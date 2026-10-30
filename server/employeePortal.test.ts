/**
 * بوابة الموظفين عبر appRouter.createCaller:
 * - الهوية من جلسة البوابة فقط (لا يقرأ الموظف بيانات موظف آخر)
 * - مراجعة الطلبات: قيد الانتظار فقط، نطاق الفرع، منع اعتماد الطلب الشخصي، السجل والإشعارات
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// خدمة البريد تُنشأ عند تحميل الموجّه وتتطلب مفتاحاً؛ لا تُستخدم في هذه الاختبارات
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: vi.fn(async () => ({ data: { id: "test" }, error: null })) };
  },
}));
import { TRPCError } from "@trpc/server";
import { EMPLOYEE_UNAUTHED_ERR_MSG } from "../shared/const";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  getEmployeeRequestById: vi.fn(),
  getEmployeeById: vi.fn(),
  getBranchById: vi.fn(),
  isEmployeeSlipVisible: vi.fn(),
  getEmployeeSalarySlips: vi.fn(),
  getEmployeeRequestsByEmployeeId: vi.fn(),
  getRequestAttachments: vi.fn(),
  getRequestTimeline: vi.fn(),
  getEmployeeRequestLogs: vi.fn(),
  reviewPendingEmployeeRequest: vi.fn(),
  createEmployeeRequestLog: vi.fn(),
  createNotification: vi.fn(),
  getAllEmployeeRequests: vi.fn(),
  getEmployeeDetailsForPortalAdmin: vi.fn(),
  getEmployeesForPortalAdmin: vi.fn(),
  createEmployeeRequest: vi.fn(),
  getPortalSupervisorIdsForBranch: vi.fn(),
  getEmployeeProfile: vi.fn(),
  deleteRequestAttachment: vi.fn(),
  cancelEmployeeRequest: vi.fn(),
}));

vi.mock("./employeeDocumentsPdf", () => ({
  getPayslipDocumentData: vi.fn(),
  generatePayslipPDF: vi.fn(),
  payslipFileName: vi.fn(() => "payslip.pdf"),
  getAdvanceRequestDocumentData: vi.fn(),
  generateAdvanceRequestPDF: vi.fn(),
  advanceRequestFileName: vi.fn(() => "advance.pdf"),
}));

vi.mock("./services/portalNotificationService", () => ({
  notifyRequestApproved: vi.fn(),
  notifyRequestRejected: vi.fn(),
  notifySupervisorNewRequest: vi.fn(),
  notifySalaryReady: vi.fn(),
  getNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  deleteNotification: vi.fn(),
}));

vi.mock("./payroll/service", () => {
  class PayrollError extends Error {
    constructor(message: string, public code: "NOT_FOUND" | "CONFLICT" | "BAD_REQUEST" | "FORBIDDEN" = "BAD_REQUEST") {
      super(message);
    }
  }
  return {
    PayrollError,
    assertSourceNotLocked: vi.fn(),
    syncOpenPayrollsForEmployee: vi.fn(),
  };
});

vi.mock("./notifications/emailNotificationService", () => ({
  notifyRequestStatusUpdate: vi.fn().mockResolvedValue(undefined),
  notifyEmployeeRequestApproved: vi.fn().mockResolvedValue(undefined),
  notifyEmployeeRequestRejected: vi.fn().mockResolvedValue(undefined),
  notifyNewEmployeeRequest: vi.fn().mockResolvedValue(undefined),
  notifyEmployeeRequestSubmitted: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./notifications/twilioService", () => ({
  sendRequestApprovedNotification: vi.fn().mockResolvedValue(undefined),
  sendRequestRejectedNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

import * as db from "./db";
import * as pdf from "./employeeDocumentsPdf";
import * as portalNotifications from "./services/portalNotificationService";
import * as payrollService from "./payroll/service";
import { appRouter } from "./routers";

type PortalEmployee = NonNullable<TrpcContext["employee"]>;
type StaffUser = NonNullable<TrpcContext["user"]>;

const EMPLOYEE_A: PortalEmployee = { id: 10, name: "موظف أ", code: "A10", branchId: 1, isSupervisor: false };
const EMPLOYEE_B_ID = 20;
const SUPERVISOR_BRANCH_1: PortalEmployee = { id: 30, name: "مشرف فرع 1", code: "S30", branchId: 1, isSupervisor: true };

function baseCtx(): Pick<TrpcContext, "req" | "res"> {
  return {
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function employeeCaller(employee: PortalEmployee) {
  return appRouter.createCaller({ ...baseCtx(), user: null, employee });
}

function anonymousCaller() {
  return appRouter.createCaller({ ...baseCtx(), user: null, employee: null });
}

function staffCaller(overrides: Partial<StaffUser>) {
  const user = {
    id: 1,
    openId: "staff",
    email: null,
    name: "مدير النظام",
    loginMethod: "local",
    role: "admin",
    branchId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  } as StaffUser;
  return appRouter.createCaller({ ...baseCtx(), user, employee: null });
}

function requestRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 100,
    requestNumber: "REQ-261030-0001",
    employeeId: EMPLOYEE_A.id,
    employeeName: "موظف أ",
    branchId: 1,
    branchName: "فرع 1",
    requestType: "advance",
    status: "pending",
    title: "طلب سلفة",
    description: null,
    advanceAmount: "500.00",
    reviewedAt: null,
    reviewedBy: null,
    reviewedByName: null,
    createdAt: new Date("2026-10-01T08:00:00Z"),
    ...overrides,
  } as any;
}

async function expectTrpcError(promise: Promise<unknown>, code: TRPCError["code"]) {
  await expect(promise).rejects.toMatchObject({ code });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.getEmployeeById).mockImplementation(async (id: number) =>
    ({ id, name: `موظف ${id}`, branchId: id === EMPLOYEE_B_ID ? 2 : 1, isActive: true, email: null, phone: null }) as any
  );
  vi.mocked(db.getBranchById).mockResolvedValue({ id: 1, name: "Branch 1", nameAr: "فرع 1" } as any);
  vi.mocked(db.reviewPendingEmployeeRequest).mockResolvedValue(true);
  vi.mocked(db.createEmployeeRequestLog).mockResolvedValue(undefined);
  vi.mocked(db.createNotification).mockResolvedValue(undefined);
  vi.mocked(payrollService.assertSourceNotLocked).mockResolvedValue(undefined);
  vi.mocked(payrollService.syncOpenPayrollsForEmployee).mockResolvedValue(0);
  vi.mocked(portalNotifications.notifyRequestApproved).mockResolvedValue(1);
  vi.mocked(portalNotifications.notifyRequestRejected).mockResolvedValue(1);
});

describe("employee portal session", () => {
  it("rejects calls without a portal session using the portal login message", async () => {
    await expect(anonymousCaller().employeePortal.getProfile()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: EMPLOYEE_UNAUTHED_ERR_MSG,
    });
    await expectTrpcError(anonymousCaller().employeePortal.getMyRequests(), "UNAUTHORIZED");
    await expectTrpcError(anonymousCaller().portalNotifications.getUnreadCount(), "UNAUTHORIZED");
  });

  it("does not accept a staff session as an employee identity", async () => {
    await expectTrpcError(staffCaller({ role: "admin" }).employeePortal.getSalarySlips(), "UNAUTHORIZED");
  });

  it("me() returns null without a portal session", async () => {
    await expect(anonymousCaller().employeeAuth.me()).resolves.toBeNull();
  });

  it("logout clears the portal cookie", async () => {
    const ctx = { ...baseCtx(), user: null, employee: null };
    await expect(appRouter.createCaller(ctx).employeeAuth.logout()).resolves.toEqual({ success: true });
    expect(ctx.res.clearCookie).toHaveBeenCalledWith("emp_session", expect.objectContaining({ httpOnly: true }));
  });
});

describe("employee portal ownership (IDOR)", () => {
  it("lists only the session employee's requests and hides unapproved end-of-service", async () => {
    vi.mocked(db.getEmployeeRequestsByEmployeeId).mockResolvedValue([
      requestRow(),
      requestRow({ id: 101, requestType: "end_of_service", status: "pending" }),
      requestRow({ id: 102, requestType: "end_of_service", status: "approved" }),
    ]);
    const rows = await employeeCaller(EMPLOYEE_A).employeePortal.getMyRequests();
    expect(db.getEmployeeRequestsByEmployeeId).toHaveBeenCalledWith(EMPLOYEE_A.id);
    expect(rows.map(r => r.id)).toEqual([100, 102]);

    await employeeCaller(EMPLOYEE_A).employeeAuth.getMyRequests();
    expect(db.getEmployeeRequestsByEmployeeId).toHaveBeenLastCalledWith(EMPLOYEE_A.id);
  });

  it("employee A cannot read employee B's payslip", async () => {
    vi.mocked(db.isEmployeeSlipVisible).mockImplementation(async (employeeId: number) => employeeId === EMPLOYEE_B_ID);
    await expectTrpcError(employeeCaller(EMPLOYEE_A).employeePortal.getSalarySlip({ payrollId: 5 }), "NOT_FOUND");
    await expectTrpcError(employeeCaller(EMPLOYEE_A).employeePortal.payslipPdf({ payrollId: 5 }), "NOT_FOUND");
    expect(db.isEmployeeSlipVisible).toHaveBeenCalledWith(EMPLOYEE_A.id, 5);
    expect(pdf.getPayslipDocumentData).not.toHaveBeenCalled();
    expect(pdf.generatePayslipPDF).not.toHaveBeenCalled();
  });

  it("returns the employee's own approved payslip and PDF", async () => {
    const slip = { payrollId: 5, payrollNumber: "PAY-1", status: "approved", employee: { id: EMPLOYEE_A.id, code: "A10" } } as any;
    vi.mocked(db.isEmployeeSlipVisible).mockResolvedValue(true);
    vi.mocked(pdf.getPayslipDocumentData).mockResolvedValue(slip);
    vi.mocked(pdf.generatePayslipPDF).mockResolvedValue(Buffer.from("%PDF-1.4"));

    await expect(employeeCaller(EMPLOYEE_A).employeePortal.getSalarySlip({ payrollId: 5 })).resolves.toBe(slip);
    expect(pdf.getPayslipDocumentData).toHaveBeenCalledWith(5, EMPLOYEE_A.id);
    await expect(employeeCaller(EMPLOYEE_A).employeePortal.payslipPdf({ payrollId: 5 })).resolves.toEqual({
      pdf: Buffer.from("%PDF-1.4").toString("base64"),
      filename: "payslip.pdf",
    });
  });

  it("hides a payslip whose loaded status is not approved or paid", async () => {
    vi.mocked(db.isEmployeeSlipVisible).mockResolvedValue(true);
    vi.mocked(pdf.getPayslipDocumentData).mockResolvedValue({ status: "draft", employee: { id: EMPLOYEE_A.id } } as any);
    await expectTrpcError(employeeCaller(EMPLOYEE_A).employeePortal.getSalarySlip({ payrollId: 5 }), "NOT_FOUND");
  });

  it("employee A cannot read B's attachments, timeline or advance document", async () => {
    vi.mocked(db.getEmployeeRequestById).mockResolvedValue(requestRow({ employeeId: EMPLOYEE_B_ID }));
    const caller = employeeCaller(EMPLOYEE_A);
    await expectTrpcError(caller.employeePortal.getAttachments({ requestId: 100 }), "NOT_FOUND");
    await expectTrpcError(caller.employeePortal.getRequestTimeline({ requestId: 100 }), "NOT_FOUND");
    await expectTrpcError(caller.employeePortal.advanceRequestPdf({ requestId: 100 }), "NOT_FOUND");
    await expectTrpcError(
      caller.employeePortal.uploadAttachment({ requestId: 100, fileName: "a.pdf", base64Data: Buffer.from("%PDF-1.4").toString("base64"), contentType: "application/pdf" }),
      "NOT_FOUND"
    );
    expect(db.getRequestAttachments).not.toHaveBeenCalled();
    expect(pdf.getAdvanceRequestDocumentData).not.toHaveBeenCalled();
  });

  it("returns the advance request PDF only for the employee's own advance", async () => {
    vi.mocked(db.getEmployeeRequestById).mockResolvedValue(requestRow({ requestType: "vacation" }));
    await expectTrpcError(employeeCaller(EMPLOYEE_A).employeePortal.advanceRequestPdf({ requestId: 100 }), "NOT_FOUND");

    vi.mocked(db.getEmployeeRequestById).mockResolvedValue(requestRow());
    vi.mocked(pdf.getAdvanceRequestDocumentData).mockResolvedValue({ requestNumber: "REQ-1", employee: { id: EMPLOYEE_A.id } } as any);
    vi.mocked(pdf.generateAdvanceRequestPDF).mockResolvedValue(Buffer.from("pdf"));
    await expect(employeeCaller(EMPLOYEE_A).employeePortal.advanceRequestPdf({ requestId: 100 })).resolves.toEqual({
      pdf: Buffer.from("pdf").toString("base64"),
      filename: "advance.pdf",
    });
  });

  it("builds the request timeline from the request log", async () => {
    vi.mocked(db.getEmployeeRequestById).mockResolvedValue(requestRow());
    vi.mocked(db.getRequestTimeline).mockResolvedValue([]);
    vi.mocked(db.getEmployeeRequestLogs).mockResolvedValue([
      { id: 2, requestId: 100, newStatus: "approved", notes: "تمت", performedByName: "المدير", createdAt: new Date("2026-10-02T08:00:00Z") },
      { id: 1, requestId: 100, newStatus: "pending", notes: null, performedByName: "موظف أ", createdAt: new Date("2026-10-01T08:00:00Z") },
    ] as any);
    const timeline = await employeeCaller(EMPLOYEE_A).employeePortal.getRequestTimeline({ requestId: 100 });
    expect(timeline.map(e => e.status)).toEqual(["submitted", "approved"]);
    expect(timeline[1].actionByName).toBe("المدير");
  });

  it("creates an advance request for the session employee only", async () => {
    vi.mocked(db.createEmployeeRequest).mockResolvedValue({ requestNumber: "REQ-261030-1234", insertId: 555 } as any);
    vi.mocked(db.getPortalSupervisorIdsForBranch).mockResolvedValue([SUPERVISOR_BRANCH_1.id, EMPLOYEE_A.id]);

    const result = await employeeCaller(EMPLOYEE_A).employeePortal.createAdvanceRequest({
      amount: 750.555,
      reason: "  ظروف عائلية  ",
      repaymentMethod: "installments",
    });
    expect(result).toEqual({ id: 555, requestNumber: "REQ-261030-1234" });
    expect(db.createEmployeeRequest).toHaveBeenCalledWith(expect.objectContaining({
      employeeId: EMPLOYEE_A.id,
      branchId: 1,
      branchName: "فرع 1",
      requestType: "advance",
      title: "طلب سلفة",
      advanceAmount: "750.56",
      advanceReason: "ظروف عائلية",
      repaymentMethod: "installments",
    }));
    expect(db.createEmployeeRequestLog).toHaveBeenCalledWith(expect.objectContaining({ requestId: 555, newStatus: "pending" }));
    await vi.waitFor(() => expect(portalNotifications.notifySupervisorNewRequest).toHaveBeenCalledTimes(1));
    expect(portalNotifications.notifySupervisorNewRequest).toHaveBeenCalledWith(SUPERVISOR_BRANCH_1.id, 555, "advance", expect.any(String), "فرع 1");
  });

  it("validates the advance amount and reason", async () => {
    const caller = employeeCaller(EMPLOYEE_A);
    await expectTrpcError(caller.employeePortal.createAdvanceRequest({ amount: 0, reason: "سبب كافٍ", repaymentMethod: "salary_deduction" }), "BAD_REQUEST");
    await expectTrpcError(caller.employeePortal.createAdvanceRequest({ amount: 100001, reason: "سبب كافٍ", repaymentMethod: "salary_deduction" }), "BAD_REQUEST");
    await expectTrpcError(caller.employeePortal.createAdvanceRequest({ amount: 100, reason: "  ", repaymentMethod: "salary_deduction" }), "BAD_REQUEST");
    expect(db.createEmployeeRequest).not.toHaveBeenCalled();
  });
});

describe("request review (portalAdmin.updateRequestStatus / employeeRequests.updateStatus)", () => {
  it("requires a reviewer session", async () => {
    await expectTrpcError(anonymousCaller().portalAdmin.updateRequestStatus({ requestId: 100, status: "approved" }), "UNAUTHORIZED");
    await expectTrpcError(employeeCaller(EMPLOYEE_A).portalAdmin.updateRequestStatus({ requestId: 100, status: "approved" }), "FORBIDDEN");
    await expectTrpcError(employeeCaller(EMPLOYEE_A).portalAdmin.getRequests(), "FORBIDDEN");
    expect(db.reviewPendingEmployeeRequest).not.toHaveBeenCalled();
  });

  it("approves a pending request in the supervisor's branch with log, payroll sync and portal notification", async () => {
    vi.mocked(db.getEmployeeRequestById).mockResolvedValue(requestRow());
    const result = await employeeCaller(SUPERVISOR_BRANCH_1).portalAdmin.updateRequestStatus({
      requestId: 100,
      status: "approved",
      reviewNotes: "موافق",
    });
    expect(result.success).toBe(true);
    expect(db.reviewPendingEmployeeRequest).toHaveBeenCalledWith(100, expect.objectContaining({
      status: "approved",
      reviewedBy: SUPERVISOR_BRANCH_1.id,
      reviewedByName: SUPERVISOR_BRANCH_1.name,
      reviewNotes: "موافق",
    }));
    expect(payrollService.assertSourceNotLocked).toHaveBeenCalledWith("advance", 100);
    expect(db.createEmployeeRequestLog).toHaveBeenCalledWith(expect.objectContaining({ requestId: 100, oldStatus: "pending", newStatus: "approved" }));
    expect(payrollService.syncOpenPayrollsForEmployee).toHaveBeenCalledWith(EMPLOYEE_A.id);
    expect(portalNotifications.notifyRequestApproved).toHaveBeenCalledWith(EMPLOYEE_A.id, 100, "advance", SUPERVISOR_BRANCH_1.name);
  });

  it("uses the review notes as rejection reason from the portal and notifies the employee", async () => {
    vi.mocked(db.getEmployeeRequestById).mockResolvedValue(requestRow({ requestType: "vacation" }));
    await employeeCaller(SUPERVISOR_BRANCH_1).portalAdmin.updateRequestStatus({ requestId: 100, status: "rejected", reviewNotes: "ضغط عمل" });
    expect(db.reviewPendingEmployeeRequest).toHaveBeenCalledWith(100, expect.objectContaining({ status: "rejected", rejectionReason: "ضغط عمل" }));
    expect(portalNotifications.notifyRequestRejected).toHaveBeenCalledWith(EMPLOYEE_A.id, 100, "vacation", "ضغط عمل");
  });

  it("refuses another branch's request", async () => {
    vi.mocked(db.getEmployeeRequestById).mockResolvedValue(requestRow({ employeeId: EMPLOYEE_B_ID, branchId: 2 }));
    await expectTrpcError(
      employeeCaller(SUPERVISOR_BRANCH_1).portalAdmin.updateRequestStatus({ requestId: 100, status: "approved" }),
      "FORBIDDEN"
    );
    await expectTrpcError(
      staffCaller({ role: "supervisor", branchId: 1 }).employeeRequests.updateStatus({ id: 100, status: "approved" }),
      "FORBIDDEN"
    );
    expect(db.reviewPendingEmployeeRequest).not.toHaveBeenCalled();
  });

  it("refuses self-approval by an employee supervisor", async () => {
    vi.mocked(db.getEmployeeRequestById).mockResolvedValue(requestRow({ employeeId: SUPERVISOR_BRANCH_1.id }));
    await expectTrpcError(
      employeeCaller(SUPERVISOR_BRANCH_1).portalAdmin.updateRequestStatus({ requestId: 100, status: "approved" }),
      "FORBIDDEN"
    );
    expect(db.reviewPendingEmployeeRequest).not.toHaveBeenCalled();
  });

  it("never re-reviews a request (status guard) and refuses end of service", async () => {
    for (const status of ["approved", "rejected", "cancelled"]) {
      vi.mocked(db.getEmployeeRequestById).mockResolvedValue(requestRow({ status, reviewedAt: new Date() }));
      await expectTrpcError(staffCaller({ role: "admin" }).employeeRequests.updateStatus({ id: 100, status: "approved" }), "CONFLICT");
    }
    vi.mocked(db.getEmployeeRequestById).mockResolvedValue(requestRow({ requestType: "end_of_service" }));
    await expectTrpcError(staffCaller({ role: "admin" }).employeeRequests.updateStatus({ id: 100, status: "approved" }), "BAD_REQUEST");
    expect(db.reviewPendingEmployeeRequest).not.toHaveBeenCalled();
  });

  it("reports a conflict when another reviewer changed the request first", async () => {
    vi.mocked(db.getEmployeeRequestById).mockResolvedValue(requestRow());
    vi.mocked(db.reviewPendingEmployeeRequest).mockResolvedValue(false);
    await expectTrpcError(staffCaller({ role: "manager" }).employeeRequests.updateStatus({ id: 100, status: "approved" }), "CONFLICT");
    expect(db.createEmployeeRequestLog).not.toHaveBeenCalled();
    expect(portalNotifications.notifyRequestApproved).not.toHaveBeenCalled();
  });

  it("refuses an advance locked in an approved payroll", async () => {
    vi.mocked(db.getEmployeeRequestById).mockResolvedValue(requestRow());
    vi.mocked(payrollService.assertSourceNotLocked).mockRejectedValue(new payrollService.PayrollError("مخصومة", "CONFLICT"));
    await expectTrpcError(staffCaller({ role: "admin" }).employeeRequests.updateStatus({ id: 100, status: "cancelled" }), "CONFLICT");
    expect(db.reviewPendingEmployeeRequest).not.toHaveBeenCalled();
  });

  it("keeps the approval when notifications or payroll sync fail", async () => {
    vi.mocked(db.getEmployeeRequestById).mockResolvedValue(requestRow());
    vi.mocked(portalNotifications.notifyRequestApproved).mockRejectedValue(new Error("notify down"));
    vi.mocked(payrollService.syncOpenPayrollsForEmployee).mockRejectedValue(new Error("sync down"));
    const result = await staffCaller({ role: "admin" }).employeeRequests.updateStatus({ id: 100, status: "approved" });
    expect(result.success).toBe(true);
    expect(db.reviewPendingEmployeeRequest).toHaveBeenCalledTimes(1);
  });

  it("scopes the supervisor's request list to their branch", async () => {
    vi.mocked(db.getAllEmployeeRequests).mockResolvedValue([
      requestRow(),
      requestRow({ id: 101, requestType: "end_of_service", status: "pending" }),
    ]);
    const rows = await employeeCaller(SUPERVISOR_BRANCH_1).portalAdmin.getRequests({ branchId: 2 });
    expect(db.getAllEmployeeRequests).toHaveBeenCalledWith(expect.objectContaining({ branchId: 1 }));
    expect(rows.map(r => r.id)).toEqual([100]);

    await staffCaller({ role: "admin" }).portalAdmin.getRequests({ branchId: 2 });
    expect(db.getAllEmployeeRequests).toHaveBeenLastCalledWith(expect.objectContaining({ branchId: 2 }));
  });

  it("hides employees of other branches from a branch supervisor", async () => {
    vi.mocked(db.getEmployeeDetailsForPortalAdmin).mockResolvedValue({ employee: { id: EMPLOYEE_B_ID, branchId: 2 }, requests: [], documents: {} });
    await expectTrpcError(employeeCaller(SUPERVISOR_BRANCH_1).portalAdmin.getEmployeeDetails({ employeeId: EMPLOYEE_B_ID }), "NOT_FOUND");

    await employeeCaller(SUPERVISOR_BRANCH_1).portalAdmin.getEmployees({ branchId: 2 });
    expect(db.getEmployeesForPortalAdmin).toHaveBeenCalledWith(1, undefined);
  });
});
