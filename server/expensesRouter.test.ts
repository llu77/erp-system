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
    getDb: vi.fn(async () => null),
    getAllExpenses: vi.fn(),
    getExpenseById: vi.fn(),
    updateExpense: vi.fn(async () => undefined),
    deleteExpense: vi.fn(async () => undefined),
    updateExpenseStatus: vi.fn(async () => undefined),
    createExpenseLog: vi.fn(async () => undefined),
  };
});

// المصاريف التلقائية: التنفيذ الحقيقي افتراضياً (قاعدة البيانات الوهمية أعلاه)، مع إمكانية الاستبدال لكل اختبار
vi.mock("./expenses/autoExpenses", async importOriginal => {
  const actual = await importOriginal<typeof import("./expenses/autoExpenses")>();
  return {
    ...actual,
    ensureCurrentMonthFixedExpenses: vi.fn(async () => null),
    listFixedExpenseTemplates: vi.fn(actual.listFixedExpenseTemplates),
    saveFixedExpenseTemplate: vi.fn(actual.saveFixedExpenseTemplate),
    deactivateFixedExpenseTemplate: vi.fn(actual.deactivateFixedExpenseTemplate),
  };
});

import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import * as autoExpenses from "./expenses/autoExpenses";
import { appRouter } from "./routers";
import { autoExpenseDate } from "../shared/expenses";

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

const FIXED_ID = 10;
const PAYROLL_ID = 11;
const MANUAL_ID = 12;
const TEMPLATE_ID = 7;
const ADMIN_USER_ID = 5;
const INTERNET_AMOUNT = 250;

const base = {
  expenseNumber: "EXP-2026-0001",
  description: null,
  branchId: 1,
  branchName: "فرع لبن",
  status: "approved",
  createdBy: 0,
  createdByName: "النظام",
};
const FIXED = {
  ...base,
  id: FIXED_ID,
  source: "fixed",
  sourceKey: "fixed:1:2026-11:1",
  category: "shop_rent",
  title: "إيجار محل - نوفمبر 2026",
  amount: "3583.00",
  paymentMethod: "bank_transfer",
  expenseDate: autoExpenseDate(2026, 11),
};
const PAYROLL = {
  ...base,
  id: PAYROLL_ID,
  source: "payroll",
  sourceKey: "payroll:7",
  category: "salaries",
  title: "مسير رواتب فرع لبن نوفمبر 2026 (PAY-202611-0007)",
  amount: "8500.00",
  paymentMethod: "bank_transfer",
  expenseDate: autoExpenseDate(2026, 11),
};
const MANUAL = { ...base, id: MANUAL_ID, source: "manual", sourceKey: null, category: "printing", title: "طباعة", amount: "40.00", paymentMethod: "cash", status: "pending", expenseDate: new Date("2026-11-04") };

const codeOf = async (p: Promise<unknown>) => p.then(() => "OK", (e: any) => e.code as string);

beforeEach(() => {
  vi.mocked(db.getDb).mockReset();
  vi.mocked(db.getDb).mockResolvedValue(null as never);
  vi.mocked(db.getExpenseById).mockReset();
  vi.mocked(db.getAllExpenses).mockReset();
  vi.mocked(db.updateExpense).mockClear();
  vi.mocked(db.deleteExpense).mockClear();
  vi.mocked(db.updateExpenseStatus).mockClear();
  vi.mocked(db.createExpenseLog).mockClear();
  vi.mocked(autoExpenses.ensureCurrentMonthFixedExpenses).mockClear();
  vi.mocked(autoExpenses.listFixedExpenseTemplates).mockClear();
  vi.mocked(autoExpenses.saveFixedExpenseTemplate).mockClear();
  vi.mocked(autoExpenses.deactivateFixedExpenseTemplate).mockClear();
});

describe("expenses router: payroll expense rows", () => {
  beforeEach(() => vi.mocked(db.getExpenseById).mockResolvedValue(PAYROLL as never));

  it("cannot be edited, re-statused or deleted (managed from the payroll)", async () => {
    const admin = caller("admin");
    for (const attempt of [
      admin.expenses.update({ id: PAYROLL_ID, amount: "1.00" }),
      admin.expenses.updateStatus({ id: PAYROLL_ID, status: "rejected", rejectionReason: "x" }),
      admin.expenses.delete({ id: PAYROLL_ID }),
    ]) {
      const error: any = await attempt.catch(e => e);
      expect(error.code).toBe("FORBIDDEN");
      expect(error.message).toBe(autoExpenses.PAYROLL_EXPENSE_LOCKED_MESSAGE);
    }
    expect(db.updateExpense).not.toHaveBeenCalled();
    expect(db.updateExpenseStatus).not.toHaveBeenCalled();
    expect(db.deleteExpense).not.toHaveBeenCalled();
  });

  it("are hidden from roles that cannot see payrolls", async () => {
    vi.mocked(db.getAllExpenses).mockResolvedValue([FIXED, PAYROLL, MANUAL] as never);
    expect((await caller("employee").expenses.list()).map(e => e.id)).toEqual([FIXED_ID, MANUAL_ID]);
    expect((await caller("admin").expenses.list()).map(e => e.id)).toEqual([FIXED_ID, PAYROLL_ID, MANUAL_ID]);
    // المصاريف الثابتة للشهر تُضاف قبل العرض
    expect(autoExpenses.ensureCurrentMonthFixedExpenses).toHaveBeenCalled();
  });

  it("lists nothing when there are no expenses, and a supervisor without a branch sees every row", async () => {
    vi.mocked(db.getAllExpenses).mockResolvedValue([] as never);
    expect(await caller("admin").expenses.list()).toEqual([]);
    vi.mocked(db.getAllExpenses).mockResolvedValue([FIXED, PAYROLL, { ...MANUAL, branchId: null }] as never);
    expect((await caller("supervisor", null).expenses.list()).map(e => e.id)).toEqual([FIXED_ID, PAYROLL_ID, MANUAL_ID]);
    // مشرف فرع آخر لا يرى صفوف هذا الفرع
    expect(await caller("supervisor", 2).expenses.list()).toEqual([]);
  });

  it("still loads the list when ensuring this month's fixed expenses fails", async () => {
    vi.mocked(autoExpenses.ensureCurrentMonthFixedExpenses).mockResolvedValueOnce(null);
    vi.mocked(db.getAllExpenses).mockResolvedValue([MANUAL] as never);
    expect((await caller("admin").expenses.list()).map(e => e.id)).toEqual([MANUAL_ID]);
  });
});

describe("expenses router: fixed expense rows", () => {
  beforeEach(() => vi.mocked(db.getExpenseById).mockResolvedValue(FIXED as never));

  it("cannot be deleted (deactivate the template instead)", async () => {
    const error: any = await caller("admin").expenses.delete({ id: FIXED_ID }).catch(e => e);
    expect(error.code).toBe("BAD_REQUEST");
    expect(error.message).toBe(autoExpenses.FIXED_EXPENSE_DELETE_MESSAGE);
    expect(error.message).toContain("أوقف قالبه");
    expect(db.deleteExpense).not.toHaveBeenCalled();
  });

  it("can have the amount and notes edited; nothing else is written", async () => {
    await caller("admin").expenses.update({
      id: FIXED_ID,
      amount: "3600.00",
      description: "زيادة الإيجار",
      title: FIXED.title,
      category: "shop_rent",
      expenseDate: "2026-11-01",
      paymentMethod: "bank_transfer",
    });
    expect(db.updateExpense).toHaveBeenCalledWith(FIXED_ID, { amount: "3600.00", description: "زيادة الإيجار" });
    expect(vi.mocked(db.createExpenseLog).mock.calls[0][0]).toMatchObject({ expenseId: FIXED_ID, action: expect.stringContaining("3600.00") });
  });

  it("rejects changing the item, date or payment method", async () => {
    expect(await codeOf(caller("admin").expenses.update({ id: FIXED_ID, title: "إيجار آخر" }))).toBe("BAD_REQUEST");
    expect(await codeOf(caller("admin").expenses.update({ id: FIXED_ID, paymentMethod: "cash" }))).toBe("BAD_REQUEST");
    expect(await codeOf(caller("admin").expenses.update({ id: FIXED_ID, amount: "0" }))).toBe("BAD_REQUEST");
    expect(db.updateExpense).not.toHaveBeenCalled();
  });

  it("can be rejected for the month", async () => {
    await caller("admin").expenses.updateStatus({ id: FIXED_ID, status: "rejected", rejectionReason: "لم يُدفع هذا الشهر" });
    expect(db.updateExpenseStatus).toHaveBeenCalledWith(FIXED_ID, "rejected", ADMIN_USER_ID, "مستخدم", "لم يُدفع هذا الشهر");
  });
});

describe("expenses router: manual expenses", () => {
  it("still deletes manual rows", async () => {
    vi.mocked(db.getExpenseById).mockResolvedValue(MANUAL as never);
    await caller("admin").expenses.delete({ id: MANUAL_ID });
    expect(db.deleteExpense).toHaveBeenCalledWith(MANUAL_ID);
  });

  it("does not accept salaries by hand", async () => {
    const input = { category: "salaries", title: "رواتب", amount: "100", expenseDate: new Date().toISOString().slice(0, 10) };
    expect(await codeOf(caller("admin").expenses.create(input as any))).toBe("BAD_REQUEST");
    expect(await codeOf(caller("admin").expenses.update({ id: MANUAL_ID, category: "salaries" } as any))).toBe("BAD_REQUEST");
  });

  it("reports a missing expense as NOT_FOUND", async () => {
    vi.mocked(db.getExpenseById).mockResolvedValue(undefined as never);
    expect(await codeOf(caller("admin").expenses.delete({ id: MANUAL_ID }))).toBe("NOT_FOUND");
    expect(await codeOf(caller("admin").expenses.updateStatus({ id: MANUAL_ID, status: "approved" }))).toBe("NOT_FOUND");
  });

  it("reports a database outage as an internal error, not a conflict", async () => {
    const error: any = await caller("admin")
      .expenses.create({ category: "printing", title: "طباعة أوراق", amount: "40", expenseDate: new Date().toISOString().slice(0, 10) })
      .catch(e => e);
    expect(error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(error.message).toBe("قاعدة البيانات غير متاحة، حاول مرة أخرى");
  });
});

describe("expenses.fixedTemplates (owner only)", () => {
  const save = { branchId: 1, category: "internet" as const, title: "إنترنت", amount: INTERNET_AMOUNT, paymentMethod: "cash" as const };

  it("refuses every role except admin", async () => {
    for (const role of ["manager", "supervisor", "viewer", "employee"] as Role[]) {
      const c = caller(role, 1);
      expect(await codeOf(c.expenses.fixedTemplates.list())).toBe("FORBIDDEN");
      expect(await codeOf(c.expenses.fixedTemplates.save(save))).toBe("FORBIDDEN");
      expect(await codeOf(c.expenses.fixedTemplates.remove({ id: TEMPLATE_ID }))).toBe("FORBIDDEN");
    }
    expect(autoExpenses.listFixedExpenseTemplates).not.toHaveBeenCalled();
    expect(autoExpenses.saveFixedExpenseTemplate).not.toHaveBeenCalled();
    expect(autoExpenses.deactivateFixedExpenseTemplate).not.toHaveBeenCalled();
  });

  it("lets the admin list, save and deactivate templates", async () => {
    vi.mocked(autoExpenses.listFixedExpenseTemplates).mockResolvedValueOnce([{ id: TEMPLATE_ID, branchName: "فرع لبن" }] as never);
    vi.mocked(autoExpenses.saveFixedExpenseTemplate)
      .mockResolvedValueOnce({ id: TEMPLATE_ID, currentMonth: { created: 1 } } as never)
      .mockResolvedValueOnce({ id: TEMPLATE_ID, currentMonth: { created: 0 } } as never);
    vi.mocked(autoExpenses.deactivateFixedExpenseTemplate).mockResolvedValueOnce({ id: TEMPLATE_ID });
    const admin = caller("admin");
    expect(await admin.expenses.fixedTemplates.list()).toEqual([{ id: TEMPLATE_ID, branchName: "فرع لبن" }]);
    const saved = await admin.expenses.fixedTemplates.save(save);
    expect(saved).toEqual({ success: true, id: TEMPLATE_ID, addedThisMonth: 1, message: "تمت إضافة المصروف الثابت وتسجيله لهذا الشهر" });
    // التعديل يسري على الشهور التي لم تُضف بعد
    const edited = await admin.expenses.fixedTemplates.save({ ...save, id: TEMPLATE_ID, amount: INTERNET_AMOUNT + 50 });
    expect(edited.message).toBe("تم حفظ المصروف الثابت؛ يسري على الشهور التي لم تُضف بعد");
    expect(vi.mocked(autoExpenses.saveFixedExpenseTemplate).mock.calls[1][0]).toMatchObject({ id: TEMPLATE_ID, amount: INTERNET_AMOUNT + 50 });
    const removed = await admin.expenses.fixedTemplates.remove({ id: TEMPLATE_ID });
    expect(removed.message).toContain("لن يُضاف من الشهر القادم");
    expect(autoExpenses.deactivateFixedExpenseTemplate).toHaveBeenCalledWith(TEMPLATE_ID);
  });

  it("validates the template input (manual categories only, positive amount)", async () => {
    const admin = caller("admin");
    expect(await codeOf(admin.expenses.fixedTemplates.save({ ...save, category: "salaries" as any }))).toBe("BAD_REQUEST");
    expect(await codeOf(admin.expenses.fixedTemplates.save({ ...save, amount: 0 }))).toBe("BAD_REQUEST");
    expect(await codeOf(admin.expenses.fixedTemplates.save({ ...save, amount: -1 }))).toBe("BAD_REQUEST");
    expect(await codeOf(admin.expenses.fixedTemplates.save({ ...save, title: " " }))).toBe("BAD_REQUEST");
    expect(autoExpenses.saveFixedExpenseTemplate).not.toHaveBeenCalled();
    // أصغر مبلغ موجب مقبول
    vi.mocked(autoExpenses.saveFixedExpenseTemplate).mockResolvedValueOnce({ id: TEMPLATE_ID, currentMonth: { created: 0 } } as never);
    expect(await codeOf(admin.expenses.fixedTemplates.save({ ...save, amount: 0.01 }))).toBe("OK");
  });

  it("maps a database outage to INTERNAL_SERVER_ERROR", async () => {
    const error: any = await caller("admin").expenses.fixedTemplates.list().catch(e => e);
    expect(error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(error.message).toBe(autoExpenses.DB_UNAVAILABLE_MESSAGE);
  });
});
