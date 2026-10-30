/**
 * قوالب طباعة مسيرات الرواتب ومسيرات رواتب الموظفين
 *
 * - تُبنى من القيم المحفوظة في الخادم فقط (لا إعادة حساب في الواجهة)
 * - كل مكوّن خصم له عمود/سطر مستقل حتى يطابق (الإجمالي - الخصومات = الصافي)
 * - التوقيعات والختم تظهر فقط بعد الاعتماد (معتمدة / مدفوعة)
 * - الترويسة باسم مؤسسة فرع المسيرة (getEstablishmentForBranch) وليس اسم النظام
 * - مسيرة الراتب تستخدم القالب الرسمي المشترك مع PDF الخادم (shared/payslipTemplate.ts)
 */
import {
  SIGNATURES,
  getEstablishmentForBranch,
  isPlaceholderValue,
  type Establishment,
} from "@shared/branding";
import {
  buildPayslipDocumentData,
  renderPayslipHtml,
  type PayslipDetailSource,
  type PayslipDocumentData,
  type PayslipEmployeeExtras,
} from "@shared/payslipTemplate";
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
  id?: number;
  payrollNumber: string;
  branchId?: number | null;
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
  employeeId?: number;
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

/** كتابة مستند كامل في نافذة الطباعة (المستند يتضمن سكربت الطباعة التلقائية) */
export function writePrintDocument(win: Window, html: string) {
  win.document.open();
  win.document.write(html);
  win.document.close();
}

/** رسالة انتظار مؤقتة في نافذة الطباعة أثناء جلب البيانات من الخادم */
export function writePrintLoading(win: Window, message = "جاري تجهيز المستند للطباعة...") {
  writePrintDocument(
    win,
    `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8" /><title>${escapeHtml(message)}</title></head>` +
      `<body style="font-family:Tahoma,Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:90vh;color:#555">${escapeHtml(message)}</body></html>`
  );
}

/** أساس روابط الصور في نافذة الطباعة (النافذة الفارغة لا تملك عنواناً خاصاً بها) */
function browserOrigin(): string | undefined {
  return typeof window !== "undefined" && window.location ? window.location.origin : undefined;
}

function assetUrl(path: string, base = browserOrigin()): string {
  if (!path || /^(data:|https?:|blob:)/i.test(path) || !base) return path;
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
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
  .stamp img { width: 148px; height: 148px; object-fit: contain; opacity: .92; display: block; margin: 0 auto; }
  .stamp .ph { width: 110px; height: 110px; border: 2px dashed #ccc; border-radius: 50%; margin: 0 auto; display: flex; align-items: center; justify-content: center; color: #aaa; font-size: 10px; }
  .footer { margin-top: 14px; border-top: 1px dashed #bbb; padding-top: 6px; display: flex; justify-content: space-between; font-size: 9.5px; color: #666; }
  @page { margin: 8mm; }
`;

/** مؤسسة المسيرة: من اسم فرع المسيرة المحفوظ (لبن -> قصه وتخفيف، طويق -> تدرج وتخفيف، وإلا الهوية العامة) */
export function payrollEstablishment(payroll: Pick<PrintablePayroll, "branchName">): Establishment {
  return getEstablishmentForBranch(payroll.branchName);
}

function signaturesBlock(
  company: Establishment,
  approved: boolean,
  approvedByName?: string | null,
  approvedAt?: Date | string | null
) {
  const sigBox = (s: { name: string; title: string; image: string }) => `
    <div class="sig">
      <div class="t">اعتماد ${escapeHtml(s.title)}</div>
      <div class="img">${
        approved
          ? `<img src="${escapeHtml(assetUrl(s.image))}" alt="${escapeHtml(s.name)}" onerror="this.outerHTML='<span>✓ موقّع</span>'" />`
          : `<span class="wait">بانتظار الاعتماد</span>`
      }</div>
      <div class="line">${escapeHtml(s.name)}</div>
      <div class="role">${escapeHtml(s.title)}</div>
    </div>`;
  const stamp = company.stamp || SIGNATURES.stamp.image;
  return `
    <div class="signatures">
      ${sigBox(SIGNATURES.supervisor)}
      <div class="stamp">
        ${approved
          // الختم نفسه يحمل اسم الإدارة؛ إزالة التسمية تعطي الختم الأكبر مساحته دون زيادة ارتفاع الصف
          ? `<img src="${escapeHtml(assetUrl(stamp))}" alt="${escapeHtml(SIGNATURES.stamp.label)}" onerror="this.style.display='none'" />`
          : `<div class="ph">الختم بعد الاعتماد</div><div class="role" style="font-size:10px;color:#555;margin-top:4px">${escapeHtml(SIGNATURES.stamp.label)}</div>`}
        ${approved && approvedByName ? `<div style="font-size:9.5px;color:#333;margin-top:2px">اعتمدها: ${escapeHtml(approvedByName)} — ${fmtDate(approvedAt)}</div>` : ""}
      </div>
      ${sigBox(SIGNATURES.manager)}
    </div>`;
}

/** ترويسة المؤسسة: الشعار فقط إن وُجد (وإلا ترويسة نصية)، وبدون القيم المؤقتة مثل XXXX */
function brandBlock(company: Establishment): string {
  const shown = (v: string | null | undefined) => (v && !isPlaceholderValue(v) ? escapeHtml(v.trim()) : "");
  const sub = [shown(company.subtitle), shown(company.cr), shown(company.vat)].filter(Boolean).join(" | ");
  const logo = company.logo
    ? `<img src="${escapeHtml(assetUrl(company.logo))}" alt="logo" onerror="this.style.display='none'" />`
    : "";
  return `
      <div class="brand">
        ${logo}
        <div><div class="name">${escapeHtml(company.nameAr)}</div>${sub ? `<div class="sub">${sub}</div>` : ""}</div>
      </div>`;
}

function headerBlock(titleAr: string, titleEn: string, payroll: PrintablePayroll, company: Establishment) {
  const approved = isPayrollApproved(payroll.status);
  return `
    <div class="header">
      ${brandBlock(company)}
      <div class="title"><h1>${escapeHtml(titleAr)}</h1><div class="en">${escapeHtml(titleEn)}</div></div>
      <div class="meta">
        <div><b>رقم المسيرة:</b> ${escapeHtml(payroll.payrollNumber)}</div>
        <div><b>الفترة:</b> ${ARABIC_MONTHS[payroll.month - 1]} ${payroll.year}</div>
        <div><b>الحالة:</b> <span class="badge ${approved ? "ok" : ""}">${escapeHtml(STATUS_LABELS[payroll.status] ?? payroll.status)}</span></div>
      </div>
    </div>`;
}

function watermark(status: string) {
  if (status === "cancelled") return `<div class="watermark">ملغاة</div>`;
  if (!isPayrollApproved(status)) return `<div class="watermark">مسودة</div>`;
  return "";
}

function footer(company: Establishment) {
  const now = new Date();
  return `<div class="footer"><span>${escapeHtml(company.nameAr)}</span><span>طُبعت في ${now.toLocaleDateString("ar-SA-u-ca-gregory")} ${now.toLocaleTimeString("ar-SA")}</span></div>`;
}

/** مسيرة الرواتب الكاملة (أفقي A4) */
export function buildPayrollSheetHtml(payroll: PrintablePayroll, details: PrintableDetail[]): string {
  const approved = isPayrollApproved(payroll.status);
  const company = payrollEstablishment(payroll);
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
  ${headerBlock("مسيرة رواتب الموظفين", "Monthly Payroll Sheet", payroll, company)}
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
  ${signaturesBlock(company, approved, payroll.approvedByName, payroll.approvedAt)}
  ${footer(company)}
</div></body></html>`;
}

/** خيارات مسيرة الراتب في المتصفح */
export interface PayslipPrintOptions {
  /** طباعة تلقائية بعد تحميل الصفحة والخطوط (الافتراضي: نعم) */
  autoPrint?: boolean;
  /** أساس روابط الصور والخط (الافتراضي: عنوان الصفحة الحالية) */
  assetBaseUrl?: string;
}

/**
 * مسيرة الراتب الرسمية من بيانات الخادم (payrolls.payslipDocument) بنفس قالب PDF
 * - الطباعة التلقائية مضمّنة في المستند: اكتبه بـ writePrintDocument (وليس writeAndPrint)
 */
export function buildPayslipDocumentHtml(data: PayslipDocumentData, options: PayslipPrintOptions = {}): string {
  return renderPayslipHtml(data, {
    assetBaseUrl: options.assetBaseUrl ?? browserOrigin(),
    autoPrint: options.autoPrint ?? true,
  });
}

/**
 * مسيرة راتب موظف من صفوف المسيرة المحمّلة في الصفحة (للتوافق مع الاستدعاءات القديمة)
 * - نفس القالب الرسمي؛ بيانات ملف الموظف (الإقامة، الجنسية، البنك) تُمرر في extras إن توفرت
 * - بدون طباعة تلقائية مضمّنة لأن writeAndPrint يطبع بنفسه
 */
export function buildPayslipHtml(
  payroll: PrintablePayroll,
  detail: PrintableDetail,
  extras: PayslipEmployeeExtras = {}
): string {
  const data = buildPayslipDocumentData(payroll, detail as PayslipDetailSource, extras);
  return buildPayslipDocumentHtml(data, { autoPrint: false });
}
