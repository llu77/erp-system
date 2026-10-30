import { describe, expect, it } from "vitest";
import { assembleBranchFinancials } from "./finance/branchFinancials";
import {
  DEFAULT_FIXED_EXPENSES,
  EXPENSE_CATEGORY_LABELS,
  MANUAL_EXPENSE_CATEGORIES,
  autoExpenseDate,
  fixedExpenseSourceKey,
  isMonthOnOrAfter,
  monthKey,
  payrollExpenseAmount,
  payrollExpenseSourceKey,
  utcMonthRange,
} from "../shared/expenses";

describe("shared expenses rules", () => {
  it("keeps salaries out of the manual categories and labels every category", () => {
    expect(MANUAL_EXPENSE_CATEGORIES).not.toContain("salaries");
    expect(EXPENSE_CATEGORY_LABELS.salaries).toBe("رواتب");
    for (const c of MANUAL_EXPENSE_CATEGORIES) expect(EXPENSE_CATEGORY_LABELS[c]).toBeTruthy();
  });

  it("has the requested fixed expenses per establishment", () => {
    const summary = (k: "qessa" | "tadarruj") => DEFAULT_FIXED_EXPENSES[k].map(e => [e.category, e.amount, e.paymentMethod]);
    expect(summary("qessa")).toEqual([["shop_rent", 3583, "bank_transfer"], ["housing_rent", 1700, "cash"], ["internet", 250, "cash"]]);
    expect(summary("tadarruj")).toEqual([["shop_rent", 3583, "bank_transfer"], ["housing_rent", 2000, "cash"], ["internet", 250, "cash"]]);
  });

  it("dates auto expenses inside the month in UTC and Riyadh time, with stable keys", () => {
    const d = autoExpenseDate(2026, 11);
    const { start, endExclusive } = utcMonthRange(2026, 11);
    expect(d >= start && d < endExclusive).toBe(true);
    expect(new Date(d.getTime() + 3 * 3600_000).getUTCMonth()).toBe(10);
    expect(utcMonthRange(2026, 12).endExclusive.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(monthKey(2026, 3)).toBe("2026-03");
    expect(isMonthOnOrAfter(2026, 11, "2026-10")).toBe(true);
    expect(isMonthOnOrAfter(2026, 9, "2026-10")).toBe(false);
    expect(fixedExpenseSourceKey(4, 2026, 11, 9)).toBe("fixed:4:2026-11:9");
    expect(payrollExpenseSourceKey(12)).toBe("payroll:12");
  });

  it("costs a payroll as net salary plus the advances it recovered", () => {
    expect(payrollExpenseAmount(10_000, 1_500.5)).toBe(11_500.5);
    expect(payrollExpenseAmount(0, 0)).toBe(0);
  });
});

describe("assembleBranchFinancials", () => {
  it("profit = revenue − (fixed + manual expenses + payroll cost); payroll rows in expenses are not counted twice", () => {
    const f = assembleBranchFinancials(2026, 11, 1, {
      revenue: { cash: "20000.00", network: "15000.50", days: 30 },
      expenseRows: [
        { category: "shop_rent", source: "fixed", amount: "3583.00" },
        { category: "housing_rent", source: "fixed", amount: "1700.00" },
        { category: "internet", source: "fixed", amount: "250.00" },
        { category: "shop_supplies", source: "manual", amount: "420.25" },
        { category: "salaries", source: "payroll", amount: "9999.00" },
      ],
      payroll: { count: 1, netSalary: "8000.00", recoveredAdvances: "500.00" },
    });
    expect(f.revenue.total).toBe(35000.5);
    expect(f.expenses.fixed).toBe(5533);
    expect(f.expenses.other).toBe(420.25);
    expect(f.expenses.total).toBe(5953.25);
    expect(f.payroll.cost).toBe(8500);
    expect(f.totalCosts).toBe(14453.25);
    expect(f.profit).toBe(20547.25);
    expect(f.expenses.byCategory.map(c => c.category)).not.toContain("salaries");
    expect(f.expenses.byCategory[0]).toEqual({ category: "shop_rent", label: "ايجار محل", amount: 3583 });
  });

  it("reports a loss as a negative profit", () => {
    const f = assembleBranchFinancials(2026, 11, null, {
      revenue: { cash: 1000, network: 0, days: 2 },
      expenseRows: [{ category: "shop_rent", source: "fixed", amount: 3583 }],
      payroll: { count: 0, netSalary: 0, recoveredAdvances: 0 },
    });
    expect(f.profit).toBe(-2583);
  });
});
