/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Advanced Database Queries - استعلامات متقدمة لقاعدة البيانات
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * هذا الملف يحتوي على دوال متقدمة للاستخدامات التالية:
 * 
 * 1. 🔍 System Monitoring - مراقبة النظام
 * 2. 🔄 Reconciliation - المطابقة والتسوية
 * 3. 📊 Workflow Management - إدارة سير العمل
 * 4. 📈 Analytics & Reports - التحليلات والتقارير
 * 5. 🛡️ Audit & Compliance - المراجعة والامتثال
 * 
 * @author Omar
 * @version 1.0.0
 * @modified Manus AI - تم تعديله للتوافق مع schema الحالي
 */

import { getDb } from "./db";
import {
  dailyRevenues,
  employeeRevenues,
  weeklyBonuses,
  bonusDetails,
  employees,
  branches,
  users,
  bonusAuditLog,
  systemLogs,
  activityLogs,
} from "../drizzle/schema";
import { eq, and, gte, lte, sql, between, desc, asc, isNull, ne, or, count, sum, avg } from "drizzle-orm";

// ═══════════════════════════════════════════════════════════════════════════════
// Types & Interfaces - الأنواع والواجهات
// ═══════════════════════════════════════════════════════════════════════════════

type DatabaseConnection = Awaited<ReturnType<typeof getDb>>;
type DrizzleDb = NonNullable<DatabaseConnection>;

/**
 * نتيجة فحص صحة النظام
 */
interface HealthCheckResult {
  component: string;
  status: "healthy" | "degraded" | "unhealthy";
  latencyMs: number;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * نتيجة المطابقة
 */
interface ReconciliationResult {
  isReconciled: boolean;
  discrepancies: Array<{
    type: "missing" | "mismatch" | "orphan";
    entity: string;
    entityId: number;
    expected: number;
    actual: number;
    difference: number;
    details: string;
  }>;
  summary: {
    totalChecked: number;
    matched: number;
    mismatched: number;
    totalDifference: number;
  };
}

/**
 * حالة سير العمل
 */
type WorkflowStatus = 
  | "draft"           // مسودة
  | "pending"         // في الانتظار
  | "under_review"    // قيد المراجعة
  | "approved"        // معتمد
  | "rejected"        // مرفوض
  | "paid"            // مدفوع
  | "cancelled";      // ملغي

/**
 * سجل المراجعة
 */
interface AuditEntry {
  id: number;
  entityType: string;
  entityId: number;
  action: string;
  userId: number;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

/**
 * مقاييس الأداء
 */
interface PerformanceMetrics {
  avgQueryTimeMs: number;
  totalQueries: number;
  slowQueries: number;
  errorRate: number;
  cacheHitRate: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. 🔍 SYSTEM MONITORING - مراقبة النظام
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 1.1 فحص صحة قاعدة البيانات
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    const db = await getDb();
    if (!db) {
      return {
        component: "database",
        status: "unhealthy",
        latencyMs: Date.now() - startTime,
        message: "فشل الاتصال بقاعدة البيانات",
      };
    }

    // استعلام بسيط للتحقق
    await db.execute(sql`SELECT 1`);
    
    const latency = Date.now() - startTime;
    
    // تحديد الحالة بناءً على زمن الاستجابة
    let status: "healthy" | "degraded" | "unhealthy" = "healthy";
    let message = "قاعدة البيانات تعمل بشكل طبيعي";
    
    if (latency > 1000) {
      status = "degraded";
      message = "قاعدة البيانات بطيئة";
    } else if (latency > 5000) {
      status = "unhealthy";
      message = "قاعدة البيانات بطيئة جداً";
    }

    return {
      component: "database",
      status,
      latencyMs: latency,
      message,
      details: {
        connectionPool: "active",
        lastCheck: new Date().toISOString(),
      },
    };

  } catch (error) {
    return {
      component: "database",
      status: "unhealthy",
      latencyMs: Date.now() - startTime,
      message: `خطأ: ${error instanceof Error ? error.message : "غير معروف"}`,
    };
  }
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 1.2 فحص تكامل البيانات
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function checkDataIntegrity(): Promise<Array<{
  issue: string;
  severity: "low" | "medium" | "high" | "critical";
  affectedRecords: number;
  table: string;
  query: string;
}>> {
  const db = await getDb();
  if (!db) throw new Error("فشل الاتصال بقاعدة البيانات");

  const issues: Array<{
    issue: string;
    severity: "low" | "medium" | "high" | "critical";
    affectedRecords: number;
    table: string;
    query: string;
  }> = [];

  // 1. البحث عن إيرادات موظفين بدون إيراد يومي مرتبط
  const orphanEmployeeRevenues = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(employeeRevenues)
    .leftJoin(dailyRevenues, eq(employeeRevenues.dailyRevenueId, dailyRevenues.id))
    .where(isNull(dailyRevenues.id));

  if (Number(orphanEmployeeRevenues[0]?.count) > 0) {
    issues.push({
      issue: "إيرادات موظفين يتيمة (بدون إيراد يومي)",
      severity: "high",
      affectedRecords: Number(orphanEmployeeRevenues[0].count),
      table: "employee_revenues",
      query: "SELECT * FROM employee_revenues WHERE daily_revenue_id NOT IN (SELECT id FROM daily_revenues)",
    });
  }

  // 2. البحث عن تفاصيل بونص بدون بونص أسبوعي
  const orphanBonusDetails = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(bonusDetails)
    .leftJoin(weeklyBonuses, eq(bonusDetails.weeklyBonusId, weeklyBonuses.id))
    .where(isNull(weeklyBonuses.id));

  if (Number(orphanBonusDetails[0]?.count) > 0) {
    issues.push({
      issue: "تفاصيل بونص يتيمة (بدون بونص أسبوعي)",
      severity: "critical",
      affectedRecords: Number(orphanBonusDetails[0].count),
      table: "bonus_details",
      query: "SELECT * FROM bonus_details WHERE weekly_bonus_id NOT IN (SELECT id FROM weekly_bonuses)",
    });
  }

  // 3. البحث عن موظفين بدون فرع
  const employeesWithoutBranch = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(employees)
    .leftJoin(branches, eq(employees.branchId, branches.id))
    .where(isNull(branches.id));

  if (Number(employeesWithoutBranch[0]?.count) > 0) {
    issues.push({
      issue: "موظفين بدون فرع",
      severity: "medium",
      affectedRecords: Number(employeesWithoutBranch[0].count),
      table: "employees",
      query: "SELECT * FROM employees WHERE branch_id NOT IN (SELECT id FROM branches)",
    });
  }

  // 4. البحث عن إيرادات سالبة - تم تعديل الحقل من totalRevenue إلى total
  const negativeRevenues = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(dailyRevenues)
    .where(sql`${dailyRevenues.total} < 0`);

  if (Number(negativeRevenues[0]?.count) > 0) {
    issues.push({
      issue: "إيرادات يومية سالبة",
      severity: "high",
      affectedRecords: Number(negativeRevenues[0].count),
      table: "daily_revenues",
      query: "SELECT * FROM daily_revenues WHERE total < 0",
    });
  }

  // 5. البحث عن بونص أكبر من الإيراد
  const invalidBonus = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(bonusDetails)
    .where(sql`CAST(${bonusDetails.bonusAmount} AS DECIMAL) > CAST(${bonusDetails.weeklyRevenue} AS DECIMAL)`);

  if (Number(invalidBonus[0]?.count) > 0) {
    issues.push({
      issue: "بونص أكبر من الإيراد الأسبوعي",
      severity: "critical",
      affectedRecords: Number(invalidBonus[0].count),
      table: "bonus_details",
      query: "SELECT * FROM bonus_details WHERE CAST(bonus_amount AS DECIMAL) > CAST(weekly_revenue AS DECIMAL)",
    });
  }

  return issues;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 1.3 مراقبة حجم الجداول ونموها
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function getTableStatistics(): Promise<Array<{
  tableName: string;
  rowCount: number;
  sizeBytes: number;
  sizeMB: number;
  avgRowSize: number;
  lastUpdated: Date | null;
}>> {
  const db = await getDb();
  if (!db) throw new Error("فشل الاتصال بقاعدة البيانات");

  // استعلام MySQL للحصول على إحصائيات الجداول
  const result = await db.execute(sql`
    SELECT 
      TABLE_NAME as tableName,
      TABLE_ROWS as rowCount,
      DATA_LENGTH + INDEX_LENGTH as sizeBytes,
      ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) as sizeMB,
      ROUND(AVG_ROW_LENGTH, 2) as avgRowSize,
      UPDATE_TIME as lastUpdated
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
    ORDER BY DATA_LENGTH + INDEX_LENGTH DESC
  `);

  const rows = result[0] as unknown as any[];
  return rows.map((row: any) => ({
    tableName: row.tableName,
    rowCount: Number(row.rowCount || 0),
    sizeBytes: Number(row.sizeBytes || 0),
    sizeMB: Number(row.sizeMB || 0),
    avgRowSize: Number(row.avgRowSize || 0),
    lastUpdated: row.lastUpdated ? new Date(row.lastUpdated) : null,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. 🔄 RECONCILIATION - المطابقة والتسوية
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 2.1 مطابقة إيرادات الفرع مع إيرادات الموظفين
 * ─────────────────────────────────────────────────────────────────────────────
 * 
 * القاعدة الذهبية: ∑(إيرادات الموظفين) = إيراد الفرع اليومي
 */
export async function reconcileBranchRevenues(
  branchId: number,
  startDate: Date,
  endDate: Date
): Promise<ReconciliationResult> {
  const db = await getDb();
  if (!db) throw new Error("فشل الاتصال بقاعدة البيانات");

  // الحصول على إيرادات الفرع اليومية - تم تعديل الحقل من totalRevenue إلى total
  const branchDailyRevenues = await db
    .select({
      id: dailyRevenues.id,
      date: dailyRevenues.date,
      branchTotal: dailyRevenues.total,
    })
    .from(dailyRevenues)
    .where(
      and(
        eq(dailyRevenues.branchId, branchId),
        between(dailyRevenues.date, startDate, endDate)
      )
    )
    .orderBy(dailyRevenues.date);

  // الحصول على مجموع إيرادات الموظفين لكل يوم
  const employeeTotals = await db
    .select({
      dailyRevenueId: employeeRevenues.dailyRevenueId,
      employeesTotal: sql<string>`SUM(${employeeRevenues.total})`,
    })
    .from(employeeRevenues)
    .innerJoin(dailyRevenues, eq(employeeRevenues.dailyRevenueId, dailyRevenues.id))
    .where(
      and(
        eq(dailyRevenues.branchId, branchId),
        between(dailyRevenues.date, startDate, endDate)
      )
    )
    .groupBy(employeeRevenues.dailyRevenueId);

  // تحويل إلى Map للوصول السريع
  const employeeTotalsMap = new Map<number, number>();
  for (const et of employeeTotals) {
    employeeTotalsMap.set(et.dailyRevenueId, Number(et.employeesTotal || 0));
  }

  const discrepancies: ReconciliationResult["discrepancies"] = [];
  let matched = 0;
  let totalDifference = 0;

  for (const day of branchDailyRevenues) {
    const branchTotal = Number(day.branchTotal || 0);
    const employeesTotal = employeeTotalsMap.get(day.id) || 0;
    const difference = Math.abs(branchTotal - employeesTotal);

    if (difference > 0.01) {
      discrepancies.push({
        type: "mismatch",
        entity: "daily_revenue",
        entityId: day.id,
        expected: branchTotal,
        actual: employeesTotal,
        difference,
        details: `التاريخ: ${new Date(day.date).toLocaleDateString("ar-SA")} - الفرع: ${branchTotal.toFixed(2)} - الموظفين: ${employeesTotal.toFixed(2)}`,
      });
      totalDifference += difference;
    } else {
      matched++;
    }
  }

  // البحث عن أيام لها إيرادات موظفين بدون إيراد فرع - تم تعديل الحقل
  const orphanEmployeeRevenues = await db
    .select({
      dailyRevenueId: employeeRevenues.dailyRevenueId,
      total: sql<string>`SUM(${employeeRevenues.total})`,
    })
    .from(employeeRevenues)
    .innerJoin(dailyRevenues, eq(employeeRevenues.dailyRevenueId, dailyRevenues.id))
    .where(
      and(
        eq(dailyRevenues.branchId, branchId),
        between(dailyRevenues.date, startDate, endDate),
        sql`${dailyRevenues.total} IS NULL OR ${dailyRevenues.total} = 0`
      )
    )
    .groupBy(employeeRevenues.dailyRevenueId);

  for (const orphan of orphanEmployeeRevenues) {
    discrepancies.push({
      type: "orphan",
      entity: "employee_revenue",
      entityId: orphan.dailyRevenueId,
      expected: 0,
      actual: Number(orphan.total || 0),
      difference: Number(orphan.total || 0),
      details: `إيرادات موظفين بدون إيراد فرع مسجل`,
    });
  }

  return {
    isReconciled: discrepancies.length === 0,
    discrepancies,
    summary: {
      totalChecked: branchDailyRevenues.length,
      matched,
      mismatched: discrepancies.length,
      totalDifference,
    },
  };
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 2.2 مطابقة البونص مع الإيرادات
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function reconcileBonusCalculations(
  branchId: number,
  weekNumber: number,
  month: number,
  year: number
): Promise<ReconciliationResult> {
  const db = await getDb();
  if (!db) throw new Error("فشل الاتصال بقاعدة البيانات");

  const discrepancies: ReconciliationResult["discrepancies"] = [];

  // الحصول على سجل البونص الأسبوعي
  const weeklyBonus = await db
    .select()
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

  if (weeklyBonus.length === 0) {
    return {
      isReconciled: false,
      discrepancies: [{
        type: "missing",
        entity: "weekly_bonus",
        entityId: 0,
        expected: 1,
        actual: 0,
        difference: 1,
        details: "لا يوجد سجل بونص أسبوعي",
      }],
      summary: {
        totalChecked: 0,
        matched: 0,
        mismatched: 1,
        totalDifference: 0,
      },
    };
  }

  const bonusId = weeklyBonus[0].id;

  // الحصول على تفاصيل البونص
  const details = await db
    .select({
      employeeId: bonusDetails.employeeId,
      weeklyRevenue: bonusDetails.weeklyRevenue,
      bonusAmount: bonusDetails.bonusAmount,
      bonusTier: bonusDetails.bonusTier,
    })
    .from(bonusDetails)
    .where(eq(bonusDetails.weeklyBonusId, bonusId));

  // التحقق من صحة كل حساب بونص
  const tierRules = [
    { tier: "tier_5", min: 2400, bonus: 180 },
    { tier: "tier_4", min: 2100, bonus: 135 },
    { tier: "tier_3", min: 1800, bonus: 95 },
    { tier: "tier_2", min: 1500, bonus: 60 },
    { tier: "tier_1", min: 1200, bonus: 35 },
    { tier: "none", min: 0, bonus: 0 },
  ];

  let calculatedTotal = 0;
  let matched = 0;

  for (const detail of details) {
    const revenue = Number(detail.weeklyRevenue || 0);
    const actualBonus = Number(detail.bonusAmount || 0);

    // حساب البونص المتوقع
    let expectedBonus = 0;
    let expectedTier = "none";
    for (const rule of tierRules) {
      if (revenue >= rule.min) {
        expectedBonus = rule.bonus;
        expectedTier = rule.tier;
        break;
      }
    }

    calculatedTotal += expectedBonus;

    // التحقق من التطابق
    if (Math.abs(actualBonus - expectedBonus) > 0.01 || detail.bonusTier !== expectedTier) {
      discrepancies.push({
        type: "mismatch",
        entity: "bonus_detail",
        entityId: detail.employeeId,
        expected: expectedBonus,
        actual: actualBonus,
        difference: Math.abs(expectedBonus - actualBonus),
        details: `الإيراد: ${revenue} - البونص المتوقع: ${expectedBonus} (${expectedTier}) - البونص الفعلي: ${actualBonus} (${detail.bonusTier})`,
      });
    } else {
      matched++;
    }
  }

  // التحقق من إجمالي البونص الأسبوعي
  const recordedTotal = Number(weeklyBonus[0].totalAmount || 0);
  if (Math.abs(recordedTotal - calculatedTotal) > 0.01) {
    discrepancies.push({
      type: "mismatch",
      entity: "weekly_bonus_total",
      entityId: bonusId,
      expected: calculatedTotal,
      actual: recordedTotal,
      difference: Math.abs(calculatedTotal - recordedTotal),
      details: `إجمالي البونص المسجل: ${recordedTotal} - المحسوب: ${calculatedTotal}`,
    });
  }

  return {
    isReconciled: discrepancies.length === 0,
    discrepancies,
    summary: {
      totalChecked: details.length,
      matched,
      mismatched: discrepancies.filter(d => d.entity === "bonus_detail").length,
      totalDifference: discrepancies.reduce((sum, d) => sum + d.difference, 0),
    },
  };
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 2.3 مطابقة شاملة لشهر كامل
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function reconcileMonth(
  branchId: number,
  month: number,
  year: number
): Promise<{
  revenueReconciliation: ReconciliationResult;
  bonusReconciliations: Array<{ week: number; result: ReconciliationResult }>;
  overallStatus: "reconciled" | "has_issues" | "critical";
  summary: {
    totalRevenueDays: number;
    totalBonusWeeks: number;
    totalDiscrepancies: number;
    totalDifference: number;
  };
}> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  // مطابقة الإيرادات
  const revenueReconciliation = await reconcileBranchRevenues(
    branchId,
    startDate,
    endDate
  );

  // مطابقة البونص لكل أسبوع
  const lastDay = endDate.getDate();
  const weeksCount = lastDay > 28 ? 5 : 4;
  const bonusReconciliations: Array<{ week: number; result: ReconciliationResult }> = [];

  for (let week = 1; week <= weeksCount; week++) {
    const result = await reconcileBonusCalculations(branchId, week, month, year);
    bonusReconciliations.push({ week, result });
  }

  // حساب الملخص
  const totalDiscrepancies =
    revenueReconciliation.discrepancies.length +
    bonusReconciliations.reduce((sum, b) => sum + b.result.discrepancies.length, 0);

  const totalDifference =
    revenueReconciliation.summary.totalDifference +
    bonusReconciliations.reduce((sum, b) => sum + b.result.summary.totalDifference, 0);

  // تحديد الحالة العامة
  let overallStatus: "reconciled" | "has_issues" | "critical" = "reconciled";
  if (totalDiscrepancies > 0) {
    overallStatus = "has_issues";
  }
  if (totalDifference > 1000 || totalDiscrepancies > 10) {
    overallStatus = "critical";
  }

  return {
    revenueReconciliation,
    bonusReconciliations,
    overallStatus,
    summary: {
      totalRevenueDays: revenueReconciliation.summary.totalChecked,
      totalBonusWeeks: bonusReconciliations.length,
      totalDiscrepancies,
      totalDifference,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. 📊 WORKFLOW MANAGEMENT - إدارة سير العمل
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 3.1 الحصول على حالة سير العمل للبونص
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function getBonusWorkflowStatus(
  branchId: number,
  month: number,
  year: number
): Promise<Array<{
  weekNumber: number;
  status: string;
  totalAmount: number;
  employeeCount: number;
  createdAt: Date;
  updatedAt: Date;
  canTransitionTo: string[];
}>> {
  const db = await getDb();
  if (!db) throw new Error("فشل الاتصال بقاعدة البيانات");

  const bonuses = await db
    .select({
      id: weeklyBonuses.id,
      weekNumber: weeklyBonuses.weekNumber,
      status: weeklyBonuses.status,
      totalAmount: weeklyBonuses.totalAmount,
      createdAt: weeklyBonuses.createdAt,
      updatedAt: weeklyBonuses.updatedAt,
    })
    .from(weeklyBonuses)
    .where(
      and(
        eq(weeklyBonuses.branchId, branchId),
        eq(weeklyBonuses.month, month),
        eq(weeklyBonuses.year, year)
      )
    )
    .orderBy(weeklyBonuses.weekNumber);

  // الحصول على عدد الموظفين لكل بونص
  const employeeCounts = await db
    .select({
      weeklyBonusId: bonusDetails.weeklyBonusId,
      count: sql<number>`COUNT(*)`,
    })
    .from(bonusDetails)
    .where(
      sql`${bonusDetails.weeklyBonusId} IN (${sql.join(bonuses.map(b => sql`${b.id}`), sql`, `)})`
    )
    .groupBy(bonusDetails.weeklyBonusId);

  const countMap = new Map<number, number>();
  for (const ec of employeeCounts) {
    countMap.set(ec.weeklyBonusId, Number(ec.count));
  }

  // تحديد الانتقالات الممكنة
  const transitions: Record<string, string[]> = {
    pending: ["requested"],
    requested: ["approved", "rejected"],
    approved: [],
    rejected: ["pending"],
  };

  return bonuses.map(bonus => ({
    weekNumber: bonus.weekNumber,
    status: bonus.status || "draft",
    totalAmount: Number(bonus.totalAmount || 0),
    employeeCount: countMap.get(bonus.id) || 0,
    createdAt: bonus.createdAt!,
    updatedAt: bonus.updatedAt!,
    canTransitionTo: transitions[bonus.status || "draft"] || [],
  }));
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 3.2 الحصول على المهام المعلقة حسب الدور
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function getPendingTasks(
  userId: number,
  userRole: "admin" | "manager" | "accountant"
): Promise<Array<{
  taskType: "review" | "approve" | "pay";
  entityType: string;
  entityId: number;
  branchName: string;
  weekNumber: number;
  month: number;
  year: number;
  amount: number;
  waitingDays: number;
  priority: "low" | "normal" | "high" | "urgent";
}>> {
  const db = await getDb();
  if (!db) throw new Error("فشل الاتصال بقاعدة البيانات");

  // تحديد الحالات المطلوب مراجعتها حسب الدور
  const statusesToReview: Record<string, string[]> = {
    admin: ["pending", "requested", "approved"],
    manager: ["pending", "requested"],
    accountant: ["approved"],
  };

  const statuses = statusesToReview[userRole] || [];
  
  if (statuses.length === 0) {
    return [];
  }

  const tasks = await db
    .select({
      id: weeklyBonuses.id,
      branchId: weeklyBonuses.branchId,
      branchName: branches.nameAr,
      weekNumber: weeklyBonuses.weekNumber,
      month: weeklyBonuses.month,
      year: weeklyBonuses.year,
      status: weeklyBonuses.status,
      totalAmount: weeklyBonuses.totalAmount,
      updatedAt: weeklyBonuses.updatedAt,
    })
    .from(weeklyBonuses)
    .innerJoin(branches, eq(weeklyBonuses.branchId, branches.id))
    .where(
      sql`${weeklyBonuses.status} IN (${sql.join(statuses.map(s => sql`${s}`), sql`, `)})`
    )
    .orderBy(weeklyBonuses.updatedAt);

  const now = new Date();

  return tasks.map(task => {
    const waitingDays = Math.floor(
      (now.getTime() - (task.updatedAt?.getTime() || now.getTime())) / (1000 * 60 * 60 * 24)
    );

    // تحديد نوع المهمة
    let taskType: "review" | "approve" | "pay" = "review";
    if (task.status === "requested") taskType = "approve";
    if (task.status === "approved") taskType = "pay";

    // تحديد الأولوية
    let priority: "low" | "normal" | "high" | "urgent" = "normal";
    if (waitingDays > 7) priority = "urgent";
    else if (waitingDays > 3) priority = "high";
    else if (waitingDays < 1) priority = "low";

    return {
      taskType,
      entityType: "weekly_bonus",
      entityId: task.id,
      branchName: task.branchName || "",
      weekNumber: task.weekNumber,
      month: task.month,
      year: task.year,
      amount: Number(task.totalAmount || 0),
      waitingDays,
      priority,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. 📈 ANALYTICS & REPORTS - التحليلات والتقارير
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 4.1 تحليل أداء الموظفين
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function analyzeEmployeePerformance(
  employeeId: number,
  startDate: Date,
  endDate: Date
): Promise<{
  employee: {
    id: number;
    name: string;
    branchId: number;
    branchName: string;
  };
  metrics: {
    totalRevenue: number;
    totalBonus: number;
    avgDailyRevenue: number;
    avgWeeklyRevenue: number;
    workingDays: number;
    bonusEligibleWeeks: number;
    totalWeeks: number;
    bonusRate: number;
  };
  tierDistribution: Record<string, number>;
  trend: {
    direction: "up" | "down" | "stable";
    percentage: number;
  };
  ranking: {
    inBranch: number;
    totalInBranch: number;
  };
}> {
  const db = await getDb();
  if (!db) throw new Error("فشل الاتصال بقاعدة البيانات");

  // الحصول على بيانات الموظف
  const employee = await db
    .select({
      id: employees.id,
      name: employees.name,
      branchId: employees.branchId,
      branchName: branches.nameAr,
    })
    .from(employees)
    .innerJoin(branches, eq(employees.branchId, branches.id))
    .where(eq(employees.id, employeeId))
    .limit(1);

  if (employee.length === 0) {
    throw new Error("الموظف غير موجود");
  }

  // إجمالي الإيرادات
  const revenueData = await db
    .select({
      totalRevenue: sql<string>`COALESCE(SUM(${employeeRevenues.total}), 0)`,
      workingDays: sql<number>`COUNT(DISTINCT DATE(${dailyRevenues.date}))`,
    })
    .from(employeeRevenues)
    .innerJoin(dailyRevenues, eq(employeeRevenues.dailyRevenueId, dailyRevenues.id))
    .where(
      and(
        eq(employeeRevenues.employeeId, employeeId),
        between(dailyRevenues.date, startDate, endDate)
      )
    );

  // بيانات البونص
  const bonusData = await db
    .select({
      totalBonus: sql<string>`COALESCE(SUM(${bonusDetails.bonusAmount}), 0)`,
      totalWeeks: sql<number>`COUNT(*)`,
      eligibleWeeks: sql<number>`SUM(CASE WHEN ${bonusDetails.isEligible} = true THEN 1 ELSE 0 END)`,
    })
    .from(bonusDetails)
    .innerJoin(weeklyBonuses, eq(bonusDetails.weeklyBonusId, weeklyBonuses.id))
    .where(
      and(
        eq(bonusDetails.employeeId, employeeId),
        between(weeklyBonuses.weekStart, startDate, endDate)
      )
    );

  // توزيع المستويات
  const tierData = await db
    .select({
      tier: bonusDetails.bonusTier,
      count: sql<number>`COUNT(*)`,
    })
    .from(bonusDetails)
    .innerJoin(weeklyBonuses, eq(bonusDetails.weeklyBonusId, weeklyBonuses.id))
    .where(
      and(
        eq(bonusDetails.employeeId, employeeId),
        between(weeklyBonuses.weekStart, startDate, endDate)
      )
    )
    .groupBy(bonusDetails.bonusTier);

  const tierDistribution: Record<string, number> = {};
  for (const t of tierData) {
    tierDistribution[t.tier || "none"] = Number(t.count);
  }

  // حساب الاتجاه (مقارنة النصف الأول بالنصف الثاني)
  const midDate = new Date((startDate.getTime() + endDate.getTime()) / 2);

  const firstHalf = await db
    .select({
      total: sql<string>`COALESCE(SUM(${employeeRevenues.total}), 0)`,
    })
    .from(employeeRevenues)
    .innerJoin(dailyRevenues, eq(employeeRevenues.dailyRevenueId, dailyRevenues.id))
    .where(
      and(
        eq(employeeRevenues.employeeId, employeeId),
        between(dailyRevenues.date, startDate, midDate)
      )
    );

  const secondHalf = await db
    .select({
      total: sql<string>`COALESCE(SUM(${employeeRevenues.total}), 0)`,
    })
    .from(employeeRevenues)
    .innerJoin(dailyRevenues, eq(employeeRevenues.dailyRevenueId, dailyRevenues.id))
    .where(
      and(
        eq(employeeRevenues.employeeId, employeeId),
        gte(dailyRevenues.date, midDate),
        lte(dailyRevenues.date, endDate)
      )
    );

  const firstTotal = Number(firstHalf[0]?.total || 0);
  const secondTotal = Number(secondHalf[0]?.total || 0);
  const trendPercentage = firstTotal > 0 ? ((secondTotal - firstTotal) / firstTotal) * 100 : 0;

  let trendDirection: "up" | "down" | "stable" = "stable";
  if (trendPercentage > 5) trendDirection = "up";
  else if (trendPercentage < -5) trendDirection = "down";

  // الترتيب في الفرع
  const branchRanking = await db
    .select({
      employeeId: employeeRevenues.employeeId,
      total: sql<string>`SUM(${employeeRevenues.total})`,
    })
    .from(employeeRevenues)
    .innerJoin(dailyRevenues, eq(employeeRevenues.dailyRevenueId, dailyRevenues.id))
    .where(
      and(
        eq(dailyRevenues.branchId, employee[0].branchId),
        between(dailyRevenues.date, startDate, endDate)
      )
    )
    .groupBy(employeeRevenues.employeeId)
    .orderBy(desc(sql`SUM(${employeeRevenues.total})`));

  const rank = branchRanking.findIndex(r => r.employeeId === employeeId) + 1;

  // حساب المقاييس
  const totalRevenue = Number(revenueData[0]?.totalRevenue || 0);
  const workingDays = Number(revenueData[0]?.workingDays || 0);
  const totalWeeks = Number(bonusData[0]?.totalWeeks || 0);
  const eligibleWeeks = Number(bonusData[0]?.eligibleWeeks || 0);

  return {
    employee: {
      id: employee[0].id,
      name: employee[0].name,
      branchId: employee[0].branchId,
      branchName: employee[0].branchName || "",
    },
    metrics: {
      totalRevenue,
      totalBonus: Number(bonusData[0]?.totalBonus || 0),
      avgDailyRevenue: workingDays > 0 ? totalRevenue / workingDays : 0,
      avgWeeklyRevenue: totalWeeks > 0 ? totalRevenue / totalWeeks : 0,
      workingDays,
      bonusEligibleWeeks: eligibleWeeks,
      totalWeeks,
      bonusRate: totalWeeks > 0 ? (eligibleWeeks / totalWeeks) * 100 : 0,
    },
    tierDistribution,
    trend: {
      direction: trendDirection,
      percentage: Math.abs(trendPercentage),
    },
    ranking: {
      inBranch: rank,
      totalInBranch: branchRanking.length,
    },
  };
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 4.2 تحليل أداء الفروع
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function analyzeBranchPerformance(
  startDate: Date,
  endDate: Date
): Promise<Array<{
  branchId: number;
  branchName: string;
  metrics: {
    totalRevenue: number;
    totalBonus: number;
    employeeCount: number;
    avgRevenuePerEmployee: number;
    avgBonusPerEmployee: number;
    bonusRate: number;
  };
  ranking: number;
  trend: "up" | "down" | "stable";
}>> {
  const db = await getDb();
  if (!db) throw new Error("فشل الاتصال بقاعدة البيانات");

  // إيرادات الفروع - تم تعديل الحقل من totalRevenue إلى total
  const branchRevenues = await db
    .select({
      branchId: dailyRevenues.branchId,
      branchName: branches.nameAr,
      totalRevenue: sql<string>`SUM(${dailyRevenues.total})`,
    })
    .from(dailyRevenues)
    .innerJoin(branches, eq(dailyRevenues.branchId, branches.id))
    .where(between(dailyRevenues.date, startDate, endDate))
    .groupBy(dailyRevenues.branchId, branches.nameAr)
    .orderBy(desc(sql`SUM(${dailyRevenues.total})`));

  // بونص الفروع
  const branchBonuses = await db
    .select({
      branchId: weeklyBonuses.branchId,
      totalBonus: sql<string>`SUM(${weeklyBonuses.totalAmount})`,
    })
    .from(weeklyBonuses)
    .where(between(weeklyBonuses.weekStart, startDate, endDate))
    .groupBy(weeklyBonuses.branchId);

  const bonusMap = new Map<number, number>();
  for (const b of branchBonuses) {
    bonusMap.set(b.branchId, Number(b.totalBonus || 0));
  }

  // عدد الموظفين لكل فرع
  const employeeCounts = await db
    .select({
      branchId: employees.branchId,
      count: sql<number>`COUNT(*)`,
    })
    .from(employees)
    .where(eq(employees.isActive, true))
    .groupBy(employees.branchId);

  const empCountMap = new Map<number, number>();
  for (const ec of employeeCounts) {
    empCountMap.set(ec.branchId, Number(ec.count));
  }

  return branchRevenues.map((branch, index) => {
    const totalRevenue = Number(branch.totalRevenue || 0);
    const totalBonus = bonusMap.get(branch.branchId) || 0;
    const employeeCount = empCountMap.get(branch.branchId) || 1;

    return {
      branchId: branch.branchId,
      branchName: branch.branchName || "",
      metrics: {
        totalRevenue,
        totalBonus,
        employeeCount,
        avgRevenuePerEmployee: totalRevenue / employeeCount,
        avgBonusPerEmployee: totalBonus / employeeCount,
        bonusRate: totalRevenue > 0 ? (totalBonus / totalRevenue) * 100 : 0,
      },
      ranking: index + 1,
      trend: "stable" as const, // يمكن تحسينه لاحقاً بمقارنة الفترات
    };
  });
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 4.3 تقرير الفجوات في البيانات
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function getDataGapsReport(
  branchId: number,
  month: number,
  year: number
): Promise<{
  missingDays: Date[];
  incompleteWeeks: Array<{
    weekNumber: number;
    missingDays: number;
    hasBonus: boolean;
  }>;
  employeesWithoutRevenue: Array<{
    employeeId: number;
    employeeName: string;
    missingDays: number;
  }>;
  completionRate: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("فشل الاتصال بقاعدة البيانات");

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  const totalDays = endDate.getDate();

  // الأيام المسجلة
  const enteredDays = await db
    .select({ date: dailyRevenues.date })
    .from(dailyRevenues)
    .where(
      and(
        eq(dailyRevenues.branchId, branchId),
        between(dailyRevenues.date, startDate, endDate)
      )
    );

  const enteredDatesSet = new Set(
    enteredDays.map(d => new Date(d.date).toDateString())
  );

  // البحث عن الأيام الناقصة
  const missingDays: Date[] = [];
  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(year, month - 1, day);
    if (!enteredDatesSet.has(date.toDateString())) {
      missingDays.push(date);
    }
  }

  // الأسابيع غير المكتملة
  const weeksCount = totalDays > 28 ? 5 : 4;
  const incompleteWeeks: Array<{
    weekNumber: number;
    missingDays: number;
    hasBonus: boolean;
  }> = [];

  for (let week = 1; week <= weeksCount; week++) {
    const weekStart = (week - 1) * 7 + 1;
    const weekEnd = Math.min(week * 7, totalDays);
    const expectedDays = weekEnd - weekStart + 1;

    let daysInWeek = 0;
    for (let day = weekStart; day <= weekEnd; day++) {
      const date = new Date(year, month - 1, day);
      if (enteredDatesSet.has(date.toDateString())) {
        daysInWeek++;
      }
    }

    // التحقق من وجود بونص
    const bonus = await db
      .select({ id: weeklyBonuses.id })
      .from(weeklyBonuses)
      .where(
        and(
          eq(weeklyBonuses.branchId, branchId),
          eq(weeklyBonuses.weekNumber, week),
          eq(weeklyBonuses.month, month),
          eq(weeklyBonuses.year, year)
        )
      )
      .limit(1);

    if (daysInWeek < expectedDays) {
      incompleteWeeks.push({
        weekNumber: week,
        missingDays: expectedDays - daysInWeek,
        hasBonus: bonus.length > 0,
      });
    }
  }

  // الموظفين بدون إيرادات
  const activeEmployees = await db
    .select({ id: employees.id, name: employees.name })
    .from(employees)
    .where(
      and(
        eq(employees.branchId, branchId),
        eq(employees.isActive, true)
      )
    );

  const employeesWithoutRevenue: Array<{
    employeeId: number;
    employeeName: string;
    missingDays: number;
  }> = [];

  for (const emp of activeEmployees) {
    const empRevenues = await db
      .select({ count: sql<number>`COUNT(DISTINCT DATE(${dailyRevenues.date}))` })
      .from(employeeRevenues)
      .innerJoin(dailyRevenues, eq(employeeRevenues.dailyRevenueId, dailyRevenues.id))
      .where(
        and(
          eq(employeeRevenues.employeeId, emp.id),
          eq(dailyRevenues.branchId, branchId),
          between(dailyRevenues.date, startDate, endDate)
        )
      );

    const daysWithRevenue = Number(empRevenues[0]?.count || 0);
    const missingDaysCount = enteredDatesSet.size - daysWithRevenue;

    if (missingDaysCount > 0) {
      employeesWithoutRevenue.push({
        employeeId: emp.id,
        employeeName: emp.name,
        missingDays: missingDaysCount,
      });
    }
  }

  return {
    missingDays,
    incompleteWeeks,
    employeesWithoutRevenue,
    completionRate: ((totalDays - missingDays.length) / totalDays) * 100,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. 🛡️ AUDIT & COMPLIANCE - المراجعة والامتثال
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 5.1 تقرير الامتثال
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function getComplianceReport(
  branchId: number,
  month: number,
  year: number
): Promise<{
  bonusCalculationCompliance: {
    onTime: number;
    delayed: number;
    delayedDetails: Array<{ weekNumber: number; delayDays: number }>;
  };
  approvalCompliance: {
    properlyApproved: number;
    missingApproval: number;
    details: Array<{ weekNumber: number; status: string; hasApproval: boolean }>;
  };
  dataEntryCompliance: {
    completeDays: number;
    incompleteDays: number;
    completionRate: number;
  };
  overallScore: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("فشل الاتصال بقاعدة البيانات");

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  const totalDays = endDate.getDate();

  // التحقق من حساب البونص في الوقت المحدد
  const weeklyBonusData = await db
    .select({
      weekNumber: weeklyBonuses.weekNumber,
      weekEnd: weeklyBonuses.weekEnd,
      createdAt: weeklyBonuses.createdAt,
      status: weeklyBonuses.status,
    })
    .from(weeklyBonuses)
    .where(
      and(
        eq(weeklyBonuses.branchId, branchId),
        eq(weeklyBonuses.month, month),
        eq(weeklyBonuses.year, year)
      )
    );

  let onTime = 0;
  let delayed = 0;
  const delayedDetails: Array<{ weekNumber: number; delayDays: number }> = [];

  for (const bonus of weeklyBonusData) {
    const weekEnd = new Date(bonus.weekEnd);
    const created = new Date(bonus.createdAt!);
    const expectedDeadline = new Date(weekEnd);
    expectedDeadline.setDate(expectedDeadline.getDate() + 2);

    if (created <= expectedDeadline) {
      onTime++;
    } else {
      delayed++;
      const delayDays = Math.ceil((created.getTime() - expectedDeadline.getTime()) / (1000 * 60 * 60 * 24));
      delayedDetails.push({ weekNumber: bonus.weekNumber, delayDays });
    }
  }

  // التحقق من الموافقات
  const approvalDetails: Array<{ weekNumber: number; status: string; hasApproval: boolean }> = [];
  let properlyApproved = 0;
  let missingApproval = 0;

  for (const bonus of weeklyBonusData) {
    const needsApproval = bonus.status === "approved";
    const hasApproval = bonus.status === "approved";

    if (needsApproval && !hasApproval) {
      missingApproval++;
    } else if (hasApproval) {
      properlyApproved++;
    }

    approvalDetails.push({
      weekNumber: bonus.weekNumber,
      status: bonus.status || "unknown",
      hasApproval,
    });
  }

  // التحقق من اكتمال إدخال البيانات
  const enteredDays = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(dailyRevenues)
    .where(
      and(
        eq(dailyRevenues.branchId, branchId),
        between(dailyRevenues.date, startDate, endDate)
      )
    );

  const completeDays = Number(enteredDays[0]?.count || 0);
  const incompleteDays = totalDays - completeDays;
  const completionRate = (completeDays / totalDays) * 100;

  // حساب النتيجة الإجمالية
  const totalWeeks = weeklyBonusData.length;
  const bonusScore = totalWeeks > 0 ? (onTime / totalWeeks) * 100 : 100;
  const approvalScore = totalWeeks > 0 ? (properlyApproved / totalWeeks) * 100 : 100;
  const entryScore = completionRate;

  const overallScore = (bonusScore * 0.3 + approvalScore * 0.3 + entryScore * 0.4);

  return {
    bonusCalculationCompliance: {
      onTime,
      delayed,
      delayedDetails,
    },
    approvalCompliance: {
      properlyApproved,
      missingApproval,
      details: approvalDetails,
    },
    dataEntryCompliance: {
      completeDays,
      incompleteDays,
      completionRate,
    },
    overallScore: Math.round(overallScore),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. 🔧 UTILITY FUNCTIONS - دوال مساعدة
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * تنفيذ استعلام مع قياس الوقت
 */
export async function executeWithTiming<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<{ result: T; executionTimeMs: number }> {
  const startTime = Date.now();
  const result = await operation();
  const executionTimeMs = Date.now() - startTime;

  console.log(`[Timing] ${operationName}: ${executionTimeMs}ms`);

  return { result, executionTimeMs };
}

/**
 * تحويل التاريخ للصيغة المناسبة
 */
export function formatDateForQuery(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * الحصول على نطاق الشهر
 */
export function getMonthRange(month: number, year: number): { start: Date; end: Date } {
  return {
    start: new Date(year, month - 1, 1),
    end: new Date(year, month, 0, 23, 59, 59),
  };
}
