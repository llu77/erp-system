/**
 * Bonus Calculator - حاسبة البونص الأسبوعي
 *
 * - المستويات يحددها المدير من صفحة "إعدادات مستويات البونص" (جدول bonusTierSettings)
 *   وتُمرر لكل عملية احتساب؛ القيم الافتراضية DEFAULT_BONUS_TIERS تُستخدم فقط إذا لم تُحدد مستويات
 * - فترات البونص: 1-7، 8-14، 15-21، 22-28، 29-نهاية الشهر (shared/bonus.ts)
 * - حدود الفترات بتوقيت UTC (منتصف الليل UTC لأول يوم حتى 23:59:59.999 UTC لآخر يوم)
 *
 * @version 4.0.0 - مستويات من قاعدة البيانات + فترات موحدة
 */

import {
  resolveBonusTier,
  revenueToNextTier,
  normalizeTiers,
  getBonusPeriodNumber,
  getBonusPeriodDays,
  getBonusPeriodsInMonth,
  type BonusTierRule,
} from "../../shared/bonus";

// ==================== Types ====================

export type BonusTier = "tier_1" | "tier_2" | "tier_3" | "tier_4" | "tier_5" | "tier_6" | "tier_7" | "none";

export type { BonusTierRule };

export interface BonusCalculation {
  tier: BonusTier;
  tierName: string;
  amount: number;
  isEligible: boolean;
}

export interface WeekInfo {
  weekNumber: 1 | 2 | 3 | 4 | 5;
  weekStart: Date;
  weekEnd: Date;
  month: number;
  year: number;
  daysCount: number;
}

export interface WeekValidation {
  isValid: boolean;
  expectedDays: number;
  actualDays: number;
  missingDates: Date[];
  message: string;
}

export interface RevenueValidation {
  isMatching: boolean;
  branchTotal: number;
  employeesTotal: number;
  difference: number;
  message: string;
}

export interface WeekSummary {
  weekNumber: number;
  month: number;
  year: number;
  totalBranchRevenue: number;
  totalEmployeesRevenue: number;
  totalBonus: number;
  employeeCount: number;
  eligibleCount: number;
  validation: {
    daysComplete: WeekValidation;
    revenueMatch: RevenueValidation;
  };
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  value?: unknown;
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors: ValidationError[];
}

// ==================== Input Validation ====================

/**
 * التحقق من صحة الرقم
 */
export function validateNumber(
  value: unknown,
  fieldName: string,
  options: {
    allowNegative?: boolean;
    allowZero?: boolean;
    min?: number;
    max?: number;
  } = {}
): ValidationResult<number> {
  const errors: ValidationError[] = [];
  const { allowNegative = false, allowZero = true, min, max } = options;

  // التحقق من أن القيمة رقم
  if (value === null || value === undefined) {
    errors.push({
      code: "REQUIRED",
      message: `${fieldName} مطلوب`,
      field: fieldName,
      value,
    });
    return { success: false, errors };
  }

  const num = Number(value);

  if (Number.isNaN(num)) {
    errors.push({
      code: "INVALID_NUMBER",
      message: `${fieldName} يجب أن يكون رقماً صالحاً`,
      field: fieldName,
      value,
    });
    return { success: false, errors };
  }

  if (!Number.isFinite(num)) {
    errors.push({
      code: "INFINITE_NUMBER",
      message: `${fieldName} يجب أن يكون رقماً محدوداً`,
      field: fieldName,
      value,
    });
    return { success: false, errors };
  }

  if (!allowNegative && num < 0) {
    errors.push({
      code: "NEGATIVE_NOT_ALLOWED",
      message: `${fieldName} لا يمكن أن يكون سالباً`,
      field: fieldName,
      value,
    });
    return { success: false, errors };
  }

  if (!allowZero && num === 0) {
    errors.push({
      code: "ZERO_NOT_ALLOWED",
      message: `${fieldName} لا يمكن أن يكون صفراً`,
      field: fieldName,
      value,
    });
    return { success: false, errors };
  }

  if (min !== undefined && num < min) {
    errors.push({
      code: "BELOW_MIN",
      message: `${fieldName} يجب أن يكون أكبر من أو يساوي ${min}`,
      field: fieldName,
      value,
    });
    return { success: false, errors };
  }

  if (max !== undefined && num > max) {
    errors.push({
      code: "ABOVE_MAX",
      message: `${fieldName} يجب أن يكون أقل من أو يساوي ${max}`,
      field: fieldName,
      value,
    });
    return { success: false, errors };
  }

  return { success: true, data: num, errors: [] };
}

/**
 * التحقق من صحة التاريخ
 */
export function validateDate(
  value: unknown,
  fieldName: string
): ValidationResult<Date> {
  const errors: ValidationError[] = [];

  if (value === null || value === undefined) {
    errors.push({
      code: "REQUIRED",
      message: `${fieldName} مطلوب`,
      field: fieldName,
      value,
    });
    return { success: false, errors };
  }

  let date: Date;

  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "string" || typeof value === "number") {
    date = new Date(value);
  } else {
    errors.push({
      code: "INVALID_DATE_TYPE",
      message: `${fieldName} نوع غير صالح`,
      field: fieldName,
      value,
    });
    return { success: false, errors };
  }

  if (Number.isNaN(date.getTime())) {
    errors.push({
      code: "INVALID_DATE",
      message: `${fieldName} تاريخ غير صالح`,
      field: fieldName,
      value,
    });
    return { success: false, errors };
  }

  return { success: true, data: date, errors: [] };
}

/**
 * التحقق من صحة رقم الأسبوع
 */
export function validateWeekNumber(
  value: unknown
): ValidationResult<1 | 2 | 3 | 4 | 5> {
  const numValidation = validateNumber(value, "رقم الأسبوع", {
    min: 1,
    max: 5,
  });

  if (!numValidation.success) {
    return { success: false, errors: numValidation.errors };
  }

  const weekNum = Math.floor(numValidation.data!);
  if (weekNum < 1 || weekNum > 5) {
    return {
      success: false,
      errors: [{
        code: "INVALID_WEEK_NUMBER",
        message: "رقم الأسبوع يجب أن يكون من 1 إلى 5",
        field: "weekNumber",
        value,
      }],
    };
  }

  return { success: true, data: weekNum as 1 | 2 | 3 | 4 | 5, errors: [] };
}

/**
 * التحقق من صحة الشهر
 */
export function validateMonth(value: unknown): ValidationResult<number> {
  const numValidation = validateNumber(value, "الشهر", { min: 1, max: 12 });

  if (!numValidation.success) {
    return { success: false, errors: numValidation.errors };
  }

  return { success: true, data: Math.floor(numValidation.data!), errors: [] };
}

/**
 * التحقق من صحة السنة
 */
export function validateYear(value: unknown): ValidationResult<number> {
  const numValidation = validateNumber(value, "السنة", { min: 2020, max: 2100 });

  if (!numValidation.success) {
    return { success: false, errors: numValidation.errors };
  }

  return { success: true, data: Math.floor(numValidation.data!), errors: [] };
}

// ==================== Core Functions ====================

/**
 * حساب البونص بناءً على إيراد الفترة ومستويات المدير
 * @param tiers المستويات النشطة من قاعدة البيانات (null/فارغة = المستويات الافتراضية)
 * @throws {Error} إذا كان الإدخال غير صالح
 */
export function calculateBonus(
  weeklyRevenue: unknown,
  tiers: BonusTierRule[] | null | undefined
): BonusCalculation {
  const validation = validateNumber(weeklyRevenue, "الإيراد الأسبوعي", {
    allowNegative: false,
  });

  if (!validation.success) {
    throw new Error(validation.errors.map(e => e.message).join(", "));
  }

  const match = resolveBonusTier(validation.data!, tiers);
  return {
    tier: match.tier,
    tierName: match.tierName,
    amount: match.amount,
    isEligible: match.isEligible,
  };
}

/**
 * حساب البونص مع إرجاع نتيجة التحقق (بدون throw)
 */
export function calculateBonusSafe(
  weeklyRevenue: unknown,
  tiers: BonusTierRule[] | null | undefined
): ValidationResult<BonusCalculation> {
  const validation = validateNumber(weeklyRevenue, "الإيراد الأسبوعي", {
    allowNegative: false,
  });

  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }

  const match = resolveBonusTier(validation.data!, tiers);
  return {
    success: true,
    data: {
      tier: match.tier,
      tierName: match.tierName,
      amount: match.amount,
      isEligible: match.isEligible,
    },
    errors: [],
  };
}

/**
 * تحديد رقم الفترة من اليوم في الشهر (1-7، 8-14، 15-21، 22-28، 29+)
 */
export function getWeekNumber(day: number): 1 | 2 | 3 | 4 | 5 {
  const validation = validateNumber(day, "اليوم", { min: 1, max: 31 });

  if (!validation.success) {
    throw new Error(validation.errors.map(e => e.message).join(", "));
  }

  return getBonusPeriodNumber(Math.floor(validation.data!));
}

function assertPeriodInputs(weekNumber: number, month: number, year: number): void {
  const weekValidation = validateWeekNumber(weekNumber);
  const monthValidation = validateMonth(month);
  const yearValidation = validateYear(year);

  if (!weekValidation.success || !monthValidation.success || !yearValidation.success) {
    const errors = [
      ...weekValidation.errors,
      ...monthValidation.errors,
      ...yearValidation.errors,
    ];
    throw new Error(errors.map(e => e.message).join(", "));
  }

  if (weekNumber > getBonusPeriodsInMonth(month, year)) {
    throw new Error(`INVALID_INPUT: الفترة ${weekNumber} غير موجودة في الشهر ${month}/${year}`);
  }
}

/**
 * الحصول على عدد الأيام المتوقع لفترة معينة
 */
export function getExpectedDaysCount(
  weekNumber: number,
  month: number,
  year: number
): number {
  assertPeriodInputs(weekNumber, month, year);
  return getBonusPeriodDays(weekNumber, month, year).days;
}

/**
 * الحصول على نطاق التواريخ لفترة معينة (حدود UTC)
 */
export function getWeekDateRange(
  weekNumber: number,
  month: number,
  year: number
): { start: Date; end: Date } {
  assertPeriodInputs(weekNumber, month, year);

  const { startDay, endDay } = getBonusPeriodDays(weekNumber, month, year);

  // استخدام UTC لتجنب مشاكل المنطقة الزمنية
  const start = new Date(Date.UTC(year, month - 1, startDay, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, endDay, 23, 59, 59, 999));

  return { start, end };
}

// ==================== يوم العمل ====================

/**
 * مفتاح يوم العمل (YYYY-MM-DD) لتوقيت الخادم المحلي
 * (نفس منطق الكاشير: الفواتير تُسجل بمنتصف ليل اليوم المحلي)
 */
export function getBusinessDayKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** تحويل مفتاح اليوم إلى التاريخ المخزن في dailyRevenues (منتصف الليل UTC) - مثل مسار الإدخال اليدوي */
export function businessDayKeyToStoredDate(dayKey: string): Date {
  const { year, month, day } = parseBusinessDayKey(dayKey);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/** تحويل مفتاح اليوم إلى منتصف الليل المحلي (لاستعلامات فواتير الكاشير) */
export function businessDayKeyToLocalDate(dayKey: string): Date {
  const { year, month, day } = parseBusinessDayKey(dayKey);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function parseBusinessDayKey(dayKey: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dayKey);
  if (!match) {
    throw new Error(`INVALID_INPUT: تاريخ غير صالح ${dayKey}`);
  }
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** فترة البونص لتاريخ مخزن في dailyRevenues (حسب UTC بما يطابق حدود الاستعلام) */
export function getBonusPeriodForStoredDate(date: Date): { year: number; month: number; weekNumber: 1 | 2 | 3 | 4 | 5 } {
  const d = new Date(date);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    weekNumber: getBonusPeriodNumber(d.getUTCDate()),
  };
}

/** فترة البونص لمفتاح يوم عمل */
export function getBonusPeriodForDayKey(dayKey: string): { year: number; month: number; weekNumber: 1 | 2 | 3 | 4 | 5 } {
  const { year, month, day } = parseBusinessDayKey(dayKey);
  return { year, month, weekNumber: getBonusPeriodNumber(day) };
}

/** الفترة الحالية حسب يوم العمل للخادم */
export function getCurrentBonusPeriod(now: Date = new Date()) {
  return getBonusPeriodForDayKey(getBusinessDayKey(now));
}

/**
 * الحصول على معلومات الأسبوع لتاريخ معين
 */
export function getWeekInfo(date: Date): WeekInfo {
  const dateValidation = validateDate(date, "التاريخ");

  if (!dateValidation.success) {
    throw new Error(dateValidation.errors.map(e => e.message).join(", "));
  }

  // يوم العمل حسب التقويم المحلي للخادم
  const { year, month, weekNumber } = getBonusPeriodForDayKey(getBusinessDayKey(dateValidation.data!));

  const { start, end } = getWeekDateRange(weekNumber, month, year);
  const daysCount = getExpectedDaysCount(weekNumber, month, year);

  return {
    weekNumber,
    weekStart: start,
    weekEnd: end,
    month,
    year,
    daysCount,
  };
}

/**
 * الحصول على قائمة جميع التواريخ في أسبوع معين
 */
export function getWeekDates(
  weekNumber: number,
  month: number,
  year: number
): Date[] {
  const { start, end } = getWeekDateRange(weekNumber, month, year);
  const dates: Date[] = [];

  const current = new Date(start);
  while (current <= end) {
    dates.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

/**
 * تطبيع التاريخ للمقارنة (إزالة الوقت) - حسب UTC بما يطابق حدود الفترات
 */
export function normalizeDateForComparison(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

/**
 * التحقق من اكتمال بيانات الأسبوع
 */
export function validateWeekData(
  weekNumber: number,
  month: number,
  year: number,
  enteredDates: Date[]
): WeekValidation {
  const expectedDates = getWeekDates(weekNumber, month, year);
  const expectedDays = expectedDates.length;

  // تحويل التواريخ المدخلة إلى صيغة للمقارنة
  const enteredDateStrings = new Set(
    enteredDates.map(d => normalizeDateForComparison(d))
  );

  // البحث عن التواريخ الناقصة
  const missingDates: Date[] = [];
  for (const expectedDate of expectedDates) {
    const dateStr = normalizeDateForComparison(expectedDate);
    if (!enteredDateStrings.has(dateStr)) {
      missingDates.push(expectedDate);
    }
  }

  const actualDays = expectedDays - missingDates.length;
  const isValid = missingDates.length === 0;

  let message: string;
  if (isValid) {
    message = `الأسبوع ${weekNumber} مكتمل (${expectedDays} أيام)`;
  } else {
    const missingDaysStr = missingDates.map(d => d.getUTCDate()).join("، ");
    message = `الأسبوع ${weekNumber} غير مكتمل - ناقص ${missingDates.length} يوم (الأيام: ${missingDaysStr})`;
  }

  return {
    isValid,
    expectedDays,
    actualDays,
    missingDates,
    message,
  };
}

/**
 * التحقق من تطابق الإيرادات
 */
export function validateRevenueMatch(
  branchTotal: number,
  employeesTotal: number,
  tolerance: number = 0.01
): RevenueValidation {
  // التحقق من المدخلات
  const branchValidation = validateNumber(branchTotal, "إيراد الفرع", { allowNegative: false });
  const employeesValidation = validateNumber(employeesTotal, "إيراد الموظفين", { allowNegative: false });

  if (!branchValidation.success || !employeesValidation.success) {
    const errors = [...branchValidation.errors, ...employeesValidation.errors];
    throw new Error(errors.map(e => e.message).join(", "));
  }

  const branch = branchValidation.data!;
  const employees = employeesValidation.data!;
  const difference = Math.abs(branch - employees);
  const isMatching = difference <= tolerance;

  let message: string;
  if (isMatching) {
    message = `الإيرادات متطابقة: ${branch.toFixed(2)} ر.س`;
  } else {
    message = `تحذير: فرق في الإيرادات! الفرع: ${branch.toFixed(2)} - الموظفين: ${employees.toFixed(2)} = فرق ${difference.toFixed(2)} ر.س`;
  }

  return {
    isMatching,
    branchTotal: branch,
    employeesTotal: employees,
    difference,
    message,
  };
}

/**
 * إنشاء ملخص الأسبوع
 */
export function createWeekSummary(
  weekNumber: number,
  month: number,
  year: number,
  branchRevenue: number,
  employeesRevenue: number,
  totalBonus: number,
  employeeCount: number,
  eligibleCount: number,
  enteredDates: Date[]
): WeekSummary {
  return {
    weekNumber,
    month,
    year,
    totalBranchRevenue: branchRevenue,
    totalEmployeesRevenue: employeesRevenue,
    totalBonus,
    employeeCount,
    eligibleCount,
    validation: {
      daysComplete: validateWeekData(weekNumber, month, year, enteredDates),
      revenueMatch: validateRevenueMatch(branchRevenue, employeesRevenue),
    },
  };
}

// ==================== Utility Functions ====================

/**
 * الحصول على اسم المستوى بالعربية
 */
export function getTierNameAr(tier: BonusTier): string {
  const names: Record<BonusTier, string> = {
    tier_7: "المستوى 7",
    tier_6: "المستوى 6",
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
    tier_7: "purple",
    tier_6: "indigo",
    tier_5: "blue",
    tier_4: "cyan",
    tier_3: "green",
    tier_2: "yellow",
    tier_1: "orange",
    none: "gray",
  };
  return colors[tier];
}

/**
 * الحصول على حدود المستويات من قائمة المستويات (الحد الأقصى = الحد الأدنى التالي - 0.01)
 */
export function getTierThresholds(tiers: BonusTierRule[] | null | undefined): Array<{
  tier: string;
  tierName: string;
  minRevenue: number;
  maxRevenue: number | null;
  bonusAmount: number;
}> {
  const ordered = normalizeTiers(tiers);
  const rows = ordered.map((t, i) => ({
    tier: t.tierKey,
    tierName: t.tierName,
    minRevenue: t.minRevenue,
    maxRevenue: ordered[i + 1] ? Math.round((ordered[i + 1].minRevenue - 0.01) * 100) / 100 : null,
    bonusAmount: t.bonusAmount,
  }));
  const lowest = ordered[0]?.minRevenue ?? 0;
  return [
    ...rows.reverse(),
    { tier: "none", tierName: "غير مؤهل", minRevenue: 0, maxRevenue: Math.max(0, Math.round((lowest - 0.01) * 100) / 100), bonusAmount: 0 },
  ];
}

/**
 * حساب الإيراد المطلوب للوصول للمستوى التالي
 */
export function getRevenueToNextTier(
  currentRevenue: number,
  tiers: BonusTierRule[] | null | undefined
): {
  currentTier: string;
  nextTier: string | null;
  nextTierName: string | null;
  nextTierAmount: number;
  requiredRevenue: number;
  additionalNeeded: number;
} {
  const validation = validateNumber(currentRevenue, "الإيراد الحالي", { allowNegative: false });

  if (!validation.success) {
    throw new Error(validation.errors.map(e => e.message).join(", "));
  }

  const revenue = validation.data!;
  const current = resolveBonusTier(revenue, tiers);
  const { nextTier, remaining } = revenueToNextTier(revenue, tiers);

  return {
    currentTier: current.tier,
    nextTier: nextTier?.tierKey ?? null,
    nextTierName: nextTier?.tierName ?? null,
    nextTierAmount: nextTier?.bonusAmount ?? 0,
    requiredRevenue: nextTier?.minRevenue ?? 0,
    additionalNeeded: remaining,
  };
}
