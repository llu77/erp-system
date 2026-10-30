import { describe, it, expect } from "vitest";
import {
  resolveBonusTier,
  validateTierList,
  getBonusPeriodDays,
  getBonusPeriodNumber,
  getBonusPeriodsInMonth,
  revenueToNextTier,
  DEFAULT_BONUS_TIERS,
} from "../shared/bonus";

const managerTiers = [
  { tierKey: "tier_1", tierName: "المستوى 1", minRevenue: 1200, bonusAmount: 35 },
  { tierKey: "tier_2", tierName: "المستوى 2", minRevenue: 1500, bonusAmount: 60 },
  { tierKey: "tier_3", tierName: "المستوى 3", minRevenue: 2000, bonusAmount: 100 },
];

describe("resolveBonusTier", () => {
  it("uses the manager-configured tiers", () => {
    expect(resolveBonusTier(1199.99, managerTiers).amount).toBe(0);
    expect(resolveBonusTier(1200, managerTiers)).toMatchObject({ tier: "tier_1", amount: 35, isEligible: true });
    expect(resolveBonusTier(1999, managerTiers)).toMatchObject({ tier: "tier_2", amount: 60 });
    expect(resolveBonusTier(5000, managerTiers)).toMatchObject({ tier: "tier_3", amount: 100 });
  });

  it("is independent of tier order", () => {
    expect(resolveBonusTier(1600, [...managerTiers].reverse()).amount).toBe(60);
  });

  it("falls back to defaults when no tiers are configured", () => {
    expect(resolveBonusTier(1450, []).amount).toBe(DEFAULT_BONUS_TIERS[0].bonusAmount);
    expect(resolveBonusTier(3200, null).amount).toBe(190);
  });
});

describe("validateTierList", () => {
  it("accepts ascending tiers", () => {
    expect(validateTierList(managerTiers)).toEqual([]);
  });
  it("rejects duplicates, non-positive values and decreasing amounts", () => {
    expect(validateTierList([{ minRevenue: 1000, bonusAmount: 50 }, { minRevenue: 1000, bonusAmount: 60 }]).length).toBeGreaterThan(0);
    expect(validateTierList([{ minRevenue: 0, bonusAmount: 50 }]).length).toBeGreaterThan(0);
    expect(validateTierList([{ minRevenue: 1000, bonusAmount: 80 }, { minRevenue: 2000, bonusAmount: 60 }]).length).toBeGreaterThan(0);
    expect(validateTierList([]).length).toBeGreaterThan(0);
  });
});

describe("bonus periods", () => {
  it("uses 1-7, 8-14, 15-21, 22-28, 29-end", () => {
    expect(getBonusPeriodNumber(7)).toBe(1);
    expect(getBonusPeriodNumber(8)).toBe(2);
    expect(getBonusPeriodNumber(21)).toBe(3);
    expect(getBonusPeriodNumber(28)).toBe(4);
    expect(getBonusPeriodNumber(31)).toBe(5);
    expect(getBonusPeriodDays(5, 10, 2026)).toEqual({ startDay: 29, endDay: 31, days: 3 });
    expect(getBonusPeriodDays(2, 10, 2026)).toEqual({ startDay: 8, endDay: 14, days: 7 });
  });
  it("february without a 29th has 4 periods", () => {
    expect(getBonusPeriodsInMonth(2, 2026)).toBe(4);
    expect(getBonusPeriodsInMonth(2, 2028)).toBe(5);
    expect(getBonusPeriodDays(5, 2, 2026).days).toBe(0);
  });
});

describe("revenueToNextTier", () => {
  it("reports remaining revenue to next tier", () => {
    const r = revenueToNextTier(1300, managerTiers);
    expect(r.nextTier?.minRevenue).toBe(1500);
    expect(r.remaining).toBe(200);
    expect(revenueToNextTier(9999, managerTiers).nextTier).toBeNull();
  });
});
