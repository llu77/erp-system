/**
 * Bonus Calculator - حاسبة البونص الأسبوعي
 * 
 * مستويات البونص:
 * - المستوى 5: ≥2400 ر.س → 180 ر.س
 * - المستوى 4: 2100-2399 ر.س → 135 ر.س
 * - المستوى 3: 1800-2099 ر.س → 95 ر.س
 * - المستوى 2: 1500-1799 ر.س → 60 ر.س
 * - المستوى 1: 1200-1499 ر.س → 35 ر.س
 * - بدون: <1200 ر.س → 0 ر.س
 */

export type BonusTier = "tier_1" | "tier_2" | "tier_3" | "tier_4" | "tier_5" | "none";

export interface BonusCalculation {
  tier: BonusTier;
  amount: number;
  isEligible: boolean;
}

export interface WeekInfo {
  weekNumber: 1 | 2 | 3 | 4 | 5;
  weekStart: Date;
  weekEnd: Date;
  month: number;
  year: number;
}

/**
 * حساب البونص بناءً على الإيراد الأسبوعي
 */
export function calculateBonus(weeklyRevenue: number): BonusCalculation {
  if (weeklyRevenue >= 2400) {
    return { tier: "tier_5", amount: 180, isEligible: true };
  }
  if (weeklyRevenue >= 2100) {
    return { tier: "tier_4", amount: 135, isEligible: true };
  }
  if (weeklyRevenue >= 1800) {
    return { tier: "tier_3", amount: 95, isEligible: true };
  }
  if (weeklyRevenue >= 1500) {
    return { tier: "tier_2", amount: 60, isEligible: true };
  }
  if (weeklyRevenue >= 1200) {
    return { tier: "tier_1", amount: 35, isEligible: true };
  }
  return { tier: "none", amount: 0, isEligible: false };
}

/**
 * تحديد رقم الأسبوع من اليوم في الشهر
 * الأسبوع 1: الأيام 1-7
 * الأسبوع 2: الأيام 8-15
 * الأسبوع 3: الأيام 16-22
 * الأسبوع 4: الأيام 23-29
 * الأسبوع 5: الأيام 30-31 (الأيام المتبقية)
 */
export function getWeekNumber(day: number): 1 | 2 | 3 | 4 | 5 {
  if (day >= 1 && day <= 7) return 1;
  if (day >= 8 && day <= 15) return 2;
  if (day >= 16 && day <= 22) return 3;
  if (day >= 23 && day <= 29) return 4;
  return 5; // Days 30-31
}

/**
 * الحصول على معلومات الأسبوع لتاريخ معين
 */
export function getWeekInfo(date: Date): WeekInfo {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const weekNumber = getWeekNumber(day);
  
  const { start, end } = getWeekDateRange(weekNumber, month, year);
  
  return {
    weekNumber,
    weekStart: start,
    weekEnd: end,
    month,
    year,
  };
}

/**
 * الحصول على نطاق التواريخ لأسبوع معين
 */
export function getWeekDateRange(
  weekNumber: number,
  month: number,
  year: number
): { start: Date; end: Date } {
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  
  const ranges: Record<number, { startDay: number; endDay: number }> = {
    1: { startDay: 1, endDay: 7 },
    2: { startDay: 8, endDay: 15 },
    3: { startDay: 16, endDay: 22 },
    4: { startDay: 23, endDay: 29 },
    5: { startDay: 30, endDay: lastDayOfMonth },
  };

  const range = ranges[weekNumber] || ranges[5];
  const start = new Date(year, month - 1, range.startDay, 0, 0, 0);
  const end = new Date(year, month - 1, Math.min(range.endDay, lastDayOfMonth), 23, 59, 59);

  return { start, end };
}

/**
 * الحصول على اسم المستوى بالعربية
 */
export function getTierNameAr(tier: BonusTier): string {
  const names: Record<BonusTier, string> = {
    tier_5: "المستوى 5",
    tier_4: "المستوى 4",
    tier_3: "المستوى 3",
    tier_2: "المستوى 2",
    tier_1: "المستوى 1",
    none: "غير مؤهل",
  };
  return names[tier];
}

/**
 * الحصول على لون المستوى
 */
export function getTierColor(tier: BonusTier): string {
  const colors: Record<BonusTier, string> = {
    tier_5: "purple",
    tier_4: "blue",
    tier_3: "green",
    tier_2: "yellow",
    tier_1: "orange",
    none: "gray",
  };
  return colors[tier];
}
