/**
 * Bonus Recompute - إعادة احتساب البونص الأسبوعي (المسار الوحيد)
 *
 * @version 3.0.0
 * - دالة واحدة recomputeWeeklyBonus(branchId, year, month, weekNumber) داخل معاملة واحدة
 * - قفل صف الفرع (SELECT ... FOR UPDATE) لمنع التكرار عند الكتابة المتزامنة لنفس الفرع
 * - المستويات من إعدادات المدير (bonusTierSettings)
 * - الفترات المقفلة (requested / approved / paid) لا تتغير ويُسجل الفرق في سجل التدقيق
 * - الفترة المرفوضة يُعاد احتسابها وتعود "قيد الاحتساب"
 * - عدم تطابق إيراد الفرع مع إيرادات الموظفين تحذير فقط وليس مانعاً
 * - لا يتم إرسال أي إشعارات عند إعادة الاحتساب العادية
 */

import { getDb } from "../db";
import {
  dailyRevenues,
  employeeRevenues,
  weeklyBonuses,
  bonusDetails,
  bonusAuditLog,
  employees,
  branches,
} from "../../drizzle/schema";
import { eq, and, gte, lte, sql, inArray, desc } from "drizzle-orm";
import {
  getWeekDateRange,
  validateWeekData,
  getBonusPeriodForStoredDate,
  getBusinessDayKey,
  type WeekValidation,
} from "./calculator";
import { loadActiveBonusTiers } from "./tiers";
import {
  computeEmployeeBonuses,
  planDetailWrites,
  decideRecomputeAction,
  pickWeeklyBonusRow,
  hasMeaningfulChange,
  sumBonusAmounts,
  sumRevenues,
  buildRevenueMismatchWarning,
} from "./recomputePlan";
import { getBonusStatusLabel, isValidBonusPeriod, toDayKey, type WeeklyBonusStatus } from "../../shared/bonusHelpers";
import { getBonusPeriodDays, getBonusPeriodsInMonth, type BonusTierRule } from "../../shared/bonus";

// ==================== Types ====================

type DrizzleDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Tx = Parameters<Parameters<DrizzleDb["transaction"]>[0]>[0];

export interface RecomputeOptions {
  /** المستويات (تُحمل مرة واحدة إذا لم تمرر) */
  tiers?: BonusTierRule[];
  /** المستخدم المسبب لإعادة الاحتساب (لسجل التدقيق) */
  performedBy?: number | null;
  /** سبب إعادة الاحتساب (للتسجيل) */
  reason?: string;
}

export interface RecomputeResult {
  success: boolean;
  message: string;
  branchId: number;
  year: number;
  month: number;
  weekNumber: number;
  weeklyBonusId: number | null;
  status: WeeklyBonusStatus | null;
  /** الفترة مقفلة (تم طلبها/اعتمادها/صرفها) ولم تتغير مبالغها */
  locked: boolean;
  /** تمت إعادة فترة مرفوضة إلى "قيد الاحتساب" */
  statusReset: boolean;
  previousTotal: number;
  /** الإجمالي المحفوظ بعد العملية */
  totalAmount: number;
  /** الإجمالي حسب الإيرادات الحالية */
  computedTotal: number;
  employeeCount: number;
  eligibleCount: number;
  warnings: string[];
  validation?: {
    daysValidation: WeekValidation;
    branchCashNetwork: number;
    employeesRevenue: number;
    daysWithoutEmployees: number;
  };
  errors?: string[];
}

// ==================== Helpers ====================

async function getValidDb(): Promise<DrizzleDb> {
  const db = await getDb();
  if (!db) {
    throw new Error("DB_CONNECTION_FAILED: فشل الاتصال بقاعدة البيانات");
  }
  return db;
}

/** قفل صف الفرع حتى نهاية المعاملة (تسلسل الكتابة لنفس الفرع) */
export async function lockBranchRow(tx: Tx, branchId: number): Promise<boolean> {
  const result = (await tx.execute(sql`SELECT id FROM branches WHERE id = ${branchId} FOR UPDATE`)) as unknown;
  const rows = Array.isArray(result) ? (result[0] as unknown) : result;
  return Array.isArray(rows) ? rows.length > 0 : true;
}

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function emptyResult(branchId: number, year: number, month: number, weekNumber: number, message: string): RecomputeResult {
  return {
    success: false,
    message,
    branchId,
    year,
    month,
    weekNumber,
    weeklyBonusId: null,
    status: null,
    locked: false,
    statusReset: false,
    previousTotal: 0,
    totalAmount: 0,
    computedTotal: 0,
    employeeCount: 0,
    eligibleCount: 0,
    warnings: [],
    errors: [message],
  };
}

// ==================== Main Recompute ====================

/**
 * إعادة احتساب بونص فترة واحدة لفرع واحد (داخل معاملة مع قفل صف الفرع)
 */
export async function recomputeWeeklyBonus(
  branchId: number,
  year: number,
  month: number,
  weekNumber: number,
  options: RecomputeOptions = {}
): Promise<RecomputeResult> {
  if (!isValidBonusPeriod(weekNumber, month, year)) {
    return emptyResult(branchId, year, month, weekNumber, `الفترة ${weekNumber} غير موجودة في الشهر ${month}/${year}`);
  }

  try {
    const db = await getValidDb();
    const tiers = options.tiers ?? (await loadActiveBonusTiers()).tiers;
    const { start, end } = getWeekDateRange(weekNumber, month, year);

    return await db.transaction(async (tx) => {
      const branchExists = await lockBranchRow(tx, branchId);
      if (!branchExists) {
        throw new Error("NOT_FOUND: الفرع غير موجود");
      }

      // ===== 1. الإيرادات اليومية للفرع في الفترة =====
      const days = await tx
        .select({
          id: dailyRevenues.id,
          date: dailyRevenues.date,
          cash: dailyRevenues.cash,
          network: dailyRevenues.network,
        })
        .from(dailyRevenues)
        .where(and(eq(dailyRevenues.branchId, branchId), gte(dailyRevenues.date, start), lte(dailyRevenues.date, end)));

      const dayIds = days.map(d => d.id);

      // ===== 2. إيرادات الموظفين في الفترة (بغض النظر عن فرعهم الحالي أو حالتهم) =====
      const revenueRows = dayIds.length
        ? await tx
            .select({
              dailyRevenueId: employeeRevenues.dailyRevenueId,
              employeeId: employeeRevenues.employeeId,
              total: employeeRevenues.total,
            })
            .from(employeeRevenues)
            .where(inArray(employeeRevenues.dailyRevenueId, dayIds))
        : [];

      const revenueByEmployee = new Map<number, number>();
      const daysWithEmployees = new Set<number>();
      for (const row of revenueRows) {
        revenueByEmployee.set(row.employeeId, (revenueByEmployee.get(row.employeeId) ?? 0) + toNumber(row.total));
        daysWithEmployees.add(row.dailyRevenueId);
      }

      // ===== 3. الموظفون النشطون حالياً في الفرع =====
      const activeEmployees = await tx
        .select({ id: employees.id })
        .from(employees)
        .where(and(eq(employees.branchId, branchId), eq(employees.isActive, true)));

      // ===== 4. الحساب =====
      const computed = computeEmployeeBonuses(revenueByEmployee, activeEmployees.map(e => e.id), tiers);
      const computedTotal = sumBonusAmounts(computed);
      const computedRevenue = sumRevenues(computed);
      const eligibleCount = computed.filter(c => c.isEligible).length;

      // ===== 5. التحذيرات (لا تمنع الاحتساب) =====
      const warnings: string[] = [];
      const branchCashNetwork = Math.round(days.reduce((s, d) => s + toNumber(d.cash) + toNumber(d.network), 0) * 100) / 100;
      const mismatch = buildRevenueMismatchWarning(branchCashNetwork, computedRevenue);
      if (mismatch) warnings.push(mismatch);
      const daysWithoutEmployees = days.filter(d => !daysWithEmployees.has(d.id)).length;
      if (daysWithoutEmployees > 0) {
        warnings.push(`يوجد ${daysWithoutEmployees} يوم بإيراد للفرع بدون توزيع على الموظفين (استخدم "إعادة احتساب من الكاشير")`);
      }
      const daysValidation = validateWeekData(weekNumber, month, year, days.map(d => new Date(d.date)));
      if (!daysValidation.isValid) warnings.push(daysValidation.message);

      // ===== 6. سجل البونص الأسبوعي =====
      const existingRows = await tx
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
      if (existingRows.length > 1) {
        warnings.push(`يوجد ${existingRows.length} سجلات مكررة لنفس الفترة - تم استخدام سجل واحد فقط`);
      }

      let weekly = pickWeeklyBonusRow(existingRows);
      if (!weekly) {
        const inserted = await tx.insert(weeklyBonuses).values({
          branchId,
          weekNumber,
          weekStart: start,
          weekEnd: end,
          month,
          year,
          status: "pending",
          totalAmount: "0.00",
        });
        const insertId = Number((inserted as any)?.[0]?.insertId);
        const [created] = await tx.select().from(weeklyBonuses).where(eq(weeklyBonuses.id, insertId)).limit(1);
        if (!created) throw new Error("فشل إنشاء سجل البونص الأسبوعي");
        weekly = created;
      }

      const weeklyBonusId = weekly.id;
      const previousTotal = toNumber(weekly.totalAmount);
      const action = decideRecomputeAction(weekly.status);
      const baseResult = {
        branchId,
        year,
        month,
        weekNumber,
        weeklyBonusId,
        previousTotal,
        computedTotal,
        employeeCount: computed.length,
        eligibleCount,
        validation: { daysValidation, branchCashNetwork, employeesRevenue: computedRevenue, daysWithoutEmployees },
      };

      // ===== 7. فترة مقفلة: لا تعديل، تسجيل الفرق فقط =====
      if (action === "locked") {
        const existingDetails = await tx
          .select({ weeklyRevenue: bonusDetails.weeklyRevenue })
          .from(bonusDetails)
          .where(eq(bonusDetails.weeklyBonusId, weeklyBonusId));
        const previousRevenue = sumRevenues(existingDetails);

        if (hasMeaningfulChange(previousTotal, computedTotal) || hasMeaningfulChange(previousRevenue, computedRevenue)) {
          const details =
            `تغيرت إيرادات الفترة بعد قفلها (${getBonusStatusLabel(weekly.status)}): ` +
            `البونص المسجل ${previousTotal.toFixed(2)} ر.س ← حسب الإيرادات الحالية ${computedTotal.toFixed(2)} ر.س؛ ` +
            `الإيراد المسجل ${previousRevenue.toFixed(2)} ر.س ← الحالي ${computedRevenue.toFixed(2)} ر.س`;

          // تجنب تكرار نفس التسجيل
          const [lastEntry] = await tx
            .select({ details: bonusAuditLog.details })
            .from(bonusAuditLog)
            .where(and(eq(bonusAuditLog.weeklyBonusId, weeklyBonusId), eq(bonusAuditLog.action, "revenue_changed_after_lock")))
            .orderBy(desc(bonusAuditLog.id))
            .limit(1);

          if (!lastEntry || lastEntry.details !== details) {
            await tx.insert(bonusAuditLog).values({
              weeklyBonusId,
              action: "revenue_changed_after_lock",
              oldStatus: weekly.status,
              newStatus: weekly.status,
              performedBy: options.performedBy ?? 0,
              details,
            });
          }
          warnings.push(
            `الفترة ${getBonusStatusLabel(weekly.status)} ولم يتم تعديل مبالغها؛ البونص حسب الإيرادات الحالية ${computedTotal.toFixed(2)} ر.س بدلاً من ${previousTotal.toFixed(2)} ر.س`
          );
        }

        return {
          ...baseResult,
          success: true,
          message: `الفترة مقفلة (${getBonusStatusLabel(weekly.status)}) - لم يتم تعديل البونص`,
          status: weekly.status as WeeklyBonusStatus,
          locked: true,
          statusReset: false,
          totalAmount: previousTotal,
          warnings,
        };
      }

      // ===== 8. تحديث التفاصيل =====
      const existingDetails = await tx
        .select({ id: bonusDetails.id, employeeId: bonusDetails.employeeId })
        .from(bonusDetails)
        .where(eq(bonusDetails.weeklyBonusId, weeklyBonusId));

      const plan = planDetailWrites(existingDetails, computed);

      for (const item of plan.toUpdate) {
        await tx
          .update(bonusDetails)
          .set({
            weeklyRevenue: item.data.weeklyRevenue.toFixed(2),
            bonusAmount: item.data.bonusAmount.toFixed(2),
            bonusTier: item.data.bonusTier,
            tierName: item.data.tierName,
            isEligible: item.data.isEligible,
            updatedAt: new Date(),
          })
          .where(eq(bonusDetails.id, item.id));
      }

      if (plan.toInsert.length > 0) {
        await tx.insert(bonusDetails).values(
          plan.toInsert.map(c => ({
            weeklyBonusId,
            employeeId: c.employeeId,
            weeklyRevenue: c.weeklyRevenue.toFixed(2),
            bonusAmount: c.bonusAmount.toFixed(2),
            bonusTier: c.bonusTier,
            tierName: c.tierName,
            isEligible: c.isEligible,
          }))
        );
      }

      if (plan.toDeleteIds.length > 0) {
        await tx.delete(bonusDetails).where(inArray(bonusDetails.id, plan.toDeleteIds));
      }

      // الإجمالي = مجموع التفاصيل من نفس المعاملة
      const [sumRow] = await tx
        .select({ total: sql<string>`COALESCE(SUM(${bonusDetails.bonusAmount}), 0)` })
        .from(bonusDetails)
        .where(eq(bonusDetails.weeklyBonusId, weeklyBonusId));
      const totalAmount = toNumber(sumRow?.total);

      const statusReset = action === "reset_rejected";
      await tx
        .update(weeklyBonuses)
        .set({
          totalAmount: totalAmount.toFixed(2),
          weekStart: start,
          weekEnd: end,
          ...(statusReset ? { status: "pending" as const } : {}),
          updatedAt: new Date(),
        })
        .where(eq(weeklyBonuses.id, weeklyBonusId));

      if (statusReset) {
        await tx.insert(bonusAuditLog).values({
          weeklyBonusId,
          action: "reset_after_rejection",
          oldStatus: "rejected",
          newStatus: "pending",
          performedBy: options.performedBy ?? 0,
          details: `إعادة احتساب الفترة المرفوضة بعد تحديث الإيرادات: ${previousTotal.toFixed(2)} ر.س ← ${totalAmount.toFixed(2)} ر.س${options.reason ? ` (${options.reason})` : ""}`,
        });
      }

      return {
        ...baseResult,
        success: true,
        message: statusReset
          ? `تم إعادة احتساب البونص وإعادة الفترة المرفوضة إلى "قيد الاحتساب" (${computed.length} موظف)`
          : `تم احتساب البونص لـ ${computed.length} موظف${warnings.length ? " (مع تحذيرات)" : ""}`,
        status: statusReset ? "pending" : (weekly.status as WeeklyBonusStatus),
        locked: false,
        statusReset,
        totalAmount,
        warnings,
      };
    });
  } catch (error) {
    console.error("[Bonus Recompute] Error:", error);
    const message = error instanceof Error ? error.message : "خطأ غير معروف";
    return emptyResult(branchId, year, month, weekNumber, `فشل احتساب البونص: ${message}`);
  }
}

/**
 * إعادة احتساب الفترات المتأثرة بتواريخ إيرادات مخزنة (كل فترة مرة واحدة)
 */
export async function recomputeBonusForStoredDates(
  branchId: number,
  dates: Date[],
  options: RecomputeOptions = {}
): Promise<RecomputeResult[]> {
  const periods = new Map<string, { year: number; month: number; weekNumber: number }>();
  for (const date of dates) {
    const p = getBonusPeriodForStoredDate(date);
    periods.set(`${p.year}-${p.month}-${p.weekNumber}`, p);
  }
  if (periods.size === 0) return [];

  const tiers = options.tiers ?? (await loadActiveBonusTiers()).tiers;
  const results: RecomputeResult[] = [];
  for (const p of Array.from(periods.values())) {
    results.push(await recomputeWeeklyBonus(branchId, p.year, p.month, p.weekNumber, { ...options, tiers }));
  }
  return results;
}

/**
 * إعادة احتساب الفترات المفتوحة (قيد الاحتساب) لشهر معين لكل الفروع النشطة
 * تُستخدم بعد تعديل المستويات
 */
export async function recomputeOpenPeriodsForMonth(
  year: number,
  month: number,
  options: RecomputeOptions & { branchIds?: number[] } = {}
): Promise<{ recomputed: number; skipped: number; failed: number; results: RecomputeResult[] }> {
  const db = await getValidDb();
  const tiers = options.tiers ?? (await loadActiveBonusTiers({ fresh: true })).tiers;

  const branchRows = options.branchIds?.length
    ? options.branchIds.map(id => ({ id }))
    : await db.select({ id: branches.id }).from(branches).where(eq(branches.isActive, true));

  const existing = await db
    .select({ id: weeklyBonuses.id, branchId: weeklyBonuses.branchId, weekNumber: weeklyBonuses.weekNumber, status: weeklyBonuses.status })
    .from(weeklyBonuses)
    .where(and(eq(weeklyBonuses.year, year), eq(weeklyBonuses.month, month)));

  const todayKey = getBusinessDayKey();
  const periodsCount = getBonusPeriodsInMonth(month, year);
  const results: RecomputeResult[] = [];
  let skipped = 0;

  for (const branch of branchRows) {
    for (let weekNumber = 1; weekNumber <= periodsCount; weekNumber++) {
      // لا نحتسب الفترات المستقبلية
      const { startDay } = getBonusPeriodDays(weekNumber, month, year);
      if (toDayKey(year, month, startDay) > todayKey) continue;

      const rows = existing.filter(r => r.branchId === branch.id && r.weekNumber === weekNumber);
      const isOpen = rows.length === 0 || rows.every(r => r.status === "pending");
      if (!isOpen) {
        skipped++;
        continue;
      }
      results.push(await recomputeWeeklyBonus(branch.id, year, month, weekNumber, { ...options, tiers }));
    }
  }

  return {
    recomputed: results.filter(r => r.success).length,
    skipped,
    failed: results.filter(r => !r.success).length,
    results,
  };
}

/**
 * إعادة احتساب جميع فترات شهر لفرع (تحترم قاعدة القفل)
 */
export async function recalculateMonthlyBonuses(
  branchId: number,
  month: number,
  year: number,
  options: RecomputeOptions = {}
): Promise<{ success: boolean; message: string; results: RecomputeResult[] }> {
  const tiers = options.tiers ?? (await loadActiveBonusTiers()).tiers;
  const weeksCount = getBonusPeriodsInMonth(month, year);
  const results: RecomputeResult[] = [];

  for (let week = 1; week <= weeksCount; week++) {
    results.push(await recomputeWeeklyBonus(branchId, year, month, week, { ...options, tiers }));
  }

  const successCount = results.filter(r => r.success).length;
  return {
    success: successCount === weeksCount,
    message: `تم احتساب ${successCount}/${weeksCount} فترة`,
    results,
  };
}

/**
 * توافق مع الاستدعاءات القديمة: تزامن فترة لفرع
 */
export async function syncWeeklyBonusForBranch(
  branchId: number,
  weekNumber: number,
  month: number,
  year: number,
  options: RecomputeOptions = {}
): Promise<RecomputeResult> {
  return recomputeWeeklyBonus(branchId, year, month, weekNumber, options);
}
