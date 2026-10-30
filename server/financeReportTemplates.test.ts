import { describe, expect, it } from "vitest";
import { ESTABLISHMENTS, GROUP_ESTABLISHMENT, SIGNATURES } from "../shared/branding";
import { FIXED_EXPENSES_SECTION_TITLE } from "../shared/expenses";
import {
  monthDateRange,
  reportBranchLabel,
  ALL_BRANCHES_LABEL,
} from "../shared/financialReportBase";
import {
  renderRevenueReportHtml,
  revenueReportPeriodText,
  revenueReportReference,
  summarizeRevenueReport,
  type RevenueReportData,
  type RevenueReportRow,
} from "../shared/revenueReportTemplate";
import {
  buildExpenseReportSections,
  itemsCountText,
  renderExpenseReportHtml,
  type ExpenseReportData,
  type ExpenseReportRow,
} from "../shared/expenseReportTemplate";

const ASSETS = {
  logo: "",
  supervisorSignature: "data:image/png;base64,SUPERVISOR",
  managerSignature: "data:image/png;base64,MANAGER",
  stamp: "data:image/png;base64,STAMP",
  font: "data:font/ttf;base64,FONT",
};
const PRINTED_AT = new Date("2026-10-30T09:00:00Z");
const OPTIONS = { assets: ASSETS, printedAt: PRINTED_AT };

/** أرقام عربية-هندية (يجب ألا تظهر في التقارير) */
const ARABIC_INDIC_DIGITS = /[٠-٩۰-۹]/;

/** الحصول على نص الجدول/القسم بين علامتين */
function between(html: string, start: string, end: string): string {
  const a = html.indexOf(start);
  const b = html.indexOf(end, a + start.length);
  expect(a, `missing ${start}`).toBeGreaterThanOrEqual(0);
  expect(b, `missing ${end}`).toBeGreaterThan(a);
  return html.slice(a, b);
}

// ==================== تقرير الإيرادات ====================

function revRow(over: Partial<RevenueReportRow> = {}): RevenueReportRow {
  return {
    date: new Date(Date.UTC(2026, 9, 1)),
    branchId: 1,
    branchName: "فرع لبن",
    cash: "1000.00",
    network: "2500.50",
    paidInvoices: "0.00",
    loyalty: "0.00",
    isMatched: true,
    ...over,
  };
}

function revenueData(over: Partial<RevenueReportData> = {}): RevenueReportData {
  return {
    branchName: "فرع لبن",
    from: "2026-10-01",
    to: "2026-10-31",
    year: 2026,
    month: 10,
    rows: [
      revRow(),
      revRow({ date: new Date(Date.UTC(2026, 9, 2)), cash: "800", network: "1200", paidInvoices: "150", loyalty: "40", isMatched: false }),
      revRow({ date: new Date(Date.UTC(2026, 9, 31)), cash: "0", network: "3000" }),
    ],
    preparedByName: "أحمد المحاسب",
    ...over,
  };
}

describe("summarizeRevenueReport", () => {
  it("uses cash + network as the official revenue and keeps paid invoices / loyalty out of it", () => {
    const s = summarizeRevenueReport(revenueData().rows);
    expect(s.totals.cash).toBe(1800);
    expect(s.totals.network).toBe(6700.5);
    expect(s.totals.total).toBe(8500.5);
    expect(s.totals.paidInvoices).toBe(150);
    expect(s.totals.loyalty).toBe(40);
    expect(s.totals.days).toBe(3);
    expect(s.totals.unmatchedDays).toBe(1);
    expect(s.totals.dailyAverage).toBe(2833.5);
    expect(s.days.map(d => d.date)).toEqual(["2026-10-01", "2026-10-02", "2026-10-31"]);
    expect(s.days[1].total).toBe(2000);
  });

  it("merges branches into one row per day and totals each branch", () => {
    const rows = [
      revRow({ branchId: 1, branchName: "فرع لبن", cash: "100", network: "200" }),
      revRow({ branchId: 2, branchName: "فرع طويق", cash: "50", network: "25.25", isMatched: false }),
      revRow({ branchId: 2, branchName: "فرع طويق", date: "2026-10-05", cash: "10", network: "0" }),
    ];
    const s = summarizeRevenueReport(rows);
    expect(s.days).toHaveLength(2);
    expect(s.days[0]).toMatchObject({ date: "2026-10-01", cash: 150, network: 225.25, total: 375.25, entries: 2, unmatched: 1 });
    expect(s.branches.map(b => [b.name, b.days, b.total])).toEqual([
      ["فرع لبن", 1, 300],
      ["فرع طويق", 2, 85.25],
    ]);
    expect(s.totals.total).toBe(385.25);
  });

  it("returns zero totals without rows", () => {
    const s = summarizeRevenueReport([]);
    expect(s.totals).toMatchObject({ total: 0, days: 0, dailyAverage: 0 });
  });
});

describe("renderRevenueReportHtml", () => {
  it("renders an RTL A4 document with the branch establishment letterhead and embedded font", () => {
    const html = renderRevenueReportHtml(revenueData(), OPTIONS);
    expect(html).toContain('<html dir="rtl" lang="ar">');
    expect(html).toContain("size: A4");
    expect(html).toContain(ESTABLISHMENTS.qessa.nameAr);
    expect(html).toContain("7032291507");
    expect(html).not.toContain(ESTABLISHMENTS.tadarruj.nameAr);
    expect(html).toContain("data:font/ttf;base64,FONT");
    expect(html).not.toContain("fonts.googleapis.com");
    expect(html).not.toMatch(/symbol\s*ai/i);
    expect(html).toContain("تقرير الإيرادات");
    expect(html).toContain("شهر أكتوبر 2026");
    expect(html).toContain("01/10/2026 - 31/10/2026");
    expect(html).toContain("REV-2026-10");
  });

  it("maps فرع طويق to مؤسسة تدرج وتخفيف and all branches to the group identity", () => {
    expect(renderRevenueReportHtml(revenueData({ branchName: "فرع طويق" }), OPTIONS)).toContain(ESTABLISHMENTS.tadarruj.nameAr);
    const all = renderRevenueReportHtml(revenueData({ branchName: null }), OPTIONS);
    expect(all).toContain(GROUP_ESTABLISHMENT.nameAr);
    expect(all).toContain(ALL_BRANCHES_LABEL);
    // صريح: الجهة المُصدرة من البيانات تتقدم على اسم الفرع
    const explicit = renderRevenueReportHtml(revenueData({ branchName: "الفرع الرئيسي", establishment: ESTABLISHMENTS.tadarruj }), OPTIONS);
    expect(explicit).toContain(ESTABLISHMENTS.tadarruj.nameAr);
  });

  it("prints one row per day with date, weekday, amounts in Latin digits and a totals row", () => {
    const html = renderRevenueReportHtml(revenueData(), OPTIONS);
    expect(html).not.toMatch(ARABIC_INDIC_DIGITS);
    const table = between(html, "التفصيل اليومي", "report-note");
    expect(table).toContain("01/10/2026");
    expect(table).toContain("الخميس"); // 01/10/2026
    expect(table).toContain("31/10/2026");
    expect(table).toContain("السبت"); // 31/10/2026
    expect(table).toContain("3,500.50"); // 1000 + 2500.50
    expect(table).toContain("غير متطابق");
    // صف الإجمالي: النقدي والشبكة والإجمالي (بدون فواتير المدفوع والولاء)
    const totalRow = between(table, 'class="total-row"', "</tr>");
    expect(totalRow).toContain("الإجمالي (3 أيام)");
    expect(totalRow).toContain("1,800.00");
    expect(totalRow).toContain("6,700.50");
    expect(totalRow).toContain("8,500.50");
    expect(totalRow).toContain("150.00");
    expect(totalRow).toContain("40.00");
    expect(totalRow).toContain("غير متطابق: يوم واحد");
    // العمود بالترتيب المطلوب
    const head = between(table, "<thead>", "</thead>");
    const order = ["التاريخ", "اليوم", "النقدي", "الشبكة", "الإجمالي", "فواتير المدفوع", "الولاء", "المطابقة"].map(h => head.indexOf(`>${h}<`));
    expect(order.every(i => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toContain("الإيراد الرسمي = النقدي + الشبكة");
  });

  it("shows the summary cards: total, cash, network, days and daily average", () => {
    const cards = between(renderRevenueReportHtml(revenueData(), OPTIONS), 'class="cards"', "</section>");
    expect(cards).toContain("الإيرادات (نقدي + شبكة)");
    expect(cards).toContain("8,500.50");
    expect(cards).toContain("1,800.00");
    expect(cards).toContain("6,700.50");
    expect(cards).toContain("أيام العمل");
    expect(cards).toContain(">3<");
    expect(cards).toContain("2,833.50");
  });

  it("adds a branch table for all branches and the employees table when given", () => {
    const html = renderRevenueReportHtml(
      revenueData({
        branchName: null,
        rows: [revRow(), revRow({ branchId: 2, branchName: "فرع طويق" })],
        employees: [{ name: "محمد", code: "EMP-1", total: "500" }],
      }),
      OPTIONS
    );
    expect(html).toContain("الإيرادات حسب الفرع");
    expect(html).toContain("الإيرادات حسب الموظف");
    expect(html).toContain("التفصيل اليومي (مجموع الفروع)");
    const single = renderRevenueReportHtml(revenueData(), OPTIONS);
    expect(single).not.toContain("الإيرادات حسب الفرع");
    expect(single).not.toContain("الإيرادات حسب الموظف");
  });

  it("escapes user text (branch, employee and preparer names)", () => {
    const html = renderRevenueReportHtml(
      revenueData({
        branchName: '<img src=x onerror="alert(1)">',
        rows: [revRow({ branchName: "<b>x</b>" })],
        employees: [{ name: "<script>alert(1)</script>", code: '"><i>', total: "10" }],
        preparedByName: "<svg onload=alert(2)>",
      }),
      OPTIONS
    );
    expect(html).not.toContain("<script>alert(1)");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<svg onload");
    expect(html).not.toContain('"><i>');
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("has blank signature lines with the official names but no signature images or stamp", () => {
    const html = renderRevenueReportHtml(revenueData(), OPTIONS);
    const signers = between(html, "report-signers", "doc-footer");
    expect(signers).toContain("أعدّه");
    expect(signers).toContain("أحمد المحاسب");
    expect(signers).toContain(SIGNATURES.supervisor.title);
    expect(signers).toContain(SIGNATURES.supervisor.name);
    expect(signers).toContain(SIGNATURES.manager.title);
    expect(signers).toContain(SIGNATURES.manager.name);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("SUPERVISOR");
    expect(html).not.toContain("STAMP");
  });

  it("shows an empty-state row without revenues", () => {
    const html = renderRevenueReportHtml(revenueData({ rows: [] }), OPTIONS);
    expect(html).toContain("لا توجد إيرادات مسجلة في هذه الفترة");
    expect(html).toContain("0.00");
  });

  it("describes a custom date range", () => {
    const range = { from: "2026-10-05", to: "2026-10-12", year: null, month: null };
    expect(revenueReportPeriodText(range)).toBe("من 05/10/2026 إلى 12/10/2026");
    expect(revenueReportReference(range)).toBe("REV-20261005-20261012");
    expect(revenueReportReference({ ...range, year: 2026, month: 2 })).toBe("REV-2026-02");
  });
});

// ==================== تقرير المصاريف ====================

function expRow(over: Partial<ExpenseReportRow> = {}): ExpenseReportRow {
  return {
    expenseNumber: "EXP-2026-10-0001",
    title: "مصروف",
    category: "other",
    source: "manual",
    amount: "100.00",
    expenseDate: new Date(Date.UTC(2026, 9, 10)),
    paymentMethod: "cash",
    status: "approved",
    branchName: "فرع طويق",
    ...over,
  };
}

const EXPENSE_ROWS: ExpenseReportRow[] = [
  expRow({ expenseNumber: "FIX-1", title: "إيجار محل", category: "shop_rent", source: "fixed", amount: "3583", paymentMethod: "bank_transfer", expenseDate: new Date(Date.UTC(2026, 9, 1, 12)) }),
  expRow({ expenseNumber: "FIX-2", title: "إيجار سكن", category: "housing_rent", source: "fixed", amount: "2000", expenseDate: new Date(Date.UTC(2026, 9, 1, 12)), status: "paid" }),
  expRow({ expenseNumber: "PAY-1", title: "رواتب أكتوبر", category: "salaries", source: "payroll", amount: "14350", paymentMethod: "bank_transfer", expenseDate: new Date(Date.UTC(2026, 9, 1, 12)) }),
  expRow({ expenseNumber: "M-3", title: "ورق طباعة", category: "printing", amount: "75.5", expenseDate: new Date(Date.UTC(2026, 9, 20)) }),
  expRow({ expenseNumber: "M-2", title: "صيانة كرسي", category: "maintenance", amount: "300", paymentMethod: "check", status: "paid" }),
  expRow({ expenseNumber: "M-1", title: "طباعة فواتير", category: "printing", amount: "24.5", expenseDate: new Date(Date.UTC(2026, 9, 3)) }),
  expRow({ expenseNumber: "M-4", title: "بند قيد المراجعة", category: "printing", amount: "999", status: "pending" }),
  expRow({ expenseNumber: "M-5", title: "بند مرفوض", category: "other", amount: "777", status: "rejected" }),
  expRow({ expenseNumber: "FIX-3", title: "إنترنت معلق", category: "internet", source: "fixed", amount: "250", status: "pending" }),
];

function expenseData(over: Partial<ExpenseReportData> = {}): ExpenseReportData {
  return { year: 2026, month: 10, branchName: "فرع طويق", rows: EXPENSE_ROWS, preparedByName: "أحمد المحاسب", ...over };
}

describe("buildExpenseReportSections", () => {
  it("counts approved and paid only, in the order fixed, salaries, then categories", () => {
    const s = buildExpenseReportSections(EXPENSE_ROWS);
    expect(s.sections.map(x => x.key)).toEqual(["fixed", "payroll", "category:printing", "category:maintenance"]);
    expect(s.sections.map(x => x.title)).toEqual([FIXED_EXPENSES_SECTION_TITLE, "رواتب", "طباعة ورق", "صيانة"]);
    expect(s.totals).toEqual({ total: 20333, fixed: 5583, salaries: 14350, other: 400, count: 6 });
    expect(s.sections[2].total).toBe(100);
    // البنود مرتبة بالتاريخ داخل القسم
    expect(s.sections[2].rows.map(r => r.expenseNumber)).toEqual(["M-1", "M-3"]);
    const all = s.sections.flatMap(x => x.rows.map(r => r.status));
    expect(new Set(all)).toEqual(new Set(["approved", "paid"]));
  });

  it("keeps the fixed and salaries sections even when empty", () => {
    const s = buildExpenseReportSections([expRow()]);
    expect(s.sections.map(x => [x.key, x.rows.length])).toEqual([
      ["fixed", 0],
      ["payroll", 0],
      ["category:other", 1],
    ]);
    expect(buildExpenseReportSections([expRow()], { keepEmptyFixedSections: false }).sections).toHaveLength(1);
  });

  it("words item counts in Arabic", () => {
    expect(itemsCountText(1)).toBe("بند واحد");
    expect(itemsCountText(2)).toBe("بندان");
    expect(itemsCountText(5)).toBe("5 بنود");
    expect(itemsCountText(11)).toBe("11 بنداً");
  });
});

describe("renderExpenseReportHtml", () => {
  it("renders an RTL document with the branch establishment and says approved/paid only", () => {
    const html = renderExpenseReportHtml(expenseData(), OPTIONS);
    expect(html).toContain('<html dir="rtl" lang="ar">');
    expect(html).toContain(ESTABLISHMENTS.tadarruj.nameAr);
    expect(html).toContain("7036161573");
    expect(html).toContain("تقرير المصاريف");
    expect(html).toContain("شهر أكتوبر 2026");
    expect(html).toContain("01/10/2026 - 31/10/2026");
    expect(html).toContain("المصاريف المعتمدة والمدفوعة فقط");
    expect(html).toContain("EXP-2026-10");
    expect(html).not.toMatch(ARABIC_INDIC_DIGITS);
    expect(html).not.toMatch(/symbol\s*ai/i);
    expect(html).not.toContain("fonts.googleapis.com");
    expect(renderExpenseReportHtml(expenseData({ branchName: "فرع لبن" }), OPTIONS)).toContain(ESTABLISHMENTS.qessa.nameAr);
    expect(renderExpenseReportHtml(expenseData({ branchName: null }), OPTIONS)).toContain(GROUP_ESTABLISHMENT.nameAr);
  });

  it("leaves out pending and rejected expenses", () => {
    const html = renderExpenseReportHtml(expenseData(), OPTIONS);
    expect(html).not.toContain("بند قيد المراجعة");
    expect(html).not.toContain("بند مرفوض");
    expect(html).not.toContain("إنترنت معلق");
    expect(html).not.toContain("999.00");
    expect(html).not.toContain("777.00");
  });

  it("renders the fixed, salaries and category sections in order with subtotals and the grand total", () => {
    const html = renderExpenseReportHtml(expenseData(), OPTIONS);
    const fixedAt = html.indexOf('section-fixed');
    const payrollAt = html.indexOf('section-payroll');
    const categoryAt = html.indexOf('section-category');
    expect(fixedAt).toBeGreaterThan(0);
    expect(payrollAt).toBeGreaterThan(fixedAt);
    expect(categoryAt).toBeGreaterThan(payrollAt);

    const fixed = html.slice(fixedAt, payrollAt);
    expect(fixed).toContain(FIXED_EXPENSES_SECTION_TITLE);
    expect(fixed).toContain("إيجار محل");
    expect(fixed).toContain("ايجار محل"); // التصنيف
    expect(fixed).toContain("تحويل بنكي"); // طريقة الدفع
    expect(fixed).toContain("01/10/2026");
    expect(fixed).toContain(`إجمالي ${FIXED_EXPENSES_SECTION_TITLE}`);
    expect(fixed).toContain("5,583.00");

    const payroll = html.slice(payrollAt, categoryAt);
    expect(payroll).toContain("رواتب أكتوبر");
    expect(payroll).toContain("إجمالي رواتب");
    expect(payroll).toContain("14,350.00");

    const other = html.slice(categoryAt, html.indexOf('class="grand"'));
    expect(other.indexOf("طباعة ورق")).toBeLessThan(other.indexOf("صيانة"));
    expect(other).toContain("إجمالي طباعة ورق");
    expect(other).toContain("100.00");
    expect(other).toContain("إجمالي صيانة");
    expect(other).toContain("شيك");
    expect(other).toContain("إجمالي المصاريف الأخرى");
    expect(other).toContain("400.00");

    const grand = between(html, 'class="grand"', "report-signers");
    expect(grand).toContain("20,333.00");
    expect(grand).toContain("فقط عشرون ألف");

    const cards = between(html, 'class="cards"', "</section>");
    for (const v of ["20,333.00", "5,583.00", "14,350.00", "400.00"]) expect(cards).toContain(v);
    expect(cards).toContain("إجمالي المصاريف");
    expect(cards).toContain(FIXED_EXPENSES_SECTION_TITLE);
    expect(cards).toContain("رواتب");
    expect(cards).toContain("مصاريف أخرى");
  });

  it("each detail row has date, number, title, category, payment method and amount", () => {
    const html = renderExpenseReportHtml(expenseData(), OPTIONS);
    const row = between(html, "M-2", "</tr>");
    expect(row).toContain("صيانة كرسي");
    expect(row).toContain("صيانة");
    expect(row).toContain("شيك");
    expect(row).toContain("300.00");
    const head = between(html, 'class="fin report detail"', "</thead>");
    const order = ["التاريخ", "رقم المصروف", "البيان", "التصنيف", "طريقة الدفع", "المبلغ"].map(h => head.indexOf(`>${h}<`));
    expect(order.every(i => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(head).not.toContain(">الفرع<");
    // لكل الفروع يُضاف عمود الفرع
    const all = renderExpenseReportHtml(expenseData({ branchName: null }), OPTIONS);
    expect(between(all, 'class="fin report detail"', "</thead>")).toContain(">الفرع<");
  });

  it("applies the status and category filters", () => {
    const paid = renderExpenseReportHtml(expenseData({ status: "paid" }), OPTIONS);
    expect(paid).toContain("المصاريف المدفوعة فقط");
    expect(paid).toContain("إيجار سكن");
    expect(paid).not.toContain("إيجار محل");
    expect(paid).not.toContain("رواتب أكتوبر");

    const printing = renderExpenseReportHtml(expenseData({ category: "printing" }), OPTIONS);
    expect(printing).toContain("طباعة فواتير");
    expect(printing).not.toContain("صيانة كرسي");
    expect(printing).not.toContain("section-fixed");
    expect(printing).toContain("100.00");
  });

  it("escapes expense titles, numbers and branch names", () => {
    const html = renderExpenseReportHtml(
      expenseData({
        branchName: null,
        rows: [expRow({ title: '<img src=x onerror="alert(1)">', expenseNumber: "<b>N</b>", branchName: "<i>فرع</i>" })],
      }),
      OPTIONS
    );
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<b>N</b>");
    expect(html).not.toContain("<i>فرع</i>");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("&lt;b&gt;N&lt;/b&gt;");
  });

  it("shows empty sections and zero totals for a month without expenses", () => {
    const html = renderExpenseReportHtml(expenseData({ month: 11, rows: [] }), OPTIONS);
    expect(html).toContain("لا توجد مصاريف ثابتة معتمدة لهذا الشهر");
    expect(html).toContain("لا يوجد مسير رواتب معتمد لهذا الشهر");
    expect(html).toContain("لا توجد مصاريف أخرى معتمدة لهذا الشهر");
    expect(html).toContain("01/11/2026 - 30/11/2026");
  });

  it("has blank signature lines and no signature images or stamp", () => {
    const html = renderExpenseReportHtml(expenseData({ preparedByName: null }), OPTIONS);
    const signers = between(html, "report-signers", "doc-footer");
    expect(signers).toContain(SIGNATURES.supervisor.name);
    expect(signers).toContain(SIGNATURES.manager.name);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("STAMP");
  });
});

describe("financialReportBase", () => {
  it("builds month ranges and branch labels", () => {
    expect(monthDateRange(2026, 2)).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthDateRange(2028, 2)).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(monthDateRange(2026, 12)).toEqual({ from: "2026-12-01", to: "2026-12-31" });
    expect(reportBranchLabel(null)).toBe(ALL_BRANCHES_LABEL);
    expect(reportBranchLabel("  فرع لبن ")).toBe("فرع لبن");
  });
});
