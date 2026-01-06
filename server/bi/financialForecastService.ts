/**
 * Financial Forecast Service - خدمة التنبؤ المالي
 * 
 * التكاليف الثابتة الحقيقية:
 * - رواتب: 21,000 ر.س
 * - إيجارات محلات: 6,600 ر.س
 * - إيجارات سكن: 3,200 ر.س
 * - كهرباء: 800 ر.س
 * - إنترنت: 600 ر.س
 * - المجموع: 32,200 ر.س (للفرعين)
 * - لكل فرع: 16,100 ر.س
 * 
 * المنطق:
 * 1. المتوسط اليومي = إجمالي إيرادات الشهر الماضي ÷ عدد أيام الشهر
 * 2. صافي الربح = الإيرادات - التكاليف الثابتة - تكلفة البضاعة - المصاريف الأخرى
 * 3. نقطة التعادل = التكاليف الثابتة ÷ (1 - نسبة التكاليف المتغيرة)
 */

import { getDb } from "../db";
import { dailyRevenues, companySettings, expenses } from "../../drizzle/schema";
import { eq, sql, and, gte, lte } from "drizzle-orm";

// ==================== التكاليف الثابتة الحقيقية ====================
export const FIXED_COSTS = {
  salaries: 21000,      // رواتب
  shopRent: 6600,       // إيجارات محلات
  housingRent: 3200,    // إيجارات سكن
  electricity: 800,     // كهرباء
  internet: 600,        // إنترنت
};

export const TOTAL_FIXED_COSTS = Object.values(FIXED_COSTS).reduce((a, b) => a + b, 0); // 32,200
export const BRANCHES_COUNT = 2;
export const FIXED_COSTS_PER_BRANCH = TOTAL_FIXED_COSTS / BRANCHES_COUNT; // 16,100

// ==================== الحصول على إعدادات التكاليف ====================
export async function getFinancialSettings() {
  const db = await getDb();
  if (!db) {
    return {
      variableCostRate: 30, // افتراضي 30%
      fixedMonthlyCosts: FIXED_COSTS_PER_BRANCH,
      fixedCostsBreakdown: FIXED_COSTS,
      totalFixedCosts: TOTAL_FIXED_COSTS,
      branchesCount: BRANCHES_COUNT,
    };
  }

  const settings = await db
    .select()
    .from(companySettings)
    .where(
      sql`${companySettings.key} IN ('variable_cost_rate', 'fixed_monthly_costs')`
    );

  let variableCostRate = 30; // افتراضي 30%
  let fixedMonthlyCosts = FIXED_COSTS_PER_BRANCH;

  for (const setting of settings) {
    if (setting.key === 'variable_cost_rate') {
      const val = parseFloat(setting.value || '30');
      variableCostRate = Math.max(1, Math.min(80, val)); // الحد 1-80%
    } else if (setting.key === 'fixed_monthly_costs') {
      fixedMonthlyCosts = parseFloat(setting.value || String(FIXED_COSTS_PER_BRANCH));
    }
  }

  return {
    variableCostRate,
    fixedMonthlyCosts,
    fixedCostsBreakdown: FIXED_COSTS,
    totalFixedCosts: TOTAL_FIXED_COSTS,
    branchesCount: BRANCHES_COUNT,
  };
}

// ==================== حفظ إعدادات التكاليف ====================
export async function saveFinancialSettings(
  variableCostRate: number,
  fixedMonthlyCosts?: number
) {
  const db = await getDb();
  if (!db) {
    return { success: false, error: 'Database not available' };
  }

  // التحقق من الحدود
  const validRate = Math.max(1, Math.min(80, variableCostRate));
  const validFixed = fixedMonthlyCosts ?? FIXED_COSTS_PER_BRANCH;

  // حفظ أو تحديث نسبة تكلفة البضاعة
  const existingRate = await db
    .select()
    .from(companySettings)
    .where(eq(companySettings.key, 'variable_cost_rate'));

  if (existingRate.length > 0) {
    await db
      .update(companySettings)
      .set({ value: validRate.toString() })
      .where(eq(companySettings.key, 'variable_cost_rate'));
  } else {
    await db.insert(companySettings).values({
      key: 'variable_cost_rate',
      value: validRate.toString(),
      type: 'number',
      category: 'financial',
      description: 'نسبة تكلفة البضاعة (%)',
    });
  }

  // حفظ أو تحديث التكاليف الثابتة
  const existingFixed = await db
    .select()
    .from(companySettings)
    .where(eq(companySettings.key, 'fixed_monthly_costs'));

  if (existingFixed.length > 0) {
    await db
      .update(companySettings)
      .set({ value: validFixed.toString() })
      .where(eq(companySettings.key, 'fixed_monthly_costs'));
  } else {
    await db.insert(companySettings).values({
      key: 'fixed_monthly_costs',
      value: validFixed.toString(),
      type: 'number',
      category: 'financial',
      description: 'التكاليف الثابتة الشهرية',
    });
  }

  return { success: true, variableCostRate: validRate, fixedMonthlyCosts: validFixed };
}

// ==================== جلب المصاريف الأخرى من النظام ====================
export async function getOtherExpenses(branchId?: number, startDate?: string, endDate?: string) {
  const db = await getDb();
  if (!db) {
    return { total: 0, breakdown: [] };
  }

  const now = new Date();
  const start = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const end = endDate || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  // جلب المصاريف المسجلة في النظام (غير التكاليف الثابتة الأساسية)
  const expenseCategories = ['salaries', 'rent', 'utilities', 'electricity', 'internet'];
  
  const otherExpenses = await db
    .select({
      category: expenses.category,
      total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)`,
    })
    .from(expenses)
    .where(
      branchId
        ? sql`DATE(${expenses.expenseDate}) >= ${start} AND DATE(${expenses.expenseDate}) <= ${end} AND ${expenses.branchId} = ${branchId} AND ${expenses.category} NOT IN ('shop_rent', 'housing_rent', 'electricity', 'internet')`
        : sql`DATE(${expenses.expenseDate}) >= ${start} AND DATE(${expenses.expenseDate}) <= ${end} AND ${expenses.category} NOT IN ('shop_rent', 'housing_rent', 'electricity', 'internet')`
    )
    .groupBy(expenses.category);

  const total = otherExpenses.reduce((sum, exp) => sum + Number(exp.total || 0), 0);

  return {
    total,
    breakdown: otherExpenses.map(e => ({
      category: e.category,
      amount: Number(e.total || 0),
    })),
  };
}

// ==================== حساب الربح ====================
export function calculateProfit(
  revenue: number,
  variableCostRate: number, // نسبة مئوية (0-100)
  fixedCosts: number,
  otherExpenses: number = 0
) {
  const variableCosts = revenue * (variableCostRate / 100);
  const totalCosts = fixedCosts + variableCosts + otherExpenses;
  const netProfit = revenue - totalCosts;

  return {
    revenue,
    variableCosts,
    fixedCosts,
    otherExpenses,
    totalCosts,
    netProfit,
    status: netProfit >= 0 ? 'ربح' : 'خسارة' as 'ربح' | 'خسارة',
    profitMargin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
  };
}

// ==================== حساب نقطة التعادل ====================
export function calculateBreakEven(
  fixedCosts: number,
  variableCostRate: number, // نسبة مئوية (0-100)
  otherExpenses: number = 0
) {
  const rate = variableCostRate / 100;
  
  if (rate >= 1) {
    return {
      daily: Infinity,
      monthly: Infinity,
      message: 'نسبة التكاليف المتغيرة عالية جداً - لا يمكن تحقيق التعادل',
      aboveBreakEven: false,
    };
  }

  const totalFixed = fixedCosts + otherExpenses;
  const monthlyBreakEven = totalFixed / (1 - rate);
  const dailyBreakEven = monthlyBreakEven / 30;

  return {
    daily: Math.round(dailyBreakEven),
    monthly: Math.round(monthlyBreakEven),
    message: null,
    aboveBreakEven: false, // سيتم تحديثه لاحقاً
  };
}

// ==================== توليد التحذيرات ====================
export function generateAlerts(
  revenue: number,
  breakEven: { daily: number; monthly: number },
  netProfit: number,
  isDaily: boolean = false
) {
  const alerts: Array<{ level: 'critical' | 'warning' | 'info'; message: string; color: string }> = [];

  if (netProfit < 0) {
    alerts.push({
      level: 'critical',
      message: `خسارة: ${Math.abs(Math.round(netProfit)).toLocaleString('ar-SA')} ر.س`,
      color: 'red',
    });
  }

  const target = isDaily ? breakEven.daily : breakEven.monthly;
  if (revenue < target) {
    const deficit = ((target - revenue) / target * 100).toFixed(1);
    alerts.push({
      level: 'warning',
      message: `تحت نقطة التعادل بـ ${deficit}%`,
      color: 'orange',
    });
  } else if (revenue >= target) {
    const surplus = ((revenue - target) / target * 100).toFixed(1);
    alerts.push({
      level: 'info',
      message: `فوق نقطة التعادل بـ ${surplus}%`,
      color: 'green',
    });
  }

  return alerts;
}

// ==================== تحليل الشهر الماضي ====================
export async function analyzeLastMonth(branchId?: number) {
  const db = await getDb();
  if (!db) {
    return {
      error: 'Database not available',
      needsConfiguration: false,
    };
  }

  // حساب تواريخ الشهر الماضي
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const daysInLastMonth = lastMonthEnd.getDate();

  const startDate = lastMonth.toISOString().split('T')[0];
  const endDate = lastMonthEnd.toISOString().split('T')[0];

  // جلب إيرادات الشهر الماضي
  const revenues = await db
    .select({
      totalRevenue: sql<number>`COALESCE(SUM(${dailyRevenues.total}), 0)`,
      daysRecorded: sql<number>`COUNT(DISTINCT DATE(${dailyRevenues.date}))`,
    })
    .from(dailyRevenues)
    .where(
      branchId
        ? sql`DATE(${dailyRevenues.date}) >= ${startDate} AND DATE(${dailyRevenues.date}) <= ${endDate} AND ${dailyRevenues.branchId} = ${branchId}`
        : sql`DATE(${dailyRevenues.date}) >= ${startDate} AND DATE(${dailyRevenues.date}) <= ${endDate}`
    );

  const totalRevenue = Number(revenues[0]?.totalRevenue || 0);
  const daysRecorded = Number(revenues[0]?.daysRecorded || 0);

  // المتوسط اليومي الصحيح = الإجمالي ÷ أيام الشهر الفعلية
  const dailyAverage = totalRevenue / daysInLastMonth;

  // جلب إعدادات التكاليف
  const settings = await getFinancialSettings();

  // جلب المصاريف الأخرى
  const otherExpenses = await getOtherExpenses(branchId, startDate, endDate);

  // تحديد التكاليف الثابتة حسب الفرع
  const fixedCosts = branchId ? FIXED_COSTS_PER_BRANCH : TOTAL_FIXED_COSTS;

  // حساب الربح للشهر الماضي
  const monthlyProfit = calculateProfit(
    totalRevenue,
    settings.variableCostRate,
    fixedCosts,
    otherExpenses.total
  );

  // حساب نقطة التعادل
  const breakEven = calculateBreakEven(
    fixedCosts,
    settings.variableCostRate,
    otherExpenses.total
  );
  breakEven.aboveBreakEven = dailyAverage >= breakEven.daily;

  // توليد التحذيرات
  const alerts = generateAlerts(totalRevenue, breakEven, monthlyProfit.netProfit, false);

  return {
    period: {
      month: lastMonth.toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' }),
      startDate,
      endDate,
      totalDays: daysInLastMonth,
      daysRecorded,
    },
    revenue: {
      total: totalRevenue,
      dailyAverage: Math.round(dailyAverage),
    },
    costs: {
      variableCostRate: settings.variableCostRate,
      fixedMonthlyCosts: fixedCosts,
      fixedCostsBreakdown: branchId ? {
        salaries: FIXED_COSTS.salaries / 2,
        shopRent: FIXED_COSTS.shopRent / 2,
        housingRent: FIXED_COSTS.housingRent / 2,
        electricity: FIXED_COSTS.electricity / 2,
        internet: FIXED_COSTS.internet / 2,
      } : FIXED_COSTS,
      variableCosts: Math.round(monthlyProfit.variableCosts),
      otherExpenses: otherExpenses.total,
      otherExpensesBreakdown: otherExpenses.breakdown,
      totalCosts: Math.round(monthlyProfit.totalCosts),
    },
    profit: {
      netProfit: Math.round(monthlyProfit.netProfit),
      status: monthlyProfit.status,
      profitMargin: Math.round(monthlyProfit.profitMargin * 10) / 10,
    },
    breakEven: {
      daily: breakEven.daily,
      monthly: breakEven.monthly,
      message: breakEven.message,
      aboveBreakEven: breakEven.aboveBreakEven,
    },
    alerts,
    needsConfiguration: false, // لم يعد مطلوباً لأن لدينا قيم افتراضية
  };
}

// ==================== التنبؤ للشهر الحالي ====================
export async function forecastCurrentMonth(branchId?: number) {
  const db = await getDb();
  if (!db) {
    return {
      error: 'Database not available',
    };
  }

  // تحليل الشهر الماضي للحصول على المتوسط
  const lastMonthAnalysis = await analyzeLastMonth(branchId);

  if ('error' in lastMonthAnalysis && lastMonthAnalysis.error) {
    return lastMonthAnalysis;
  }

  const dailyAverage = lastMonthAnalysis.revenue?.dailyAverage || 0;
  const settings = await getFinancialSettings();
  const fixedCosts = branchId ? FIXED_COSTS_PER_BRANCH : TOTAL_FIXED_COSTS;

  // حساب تواريخ الشهر الحالي
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysInCurrentMonth = currentMonthEnd.getDate();
  const currentDay = now.getDate();
  const remainingDays = daysInCurrentMonth - currentDay;

  // جلب إيرادات الشهر الحالي حتى الآن
  const startDate = currentMonthStart.toISOString().split('T')[0];
  const todayDate = now.toISOString().split('T')[0];

  const currentRevenues = await db
    .select({
      totalRevenue: sql<number>`COALESCE(SUM(${dailyRevenues.total}), 0)`,
    })
    .from(dailyRevenues)
    .where(
      branchId
        ? sql`DATE(${dailyRevenues.date}) >= ${startDate} AND DATE(${dailyRevenues.date}) <= ${todayDate} AND ${dailyRevenues.branchId} = ${branchId}`
        : sql`DATE(${dailyRevenues.date}) >= ${startDate} AND DATE(${dailyRevenues.date}) <= ${todayDate}`
    );

  const actualRevenue = Number(currentRevenues[0]?.totalRevenue || 0);

  // جلب المصاريف الأخرى للشهر الحالي
  const otherExpenses = await getOtherExpenses(branchId, startDate, todayDate);

  // التنبؤ بالإيرادات المتبقية
  const expectedRemainingRevenue = dailyAverage * remainingDays;
  const expectedTotalRevenue = actualRevenue + expectedRemainingRevenue;

  // حساب الربح المتوقع
  const expectedProfit = calculateProfit(
    expectedTotalRevenue,
    settings.variableCostRate,
    fixedCosts,
    otherExpenses.total
  );

  // حساب نقطة التعادل
  const breakEven = calculateBreakEven(fixedCosts, settings.variableCostRate, otherExpenses.total);
  breakEven.aboveBreakEven = (expectedTotalRevenue / daysInCurrentMonth) >= breakEven.daily;

  // التنبؤ بالفترات الثلاث
  const periods = [
    { name: 'الفترة الأولى', days: '1-10', daysCount: 10 },
    { name: 'الفترة الثانية', days: '11-20', daysCount: 10 },
    { name: 'الفترة الثالثة', days: '21-' + daysInCurrentMonth, daysCount: daysInCurrentMonth - 20 },
  ];

  const periodForecasts = periods.map((period) => {
    const periodRevenue = dailyAverage * period.daysCount;
    const periodFixedCosts = fixedCosts / 3;
    const periodOtherExpenses = otherExpenses.total / 3;
    const periodProfit = calculateProfit(
      periodRevenue,
      settings.variableCostRate,
      periodFixedCosts,
      periodOtherExpenses
    );

    return {
      name: period.name,
      days: period.days,
      expectedRevenue: Math.round(periodRevenue),
      fixedCosts: Math.round(periodFixedCosts),
      variableCosts: Math.round(periodProfit.variableCosts),
      otherExpenses: Math.round(periodOtherExpenses),
      expectedCosts: Math.round(periodProfit.totalCosts),
      expectedProfit: Math.round(periodProfit.netProfit),
      status: periodProfit.status,
    };
  });

  // التنبؤ اليومي للأيام القادمة (7 أيام)
  const dailyForecasts = [];
  const dailyFixedCosts = fixedCosts / 30;
  const dailyOtherExpenses = otherExpenses.total / 30;

  for (let i = 1; i <= 7; i++) {
    const forecastDate = new Date(now);
    forecastDate.setDate(now.getDate() + i);

    const dayName = forecastDate.toLocaleDateString('ar-SA', { weekday: 'long' });
    const dateStr = forecastDate.toLocaleDateString('ar-SA', { day: 'numeric', month: 'numeric' });

    const dayProfit = calculateProfit(
      dailyAverage,
      settings.variableCostRate,
      dailyFixedCosts,
      dailyOtherExpenses
    );

    dailyForecasts.push({
      date: dateStr,
      dayName,
      expectedRevenue: Math.round(dailyAverage),
      fixedCosts: Math.round(dailyFixedCosts),
      variableCosts: Math.round(dayProfit.variableCosts),
      otherExpenses: Math.round(dailyOtherExpenses),
      expectedCosts: Math.round(dayProfit.totalCosts),
      expectedProfit: Math.round(dayProfit.netProfit),
      status: dayProfit.status,
      confidence: Math.max(50, 95 - (i * 5)),
    });
  }

  // توليد التحذيرات
  const alerts = generateAlerts(expectedTotalRevenue, breakEven, expectedProfit.netProfit, false);

  return {
    currentMonth: {
      month: now.toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' }),
      totalDays: daysInCurrentMonth,
      currentDay,
      remainingDays,
    },
    actual: {
      revenue: Math.round(actualRevenue),
      daysElapsed: currentDay,
    },
    forecast: {
      expectedTotalRevenue: Math.round(expectedTotalRevenue),
      fixedCosts: fixedCosts,
      variableCosts: Math.round(expectedProfit.variableCosts),
      otherExpenses: otherExpenses.total,
      expectedTotalCosts: Math.round(expectedProfit.totalCosts),
      expectedNetProfit: Math.round(expectedProfit.netProfit),
      status: expectedProfit.status,
      profitMargin: Math.round(expectedProfit.profitMargin * 10) / 10,
    },
    breakEven,
    periodForecasts,
    dailyForecasts,
    alerts,
    basedOn: {
      lastMonthAverage: Math.round(dailyAverage),
      variableCostRate: settings.variableCostRate,
      fixedMonthlyCosts: fixedCosts,
      fixedCostsBreakdown: branchId ? {
        salaries: FIXED_COSTS.salaries / 2,
        shopRent: FIXED_COSTS.shopRent / 2,
        housingRent: FIXED_COSTS.housingRent / 2,
        electricity: FIXED_COSTS.electricity / 2,
        internet: FIXED_COSTS.internet / 2,
      } : FIXED_COSTS,
    },
  };
}
