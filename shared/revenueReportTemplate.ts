/**
 * تقرير الإيرادات الرسمي (صفحة A4 RTL) - يُولَّد PDF في الخادم لصفحة الإيرادات والتقارير الشهرية
 * - الترويسة باسم مؤسسة الفرع (لبن -> قصه وتخفيف، طويق -> تدرج وتخفيف)، أو الهوية العامة لكل الفروع
 * - صف لكل يوم: النقدي، الشبكة، الإجمالي، فواتير المدفوع، الولاء، المطابقة؛ وصف الإجمالي في الأسفل
 * - الإيراد الرسمي = النقدي + الشبكة (نفس رقم الأرباح والخسائر)؛ فواتير المدفوع والولاء للعلم فقط
 * - لكل الفروع: صفوف الأيام مجمّعة لكل الفروع مع جدول الإيرادات حسب الفرع
 * - جميع النصوص المُدخلة من المستخدم تُهرّب قبل إدراجها في HTML
 */

import type { Establishment } from "./branding";
import { roundMoney, toVoucherDateString } from "./vouchers";
import {
  arabicMonthName,
  buildEmployeeDocContext,
  dateText,
  daysText,
  esc,
  money,
  present,
  renderDocumentShell,
  renderFooter,
  type EmployeeDocumentBaseOptions,
} from "./employeeDocumentBase";
import { arabicWeekdayName } from "./endOfServiceTemplate";
import {
  FINANCIAL_REPORT_STYLES,
  amountCell,
  reportBranchLabel,
  reportRangeText,
  renderReportSigners,
  renderReportTitleRow,
  renderSummaryCards,
} from "./financialReportBase";

export const REVENUE_REPORT_TITLE = "تقرير الإيرادات";

/** صف إيراد يومي (صف dailyRevenues لفرع في يوم) */
export interface RevenueReportRow {
  date: Date | string;
  branchId?: number | null;
  branchName?: string | null;
  cash: unknown;
  network: unknown;
  paidInvoices?: unknown;
  loyalty?: unknown;
  isMatched?: boolean | null;
}

export interface RevenueReportEmployeeRow {
  name: string;
  code?: string | null;
  total: unknown;
}

export interface RevenueReportData {
  /** اسم الفرع، أو null لكل الفروع (الهوية العامة) */
  branchName: string | null;
  /** الفترة YYYY-MM-DD (شاملة) */
  from: string;
  to: string;
  /** شهر التقرير عندما تكون الفترة شهراً كاملاً */
  year?: number | null;
  month?: number | null;
  rows: RevenueReportRow[];
  /** إيرادات الموظفين في الفترة (اختياري) */
  employees?: RevenueReportEmployeeRow[] | null;
  /** اسم من أصدر التقرير (سطر "أعدّه") */
  preparedByName?: string | null;
  /** الجهة المُصدرة (الافتراضي: مؤسسة اسم الفرع، أو الهوية العامة لكل الفروع) */
  establishment?: Establishment | null;
}

export interface RevenueReportDay {
  /** YYYY-MM-DD */
  date: string;
  cash: number;
  network: number;
  /** الإيراد الرسمي = النقدي + الشبكة */
  total: number;
  paidInvoices: number;
  loyalty: number;
  /** عدد صفوف الفروع في اليوم */
  entries: number;
  /** عدد صفوف الفروع غير المتطابقة */
  unmatched: number;
}

export interface RevenueReportBranch {
  name: string;
  days: number;
  cash: number;
  network: number;
  total: number;
}

export interface RevenueReportSummary {
  days: RevenueReportDay[];
  branches: RevenueReportBranch[];
  totals: {
    cash: number;
    network: number;
    total: number;
    paidInvoices: number;
    loyalty: number;
    days: number;
    unmatchedDays: number;
    dailyAverage: number;
  };
}

/** تجميع صفوف الإيرادات: صف لكل يوم (لكل الفروع) والإجماليات وإيرادات كل فرع */
export function summarizeRevenueReport(rows: RevenueReportRow[]): RevenueReportSummary {
  const dayMap = new Map<string, RevenueReportDay>();
  const branchMap = new Map<string, RevenueReportBranch & { dates: Set<string> }>();
  for (const row of rows) {
    const date = toVoucherDateString(row.date ?? null);
    if (!date) continue;
    const cash = roundMoney(row.cash);
    const network = roundMoney(row.network);
    const day = dayMap.get(date) ?? {
      date,
      cash: 0,
      network: 0,
      total: 0,
      paidInvoices: 0,
      loyalty: 0,
      entries: 0,
      unmatched: 0,
    };
    day.cash = roundMoney(day.cash + cash);
    day.network = roundMoney(day.network + network);
    day.total = roundMoney(day.cash + day.network);
    day.paidInvoices = roundMoney(day.paidInvoices + roundMoney(row.paidInvoices));
    day.loyalty = roundMoney(day.loyalty + roundMoney(row.loyalty));
    day.entries += 1;
    if (row.isMatched === false) day.unmatched += 1;
    dayMap.set(date, day);

    const branchKey = row.branchId != null ? `id:${row.branchId}` : `name:${present(row.branchName) ?? ""}`;
    const branch = branchMap.get(branchKey) ?? {
      name: present(row.branchName) ?? (row.branchId != null ? `فرع رقم ${row.branchId}` : "-"),
      days: 0,
      cash: 0,
      network: 0,
      total: 0,
      dates: new Set<string>(),
    };
    branch.cash = roundMoney(branch.cash + cash);
    branch.network = roundMoney(branch.network + network);
    branch.total = roundMoney(branch.cash + branch.network);
    branch.dates.add(date);
    branch.days = branch.dates.size;
    branchMap.set(branchKey, branch);
  }

  const days = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  const branches = Array.from(branchMap.values())
    .map(({ dates: _dates, ...b }) => b)
    .sort((a, b) => b.total - a.total);
  const cash = roundMoney(days.reduce((s, d) => s + d.cash, 0));
  const network = roundMoney(days.reduce((s, d) => s + d.network, 0));
  const total = roundMoney(cash + network);
  return {
    days,
    branches,
    totals: {
      cash,
      network,
      total,
      paidInvoices: roundMoney(days.reduce((s, d) => s + d.paidInvoices, 0)),
      loyalty: roundMoney(days.reduce((s, d) => s + d.loyalty, 0)),
      days: days.length,
      unmatchedDays: days.filter(d => d.unmatched > 0).length,
      dailyAverage: days.length > 0 ? roundMoney(total / days.length) : 0,
    },
  };
}

/** سطر الفترة: "شهر أكتوبر 2026" للشهر الكامل، وإلا "من 01/10/2026 إلى 15/10/2026" */
export function revenueReportPeriodText(data: Pick<RevenueReportData, "from" | "to" | "year" | "month">): string {
  if (data.year && data.month) return `شهر ${arabicMonthName(data.month)} ${data.year}`;
  return `من ${dateText(data.from)} إلى ${dateText(data.to)}`;
}

/** مرجع التقرير في الذيل: REV-2026-10 أو REV-20261001-20261015 */
export function revenueReportReference(data: Pick<RevenueReportData, "from" | "to" | "year" | "month">): string {
  if (data.year && data.month) return `REV-${data.year}-${String(data.month).padStart(2, "0")}`;
  return `REV-${data.from.replace(/-/g, "")}-${data.to.replace(/-/g, "")}`;
}

function renderBranches(summary: RevenueReportSummary): string {
  const total = summary.totals.total;
  const rows = summary.branches
    .map(
      b => `
          <tr>
            <td>${esc(b.name)}</td>
            <td class="c">${b.days}</td>
            ${amountCell(b.cash)}
            ${amountCell(b.network)}
            <td class="amt strong">${money(b.total)}</td>
            <td class="c ltr">${total > 0 ? ((b.total / total) * 100).toFixed(1) : "0.0"}%</td>
          </tr>`
    )
    .join("");
  return `
    <section class="block">
      <div class="block-title"><span>الإيرادات حسب الفرع</span></div>
      <table class="fin report">
        <thead>
          <tr>
            <th>الفرع</th>
            <th class="c">الأيام</th>
            <th class="num">النقدي</th>
            <th class="num">الشبكة</th>
            <th class="num">الإجمالي</th>
            <th class="c">النسبة</th>
          </tr>
        </thead>
        <tbody>${rows}
          <tr class="total-row">
            <td colspan="2">الإجمالي</td>
            ${amountCell(summary.totals.cash)}
            ${amountCell(summary.totals.network)}
            <td class="amt">${money(total)}</td>
            <td class="c ltr">${total > 0 ? "100%" : "-"}</td>
          </tr>
        </tbody>
      </table>
    </section>`;
}

function matchCell(day: RevenueReportDay, multiBranch: boolean): string {
  if (day.unmatched === 0) return `<td class="c ok">متطابق</td>`;
  const count = multiBranch && day.entries > 1 ? ` (${day.unmatched})` : "";
  return `<td class="c bad">غير متطابق${count}</td>`;
}

function renderDays(summary: RevenueReportSummary, multiBranch: boolean): string {
  const t = summary.totals;
  const rows =
    summary.days.length > 0
      ? summary.days
          .map(
            d => `
          <tr>
            <td class="date">${esc(dateText(d.date))}</td>
            <td class="nowrap">${esc(arabicWeekdayName(d.date) ?? "-")}</td>
            ${amountCell(d.cash)}
            ${amountCell(d.network)}
            <td class="amt strong">${money(d.total)}</td>
            ${amountCell(d.paidInvoices, true)}
            ${amountCell(d.loyalty, true)}
            ${matchCell(d, multiBranch)}
          </tr>`
          )
          .join("")
      : `
          <tr><td colspan="8" class="empty">لا توجد إيرادات مسجلة في هذه الفترة</td></tr>`;
  const matchTotal =
    t.days === 0
      ? "-"
      : t.unmatchedDays === 0
        ? `<span class="ok">كلها متطابقة</span>`
        : `<span class="bad">غير متطابق: ${esc(daysText(t.unmatchedDays))}</span>`;
  return `
    <section class="block">
      <div class="block-title">
        <span>التفصيل اليومي${multiBranch ? " (مجموع الفروع)" : ""}</span>
        <span class="meta">المبالغ بالريال السعودي</span>
      </div>
      <table class="fin report">
        <thead>
          <tr>
            <th>التاريخ</th>
            <th>اليوم</th>
            <th class="num">النقدي</th>
            <th class="num">الشبكة</th>
            <th class="num">الإجمالي</th>
            <th class="num">فواتير المدفوع</th>
            <th class="num">الولاء</th>
            <th class="c">المطابقة</th>
          </tr>
        </thead>
        <tbody>${rows}
          <tr class="total-row">
            <td colspan="2">الإجمالي (${esc(daysText(t.days))})</td>
            ${amountCell(t.cash)}
            ${amountCell(t.network)}
            <td class="amt">${money(t.total)}</td>
            ${amountCell(t.paidInvoices)}
            ${amountCell(t.loyalty)}
            <td class="c">${matchTotal}</td>
          </tr>
        </tbody>
      </table>
      <div class="report-note">
        الإيراد الرسمي = النقدي + الشبكة، وهو الرقم المعتمد في تقرير الأرباح والخسائر.
        فواتير المدفوع والولاء للعلم فقط ولا تدخل في الإجمالي.
      </div>
    </section>`;
}

function renderEmployees(employees: RevenueReportEmployeeRow[]): string {
  const list = employees
    .map(e => ({ name: e.name, code: present(e.code), total: roundMoney(e.total) }))
    .filter(e => e.total !== 0)
    .sort((a, b) => b.total - a.total);
  if (list.length === 0) return "";
  const sum = roundMoney(list.reduce((s, e) => s + e.total, 0));
  const rows = list
    .map(
      (e, i) => `
          <tr>
            <td class="c">${i + 1}</td>
            <td>${esc(e.name)}</td>
            <td class="ref">${e.code ? esc(e.code) : "-"}</td>
            <td class="amt">${money(e.total)}</td>
            <td class="c ltr">${sum > 0 ? ((e.total / sum) * 100).toFixed(1) : "0.0"}%</td>
          </tr>`
    )
    .join("");
  return `
    <section class="block">
      <div class="block-title"><span>الإيرادات حسب الموظف</span></div>
      <table class="fin report">
        <colgroup><col style="width: 6%" /><col /><col style="width: 20%" /><col style="width: 20%" /><col style="width: 12%" /></colgroup>
        <thead>
          <tr>
            <th class="c">#</th>
            <th>الموظف</th>
            <th>الرقم الوظيفي</th>
            <th class="num">الإيرادات</th>
            <th class="c">النسبة</th>
          </tr>
        </thead>
        <tbody>${rows}
          <tr class="total-row">
            <td colspan="3">إجمالي إيرادات الموظفين</td>
            <td class="amt">${money(sum)}</td>
            <td class="c ltr">${sum > 0 ? "100%" : "-"}</td>
          </tr>
        </tbody>
      </table>
    </section>`;
}

/** تقرير الإيرادات (HTML كامل) */
export function renderRevenueReportHtml(
  data: RevenueReportData,
  options: EmployeeDocumentBaseOptions = {}
): string {
  const ctx = buildEmployeeDocContext(data.branchName, "report", false, {
    ...options,
    establishment: options.establishment ?? data.establishment ?? undefined,
  });
  const summary = summarizeRevenueReport(data.rows);
  const multiBranch = !present(data.branchName) && summary.branches.length > 1;
  const branchLabel = reportBranchLabel(data.branchName);
  const period = revenueReportPeriodText(data);
  const t = summary.totals;

  const body = `
    ${renderReportTitleRow({
      titleAr: REVENUE_REPORT_TITLE,
      titleEn: "REVENUE REPORT",
      period,
      branchLabel,
      rangeText: reportRangeText(data.from, data.to),
    })}
    ${renderSummaryCards([
      { label: "الإيرادات (نقدي + شبكة)", value: money(t.total), unit: "ر.س", main: true },
      { label: "النقدي", value: money(t.cash), unit: "ر.س" },
      { label: "الشبكة", value: money(t.network), unit: "ر.س" },
      { label: "أيام العمل", value: String(t.days), unit: "يوم" },
      { label: "المتوسط اليومي", value: money(t.dailyAverage), unit: "ر.س" },
    ])}
    ${multiBranch ? renderBranches(summary) : ""}
    ${renderDays(summary, multiBranch)}
    ${data.employees && data.employees.length > 0 ? renderEmployees(data.employees) : ""}
    ${renderReportSigners(data.preparedByName)}`;

  return renderDocumentShell({
    ctx,
    title: `${REVENUE_REPORT_TITLE} - ${branchLabel} - ${period}`,
    kind: "revenue-report",
    watermark: "",
    body,
    footer: renderFooter(ctx, REVENUE_REPORT_TITLE, "المرجع", revenueReportReference(data)),
    extraCss: FINANCIAL_REPORT_STYLES,
    autoPrint: options.autoPrint,
  });
}
