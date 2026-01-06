/**
 * Bonus Calculator - حاسبة البونص الأسبوعي
 * 
 * مستويات البونص (محدثة 7 يناير 2026):
 * - المستوى 7: ≥3200 ر.س → 190 ر.س
 * - المستوى 6: 2800-3199 ر.س → 155 ر.س
 * - المستوى 5: 2500-2799 ر.س → 120 ر.س
 * - المستوى 4: 2200-2499 ر.س → 90 ر.س
 * - المستوى 3: 1950-2199 ر.س → 65 ر.س
 * - المستوى 2: 1750-1949 ر.س → 55 ر.س
 * - المستوى 1: 1450-1749 ر.س → 35 ر.س
 * - بدون: <1450 ر.س → 0 ر.س
 * 
 * @version 3.0.0 - مستويات بونص محدثة
 */

// ==================== Types ====================

export type BonusTier = "tier_1" | "tier_2" | "tier_3" | "tier_4" | "tier_5" | "tier_6" | "tier_7" | "none";

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
 * حساب البونص بناءً على الإيراد الأسبوعي
 * @throws {Error} إذا كان الإدخال غير صالح
 */
export function calculateBonus(weeklyRevenue: unknown): BonusCalculation {
  const validation = validateNumber(weeklyRevenue, "الإيراد الأسبوعي", {
    allowNegative: false,
  });

  if (!validation.success) {
    throw new Error(validation.errors.map(e => e.message).join(", "));
  }

  const revenue = validation.data!;

  if (revenue >= 3200) {
    return { tier: "tier_7", amount: 190, isEligible: true };
  }
  if (revenue >= 2800) {
    return { tier: "tier_6", amount: 155, isEligible: true };
  }
  if (revenue >= 2500) {
    return { tier: "tier_5", amount: 120, isEligible: true };
  }
  if (revenue >= 2200) {
    return { tier: "tier_4", amount: 90, isEligible: true };
  }
  if (revenue >= 1950) {
    return { tier: "tier_3", amount: 65, isEligible: true };
  }
  if (revenue >= 1750) {
    return { tier: "tier_2", amount: 55, isEligible: true };
  }
  if (revenue >= 1450) {
    return { tier: "tier_1", amount: 35, isEligible: true };
  }
  return { tier: "none", amount: 0, isEligible: false };
}

/**
 * حساب البونص مع إرجاع نتيجة التحقق (بدون throw)
 */
export function calculateBonusSafe(
  weeklyRevenue: unknown
): ValidationResult<BonusCalculation> {
  const validation = validateNumber(weeklyRevenue, "الإيراد الأسبوعي", {
    allowNegative: false,
  });

  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }

  const revenue = validation.data!;
  let result: BonusCalculation;

  if (revenue >= 3200) {
    result = { tier: "tier_7", amount: 190, isEligible: true };
  } else if (revenue >= 2800) {
    result = { tier: "tier_6", amount: 155, isEligible: true };
  } else if (revenue >= 2500) {
    result = { tier: "tier_5", amount: 120, isEligible: true };
  } else if (revenue >= 2200) {
    result = { tier: "tier_4", amount: 90, isEligible: true };
  } else if (revenue >= 1950) {
    result = { tier: "tier_3", amount: 65, isEligible: true };
  } else if (revenue >= 1750) {
    result = { tier: "tier_2", amount: 55, isEligible: true };
  } else if (revenue >= 1450) {
    result = { tier: "tier_1", amount: 35, isEligible: true };
  } else {
    result = { tier: "none", amount: 0, isEligible: false };
  }

  return { success: true, data: result, errors: [] };
}

/**
 * تحديد رقم الأسبوع من اليوم في الشهر
 */
export function getWeekNumber(day: number): 1 | 2 | 3 | 4 | 5 {
  const validation = validateNumber(day, "اليوم", { min: 1, max: 31 });

  if (!validation.success) {
    throw new Error(validation.errors.map(e => e.message).join(", "));
  }

  const d = Math.floor(validation.data!);

  if (d >= 1 && d <= 7) return 1;
  if (d >= 8 && d <= 14) return 2;
  if (d >= 15 && d <= 21) return 3;
  if (d >= 22 && d <= 28) return 4;
  return 5;
}

/**
 * الحصول على عدد الأيام المتوقع لأسبوع معين
 */
export function getExpectedDaysCount(
  weekNumber: number,
  month: number,
  year: number
): number {
  // التحقق من المدخلات
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

  if (weekNumber >= 1 && weekNumber <= 4) {
    return 7;
  }

  const lastDayOfMonth = new Date(year, month, 0).getDate();
  return Math.max(0, lastDayOfMonth - 28);
}

/**
 * الحصول على نطاق التواريخ لأسبوع معين
 */
export function getWeekDateRange(
  weekNumber: number,
  month: number,
  year: number
): { start: Date; end: Date } {
  // التحقق من المدخلات
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

  const lastDayOfMonth = new Date(year, month, 0).getDate();

  const ranges: Record<number, { startDay: number; endDay: number }> = {
    1: { startDay: 1, endDay: 7 },
    2: { startDay: 8, endDay: 14 },
    3: { startDay: 15, endDay: 21 },
    4: { startDay: 22, endDay: 28 },
    5: { startDay: 29, endDay: lastDayOfMonth },
  };

  const range = ranges[weekNumber] || ranges[5];
  
  // استخدام UTC لتجنب مشاكل المنطقة الزمنية
  const start = new Date(Date.UTC(year, month - 1, range.startDay, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, Math.min(range.endDay, lastDayOfMonth), 23, 59, 59, 999));

  return { start, end };
}

/**
 * الحصول على معلومات الأسبوع لتاريخ معين
 */
export function getWeekInfo(date: Date): WeekInfo {
  const dateValidation = validateDate(date, "التاريخ");

  if (!dateValidation.success) {
    throw new Error(dateValidation.errors.map(e => e.message).join(", "));
  }

  const validDate = dateValidation.data!;
  const day = validDate.getDate();
  const month = validDate.getMonth() + 1;
  const year = validDate.getFullYear();
  const weekNumber = getWeekNumber(day);

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
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * تطبيع التاريخ للمقارنة (إزالة الوقت)
 */
export function normalizeDateForComparison(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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
    const missingDaysStr = missingDates.map(d => d.getDate()).join("، ");
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
 * الحصول على حدود المستوى
 */
export function getTierThresholds(): Array<{
  tier: BonusTier;
  minRevenue: number;
  maxRevenue: number | null;
  bonusAmount: number;
}> {
  return [
    { tier: "tier_7", minRevenue: 3200, maxRevenue: null, bonusAmount: 190 },
    { tier: "tier_6", minRevenue: 2800, maxRevenue: 3199.99, bonusAmount: 155 },
    { tier: "tier_5", minRevenue: 2500, maxRevenue: 2799.99, bonusAmount: 120 },
    { tier: "tier_4", minRevenue: 2200, maxRevenue: 2499.99, bonusAmount: 90 },
    { tier: "tier_3", minRevenue: 1950, maxRevenue: 2199.99, bonusAmount: 65 },
    { tier: "tier_2", minRevenue: 1750, maxRevenue: 1949.99, bonusAmount: 55 },
    { tier: "tier_1", minRevenue: 1450, maxRevenue: 1749.99, bonusAmount: 35 },
    { tier: "none", minRevenue: 0, maxRevenue: 1449.99, bonusAmount: 0 },
  ];
}

/**
 * حساب الإيراد المطلوب للوصول للمستوى التالي
 */
export function getRevenueToNextTier(currentRevenue: number): {
  currentTier: BonusTier;
  nextTier: BonusTier | null;
  requiredRevenue: number;
  additionalNeeded: number;
} {
  const validation = validateNumber(currentRevenue, "الإيراد الحالي", { allowNegative: false });
  
  if (!validation.success) {
    throw new Error(validation.errors.map(e => e.message).join(", "));
  }

  const revenue = validation.data!;
  const thresholds = [
    { tier: "tier_7" as BonusTier, min: 3200 },
    { tier: "tier_6" as BonusTier, min: 2800 },
    { tier: "tier_5" as BonusTier, min: 2500 },
    { tier: "tier_4" as BonusTier, min: 2200 },
    { tier: "tier_3" as BonusTier, min: 1950 },
    { tier: "tier_2" as BonusTier, min: 1750 },
    { tier: "tier_1" as BonusTier, min: 1450 },
    { tier: "none" as BonusTier, min: 0 },
  ];

  let currentTier: BonusTier = "none";
  let nextTier: BonusTier | null = null;
  let requiredRevenue = 0;

  for (let i = 0; i < thresholds.length; i++) {
    if (revenue >= thresholds[i].min) {
      currentTier = thresholds[i].tier;
      if (i > 0) {
        nextTier = thresholds[i - 1].tier;
        requiredRevenue = thresholds[i - 1].min;
      }
      break;
    }
  }

  return {
    currentTier,
    nextTier,
    requiredRevenue,
    additionalNeeded: nextTier ? Math.max(0, requiredRevenue - revenue) : 0,
  };
}
