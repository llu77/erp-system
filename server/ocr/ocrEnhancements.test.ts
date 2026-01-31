/**
 * اختبارات تحسينات OCR المتقدمة
 * Tests for Advanced OCR Enhancements
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeExtractedAmount,
  analyzeSections,
  analyzeExtractedDate,
  createEnhancedWarning,
  performComprehensiveAnalysis,
  KNOWN_PAYMENT_SECTIONS,
  AMOUNT_LIMITS,
} from './ocrEnhancements';
import type { POSSection } from './balanceImageOCR';

// ==================== analyzeExtractedAmount Tests ====================
describe('analyzeExtractedAmount', () => {
  describe('Valid Amounts', () => {
    it('should analyze simple amount', () => {
      const result = analyzeExtractedAmount('1000');
      expect(result.isValid).toBe(true);
      expect(result.normalizedAmount).toBe(1000);
      expect(result.confidence).toBeGreaterThan(80);
    });

    it('should analyze amount with decimals', () => {
      const result = analyzeExtractedAmount('1500.50');
      expect(result.isValid).toBe(true);
      expect(result.normalizedAmount).toBe(1500.50);
    });

    it('should analyze amount with commas', () => {
      const result = analyzeExtractedAmount('1,234,567.89');
      expect(result.isValid).toBe(true);
      expect(result.normalizedAmount).toBe(1234567.89);
    });

    it('should analyze Arabic numerals', () => {
      const result = analyzeExtractedAmount('١٥٠٠');
      expect(result.isValid).toBe(true);
      expect(result.normalizedAmount).toBe(1500);
    });

    it('should analyze zero', () => {
      const result = analyzeExtractedAmount('0');
      expect(result.isValid).toBe(true);
      expect(result.normalizedAmount).toBe(0);
    });
  });

  describe('Invalid Amounts', () => {
    it('should reject null input', () => {
      const result = analyzeExtractedAmount(null);
      expect(result.isValid).toBe(false);
      expect(result.normalizedAmount).toBeNull();
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should reject empty string', () => {
      const result = analyzeExtractedAmount('');
      expect(result.isValid).toBe(false);
    });

    it('should reject non-numeric string', () => {
      const result = analyzeExtractedAmount('abc');
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('لا توجد أرقام في النص');
    });

    it('should reject amount exceeding max limit', () => {
      const result = analyzeExtractedAmount('999999999999');
      expect(result.isValid).toBe(false);
      expect(result.issues.some(i => i.includes('الحد الأقصى'))).toBe(true);
    });
  });

  describe('Suspicious Amounts', () => {
    it('should flag large amounts', () => {
      const result = analyzeExtractedAmount('2000000');
      expect(result.isValid).toBe(true);
      expect(result.issues.some(i => i.includes('يستدعي التحقق'))).toBe(true);
      expect(result.confidence).toBeLessThan(100);
    });
  });

  describe('Multiple Decimal Points', () => {
    it('should handle and flag multiple decimal points', () => {
      const result = analyzeExtractedAmount('1.500.00');
      expect(result.isValid).toBe(true);
      expect(result.normalizedAmount).toBe(1500);
      expect(result.issues.some(i => i.includes('نقاط متعددة'))).toBe(true);
    });
  });
});

// ==================== analyzeSections Tests ====================
describe('analyzeSections', () => {
  const createSection = (name: string, total: number, count: number): POSSection => ({
    name,
    hostTotal: total,
    terminalTotal: total,
    count,
  });

  describe('Valid Sections', () => {
    it('should analyze sections with active payments', () => {
      const sections = [
        createSection('mada', 700, 20),
        createSection('VISA', 200, 5),
        createSection('MasterCard', 100, 3),
      ];
      const result = analyzeSections(sections);
      
      expect(result.isValid).toBe(true);
      expect(result.totalAmount).toBe(1000);
      expect(result.activeSections.length).toBe(3);
      expect(result.confidence).toBeGreaterThan(80);
    });

    it('should separate active and inactive sections', () => {
      const sections = [
        createSection('mada', 700, 20),
        createSection('VISA', 0, 0),
        createSection('MasterCard', 100, 3),
      ];
      const result = analyzeSections(sections);
      
      expect(result.activeSections.length).toBe(2);
      expect(result.inactiveSections).toContain('VISA');
    });
  });

  describe('Invalid Sections', () => {
    it('should reject empty sections array', () => {
      const result = analyzeSections([]);
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('لم يتم استخراج أي أقسام دفع');
    });

    it('should handle all inactive sections', () => {
      const sections = [
        createSection('mada', 0, 0),
        createSection('VISA', 0, 0),
      ];
      const result = analyzeSections(sections);
      
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('جميع الأقسام بدون معاملات');
    });
  });

  describe('Host/Terminal Mismatch', () => {
    it('should flag host/terminal mismatch', () => {
      const sections: POSSection[] = [{
        name: 'mada',
        hostTotal: 700,
        terminalTotal: 750,
        count: 20,
      }];
      const result = analyzeSections(sections);
      
      expect(result.issues.some(i => i.includes('فرق في قسم'))).toBe(true);
      expect(result.confidence).toBeLessThan(100);
    });
  });

  describe('Unknown Sections', () => {
    it('should flag unknown section names', () => {
      const sections = [
        createSection('UnknownCard', 500, 10),
      ];
      const result = analyzeSections(sections);
      
      expect(result.issues.some(i => i.includes('أقسام غير معروفة'))).toBe(true);
    });
  });
});

// ==================== analyzeExtractedDate Tests ====================
describe('analyzeExtractedDate', () => {
  describe('Valid Dates', () => {
    it('should analyze DD/MM/YYYY format', () => {
      const result = analyzeExtractedDate('15/01/2024');
      expect(result.isValid).toBe(true);
      expect(result.normalizedDate).toBe('2024-01-15');
      expect(result.format).toBe('DD/MM/YYYY');
    });

    it('should analyze YYYY-MM-DD format', () => {
      const result = analyzeExtractedDate('2024-01-15');
      expect(result.isValid).toBe(true);
      expect(result.normalizedDate).toBe('2024-01-15');
      expect(result.format).toBe('YYYY-MM-DD');
    });

    it('should analyze DD-MM-YYYY format', () => {
      const result = analyzeExtractedDate('15-01-2024');
      expect(result.isValid).toBe(true);
      expect(result.normalizedDate).toBe('2024-01-15');
    });
  });

  describe('Invalid Dates', () => {
    it('should reject null input', () => {
      const result = analyzeExtractedDate(null);
      expect(result.isValid).toBe(false);
    });

    it('should reject invalid month', () => {
      const result = analyzeExtractedDate('15/13/2024');
      expect(result.isValid).toBe(false);
      expect(result.issues.some(i => i.includes('شهر غير صالح'))).toBe(true);
    });

    it('should reject invalid day', () => {
      const result = analyzeExtractedDate('32/01/2024');
      expect(result.isValid).toBe(false);
      expect(result.issues.some(i => i.includes('يوم غير صالح'))).toBe(true);
    });

    it('should reject unreasonable year', () => {
      const result = analyzeExtractedDate('15/01/1900');
      expect(result.isValid).toBe(false);
      expect(result.issues.some(i => i.includes('سنة غير معقولة'))).toBe(true);
    });

    it('should reject unknown format', () => {
      const result = analyzeExtractedDate('not a date');
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('تنسيق تاريخ غير معروف');
    });
  });
});

// ==================== createEnhancedWarning Tests ====================
describe('createEnhancedWarning', () => {
  describe('Warning Types', () => {
    it('should create no_date warning', () => {
      const warning = createEnhancedWarning('no_date', {});
      expect(warning.type).toBe('no_date');
      expect(warning.severity).toBe('warning');
      expect(warning.message).toContain('التاريخ');
      expect(warning.suggestion).toBeTruthy();
    });

    it('should create unclear_image warning', () => {
      const warning = createEnhancedWarning('unclear_image', {});
      expect(warning.type).toBe('unclear_image');
      expect(warning.severity).toBe('warning');
      expect(warning.message).toContain('الصورة');
    });

    it('should create amount_mismatch warning with context', () => {
      const warning = createEnhancedWarning('amount_mismatch', {
        extractedAmount: 800,
        expectedAmount: 1000,
      });
      expect(warning.type).toBe('amount_mismatch');
      expect(warning.severity).toBe('error');
      expect(warning.message).toContain('800');
      expect(warning.message).toContain('1000');
      expect(warning.message).toContain('200'); // difference
    });

    it('should create date_mismatch warning with context', () => {
      const warning = createEnhancedWarning('date_mismatch', {
        extractedDate: '2024-01-10',
        expectedDate: '2024-01-15',
      });
      expect(warning.type).toBe('date_mismatch');
      expect(warning.severity).toBe('error');
      expect(warning.message).toContain('2024-01-10');
      expect(warning.message).toContain('2024-01-15');
    });

    it('should create partial_read warning with section count', () => {
      const warning = createEnhancedWarning('partial_read', {
        sections: [
          { name: 'mada', hostTotal: 700, terminalTotal: 700, count: 20 },
        ],
      });
      expect(warning.type).toBe('partial_read');
      expect(warning.message).toContain('1 قسم');
    });
  });
});

// ==================== performComprehensiveAnalysis Tests ====================
describe('performComprehensiveAnalysis', () => {
  describe('Perfect Match', () => {
    it('should return high confidence for perfect match', () => {
      const sections: POSSection[] = [
        { name: 'mada', hostTotal: 700, terminalTotal: 700, count: 20 },
        { name: 'VISA', hostTotal: 200, terminalTotal: 200, count: 5 },
        { name: 'MasterCard', hostTotal: 100, terminalTotal: 100, count: 3 },
      ];
      
      const result = performComprehensiveAnalysis(
        1000,
        '2024-01-15',
        sections,
        1000,
        '2024-01-15'
      );
      
      expect(result.isValid).toBe(true);
      expect(result.overallConfidence).toBeGreaterThan(80);
      expect(result.recommendations.length).toBe(0);
    });
  });

  describe('Amount Mismatch', () => {
    it('should reduce confidence for amount mismatch', () => {
      const sections: POSSection[] = [
        { name: 'mada', hostTotal: 800, terminalTotal: 800, count: 20 },
      ];
      
      const result = performComprehensiveAnalysis(
        800,
        '2024-01-15',
        sections,
        1000, // expected different
        '2024-01-15'
      );
      
      expect(result.overallConfidence).toBeLessThan(100);
      expect(result.recommendations.some(r => r.includes('المبلغ'))).toBe(true);
    });
  });

  describe('Missing Data', () => {
    it('should reduce confidence for missing date', () => {
      const sections: POSSection[] = [
        { name: 'mada', hostTotal: 1000, terminalTotal: 1000, count: 20 },
      ];
      
      const result = performComprehensiveAnalysis(
        1000,
        null, // no date
        sections,
        1000,
        '2024-01-15'
      );
      
      expect(result.dateAnalysis.isValid).toBe(false);
      expect(result.recommendations.some(r => r.includes('التاريخ'))).toBe(true);
    });

    it('should reduce confidence for empty sections', () => {
      const result = performComprehensiveAnalysis(
        1000,
        '2024-01-15',
        [], // no sections
        1000,
        '2024-01-15'
      );
      
      expect(result.sectionsAnalysis.isValid).toBe(false);
      expect(result.recommendations.some(r => r.includes('أقسام'))).toBe(true);
    });
  });
});

// ==================== Constants Tests ====================
describe('OCR Enhancement Constants', () => {
  it('should have known payment sections', () => {
    expect(KNOWN_PAYMENT_SECTIONS).toContain('mada');
    expect(KNOWN_PAYMENT_SECTIONS).toContain('VISA');
    expect(KNOWN_PAYMENT_SECTIONS).toContain('MasterCard');
    expect(KNOWN_PAYMENT_SECTIONS.length).toBeGreaterThan(5);
  });

  it('should have reasonable amount limits', () => {
    expect(AMOUNT_LIMITS.MIN).toBe(0);
    expect(AMOUNT_LIMITS.MAX).toBeGreaterThan(1000000);
    expect(AMOUNT_LIMITS.SUSPICIOUS_THRESHOLD).toBeLessThan(AMOUNT_LIMITS.MAX);
  });
});
