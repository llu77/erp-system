/**
 * Bonus Workflow - آلة حالات البونص الأسبوعي
 *
 * - pending | rejected → requested  (المسؤول / المدير / مشرف الفرع لفرعه) بعد انتهاء الفترة وبمبلغ > 0
 * - requested → approved | rejected (المدير) - الرفض يتطلب سبباً
 * - approved → paid                 (المدير) مع حفظ المبلغ المصروف وطريقة الدفع والمرجع
 *
 * كل انتقال يتم بتحديث مشروط (WHERE status = الحالة المتوقعة) داخل معاملة مع التحقق من عدد الصفوف المتأثرة،
 * ويُسجل في سجل التدقيق بالحالة الحقيقية السابقة.
 */

import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { weeklyBonuses, bonusAuditLog, type WeeklyBonus } from "../../drizzle/schema";
import {
  REQUESTABLE_BONUS_STATUSES,
  getBonusStatusLabel,
  isBonusPeriodEnded,
  type WeeklyBonusStatus,
} from "../../shared/bonusHelpers";
import { formatBonusPeriodLabel } from "../../shared/bonus";
import { getBusinessDayKey } from "./calculator";

type DrizzleDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Tx = Parameters<Parameters<DrizzleDb["transaction"]>[0]>[0];
type WeeklyBonusPatch = Partial<typeof weeklyBonuses.$inferInsert>;

export interface TransitionResult {
  bonus: WeeklyBonus;
  oldStatus: WeeklyBonusStatus;
  newStatus: WeeklyBonusStatus;
}

async function getValidDb(): Promise<DrizzleDb> {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
  }
  return db;
}

function affectedRows(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { affectedRows?: number } | undefined)?.affectedRows ?? 0);
}

/**
 * انتقال حالة مشروط داخل معاملة
 */
async function transition(params: {
  weeklyBonusId: number;
  from: WeeklyBonusStatus[];
  to: WeeklyBonusStatus;
  performedBy: number;
  action: string;
  details: (bonus: WeeklyBonus) => string;
  /** تحقق إضافي قبل التحديث (يرمي خطأ عند الرفض) */
  guard?: (bonus: WeeklyBonus) => void;
  patch: (bonus: WeeklyBonus) => WeeklyBonusPatch;
  conflictMessage: (bonus: WeeklyBonus) => string;
}): Promise<TransitionResult> {
  const db = await getValidDb();

  return await db.transaction(async (tx: Tx) => {
    const [bonus] = await tx
      .select()
      .from(weeklyBonuses)
      .where(eq(weeklyBonuses.id, params.weeklyBonusId))
      .limit(1)
      .for("update");

    if (!bonus) {
      throw new TRPCError({ code: "NOT_FOUND", message: "البونص غير موجود" });
    }

    const oldStatus = bonus.status as WeeklyBonusStatus;
    if (!params.from.includes(oldStatus)) {
      throw new TRPCError({ code: "CONFLICT", message: params.conflictMessage(bonus) });
    }

    params.guard?.(bonus);

    const result = await tx
      .update(weeklyBonuses)
      .set({ ...params.patch(bonus), status: params.to, updatedAt: new Date() })
      .where(and(eq(weeklyBonuses.id, bonus.id), eq(weeklyBonuses.status, oldStatus)));

    if (affectedRows(result) !== 1) {
      throw new TRPCError({ code: "CONFLICT", message: "تم تعديل حالة البونص من مستخدم آخر، يرجى تحديث الصفحة" });
    }

    await tx.insert(bonusAuditLog).values({
      weeklyBonusId: bonus.id,
      action: params.action,
      oldStatus,
      newStatus: params.to,
      performedBy: params.performedBy,
      details: params.details(bonus),
    });

    const [updated] = await tx.select().from(weeklyBonuses).where(eq(weeklyBonuses.id, bonus.id)).limit(1);
    return { bonus: updated ?? bonus, oldStatus, newStatus: params.to };
  });
}

function periodLabel(bonus: Pick<WeeklyBonus, "weekNumber" | "month" | "year">): string {
  return formatBonusPeriodLabel(bonus.weekNumber, bonus.month, bonus.year);
}

/** التحقق من أن الطلب ممكن (يُستخدم أيضاً لعرض زر الطلب في الواجهة) */
export function getRequestBlocker(
  bonus: Pick<WeeklyBonus, "status" | "weekNumber" | "month" | "year" | "totalAmount">,
  todayKey: string = getBusinessDayKey()
): string | null {
  if (!REQUESTABLE_BONUS_STATUSES.includes(bonus.status as WeeklyBonusStatus)) {
    return `لا يمكن طلب صرف بونص حالته "${getBonusStatusLabel(bonus.status)}"`;
  }
  if (!isBonusPeriodEnded(bonus.weekNumber, bonus.month, bonus.year, todayKey)) {
    return `لا يمكن طلب الصرف قبل انتهاء الفترة (${periodLabel(bonus)})`;
  }
  if (!(Number(bonus.totalAmount) > 0)) {
    return "لا يوجد مبلغ بونص مستحق لهذه الفترة";
  }
  return null;
}

/**
 * طلب صرف البونص
 */
export async function requestWeeklyBonus(weeklyBonusId: number, user: { id: number; name?: string | null }) {
  return transition({
    weeklyBonusId,
    from: REQUESTABLE_BONUS_STATUSES,
    to: "requested",
    performedBy: user.id,
    action: "request",
    conflictMessage: bonus => `لا يمكن طلب صرف بونص حالته "${getBonusStatusLabel(bonus.status)}"`,
    guard: bonus => {
      const blocker = getRequestBlocker(bonus);
      if (blocker) throw new TRPCError({ code: "BAD_REQUEST", message: blocker });
    },
    patch: () => ({
      requestedAt: new Date(),
      requestedBy: user.id,
      rejectedAt: null,
      rejectedBy: null,
      rejectionReason: null,
    }),
    details: bonus =>
      `طلب صرف بونص ${periodLabel(bonus)} بمبلغ ${Number(bonus.totalAmount).toFixed(2)} ر.س` +
      (bonus.status === "rejected" ? " (إعادة طلب بعد الرفض)" : ""),
  });
}

/**
 * الموافقة على البونص (يُحفظ المبلغ المعتمد)
 */
export async function approveWeeklyBonus(weeklyBonusId: number, user: { id: number }) {
  return transition({
    weeklyBonusId,
    from: ["requested"],
    to: "approved",
    performedBy: user.id,
    action: "approve",
    conflictMessage: bonus => `لا يمكن الموافقة على بونص حالته "${getBonusStatusLabel(bonus.status)}"`,
    patch: bonus => ({
      approvedAt: new Date(),
      approvedBy: user.id,
      approvedAmount: bonus.totalAmount,
    }),
    details: bonus => `الموافقة على بونص ${periodLabel(bonus)} بمبلغ ${Number(bonus.totalAmount).toFixed(2)} ر.س`,
  });
}

/**
 * رفض البونص (السبب مطلوب)
 */
export async function rejectWeeklyBonus(weeklyBonusId: number, user: { id: number }, reason: string) {
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "سبب الرفض مطلوب" });
  }
  return transition({
    weeklyBonusId,
    from: ["requested"],
    to: "rejected",
    performedBy: user.id,
    action: "reject",
    conflictMessage: bonus => `لا يمكن رفض بونص حالته "${getBonusStatusLabel(bonus.status)}"`,
    patch: () => ({
      rejectedAt: new Date(),
      rejectedBy: user.id,
      rejectionReason: trimmed,
    }),
    details: bonus => `رفض بونص ${periodLabel(bonus)}: ${trimmed}`,
  });
}

/**
 * تسجيل صرف البونص (يُحفظ المبلغ المصروف وطريقة الدفع والمرجع)
 */
export async function markWeeklyBonusPaid(
  weeklyBonusId: number,
  user: { id: number },
  payment: { paymentMethod: "cash" | "bank_transfer" | "check"; paymentReference?: string | null; paymentNotes?: string | null }
) {
  return transition({
    weeklyBonusId,
    from: ["approved"],
    to: "paid",
    performedBy: user.id,
    action: "pay",
    conflictMessage: bonus =>
      bonus.status === "paid" ? "تم صرف هذا البونص مسبقاً" : `يجب الموافقة على البونص قبل الصرف (الحالة الحالية: ${getBonusStatusLabel(bonus.status)})`,
    patch: bonus => ({
      paidAt: new Date(),
      paidBy: user.id,
      paidAmount: bonus.approvedAmount ?? bonus.totalAmount,
      paymentMethod: payment.paymentMethod,
      paymentReference: payment.paymentReference?.trim() || null,
      paymentNotes: payment.paymentNotes?.trim() || null,
    }),
    details: bonus => {
      const amount = Number(bonus.approvedAmount ?? bonus.totalAmount).toFixed(2);
      const methods: Record<string, string> = { cash: "نقداً", bank_transfer: "تحويل بنكي", check: "شيك" };
      return `صرف بونص ${periodLabel(bonus)} بمبلغ ${amount} ر.س - طريقة الدفع: ${methods[payment.paymentMethod]}` +
        (payment.paymentReference ? ` - المرجع: ${payment.paymentReference}` : "");
    },
  });
}
