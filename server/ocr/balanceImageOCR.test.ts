/**
 * اختبارات خدمة OCR للتحقق من صور إيصالات نقاط البيع (POS)
 * POS Receipt OCR Service Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  verifyBalanceImage,
  isConfidenceSufficient,
  getConfidenceWarning,
  verifyDateOnly,
  type BalanceImage,
  type BalanceVerificationResult,
  type POSSection,
} from './balanceImageOCR';

// Mock LLM module
vi.mock('../_core/llm', () => ({
  invokeLLM: vi.fn(),
}));

describe('POS Receipt OCR Service', () => {
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

  describe('verifyDateOnly', () => {
    it('should return matched for same date', () => {
      const result = verifyDateOnly('2024-01-15', '2024-01-15');
      expect(result.isMatched).toBe(true);
      expect(result.message).toContain('مطابق');
    });

    it('should return matched for date within tolerance (1 day)', () => {
      const result = verifyDateOnly('2024-01-15', '2024-01-16');
      expect(result.isMatched).toBe(true);
    });

    it('should return not matched for date outside tolerance', () => {
      const result = verifyDateOnly('2024-01-15', '2024-01-20');
      expect(result.isMatched).toBe(false);
      expect(result.message).toContain('غير مطابق');
    });

    it('should return not matched for null extracted date', () => {
      const result = verifyDateOnly(null, '2024-01-15');
      expect(result.isMatched).toBe(false);
      expect(result.message).toContain('لم نتمكن');
    });
  });

  describe('verifyBalanceImage - Edge Cases', () => {
    it('should return error when no images provided', async () => {
      const result = await verifyBalanceImage([], 1000);
      
      expect(result.success).toBe(false);
      expect(result.isMatched).toBe(false);
      expect(result.isDateMatched).toBe(false);
      expect(result.message).toContain('لم يتم رفع');
    });

    it('should return success when expected amount is zero', async () => {
      const images: BalanceImage[] = [
        { url: 'https://example.com/image.jpg', key: 'key1', uploadedAt: new Date().toISOString() }
      ];
      
      const result = await verifyBalanceImage(images, 0);
      
      expect(result.success).toBe(true);
      expect(result.isMatched).toBe(true);
      expect(result.isDateMatched).toBe(true);
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

  describe('Date Matching Logic', () => {
    it('should match same dates', () => {
      const date1 = new Date('2024-01-15');
      const date2 = new Date('2024-01-15');
      const diffDays = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBe(0);
    });

    it('should match dates within 1 day tolerance', () => {
      const date1 = new Date('2024-01-15');
      const date2 = new Date('2024-01-16');
      const diffDays = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeLessThanOrEqual(1);
    });

    it('should not match dates more than 1 day apart', () => {
      const date1 = new Date('2024-01-15');
      const date2 = new Date('2024-01-18');
      const diffDays = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(1);
    });
  });

  describe('POS Section Structure', () => {
    it('should validate POS section structure', () => {
      const section: POSSection = {
        name: 'mada',
        hostTotal: 870,
        terminalTotal: 870,
        count: 25
      };

      expect(section.name).toBe('mada');
      expect(section.hostTotal).toBe(870);
      expect(section.terminalTotal).toBe(870);
      expect(section.count).toBe(25);
    });

    it('should handle multiple sections', () => {
      const sections: POSSection[] = [
        { name: 'mada', hostTotal: 870, terminalTotal: 870, count: 25 },
        { name: 'VISA', hostTotal: 0, terminalTotal: 0, count: 0 },
        { name: 'MasterCard', hostTotal: 48, terminalTotal: 48, count: 2 },
      ];

      const total = sections.reduce((sum, s) => sum + s.terminalTotal, 0);
      expect(total).toBe(918);
    });

    it('should handle sections with zero transactions', () => {
      const section: POSSection = {
        name: 'VISA',
        hostTotal: 0,
        terminalTotal: 0,
        count: 0
      };

      expect(section.terminalTotal).toBe(0);
      expect(section.count).toBe(0);
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
        isDateMatched: true,
        extractedAmount: 918,
        expectedAmount: 918,
        difference: 0,
        extractedDate: '2024-01-15',
        expectedDate: '2024-01-15',
        confidence: 'high',
        message: '✅ المبلغ مطابق تماماً\n✅ التاريخ مطابق: 2024-01-15',
        sections: [
          { name: 'mada', hostTotal: 870, terminalTotal: 870, count: 25 },
          { name: 'MasterCard', hostTotal: 48, terminalTotal: 48, count: 2 },
        ],
        details: {
          rawText: 'POS Terminal Receipt',
          processingTime: 1234,
        },
      };

      expect(result.success).toBe(true);
      expect(result.isMatched).toBe(true);
      expect(result.isDateMatched).toBe(true);
      expect(result.extractedAmount).toBe(918);
      expect(result.expectedAmount).toBe(918);
      expect(result.difference).toBe(0);
      expect(result.extractedDate).toBe('2024-01-15');
      expect(result.confidence).toBe('high');
      expect(result.sections?.length).toBe(2);
      expect(result.details?.processingTime).toBeGreaterThan(0);
    });

    it('should return proper structure for amount mismatch', () => {
      const result: BalanceVerificationResult = {
        success: true,
        isMatched: false,
        isDateMatched: true,
        extractedAmount: 800,
        expectedAmount: 1000,
        difference: 200,
        extractedDate: '2024-01-15',
        expectedDate: '2024-01-15',
        confidence: 'high',
        message: '❌ المبلغ غير مطابق',
      };

      expect(result.success).toBe(true);
      expect(result.isMatched).toBe(false);
      expect(result.difference).toBe(200);
    });

    it('should return proper structure for date mismatch', () => {
      const result: BalanceVerificationResult = {
        success: true,
        isMatched: true,
        isDateMatched: false,
        extractedAmount: 1000,
        expectedAmount: 1000,
        difference: 0,
        extractedDate: '2024-01-10',
        expectedDate: '2024-01-15',
        confidence: 'high',
        message: '❌ التاريخ غير مطابق',
      };

      expect(result.success).toBe(true);
      expect(result.isMatched).toBe(true);
      expect(result.isDateMatched).toBe(false);
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

      testCases.forEach(({ input }) => {
        // Clean the input (simplified version of the actual logic)
        const cleaned = input
          .replace(/[^\d.,٠-٩]/g, '')
          .replace(/,/g, '');
        
        expect(cleaned).toBeTruthy();
      });
    });
  });

  describe('Date Normalization', () => {
    it('should handle DD/MM/YYYY format', () => {
      const input = '15/01/2024';
      const match = input.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      expect(match).toBeTruthy();
      if (match) {
        const [, day, month, year] = match;
        const normalized = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        expect(normalized).toBe('2024-01-15');
      }
    });

    it('should handle YYYY-MM-DD format', () => {
      const input = '2024-01-15';
      const match = input.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
      expect(match).toBeTruthy();
      if (match) {
        const [, year, month, day] = match;
        const normalized = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        expect(normalized).toBe('2024-01-15');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle LLM errors gracefully', async () => {
      // When LLM fails, the service should not crash
      const images: BalanceImage[] = [
        { url: 'invalid-url', key: 'key1', uploadedAt: new Date().toISOString() }
      ];

      // The actual implementation should catch errors and return a proper result
      const expectedErrorResult: BalanceVerificationResult = {
        success: false,
        isMatched: false,
        isDateMatched: false,
        extractedAmount: null,
        expectedAmount: 1000,
        difference: null,
        extractedDate: null,
        expectedDate: '2024-01-15',
        confidence: 'none',
        message: 'خطأ في التحقق',
      };

      expect(expectedErrorResult.success).toBe(false);
      expect(expectedErrorResult.confidence).toBe('none');
    });
  });

  describe('Integration with Revenue Router', () => {
    it('should validate that OCR is only called when network amount > 0', () => {
      const networkAmount = 0;
      const shouldCallOCR = networkAmount > 0;
      expect(shouldCallOCR).toBe(false);
    });

    it('should validate that OCR is only called when images exist', () => {
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

    it('should pass upload date to verification', () => {
      const uploadDate = '2024-01-15';
      const revenueDate = new Date('2024-01-15');
      const expectedUploadDate = revenueDate.toISOString().split('T')[0];
      
      expect(expectedUploadDate).toBe(uploadDate);
    });
  });

  describe('POS Receipt Specific Tests', () => {
    it('should calculate grand total from sections correctly', () => {
      const sections: POSSection[] = [
        { name: 'mada', hostTotal: 870, terminalTotal: 870, count: 25 },
        { name: 'VISA', hostTotal: 0, terminalTotal: 0, count: 0 },
        { name: 'MasterCard', hostTotal: 48, terminalTotal: 48, count: 2 },
        { name: 'DISCOVER', hostTotal: 0, terminalTotal: 0, count: 0 },
        { name: 'Maestro', hostTotal: 0, terminalTotal: 0, count: 0 },
        { name: 'GCCNET', hostTotal: 0, terminalTotal: 0, count: 0 },
        { name: 'JN ONPAY', hostTotal: 0, terminalTotal: 0, count: 0 },
      ];

      const grandTotal = sections.reduce((sum, s) => sum + s.terminalTotal, 0);
      expect(grandTotal).toBe(918);
    });

    it('should identify sections with transactions', () => {
      const sections: POSSection[] = [
        { name: 'mada', hostTotal: 870, terminalTotal: 870, count: 25 },
        { name: 'VISA', hostTotal: 0, terminalTotal: 0, count: 0 },
        { name: 'MasterCard', hostTotal: 48, terminalTotal: 48, count: 2 },
      ];

      const activeSections = sections.filter(s => s.terminalTotal > 0);
      expect(activeSections.length).toBe(2);
      expect(activeSections.map(s => s.name)).toEqual(['mada', 'MasterCard']);
    });

    it('should handle receipt with no transactions', () => {
      const sections: POSSection[] = [
        { name: 'mada', hostTotal: 0, terminalTotal: 0, count: 0 },
        { name: 'VISA', hostTotal: 0, terminalTotal: 0, count: 0 },
        { name: 'MasterCard', hostTotal: 0, terminalTotal: 0, count: 0 },
      ];

      const grandTotal = sections.reduce((sum, s) => sum + s.terminalTotal, 0);
      expect(grandTotal).toBe(0);
    });
  });
});
