import { describe, expect, it } from "vitest";
import {
  ESTABLISHMENTS,
  GROUP_ESTABLISHMENT,
  SIGNATURES,
  SYSTEM_BRAND,
} from "../shared/branding";
import {
  REPORT_SIGNATORIES,
  establishmentDetailsLine,
  getReportEstablishment,
  isSystemBrandName,
  reportFooterText,
  reportPrintedAtText,
  resolveStoreName,
} from "../shared/reportBranding";
import { generateDocumentReportHTML } from "./documentReportService";
import { generateCashFlowReportHTML } from "./cashFlowPdfService";
import {
  buildBonusReportHtml,
  bonusReportEstablishment,
  type BonusPdfRequest,
} from "../client/src/lib/bonusPdfGenerator";
import { buildPayrollSheetHtml, payrollEstablishment } from "../client/src/lib/payrollPrint";
import { getPDFEstablishment, getPDFHeader, getPDFFooter } from "../client/src/utils/pdfTemplates";

const QESSA = ESTABLISHMENTS.qessa.nameAr;
const TADARRUJ = ESTABLISHMENTS.tadarruj.nameAr;
const GROUP = GROUP_ESTABLISHMENT.nameAr;
// اسم النظام (وليس فئة CSS مثل .symbol لعلامة ✓ في الختم)
const SYSTEM_NAME = /symbol[\s-]?ai|سيمبول/i;

describe("getReportEstablishment", () => {
  it("فرع واحد -> مؤسسته (عربي أو إنجليزي أو كائن فرع)", () => {
    expect(getReportEstablishment("فرع لبن").nameAr).toBe(QESSA);
    expect(getReportEstablishment("Tuwaiq Branch").nameAr).toBe(TADARRUJ);
    expect(getReportEstablishment({ name: "Branch 2", nameAr: "فرع طويق" }).nameAr).toBe(TADARRUJ);
  });

  it("بدون فرع أو جميع الفروع أو فرع غير معروف -> الهوية العامة", () => {
    expect(getReportEstablishment(null).nameAr).toBe(GROUP);
    expect(getReportEstablishment(undefined).nameAr).toBe(GROUP);
    expect(getReportEstablishment("جميع الفروع").nameAr).toBe(GROUP);
    expect(getReportEstablishment("فرع الرياض").nameAr).toBe(GROUP);
  });

  it("قائمة فروع: مؤسستها إن كانت واحدة، وإلا الهوية العامة", () => {
    expect(getReportEstablishment(["فرع لبن", "Laban 2"]).nameAr).toBe(QESSA);
    expect(getReportEstablishment(["فرع لبن", "فرع طويق"]).nameAr).toBe(GROUP);
    expect(getReportEstablishment([]).nameAr).toBe(GROUP);
  });
});

describe("establishmentDetailsLine", () => {
  it("يخفي القيم المؤقتة (XXXX) ويجمع الباقي", () => {
    expect(establishmentDetailsLine(ESTABLISHMENTS.qessa)).toBe("");
    expect(
      establishmentDetailsLine({ subtitle: "صالون رجالي", cr: "س.ت: 1010123456", vat: "الرقم الضريبي: XXXXXXXXXXXXXXX" })
    ).toBe("صالون رجالي | س.ت: 1010123456");
  });
});

describe("موقعو التقارير والذيل", () => {
  it("الموقعون والمسميات من SIGNATURES (لا مدير المالية)", () => {
    expect(REPORT_SIGNATORIES.supervisor).toEqual({ name: SIGNATURES.supervisor.name, title: SIGNATURES.supervisor.title });
    expect(REPORT_SIGNATORIES.manager).toEqual({ name: SIGNATURES.manager.name, title: SIGNATURES.manager.title });
    expect(JSON.stringify(REPORT_SIGNATORIES)).not.toContain("مدير المالية");
  });

  it("الذيل باسم المؤسسة وتاريخ ميلادي بتوقيت الرياض", () => {
    // 2026-10-29 22:30 UTC = 2026-10-30 01:30 بتوقيت الرياض
    const now = new Date("2026-10-29T22:30:00Z");
    expect(reportPrintedAtText(now)).toBe("التاريخ: 30/10/2026 | الوقت: 01:30");
    const footer = reportFooterText(ESTABLISHMENTS.qessa, now);
    expect(footer).toBe(`${QESSA} | التاريخ: 30/10/2026 | الوقت: 01:30`);
    expect(footer).not.toMatch(SYSTEM_NAME);
  });
});

describe("resolveStoreName (إيصال نقطة البيع)", () => {
  it("اسم المتجر المحفوظ أولاً", () => {
    expect(resolveStoreName("  صالون النخبة  ", "فرع لبن")).toBe("صالون النخبة");
  });

  it("بدون اسم محفوظ أو باسم النظام القديم -> مؤسسة الفرع", () => {
    expect(resolveStoreName(null, "فرع لبن")).toBe(QESSA);
    expect(resolveStoreName("", { nameAr: "فرع طويق" })).toBe(TADARRUJ);
    expect(resolveStoreName(SYSTEM_BRAND.name, "فرع طويق")).toBe(TADARRUJ);
    expect(resolveStoreName("symbol ai", "فرع غير معروف")).toBe(GROUP);
    expect(isSystemBrandName(SYSTEM_BRAND.nameAr)).toBe(true);
    expect(isSystemBrandName("مؤسسة قصه وتخفيف")).toBe(false);
  });
});

describe("إعدادات الطباعة الافتراضية لنقطة البيع", () => {
  it("اسم المتجر الافتراضي = مؤسسة الفرع وليس اسم النظام", async () => {
    const { getDefaultPrintSettings } = await import("./db");
    expect(getDefaultPrintSettings(1, { name: "Laban", nameAr: "فرع لبن" }).storeName).toBe(QESSA);
    expect(getDefaultPrintSettings(2, { name: "Tuwaiq", nameAr: "فرع طويق" }).storeName).toBe(TADARRUJ);
    expect(getDefaultPrintSettings(3).storeName).toBe(GROUP);
    expect(getDefaultPrintSettings(3).storeName).not.toMatch(SYSTEM_NAME);
  });
});

describe("تقرير البونص (الواجهة)", () => {
  const request = (branchName: string, status = "approved"): BonusPdfRequest => ({
    id: 5,
    branchName,
    weekNumber: 1,
    month: 10,
    year: 2026,
    status,
    totalAmount: "50",
    eligibleCount: 1,
    totalEmployees: 1,
    details: [{ employeeName: "أحمد", employeeCode: "E1", weeklyRevenue: "1500", bonusTier: "tier_1", tierName: "البرونزي", bonusAmount: "50", isEligible: true }],
  });

  it("الترويسة والذيل باسم مؤسسة فرع البونص بدون اسم النظام أو شعاره", () => {
    const laban = buildBonusReportHtml(request("فرع لبن"));
    expect(laban).toContain(QESSA);
    expect(laban).not.toMatch(SYSTEM_NAME);
    expect(laban).not.toContain("symbol-ai-logo");
    expect(laban).not.toContain('class="logo"');

    const tuwaiq = buildBonusReportHtml(request("فرع طويق"));
    expect(tuwaiq).toContain(TADARRUJ);
    expect(tuwaiq).not.toContain(QESSA);
    expect(bonusReportEstablishment({ branchName: "فرع الرياض" }).nameAr).toBe(GROUP);
  });

  it("يهرّب اسم الفرع", () => {
    const html = buildBonusReportHtml(request('فرع لبن <img src=x onerror="alert(1)">'));
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
  });
});

describe("مسيرة الرواتب المطبوعة", () => {
  const payroll = (branchName: string, status = "approved") => ({
    payrollNumber: "PR-2026-10-001",
    branchName,
    year: 2026,
    month: 10,
    status,
    createdAt: "2026-10-28T09:00:00Z",
    createdByName: "مشرف",
    approvedByName: "المدير",
    approvedAt: "2026-10-29T09:00:00Z",
  });
  const detail = {
    employeeName: "أحمد",
    employeeCode: "E1",
    baseSalary: "3000",
    overtimeAmount: "0",
    incentiveAmount: "0",
    workDays: 30,
    absentDays: 0,
    absentDeduction: "0",
    leaveDays: 0,
    leaveDeduction: "0",
    advanceDeduction: "0",
    negativeInvoicesDeduction: "0",
    deductionAmount: "0",
    grossSalary: "3000",
    totalDeductions: "0",
    netSalary: "3000",
  };

  it("الترويسة باسم مؤسسة فرع المسيرة بدون صورة شعار وبدون اسم النظام", () => {
    const html = buildPayrollSheetHtml(payroll("فرع طويق"), [detail]);
    expect(payrollEstablishment({ branchName: "فرع طويق" }).nameAr).toBe(TADARRUJ);
    expect(html).toContain(`<div class="name">${TADARRUJ}</div>`);
    expect(html).not.toContain('alt="logo"');
    expect(html).not.toMatch(SYSTEM_NAME);
    expect(html).not.toContain("XXXX");
  });

  it("الختم والتوقيعات بعد الاعتماد فقط", () => {
    expect(buildPayrollSheetHtml(payroll("فرع لبن", "approved"), [detail])).toContain(SIGNATURES.stamp.image);
    const draft = buildPayrollSheetHtml(payroll("فرع لبن", "draft"), [detail]);
    expect(draft).not.toContain(SIGNATURES.stamp.image);
    expect(draft).toContain(QESSA);
  });
});

describe("قوالب تقارير الواجهة (pdfTemplates)", () => {
  it("الهوية العامة بدون فرع، ومؤسسة الفرع عند تحديده", () => {
    expect(getPDFEstablishment().nameAr).toBe(GROUP);
    expect(getPDFEstablishment({ branchName: "جميع الفروع" }).nameAr).toBe(GROUP);
    expect(getPDFEstablishment({ branchName: { name: "Laban", nameAr: "فرع لبن" } }).nameAr).toBe(QESSA);
    const header = getPDFHeader("تقرير", { branchName: "فرع طويق" });
    expect(header).toContain(TADARRUJ);
    expect(header).not.toMatch(SYSTEM_NAME);
    expect(header).not.toContain("<img");
    const footer = getPDFFooter(undefined, { branchName: "فرع لبن" });
    expect(footer).toContain(QESSA);
    expect(footer).not.toMatch(SYSTEM_NAME);
  });
});

describe("تقارير الخادم HTML (الوثائق والتدفق النقدي)", () => {
  const emptyDocs = { iqama: [], healthCert: [], contract: [] };
  const docReport = (branchFilter: string | null) =>
    generateDocumentReportHTML({
      generatedAt: new Date("2026-10-30T08:00:00Z"),
      generatedBy: "<b>مدير</b>",
      branchFilter,
      summary: {
        totalExpired: 0,
        totalExpiring: 0,
        expiredIqamaCount: 0,
        expiringIqamaCount: 0,
        expiredHealthCertCount: 0,
        expiringHealthCertCount: 0,
        expiredContractCount: 0,
        expiringContractCount: 0,
      },
      expired: emptyDocs,
      expiring: emptyDocs,
    });

  it("تقرير الوثائق: مؤسسة الفرع أو الهوية العامة، والموقعون من SIGNATURES", () => {
    const all = docReport(null);
    expect(all).toContain(GROUP);
    expect(all).not.toMatch(SYSTEM_NAME);
    expect(all).toContain(SIGNATURES.supervisor.name);
    expect(all).toContain(SIGNATURES.manager.title);
    expect(all).not.toContain("<b>مدير</b>");

    const laban = docReport("Laban");
    expect(laban).toContain(QESSA);
    expect(laban).not.toContain(GROUP);
  });

  it("تقرير التدفق النقدي: مؤسسة الفرع ويهرّب اسمه", () => {
    const html = generateCashFlowReportHTML({
      reportTitle: "تقرير التدفق النقدي",
      periodType: "monthly",
      year: 2026,
      month: 10,
      branchName: "فرع طويق <script>",
      generatedAt: new Date("2026-10-30T08:00:00Z"),
      generatedBy: "مدير",
      summary: {
        totalCashRevenue: 0,
        totalCashExpenses: 0,
        totalCashVouchers: 0,
        totalCashAdvances: 0,
        remainingCash: 0,
        cashRetentionRate: "0",
      },
      kpis: {
        dailyAverage: 0,
        growthRate: 0,
        previousPeriodCash: 0,
        highestDay: { date: "-", amount: 0 },
        lowestDay: { date: "-", amount: 0 },
        daysWithPositiveCash: 0,
        totalDays: 0,
      },
      expensesByMethod: {},
      vouchersByMethod: {},
    });
    expect(html).toContain(TADARRUJ);
    expect(html).not.toMatch(SYSTEM_NAME);
    expect(html).not.toContain("فرع طويق <script>");
    expect(html).toContain(SIGNATURES.manager.name);
  });
});
