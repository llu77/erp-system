import { beforeEach, describe, expect, it, vi } from "vitest";

// قاعدة البيانات غير مطلوبة لهذه الاختبارات (الدوال النقية + مولّد الرقم على منفّذ وهمي)
vi.mock("./db", () => ({ getDb: vi.fn(async () => null) }));

import * as db from "./db";
import {
  DB_UNAVAILABLE_MESSAGE,
  ExpenseRuleError,
  FIXED_EXPENSE_APPROVER_NAME,
  FIXED_EXPENSE_DELETE_MESSAGE,
  PAYROLL_EXPENSE_LOCKED_MESSAGE,
  SYSTEM_CREATOR_NAME,
  assertExpenseDeletable,
  assertExpenseEditable,
  assertExpenseStatusChangeable,
  buildFixedExpenseRow,
  buildPayrollExpenseRow,
  createExpenseWithNumber,
  currentRiyadhMonth,
  ensureCurrentMonthFixedExpenses,
  ensureFixedExpensesForViewedMonth,
  ensureFixedExpensesForMonth,
  fixedExpenseTitle,
  formatExpenseNumber,
  insertExpenseWithNumber,
  listFixedExpenseTemplates,
  manualExpenseKey,
  parseExpenseSequence,
  payrollExpenseTitle,
  pickFixedExpenseEditableFields,
  planDefaultFixedTemplates,
  planFixedExpensesForMonth,
  resetLazyFixedExpensesCache,
  saveFixedExpenseTemplate,
  type Exec,
  type FixedTemplateForMonth,
  type NewExpenseRow,
} from "./expenses/autoExpenses";
import { autoExpenseDate, fixedExpenseSourceKey } from "../shared/expenses";

const NOW = new Date("2026-11-03T09:00:00Z");

beforeEach(() => {
  vi.mocked(db.getDb).mockReset();
  vi.mocked(db.getDb).mockResolvedValue(null as never);
  resetLazyFixedExpensesCache();
});

// ==================== رقم المصروف ====================

describe("expense numbers", () => {
  it("parses only EXP-YYYY-NNNN numbers (other formats never corrupt the sequence)", () => {
    expect(parseExpenseSequence("EXP-2026-0042")).toBe(42);
    expect(parseExpenseSequence("EXP-2026-0042", 2026)).toBe(42);
    expect(parseExpenseSequence("EXP-2025-0042", 2026)).toBe(0);
    expect(parseExpenseSequence("EXP-1730000000000")).toBe(0);
    expect(parseExpenseSequence("PAY-202611-0001")).toBe(0);
    expect(parseExpenseSequence(null)).toBe(0);
    expect(formatExpenseNumber(2026, 7)).toBe("EXP-2026-0007");
    expect(formatExpenseNumber(2026, 12345)).toBe("EXP-2026-12345");
  });

  /** منفّذ وهمي: أعلى تسلسل ثابت (كقراءة داخل معاملة) وإدراج يفشل حسب السيناريو */
  function fakeExec(maxSeq: number, insertOutcomes: Array<"ok" | unknown>) {
    const tried: string[] = [];
    const chain: any = {
      from: () => chain,
      where: () => chain,
      limit: () => chain,
      then: (resolve: (v: unknown) => void) => resolve([{ maxSeq }]),
    };
    const exec = {
      select: () => chain,
      insert: () => ({
        values: async (v: { expenseNumber: string }) => {
          tried.push(v.expenseNumber);
          const outcome = insertOutcomes.shift() ?? "ok";
          if (outcome !== "ok") throw outcome;
          return [{ insertId: 99 }];
        },
      }),
    } as unknown as Exec;
    return { exec, tried };
  }

  const row = { title: "x", category: "other", amount: "1.00", expenseDate: NOW, createdBy: 1 } as NewExpenseRow;
  const dupNumber = (n: string) => ({ code: "ER_DUP_ENTRY", errno: 1062, message: `Duplicate entry '${n}' for key 'expenses_expenseNumber_unique'` });

  it("retries with the next number on a duplicate expense number (even inside a transaction snapshot)", async () => {
    const { exec, tried } = fakeExec(41, [dupNumber("EXP-2026-0042"), "ok"]);
    const created = await insertExpenseWithNumber(exec, row, NOW);
    expect(tried).toEqual(["EXP-2026-0042", "EXP-2026-0043"]);
    expect(created).toEqual({ id: 99, expenseNumber: "EXP-2026-0043" });
  });

  it("returns null when the auto expense already exists (duplicate sourceKey), also for wrapped driver errors", async () => {
    const sourceDup = { cause: { code: "ER_DUP_ENTRY", sqlMessage: "Duplicate entry 'fixed:1:2026-11:3' for key 'expenses_sourceKey_unique'" } };
    const { exec, tried } = fakeExec(0, [sourceDup]);
    expect(await insertExpenseWithNumber(exec, { ...row, sourceKey: "fixed:1:2026-11:3" }, NOW)).toBeNull();
    expect(tried).toEqual(["EXP-2026-0001"]);
  });

  it("rethrows other database errors and gives up after repeated number conflicts", async () => {
    const { exec } = fakeExec(0, [new Error("connection lost")]);
    await expect(insertExpenseWithNumber(exec, row, NOW)).rejects.toThrow("connection lost");

    const always = Array.from({ length: 20 }, (_, i) => dupNumber(`EXP-2026-${i}`));
    const { exec: busy, tried } = fakeExec(0, always);
    const error = await insertExpenseWithNumber(busy, row, NOW).catch(e => e);
    expect(error).toBeInstanceOf(ExpenseRuleError);
    expect(error.code).toBe("CONFLICT");
    expect(tried.length).toBe(8);
  });
});

// ==================== القوالب الافتراضية ====================

describe("default fixed expense templates", () => {
  it("creates the requested items for every active Laban/Tuwaiq branch only", () => {
    const rows = planDefaultFixedTemplates(
      [
        { id: 1, name: "Laban", nameAr: "فرع لبن", isActive: true },
        { id: 2, name: "Tuwaiq", nameAr: "فرع طويق", isActive: true },
        { id: 3, name: "Olaya", nameAr: "فرع العليا", isActive: true },
        { id: 4, name: "Laban old", nameAr: "فرع لبن القديم", isActive: false },
      ],
      "2026-11"
    );
    expect(rows.map(r => [r.branchId, r.category, r.title, r.amount, r.paymentMethod, r.sortOrder, r.startsOn])).toEqual([
      [1, "shop_rent", "إيجار محل", "3583.00", "bank_transfer", 0, "2026-11"],
      [1, "housing_rent", "إيجار سكن", "1700.00", "cash", 1, "2026-11"],
      [1, "internet", "إنترنت", "250.00", "cash", 2, "2026-11"],
      [2, "shop_rent", "إيجار محل", "3583.00", "bank_transfer", 0, "2026-11"],
      [2, "housing_rent", "إيجار سكن", "2000.00", "cash", 1, "2026-11"],
      [2, "internet", "إنترنت", "250.00", "cash", 2, "2026-11"],
    ]);
  });
});

// ==================== توليد الشهر ====================

const template = (over: Partial<FixedTemplateForMonth> = {}): FixedTemplateForMonth => ({
  id: 1,
  branchId: 1,
  branchName: "فرع لبن",
  category: "shop_rent",
  title: "إيجار محل",
  amount: "3583.00",
  paymentMethod: "bank_transfer",
  startsOn: "2026-10",
  ...over,
});

describe("monthly fixed expense rows", () => {
  it("builds an approved system row dated inside the month", () => {
    const row = buildFixedExpenseRow(template(), 2026, 11, NOW);
    expect(row).toMatchObject({
      source: "fixed",
      sourceKey: "fixed:1:2026-11:1",
      category: "shop_rent",
      title: "إيجار محل - نوفمبر 2026",
      amount: "3583.00",
      branchId: 1,
      branchName: "فرع لبن",
      paymentMethod: "bank_transfer",
      status: "approved",
      approvedByName: FIXED_EXPENSE_APPROVER_NAME,
      createdBy: 0,
      createdByName: SYSTEM_CREATOR_NAME,
    });
    expect(FIXED_EXPENSE_APPROVER_NAME).toBe("تلقائي (مصاريف ثابتة)");
    expect(SYSTEM_CREATOR_NAME).toBe("النظام");
    expect(row.expenseDate).toEqual(autoExpenseDate(2026, 11));
    expect(fixedExpenseTitle("إنترنت", 2027, 1)).toBe("إنترنت - يناير 2027");
  });

  it("is idempotent, skips months before the template starts, and leaves manual entries alone", () => {
    const templates = [
      template(),
      template({ id: 2, category: "housing_rent", title: "إيجار سكن", amount: "1700.00", paymentMethod: "cash" }),
      template({ id: 3, branchId: 2, branchName: "فرع طويق", category: "internet", title: "إنترنت", amount: "250.00", paymentMethod: "cash" }),
      template({ id: 4, branchId: 2, branchName: "فرع طويق", startsOn: "2026-12" }),
    ];
    const manual = new Set([manualExpenseKey(2, "internet")]);
    const first = planFixedExpensesForMonth(2026, 11, templates, new Set(), manual, NOW);
    expect(first.toCreate.map(c => c.template.id)).toEqual([1, 2]);
    expect(first.skippedManual.map(t => t.id)).toEqual([3]);
    expect(first.notStarted).toBe(1);

    // التشغيل الثاني بعد الإضافة: لا شيء جديد
    const created = new Set(first.toCreate.map(c => c.row.sourceKey as string));
    const second = planFixedExpensesForMonth(2026, 11, templates, created, manual, NOW);
    expect(second.toCreate).toEqual([]);
    expect(second.existing).toBe(2);

    // صف موجود (حتى لو رُفض) لا يُعاد إنشاؤه؛ المصروف اليدوي لفرع آخر لا يؤثر
    const rejectedKey = new Set([fixedExpenseSourceKey(1, 2026, 11, 1)]);
    const third = planFixedExpensesForMonth(2026, 11, templates.slice(0, 2), rejectedKey, new Set([manualExpenseKey(2, "shop_rent")]), NOW);
    expect(third.toCreate.map(c => c.template.id)).toEqual([2]);
  });

  it("uses the Riyadh month (late on the last day UTC is already next month in Riyadh)", () => {
    expect(currentRiyadhMonth(new Date("2026-10-31T22:30:00Z"))).toEqual({ year: 2026, month: 11 });
    expect(currentRiyadhMonth(new Date("2026-12-31T20:59:00Z"))).toEqual({ year: 2026, month: 12 });
  });
});

// ==================== مصروف المسير ====================

describe("payroll expense row", () => {
  const payroll = {
    id: 12,
    payrollNumber: "PAY-202611-0012",
    branchId: 1,
    branchName: "فرع لبن",
    year: 2026,
    month: 11,
    totalNetSalary: "8000.00",
    approvedBy: 3,
    approvedByName: "عمر المطيري",
    approvedAt: NOW,
  };

  it("costs net salary plus recovered advances under salaries, by bank transfer", () => {
    const row = buildPayrollExpenseRow(payroll as any, 500, "approved", { id: 3, name: "عمر المطيري" }, NOW);
    expect(row).toMatchObject({
      source: "payroll",
      sourceKey: "payroll:12",
      category: "salaries",
      title: "مسير رواتب فرع لبن نوفمبر 2026 (PAY-202611-0012)",
      amount: "8500.00",
      branchId: 1,
      paymentMethod: "bank_transfer",
      paymentReference: "PAY-202611-0012",
      status: "approved",
      approvedBy: 3,
      approvedByName: "عمر المطيري",
    });
    expect(row.description).toContain("صافي الرواتب 8,000.00 ر.س");
    expect(row.description).toContain("السلف المستردة في المسير 500.00 ر.س");
    expect(row.description).toContain("= 8,500.00 ر.س");
    expect(row.expenseDate).toEqual(autoExpenseDate(2026, 11));
    expect(payrollExpenseTitle(payroll as any)).toBe(row.title);
  });

  it("states when no advances were recovered", () => {
    const row = buildPayrollExpenseRow(payroll as any, 0, "paid", { id: 1, name: null }, NOW);
    expect(row.amount).toBe("8000.00");
    expect(row.status).toBe("paid");
    expect(row.description).toBe("صافي الرواتب 8,000.00 ر.س (لا سلف مستردة في المسير)");
  });
});

// ==================== حماية الصفوف التلقائية ====================

describe("auto expense guards", () => {
  const fixed = { source: "fixed", title: "إيجار محل - نوفمبر 2026", category: "shop_rent", amount: "3583.00", paymentMethod: "bank_transfer", expenseDate: autoExpenseDate(2026, 11) };

  it("locks payroll rows completely", () => {
    for (const fn of [() => assertExpenseEditable({ source: "payroll" }, { amount: "1" }), () => assertExpenseStatusChangeable({ source: "payroll" }), () => assertExpenseDeletable({ source: "payroll" })]) {
      expect(fn).toThrowError(PAYROLL_EXPENSE_LOCKED_MESSAGE);
      try { fn(); } catch (e: any) { expect(e.code).toBe("FORBIDDEN"); }
    }
  });

  it("lets fixed rows change amount and notes only, be re-statused, but never deleted", () => {
    expect(() => assertExpenseEditable(fixed, { amount: "3600.00", description: "زيادة", title: fixed.title, category: "shop_rent", expenseDate: "2026-11-01", paymentMethod: "bank_transfer" })).not.toThrow();
    expect(() => assertExpenseEditable(fixed, { title: "إيجار آخر" })).toThrow(ExpenseRuleError);
    expect(() => assertExpenseEditable(fixed, { paymentMethod: "cash" })).toThrow(ExpenseRuleError);
    expect(() => assertExpenseEditable(fixed, { expenseDate: "2026-11-15" })).toThrow(ExpenseRuleError);
    expect(() => assertExpenseStatusChangeable(fixed)).not.toThrow();
    expect(() => assertExpenseDeletable(fixed)).toThrowError(FIXED_EXPENSE_DELETE_MESSAGE);
    expect(pickFixedExpenseEditableFields({ amount: "1", description: "d", title: "t", expenseDate: "2026-11-01", receiptNumber: undefined })).toEqual({ amount: "1", description: "d" });
  });

  it("leaves manual rows alone", () => {
    expect(() => assertExpenseEditable({ source: "manual" }, { title: "x", category: "other" })).not.toThrow();
    expect(() => assertExpenseDeletable({ source: "manual" })).not.toThrow();
  });
});

// ==================== تعطل قاعدة البيانات ====================

describe("database outage", () => {
  it("is an internal error, not a user conflict", async () => {
    const created = await createExpenseWithNumber({ title: "x", category: "other", amount: "1.00", expenseDate: NOW, createdBy: 1 } as NewExpenseRow).catch(e => e);
    expect(created).toBeInstanceOf(ExpenseRuleError);
    expect(created.code).toBe("INTERNAL_SERVER_ERROR");
    expect(created.message).toBe(DB_UNAVAILABLE_MESSAGE);
    expect(DB_UNAVAILABLE_MESSAGE).toBe("قاعدة البيانات غير متاحة، حاول مرة أخرى");

    const listed = await listFixedExpenseTemplates().catch(e => e);
    expect(listed.code).toBe("INTERNAL_SERVER_ERROR");
    const saved = await saveFixedExpenseTemplate({ branchId: 1, category: "internet", title: "إنترنت", amount: 250, paymentMethod: "cash" }).catch(e => e);
    expect(saved.code).toBe("INTERNAL_SERVER_ERROR");
  });

  it("never breaks the automatic paths", async () => {
    await expect(ensureFixedExpensesForMonth(2026, 11, NOW)).resolves.toMatchObject({ created: 0, templates: 0 });
    vi.mocked(db.getDb).mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(ensureCurrentMonthFixedExpenses(NOW)).resolves.toBeNull();
  });

  it("fills a viewed month only up to the current month and never fails the page", async () => {
    vi.mocked(db.getDb).mockClear();
    await expect(ensureFixedExpensesForViewedMonth(2026, 12, NOW)).resolves.toBeNull();
    await expect(ensureFixedExpensesForViewedMonth(2027, 1, NOW)).resolves.toBeNull();
    expect(db.getDb).not.toHaveBeenCalled();

    vi.mocked(db.getDb).mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(ensureFixedExpensesForViewedMonth(2026, 10, NOW)).resolves.toBeNull();
    expect(db.getDb).toHaveBeenCalled();
  });
});
