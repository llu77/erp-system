/**
 * Bonus Views - تجهيز بيانات البونص للعرض في الواجهة
 */

import { and, eq } from "drizzle-orm";
import * as db from "../db";
import { weeklyBonuses, type WeeklyBonus } from "../../drizzle/schema";
import { formatBonusPeriodLabel, revenueToNextTier, type BonusTierRule } from "../../shared/bonus";
import {
  getBonusStatusLabel,
  getTierDisplayName,
  isBonusPeriodEnded,
  isLockedBonusStatus,
  type WeeklyBonusStatus,
} from "../../shared/bonusHelpers";
import { getBusinessDayKey, getCurrentBonusPeriod, getWeekDateRange } from "./calculator";
import { pickWeeklyBonusRow } from "./recomputePlan";
import { getRequestBlocker } from "./workflow";
import { loadActiveBonusTiers } from "./tiers";
import { bonusLogger } from "../utils/logger";

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

type DetailRow = Awaited<ReturnType<typeof db.getBonusDetails>>[number];

function decorateDetail(detail: DetailRow, tiers: BonusTierRule[], showNextTier: boolean) {
  const revenue = toNumber(detail.weeklyRevenue);
  const next = showNextTier ? revenueToNextTier(revenue, tiers) : { nextTier: null, remaining: 0 };
  return {
    ...detail,
    tierLabel: getTierDisplayName(detail.bonusTier, detail.tierName, tiers),
    nextTierName: next.nextTier?.tierName ?? null,
    nextTierAmount: next.nextTier?.bonusAmount ?? null,
    remainingToNextTier: next.nextTier ? Math.round(next.remaining * 100) / 100 : null,
  };
}

type BonusActorIds = Pick<WeeklyBonus, "requestedBy" | "approvedBy" | "rejectedBy" | "paidBy">;

/** أسماء من طلب واعتمد ورفض وصرف (تظهر في التقرير المطبوع) */
function bonusActorNames(row: BonusActorIds, userNames: Map<number, string>) {
  const nameOf = (id: number | null) => (id ? userNames.get(id) ?? null : null);
  return {
    requestedByName: nameOf(row.requestedBy),
    approvedByName: nameOf(row.approvedBy),
    rejectedByName: nameOf(row.rejectedBy),
    paidByName: nameOf(row.paidBy),
  };
}

async function loadActorNames(row: BonusActorIds): Promise<Map<number, string>> {
  const ids = Array.from(new Set([row.requestedBy, row.approvedBy, row.rejectedBy, row.paidBy].filter((id): id is number => !!id)));
  const names = new Map<number, string>();
  // الأسماء للعرض فقط: فشل قراءتها لا يُسقط عرض البونص (تظهر "-")
  try {
    for (const user of await Promise.all(ids.map(id => db.getUserById(id)))) {
      if (user) names.set(user.id, user.name || user.username || `#${user.id}`);
    }
  } catch (error) {
    bonusLogger.error("تعذر تحميل أسماء منفذي إجراءات البونص", error);
  }
  return names;
}

/** سجل الفترة (مع معالجة السجلات المكررة القديمة) */
export async function findWeeklyBonus(branchId: number, year: number, month: number, weekNumber: number): Promise<WeeklyBonus | null> {
  const database = await db.getDb();
  if (!database) return null;
  const rows = await database
    .select()
    .from(weeklyBonuses)
    .where(
      and(
        eq(weeklyBonuses.branchId, branchId),
        eq(weeklyBonuses.year, year),
        eq(weeklyBonuses.month, month),
        eq(weeklyBonuses.weekNumber, weekNumber)
      )
    );
  return pickWeeklyBonusRow(rows);
}

/**
 * عرض بونص فترة لفرع (موجودة أو لم تُحتسب بعد)
 */
export async function getBonusPeriodView(branchId: number, year: number, month: number, weekNumber: number) {
  const { tiers } = await loadActiveBonusTiers();
  const todayKey = getBusinessDayKey();
  const current = getCurrentBonusPeriod();
  const isCurrentPeriod = current.year === year && current.month === month && current.weekNumber === weekNumber;
  const periodEnded = isBonusPeriodEnded(weekNumber, month, year, todayKey);
  const periodLabel = formatBonusPeriodLabel(weekNumber, month, year);
  const branch = await db.getBranchById(branchId);
  const branchName = branch?.nameAr || "غير محدد";

  const weekly = await findWeeklyBonus(branchId, year, month, weekNumber);

  if (!weekly) {
    const { start, end } = getWeekDateRange(weekNumber, month, year);
    const branchEmployees = await db.getEmployeesByBranch(branchId);
    const details = branchEmployees
      .filter(emp => emp.isActive !== false)
      .map(emp =>
        decorateDetail(
          {
            id: 0,
            employeeId: emp.id,
            employeeName: emp.name,
            employeeCode: emp.code,
            weeklyRevenue: "0.00",
            bonusAmount: "0.00",
            bonusTier: "none",
            tierName: null,
            isEligible: false,
          },
          tiers,
          !periodEnded
        )
      );

    return {
      id: 0,
      exists: false,
      branchId,
      branchName,
      year,
      month,
      weekNumber,
      weekStart: start,
      weekEnd: end,
      periodLabel,
      status: "pending" as WeeklyBonusStatus,
      statusLabel: getBonusStatusLabel("pending"),
      totalAmount: "0.00",
      approvedAmount: null as string | null,
      paidAmount: null as string | null,
      requestedAt: null as Date | null,
      approvedAt: null as Date | null,
      rejectedAt: null as Date | null,
      rejectionReason: null as string | null,
      paidAt: null as Date | null,
      paymentMethod: null as string | null,
      paymentReference: null as string | null,
      requestedByName: null as string | null,
      approvedByName: null as string | null,
      rejectedByName: null as string | null,
      paidByName: null as string | null,
      details,
      eligibleCount: 0,
      totalEmployees: details.length,
      totalRevenue: 0,
      hasRevenues: false,
      isCurrentPeriod,
      periodEnded,
      locked: false,
      canRequest: false,
      requestBlocker: "لم يتم احتساب البونص لهذه الفترة بعد",
      message: "لم يتم إدخال إيرادات لهذه الفترة بعد",
    };
  }

  const locked = isLockedBonusStatus(weekly.status);
  const rawDetails = await db.getBonusDetails(weekly.id);
  const details = rawDetails.map(d => decorateDetail(d, tiers, !locked && !periodEnded));
  const totalRevenue = details.reduce((sum, d) => sum + toNumber(d.weeklyRevenue), 0);
  const requestBlocker = getRequestBlocker(weekly, todayKey);
  const actorNames = bonusActorNames(weekly, await loadActorNames(weekly));

  return {
    ...weekly,
    ...actorNames,
    exists: true,
    branchName,
    periodLabel,
    statusLabel: getBonusStatusLabel(weekly.status),
    details,
    eligibleCount: details.filter(d => d.isEligible).length,
    totalEmployees: details.length,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    hasRevenues: totalRevenue > 0,
    isCurrentPeriod,
    periodEnded,
    locked,
    canRequest: requestBlocker === null,
    requestBlocker,
    message: null as string | null,
  };
}

/**
 * إضافة اسم الفرع والتفاصيل والأسماء لقائمة سجلات بونص (لصفحة الطلبات)
 */
export async function enrichWeeklyBonusRows(rows: WeeklyBonus[]) {
  if (rows.length === 0) return [];
  const [branchesList, usersList] = await Promise.all([db.getBranches(), db.getAllUsers()]);
  const branchNames = new Map(branchesList.map(b => [b.id, b.nameAr || b.name]));
  const userNames = new Map(usersList.map(u => [u.id, u.name || u.username || `#${u.id}`]));
  const todayKey = getBusinessDayKey();

  const result = [];
  for (const row of rows) {
    const details = await db.getBonusDetails(row.id);
    result.push({
      ...row,
      branchName: branchNames.get(row.branchId) || "غير محدد",
      periodLabel: formatBonusPeriodLabel(row.weekNumber, row.month, row.year),
      statusLabel: getBonusStatusLabel(row.status),
      ...bonusActorNames(row, userNames),
      details: details.map(d => ({ ...d, tierLabel: getTierDisplayName(d.bonusTier, d.tierName) })),
      eligibleCount: details.filter(d => d.isEligible).length,
      totalEmployees: details.length,
      totalRevenue: Math.round(details.reduce((sum, d) => sum + toNumber(d.weeklyRevenue), 0) * 100) / 100,
      canRequest: getRequestBlocker(row, todayKey) === null,
    });
  }
  return result;
}
