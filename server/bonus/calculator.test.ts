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
    it("returns tier_5 with 180 SAR for revenue >= 2400", () => {
      const result = calculateBonus(2400);
      expect(result.tier).toBe("tier_5");
      expect(result.amount).toBe(180);
      expect(result.isEligible).toBe(true);
    });

    it("returns tier_5 for revenue above 2400", () => {
      const result = calculateBonus(3000);
      expect(result.tier).toBe("tier_5");
      expect(result.amount).toBe(180);
    });

    it("returns tier_4 with 135 SAR for revenue 2100-2399", () => {
      const result = calculateBonus(2100);
      expect(result.tier).toBe("tier_4");
      expect(result.amount).toBe(135);
      expect(result.isEligible).toBe(true);
    });

    it("returns tier_4 for revenue 2399", () => {
      const result = calculateBonus(2399);
      expect(result.tier).toBe("tier_4");
      expect(result.amount).toBe(135);
    });

    it("returns tier_3 with 95 SAR for revenue 1800-2099", () => {
      const result = calculateBonus(1800);
      expect(result.tier).toBe("tier_3");
      expect(result.amount).toBe(95);
      expect(result.isEligible).toBe(true);
    });

    it("returns tier_2 with 60 SAR for revenue 1500-1799", () => {
      const result = calculateBonus(1500);
      expect(result.tier).toBe("tier_2");
      expect(result.amount).toBe(60);
      expect(result.isEligible).toBe(true);
    });

    it("returns tier_1 with 35 SAR for revenue 1200-1499", () => {
      const result = calculateBonus(1200);
      expect(result.tier).toBe("tier_1");
      expect(result.amount).toBe(35);
      expect(result.isEligible).toBe(true);
    });

    it("returns none with 0 SAR for revenue < 1200", () => {
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
      expect(getTierColor("tier_5")).toBe("purple");
      expect(getTierColor("tier_4")).toBe("blue");
      expect(getTierColor("tier_3")).toBe("green");
      expect(getTierColor("tier_2")).toBe("yellow");
      expect(getTierColor("tier_1")).toBe("orange");
      expect(getTierColor("none")).toBe("gray");
    });
  });
});
