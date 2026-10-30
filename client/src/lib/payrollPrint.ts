/**
 * قوالب طباعة مسيرات الرواتب وقسائم الرواتب
 *
 * - تُبنى من القيم المحفوظة في الخادم فقط (لا إعادة حساب في الواجهة)
 * - كل مكوّن خصم له عمود/سطر مستقل حتى يطابق (الإجمالي - الخصومات = الصافي)
 * - التوقيعات والختم تظهر فقط بعد الاعتماد (معتمدة / مدفوعة)
 */
import { SIGNATURES, COMPANY_INFO } from "@/utils/pdfTemplates";
import {
  parseLinkedItems,
  parseJsonArray,
  LEAVE_KIND_LABELS,
  type PayrollAdvanceItem,
  type PayrollViolationItem,
  type PayrollLeaveItem,
  type PayrollNegativeInvoiceItem,
} from "@shared/payroll";
import { amountToArabicWords } from "@shared/vouchers";

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  pending: "تحت الإجراء",
  approved: "معتمدة",
  paid: "مدفوعة",
  cancelled: "ملغاة",
};

export interface PrintablePayroll {
  payrollNumber: string;
  branchName: string;
  year: number;
  month: number;
  status: string;
  createdAt: Date | string;
  createdByName?: string | null;
  approvedByName?: string | null;
  approvedAt?: Date | string | null;
  paidAt?: Date | string | null;
}

export interface PrintableDetail {
  employeeName: string;
  employeeCode: string;
  position?: string | null;
  baseSalary: string | number;
  overtimeAmount: string | number;
  overtimeEnabled?: boolean;
  incentiveAmount: string | number;
  workDays: number;
  absentDays: number;
  absentDeduction: string | number;
  leaveDays: number;
  leaveDeduction: string | number;
  leaveType?: string | null;
  leaveDetails?: string | null;
  advanceDeduction: string | number;
  advanceDetails?: string | null;
  violationsDeduction?: string | number | null;
  violationsDetails?: string | null;
  negativeInvoicesDeduction: string | number;
  negativeInvoicesDetails?: string | null;
  deductionAmount: string | number;
  deductionReason?: string | null;
  grossSalary: string | number;
  totalDeductions: string | number;
  netSalary: string | number;
  notes?: string | null;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"));
  return Number.isFinite(n) ? n : 0;
};

const money = (v: unknown) =>
  num(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const cell = (v: unknown, negative = false) => (num(v) !== 0 ? `${negative ? "-" : ""}${money(v)}` : "—");

const fmtDate = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("ar-SA-u-ca-gregory", { year: "numeric", month: "2-digit", day: "2-digit" }) : "—";

/** الصافي كتابةً: الصافي السالب يُكتب كمبلغ مستحق على الموظف وليس كمبلغ مستحق له */
function netInWords(net: number): string {
  if (net < 0) return `لا يوجد صافي مستحق للموظف — مستحق على الموظف: ${amountToArabicWords(Math.abs(net))}`;
  return amountToArabicWords(net);
}

export function isPayrollApproved(status: string): boolean {
  return status === "approved" || status === "paid";
}

/** فتح نافذة الطباعة (يجب استدعاؤها مباشرة من حدث النقر لتجنب حظر النوافذ) */
export function openPrintWindow(): Window | null {
  return window.open("", "_blank");
}

export function writeAndPrint(win: Window, html: string) {
  win.document.open();
  win.document.write(html);
  win.document.close();
  const trigger = () => setTimeout(() => win.print(), 350);
  if (win.document.readyState === "complete") trigger();
  else win.onload = trigger;
}

const BASE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'Tajawal', 'Segoe UI', Tahoma, sans-serif; color: #111; background: #fff; font-size: 12px; }
  .doc { position: relative; padding: 18px 22px; }
  .watermark { position: fixed; top: 45%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 110px;
    font-weight: 900; color: rgba(0,0,0,0.05); white-space: nowrap; pointer-events: none; z-index: 0; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px double #111; padding-bottom: 10px; margin-bottom: 12px; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand img { height: 54px; }
  .brand .name { font-size: 18px; font-weight: 900; }
  .brand .sub { font-size: 11px; color: #444; }
  .title { text-align: center; }
  .title h1 { font-size: 20px; font-weight: 900; letter-spacing: 1px; }
  .title .en { font-size: 11px; color: #555; letter-spacing: 2px; text-transform: uppercase; }
  .meta { text-align: left; font-size: 11px; line-height: 1.7; }
  .meta b { display: inline-block; min-width: 70px; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 10px; font-weight: 700; font-size: 11px; border: 1px solid #111; }
  .badge.ok { background: #111; color: #fff; }
  .info { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid #111; margin-bottom: 12px; }
  .info div { padding: 6px 8px; border-left: 1px solid #ccc; }
  .info div:last-child { border-left: none; }
  .info label { display: block; font-size: 10px; color: #555; }
  .info span { font-size: 13px; font-weight: 800; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #111; color: #fff; font-weight: 700; padding: 6px 4px; font-size: 10.5px; border: 1px solid #111; }
  td { border: 1px solid #bbb; padding: 5px 4px; text-align: center; font-size: 11px; font-weight: 600; }
  tr:nth-child(even) td { background: #f6f6f6; }
  td.name { text-align: right; font-weight: 800; }
  td.net { font-weight: 900; font-size: 12px; background: #eef7ee !important; }
  tfoot td { background: #111 !important; color: #fff; font-weight: 900; }
  .sub-note { display: block; font-size: 9px; color: #666; font-weight: 500; }
  .signatures { display: grid; grid-template-columns: 1fr 150px 1fr; gap: 16px; margin-top: 18px; align-items: end; }
  .sig { border: 1px solid #ccc; border-radius: 6px; padding: 8px; text-align: center; min-height: 120px; }
  .sig .t { font-size: 10px; color: #555; font-weight: 700; }
  .sig .img { height: 64px; display: flex; align-items: center; justify-content: center; }
  .sig .img img { max-height: 64px; max-width: 150px; object-fit: contain; }
  .sig .wait { color: #999; font-size: 10px; }
  .sig .line { border-top: 1px solid #333; margin-top: 4px; padding-top: 4px; font-weight: 800; font-size: 12px; }
  .sig .role { font-size: 10px; color: #555; }
  .stamp { text-align: center; }
  .stamp img { width: 130px; height: 130px; object-fit: contain; opacity: .92; }
  .stamp .ph { width: 110px; height: 110px; border: 2px dashed #ccc; border-radius: 50%; margin: 0 auto; display: flex; align-items: center; justify-content: center; color: #aaa; font-size: 10px; }
  .footer { margin-top: 14px; border-top: 1px dashed #bbb; padding-top: 6px; display: flex; justify-content: space-between; font-size: 9.5px; color: #666; }
  @page { margin: 8mm; }
`;

function signaturesBlock(approved: boolean, approvedByName?: string | null, approvedAt?: Date | string | null) {
  const sigBox = (title: string, s: { name: string; title: string; image: string }) => `
    <div class="sig">
      <div class="t">${escapeHtml(title)}</div>
      <div class="img">${
        approved
          ? `<img src="${s.image}" alt="${escapeHtml(s.name)}" onerror="this.outerHTML='<span>✓ موقّع</span>'" />`
          : `<span class="wait">بانتظار الاعتماد</span>`
      }</div>
      <div class="line">${escapeHtml(s.name)}</div>
      <div class="role">${escapeHtml(s.title)}</div>
    </div>`;
  return `
    <div class="signatures">
      ${sigBox("اعتماد المشرف العام", SIGNATURES.supervisor)}
      <div class="stamp">
        ${approved ? `<img src="${SIGNATURES.stamp.image}" alt="ختم الإدارة" onerror="this.style.display='none'" />` : `<div class="ph">الختم بعد الاعتماد</div>`}
        <div class="role" style="font-size:10px;color:#555;margin-top:4px">${escapeHtml(SIGNATURES.stamp.label)}</div>
        ${approved && approvedByName ? `<div style="font-size:9.5px;color:#333;margin-top:2px">اعتمدها: ${escapeHtml(approvedByName)} — ${fmtDate(approvedAt)}</div>` : ""}
      </div>
      ${sigBox("اعتماد المدير العام", SIGNATURES.manager)}
    </div>`;
}

function headerBlock(titleAr: string, titleEn: string, payroll: PrintablePayroll) {
  const approved = isPayrollApproved(payroll.status);
  return `
    <div class="header">
      <div class="brand">
        <img src="${COMPANY_INFO.logo}" alt="logo" onerror="this.style.display='none'" />
        <div><div class="name">${escapeHtml(COMPANY_INFO.name)}</div><div class="sub">${escapeHtml(COMPANY_INFO.subtitle)}</div></div>
      </div>
      <div class="title"><h1>${escapeHtml(titleAr)}</h1><div class="en">${escapeHtml(titleEn)}</div></div>
      <div class="meta">
        <div><b>رقم المسيرة:</b> ${escapeHtml(payroll.payrollNumber)}</div>
        <div><b>الفترة:</b> ${ARABIC_MONTHS[payroll.month - 1]} ${payroll.year}</div>
        <div><b>الحالة:</b> <span class="badge ${approved ? "ok" : ""}">${STATUS_LABELS[payroll.status] ?? payroll.status}</span></div>
      </div>
    </div>`;
}

function watermark(status: string) {
  if (status === "cancelled") return `<div class="watermark">ملغاة</div>`;
  if (!isPayrollApproved(status)) return `<div class="watermark">مسودة</div>`;
  return "";
}

function footer() {
  const now = new Date();
  return `<div class="footer"><span>${escapeHtml(COMPANY_INFO.name)} - ${escapeHtml(COMPANY_INFO.subtitle)}</span><span>طُبعت في ${now.toLocaleDateString("ar-SA-u-ca-gregory")} ${now.toLocaleTimeString("ar-SA")}</span></div>`;
}

/** مسيرة الرواتب الكاملة (أفقي A4) */
export function buildPayrollSheetHtml(payroll: PrintablePayroll, details: PrintableDetail[]): string {
  const approved = isPayrollApproved(payroll.status);
  const sum = (key: keyof PrintableDetail) => details.reduce((s, d) => s + num(d[key]), 0);

  const rows = details
    .map((d, i) => {
      const leaveNote = num(d.leaveDays) > 0 ? `<span class="sub-note">${d.leaveDays} يوم ${escapeHtml(d.leaveType || "")}</span>` : "";
      const absentNote = num(d.absentDays) > 0 ? `<span class="sub-note">${d.absentDays} يوم</span>` : "";
      const otherNote = d.deductionReason ? `<span class="sub-note">${escapeHtml(d.deductionReason)}</span>` : "";
      return `<tr>
        <td>${i + 1}</td>
        <td class="name">${escapeHtml(d.employeeName)}<span class="sub-note">${escapeHtml(d.employeeCode)}${d.position ? " - " + escapeHtml(d.position) : ""}</span></td>
        <td>${money(d.baseSalary)}</td>
        <td>${cell(d.overtimeAmount)}</td>
        <td>${cell(d.incentiveAmount)}</td>
        <td><b>${money(d.grossSalary)}</b></td>
        <td>${d.workDays}</td>
        <td>${cell(d.absentDeduction, true)}${absentNote}</td>
        <td>${cell(d.leaveDeduction, true)}${leaveNote}</td>
        <td>${cell(d.advanceDeduction, true)}</td>
        <td>${cell(d.violationsDeduction, true)}</td>
        <td>${cell(d.negativeInvoicesDeduction, true)}</td>
        <td>${cell(d.deductionAmount, true)}${otherNote}</td>
        <td><b>${cell(d.totalDeductions, true)}</b></td>
        <td class="net">${money(d.netSalary)}</td>
        <td style="min-width:70px"></td>
      </tr>`;
    })
    .join("");

  const totalNet = sum("netSalary");

  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8" />
<title>مسيرة رواتب ${escapeHtml(payroll.branchName)} - ${ARABIC_MONTHS[payroll.month - 1]} ${payroll.year}</title>
<style>${BASE_STYLES} @page { size: A4 landscape; margin: 7mm; }</style></head><body>
${watermark(payroll.status)}
<div class="doc">
  ${headerBlock("مسيرة رواتب الموظفين", "Monthly Payroll Sheet", payroll)}
  <div class="info">
    <div><label>الفرع</label><span>${escapeHtml(payroll.branchName)}</span></div>
    <div><label>عدد الموظفين</label><span>${details.length}</span></div>
    <div><label>أُعدت بواسطة</label><span>${escapeHtml(payroll.createdByName || "—")} — ${fmtDate(payroll.createdAt)}</span></div>
    <div><label>صافي المسيرة</label><span>${money(totalNet)} ر.س</span></div>
  </div>
  <table>
    <thead><tr>
      <th>#</th><th>الموظف</th><th>الأساسي</th><th>الإضافي</th><th>الحوافز</th><th>الإجمالي</th><th>أيام العمل</th>
      <th>الغياب</th><th>الإجازات</th><th>السلف</th><th>المخالفات</th><th>فواتير سالبة</th><th>خصومات أخرى</th>
      <th>إجمالي الخصومات</th><th>الصافي</th><th>توقيع الموظف</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr>
      <td colspan="2">الإجمالي</td>
      <td>${money(sum("baseSalary"))}</td><td>${money(sum("overtimeAmount"))}</td><td>${money(sum("incentiveAmount"))}</td>
      <td>${money(sum("grossSalary"))}</td><td>—</td>
      <td>${money(sum("absentDeduction"))}</td><td>${money(sum("leaveDeduction"))}</td><td>${money(sum("advanceDeduction"))}</td>
      <td>${money(sum("violationsDeduction"))}</td><td>${money(sum("negativeInvoicesDeduction"))}</td><td>${money(sum("deductionAmount"))}</td>
      <td>${money(sum("totalDeductions"))}</td><td>${money(totalNet)}</td><td></td>
    </tr></tfoot>
  </table>
  <div style="margin-top:8px;font-size:11px;font-weight:700">صافي المسيرة كتابةً: ${escapeHtml(netInWords(totalNet))}</div>
  ${signaturesBlock(approved, payroll.approvedByName, payroll.approvedAt)}
  ${footer()}
</div></body></html>`;
}

/** قسيمة راتب موظف (عمودي A4) */
export function buildPayslipHtml(payroll: PrintablePayroll, d: PrintableDetail): string {
  const approved = isPayrollApproved(payroll.status);
  const advances = parseLinkedItems<PayrollAdvanceItem>(d.advanceDetails).items;
  const violations = parseLinkedItems<PayrollViolationItem>(d.violationsDetails).items;
  const leaves = parseJsonArray<PayrollLeaveItem>(d.leaveDetails);
  const invoices = parseJsonArray<PayrollNegativeInvoiceItem>(d.negativeInvoicesDetails);

  const row = (label: string, value: unknown, negative = false, note = "") =>
    `<tr><td class="name">${escapeHtml(label)}${note ? `<span class="sub-note">${note}</span>` : ""}</td><td style="width:140px">${negative ? "-" : ""}${money(value)} ر.س</td></tr>`;

  const earnings = [
    row("الراتب الأساسي", d.baseSalary),
    num(d.overtimeAmount) > 0 ? row("بدل ساعات إضافية", d.overtimeAmount) : "",
    num(d.incentiveAmount) > 0 ? row("حوافز", d.incentiveAmount) : "",
  ].join("");

  const deductions = [
    num(d.absentDeduction) > 0 ? row(`خصم غياب (${d.absentDays} يوم)`, d.absentDeduction, true) : "",
    num(d.leaveDays) > 0
      ? row(
          `إجازات (${d.leaveDays} يوم)`,
          d.leaveDeduction,
          true,
          leaves.map(l => `${escapeHtml(LEAVE_KIND_LABELS[l.kind] ?? l.type)}: ${l.days} يوم (${escapeHtml(l.startDate)} → ${escapeHtml(l.endDate)})`).join(" | ")
        )
      : "",
    num(d.advanceDeduction) > 0
      ? row("سلف مستردة", d.advanceDeduction, true, advances.map(a => `${escapeHtml(a.title)}: ${money(a.amount)}`).join(" | "))
      : "",
    num(d.violationsDeduction) > 0
      ? row("مخالفات", d.violationsDeduction, true, violations.map(v => `${escapeHtml(v.violationType)} (${escapeHtml(v.violationDate)}): ${money(v.amount)}`).join(" | "))
      : "",
    num(d.negativeInvoicesDeduction) > 0
      ? row("فواتير سالبة", d.negativeInvoicesDeduction, true, invoices.map(i => `${escapeHtml(i.invoiceNumber)}: ${money(i.amount)}${i.reason ? " - " + escapeHtml(i.reason) : ""}`).join(" | "))
      : "",
    num(d.deductionAmount) > 0 ? row("خصومات أخرى", d.deductionAmount, true, escapeHtml(d.deductionReason || "")) : "",
  ].join("");

  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8" />
<title>قسيمة راتب - ${escapeHtml(d.employeeName)}</title>
<style>${BASE_STYLES} @page { size: A4 portrait; margin: 10mm; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px; }
  .box h3 { font-size: 13px; padding: 6px 8px; background: #111; color: #fff; }
  .box table td { text-align: left; }
  .box table td.name { text-align: right; }
  .box .total td { font-weight: 900; background: #eee !important; }
  .net { margin-top: 12px; border: 2px solid #111; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; }
  .net .v { font-size: 22px; font-weight: 900; }
  .words { font-size: 11px; font-weight: 700; margin-top: 4px; }
  .receiver { margin-top: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 12px; font-weight: 700; }
  .receiver div { border-bottom: 1px dotted #333; padding-bottom: 18px; }
</style></head><body>
${watermark(payroll.status)}
<div class="doc">
  ${headerBlock("قسيمة راتب", "Salary Slip", payroll)}
  <div class="info">
    <div><label>اسم الموظف</label><span>${escapeHtml(d.employeeName)}</span></div>
    <div><label>الرقم الوظيفي</label><span>${escapeHtml(d.employeeCode)}</span></div>
    <div><label>الفرع</label><span>${escapeHtml(payroll.branchName)}</span></div>
    <div><label>أيام العمل</label><span>${d.workDays} / 30</span></div>
  </div>
  <div class="grid2">
    <div class="box"><h3>▲ المستحقات</h3><table>${earnings}<tr class="total"><td class="name">إجمالي المستحقات</td><td>${money(d.grossSalary)} ر.س</td></tr></table></div>
    <div class="box"><h3>▼ الاستقطاعات</h3><table>${deductions || `<tr><td class="name">لا توجد استقطاعات</td><td>0.00 ر.س</td></tr>`}<tr class="total"><td class="name">إجمالي الاستقطاعات</td><td>-${money(d.totalDeductions)} ر.س</td></tr></table></div>
  </div>
  <div class="net"><span style="font-weight:800">صافي الراتب المستحق</span><span class="v">${money(d.netSalary)} ر.س</span></div>
  <div class="words">${escapeHtml(netInWords(num(d.netSalary)))}</div>
  ${d.notes ? `<div style="margin-top:6px;font-size:11px">ملاحظات: ${escapeHtml(d.notes)}</div>` : ""}
  <div class="receiver"><div>اسم المستلم: ${escapeHtml(d.employeeName)}</div><div>توقيع المستلم:</div></div>
  ${signaturesBlock(approved, payroll.approvedByName, payroll.approvedAt)}
  ${footer()}
</div></body></html>`;
}
