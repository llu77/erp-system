import { describe, it, expect } from "vitest";
import {
  calculatePayrollLine,
  sumPayrollTotals,
  normalizeLeaveKind,
  countOverlapDays,
  roundMoney,
  canTransitionPayroll,
  isPayrollEditable,
} from "../shared/payroll";

const base = {
  baseSalary: 2000,
  overtimeEnabled: false,
  overtimeRate: 1000,
  workDays: 30,
  incentiveAmount: 0,
  otherDeduction: 0,
  advanceDeduction: 0,
  violationsDeduction: 0,
  negativeInvoicesDeduction: 0,
  leaves: [],
};

describe("calculatePayrollLine", () => {
  it("includes 1000 overtime in gross and net when enabled", () => {
    const r = calculatePayrollLine({ ...base, overtimeEnabled: true });
    expect(r.overtimeAmount).toBe(1000);
    expect(r.grossSalary).toBe(3000);
    expect(r.netSalary).toBe(3000);
  });

  it("uses the configured overtime rate, not a hard-coded value", () => {
    const r = calculatePayrollLine({ ...base, overtimeEnabled: true, overtimeRate: 750 });
    expect(r.overtimeAmount).toBe(750);
    expect(r.grossSalary).toBe(2750);
  });

  it("ignores overtime rate when overtime is disabled", () => {
    const r = calculatePayrollLine({ ...base, overtimeEnabled: false, overtimeRate: 1000 });
    expect(r.overtimeAmount).toBe(0);
    expect(r.overtimeEnabled).toBe(false);
  });

  it("deducts approved advances fully from net", () => {
    const r = calculatePayrollLine({ ...base, advanceDeduction: 500 });
    expect(r.totalDeductions).toBe(500);
    expect(r.netSalary).toBe(1500);
  });

  it("computes absence on daily rate including overtime", () => {
    const r = calculatePayrollLine({ ...base, overtimeEnabled: true, workDays: 28 });
    expect(r.absentDays).toBe(2);
    expect(r.absentDeduction).toBe(200); // (2000+1000)/30 * 2
    expect(r.netSalary).toBe(2800);
  });

  it("clamps work days to 0..30", () => {
    expect(calculatePayrollLine({ ...base, workDays: 45 }).absentDays).toBe(0);
    expect(calculatePayrollLine({ ...base, workDays: -3 }).absentDays).toBe(30);
  });

  it("handles the work-day boundaries 0 and 30 exactly", () => {
    const full = calculatePayrollLine({ ...base, workDays: 30 });
    expect(full.absentDays).toBe(0);
    expect(full.absentDeduction).toBe(0);
    const none = calculatePayrollLine({ ...base, workDays: 0 });
    expect(none.absentDays).toBe(30);
    expect(none.absentDeduction).toBe(2000);
    expect(none.netSalary).toBe(0);
  });

  it("returns zero leave values for an empty leaves list", () => {
    const r = calculatePayrollLine({ ...base, leaves: [] });
    expect(r.leaveDays).toBe(0);
    expect(r.leaveDeduction).toBe(0);
  });

  it("deducts leaves by type: annual/sick paid, emergency 50%, unpaid 100%", () => {
    const r = calculatePayrollLine({
      ...base,
      leaves: [
        { type: "annual", days: 5 },
        { type: "مرضية", days: 2 },
        { type: "emergency", days: 3 },
        { type: "unpaid", days: 3 },
      ],
    });
    const daily = 2000 / 30;
    expect(r.leaveDays).toBe(13);
    expect(r.paidLeaveDays).toBe(7);
    expect(r.leaveDeduction).toBe(roundMoney(daily * 3 * 0.5 + daily * 3));
  });

  it("sums every deduction source exactly once", () => {
    const r = calculatePayrollLine({
      ...base,
      overtimeEnabled: true,
      incentiveAmount: 400,
      advanceDeduction: 300,
      violationsDeduction: 100,
      negativeInvoicesDeduction: 50,
      otherDeduction: 25,
      leaves: [{ type: "unpaid", days: 1 }],
    });
    expect(r.grossSalary).toBe(3400);
    expect(r.leaveDeduction).toBe(100);
    expect(r.totalDeductions).toBe(575);
    expect(r.netSalary).toBe(2825);
  });

  it("treats negative or invalid inputs as zero", () => {
    const r = calculatePayrollLine({ ...base, advanceDeduction: -50, incentiveAmount: NaN as any });
    expect(r.advanceDeduction).toBe(0);
    expect(r.incentiveAmount).toBe(0);
  });
});

describe("sumPayrollTotals", () => {
  it("derives payroll totals from lines", () => {
    const a = calculatePayrollLine({ ...base, overtimeEnabled: true });
    const b = calculatePayrollLine({ ...base, advanceDeduction: 200 });
    const t = sumPayrollTotals([a, b]);
    expect(t.totalBaseSalary).toBe(4000);
    expect(t.totalOvertime).toBe(1000);
    expect(t.totalDeductions).toBe(200);
    expect(t.totalNetSalary).toBe(4800);
    expect(t.employeeCount).toBe(2);
  });

  it("returns zero totals for an empty payroll", () => {
    expect(sumPayrollTotals([])).toEqual({
      totalBaseSalary: 0,
      totalOvertime: 0,
      totalIncentives: 0,
      totalDeductions: 0,
      totalNetSalary: 0,
      employeeCount: 0,
    });
  });
});

describe("normalizeLeaveKind", () => {
  it("maps arabic and english labels", () => {
    expect(normalizeLeaveKind("annual")).toBe("annual");
    expect(normalizeLeaveKind("إجازة سنوية")).toBe("annual");
    expect(normalizeLeaveKind("sick")).toBe("sick");
    expect(normalizeLeaveKind("طارئة")).toBe("emergency");
    expect(normalizeLeaveKind("بدون راتب")).toBe("unpaid");
    expect(normalizeLeaveKind(null)).toBe("unpaid");
  });
});

describe("countOverlapDays", () => {
  it("counts only days within the payroll month", () => {
    expect(countOverlapDays({ year: 2026, month: 9, day: 28 }, { year: 2026, month: 10, day: 3 }, 2026, 10)).toBe(3);
    expect(countOverlapDays({ year: 2026, month: 10, day: 30 }, { year: 2026, month: 11, day: 2 }, 2026, 10)).toBe(2);
    expect(countOverlapDays({ year: 2026, month: 11, day: 1 }, { year: 2026, month: 11, day: 2 }, 2026, 10)).toBe(0);
  });
  it("never exceeds 30 payroll days", () => {
    expect(countOverlapDays({ year: 2026, month: 1, day: 1 }, { year: 2026, month: 12, day: 31 }, 2026, 10)).toBe(30);
  });
});

describe("payroll status rules", () => {
  it("allows the normal approval path only", () => {
    expect(canTransitionPayroll("pending", "approved")).toBe(true);
    expect(canTransitionPayroll("approved", "paid")).toBe(true);
    expect(canTransitionPayroll("draft", "paid")).toBe(false);
    expect(canTransitionPayroll("paid", "cancelled")).toBe(false);
  });
  it("only draft and pending payrolls are editable", () => {
    expect(isPayrollEditable("draft")).toBe(true);
    expect(isPayrollEditable("pending")).toBe(true);
    expect(isPayrollEditable("approved")).toBe(false);
  });
});
