import { describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getDb: vi.fn(async () => null), generateRequestNumber: vi.fn(() => "REQ-261030-0001") }));

import {
  EndOfServiceError,
  _internal,
  assertCanViewSettlement,
  buildSettlementValues,
  buildWageDefaults,
  calculateOrThrow,
  canManageEndOfService,
  getSettlementById,
  isRequestVisibleToEmployee,
  listSettlements,
  resolveViewScope,
  settlementToForm,
  storedCalculation,
  sumAnnualLeaveDays,
  annualLeaveDaysTaken,
  toDocumentData,
  toListRow,
  vacationRowDays,
  validateFormDates,
  type EmployeeContext,
  type EndOfServiceForm,
} from "./endOfService/service";
import { settledInEndOfServiceMessage } from "./payroll/service";
import type { Employee, EndOfServiceSettlement } from "../drizzle/schema";

const employee = {
  id: 7,
  code: "E007",
  name: "محمد إسماعيل",
  branchId: 3,
  phone: null,
  email: null,
  emailVerified: false,
  position: "حلاق",
  username: null,
  password: null,
  hasPortalAccess: false,
  isSupervisor: false,
  lastLogin: null,
  photoUrl: null,
  iqamaNumber: "2412345678",
  iqamaExpiryDate: null,
  iqamaImageUrl: null,
  healthCertExpiryDate: null,
  healthCertImageUrl: null,
  contractExpiryDate: null,
  contractImageUrl: null,
  hireDate: "2021-11-01",
  nationality: "مصري",
  infoSubmittedAt: null,
  infoSubmittedBy: null,
  isActive: true,
  createdAt: new Date("2021-11-01T08:00:00Z"),
  updatedAt: new Date("2021-11-01T08:00:00Z"),
} as Employee;

const ctx: EmployeeContext = {
  employee,
  branchName: "فرع لبن",
  wage: { baseSalary: 2000, fixedAllowances: 1000, breakdown: [] },
  annualLeaveDaysTaken: 30,
  lastPayroll: { year: 2026, month: 9, payrollNumber: "PAY-202609-0001" },
  advances: [{ id: 11, label: "سلفة REQ-260901-0001", amount: 500, date: "2026-09-01" }],
  violations: [{ id: 21, label: "تأخير", amount: 100, date: "2026-10-05" }],
};

const form: EndOfServiceForm = {
  employeeId: 7,
  hireDate: "2021-11-01",
  contractEndDate: "2026-10-31",
  lastWorkingDay: "2026-10-31",
  letterDate: "2026-09-01",
  nationality: "مصري",
  idNumber: "2412345678",
  position: "حلاق",
  baseSalary: 2000,
  fixedAllowances: 1000,
  leaveBalanceDaysOverride: null,
  leaveNote: null,
  salaryDaysOverride: null,
  salaryNote: null,
  otherAdditions: 250,
  otherAdditionsNote: "بدل تذاكر",
  otherDeductions: 50,
  otherDeductionsNote: "عهدة",
  notes: null,
};

function settlementRow(overrides: Partial<EndOfServiceSettlement> = {}, f: EndOfServiceForm = form): EndOfServiceSettlement {
  const calc = calculateOrThrow(f, ctx);
  return {
    id: 1,
    settlementNumber: "EOS-2026-0001",
    requestId: 99,
    status: "draft",
    paymentMethod: null,
    paymentReference: null,
    createdBy: 1,
    createdByName: "المدير",
    approvedBy: null,
    approvedByName: null,
    approvedAt: null,
    paidBy: null,
    paidByName: null,
    paidAt: null,
    cancelledBy: null,
    cancelledByName: null,
    cancelledAt: null,
    cancellationReason: null,
    createdAt: new Date("2026-09-01T09:00:00Z"),
    updatedAt: new Date("2026-09-01T09:00:00Z"),
    ...buildSettlementValues(f, ctx, calc),
    ...overrides,
  } as EndOfServiceSettlement;
}

describe("wage defaults", () => {
  it("uses the default base salary without salary settings", () => {
    const w = buildWageDefaults(undefined);
    expect(w).toEqual({ baseSalary: 2000, fixedAllowances: 0, breakdown: [{ label: "الأجر الأساسي", amount: 2000 }] });
  });

  it("adds fixed overtime and the supervisor incentive as allowances", () => {
    const w = buildWageDefaults({
      baseSalary: "2500.00",
      overtimeEnabled: true,
      overtimeRate: "1000.00",
      isSupervisor: true,
      supervisorIncentive: "400.00",
    });
    expect(w.baseSalary).toBe(2500);
    expect(w.fixedAllowances).toBe(1400);
    expect(w.breakdown.map(b => b.label)).toEqual(["الأجر الأساسي", "الساعات الإضافية الثابتة", "حافز الإشراف"]);
  });

  it("ignores the overtime rate when overtime is disabled", () => {
    const w = buildWageDefaults({
      baseSalary: "2000.00",
      overtimeEnabled: false,
      overtimeRate: "1000.00",
      isSupervisor: false,
      supervisorIncentive: "400.00",
    });
    expect(w.fixedAllowances).toBe(0);
    expect(w.breakdown).toHaveLength(1);
  });
});

describe("annual leave taken", () => {
  it("counts recorded days, or the inclusive span between the dates", () => {
    expect(vacationRowDays({ vacationType: "سنوية", vacationStartDate: null, vacationEndDate: null, vacationDays: 10 })).toBe(10);
    expect(
      vacationRowDays({
        vacationType: "annual",
        vacationStartDate: new Date("2026-03-01T00:00:00+03:00"),
        vacationEndDate: new Date("2026-03-07T00:00:00+03:00"),
        vacationDays: null,
      })
    ).toBe(7);
    expect(
      vacationRowDays({ vacationType: "annual", vacationStartDate: "2026-03-01", vacationEndDate: null, vacationDays: 0 })
    ).toBe(1);
  });

  it("sums only annual leave and skips leave starting after the last working day", () => {
    const rows = [
      { vacationType: "إجازة سنوية", vacationStartDate: "2025-01-01", vacationEndDate: null, vacationDays: 21 },
      { vacationType: "annual", vacationStartDate: "2026-02-01", vacationEndDate: null, vacationDays: 9.5 },
      { vacationType: "مرضية", vacationStartDate: "2026-03-01", vacationEndDate: null, vacationDays: 5 },
      { vacationType: "بدون راتب", vacationStartDate: "2026-04-01", vacationEndDate: null, vacationDays: 3 },
      { vacationType: "سنوية", vacationStartDate: "2026-11-15", vacationEndDate: null, vacationDays: 10 },
    ];
    expect(sumAnnualLeaveDays(rows)).toBe(40.5);
    expect(sumAnnualLeaveDays(rows, "2026-10-31")).toBe(30.5);
  });

  it("takes the larger of approved requests and recorded balances, never their sum", () => {
    expect(annualLeaveDaysTaken(30, 21)).toBe(30);
    expect(annualLeaveDaysTaken(10, "63")).toBe(63);
    expect(annualLeaveDaysTaken(12, null)).toBe(12);
    expect(annualLeaveDaysTaken(12, -5)).toBe(12);
  });
});

describe("view access", () => {
  it("gives admins, managers and general supervisors every branch", () => {
    for (const role of ["admin", "manager", "viewer"]) {
      expect(resolveViewScope({ role, branchId: 4 })).toEqual({ branchId: null });
    }
  });

  it("limits branch supervisors to their branch and refuses one without a branch", () => {
    expect(resolveViewScope({ role: "supervisor", branchId: 3 })).toEqual({ branchId: 3 });
    expect(() => resolveViewScope({ role: "supervisor", branchId: null })).toThrow("حسابك غير مرتبط بفرع");
    expect(() => assertCanViewSettlement({ role: "supervisor", branchId: 3 }, { branchId: 3 })).not.toThrow();
    try {
      assertCanViewSettlement({ role: "supervisor", branchId: 3 }, { branchId: 5 });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(EndOfServiceError);
      expect((error as EndOfServiceError).code).toBe("FORBIDDEN");
    }
  });

  it("refuses employees and other roles", () => {
    expect(() => resolveViewScope({ role: "employee", branchId: 3 })).toThrow(EndOfServiceError);
    expect(() => resolveViewScope({ role: "user", branchId: null })).toThrow(EndOfServiceError);
  });

  it("checks access before touching the database", async () => {
    await expect(listSettlements(undefined, { role: "employee", branchId: 3 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getSettlementById(1, { role: "supervisor", branchId: null })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(listSettlements(undefined, { role: "admin", branchId: null })).rejects.toThrow("قاعدة البيانات غير متاحة");
  });

  it("lets only admins and managers manage settlements", () => {
    expect(canManageEndOfService("admin")).toBe(true);
    expect(canManageEndOfService("manager")).toBe(true);
    expect(canManageEndOfService("viewer")).toBe(false);
    expect(canManageEndOfService("supervisor")).toBe(false);
  });
});

describe("form validation", () => {
  it("rejects invalid or inverted dates with Arabic messages", () => {
    expect(() => validateFormDates({ ...form, hireDate: "2021-02-30" })).toThrow("تاريخ مباشرة العمل غير صحيح");
    expect(() => validateFormDates({ ...form, letterDate: "01/09/2026" })).toThrow("تاريخ الخطاب غير صحيح");
    expect(() => validateFormDates({ ...form, contractEndDate: "2020-01-01" })).toThrow("تاريخ انتهاء العقد يجب أن يكون بعد تاريخ مباشرة العمل");
    expect(() => validateFormDates({ ...form, lastWorkingDay: "2020-01-01" })).toThrow("آخر يوم عمل يجب أن يكون بعد تاريخ مباشرة العمل");
    expect(() => validateFormDates(form)).not.toThrow();
  });

  it("turns a calculation failure into a BAD_REQUEST error", () => {
    expect(() => calculateOrThrow({ ...form, baseSalary: 0, fixedAllowances: 0 }, ctx)).toThrow(
      "الأجر الشهري المعتمد للحساب يجب أن يكون أكبر من صفر"
    );
  });
});

describe("settlement rows", () => {
  it("stores the calculated figures as decimals and the manual inputs as given", () => {
    const calc = calculateOrThrow(form, ctx);
    const values = buildSettlementValues(form, ctx, calc);
    // 5 سنوات: نصف أجر شهر عن كل سنة = 2.5 × 3000
    expect(values.eosAward).toBe("7500.00");
    expect(values.monthlyWage).toBe("3000.00");
    expect(values.serviceYears).toBe(5);
    expect(values.advancesDeduction).toBe("500.00");
    expect(values.violationsDeduction).toBe("100.00");
    expect(values.otherAdditions).toBe("250.00");
    expect(values.netAmount).toBe(calc.netAmount.toFixed(2));
    expect(values.leaveBalanceDaysOverride).toBeNull();
    expect(values.lastPayrollYear).toBe(2026);
    expect(values.lastPayrollMonth).toBe(9);
    expect(values.branchName).toBe("فرع لبن");
    expect(JSON.parse(values.advancesDetails)).toEqual(ctx.advances);
    expect(JSON.parse(values.calculationSnapshot).netAmount).toBe(calc.netAmount);
  });

  it("falls back to the employee file for snapshot fields the form leaves out", () => {
    const { nationality, idNumber, position, ...rest } = form;
    const values = buildSettlementValues(rest as EndOfServiceForm, ctx, calculateOrThrow(form, ctx));
    expect(values.nationality).toBe("مصري");
    expect(values.idNumber).toBe("2412345678");
    expect(values.position).toBe("حلاق");
    const cleared = buildSettlementValues({ ...form, nationality: "  ", position: null }, ctx, calculateOrThrow(form, ctx));
    expect(cleared.nationality).toBeNull();
    expect(cleared.position).toBeNull();
  });

  it("round-trips the saved form for editing and approval recompute", () => {
    const withOverrides: EndOfServiceForm = { ...form, leaveBalanceDaysOverride: 12.5, salaryDaysOverride: 15, leaveNote: "حسب الاتفاق" };
    const row = settlementRow({}, withOverrides);
    expect(row.leaveBalanceDaysOverride).toBe("12.50");
    expect(settlementToForm(row)).toEqual(withOverrides);
  });

  it("maps a row to the print document data", () => {
    const row = settlementRow({
      status: "approved",
      approvedByName: "عمر المطيري",
      approvedAt: new Date("2026-09-02T10:00:00Z"),
      letterDate: "2026-09-01",
    });
    const doc = toDocumentData(row);
    const calc = calculateOrThrow(form, ctx);
    expect(doc.settlementNumber).toBe("EOS-2026-0001");
    expect(doc.status).toBe("approved");
    expect(doc.reason).toBe("contract_expiry");
    expect(doc.employeeName).toBe("محمد إسماعيل");
    expect(doc.idNumber).toBe("2412345678");
    expect(doc.hireDate).toBe("2021-11-01");
    expect(doc.lastWorkingDay).toBe("2026-10-31");
    expect(doc.baseSalary).toBe(2000);
    expect(doc.fixedAllowances).toBe(1000);
    expect(doc.calculation).toEqual(calc);
    expect(doc.advances).toEqual(ctx.advances);
    expect(doc.violations).toEqual(ctx.violations);
    expect(doc.otherAdditionsNote).toBe("بدل تذاكر");
    expect(doc.approvedByName).toBe("عمر المطيري");
  });

  it("recomputes the calculation from the stored columns when the snapshot is unreadable", () => {
    const row = settlementRow({ calculationSnapshot: "{not json" });
    const calc = storedCalculation(row);
    expect(calc.netAmount).toBe(calculateOrThrow(form, ctx).netAmount);
    expect(calc.advancesDeduction).toBe(500);
    expect(_internal.parseCalculationSnapshot(JSON.stringify({ netAmount: 1 }))).toBeNull();
  });

  it("keeps a negative net amount in the list (amount owed by the employee)", () => {
    const row = settlementRow({ netAmount: "-350.00" });
    const listed = toListRow(row);
    expect(listed.netAmount).toBe(-350);
    expect(listed.lastWorkingDay).toBe("2026-10-31");
    expect(listed.branchId).toBe(3);
  });

  it("describes the request with the settlement number and net amount", () => {
    const calc = calculateOrThrow(form, ctx);
    const text = _internal.requestDescription(form, calc, "EOS-2026-0007");
    expect(text).toContain("EOS-2026-0007");
    expect(text).toContain("آخر يوم عمل: 2026-10-31");
    expect(text).toContain(`${calc.netAmount.toFixed(2)} ر.س`);
  });

  it("stores the request's last working day at Riyadh midnight", () => {
    expect(_internal.riyadhMidnight("2026-10-31").toISOString()).toBe("2026-10-30T21:00:00.000Z");
  });
});

describe("employee portal visibility", () => {
  it("shows an end-of-service request to the employee only once approved", () => {
    expect(isRequestVisibleToEmployee({ requestType: "end_of_service", status: "pending" })).toBe(false);
    expect(isRequestVisibleToEmployee({ requestType: "end_of_service", status: "cancelled" })).toBe(false);
    expect(isRequestVisibleToEmployee({ requestType: "end_of_service", status: "approved" })).toBe(true);
    expect(isRequestVisibleToEmployee({ requestType: "advance", status: "pending" })).toBe(true);
  });
});

describe("settled items guard", () => {
  it("names the settlement in the refusal message", () => {
    expect(settledInEndOfServiceMessage("advance", "EOS-2026-0003")).toBe(
      "السلفة مخصومة في مخالصة نهائية (EOS-2026-0003)، ألغِ المخالصة أولاً"
    );
    expect(settledInEndOfServiceMessage("violation")).toBe("المخالفة مخصومة في مخالصة نهائية، ألغِ المخالصة أولاً");
  });
});
