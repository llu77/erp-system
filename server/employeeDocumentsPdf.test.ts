import { beforeEach, describe, expect, it, vi } from "vitest";

// توليد PDF يحتاج متصفحاً: نستبدل خطوة التحويل فقط ونُبقي تحميل الصور الحقيقي
vi.mock("./voucherPdf", async importOriginal => {
  const actual = await importOriginal<typeof import("./voucherPdf")>();
  return {
    ...actual,
    renderHtmlToPdf: vi.fn(async (html: string) => Buffer.from(html, "utf8")),
  };
});

// قاعدة بيانات وهمية: كل جدول يرجع صفوفه المجهزة في الاختبار
const tableRows = new Map<unknown, unknown[]>();
vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({
    select: () => {
      let table: unknown;
      const builder = {
        from(t: unknown) {
          table = t;
          return builder;
        },
        where() {
          return builder;
        },
        limit: async () => tableRows.get(table) ?? [],
      };
      return builder;
    },
  })),
}));

import {
  branches,
  employeeRequests,
  employeeSalarySettings,
  employees,
  endOfServiceSettlements,
  payrollDetails,
  payrolls,
} from "../drizzle/schema";
import { ESTABLISHMENTS } from "../shared/branding";
import {
  advanceRequestFileName,
  generateAdvanceRequestPDF,
  generatePayslipPDF,
  getAdvanceRequestDocumentData,
  getPayslipDocumentData,
  payslipFileName,
  renderPayslipHtmlEmbedded,
} from "./employeeDocumentsPdf";
import { loadDocumentAssetsForBranch, renderHtmlToPdf } from "./voucherPdf";

const PAYROLL = {
  id: 12,
  payrollNumber: "PAY-2026-10-0003",
  branchId: 2,
  branchName: "فرع طويق",
  year: 2026,
  month: 10,
  periodStart: new Date("2026-09-30T21:00:00Z"),
  periodEnd: new Date("2026-10-31T20:59:59Z"),
  status: "approved",
  approvedByName: "عمر المطيري",
  approvedAt: new Date("2026-10-29T10:30:00Z"),
  paidAt: null,
  createdByName: "أحمد",
  createdAt: new Date("2026-10-28T08:00:00Z"),
};

const DETAIL = {
  id: 90,
  payrollId: 12,
  employeeId: 7,
  employeeName: "محمد القحطاني",
  employeeCode: "EMP-0007",
  position: "حلاق",
  baseSalary: "2000.00",
  overtimeEnabled: false,
  overtimeAmount: "0.00",
  workDays: 30,
  absentDays: 0,
  absentDeduction: "0.00",
  incentiveAmount: "0.00",
  isSupervisor: false,
  deductionAmount: "0.00",
  deductionReason: null,
  advanceDeduction: "300.00",
  advanceDetails: JSON.stringify({
    items: [{ id: 44, amount: 300, title: "سلفة", approvedAt: "2026-10-05" }],
    deferredIds: [],
  }),
  violationsDeduction: "0.00",
  violationsDetails: null,
  negativeInvoicesDeduction: "0.00",
  negativeInvoicesDetails: null,
  leaveDays: 0,
  leaveDeduction: "0.00",
  leaveType: null,
  leaveDetails: null,
  grossSalary: "2000.00",
  totalDeductions: "300.00",
  netSalary: "1700.00",
  isPaid: false,
  paidAt: null,
  paymentMethod: null,
  paymentReference: null,
  notes: null,
};

const REQUEST = {
  id: 44,
  requestNumber: "REQ-261012-0044",
  employeeId: 7,
  employeeName: "محمد القحطاني",
  branchId: 1,
  branchName: "فرع لبن",
  requestType: "advance",
  status: "approved",
  title: "طلب سلفة",
  description: null,
  advanceAmount: "300.00",
  advanceReason: "ظرف طارئ",
  repaymentMethod: "salary_deduction",
  reviewedByName: "عمر المطيري",
  reviewedAt: new Date("2026-10-04T09:00:00Z"),
  reviewNotes: null,
  rejectionReason: null,
  deductedInPayrollId: 12,
  settledInEndOfServiceId: null,
  createdAt: new Date("2026-10-03T08:00:00Z"),
};

beforeEach(() => {
  tableRows.clear();
  vi.mocked(renderHtmlToPdf).mockClear();
});

describe("تحميل بيانات قسيمة الراتب", () => {
  it("joins the payroll line, the employee file and the bank details", async () => {
    tableRows.set(payrolls, [PAYROLL]);
    tableRows.set(payrollDetails, [DETAIL]);
    tableRows.set(employees, [
      {
        iqamaNumber: "2412345678",
        nationality: "يمني",
        hireDate: "2020-01-05",
      },
    ]);
    tableRows.set(employeeSalarySettings, [
      { bankName: "الأهلي", iban: "SA4420000001234567891234" },
    ]);
    const data = await getPayslipDocumentData(12, 7);
    expect(data).toMatchObject({
      payrollId: 12,
      payrollNumber: "PAY-2026-10-0003",
      branchName: "فرع طويق",
      status: "approved",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      employee: {
        id: 7,
        name: "محمد القحطاني",
        code: "EMP-0007",
        iqamaNumber: "2412345678",
        nationality: "يمني",
        hireDate: "2020-01-05",
        bankName: "الأهلي",
        iban: "SA4420000001234567891234",
      },
      totals: { grossSalary: 2000, totalDeductions: 300, netSalary: 1700 },
    });
    expect(data?.items.advances).toEqual([
      { label: "سلفة", amount: 300, date: "2026-10-05", note: null },
    ]);
  });

  it("returns null when the payroll or the employee line does not exist", async () => {
    expect(await getPayslipDocumentData(12, 7)).toBeNull();
    tableRows.set(payrolls, [PAYROLL]);
    expect(await getPayslipDocumentData(12, 8)).toBeNull();
  });

  it("works without an employee file or salary settings", async () => {
    tableRows.set(payrolls, [PAYROLL]);
    tableRows.set(payrollDetails, [DETAIL]);
    const data = await getPayslipDocumentData(12, 7);
    expect(data?.employee).toMatchObject({
      iqamaNumber: null,
      bankName: null,
      iban: null,
    });
  });
});

describe("تحميل بيانات طلب السلفة", () => {
  it("returns the advance with employee details and the payroll that deducted it", async () => {
    tableRows.set(employeeRequests, [REQUEST]);
    tableRows.set(employees, [
      {
        code: "EMP-0007",
        position: "حلاق",
        iqamaNumber: "2412345678",
        nationality: "يمني",
        phone: "055",
        hireDate: "2020-01-05",
        branchId: 1,
      },
    ]);
    tableRows.set(payrolls, [
      {
        payrollNumber: "PAY-2026-10-0003",
        year: 2026,
        month: 10,
        status: "approved",
      },
    ]);
    const data = await getAdvanceRequestDocumentData(44);
    expect(data).toMatchObject({
      requestId: 44,
      amount: 300,
      reason: "ظرف طارئ",
      branchName: "فرع لبن",
      employee: { code: "EMP-0007", phone: "055" },
      deduction: {
        kind: "payroll",
        reference: "PAY-2026-10-0003",
        period: "أكتوبر 2026",
        status: "approved",
      },
    });
  });

  it("uses the end-of-service settlement when the advance was settled there", async () => {
    tableRows.set(employeeRequests, [
      { ...REQUEST, deductedInPayrollId: null, settledInEndOfServiceId: 3 },
    ]);
    tableRows.set(endOfServiceSettlements, [
      { settlementNumber: "EOS-2026-0003", status: "approved" },
    ]);
    expect((await getAdvanceRequestDocumentData(44))?.deduction).toEqual({
      kind: "end_of_service",
      reference: "EOS-2026-0003",
      period: null,
      status: "approved",
    });
  });

  it("falls back to the branch table when the request has no saved branch name", async () => {
    tableRows.set(employeeRequests, [
      { ...REQUEST, branchName: null, deductedInPayrollId: null },
    ]);
    tableRows.set(branches, [{ name: "Tuwaiq", nameAr: "فرع طويق" }]);
    expect((await getAdvanceRequestDocumentData(44))?.branchName).toBe(
      "فرع طويق"
    );
  });

  it("returns null for missing requests and for other request types", async () => {
    expect(await getAdvanceRequestDocumentData(44)).toBeNull();
    tableRows.set(employeeRequests, [{ ...REQUEST, requestType: "vacation" }]);
    expect(await getAdvanceRequestDocumentData(44)).toBeNull();
  });
});

describe("توليد PDF لمستندات الموظف", () => {
  it("renders the payslip with the establishment stamp only when approved", async () => {
    tableRows.set(payrolls, [PAYROLL]);
    tableRows.set(payrollDetails, [DETAIL]);
    const data = (await getPayslipDocumentData(12, 7))!;
    const stamp = loadDocumentAssetsForBranch("فرع طويق").stamp as string;
    const pdf = (await generatePayslipPDF(data)).toString("utf8");
    expect(vi.mocked(renderHtmlToPdf)).toHaveBeenCalledTimes(1);
    expect(pdf).toContain(ESTABLISHMENTS.tadarruj.nameAr);
    expect(pdf).toContain(stamp);
    expect(
      renderPayslipHtmlEmbedded({ ...data, status: "pending" })
    ).not.toContain(stamp);
  });

  it("renders the advance request letter", async () => {
    tableRows.set(employeeRequests, [
      { ...REQUEST, deductedInPayrollId: null },
    ]);
    const data = (await getAdvanceRequestDocumentData(44))!;
    const pdf = (await generateAdvanceRequestPDF(data)).toString("utf8");
    expect(pdf).toContain("طلب سلفة");
    expect(pdf).toContain(ESTABLISHMENTS.qessa.nameAr);
  });

  it("builds safe file names", () => {
    expect(
      payslipFileName({
        payrollNumber: "PAY-2026-10-0003",
        employee: { code: "EMP/7" } as never,
      })
    ).toBe("payslip-PAY-2026-10-0003-EMP_7.pdf");
    expect(advanceRequestFileName({ requestNumber: "../REQ 1" })).toBe(
      "advance-request-___REQ_1.pdf"
    );
  });
});
