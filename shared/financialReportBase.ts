/**
 * الأجزاء المشتركة للتقارير المالية الرسمية (تقرير الإيرادات وتقرير المصاريف)
 * - مبنية على هوية مستندات الموظف (employeeDocumentBase): الترويسة والخط المضمّن والجداول والذيل
 * - التقرير ليس اعتماداً: خطوط توقيع فارغة بأسماء SIGNATURES بدون صور توقيع أو ختم
 * - المبالغ والتواريخ بالأرقام اللاتينية، وجميع النصوص المُدخلة من المستخدم تُهرّب
 */

import { SIGNATURES } from "./branding";
import {
  bi,
  dateText,
  esc,
  money,
  present,
  DOC_ACCENT,
  DOC_ACCENT_SOFT,
  DOC_GOLD,
  DOC_NEGATIVE,
} from "./employeeDocumentBase";

/** اسم الفرع في التقرير، أو "جميع الفروع" عندما لا يُحدد فرع */
export const ALL_BRANCHES_LABEL = "جميع الفروع";

export function reportBranchLabel(branchName: string | null | undefined): string {
  return present(branchName) ?? ALL_BRANCHES_LABEL;
}

/** أول وآخر يوم في الشهر بصيغة YYYY-MM-DD */
export function monthDateRange(year: number, month: number): { from: string; to: string } {
  const mm = String(month).padStart(2, "0");
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(last).padStart(2, "0")}` };
}

/** نص الفترة DD/MM/YYYY - DD/MM/YYYY */
export function reportRangeText(from: string, to: string): string {
  return `${dateText(from)} - ${dateText(to)}`;
}

export interface ReportTitleRowArgs {
  titleAr: string;
  titleEn: string;
  /** سطر الفترة تحت العنوان (مثل: شهر أكتوبر 2026) */
  period: string;
  branchLabel: string;
  rangeText: string;
}

/** صف العنوان: الفرع يميناً، العنوان والفترة في الوسط، ونطاق التواريخ يساراً */
export function renderReportTitleRow(args: ReportTitleRowArgs): string {
  return `
    <div class="title-row">
      <div class="info-box">
        <div class="lbl">${bi("الفرع", "Branch")}</div>
        <div class="val">${esc(args.branchLabel)}</div>
      </div>
      <div class="doc-title">
        <h1>${esc(args.titleAr)}</h1>
        <h2>${esc(args.titleEn)}</h2>
        <div class="period">${esc(args.period)}</div>
        <div class="title-rule"></div>
      </div>
      <div class="info-box">
        <div class="lbl">${bi("الفترة", "Period")}</div>
        <div class="val ltr small">${esc(args.rangeText)}</div>
      </div>
    </div>`;
}

export interface ReportSummaryCard {
  label: string;
  /** القيمة جاهزة للعرض (أرقام لاتينية) */
  value: string;
  /** وحدة صغيرة بجانب القيمة (ر.س / يوم) */
  unit?: string;
  /** البطاقة الرئيسية تُميَّز بلون الهوية */
  main?: boolean;
  /** سطر توضيحي صغير تحت القيمة */
  hint?: string;
}

/** بطاقات الملخص في صف واحد */
export function renderSummaryCards(cards: ReportSummaryCard[]): string {
  const items = cards
    .map(
      c => `
      <div class="card${c.main ? " main" : ""}">
        <div class="card-lbl">${esc(c.label)}</div>
        <div class="card-val"><span class="ltr">${esc(c.value)}</span>${c.unit ? `<small>${esc(c.unit)}</small>` : ""}</div>
        ${c.hint ? `<div class="card-hint">${esc(c.hint)}</div>` : ""}
      </div>`
    )
    .join("");
  return `<section class="cards" style="grid-template-columns: repeat(${cards.length}, 1fr);">${items}
    </section>`;
}

/** خلية مبلغ في الجدول: "-" للصفر في الأعمدة الاختيارية */
export function amountCell(value: number, dashIfZero = false): string {
  if (dashIfZero && Math.abs(value) < 0.005) return `<td class="amt muted">-</td>`;
  return `<td class="amt">${money(value)}</td>`;
}

/**
 * خطوط التوقيع: أعدّه (اسم من أصدر التقرير إن وُجد)، المشرف العام، المدير العام
 * بدون صور توقيع أو ختم لأن التقرير ليس مستند اعتماد
 */
export function renderReportSigners(preparedByName?: string | null): string {
  const prepared = present(preparedByName);
  const block = (title: string, titleEn: string, name: string, nameEn: string, cls: string) => `
      <div class="sig ${cls}">
        <div class="sig-title">${bi(esc(title), esc(titleEn))}</div>
        <div class="sig-blank"></div>
        <div class="sig-line"></div>
        <div class="sig-name">${name ? esc(name) : "&nbsp;"}</div>
        <div class="sig-name-en">${nameEn ? esc(nameEn) : "&nbsp;"}</div>
      </div>`;
  return `
    <section class="sign-row report-signers">
      ${block("أعدّه", "Prepared By", prepared ?? "", "", "sig-prepared")}
      ${block(SIGNATURES.supervisor.title, SIGNATURES.supervisor.titleEn, SIGNATURES.supervisor.name, SIGNATURES.supervisor.nameEn, "sig-supervisor")}
      ${block(SIGNATURES.manager.title, SIGNATURES.manager.titleEn, SIGNATURES.manager.name, SIGNATURES.manager.nameEn, "sig-manager")}
    </section>`;
}

/**
 * تنسيقات التقارير المالية (تُضاف إلى BASE_STYLES عبر extraCss)
 * - صفوف الإجمالي داخل tbody حتى لا يتكرر الإجمالي أسفل كل صفحة عند الطباعة
 * - رأس الجدول يتكرر في كل صفحة، والصفوف لا تنقسم بين صفحتين
 * - رقم الصفحة في الهامش السفلي (المتصفحات التي لا تدعم هوامش الصفحة تتجاهله)
 */
export const FINANCIAL_REPORT_STYLES = `
  @page { @bottom-center { content: "صفحة " counter(page) " من " counter(pages); font-size: 8px; color: #8a8f98; } }
  .title-row .info-box { display: flex; flex-direction: column; }
  .title-row .info-box .val { flex: 1; display: flex; align-items: center; justify-content: center; padding: 2px 4px; }
  .info-box .val.small { font-size: 11px; }

  .cards { display: grid; gap: 6px; margin: 2px 0 8px; break-inside: avoid; page-break-inside: avoid; }
  .card { border: 1px solid #cfd6df; border-top: 3px solid ${DOC_GOLD}; border-radius: 4px; padding: 3px 8px 4px; text-align: center; background: #ffffff; min-width: 0; }
  .card-lbl { font-size: 9.5px; color: #5b6573; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .card-val { font-size: 14px; font-weight: 700; color: ${DOC_ACCENT}; line-height: 1.35; white-space: nowrap; }
  .card-val small { font-size: 9px; font-weight: 600; color: #5b6573; margin-right: 3px; }
  .card-hint { font-size: 8.5px; color: #5b6573; line-height: 1.3; }
  .card.main { background: ${DOC_ACCENT}; border-color: ${DOC_ACCENT}; border-top-color: ${DOC_GOLD}; }
  .card.main .card-lbl, .card.main .card-hint, .card.main .card-val small { color: #dbe3ee; }
  .card.main .card-val { color: #ffffff; }

  .block { margin-bottom: 8px; }
  .block-title { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 11.5px; font-weight: 700; color: ${DOC_ACCENT}; border-bottom: 1.5px solid ${DOC_ACCENT}; padding-bottom: 1px; margin-bottom: 3px; break-after: avoid; page-break-after: avoid; }
  .block-title .meta { font-size: 10px; font-weight: 600; color: #3f4753; white-space: nowrap; }
  .block-title .meta .ltr { font-weight: 700; color: ${DOC_ACCENT}; }

  table.fin.report { font-size: 10.5px; }
  table.fin.report thead { display: table-header-group; }
  table.fin.report th { padding: 2px 5px; font-size: 10px; }
  table.fin.report th.num { text-align: left; }
  table.fin.report th.c, table.fin.report td.c { text-align: center; }
  table.fin.report td { padding: 1px 5px; line-height: 1.45; vertical-align: middle; }
  table.fin.report tbody tr:nth-child(even) td { background: #f7f9fc; }
  table.fin.report td.amt { font-weight: 600; }
  table.fin.report td.amt.strong { font-weight: 700; color: ${DOC_ACCENT}; }
  table.fin.report td.muted { color: #9aa0a9; font-weight: 400; }
  table.fin.report td.date { direction: ltr; text-align: right; unicode-bidi: isolate; white-space: nowrap; }
  table.fin.report td.ref { direction: ltr; text-align: right; unicode-bidi: isolate; white-space: nowrap; font-size: 9.5px; color: #3f4753; }
  table.fin.report td.wrap { overflow-wrap: anywhere; }
  table.fin.report td.nowrap { white-space: nowrap; }
  table.fin.report tr.total-row td { background: ${DOC_ACCENT_SOFT} !important; font-weight: 700; border-top: 2px solid ${DOC_ACCENT}; font-size: 11px; }
  table.fin.report tr.total-row td.amt { color: ${DOC_ACCENT}; }
  table.fin.report tr.group-row td { background: #e3eaf3 !important; color: ${DOC_ACCENT}; font-weight: 700; font-size: 10.5px; border-top: 1.5px solid #9fb0c6; }
  table.fin.report tr.group-row .group-meta { font-size: 9.5px; font-weight: 600; color: #5b6573; }
  table.fin.report tr.group-row { break-after: avoid; page-break-after: avoid; }
  table.fin.report tr.subtotal-row td { background: #f3f6fa !important; font-weight: 700; font-size: 10px; color: #3f4753; border-top: 1px solid #9fb0c6; }
  table.fin.report tr.subtotal-row td.amt { color: ${DOC_ACCENT}; }
  table.fin.report tr.subtotal-row { break-before: avoid; page-break-before: avoid; }
  .ok { color: #065f46; font-weight: 700; }
  .bad { color: ${DOC_NEGATIVE}; font-weight: 700; }

  .report-note { margin: 3px 0 6px; padding: 3px 9px; border-right: 3px solid ${DOC_GOLD}; background: #fbf8f2; font-size: 10px; color: #3f4753; line-height: 1.6; break-inside: avoid; page-break-inside: avoid; }
  .filters { display: flex; flex-wrap: wrap; gap: 4px 14px; margin: -2px 0 6px; padding: 2px 9px; border: 1px solid #cfd6df; border-radius: 4px; font-size: 10px; color: #3f4753; background: #fbfcfe; }
  .filters b { color: #111111; }

  .grand { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 4px 0 6px; padding: 5px 12px; border: 1.5px solid ${DOC_ACCENT}; border-radius: 5px; background: ${DOC_ACCENT_SOFT}; break-inside: avoid; page-break-inside: avoid; }
  .grand-lbl { font-size: 12px; font-weight: 700; color: ${DOC_ACCENT}; }
  .grand-words { font-size: 9.5px; color: #3f4753; }
  .grand-val { font-size: 17px; font-weight: 700; color: ${DOC_ACCENT}; white-space: nowrap; }
  .grand-val small { font-size: 10px; font-weight: 600; color: #5b6573; margin-right: 4px; }

  .report-signers { margin-top: 12px; }
  .report-signers .sig-blank { height: 34px; }
  .report-signers .sig-title .en { display: block; }
`;
