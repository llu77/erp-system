/**
 * منطق واجهة بوابة الموظفين (دوال نقية بدون React - قابلة للاختبار)
 * - مسارات البوابة وإعادة التوجيه عند انتهاء الجلسة
 * - التبويبات من رابط الصفحة (?tab=)
 * - تنسيق التواريخ (يوم تقويم الرياض، ميلادي) والمبالغ
 * - بنود قسيمة الراتب وطلب السلفة
 */

import { EMPLOYEE_UNAUTHED_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import { LEAVE_KIND_LABELS, type LeaveKind } from "@shared/payroll";
import type { PayslipDocumentData, PayslipItem } from "@shared/payslipTemplate";
import { amountToArabicWords, toVoucherDateString, VOUCHER_TIMEZONE } from "@shared/vouchers";

// ==================== المسارات ====================

export const PORTAL_LOGIN_PATH = "/employee-login";
export const EMPLOYEE_PORTAL_PATH = "/employee-portal";
export const ADMIN_PORTAL_PATH = "/admin-employee-portal";

const PORTAL_PATHS = [PORTAL_LOGIN_PATH, EMPLOYEE_PORTAL_PATH, ADMIN_PORTAL_PATH];

export function isPortalPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return PORTAL_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * إعادة التوجيه عند خطأ عدم تسجيل الدخول:
 * - انتهاء جلسة البوابة -> صفحة دخول الموظفين (وليس دخول النظام)
 * - انتهاء جلسة النظام داخل صفحات البوابة -> لا شيء (البوابة تدير جلستها بنفسها)
 */
export function resolveAuthRedirect(
  message: string | null | undefined,
  pathname: string | null | undefined
): "employee-login" | "oauth-login" | null {
  if (message === EMPLOYEE_UNAUTHED_ERR_MSG) {
    return pathname === PORTAL_LOGIN_PATH ? null : "employee-login";
  }
  if (message === UNAUTHED_ERR_MSG) {
    return isPortalPath(pathname) ? null : "oauth-login";
  }
  return null;
}

/** الصفحة الرئيسية للموظف بعد الدخول: المشرف -> لوحة المشرف، غيره -> البوابة */
export function portalHomePath(me: { isSupervisor: boolean }): string {
  return me.isSupervisor ? ADMIN_PORTAL_PATH : EMPLOYEE_PORTAL_PATH;
}

/** أدوار مستخدمي النظام المسموح لهم بلوحة مراجعة البوابة */
export const STAFF_REVIEWER_ROLES = ["admin", "manager", "supervisor", "viewer"] as const;

export function isStaffReviewerRole(role: string | null | undefined): boolean {
  return !!role && (STAFF_REVIEWER_ROLES as readonly string[]).includes(role);
}

export type AdminPortalAccess =
  | { kind: "employee" }
  | { kind: "staff" }
  | { kind: "redirect"; to: string };

/**
 * من يدخل لوحة المشرف: موظف مشرف بجلسة البوابة، أو مستخدم النظام بدور مراجع.
 * الموظف العادي يُعاد لبوابته، ومن لا جلسة له لصفحة الدخول
 */
export function resolveAdminPortalAccess(
  me: { isSupervisor: boolean } | null | undefined,
  staffRole: string | null | undefined
): AdminPortalAccess {
  if (me?.isSupervisor) return { kind: "employee" };
  if (isStaffReviewerRole(staffRole)) return { kind: "staff" };
  if (me) return { kind: "redirect", to: EMPLOYEE_PORTAL_PATH };
  return { kind: "redirect", to: PORTAL_LOGIN_PATH };
}

export const STAFF_ROLE_LABELS: Record<string, string> = {
  admin: "مدير النظام",
  manager: "مدير",
  supervisor: "مشرف",
  viewer: "مشرف عام",
};

// ==================== التبويبات من الرابط ====================

export const EMPLOYEE_PORTAL_TABS = ["chat", "requests", "salary", "leaves", "bonus", "profile"] as const;
export type EmployeePortalTab = (typeof EMPLOYEE_PORTAL_TABS)[number];

export const ADMIN_PORTAL_TABS = ["dashboard", "requests", "employees", "documents", "reports", "myProfile"] as const;
export type AdminPortalTab = (typeof ADMIN_PORTAL_TABS)[number];

/** أسماء بديلة قد تصل في روابط الإشعارات */
const TAB_ALIASES: Record<string, string> = {
  payslip: "salary",
  payroll: "salary",
  advances: "requests",
  advance: "requests",
  documents: "profile",
  assistant: "chat",
};

function toSearchParams(search: string | null | undefined): URLSearchParams {
  const raw = (search ?? "").trim();
  return new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
}

/** التبويب المطلوب في الرابط (?tab=) إن كان مسموحاً، وإلا الافتراضي */
export function resolvePortalTab<T extends string>(
  search: string | null | undefined,
  allowed: readonly T[],
  fallback: T
): T {
  const requested = toSearchParams(search).get("tab");
  if (!requested) return fallback;
  if ((allowed as readonly string[]).includes(requested)) return requested as T;
  const alias = TAB_ALIASES[requested];
  if (alias && (allowed as readonly string[]).includes(alias)) return alias as T;
  return fallback;
}

/** رقم موجب من الرابط (مثل ?payrollId=12) أو null */
export function readPositiveIntParam(search: string | null | undefined, name: string): number | null {
  const value = toSearchParams(search).get(name);
  if (!value || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** رابط تبويب مع الحفاظ على بقية معاملات الرابط */
export function buildTabHref(path: string, search: string | null | undefined, tab: string): string {
  const params = toSearchParams(search);
  params.set("tab", tab);
  return `${path}?${params.toString()}`;
}

// ==================== التواريخ والمبالغ ====================

const DATE_FORMAT = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: VOUCHER_TIMEZONE,
});

/** تاريخ ميلادي بالعربية ليوم التقويم في الرياض (يقبل YYYY-MM-DD أو Date) */
export function formatPortalDate(value: Date | string | null | undefined, fallback = "-"): string {
  const ymd = toVoucherDateString(value ?? null);
  if (!ymd) return fallback;
  const [y, m, d] = ymd.split("-").map(Number);
  return DATE_FORMAT.format(new Date(Date.UTC(y, m - 1, d)));
}

/** تاريخ ووقت بتوقيت الرياض */
export function formatPortalDateTime(value: Date | string | null | undefined, fallback = "-"): string {
  if (value === null || value === undefined || value === "") return fallback;
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return fallback;
  return DATE_TIME_FORMAT.format(d);
}

/** عدد الأيام حتى التاريخ (بأيام تقويم الرياض): سالب = منتهي */
export function daysUntil(value: Date | string | null | undefined, now: Date = new Date()): number | null {
  const target = toVoucherDateString(value ?? null);
  const today = toVoucherDateString(now);
  if (!target || !today) return null;
  const toUtc = (ymd: string) => {
    const [y, m, d] = ymd.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(target) - toUtc(today)) / 86_400_000);
}

const AMOUNT_FORMAT = new Intl.NumberFormat("ar-SA", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function toAmount(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** مبلغ بالريال (عربي) */
export function formatSar(value: unknown): string {
  return `${AMOUNT_FORMAT.format(toAmount(value))} ر.س`;
}

export const MONTH_NAMES_AR = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
] as const;

export function payrollPeriodLabel(year: number, month: number): string {
  const name = MONTH_NAMES_AR[month - 1];
  return name ? `${name} ${year}` : `${month}/${year}`;
}

// ==================== الأخطاء ====================

/** رسالة الخطأ للمستخدم (رسائل التحقق الخام من الخادم تُستبدل برسالة عامة) */
export function errorMessage(error: unknown, fallback: string): string {
  const message = (error as { message?: unknown } | null)?.message;
  if (typeof message !== "string") return fallback;
  const trimmed = message.trim();
  if (!trimmed || trimmed.startsWith("[") || trimmed.startsWith("{")) return fallback;
  return trimmed;
}

export function trpcErrorCode(error: unknown): string | undefined {
  const code = (error as { data?: { code?: unknown } } | null)?.data?.code;
  return typeof code === "string" ? code : undefined;
}

/** إعادة المحاولة للأخطاء المؤقتة فقط (لا تُعاد أخطاء الصلاحية أو عدم الوجود) */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  const code = trpcErrorCode(error);
  if (code && ["NOT_FOUND", "FORBIDDEN", "UNAUTHORIZED", "BAD_REQUEST"].includes(code)) return false;
  return failureCount < 2;
}

// ==================== قسيمة الراتب ====================

/** حالة القسيمة في البوابة: المعتمدة والمصروفة باللون الأخضر */
export function payslipStatusInfo(status: string | null | undefined): { label: string; className: string } {
  switch (status) {
    case "approved":
      return { label: "معتمد", className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" };
    case "paid":
      return { label: "تم الصرف", className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" };
    default:
      return { label: "غير معتمد", className: "bg-amber-500/20 text-amber-300 border-amber-500/40" };
  }
}

export interface PayslipLine {
  key: string;
  label: string;
  amount: number;
  note?: string | null;
  items?: PayslipItem[];
}

export function leaveTypeLabel(leaveType: string | null | undefined): string | null {
  if (!leaveType) return null;
  return LEAVE_KIND_LABELS[leaveType as LeaveKind] ?? leaveType;
}

/** بنود الاستحقاقات (الراتب الأساسي دائماً، والبقية عند وجود قيمة) */
export function buildPayslipEarnings(data: PayslipDocumentData): PayslipLine[] {
  const e = data.earnings;
  const lines: PayslipLine[] = [{ key: "base", label: "الراتب الأساسي", amount: toAmount(e.baseSalary) }];
  if (e.overtimeEnabled && toAmount(e.overtimeAmount) > 0) {
    lines.push({ key: "overtime", label: "بدل الساعات الإضافية", amount: toAmount(e.overtimeAmount) });
  }
  if (toAmount(e.incentiveAmount) > 0) {
    lines.push({
      key: "incentive",
      label: e.isSupervisor ? "حوافز المشرف" : "الحوافز",
      amount: toAmount(e.incentiveAmount),
    });
  }
  return lines;
}

/** بنود الخصومات مع تفاصيل كل بند (السلف، المخالفات، الإجازات، الفواتير السالبة) */
export function buildPayslipDeductions(data: PayslipDocumentData): PayslipLine[] {
  const d = data.deductions;
  const a = data.attendance;
  const items = data.items ?? { advances: [], violations: [], leaves: [], negativeInvoices: [] };
  const lines: PayslipLine[] = [];

  if (toAmount(d.absentDeduction) > 0) {
    lines.push({
      key: "absent",
      label: a.absentDays > 0 ? `خصم الغياب (${a.absentDays} يوم)` : "خصم الغياب",
      amount: toAmount(d.absentDeduction),
    });
  }
  if (toAmount(d.leaveDeduction) > 0) {
    const kind = leaveTypeLabel(a.leaveType);
    const parts = [a.leaveDays > 0 ? `${a.leaveDays} يوم` : null, kind].filter(Boolean);
    lines.push({
      key: "leave",
      label: parts.length ? `خصم الإجازات (${parts.join(" - ")})` : "خصم الإجازات",
      amount: toAmount(d.leaveDeduction),
      items: items.leaves,
    });
  }
  if (toAmount(d.advanceDeduction) > 0) {
    lines.push({ key: "advance", label: "خصم السلف", amount: toAmount(d.advanceDeduction), items: items.advances });
  }
  if (toAmount(d.violationsDeduction) > 0) {
    lines.push({
      key: "violations",
      label: "خصم المخالفات",
      amount: toAmount(d.violationsDeduction),
      items: items.violations,
    });
  }
  if (toAmount(d.negativeInvoicesDeduction) > 0) {
    lines.push({
      key: "negativeInvoices",
      label: "خصم الفواتير السالبة",
      amount: toAmount(d.negativeInvoicesDeduction),
      items: items.negativeInvoices,
    });
  }
  if (toAmount(d.otherDeduction) > 0) {
    lines.push({
      key: "other",
      label: "خصومات أخرى",
      amount: toAmount(d.otherDeduction),
      note: d.otherDeductionReason || null,
    });
  }
  return lines;
}

/** صافي الراتب كتابةً (الصافي السالب مبلغ مستحق على الموظف) */
export function netSalaryInWords(net: number): string {
  const value = toAmount(net);
  if (value < 0) return `لا يوجد صافي مستحق — مستحق على الموظف: ${amountToArabicWords(Math.abs(value))}`;
  return amountToArabicWords(value);
}

/** القسيمة المختارة: المطلوبة إن وُجدت في القائمة، وإلا الأحدث (القائمة مرتبة من الأحدث) */
export function pickPayrollId(
  slips: ReadonlyArray<{ payrollId: number }> | null | undefined,
  preferred: number | null | undefined
): number | null {
  if (!slips || slips.length === 0) return null;
  if (preferred != null && slips.some(s => s.payrollId === preferred)) return preferred;
  return slips[0].payrollId;
}

// ==================== طلب السلفة ====================

export const REPAYMENT_METHODS = ["salary_deduction", "installments", "full_payment"] as const;
export type RepaymentMethod = (typeof REPAYMENT_METHODS)[number];

export const ADVANCE_LIMITS = {
  minAmount: 1,
  maxAmount: 100_000,
  minReason: 3,
  maxReason: 1000,
} as const;

export interface AdvanceFormInput {
  amount: string;
  reason: string;
  repaymentMethod: string;
}

export type AdvanceFormErrors = Partial<Record<keyof AdvanceFormInput, string>>;

export type AdvanceFormResult =
  | { ok: true; value: { amount: number; reason: string; repaymentMethod: RepaymentMethod } }
  | { ok: false; errors: AdvanceFormErrors };

/** تحويل الأرقام العربية/الفارسية والفواصل إلى صيغة رقمية */
export function normalizeAmountInput(raw: string): string {
  return raw
    .trim()
    .replace(/[٠-٩]/g, ch => String(ch.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, ch => String(ch.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, ".")
    .replace(/[٬,\s]/g, "");
}

export function validateAdvanceForm(input: AdvanceFormInput): AdvanceFormResult {
  const errors: AdvanceFormErrors = {};

  const normalized = normalizeAmountInput(input.amount);
  let amount = NaN;
  if (!normalized) {
    errors.amount = "يرجى إدخال مبلغ السلفة";
  } else if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    errors.amount = "صيغة المبلغ غير صحيحة (بحد أقصى خانتين عشريتين)";
  } else {
    amount = Number(normalized);
    if (amount < ADVANCE_LIMITS.minAmount) {
      errors.amount = `أقل مبلغ للسلفة ${ADVANCE_LIMITS.minAmount} ريال`;
    } else if (amount > ADVANCE_LIMITS.maxAmount) {
      errors.amount = `أعلى مبلغ للسلفة ${ADVANCE_LIMITS.maxAmount.toLocaleString("en-US")} ريال`;
    }
  }

  const reason = input.reason.trim();
  if (reason.length < ADVANCE_LIMITS.minReason) {
    errors.reason = `يرجى توضيح سبب السلفة (${ADVANCE_LIMITS.minReason} أحرف على الأقل)`;
  } else if (reason.length > ADVANCE_LIMITS.maxReason) {
    errors.reason = `السبب طويل جداً (الحد ${ADVANCE_LIMITS.maxReason} حرف)`;
  }

  if (!(REPAYMENT_METHODS as readonly string[]).includes(input.repaymentMethod)) {
    errors.repaymentMethod = "يرجى اختيار طريقة السداد";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { amount, reason, repaymentMethod: input.repaymentMethod as RepaymentMethod },
  };
}

// ==================== كلمة المرور ====================

export const PORTAL_PASSWORD_MIN_LENGTH = 8;

export function validatePasswordChange(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): string | null {
  if (!input.currentPassword) return "يرجى إدخال كلمة المرور الحالية";
  if (input.newPassword.length < PORTAL_PASSWORD_MIN_LENGTH) {
    return `كلمة المرور الجديدة يجب أن تكون ${PORTAL_PASSWORD_MIN_LENGTH} أحرف على الأقل`;
  }
  if (input.newPassword.length > 128) return "كلمة المرور طويلة جداً";
  if (input.newPassword === input.currentPassword) return "كلمة المرور الجديدة يجب أن تختلف عن الحالية";
  if (input.newPassword !== input.confirmPassword) return "تأكيد كلمة المرور غير مطابق";
  return null;
}

// ==================== الوثائق (لوحة المشرف) ====================

interface ExpiringDocsLike {
  summary?: { totalExpired?: number; totalExpiring?: number } | null;
  expired?: Record<string, unknown[] | undefined> | null;
  expiring?: Record<string, unknown[] | undefined> | null;
}

function countGroups(groups: Record<string, unknown[] | undefined> | null | undefined): number {
  if (!groups) return 0;
  return Object.values(groups).reduce<number>((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
}

/** عدد الوثائق المنتهية والقريبة من الانتهاء (من الملخص إن وُجد) */
export function summarizeExpiringDocuments(docs: ExpiringDocsLike | null | undefined): {
  expired: number;
  expiring: number;
} {
  if (!docs) return { expired: 0, expiring: 0 };
  return {
    expired: docs.summary?.totalExpired ?? countGroups(docs.expired),
    expiring: docs.summary?.totalExpiring ?? countGroups(docs.expiring),
  };
}

/** نص المدة المتبقية للوثيقة */
export function describeDaysLeft(days: number | null): string {
  if (days === null) return "قريباً";
  if (days < 0) return "منتهية";
  if (days === 0) return "تنتهي اليوم";
  return `${days} يوم`;
}
