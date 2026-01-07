/**
 * خدمة تحليلات الإيرادات والمصاريف وأداء الموظفين
 * تحليلات علمية ودقيقة باستخدام خوارزميات رياضية وإحصائية
 */

import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { 
  dailyRevenues, employeeRevenues, expenses, employees, branches,
  monthlyRecords
} from "../../drizzle/schema";
import { sql, eq, and, gte, lte, desc, asc } from "drizzle-orm";
import { TOTAL_FIXED_COSTS, FIXED_COSTS_PER_BRANCH, BRANCHES_COUNT } from "./financialForecastService";

// ==================== أنواع البيانات ====================

export interface RevenueAnalysis {
  period: string;
  totalRevenue: number;
  totalCash: number;
  totalNetwork: number;
  daysCount: number; // عدد الأيام المسجلة فعلياً
  periodDays: number; // عدد أيام الفترة الفعلية (لحساب المتوسط الصحيح)
  avgDailyRevenue: number; // المتوسط اليومي = إجمالي ÷ عدد أيام الفترة
  trend: 'up' | 'down' | 'stable';
  growthRate: number;
  volatility: number; // معامل التباين
}

export interface ExpenseAnalysis {
  period: string;
  totalExpenses: number;
  expensesByCategory: { category: string; amount: number; percentage: number }[];
  avgDailyExpense: number;
  trend: 'up' | 'down' | 'stable';
  growthRate: number;
}

export interface EmployeePerformanceAnalysis {
  employeeId: number;
  employeeName: string;
  employeeCode: string;
  totalRevenue: number;
  avgDailyRevenue: number;
  daysWorked: number;
  performanceScore: number; // 0-100
  rank: number;
  trend: 'improving' | 'declining' | 'stable';
  consistency: number; // معامل الاتساق
}

export interface ProfitabilityAnalysis {
  period: string;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  breakEvenPoint: number;
  operatingRatio: number;
}

export interface StatisticalMetrics {
  mean: number;
  median: number;
  standardDeviation: number;
  variance: number;
  coefficientOfVariation: number;
  skewness: number;
  min: number;
  max: number;
  range: number;
  quartiles: { q1: number; q2: number; q3: number };
}

export interface AIBusinessInsights {
  summary: string;
  revenueInsights: string[];
  expenseInsights: string[];
  employeeInsights: string[];
  recommendations: string[];
  risks: string[];
  opportunities: string[];
  riskLevel: 'low' | 'medium' | 'high';
  confidenceScore: number;
  dataQuality: 'excellent' | 'good' | 'fair' | 'poor';
}

// ==================== دوال إحصائية ====================

/**
 * حساب المقاييس الإحصائية الأساسية
 */
function calculateStatistics(values: number[]): StatisticalMetrics {
  if (values.length === 0) {
    return {
      mean: 0, median: 0, standardDeviation: 0, variance: 0,
      coefficientOfVariation: 0, skewness: 0, min: 0, max: 0, range: 0,
      quartiles: { q1: 0, q2: 0, q3: 0 }
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = values.length;
  
  // المتوسط الحسابي
  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  
  // الوسيط
  const median = n % 2 === 0 
    ? (sorted[n/2 - 1] + sorted[n/2]) / 2 
    : sorted[Math.floor(n/2)];
  
  // التباين والانحراف المعياري
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
  const standardDeviation = Math.sqrt(variance);
  
  // معامل التباين (CV)
  const coefficientOfVariation = mean !== 0 ? (standardDeviation / mean) * 100 : 0;
  
  // الالتواء (Skewness)
  const skewness = n > 2 
    ? (values.reduce((sum, v) => sum + Math.pow((v - mean) / standardDeviation, 3), 0) / n)
    : 0;
  
  // الربيعيات
  const q1Index = Math.floor(n * 0.25);
  const q2Index = Math.floor(n * 0.5);
  const q3Index = Math.floor(n * 0.75);
  
  return {
    mean,
    median,
    standardDeviation,
    variance,
    coefficientOfVariation,
    skewness,
    min: sorted[0],
    max: sorted[n - 1],
    range: sorted[n - 1] - sorted[0],
    quartiles: {
      q1: sorted[q1Index],
      q2: sorted[q2Index],
      q3: sorted[q3Index]
    }
  };
}

/**
 * حساب معدل النمو
 */
function calculateGrowthRate(currentValue: number, previousValue: number): number {
  if (previousValue === 0) return currentValue > 0 ? 100 : 0;
  return ((currentValue - previousValue) / previousValue) * 100;
}

/**
 * حساب الاتجاه باستخدام الانحدار الخطي البسيط
 */
function calculateTrend(values: number[]): { slope: number; trend: 'up' | 'down' | 'stable'; r2: number } {
  if (values.length < 2) {
    return { slope: 0, trend: 'stable', r2: 0 };
  }

  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((sum, v) => sum + v, 0) / n;
  
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (values[i] - yMean);
    denominator += Math.pow(i - xMean, 2);
  }
  
  const slope = denominator !== 0 ? numerator / denominator : 0;
  
  // حساب R² (معامل التحديد)
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const predicted = yMean + slope * (i - xMean);
    ssRes += Math.pow(values[i] - predicted, 2);
    ssTot += Math.pow(values[i] - yMean, 2);
  }
  const r2 = ssTot !== 0 ? 1 - (ssRes / ssTot) : 0;
  
  // تحديد الاتجاه بناءً على الميل ومعامل التحديد
  const threshold = yMean * 0.02; // 2% من المتوسط
  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (slope > threshold && r2 > 0.3) trend = 'up';
  else if (slope < -threshold && r2 > 0.3) trend = 'down';
  
  return { slope, trend, r2 };
}

/**
 * حساب المتوسط المتحرك
 */
function calculateMovingAverage(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = period - 1; i < values.length; i++) {
    const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  return result;
}

// ==================== خدمات التحليل ====================

/**
 * تحليل الإيرادات
 */
export async function analyzeRevenues(
  startDate: Date,
  endDate: Date,
  branchId?: number
): Promise<RevenueAnalysis & { statistics: StatisticalMetrics; dailyData: { date: string; revenue: number }[] }> {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  const conditions = [
    gte(dailyRevenues.date, startDate),
    lte(dailyRevenues.date, endDate)
  ];
  if (branchId) conditions.push(eq(dailyRevenues.branchId, branchId));

  // جلب البيانات اليومية
  const dailyData = await db
    .select({
      date: dailyRevenues.date,
      cash: dailyRevenues.cash,
      network: dailyRevenues.network,
      total: sql<number>`${dailyRevenues.cash} + ${dailyRevenues.network}`,
    })
    .from(dailyRevenues)
    .where(and(...conditions))
    .orderBy(asc(dailyRevenues.date));

  const revenueValues = dailyData.map(d => Number(d.total));
  const statistics = calculateStatistics(revenueValues);
  const trendAnalysis = calculateTrend(revenueValues);

  const totalRevenue = revenueValues.reduce((sum, v) => sum + v, 0);
  const totalCash = dailyData.reduce((sum, d) => sum + Number(d.cash), 0);
  const totalNetwork = dailyData.reduce((sum, d) => sum + Number(d.network), 0);
  const daysCount = dailyData.length;
  
  // حساب عدد أيام الفترة الفعلية (للمتوسط الصحيح)
  const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  // المتوسط اليومي الصحيح = إجمالي الإيرادات ÷ عدد أيام الفترة الفعلية
  const correctAvgDailyRevenue = periodDays > 0 ? totalRevenue / periodDays : 0;

  // حساب معدل النمو مقارنة بالفترة السابقة
  const periodLength = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const previousStart = new Date(startDate);
  previousStart.setDate(previousStart.getDate() - periodLength);
  const previousEnd = new Date(startDate);
  previousEnd.setDate(previousEnd.getDate() - 1);

  const previousConditions = [
    gte(dailyRevenues.date, previousStart),
    lte(dailyRevenues.date, previousEnd)
  ];
  if (branchId) previousConditions.push(eq(dailyRevenues.branchId, branchId));

  const [previousData] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${dailyRevenues.cash} + ${dailyRevenues.network}), 0)`,
    })
    .from(dailyRevenues)
    .where(and(...previousConditions));

  const previousTotal = Number(previousData?.total || 0);
  const growthRate = calculateGrowthRate(totalRevenue, previousTotal);

  return {
    period: `${startDate.toISOString().split('T')[0]} - ${endDate.toISOString().split('T')[0]}`,
    totalRevenue,
    totalCash,
    totalNetwork,
    daysCount, // عدد الأيام المسجلة
    periodDays, // عدد أيام الفترة الفعلية
    avgDailyRevenue: correctAvgDailyRevenue, // المتوسط = إجمالي ÷ أيام الفترة الفعلية
    trend: trendAnalysis.trend,
    growthRate,
    volatility: statistics.coefficientOfVariation,
    statistics,
    dailyData: dailyData.map(d => ({
      date: d.date instanceof Date ? d.date.toISOString().split('T')[0] : String(d.date),
      revenue: Number(d.total)
    }))
  };
}

/**
 * تحليل المصاريف
 */
export async function analyzeExpenses(
  startDate: Date,
  endDate: Date,
  branchId?: number
): Promise<ExpenseAnalysis & { statistics: StatisticalMetrics }> {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  // الفئات المكررة مع التكاليف الثابتة - يجب استبعادها
  // التكاليف الثابتة تشمل: إيجار محل، إيجار سكن، كهرباء، إنترنت، رواتب
  const duplicateCategories = ['shop_rent', 'housing_rent', 'electricity', 'internet'];
  
  const conditions = [
    gte(expenses.expenseDate, startDate),
    lte(expenses.expenseDate, endDate),
    // استبعاد الفئات المكررة مع التكاليف الثابتة
    sql`${expenses.category} NOT IN ('shop_rent', 'housing_rent', 'electricity', 'internet')`
  ];
  if (branchId) conditions.push(eq(expenses.branchId, branchId));

  // جلب المصاريف حسب الفئة
  const expensesByCategory = await db
    .select({
      category: expenses.category,
      amount: sql<number>`COALESCE(SUM(${expenses.amount}), 0)`,
    })
    .from(expenses)
    .where(and(...conditions))
    .groupBy(expenses.category);

  // جلب المصاريف اليومية
  const dailyExpenses = await db
    .select({
      date: expenses.expenseDate,
      amount: sql<number>`COALESCE(SUM(${expenses.amount}), 0)`,
    })
    .from(expenses)
    .where(and(...conditions))
    .groupBy(expenses.expenseDate)
    .orderBy(asc(expenses.expenseDate));

  const expenseValues = dailyExpenses.map(d => Number(d.amount));
  const statistics = calculateStatistics(expenseValues);
  const trendAnalysis = calculateTrend(expenseValues);

  const totalExpenses = expensesByCategory.reduce((sum, c) => sum + Number(c.amount), 0);

  // حساب معدل النمو
  const periodLength = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const previousStart = new Date(startDate);
  previousStart.setDate(previousStart.getDate() - periodLength);
  const previousEnd = new Date(startDate);
  previousEnd.setDate(previousEnd.getDate() - 1);

  const previousConditions = [
    gte(expenses.expenseDate, previousStart),
    lte(expenses.expenseDate, previousEnd),
    // استبعاد الفئات المكررة مع التكاليف الثابتة
    sql`${expenses.category} NOT IN ('shop_rent', 'housing_rent', 'electricity', 'internet')`
  ];
  if (branchId) previousConditions.push(eq(expenses.branchId, branchId));

  const [previousData] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)`,
    })
    .from(expenses)
    .where(and(...previousConditions));

  const previousTotal = Number(previousData?.total || 0);
  const growthRate = calculateGrowthRate(totalExpenses, previousTotal);

  return {
    period: `${startDate.toISOString().split('T')[0]} - ${endDate.toISOString().split('T')[0]}`,
    totalExpenses,
    expensesByCategory: expensesByCategory.map(c => ({
      category: c.category || 'غير مصنف',
      amount: Number(c.amount),
      percentage: totalExpenses > 0 ? (Number(c.amount) / totalExpenses) * 100 : 0
    })),
    avgDailyExpense: statistics.mean,
    trend: trendAnalysis.trend,
    growthRate,
    statistics
  };
}

/**
 * تحليل أداء الموظفين
 */
export async function analyzeEmployeePerformance(
  startDate: Date,
  endDate: Date,
  branchId?: number
): Promise<EmployeePerformanceAnalysis[]> {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  // جلب إيرادات الموظفين
  const employeeData = await db
    .select({
      employeeId: employeeRevenues.employeeId,
      employeeName: employees.name,
      employeeCode: employees.code,
      date: dailyRevenues.date,
      cash: employeeRevenues.cash,
      network: employeeRevenues.network,
      total: employeeRevenues.total,
    })
    .from(employeeRevenues)
    .innerJoin(dailyRevenues, eq(employeeRevenues.dailyRevenueId, dailyRevenues.id))
    .innerJoin(employees, eq(employeeRevenues.employeeId, employees.id))
    .where(
      and(
        gte(dailyRevenues.date, startDate),
        lte(dailyRevenues.date, endDate),
        branchId ? eq(dailyRevenues.branchId, branchId) : undefined
      )
    )
    .orderBy(asc(dailyRevenues.date));

  // تجميع البيانات حسب الموظف
  const employeeMap = new Map<number, {
    name: string;
    code: string;
    dailyRevenues: number[];
    totalRevenue: number;
    daysWorked: number;
  }>();

  for (const row of employeeData) {
    const existing = employeeMap.get(row.employeeId);
    const revenue = Number(row.total);
    
    if (existing) {
      existing.dailyRevenues.push(revenue);
      existing.totalRevenue += revenue;
      existing.daysWorked++;
    } else {
      employeeMap.set(row.employeeId, {
        name: row.employeeName || `موظف ${row.employeeId}`,
        code: row.employeeCode || '',
        dailyRevenues: [revenue],
        totalRevenue: revenue,
        daysWorked: 1
      });
    }
  }

  // حساب الأداء لكل موظف
  const results: EmployeePerformanceAnalysis[] = [];
  const allTotals = Array.from(employeeMap.values()).map(e => e.totalRevenue);
  const maxTotal = Math.max(...allTotals, 1);
  const avgTotal = allTotals.reduce((sum, v) => sum + v, 0) / allTotals.length || 1;

  for (const [employeeId, data] of Array.from(employeeMap.entries())) {
    const statistics = calculateStatistics(data.dailyRevenues);
    const trendAnalysis = calculateTrend(data.dailyRevenues);
    
    // حساب درجة الأداء (0-100)
    // معادلة تجمع بين: الإيراد الكلي، الاتساق، والاتجاه
    const revenueScore = (data.totalRevenue / maxTotal) * 50; // 50% للإيراد
    const consistencyScore = Math.max(0, 100 - statistics.coefficientOfVariation) * 0.3; // 30% للاتساق
    const trendScore = trendAnalysis.trend === 'up' ? 20 : trendAnalysis.trend === 'stable' ? 10 : 0; // 20% للاتجاه
    const performanceScore = Math.min(100, revenueScore + consistencyScore + trendScore);

    results.push({
      employeeId,
      employeeName: data.name,
      employeeCode: data.code,
      totalRevenue: data.totalRevenue,
      avgDailyRevenue: statistics.mean,
      daysWorked: data.daysWorked,
      performanceScore: Math.round(performanceScore),
      rank: 0, // سيتم تحديده لاحقاً
      trend: trendAnalysis.trend === 'up' ? 'improving' : trendAnalysis.trend === 'down' ? 'declining' : 'stable',
      consistency: Math.max(0, 100 - statistics.coefficientOfVariation)
    });
  }

  // ترتيب الموظفين حسب الأداء
  results.sort((a, b) => b.performanceScore - a.performanceScore);
  results.forEach((emp, index) => emp.rank = index + 1);

  return results;
}

/**
 * تحليل الربحية - محدث ليستخدم التكاليف الثابتة الحقيقية
 */
export async function analyzeProfitability(
  startDate: Date,
  endDate: Date,
  branchId?: number
): Promise<ProfitabilityAnalysis> {
  const revenueAnalysis = await analyzeRevenues(startDate, endDate, branchId);
  const expenseAnalysis = await analyzeExpenses(startDate, endDate, branchId);

  // حساب عدد أشهر الفترة
  const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const monthsInPeriod = periodDays / 30;

  // التكاليف الثابتة الحقيقية للفترة
  // إذا تم تحديد فرع واحد، نستخدم تكاليف فرع واحد
  // إذا كانت جميع الفروع، نستخدم إجمالي التكاليف الثابتة
  const fixedCostsForPeriod = branchId 
    ? FIXED_COSTS_PER_BRANCH * monthsInPeriod 
    : TOTAL_FIXED_COSTS * monthsInPeriod;

  // المصاريف المسجلة في النظام (مصاريف إضافية غير التكاليف الثابتة)
  const recordedExpenses = expenseAnalysis.totalExpenses;

  // إجمالي التكاليف = التكاليف الثابتة + المصاريف المسجلة
  // التكاليف الثابتة: رواتب + إيجار محل + إيجار سكن + كهرباء + إنترنت (17,700 لكل فرع)
  // المصاريف المسجلة: مصاريف إضافية مسجلة في صفحة المصاريف
  const totalCosts = fixedCostsForPeriod + recordedExpenses;

  // صافي الربح = الإيرادات - إجمالي التكاليف
  const netProfit = revenueAnalysis.totalRevenue - totalCosts;
  const profitMargin = revenueAnalysis.totalRevenue > 0 
    ? (netProfit / revenueAnalysis.totalRevenue) * 100 
    : 0;
  
  // نقطة التعادل = التكاليف الثابتة / (1 - نسبة التكاليف المتغيرة)
  // نسبة التكاليف المتغيرة = المصاريف المسجلة / الإيرادات
  const variableCostRatio = revenueAnalysis.totalRevenue > 0 
    ? recordedExpenses / revenueAnalysis.totalRevenue 
    : 0.1; // افتراضي 10%
  const breakEvenPoint = (1 - variableCostRatio) > 0 
    ? fixedCostsForPeriod / (1 - variableCostRatio) 
    : fixedCostsForPeriod;
  
  // نسبة التشغيل = إجمالي التكاليف / الإيرادات
  const operatingRatio = revenueAnalysis.totalRevenue > 0 
    ? (totalCosts / revenueAnalysis.totalRevenue) * 100 
    : 0;

  return {
    period: revenueAnalysis.period,
    totalRevenue: revenueAnalysis.totalRevenue,
    totalExpenses: totalCosts, // إجمالي التكاليف (ثابتة + متغيرة)
    netProfit,
    profitMargin,
    breakEvenPoint,
    operatingRatio
  };
}

/**
 * الحصول على رؤى AI الشاملة المبنية على البيانات الفعلية
 */
export async function getComprehensiveAIInsights(
  startDate: Date,
  endDate: Date,
  branchId?: number
): Promise<AIBusinessInsights> {
  // جمع جميع التحليلات
  const [revenueAnalysis, expenseAnalysis, employeePerformance, profitability] = await Promise.all([
    analyzeRevenues(startDate, endDate, branchId),
    analyzeExpenses(startDate, endDate, branchId),
    analyzeEmployeePerformance(startDate, endDate, branchId),
    analyzeProfitability(startDate, endDate, branchId)
  ]);

  // تقييم جودة البيانات
  let dataQuality: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
  if (revenueAnalysis.daysCount >= 25) dataQuality = 'excellent';
  else if (revenueAnalysis.daysCount >= 15) dataQuality = 'good';
  else if (revenueAnalysis.daysCount >= 7) dataQuality = 'fair';

  // إعداد البيانات للتحليل بواسطة LLM
  const analysisData = {
    revenue: {
      total: Math.round(revenueAnalysis.totalRevenue),
      avgDaily: Math.round(revenueAnalysis.avgDailyRevenue),
      trend: revenueAnalysis.trend,
      growthRate: revenueAnalysis.growthRate.toFixed(1),
      volatility: revenueAnalysis.volatility.toFixed(1),
      daysCount: revenueAnalysis.daysCount,
      cashRatio: revenueAnalysis.totalRevenue > 0 
        ? ((revenueAnalysis.totalCash / revenueAnalysis.totalRevenue) * 100).toFixed(1) 
        : '0'
    },
    expenses: {
      total: Math.round(expenseAnalysis.totalExpenses),
      avgDaily: Math.round(expenseAnalysis.avgDailyExpense),
      trend: expenseAnalysis.trend,
      growthRate: expenseAnalysis.growthRate.toFixed(1),
      topCategories: expenseAnalysis.expensesByCategory.slice(0, 3)
    },
    profitability: {
      netProfit: Math.round(profitability.netProfit),
      profitMargin: profitability.profitMargin.toFixed(1),
      operatingRatio: profitability.operatingRatio.toFixed(1)
    },
    employees: {
      count: employeePerformance.length,
      topPerformers: employeePerformance.slice(0, 3).map(e => ({
        name: e.employeeName,
        score: e.performanceScore,
        revenue: Math.round(e.totalRevenue)
      })),
      avgPerformance: employeePerformance.length > 0 
        ? Math.round(employeePerformance.reduce((sum, e) => sum + e.performanceScore, 0) / employeePerformance.length)
        : 0,
      improvingCount: employeePerformance.filter(e => e.trend === 'improving').length,
      decliningCount: employeePerformance.filter(e => e.trend === 'declining').length
    }
  };

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `أنت محلل أعمال خبير متخصص في تحليل البيانات المالية وأداء الموظفين لصالونات التجميل.

## مبادئ التحليل:
1. **الدقة العلمية**: استخدم المؤشرات الإحصائية لدعم استنتاجاتك
2. **الموضوعية**: قدم تحليلاً متوازناً يشمل الإيجابيات والسلبيات
3. **العملية**: ركز على توصيات قابلة للتنفيذ فعلياً
4. **السياق**: ضع في اعتبارك طبيعة عمل الصالونات (موسمية، أيام الذروة، العطلات)

## معايير التقييم:
- هامش ربح > 25%: ممتاز
- هامش ربح 15-25%: جيد
- هامش ربح 5-15%: مقبول
- هامش ربح < 5%: يحتاج تحسين
- نسبة تشغيل < 70%: ممتازة
- نسبة تشغيل > 90%: خطرة
- معامل تباين < 20%: استقرار عالي
- معامل تباين > 40%: تذبذب كبير

## أسلوب الكتابة:
- استخدم لغة عربية فصحى واضحة
- اجعل كل رؤية محددة وقابلة للقياس
- اربط التوصيات بالبيانات الفعلية
- تجنب العموميات والكلام الإنشائي

يجب أن تكون إجابتك بصيغة JSON فقط.`
        },
        {
          role: "user",
          content: `قم بتحليل البيانات التالية وقدم رؤى شاملة:

## بيانات الإيرادات:
- إجمالي الإيرادات: ${analysisData.revenue.total} ريال
- متوسط الإيراد اليومي: ${analysisData.revenue.avgDaily} ريال
- الاتجاه: ${analysisData.revenue.trend === 'up' ? 'صاعد' : analysisData.revenue.trend === 'down' ? 'هابط' : 'مستقر'}
- معدل النمو مقارنة بالفترة السابقة: ${analysisData.revenue.growthRate}%
- معامل التباين (التذبذب): ${analysisData.revenue.volatility}%
- نسبة النقد من الإيرادات: ${analysisData.revenue.cashRatio}%
- عدد الأيام المسجلة: ${analysisData.revenue.daysCount}

## بيانات المصاريف:
- إجمالي المصاريف: ${analysisData.expenses.total} ريال
- متوسط المصاريف اليومية: ${analysisData.expenses.avgDaily} ريال
- الاتجاه: ${analysisData.expenses.trend === 'up' ? 'صاعد' : analysisData.expenses.trend === 'down' ? 'هابط' : 'مستقر'}
- معدل النمو: ${analysisData.expenses.growthRate}%
- أعلى فئات المصاريف: ${JSON.stringify(analysisData.expenses.topCategories)}

## مؤشرات الربحية:
- صافي الربح: ${analysisData.profitability.netProfit} ريال
- هامش الربح: ${analysisData.profitability.profitMargin}%
- نسبة التشغيل: ${analysisData.profitability.operatingRatio}%

## أداء الموظفين:
- عدد الموظفين: ${analysisData.employees.count}
- متوسط درجة الأداء: ${analysisData.employees.avgPerformance}/100
- موظفين في تحسن: ${analysisData.employees.improvingCount}
- موظفين في تراجع: ${analysisData.employees.decliningCount}
- أفضل 3 موظفين: ${JSON.stringify(analysisData.employees.topPerformers)}

## المطلوب:
قدم تحليلاً شاملاً يتضمن:

1. **الملخص التنفيذي**: جملتان إلى ثلاث جمل تلخص الوضع المالي والتشغيلي

2. **رؤى الإيرادات** (3 رؤى):
   - تحليل الاتجاه ومعدل النمو
   - تقييم الاستقرار (معامل التباين)
   - تحليل طرق الدفع (نقد/شبكة)

3. **رؤى المصاريف** (2 رؤيتان):
   - تحليل الفئات الرئيسية
   - تقييم نسبة التشغيل

4. **رؤى الموظفين** (2 رؤيتان):
   - تحليل الأداء العام
   - الفجوة بين أفضل وأضعف الموظفين

5. **التوصيات** (3 توصيات):
   - توصيات محددة وقابلة للتنفيذ
   - مرتبطة بالبيانات الفعلية

6. **المخاطر** (2 مخاطر):
   - مخاطر محتملة بناءً على البيانات

7. **الفرص** (2 فرصتان):
   - فرص للتحسين والنمو

8. **مستوى الخطر**: حدد مستوى الخطر بناءً على:
   - low: هامش ربح > 15% ونسبة تشغيل < 80%
   - medium: هامش ربح 5-15% أو نسبة تشغيل 80-90%
   - high: هامش ربح < 5% أو نسبة تشغيل > 90%

9. **درجة الثقة**: بناءً على جودة البيانات (60-95)

قدم التحليل بالصيغة التالية:
{
  "summary": "ملخص تنفيذي شامل للوضع المالي والتشغيلي (2-3 جمل)",
  "revenueInsights": ["رؤية 1 عن الإيرادات", "رؤية 2", "رؤية 3"],
  "expenseInsights": ["رؤية 1 عن المصاريف", "رؤية 2"],
  "employeeInsights": ["رؤية 1 عن أداء الموظفين", "رؤية 2"],
  "recommendations": ["توصية 1 عملية", "توصية 2", "توصية 3"],
  "risks": ["خطر 1 محتمل", "خطر 2"],
  "opportunities": ["فرصة 1", "فرصة 2"],
  "riskLevel": "low أو medium أو high",
  "confidenceScore": 85
}`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "business_insights",
          strict: true,
          schema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              revenueInsights: { type: "array", items: { type: "string" } },
              expenseInsights: { type: "array", items: { type: "string" } },
              employeeInsights: { type: "array", items: { type: "string" } },
              recommendations: { type: "array", items: { type: "string" } },
              risks: { type: "array", items: { type: "string" } },
              opportunities: { type: "array", items: { type: "string" } },
              riskLevel: { type: "string", enum: ["low", "medium", "high"] },
              confidenceScore: { type: "number" }
            },
            required: ["summary", "revenueInsights", "expenseInsights", "employeeInsights", "recommendations", "risks", "opportunities", "riskLevel", "confidenceScore"],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0].message.content;
    const result = JSON.parse(typeof content === 'string' ? content : JSON.stringify(content) || '{}');
    
    return {
      ...result,
      dataQuality
    };
  } catch (error) {
    // في حالة فشل LLM، نقدم تحليل أساسي
    const riskLevel = profitability.profitMargin < 0 ? 'high' : 
                      profitability.profitMargin < 10 ? 'medium' : 'low';
    
    return {
      summary: `إجمالي الإيرادات ${analysisData.revenue.total} ريال بهامش ربح ${analysisData.profitability.profitMargin}%. الاتجاه العام ${analysisData.revenue.trend === 'up' ? 'إيجابي' : analysisData.revenue.trend === 'down' ? 'سلبي' : 'مستقر'}.`,
      revenueInsights: [
        `متوسط الإيراد اليومي ${analysisData.revenue.avgDaily} ريال`,
        `معدل النمو ${analysisData.revenue.growthRate}% مقارنة بالفترة السابقة`,
        `نسبة التذبذب ${analysisData.revenue.volatility}%`
      ],
      expenseInsights: [
        `إجمالي المصاريف ${analysisData.expenses.total} ريال`,
        `نسبة التشغيل ${analysisData.profitability.operatingRatio}%`
      ],
      employeeInsights: [
        `${analysisData.employees.count} موظف نشط`,
        `متوسط درجة الأداء ${analysisData.employees.avgPerformance}/100`,
        `${analysisData.employees.improvingCount} موظف في تحسن، ${analysisData.employees.decliningCount} في تراجع`
      ],
      recommendations: [
        'مراجعة المصاريف ذات النسبة العالية',
        'تحفيز الموظفين المتراجعين',
        'الحفاظ على استقرار الإيرادات'
      ],
      risks: riskLevel === 'high' 
        ? ['هامش الربح منخفض', 'نسبة التشغيل مرتفعة']
        : ['تذبذب في الإيرادات'],
      opportunities: [
        'تحسين كفاءة التشغيل',
        'زيادة المبيعات عبر الشبكة'
      ],
      riskLevel,
      confidenceScore: 70,
      dataQuality
    };
  }
}

/**
 * التنبؤ بالإيرادات المستقبلية
 */
export async function forecastRevenue(
  branchId?: number,
  days: number = 7
): Promise<{ date: string; predicted: number; lowerBound: number; upperBound: number; confidence: number }[]> {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  // جلب بيانات آخر 60 يوم
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 60);

  const conditions = [
    gte(dailyRevenues.date, startDate),
    lte(dailyRevenues.date, endDate)
  ];
  if (branchId) conditions.push(eq(dailyRevenues.branchId, branchId));

  const historicalData = await db
    .select({
      date: dailyRevenues.date,
      total: sql<number>`${dailyRevenues.cash} + ${dailyRevenues.network}`,
    })
    .from(dailyRevenues)
    .where(and(...conditions))
    .orderBy(asc(dailyRevenues.date));

  if (historicalData.length < 7) {
    return [];
  }

  const values = historicalData.map(d => Number(d.total));
  const statistics = calculateStatistics(values);
  const trendAnalysis = calculateTrend(values);
  
  // حساب المتوسط المتحرك لآخر 7 أيام
  const recentValues = values.slice(-7);
  const recentAvg = recentValues.reduce((sum, v) => sum + v, 0) / recentValues.length;
  
  // التنبؤ باستخدام الاتجاه الخطي
  const forecasts = [];
  for (let i = 1; i <= days; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    
    // التنبؤ = المتوسط الأخير + (الميل × عدد الأيام)
    const predicted = recentAvg + (trendAnalysis.slope * i);
    
    // حدود الثقة بناءً على الانحراف المعياري
    const margin = statistics.standardDeviation * 1.96; // 95% confidence
    
    // تقليل الثقة كلما ابتعدنا في المستقبل
    const confidence = Math.max(50, 95 - (i * 5));
    
    forecasts.push({
      date: date.toISOString().split('T')[0],
      predicted: Math.max(0, Math.round(predicted)),
      lowerBound: Math.max(0, Math.round(predicted - margin * (1 + i * 0.1))),
      upperBound: Math.round(predicted + margin * (1 + i * 0.1)),
      confidence
    });
  }

  return forecasts;
}


/**
 * تقرير مقارنة شهري لأداء الفروع
 * يقارن أداء كل فرع على مدار الأشهر الماضية
 */
export interface MonthlyBranchComparison {
  branchId: number;
  branchName: string;
  months: {
    month: string;
    monthLabel: string;
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    profitMargin: number;
    daysCount: number;
    avgDailyRevenue: number;
    growthRate: number; // مقارنة بالشهر السابق
  }[];
  summary: {
    totalRevenue: number;
    totalExpenses: number;
    totalProfit: number;
    avgMonthlyRevenue: number;
    avgProfitMargin: number;
    bestMonth: string;
    worstMonth: string;
    overallTrend: 'improving' | 'declining' | 'stable';
    consistencyScore: number; // 0-100
  };
}

export interface MonthlyComparisonReport {
  period: string;
  monthsCount: number;
  branches: MonthlyBranchComparison[];
  overallSummary: {
    totalRevenue: number;
    totalExpenses: number;
    totalProfit: number;
    avgProfitMargin: number;
    bestBranch: { id: number; name: string; profit: number };
    worstBranch: { id: number; name: string; profit: number };
    monthlyTrend: { month: string; totalRevenue: number; totalProfit: number }[];
  };
  insights: string[];
  recommendations: string[];
}

/**
 * إنشاء تقرير مقارنة شهري لجميع الفروع
 * ملاحظة: يتم استبعاد الأشهر التي لا تحتوي على إيرادات من الحسابات
 */
export async function generateMonthlyComparisonReport(
  monthsCount: number = 6
): Promise<MonthlyComparisonReport> {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  // جلب جميع الفروع
  const allBranches = await db.select().from(branches);
  
  // تحديد الأشهر للتحليل
  const months: { start: Date; end: Date; label: string; key: string }[] = [];
  const now = new Date();
  
  for (let i = monthsCount - 1; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    
    months.push({
      start: monthDate,
      end: monthEnd,
      label: monthDate.toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' }),
      key: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`
    });
  }
  
  // تحديد الأشهر التي تحتوي على إيرادات فعلية
  const monthsWithRevenue = new Set<string>();
  for (const month of months) {
    const [revenueCheck] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${dailyRevenues.cash} + ${dailyRevenues.network}), 0)`,
      })
      .from(dailyRevenues)
      .where(and(
        gte(dailyRevenues.date, month.start),
        lte(dailyRevenues.date, month.end)
      ));
    
    if (Number(revenueCheck?.total || 0) > 0) {
      monthsWithRevenue.add(month.key);
    }
  }
  
  // تصفية الأشهر للاحتفاظ فقط بالأشهر ذات الإيرادات
  const activeMonths = months.filter(m => monthsWithRevenue.has(m.key));

  // تحليل كل فرع
  const branchComparisons: MonthlyBranchComparison[] = [];
  
  for (const branch of allBranches) {
    const monthlyData: MonthlyBranchComparison['months'] = [];
    let previousRevenue = 0;
    
    // استخدام activeMonths بدلاً من months لاستبعاد الأشهر بدون إيرادات
    for (const month of activeMonths) {
      // جلب الإيرادات للشهر
      const [revenueData] = await db
        .select({
          total: sql<number>`COALESCE(SUM(${dailyRevenues.cash} + ${dailyRevenues.network}), 0)`,
          count: sql<number>`COUNT(*)`,
        })
        .from(dailyRevenues)
        .where(and(
          eq(dailyRevenues.branchId, branch.id),
          gte(dailyRevenues.date, month.start),
          lte(dailyRevenues.date, month.end)
        ));
      
      const totalRevenue = Number(revenueData?.total || 0);
      
      // إذا لم يكن هناك إيرادات لهذا الفرع في هذا الشهر، لا نحتسب المصاريف الثابتة
      // هذا يمنع احتساب مصاريف ثابتة لأشهر بدون نشاط فعلي
      if (totalRevenue === 0) {
        // تخطي الشهر إذا لم يكن هناك إيرادات لهذا الفرع
        continue;
      }
      
      // جلب المصاريف للشهر (باستثناء التكاليف الثابتة المكررة)
      const [expenseData] = await db
        .select({
          total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)`,
        })
        .from(expenses)
        .where(and(
          eq(expenses.branchId, branch.id),
          gte(expenses.expenseDate, month.start),
          lte(expenses.expenseDate, month.end),
          sql`${expenses.category} NOT IN ('shop_rent', 'housing_rent', 'electricity', 'internet')`
        ));
      
      const recordedExpenses = Number(expenseData?.total || 0);
      // احتساب التكاليف الثابتة فقط للأشهر ذات الإيرادات
      const totalExpenses = FIXED_COSTS_PER_BRANCH + recordedExpenses;
      const netProfit = totalRevenue - totalExpenses;
      const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
      const daysCount = Number(revenueData?.count || 0);
      const daysInMonth = Math.ceil((month.end.getTime() - month.start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const avgDailyRevenue = daysInMonth > 0 ? totalRevenue / daysInMonth : 0;
      
      // حساب معدل النمو مقارنة بالشهر السابق
      const growthRate = previousRevenue > 0 
        ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 
        : 0;
      
      monthlyData.push({
        month: month.key,
        monthLabel: month.label,
        totalRevenue,
        totalExpenses,
        netProfit,
        profitMargin,
        daysCount,
        avgDailyRevenue,
        growthRate
      });
      
      previousRevenue = totalRevenue;
    }
    
    // حساب ملخص الفرع
    const totalRevenue = monthlyData.reduce((sum, m) => sum + m.totalRevenue, 0);
    const totalExpenses = monthlyData.reduce((sum, m) => sum + m.totalExpenses, 0);
    const totalProfit = monthlyData.reduce((sum, m) => sum + m.netProfit, 0);
    const avgMonthlyRevenue = monthlyData.length > 0 ? totalRevenue / monthlyData.length : 0;
    const avgProfitMargin = monthlyData.length > 0 
      ? monthlyData.reduce((sum, m) => sum + m.profitMargin, 0) / monthlyData.length 
      : 0;
    
    // أفضل وأسوأ شهر
    const sortedByProfit = [...monthlyData].sort((a, b) => b.netProfit - a.netProfit);
    const bestMonth = sortedByProfit[0]?.monthLabel || '';
    const worstMonth = sortedByProfit[sortedByProfit.length - 1]?.monthLabel || '';
    
    // تحديد الاتجاه العام
    const revenueValues = monthlyData.map(m => m.totalRevenue);
    const trendAnalysis = calculateTrend(revenueValues);
    
    // حساب درجة الاتساق
    const stats = calculateStatistics(revenueValues);
    const consistencyScore = stats.mean > 0 
      ? Math.max(0, 100 - stats.coefficientOfVariation) 
      : 0;
    
    branchComparisons.push({
      branchId: branch.id,
      branchName: branch.name,
      months: monthlyData,
      summary: {
        totalRevenue,
        totalExpenses,
        totalProfit,
        avgMonthlyRevenue,
        avgProfitMargin,
        bestMonth,
        worstMonth,
        overallTrend: trendAnalysis.trend === 'up' ? 'improving' : 
                      trendAnalysis.trend === 'down' ? 'declining' : 'stable',
        consistencyScore: Math.round(consistencyScore)
      }
    });
  }
  
  // حساب الملخص العام
  const totalRevenue = branchComparisons.reduce((sum, b) => sum + b.summary.totalRevenue, 0);
  const totalExpenses = branchComparisons.reduce((sum, b) => sum + b.summary.totalExpenses, 0);
  const totalProfit = branchComparisons.reduce((sum, b) => sum + b.summary.totalProfit, 0);
  const avgProfitMargin = branchComparisons.length > 0
    ? branchComparisons.reduce((sum, b) => sum + b.summary.avgProfitMargin, 0) / branchComparisons.length
    : 0;
  
  // أفضل وأسوأ فرع
  const sortedBranches = [...branchComparisons].sort((a, b) => b.summary.totalProfit - a.summary.totalProfit);
  const bestBranch = sortedBranches[0] 
    ? { id: sortedBranches[0].branchId, name: sortedBranches[0].branchName, profit: sortedBranches[0].summary.totalProfit }
    : { id: 0, name: '', profit: 0 };
  const worstBranch = sortedBranches[sortedBranches.length - 1]
    ? { id: sortedBranches[sortedBranches.length - 1].branchId, name: sortedBranches[sortedBranches.length - 1].branchName, profit: sortedBranches[sortedBranches.length - 1].summary.totalProfit }
    : { id: 0, name: '', profit: 0 };
  
  // الاتجاه الشهري الإجمالي - فقط للأشهر ذات الإيرادات
  const monthlyTrend = activeMonths.map((month) => {
    // جمع إيرادات وأرباح كل الفروع لهذا الشهر
    const monthRevenue = branchComparisons.reduce((sum, b) => {
      const monthData = b.months.find(m => m.month === month.key);
      return sum + (monthData?.totalRevenue || 0);
    }, 0);
    const monthProfit = branchComparisons.reduce((sum, b) => {
      const monthData = b.months.find(m => m.month === month.key);
      return sum + (monthData?.netProfit || 0);
    }, 0);
    return {
      month: month.label,
      totalRevenue: monthRevenue,
      totalProfit: monthProfit
    };
  });
  
  // توليد الرؤى والتوصيات باستخدام AI
  const { insights, recommendations } = await generateComparisonInsights(branchComparisons, monthlyTrend);
  
  // تحديد الفترة بناءً على الأشهر النشطة فقط
  return {
    period: activeMonths.length > 0 
      ? `${activeMonths[0]?.label || ''} - ${activeMonths[activeMonths.length - 1]?.label || ''}`
      : 'لا توجد بيانات',
    monthsCount,
    branches: branchComparisons,
    overallSummary: {
      totalRevenue,
      totalExpenses,
      totalProfit,
      avgProfitMargin,
      bestBranch,
      worstBranch,
      monthlyTrend
    },
    insights,
    recommendations
  };
}

/**
 * توليد رؤى وتوصيات للمقارنة الشهرية
 */
async function generateComparisonInsights(
  branches: MonthlyBranchComparison[],
  monthlyTrend: { month: string; totalRevenue: number; totalProfit: number }[]
): Promise<{ insights: string[]; recommendations: string[] }> {
  try {
    const analysisData = {
      branches: branches.map(b => ({
        name: b.branchName,
        totalRevenue: Math.round(b.summary.totalRevenue),
        totalProfit: Math.round(b.summary.totalProfit),
        avgProfitMargin: b.summary.avgProfitMargin.toFixed(1),
        trend: b.summary.overallTrend,
        consistency: b.summary.consistencyScore,
        bestMonth: b.summary.bestMonth,
        worstMonth: b.summary.worstMonth
      })),
      monthlyTrend: monthlyTrend.map(m => ({
        month: m.month,
        revenue: Math.round(m.totalRevenue),
        profit: Math.round(m.totalProfit)
      }))
    };

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `أنت محلل أعمال خبير متخصص في تحليل أداء الفروع والمقارنات الشهرية.
          قدم تحليلاً دقيقاً وموضوعياً مع رؤى عملية وتوصيات قابلة للتنفيذ.
          ركز على:
          1. الفروقات في الأداء بين الفروع
          2. الاتجاهات الشهرية والموسمية
          3. نقاط القوة والضعف لكل فرع
          4. الفرص والتحديات
          يجب أن تكون إجابتك بصيغة JSON فقط.`
        },
        {
          role: "user",
          content: `قم بتحليل بيانات المقارنة الشهرية التالية وقدم رؤى وتوصيات:

## بيانات الفروع:
${JSON.stringify(analysisData.branches, null, 2)}

## الاتجاه الشهري:
${JSON.stringify(analysisData.monthlyTrend, null, 2)}

قدم التحليل بالصيغة التالية:
{
  "insights": [
    "رؤية 1 عن أداء الفروع",
    "رؤية 2 عن الاتجاهات",
    "رؤية 3 عن المقارنة",
    "رؤية 4 عن الفرص"
  ],
  "recommendations": [
    "توصية 1 عملية وقابلة للتنفيذ",
    "توصية 2",
    "توصية 3"
  ]
}`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "comparison_insights",
          strict: true,
          schema: {
            type: "object",
            properties: {
              insights: { type: "array", items: { type: "string" } },
              recommendations: { type: "array", items: { type: "string" } }
            },
            required: ["insights", "recommendations"],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0].message.content;
    return JSON.parse(typeof content === 'string' ? content : JSON.stringify(content) || '{}');
  } catch (error) {
    // في حالة فشل LLM، نقدم رؤى أساسية
    const sortedByProfit = [...branches].sort((a, b) => b.summary.totalProfit - a.summary.totalProfit);
    const bestBranch = sortedByProfit[0];
    const worstBranch = sortedByProfit[sortedByProfit.length - 1];
    
    return {
      insights: [
        `أفضل فرع من حيث الربحية: ${bestBranch?.branchName || 'غير محدد'} بإجمالي ربح ${Math.round(bestBranch?.summary.totalProfit || 0)} ريال`,
        `الفرع الأقل ربحية: ${worstBranch?.branchName || 'غير محدد'} بإجمالي ربح ${Math.round(worstBranch?.summary.totalProfit || 0)} ريال`,
        `متوسط هامش الربح للفروع: ${(branches.reduce((sum, b) => sum + b.summary.avgProfitMargin, 0) / branches.length).toFixed(1)}%`,
        `${branches.filter(b => b.summary.overallTrend === 'improving').length} فرع في تحسن، ${branches.filter(b => b.summary.overallTrend === 'declining').length} في تراجع`
      ],
      recommendations: [
        'دراسة عوامل نجاح الفرع الأفضل وتطبيقها على الفروع الأخرى',
        'مراجعة تكاليف التشغيل للفروع ذات الربحية المنخفضة',
        'تحسين استراتيجيات التسويق للفروع المتراجعة'
      ]
    };
  }
}
