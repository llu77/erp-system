/**
 * تقرير المصاريف الشهري الرسمي (صفحة A4 RTL) - يُولَّد PDF في الخادم لصفحة المصاريف والتقارير الشهرية
 * - المصاريف المعتمدة والمدفوعة فقط (نفس أرقام الأرباح والخسائر)
 * - الأقسام بالترتيب: مصاريف ثابتة (source = fixed)، رواتب (source = payroll)، ثم باقي المصاريف حسب التصنيف
 * - لكل قسم جدول بإجماليه، ثم الإجمالي العام بالأرقام والحروف
 * - الترويسة باسم مؤسسة الفرع، أو الهوية العامة لكل الفروع (مع عمود الفرع)
 * - جميع النصوص المُدخلة من المستخدم تُهرّب قبل إدراجها في HTML
 */

import type { Establishment } from "./branding";
import {
  EXPENSE_CATEGORIES,
  FIXED_EXPENSES_SECTION_TITLE,
  expenseCategoryLabel,
  expensePaymentMethodLabel,
} from "./expenses";
import { amountToArabicWords, roundMoney, toVoucherDateString } from "./vouchers";
import {
  arabicMonthName,
  buildEmployeeDocContext,
  dateText,
  esc,
  money,
  present,
  renderDocumentShell,
  renderFooter,
  type EmployeeDocumentBaseOptions,
} from "./employeeDocumentBase";
import {
  FINANCIAL_REPORT_STYLES,
  monthDateRange,
  reportBranchLabel,
  reportRangeText,
  renderReportSigners,
  renderReportTitleRow,
  renderSummaryCards,
} from "./financialReportBase";

export const EXPENSE_REPORT_TITLE = "تقرير المصاريف";
export const PAYROLL_EXPENSES_SECTION_TITLE = "رواتب";
export const OTHER_EXPENSES_SECTION_TITLE = "مصاريف أخرى حسب التصنيف";

/** حالات المصروف التي يشملها التقرير */
export const EXPENSE_REPORT_STATUSES = ["approved", "paid"] as const;
export type ExpenseReportStatus = (typeof EXPENSE_REPORT_STATUSES)[number];

const STATUS_LABELS: Record<ExpenseReportStatus, string> = {
  approved: "المعتمدة",
  paid: "المدفوعة",
};

export function isReportedExpenseStatus(status: string | null | undefined): status is ExpenseReportStatus {
  return (EXPENSE_REPORT_STATUSES as readonly string[]).includes(String(status ?? ""));
}

/** صف مصروف (من جدول expenses) */
export interface ExpenseReportRow {
  expenseNumber: string;
  title: string;
  category: string | null;
  /** manual / fixed / payroll */
  source?: string | null;
  amount: unknown;
  expenseDate: Date | string;
  paymentMethod?: string | null;
  status: string;
  branchName?: string | null;
}

export interface ExpenseReportData {
  year: number;
  month: number;
  /** اسم الفرع، أو null لكل الفروع (الهوية العامة) */
  branchName: string | null;
  rows: ExpenseReportRow[];
  /** فلتر التصنيف (اختياري) */
  category?: string | null;
  /** فلتر الحالة: معتمد أو مدفوع فقط (الافتراضي: الاثنان) */
  status?: ExpenseReportStatus | null;
  /** اسم من أصدر التقرير (سطر "أعدّه") */
  preparedByName?: string | null;
  /** الجهة المُصدرة (الافتراضي: مؤسسة اسم الفرع، أو الهوية العامة لكل الفروع) */
  establishment?: Establishment | null;
}

export type ExpenseReportSectionKind = "fixed" | "payroll" | "category";

export interface ExpenseReportSection {
  key: string;
  kind: ExpenseReportSectionKind;
  title: string;
  rows: ExpenseReportRow[];
  total: number;
}

export interface ExpenseReportSummary {
  sections: ExpenseReportSection[];
  totals: { total: number; fixed: number; salaries: number; other: number; count: number };
}

function sortRows(rows: ExpenseReportRow[]): ExpenseReportRow[] {
  return [...rows].sort((a, b) => {
    const da = toVoucherDateString(a.expenseDate ?? null) ?? "";
    const dbb = toVoucherDateString(b.expenseDate ?? null) ?? "";
    return da.localeCompare(dbb) || String(a.expenseNumber).localeCompare(String(b.expenseNumber));
  });
}

function sectionTotal(rows: ExpenseReportRow[]): number {
  return roundMoney(rows.reduce((s, r) => s + roundMoney(r.amount), 0));
}

/**
 * أقسام التقرير (المعتمدة والمدفوعة فقط):
 * مصاريف ثابتة، رواتب، ثم باقي التصنيفات بترتيب قائمة التصنيفات
 * - القسمان الثابت والرواتب يظهران دائماً (ولو فارغين) إلا عند فلترة تصنيف
 */
export function buildExpenseReportSections(
  rows: ExpenseReportRow[],
  options: { keepEmptyFixedSections?: boolean } = {}
): ExpenseReportSummary {
  const counted = rows.filter(r => isReportedExpenseStatus(r.status));
  const fixed = counted.filter(r => r.source === "fixed");
  const payroll = counted.filter(r => r.source === "payroll");
  const other = counted.filter(r => r.source !== "fixed" && r.source !== "payroll");

  const sections: ExpenseReportSection[] = [];
  const keepEmpty = options.keepEmptyFixedSections !== false;
  if (fixed.length > 0 || keepEmpty) {
    sections.push({ key: "fixed", kind: "fixed", title: FIXED_EXPENSES_SECTION_TITLE, rows: sortRows(fixed), total: sectionTotal(fixed) });
  }
  if (payroll.length > 0 || keepEmpty) {
    sections.push({ key: "payroll", kind: "payroll", title: PAYROLL_EXPENSES_SECTION_TITLE, rows: sortRows(payroll), total: sectionTotal(payroll) });
  }

  const byCategory = new Map<string, ExpenseReportRow[]>();
  for (const row of other) {
    const category = present(row.category) ?? "other";
    byCategory.set(category, [...(byCategory.get(category) ?? []), row]);
  }
  const order = (c: string) => {
    const i = (EXPENSE_CATEGORIES as readonly string[]).indexOf(c);
    return i === -1 ? EXPENSE_CATEGORIES.length : i;
  };
  const categories = Array.from(byCategory.keys()).sort((a, b) => order(a) - order(b) || a.localeCompare(b));
  for (const category of categories) {
    const list = byCategory.get(category) ?? [];
    sections.push({
      key: `category:${category}`,
      kind: "category",
      title: expenseCategoryLabel(category),
      rows: sortRows(list),
      total: sectionTotal(list),
    });
  }

  const fixedTotal = sectionTotal(fixed);
  const salaries = sectionTotal(payroll);
  const otherTotal = sectionTotal(other);
  return {
    sections,
    totals: {
      total: roundMoney(fixedTotal + salaries + otherTotal),
      fixed: fixedTotal,
      salaries,
      other: otherTotal,
      count: counted.length,
    },
  };
}

/** مرجع التقرير في الذيل: EXP-2026-10 */
export function expenseReportReference(data: Pick<ExpenseReportData, "year" | "month">): string {
  return `EXP-${data.year}-${String(data.month).padStart(2, "0")}`;
}

/** عدد البنود بصيغة عربية سليمة: بند واحد، بندان، 3 بنود، 11 بنداً */
export function itemsCountText(count: number): string {
  if (count === 1) return "بند واحد";
  if (count === 2) return "بندان";
  if (count >= 3 && count <= 10) return `${count} بنود`;
  if (count === 0) return "لا بنود";
  return `${count} بنداً`;
}

function emptySectionText(kind: ExpenseReportSectionKind): string {
  if (kind === "fixed") return "لا توجد مصاريف ثابتة معتمدة لهذا الشهر";
  if (kind === "payroll") return "لا يوجد مسير رواتب معتمد لهذا الشهر";
  return "لا توجد مصاريف أخرى معتمدة لهذا الشهر";
}

/** أعمدة جداول التفاصيل (نفس العرض في كل الأقسام) */
function detailTableStart(withBranch: boolean): string {
  return `
      <table class="fin report detail">
        <colgroup>
          <col style="width: 12%" />
          <col style="width: ${withBranch ? 14 : 15}%" />
          <col />
          <col style="width: ${withBranch ? 13 : 15}%" />
          ${withBranch ? `<col style="width: 10%" />` : ""}
          <col style="width: ${withBranch ? 11 : 12}%" />
          <col style="width: 13%" />
        </colgroup>
        <thead>
          <tr>
            <th>التاريخ</th>
            <th>رقم المصروف</th>
            <th>البيان</th>
            <th>التصنيف</th>
            ${withBranch ? "<th>الفرع</th>" : ""}
            <th>طريقة الدفع</th>
            <th class="num">المبلغ</th>
          </tr>
        </thead>
        <tbody>`;
}

function detailRows(rows: ExpenseReportRow[], withBranch: boolean): string {
  return rows
    .map(
      r => `
          <tr>
            <td class="date">${esc(dateText(r.expenseDate))}</td>
            <td class="ref">${esc(r.expenseNumber)}</td>
            <td class="wrap">${esc(r.title)}</td>
            <td class="nowrap">${esc(expenseCategoryLabel(r.category))}</td>
            ${withBranch ? `<td class="nowrap">${esc(present(r.branchName) ?? "-")}</td>` : ""}
            <td class="nowrap">${esc(expensePaymentMethodLabel(r.paymentMethod))}</td>
            <td class="amt">${money(r.amount)}</td>
          </tr>`
    )
    .join("");
}

function blockTitle(title: string, count: number, total: number): string {
  return `
      <div class="block-title">
        <span>${esc(title)}</span>
        <span class="meta">${esc(itemsCountText(count))} &nbsp;|&nbsp; الإجمالي: <span class="ltr">${money(total)}</span> ر.س</span>
      </div>`;
}

/** قسم المصاريف الثابتة أو الرواتب: جدول واحد بإجماليه */
function renderSourceSection(section: ExpenseReportSection, withBranch: boolean): string {
  const cols = withBranch ? 7 : 6;
  const rows =
    section.rows.length > 0
      ? detailRows(section.rows, withBranch)
      : `
          <tr><td colspan="${cols}" class="empty">${esc(emptySectionText(section.kind))}</td></tr>`;
  return `
    <section class="block expense-section section-${section.kind}">
      ${blockTitle(section.title, section.rows.length, section.total)}
      ${detailTableStart(withBranch)}${rows}
          <tr class="total-row">
            <td colspan="${cols - 1}">إجمالي ${esc(section.title)}</td>
            <td class="amt">${money(section.total)}</td>
          </tr>
        </tbody>
      </table>
    </section>`;
}

/** باقي المصاريف في جدول واحد مجمّع حسب التصنيف: صف عنوان لكل تصنيف ثم بنوده ثم إجماليه */
function renderCategorySections(sections: ExpenseReportSection[], withBranch: boolean): string {
  const cols = withBranch ? 7 : 6;
  const count = sections.reduce((s, x) => s + x.rows.length, 0);
  const total = roundMoney(sections.reduce((s, x) => s + x.total, 0));
  const groups =
    sections.length > 0
      ? sections
          .map(
            section => `
          <tr class="group-row">
            <td colspan="${cols}">${esc(section.title)} <span class="group-meta">(${esc(itemsCountText(section.rows.length))})</span></td>
          </tr>${detailRows(section.rows, withBranch)}
          <tr class="subtotal-row">
            <td colspan="${cols - 1}">إجمالي ${esc(section.title)}</td>
            <td class="amt">${money(section.total)}</td>
          </tr>`
          )
          .join("")
      : `
          <tr><td colspan="${cols}" class="empty">${esc(emptySectionText("category"))}</td></tr>`;
  return `
    <section class="block expense-section section-category">
      ${blockTitle(OTHER_EXPENSES_SECTION_TITLE, count, total)}
      ${detailTableStart(withBranch)}${groups}
          <tr class="total-row">
            <td colspan="${cols - 1}">إجمالي المصاريف الأخرى</td>
            <td class="amt">${money(total)}</td>
          </tr>
        </tbody>
      </table>
    </section>`;
}

function renderBreakdown(summary: ExpenseReportSummary): string {
  const total = summary.totals.total;
  const rows = summary.sections
    .map(
      s => `
          <tr>
            <td>${esc(s.title)}</td>
            <td class="c">${s.rows.length}</td>
            <td class="amt">${money(s.total)}</td>
            <td class="c ltr">${total > 0 ? ((s.total / total) * 100).toFixed(1) : "0.0"}%</td>
          </tr>`
    )
    .join("");
  return `
    <section class="block breakdown">
      <div class="block-title"><span>ملخص المصاريف حسب القسم</span><span class="meta">المبالغ بالريال السعودي</span></div>
      <table class="fin report">
        <colgroup><col /><col style="width: 14%" /><col style="width: 22%" /><col style="width: 14%" /></colgroup>
        <thead>
          <tr>
            <th>القسم</th>
            <th class="c">عدد البنود</th>
            <th class="num">المبلغ</th>
            <th class="c">النسبة</th>
          </tr>
        </thead>
        <tbody>${rows || `
          <tr><td colspan="4" class="empty">لا توجد مصاريف</td></tr>`}
          <tr class="total-row">
            <td>الإجمالي</td>
            <td class="c">${summary.totals.count}</td>
            <td class="amt">${money(total)}</td>
            <td class="c ltr">${total > 0 ? "100%" : "-"}</td>
          </tr>
        </tbody>
      </table>
    </section>`;
}

/** تقرير المصاريف الشهري (HTML كامل) */
export function renderExpenseReportHtml(
  data: ExpenseReportData,
  options: EmployeeDocumentBaseOptions = {}
): string {
  const ctx = buildEmployeeDocContext(data.branchName, "report", false, {
    ...options,
    establishment: options.establishment ?? data.establishment ?? undefined,
  });
  const category = present(data.category);
  const status = isReportedExpenseStatus(data.status) ? data.status : null;
  // عند فلترة الحالة لا يُحتسب إلا صفوفها
  const rows = status ? data.rows.filter(r => r.status === status) : data.rows;
  const summary = buildExpenseReportSections(category ? rows.filter(r => r.category === category) : rows, {
    keepEmptyFixedSections: !category,
  });
  const branchLabel = reportBranchLabel(data.branchName);
  const withBranch = !present(data.branchName);
  const period = `شهر ${arabicMonthName(data.month)} ${data.year}`;
  const range = monthDateRange(data.year, data.month);
  const t = summary.totals;

  const statusText = status ? `${STATUS_LABELS[status]} فقط` : "المعتمدة والمدفوعة فقط";
  const filters = `
    <div class="filters">
      <span>يشمل التقرير: <b>المصاريف ${esc(statusText)}</b></span>
      <span>التصنيف: <b>${category ? esc(expenseCategoryLabel(category)) : "جميع التصنيفات"}</b></span>
      <span>عدد البنود: <b class="ltr">${t.count}</b></span>
    </div>`;

  const grand = `
    <div class="grand">
      <div>
        <div class="grand-lbl">إجمالي المصاريف ${esc(statusText.replace(" فقط", ""))} - ${esc(period)}</div>
        <div class="grand-words">${esc(amountToArabicWords(t.total))}</div>
      </div>
      <div class="grand-val"><span class="ltr">${money(t.total)}</span><small>ريال سعودي</small></div>
    </div>`;

  const body = `
    ${renderReportTitleRow({
      titleAr: EXPENSE_REPORT_TITLE,
      titleEn: "EXPENSE REPORT",
      period,
      branchLabel,
      rangeText: reportRangeText(range.from, range.to),
    })}
    ${filters}
    ${renderSummaryCards([
      { label: "إجمالي المصاريف", value: money(t.total), unit: "ر.س", main: true },
      { label: FIXED_EXPENSES_SECTION_TITLE, value: money(t.fixed), unit: "ر.س" },
      { label: PAYROLL_EXPENSES_SECTION_TITLE, value: money(t.salaries), unit: "ر.س" },
      { label: "مصاريف أخرى", value: money(t.other), unit: "ر.س" },
    ])}
    ${renderBreakdown(summary)}
    ${summary.sections.filter(s => s.kind !== "category").map(s => renderSourceSection(s, withBranch)).join("")}
    ${renderCategorySections(summary.sections.filter(s => s.kind === "category"), withBranch)}
    ${grand}
    ${renderReportSigners(data.preparedByName)}`;

  return renderDocumentShell({
    ctx,
    title: `${EXPENSE_REPORT_TITLE} - ${branchLabel} - ${period}`,
    kind: "expense-report",
    watermark: "",
    body,
    footer: renderFooter(ctx, EXPENSE_REPORT_TITLE, "المرجع", expenseReportReference(data)),
    extraCss: FINANCIAL_REPORT_STYLES,
    autoPrint: options.autoPrint,
  });
}
