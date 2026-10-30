/**
 * مسيرة الراتب الرسمية للموظف (صفحة A4 RTL) - مشتركة بين بوابة الموظفين والنظام الرئيسي والخادم (PDF)
 * - مستند صادر من الإدارة: بلا إقرار استلام من الموظف
 * - الترويسة باسم مؤسسة فرع المسيرة (getEstablishmentForBranch) وليس فرع الموظف الحالي
 * - البيانات من لقطة سطر المسيرة وقت إصدارها (buildPayslipDocumentData)
 * - التوقيعات والختم فقط للمسيرة المعتمدة أو المصروفة، وإلا علامة مائية
 * - جميع النصوص المُدخلة من المستخدم تُهرّب قبل إدراجها في HTML
 */

import type { Establishment } from "./branding";
import { JOB_TITLE_BARBER, JOB_TITLE_SUPERVISOR, employeeJobTitle } from "./employeeFile";
import {
  LEAVE_DEDUCTION_RATE,
  LEAVE_KIND_LABELS,
  PAYROLL_MONTH_DAYS,
  normalizeLeaveKind,
  parseJsonArray,
  parseLinkedItems,
  roundMoney,
  type PayrollAdvanceItem,
  type PayrollLeaveItem,
  type PayrollNegativeInvoiceItem,
  type PayrollViolationItem,
} from "./payroll";
import {
  PAYMENT_METHOD_LABELS,
  amountToArabicWords,
  toVoucherDateString,
} from "./vouchers";
import type { VoucherTemplateAssets } from "./voucherTemplate";
import {
  arabicMonthName,
  bi,
  buildEmployeeDocContext,
  dateText,
  dateTimeText,
  daysText,
  esc,
  formatDays,
  money,
  num,
  present,
  renderDocumentShell,
  renderFooter,
  renderSigner,
  renderWatermark,
  statusClass,
  DOC_ACCENT,
  DOC_ACCENT_SOFT,
  DOC_NEGATIVE,
  type EmployeeDocContext,
} from "./employeeDocumentBase";

export interface PayslipItem {
  label: string;
  amount: number;
  date?: string | null;
  note?: string | null;
  /** للإجازات: تاريخ النهاية (YYYY-MM-DD) وعدد الأيام */
  endDate?: string | null;
  days?: number | null;
}

/** بيانات مسيرة الراتب (من لقطة المسيرة وقت إصدارها، لا من بيانات الموظف الحالية) */
export interface PayslipDocumentData {
  payrollId: number;
  payrollNumber: string;
  year: number;
  month: number;
  /** YYYY-MM-DD */
  periodStart?: string | null;
  periodEnd?: string | null;
  /** draft | pending | approved | paid | cancelled */
  status: string;
  branchId: number | null;
  branchName: string | null;
  employee: {
    id: number;
    name: string;
    code: string;
    position?: string | null;
    iqamaNumber?: string | null;
    nationality?: string | null;
    hireDate?: string | null;
    bankName?: string | null;
    iban?: string | null;
  };
  earnings: {
    baseSalary: number;
    overtimeEnabled: boolean;
    overtimeAmount: number;
    incentiveAmount: number;
    isSupervisor: boolean;
  };
  attendance: {
    workDays: number;
    absentDays: number;
    leaveDays: number;
    leaveType?: string | null;
  };
  deductions: {
    absentDeduction: number;
    leaveDeduction: number;
    advanceDeduction: number;
    violationsDeduction: number;
    negativeInvoicesDeduction: number;
    otherDeduction: number;
    otherDeductionReason?: string | null;
  };
  /** تفاصيل البنود (من لقطات JSON في سطر المسيرة) */
  items: {
    advances: PayslipItem[];
    violations: PayslipItem[];
    leaves: PayslipItem[];
    negativeInvoices: PayslipItem[];
  };
  totals: {
    grossSalary: number;
    totalDeductions: number;
    netSalary: number;
  };
  notes?: string | null;
  createdByName?: string | null;
  createdAt?: string | Date | null;
  approvedByName?: string | null;
  approvedAt?: string | Date | null;
  paidAt?: string | Date | null;
  paymentMethod?: string | null;
  paymentReference?: string | null;
}

/** خيارات قوالب مستندات الموظف (مسيرة الراتب وطلب السلفة) */
export interface EmployeeDocumentTemplateOptions {
  /** أساس روابط الصور (مثال: window.location.origin). يُتجاهل للصور المُمررة صراحةً في assets */
  assetBaseUrl?: string;
  /** صور وخط مُمررة صراحةً (data URIs في الخادم) */
  assets?: VoucherTemplateAssets;
  /** تجاوز المؤسسة (الافتراضي: مؤسسة الفرع) */
  establishment?: Establishment;
  /** سكربت طباعة تلقائية بعد التحميل */
  autoPrint?: boolean;
  /** وقت الطباعة (للاختبارات) */
  printedAt?: Date;
}

/** التوقيعات والختم: للمسيرة المعتمدة أو المصروفة فقط */
export function isPayslipSigned(status: string | null | undefined): boolean {
  return status === "approved" || status === "paid";
}

/**
 * مسمى الموظف في سطر المسيرة: المحفوظ وقت الإنشاء من حساب الموظف (حلاق / مشرف)،
 * وللسطور القديمة بمسمى آخر يُشتق من علامة المشرف في السطر
 */
function payrollLineJobTitle(detail: Pick<PayslipDetailSource, "position" | "isSupervisor">): string {
  const saved = detail.position?.trim();
  if (saved === JOB_TITLE_BARBER || saved === JOB_TITLE_SUPERVISOR) return saved;
  return employeeJobTitle(detail.isSupervisor);
}

/** اسم مستند راتب الموظف الشهري (مسير الراتب، وليس قسيمة) */
export const PAYROLL_STATEMENT_TITLE = "مسير راتب";

export const PAYSLIP_STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  pending: "تحت الإجراء",
  approved: "معتمد",
  paid: "مدفوع",
  cancelled: "ملغى",
};

export function payslipStatusLabel(status: string | null | undefined): string {
  return PAYSLIP_STATUS_LABELS[String(status ?? "")] ?? String(status ?? "-");
}

// ==================== تحويل صفوف المسيرة إلى بيانات مسيرة الراتب ====================

type Money = number | string | null | undefined;
type DateLike = Date | string | null | undefined;

/** صف المسيرة (payrolls) كما يرجعه الخادم */
export interface PayslipPayrollSource {
  id?: number;
  payrollNumber: string;
  branchId?: number | null;
  branchName?: string | null;
  year: number;
  month: number;
  periodStart?: DateLike;
  periodEnd?: DateLike;
  status: string;
  createdByName?: string | null;
  createdAt?: DateLike;
  approvedByName?: string | null;
  approvedAt?: DateLike;
  paidAt?: DateLike;
}

/** سطر الموظف في المسيرة (payrollDetails) كما يرجعه الخادم */
export interface PayslipDetailSource {
  employeeId?: number;
  employeeName: string;
  employeeCode: string;
  position?: string | null;
  baseSalary: Money;
  overtimeEnabled?: boolean | null;
  overtimeAmount: Money;
  incentiveAmount: Money;
  isSupervisor?: boolean | null;
  workDays: number | string | null | undefined;
  absentDays: number | string | null | undefined;
  absentDeduction: Money;
  leaveDays: number | string | null | undefined;
  leaveDeduction: Money;
  leaveType?: string | null;
  leaveDetails?: string | null;
  advanceDeduction: Money;
  advanceDetails?: string | null;
  violationsDeduction?: Money;
  violationsDetails?: string | null;
  negativeInvoicesDeduction: Money;
  negativeInvoicesDetails?: string | null;
  deductionAmount: Money;
  deductionReason?: string | null;
  grossSalary: Money;
  totalDeductions: Money;
  netSalary: Money;
  notes?: string | null;
  paidAt?: DateLike;
  paymentMethod?: string | null;
  paymentReference?: string | null;
}

/** بيانات الموظف الإضافية (من ملف الموظف وإعدادات الراتب الحالية) */
export interface PayslipEmployeeExtras {
  iqamaNumber?: string | null;
  nationality?: string | null;
  hireDate?: DateLike;
  bankName?: string | null;
  iban?: string | null;
}

const ymd = (value: DateLike): string | null =>
  toVoucherDateString(value ?? null);
const text = (value: unknown): string | null => present(value);

/**
 * بيانات مسيرة الراتب من صف المسيرة وسطر الموظف (الأرقام كما حُفظت، بدون إعادة حساب)
 * - تفاصيل السلف والمخالفات والإجازات والفواتير من لقطات JSON في السطر
 * - مبلغ كل إجازة = أجر اليوم × الأيام × نسبة خصم نوعها (للعرض؛ الإجمالي من السطر)
 */
export function buildPayslipDocumentData(
  payroll: PayslipPayrollSource,
  detail: PayslipDetailSource,
  extras: PayslipEmployeeExtras = {}
): PayslipDocumentData {
  const baseSalary = roundMoney(num(detail.baseSalary));
  const overtimeAmount = roundMoney(num(detail.overtimeAmount));
  const dailyRate = (baseSalary + overtimeAmount) / PAYROLL_MONTH_DAYS;

  const advances = parseLinkedItems<PayrollAdvanceItem>(
    detail.advanceDetails
  ).items.map(
    (a): PayslipItem => ({
      label: text(a?.title) ?? "سلفة",
      amount: roundMoney(num(a?.amount)),
      date: ymd(a?.approvedAt),
      note: null,
    })
  );
  const violations = parseLinkedItems<PayrollViolationItem>(
    detail.violationsDetails
  ).items.map(
    (v): PayslipItem => ({
      label: text(v?.violationType) ?? "مخالفة",
      amount: roundMoney(num(v?.amount)),
      date: ymd(v?.violationDate),
      note: text(v?.description),
    })
  );
  const leaves = parseJsonArray<PayrollLeaveItem>(detail.leaveDetails).map(
    (l): PayslipItem => {
      const kind = normalizeLeaveKind(l?.kind ?? l?.type);
      const days = Math.max(0, Math.floor(num(l?.days)));
      return {
        label: `إجازة ${LEAVE_KIND_LABELS[kind]}`,
        amount: roundMoney(dailyRate * days * LEAVE_DEDUCTION_RATE[kind]),
        date: ymd(l?.startDate),
        endDate: ymd(l?.endDate),
        days,
        note:
          LEAVE_DEDUCTION_RATE[kind] === 0
            ? "مدفوعة"
            : LEAVE_DEDUCTION_RATE[kind] < 1
              ? "خصم نصف أجر اليوم"
              : "بدون راتب",
      };
    }
  );
  const negativeInvoices = parseJsonArray<PayrollNegativeInvoiceItem>(
    detail.negativeInvoicesDetails
  ).map(
    (i): PayslipItem => ({
      label: text(i?.invoiceNumber)
        ? `فاتورة ${text(i?.invoiceNumber)}`
        : "فاتورة سالبة",
      amount: roundMoney(num(i?.amount)),
      date: ymd(i?.invoiceDate),
      note: text(i?.reason),
    })
  );

  return {
    payrollId: payroll.id ?? 0,
    payrollNumber: payroll.payrollNumber,
    year: payroll.year,
    month: payroll.month,
    periodStart: ymd(payroll.periodStart),
    periodEnd: ymd(payroll.periodEnd),
    status: String(payroll.status || "draft"),
    branchId: payroll.branchId ?? null,
    branchName: text(payroll.branchName),
    employee: {
      id: detail.employeeId ?? 0,
      name: detail.employeeName,
      code: detail.employeeCode,
      // المسمى الثابت المحفوظ في السطر من حساب الموظف (حلاق / مشرف)
      position: payrollLineJobTitle(detail),
      iqamaNumber: text(extras.iqamaNumber),
      nationality: text(extras.nationality),
      hireDate: ymd(extras.hireDate),
      bankName: text(extras.bankName),
      iban: text(extras.iban),
    },
    earnings: {
      baseSalary,
      overtimeEnabled: !!detail.overtimeEnabled && overtimeAmount > 0,
      overtimeAmount,
      incentiveAmount: roundMoney(num(detail.incentiveAmount)),
      isSupervisor: !!detail.isSupervisor,
    },
    attendance: {
      workDays: num(detail.workDays),
      absentDays: num(detail.absentDays),
      leaveDays: num(detail.leaveDays),
      leaveType: text(detail.leaveType),
    },
    deductions: {
      absentDeduction: roundMoney(num(detail.absentDeduction)),
      leaveDeduction: roundMoney(num(detail.leaveDeduction)),
      advanceDeduction: roundMoney(num(detail.advanceDeduction)),
      violationsDeduction: roundMoney(num(detail.violationsDeduction)),
      negativeInvoicesDeduction: roundMoney(
        num(detail.negativeInvoicesDeduction)
      ),
      otherDeduction: roundMoney(num(detail.deductionAmount)),
      otherDeductionReason: text(detail.deductionReason),
    },
    items: { advances, violations, leaves, negativeInvoices },
    totals: {
      grossSalary: roundMoney(num(detail.grossSalary)),
      totalDeductions: roundMoney(num(detail.totalDeductions)),
      netSalary: roundMoney(num(detail.netSalary)),
    },
    notes: text(detail.notes),
    createdByName: text(payroll.createdByName),
    createdAt: payroll.createdAt ?? null,
    approvedByName: text(payroll.approvedByName),
    approvedAt: payroll.approvedAt ?? null,
    paidAt: detail.paidAt ?? payroll.paidAt ?? null,
    paymentMethod: text(detail.paymentMethod),
    paymentReference: text(detail.paymentReference),
  };
}

// ==================== القالب ====================

function cell(label: string, value: unknown, cls = ""): string {
  const v = present(value);
  return `<div class="cell${cls ? ` ${cls}` : ""}"><div class="lbl">${label}</div><div class="val">${v ? esc(v) : "-"}</div></div>`;
}

/** تفاصيل البنود داخل خلية الحساب: • العنوان — التاريخ — ملاحظة — المبلغ */
function itemLines(items: PayslipItem[], withAmount = true): string {
  return items
    .map(item => {
      const parts = [`<b>${esc(item.label)}</b>`];
      if (item.date && item.endDate)
        parts.push(
          `من ${esc(dateText(item.date))} إلى ${esc(dateText(item.endDate))}`
        );
      else if (item.date) parts.push(esc(dateText(item.date)));
      if (item.days !== null && item.days !== undefined)
        parts.push(daysText(item.days));
      if (present(item.note)) parts.push(esc(present(item.note)));
      const amount = withAmount
        ? ` <span class="ltr item-amt">${money(item.amount)}</span>`
        : "";
      return `<div class="sub-item">&#8226; ${parts.join(" &nbsp;&#8212;&nbsp; ")}${amount}</div>`;
    })
    .join("");
}

function row(
  label: string,
  calc: string,
  amount: number,
  negative = false
): string {
  return `
          <tr>
            <td>${label}</td>
            <td class="calc">${calc || "-"}</td>
            <td class="amt">${negative && amount > 0 ? "-" : ""}${money(amount)}</td>
          </tr>`;
}

function renderEmployee(data: PayslipDocumentData): string {
  const e = data.employee;
  const cells = [
    cell("اسم الموظف", e.name, "span2 strong"),
    cell("الرقم الوظيفي", e.code),
    cell("المسمى الوظيفي", e.position),
    cell("الفرع", data.branchName),
    cell("رقم الإقامة / الهوية", e.iqamaNumber),
    cell("الجنسية", e.nationality),
    cell("تاريخ المباشرة", e.hireDate ? dateText(e.hireDate) : null),
  ];
  const bank = present(e.bankName);
  const iban = present(e.iban);
  if (bank || iban) {
    cells.push(cell("البنك", bank));
    cells.push(
      `<div class="cell span3"><div class="lbl">الآيبان (IBAN)</div><div class="val ltr iban">${iban ? esc(iban) : "-"}</div></div>`
    );
  }
  return `
    <section class="sec">
      <div class="sec-title">${bi("بيانات الموظف", "Employee Details")}</div>
      <div class="grid">${cells.join("")}</div>
    </section>`;
}

function renderAttendance(data: PayslipDocumentData): string {
  const a = data.attendance;
  const dailyRate =
    (data.earnings.baseSalary + data.earnings.overtimeAmount) /
    PAYROLL_MONTH_DAYS;
  const leaveType = present(a.leaveType);
  return `
    <section class="sec basis">
      <div class="basis-title">${bi("الحضور", "Attendance")}</div>
      <div class="basis-item"><span class="lbl">أيام الشهر</span> <b>${PAYROLL_MONTH_DAYS}</b></div>
      <div class="basis-item main"><span class="lbl">أيام العمل</span> <b>${formatDays(a.workDays)}</b></div>
      <div class="basis-item"><span class="lbl">الغياب</span> <b>${formatDays(a.absentDays)}</b></div>
      <div class="basis-item"><span class="lbl">الإجازات${leaveType ? ` (${esc(leaveType)})` : ""}</span> <b>${formatDays(a.leaveDays)}</b></div>
      <div class="basis-item"><span class="lbl">أجر اليوم</span> <b>${money(dailyRate)}</b></div>
    </section>`;
}

function renderEarnings(data: PayslipDocumentData): string {
  const e = data.earnings;
  let rows = row("الراتب الأساسي", "الراتب الشهري حسب العقد", e.baseSalary);
  if (e.overtimeAmount > 0)
    rows += row("بدل ساعات إضافية", "بدل شهري ثابت", e.overtimeAmount);
  if (e.incentiveAmount > 0)
    rows += row(
      "الحوافز",
      e.isSupervisor ? "حافز الإشراف" : "حوافز الشهر",
      e.incentiveAmount
    );
  return `
    <section class="sec">
      <table class="fin">
        <thead>
          <tr>
            <th class="col-item">${bi("المستحقات", "Earnings")}</th>
            <th class="col-calc">${bi("البيان", "Details")}</th>
            <th class="col-amt">${bi("المبلغ", "SAR")}</th>
          </tr>
        </thead>
        <tbody>${rows}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2">إجمالي المستحقات</td>
            <td class="amt">${money(data.totals.grossSalary)}</td>
          </tr>
        </tfoot>
      </table>
    </section>`;
}

function renderDeductions(data: PayslipDocumentData): string {
  const d = data.deductions;
  const a = data.attendance;
  const it = data.items;
  const dailyRate =
    (data.earnings.baseSalary + data.earnings.overtimeAmount) /
    PAYROLL_MONTH_DAYS;
  let rows = "";
  if (d.absentDeduction > 0 || a.absentDays > 0) {
    rows += row(
      "خصم الغياب",
      `${formatDays(a.absentDays)} يوم × ${money(dailyRate)} (أجر اليوم)`,
      d.absentDeduction,
      true
    );
  }
  if (a.leaveDays > 0 || d.leaveDeduction > 0) {
    const calc =
      it.leaves.length > 0
        ? itemLines(it.leaves, false)
        : `${daysText(a.leaveDays)}${present(a.leaveType) ? ` (${esc(present(a.leaveType))})` : ""}`;
    rows += row(
      `الإجازات (${daysText(a.leaveDays)})`,
      calc,
      d.leaveDeduction,
      true
    );
  }
  if (d.advanceDeduction > 0 || it.advances.length > 0) {
    rows += row(
      `<span class="tag">سلف</span> السلف المستردة`,
      itemLines(it.advances),
      d.advanceDeduction,
      true
    );
  }
  if (d.violationsDeduction > 0 || it.violations.length > 0) {
    rows += row(
      `<span class="tag">مخالفات</span> المخالفات`,
      itemLines(it.violations),
      d.violationsDeduction,
      true
    );
  }
  if (d.negativeInvoicesDeduction > 0 || it.negativeInvoices.length > 0) {
    rows += row(
      "الفواتير السالبة",
      itemLines(it.negativeInvoices),
      d.negativeInvoicesDeduction,
      true
    );
  }
  if (d.otherDeduction > 0) {
    rows += row(
      "خصومات أخرى",
      present(d.otherDeductionReason)
        ? esc(present(d.otherDeductionReason))
        : "-",
      d.otherDeduction,
      true
    );
  }
  if (!rows) {
    rows = `
          <tr>
            <td colspan="3" class="empty">لا توجد خصومات</td>
          </tr>`;
  }
  return `
    <section class="sec">
      <table class="fin">
        <thead>
          <tr>
            <th class="col-item">${bi("الخصومات", "Deductions")}</th>
            <th class="col-calc">${bi("التفاصيل والتاريخ", "Details")}</th>
            <th class="col-amt">${bi("المبلغ", "SAR")}</th>
          </tr>
        </thead>
        <tbody>${rows}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2">إجمالي الخصومات</td>
            <td class="amt">${data.totals.totalDeductions > 0 ? "-" : ""}${money(data.totals.totalDeductions)}</td>
          </tr>
        </tfoot>
      </table>
    </section>`;
}

function renderNet(data: PayslipDocumentData): string {
  const net = data.totals.netSalary;
  const negative = net < 0;
  return `
    <div class="net${negative ? " negative" : ""}">
      <div class="net-lbl">${negative ? "صافي المستحق على الموظف" : "صافي الراتب المستحق"}</div>
      <div class="net-val"><span class="ltr">${money(Math.abs(net))}</span><small>ريال سعودي</small></div>
      <div class="net-words">${esc(amountToArabicWords(Math.abs(net)))}</div>
    </div>`;
}

function paymentMethodText(code: string | null | undefined): string | null {
  const c = present(code);
  if (!c) return null;
  return PAYMENT_METHOD_LABELS[c]?.ar ?? c;
}

function renderApproval(
  ctx: EmployeeDocContext,
  data: PayslipDocumentData
): string {
  if (ctx.cancelled)
    return `<div class="alert-box"><b>المسير ملغى</b> - هذا المستند غير صالح للاستخدام.</div>`;
  if (!ctx.signed)
    return `<div class="pending-note">بانتظار اعتماد المسير - لا يُعد هذا المستند رسمياً قبل الاعتماد</div>`;
  const approvedBy = present(data.approvedByName);
  let note = `&#10004; اعتُمد المسير${approvedBy ? ` بواسطة ${esc(approvedBy)}` : ""}${data.approvedAt ? ` بتاريخ ${esc(dateTimeText(data.approvedAt))}` : ""}`;
  if (ctx.status === "paid") {
    const method = paymentMethodText(data.paymentMethod);
    const reference = present(data.paymentReference);
    note += ` &nbsp;|&nbsp; تم صرف الراتب${data.paidAt ? ` بتاريخ ${esc(dateTimeText(data.paidAt))}` : ""}${method ? ` (${esc(method)})` : ""}${reference ? ` - المرجع: <span class="ltr">${esc(reference)}</span>` : ""}`;
  }
  return `<div class="approval-note">${note}</div>`;
}

function renderSignatures(
  ctx: EmployeeDocContext,
  data: PayslipDocumentData
): string {
  const pendingText = ctx.cancelled ? "ملغى" : "بانتظار الاعتماد";
  const preparedBy = `
      <div class="sig sig-prepared">
        <div class="sig-title">${bi("أعدّه", "Prepared By")}</div>
        <div class="sig-area"></div>
        <div class="sig-line"></div>
        <div class="sig-name">${present(data.createdByName) ? esc(present(data.createdByName)) : "&nbsp;"}</div>
        <div class="sig-name-en">${data.createdAt ? esc(dateTimeText(data.createdAt)) : "&nbsp;"}</div>
      </div>`;
  return `
    <section class="sign-row">
      ${preparedBy}
      ${renderSigner(ctx, "supervisor", false, pendingText)}
      ${renderSigner(ctx, "manager", true, pendingText)}
    </section>`;
}

/** مسير راتب الموظف (HTML كامل، صفحة A4 واحدة للحالات المعتادة) */
export function renderPayslipHtml(
  data: PayslipDocumentData,
  options: EmployeeDocumentTemplateOptions = {}
): string {
  const status = String(data.status || "draft");
  const ctx = buildEmployeeDocContext(
    data.branchName,
    status,
    isPayslipSigned(status),
    options
  );
  const monthYear = `${arabicMonthName(data.month)} ${data.year}`;
  const periodText = `شهر ${monthYear}`;
  const range =
    data.periodStart && data.periodEnd
      ? `${dateText(data.periodStart)} - ${dateText(data.periodEnd)}`
      : `${String(data.month).padStart(2, "0")}/${data.year}`;

  const watermark = ctx.cancelled
    ? renderWatermark("ملغى", "cancelled")
    : !ctx.signed
      ? renderWatermark("مسودة - غير معتمد", "draft")
      : "";

  const notes = present(data.notes)
    ? `<div class="notes"><b>ملاحظات:</b> <span class="user-text">${esc(present(data.notes))}</span></div>`
    : "";

  const body = `
    <div class="title-row">
      <div class="info-box">
        <div class="lbl">${bi("رقم المسير", "Payroll No.")}</div>
        <div class="val ltr">${esc(data.payrollNumber)}</div>
      </div>
      <div class="doc-title">
        <h1>${PAYROLL_STATEMENT_TITLE}</h1>
        <h2>PAYROLL STATEMENT</h2>
        <div class="period">${esc(periodText)}</div>
      </div>
      <div class="info-box">
        <div class="lbl">${bi("الفترة", "Period")}</div>
        <div class="val ltr small">${esc(range)}</div>
        <div class="badge-wrap"><span class="status-badge status-${statusClass(status)}">${esc(payslipStatusLabel(status))}</span></div>
      </div>
    </div>

    ${renderEmployee(data)}
    ${renderAttendance(data)}
    ${renderEarnings(data)}
    ${renderDeductions(data)}
    ${renderNet(data)}
    ${notes}
    <div class="closing-block">
      ${renderApproval(ctx, data)}
      ${renderSignatures(ctx, data)}
    </div>`;

  return renderDocumentShell({
    ctx,
    title: `${PAYROLL_STATEMENT_TITLE} - ${data.employee.name} - ${monthYear}`,
    kind: "payslip",
    watermark,
    body,
    footer: renderFooter(ctx, PAYROLL_STATEMENT_TITLE, "رقم المسير", data.payrollNumber),
    extraCss: PAYSLIP_STYLES,
    autoPrint: options.autoPrint,
  });
}

const PAYSLIP_STYLES = `
  .info-box .val.small { font-size: 11px; padding-top: 3px; }
  .iban { letter-spacing: 0.6px; text-align: right; }
  .basis { display: flex; align-items: stretch; border: 1px solid #cfd6df; border-radius: 4px; overflow: hidden; background: ${DOC_ACCENT_SOFT}; }
  .basis-title { background: ${DOC_ACCENT}; color: #fff; font-weight: 700; font-size: 11px; padding: 3px 10px; display: flex; align-items: center; gap: 2px; white-space: nowrap; }
  .basis-title .en, .basis-title .sep { color: #dbe3ee; }
  .basis-item { flex: 1; display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 3px 8px; border-left: 1px solid #cfd6df; font-size: 11px; white-space: nowrap; }
  .basis-item:last-child { border-left: none; }
  .basis-item .lbl { font-size: 9.5px; color: #5b6573; }
  .basis-item.main b { color: ${DOC_ACCENT}; }
  .sub-item { font-size: 10px; color: #333; line-height: 1.45; }
  .sub-item b { font-weight: 700; }
  .sub-item .item-amt { color: #5b6573; font-weight: 600; margin-inline-start: 4px; }
  .net { display: flex; align-items: stretch; border: 2px solid ${DOC_ACCENT}; border-radius: 6px; overflow: hidden; margin: 6px 0; break-inside: avoid; page-break-inside: avoid; }
  .net-lbl { background: ${DOC_ACCENT}; color: #fff; font-size: 12.5px; font-weight: 700; padding: 5px 12px; display: flex; align-items: center; white-space: nowrap; }
  .net-val { font-size: 18px; font-weight: 700; padding: 3px 12px; white-space: nowrap; display: flex; align-items: center; gap: 5px; border-left: 1px solid #cfd6df; }
  .net-val small { font-size: 10px; font-weight: 600; color: #5b6573; }
  .net-words { flex: 1; padding: 4px 12px; font-size: 11px; font-weight: 600; display: flex; align-items: center; background: ${DOC_ACCENT_SOFT}; }
  .net.negative { border-color: ${DOC_NEGATIVE}; }
  .net.negative .net-lbl { background: ${DOC_NEGATIVE}; }
  .net.negative .net-val { color: ${DOC_NEGATIVE}; }
  .closing-block { break-inside: avoid; page-break-inside: avoid; }
`;
