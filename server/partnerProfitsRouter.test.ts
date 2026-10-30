import { beforeEach, describe, expect, it, vi } from "vitest";

// خدمة البريد تُنشأ عند تحميل الموجّه وتتطلب مفتاحاً؛ لا تُستخدم في هذه الاختبارات
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: vi.fn(async () => ({ data: { id: "test" }, error: null })) };
  },
}));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, getBranches: vi.fn() };
});

vi.mock("./finance/branchFinancials", async importOriginal => {
  const actual = await importOriginal<typeof import("./finance/branchFinancials")>();
  return { ...actual, getBranchMonthlyFinancials: vi.fn() };
});

vi.mock("./voucherPdf", async importOriginal => {
  const actual = await importOriginal<typeof import("./voucherPdf")>();
  return { ...actual, renderHtmlToPdf: vi.fn(async () => Buffer.from("PARTNERS-PDF")) };
});

import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import * as financials from "./finance/branchFinancials";
import * as voucherPdf from "./voucherPdf";
import { appRouter } from "./routers";

type Role = "admin" | "manager" | "supervisor" | "viewer" | "employee";

function caller(role: Role | null, branchId: number | null = null) {
  const ctx = {
    user: role
      ? {
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
        }
      : null,
    req: { protocol: "https", headers: {} },
    res: { clearCookie: vi.fn(), cookie: vi.fn() },
  } as unknown as TrpcContext;
  return appRouter.createCaller(ctx);
}

const BRANCHES = [
  { id: 1, code: "B1", name: "Laban", nameAr: "فرع لبن", isActive: true },
  { id: 2, code: "B2", name: "Tuwaiq", nameAr: "فرع طويق", isActive: true },
  { id: 3, code: "B3", name: "Malqa", nameAr: "فرع الملقا", isActive: true },
  { id: 4, code: "B4", name: "Old Laban", nameAr: "فرع لبن القديم", isActive: false },
];

const RAW: Record<number, financials.BranchFinancialsRaw> = {
  // لبن: 42,000.75 - (5,533 ثابتة + 812.40 أخرى + 15,000 رواتب) = 20,655.35
  1: {
    revenue: { cash: "30000.50", network: "12000.25", days: 30 },
    expenseRows: [
      { category: "shop_rent", source: "fixed", amount: "3583.00" },
      { category: "housing_rent", source: "fixed", amount: "1700.00" },
      { category: "internet", source: "fixed", amount: "250.00" },
      { category: "shop_supplies", source: "manual", amount: "812.40" },
    ],
    payroll: { count: 1, netSalary: "14200.00", recoveredAdvances: "800.00" },
  },
  // طويق: 9,000 - (5,833 ثابتة + 5,000 رواتب) = -1,833.00 خسارة
  2: {
    revenue: { cash: "6000", network: "3000", days: 12 },
    expenseRows: [
      { category: "shop_rent", source: "fixed", amount: "3583.00" },
      { category: "housing_rent", source: "fixed", amount: "2000.00" },
      { category: "internet", source: "fixed", amount: "250.00" },
    ],
    payroll: { count: 1, netSalary: "5000", recoveredAdvances: "0" },
  },
};

beforeEach(() => {
  vi.mocked(db.getBranches).mockReset();
  vi.mocked(db.getBranches).mockResolvedValue(BRANCHES as never);
  vi.mocked(financials.getBranchMonthlyFinancials).mockReset();
  vi.mocked(financials.getBranchMonthlyFinancials).mockImplementation(async (year, month, branchId) =>
    financials.assembleBranchFinancials(year, month, branchId ?? null, RAW[branchId as number])
  );
  vi.mocked(voucherPdf.renderHtmlToPdf).mockClear();
});

describe("partnerProfits access", () => {
  it.each(["manager", "supervisor", "viewer", "employee"] as const)("rejects %s with FORBIDDEN", async role => {
    await expect(caller(role).partnerProfits.summary({ year: 2026, month: 10 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(caller(role, 1).partnerProfits.pdf({ year: 2026, month: 10, branchId: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.getBranches).not.toHaveBeenCalled();
    expect(financials.getBranchMonthlyFinancials).not.toHaveBeenCalled();
    expect(voucherPdf.renderHtmlToPdf).not.toHaveBeenCalled();
  });

  it("requires a signed-in user", async () => {
    await expect(caller(null).partnerProfits.summary({ year: 2026, month: 10 })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

describe("partnerProfits.summary", () => {
  it("returns one statement per active branch with partners and lists the others separately", async () => {
    const summary = await caller("admin").partnerProfits.summary({ year: 2026, month: 10 });

    expect(summary.year).toBe(2026);
    expect(summary.month).toBe(10);
    expect(summary.branches.map(b => [b.branchId, b.establishmentKey])).toEqual([
      [1, "qessa"],
      [2, "tadarruj"],
    ]);
    expect(summary.unassigned).toEqual([{ id: 3, name: "فرع الملقا" }]);
    expect(vi.mocked(financials.getBranchMonthlyFinancials).mock.calls).toEqual([
      [2026, 10, 1],
      [2026, 10, 2],
    ]);

    const laban = summary.branches[0];
    expect(laban.revenue).toEqual({ cash: 30000.5, network: 12000.25, total: 42000.75, days: 30 });
    expect(laban.expenses).toMatchObject({ fixed: 5533, salaries: 15000, other: 812.4, total: 21345.4 });
    expect(laban.expenses.payroll).toEqual({ count: 1, netSalary: 14200, recoveredAdvances: 800 });
    expect(laban.profit).toBe(20655.35);
    expect(laban.partners).toEqual([
      { name: "عمر", percent: 50, amount: 10327.68 },
      { name: "سالم", percent: 30, amount: 6196.6 },
      { name: "عبدالله", percent: 20, amount: 4131.07 },
    ]);

    const tuwaiq = summary.branches[1];
    expect(tuwaiq.profit).toBe(-1833);
    expect(tuwaiq.isLoss).toBe(true);
    expect(tuwaiq.partners).toEqual([
      { name: "سعود", percent: 40, amount: -733.2 },
      { name: "عمر", percent: 40, amount: -733.2 },
      { name: "كلثوم الكلثم", percent: 20, amount: -366.6 },
    ]);
  });

  it("validates the month and accepts its bounds", async () => {
    for (const month of [0, 13]) {
      await expect(caller("admin").partnerProfits.summary({ year: 2026, month })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    }
    for (const month of [1, 12]) {
      await expect(caller("admin").partnerProfits.summary({ year: 2026, month })).resolves.toMatchObject({ month });
    }
  });

  it("returns empty lists when there are no active branches", async () => {
    vi.mocked(db.getBranches).mockResolvedValue([BRANCHES[3]] as never);
    await expect(caller("admin").partnerProfits.summary({ year: 2026, month: 10 })).resolves.toEqual({
      year: 2026,
      month: 10,
      branches: [],
      unassigned: [],
    });
    expect(financials.getBranchMonthlyFinancials).not.toHaveBeenCalled();
  });

  it("shows a branch with no revenue, expenses or payroll as a zero profit split", async () => {
    vi.mocked(financials.getBranchMonthlyFinancials).mockImplementation(async (year, month, branchId) =>
      financials.assembleBranchFinancials(year, month, branchId ?? null, {
        revenue: { cash: 0, network: 0, days: 0 },
        expenseRows: [],
        payroll: { count: 0, netSalary: 0, recoveredAdvances: 0 },
      })
    );
    const summary = await caller("admin").partnerProfits.summary({ year: 2026, month: 10 });
    expect(summary.branches).toHaveLength(2);
    for (const b of summary.branches) {
      expect(b.profit).toBe(0);
      expect(b.isLoss).toBe(false);
      expect(b.expenses.byCategory).toEqual([]);
      expect(b.partners.map(p => p.amount)).toEqual([0, 0, 0]);
    }
  });
});

describe("partnerProfits.pdf", () => {
  it("renders the statement of one branch as a base64 PDF with a safe file name", async () => {
    const result = await caller("admin").partnerProfits.pdf({ year: 2026, month: 10, branchId: 2 });

    expect(Buffer.from(result.pdf, "base64").toString()).toBe("PARTNERS-PDF");
    expect(result.filename).toBe("partner-profits-tadarruj-2-2026-10.pdf");
    expect(vi.mocked(financials.getBranchMonthlyFinancials).mock.calls).toEqual([[2026, 10, 2]]);
    const html = vi.mocked(voucherPdf.renderHtmlToPdf).mock.calls[0][0];
    expect(html).toContain("بيان توزيع أرباح الشركاء");
    expect(html).toContain("مؤسسة تدرج وتخفيف");
    expect(html).toContain("فرع طويق");
    for (const name of ["سعود", "عمر", "كلثوم الكلثم"]) expect(html).toContain(name);
    expect(html).toContain("صافي الخسارة");
    expect(html).toContain("-1,833.00");
  });

  it("returns NOT_FOUND for a branch without partners or an inactive branch", async () => {
    for (const branchId of [3, 4, 99]) {
      await expect(caller("admin").partnerProfits.pdf({ year: 2026, month: 10, branchId })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    }
    expect(financials.getBranchMonthlyFinancials).not.toHaveBeenCalled();
    expect(voucherPdf.renderHtmlToPdf).not.toHaveBeenCalled();
  });

  it("turns a renderer failure into a clear Arabic error", async () => {
    vi.mocked(voucherPdf.renderHtmlToPdf).mockRejectedValueOnce(new Error("no browser"));
    await expect(caller("admin").partnerProfits.pdf({ year: 2026, month: 10, branchId: 1 })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "تعذر توليد ملف PDF، استخدم زر الطباعة من المتصفح",
    });
  });
});
