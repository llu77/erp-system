import { beforeEach, describe, expect, it, vi } from "vitest";

// تقريرا الإيرادات والمصاريف في صفحة التقارير الشهرية يستخدمان القالبين الرسميين (بدون puppeteer محلي)
const { launch } = vi.hoisted(() => ({ launch: vi.fn() }));
vi.mock("puppeteer", () => ({ default: { launch } }));

vi.mock("./financeReportsPdf", () => ({
  getRevenueReportData: vi.fn(),
  getExpenseReportData: vi.fn(),
  generateRevenueReportPDF: vi.fn(async () => Buffer.from("REVENUE-PDF")),
  generateExpenseReportPDF: vi.fn(async () => Buffer.from("EXPENSE-PDF")),
}));

import * as reports from "./financeReportsPdf";
import { generateMonthlyExpenseReport, generateMonthlyRevenueReport } from "./monthlyReports";

beforeEach(() => {
  vi.mocked(reports.getRevenueReportData).mockReset();
  vi.mocked(reports.getExpenseReportData).mockReset();
  launch.mockClear();
});

describe("monthly revenue/expense reports", () => {
  it("renders the revenue report for the whole month with the employees table", async () => {
    const data = { branchName: null, from: "2026-02-01", to: "2026-02-28", rows: [] };
    vi.mocked(reports.getRevenueReportData).mockResolvedValue(data);
    const pdf = await generateMonthlyRevenueReport(2, 2026);
    expect(pdf.toString()).toBe("REVENUE-PDF");
    expect(reports.getRevenueReportData).toHaveBeenCalledWith({
      branchId: null,
      from: "2026-02-01",
      to: "2026-02-28",
      year: 2026,
      month: 2,
      includeEmployees: true,
    });
    expect(reports.generateRevenueReportPDF).toHaveBeenCalledWith(data);
    expect(launch).not.toHaveBeenCalled();
  });

  it("uses the full last month of the year (no rollover into January)", async () => {
    vi.mocked(reports.getRevenueReportData).mockResolvedValue({ branchName: "فرع طويق", from: "2026-12-01", to: "2026-12-31", rows: [] });
    await generateMonthlyRevenueReport(12, 2026, 2);
    expect(reports.getRevenueReportData).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: 2, from: "2026-12-01", to: "2026-12-31", year: 2026, month: 12 })
    );
  });

  it("renders the expense report for a branch", async () => {
    const data = { year: 2026, month: 10, branchName: "فرع لبن", rows: [] };
    vi.mocked(reports.getExpenseReportData).mockResolvedValue(data);
    const pdf = await generateMonthlyExpenseReport(10, 2026, 1);
    expect(pdf.toString()).toBe("EXPENSE-PDF");
    expect(reports.getExpenseReportData).toHaveBeenCalledWith({ year: 2026, month: 10, branchId: 1 });
    expect(reports.generateExpenseReportPDF).toHaveBeenCalledWith(data);
    expect(launch).not.toHaveBeenCalled();
  });

  it("fails clearly for a missing branch", async () => {
    vi.mocked(reports.getRevenueReportData).mockResolvedValue(null);
    vi.mocked(reports.getExpenseReportData).mockResolvedValue(null);
    await expect(generateMonthlyRevenueReport(10, 2026, 99)).rejects.toThrow("الفرع غير موجود");
    await expect(generateMonthlyExpenseReport(10, 2026, 99)).rejects.toThrow("الفرع غير موجود");
  });
});
