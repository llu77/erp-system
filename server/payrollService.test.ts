import { describe, it, expect, vi } from "vitest";

vi.mock("./db", () => ({ getDb: vi.fn(async () => null) }));

import { _internal, canActorTransition } from "./payroll/service";

const { buildLine, resolveAdjustment, lineToDetailValues, storedAdjustment } = _internal;

const emp = { id: 7, name: "محمد إسماعيل", code: "E007", position: "حلاق" };

function sources(overrides: Partial<Record<string, any>> = {}) {
  return {
    settings: new Map(overrides.settings ?? []),
    advances: new Map(overrides.advances ?? []),
    violations: new Map(overrides.violations ?? []),
    leaves: new Map(overrides.leaves ?? []),
    negativeInvoices: new Map(overrides.negativeInvoices ?? []),
  } as any;
}

const settingsRow = (patch: Record<string, unknown> = {}) => ({
  id: 1,
  employeeId: 7,
  baseSalary: "2000.00",
  overtimeEnabled: true,
  overtimeRate: "1000.00",
  isSupervisor: false,
  supervisorIncentive: "400.00",
  fixedDeduction: "0.00",
  fixedDeductionReason: null,
  ...patch,
});

describe("payroll service line building", () => {
  it("applies salary settings: overtime rate and supervisor incentive by default", () => {
    const src = sources({ settings: [[7, settingsRow({ isSupervisor: true })]] });
    const inputs = resolveAdjustment(7, src.settings.get(7), undefined, undefined);
    expect(inputs.overtimeEnabled).toBe(true);
    expect(inputs.incentiveAmount).toBe(400);
    const line = buildLine(emp, src, inputs);
    expect(line.calc.overtimeAmount).toBe(1000);
    expect(line.calc.grossSalary).toBe(3400);
  });

  it("falls back to defaults when the employee has no salary settings", () => {
    const src = sources();
    const line = buildLine(emp, src, resolveAdjustment(7, undefined, undefined, undefined));
    expect(line.calc.baseSalary).toBe(2000);
    expect(line.calc.overtimeAmount).toBe(0);
    expect(line.calc.netSalary).toBe(2000);
  });

  it("deducts every approved advance and violation unless deferred", () => {
    const src = sources({
      settings: [[7, settingsRow()]],
      advances: [[7, [
        { id: 11, amount: 500, title: "سلفة 1", approvedAt: null },
        { id: 12, amount: 300, title: "سلفة 2", approvedAt: null },
      ]]],
      violations: [[7, [{ id: 21, amount: 100, violationType: "تأخير", violationDate: "2026-10-05", description: null }]]],
    });
    const all = buildLine(emp, src, resolveAdjustment(7, src.settings.get(7), undefined, undefined));
    expect(all.calc.advanceDeduction).toBe(800);
    expect(all.calc.violationsDeduction).toBe(100);
    expect(all.calc.netSalary).toBe(3000 - 900);

    const deferred = buildLine(
      emp,
      src,
      resolveAdjustment(7, src.settings.get(7), undefined, { employeeId: 7, deferredAdvanceIds: [12] })
    );
    expect(deferred.calc.advanceDeduction).toBe(500);
    expect(deferred.advances.find(a => a.id === 12)?.deferred).toBe(true);
  });

  it("drops deferred ids that no longer exist", () => {
    const src = sources({ advances: [[7, [{ id: 11, amount: 500, title: "سلفة", approvedAt: null }]]] });
    const line = buildLine(emp, src, resolveAdjustment(7, undefined, undefined, { employeeId: 7, deferredAdvanceIds: [11, 99] }));
    expect(line.inputs.deferredAdvanceIds).toEqual([11]);
  });

  it("stores and restores manual inputs without loss (used by recalculation)", () => {
    const src = sources({
      settings: [[7, settingsRow()]],
      advances: [[7, [{ id: 11, amount: 500, title: "سلفة", approvedAt: null }, { id: 12, amount: 250, title: "سلفة ب", approvedAt: null }]]],
      leaves: [[7, [{ requestId: 5, type: "unpaid", kind: "unpaid", days: 2, startDate: "2026-10-10", endDate: "2026-10-11" }]]],
    });
    const override = {
      employeeId: 7,
      workDays: 28,
      incentiveAmount: 150,
      otherDeduction: 75,
      otherDeductionReason: "تلف أدوات",
      deferredAdvanceIds: [12],
      notes: "ملاحظة",
    };
    const line = buildLine(emp, src, resolveAdjustment(7, src.settings.get(7), undefined, override));
    const stored = lineToDetailValues(line);
    expect(stored.advanceDeduction).toBe("500.00");
    expect(stored.leaveDeduction).toBe("200.00"); // (2000+1000)/30 * 2
    expect(stored.absentDeduction).toBe("200.00");
    expect(Number(stored.totalDeductions)).toBeCloseTo(500 + 200 + 200 + 75, 2);

    const restored = storedAdjustment({ ...stored, id: 1, payrollId: 1 } as any);
    expect(restored).toMatchObject({
      overtimeEnabled: true,
      workDays: 28,
      incentiveAmount: 150,
      otherDeduction: 75,
      otherDeductionReason: "تلف أدوات",
      deferredAdvanceIds: [12],
      notes: "ملاحظة",
    });
    // إعادة البناء من المدخلات المحفوظة تعطي نفس الأرقام
    const rebuilt = buildLine(emp, src, resolveAdjustment(7, src.settings.get(7), restored, undefined));
    expect(rebuilt.calc).toEqual(line.calc);
  });
});

describe("payroll status permissions", () => {
  const payroll = { branchId: 3 };
  it("lets admin and manager approve and pay", () => {
    expect(canActorTransition({ id: 1, name: "a", role: "admin", branchId: null }, payroll, "approved")).toBe(true);
    expect(canActorTransition({ id: 1, name: "m", role: "manager", branchId: null }, payroll, "paid")).toBe(true);
  });
  it("lets a branch supervisor only submit their own branch payroll", () => {
    expect(canActorTransition({ id: 2, name: "s", role: "supervisor", branchId: 3 }, payroll, "pending")).toBe(true);
    expect(canActorTransition({ id: 2, name: "s", role: "supervisor", branchId: 3 }, payroll, "approved")).toBe(false);
    expect(canActorTransition({ id: 2, name: "s", role: "supervisor", branchId: 4 }, payroll, "pending")).toBe(false);
  });
  it("denies employees and viewers", () => {
    expect(canActorTransition({ id: 3, name: "e", role: "employee", branchId: 3 }, payroll, "pending")).toBe(false);
    expect(canActorTransition({ id: 3, name: "v", role: "viewer", branchId: null }, payroll, "approved")).toBe(false);
  });
});
