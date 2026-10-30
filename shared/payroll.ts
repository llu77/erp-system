/**
 * محرك حساب الرواتب - مصدر الحقيقة الوحيد
 *
 * يُستخدم في الخادم (عند إنشاء/تحديث المسيرة) وفي الواجهة (للمعاينة الفورية)
 * حتى لا تختلف الأرقام بين ما يُعرض وما يُحفظ وما يُطبع.
 *
 * القواعد:
 * - الشهر المحاسبي = 30 يوماً
 * - الأجر اليومي = (الأساسي + الإضافي) / 30
 * - خصم الغياب = الأجر اليومي × أيام الغياب (أيام الغياب = 30 - أيام العمل)
 * - الإجازة السنوية والمرضية: مدفوعة (بدون خصم)
 * - الإجازة الطارئة: خصم 50% من الأجر اليومي
 * - الإجازة بدون راتب (أو غير محددة): خصم كامل
 * - الإجمالي = الأساسي + الإضافي + الحوافز
 * - الخصومات = غياب + إجازات + سلف + مخالفات + فواتير سالبة + خصومات أخرى
 * - الصافي = الإجمالي - الخصومات
 */

export const PAYROLL_MONTH_DAYS = 30;
export const DEFAULT_BASE_SALARY = 2000;
export const DEFAULT_OVERTIME_AMOUNT = 1000;
export const DEFAULT_SUPERVISOR_INCENTIVE = 400;

export type LeaveKind = "annual" | "sick" | "emergency" | "unpaid";

export const LEAVE_KIND_LABELS: Record<LeaveKind, string> = {
  annual: "سنوية",
  sick: "مرضية",
  emergency: "طارئة",
  unpaid: "بدون راتب",
};

/** نسبة الخصم من الأجر اليومي لكل نوع إجازة */
export const LEAVE_DEDUCTION_RATE: Record<LeaveKind, number> = {
  annual: 0,
  sick: 0,
  emergency: 0.5,
  unpaid: 1,
};

export interface PayrollLeaveInput {
  type: string | null | undefined;
  days: number;
}

export interface PayrollLineInput {
  baseSalary: number;
  overtimeEnabled: boolean;
  /** قيمة الساعات الإضافية الشهرية عند تفعيلها */
  overtimeRate: number;
  /** أيام العمل الفعلية (0-30) */
  workDays: number;
  incentiveAmount: number;
  /** خصومات أخرى يدوية (مع سبب) */
  otherDeduction: number;
  advanceDeduction: number;
  violationsDeduction: number;
  negativeInvoicesDeduction: number;
  leaves: PayrollLeaveInput[];
}

export interface PayrollLineResult {
  baseSalary: number;
  overtimeEnabled: boolean;
  overtimeAmount: number;
  dailyRate: number;
  workDays: number;
  absentDays: number;
  absentDeduction: number;
  incentiveAmount: number;
  leaveDays: number;
  paidLeaveDays: number;
  leaveDeduction: number;
  advanceDeduction: number;
  violationsDeduction: number;
  negativeInvoicesDeduction: number;
  otherDeduction: number;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
}

export interface PayrollTotals {
  totalBaseSalary: number;
  totalOvertime: number;
  totalIncentives: number;
  totalDeductions: number;
  totalNetSalary: number;
  employeeCount: number;
}

/** تقريب مالي لخانتين عشريتين (يتجنب أخطاء الفاصلة العائمة مثل 1.005) */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const sign = value < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(value) * 100 + 1e-8)) / 100;
}

/** تحويل أي قيمة (نص عشري من قاعدة البيانات أو رقم) إلى رقم آمن غير سالب */
export function toAmount(value: unknown): number {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? "0"));
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/** توحيد نوع الإجازة (عربي/إنجليزي). أي نوع غير معروف يُعامل كإجازة بدون راتب */
export function normalizeLeaveKind(raw: string | null | undefined): LeaveKind {
  const value = (raw ?? "").toString().trim().toLowerCase();
  if (!value) return "unpaid";
  if (value === "annual" || value.includes("سنوي")) return "annual";
  if (value === "sick" || value.includes("مرض")) return "sick";
  if (value === "emergency" || value.includes("طار")) return "emergency";
  return "unpaid";
}

export function clampWorkDays(workDays: unknown): number {
  const n = Math.floor(toAmount(workDays));
  return Math.min(PAYROLL_MONTH_DAYS, Math.max(0, n));
}

/** حساب سطر راتب موظف واحد */
export function calculatePayrollLine(input: PayrollLineInput): PayrollLineResult {
  const baseSalary = roundMoney(toAmount(input.baseSalary));
  const overtimeAmount = input.overtimeEnabled ? roundMoney(toAmount(input.overtimeRate)) : 0;
  const incentiveAmount = roundMoney(toAmount(input.incentiveAmount));
  const workDays = clampWorkDays(input.workDays);
  const absentDays = PAYROLL_MONTH_DAYS - workDays;
  const dailyRate = (baseSalary + overtimeAmount) / PAYROLL_MONTH_DAYS;

  const absentDeduction = roundMoney(dailyRate * absentDays);

  let leaveDays = 0;
  let paidLeaveDays = 0;
  let leaveDeductionRaw = 0;
  for (const leave of input.leaves ?? []) {
    const days = Math.max(0, Math.floor(toAmount(leave.days)));
    if (days === 0) continue;
    const kind = normalizeLeaveKind(leave.type);
    leaveDays += days;
    if (LEAVE_DEDUCTION_RATE[kind] === 0) paidLeaveDays += days;
    leaveDeductionRaw += dailyRate * days * LEAVE_DEDUCTION_RATE[kind];
  }
  const leaveDeduction = roundMoney(leaveDeductionRaw);

  const advanceDeduction = roundMoney(toAmount(input.advanceDeduction));
  const violationsDeduction = roundMoney(toAmount(input.violationsDeduction));
  const negativeInvoicesDeduction = roundMoney(toAmount(input.negativeInvoicesDeduction));
  const otherDeduction = roundMoney(toAmount(input.otherDeduction));

  const grossSalary = roundMoney(baseSalary + overtimeAmount + incentiveAmount);
  const totalDeductions = roundMoney(
    absentDeduction +
      leaveDeduction +
      advanceDeduction +
      violationsDeduction +
      negativeInvoicesDeduction +
      otherDeduction
  );
  const netSalary = roundMoney(grossSalary - totalDeductions);

  return {
    baseSalary,
    overtimeEnabled: !!input.overtimeEnabled && overtimeAmount > 0,
    overtimeAmount,
    dailyRate: roundMoney(dailyRate),
    workDays,
    absentDays,
    absentDeduction,
    incentiveAmount,
    leaveDays,
    paidLeaveDays,
    leaveDeduction,
    advanceDeduction,
    violationsDeduction,
    negativeInvoicesDeduction,
    otherDeduction,
    grossSalary,
    totalDeductions,
    netSalary,
  };
}

/** إجماليات المسيرة من الأسطر (لا تُؤخذ من الواجهة أبداً) */
export function sumPayrollTotals(
  lines: Array<Pick<PayrollLineResult, "baseSalary" | "overtimeAmount" | "incentiveAmount" | "totalDeductions" | "netSalary">>
): PayrollTotals {
  const totals = lines.reduce(
    (acc, l) => ({
      totalBaseSalary: acc.totalBaseSalary + toNumber(l.baseSalary),
      totalOvertime: acc.totalOvertime + toNumber(l.overtimeAmount),
      totalIncentives: acc.totalIncentives + toNumber(l.incentiveAmount),
      totalDeductions: acc.totalDeductions + toNumber(l.totalDeductions),
      totalNetSalary: acc.totalNetSalary + toNumber(l.netSalary),
    }),
    { totalBaseSalary: 0, totalOvertime: 0, totalIncentives: 0, totalDeductions: 0, totalNetSalary: 0 }
  );
  return {
    totalBaseSalary: roundMoney(totals.totalBaseSalary),
    totalOvertime: roundMoney(totals.totalOvertime),
    totalIncentives: roundMoney(totals.totalIncentives),
    totalDeductions: roundMoney(totals.totalDeductions),
    totalNetSalary: roundMoney(totals.totalNetSalary),
    employeeCount: lines.length,
  };
}

function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? "0"));
  return Number.isFinite(n) ? n : 0;
}

/**
 * عدد أيام تقاطع فترة (إجازة) مع شهر المسيرة، بالأيام التقويمية.
 * يعتمد على مكونات التاريخ (سنة/شهر/يوم) لتجنب انحرافات المنطقة الزمنية.
 */
export function countOverlapDays(
  start: { year: number; month: number; day: number },
  end: { year: number; month: number; day: number },
  year: number,
  month: number
): number {
  const toSerial = (d: { year: number; month: number; day: number }) =>
    Math.floor(Date.UTC(d.year, d.month - 1, d.day) / 86400000);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthStart = toSerial({ year, month, day: 1 });
  const monthEnd = toSerial({ year, month, day: lastDay });
  const s = Math.max(toSerial(start), monthStart);
  const e = Math.min(toSerial(end), monthEnd);
  if (e < s) return 0;
  // لا تتجاوز أيام الإجازة في الشهر المحاسبي 30 يوماً
  return Math.min(PAYROLL_MONTH_DAYS, e - s + 1);
}

/** الحالات المسموح الانتقال إليها لكل حالة مسيرة */
export const PAYROLL_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["pending", "cancelled"],
  pending: ["draft", "approved", "cancelled"],
  approved: ["paid", "cancelled"],
  paid: [],
  cancelled: [],
};

export function canTransitionPayroll(from: string, to: string): boolean {
  return (PAYROLL_STATUS_TRANSITIONS[from] ?? []).includes(to);
}

/** المسيرات القابلة للتعديل وإعادة الحساب */
export function isPayrollEditable(status: string): boolean {
  return status === "draft" || status === "pending";
}
