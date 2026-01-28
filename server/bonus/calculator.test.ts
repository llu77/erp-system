import { describe, expect, it } from "vitest";
import { 
  calculateBonus, 
  getWeekNumber, 
  getWeekInfo, 
  getWeekDateRange,
  getTierNameAr,
  getTierColor
} from "./calculator";

describe("Bonus Calculator", () => {
  describe("calculateBonus", () => {
    // المستويات المحدثة (7 يناير 2026):
    // tier_7: >=3200 → 190 ر.س
    // tier_6: 2800-3199 → 155 ر.س
    // tier_5: 2500-2799 → 120 ر.س
    // tier_4: 2200-2499 → 90 ر.س
    // tier_3: 1950-2199 → 65 ر.س
    // tier_2: 1750-1949 → 55 ر.س
    // tier_1: 1450-1749 → 35 ر.س
    // none: <1450 → 0 ر.س

    it("returns tier_7 with 190 SAR for revenue >= 3200", () => {
      const result = calculateBonus(3200);
      expect(result.tier).toBe("tier_7");
      expect(result.amount).toBe(190);
      expect(result.isEligible).toBe(true);
    });

    it("returns tier_7 for revenue above 3200", () => {
      const result = calculateBonus(4000);
      expect(result.tier).toBe("tier_7");
      expect(result.amount).toBe(190);
    });

    it("returns tier_6 with 155 SAR for revenue 2800-3199", () => {
      const result = calculateBonus(2800);
      expect(result.tier).toBe("tier_6");
      expect(result.amount).toBe(155);
      expect(result.isEligible).toBe(true);
    });

    it("returns tier_6 for revenue 3199", () => {
      const result = calculateBonus(3199);
      expect(result.tier).toBe("tier_6");
      expect(result.amount).toBe(155);
    });

    it("returns tier_5 with 120 SAR for revenue 2500-2799", () => {
      const result = calculateBonus(2500);
      expect(result.tier).toBe("tier_5");
      expect(result.amount).toBe(120);
      expect(result.isEligible).toBe(true);
    });

    it("returns tier_4 with 90 SAR for revenue 2200-2499", () => {
      const result = calculateBonus(2200);
      expect(result.tier).toBe("tier_4");
      expect(result.amount).toBe(90);
      expect(result.isEligible).toBe(true);
    });

    it("returns tier_3 with 65 SAR for revenue 1950-2199", () => {
      const result = calculateBonus(1950);
      expect(result.tier).toBe("tier_3");
      expect(result.amount).toBe(65);
      expect(result.isEligible).toBe(true);
    });

    it("returns tier_2 with 55 SAR for revenue 1750-1949", () => {
      const result = calculateBonus(1750);
      expect(result.tier).toBe("tier_2");
      expect(result.amount).toBe(55);
      expect(result.isEligible).toBe(true);
    });

    it("returns tier_1 with 35 SAR for revenue 1450-1749", () => {
      const result = calculateBonus(1450);
      expect(result.tier).toBe("tier_1");
      expect(result.amount).toBe(35);
      expect(result.isEligible).toBe(true);
    });

    it("returns none with 0 SAR for revenue < 1450", () => {
      const result = calculateBonus(1199);
      expect(result.tier).toBe("none");
      expect(result.amount).toBe(0);
      expect(result.isEligible).toBe(false);
    });

    it("returns none for zero revenue", () => {
      const result = calculateBonus(0);
      expect(result.tier).toBe("none");
      expect(result.amount).toBe(0);
      expect(result.isEligible).toBe(false);
    });
  });

  describe("getWeekNumber - كل أسبوع 7 أيام بالضبط", () => {
    it("returns week 1 for days 1-7", () => {
      expect(getWeekNumber(1)).toBe(1);
      expect(getWeekNumber(7)).toBe(1);
    });

    it("returns week 2 for days 8-14", () => {
      expect(getWeekNumber(8)).toBe(2);
      expect(getWeekNumber(14)).toBe(2);
    });

    it("returns week 3 for days 15-21", () => {
      expect(getWeekNumber(15)).toBe(3);
      expect(getWeekNumber(21)).toBe(3);
    });

    it("returns week 4 for days 22-28", () => {
      expect(getWeekNumber(22)).toBe(4);
      expect(getWeekNumber(28)).toBe(4);
    });

    it("returns week 5 for days 29-31", () => {
      expect(getWeekNumber(29)).toBe(5);
      expect(getWeekNumber(30)).toBe(5);
      expect(getWeekNumber(31)).toBe(5);
    });
  });

  describe("getWeekDateRange - كل أسبوع 7 أيام بالضبط", () => {
    it("returns correct range for week 1 (1-7)", () => {
      const { start, end } = getWeekDateRange(1, 1, 2026);
      expect(start.getUTCDate()).toBe(1);
      expect(end.getUTCDate()).toBe(7);
    });

    it("returns correct range for week 2 (8-14)", () => {
      const { start, end } = getWeekDateRange(2, 1, 2026);
      expect(start.getUTCDate()).toBe(8);
      expect(end.getUTCDate()).toBe(14);
    });

    it("returns correct range for week 3 (15-21)", () => {
      const { start, end } = getWeekDateRange(3, 1, 2026);
      expect(start.getUTCDate()).toBe(15);
      expect(end.getUTCDate()).toBe(21);
    });

    it("returns correct range for week 4 (22-28)", () => {
      const { start, end } = getWeekDateRange(4, 1, 2026);
      expect(start.getUTCDate()).toBe(22);
      expect(end.getUTCDate()).toBe(28);
    });

    it("returns correct range for week 5 in a 31-day month (29-31)", () => {
      const { start, end } = getWeekDateRange(5, 1, 2026); // January
      expect(start.getUTCDate()).toBe(29);
      expect(end.getUTCDate()).toBe(31);
    });

    it("returns correct range for week 5 in a 30-day month (29-30)", () => {
      const { start, end } = getWeekDateRange(5, 4, 2026); // April
      expect(start.getUTCDate()).toBe(29);
      expect(end.getUTCDate()).toBe(30);
    });

    it("returns correct range for week 5 in February (29 only for leap year)", () => {
      const { start, end } = getWeekDateRange(5, 2, 2024); // February 2024 (leap year)
      expect(start.getUTCDate()).toBe(29);
      expect(end.getUTCDate()).toBe(29);
    });
  });

  describe("getWeekInfo - كل أسبوع 7 أيام بالضبط", () => {
    it("returns week 3 for January 15 (day 15 is in week 3: 15-21)", () => {
      const date = new Date(2026, 0, 15); // January 15, 2026
      const info = getWeekInfo(date);
      expect(info.weekNumber).toBe(3);
      expect(info.month).toBe(1);
      expect(info.year).toBe(2026);
    });

    it("returns week 2 for January 14 (day 14 is in week 2: 8-14)", () => {
      const date = new Date(2026, 0, 14); // January 14, 2026
      const info = getWeekInfo(date);
      expect(info.weekNumber).toBe(2);
      expect(info.month).toBe(1);
      expect(info.year).toBe(2026);
    });

    it("returns week 5 for January 29 (day 29 is in week 5: 29-31)", () => {
      const date = new Date(2026, 0, 29); // January 29, 2026
      const info = getWeekInfo(date);
      expect(info.weekNumber).toBe(5);
      expect(info.month).toBe(1);
      expect(info.year).toBe(2026);
    });
  });

  describe("getTierNameAr", () => {
    it("returns correct Arabic name for each tier", () => {
      expect(getTierNameAr("tier_7")).toBe("المستوى 7");
      expect(getTierNameAr("tier_6")).toBe("المستوى 6");
      expect(getTierNameAr("tier_5")).toBe("المستوى 5");
      expect(getTierNameAr("tier_4")).toBe("المستوى 4");
      expect(getTierNameAr("tier_3")).toBe("المستوى 3");
      expect(getTierNameAr("tier_2")).toBe("المستوى 2");
      expect(getTierNameAr("tier_1")).toBe("المستوى 1");
      expect(getTierNameAr("none")).toBe("غير مؤهل");
    });
  });

  describe("getTierColor", () => {
    it("returns correct color for each tier", () => {
      expect(getTierColor("tier_7")).toBe("purple");
      expect(getTierColor("tier_6")).toBe("indigo");
      expect(getTierColor("tier_5")).toBe("blue");
      expect(getTierColor("tier_4")).toBe("cyan");
      expect(getTierColor("tier_3")).toBe("green");
      expect(getTierColor("tier_2")).toBe("yellow");
      expect(getTierColor("tier_1")).toBe("orange");
      expect(getTierColor("none")).toBe("gray");
    });
  });
});
