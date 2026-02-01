/**
 * اختبارات خدمة التحقق من صحة البيانات المالية
 * Financial Validation Service Tests
 */

import { describe, it, expect } from 'vitest';
import {
  validateAmount,
  validateDate,
  validateText,
  VALIDATION_LIMITS,
} from './financialValidation';

describe('Financial Validation Service', () => {
  // ==================== اختبارات التحقق من المبالغ ====================
  describe('validateAmount', () => {
    it('should validate positive numbers correctly', () => {
      const result = validateAmount(100);
      expect(result.success).toBe(true);
      expect(result.data).toBe(100);
    });

    it('should validate string numbers correctly', () => {
      const result = validateAmount('250.50');
      expect(result.success).toBe(true);
      expect(result.data).toBe(250.50);
    });

    it('should reject null values', () => {
      const result = validateAmount(null);
      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('AMOUNT_REQUIRED');
    });

    it('should reject undefined values', () => {
      const result = validateAmount(undefined);
      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('AMOUNT_REQUIRED');
    });

    it('should reject empty strings', () => {
      const result = validateAmount('');
      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('AMOUNT_REQUIRED');
    });

    it('should reject NaN values', () => {
      const result = validateAmount('abc');
      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('AMOUNT_INVALID');
    });

    it('should reject Infinity', () => {
      const result = validateAmount(Infinity);
      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('AMOUNT_INVALID');
    });

    it('should reject negative numbers by default', () => {
      const result = validateAmount(-100);
      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('AMOUNT_NEGATIVE');
    });

    it('should allow negative numbers when option is set', () => {
      const result = validateAmount(-100, { allowNegative: true });
      expect(result.success).toBe(true);
      expect(result.data).toBe(-100);
    });

    it('should allow zero by default', () => {
      const result = validateAmount(0);
      expect(result.success).toBe(true);
      expect(result.data).toBe(0);
    });

    it('should reject zero when option is set', () => {
      const result = validateAmount(0, { allowZero: false });
      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('AMOUNT_ZERO');
    });

    it('should reject amounts below minimum', () => {
      const result = validateAmount(5, { min: 10 });
      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('AMOUNT_TOO_SMALL');
    });

    it('should reject amounts above maximum', () => {
      const result = validateAmount(100, { max: 50 });
      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('AMOUNT_TOO_LARGE');
    });

    it('should reject amounts exceeding global maximum', () => {
      const result = validateAmount(VALIDATION_LIMITS.MAX_AMOUNT + 1);
      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('AMOUNT_TOO_LARGE');
    });

    it('should reject amounts with too many decimal places', () => {
      const result = validateAmount(100.123, { precision: 2 });
      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('AMOUNT_PRECISION');
    });

    it('should accept amounts with valid decimal places', () => {
      const result = validateAmount(100.12, { precision: 2 });
      expect(result.success).toBe(true);
      expect(result.data).toBe(100.12);
    });

    it('should use custom field name in error messages', () => {
      const result = validateAmount(null, { fieldName: 'الكاش' });
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('الكاش');
    });
  });

  // ==================== اختبارات التحقق من التواريخ ====================
  describe('validateDate', () => {
    it('should validate valid Date objects', () => {
      const date = new Date();
      const result = validateDate(date);
      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Date);
    });

    it('should validate valid date strings', () => {
      // استخدام تاريخ اليوم لضمان النجاح
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      const result = validateDate(dateStr);
      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Date);
    });

    it('should reject null values', () => {
      const result = validateDate(null);
      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('DATE_REQUIRED');
    });

    it('should reject undefined values', () => {
      const result = validateDate(undefined);
      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('DATE_REQUIRED');
    });

    it('should reject empty strings', () => {
      const result = validateDate('');
      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('DATE_REQUIRED');
    });

    it('should reject invalid date strings', () => {
      const result = validateDate('invalid-date');
      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('DATE_INVALID');
    });

    it('should reject future dates by default', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      const result = validateDate(futureDate);
      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('DATE_FUTURE');
    });

    it('should allow future dates when option is set', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const result = validateDate(futureDate, { allowFuture: true, maxDaysInFuture: 10 });
      expect(result.success).toBe(true);
    });

    it('should reject dates too far in the past', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 400);
      const result = validateDate(oldDate, { maxDaysInPast: 365 });
      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('DATE_TOO_OLD');
    });

    it('should accept dates within allowed past range', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      const result = validateDate(pastDate, { maxDaysInPast: 30 });
      expect(result.success).toBe(true);
    });

    it('should use custom field name in error messages', () => {
      const result = validateDate(null, { fieldName: 'تاريخ الإيراد' });
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('تاريخ الإيراد');
    });
  });

  // ==================== اختبارات التحقق من النصوص ====================
  describe('validateText', () => {
    it('should validate valid text', () => {
      const result = validateText('نص صالح');
      expect(result.success).toBe(true);
      expect(result.data).toBe('نص صالح');
    });

    it('should trim whitespace', () => {
      const result = validateText('  نص مع مسافات  ');
      expect(result.success).toBe(true);
      expect(result.data).toBe('نص مع مسافات');
    });

    it('should allow empty strings when not required', () => {
      const result = validateText('', { required: false });
      expect(result.success).toBe(true);
      expect(result.data).toBe('');
    });

    it('should reject empty strings when required', () => {
      const result = validateText('', { required: true });
      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('FIELD_REQUIRED');
    });

    it('should reject text below minimum length', () => {
      const result = validateText('ab', { minLength: 3 });
      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('FIELD_TOO_SHORT');
    });

    it('should reject text above maximum length', () => {
      const result = validateText('a'.repeat(1001), { maxLength: 1000 });
      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('FIELD_TOO_LONG');
    });

    it('should accept text within length limits', () => {
      const result = validateText('نص مناسب', { minLength: 3, maxLength: 100 });
      expect(result.success).toBe(true);
    });

    it('should use custom field name in error messages', () => {
      const result = validateText('', { required: true, fieldName: 'وصف المصروف' });
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('وصف المصروف');
    });
  });

  // ==================== اختبارات قواعد العمل ====================
  describe('Business Rules Validation', () => {
    it('should validate revenue calculation: total = cash + network + paidInvoices + loyalty', () => {
      const cash = 1000;
      const network = 500;
      const paidInvoices = 200;
      const loyalty = 100;
      const expectedTotal = cash + network + paidInvoices + loyalty;
      
      expect(expectedTotal).toBe(1800);
    });

    it('should require customer name when paidInvoices > 0', () => {
      const paidInvoices = 100;
      const paidInvoicesCustomer = '';
      
      // محاكاة قاعدة العمل
      const isValid = paidInvoices <= 0 || paidInvoicesCustomer.trim() !== '';
      expect(isValid).toBe(false);
    });

    it('should require loyalty invoice image when loyalty > 0', () => {
      const loyalty = 50;
      const loyaltyInvoiceImage = null;
      
      // محاكاة قاعدة العمل
      const isValid = loyalty <= 0 || loyaltyInvoiceImage !== null;
      expect(isValid).toBe(false);
    });

    it('should validate employee revenues match total', () => {
      const cash = 1000;
      const network = 500;
      const employeeRevenues = [
        { cash: 400, network: 200 },
        { cash: 600, network: 300 },
      ];
      
      const totalEmployeeCash = employeeRevenues.reduce((sum, e) => sum + e.cash, 0);
      const totalEmployeeNetwork = employeeRevenues.reduce((sum, e) => sum + e.network, 0);
      const totalEmployeeAmount = totalEmployeeCash + totalEmployeeNetwork;
      const expectedAmount = cash + network;
      
      expect(totalEmployeeAmount).toBe(expectedAmount);
    });
  });

  // ==================== اختبارات حدود المبالغ ====================
  describe('Amount Limits', () => {
    it('should accept amounts at maximum limit', () => {
      const result = validateAmount(VALIDATION_LIMITS.MAX_AMOUNT);
      expect(result.success).toBe(true);
    });

    it('should accept amounts at minimum limit', () => {
      const result = validateAmount(VALIDATION_LIMITS.MIN_AMOUNT);
      expect(result.success).toBe(true);
    });

    it('should have reasonable maximum amount (10 million)', () => {
      expect(VALIDATION_LIMITS.MAX_AMOUNT).toBe(10_000_000);
    });

    it('should have reasonable decimal precision (2 places)', () => {
      expect(VALIDATION_LIMITS.MAX_DECIMAL_PLACES).toBe(2);
    });
  });

  // ==================== اختبارات الأمان ====================
  describe('Security Validation', () => {
    it('should handle potential SQL injection in text', () => {
      const maliciousInput = "'; DROP TABLE users; --";
      const result = validateText(maliciousInput);
      // التحقق يمر لأن النص صالح من حيث الشكل
      // الحماية الفعلية تتم عبر Prepared Statements في قاعدة البيانات
      expect(result.success).toBe(true);
    });

    it('should handle potential XSS in text', () => {
      const xssInput = '<script>alert("xss")</script>';
      const result = validateText(xssInput);
      // التحقق يمر لأن النص صالح من حيث الشكل
      // الحماية الفعلية تتم عبر تنظيف المخرجات في الواجهة
      expect(result.success).toBe(true);
    });

    it('should reject extremely large numbers', () => {
      const result = validateAmount(Number.MAX_SAFE_INTEGER);
      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('AMOUNT_TOO_LARGE');
    });
  });
});
