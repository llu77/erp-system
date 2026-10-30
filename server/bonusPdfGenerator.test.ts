import { describe, expect, it } from "vitest";
import { SIGNATURES } from "../shared/branding";
import { buildBonusReportHtml, type BonusPdfRequest } from "../client/src/lib/bonusPdfGenerator";

function makeRequest(status: string, overrides: Partial<BonusPdfRequest> = {}): BonusPdfRequest {
  return {
    id: 12,
    branchName: "فرع الرياض",
    weekNumber: 2,
    month: 10,
    year: 2026,
    status,
    totalAmount: "90.00",
    eligibleCount: 2,
    totalEmployees: 3,
    details: [
      { employeeName: "أحمد", employeeCode: "E1", weeklyRevenue: "1800", bonusTier: "tier_2", tierName: "الذهبي", bonusAmount: "55", isEligible: true },
      { employeeName: "خالد", employeeCode: "E2", weeklyRevenue: "1500", bonusTier: "tier_1", tierName: null, tierLabel: "البرونزي", bonusAmount: "35", isEligible: true },
      { employeeName: "<script>x</script>", employeeCode: null, weeklyRevenue: "100", bonusTier: "none", tierName: null, bonusAmount: "0", isEligible: false },
    ],
    ...overrides,
  };
}

describe("buildBonusReportHtml", () => {
  it("يعرض أسماء المستويات من البيانات وعنوان الفترة", () => {
    const html = buildBonusReportHtml(makeRequest("requested"));
    expect(html).toContain("الذهبي");
    expect(html).toContain("البرونزي");
    expect(html).toContain("غير مؤهل");
    expect(html).toContain("8-14 أكتوبر 2026");
    expect(html).not.toContain("tier_2");
  });

  it("لا يطبع التوقيعات والختم قبل الاعتماد", () => {
    for (const status of ["pending", "requested", "rejected"]) {
      const html = buildBonusReportHtml(makeRequest(status, { rejectionReason: "مبلغ غير صحيح" }));
      expect(html).not.toContain(SIGNATURES.stamp.image);
      expect(html).not.toContain(SIGNATURES.manager.image);
      expect(html).toContain("غير معتمد");
    }
    expect(buildBonusReportHtml(makeRequest("rejected", { rejectionReason: "مبلغ غير صحيح" }))).toContain("مبلغ غير صحيح");
  });

  it("يطبع التوقيعات والختم للمعتمد والمصروف", () => {
    for (const status of ["approved", "paid"]) {
      const html = buildBonusReportHtml(makeRequest(status, { paymentMethod: "bank_transfer", paymentReference: "TR-1", paidAmount: "90" }));
      expect(html).toContain(SIGNATURES.stamp.image);
      expect(html).toContain(SIGNATURES.manager.image);
      expect(html).toContain(SIGNATURES.supervisor.image);
      expect(html).not.toContain('class="watermark"');
    }
    const paid = buildBonusReportHtml(makeRequest("paid", { paymentMethod: "bank_transfer", paymentReference: "TR-1" }));
    expect(paid).toContain("تحويل بنكي");
    expect(paid).toContain("TR-1");
  });

  it("يحمي أسماء الموظفين من HTML", () => {
    const html = buildBonusReportHtml(makeRequest("pending"));
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("يعمل بدون موظفين وبدون مستويات", () => {
    const html = buildBonusReportHtml(makeRequest("pending", { details: [], eligibleCount: 0, totalEmployees: 0, totalAmount: "0" }), { tiers: [] });
    expect(html).toContain("0 من 0");
    expect(html).toContain("0.00 ر.س");
    expect(html).not.toContain('class="legend"');
    expect(html).not.toContain("<td class=\"name-cell\">أحمد");
  });

  const legendTiers = [
    { tierKey: "tier_1", tierName: "البرونزي", minRevenue: 1450, maxRevenue: 1749.99, bonusAmount: 35, color: "orange" },
    { tierKey: "tier_2", tierName: "الذهبي", minRevenue: 1750, maxRevenue: null, bonusAmount: 55, color: "yellow" },
  ];

  it("يعرض دليل المستويات من الإعدادات لفترة غير مقفلة", () => {
    const html = buildBonusReportHtml(makeRequest("pending"), { tiers: legendTiers });
    expect(html).toContain('class="legend"');
    expect(html).toContain("1450 - 1749.99");
    expect(html).toContain("1750 فأكثر");
  });

  it("لا يعرض المستويات الحالية لفترة مقفلة (احتُسبت بمستويات وقتها)", () => {
    for (const status of ["requested", "approved", "paid"]) {
      const html = buildBonusReportHtml(makeRequest(status), { tiers: legendTiers });
      expect(html).not.toContain('class="legend"');
      expect(html).not.toContain("1750 فأكثر");
      // أسماء المستويات المحفوظة وقت الاحتساب تبقى في الجدول
      expect(html).toContain("الذهبي");
    }
  });
});
