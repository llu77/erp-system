import { beforeEach, describe, expect, it, vi } from "vitest";

// خدمة البريد تُنشأ عند تحميل الموجّه وتتطلب مفتاحاً؛ لا تُستخدم في هذه الاختبارات
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: vi.fn(async () => ({ data: { id: "test" }, error: null })) };
  },
}));

vi.mock("./reports/financeReportsPdf", async importOriginal => {
  const actual = await importOriginal<typeof import("./reports/financeReportsPdf")>();
  return {
    ...actual,
    getRevenueReportData: vi.fn(),
    getExpenseReportData: vi.fn(),
    generateRevenueReportPDF: vi.fn(async () => Buffer.from("REVENUE-PDF")),
    generateExpenseReportPDF: vi.fn(async () => Buffer.from("EXPENSE-PDF")),
  };
});

import type { TrpcContext } from "./_core/context";
import * as reports from "./reports/financeReportsPdf";
import { appRouter } from "./routers";

type Role = "admin" | "manager" | "supervisor" | "viewer" | "employee" | "user";

function caller(role: Role, branchId: number | null = null) {
  const ctx = {
    user: {
      id: 5,
      openId: "u5",
      email: null,
      name: "أحمد المحاسب",
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

const REVENUE_DATA = { branchName: "فرع لبن", from: "2026-10-01", to: "2026-10-31", rows: [] } as Awaited<
  ReturnType<typeof reports.getRevenueReportData>
>;
const EXPENSE_DATA = { year: 2026, month: 10, branchName: "فرع لبن", rows: [] } as Awaited<
  ReturnType<typeof reports.getExpenseReportData>
>;

beforeEach(() => {
  vi.mocked(reports.getRevenueReportData).mockReset().mockResolvedValue(REVENUE_DATA);
  vi.mocked(reports.getExpenseReportData).mockReset().mockResolvedValue(EXPENSE_DATA);
  vi.mocked(reports.generateRevenueReportPDF).mockClear();
  vi.mocked(reports.generateExpenseReportPDF).mockClear();
});

describe("revenues.reportPdf", () => {
  it("returns a base64 PDF for a month and the requested branch", async () => {
    const result = await caller("manager").revenues.reportPdf({ branchId: 2, year: 2026, month: 10 });
    expect(Buffer.from(result.pdf, "base64").toString()).toBe("REVENUE-PDF");
    expect(result.filename).toBe("revenue-report-2026-10-branch-2.pdf");
    expect(reports.getRevenueReportData).toHaveBeenCalledWith({
      branchId: 2,
      from: "2026-10-01",
      to: "2026-10-31",
      year: 2026,
      month: 10,
      preparedByName: "أحمد المحاسب",
    });
  });

  it("lets admins export all branches and a custom date range", async () => {
    const result = await caller("admin").revenues.reportPdf({ from: "2026-10-05", to: "2026-10-12" });
    expect(result.filename).toBe("revenue-report-2026-10-05_2026-10-12-all-branches.pdf");
    expect(reports.getRevenueReportData).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: null, from: "2026-10-05", to: "2026-10-12", year: null, month: null })
    );
  });

  it("limits a branch supervisor to their own branch", async () => {
    await caller("supervisor", 1).revenues.reportPdf({ year: 2026, month: 10 });
    expect(reports.getRevenueReportData).toHaveBeenLastCalledWith(expect.objectContaining({ branchId: 1 }));
    await caller("supervisor", 1).revenues.reportPdf({ branchId: 1, year: 2026, month: 10 });
    expect(reports.getRevenueReportData).toHaveBeenLastCalledWith(expect.objectContaining({ branchId: 1 }));

    vi.mocked(reports.getRevenueReportData).mockClear();
    await expect(caller("supervisor", 1).revenues.reportPdf({ branchId: 2, year: 2026, month: 10 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(caller("supervisor", null).revenues.reportPdf({ year: 2026, month: 10 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(reports.getRevenueReportData).not.toHaveBeenCalled();
  });

  it("scopes a general supervisor (viewer) like the branch list", async () => {
    await caller("viewer", 2).revenues.reportPdf({ year: 2026, month: 10 });
    expect(reports.getRevenueReportData).toHaveBeenLastCalledWith(expect.objectContaining({ branchId: 2 }));
    await expect(caller("viewer", 2).revenues.reportPdf({ branchId: 1, year: 2026, month: 10 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await caller("viewer", null).revenues.reportPdf({ year: 2026, month: 10 });
    expect(reports.getRevenueReportData).toHaveBeenLastCalledWith(expect.objectContaining({ branchId: null }));
  });

  it("rejects employees and plain users", async () => {
    for (const role of ["employee", "user"] as const) {
      await expect(caller(role, 1).revenues.reportPdf({ branchId: 1, year: 2026, month: 10 })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
    expect(reports.getRevenueReportData).not.toHaveBeenCalled();
    expect(reports.generateRevenueReportPDF).not.toHaveBeenCalled();
  });

  it("validates the period", async () => {
    await expect(caller("admin").revenues.reportPdf({})).rejects.toMatchObject({ code: "BAD_REQUEST", message: "حدد الشهر أو فترة التقرير" });
    await expect(caller("admin").revenues.reportPdf({ from: "2026-10-12", to: "2026-10-05" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(caller("admin").revenues.reportPdf({ from: "2026-02-30", to: "2026-03-05" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(caller("admin").revenues.reportPdf({ from: "2025-01-01", to: "2026-10-05" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(caller("admin").revenues.reportPdf({ year: 2026, month: 13 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(reports.getRevenueReportData).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for a missing branch and a clear error when PDF rendering fails", async () => {
    vi.mocked(reports.getRevenueReportData).mockResolvedValueOnce(null);
    await expect(caller("admin").revenues.reportPdf({ branchId: 99, year: 2026, month: 10 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    vi.mocked(reports.generateRevenueReportPDF).mockRejectedValueOnce(new Error("no browser"));
    await expect(caller("admin").revenues.reportPdf({ year: 2026, month: 10 })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "تعذر توليد ملف PDF، استخدم زر الطباعة من المتصفح",
    });
  });
});

describe("expenses.reportPdf", () => {
  it("returns a base64 PDF with the page filters", async () => {
    const result = await caller("admin").expenses.reportPdf({
      year: 2026,
      month: 10,
      branchId: 3,
      category: "shop_rent",
      status: "paid",
    });
    expect(Buffer.from(result.pdf, "base64").toString()).toBe("EXPENSE-PDF");
    expect(result.filename).toBe("expense-report-2026-10-branch-3.pdf");
    expect(reports.getExpenseReportData).toHaveBeenCalledWith({
      year: 2026,
      month: 10,
      branchId: 3,
      category: "shop_rent",
      status: "paid",
      preparedByName: "أحمد المحاسب",
    });
  });

  it("exports all branches for managers and only their branch for supervisors", async () => {
    const all = await caller("manager").expenses.reportPdf({ year: 2026, month: 10 });
    expect(all.filename).toBe("expense-report-2026-10-all-branches.pdf");
    expect(reports.getExpenseReportData).toHaveBeenLastCalledWith(expect.objectContaining({ branchId: null, category: null, status: null }));

    const own = await caller("supervisor", 4).expenses.reportPdf({ year: 2026, month: 10, branchId: null });
    expect(own.filename).toBe("expense-report-2026-10-branch-4.pdf");
    expect(reports.getExpenseReportData).toHaveBeenLastCalledWith(expect.objectContaining({ branchId: 4 }));

    vi.mocked(reports.getExpenseReportData).mockClear();
    await expect(caller("supervisor", 4).expenses.reportPdf({ year: 2026, month: 10, branchId: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(caller("supervisor", null).expenses.reportPdf({ year: 2026, month: 10 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(caller("employee", 4).expenses.reportPdf({ year: 2026, month: 10, branchId: 4 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(reports.getExpenseReportData).not.toHaveBeenCalled();
  });

  it("accepts approved/paid statuses only and known categories", async () => {
    await expect(
      caller("admin").expenses.reportPdf({ year: 2026, month: 10, status: "pending" as never })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller("admin").expenses.reportPdf({ year: 2026, month: 10, category: "rent" as never })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(reports.getExpenseReportData).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for a missing branch", async () => {
    vi.mocked(reports.getExpenseReportData).mockResolvedValueOnce(null);
    await expect(caller("admin").expenses.reportPdf({ year: 2026, month: 10, branchId: 99 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(reports.generateExpenseReportPDF).not.toHaveBeenCalled();
  });
});

describe("report helpers", () => {
  it("builds UTC day ranges for stored business days", () => {
    const { start, endExclusive } = reports.utcDayRange("2026-10-01", "2026-10-31");
    expect(start.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(endExclusive.toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });

  it("resolves the revenue period from a month or a range", () => {
    expect(reports.resolveRevenueReportPeriod({ year: 2026, month: 2 })).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
      year: 2026,
      month: 2,
    });
    expect(reports.resolveRevenueReportPeriod({ from: "2026-10-05", to: "2026-10-05" })).toEqual({
      from: "2026-10-05",
      to: "2026-10-05",
      year: null,
      month: null,
    });
    expect(reports.resolveRevenueReportPeriod({ from: "bad", to: "2026-10-05" })).toEqual({ error: "تاريخ الفترة غير صحيح" });
  });
});
