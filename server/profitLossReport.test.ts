import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * تقرير الربح والخسارة بعد تسجيل مسير الرواتب المعتمد مصروفاً:
 * الرواتب تُحسب مرة واحدة (تكلفة المسير) ولا تُضاف صفوف المسير في المصاريف فوقها
 */

let capturedHtml = "";
vi.mock("puppeteer", () => ({
  default: {
    launch: vi.fn(async () => ({
      newPage: async () => ({
        setContent: async (html: string) => {
          capturedHtml = html;
        },
        pdf: async () => Buffer.from("PDF"),
      }),
      close: async () => undefined,
    })),
  },
}));

vi.mock("./db", () => ({ getDb: vi.fn() }));
vi.mock("./expenses/autoExpenses", () => ({ ensureFixedExpensesForViewedMonth: vi.fn(async () => null) }));

import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { SQL } from "drizzle-orm";
import * as db from "./db";
import * as autoExpenses from "./expenses/autoExpenses";
import { generateProfitLossReport } from "./reports/monthlyReports";
import { getBranchMonthlyFinancials } from "./finance/branchFinancials";
import { branches, dailyRevenues, expenses, payrollDetails, payrolls } from "../drizzle/schema";

// صفوف المصاريف كما يرجعها التجميع؛ يتضمن صف المسير حتى يثبت الاختبار أنه لا يُحسب حتى لو وصل
const EXPENSE_ROWS = [
  { category: "shop_rent", source: "fixed", amount: "3583.00" },
  { category: "housing_rent", source: "fixed", amount: "1700.00" },
  { category: "internet", source: "fixed", amount: "250.00" },
  { category: "shop_supplies", source: "manual", amount: "420.25" },
  { category: "salaries", source: "payroll", amount: "8500.00" },
];
const NET_SALARY = 8000;
const RECOVERED_ADVANCES = 500;
const REVENUE_CASH = 20000;
const REVENUE_NETWORK = 15000.5;

let expenseWhere: SQL | undefined;

/** قاعدة بيانات وهمية: تُرجع النتيجة حسب الجدول والحقول المطلوبة */
function fakeDb() {
  const respond = (table: unknown, fields: Record<string, unknown> | undefined) => {
    if (table === dailyRevenues) return [{ cash: String(REVENUE_CASH), network: String(REVENUE_NETWORK), days: 30 }];
    if (table === expenses) return EXPENSE_ROWS;
    if (table === payrollDetails) return [{ total: String(RECOVERED_ADVANCES) }];
    if (table === payrolls && fields && "id" in fields) return [{ id: 7, totalNetSalary: String(NET_SALARY) }];
    if (table === payrolls) return [{ totalNet: NET_SALARY, totalBase: 9000, totalOvertime: 0, totalIncentives: 0, totalDeductions: 1000 }];
    if (table === branches) return [{ name: "Laban", nameAr: "فرع لبن" }];
    return [];
  };
  return {
    select(fields?: Record<string, unknown>) {
      let table: unknown;
      const chain: any = {
        from(t: unknown) {
          table = t;
          return chain;
        },
        where(condition: SQL) {
          if (table === expenses) expenseWhere = condition;
          return chain;
        },
        groupBy: () => chain,
        limit: () => chain,
        orderBy: () => chain,
        then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(respond(table, fields)).then(resolve, reject),
      };
      return chain;
    },
  };
}

const money = (n: number) => `${n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;

beforeEach(() => {
  capturedHtml = "";
  expenseWhere = undefined;
  vi.mocked(db.getDb).mockResolvedValue(fakeDb() as never);
  vi.mocked(autoExpenses.ensureFixedExpensesForViewedMonth).mockClear();
});

describe("P&L is not double counted", () => {
  it("expenses exclude payroll rows; salaries are counted once as the payroll cost", async () => {
    const f = await getBranchMonthlyFinancials(2026, 11, 1);
    const nonPayrollExpenses = 3583 + 1700 + 250 + 420.25;
    const payrollCost = NET_SALARY + RECOVERED_ADVANCES;
    expect(f.expenses.total).toBe(nonPayrollExpenses);
    expect(f.payroll.cost).toBe(payrollCost);
    // صف مصروف المسير = تكلفة الرواتب نفسها، فلو أُضيف فوقها لتضاعفت الرواتب
    expect(Number(EXPENSE_ROWS.find(r => r.source === "payroll")!.amount)).toBe(payrollCost);
    expect(f.totalCosts).toBe(nonPayrollExpenses + payrollCost);
    expect(f.profit).toBe(REVENUE_CASH + REVENUE_NETWORK - nonPayrollExpenses - payrollCost);

    // الاستعلام نفسه يستبعد صفوف المسير ويحسب المعتمد والمدفوع فقط
    const query = new MySqlDialect().sqlToQuery(expenseWhere!);
    expect(query.sql).toContain("`expenses`.`source` <> ?");
    expect(query.params).toContain("payroll");
    expect(query.sql).toMatch(/`expenses`\.`status` in \(\?, \?\)/);
    expect(query.params).toEqual(expect.arrayContaining(["approved", "paid"]));
  });

  it("the P&L PDF shows the same numbers as the partners' monthly financials", async () => {
    const f = await getBranchMonthlyFinancials(2026, 11, 1);
    const pdf = await generateProfitLossReport(11, 2026, 1);
    expect(pdf.toString()).toBe("PDF");
    expect(autoExpenses.ensureFixedExpensesForViewedMonth).toHaveBeenCalledWith(2026, 11);

    // إجمالي المصاريف بدون الرواتب، وتكلفة الرواتب مرة واحدة، والربح الصافي = نفس رقم أرباح الشركاء
    expect(capturedHtml).toContain(`<h3>إجمالي المصاريف</h3>\n      <div class="amount">${money(f.expenses.total)}</div>`);
    expect(capturedHtml).toContain(`<h3>إجمالي الرواتب</h3>\n      <div class="amount">${money(f.payroll.cost)}</div>`);
    expect(capturedHtml).toContain(`<h3>صافي الربح</h3>\n      <div class="amount">${money(f.profit)}</div>`);
    expect(capturedHtml).toContain(`<td>تكلفة الرواتب</td><td>${money(NET_SALARY + RECOVERED_ADVANCES)}</td>`);
    // لا سطر "رواتب" بين المصاريف التشغيلية
    const operating = capturedHtml.slice(capturedHtml.indexOf("المصاريف التشغيلية"), capturedHtml.indexOf("إجمالي المصاريف</td>"));
    expect(operating).not.toContain("<td>رواتب</td>");
    expect(operating).toContain("<td>ايجار محل</td>");
  });
});
