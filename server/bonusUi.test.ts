import { describe, expect, it } from "vitest";
import { resolveBonusTier } from "../shared/bonus";
import {
  clampBonusPeriod,
  createEmptyTierDraftRow,
  describeDraftRanges,
  draftRowsToRules,
  draftRowsToTierInput,
  getBonusAuditActionLabel,
  getBonusPeriodOptions,
  getDefaultBonusPeriod,
  getReadableTextColor,
  isTierDraftDirty,
  parseAmountInput,
  shiftBonusPeriod,
  summarizeTierSnapshot,
  tiersToDraftRows,
  validateTierDraft,
  type TierDraftRow,
} from "../client/src/lib/bonusUi";

function row(minRevenue: string, bonusAmount: string, tierName = ""): TierDraftRow {
  return { ...createEmptyTierDraftRow(0), minRevenue, bonusAmount, tierName };
}

describe("parseAmountInput", () => {
  it("يقبل الأرقام اللاتينية والعربية والفواصل", () => {
    expect(parseAmountInput("1450")).toBe(1450);
    expect(parseAmountInput("١٤٥٠")).toBe(1450);
    expect(parseAmountInput("1,450.50")).toBe(1450.5);
    expect(parseAmountInput("١٤٥٠٫٥")).toBe(1450.5);
    expect(parseAmountInput(" 35 ")).toBe(35);
    expect(parseAmountInput(12)).toBe(12);
  });

  it("يرجع NaN للقيم الفارغة أو غير الصالحة", () => {
    expect(parseAmountInput("")).toBeNaN();
    expect(parseAmountInput("abc")).toBeNaN();
    expect(parseAmountInput("12a")).toBeNaN();
    expect(parseAmountInput(null)).toBeNaN();
  });
});

describe("جدول المستويات القابل للتعديل", () => {
  it("يحول المستويات المحفوظة إلى صفوف مرتبة بدون أصفار زائدة", () => {
    const rows = tiersToDraftRows([
      { tierName: "ذهبي", minRevenue: "2000.00", bonusAmount: "60.00", color: "yellow" },
      { tierName: "فضي", minRevenue: "1450.00", bonusAmount: "35.00", color: null },
    ]);
    expect(rows.map(r => [r.tierName, r.minRevenue, r.bonusAmount])).toEqual([
      ["فضي", "1450", "35"],
      ["ذهبي", "2000", "60"],
    ]);
    expect(rows[0].color).toBe("orange");
    expect(rows[1].color).toBe("yellow");
    expect(new Set(rows.map(r => r.uid)).size).toBe(2);
  });

  it("يتحقق بنفس قواعد الخادم", () => {
    expect(validateTierDraft([row("1450", "35"), row("1750", "55")])).toEqual([]);
    expect(validateTierDraft([])).toContain("يجب تحديد مستوى واحد على الأقل");
    expect(validateTierDraft([row("", "35")]).length).toBeGreaterThan(0);
    expect(validateTierDraft([row("1450", "35"), row("1450", "55")]).join(" ")).toContain("مكرر");
    expect(validateTierDraft([row("1450", "55"), row("1750", "35")]).join(" ")).toContain("أقل من المستوى الأدنى");
    expect(validateTierDraft([row("1450", "35", "x".repeat(101))]).join(" ")).toContain("أطول");
    const eight = Array.from({ length: 8 }, (_, i) => row(String(1000 + i * 100), String(10 + i)));
    expect(validateTierDraft(eight).join(" ")).toContain("الحد الأقصى");
  });

  it("يجهز المستويات كما ستحفظ ويختبر الإيراد عليها قبل الحفظ", () => {
    const rows = [row("1750", "55", "الثاني"), row("1450", "35", "")];
    const rules = draftRowsToRules(rows);
    expect(rules.map(r => [r.tierKey, r.tierName, r.minRevenue, r.maxRevenue, r.bonusAmount])).toEqual([
      ["tier_1", "المستوى 1", 1450, 1749.99, 35],
      ["tier_2", "الثاني", 1750, null, 55],
    ]);
    expect(resolveBonusTier(1500, rules)).toMatchObject({ tier: "tier_1", amount: 35, isEligible: true });
    expect(resolveBonusTier(1750, rules)).toMatchObject({ tier: "tier_2", tierName: "الثاني", amount: 55 });
    expect(resolveBonusTier(1000, rules)).toMatchObject({ tier: "none", amount: 0, isEligible: false });
  });

  it("لا يرجع مستويات من صفوف غير صالحة (حتى لا تُستخدم الافتراضية في الاختبار)", () => {
    expect(draftRowsToRules([row("1450", "")])).toEqual([]);
  });

  it("يحول الصفوف لمدخلات الحفظ", () => {
    expect(draftRowsToTierInput([row("١٤٥٠", "35", "  فضي ")])).toEqual([
      { tierName: "فضي", minRevenue: 1450, bonusAmount: 35, color: "orange" },
    ]);
  });

  it("يصف نطاق كل صف حسب الترتيب", () => {
    const a = row("1750", "55");
    const b = row("1450", "35");
    const c = row("", "10");
    const ranges = describeDraftRanges([a, b, c]);
    expect(ranges[b.uid]).toBe("1450 - 1749.99");
    expect(ranges[a.uid]).toBe("1750 فأكثر");
    expect(ranges[c.uid]).toBeNull();
  });

  it("يكتشف التعديلات غير المحفوظة بغض النظر عن الترتيب", () => {
    const saved = [row("1450", "35"), row("1750", "55")];
    expect(isTierDraftDirty([saved[1], saved[0]], saved)).toBe(false);
    expect(isTierDraftDirty([row("1450.00", "35"), row("1750", "55")], saved)).toBe(false);
    expect(isTierDraftDirty([row("1450", "40"), row("1750", "55")], saved)).toBe(true);
    expect(isTierDraftDirty([row("1450", "35")], saved)).toBe(true);
  });
});

describe("summarizeTierSnapshot", () => {
  it("يلخص قائمة أو مستوى واحد", () => {
    const list = JSON.stringify([
      { tierKey: "tier_2", tierName: "الثاني", minRevenue: 1750, bonusAmount: 55, isActive: true },
      { tierKey: "tier_1", tierName: "الأول", minRevenue: "1450.00", bonusAmount: "35.00" },
    ]);
    expect(summarizeTierSnapshot(list)).toEqual([
      "الأول: 1450 ر.س ← بونص 35 ر.س",
      "الثاني: 1750 ر.س ← بونص 55 ر.س",
    ]);
    expect(summarizeTierSnapshot(JSON.stringify({ tierKey: "tier_3", tierName: "", minRevenue: "2000", bonusAmount: "65" }))).toEqual([
      "tier_3: 2000 ر.س ← بونص 65 ر.س",
    ]);
  });

  it("يتجاهل القيم غير الصالحة والمستويات غير النشطة", () => {
    expect(summarizeTierSnapshot(null)).toEqual([]);
    expect(summarizeTierSnapshot("not json")).toEqual([]);
    expect(summarizeTierSnapshot(JSON.stringify([{ tierName: "x", minRevenue: 1, bonusAmount: 1, isActive: false }]))).toEqual([]);
  });
});

describe("فترات البونص للاختيار", () => {
  it("الفترة الحالية حسب اليوم", () => {
    expect(getDefaultBonusPeriod(new Date(2026, 9, 7))).toEqual({ year: 2026, month: 10, weekNumber: 1 });
    expect(getDefaultBonusPeriod(new Date(2026, 9, 8))).toEqual({ year: 2026, month: 10, weekNumber: 2 });
    expect(getDefaultBonusPeriod(new Date(2026, 9, 30))).toEqual({ year: 2026, month: 10, weekNumber: 5 });
  });

  it("خيارات الشهر مع حالة البدء والانتهاء", () => {
    const options = getBonusPeriodOptions(10, 2026, "2026-10-15");
    expect(options.map(o => o.label)).toEqual([
      "1-7 أكتوبر 2026",
      "8-14 أكتوبر 2026",
      "15-21 أكتوبر 2026",
      "22-28 أكتوبر 2026",
      "29-31 أكتوبر 2026",
    ]);
    expect(options.map(o => o.started)).toEqual([true, true, true, false, false]);
    expect(options.map(o => o.ended)).toEqual([true, true, false, false, false]);
    expect(getBonusPeriodOptions(2, 2027, "2027-03-01")).toHaveLength(4);
  });

  it("تصحيح وتحريك الفترة عبر الأشهر", () => {
    expect(clampBonusPeriod({ year: 2027, month: 2, weekNumber: 5 })).toEqual({ year: 2027, month: 2, weekNumber: 4 });
    expect(shiftBonusPeriod({ year: 2026, month: 10, weekNumber: 5 }, 1)).toEqual({ year: 2026, month: 11, weekNumber: 1 });
    expect(shiftBonusPeriod({ year: 2026, month: 12, weekNumber: 5 }, 1)).toEqual({ year: 2027, month: 1, weekNumber: 1 });
    expect(shiftBonusPeriod({ year: 2027, month: 3, weekNumber: 1 }, -1)).toEqual({ year: 2027, month: 2, weekNumber: 4 });
    expect(shiftBonusPeriod({ year: 2026, month: 1, weekNumber: 1 }, -1)).toEqual({ year: 2025, month: 12, weekNumber: 5 });
    expect(shiftBonusPeriod({ year: 2026, month: 10, weekNumber: 3 }, -1)).toEqual({ year: 2026, month: 10, weekNumber: 2 });
  });
});

describe("تسميات وألوان", () => {
  it("أسماء إجراءات التدقيق", () => {
    expect(getBonusAuditActionLabel("pay")).toBe("تسجيل صرف");
    expect(getBonusAuditActionLabel("reset_after_rejection")).toBe("إعادة فتح بعد الرفض");
    expect(getBonusAuditActionLabel("unknown_code")).toBe("unknown_code");
    expect(getBonusAuditActionLabel(null)).toBe("-");
  });

  it("لون النص المقروء", () => {
    expect(getReadableTextColor("#eab308")).toBe("#000000");
    expect(getReadableTextColor("#3b82f6")).toBe("#ffffff");
    expect(getReadableTextColor("bad")).toBe("#ffffff");
  });
});
