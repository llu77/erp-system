/**
 * Bonus Notifications - إشعارات سير عمل البونص
 *
 * - تُرسل فقط بعد نجاح المعاملة (لا إشعارات عند إعادة الاحتساب العادية)
 * - طلب الصرف: للمسؤولين والمديرين فقط (أصحاب صلاحية الموافقة) وليس لمشرفي الفروع
 * - الموافقة / الرفض / الصرف: لمقدم الطلب، وعند الموافقة والصرف للموظفين المستحقين عبر بوابة الموظفين
 * - أي فشل في الإشعارات لا يُفشل العملية (try/catch)
 */

import * as db from "../db";
import { notifyOwner } from "../_core/notification";
import { formatBonusPeriodLabel } from "../../shared/bonus";
import { getTierDisplayName } from "../../shared/bonusHelpers";
import type { WeeklyBonus } from "../../drizzle/schema";
import { bonusLogger } from "../utils/logger";

type Actor = { id: number; name?: string | null; role?: string | null };

const ROLE_LABELS: Record<string, string> = {
  admin: "مسؤول النظام",
  manager: "المدير",
  supervisor: "مشرف الفرع",
  viewer: "المشرف العام",
  employee: "موظف",
};

async function safe(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    bonusLogger.error(`فشل إرسال إشعار البونص (${label})`, error);
  }
}

function periodOf(bonus: Pick<WeeklyBonus, "weekNumber" | "month" | "year">): string {
  return formatBonusPeriodLabel(bonus.weekNumber, bonus.month, bonus.year);
}

function amountOf(value: string | number | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** المستخدمون أصحاب صلاحية الموافقة (المسؤول + المدير) */
async function getApproverUsers() {
  const users = await db.getAllUsers();
  return users.filter(u => u.isActive && (u.role === "admin" || u.role === "manager"));
}

/**
 * إشعار طلب صرف بونص جديد (للمسؤولين والمديرين)
 */
export async function dispatchBonusRequestedNotifications(bonus: WeeklyBonus, requester: Actor): Promise<void> {
  const branch = await db.getBranchById(bonus.branchId).catch(() => undefined);
  const branchName = branch?.nameAr || "غير محدد";
  const label = periodOf(bonus);
  const total = amountOf(bonus.totalAmount);
  const requesterName = requester.name || "مستخدم";
  const title = "طلب صرف بونص جديد";
  const message = `${branchName} - فترة ${label}: طلب صرف بونص بمبلغ ${total.toFixed(2)} ر.س بواسطة ${requesterName}`;

  // 1. إشعارات داخل النظام للمسؤولين والمديرين
  await safe("in-app approvers", async () => {
    const approvers = await getApproverUsers();
    for (const approver of approvers) {
      if (approver.id === requester.id) continue;
      await db.createNotification({
        userId: approver.id,
        type: "system",
        title,
        message,
        relatedId: bonus.id,
        relatedType: "weeklyBonus",
      });
    }
  });

  // 2. إشعار المالك
  await safe("owner", () => notifyOwner({ title, content: message }));

  // 3. بريد إلكتروني للمعتمدين فقط مع أسماء المستويات المحفوظة
  await safe("email approvers", async () => {
    const details = await db.getBonusDetails(bonus.id);
    const eligible = details.filter(d => d.isEligible);
    const emailService = await import("../notifications/emailNotificationService");
    await emailService.notifyAdvancedBonusPaymentRequest({
      branchId: bonus.branchId,
      branchName,
      weekNumber: bonus.weekNumber,
      month: bonus.month,
      year: bonus.year,
      periodLabel: label,
      totalAmount: total,
      eligibleCount: eligible.length,
      totalEmployees: details.length,
      requestedBy: requesterName,
      requestedByRole: ROLE_LABELS[requester.role ?? ""] ?? "مستخدم",
      employees: eligible.map(d => ({
        name: d.employeeName || "غير محدد",
        code: d.employeeCode || "",
        weeklyRevenue: amountOf(d.weeklyRevenue),
        tier: d.bonusTier || "none",
        tierName: getTierDisplayName(d.bonusTier, d.tierName),
        bonusAmount: amountOf(d.bonusAmount),
      })),
    });
  });
}

/**
 * إشعار نتيجة الطلب (موافقة / رفض / صرف)
 */
export async function dispatchBonusDecisionNotifications(
  bonus: WeeklyBonus,
  decision: "approved" | "rejected" | "paid",
  actor: Actor
): Promise<void> {
  const branch = await db.getBranchById(bonus.branchId).catch(() => undefined);
  const branchName = branch?.nameAr || "غير محدد";
  const label = periodOf(bonus);
  const amount =
    decision === "paid"
      ? amountOf(bonus.paidAmount ?? bonus.approvedAmount ?? bonus.totalAmount)
      : decision === "approved"
        ? amountOf(bonus.approvedAmount ?? bonus.totalAmount)
        : amountOf(bonus.totalAmount);
  const actorName = actor.name || "المدير";

  const titles: Record<typeof decision, string> = {
    approved: "تمت الموافقة على طلب البونص",
    rejected: "تم رفض طلب البونص",
    paid: "تم صرف البونص",
  };
  const messages: Record<typeof decision, string> = {
    approved: `تمت الموافقة على بونص ${branchName} لفترة ${label} بمبلغ ${amount.toFixed(2)} ر.س بواسطة ${actorName}`,
    rejected: `تم رفض بونص ${branchName} لفترة ${label} بواسطة ${actorName}. السبب: ${bonus.rejectionReason || "غير محدد"}`,
    paid: `تم صرف بونص ${branchName} لفترة ${label} بمبلغ ${amount.toFixed(2)} ر.س بواسطة ${actorName}`,
  };

  // 1. إشعار مقدم الطلب داخل النظام
  if (bonus.requestedBy && bonus.requestedBy !== actor.id) {
    await safe("in-app requester", () =>
      db.createNotification({
        userId: bonus.requestedBy!,
        type: "system",
        title: titles[decision],
        message: messages[decision],
        relatedId: bonus.id,
        relatedType: "weeklyBonus",
      })
    );
  }

  // 2. إشعار الموظفين المستحقين عبر بوابة الموظفين (عند الموافقة والصرف فقط)
  if (decision === "approved" || decision === "paid") {
    await safe("portal employees", async () => {
      const details = await db.getBonusDetails(bonus.id);
      const portal = await import("../services/portalNotificationService");
      for (const detail of details) {
        const employeeAmount = amountOf(detail.bonusAmount);
        if (!detail.isEligible || employeeAmount <= 0) continue;
        await portal.createNotification({
          employeeId: detail.employeeId,
          type: "bonus_approved",
          title: decision === "paid" ? "تم صرف البونص" : "تمت الموافقة على البونص",
          message:
            decision === "paid"
              ? `تم صرف بونص فترة ${label} بقيمة ${employeeAmount.toFixed(2)} ر.س`
              : `تمت الموافقة على بونص فترة ${label} بقيمة ${employeeAmount.toFixed(2)} ر.س (${getTierDisplayName(detail.bonusTier, detail.tierName)})`,
          actionUrl: "/employee-portal?tab=bonus",
          actionLabel: "عرض التفاصيل",
          metadata: { amount: employeeAmount, branchId: bonus.branchId, branchName },
          priority: "normal",
        });
      }
    });
  }
}

/** تشغيل الإشعارات بعد الاستجابة دون انتظار (الأخطاء تُسجل فقط) */
export function runAfterCommit(label: string, fn: () => Promise<void>): void {
  setImmediate(() => {
    fn().catch(error => bonusLogger.error(`فشل إشعارات البونص بعد الحفظ (${label})`, error));
  });
}
