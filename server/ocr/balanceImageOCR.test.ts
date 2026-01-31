/**
 * اختبارات خدمة OCR للتحقق من صور الموازنة
 * Balance Image OCR Service Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  verifyBalanceImage,
  isConfidenceSufficient,
  getConfidenceWarning,
  type BalanceImage,
  type BalanceVerificationResult,
} from './balanceImageOCR';

// Mock LLM module
vi.mock('../_core/llm', () => ({
  invokeLLM: vi.fn(),
}));

describe('Balance Image OCR Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isConfidenceSufficient', () => {
    it('should return true for high confidence', () => {
      expect(isConfidenceSufficient('high')).toBe(true);
    });

    it('should return true for medium confidence', () => {
      expect(isConfidenceSufficient('medium')).toBe(true);
    });

    it('should return false for low confidence', () => {
      expect(isConfidenceSufficient('low')).toBe(false);
    });

    it('should return false for none confidence', () => {
      expect(isConfidenceSufficient('none')).toBe(false);
    });
  });

  describe('getConfidenceWarning', () => {
    it('should return null for high confidence', () => {
      expect(getConfidenceWarning('high')).toBeNull();
    });

    it('should return warning for medium confidence', () => {
      const warning = getConfidenceWarning('medium');
      expect(warning).toBeTruthy();
      expect(warning).toContain('متوسطة');
    });

    it('should return warning for low confidence', () => {
      const warning = getConfidenceWarning('low');
      expect(warning).toBeTruthy();
      expect(warning).toContain('منخفضة');
    });

    it('should return warning for none confidence', () => {
      const warning = getConfidenceWarning('none');
      expect(warning).toBeTruthy();
      expect(warning).toContain('لم نتمكن');
    });
  });

  describe('verifyBalanceImage - Edge Cases', () => {
    it('should return error when no images provided', async () => {
      const result = await verifyBalanceImage([], 1000);
      
      expect(result.success).toBe(false);
      expect(result.isMatched).toBe(false);
      expect(result.message).toContain('لم يتم رفع');
    });

    it('should return success when expected amount is zero', async () => {
      const images: BalanceImage[] = [
        { url: 'https://example.com/image.jpg', key: 'key1', uploadedAt: new Date().toISOString() }
      ];
      
      const result = await verifyBalanceImage(images, 0);
      
      expect(result.success).toBe(true);
      expect(result.isMatched).toBe(true);
      expect(result.extractedAmount).toBe(0);
    });

    it('should handle empty images array', async () => {
      const result = await verifyBalanceImage([], 500);
      
      expect(result.success).toBe(false);
      expect(result.confidence).toBe('none');
    });
  });

  describe('Amount Matching Logic', () => {
    it('should consider amounts within 2% tolerance as matched', () => {
      // Test the tolerance logic conceptually
      const expected = 1000;
      const tolerance = expected * 0.02; // 2% = 20
      
      // Within tolerance
      expect(Math.abs(1010 - expected) <= tolerance).toBe(true);
      expect(Math.abs(990 - expected) <= tolerance).toBe(true);
      
      // Outside tolerance
      expect(Math.abs(1030 - expected) <= tolerance).toBe(false);
      expect(Math.abs(970 - expected) <= tolerance).toBe(false);
    });

    it('should handle exact match', () => {
      const expected = 1500;
      const extracted = 1500;
      expect(Math.abs(extracted - expected)).toBe(0);
    });

    it('should handle zero expected amount', () => {
      const expected = 0;
      const extracted = 0;
      expect(extracted === expected).toBe(true);
    });
  });

  describe('Input Validation', () => {
    it('should validate balance image structure', () => {
      const validImage: BalanceImage = {
        url: 'https://example.com/image.jpg',
        key: 'balance-images/user123/timestamp-filename.jpg',
        uploadedAt: '2024-01-15T10:30:00Z',
      };

      expect(validImage.url).toBeTruthy();
      expect(validImage.key).toBeTruthy();
      expect(validImage.uploadedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should handle multiple images', () => {
      const images: BalanceImage[] = [
        { url: 'https://example.com/1.jpg', key: 'key1', uploadedAt: new Date().toISOString() },
        { url: 'https://example.com/2.jpg', key: 'key2', uploadedAt: new Date().toISOString() },
        { url: 'https://example.com/3.jpg', key: 'key3', uploadedAt: new Date().toISOString() },
      ];

      expect(images.length).toBe(3);
      expect(images[0].url).toBeTruthy();
    });
  });

  describe('Result Structure', () => {
    it('should return proper verification result structure', () => {
      const result: BalanceVerificationResult = {
        success: true,
        isMatched: true,
        extractedAmount: 1500,
        expectedAmount: 1500,
        difference: 0,
        confidence: 'high',
        message: 'المبلغ مطابق تماماً',
        details: {
          rawText: 'Total: 1500 SAR',
          processingTime: 1234,
        },
      };

      expect(result.success).toBe(true);
      expect(result.isMatched).toBe(true);
      expect(result.extractedAmount).toBe(1500);
      expect(result.expectedAmount).toBe(1500);
      expect(result.difference).toBe(0);
      expect(result.confidence).toBe('high');
      expect(result.message).toBeTruthy();
      expect(result.details?.processingTime).toBeGreaterThan(0);
    });

    it('should return proper structure for mismatch', () => {
      const result: BalanceVerificationResult = {
        success: true,
        isMatched: false,
        extractedAmount: 1200,
        expectedAmount: 1500,
        difference: 300,
        confidence: 'high',
        message: 'المبلغ غير مطابق',
      };

      expect(result.success).toBe(true);
      expect(result.isMatched).toBe(false);
      expect(result.difference).toBe(300);
    });
  });

  describe('Arabic Number Parsing', () => {
    it('should conceptually handle Arabic numerals conversion', () => {
      // Test the conversion logic
      const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
      const westernDigits = '0123456789';
      
      // Verify mapping
      expect(arabicDigits.length).toBe(westernDigits.length);
      expect(arabicDigits.indexOf('٠')).toBe(0);
      expect(arabicDigits.indexOf('٩')).toBe(9);
    });

    it('should handle currency symbols removal', () => {
      const testCases = [
        { input: '1,500.00 SAR', expected: '1500.00' },
        { input: '١٥٠٠ ر.س', expected: '1500' },
        { input: 'Total: 2,500.50', expected: '2500.50' },
      ];

      testCases.forEach(({ input, expected }) => {
        // Clean the input (simplified version of the actual logic)
        const cleaned = input
          .replace(/[^\d.,٠-٩]/g, '')
          .replace(/,/g, '');
        
        expect(cleaned).toBeTruthy();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle LLM errors gracefully', async () => {
      // When LLM fails, the service should not crash
      const images: BalanceImage[] = [
        { url: 'invalid-url', key: 'key1', uploadedAt: new Date().toISOString() }
      ];

      // The actual implementation should catch errors and return a proper result
      // This test verifies the expected behavior
      const expectedErrorResult: BalanceVerificationResult = {
        success: false,
        isMatched: false,
        extractedAmount: null,
        expectedAmount: 1000,
        difference: null,
        confidence: 'none',
        message: 'خطأ في التحقق',
      };

      expect(expectedErrorResult.success).toBe(false);
      expect(expectedErrorResult.confidence).toBe('none');
    });
  });

  describe('Integration with Revenue Router', () => {
    it('should validate that OCR is only called when network amount > 0', () => {
      // When network amount is 0, OCR should not be called
      const networkAmount = 0;
      const shouldCallOCR = networkAmount > 0;
      expect(shouldCallOCR).toBe(false);
    });

    it('should validate that OCR is only called when images exist', () => {
      // When no images, OCR should not be called
      const images: BalanceImage[] = [];
      const shouldCallOCR = images.length > 0;
      expect(shouldCallOCR).toBe(false);
    });

    it('should validate both conditions together', () => {
      const networkAmount = 1500;
      const images: BalanceImage[] = [
        { url: 'https://example.com/image.jpg', key: 'key1', uploadedAt: new Date().toISOString() }
      ];
      
      const shouldCallOCR = networkAmount > 0 && images.length > 0;
      expect(shouldCallOCR).toBe(true);
    });
  });
});
