import { describe, expect, it } from "vitest";
import {
  PARTNER_PROFITS_STATEMENT_TITLE,
  PARTNER_SHARES,
  buildPartnerProfitStatement,
  partnerKeyForBranch,
  profitOrLossLabel,
  splitPartnerProfit,
  type PartnerProfitFinancialsInput,
  type PartnerShareAmount,
} from "../shared/partnerProfits";
import { partnerProfitsPeriodRange, renderPartnerProfitsHtml } from "../shared/partnerProfitsTemplate";
import { amountToArabicWords, toHalalas } from "../shared/vouchers";

const sumHalalas = (shares: PartnerShareAmount[]) => shares.reduce((sum, s) => sum + toHalalas(s.amount), 0);
const amounts = (shares: PartnerShareAmount[]) => shares.map(s => s.amount);

describe("partner shares", () => {
  it("has the requested partners and percentages, each list summing to 100", () => {
    expect(PARTNER_SHARES.qessa).toEqual([
      { name: "عمر", percent: 50 },
      { name: "سالم", percent: 30 },
      { name: "عبدالله", percent: 20 },
    ]);
    expect(PARTNER_SHARES.tadarruj).toEqual([
      { name: "سعود", percent: 40 },
      { name: "عمر", percent: 40 },
      { name: "كلثوم الكلثم", percent: 20 },
    ]);
    for (const shares of Object.values(PARTNER_SHARES)) {
      expect(shares.reduce((sum, s) => sum + s.percent, 0)).toBe(100);
    }
  });

  it("finds a branch's partners by its Arabic or English name", () => {
    expect(partnerKeyForBranch({ nameAr: "فرع لبن", name: "Laban" })).toBe("qessa");
    expect(partnerKeyForBranch({ nameAr: "فرع طويق", name: "" })).toBe("tadarruj");
    expect(partnerKeyForBranch({ nameAr: "", name: "Tuwaiq Branch" })).toBe("tadarruj");
    expect(partnerKeyForBranch({ nameAr: "فرع الملقا", name: "Malqa" })).toBeNull();
    // اسم يطابق المؤسستين معاً لا يُنسب لأي منهما
    expect(partnerKeyForBranch({ nameAr: "لبن - طويق", name: null })).toBeNull();
  });
});

describe("splitPartnerProfit", () => {
  it("splits a round profit by the percentages", () => {
    expect(amounts(splitPartnerProfit(10000, PARTNER_SHARES.qessa))).toEqual([5000, 3000, 2000]);
    expect(amounts(splitPartnerProfit(10000, PARTNER_SHARES.tadarruj))).toEqual([4000, 4000, 2000]);
  });

  it("gives the odd halalas to the largest share (the first one on a tie)", () => {
    expect(amounts(splitPartnerProfit(100.01, PARTNER_SHARES.qessa))).toEqual([50.01, 30, 20]);
    expect(amounts(splitPartnerProfit(0.03, PARTNER_SHARES.tadarruj))).toEqual([0.02, 0.01, 0]);
    expect(amounts(splitPartnerProfit(1000.07, PARTNER_SHARES.tadarruj))).toEqual([400.04, 400.02, 200.01]);
  });

  it("splits a loss the same way as negative amounts labelled خسارة", () => {
    const loss = splitPartnerProfit(-1000.07, PARTNER_SHARES.tadarruj);
    expect(amounts(loss)).toEqual([-400.04, -400.02, -200.01]);
    expect(sumHalalas(loss)).toBe(-100007);
    expect(profitOrLossLabel(-0.01)).toBe("خسارة");
    expect(profitOrLossLabel(0)).toBe("ربح");
    expect(profitOrLossLabel(12)).toBe("ربح");
  });

  it("returns plain zeros for a zero profit", () => {
    for (const share of splitPartnerProfit(0, PARTNER_SHARES.qessa)) expect(Object.is(share.amount, 0)).toBe(true);
    for (const share of splitPartnerProfit(-0, PARTNER_SHARES.tadarruj)) expect(Object.is(share.amount, 0)).toBe(true);
  });

  it("always sums exactly to the profit in halalas", () => {
    const values = [0.01, 0.02, 0.99, 1, 33.33, 99.99, 12345.67, 20655.35, 987654.31, -0.01, -7.77, -12345.67];
    for (let i = 1; i <= 300; i++) values.push(((i * 7919) % 100003) / 100, -((i * 104729) % 50021) / 100);
    for (const profit of values) {
      for (const shares of Object.values(PARTNER_SHARES)) {
        const split = splitPartnerProfit(profit, shares);
        expect(sumHalalas(split)).toBe(toHalalas(profit));
        // كل حصة بالهللات (خانتان عشريتان على الأكثر)
        for (const s of split) expect(Math.abs(s.amount * 100 - Math.round(s.amount * 100))).toBeLessThan(1e-6);
      }
    }
  });

  it("rejects shares that do not add up to 100%", () => {
    expect(() => splitPartnerProfit(100, [{ name: "أ", percent: 60 }, { name: "ب", percent: 30 }])).toThrow("100%");
    expect(() => splitPartnerProfit(100, [])).toThrow();
  });
});

const FINANCIALS: PartnerProfitFinancialsInput = {
  revenue: { cash: 30000.5, network: 12000.25, total: 42000.75, days: 30 },
  expenses: {
    total: 6345.4,
    fixed: 5533,
    other: 812.4,
    byCategory: [
      { category: "shop_rent", label: "ايجار محل", amount: 3583 },
      { category: "housing_rent", label: "ايجار سكن", amount: 1700 },
      { category: "shop_supplies", label: "اغراض محل", amount: 512.4 },
      { category: "maintenance", label: "صيانة", amount: 300 },
      { category: "internet", label: "انترنت", amount: 250 },
      { category: "printing", label: "طباعة ورق", amount: 0 },
    ],
  },
  payroll: { count: 1, netSalary: 14200, recoveredAdvances: 800, cost: 15000 },
  totalCosts: 21345.4,
  profit: 20655.35,
};

describe("buildPartnerProfitStatement", () => {
  it("splits expenses into fixed / salaries / other and the profit between the partners", () => {
    const s = buildPartnerProfitStatement({
      year: 2026,
      month: 10,
      branch: { id: 1, nameAr: "فرع لبن", name: "Laban" },
      key: "qessa",
      financials: FINANCIALS,
    });
    expect(s.branchName).toBe("فرع لبن");
    expect(s.establishmentName).toBe("مؤسسة قصه وتخفيف");
    expect(s.expenses).toMatchObject({ fixed: 5533, salaries: 15000, other: 812.4, total: 21345.4 });
    expect(s.expenses.byCategory.map(c => c.category)).not.toContain("printing");
    expect(s.profit).toBe(20655.35);
    expect(s.isLoss).toBe(false);
    expect(amounts(s.partners)).toEqual([10327.68, 6196.6, 4131.07]);
    expect(sumHalalas(s.partners)).toBe(toHalalas(s.profit));
  });
});

describe("renderPartnerProfitsHtml", () => {
  const printedAt = new Date("2026-10-30T09:00:00Z");

  it("renders the official statement with the establishment letterhead, the calculation and the partners", () => {
    const s = buildPartnerProfitStatement({
      year: 2026,
      month: 10,
      branch: { id: 1, nameAr: 'فرع لبن <script>alert("x")</script>', name: "Laban" },
      key: "qessa",
      financials: FINANCIALS,
    });
    const html = renderPartnerProfitsHtml(s, { printedAt });

    expect(html).toContain(PARTNER_PROFITS_STATEMENT_TITLE);
    expect(html).toContain("مؤسسة قصه وتخفيف");
    expect(html).toContain("الرقم الموحد: 7032291507");
    expect(html).toContain("شهر أكتوبر 2026");
    expect(html).toContain("01/10/2026 - 31/10/2026");
    // الحساب
    for (const text of ["نقدي", "شبكة", "إجمالي الإيرادات", "مصاريف ثابتة", "رواتب", "مصاريف أخرى", "إجمالي المصاريف", "الأرباح = الإيرادات - المصاريف", "صافي الربح"]) {
      expect(html).toContain(text);
    }
    for (const amount of ["30,000.50", "12,000.25", "42,000.75", "5,533.00", "15,000.00", "812.40", "21,345.40", "20,655.35", "14,200.00", "800.00", "3,583.00", "512.40"]) {
      expect(html).toContain(amount);
    }
    expect(html).toContain("ايجار محل");
    expect(html).not.toContain("طباعة ورق");
    expect(html).toContain(amountToArabicWords(20655.35));
    // الشركاء والنسب والحصص والإجمالي
    for (const name of ["عمر", "سالم", "عبدالله"]) expect(html).toContain(`<td class="partner">${name}</td>`);
    for (const pct of ["50%", "30%", "20%", "100%"]) expect(html).toContain(pct);
    for (const amount of ["10,327.68", "6,196.60", "4,131.07"]) expect(html).toContain(amount);
    expect(html).toMatch(/الإجمالي[^<]*<\/td>\s*<td class="pct ltr">100%<\/td>\s*<td class="amt">20,655.35<\/td>/);
    expect(html).toContain("توقيع الشريك");
    expect(html.match(/class="sign-blank"/g)).toHaveLength(3);
    // بدون صور توقيع أو ختم
    expect(html).not.toContain('class="sig-img"');
    expect(html).not.toContain('class="stamp-img"');
    expect(html).not.toContain("<img");
    // أرقام لاتينية فقط وتهريب النص
    expect(html).not.toMatch(/[٠-٩۰-۹]/);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    // تاريخ الطباعة بتوقيت الرياض
    expect(html).toContain("30/10/2026 12:00");
  });

  it("labels a loss as خسارة and shows negative partner shares", () => {
    const s = buildPartnerProfitStatement({
      year: 2026,
      month: 2,
      branch: { id: 2, nameAr: "فرع طويق", name: "Tuwaiq" },
      key: "tadarruj",
      financials: { ...FINANCIALS, revenue: { cash: 1000, network: 0, total: 1000, days: 3 }, profit: -20345.4 },
    });
    expect(s.isLoss).toBe(true);
    const html = renderPartnerProfitsHtml(s, { printedAt });
    expect(html).toContain("مؤسسة تدرج وتخفيف");
    expect(html).toContain("صافي الخسارة");
    expect(html).toContain("حصة الخسارة");
    expect(html).toContain('class="net negative"');
    for (const name of ["سعود", "عمر", "كلثوم الكلثم"]) expect(html).toContain(`<td class="partner">${name}</td>`);
    for (const amount of ["-8,138.16", "-8,138.16", "-4,069.08", "-20,345.40"]) expect(html).toContain(amount);
    expect(html).toContain(amountToArabicWords(20345.4));
    expect(html).toContain("01/02/2026 - 28/02/2026");
  });

  it("formats the month range in Latin digits", () => {
    expect(partnerProfitsPeriodRange(2028, 2)).toBe("01/02/2028 - 29/02/2028");
    expect(partnerProfitsPeriodRange(2026, 12)).toBe("01/12/2026 - 31/12/2026");
  });
});
