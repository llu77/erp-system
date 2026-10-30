import { describe, expect, it } from "vitest";
import {
  calculateEndOfServiceSettlement,
  canTransitionEndOfService,
  computeServicePeriod,
  computeUnpaidSalaryPeriod,
  END_OF_SERVICE_FIXED_AWARD,
  formatEndOfServiceNumber,
  formatServicePeriod,
  isEndOfServiceSigned,
  parseDateOnly,
  parseEndOfServiceSequence,
  settlementTotalsChanged,
  type EndOfServiceCalcInput,
} from "../shared/endOfService";

const base: EndOfServiceCalcInput = {
  hireDate: "2021-11-01",
  lastWorkingDay: "2026-10-31",
  baseSalary: 2000,
  fixedAllowances: 1000,
  lastPayrollMonth: { year: 2026, month: 9 },
  advances: [],
  violations: [],
};

function calc(overrides: Partial<EndOfServiceCalcInput> = {}) {
  const r = calculateEndOfServiceSettlement({ ...base, ...overrides });
  if (!r.ok) throw new Error(r.error);
  return r.calculation;
}

describe("parseDateOnly", () => {
  it("accepts valid dates and rejects impossible ones", () => {
    expect(parseDateOnly("2026-02-28")).toEqual({
      year: 2026,
      month: 2,
      day: 28,
    });
    expect(parseDateOnly("2026-02-30")).toBeNull();
    expect(parseDateOnly("2026/02/01")).toBeNull();
    expect(parseDateOnly("")).toBeNull();
  });
});

describe("computeServicePeriod", () => {
  it("counts both the first and last day (exact five years)", () => {
    const p = computeServicePeriod("2021-11-01", "2026-10-31")!;
    expect([p.years, p.months, p.days]).toEqual([5, 0, 0]);
    expect(p.yearsDecimal).toBe(5);
  });

  it("splits years, months and days across month ends", () => {
    const p = computeServicePeriod("2023-01-15", "2026-04-20")!;
    expect([p.years, p.months, p.days]).toEqual([3, 3, 6]);
    expect(p.yearsDecimal).toBeCloseTo(3 + 3 / 12 + 6 / 365, 10);
  });

  it("clamps month ends instead of producing negative days", () => {
    // 31 يناير + شهر = 28 فبراير، ثم يومان حتى نهاية 1 مارس
    const p = computeServicePeriod("2025-01-31", "2025-03-01")!;
    expect([p.years, p.months, p.days]).toEqual([0, 1, 2]);
    expect(p.totalDays).toBe(30);
    // ذكرى 29 فبراير في سنة غير كبيسة = 28 فبراير: 365 يوماً = سنة كاملة
    const leap = computeServicePeriod("2024-02-29", "2025-02-27")!;
    expect([leap.years, leap.months, leap.days, leap.totalDays]).toEqual([
      1, 0, 0, 365,
    ]);
    const leapPlus = computeServicePeriod("2024-02-29", "2025-02-28")!;
    expect([leapPlus.years, leapPlus.months, leapPlus.days]).toEqual([1, 0, 1]);
  });

  it("a single day of service", () => {
    const p = computeServicePeriod("2026-10-30", "2026-10-30")!;
    expect([p.years, p.months, p.days, p.totalDays]).toEqual([0, 0, 1, 1]);
  });

  it("rejects an end before the start", () => {
    expect(computeServicePeriod("2026-10-30", "2026-10-29")).toBeNull();
  });
});

describe("formatServicePeriod", () => {
  it("uses Arabic counting forms", () => {
    expect(formatServicePeriod({ years: 5, months: 3, days: 10 })).toBe(
      "5 سنوات و3 أشهر و10 أيام"
    );
    expect(formatServicePeriod({ years: 1, months: 2, days: 1 })).toBe(
      "سنة واحدة وشهران ويوم واحد"
    );
    expect(formatServicePeriod({ years: 2, months: 0, days: 0 })).toBe("سنتان");
    expect(formatServicePeriod({ years: 12, months: 11, days: 15 })).toBe(
      "12 سنة و11 شهراً و15 يوماً"
    );
  });
});

describe("computeUnpaidSalaryPeriod", () => {
  it("pays the final partial month after the last payroll", () => {
    expect(
      computeUnpaidSalaryPeriod("2026-10-15", { year: 2026, month: 9 })
    ).toEqual({ fromDate: "2026-10-01", days: 15, coveredByPayroll: false });
  });
  it("a full last month is 30 days, including February", () => {
    expect(
      computeUnpaidSalaryPeriod("2026-10-31", { year: 2026, month: 9 }).days
    ).toBe(30);
    expect(
      computeUnpaidSalaryPeriod("2026-02-28", { year: 2026, month: 1 }).days
    ).toBe(30);
  });
  it("adds 30 days for every unpaid full month in between", () => {
    expect(
      computeUnpaidSalaryPeriod("2026-10-10", { year: 2026, month: 7 })
    ).toEqual({ fromDate: "2026-08-01", days: 70, coveredByPayroll: false });
  });
  it("crosses the year boundary", () => {
    expect(
      computeUnpaidSalaryPeriod("2027-01-05", { year: 2026, month: 11 })
    ).toEqual({ fromDate: "2026-12-01", days: 35, coveredByPayroll: false });
  });
  it("is zero when a payroll already covers the last month", () => {
    expect(
      computeUnpaidSalaryPeriod("2026-10-15", { year: 2026, month: 10 })
    ).toEqual({
      fromDate: null,
      days: 0,
      coveredByPayroll: true,
      payrollAfterLastMonth: false,
    });
    expect(
      computeUnpaidSalaryPeriod("2026-09-30", { year: 2026, month: 10 })
        .payrollAfterLastMonth
    ).toBe(true);
  });
  it("never starts before the hire date, counting a partial month by its actual days", () => {
    // مباشرة 20 أكتوبر وآخر يوم 31 أكتوبر بلا مسيرة: 12 يوماً لا 30
    expect(computeUnpaidSalaryPeriod("2026-10-31", null, "2026-10-20")).toEqual(
      { fromDate: "2026-10-20", days: 12, coveredByPayroll: false }
    );
    // مباشرة في منتصف شهر بعد آخر مسيرة: الشهر الأول جزئي ثم شهر كامل ثم الشهر الأخير
    expect(
      computeUnpaidSalaryPeriod(
        "2026-11-10",
        { year: 2026, month: 8 },
        "2026-09-16"
      )
    ).toEqual({
      fromDate: "2026-09-16",
      days: 15 + 30 + 10,
      coveredByPayroll: false,
    });
    // مباشرة بعد آخر يوم (بيانات خاطئة) لا تعطي أياماً
    expect(
      computeUnpaidSalaryPeriod("2026-10-05", null, "2026-10-20").days
    ).toBe(0);
  });

  it("without any payroll it starts from the last month", () => {
    expect(computeUnpaidSalaryPeriod("2026-10-12", null)).toEqual({
      fromDate: "2026-10-01",
      days: 12,
      coveredByPayroll: false,
    });
  });
});

describe("calculateEndOfServiceSettlement", () => {
  it("pays the fixed 2000 award whatever the service length, plus the final month", () => {
    expect(END_OF_SERVICE_FIXED_AWARD).toBe(2000);
    const c = calc();
    expect(c.monthlyWage).toBe(3000);
    expect(c.eosAward).toBe(2000);
    expect(c.salaryDays).toBe(30);
    expect(c.salaryDue).toBe(3000);
    expect(c.totalEntitlements).toBe(5000);
    expect(c.netAmount).toBe(5000);
    expect(c.netAmountWords).toBe("فقط خمسة آلاف ريال سعودي لا غير");
    // مدة قصيرة أو طويلة: نفس المكافأة
    expect(calc({ hireDate: "2026-09-01" }).eosAward).toBe(2000);
    expect(calc({ hireDate: "2010-01-01" }).eosAward).toBe(2000);
  });

  it("has no leave figures in the calculation", () => {
    const c = calc() as unknown as Record<string, unknown>;
    for (const key of [
      "leaveCompensation",
      "leaveBalanceDays",
      "accruedLeaveDays",
      "annualLeaveDaysTaken",
    ]) {
      expect(c[key]).toBeUndefined();
    }
  });

  it("deducts outstanding advances, violations and other deductions exactly once", () => {
    const c = calc({
      advances: [
        { id: 1, label: "سلفة REQ-1", amount: 1000 },
        { id: 2, label: "سلفة REQ-2", amount: 500 },
      ],
      violations: [{ id: 7, label: "تأخير", amount: 100 }],
      otherDeductions: 50,
      otherAdditions: 200,
    });
    expect(c.advancesDeduction).toBe(1500);
    expect(c.violationsDeduction).toBe(100);
    expect(c.totalDeductions).toBe(1650);
    expect(c.totalEntitlements).toBe(2000 + 3000 + 200);
    expect(c.netAmount).toBe(5200 - 1650);
  });

  it("honours manual salary days, including zero", () => {
    const c = calc({ salaryDaysOverride: 0 });
    expect(c.salaryDays).toBe(0);
    expect(c.salaryDaysIsManual).toBe(true);
    expect(c.netAmount).toBe(2000);
  });

  it("warns when a payroll already covers the last month", () => {
    const c = calc({
      lastWorkingDay: "2026-09-15",
      lastPayrollMonth: { year: 2026, month: 9 },
    });
    expect(c.salaryDays).toBe(0);
    expect(c.salaryCoveredByPayroll).toBe(true);
    expect(c.warnings.join(" ")).toContain("مشمول بمسير رواتب");
  });

  it("allows a negative net (employee owes) and words use the absolute value", () => {
    const c = calc({
      hireDate: "2026-10-01",
      salaryDaysOverride: 0,
      advances: [{ id: 1, label: "سلفة", amount: 5000 }],
    });
    expect(c.netAmount).toBeLessThan(0);
    expect(c.netAmountWords).not.toContain("-");
    expect(c.warnings.join(" ")).toContain("مستحق على الموظف");
  });

  it("does not overpay an employee hired inside the last month", () => {
    const c = calc({
      hireDate: "2026-10-20",
      lastWorkingDay: "2026-10-31",
      lastPayrollMonth: null,
    });
    expect(c.salaryDays).toBe(12);
    expect(c.salaryDue).toBe(1200);
  });

  it("warns precisely when a later payroll would pay a month after the last working day", () => {
    const c = calc({
      lastWorkingDay: "2026-09-30",
      lastPayrollMonth: { year: 2026, month: 10 },
    });
    expect(c.salaryDays).toBe(0);
    expect(c.warnings.join(" ")).toContain("10/2026 بعد آخر يوم عمل");
  });

  it("warns when no payroll ever paid the months before the last one", () => {
    const c = calc({ lastPayrollMonth: null });
    expect(c.salaryFromDate).toBe("2026-10-01");
    expect(c.warnings.join(" ")).toContain("لا يوجد مسير رواتب سابق");
  });

  it("rejects invalid input", () => {
    expect(
      calculateEndOfServiceSettlement({ ...base, hireDate: "2026-13-01" }).ok
    ).toBe(false);
    expect(
      calculateEndOfServiceSettlement({ ...base, lastWorkingDay: "2020-01-01" })
        .ok
    ).toBe(false);
    expect(
      calculateEndOfServiceSettlement({
        ...base,
        baseSalary: 0,
        fixedAllowances: 0,
      }).ok
    ).toBe(false);
  });

  it("ignores negative amounts", () => {
    const c = calc({
      otherAdditions: -100,
      otherDeductions: -50,
      advances: [{ id: 1, label: "x", amount: -10 }],
    });
    expect(c.otherAdditions).toBe(0);
    expect(c.otherDeductions).toBe(0);
    expect(c.advancesDeduction).toBe(0);
  });
});

describe("status, numbering and change detection", () => {
  it("follows draft → approved → paid, with cancel before payment", () => {
    expect(canTransitionEndOfService("draft", "approved")).toBe(true);
    expect(canTransitionEndOfService("approved", "paid")).toBe(true);
    expect(canTransitionEndOfService("approved", "cancelled")).toBe(true);
    expect(canTransitionEndOfService("draft", "paid")).toBe(false);
    expect(canTransitionEndOfService("paid", "cancelled")).toBe(false);
  });
  it("signs only approved and paid", () => {
    expect(isEndOfServiceSigned("draft")).toBe(false);
    expect(isEndOfServiceSigned("approved")).toBe(true);
    expect(isEndOfServiceSigned("paid")).toBe(true);
    expect(isEndOfServiceSigned("cancelled")).toBe(false);
  });
  it("numbers EOS-YYYY-NNNN", () => {
    expect(formatEndOfServiceNumber(2026, 7)).toBe("EOS-2026-0007");
    expect(parseEndOfServiceSequence("EOS-2026-0012")).toBe(12);
    expect(parseEndOfServiceSequence("RV-2026-0012")).toBe(0);
  });
  it("detects a change in totals", () => {
    const a = calc();
    expect(settlementTotalsChanged(a, a)).toBe(false);
    expect(settlementTotalsChanged(a, calc({ otherDeductions: 1 }))).toBe(true);
  });
});
