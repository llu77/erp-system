import { beforeEach, describe, expect, it, vi } from "vitest";

// خدمة البريد تُنشأ عند تحميل الموجّه وتتطلب مفتاحاً؛ لا تُستخدم في هذه الاختبارات
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: vi.fn(async () => ({ data: { id: "test" }, error: null })) };
  },
}));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getPayrollById: vi.fn(),
    getEmployeeRequestById: vi.fn(),
    getEmployeeById: vi.fn(),
  };
});

vi.mock("./employeeDocumentsPdf", async importOriginal => {
  const actual =
    await importOriginal<typeof import("./employeeDocumentsPdf")>();
  return {
    ...actual,
    getPayslipDocumentData: vi.fn(),
    getAdvanceRequestDocumentData: vi.fn(),
    generatePayslipPDF: vi.fn(async () => Buffer.from("PAYSLIP-PDF")),
    generateAdvanceRequestPDF: vi.fn(async () => Buffer.from("ADVANCE-PDF")),
  };
});

import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import * as docs from "./employeeDocumentsPdf";
import { appRouter } from "./routers";

type Role = "admin" | "manager" | "supervisor" | "viewer" | "employee" | "user";

function caller(role: Role, branchId: number | null = null) {
  const ctx = {
    user: {
      id: 5,
      openId: "u5",
      email: null,
      name: "مستخدم",
      loginMethod: "local",
      role,
      branchId,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} },
    res: { clearCookie: vi.fn(), cookie: vi.fn() },
  } as unknown as TrpcContext;
  return appRouter.createCaller(ctx);
}

const PAYSLIP = {
  payrollId: 12,
  payrollNumber: "PAY-2026-10-0003",
  employee: { id: 7, name: "محمد", code: "EMP-0007" },
} as unknown as Awaited<ReturnType<typeof docs.getPayslipDocumentData>>;

const ADVANCE = {
  requestId: 44,
  requestNumber: "REQ-261012-0044",
} as unknown as Awaited<ReturnType<typeof docs.getAdvanceRequestDocumentData>>;

beforeEach(() => {
  vi.mocked(db.getPayrollById).mockReset();
  vi.mocked(db.getEmployeeRequestById).mockReset();
  vi.mocked(db.getEmployeeById).mockReset();
  vi.mocked(docs.getPayslipDocumentData).mockReset();
  vi.mocked(docs.getAdvanceRequestDocumentData).mockReset();
  vi.mocked(docs.generatePayslipPDF).mockClear();
});

describe("payrolls.payslipPdf", () => {
  it("returns a base64 PDF and a safe file name for any payroll status", async () => {
    vi.mocked(db.getPayrollById).mockResolvedValue({
      id: 12,
      branchId: 1,
      status: "draft",
    } as never);
    vi.mocked(docs.getPayslipDocumentData).mockResolvedValue(PAYSLIP);
    const result = await caller("manager").payrolls.payslipPdf({
      payrollId: 12,
      employeeId: 7,
    });
    expect(Buffer.from(result.pdf, "base64").toString()).toBe("PAYSLIP-PDF");
    expect(result.filename).toBe("payroll-statement-PAY-2026-10-0003-EMP-0007.pdf");
    expect(docs.getPayslipDocumentData).toHaveBeenCalledWith(12, 7);
  });

  it("limits branch supervisors to their branch and rejects employees", async () => {
    vi.mocked(db.getPayrollById).mockResolvedValue({
      id: 12,
      branchId: 2,
    } as never);
    vi.mocked(docs.getPayslipDocumentData).mockResolvedValue(PAYSLIP);
    await expect(
      caller("supervisor", 1).payrolls.payslipPdf({
        payrollId: 12,
        employeeId: 7,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      caller("supervisor", null).payrolls.payslipDocument({
        payrollId: 12,
        employeeId: 7,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      caller("employee").payrolls.payslipPdf({ payrollId: 12, employeeId: 7 })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      caller("supervisor", 2).payrolls.payslipDocument({
        payrollId: 12,
        employeeId: 7,
      })
    ).resolves.toBe(PAYSLIP);
    expect(docs.generatePayslipPDF).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for a missing payroll or employee line", async () => {
    await expect(
      caller("admin").payrolls.payslipPdf({ payrollId: 99, employeeId: 7 })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "المسير غير موجود",
    });
    vi.mocked(db.getPayrollById).mockResolvedValue({
      id: 12,
      branchId: 1,
    } as never);
    vi.mocked(docs.getPayslipDocumentData).mockResolvedValue(null);
    await expect(
      caller("admin").payrolls.payslipPdf({ payrollId: 12, employeeId: 8 })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "الموظف غير موجود في هذا المسير",
    });
  });

  it("reports a PDF engine failure in Arabic", async () => {
    vi.mocked(db.getPayrollById).mockResolvedValue({
      id: 12,
      branchId: 1,
    } as never);
    vi.mocked(docs.getPayslipDocumentData).mockResolvedValue(PAYSLIP);
    vi.mocked(docs.generatePayslipPDF).mockRejectedValueOnce(
      new Error("no chromium")
    );
    await expect(
      caller("admin").payrolls.payslipPdf({ payrollId: 12, employeeId: 7 })
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "تعذر توليد ملف PDF، استخدم زر الطباعة من المتصفح",
    });
  });

  it("validates the input", async () => {
    await expect(
      caller("admin").payrolls.payslipPdf({ payrollId: 0, employeeId: 7 })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("employeeRequests.advancePdf", () => {
  it("returns the advance request PDF", async () => {
    vi.mocked(db.getEmployeeRequestById).mockResolvedValue({
      id: 44,
      requestType: "advance",
      employeeId: 7,
      branchId: 1,
    } as never);
    vi.mocked(docs.getAdvanceRequestDocumentData).mockResolvedValue(ADVANCE);
    const result = await caller("viewer").employeeRequests.advancePdf({
      id: 44,
    });
    expect(Buffer.from(result.pdf, "base64").toString()).toBe("ADVANCE-PDF");
    expect(result.filename).toBe("advance-request-REQ-261012-0044.pdf");
  });

  it("refuses other request types and missing requests", async () => {
    vi.mocked(db.getEmployeeRequestById).mockResolvedValue({
      id: 45,
      requestType: "vacation",
      employeeId: 7,
      branchId: 1,
    } as never);
    await expect(
      caller("admin").employeeRequests.advancePdf({ id: 45 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    vi.mocked(db.getEmployeeRequestById).mockResolvedValue(undefined as never);
    await expect(
      caller("admin").employeeRequests.advanceDocument({ id: 46 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("limits branch supervisors to requests of their branch employees", async () => {
    vi.mocked(db.getEmployeeRequestById).mockResolvedValue({
      id: 44,
      requestType: "advance",
      employeeId: 7,
      branchId: 1,
    } as never);
    vi.mocked(db.getEmployeeById).mockResolvedValue({
      id: 7,
      branchId: 2,
    } as never);
    vi.mocked(docs.getAdvanceRequestDocumentData).mockResolvedValue(ADVANCE);
    await expect(
      caller("supervisor", 1).employeeRequests.advancePdf({ id: 44 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller("supervisor", 2).employeeRequests.advanceDocument({ id: 44 })
    ).resolves.toBe(ADVANCE);
    await expect(
      caller("employee").employeeRequests.advancePdf({ id: 44 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
