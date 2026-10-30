import { beforeEach, describe, expect, it, vi } from "vitest";

// الموجّه ينشئ عميل البريد عند التحميل
vi.hoisted(() => {
  process.env.RESEND_API_KEY ??= "re_test_key";
});

vi.mock("./db", () => ({
  getEmployeeById: vi.fn(),
  updateEmployee: vi.fn().mockResolvedValue(undefined),
  createEmployee: vi.fn().mockResolvedValue(undefined),
  createActivityLog: vi.fn().mockResolvedValue(undefined),
  getAllEmployees: vi.fn().mockResolvedValue([]),
  getEmployeesByBranch: vi.fn().mockResolvedValue([]),
}));

vi.mock("./employeeFile/service", async importOriginal => {
  const actual = await importOriginal<typeof import("./employeeFile/service")>();
  return {
    ...actual,
    getDocumentsOverview: vi.fn().mockResolvedValue({ rows: [], summary: {}, byKind: {}, today: "2026-10-30" }),
    getEmployeeFile: vi.fn().mockResolvedValue({ employee: { id: 1 } }),
    listEmployeesWithImages: vi.fn().mockResolvedValue([]),
    saveSalarySettings: vi.fn(),
    applySalaryChangeToOpenPayrolls: vi.fn().mockResolvedValue({ updated: 1, failed: 0 }),
    setEmployeeImage: vi.fn().mockResolvedValue(undefined),
  };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import * as service from "./employeeFile/service";
import { effectiveSalarySettings } from "./employeeFile/schemas";

type Role = "admin" | "manager" | "supervisor" | "viewer" | "employee";

function caller(role: Role, branchId: number | null = null) {
  const ctx = {
    user: {
      id: 9,
      openId: `u-${role}`,
      name: "مستخدم",
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

const employeeInBranch = (branchId: number) => ({
  id: 5,
  code: "E5",
  name: "موظف",
  branchId,
  isActive: true,
  iqamaNumber: "2123456789",
  iqamaExpiryDate: new Date("2027-01-01T00:00:00Z"),
  healthCertExpiryDate: null,
  contractExpiryDate: null,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("employees.update", () => {
  it("lets a branch supervisor edit an employee of the same branch", async () => {
    vi.mocked(db.getEmployeeById).mockResolvedValue(employeeInBranch(2) as never);
    await caller("supervisor", 2).employees.update({ id: 5, phone: "0500000000" });
    expect(db.updateEmployee).toHaveBeenCalledWith(5, { phone: "0500000000" });
  });

  it("rejects a supervisor editing another branch's employee", async () => {
    vi.mocked(db.getEmployeeById).mockResolvedValue(employeeInBranch(3) as never);
    await expect(caller("supervisor", 2).employees.update({ id: 5, phone: "1" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.updateEmployee).not.toHaveBeenCalled();
  });

  it("rejects a supervisor moving an employee or changing the active flag", async () => {
    vi.mocked(db.getEmployeeById).mockResolvedValue(employeeInBranch(2) as never);
    await expect(caller("supervisor", 2).employees.update({ id: 5, branchId: 3 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(caller("supervisor", 2).employees.update({ id: 5, isActive: false })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("keeps omitted dates and records who changed document data", async () => {
    vi.mocked(db.getEmployeeById).mockResolvedValue(employeeInBranch(2) as never);
    await caller("manager").employees.update({ id: 5, healthCertExpiryDate: "2027-05-01" });
    const patch = vi.mocked(db.updateEmployee).mock.calls[0][1];
    expect(patch).toMatchObject({
      healthCertExpiryDate: new Date("2027-05-01T00:00:00Z"),
      infoSubmittedBy: 9,
    });
    expect(patch).not.toHaveProperty("iqamaExpiryDate");
    expect(patch).not.toHaveProperty("contractExpiryDate");
  });
});

describe("employee file access", () => {
  it("forbids viewers and employees from opening an employee file", async () => {
    await expect(caller("viewer").employees.getFile({ id: 5 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller("employee").employees.getFile({ id: 5 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("forbids a supervisor without a branch", async () => {
    await expect(caller("supervisor", null).employees.getFile({ id: 5 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("scopes the documents overview of a supervisor to their branch", async () => {
    await caller("supervisor", 4).employees.getDocumentsOverview({ branchId: 1 });
    expect(service.getDocumentsOverview).toHaveBeenCalledWith({ branchId: 4 });
    await caller("viewer").employees.getDocumentsOverview({ branchId: 1 });
    expect(service.getDocumentsOverview).toHaveBeenLastCalledWith({ branchId: 1 });
  });

  it("does not return document images in the list to other roles", async () => {
    await expect(caller("employee").employees.list({ withImages: true })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await caller("supervisor", 7).employees.list({ withImages: true });
    expect(service.listEmployeesWithImages).toHaveBeenCalledWith(7);
  });

  it("rejects uploads with a spoofed content type before storing anything", async () => {
    vi.mocked(db.getEmployeeById).mockResolvedValue(employeeInBranch(2) as never);
    const pdf = Buffer.from("%PDF-1.7 fake").toString("base64");
    await expect(
      caller("manager").employees.uploadDocumentImage({ employeeId: 5, kind: "photo", base64: pdf, contentType: "image/png" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(service.setEmployeeImage).not.toHaveBeenCalled();
  });
});

describe("salarySettings.save", () => {
  it("is limited to admin and manager", async () => {
    await expect(caller("supervisor", 2).salarySettings.save({ employeeId: 5, baseSalary: 3000 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("saves and reports the open payrolls it updated", async () => {
    const previous = effectiveSalarySettings(undefined);
    vi.mocked(service.saveSalarySettings).mockResolvedValue({
      previous,
      next: { ...previous, baseSalary: 3000 },
      created: true,
    });
    const result = await caller("manager").salarySettings.save({ employeeId: 5, baseSalary: 3000 });
    expect(result).toEqual({ success: true, openPayrollsUpdated: 1, openPayrollsFailed: 0 });
    expect(service.applySalaryChangeToOpenPayrolls).toHaveBeenCalledWith(5, previous, { ...previous, baseSalary: 3000 });
  });
});
