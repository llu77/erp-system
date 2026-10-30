/**
 * POS → Bonus Rebuild - إعادة احتساب إيرادات الموظفين من فواتير الكاشير
 *
 * للأيام المؤكدة من الكاشير قبل ربطها بالبونص (لا تحتوي على إيرادات موظفين):
 * - تُبنى إيرادات كل موظف من فواتير ذلك اليوم المكتملة فقط
 * - يُصحح تاريخ اليوم ليوم العمل (منتصف الليل UTC) ويُعلم كمؤكد من الكاشير
 * - لا تُعدل إجماليات الإيراد اليومي (صفحة الإيرادات هي المرجع)
 * - بعد الحفظ يُعاد احتساب الفترات المتأثرة (مع احترام قفل الفترات المطلوبة/المعتمدة/المصروفة)
 */

import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  dailyRevenues,
  employeeRevenues,
  posInvoices,
} from "../../drizzle/schema";
import { aggregatePosInvoices } from "./posRevenue";
import {
  businessDayKeyToLocalDate,
  businessDayKeyToStoredDate,
  getBusinessDayKey,
  parseBusinessDayKey,
} from "./calculator";
import { loadActiveBonusTiers } from "./tiers";
import {
  lockBranchRow,
  recomputeBonusForStoredDates,
  type RecomputeResult,
} from "./sync";

export interface PosRebuildDayResult {
  dailyRevenueId: number;
  branchId: number;
  businessDay: string;
  status: "rebuilt" | "skipped" | "failed";
  reason?: string;
  employeesCount?: number;
  employeesTotal?: number;
  branchTotal?: number;
}

export interface PosRebuildResult {
  scanned: number;
  rebuilt: number;
  skipped: number;
  failed: number;
  days: PosRebuildDayResult[];
  periods: RecomputeResult[];
  warnings: string[];
}

/**
 * إعادة بناء إيرادات الموظفين من فواتير الكاشير لشهر معين
 */
export async function rebuildEmployeeRevenuesFromPos(params: {
  branchId?: number | null;
  year: number;
  month: number;
  performedBy?: number | null;
}): Promise<PosRebuildResult> {
  const db = await getDb();
  if (!db) throw new Error("DB_CONNECTION_FAILED: فشل الاتصال بقاعدة البيانات");

  const { year, month } = params;

  // نطاق أوسع بيوم من كل جهة لالتقاط الأيام المخزنة بتوقيت محلي، ثم التصفية حسب يوم العمل
  const rangeStart = new Date(
    Date.UTC(year, month - 1, 1) - 24 * 60 * 60 * 1000
  );
  const rangeEnd = new Date(Date.UTC(year, month, 1) + 24 * 60 * 60 * 1000 - 1);

  const conditions = [
    gte(dailyRevenues.date, rangeStart),
    lte(dailyRevenues.date, rangeEnd),
  ];
  if (params.branchId)
    conditions.push(eq(dailyRevenues.branchId, params.branchId));

  const rows = await db
    .select({
      id: dailyRevenues.id,
      branchId: dailyRevenues.branchId,
      date: dailyRevenues.date,
      total: dailyRevenues.total,
      posConfirmed: dailyRevenues.posConfirmed,
    })
    .from(dailyRevenues)
    .where(and(...conditions));

  const inMonth = rows.filter(r => {
    const key = getBusinessDayKey(new Date(r.date));
    const parsed = parseBusinessDayKey(key);
    return parsed.year === year && parsed.month === month;
  });

  const ids = inMonth.map(r => r.id);
  const withEmployees = ids.length
    ? await db
        .selectDistinct({ dailyRevenueId: employeeRevenues.dailyRevenueId })
        .from(employeeRevenues)
        .where(inArray(employeeRevenues.dailyRevenueId, ids))
    : [];
  const hasEmployees = new Set(withEmployees.map(r => r.dailyRevenueId));
  // أيام الكاشير المؤكدة فقط (الأيام المدخلة يدوياً لها إيرادات موظفين من الإدخال نفسه)
  const candidates = inMonth.filter(
    r => r.posConfirmed && !hasEmployees.has(r.id)
  );

  const days: PosRebuildDayResult[] = [];
  const affectedDates = new Map<number, Date[]>();
  const warnings: string[] = [];

  for (const row of candidates) {
    const businessDay = getBusinessDayKey(new Date(row.date));
    const localStart = businessDayKeyToLocalDate(businessDay);
    const localEnd = new Date(localStart);
    localEnd.setHours(23, 59, 59, 999);
    const storedDate = businessDayKeyToStoredDate(businessDay);

    let dayResult: PosRebuildDayResult;
    try {
      dayResult = await db.transaction(
        async (tx): Promise<PosRebuildDayResult> => {
          await lockBranchRow(tx, row.branchId);

          // إعادة التحقق داخل المعاملة (منع التكرار عند التشغيل المتزامن)
          const [existing] = await tx
            .select({ count: sql<number>`COUNT(*)` })
            .from(employeeRevenues)
            .where(eq(employeeRevenues.dailyRevenueId, row.id));
          if (Number(existing?.count || 0) > 0) {
            return {
              dailyRevenueId: row.id,
              branchId: row.branchId,
              businessDay,
              status: "skipped" as const,
              reason: "تمت إعادة البناء مسبقاً",
            };
          }

          const invoices = await tx
            .select({
              employeeId: posInvoices.employeeId,
              employeeName: posInvoices.employeeName,
              total: posInvoices.total,
              paymentMethod: posInvoices.paymentMethod,
              cashAmount: posInvoices.cashAmount,
              cardAmount: posInvoices.cardAmount,
              status: posInvoices.status,
            })
            .from(posInvoices)
            .where(
              and(
                eq(posInvoices.branchId, row.branchId),
                gte(posInvoices.invoiceDate, localStart),
                lte(posInvoices.invoiceDate, localEnd)
              )
            );

          const aggregation = aggregatePosInvoices(invoices);
          if (aggregation.employees.length === 0) {
            return {
              dailyRevenueId: row.id,
              branchId: row.branchId,
              businessDay,
              status: "skipped" as const,
              reason: "لا توجد فواتير كاشير مكتملة لهذا اليوم",
            };
          }

          await tx.insert(employeeRevenues).values(
            aggregation.employees.map(emp => ({
              dailyRevenueId: row.id,
              employeeId: emp.employeeId,
              cash: emp.cash.toFixed(2),
              network: emp.network.toFixed(2),
              total: emp.total.toFixed(2),
            }))
          );

          await tx
            .update(dailyRevenues)
            .set({
              date: storedDate,
              posConfirmed: true,
              posConfirmedAt: sql`COALESCE(${dailyRevenues.posConfirmedAt}, ${dailyRevenues.createdAt})`,
              posConfirmedBy: sql`COALESCE(${dailyRevenues.posConfirmedBy}, 'الكاشير')`,
            })
            .where(eq(dailyRevenues.id, row.id));

          return {
            dailyRevenueId: row.id,
            branchId: row.branchId,
            businessDay,
            status: "rebuilt" as const,
            employeesCount: aggregation.employees.length,
            employeesTotal: aggregation.branch.total,
            branchTotal: Number(row.total || 0),
          };
        }
      );
    } catch (error: any) {
      // فشل يوم لا يوقف بقية الأيام؛ يُبلَّغ عنه في النتيجة ويمكن إعادة المحاولة
      console.error(
        `[Bonus POS] فشل إعادة بناء يوم ${businessDay} للفرع ${row.branchId}:`,
        error
      );
      dayResult = {
        dailyRevenueId: row.id,
        branchId: row.branchId,
        businessDay,
        status: "failed",
        reason: error?.message || "خطأ غير متوقع",
      };
      warnings.push(
        `يوم ${businessDay}: تعذرت إعادة البناء (${dayResult.reason})`
      );
    }

    days.push(dayResult);
    if (dayResult.status === "rebuilt") {
      const dates = affectedDates.get(row.branchId) ?? [];
      dates.push(new Date(row.date), storedDate);
      affectedDates.set(row.branchId, dates);
      if (
        dayResult.branchTotal !== undefined &&
        dayResult.employeesTotal !== undefined &&
        Math.abs(dayResult.branchTotal - dayResult.employeesTotal) > 0.01
      ) {
        warnings.push(
          `يوم ${businessDay}: إجمالي الإيراد المسجل ${dayResult.branchTotal.toFixed(2)} ر.س يختلف عن إجمالي فواتير الكاشير المكتملة ${dayResult.employeesTotal.toFixed(2)} ر.س`
        );
      }
    }
  }

  // إعادة احتساب الفترات المتأثرة (مرة واحدة لكل فترة)
  const tiers = (await loadActiveBonusTiers()).tiers;
  const periods: RecomputeResult[] = [];
  for (const [branchId, dates] of Array.from(affectedDates.entries())) {
    periods.push(
      ...(await recomputeBonusForStoredDates(branchId, dates, {
        tiers,
        performedBy: params.performedBy ?? null,
        reason: "إعادة احتساب من الكاشير",
      }))
    );
  }
  for (const p of periods)
    warnings.push(...(p.success ? p.warnings : [p.message]));

  return {
    scanned: inMonth.length,
    rebuilt: days.filter(d => d.status === "rebuilt").length,
    skipped: days.filter(d => d.status === "skipped").length,
    failed: days.filter(d => d.status === "failed").length,
    days,
    periods,
    warnings,
  };
}
