import { describe, it, expect } from "vitest";
import {
  amountToArabicWords,
  amountToEnglishWords,
  integerToArabicWords,
  formatVoucherNumber,
  parseVoucherSequence,
  splitPaymentTotal,
  derivePaymentMethod,
} from "../shared/vouchers";

describe("amountToArabicWords", () => {
  it("writes common salary amounts", () => {
    expect(amountToArabicWords(2000)).toBe("فقط ألفان ريال سعودي لا غير");
    expect(amountToArabicWords(1500)).toBe("فقط ألف وخمسمائة ريال سعودي لا غير");
    expect(amountToArabicWords(500)).toBe("فقط خمسمائة ريال سعودي لا غير");
  });
  it("handles zero, negative and invalid amounts", () => {
    expect(amountToArabicWords(0)).toBe("فقط صفر ريال سعودي لا غير");
    expect(amountToArabicWords(-250)).toBe("فقط مائتان وخمسون ريال سعودي لا غير");
    expect(amountToArabicWords(NaN)).toBe("فقط صفر ريال سعودي لا غير");
    expect(amountToArabicWords(undefined as any)).toBe("فقط صفر ريال سعودي لا غير");
    expect(amountToEnglishWords(null as any)).toBe("Zero Saudi Riyals Only");
  });
  it("handles halalas", () => {
    expect(amountToArabicWords(10.5)).toBe("فقط عشرة ريال سعودي وخمسون هللة لا غير");
  });
  it("handles thousands grammar", () => {
    expect(integerToArabicWords(3000)).toBe("ثلاثة آلاف");
    expect(integerToArabicWords(11000)).toBe("أحد عشر ألف");
    expect(integerToArabicWords(125250)).toBe("مائة وخمسة وعشرون ألف ومائتان وخمسون");
    expect(integerToArabicWords(0)).toBe("صفر");
  });
});

describe("amountToEnglishWords", () => {
  it("writes english amounts", () => {
    expect(amountToEnglishWords(2000)).toBe("Two Thousand Saudi Riyals Only");
    expect(amountToEnglishWords(1525.25)).toBe("One Thousand Five Hundred Twenty-Five Saudi Riyals and Twenty-Five Halalas Only");
  });
});

describe("voucher numbering and payment split", () => {
  it("formats and parses voucher numbers", () => {
    expect(formatVoucherNumber("payment", 2026, 7)).toBe("PV-2026-0007");
    expect(formatVoucherNumber("receipt", 2026, 12)).toBe("RV-2026-0012");
    expect(parseVoucherSequence("RV-2026-003")).toBe(3);
    expect(parseVoucherSequence("garbage")).toBe(0);
  });
  it("sums split payments and derives the method", () => {
    expect(splitPaymentTotal({ cashAmount: 500, bankAmount: 1500 })).toBe(2000);
    expect(derivePaymentMethod({ cashAmount: 500, bankAmount: 1500 })).toBe("mixed");
    expect(derivePaymentMethod({ checkAmount: 100 })).toBe("check");
    expect(derivePaymentMethod({})).toBeNull();
  });
});
