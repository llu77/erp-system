/**
 * المصاريف: قواعد مشتركة بين الواجهة والخادم
 * - التصنيفات وأسماؤها (مصدر واحد بدل القوائم المكررة)
 * - مصادر المصروف: يدوي، مصروف ثابت شهري، مسير رواتب معتمد
 * - المصاريف الثابتة الافتراضية لكل مؤسسة (تُنشأ قوالبها عند أول تشغيل)
 * - حدود الشهر وتاريخ المصروف التلقائي ومفاتيح عدم التكرار
 */

import type { EstablishmentKey } from "./branding";
import { roundMoney } from "./vouchers";

// ==================== التصنيفات ====================

/** تصنيفات يدخلها المستخدم (الرواتب تأتي من المسير المعتمد فقط) */
export const MANUAL_EXPENSE_CATEGORIES = [
  "shop_supplies",
  "printing",
  "carpet_cleaning",
  "small_needs",
  "residency",
  "medical_exam",
  "transportation",
  "electricity",
  "internet",
  "license_renewal",
  "visa",
  "residency_renewal",
  "health_cert_renewal",
  "maintenance",
  "health_cert",
  "violation",
  "emergency",
  "shop_rent",
  "housing_rent",
  "improvements",
  "bonus",
  "other",
] as const;

export type ManualExpenseCategory = (typeof MANUAL_EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORIES = [...MANUAL_EXPENSE_CATEGORIES, "salaries"] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  shop_supplies: "اغراض محل",
  printing: "طباعة ورق",
  carpet_cleaning: "غسيل سجاد",
  small_needs: "احتياجات بسيطة",
  residency: "اقامة",
  medical_exam: "فحص طبي",
  transportation: "مواصلات",
  electricity: "كهرباء",
  internet: "انترنت",
  license_renewal: "تجديد رخصة",
  visa: "تاشيره",
  residency_renewal: "تجديد اقامة",
  health_cert_renewal: "تجديد شهادة صحيه",
  maintenance: "صيانة",
  health_cert: "شهادة صحية",
  violation: "مخالفة",
  emergency: "طوارىء",
  shop_rent: "ايجار محل",
  housing_rent: "ايجار سكن",
  improvements: "تحسينات",
  bonus: "مكافأة",
  other: "أخرى",
  salaries: "رواتب",
};

export function expenseCategoryLabel(category: string | null | undefined): string {
  return EXPENSE_CATEGORY_LABELS[(category ?? "") as ExpenseCategory] ?? (category || "أخرى");
}

// ==================== المصدر وطريقة الدفع ====================

export const EXPENSE_SOURCES = ["manual", "fixed", "payroll"] as const;

export type ExpenseSource = (typeof EXPENSE_SOURCES)[number];

export const EXPENSE_SOURCE_LABELS: Record<ExpenseSource, string> = {
  manual: "يدوي",
  fixed: "مصاريف ثابتة",
  payroll: "مسير رواتب",
};

/** عنوان قسم المصاريف الثابتة في الصفحات والتقارير */
export const FIXED_EXPENSES_SECTION_TITLE = "مصاريف ثابتة";

export const EXPENSE_PAYMENT_METHODS = ["cash", "bank_transfer", "check", "credit_card", "other"] as const;

export type ExpensePaymentMethod = (typeof EXPENSE_PAYMENT_METHODS)[number];

export const EXPENSE_PAYMENT_METHOD_LABELS: Record<ExpensePaymentMethod, string> = {
  cash: "نقدي",
  bank_transfer: "تحويل بنكي",
  check: "شيك",
  credit_card: "بطاقة ائتمان",
  other: "أخرى",
};

export function expensePaymentMethodLabel(method: string | null | undefined): string {
  return EXPENSE_PAYMENT_METHOD_LABELS[(method ?? "") as ExpensePaymentMethod] ?? (method || "-");
}

// ==================== المصاريف الثابتة الافتراضية ====================

export interface FixedExpenseDefault {
  category: ManualExpenseCategory;
  title: string;
  amount: number;
  paymentMethod: ExpensePaymentMethod;
}

/**
 * المصاريف الثابتة الشهرية لكل مؤسسة (حسب الفرع): تُنشأ قوالبها مرة واحدة ويمكن تعديلها لاحقاً
 * - قصه وتخفيف (لبن): إيجار محل 3583 تحويل، إيجار سكن 1700، إنترنت 250
 * - تدرج وتخفيف (طويق): إيجار محل 3583 تحويل، إيجار سكن 2000، إنترنت 250
 */
export const DEFAULT_FIXED_EXPENSES: Record<Exclude<EstablishmentKey, "group">, FixedExpenseDefault[]> = {
  qessa: [
    { category: "shop_rent", title: "إيجار محل", amount: 3583, paymentMethod: "bank_transfer" },
    { category: "housing_rent", title: "إيجار سكن", amount: 1700, paymentMethod: "cash" },
    { category: "internet", title: "إنترنت", amount: 250, paymentMethod: "cash" },
  ],
  tadarruj: [
    { category: "shop_rent", title: "إيجار محل", amount: 3583, paymentMethod: "bank_transfer" },
    { category: "housing_rent", title: "إيجار سكن", amount: 2000, paymentMethod: "cash" },
    { category: "internet", title: "إنترنت", amount: 250, paymentMethod: "cash" },
  ],
};

// ==================== الشهر والتاريخ ومفاتيح عدم التكرار ====================

/** مفتاح الشهر YYYY-MM */
export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** هل الشهر (year, month) في أو بعد YYYY-MM؟ */
export function isMonthOnOrAfter(year: number, month: number, startsOn: string): boolean {
  return monthKey(year, month) >= startsOn;
}

/**
 * حدود الشهر بتوقيت UTC (الإيرادات اليومية ومصاريف اليوم تُحفظ منتصف ليل UTC ليوم العمل)
 * [start, endExclusive)
 */
export function utcMonthRange(year: number, month: number): { start: Date; endExclusive: Date } {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    endExclusive: new Date(Date.UTC(year, month, 1)),
  };
}

/** تاريخ المصروف التلقائي: ظهر اليوم الأول من الشهر (داخل الشهر بتوقيت UTC والرياض معاً) */
export function autoExpenseDate(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1, 12));
}

export function fixedExpenseSourceKey(branchId: number, year: number, month: number, templateId: number): string {
  return `fixed:${branchId}:${monthKey(year, month)}:${templateId}`;
}

export function payrollExpenseSourceKey(payrollId: number): string {
  return `payroll:${payrollId}`;
}

/**
 * تكلفة مسير الرواتب كمصروف: صافي المسير + السلف المستردة فيه
 * (السلف صُرفت نقداً من قبل ولا تُسجل مصروفاً عند صرفها، فالصافي وحده يقلل التكلفة الفعلية)
 */
export function payrollExpenseAmount(totalNetSalary: number, recoveredAdvances: number): number {
  return roundMoney((Number(totalNetSalary) || 0) + (Number(recoveredAdvances) || 0));
}
