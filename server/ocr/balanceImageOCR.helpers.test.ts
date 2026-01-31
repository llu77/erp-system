/**
 * اختبارات شاملة للدوال المساعدة في خدمة OCR
 * Comprehensive Unit Tests for OCR Helper Functions
 * 
 * هذه الاختبارات تغطي الفجوات المكتشفة في التغطية الاختبارية:
 * - parseExtractedAmount
 * - normalizeDate
 * - amountsMatch
 * - datesMatch
 * - determineConfidence
 * - generateWarnings
 * - getUploadDate
 */

import { describe, it, expect } from 'vitest';
import {
  parseExtractedAmount,
  normalizeDate,
  datesMatch,
  amountsMatch,
  determineConfidence,
  generateWarnings,
  getUploadDate,
  AMOUNT_TOLERANCE_PERCENTAGE,
  DATE_TOLERANCE_DAYS,
  type OCRExtractionResult,
} from './balanceImageOCR';

// ==================== parseExtractedAmount Tests ====================
describe('parseExtractedAmount', () => {
  describe('Basic Number Parsing', () => {
    it('should parse simple integer', () => {
      expect(parseExtractedAmount('1000')).toBe(1000);
    });

    it('should parse decimal number', () => {
      expect(parseExtractedAmount('1500.50')).toBe(1500.50);
    });

    it('should parse number with commas', () => {
      expect(parseExtractedAmount('1,500.00')).toBe(1500);
    });

    it('should parse number with multiple commas', () => {
      expect(parseExtractedAmount('1,234,567.89')).toBe(1234567.89);
    });

    it('should parse zero', () => {
      expect(parseExtractedAmount('0')).toBe(0);
    });

    it('should parse small decimal', () => {
      expect(parseExtractedAmount('0.01')).toBe(0.01);
    });
  });

  describe('Arabic Number Conversion', () => {
    it('should convert Arabic numerals to Western', () => {
      expect(parseExtractedAmount('١٥٠٠')).toBe(1500);
    });

    it('should convert mixed Arabic and Western numerals', () => {
      expect(parseExtractedAmount('١500')).toBe(1500);
    });

    it('should handle Arabic decimal point', () => {
      expect(parseExtractedAmount('١٥٠٠.٥٠')).toBe(1500.50);
    });

    it('should convert all Arabic digits correctly', () => {
      expect(parseExtractedAmount('٠١٢٣٤٥٦٧٨٩')).toBe(123456789);
    });
  });

  describe('Currency Symbol Removal', () => {
    it('should remove SAR suffix', () => {
      expect(parseExtractedAmount('1500 SAR')).toBe(1500);
    });

    it('should remove Arabic Riyal symbol', () => {
      expect(parseExtractedAmount('1500 ر.س')).toBe(1500);
    });

    it('should remove currency prefix', () => {
      expect(parseExtractedAmount('SAR 1500')).toBe(1500);
    });

    it('should handle "Total:" prefix', () => {
      expect(parseExtractedAmount('Total: 2,500.50')).toBe(2500.50);
    });

    it('should handle complex text with numbers', () => {
      expect(parseExtractedAmount('المجموع: 1,500.00 ريال')).toBe(1500);
    });
  });

  describe('Edge Cases', () => {
    it('should return null for null input', () => {
      expect(parseExtractedAmount(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(parseExtractedAmount(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseExtractedAmount('')).toBeNull();
    });

    it('should return null for non-numeric string', () => {
      expect(parseExtractedAmount('abc')).toBeNull();
    });

    it('should handle whitespace only', () => {
      expect(parseExtractedAmount('   ')).toBeNull();
    });

    it('should handle multiple decimal points', () => {
      // Should take last decimal point
      const result = parseExtractedAmount('1.500.00');
      expect(result).toBe(1500);
    });

    it('should handle negative numbers', () => {
      // Current implementation strips negative sign
      expect(parseExtractedAmount('-1500')).toBe(1500);
    });

    it('should handle very large numbers', () => {
      expect(parseExtractedAmount('999999999.99')).toBe(999999999.99);
    });

    it('should handle very small decimals', () => {
      expect(parseExtractedAmount('0.001')).toBe(0.001);
    });
  });

  describe('Real-world POS Receipt Values', () => {
    it('should parse typical mada total', () => {
      expect(parseExtractedAmount('870.00')).toBe(870);
    });

    it('should parse typical VISA total', () => {
      expect(parseExtractedAmount('48.00')).toBe(48);
    });

    it('should parse grand total with formatting', () => {
      expect(parseExtractedAmount('918.00 SAR')).toBe(918);
    });
  });
});

// ==================== normalizeDate Tests ====================
describe('normalizeDate', () => {
  describe('DD/MM/YYYY Format', () => {
    it('should normalize DD/MM/YYYY', () => {
      expect(normalizeDate('15/01/2024')).toBe('2024-01-15');
    });

    it('should normalize D/M/YYYY', () => {
      expect(normalizeDate('5/1/2024')).toBe('2024-01-05');
    });

    it('should normalize DD-MM-YYYY', () => {
      expect(normalizeDate('15-01-2024')).toBe('2024-01-15');
    });
  });

  describe('YYYY-MM-DD Format', () => {
    it('should pass through YYYY-MM-DD', () => {
      expect(normalizeDate('2024-01-15')).toBe('2024-01-15');
    });

    it('should normalize YYYY/MM/DD', () => {
      expect(normalizeDate('2024/01/15')).toBe('2024-01-15');
    });

    it('should normalize YYYY-M-D', () => {
      expect(normalizeDate('2024-1-5')).toBe('2024-01-05');
    });
  });

  describe('Edge Cases', () => {
    it('should return null for null input', () => {
      expect(normalizeDate(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(normalizeDate(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(normalizeDate('')).toBeNull();
    });

    it('should return null for invalid date string', () => {
      expect(normalizeDate('not a date')).toBeNull();
    });

    it('should handle date with extra whitespace', () => {
      expect(normalizeDate('  2024-01-15  ')).toBe('2024-01-15');
    });
  });

  describe('ISO Date String', () => {
    it('should handle ISO date string', () => {
      expect(normalizeDate('2024-01-15T10:30:00Z')).toBe('2024-01-15');
    });

    it('should handle ISO date with timezone', () => {
      expect(normalizeDate('2024-01-15T10:30:00+03:00')).toBe('2024-01-15');
    });
  });

  describe('Month Boundaries', () => {
    it('should handle end of month', () => {
      expect(normalizeDate('31/01/2024')).toBe('2024-01-31');
    });

    it('should handle February 29 in leap year', () => {
      expect(normalizeDate('29/02/2024')).toBe('2024-02-29');
    });

    it('should handle December 31', () => {
      expect(normalizeDate('31/12/2024')).toBe('2024-12-31');
    });
  });
});

// ==================== amountsMatch Tests ====================
describe('amountsMatch', () => {
  describe('Exact Match', () => {
    it('should return true for exact match', () => {
      expect(amountsMatch(1000, 1000)).toBe(true);
    });

    it('should return true for zero match', () => {
      expect(amountsMatch(0, 0)).toBe(true);
    });
  });

  describe('Within Tolerance (2%)', () => {
    it('should return true for 1% difference', () => {
      // 1000 * 0.02 = 20 tolerance, 1010 - 1000 = 10 < 20
      expect(amountsMatch(1010, 1000)).toBe(true);
    });

    it('should return true for exactly 2% difference', () => {
      // 1000 * 0.02 = 20 tolerance, 1020 - 1000 = 20 <= 20
      expect(amountsMatch(1020, 1000)).toBe(true);
    });

    it('should return true for negative difference within tolerance', () => {
      // 1000 * 0.02 = 20 tolerance, |990 - 1000| = 10 <= 20
      expect(amountsMatch(990, 1000)).toBe(true);
    });

    it('should return true for exactly -2% difference', () => {
      // 1000 * 0.02 = 20 tolerance, |980 - 1000| = 20 <= 20
      expect(amountsMatch(980, 1000)).toBe(true);
    });
  });

  describe('Outside Tolerance', () => {
    it('should return false for >2% difference', () => {
      // 1000 * 0.02 = 20 tolerance, 1030 - 1000 = 30 > 20
      expect(amountsMatch(1030, 1000)).toBe(false);
    });

    it('should return false for <-2% difference', () => {
      // 1000 * 0.02 = 20 tolerance, |970 - 1000| = 30 > 20
      expect(amountsMatch(970, 1000)).toBe(false);
    });
  });

  describe('Zero Expected Amount', () => {
    it('should return true when both are zero', () => {
      expect(amountsMatch(0, 0)).toBe(true);
    });

    it('should return false when expected is zero but extracted is not', () => {
      expect(amountsMatch(100, 0)).toBe(false);
    });
  });

  describe('Custom Tolerance', () => {
    it('should use custom tolerance percentage', () => {
      // 1000 * 0.05 = 50 tolerance
      expect(amountsMatch(1040, 1000, 0.05)).toBe(true);
      expect(amountsMatch(1060, 1000, 0.05)).toBe(false);
    });

    it('should handle 0% tolerance', () => {
      expect(amountsMatch(1000, 1000, 0)).toBe(true);
      expect(amountsMatch(1001, 1000, 0)).toBe(false);
    });
  });

  describe('Large Amounts (Graduated Tolerance)', () => {
    it('should use 1% tolerance for amounts > 10000', () => {
      // 100000 * 0.01 = 1000 tolerance (النظام المتدرج الجديد)
      expect(amountsMatch(100500, 100000)).toBe(true);  // داخل 1%
      expect(amountsMatch(101000, 100000)).toBe(true);  // على الحد
      expect(amountsMatch(101500, 100000)).toBe(false); // خارج 1%
    });
  });

  describe('Small Amounts (Graduated Tolerance)', () => {
    it('should use 3% tolerance for amounts < 500', () => {
      // 100 * 0.03 = 3 tolerance (النظام المتدرج الجديد)
      expect(amountsMatch(101, 100)).toBe(true);  // داخل 3%
      expect(amountsMatch(103, 100)).toBe(true);  // على الحد
      expect(amountsMatch(104, 100)).toBe(false); // خارج 3%
    });
  });

  describe('Medium Amounts (Graduated Tolerance)', () => {
    it('should use 2.5% tolerance for amounts 500-2000', () => {
      // 1000 * 0.025 = 25 tolerance
      expect(amountsMatch(1020, 1000)).toBe(true);  // داخل 2.5%
      expect(amountsMatch(1025, 1000)).toBe(true);  // على الحد
      expect(amountsMatch(1030, 1000)).toBe(false); // خارج 2.5%
    });
  });

  describe('Decimal Amounts', () => {
    it('should handle decimal amounts with graduated tolerance', () => {
      // 1500.50 * 0.025 = 37.51 tolerance (لأن 1500.50 في نطاق 500-2000)
      expect(amountsMatch(1520.50, 1500.50)).toBe(true);  // داخل 2.5%
      expect(amountsMatch(1538.00, 1500.50)).toBe(true);  // على الحد تقريباً
      expect(amountsMatch(1545.50, 1500.50)).toBe(false); // خارج 2.5%
    });
  });
});

// ==================== datesMatch Tests ====================
describe('datesMatch', () => {
  describe('Exact Match', () => {
    it('should return true for same date', () => {
      expect(datesMatch('2024-01-15', '2024-01-15')).toBe(true);
    });
  });

  describe('Within Tolerance (1 day)', () => {
    it('should return true for 1 day difference (future)', () => {
      expect(datesMatch('2024-01-16', '2024-01-15')).toBe(true);
    });

    it('should return true for 1 day difference (past)', () => {
      expect(datesMatch('2024-01-14', '2024-01-15')).toBe(true);
    });
  });

  describe('Outside Tolerance', () => {
    it('should return false for 2 days difference', () => {
      expect(datesMatch('2024-01-17', '2024-01-15')).toBe(false);
    });

    it('should return false for 5 days difference', () => {
      expect(datesMatch('2024-01-20', '2024-01-15')).toBe(false);
    });
  });

  describe('Null Extracted Date', () => {
    it('should return false for null extracted date', () => {
      expect(datesMatch(null, '2024-01-15')).toBe(false);
    });
  });

  describe('Custom Tolerance', () => {
    it('should use custom tolerance', () => {
      expect(datesMatch('2024-01-18', '2024-01-15', 3)).toBe(true);
      expect(datesMatch('2024-01-20', '2024-01-15', 3)).toBe(false);
    });

    it('should handle 0 day tolerance', () => {
      expect(datesMatch('2024-01-15', '2024-01-15', 0)).toBe(true);
      expect(datesMatch('2024-01-16', '2024-01-15', 0)).toBe(false);
    });
  });

  describe('Month Boundaries', () => {
    it('should handle month boundary', () => {
      expect(datesMatch('2024-02-01', '2024-01-31')).toBe(true);
    });

    it('should handle year boundary', () => {
      expect(datesMatch('2024-01-01', '2023-12-31')).toBe(true);
    });
  });

  describe('Invalid Dates', () => {
    it('should return false for invalid extracted date', () => {
      expect(datesMatch('invalid', '2024-01-15')).toBe(false);
    });
  });
});

// ==================== determineConfidence Tests ====================
describe('determineConfidence', () => {
  describe('Explicit Confidence Levels', () => {
    it('should return high for "high"', () => {
      expect(determineConfidence('high', 1000)).toBe('high');
    });

    it('should return high for "عالي"', () => {
      expect(determineConfidence('عالي', 1000)).toBe('high');
    });

    it('should return medium for "medium"', () => {
      expect(determineConfidence('medium', 1000)).toBe('medium');
    });

    it('should return medium for "متوسط"', () => {
      expect(determineConfidence('متوسط', 1000)).toBe('medium');
    });

    it('should return low for "low"', () => {
      expect(determineConfidence('low', 1000)).toBe('low');
    });

    it('should return low for "منخفض"', () => {
      expect(determineConfidence('منخفض', 1000)).toBe('low');
    });
  });

  describe('Case Insensitivity', () => {
    it('should handle uppercase HIGH', () => {
      expect(determineConfidence('HIGH', 1000)).toBe('high');
    });

    it('should handle mixed case Medium', () => {
      expect(determineConfidence('Medium', 1000)).toBe('medium');
    });
  });

  describe('Null Amount', () => {
    it('should return none for null amount', () => {
      expect(determineConfidence('high', null)).toBe('none');
    });
  });

  describe('Undefined/Empty Confidence', () => {
    it('should return medium for undefined confidence with valid amount', () => {
      expect(determineConfidence(undefined, 1000)).toBe('medium');
    });

    it('should return medium for empty string with valid amount', () => {
      expect(determineConfidence('', 1000)).toBe('medium');
    });
  });

  describe('Partial Match', () => {
    it('should match "high confidence" string', () => {
      expect(determineConfidence('high confidence level', 1000)).toBe('high');
    });

    it('should match "confidence: medium" string', () => {
      expect(determineConfidence('confidence: medium', 1000)).toBe('medium');
    });
  });
});

// ==================== getUploadDate Tests ====================
describe('getUploadDate', () => {
  describe('Valid ISO Strings', () => {
    it('should extract date from ISO string', () => {
      expect(getUploadDate('2024-01-15T10:30:00Z')).toBe('2024-01-15');
    });

    it('should extract date from ISO string with timezone', () => {
      expect(getUploadDate('2024-01-15T10:30:00+03:00')).toBe('2024-01-15');
    });

    it('should extract date from ISO string with milliseconds', () => {
      expect(getUploadDate('2024-01-15T10:30:00.123Z')).toBe('2024-01-15');
    });
  });

  describe('Invalid Input', () => {
    it('should return current date for invalid string', () => {
      const result = getUploadDate('invalid');
      const today = new Date().toISOString().split('T')[0];
      expect(result).toBe(today);
    });

    it('should return current date for empty string', () => {
      const result = getUploadDate('');
      const today = new Date().toISOString().split('T')[0];
      expect(result).toBe(today);
    });
  });
});

// ==================== generateWarnings Tests ====================
describe('generateWarnings', () => {
  const createExtractionResult = (overrides: Partial<OCRExtractionResult> = {}): OCRExtractionResult => ({
    success: true,
    extractedAmount: 1000,
    extractedDate: '2024-01-15',
    sections: [
      { name: 'mada', hostTotal: 700, terminalTotal: 700, count: 20 },
      { name: 'VISA', hostTotal: 200, terminalTotal: 200, count: 5 },
      { name: 'MasterCard', hostTotal: 100, terminalTotal: 100, count: 3 },
    ],
    grandTotal: 1000,
    confidence: 'high',
    rawText: 'POS Receipt',
    ...overrides,
  });

  describe('No Warnings for Perfect Match', () => {
    it('should return empty array when everything matches', () => {
      const result = createExtractionResult();
      const warnings = generateWarnings(
        result,
        true, // isAmountMatched
        true, // isDateMatched
        '2024-01-15',
        '2024-01-15',
        1000,
        1000
      );
      expect(warnings).toHaveLength(0);
    });
  });

  describe('No Date Warning', () => {
    it('should generate no_date warning when date is null', () => {
      const result = createExtractionResult({ extractedDate: null });
      const warnings = generateWarnings(
        result,
        true,
        false,
        null,
        '2024-01-15',
        1000,
        1000
      );
      expect(warnings.some(w => w.type === 'no_date')).toBe(true);
      expect(warnings.find(w => w.type === 'no_date')?.severity).toBe('warning');
    });
  });

  describe('Date Mismatch Warning', () => {
    it('should generate date_mismatch warning when dates do not match', () => {
      const result = createExtractionResult();
      const warnings = generateWarnings(
        result,
        true,
        false,
        '2024-01-10',
        '2024-01-15',
        1000,
        1000
      );
      expect(warnings.some(w => w.type === 'date_mismatch')).toBe(true);
      expect(warnings.find(w => w.type === 'date_mismatch')?.severity).toBe('error');
    });
  });

  describe('Amount Mismatch Warning', () => {
    it('should generate amount_mismatch warning when amounts do not match', () => {
      const result = createExtractionResult({ extractedAmount: 800 });
      const warnings = generateWarnings(
        result,
        false,
        true,
        '2024-01-15',
        '2024-01-15',
        800,
        1000
      );
      expect(warnings.some(w => w.type === 'amount_mismatch')).toBe(true);
      expect(warnings.find(w => w.type === 'amount_mismatch')?.severity).toBe('error');
    });
  });

  describe('Unclear Image Warning', () => {
    it('should generate unclear_image warning for low confidence', () => {
      const result = createExtractionResult({ confidence: 'low' });
      const warnings = generateWarnings(
        result,
        true,
        true,
        '2024-01-15',
        '2024-01-15',
        1000,
        1000
      );
      expect(warnings.some(w => w.type === 'unclear_image')).toBe(true);
    });

    it('should generate unclear_image warning for none confidence', () => {
      const result = createExtractionResult({ confidence: 'none' });
      const warnings = generateWarnings(
        result,
        true,
        true,
        '2024-01-15',
        '2024-01-15',
        1000,
        1000
      );
      expect(warnings.some(w => w.type === 'unclear_image')).toBe(true);
    });
  });

  describe('Low Confidence Warning', () => {
    it('should generate low_confidence warning for low confidence', () => {
      const result = createExtractionResult({ confidence: 'low' });
      const warnings = generateWarnings(
        result,
        true,
        true,
        '2024-01-15',
        '2024-01-15',
        1000,
        1000
      );
      expect(warnings.some(w => w.type === 'low_confidence')).toBe(true);
      expect(warnings.find(w => w.type === 'low_confidence')?.severity).toBe('info');
    });
  });

  describe('No Sections Warning', () => {
    it('should generate no_sections warning when sections array is empty', () => {
      const result = createExtractionResult({ sections: [] });
      const warnings = generateWarnings(
        result,
        true,
        true,
        '2024-01-15',
        '2024-01-15',
        1000,
        1000
      );
      expect(warnings.some(w => w.type === 'no_sections')).toBe(true);
      expect(warnings.find(w => w.type === 'no_sections')?.severity).toBe('warning');
    });
  });

  describe('Partial Read Warning', () => {
    it('should generate partial_read warning for few active sections with large amount', () => {
      const result = createExtractionResult({
        sections: [{ name: 'mada', hostTotal: 1500, terminalTotal: 1500, count: 50 }],
      });
      const warnings = generateWarnings(
        result,
        true,
        true,
        '2024-01-15',
        '2024-01-15',
        1500,
        1500
      );
      expect(warnings.some(w => w.type === 'partial_read')).toBe(true);
      expect(warnings.find(w => w.type === 'partial_read')?.severity).toBe('info');
    });

    it('should NOT generate partial_read warning for small amounts', () => {
      const result = createExtractionResult({
        sections: [{ name: 'mada', hostTotal: 500, terminalTotal: 500, count: 10 }],
        extractedAmount: 500,
      });
      const warnings = generateWarnings(
        result,
        true,
        true,
        '2024-01-15',
        '2024-01-15',
        500,
        500
      );
      expect(warnings.some(w => w.type === 'partial_read')).toBe(false);
    });
  });

  describe('Multiple Warnings', () => {
    it('should generate multiple warnings when multiple issues exist', () => {
      const result = createExtractionResult({
        confidence: 'low',
        sections: [],
        extractedDate: null,
      });
      const warnings = generateWarnings(
        result,
        false,
        false,
        null,
        '2024-01-15',
        800,
        1000
      );
      
      expect(warnings.length).toBeGreaterThan(2);
      expect(warnings.some(w => w.type === 'no_date')).toBe(true);
      expect(warnings.some(w => w.type === 'amount_mismatch')).toBe(true);
      expect(warnings.some(w => w.type === 'unclear_image')).toBe(true);
      expect(warnings.some(w => w.type === 'no_sections')).toBe(true);
    });
  });

  describe('Warning Suggestions', () => {
    it('should include suggestions in warnings', () => {
      const result = createExtractionResult({ extractedDate: null });
      const warnings = generateWarnings(
        result,
        true,
        false,
        null,
        '2024-01-15',
        1000,
        1000
      );
      
      const noDateWarning = warnings.find(w => w.type === 'no_date');
      expect(noDateWarning?.suggestion).toBeTruthy();
    });
  });
});

// ==================== Constants Tests ====================
describe('OCR Constants', () => {
  it('should have correct AMOUNT_TOLERANCE_PERCENTAGE', () => {
    expect(AMOUNT_TOLERANCE_PERCENTAGE).toBe(0.02);
  });

  it('should have correct DATE_TOLERANCE_DAYS', () => {
    expect(DATE_TOLERANCE_DAYS).toBe(1);
  });
});

// ==================== Integration Scenarios ====================
describe('Integration Scenarios', () => {
  describe('Real-world POS Receipt Verification', () => {
    it('should verify typical POS receipt data', () => {
      // Simulate real POS receipt verification
      const extractedAmount = 918;
      const expectedAmount = 918;
      const extractedDate = '2024-01-15';
      const expectedDate = '2024-01-15';

      expect(amountsMatch(extractedAmount, expectedAmount)).toBe(true);
      expect(datesMatch(extractedDate, expectedDate)).toBe(true);
    });

    it('should handle slight OCR error in amount', () => {
      // OCR might read 918 as 920 (within 2%)
      const extractedAmount = 920;
      const expectedAmount = 918;

      expect(amountsMatch(extractedAmount, expectedAmount)).toBe(true);
    });

    it('should reject significant amount difference', () => {
      // User entered wrong amount
      const extractedAmount = 918;
      const expectedAmount = 1500;

      expect(amountsMatch(extractedAmount, expectedAmount)).toBe(false);
    });
  });

  describe('Date Handling Across Timezones', () => {
    it('should handle date uploaded late at night', () => {
      // Receipt dated 2024-01-15, uploaded at 2024-01-15 23:59
      const extractedDate = normalizeDate('15/01/2024');
      const uploadDate = getUploadDate('2024-01-15T23:59:00Z');

      expect(datesMatch(extractedDate, uploadDate)).toBe(true);
    });

    it('should handle date uploaded early morning next day', () => {
      // Receipt dated 2024-01-15, uploaded at 2024-01-16 01:00
      const extractedDate = normalizeDate('15/01/2024');
      const uploadDate = getUploadDate('2024-01-16T01:00:00Z');

      expect(datesMatch(extractedDate, uploadDate)).toBe(true);
    });
  });
});
