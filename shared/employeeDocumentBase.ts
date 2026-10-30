/**
 * الأجزاء المشتركة لمستندات الموظف الرسمية (مسيرة الراتب وطلب السلفة)
 * - صفحة A4 طولية RTL بنفس هوية مستندات إنهاء الخدمة (الترويسة والخط والتوقيعات والختم)
 * - الترويسة باسم مؤسسة فرع المستند (getEstablishmentForBranch) ولا تحمل اسم النظام
 * - التوقيعات والختم لا تظهر إلا للمستند المعتمد (signed)، وإلا علامة مائية ونص "بانتظار الاعتماد"
 * - جميع النصوص المُدخلة من المستخدم تُهرّب قبل إدراجها في HTML
 */

import {
  SIGNATURES,
  getEstablishmentForBranch,
  isPlaceholderValue,
  type Establishment,
} from "./branding";
import {
  escapeHtml,
  formatVoucherAmount,
  formatVoucherDate,
  formatVoucherDateTime,
} from "./vouchers";
import {
  autoPrintScript,
  bilingualHtml,
  logoImgHtml,
  printFontFaceCss,
  resolveVoucherAssets,
  type ResolvedVoucherAssets,
  type VoucherTemplateAssets,
} from "./voucherTemplate";

export const esc = escapeHtml;
export const bi = bilingualHtml;

export const DOC_ACCENT = "#1f3a5f";
export const DOC_ACCENT_SOFT = "#eef3f9";
export const DOC_GOLD = "#b08d57";
export const DOC_NEGATIVE = "#8b1e1e";
/** خط المستندات: يُعرَّف بوزن عادي حتى يُولّد المتصفح الخط العريض من الملف الوحيد المتوفر */
export const DOC_FONT_FAMILY = "EmpDocArabic";

export const ARABIC_MONTHS = [
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
];

/** اسم الشهر الميلادي بالعربية (أو رقمه إن كان خارج النطاق) */
export function arabicMonthName(month: number): string {
  return ARABIC_MONTHS[month - 1] ?? String(month);
}

/** القيمة نصاً بعد التقليم، أو null إن كانت فارغة */
export function present(value: unknown): string | null {
  const s = value === null || value === undefined ? "" : String(value).trim();
  return s ? s : null;
}

/** رقم آمن من نص عشري أو رقم */
export function num(value: unknown): number {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : 0;
}

export function money(value: unknown): string {
  return formatVoucherAmount(value);
}

/** تاريخ DD/MM/YYYY بتوقيت الرياض (أو "-") */
export function dateText(value: Date | string | null | undefined): string {
  return formatVoucherDate(value ?? null);
}

/** تاريخ ميلادي داخل النص: DD/MM/YYYYم */
export function proseDate(value: Date | string | null | undefined): string {
  const s = dateText(value);
  return s === "-" ? "-" : `${s}م`;
}

export function dateTimeText(value: Date | string | null | undefined): string {
  return formatVoucherDateTime(value ?? null);
}

/** عدد أيام: صحيح كما هو، وإلا برقمين عشريين بدون أصفار زائدة */
export function formatDays(value: unknown): string {
  const n = num(value);
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, "");
}

/** عدد الأيام بصيغة عربية سليمة: يوم واحد، يومان، 3 أيام، 11 يوماً */
export function daysText(value: unknown): string {
  const n = num(value);
  if (!Number.isInteger(n)) return `${formatDays(n)} يوم`;
  if (n === 1) return "يوم واحد";
  if (n === 2) return "يومان";
  if (n >= 3 && n <= 10) return `${n} أيام`;
  if (n === 0) return "0 يوم";
  return `${n} يوماً`;
}

/** فئة CSS آمنة للحالة */
export function statusClass(status: string): string {
  return /^[a-z_]+$/.test(status) ? status : "unknown";
}

export interface EmployeeDocumentBaseOptions {
  assetBaseUrl?: string;
  assets?: VoucherTemplateAssets;
  establishment?: Establishment;
  autoPrint?: boolean;
  printedAt?: Date;
}

export interface EmployeeDocContext {
  company: Establishment;
  assets: ResolvedVoucherAssets;
  status: string;
  signed: boolean;
  cancelled: boolean;
  printedAt: Date;
}

export function buildEmployeeDocContext(
  branchName: string | null | undefined,
  status: string,
  signed: boolean,
  options: EmployeeDocumentBaseOptions
): EmployeeDocContext {
  const company =
    options.establishment ?? getEstablishmentForBranch(branchName);
  return {
    company,
    assets: resolveVoucherAssets(options, company),
    status,
    signed,
    cancelled: status === "cancelled",
    printedAt: options.printedAt ?? new Date(),
  };
}

/** الترويسة: اسم المؤسسة (نصية بدون صورة إذا لم يوجد شعار) مع إخفاء القيم المؤقتة مثل XXXX */
export function renderLetterhead(ctx: EmployeeDocContext): string {
  const c = ctx.company;
  const shown = (v: string | null | undefined) =>
    !isPlaceholderValue(v) ? esc(String(v).trim()) : "";
  const metaAr = [shown(c.address), shown(c.phone)]
    .filter(Boolean)
    .join(" &nbsp;|&nbsp; ");
  const legal = [shown(c.cr), shown(c.vat)]
    .filter(Boolean)
    .join(" &nbsp;|&nbsp; ");
  const email = shown(c.email);
  const subtitle = present(c.subtitle);
  const nameEn = present(c.name);
  const logo = logoImgHtml(ctx.assets.logo, "lh-logo-img");
  return `
    <header class="letterhead">
      <div class="lh-side lh-ar">
        <div class="lh-name">${esc(c.nameAr)}</div>
        ${subtitle ? `<div class="lh-sub">${esc(subtitle)}</div>` : ""}
        ${metaAr ? `<div class="lh-meta">${metaAr}</div>` : ""}
        ${legal ? `<div class="lh-meta">${legal}</div>` : ""}
      </div>
      ${logo ? `<div class="lh-logo">${logo}</div>` : ""}
      <div class="lh-side lh-en">
        ${nameEn ? `<div class="lh-name">${esc(nameEn)}</div>` : ""}
        ${email ? `<div class="lh-meta">${email}</div>` : ""}
      </div>
    </header>`;
}

/** علامة مائية (نص عربي ثابت، ليس من إدخال المستخدم) */
export function renderWatermark(
  text: string | null,
  tone: "draft" | "cancelled"
): string {
  if (!text) return "";
  return `<div class="watermark ${tone}">${esc(text)}</div>`;
}

/** كتلة توقيع (المشرف العام / المدير العام)، والختم فوق كتلة المدير بعد الاعتماد فقط */
export function renderSigner(
  ctx: EmployeeDocContext,
  key: "manager" | "supervisor",
  withStamp: boolean,
  pendingText: string
): string {
  const info = SIGNATURES[key];
  const img =
    key === "manager"
      ? ctx.assets.managerSignature
      : ctx.assets.supervisorSignature;
  let area: string;
  if (ctx.signed) {
    area = `<img class="sig-img" src="${esc(img)}" alt="${esc(info.name)}" />`;
    if (withStamp)
      area += `<img class="stamp-img" src="${esc(ctx.assets.stamp)}" alt="${esc(SIGNATURES.stamp.label)}" />`;
  } else {
    area = `<div class="sig-pending">${esc(pendingText)}</div>`;
    if (withStamp) area += `<div class="stamp-placeholder">الختم</div>`;
  }
  return `
      <div class="sig sig-${key}">
        <div class="sig-title">${bi(esc(info.title), esc(info.titleEn))}</div>
        <div class="sig-area">${area}</div>
        <div class="sig-line"></div>
        <div class="sig-name">${esc(info.name)}</div>
        <div class="sig-name-en">${esc(info.nameEn)}</div>
      </div>`;
}

export function renderFooter(
  ctx: EmployeeDocContext,
  title: string,
  refLabel: string,
  ref: string
): string {
  return `
    <footer class="doc-footer">
      <span>${esc(ctx.company.nameAr)}</span>
      <span>${esc(title)} &nbsp;|&nbsp; ${esc(refLabel)}: <b class="ltr">${esc(ref)}</b></span>
      <span>تاريخ الطباعة: <span class="ltr">${esc(dateTimeText(ctx.printedAt))}</span></span>
    </footer>`;
}

export function renderDocumentShell(args: {
  ctx: EmployeeDocContext;
  title: string;
  kind: string;
  watermark: string;
  body: string;
  footer: string;
  extraCss: string;
  autoPrint?: boolean;
}): string {
  const { ctx } = args;
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(args.title)}</title>
  <style>${BASE_STYLES(printFontFaceCss(ctx.assets.font, DOC_FONT_FAMILY, "normal"))}${args.extraCss}</style>
</head>
<body>
  ${args.watermark}
  <div class="sheet doc-${args.kind} status-${statusClass(ctx.status)}">
    ${renderLetterhead(ctx)}
    ${args.body}
    <div class="push"></div>
    ${args.footer}
  </div>
  ${args.autoPrint ? autoPrintScript() : ""}
</body>
</html>`;
}

const BASE_STYLES = (fontFace: string) => `
  ${fontFace}
  @page { size: A4; margin: 10mm 11mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #ffffff; }
  body {
    font-family: '${DOC_FONT_FAMILY}', 'VoucherArabic', 'Tajawal', 'Noto Sans Arabic', 'Segoe UI', Tahoma, Arial, sans-serif;
    color: #111111; font-size: 11.5px; line-height: 1.55; direction: rtl;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .ltr { direction: ltr; unicode-bidi: isolate; }
  .ar { display: inline; unicode-bidi: isolate; }
  .sep { color: #999; }
  .en { display: inline; direction: ltr; unicode-bidi: isolate; color: #5b6573; font-size: 0.82em; font-weight: normal; }

  .sheet { position: relative; display: flex; flex-direction: column; min-height: 276mm; }
  @media screen {
    html, body { background: #e9ecf1; }
    .sheet { width: 210mm; max-width: 100%; min-height: 297mm; margin: 12px auto; padding: 10mm 11mm; background: #ffffff; box-shadow: 0 2px 14px rgba(15, 23, 42, 0.18); }
  }

  .watermark {
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-32deg);
    font-size: 70px; font-weight: 700; white-space: nowrap; pointer-events: none; z-index: 20; letter-spacing: 2px;
  }
  .watermark.draft { color: rgba(15, 23, 42, 0.07); }
  .watermark.cancelled { color: rgba(185, 28, 28, 0.14); font-size: 110px; }

  .letterhead { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 6px; border-bottom: 3px double ${DOC_ACCENT}; }
  .lh-side { flex: 1; min-width: 0; }
  .lh-ar { text-align: right; }
  .lh-en { text-align: left; direction: ltr; }
  .lh-name { font-size: 17px; font-weight: 700; color: ${DOC_ACCENT}; line-height: 1.3; }
  .lh-en .lh-name { letter-spacing: 0.6px; }
  .lh-sub { font-size: 10.5px; color: #3f4753; }
  .lh-meta { font-size: 9.5px; color: #5b6573; }
  .lh-logo img { width: 56px; height: 56px; object-fit: contain; display: block; }

  .title-row { display: flex; align-items: stretch; justify-content: space-between; gap: 10px; margin: 8px 0 7px; }
  .info-box { width: 26%; border: 1.5px solid ${DOC_ACCENT}; border-radius: 6px; text-align: center; overflow: hidden; }
  .info-box .lbl { background: ${DOC_ACCENT}; color: #fff; font-size: 10px; padding: 1px 4px; }
  .info-box .lbl .en, .info-box .lbl .sep { color: #dbe3ee; }
  .info-box .val { font-size: 12.5px; font-weight: 700; padding: 2px 4px 0; letter-spacing: 0.3px; }
  .info-box .badge-wrap { padding-bottom: 3px; }
  .doc-title { flex: 1; text-align: center; align-self: center; }
  .doc-title h1 { font-size: 19px; font-weight: 700; color: ${DOC_ACCENT}; line-height: 1.35; }
  .doc-title h2 { font-size: 10px; font-weight: 600; letter-spacing: 2.4px; color: #5b6573; direction: ltr; }
  .doc-title .period { font-size: 12px; font-weight: 700; color: #222; margin-top: 1px; }
  .title-rule { width: 110px; height: 2px; background: ${DOC_GOLD}; margin: 4px auto 0; }

  .status-badge { display: inline-block; padding: 0 8px; border-radius: 10px; font-size: 10px; font-weight: 700; border: 1px solid #999; }
  .status-badge.status-draft, .status-badge.status-pending { background: #fff7ed; border-color: #f59e0b; color: #92400e; }
  .status-badge.status-approved, .status-badge.status-paid { background: #ecfdf5; border-color: #10b981; color: #065f46; }
  .status-badge.status-cancelled, .status-badge.status-rejected { background: #fef2f2; border-color: #ef4444; color: #991b1b; }

  .sec { margin-bottom: 6px; break-inside: avoid; page-break-inside: avoid; }
  .sec-title { font-size: 11.5px; font-weight: 700; color: ${DOC_ACCENT}; border-bottom: 1.5px solid ${DOC_ACCENT}; padding-bottom: 1px; margin-bottom: 3px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid #cfd6df; border-right: 1px solid #cfd6df; }
  .grid .cell { border-left: 1px solid #cfd6df; border-bottom: 1px solid #cfd6df; padding: 1px 7px 2px; line-height: 1.38; min-width: 0; }
  .grid .cell.span2 { grid-column: span 2; }
  .grid .cell.span3 { grid-column: span 3; }
  .grid .cell.span4 { grid-column: span 4; }
  .grid .lbl { font-size: 9px; color: #5b6573; }
  .grid .val { font-size: 11px; font-weight: 600; overflow-wrap: anywhere; }
  .grid .cell.strong .val { font-weight: 700; font-size: 12px; }

  table.fin { width: 100%; border-collapse: collapse; font-size: 11px; }
  table.fin th { background: ${DOC_ACCENT}; color: #fff; padding: 2px 6px; border: 1px solid ${DOC_ACCENT}; font-weight: 700; text-align: right; line-height: 1.4; white-space: nowrap; }
  table.fin th .en { color: #dbe3ee; }
  table.fin th .sep { color: #9fb0c6; }
  table.fin th.col-item { width: 30%; }
  table.fin th.col-amt { width: 17%; text-align: left; }
  table.fin td { border: 1px solid #cfd6df; padding: 2px 6px; vertical-align: top; line-height: 1.4; }
  table.fin tr { break-inside: avoid; page-break-inside: avoid; }
  table.fin td.amt { text-align: left; direction: ltr; white-space: nowrap; font-weight: 700; }
  table.fin td.calc { color: #222; }
  table.fin td.empty { text-align: center; color: #5b6573; }
  table.fin .sub { font-size: 9.5px; color: #5b6573; }
  table.fin tr.item td { font-size: 10px; color: #333; background: #fbfcfe; }
  table.fin tr.item td.amt { font-weight: 600; color: #444; }
  table.fin tfoot td { background: ${DOC_ACCENT_SOFT}; font-weight: 700; border-top: 2px solid ${DOC_ACCENT}; font-size: 11.5px; }
  .tag { display: inline-block; font-size: 9px; font-weight: 700; color: ${DOC_ACCENT}; background: ${DOC_ACCENT_SOFT}; border: 1px solid #c7d3e3; border-radius: 3px; padding: 0 4px; line-height: 1.5; }

  .sign-row { display: flex; justify-content: space-between; gap: 10px; margin-top: 8px; break-inside: avoid; page-break-inside: avoid; }
  .sign-row .sig { flex: 1 1 0; }
  .sig { text-align: center; }
  .sig-title { font-size: 11px; font-weight: 700; }
  .sig-title .sep { display: none; }
  .sig-title .en { display: block; }
  .sig-area { position: relative; height: 82px; display: flex; align-items: center; justify-content: center; }
  .sig-img { width: 136px; height: 54px; object-fit: cover; object-position: center; position: relative; z-index: 2; }
  .stamp-img { position: absolute; left: -14px; top: 50%; width: 118px; height: 118px; transform: translateY(-50%) rotate(-10deg); object-fit: contain; opacity: 0.9; z-index: 1; }
  .sig-pending { font-size: 10px; color: #8a8f98; border: 1px dashed #b9bec7; border-radius: 4px; padding: 4px 10px; }
  .stamp-placeholder { position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 68px; height: 68px; border: 1.5px dashed #c3c8d0; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9.5px; color: #9aa0a9; }
  .sig-line { border-bottom: 1px solid #333; margin: 2px 12px 3px; }
  .sig-name { font-size: 11.5px; font-weight: 700; }
  .sig-name-en { font-size: 9.5px; color: #5b6573; direction: ltr; }
  .approval-note { margin-top: 4px; text-align: center; font-size: 10.5px; color: #065f46; font-weight: 700; }
  .pending-note { margin-top: 4px; text-align: center; font-size: 10.5px; color: #92400e; font-weight: 700; }

  .ack { margin-top: 8px; padding: 6px 10px 7px; border: 1px dashed #7b8390; border-radius: 4px; break-inside: avoid; page-break-inside: avoid; }
  .ack-text { font-size: 11px; line-height: 1.7; }
  .ack-fields { display: flex; gap: 14px; margin-top: 9px; }
  .ack-field { flex: 1; display: flex; align-items: flex-end; gap: 5px; font-size: 11px; font-weight: 700; white-space: nowrap; }
  .ack-field.short { flex: 0.7; }
  .ack-field .blank { flex: 1; min-width: 0; border-bottom: 1px solid #333; min-height: 19px; padding: 0 4px; font-weight: 600; white-space: normal; }

  .notes { padding: 2px 9px; margin-bottom: 6px; border: 1px solid #cfd6df; border-radius: 4px; font-size: 10.5px; }
  .user-text { white-space: pre-wrap; }
  .alert-box { margin-top: 6px; padding: 6px 9px; border: 1.5px solid #ef4444; background: #fef2f2; color: #7f1d1d; border-radius: 4px; font-size: 11px; break-inside: avoid; }
  .wait-box { margin-top: 6px; padding: 6px 9px; border: 1.5px dashed #f59e0b; background: #fffbeb; color: #92400e; border-radius: 4px; font-size: 11px; break-inside: avoid; }

  .push { flex: 1 0 8px; }
  .doc-footer { padding-top: 5px; border-top: 1px solid #cfd6df; display: flex; justify-content: space-between; gap: 10px; font-size: 9px; color: #5b6573; }
  .doc-footer .ltr { white-space: nowrap; }
`;
