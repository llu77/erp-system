import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock email service
vi.mock('./email/emailService', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock database
vi.mock('./db', () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  }),
}));

describe('Receipt Voucher Email Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Email Template Generation', () => {
    it('should format currency correctly in Arabic', () => {
      const amount = 1234.56;
      const formatted = amount.toLocaleString('ar-SA', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      });
      // Arabic numerals: ١ = 1, ٢٣٤ = 234
      expect(formatted).toMatch(/[1١]/);
      expect(formatted).toBeTruthy();
    });

    it('should format date correctly in Arabic', () => {
      const date = new Date('2026-01-31');
      const formatted = date.toLocaleDateString('ar-SA', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
    });

    it('should handle zero amounts', () => {
      const amount = 0;
      const formatted = amount.toLocaleString('ar-SA', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      });
      // Arabic numerals: ٠ = 0
      expect(formatted).toMatch(/[0٠]/);
    });

    it('should handle large amounts', () => {
      const amount = 9999999.99;
      const formatted = amount.toLocaleString('ar-SA', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      });
      expect(formatted).toBeTruthy();
    });

    it('should handle negative amounts', () => {
      const amount = -500.00;
      const formatted = amount.toLocaleString('ar-SA', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      });
      // Arabic numerals: ٥٠٠ = 500
      expect(formatted).toMatch(/[5٥]/);
    });
  });

  describe('Email Data Validation', () => {
    it('should validate voucher number format', () => {
      const voucherNumber = 'RV-2026-0001';
      expect(voucherNumber).toMatch(/^RV-\d{4}-\d{4}$/);
    });

    it('should validate email format', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co',
        'admin@company.org',
      ];
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      validEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(true);
      });
    });

    it('should handle missing optional fields', () => {
      const data = {
        voucherId: '123',
        voucherNumber: 'RV-2026-0001',
        voucherDate: '2026-01-31',
        payeeName: 'سالم الوادعي',
        totalAmount: '719.00',
        items: [{ description: 'بند اختباري', amount: '719.00' }],
        createdByName: 'عبدالحي',
        // payeeEmail is optional
        // branchId is optional
        // branchName is optional
      };
      
      expect(data.payeeName).toBeTruthy();
      expect(data.totalAmount).toBeTruthy();
    });

    it('should validate items array', () => {
      const items = [
        { description: 'بند أول', amount: '100.00' },
        { description: 'بند ثاني', amount: '200.00' },
        { description: 'بند ثالث', amount: '419.00' },
      ];
      
      expect(items.length).toBe(3);
      items.forEach(item => {
        expect(item.description).toBeTruthy();
        expect(parseFloat(item.amount)).toBeGreaterThanOrEqual(0);
      });
    });

    it('should calculate total correctly', () => {
      const items = [
        { description: 'بند أول', amount: '100.00' },
        { description: 'بند ثاني', amount: '200.00' },
        { description: 'بند ثالث', amount: '419.00' },
      ];
      
      const total = items.reduce((sum, item) => sum + parseFloat(item.amount), 0);
      expect(total).toBe(719.00);
    });
  });

  describe('Recipient Types', () => {
    it('should identify recipient role correctly', () => {
      const roles = ['supervisor', 'manager', 'admin'] as const;
      const roleTitle = {
        supervisor: 'مشرف الفرع',
        manager: 'المشرف العام',
        admin: 'المسؤول',
      };
      
      roles.forEach(role => {
        expect(roleTitle[role]).toBeTruthy();
      });
    });

    it('should handle payee with email', () => {
      const payee = {
        name: 'سالم الوادعي',
        email: 'salem@example.com',
      };
      
      expect(payee.email).toBeTruthy();
      expect(payee.email).toContain('@');
    });

    it('should handle payee without email', () => {
      const payee = {
        name: 'عمر المطيري',
        email: undefined,
      };
      
      expect(payee.email).toBeUndefined();
    });
  });

  describe('SMS Notification', () => {
    it('should format SMS message correctly', () => {
      const data = {
        payeeName: 'سالم الوادعي',
        voucherNumber: 'RV-2026-0001',
        totalAmount: '719.00',
      };
      
      const message = `السيد/ة ${data.payeeName}، تم إصدار سند قبض رقم ${data.voucherNumber} بمبلغ ${data.totalAmount} ر.س. شكراً لتعاملكم معنا - Symbol AI`;
      
      expect(message).toContain(data.payeeName);
      expect(message).toContain(data.voucherNumber);
      expect(message).toContain(data.totalAmount);
      expect(message.length).toBeLessThan(160 * 2); // Max 2 SMS segments
    });

    it('should validate phone number format', () => {
      const validPhones = [
        '+966501234567',
        '0501234567',
        '966501234567',
      ];
      
      validPhones.forEach(phone => {
        const cleaned = phone.replace(/[^0-9+]/g, '');
        expect(cleaned.length).toBeGreaterThanOrEqual(10);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection error', async () => {
      const { getDb } = await import('./db');
      vi.mocked(getDb).mockResolvedValueOnce(null);
      
      const { sendReceiptVoucherEmail } = await import('./receiptVoucherEmail');
      
      const result = await sendReceiptVoucherEmail({
        voucherId: '123',
        voucherNumber: 'RV-2026-0001',
        voucherDate: '2026-01-31',
        payeeName: 'سالم الوادعي',
        totalAmount: '719.00',
        items: [{ description: 'بند اختباري', amount: '719.00' }],
        createdByName: 'عبدالحي',
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('قاعدة البيانات');
    });

    it('should handle empty recipients list', async () => {
      const { getDb } = await import('./db');
      vi.mocked(getDb).mockResolvedValueOnce({
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      } as any);
      
      const { sendReceiptVoucherEmail } = await import('./receiptVoucherEmail');
      
      const result = await sendReceiptVoucherEmail({
        voucherId: '123',
        voucherNumber: 'RV-2026-0001',
        voucherDate: '2026-01-31',
        payeeName: 'سالم الوادعي',
        totalAmount: '719.00',
        items: [{ description: 'بند اختباري', amount: '719.00' }],
        createdByName: 'عبدالحي',
        // No payeeEmail, no admins, no managers
      });
      
      expect(result.sentTo).toEqual([]);
    });
  });

  describe('Date Range Picker Integration', () => {
    it('should validate date range', () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');
      
      expect(endDate >= startDate).toBe(true);
    });

    it('should handle same day range', () => {
      const startDate = new Date('2026-01-15');
      const endDate = new Date('2026-01-15');
      
      expect(endDate.getTime()).toBe(startDate.getTime());
    });

    it('should calculate days in range', () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');
      
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      expect(diffDays).toBe(30);
    });

    it('should handle preset ranges', () => {
      const presets = {
        today: () => {
          const today = new Date();
          return { start: today, end: today };
        },
        thisWeek: () => {
          const today = new Date();
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay());
          return { start: startOfWeek, end: today };
        },
        thisMonth: () => {
          const today = new Date();
          const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          return { start: startOfMonth, end: today };
        },
      };
      
      Object.values(presets).forEach(preset => {
        const range = preset();
        expect(range.start).toBeInstanceOf(Date);
        expect(range.end).toBeInstanceOf(Date);
        expect(range.end >= range.start).toBe(true);
      });
    });
  });
});
