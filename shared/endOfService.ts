/**
 * إنهاء الخدمة (انتهاء العقد وعدم التجديد) والمخالصة النهائية
 * مصدر الحساب الوحيد للواجهة والخادم وقالب الطباعة.
 *
 * - مكافأة نهاية الخدمة مبلغ ثابت حسب سياسة المنشأة (END_OF_SERVICE_FIXED_AWARD = 2000 ريال)
 *   مهما كانت مدة الخدمة.
 * - الإجازات لا تدخل المخالصة: الموظف يستنفد إجازاته خلال الخدمة.
 * - الأجر المستحق حتى آخر يوم عمل: من أول شهر بعد آخر مسيرة شملت الموظف،
 *   بنظام 30 يوماً للشهر (مثل مسيرات الرواتب).
 * - التواريخ نصوص YYYY-MM-DD (يوم الرياض) حتى لا تتأثر بمنطقة الخادم أو المتصفح.
 */

import { PAYROLL_MONTH_DAYS } from "./payroll";
import { amountToArabicWords, roundMoney } from "./vouchers";

// ==================== الثوابت والتسميات ====================

export const END_OF_SERVICE_REQUEST_TYPE = "end_of_service" as const;
export const END_OF_SERVICE_REQUEST_LABEL = "إنهاء خدمة";

/** سبب إنهاء الخدمة (حالياً: انتهاء العقد وعدم التجديد) */
export type EndOfServiceReason = "contract_expiry";
export const END_OF_SERVICE_REASON_LABELS: Record<
  EndOfServiceReason,
  { ar: string; en: string }
> = {
  contract_expiry: {
    ar: "انتهاء مدة العقد وعدم التجديد",
    en: "Contract Expiry - Non-Renewal",
  },
};

export type EndOfServiceStatus = "draft" | "approved" | "paid" | "cancelled";
export const END_OF_SERVICE_STATUSES: EndOfServiceStatus[] = [
  "draft",
  "approved",
  "paid",
  "cancelled",
];
export const END_OF_SERVICE_STATUS_LABELS: Record<
  EndOfServiceStatus,
  { ar: string; en: string }
> = {
  draft: { ar: "مسودة - بانتظار الاعتماد", en: "Draft - Pending Approval" },
  approved: { ar: "معتمد", en: "Approved" },
  paid: { ar: "تم الصرف", en: "Paid" },
  cancelled: { ar: "ملغي", en: "Cancelled" },
};

/** انتقالات الحالة المسموحة */
export const END_OF_SERVICE_TRANSITIONS: Record<
  EndOfServiceStatus,
  EndOfServiceStatus[]
> = {
  draft: ["approved", "cancelled"],
  approved: ["paid", "cancelled"],
  paid: [],
  cancelled: [],
};

export function canTransitionEndOfService(from: string, to: string): boolean {
  return (
    END_OF_SERVICE_TRANSITIONS[from as EndOfServiceStatus] ?? []
  ).includes(to as EndOfServiceStatus);
}

/** التوقيعات والختم تظهر فقط بعد الاعتماد */
export function isEndOfServiceSigned(
  status: string | null | undefined
): boolean {
  return status === "approved" || status === "paid";
}

export function isEndOfServiceEditable(
  status: string | null | undefined
): boolean {
  return status === "draft";
}

export function getEndOfServiceStatusLabel(status: string | null | undefined): {
  ar: string;
  en: string;
} {
  return (
    END_OF_SERVICE_STATUS_LABELS[status as EndOfServiceStatus] ?? {
      ar: String(status ?? "-"),
      en: String(status ?? "-"),
    }
  );
}

/** مكافأة نهاية الخدمة: مبلغ ثابت حسب سياسة المنشأة */
export const END_OF_SERVICE_FIXED_AWARD = 2000;
export const SERVICE_YEAR_DAYS = 365;

// ==================== التواريخ (YYYY-MM-DD) ====================

export interface DateOnly {
  year: number;
  month: number;
  day: number;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** قراءة تاريخ YYYY-MM-DD صالح (أو null) */
export function parseDateOnly(
  value: string | null | undefined
): DateOnly | null {
  if (!value) return null;
  const m = DATE_RE.exec(String(value).trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  )
    return null;
  return { year, month, day };
}

export function formatDateOnly(d: DateOnly): string {
  return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}

function toUtcMs(d: DateOnly): number {
  return Date.UTC(d.year, d.month - 1, d.day);
}

function addDays(d: DateOnly, days: number): DateOnly {
  const x = new Date(toUtcMs(d) + days * 86400000);
  return {
    year: x.getUTCFullYear(),
    month: x.getUTCMonth() + 1,
    day: x.getUTCDate(),
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function compareDateOnly(a: DateOnly, b: DateOnly): number {
  return toUtcMs(a) - toUtcMs(b);
}

// ==================== مدة الخدمة ====================

export interface ServicePeriod {
  years: number;
  months: number;
  days: number;
  /** عدد الأيام الفعلي (شاملاً يومي البداية والنهاية) */
  totalDays: number;
  /** السنوات بالكسر العشري لحساب المكافأة: سنوات + أشهر/12 + أيام/365 */
  yearsDecimal: number;
}

/**
 * مدة الخدمة من تاريخ المباشرة حتى آخر يوم عمل (شاملاً اليومين)
 * مثال: 2021-11-01 → 2026-10-31 = 5 سنوات بالضبط
 */
export function computeServicePeriod(
  startDate: string,
  lastWorkingDay: string
): ServicePeriod | null {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(lastWorkingDay);
  if (!start || !end || compareDateOnly(end, start) < 0) return null;

  const endExclusive = addDays(end, 1);
  // أكبر عدد أشهر كاملة لا يتجاوز النهاية (اليوم يُقصّ لطول الشهر: 31 يناير + شهر = 28 فبراير)
  let totalMonths =
    (endExclusive.year - start.year) * 12 + (endExclusive.month - start.month);
  while (
    totalMonths > 0 &&
    compareDateOnly(addMonthsClamped(start, totalMonths), endExclusive) > 0
  )
    totalMonths--;
  const anniversary = addMonthsClamped(start, totalMonths);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const days = Math.round(
    (toUtcMs(endExclusive) - toUtcMs(anniversary)) / 86400000
  );
  const totalDays = Math.round(
    (toUtcMs(endExclusive) - toUtcMs(start)) / 86400000
  );
  const yearsDecimal = years + months / 12 + days / SERVICE_YEAR_DAYS;
  return { years, months, days, totalDays, yearsDecimal };
}

function addMonthsClamped(d: DateOnly, monthsToAdd: number): DateOnly {
  const index = d.year * 12 + (d.month - 1) + monthsToAdd;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return { year, month, day: Math.min(d.day, daysInMonth(year, month)) };
}

function arabicCount(
  n: number,
  one: string,
  two: string,
  few: string,
  many: string
): string {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${n} ${few}`;
  return `${n} ${many}`;
}

/** "5 سنوات و3 أشهر و10 أيام" */
export function formatServicePeriod(
  p: Pick<ServicePeriod, "years" | "months" | "days">
): string {
  const parts: string[] = [];
  if (p.years > 0)
    parts.push(arabicCount(p.years, "سنة واحدة", "سنتان", "سنوات", "سنة"));
  if (p.months > 0)
    parts.push(arabicCount(p.months, "شهر واحد", "شهران", "أشهر", "شهراً"));
  if (p.days > 0)
    parts.push(arabicCount(p.days, "يوم واحد", "يومان", "أيام", "يوماً"));
  return parts.length > 0 ? parts.join(" و") : "أقل من يوم";
}

// ==================== الأجر ====================

/** أجر اليوم = الأجر الشهري ÷ 30 */
export function dailyWage(monthlyWage: number): number {
  return Math.max(0, Number(monthlyWage) || 0) / PAYROLL_MONTH_DAYS;
}

// ==================== الأجر المستحق حتى آخر يوم عمل ====================

export interface PayrollMonthRef {
  year: number;
  month: number;
}

export interface UnpaidSalaryPeriod {
  /** أول يوم غير مدفوع (YYYY-MM-DD) أو null إذا لا يوجد أجر مستحق */
  fromDate: string | null;
  days: number;
  /** الموظف مشمول بمسيرة تغطي شهر آخر يوم عمل (قد يكون صُرف له الشهر كاملاً) */
  coveredByPayroll: boolean;
  /** آخر مسيرة شملت الموظف لشهر بعد شهر آخر يوم عمل (أجر شهر لم يعمل فيه) */
  payrollAfterLastMonth?: boolean;
}

/**
 * أيام الأجر غير المدفوع حتى آخر يوم عمل
 * - تبدأ من أول الشهر التالي لآخر مسيرة شملت الموظف (أو أول شهر آخر يوم عمل إن لم توجد مسيرة)،
 *   ولا تبدأ قبل تاريخ مباشرة العمل
 * - مثل المسيرات: الشهر الميلادي الكامل = 30 يوماً، والشهر الجزئي = عدد أيامه الفعلية (بحد أقصى 30)
 */
export function computeUnpaidSalaryPeriod(
  lastWorkingDay: string,
  lastPayrollMonth: PayrollMonthRef | null,
  hireDate?: string | null
): UnpaidSalaryPeriod {
  const end = parseDateOnly(lastWorkingDay);
  if (!end) return { fromDate: null, days: 0, coveredByPayroll: false };

  let from: DateOnly;
  if (lastPayrollMonth) {
    const paidIndex = lastPayrollMonth.year * 12 + (lastPayrollMonth.month - 1);
    const endIndex = end.year * 12 + (end.month - 1);
    if (paidIndex >= endIndex)
      return {
        fromDate: null,
        days: 0,
        coveredByPayroll: true,
        payrollAfterLastMonth: paidIndex > endIndex,
      };
    const next = paidIndex + 1;
    from = { year: Math.floor(next / 12), month: (next % 12) + 1, day: 1 };
  } else {
    from = { year: end.year, month: end.month, day: 1 };
  }
  const hire = parseDateOnly(hireDate ?? null);
  if (hire && compareDateOnly(hire, from) > 0) from = hire;
  if (compareDateOnly(from, end) > 0)
    return { fromDate: null, days: 0, coveredByPayroll: false };

  let days = 0;
  let y = from.year;
  let m = from.month;
  while (y * 12 + m <= end.year * 12 + end.month) {
    const monthLength = daysInMonth(y, m);
    const firstDay = y === from.year && m === from.month ? from.day : 1;
    const lastDay = y === end.year && m === end.month ? end.day : monthLength;
    days +=
      firstDay === 1 && lastDay === monthLength
        ? PAYROLL_MONTH_DAYS
        : Math.min(lastDay - firstDay + 1, PAYROLL_MONTH_DAYS);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return { fromDate: formatDateOnly(from), days, coveredByPayroll: false };
}

// ==================== المخالصة ====================

export interface EndOfServiceDeductionItem {
  id: number;
  /** وصف البند (رقم الطلب/نوع المخالفة) */
  label: string;
  amount: number;
  date?: string | null;
}

/** مدخلات الحساب (القيم اليدوية اختيارية؛ الفارغ يعني القيمة المحسوبة) */
export interface EndOfServiceCalcInput {
  hireDate: string;
  lastWorkingDay: string;
  /** الأجر الأساسي الشهري */
  baseSalary: number;
  /** البدلات الثابتة الشهرية (الساعات الإضافية الثابتة + حافز الإشراف ...) */
  fixedAllowances: number;
  /** آخر شهر صُرف فيه راتب للموظف (من المسيرات غير الملغاة) */
  lastPayrollMonth: PayrollMonthRef | null;
  /** أيام أجر مستحق يدوية (تتجاوز المحسوب) */
  salaryDaysOverride?: number | null;
  otherAdditions?: number;
  advances: EndOfServiceDeductionItem[];
  violations: EndOfServiceDeductionItem[];
  otherDeductions?: number;
}

export interface EndOfServiceCalculation {
  service: ServicePeriod;
  serviceText: string;
  monthlyWage: number;
  dailyWage: number;
  /** مكافأة نهاية الخدمة (مبلغ ثابت) */
  eosAward: number;
  salaryFromDate: string | null;
  computedSalaryDays: number;
  salaryDays: number;
  salaryDaysIsManual: boolean;
  salaryCoveredByPayroll: boolean;
  salaryDue: number;
  otherAdditions: number;
  advancesDeduction: number;
  violationsDeduction: number;
  otherDeductions: number;
  totalEntitlements: number;
  totalDeductions: number;
  /** الصافي (سالب = مبلغ مستحق على الموظف) */
  netAmount: number;
  netAmountWords: string;
  warnings: string[];
}

export type EndOfServiceCalcResult =
  | { ok: true; calculation: EndOfServiceCalculation }
  | { ok: false; error: string };

function nonNegative(value: unknown): number {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function optionalNonNegative(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** حساب المخالصة النهائية كاملة */
export function calculateEndOfServiceSettlement(
  input: EndOfServiceCalcInput
): EndOfServiceCalcResult {
  if (!parseDateOnly(input.hireDate))
    return { ok: false, error: "تاريخ مباشرة العمل غير صحيح" };
  if (!parseDateOnly(input.lastWorkingDay))
    return { ok: false, error: "تاريخ آخر يوم عمل غير صحيح" };
  const service = computeServicePeriod(input.hireDate, input.lastWorkingDay);
  if (!service)
    return {
      ok: false,
      error: "آخر يوم عمل يجب أن يكون بعد تاريخ مباشرة العمل",
    };

  const baseSalary = nonNegative(input.baseSalary);
  const allowances = nonNegative(input.fixedAllowances);
  const monthlyWage = roundMoney(baseSalary + allowances);
  if (monthlyWage <= 0)
    return {
      ok: false,
      error: "الأجر الشهري المعتمد للحساب يجب أن يكون أكبر من صفر",
    };
  const perDay = dailyWage(monthlyWage);
  const warnings: string[] = [];

  // مكافأة نهاية الخدمة: مبلغ ثابت حسب سياسة المنشأة
  const eosAward = END_OF_SERVICE_FIXED_AWARD;

  // الأجر المستحق
  const unpaid = computeUnpaidSalaryPeriod(
    input.lastWorkingDay,
    input.lastPayrollMonth,
    input.hireDate
  );
  const salaryOverride = optionalNonNegative(input.salaryDaysOverride);
  const salaryDays = salaryOverride ?? unpaid.days;
  const salaryDue = roundMoney(perDay * salaryDays);
  if (unpaid.payrollAfterLastMonth && input.lastPayrollMonth) {
    warnings.push(
      `الموظف مشمول بمسير رواتب لشهر ${input.lastPayrollMonth.month}/${input.lastPayrollMonth.year} بعد آخر يوم عمل؛ عدّل أيام عمله في ذلك المسير إلى صفر حتى لا يُصرف له أجر شهر لم يعمل فيه`
    );
  } else if (unpaid.coveredByPayroll && salaryOverride === null) {
    warnings.push(
      "الموظف مشمول بمسير رواتب لشهر آخر يوم عمل؛ تأكد من أيام العمل في ذلك المسير حتى لا يُصرف له أكثر من مستحقه"
    );
  }
  if (
    !input.lastPayrollMonth &&
    salaryOverride === null &&
    unpaid.fromDate &&
    unpaid.fromDate > input.hireDate
  ) {
    warnings.push(
      "لا يوجد مسير رواتب سابق للموظف في النظام؛ الأجر المستحق محسوب من بداية شهر آخر يوم عمل فقط، تأكد من صرف رواتب الأشهر السابقة"
    );
  }
  const otherAdditions = roundMoney(nonNegative(input.otherAdditions));
  const advancesDeduction = roundMoney(
    input.advances.reduce((s, a) => s + nonNegative(a.amount), 0)
  );
  const violationsDeduction = roundMoney(
    input.violations.reduce((s, v) => s + nonNegative(v.amount), 0)
  );
  const otherDeductions = roundMoney(nonNegative(input.otherDeductions));

  const totalEntitlements = roundMoney(eosAward + salaryDue + otherAdditions);
  const totalDeductions = roundMoney(
    advancesDeduction + violationsDeduction + otherDeductions
  );
  const netAmount = roundMoney(totalEntitlements - totalDeductions);
  if (netAmount < 0)
    warnings.push("الخصومات أكبر من المستحقات؛ الصافي مبلغ مستحق على الموظف");

  return {
    ok: true,
    calculation: {
      service,
      serviceText: formatServicePeriod(service),
      monthlyWage,
      dailyWage: roundMoney(perDay),
      eosAward,
      salaryFromDate: unpaid.fromDate,
      computedSalaryDays: unpaid.days,
      salaryDays,
      salaryDaysIsManual: salaryOverride !== null,
      salaryCoveredByPayroll: unpaid.coveredByPayroll,
      salaryDue,
      otherAdditions,
      advancesDeduction,
      violationsDeduction,
      otherDeductions,
      totalEntitlements,
      totalDeductions,
      netAmount,
      netAmountWords: amountToArabicWords(Math.abs(netAmount)),
      warnings,
    },
  };
}

/** هل تغيرت أرقام المخالصة (للاعتماد: يُرفض إذا تغيرت منذ آخر مراجعة) */
export function settlementTotalsChanged(
  a: Pick<
    EndOfServiceCalculation,
    "totalEntitlements" | "totalDeductions" | "netAmount"
  >,
  b: Pick<
    EndOfServiceCalculation,
    "totalEntitlements" | "totalDeductions" | "netAmount"
  >
): boolean {
  return (
    Math.abs(a.totalEntitlements - b.totalEntitlements) > 0.005 ||
    Math.abs(a.totalDeductions - b.totalDeductions) > 0.005 ||
    Math.abs(a.netAmount - b.netAmount) > 0.005
  );
}

// ==================== الترقيم ====================

export const END_OF_SERVICE_PREFIX = "EOS";

export function formatEndOfServiceNumber(
  year: number,
  sequence: number
): string {
  return `${END_OF_SERVICE_PREFIX}-${year}-${String(Math.max(1, sequence)).padStart(4, "0")}`;
}

export function parseEndOfServiceSequence(
  value: string | null | undefined
): number {
  const m = /^EOS-\d{4}-(\d+)$/.exec(String(value ?? ""));
  return m ? Number(m[1]) : 0;
}

// ==================== بيانات المستند (الخطاب والمخالصة) ====================

/** كل ما يحتاجه قالب الطباعة (لقطة محفوظة وقت الإنشاء + الحساب + الحالة) */
export interface EndOfServiceDocumentData {
  settlementNumber: string;
  status: EndOfServiceStatus | string;
  reason: EndOfServiceReason | string;
  /** تاريخ الخطاب */
  letterDate: string;
  // بيانات الموظف
  employeeName: string;
  employeeCode: string;
  nationality?: string | null;
  idNumber?: string | null;
  position?: string | null;
  branchName?: string | null;
  hireDate: string;
  contractEndDate: string;
  lastWorkingDay: string;
  // الأجر
  baseSalary: number;
  fixedAllowances: number;
  // الحساب
  calculation: EndOfServiceCalculation;
  advances: EndOfServiceDeductionItem[];
  violations: EndOfServiceDeductionItem[];
  otherAdditionsNote?: string | null;
  otherDeductionsNote?: string | null;
  salaryNote?: string | null;
  notes?: string | null;
  // الدفع
  paymentMethod?: string | null;
  paymentReference?: string | null;
  // التتبع
  createdByName?: string | null;
  createdAt?: Date | string | null;
  approvedByName?: string | null;
  approvedAt?: Date | string | null;
  paidByName?: string | null;
  paidAt?: Date | string | null;
  cancelledByName?: string | null;
  cancelledAt?: Date | string | null;
  cancellationReason?: string | null;
}

export type EndOfServiceDocumentKind = "letter" | "settlement";

export const END_OF_SERVICE_DOCUMENT_TITLES: Record<
  EndOfServiceDocumentKind,
  { ar: string; en: string }
> = {
  letter: {
    ar: "إشعار انتهاء عقد العمل وعدم التجديد",
    en: "Notice of Contract Expiry and Non-Renewal",
  },
  settlement: {
    ar: "مخالصة نهائية وإبراء ذمة",
    en: "Final Settlement and Release",
  },
};

/** طرق صرف المخالصة */
export const END_OF_SERVICE_PAYMENT_METHODS: Record<
  string,
  { ar: string; en: string }
> = {
  cash: { ar: "نقداً", en: "Cash" },
  bank_transfer: { ar: "تحويل بنكي", en: "Bank Transfer" },
  check: { ar: "شيك", en: "Cheque" },
};
