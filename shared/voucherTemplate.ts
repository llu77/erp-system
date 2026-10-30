/**
 * قالب طباعة السندات الموحد (سند قبض / سند صرف)
 * - صفحة A4 باتجاه RTL ثنائية اللغة (عربي / إنجليزي)
 * - يُستخدم في الواجهة (نافذة الطباعة والمعاينة) وفي الخادم (PDF عبر puppeteer)
 * - التوقيعات والختم لا تظهر إلا بعد اعتماد المدير (معتمد / مدفوع)
 * - جميع النصوص المُدخلة من المستخدم تُهرّب قبل إدراجها في HTML
 */

import { COMPANY_INFO, SIGNATURES, isPlaceholderValue, type CompanyInfo } from "./branding";
import {
  VOUCHER_TITLES,
  PAYMENT_METHOD_LABELS,
  amountToArabicWords,
  amountToEnglishWords,
  escapeHtml,
  formatVoucherAmount,
  formatVoucherDate,
  formatVoucherDateTime,
  formatPaymentSplitText,
  getPaymentSplitLines,
  getVoucherStatusLabel,
  isVoucherSigned,
  roundMoney,
  type VoucherType,
} from "./vouchers";

type Money = number | string | null | undefined;
type DateLike = Date | string | null | undefined;

export interface VoucherTemplateItem {
  description: string;
  quantity?: Money;
  unitPrice?: Money;
  amount: Money;
  notes?: string | null;
}

/** بيانات السند المطلوبة للطباعة (متوافقة مع صف قاعدة البيانات) */
export interface VoucherTemplateData {
  voucherType?: VoucherType | string | null;
  voucherId: string;
  voucherDate: DateLike;
  status: string;
  partyName?: string | null;
  partyType?: string | null;
  payeeName?: string | null;
  branchName?: string | null;
  description?: string | null;
  notes?: string | null;
  dueDateFrom?: DateLike;
  dueDateTo?: DateLike;
  totalAmount: Money;
  paymentMethod?: string | null;
  cashAmount?: Money;
  bankAmount?: Money;
  checkAmount?: Money;
  bankName?: string | null;
  bankReference?: string | null;
  checkNumber?: string | null;
  checkDate?: DateLike;
  checkBank?: string | null;
  items?: VoucherTemplateItem[] | null;
  createdByName?: string | null;
  createdAt?: DateLike;
  approvedByName?: string | null;
  approvedAt?: DateLike;
  paidByName?: string | null;
  paidAt?: DateLike;
  cancelledByName?: string | null;
  cancelledAt?: DateLike;
  cancellationReason?: string | null;
  signedBy1?: string | null;
  signedBy2?: string | null;
}

export interface VoucherTemplateAssets {
  logo?: string;
  supervisorSignature?: string;
  managerSignature?: string;
  stamp?: string;
  /** خط عربي (ttf) - رابط أو data URI */
  font?: string;
}

export interface VoucherTemplateOptions {
  /** أساس روابط الصور (مثال: window.location.origin). يُتجاهل للصور المُمررة صراحةً في assets */
  assetBaseUrl?: string;
  /** صور مُمررة صراحةً (مثل data URIs في الخادم) */
  assets?: VoucherTemplateAssets;
  company?: Partial<CompanyInfo>;
  /** إضافة سكربت طباعة تلقائية بعد تحميل الصفحة */
  autoPrint?: boolean;
  /** وقت الطباعة (للاختبارات) */
  printedAt?: Date;
}

function joinAsset(base: string | undefined, assetPath: string): string {
  if (/^(data:|https?:|blob:)/i.test(assetPath)) return assetPath;
  if (!base) return assetPath;
  return `${base.replace(/\/+$/, "")}/${assetPath.replace(/^\/+/, "")}`;
}

function resolveAssets(options: VoucherTemplateOptions): Required<Omit<VoucherTemplateAssets, "font">> & { font?: string } {
  const a = options.assets ?? {};
  const base = options.assetBaseUrl;
  return {
    logo: a.logo ?? joinAsset(base, COMPANY_INFO.logo),
    supervisorSignature: a.supervisorSignature ?? joinAsset(base, SIGNATURES.supervisor.image),
    managerSignature: a.managerSignature ?? joinAsset(base, SIGNATURES.manager.image),
    stamp: a.stamp ?? joinAsset(base, SIGNATURES.stamp.image),
    font: a.font ?? (base !== undefined ? joinAsset(base, "/fonts/NotoSansArabic-Regular.ttf") : undefined),
  };
}

function normalizeType(type: VoucherTemplateData["voucherType"]): VoucherType {
  return type === "payment" ? "payment" : "receipt";
}

function bi(ar: string, en: string): string {
  return `<span class="ar">${ar}</span><span class="en">${en}</span>`;
}

function textOrDash(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value).trim();
  return s ? escapeHtml(s) : "&nbsp;";
}

function renderItems(v: VoucherTemplateData): string {
  const items = v.items && v.items.length > 0
    ? v.items
    : [{ description: v.description || "-", quantity: 1, unitPrice: null, amount: v.totalAmount }];
  let subTotal = 0;
  const rows = items.map((item, index) => {
    const qty = roundMoney(item.quantity ?? 1) || 1;
    const amount = roundMoney(item.amount);
    subTotal += amount;
    const unit = item.unitPrice !== null && item.unitPrice !== undefined && item.unitPrice !== ""
      ? roundMoney(item.unitPrice)
      : roundMoney(amount / qty);
    return `
        <tr>
          <td class="c">${index + 1}</td>
          <td class="desc">${escapeHtml(item.description)}${item.notes ? `<div class="item-note">${escapeHtml(item.notes)}</div>` : ""}</td>
          <td class="c num">${escapeHtml(Number.isInteger(qty) ? String(qty) : qty.toFixed(2))}</td>
          <td class="num">${formatVoucherAmount(unit)}</td>
          <td class="num">${formatVoucherAmount(amount)}</td>
        </tr>`;
  }).join("");
  const total = roundMoney(v.totalAmount) || roundMoney(subTotal);
  return `
    <table class="items">
      <thead>
        <tr>
          <th style="width:7%">#</th>
          <th>${bi("البيان", "Description")}</th>
          <th style="width:11%">${bi("الكمية", "Qty")}</th>
          <th style="width:17%">${bi("سعر الوحدة", "Unit Price")}</th>
          <th style="width:18%">${bi("الإجمالي", "Total")}</th>
        </tr>
      </thead>
      <tbody>${rows}
      </tbody>
      <tfoot>
        <tr class="sub">
          <td colspan="4" class="lbl">${bi("المجموع الفرعي", "Sub-total")}</td>
          <td class="num">${formatVoucherAmount(subTotal)}</td>
        </tr>
        <tr class="grand">
          <td colspan="4" class="lbl">${bi("الإجمالي (ريال سعودي)", "Total (SAR)")}</td>
          <td class="num">${formatVoucherAmount(total)}</td>
        </tr>
      </tfoot>
    </table>`;
}

function renderPayment(v: VoucherTemplateData): string {
  const lines = getPaymentSplitLines(v);
  const used = new Set(lines.map(l => l.method));
  const amountOf = (m: string) => lines.find(l => l.method === m)?.amount;
  const box = (on: boolean) => `<span class="chk${on ? " on" : ""}">${on ? "&#10004;" : ""}</span>`;
  const amountCell = (m: string) => {
    const a = amountOf(m);
    return `<span class="pm-amount">${a !== undefined ? formatVoucherAmount(a) : "&nbsp;"}</span>`;
  };

  const rows: string[] = [];
  rows.push(`
      <div class="pm-row">
        ${box(used.has("cash"))}
        <span class="pm-label">${bi(PAYMENT_METHOD_LABELS.cash.ar, PAYMENT_METHOD_LABELS.cash.en)}</span>
        ${amountCell("cash")}
      </div>`);
  rows.push(`
      <div class="pm-row">
        ${box(used.has("bank_transfer"))}
        <span class="pm-label">${bi(PAYMENT_METHOD_LABELS.bank_transfer.ar, PAYMENT_METHOD_LABELS.bank_transfer.en)}</span>
        ${amountCell("bank_transfer")}
        <span class="pm-detail">${bi("البنك", "Bank")}: <b>${textOrDash(used.has("bank_transfer") ? v.bankName : "")}</b></span>
        <span class="pm-detail">${bi("رقم المرجع / العملية", "Ref. / Txn ID")}: <b>${textOrDash(used.has("bank_transfer") ? v.bankReference : "")}</b></span>
      </div>`);
  rows.push(`
      <div class="pm-row">
        ${box(used.has("check"))}
        <span class="pm-label">${bi(PAYMENT_METHOD_LABELS.check.ar, PAYMENT_METHOD_LABELS.check.en)}</span>
        ${amountCell("check")}
        <span class="pm-detail">${bi("رقم الشيك", "Cheque No.")}: <b>${textOrDash(used.has("check") ? v.checkNumber : "")}</b></span>
        <span class="pm-detail">${bi("التاريخ", "Date")}: <b>${used.has("check") && v.checkDate ? escapeHtml(formatVoucherDate(v.checkDate)) : "&nbsp;"}</b></span>
        <span class="pm-detail">${bi("البنك", "Bank")}: <b>${textOrDash(used.has("check") ? (v.checkBank || v.bankName) : "")}</b></span>
      </div>`);
  for (const other of ["credit_card", "other"] as const) {
    if (used.has(other)) {
      rows.push(`
      <div class="pm-row">
        ${box(true)}
        <span class="pm-label">${bi(PAYMENT_METHOD_LABELS[other].ar, PAYMENT_METHOD_LABELS[other].en)}</span>
        ${amountCell(other)}
      </div>`);
    }
  }
  const summary = formatPaymentSplitText(v);
  return `
    <div class="section payment">
      <div class="section-title">${bi("طريقة الدفع", "Payment Method")}</div>
      ${rows.join("")}
      ${summary ? `<div class="pm-summary">${escapeHtml(summary)}</div>` : ""}
    </div>`;
}

function renderSignatures(v: VoucherTemplateData, type: VoucherType, assets: ReturnType<typeof resolveAssets>): string {
  const signed = isVoucherSigned(v.status);
  const cancelled = v.status === "cancelled";
  const pending = `<div class="sig-pending">${cancelled ? "ملغي / Cancelled" : "بانتظار الاعتماد<br><small>Pending Approval</small>"}</div>`;

  const signer = (key: "supervisor" | "manager", img: string, snapshot?: string | null) => {
    const info = SIGNATURES[key];
    const name = snapshot || info.name;
    return `
      <div class="sig-box">
        <div class="sig-title">${bi(info.title, info.titleEn)}</div>
        <div class="sig-area">${signed ? `<img class="sig-img" src="${escapeHtml(img)}" alt="${escapeHtml(name)}" />` : pending}</div>
        <div class="sig-line"></div>
        <div class="sig-name">${escapeHtml(name)}</div>
        <div class="sig-name-en">${escapeHtml(info.nameEn)}</div>
      </div>`;
  };

  const stamp = `
      <div class="sig-box stamp-box">
        <div class="sig-title">${bi("ختم الشركة", "Company Stamp")}</div>
        <div class="stamp-area">${signed
          ? `<img class="stamp-img" src="${escapeHtml(assets.stamp)}" alt="ختم الشركة" />`
          : `<div class="stamp-placeholder">${cancelled ? "ملغي<br><small>Cancelled</small>" : "بانتظار الاعتماد<br><small>Pending</small>"}</div>`}
        </div>
      </div>`;

  const preparedBy = `
      <div class="sig-box">
        <div class="sig-title">${bi("المحاسب / المُعِد", "Prepared By")}</div>
        <div class="sig-area"></div>
        <div class="sig-line"></div>
        <div class="sig-name">${textOrDash(v.createdByName)}</div>
        <div class="sig-name-en">${v.createdAt ? escapeHtml(formatVoucherDateTime(v.createdAt)) : "&nbsp;"}</div>
      </div>`;

  // المستلم: لسند القبض هو من استلم المبلغ (payeeName)، ولسند الصرف هو الطرف المصروف له
  const receiverName = type === "receipt" ? (v.payeeName || "") : (v.partyName || v.payeeName || "");

  let approvalNote = "";
  if (signed) {
    approvalNote = `<div class="approval-note">&#10004; ${bi(
      `اعتُمد بواسطة ${escapeHtml(v.approvedByName || "المدير")}${v.approvedAt ? ` بتاريخ ${escapeHtml(formatVoucherDateTime(v.approvedAt))}` : ""}`,
      `Approved by ${escapeHtml(v.approvedByName || "Manager")}${v.approvedAt ? ` on ${escapeHtml(formatVoucherDateTime(v.approvedAt))}` : ""}`
    )}${v.status === "paid" && type === "payment" ? ` &nbsp;|&nbsp; ${bi(
      `تم الصرف بواسطة ${escapeHtml(v.paidByName || "-")}${v.paidAt ? ` بتاريخ ${escapeHtml(formatVoucherDateTime(v.paidAt))}` : ""}`,
      `Paid${v.paidAt ? ` on ${escapeHtml(formatVoucherDateTime(v.paidAt))}` : ""}`
    )}` : ""}</div>`;
  }

  return `
    <div class="signatures">
      ${preparedBy}
      ${signer("supervisor", assets.supervisorSignature, v.signedBy1)}
      ${stamp}
      ${signer("manager", assets.managerSignature, v.signedBy2)}
    </div>
    ${approvalNote}
    <div class="receiver">
      <div class="receiver-title">${bi("المستلم", "Receiver")}</div>
      <div class="receiver-field">${bi("الاسم", "Name")}: <span class="blank">${receiverName ? escapeHtml(receiverName) : "&nbsp;"}</span></div>
      <div class="receiver-field">${bi("التوقيع", "Signature")}: <span class="blank">&nbsp;</span></div>
      <div class="receiver-field">${bi("التاريخ", "Date")}: <span class="blank short">&nbsp;</span></div>
    </div>`;
}

const STYLES = (accent: string, accentSoft: string, fontFace: string) => `
  ${fontFace}
  @page { size: A4; margin: 10mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #ffffff; }
  body {
    font-family: 'VoucherArabic', 'Tajawal', 'Noto Sans Arabic', 'Segoe UI', Tahoma, Arial, sans-serif;
    color: #111111; font-size: 12px; line-height: 1.5; direction: rtl;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .page { position: relative; max-width: 190mm; margin: 0 auto; padding: 6mm 7mm; border: 1.5px solid #222; border-radius: 4px; overflow: hidden; }
  .watermark {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg);
    font-size: 88px; font-weight: 800; white-space: nowrap; pointer-events: none; z-index: 0; letter-spacing: 4px;
  }
  .watermark.draft { color: rgba(0, 0, 0, 0.06); }
  .watermark.cancelled { color: rgba(185, 28, 28, 0.13); }
  .content { position: relative; z-index: 1; }
  .ar { display: inline; }
  .en { display: inline; direction: ltr; unicode-bidi: isolate; color: #555; font-size: 0.82em; margin-inline-start: 4px; }
  .en::before { content: "/ "; }
  .header { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-bottom: 8px; border-bottom: 3px double ${accent}; }
  .co { flex: 1; }
  .co-ar .name { font-size: 18px; font-weight: 800; }
  .co-ar .sub, .co-en .sub { font-size: 11px; color: #444; }
  .co-en { text-align: left; direction: ltr; }
  .co-en .name { font-size: 17px; font-weight: 800; letter-spacing: 0.5px; }
  .co .meta { font-size: 10px; color: #555; }
  .logo { width: 70px; height: 70px; object-fit: contain; }
  .title-row { display: flex; align-items: stretch; justify-content: space-between; gap: 10px; margin: 10px 0 8px; }
  .no-box, .amount-box { width: 30%; border: 1.5px solid ${accent}; border-radius: 6px; text-align: center; overflow: hidden; }
  .no-box .lbl, .amount-box .lbl { background: ${accent}; color: #fff; font-size: 11px; padding: 3px 4px; }
  .no-box .lbl .en, .amount-box .lbl .en { color: #e5e7eb; }
  .no-box .val { font-size: 16px; font-weight: 800; padding: 6px 4px; direction: ltr; letter-spacing: 1px; }
  .amount-box .val { font-size: 20px; font-weight: 800; padding: 4px; direction: ltr; }
  .title { flex: 1; text-align: center; align-self: center; }
  .title h1 { font-size: 26px; font-weight: 800; color: ${accent}; line-height: 1.2; }
  .title h2 { font-size: 13px; font-weight: 700; letter-spacing: 3px; color: #333; direction: ltr; }
  .meta-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
  .meta-cell { flex: 1; min-width: 120px; background: ${accentSoft}; border: 1px solid #d4d4d4; border-radius: 4px; padding: 4px 8px; }
  .meta-cell .lbl { font-size: 10px; color: #555; }
  .meta-cell .val { font-size: 12px; font-weight: 700; }
  .status-badge { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 700; border: 1px solid #999; }
  .status-draft { background: #fff7ed; border-color: #f59e0b; color: #92400e; }
  .status-approved, .status-paid { background: #ecfdf5; border-color: #10b981; color: #065f46; }
  .status-cancelled { background: #fef2f2; border-color: #ef4444; color: #991b1b; }
  .field { display: flex; align-items: flex-end; gap: 8px; margin: 6px 0; }
  .field .lbl { min-width: 150px; font-weight: 700; font-size: 12px; white-space: nowrap; }
  .field .fill { flex: 1; border-bottom: 1px dotted #444; padding: 0 4px 2px; font-size: 13px; font-weight: 600; min-height: 20px; }
  .field .fill .words-en { display: block; direction: ltr; text-align: left; font-size: 11px; color: #333; font-weight: 500; }
  table.items { width: 100%; border-collapse: collapse; margin: 10px 0 8px; font-size: 11.5px; }
  table.items th { background: ${accent}; color: #fff; padding: 5px 4px; border: 1px solid ${accent}; font-weight: 700; }
  table.items th .en { color: #e5e7eb; display: block; margin: 0; }
  table.items th .en::before { content: ""; }
  table.items td { border: 1px solid #bbb; padding: 4px 6px; vertical-align: top; }
  table.items td.c { text-align: center; }
  table.items td.num { text-align: left; direction: ltr; white-space: nowrap; }
  table.items .item-note { font-size: 10px; color: #666; }
  table.items tfoot td { font-weight: 700; }
  table.items tfoot td.lbl { text-align: left; }
  table.items tfoot tr.grand td { background: ${accentSoft}; font-size: 13px; border-top: 2px solid ${accent}; }
  .section { border: 1px solid #ccc; border-radius: 4px; padding: 6px 8px; margin-bottom: 8px; }
  .section-title { font-weight: 800; font-size: 12px; margin-bottom: 4px; color: ${accent}; }
  .pm-row { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; padding: 3px 0; border-bottom: 1px dashed #e2e2e2; }
  .pm-row:last-of-type { border-bottom: none; }
  .chk { display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; border: 1.5px solid #333; font-size: 10px; line-height: 1; }
  .chk.on { background: ${accentSoft}; }
  .pm-label { min-width: 150px; font-weight: 700; }
  .pm-amount { min-width: 90px; border-bottom: 1px solid #555; text-align: left; direction: ltr; font-weight: 700; padding: 0 4px; }
  .pm-detail { font-size: 11px; color: #333; }
  .pm-detail b { display: inline-block; min-width: 70px; border-bottom: 1px dotted #777; font-weight: 600; }
  .pm-summary { margin-top: 4px; font-size: 11.5px; font-weight: 700; background: ${accentSoft}; padding: 3px 6px; border-radius: 3px; }
  .notes { white-space: pre-wrap; font-size: 11.5px; }
  .cancel-box { border: 1.5px solid #ef4444; background: #fef2f2; color: #7f1d1d; border-radius: 4px; padding: 6px 8px; margin-bottom: 8px; font-size: 11.5px; }
  .signatures { display: flex; justify-content: space-between; gap: 8px; margin-top: 12px; }
  .sig-box { flex: 1; text-align: center; }
  .sig-title { font-size: 11px; font-weight: 700; margin-bottom: 2px; }
  .sig-title .en { display: block; margin: 0; }
  .sig-title .en::before { content: ""; }
  .sig-area { height: 58px; display: flex; align-items: center; justify-content: center; }
  .sig-img { max-height: 56px; max-width: 120px; object-fit: contain; }
  .sig-pending { font-size: 10px; color: #888; border: 1px dashed #bbb; border-radius: 4px; padding: 4px 8px; }
  .sig-line { border-bottom: 1px solid #333; margin: 2px 10px 3px; }
  .sig-name { font-size: 11.5px; font-weight: 700; }
  .sig-name-en { font-size: 10px; color: #555; direction: ltr; }
  .stamp-area { height: 96px; display: flex; align-items: center; justify-content: center; }
  .stamp-img { width: 92px; height: 92px; object-fit: contain; opacity: 0.92; }
  .stamp-placeholder { width: 86px; height: 86px; border: 2px dashed #bbb; border-radius: 50%; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 10px; color: #888; }
  .approval-note { margin-top: 6px; text-align: center; font-size: 11px; color: #065f46; font-weight: 700; }
  .receiver { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 6px 14px; margin-top: 12px; padding: 8px; border: 1px solid #999; border-radius: 4px; }
  .receiver-title { font-weight: 800; font-size: 12px; min-width: 110px; }
  .receiver-field { flex: 1; min-width: 150px; font-size: 11.5px; display: flex; align-items: flex-end; gap: 4px; }
  .receiver-field .blank { flex: 1; display: inline-block; border-bottom: 1px solid #333; min-height: 18px; min-width: 90px; font-weight: 700; }
  .receiver-field .blank.short { min-width: 60px; }
  .footer { margin-top: 10px; padding-top: 6px; border-top: 1px solid #ccc; display: flex; justify-content: space-between; font-size: 9.5px; color: #666; }
  @media print {
    .page { border: 1.5px solid #222; }
  }
`;

/**
 * توليد HTML السند الكامل (صفحة A4 مستقلة)
 */
export function renderVoucherHtml(v: VoucherTemplateData, options: VoucherTemplateOptions = {}): string {
  const type = normalizeType(v.voucherType);
  const titles = VOUCHER_TITLES[type];
  const company = { ...COMPANY_INFO, ...(options.company ?? {}) };
  const assets = resolveAssets(options);
  const status = v.status || "draft";
  const statusLabel = getVoucherStatusLabel(status, type);
  const total = roundMoney(v.totalAmount);
  const accent = type === "receipt" ? "#1f3a5f" : "#7a1f1f";
  const accentSoft = type === "receipt" ? "#eef3f9" : "#fbf0f0";
  const fontFace = assets.font
    ? `@font-face { font-family: 'VoucherArabic'; src: url('${assets.font.replace(/'/g, "%27")}') format('truetype'); font-weight: 100 900; }`
    : "";

  const watermark = status === "cancelled"
    ? `<div class="watermark cancelled">ملغي / CANCELLED</div>`
    : status === "draft"
      ? `<div class="watermark draft">مسودة / DRAFT</div>`
      : "";

  const companyMetaAr = [company.address, !isPlaceholderValue(company.phone) ? company.phone : null]
    .filter(Boolean).map(s => escapeHtml(s)).join(" - ");
  const legal = [
    !isPlaceholderValue(company.cr) ? company.cr : null,
    !isPlaceholderValue(company.vat) ? company.vat : null,
  ].filter(Boolean).map(s => escapeHtml(s)).join(" | ");

  const period = v.dueDateFrom || v.dueDateTo
    ? `${formatVoucherDate(v.dueDateFrom)} - ${formatVoucherDate(v.dueDateTo)}`
    : "";

  // "وذلك عن": البيان العام + الفترة إن وجدت
  const purpose = [v.description?.trim(), period ? `عن الفترة ${period}` : ""].filter(Boolean).join(" - ");

  const showReceivedBy = type === "receipt" && v.payeeName && v.payeeName.trim() && v.payeeName.trim() !== (v.partyName || "").trim();

  const printScript = options.autoPrint
    ? `<script>
      (function () {
        function go() { setTimeout(function () { try { window.focus(); window.print(); } catch (e) {} }, 350); }
        var fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
        if (document.readyState === 'complete') { fontsReady.then(go); }
        else { window.addEventListener('load', function () { fontsReady.then(go); }); }
      })();
    </script>`
    : "";

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(titles.ar)} ${escapeHtml(v.voucherId)}</title>
  <style>${STYLES(accent, accentSoft, fontFace)}</style>
</head>
<body>
  <div class="page status-${escapeHtml(status)} type-${type}">
    ${watermark}
    <div class="content">
      <div class="header">
        <div class="co co-ar">
          <div class="name">${escapeHtml(company.nameAr)}</div>
          <div class="sub">${escapeHtml(company.subtitle)}</div>
          ${companyMetaAr ? `<div class="meta">${companyMetaAr}</div>` : ""}
          ${legal ? `<div class="meta">${legal}</div>` : ""}
        </div>
        <img class="logo" src="${escapeHtml(assets.logo)}" alt="logo" onerror="this.style.visibility='hidden'" />
        <div class="co co-en">
          <div class="name">${escapeHtml(company.name)}</div>
          ${v.branchName ? `<div class="sub">Branch: ${escapeHtml(v.branchName)}</div>` : ""}
          ${!isPlaceholderValue(company.email) ? `<div class="meta">${escapeHtml(company.email)}</div>` : ""}
        </div>
      </div>

      <div class="title-row">
        <div class="no-box">
          <div class="lbl">${bi("رقم السند", "Voucher No.")}</div>
          <div class="val">${escapeHtml(v.voucherId)}</div>
        </div>
        <div class="title">
          <h1>${escapeHtml(titles.ar)}</h1>
          <h2>${escapeHtml(titles.en.toUpperCase())}</h2>
        </div>
        <div class="amount-box">
          <div class="lbl">${bi("المبلغ", "Amount (SAR)")}</div>
          <div class="val">${formatVoucherAmount(total)}</div>
        </div>
      </div>

      <div class="meta-row">
        <div class="meta-cell"><div class="lbl">${bi("التاريخ", "Date")}</div><div class="val">${escapeHtml(formatVoucherDate(v.voucherDate))}</div></div>
        <div class="meta-cell"><div class="lbl">${bi("الفرع", "Branch")}</div><div class="val">${textOrDash(v.branchName)}</div></div>
        ${period ? `<div class="meta-cell"><div class="lbl">${bi("الفترة", "Period")}</div><div class="val">${escapeHtml(period)}</div></div>` : ""}
        <div class="meta-cell"><div class="lbl">${bi("الحالة", "Status")}</div><div class="val"><span class="status-badge status-${escapeHtml(status)}">${escapeHtml(statusLabel.ar)}</span></div></div>
      </div>

      <div class="field">
        <div class="lbl">${bi(titles.partyAr, titles.partyEn)}:</div>
        <div class="fill">${textOrDash(v.partyName || (type === "payment" ? v.payeeName : ""))}</div>
      </div>
      ${showReceivedBy ? `
      <div class="field">
        <div class="lbl">${bi("المستلم", "Received By")}:</div>
        <div class="fill">${escapeHtml(v.payeeName)}</div>
      </div>` : ""}
      <div class="field">
        <div class="lbl">${bi("مبلغاً وقدره", "The Sum of")}:</div>
        <div class="fill">${escapeHtml(amountToArabicWords(total))}<span class="words-en">${escapeHtml(amountToEnglishWords(total))}</span></div>
      </div>
      <div class="field">
        <div class="lbl">${bi("وذلك عن", "Being for")}:</div>
        <div class="fill">${textOrDash(purpose)}</div>
      </div>

      ${renderItems(v)}

      ${renderPayment(v)}

      ${v.notes && v.notes.trim() ? `
      <div class="section">
        <div class="section-title">${bi("ملاحظات", "Notes")}</div>
        <div class="notes">${escapeHtml(v.notes.trim())}</div>
      </div>` : ""}

      ${status === "cancelled" ? `
      <div class="cancel-box">
        <b>${bi("سبب الإلغاء", "Cancellation Reason")}:</b> ${textOrDash(v.cancellationReason)}
        ${v.cancelledByName ? ` &nbsp;|&nbsp; ${bi("ألغي بواسطة", "Cancelled by")}: ${escapeHtml(v.cancelledByName)}` : ""}
        ${v.cancelledAt ? ` &nbsp;|&nbsp; ${escapeHtml(formatVoucherDateTime(v.cancelledAt))}` : ""}
      </div>` : ""}

      ${renderSignatures(v, type, assets)}

      <div class="footer">
        <span>${bi("أُعد بواسطة", "Prepared by")}: ${textOrDash(v.createdByName)}</span>
        <span>${bi("تاريخ الطباعة", "Printed")}: ${escapeHtml(formatVoucherDateTime(options.printedAt ?? new Date()))}</span>
        <span>${escapeHtml(company.name)} - ${escapeHtml(titles.ar)}</span>
      </div>
    </div>
  </div>
  ${printScript}
</body>
</html>`;
}
