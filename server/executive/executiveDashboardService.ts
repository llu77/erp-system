/**
 * Executive Dashboard Service - خدمة لوحة التحكم التنفيذية
 * KPIs في الوقت الفعلي، مقارنة الفروع، التنبؤات
 */

import { getDb } from "../db";
import { 
  kpiSnapshots, executiveAlerts, invoices, expenses, payrolls, employees, branches,
  InsertKPISnapshot, InsertExecutiveAlert
} from "../../drizzle/schema";
import { eq, desc, and, gte, lte, sql, sum, count, avg } from "drizzle-orm";

// ==================== أنواع البيانات ====================

export interface ExecutiveKPIs {
  // المالية
  totalRevenue: number;
  totalExpenses: number;
  totalPayroll: number;
  netProfit: number;
  profitMargin: number;
  
  // المقارنة
  revenueGrowth: number;
  expenseGrowth: number;
  profitGrowth: number;
  
  // التشغيلية
  totalEmployees: number;
  activeEmployees: number;
  employeeTurnover: number;
  
  // الفروع
  branchPerformance: BranchPerformance[];
  
  // التنبيهات
  criticalAlerts: number;
  pendingActions: number;
}

export interface BranchPerformance {
  branchId: number;
  branchName: string;
  revenue: number;
  expenses: number;
  profit: number;
  profitMargin: number;
  employeeCount: number;
  revenuePerEmployee: number;
  rank: number;
}

export interface FinancialTrend {
  period: string;
  revenue: number;
  expenses: number;
  profit: number;
  payroll: number;
}

export interface ExecutiveAlert {
  id: number;
  alertType: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  metric?: string;
  currentValue?: number;
  threshold?: number;
  recommendation?: string;
  createdAt: Date;
}

// ==================== حساب KPIs ====================

export async function calculateExecutiveKPIs(
  year: number,
  month: number
): Promise<ExecutiveKPIs> {
  const db = await getDb();
  if (!db) {
    return getEmptyKPIs();
  }
  
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  
  // الشهر السابق للمقارنة
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevStartDate = new Date(prevYear, prevMonth - 1, 1);
  const prevEndDate = new Date(prevYear, prevMonth, 0, 23, 59, 59);
  
  // 1. حساب الإيرادات الحالية
  const currentRevenue = await db.select({
    total: sql<number>`COALESCE(SUM(${invoices.total}), 0)`
  })
    .from(invoices)
    .where(and(
      gte(invoices.createdAt, startDate),
      lte(invoices.createdAt, endDate)
    ));
  
  // 2. حساب الإيرادات السابقة
  const prevRevenue = await db.select({
    total: sql<number>`COALESCE(SUM(${invoices.total}), 0)`
  })
    .from(invoices)
    .where(and(
      gte(invoices.createdAt, prevStartDate),
      lte(invoices.createdAt, prevEndDate)
    ));
  
  // 3. حساب المصاريف الحالية
  const currentExpenses = await db.select({
    total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)`
  })
    .from(expenses)
    .where(and(
      gte(expenses.createdAt, startDate),
      lte(expenses.createdAt, endDate)
    ));
  
  // 4. حساب المصاريف السابقة
  const prevExpenses = await db.select({
    total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)`
  })
    .from(expenses)
    .where(and(
      gte(expenses.createdAt, prevStartDate),
      lte(expenses.createdAt, prevEndDate)
    ));
  
  // 5. حساب الرواتب (آخر مسير)
  const latestPayroll = await db.select({
    total: sql<number>`COALESCE(SUM(${payrolls.totalNetSalary}), 0)`
  })
    .from(payrolls)
    .where(and(
      eq(payrolls.year, year),
      eq(payrolls.month, month)
    ));
  
  // 6. حساب الرواتب السابقة
  const prevPayroll = await db.select({
    total: sql<number>`COALESCE(SUM(${payrolls.totalNetSalary}), 0)`
  })
    .from(payrolls)
    .where(and(
      eq(payrolls.year, prevYear),
      eq(payrolls.month, prevMonth)
    ));
  
  // 7. حساب الموظفين
  const employeeStats = await db.select({
    total: count(),
    active: sql<number>`SUM(CASE WHEN ${employees.isActive} = 1 THEN 1 ELSE 0 END)`
  })
    .from(employees);
  
  // 8. أداء الفروع
  const branchPerformance = await calculateBranchPerformance(year, month);
  
  // 9. التنبيهات الحرجة
  const criticalAlertsCount = await db.select({ count: count() })
    .from(executiveAlerts)
    .where(and(
      eq(executiveAlerts.severity, "critical"),
      eq(executiveAlerts.status, "active")
    ));
  
  // حساب القيم
  const totalRevenue = Number(currentRevenue[0]?.total || 0);
  const totalExpenses = Number(currentExpenses[0]?.total || 0);
  const totalPayroll = Number(latestPayroll[0]?.total || 0);
  const netProfit = totalRevenue - totalExpenses - totalPayroll;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  
  const prevTotalRevenue = Number(prevRevenue[0]?.total || 0);
  const prevTotalExpenses = Number(prevExpenses[0]?.total || 0);
  const prevTotalPayroll = Number(prevPayroll[0]?.total || 0);
  const prevNetProfit = prevTotalRevenue - prevTotalExpenses - prevTotalPayroll;
  
  // حساب النمو
  const revenueGrowth = prevTotalRevenue > 0 
    ? ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100 
    : 0;
  const expenseGrowth = prevTotalExpenses > 0 
    ? ((totalExpenses - prevTotalExpenses) / prevTotalExpenses) * 100 
    : 0;
  const profitGrowth = prevNetProfit !== 0 
    ? ((netProfit - prevNetProfit) / Math.abs(prevNetProfit)) * 100 
    : 0;
  
  return {
    totalRevenue,
    totalExpenses,
    totalPayroll,
    netProfit,
    profitMargin,
    revenueGrowth,
    expenseGrowth,
    profitGrowth,
    totalEmployees: Number(employeeStats[0]?.total || 0),
    activeEmployees: Number(employeeStats[0]?.active || 0),
    employeeTurnover: 0, // يحتاج حساب منفصل
    branchPerformance,
    criticalAlerts: criticalAlertsCount[0]?.count || 0,
    pendingActions: 0,
  };
}

// ==================== أداء الفروع ====================

async function calculateBranchPerformance(
  year: number,
  month: number
): Promise<BranchPerformance[]> {
  const db = await getDb();
  if (!db) return [];
  
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  
  // جلب الفروع
  const allBranches = await db.select().from(branches);
  
  const performance: BranchPerformance[] = [];
  
  for (const branch of allBranches) {
    // إيرادات الفرع
    const branchRevenue = await db.select({
      total: sql<number>`COALESCE(SUM(${invoices.total}), 0)`
    })
      .from(invoices)
      .where(and(
        eq(invoices.branchId, branch.id),
        gte(invoices.createdAt, startDate),
        lte(invoices.createdAt, endDate)
      ));
    
    // مصاريف الفرع
    const branchExpenses = await db.select({
      total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)`
    })
      .from(expenses)
      .where(and(
        eq(expenses.branchId, branch.id),
        gte(expenses.createdAt, startDate),
        lte(expenses.createdAt, endDate)
      ));
    
    // موظفي الفرع
    const branchEmployees = await db.select({ count: count() })
      .from(employees)
      .where(eq(employees.branchId, branch.id));
    
    const revenue = Number(branchRevenue[0]?.total || 0);
    const expensesTotal = Number(branchExpenses[0]?.total || 0);
    const profit = revenue - expensesTotal;
    const employeeCount = branchEmployees[0]?.count || 0;
    
    performance.push({
      branchId: branch.id,
      branchName: branch.name,
      revenue,
      expenses: expensesTotal,
      profit,
      profitMargin: revenue > 0 ? (profit / revenue) * 100 : 0,
      employeeCount,
      revenuePerEmployee: employeeCount > 0 ? revenue / employeeCount : 0,
      rank: 0, // سيتم حسابه لاحقاً
    });
  }
  
  // ترتيب الفروع حسب الربح
  performance.sort((a, b) => b.profit - a.profit);
  performance.forEach((p, index) => {
    p.rank = index + 1;
  });
  
  return performance;
}

// ==================== الاتجاهات المالية ====================

export async function getFinancialTrends(
  year: number,
  months: number = 12
): Promise<FinancialTrend[]> {
  const db = await getDb();
  if (!db) return [];
  
  const trends: FinancialTrend[] = [];
  
  for (let i = 0; i < months; i++) {
    const targetMonth = ((year * 12 + 12 - i - 1) % 12) + 1;
    const targetYear = Math.floor((year * 12 + 12 - i - 1) / 12);
    
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);
    
    // الإيرادات
    const revenue = await db.select({
      total: sql<number>`COALESCE(SUM(${invoices.total}), 0)`
    })
      .from(invoices)
      .where(and(
        gte(invoices.createdAt, startDate),
        lte(invoices.createdAt, endDate)
      ));
    
    // المصاريف
    const expensesResult = await db.select({
      total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)`
    })
      .from(expenses)
      .where(and(
        gte(expenses.createdAt, startDate),
        lte(expenses.createdAt, endDate)
      ));
    
    // الرواتب
    const payroll = await db.select({
      total: sql<number>`COALESCE(SUM(${payrolls.totalNetSalary}), 0)`
    })
      .from(payrolls)
      .where(and(
        eq(payrolls.year, targetYear),
        eq(payrolls.month, targetMonth)
      ));
    
    const revenueTotal = Number(revenue[0]?.total || 0);
    const expensesTotal = Number(expensesResult[0]?.total || 0);
    const payrollTotal = Number(payroll[0]?.total || 0);
    
    trends.unshift({
      period: `${targetYear}-${String(targetMonth).padStart(2, '0')}`,
      revenue: revenueTotal,
      expenses: expensesTotal,
      profit: revenueTotal - expensesTotal - payrollTotal,
      payroll: payrollTotal,
    });
  }
  
  return trends;
}

// ==================== إنشاء تنبيه تنفيذي ====================

export async function createExecutiveAlert(input: {
  alertType: "revenue_drop" | "expense_spike" | "profit_warning" | "cash_flow_risk" | "compliance_issue" | "performance_alert" | "document_expiry" | "target_achievement" | "anomaly_detected";
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  metric?: string;
  currentValue?: number;
  threshold?: number;
  percentageChange?: number;
  recommendation?: string;
  branchId?: number;
  relatedEntityType?: string;
  relatedEntityId?: number;
}): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const alert: InsertExecutiveAlert = {
    alertType: input.alertType,
    severity: input.severity,
    title: input.title,
    titleAr: input.title, // نفس العنوان بالعربي
    message: input.message,
    messageAr: input.message, // نفس الرسالة بالعربي
    metrics: input.currentValue ? {
      currentValue: input.currentValue,
      threshold: input.threshold,
      changePercent: input.percentageChange,
    } : null,
    recommendation: input.recommendation,
    recommendationAr: input.recommendation,
    branchId: input.branchId,
    entityType: input.relatedEntityType,
    entityId: input.relatedEntityId,
    status: "active",
  };
  
  const [result] = await db.insert(executiveAlerts).values(alert);
  return result.insertId;
}

// ==================== جلب التنبيهات ====================

export async function getExecutiveAlerts(options: {
  status?: "active" | "acknowledged" | "resolved" | "dismissed";
  severity?: "info" | "warning" | "critical";
  branchId?: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  
  if (options.status) conditions.push(eq(executiveAlerts.status, options.status));
  if (options.severity) conditions.push(eq(executiveAlerts.severity, options.severity));
  if (options.branchId) conditions.push(eq(executiveAlerts.branchId, options.branchId));
  
  const alerts = await db.select()
    .from(executiveAlerts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(executiveAlerts.createdAt))
    .limit(options.limit || 50);
  
  return alerts;
}

// ==================== تحديث حالة التنبيه ====================

export async function updateAlertStatus(
  alertId: number,
  status: "acknowledged" | "resolved" | "dismissed",
  userId: number
) {
  const db = await getDb();
  if (!db) return;
  
  const updateData: Partial<InsertExecutiveAlert> = {
    status,
  };
  
  if (status === "acknowledged") {
    updateData.acknowledgedBy = userId;
    updateData.acknowledgedAt = new Date();
  } else if (status === "resolved") {
    updateData.resolvedBy = userId;
    updateData.resolvedAt = new Date();
  }
  
  await db.update(executiveAlerts)
    .set(updateData)
    .where(eq(executiveAlerts.id, alertId));
}

// ==================== حفظ لقطة KPIs ====================

export async function saveKPISnapshot(
  year: number,
  month: number,
  kpis: ExecutiveKPIs
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const snapshot: InsertKPISnapshot = {
    year,
    month,
    snapshotDate: new Date(),
    periodType: "monthly",
    totalRevenue: String(kpis.totalRevenue),
    totalExpenses: String(kpis.totalExpenses),
    salaryExpenses: String(kpis.totalPayroll),
    netProfit: String(kpis.netProfit),
    profitMargin: String(kpis.profitMargin),
    revenueGrowth: String(kpis.revenueGrowth),
    expenseGrowth: String(kpis.expenseGrowth),
    profitGrowth: String(kpis.profitGrowth),
    totalEmployees: kpis.totalEmployees,
    activeEmployees: kpis.activeEmployees,
    pendingRequests: kpis.pendingActions,
    additionalMetrics: {
      criticalAlerts: kpis.criticalAlerts,
      employeeTurnover: kpis.employeeTurnover,
    },
  };
  
  const [result] = await db.insert(kpiSnapshots).values(snapshot);
  return result.insertId;
}

// ==================== تحليل الأداء التلقائي ====================

export async function analyzePerformanceAndGenerateAlerts(
  year: number,
  month: number
): Promise<void> {
  const kpis = await calculateExecutiveKPIs(year, month);
  
  // 1. تنبيه انخفاض الإيرادات
  if (kpis.revenueGrowth < -10) {
    await createExecutiveAlert({
      alertType: "revenue_drop" as const,
      severity: kpis.revenueGrowth < -20 ? "critical" : "warning",
      title: "انخفاض في الإيرادات",
      message: `انخفضت الإيرادات بنسبة ${Math.abs(kpis.revenueGrowth).toFixed(1)}% مقارنة بالشهر السابق`,
      metric: "revenue_growth",
      currentValue: kpis.totalRevenue,
      percentageChange: kpis.revenueGrowth,
      recommendation: "مراجعة استراتيجية المبيعات وتحليل أسباب الانخفاض",
    });
  }
  
  // 2. تنبيه ارتفاع المصاريف
  if (kpis.expenseGrowth > 15) {
    await createExecutiveAlert({
      alertType: "expense_spike" as const,
      severity: kpis.expenseGrowth > 30 ? "critical" : "warning",
      title: "ارتفاع في المصاريف",
      message: `ارتفعت المصاريف بنسبة ${kpis.expenseGrowth.toFixed(1)}% مقارنة بالشهر السابق`,
      metric: "expense_growth",
      currentValue: kpis.totalExpenses,
      percentageChange: kpis.expenseGrowth,
      recommendation: "مراجعة بنود المصاريف وتحديد أسباب الارتفاع",
    });
  }
  
  // 3. تنبيه هامش الربح المنخفض
  if (kpis.profitMargin < 10) {
    await createExecutiveAlert({
      alertType: "profit_warning" as const,
      severity: kpis.profitMargin < 5 ? "critical" : "warning",
      title: "هامش ربح منخفض",
      message: `هامش الربح الحالي ${kpis.profitMargin.toFixed(1)}% وهو أقل من الحد الأدنى المقبول`,
      metric: "profit_margin",
      currentValue: kpis.profitMargin,
      threshold: 10,
      recommendation: "مراجعة التسعير وتقليل التكاليف التشغيلية",
    });
  }
  
  // 4. تنبيه أداء الفروع
  for (const branch of kpis.branchPerformance) {
    if (branch.profitMargin < 0) {
      await createExecutiveAlert({
        alertType: "performance_alert" as const,
        severity: "critical",
        title: `فرع ${branch.branchName} يحقق خسارة`,
        message: `الفرع يحقق خسارة بقيمة ${Math.abs(branch.profit).toLocaleString()} ر.س`,
        metric: "branch_profit",
        currentValue: branch.profit,
        branchId: branch.branchId,
        recommendation: "مراجعة عاجلة لأداء الفرع واتخاذ إجراءات تصحيحية",
      });
    }
  }
  
  // حفظ لقطة KPIs
  await saveKPISnapshot(year, month, kpis);
}

// ==================== دالة مساعدة ====================

function getEmptyKPIs(): ExecutiveKPIs {
  return {
    totalRevenue: 0,
    totalExpenses: 0,
    totalPayroll: 0,
    netProfit: 0,
    profitMargin: 0,
    revenueGrowth: 0,
    expenseGrowth: 0,
    profitGrowth: 0,
    totalEmployees: 0,
    activeEmployees: 0,
    employeeTurnover: 0,
    branchPerformance: [],
    criticalAlerts: 0,
    pendingActions: 0,
  };
}


// ==================== مقارنة الفروع ====================

export interface BranchComparisonData {
  branchId: number;
  branchName: string;
  revenue: number;
  expenses: number;
  profit: number;
  profitMargin: number;
  employeeCount: number;
  revenuePerEmployee: number;
  growth: number;
  rank: number;
}

export async function getBranchComparison(year: number, month: number): Promise<BranchComparisonData[]> {
  const kpis = await calculateExecutiveKPIs(year, month);
  
  const comparison = kpis.branchPerformance.map((branch, index) => ({
    branchId: branch.branchId,
    branchName: branch.branchName,
    revenue: branch.revenue,
    expenses: branch.expenses,
    profit: branch.profit,
    profitMargin: branch.profitMargin,
    employeeCount: branch.employeeCount,
    revenuePerEmployee: branch.employeeCount > 0 ? branch.revenue / branch.employeeCount : 0,
    growth: 0, // يمكن حسابه من البيانات التاريخية
    rank: index + 1,
  }));
  
  // ترتيب حسب الربح
  comparison.sort((a, b) => b.profit - a.profit);
  comparison.forEach((branch, index) => {
    branch.rank = index + 1;
  });
  
  return comparison;
}

// ==================== تحليل الأداء ====================

export interface PerformanceAnalysisResult {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  recommendations: string[];
  overallScore: number;
}

export async function runPerformanceAnalysis(year: number, month: number): Promise<PerformanceAnalysisResult> {
  const kpis = await calculateExecutiveKPIs(year, month);
  
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const opportunities: string[] = [];
  const threats: string[] = [];
  const recommendations: string[] = [];
  
  // تحليل نقاط القوة
  if (kpis.profitMargin > 15) {
    strengths.push(`هامش ربح ممتاز بنسبة ${kpis.profitMargin.toFixed(1)}%`);
  }
  if (kpis.revenueGrowth > 10) {
    strengths.push(`نمو قوي في الإيرادات بنسبة ${kpis.revenueGrowth.toFixed(1)}%`);
  }
  if (kpis.employeeTurnover < 5) {
    strengths.push("معدل دوران موظفين منخفض يدل على استقرار الفريق");
  }
  
  // تحليل نقاط الضعف
  if (kpis.profitMargin < 10) {
    weaknesses.push(`هامش ربح منخفض (${kpis.profitMargin.toFixed(1)}%) يحتاج تحسين`);
    recommendations.push("مراجعة هيكل التكاليف وتحسين الكفاءة التشغيلية");
  }
  if (kpis.expenseGrowth > 20) {
    weaknesses.push(`ارتفاع كبير في المصاريف بنسبة ${kpis.expenseGrowth.toFixed(1)}%`);
    recommendations.push("تحليل بنود المصاريف وتحديد فرص التوفير");
  }
  if (kpis.employeeTurnover > 15) {
    weaknesses.push("معدل دوران موظفين مرتفع يؤثر على الإنتاجية");
    recommendations.push("تحسين بيئة العمل وبرامج الاحتفاظ بالموظفين");
  }
  
  // تحليل الفرص
  const topBranch = kpis.branchPerformance.reduce((best, branch) => 
    branch.profitMargin > best.profitMargin ? branch : best, 
    kpis.branchPerformance[0] || { profitMargin: 0, branchName: "" }
  );
  if (topBranch && topBranch.profitMargin > 20) {
    opportunities.push(`تطبيق أفضل ممارسات فرع ${topBranch.branchName} على الفروع الأخرى`);
  }
  if (kpis.revenueGrowth > 0) {
    opportunities.push("استثمار النمو الحالي في التوسع وزيادة الحصة السوقية");
  }
  
  // تحليل التهديدات
  if (kpis.revenueGrowth < -5) {
    threats.push(`تراجع الإيرادات بنسبة ${Math.abs(kpis.revenueGrowth).toFixed(1)}%`);
    recommendations.push("تحليل أسباب التراجع ووضع خطة تصحيحية عاجلة");
  }
  const losingBranches = kpis.branchPerformance.filter(b => b.profit < 0);
  if (losingBranches.length > 0) {
    threats.push(`${losingBranches.length} فرع/فروع تحقق خسائر`);
    recommendations.push("مراجعة عاجلة للفروع الخاسرة واتخاذ قرارات استراتيجية");
  }
  
  // حساب النتيجة الإجمالية
  let score = 50; // نقطة البداية
  score += kpis.profitMargin > 15 ? 15 : kpis.profitMargin > 10 ? 10 : kpis.profitMargin > 5 ? 5 : 0;
  score += kpis.revenueGrowth > 10 ? 15 : kpis.revenueGrowth > 0 ? 10 : kpis.revenueGrowth > -5 ? 5 : 0;
  score -= kpis.expenseGrowth > 20 ? 10 : kpis.expenseGrowth > 10 ? 5 : 0;
  score -= losingBranches.length * 5;
  score = Math.max(0, Math.min(100, score));
  
  // إنشاء الملخص
  const summary = score >= 80 
    ? "الأداء ممتاز - الشركة تحقق نتائج قوية في معظم المؤشرات"
    : score >= 60
    ? "الأداء جيد - هناك مجال للتحسين في بعض المجالات"
    : score >= 40
    ? "الأداء متوسط - يحتاج اهتمام وتحسينات جوهرية"
    : "الأداء ضعيف - يتطلب تدخل عاجل وإعادة هيكلة";
  
  return {
    summary,
    strengths,
    weaknesses,
    opportunities,
    threats,
    recommendations,
    overallScore: score,
  };
}
