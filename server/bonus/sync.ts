/**
 * Revenue Sync - تزامن الإيرادات مع البونص
 * 
 * @version 2.0.0
 * - Database Transactions للحفاظ على تكامل البيانات
 * - Batch Operations لتحسين الأداء
 * - Retry Logic لمعالجة الأخطاء المؤقتة
 * - التحقق قبل الحفظ
 */

import { getDb } from "../db";
import {
  dailyRevenues,
  employeeRevenues,
  weeklyBonuses,
  bonusDetails,
  employees,
  branches
} from "../../drizzle/schema";
import { eq, and, gte, lte, sql, between, inArray } from "drizzle-orm";
import {
  calculateBonus,
  calculateBonusSafe,
  getWeekInfo,
  getWeekDateRange,
  validateWeekData,
  validateRevenueMatch,
  getExpectedDaysCount,
  WeekValidation,
  RevenueValidation,
  createWeekSummary,
  WeekSummary,
  BonusTier,
  validateNumber,
  normalizeDateForComparison,
} from "./calculator";
import { notifyBonusCalculationCompleted } from "../notifications/advancedNotificationService";
import * as emailNotifications from "../notifications/emailNotificationService";

// ==================== Types ====================

type DatabaseConnection = Awaited<ReturnType<typeof getDb>>;
type DrizzleDb = NonNullable<DatabaseConnection>;

interface SyncResult {
  success: boolean;
  message: string;
  validation?: {
    daysValidation: WeekValidation;
    revenueValidation: RevenueValidation;
  };
  data?: {
    employeeCount: number;
    totalAmount: number;
    weekSummary?: WeekSummary;
  };
  errors?: string[];
}

interface EmployeeRevenueData {
  employeeId: number;
  employeeName: string;
  weeklyRevenue: number;
  bonusTier: BonusTier;
  bonusAmount: number;
  isEligible: boolean;
}

interface BranchRevenueData {
  total: number;
  enteredDates: Date[];
  dailyBreakdown: Array<{ date: Date; revenue: number }>;
}

interface RetryOptions {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier: number;
}

// ==================== Retry Logic ====================

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
};

/**
 * تنفيذ دالة مع إعادة المحاولة عند الفشل
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const { maxAttempts, delayMs, backoffMultiplier } = {
    ...DEFAULT_RETRY_OPTIONS,
    ...options,
  };

  let lastError: Error | null = null;
  let currentDelay = delayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // لا نعيد المحاولة للأخطاء المنطقية
      if (isNonRetryableError(lastError)) {
        throw lastError;
      }

      console.warn(
        `[Retry] ${operationName} - المحاولة ${attempt}/${maxAttempts} فشلت: ${lastError.message}`
      );

      if (attempt < maxAttempts) {
        await sleep(currentDelay);
        currentDelay *= backoffMultiplier;
      }
    }
  }

  throw new Error(
    `فشل ${operationName} بعد ${maxAttempts} محاولات: ${lastError?.message}`
  );
}

/**
 * التحقق إذا كان الخطأ غير قابل لإعادة المحاولة
 */
function isNonRetryableError(error: Error): boolean {
  const nonRetryablePatterns = [
    "VALIDATION_ERROR",
    "INVALID_INPUT",
    "NOT_FOUND",
    "UNAUTHORIZED",
    "FORBIDDEN",
  ];

  return nonRetryablePatterns.some(
    (pattern) =>
      error.message.includes(pattern) || error.name.includes(pattern)
  );
}

/**
 * تأخير التنفيذ
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==================== Database Operations ====================

/**
 * الحصول على اتصال قاعدة البيانات مع التحقق
 */
async function getValidDb(): Promise<DrizzleDb> {
  const db = await getDb();
  if (!db) {
    throw new Error("DB_CONNECTION_FAILED: فشل الاتصال بقاعدة البيانات");
  }
  return db;
}

/**
 * تنفيذ عملية داخل Transaction
 */
async function withTransaction<T>(
  db: DrizzleDb,
  operation: (tx: DrizzleDb) => Promise<T>
): Promise<T> {
  // Drizzle MySQL transaction
  return await db.transaction(async (tx) => {
    return await operation(tx as unknown as DrizzleDb);
  });
}

// ==================== Revenue Queries ====================

/**
 * الحصول على إيرادات الفرع للأسبوع بشكل تفصيلي
 */
async function getBranchWeeklyRevenue(
  db: DrizzleDb,
  branchId: number,
  weekStart: Date,
  weekEnd: Date
): Promise<BranchRevenueData> {
  // التحقق من المدخلات
  const branchValidation = validateNumber(branchId, "معرف الفرع", {
    min: 1,
    allowZero: false,
  });
  if (!branchValidation.success) {
    throw new Error(
      `VALIDATION_ERROR: ${branchValidation.errors.map((e) => e.message).join(", ")}`
    );
  }

  const result = await db
    .select({
      date: dailyRevenues.date,
      revenue: dailyRevenues.total,
    })
    .from(dailyRevenues)
    .where(
      and(
        eq(dailyRevenues.branchId, branchId),
        between(dailyRevenues.date, weekStart, weekEnd)
      )
    )
    .orderBy(dailyRevenues.date);

  const dailyBreakdown = result.map((r) => ({
    date: new Date(r.date),
    revenue: Number(r.revenue || 0),
  }));

  const total = dailyBreakdown.reduce((sum, d) => sum + d.revenue, 0);
  const enteredDates = dailyBreakdown.map((d) => d.date);

  return { total, enteredDates, dailyBreakdown };
}

/**
 * الحصول على إيرادات جميع الموظفين للأسبوع (Batch Query)
 */
async function getAllEmployeesWeeklyRevenues(
  db: DrizzleDb,
  branchId: number,
  weekStart: Date,
  weekEnd: Date
): Promise<Map<number, { revenue: number; enteredDates: Date[] }>> {
  // استعلام واحد لجميع الموظفين بدلاً من N استعلامات
  const result = await db
    .select({
      employeeId: employeeRevenues.employeeId,
      total: employeeRevenues.total,
      date: dailyRevenues.date,
    })
    .from(employeeRevenues)
    .innerJoin(
      dailyRevenues,
      eq(employeeRevenues.dailyRevenueId, dailyRevenues.id)
    )
    .where(
      and(
        eq(dailyRevenues.branchId, branchId),
        between(dailyRevenues.date, weekStart, weekEnd)
      )
    );

  // تجميع البيانات حسب الموظف
  const employeeMap = new Map<
    number,
    { revenue: number; enteredDates: Date[] }
  >();

  for (const row of result) {
    const existing = employeeMap.get(row.employeeId) || {
      revenue: 0,
      enteredDates: [],
    };
    existing.revenue += Number(row.total || 0);
    existing.enteredDates.push(new Date(row.date));
    employeeMap.set(row.employeeId, existing);
  }

  return employeeMap;
}

/**
 * الحصول على مجموع إيرادات جميع الموظفين
 */
async function getTotalEmployeesRevenue(
  db: DrizzleDb,
  branchId: number,
  weekStart: Date,
  weekEnd: Date
): Promise<number> {
  const result = await db
    .select({
      total: sql<string>`COALESCE(SUM(${employeeRevenues.total}), 0)`,
    })
    .from(employeeRevenues)
    .innerJoin(
      dailyRevenues,
      eq(employeeRevenues.dailyRevenueId, dailyRevenues.id)
    )
    .where(
      and(
        eq(dailyRevenues.branchId, branchId),
        between(dailyRevenues.date, weekStart, weekEnd)
      )
    );

  return Number(result[0]?.total || 0);
}

// ==================== Bonus Operations ====================

/**
 * الحصول على أو إنشاء سجل البونص الأسبوعي
 */
async function getOrCreateWeeklyBonus(
  db: DrizzleDb,
  branchId: number,
  weekNumber: number,
  month: number,
  year: number,
  weekStart: Date,
  weekEnd: Date
): Promise<number> {
  // البحث عن سجل موجود
  const existing = await db
    .select({ id: weeklyBonuses.id })
    .from(weeklyBonuses)
    .where(
      and(
        eq(weeklyBonuses.branchId, branchId),
        eq(weeklyBonuses.weekNumber, weekNumber),
        eq(weeklyBonuses.month, month),
        eq(weeklyBonuses.year, year)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  // إنشاء سجل جديد
  await db.insert(weeklyBonuses).values({
    branchId,
    weekNumber,
    weekStart,
    weekEnd,
    month,
    year,
    status: "pending",
    totalAmount: "0.00",
  });

  // الحصول على ID السجل الجديد
  const newRecord = await db
    .select({ id: weeklyBonuses.id })
    .from(weeklyBonuses)
    .where(
      and(
        eq(weeklyBonuses.branchId, branchId),
        eq(weeklyBonuses.weekNumber, weekNumber),
        eq(weeklyBonuses.month, month),
        eq(weeklyBonuses.year, year)
      )
    )
    .limit(1);

  if (newRecord.length === 0) {
    throw new Error("فشل في إنشاء سجل البونص الأسبوعي");
  }

  return newRecord[0].id;
}

/**
 * تحديث تفاصيل البونص لجميع الموظفين (Batch Upsert)
 */
async function batchUpsertBonusDetails(
  db: DrizzleDb,
  weeklyBonusId: number,
  employeeData: EmployeeRevenueData[]
): Promise<void> {
  if (employeeData.length === 0) return;

  // الحصول على السجلات الموجودة
  const existingRecords = await db
    .select({
      id: bonusDetails.id,
      employeeId: bonusDetails.employeeId,
    })
    .from(bonusDetails)
    .where(eq(bonusDetails.weeklyBonusId, weeklyBonusId));

  const existingMap = new Map(existingRecords.map((r) => [r.employeeId, r.id]));

  // فصل البيانات إلى تحديث وإدراج
  const toUpdate: Array<{
    id: number;
    data: EmployeeRevenueData;
  }> = [];
  const toInsert: EmployeeRevenueData[] = [];

  for (const emp of employeeData) {
    const existingId = existingMap.get(emp.employeeId);
    if (existingId) {
      toUpdate.push({ id: existingId, data: emp });
    } else {
      toInsert.push(emp);
    }
  }

  // تحديث السجلات الموجودة
  for (const item of toUpdate) {
    await db
      .update(bonusDetails)
      .set({
        weeklyRevenue: item.data.weeklyRevenue.toFixed(2),
        bonusAmount: item.data.bonusAmount.toFixed(2),
        bonusTier: item.data.bonusTier,
        isEligible: item.data.isEligible,
        updatedAt: new Date(),
      })
      .where(eq(bonusDetails.id, item.id));
  }

  // إدراج السجلات الجديدة (Batch Insert)
  if (toInsert.length > 0) {
    await db.insert(bonusDetails).values(
      toInsert.map((emp) => ({
        weeklyBonusId,
        employeeId: emp.employeeId,
        weeklyRevenue: emp.weeklyRevenue.toFixed(2),
        bonusAmount: emp.bonusAmount.toFixed(2),
        bonusTier: emp.bonusTier,
        isEligible: emp.isEligible,
      }))
    );
  }
}

/**
 * تحديث إجمالي البونص الأسبوعي
 */
async function updateWeeklyBonusTotal(
  db: DrizzleDb,
  weeklyBonusId: number,
  totalAmount: number
): Promise<void> {
  await db
    .update(weeklyBonuses)
    .set({
      totalAmount: totalAmount.toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(weeklyBonuses.id, weeklyBonusId));
}

// ==================== Main Sync Functions ====================

/**
 * التحقق من صحة البيانات قبل التزامن
 */
async function preValidateSync(
  db: DrizzleDb,
  branchId: number,
  weekNumber: number,
  month: number,
  year: number
): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
  branchRevenue: BranchRevenueData;
  employeesRevenue: number;
  daysValidation: WeekValidation;
  revenueValidation: RevenueValidation;
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const { start, end } = getWeekDateRange(weekNumber, month, year);

  // الحصول على بيانات الفرع
  const branchRevenue = await getBranchWeeklyRevenue(db, branchId, start, end);

  // التحقق من اكتمال الأيام
  const daysValidation = validateWeekData(
    weekNumber,
    month,
    year,
    branchRevenue.enteredDates
  );

  if (!daysValidation.isValid) {
    warnings.push(daysValidation.message);
  }

  // الحصول على إيرادات الموظفين
  const employeesRevenue = await getTotalEmployeesRevenue(
    db,
    branchId,
    start,
    end
  );

  // التحقق من تطابق الإيرادات
  const revenueValidation = validateRevenueMatch(
    branchRevenue.total,
    employeesRevenue
  );

  if (!revenueValidation.isMatching) {
    errors.push(revenueValidation.message);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    branchRevenue,
    employeesRevenue,
    daysValidation,
    revenueValidation,
  };
}

/**
 * تزامن البونص لموظف واحد
 */
export async function syncBonusOnRevenueChange(
  employeeId: number,
  branchId: number,
  date: Date
): Promise<SyncResult> {
  try {
    const db = await getValidDb();
    const weekInfo = getWeekInfo(date);

    console.log(
      `[Bonus Sync] Employee ${employeeId}, Week ${weekInfo.weekNumber}`
    );

    return await withTransaction(db, async (tx) => {
      // الحصول على إيرادات الموظف
      const employeeRevenues = await getAllEmployeesWeeklyRevenues(
        tx,
        branchId,
        weekInfo.weekStart,
        weekInfo.weekEnd
      );

      const empData = employeeRevenues.get(employeeId) || {
        revenue: 0,
        enteredDates: [],
      };

      // حساب البونص
      const bonusCalc = calculateBonus(empData.revenue);

      // الحصول على أو إنشاء سجل البونص الأسبوعي
      const weeklyBonusId = await getOrCreateWeeklyBonus(
        tx,
        branchId,
        weekInfo.weekNumber,
        weekInfo.month,
        weekInfo.year,
        weekInfo.weekStart,
        weekInfo.weekEnd
      );

      // تحديث تفاصيل البونص
      await batchUpsertBonusDetails(tx, weeklyBonusId, [
        {
          employeeId,
          employeeName: "",
          weeklyRevenue: empData.revenue,
          bonusTier: bonusCalc.tier,
          bonusAmount: bonusCalc.amount,
          isEligible: bonusCalc.isEligible,
        },
      ]);

      // حساب الإجمالي
      const totalResult = await tx
        .select({
          total: sql<string>`COALESCE(SUM(${bonusDetails.bonusAmount}), 0)`,
        })
        .from(bonusDetails)
        .where(eq(bonusDetails.weeklyBonusId, weeklyBonusId));

      await updateWeeklyBonusTotal(
        tx,
        weeklyBonusId,
        Number(totalResult[0]?.total || 0)
      );

      // التحقق من تطابق الإيرادات
      const { total: branchTotal } = await getBranchWeeklyRevenue(
        tx,
        branchId,
        weekInfo.weekStart,
        weekInfo.weekEnd
      );

      let totalEmployeesRevenue = 0;
      employeeRevenues.forEach((v) => (totalEmployeesRevenue += v.revenue));

      const revenueValidation = validateRevenueMatch(
        branchTotal,
        totalEmployeesRevenue
      );
      const daysValidation = validateWeekData(
        weekInfo.weekNumber,
        weekInfo.month,
        weekInfo.year,
        empData.enteredDates
      );

      return {
        success: true,
        message: `تم تحديث البونص للموظف ${employeeId}`,
        validation: {
          daysValidation,
          revenueValidation,
        },
      };
    });
  } catch (error) {
    console.error("[Bonus Sync] Error:", error);
    return {
      success: false,
      message: `فشل التزامن: ${error instanceof Error ? error.message : "خطأ غير معروف"}`,
      errors: [error instanceof Error ? error.message : "خطأ غير معروف"],
    };
  }
}

/**
 * تزامن جميع الموظفين لأسبوع معين (الدالة الرئيسية المُحسّنة)
 */
export async function syncWeeklyBonusForBranch(
  branchId: number,
  weekNumber: number,
  month: number,
  year: number,
  options: { forceSync?: boolean; skipValidation?: boolean } = {}
): Promise<SyncResult> {
  const { forceSync = false, skipValidation = false } = options;

  try {
    const db = await getValidDb();

    console.log(
      `[Bonus Sync] Starting sync for branch ${branchId}, week ${weekNumber}/${month}/${year}`
    );

    // التحقق المسبق (قبل التزامن)
    if (!skipValidation) {
      const preValidation = await preValidateSync(
        db,
        branchId,
        weekNumber,
        month,
        year
      );

      if (!preValidation.isValid && !forceSync) {
        console.error(
          `[Bonus Sync] Pre-validation failed: ${preValidation.errors.join(", ")}`
        );
        return {
          success: false,
          message: `فشل التحقق: ${preValidation.errors.join(", ")}`,
          validation: {
            daysValidation: preValidation.daysValidation,
            revenueValidation: preValidation.revenueValidation,
          },
          errors: preValidation.errors,
        };
      }

      if (preValidation.warnings.length > 0) {
        console.warn(
          `[Bonus Sync] Warnings: ${preValidation.warnings.join(", ")}`
        );
      }
    }

    // تنفيذ التزامن داخل Transaction
    return await withRetry(
      () =>
        withTransaction(db, async (tx) => {
          const { start, end } = getWeekDateRange(weekNumber, month, year);

          // الحصول على الموظفين النشطين
          const branchEmployees = await tx
            .select({
              id: employees.id,
              name: employees.name,
            })
            .from(employees)
            .where(
              and(
                eq(employees.branchId, branchId),
                eq(employees.isActive, true)
              )
            );

          if (branchEmployees.length === 0) {
            throw new Error("NOT_FOUND: لا يوجد موظفين نشطين في هذا الفرع");
          }

          // الحصول على إيرادات جميع الموظفين (Batch Query واحد)
          const employeeRevenuesMap = await getAllEmployeesWeeklyRevenues(
            tx,
            branchId,
            start,
            end
          );

          // حساب البونص لكل موظف
          const employeeData: EmployeeRevenueData[] = [];
          let totalBonus = 0;
          let eligibleCount = 0;

          for (const emp of branchEmployees) {
            const revData = employeeRevenuesMap.get(emp.id) || {
              revenue: 0,
              enteredDates: [],
            };
            const bonusCalc = calculateBonus(revData.revenue);

            employeeData.push({
              employeeId: emp.id,
              employeeName: emp.name,
              weeklyRevenue: revData.revenue,
              bonusTier: bonusCalc.tier,
              bonusAmount: bonusCalc.amount,
              isEligible: bonusCalc.isEligible,
            });

            totalBonus += bonusCalc.amount;
            if (bonusCalc.isEligible) eligibleCount++;
          }

          // الحصول على أو إنشاء سجل البونص الأسبوعي
          const weeklyBonusId = await getOrCreateWeeklyBonus(
            tx,
            branchId,
            weekNumber,
            month,
            year,
            start,
            end
          );

          // تحديث جميع تفاصيل البونص (Batch Upsert)
          await batchUpsertBonusDetails(tx, weeklyBonusId, employeeData);

          // تحديث الإجمالي
          await updateWeeklyBonusTotal(tx, weeklyBonusId, totalBonus);

          // الحصول على بيانات الفرع للتحقق النهائي
          const branchRevenue = await getBranchWeeklyRevenue(
            tx,
            branchId,
            start,
            end
          );
          const totalEmployeesRevenue = employeeData.reduce(
            (sum, e) => sum + e.weeklyRevenue,
            0
          );

          const daysValidation = validateWeekData(
            weekNumber,
            month,
            year,
            branchRevenue.enteredDates
          );
          const revenueValidation = validateRevenueMatch(
            branchRevenue.total,
            totalEmployeesRevenue
          );

          // إنشاء ملخص الأسبوع
          const weekSummary = createWeekSummary(
            weekNumber,
            month,
            year,
            branchRevenue.total,
            totalEmployeesRevenue,
            totalBonus,
            branchEmployees.length,
            eligibleCount,
            branchRevenue.enteredDates
          );

          console.log(`[Bonus Sync] Week Summary:
            - Days: ${daysValidation.actualDays}/${daysValidation.expectedDays} ${daysValidation.isValid ? "✓" : "✗"}
            - Revenue Match: Branch ${branchRevenue.total.toFixed(2)} vs Employees ${totalEmployeesRevenue.toFixed(2)} ${revenueValidation.isMatching ? "✓" : "✗"}
            - Total Bonus: ${totalBonus.toFixed(2)}
            - Eligible: ${eligibleCount}/${branchEmployees.length}`);

          // الحصول على اسم الفرع للإشعارات
          const branchData = await tx
            .select({ nameAr: branches.nameAr })
            .from(branches)
            .where(eq(branches.id, branchId))
            .limit(1);

          const branchName = branchData[0]?.nameAr || "غير محدد";

          // إرسال الإشعارات (خارج الـ Transaction)
          setImmediate(async () => {
            try {
              await sendNotifications({
                branchId,
                branchName,
                weekNumber,
                month,
                year,
                totalBonus,
                eligibleCount,
                totalEmployees: branchEmployees.length,
                employeeData,
                daysValidation,
                revenueValidation,
                branchRevenue: branchRevenue.total,
                employeesRevenue: totalEmployeesRevenue,
              });
            } catch (notifError) {
              console.error(
                "[Bonus Sync] Failed to send notifications:",
                notifError
              );
            }
          });

          let resultMessage = `تم تزامن البونص لـ ${branchEmployees.length} موظف`;
          if (!daysValidation.isValid || !revenueValidation.isMatching) {
            resultMessage += " (مع تحذيرات)";
          }

          return {
            success: true,
            message: resultMessage,
            validation: {
              daysValidation,
              revenueValidation,
            },
            data: {
              employeeCount: branchEmployees.length,
              totalAmount: totalBonus,
              weekSummary,
            },
          };
        }),
      "syncWeeklyBonusForBranch"
    );
  } catch (error) {
    console.error("[Bonus Sync] Error:", error);
    return {
      success: false,
      message: `فشل التزامن: ${error instanceof Error ? error.message : "خطأ غير معروف"}`,
      errors: [error instanceof Error ? error.message : "خطأ غير معروف"],
    };
  }
}

// ==================== Notification Helper ====================

interface NotificationParams {
  branchId: number;
  branchName: string;
  weekNumber: number;
  month: number;
  year: number;
  totalBonus: number;
  eligibleCount: number;
  totalEmployees: number;
  employeeData: EmployeeRevenueData[];
  daysValidation: WeekValidation;
  revenueValidation: RevenueValidation;
  branchRevenue: number;
  employeesRevenue: number;
}

async function sendNotifications(params: NotificationParams): Promise<void> {
  const {
    branchId,
    branchName,
    weekNumber,
    month,
    year,
    totalBonus,
    eligibleCount,
    totalEmployees,
    employeeData,
    daysValidation,
    revenueValidation,
    branchRevenue,
    employeesRevenue,
  } = params;

  const warnings: string[] = [];
  if (!daysValidation.isValid) warnings.push(daysValidation.message);
  if (!revenueValidation.isMatching) warnings.push(revenueValidation.message);

  // إشعار المالك
  await notifyBonusCalculationCompleted({
    branchId,
    branchName,
    weekNumber,
    month,
    year,
    totalAmount: totalBonus,
    eligibleCount,
    totalEmployees,
    details: employeeData.map((d) => ({
      employeeName: d.employeeName,
      weeklyRevenue: d.weeklyRevenue,
      bonusAmount: d.bonusAmount,
      bonusTier: d.bonusTier,
    })),
  });

  // إشعار البريد الإلكتروني
  await emailNotifications.notifyWeeklyBonusReport({
    branchId,
    branchName,
    weekNumber,
    month,
    year,
    totalAmount: totalBonus,
    eligibleCount,
    totalEmployees,
    details: employeeData.map((d) => ({
      employeeName: d.employeeName,
      weeklyRevenue: d.weeklyRevenue,
      tier: d.bonusTier,
      bonusAmount: d.bonusAmount,
      isEligible: d.isEligible,
    })),
  });

  console.log(`[Bonus Sync] Notifications sent for branch ${branchId}`);
}

// ==================== Monthly Operations ====================

/**
 * إعادة حساب البونص لجميع الأسابيع في شهر معين
 */
export async function recalculateMonthlyBonuses(
  branchId: number,
  month: number,
  year: number
): Promise<{
  success: boolean;
  message: string;
  results: SyncResult[];
}> {
  const results: SyncResult[] = [];

  const lastDay = new Date(year, month, 0).getDate();
  const weeksCount = lastDay > 28 ? 5 : 4;

  for (let week = 1; week <= weeksCount; week++) {
    const result = await syncWeeklyBonusForBranch(branchId, week, month, year);
    results.push(result);
  }

  const successCount = results.filter((r) => r.success).length;

  return {
    success: successCount === weeksCount,
    message: `تم تزامن ${successCount}/${weeksCount} أسبوع`,
    results,
  };
}

/**
 * التحقق من سلامة البيانات لشهر كامل
 */
export async function validateMonthlyData(
  branchId: number,
  month: number,
  year: number
): Promise<{
  success: boolean;
  weeklyValidations: Array<{
    week: number;
    daysValidation: WeekValidation;
    revenueValidation: RevenueValidation;
  }>;
  summary: {
    totalDaysExpected: number;
    totalDaysEntered: number;
    totalBranchRevenue: number;
    totalEmployeesRevenue: number;
    overallMatch: boolean;
  };
}> {
  const db = await getValidDb();

  const lastDay = new Date(year, month, 0).getDate();
  const weeksCount = lastDay > 28 ? 5 : 4;

  const weeklyValidations: Array<{
    week: number;
    daysValidation: WeekValidation;
    revenueValidation: RevenueValidation;
  }> = [];

  let totalDaysExpected = 0;
  let totalDaysEntered = 0;
  let totalBranchRevenue = 0;
  let totalEmployeesRevenue = 0;

  for (let week = 1; week <= weeksCount; week++) {
    const { start, end } = getWeekDateRange(week, month, year);
    const expectedDays = getExpectedDaysCount(week, month, year);

    const branchRevenue = await getBranchWeeklyRevenue(db, branchId, start, end);
    const employeesRevenue = await getTotalEmployeesRevenue(
      db,
      branchId,
      start,
      end
    );

    const daysValidation = validateWeekData(
      week,
      month,
      year,
      branchRevenue.enteredDates
    );
    const revenueValidation = validateRevenueMatch(
      branchRevenue.total,
      employeesRevenue
    );

    weeklyValidations.push({
      week,
      daysValidation,
      revenueValidation,
    });

    totalDaysExpected += expectedDays;
    totalDaysEntered += daysValidation.actualDays;
    totalBranchRevenue += branchRevenue.total;
    totalEmployeesRevenue += employeesRevenue;
  }

  const overallRevenueMatch =
    Math.abs(totalBranchRevenue - totalEmployeesRevenue) <= 0.01;
  const overallDaysMatch = totalDaysExpected === totalDaysEntered;

  return {
    success: overallRevenueMatch && overallDaysMatch,
    weeklyValidations,
    summary: {
      totalDaysExpected,
      totalDaysEntered,
      totalBranchRevenue,
      totalEmployeesRevenue,
      overallMatch: overallRevenueMatch && overallDaysMatch,
    },
  };
}

/**
 * إصلاح التناقضات في البيانات
 */
export async function fixDataInconsistencies(
  branchId: number,
  weekNumber: number,
  month: number,
  year: number
): Promise<SyncResult> {
  console.log(
    `[Bonus Sync] Fixing inconsistencies for branch ${branchId}, week ${weekNumber}/${month}/${year}`
  );

  // إعادة التزامن مع تجاوز التحقق
  return await syncWeeklyBonusForBranch(branchId, weekNumber, month, year, {
    forceSync: true,
    skipValidation: false,
  });
}
