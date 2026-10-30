import { describe, expect, it } from "vitest";
import { EMPLOYEE_UNAUTHED_ERR_MSG, UNAUTHED_ERR_MSG } from "../shared/const";
import type { PayslipDocumentData } from "../shared/payslipTemplate";
import {
  ADMIN_PORTAL_PATH,
  ADMIN_PORTAL_TABS,
  EMPLOYEE_PORTAL_PATH,
  EMPLOYEE_PORTAL_TABS,
  PORTAL_LOGIN_PATH,
  buildPayslipDeductions,
  buildPayslipEarnings,
  buildTabHref,
  daysUntil,
  describeDaysLeft,
  errorMessage,
  formatPortalDate,
  formatSar,
  isPortalPath,
  netSalaryInWords,
  normalizeAmountInput,
  payrollPeriodLabel,
  payslipStatusInfo,
  pickPayrollId,
  portalHomePath,
  readPositiveIntParam,
  resolveAdminPortalAccess,
  portalLoginUrl,
  resolveAuthRedirect,
  resolvePortalTab,
  safePortalReturnPath,
  shouldRetryQuery,
  summarizeExpiringDocuments,
  validateAdvanceForm,
  validatePasswordChange,
} from "../client/src/lib/portal/portalUi";

function payslip(
  overrides: Partial<PayslipDocumentData> = {}
): PayslipDocumentData {
  return {
    payrollId: 7,
    payrollNumber: "PAY-2026-10-001",
    year: 2026,
    month: 10,
    status: "approved",
    branchId: 1,
    branchName: "فرع لبن",
    employee: { id: 3, name: "أحمد", code: "E003" },
    earnings: {
      baseSalary: 3000,
      overtimeEnabled: true,
      overtimeAmount: 500,
      incentiveAmount: 0,
      isSupervisor: false,
    },
    attendance: { workDays: 28, absentDays: 2, leaveDays: 0, leaveType: null },
    deductions: {
      absentDeduction: 233.33,
      leaveDeduction: 0,
      advanceDeduction: 400,
      violationsDeduction: 0,
      negativeInvoicesDeduction: 0,
      otherDeduction: 50,
      otherDeductionReason: "تأخير",
    },
    items: {
      advances: [{ label: "سلفة REQ-1", amount: 400, date: "2026-10-05" }],
      violations: [],
      leaves: [],
      negativeInvoices: [],
    },
    totals: { grossSalary: 3500, totalDeductions: 683.33, netSalary: 2816.67 },
    ...overrides,
  };
}

describe("portal auth redirects", () => {
  it("sends expired portal sessions to the employee login, never the OAuth login", () => {
    expect(
      resolveAuthRedirect(EMPLOYEE_UNAUTHED_ERR_MSG, EMPLOYEE_PORTAL_PATH)
    ).toBe("employee-login");
    // صفحة في النظام الرئيسي: دخول النظام وليس دخول الموظفين
    expect(resolveAuthRedirect(EMPLOYEE_UNAUTHED_ERR_MSG, "/payrolls")).toBe(
      "oauth-login"
    );
    expect(
      resolveAuthRedirect(EMPLOYEE_UNAUTHED_ERR_MSG, PORTAL_LOGIN_PATH)
    ).toBeNull();
  });

  it("keeps the main-system redirect outside the portal only", () => {
    expect(resolveAuthRedirect(UNAUTHED_ERR_MSG, "/payrolls")).toBe(
      "oauth-login"
    );
    expect(resolveAuthRedirect(UNAUTHED_ERR_MSG, ADMIN_PORTAL_PATH)).toBeNull();
    expect(
      resolveAuthRedirect(UNAUTHED_ERR_MSG, EMPLOYEE_PORTAL_PATH)
    ).toBeNull();
    expect(resolveAuthRedirect("other error", "/")).toBeNull();
  });

  it("recognizes portal paths exactly", () => {
    expect(isPortalPath("/employee-portal")).toBe(true);
    expect(isPortalPath("/employee-portal/x")).toBe(true);
    expect(isPortalPath("/employee-portals")).toBe(false);
    expect(isPortalPath(null)).toBe(false);
  });

  it("routes supervisors to the supervisor dashboard after login", () => {
    expect(portalHomePath({ isSupervisor: true })).toBe(ADMIN_PORTAL_PATH);
    expect(portalHomePath({ isSupervisor: false })).toBe(EMPLOYEE_PORTAL_PATH);
  });

  it("lets supervisor sessions and staff reviewers into the supervisor dashboard", () => {
    expect(resolveAdminPortalAccess({ isSupervisor: true, branchId: 2 }, null)).toEqual({
      kind: "employee",
    });
    // مثل الخادم: مشرف بلا فرع لا يراجع، ومع جلسة نظام يُعامل كمستخدم النظام
    expect(resolveAdminPortalAccess({ isSupervisor: true, branchId: null }, null)).toEqual({
      kind: "redirect",
      to: "/employee-portal",
    });
    expect(resolveAdminPortalAccess({ isSupervisor: true, branchId: 2 }, "manager")).toEqual({ kind: "employee" });
    expect(resolveAdminPortalAccess(null, "admin")).toEqual({ kind: "staff" });
    expect(resolveAdminPortalAccess(null, "viewer")).toEqual({ kind: "staff" });
    expect(
      resolveAdminPortalAccess({ isSupervisor: false }, "manager")
    ).toEqual({ kind: "staff" });
    expect(
      resolveAdminPortalAccess({ isSupervisor: false }, "employee")
    ).toEqual({
      kind: "redirect",
      to: EMPLOYEE_PORTAL_PATH,
    });
    expect(resolveAdminPortalAccess(null, "employee")).toEqual({
      kind: "redirect",
      to: PORTAL_LOGIN_PATH,
    });
    expect(resolveAdminPortalAccess(null, undefined)).toEqual({
      kind: "redirect",
      to: PORTAL_LOGIN_PATH,
    });
  });
});

describe("portal tabs from the URL", () => {
  it("opens the requested tab when allowed", () => {
    expect(resolvePortalTab("?tab=salary", EMPLOYEE_PORTAL_TABS, "chat")).toBe(
      "salary"
    );
    expect(resolvePortalTab("tab=bonus", EMPLOYEE_PORTAL_TABS, "chat")).toBe(
      "bonus"
    );
    expect(
      resolvePortalTab("tab=requests", ADMIN_PORTAL_TABS, "dashboard")
    ).toBe("requests");
  });

  it("maps aliases and falls back for unknown tabs", () => {
    expect(resolvePortalTab("tab=payslip", EMPLOYEE_PORTAL_TABS, "chat")).toBe(
      "salary"
    );
    expect(
      resolvePortalTab("tab=documents", EMPLOYEE_PORTAL_TABS, "chat")
    ).toBe("profile");
    expect(
      resolvePortalTab("tab=documents", ADMIN_PORTAL_TABS, "dashboard")
    ).toBe("documents");
    expect(resolvePortalTab("tab=hack", EMPLOYEE_PORTAL_TABS, "chat")).toBe(
      "chat"
    );
    expect(resolvePortalTab("", EMPLOYEE_PORTAL_TABS, "chat")).toBe("chat");
    expect(resolvePortalTab(null, EMPLOYEE_PORTAL_TABS, "chat")).toBe("chat");
  });

  it("reads positive integer params and keeps other params when switching tabs", () => {
    expect(readPositiveIntParam("?tab=salary&payrollId=12", "payrollId")).toBe(
      12
    );
    expect(readPositiveIntParam("payrollId=0", "payrollId")).toBeNull();
    expect(readPositiveIntParam("payrollId=-3", "payrollId")).toBeNull();
    expect(readPositiveIntParam("payrollId=1e3", "payrollId")).toBeNull();
    expect(
      buildTabHref(EMPLOYEE_PORTAL_PATH, "?tab=salary&payrollId=12", "requests")
    ).toBe("/employee-portal?tab=requests&payrollId=12");
    expect(buildTabHref(EMPLOYEE_PORTAL_PATH, "", "salary")).toBe(
      "/employee-portal?tab=salary"
    );
  });
});

describe("portal dates and amounts", () => {
  it("formats the Riyadh calendar day in the Gregorian calendar", () => {
    // 22:30 UTC is already the next day in Riyadh
    expect(formatPortalDate(new Date("2026-03-01T22:30:00Z"))).toBe(
      formatPortalDate("2026-03-02")
    );
    expect(formatPortalDate("2026-03-02")).toContain("مارس");
    expect(formatPortalDate(null)).toBe("-");
    expect(formatPortalDate("", "غير مسجل")).toBe("غير مسجل");
    expect(formatPortalDate("not a date")).toBe("-");
  });

  it("counts days to a document expiry in Riyadh calendar days", () => {
    const now = new Date("2026-03-01T22:30:00Z"); // 2026-03-02 in Riyadh
    expect(daysUntil("2026-03-02", now)).toBe(0);
    expect(daysUntil("2026-03-01", now)).toBe(-1);
    expect(daysUntil("2026-04-01", now)).toBe(30);
    expect(daysUntil(null, now)).toBeNull();
    expect(describeDaysLeft(-1)).toBe("منتهية");
    expect(describeDaysLeft(0)).toBe("تنتهي اليوم");
    expect(describeDaysLeft(12)).toBe("12 يوم");
    expect(describeDaysLeft(null)).toBe("قريباً");
  });

  it("formats riyal amounts and period labels", () => {
    expect(formatSar(1500)).toContain("ر.س");
    expect(formatSar("abc")).toBe(formatSar(0));
    expect(payrollPeriodLabel(2026, 10)).toBe("أكتوبر 2026");
    expect(payrollPeriodLabel(2026, 13)).toBe("13/2026");
  });
});

describe("payslip view", () => {
  it("shows approved and paid slips as green with the requested labels", () => {
    expect(payslipStatusInfo("approved").label).toBe("معتمد");
    expect(payslipStatusInfo("paid").label).toBe("تم الصرف");
    expect(payslipStatusInfo("approved").className).toContain("emerald");
    expect(payslipStatusInfo("paid").className).toContain("emerald");
    expect(payslipStatusInfo("draft").className).toContain("amber");
  });

  it("lists earnings: base always, overtime and incentives only when present", () => {
    const lines = buildPayslipEarnings(payslip());
    expect(lines.map(l => l.key)).toEqual(["base", "overtime"]);
    const supervisor = buildPayslipEarnings(
      payslip({
        earnings: {
          baseSalary: 3000,
          overtimeEnabled: false,
          overtimeAmount: 500,
          incentiveAmount: 200,
          isSupervisor: true,
        },
      })
    );
    expect(supervisor.map(l => l.label)).toEqual([
      "الراتب الأساسي",
      "حوافز المشرف",
    ]);
  });

  it("lists deductions with their item details and reason", () => {
    const lines = buildPayslipDeductions(payslip());
    expect(lines.map(l => l.key)).toEqual(["absent", "advance", "other"]);
    expect(lines[0].label).toBe("خصم الغياب (2 يوم)");
    expect(lines[1].items).toHaveLength(1);
    expect(lines[2].note).toBe("تأخير");
  });

  it("labels leave deductions with the leave kind", () => {
    const lines = buildPayslipDeductions(
      payslip({
        attendance: {
          workDays: 25,
          absentDays: 0,
          leaveDays: 3,
          leaveType: "unpaid",
        },
        deductions: {
          absentDeduction: 0,
          leaveDeduction: 300,
          advanceDeduction: 0,
          violationsDeduction: 0,
          negativeInvoicesDeduction: 0,
          otherDeduction: 0,
        },
      })
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].label).toBe("خصم الإجازات (3 يوم - بدون راتب)");
  });

  it("writes a negative net as an amount owed by the employee", () => {
    expect(netSalaryInWords(2000)).toContain("ألفا");
    expect(netSalaryInWords(-150)).toContain("مستحق على الموظف");
  });

  it("selects the requested slip when it exists, otherwise the newest", () => {
    const slips = [{ payrollId: 9 }, { payrollId: 7 }];
    expect(pickPayrollId(slips, 7)).toBe(7);
    expect(pickPayrollId(slips, 99)).toBe(9);
    expect(pickPayrollId(slips, null)).toBe(9);
    expect(pickPayrollId([], 7)).toBeNull();
  });
});

describe("advance request form", () => {
  it("accepts Arabic digits and thousands separators", () => {
    expect(normalizeAmountInput("١٬٥٠٠٫٥")).toBe("1500.5");
    const result = validateAdvanceForm({
      amount: "١٥٠٠",
      reason: "ظرف عائلي",
      repaymentMethod: "installments",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        amount: 1500,
        reason: "ظرف عائلي",
        repaymentMethod: "installments",
      },
    });
    expect(
      validateAdvanceForm({
        amount: "1,500.50",
        reason: "سبب",
        repaymentMethod: "salary_deduction",
      }).ok
    ).toBe(true);
  });

  it("rejects out-of-range or malformed amounts, short reasons and unknown methods", () => {
    const bad = (amount: string) =>
      validateAdvanceForm({
        amount,
        reason: "سبب واضح",
        repaymentMethod: "full_payment",
      });
    for (const amount of ["", "0", "0.5", "100000.01", "12.345", "abc", "-5"]) {
      const r = bad(amount);
      expect(r.ok, amount).toBe(false);
      if (!r.ok) expect(r.errors.amount, amount).toBeTruthy();
    }
    expect(bad("100000").ok).toBe(true);
    const r = validateAdvanceForm({
      amount: "500",
      reason: " ab ",
      repaymentMethod: "weekly",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.reason).toBeTruthy();
      expect(r.errors.repaymentMethod).toBeTruthy();
      expect(r.errors.amount).toBeUndefined();
    }
  });
});

describe("password change form", () => {
  it("validates the new password before calling the server", () => {
    const base = {
      currentPassword: "old-pass-1",
      newPassword: "new-pass-12",
      confirmPassword: "new-pass-12",
    };
    expect(validatePasswordChange(base)).toBeNull();
    expect(validatePasswordChange({ ...base, currentPassword: "" })).toContain(
      "الحالية"
    );
    expect(
      validatePasswordChange({
        ...base,
        newPassword: "short",
        confirmPassword: "short",
      })
    ).toContain("8");
    expect(
      validatePasswordChange({
        ...base,
        newPassword: "old-pass-1",
        confirmPassword: "old-pass-1",
      })
    ).toContain("تختلف");
    expect(
      validatePasswordChange({ ...base, confirmPassword: "other-pass" })
    ).toContain("غير مطابق");
  });
});

describe("supervisor dashboard document counts", () => {
  it("prefers the server summary and falls back to list lengths", () => {
    expect(
      summarizeExpiringDocuments({
        summary: { totalExpired: 4, totalExpiring: 2 },
      })
    ).toEqual({ expired: 4, expiring: 2 });
    expect(
      summarizeExpiringDocuments({
        expired: { iqama: [1, 2], healthCert: [3], contract: [] },
        expiring: { iqama: [], healthCert: [4], contract: [5, 6] },
      })
    ).toEqual({ expired: 3, expiring: 3 });
    expect(summarizeExpiringDocuments(null)).toEqual({
      expired: 0,
      expiring: 0,
    });
  });
});

describe("portal errors", () => {
  it("hides raw validation payloads behind a readable message", () => {
    expect(
      errorMessage(new Error("اسم المستخدم أو كلمة المرور غير صحيحة"), "x")
    ).toBe("اسم المستخدم أو كلمة المرور غير صحيحة");
    expect(
      errorMessage(new Error('[{"code":"too_small"}]'), "تحقق من البيانات")
    ).toBe("تحقق من البيانات");
    expect(errorMessage(null, "fallback")).toBe("fallback");
  });

  it("does not retry authorization or not-found errors", () => {
    expect(shouldRetryQuery(0, { data: { code: "UNAUTHORIZED" } })).toBe(false);
    expect(shouldRetryQuery(0, { data: { code: "NOT_FOUND" } })).toBe(false);
    expect(shouldRetryQuery(0, new Error("network"))).toBe(true);
    expect(shouldRetryQuery(2, new Error("network"))).toBe(false);
  });
});

describe("login return path", () => {
  it("returns only to portal pages, never off-site or to the login page", () => {
    expect(safePortalReturnPath("/employee-portal?tab=salary&payrollId=12")).toBe("/employee-portal?tab=salary&payrollId=12");
    expect(safePortalReturnPath("/admin-employee-portal?tab=requests")).toBe("/admin-employee-portal?tab=requests");
    for (const bad of ["https://evil.example/x", "//evil.example", "/\\evil.example", "/payrolls", "/employee-login?next=/x", "", null]) {
      expect(safePortalReturnPath(bad as string | null)).toBeNull();
    }
  });

  it("builds the login URL with an encoded next parameter", () => {
    expect(portalLoginUrl("/employee-portal?tab=salary")).toBe("/employee-login?next=%2Femployee-portal%3Ftab%3Dsalary");
    expect(portalLoginUrl("/payrolls")).toBe("/employee-login");
    expect(portalLoginUrl(undefined)).toBe("/employee-login");
  });
});
