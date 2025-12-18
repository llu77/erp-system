import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock db functions
vi.mock("./db", () => ({
  getBranches: vi.fn().mockResolvedValue([
    { id: 1, code: "BR001", name: "Main Branch", nameAr: "الفرع الرئيسي", address: "الرياض", phone: "0501234567", isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 2, code: "BR002", name: "Second Branch", nameAr: "الفرع الثاني", address: "جدة", phone: "0507654321", isActive: true, createdAt: new Date(), updatedAt: new Date() },
  ]),
  createBranch: vi.fn().mockResolvedValue(undefined),
  updateBranch: vi.fn().mockResolvedValue(undefined),
  deleteBranch: vi.fn().mockResolvedValue(undefined),
  createActivityLog: vi.fn().mockResolvedValue(undefined),
  getAllEmployees: vi.fn().mockResolvedValue([
    { id: 1, code: "EMP001", name: "أحمد محمد", branchId: 1, phone: "0501111111", position: "مندوب", isActive: true, createdAt: new Date(), updatedAt: new Date() },
  ]),
  createEmployee: vi.fn().mockResolvedValue(undefined),
  updateEmployee: vi.fn().mockResolvedValue(undefined),
  deleteEmployee: vi.fn().mockResolvedValue(undefined),
  getEmployeesByBranch: vi.fn().mockResolvedValue([]),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "مسؤول النظام",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createManagerContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "manager-user",
    email: "manager@example.com",
    name: "مدير الفرع",
    loginMethod: "manus",
    role: "manager",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createEmployeeContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 3,
    openId: "employee-user",
    email: "employee@example.com",
    name: "موظف",
    loginMethod: "manus",
    role: "employee",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("branches router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("branches.list", () => {
    it("returns list of branches for authenticated user", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.branches.list();

      expect(result).toHaveLength(2);
      expect(result[0].code).toBe("BR001");
      expect(result[0].nameAr).toBe("الفرع الرئيسي");
    });

    it("returns list of branches for manager", async () => {
      const ctx = createManagerContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.branches.list();

      expect(result).toHaveLength(2);
    });
  });

  describe("branches.create", () => {
    it("allows admin to create branch", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.branches.create({
        code: "BR003",
        nameAr: "الفرع الثالث",
        nameEn: "Third Branch",
        address: "الدمام",
        phone: "0509999999",
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe("تم إنشاء الفرع بنجاح");
    });

    it("rejects branch creation for non-admin", async () => {
      const ctx = createManagerContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.branches.create({
          code: "BR003",
          nameAr: "الفرع الثالث",
        })
      ).rejects.toThrow();
    });
  });

  describe("branches.update", () => {
    it("allows admin to update branch", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.branches.update({
        id: 1,
        code: "BR001",
        nameAr: "الفرع الرئيسي المحدث",
        address: "الرياض - حي النخيل",
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe("تم تحديث الفرع بنجاح");
    });
  });

  describe("branches.delete", () => {
    it("allows admin to delete branch", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.branches.delete({ id: 2 });

      expect(result.success).toBe(true);
      expect(result.message).toBe("تم حذف الفرع بنجاح");
    });
  });
});

describe("employees router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("employees.list", () => {
    it("returns list of employees for authenticated user", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.employees.list();

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe("EMP001");
      expect(result[0].name).toBe("أحمد محمد");
    });
  });

  describe("employees.create", () => {
    it("allows manager to create employee", async () => {
      const ctx = createManagerContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.employees.create({
        code: "EMP002",
        name: "محمد علي",
        branchId: 1,
        phone: "0502222222",
        position: "محاسب",
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe("تم إنشاء الموظف بنجاح");
    });

    it("rejects employee creation for regular employee", async () => {
      const ctx = createEmployeeContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.employees.create({
          code: "EMP002",
          name: "محمد علي",
          branchId: 1,
        })
      ).rejects.toThrow();
    });
  });

  describe("employees.update", () => {
    it("allows manager to update employee", async () => {
      const ctx = createManagerContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.employees.update({
        id: 1,
        code: "EMP001",
        name: "أحمد محمد المحدث",
        branchId: 1,
        position: "مدير مبيعات",
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe("تم تحديث الموظف بنجاح");
    });
  });

  describe("employees.delete", () => {
    it("allows manager to delete employee", async () => {
      const ctx = createManagerContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.employees.delete({ id: 1 });

      expect(result.success).toBe(true);
      expect(result.message).toBe("تم حذف الموظف بنجاح");
    });
  });
});
