/**
 * اختبارات خدمة تنبيهات الفروقات
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createDiscrepancyDetails,
  shouldSendAlert,
  type DiscrepancyDetails,
} from './discrepancyAlertService';
import type { BalanceVerificationResult, OCRWarning } from '../ocr/balanceImageOCR';

describe('discrepancyAlertService', () => {
  describe('createDiscrepancyDetails', () => {
    it('should create discrepancy details from verification result', () => {
      const verificationResult: BalanceVerificationResult = {
        success: true,
        isMatched: true,
        isDateMatched: true,
        extractedAmount: 1000,
        expectedAmount: 1000,
        difference: 0,
        extractedDate: '2026-02-01',
        expectedDate: '2026-02-01',
        confidence: 'high',
        message: 'مطابق',
        warnings: [],
        sections: [
          { name: 'mada', hostTotal: 800, terminalTotal: 800, count: 10 },
          { name: 'VISA', hostTotal: 200, terminalTotal: 200, count: 5 },
        ],
      };

      const details = createDiscrepancyDetails(
        verificationResult,
        1,
        'فرع الرياض',
        'أحمد محمد',
        1000,
        '2026-02-01',
        'https://example.com/image.jpg'
      );

      expect(details.branchId).toBe(1);
      expect(details.branchName).toBe('فرع الرياض');
      expect(details.employeeName).toBe('أحمد محمد');
      expect(details.enteredAmount).toBe(1000);
      expect(details.extractedAmount).toBe(1000);
      expect(details.difference).toBe(0);
      expect(details.isAmountMatched).toBe(true);
      expect(details.isDateMatched).toBe(true);
      expect(details.confidence).toBe('high');
      expect(details.imageUrl).toBe('https://example.com/image.jpg');
    });

    it('should handle null extracted values', () => {
      const verificationResult: BalanceVerificationResult = {
        success: false,
        isMatched: false,
        isDateMatched: false,
        extractedAmount: null,
        expectedAmount: 1000,
        difference: null,
        extractedDate: null,
        expectedDate: '2026-02-01',
        confidence: 'none',
        message: 'فشل القراءة',
        warnings: [],
      };

      const details = createDiscrepancyDetails(
        verificationResult,
        1,
        'فرع الرياض',
        'أحمد محمد',
        1000,
        '2026-02-01'
      );

      expect(details.extractedAmount).toBeNull();
      expect(details.extractedDate).toBeNull();
      expect(details.difference).toBeNull();
      expect(details.isAmountMatched).toBe(false);
    });
  });

  describe('shouldSendAlert', () => {
    it('should return false when amount and date are matched', () => {
      const result: BalanceVerificationResult = {
        success: true,
        isMatched: true,
        isDateMatched: true,
        extractedAmount: 1000,
        expectedAmount: 1000,
        difference: 0,
        extractedDate: '2026-02-01',
        expectedDate: '2026-02-01',
        confidence: 'high',
        message: 'مطابق',
        warnings: [],
      };

      expect(shouldSendAlert(result)).toBe(false);
    });

    it('should return true when amount is not matched', () => {
      const result: BalanceVerificationResult = {
        success: false,
        isMatched: false,
        isDateMatched: true,
        extractedAmount: 900,
        expectedAmount: 1000,
        difference: 100,
        extractedDate: '2026-02-01',
        expectedDate: '2026-02-01',
        confidence: 'high',
        message: 'غير مطابق',
        warnings: [],
      };

      expect(shouldSendAlert(result)).toBe(true);
    });

    it('should return true when date is not matched', () => {
      const result: BalanceVerificationResult = {
        success: false,
        isMatched: true,
        isDateMatched: false,
        extractedAmount: 1000,
        expectedAmount: 1000,
        difference: 0,
        extractedDate: '2026-01-30',
        expectedDate: '2026-02-01',
        confidence: 'high',
        message: 'التاريخ غير مطابق',
        warnings: [],
      };

      expect(shouldSendAlert(result)).toBe(true);
    });

    it('should return true when confidence is low', () => {
      const result: BalanceVerificationResult = {
        success: true,
        isMatched: true,
        isDateMatched: true,
        extractedAmount: 1000,
        expectedAmount: 1000,
        difference: 0,
        extractedDate: '2026-02-01',
        expectedDate: '2026-02-01',
        confidence: 'low',
        message: 'ثقة منخفضة',
        warnings: [],
      };

      expect(shouldSendAlert(result)).toBe(true);
    });

    it('should return true when confidence is none', () => {
      const result: BalanceVerificationResult = {
        success: false,
        isMatched: false,
        isDateMatched: false,
        extractedAmount: null,
        expectedAmount: 1000,
        difference: null,
        extractedDate: null,
        expectedDate: '2026-02-01',
        confidence: 'none',
        message: 'فشل القراءة',
        warnings: [],
      };

      expect(shouldSendAlert(result)).toBe(true);
    });

    it('should respect minimum difference threshold', () => {
      const result: BalanceVerificationResult = {
        success: false,
        isMatched: false,
        isDateMatched: true,
        extractedAmount: 999.5,
        expectedAmount: 1000,
        difference: 0.5,
        extractedDate: '2026-02-01',
        expectedDate: '2026-02-01',
        confidence: 'high',
        message: 'فرق بسيط',
        warnings: [],
      };

      // الفرق 0.5 أقل من الحد الأدنى الافتراضي (1)
      expect(shouldSendAlert(result, 1)).toBe(false);
      
      // لكن إذا كان الحد 0.1، يجب إرسال تنبيه
      expect(shouldSendAlert(result, 0.1)).toBe(true);
    });
  });

  describe('DiscrepancyDetails type', () => {
    it('should have all required fields', () => {
      const details: DiscrepancyDetails = {
        branchId: 1,
        branchName: 'فرع الرياض',
        employeeName: 'أحمد',
        date: '2026-02-01',
        enteredAmount: 1000,
        extractedAmount: 950,
        difference: 50,
        isAmountMatched: false,
        enteredDate: '2026-02-01',
        extractedDate: '2026-02-01',
        isDateMatched: true,
        confidence: 'high',
        warnings: [],
        sections: [
          { name: 'mada', hostTotal: 950, terminalTotal: 950, count: 10 },
        ],
      };

      expect(details).toBeDefined();
      expect(details.branchId).toBe(1);
      expect(details.difference).toBe(50);
    });
  });
});
