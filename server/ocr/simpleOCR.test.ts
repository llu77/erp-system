/**
 * اختبارات نظام OCR المبسط
 * Simple OCR System Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readReceiptImage, verifyReceiptSimple, type SimpleOCRResult } from "./simpleOCR";

// Mock للـ LLM
vi.mock("../_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          date: "2026-02-01",
          grandTotal: 5000,
          sections: [
            { name: "mada", total: 3000, count: 5 },
            { name: "VISA", total: 2000, count: 3 }
          ],
          rawText: "إيصال موازنة يومية"
        })
      }
    }]
  })
}));

// Mock للـ storage
vi.mock("../storage", () => ({
  storageGet: vi.fn().mockResolvedValue({
    url: "https://example.com/fresh-image.jpg",
    key: "test-key"
  })
}));

// Mock للـ fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("SimpleOCR", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock fetch لإرجاع صورة وهمية
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
      headers: new Map([["content-type", "image/jpeg"]])
    });
  });

  describe("readReceiptImage", () => {
    it("يجب أن يقبل صورة base64 مباشرة", async () => {
      const base64Image = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
      
      const result = await readReceiptImage(base64Image);
      
      expect(result.success).toBe(true);
      expect(result.data.grandTotal).toBe(5000);
      expect(result.data.date).toBe("2026-02-01");
      expect(result.data.sections).toHaveLength(2);
    });

    it("يجب أن يقبل رابط HTTP ويحوله إلى base64", async () => {
      const result = await readReceiptImage("https://example.com/image.jpg");
      
      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalled();
    });

    it("يجب أن يتعامل مع رابط منتهي الصلاحية (403) ويجدده", async () => {
      // أول محاولة تفشل بـ 403
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 403
        })
        // المحاولة الثانية بالرابط الجديد تنجح
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
          headers: new Map([["content-type", "image/jpeg"]])
        });

      const result = await readReceiptImage(
        "https://old-url.com/image.jpg",
        "receipts/image.jpg" // s3Key
      );

      expect(result.success).toBe(true);
    });

    it("يجب أن يعيد خطأ عند فشل تحميل الصورة", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500
      });

      const result = await readReceiptImage("https://example.com/image.jpg");

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("verifyReceiptSimple", () => {
    it("يجب أن يتحقق من تطابق المبلغ", async () => {
      const result = await verifyReceiptSimple(
        "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
        5000 // المبلغ المتوقع
      );

      expect(result.success).toBe(true);
      expect(result.isMatched).toBe(true);
      expect(result.extractedAmount).toBe(5000);
      expect(result.difference).toBe(0);
    });

    it("يجب أن يكتشف الفرق في المبلغ", async () => {
      const result = await verifyReceiptSimple(
        "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
        6000 // مبلغ مختلف
      );

      expect(result.success).toBe(true);
      expect(result.isMatched).toBe(false);
      expect(result.difference).toBe(1000);
    });

    it("يجب أن يقبل فرق ضمن نسبة التسامح (2%)", async () => {
      const result = await verifyReceiptSimple(
        "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
        5050 // فرق 50 ريال = 1% من 5000
      );

      expect(result.success).toBe(true);
      expect(result.isMatched).toBe(true); // 1% أقل من 2%
    });
  });

  describe("SimpleOCRResult", () => {
    it("يجب أن يحتوي على جميع الحقول المطلوبة", async () => {
      const result = await readReceiptImage("data:image/jpeg;base64,test");

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("confidence");
      expect(result).toHaveProperty("processingTime");
      
      expect(result.data).toHaveProperty("date");
      expect(result.data).toHaveProperty("grandTotal");
      expect(result.data).toHaveProperty("sections");
      expect(result.data).toHaveProperty("rawText");
    });
  });
});
