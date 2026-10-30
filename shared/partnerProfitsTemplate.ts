/**
 * بيان توزيع أرباح الشركاء الرسمي لفرع في شهر (صفحة A4 RTL) - يُولَّد PDF في الخادم
 * - الترويسة باسم مؤسسة الفرع (فرع لبن: قصه وتخفيف، فرع طويق: تدرج وتخفيف)
 * - الحساب: الإيرادات (نقدي + شبكة) - المصاريف (ثابتة + رواتب + أخرى) = الأرباح
 * - جدول الشركاء: النسبة والحصة وخانة توقيع فارغة لكل شريك، والإجمالي = الربح
 * - بدون صور توقيع أو ختم؛ الأرقام لاتينية وجميع النصوص تُهرّب قبل إدراجها في HTML
 */

import { ESTABLISHMENTS } from "./branding";
import { amountToArabicWords } from "./vouchers";
import {
  arabicMonthName,
  bi,
  buildEmployeeDocContext,
  daysText,
  esc,
  money,
  renderDocumentShell,
  renderFooter,
  DOC_ACCENT,
  DOC_ACCENT_SOFT,
  DOC_GOLD,
  DOC_NEGATIVE,
  type EmployeeDocumentBaseOptions,
} from "./employeeDocumentBase";
import {
  PARTNER_PROFITS_STATEMENT_TITLE,
  type PartnerProfitStatement,
} from "./partnerProfits";

const pad2 = (n: number) => String(n).padStart(2, "0");

/** فترة الشهر: 01/10/2026 - 31/10/2026 */
export function partnerProfitsPeriodRange(year: number, month: number): string {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `01/${pad2(month)}/${year} - ${pad2(lastDay)}/${pad2(month)}/${year}`;
}

function amountRow(label: string, details: string, amount: number): string {
  return `
          <tr>
            <td>${label}</td>
            <td class="calc">${details || "-"}</td>
            <td class="amt">${money(amount)}</td>
          </tr>`;
}

function renderRevenue(s: PartnerProfitStatement): string {
  const r = s.revenue;
  return `
    <section class="sec">
      <div class="sec-title">أولاً: الإيرادات</div>
      <table class="fin">
        <thead>
          <tr>
            <th class="col-item">${bi("البند", "Item")}</th>
            <th class="col-calc">${bi("البيان", "Details")}</th>
            <th class="col-amt">${bi("المبلغ", "SAR")}</th>
          </tr>
        </thead>
        <tbody>${amountRow("نقدي", "المقبوضات النقدية", r.cash)}${amountRow("شبكة", "مدفوعات الشبكة (البطاقات)", r.network)}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2">إجمالي الإيرادات <span class="sub">(الإيرادات اليومية للفرع: ${esc(daysText(r.days))})</span></td>
            <td class="amt">${money(r.total)}</td>
          </tr>
        </tfoot>
      </table>
    </section>`;
}

function renderExpenses(s: PartnerProfitStatement): string {
  const e = s.expenses;
  const p = e.payroll;
  const salariesDetails =
    p.count > 0
      ? `صافي ${p.count === 1 ? "المسير المعتمد" : `${p.count} مسيرات معتمدة`} <span class="ltr">${money(p.netSalary)}</span>` +
        (p.recoveredAdvances > 0
          ? ` + السلف المستردة <span class="ltr">${money(p.recoveredAdvances)}</span>`
          : "")
      : "لا يوجد مسير رواتب معتمد لهذا الشهر";
  const categories = e.byCategory.length
    ? `
      <div class="cat-box">
        <div class="cat-title">تفصيل المصاريف الثابتة والأخرى حسب التصنيف</div>
        <div class="cat-grid">${e.byCategory
          .map(
            c => `
          <div class="cat-item"><span>${esc(c.label)}</span><b class="ltr">${money(c.amount)}</b></div>`
          )
          .join("")}
        </div>
      </div>`
    : "";
  return `
    <section class="sec">
      <div class="sec-title">ثانياً: المصاريف</div>
      <table class="fin">
        <thead>
          <tr>
            <th class="col-item">${bi("البند", "Item")}</th>
            <th class="col-calc">${bi("البيان", "Details")}</th>
            <th class="col-amt">${bi("المبلغ", "SAR")}</th>
          </tr>
        </thead>
        <tbody>${amountRow("مصاريف ثابتة", "المصاريف الشهرية الثابتة المعتمدة", e.fixed)}${amountRow("رواتب", salariesDetails, e.salaries)}${amountRow("مصاريف أخرى", "المصاريف المعتمدة والمدفوعة الأخرى", e.other)}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2">إجمالي المصاريف</td>
            <td class="amt">${money(e.total)}</td>
          </tr>
        </tfoot>
      </table>${categories}
    </section>`;
}

function renderResult(s: PartnerProfitStatement): string {
  const loss = s.isLoss;
  const resultLabel = loss ? "صافي الخسارة" : "صافي الربح";
  return `
    <section class="sec">
      <div class="sec-title">ثالثاً: الأرباح = الإيرادات - المصاريف</div>
      <div class="formula">
        <div class="f-box"><div class="f-lbl">إجمالي الإيرادات</div><div class="f-val ltr">${money(s.revenue.total)}</div></div>
        <div class="f-op">-</div>
        <div class="f-box"><div class="f-lbl">إجمالي المصاريف</div><div class="f-val ltr">${money(s.expenses.total)}</div></div>
        <div class="f-op">=</div>
        <div class="f-box result${loss ? " loss" : ""}"><div class="f-lbl">${resultLabel}</div><div class="f-val ltr">${money(s.profit)}</div></div>
      </div>
      <div class="net${loss ? " negative" : ""}">
        <div class="net-lbl">${resultLabel}</div>
        <div class="net-val"><span class="ltr">${money(Math.abs(s.profit))}</span><small>ريال سعودي</small></div>
        <div class="net-words">${esc(amountToArabicWords(Math.abs(s.profit)))}</div>
      </div>
    </section>`;
}

function renderPartners(s: PartnerProfitStatement): string {
  const shareLabel = s.isLoss ? "حصة الخسارة" : "حصة الربح";
  const rows = s.partners
    .map(
      (p, i) => `
          <tr>
            <td class="num">${i + 1}</td>
            <td class="partner">${esc(p.name)}</td>
            <td class="pct ltr">${esc(p.percent)}%</td>
            <td class="amt">${money(p.amount)}</td>
            <td class="sign-cell"><div class="sign-blank"></div></td>
          </tr>`
    )
    .join("");
  const totalPercent = s.partners.reduce((sum, p) => sum + p.percent, 0);
  return `
    <section class="sec">
      <div class="sec-title">رابعاً: توزيع ${s.isLoss ? "الخسارة" : "الأرباح"} على الشركاء</div>
      <table class="fin partners${s.isLoss ? " loss" : ""}">
        <thead>
          <tr>
            <th class="col-num">م</th>
            <th class="col-partner">${bi("الشريك", "Partner")}</th>
            <th class="col-pct">${bi("النسبة", "Share")}</th>
            <th class="col-amt">${bi(shareLabel, "SAR")}</th>
            <th class="col-sign">${bi("توقيع الشريك", "Signature")}</th>
          </tr>
        </thead>
        <tbody>${rows}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2">الإجمالي (= ${s.isLoss ? "صافي الخسارة" : "صافي الربح"})</td>
            <td class="pct ltr">${esc(totalPercent)}%</td>
            <td class="amt">${money(s.profit)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </section>`;
}

/** بيان توزيع أرباح الشركاء (HTML كامل، صفحة A4 واحدة) */
export function renderPartnerProfitsHtml(
  s: PartnerProfitStatement,
  options: EmployeeDocumentBaseOptions = {}
): string {
  const ctx = buildEmployeeDocContext(s.branchName, "statement", false, {
    ...options,
    establishment: options.establishment ?? ESTABLISHMENTS[s.establishmentKey],
  });
  const title = PARTNER_PROFITS_STATEMENT_TITLE;
  const monthYear = `${arabicMonthName(s.month)} ${s.year}`;

  const body = `
    <div class="title-row">
      <div class="info-box">
        <div class="lbl">${bi("الفرع", "Branch")}</div>
        <div class="val">${esc(s.branchName)}</div>
      </div>
      <div class="doc-title">
        <h1>${esc(title)}</h1>
        <h2>PARTNERS PROFIT DISTRIBUTION</h2>
        <div class="period">شهر ${esc(monthYear)}</div>
        <div class="title-rule"></div>
      </div>
      <div class="info-box">
        <div class="lbl">${bi("الفترة", "Period")}</div>
        <div class="val ltr small">${esc(partnerProfitsPeriodRange(s.year, s.month))}</div>
      </div>
    </div>

    ${renderRevenue(s)}
    ${renderExpenses(s)}
    ${renderResult(s)}
    ${renderPartners(s)}
    <div class="calc-note">
      أساس الحساب: الإيرادات = النقدي + الشبكة من الإيرادات اليومية للفرع خلال الشهر.
      المصاريف = المصاريف المعتمدة والمدفوعة بتاريخها خلال الشهر + الرواتب (صافي مسيرات الشهر المعتمدة والمدفوعة + السلف المستردة فيها).
      يوزَّع ${s.isLoss ? "صافي الخسارة" : "صافي الربح"} على الشركاء حسب نسبهم، وفروق الهللات لصاحب النسبة الأكبر.
    </div>`;

  return renderDocumentShell({
    ctx,
    title: `${title} - ${s.branchName} - ${monthYear}`,
    kind: "partner-profits",
    watermark: "",
    body,
    footer: renderFooter(ctx, title, "الشهر", `${pad2(s.month)}/${s.year}`),
    extraCss: PARTNER_PROFITS_STYLES,
    autoPrint: options.autoPrint,
  });
}

const PARTNER_PROFITS_STYLES = `
  .info-box .val { font-size: 12px; }
  .info-box .val.small { font-size: 11px; padding-top: 3px; }
  .sec { margin-bottom: 9px; }
  .sec-title { font-size: 12px; margin-bottom: 4px; }
  table.fin { font-size: 11.5px; }
  table.fin td { padding: 3px 7px; }
  table.fin td.calc { font-size: 10.5px; color: #3f4753; }
  table.fin tfoot td { font-size: 12px; }

  .cat-box { margin-top: 5px; border: 1px solid #cfd6df; border-radius: 4px; padding: 3px 8px 4px; background: #fbfcfe; }
  .cat-title { font-size: 10px; font-weight: 700; color: #5b6573; margin-bottom: 2px; }
  .cat-grid { display: grid; grid-template-columns: repeat(3, 1fr); column-gap: 14px; }
  .cat-item { display: flex; justify-content: space-between; gap: 6px; font-size: 10.5px; border-bottom: 1px dotted #d5dbe3; padding: 1px 0; }
  .cat-item b { font-weight: 700; white-space: nowrap; }

  .formula { display: flex; align-items: stretch; gap: 6px; margin-bottom: 6px; }
  .f-box { flex: 1; border: 1.5px solid ${DOC_ACCENT}; border-radius: 6px; text-align: center; overflow: hidden; }
  .f-lbl { background: ${DOC_ACCENT_SOFT}; color: ${DOC_ACCENT}; font-size: 11px; font-weight: 700; padding: 2px 4px; border-bottom: 1px solid #c7d3e3; }
  .f-val { font-size: 15px; font-weight: 700; padding: 3px 4px; }
  .f-op { align-self: center; font-size: 20px; font-weight: 700; color: ${DOC_GOLD}; padding: 0 2px; }
  .f-box.result { border-color: #047857; }
  .f-box.result .f-lbl { background: #ecfdf5; color: #065f46; border-bottom-color: #a7f3d0; }
  .f-box.result .f-val { color: #065f46; }
  .f-box.result.loss { border-color: ${DOC_NEGATIVE}; }
  .f-box.result.loss .f-lbl { background: #fef2f2; color: ${DOC_NEGATIVE}; border-bottom-color: #fecaca; }
  .f-box.result.loss .f-val { color: ${DOC_NEGATIVE}; }

  .net { display: flex; align-items: stretch; border: 2px solid ${DOC_ACCENT}; border-radius: 6px; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
  .net-lbl { background: ${DOC_ACCENT}; color: #fff; font-size: 12.5px; font-weight: 700; padding: 5px 12px; display: flex; align-items: center; white-space: nowrap; }
  .net-val { font-size: 18px; font-weight: 700; padding: 3px 12px; white-space: nowrap; display: flex; align-items: center; gap: 5px; border-left: 1px solid #cfd6df; }
  .net-val small { font-size: 10px; font-weight: 600; color: #5b6573; }
  .net-words { flex: 1; padding: 4px 12px; font-size: 11px; font-weight: 600; display: flex; align-items: center; background: ${DOC_ACCENT_SOFT}; }
  .net.negative { border-color: ${DOC_NEGATIVE}; }
  .net.negative .net-lbl { background: ${DOC_NEGATIVE}; }
  .net.negative .net-val { color: ${DOC_NEGATIVE}; }

  table.partners th.col-num { width: 5%; text-align: center; }
  table.partners th.col-partner { width: 27%; }
  table.partners th.col-pct { width: 12%; text-align: center; }
  table.partners th.col-amt { width: 20%; text-align: left; }
  table.partners td { padding: 9px 7px; vertical-align: middle; }
  table.partners td.num { text-align: center; color: #5b6573; }
  table.partners td.partner { font-size: 13px; font-weight: 700; }
  table.partners td.pct { text-align: center; font-weight: 700; }
  table.partners td.amt { font-size: 13px; }
  table.partners tfoot td { padding: 5px 7px; }
  table.partners.loss td.amt { color: ${DOC_NEGATIVE}; }
  .sign-blank { border-bottom: 1px solid #333; height: 22px; margin: 0 8px; }

  .calc-note { margin-top: 2px; padding: 4px 9px; border: 1px dashed #b9bec7; border-radius: 4px; font-size: 9.5px; color: #5b6573; line-height: 1.6; }
`;
