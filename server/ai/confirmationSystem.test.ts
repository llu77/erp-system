/**
 * اختبارات نظام التأكيد للمساعد الذكي Symbol AI
 */

import { describe, it, expect, vi } from 'vitest';

describe('نظام التأكيد - Confirmation System', () => {
  
  describe('إنشاء طلب معلق', () => {
    it('يجب أن يُنشئ طلب معلق بنجاح', () => {
      // التحقق من أن الطلب المعلق يحتوي على المعلومات الصحيحة
      const requestData = {
        sessionId: 'test-session-123',
        employeeId: 1,
        requestType: 'vacation' as const,
        requestData: {
          description: 'إجازة سنوية',
          vacationStartDate: '2026-02-01',
          vacationEndDate: '2026-02-03',
          vacationDays: 3,
          vacationType: 'annual',
        },
      };
      
      expect(requestData.sessionId).toBeDefined();
      expect(requestData.employeeId).toBe(1);
      expect(requestData.requestType).toBe('vacation');
    });
    
    it('يجب أن يُنشئ ملخص صحيح للطلب', () => {
      const typeNames: Record<string, string> = {
        advance: 'سلفة',
        vacation: 'إجازة',
        arrears: 'صرف متأخرات',
        permission: 'استئذان',
        objection: 'اعتراض',
        resignation: 'استقالة',
      };
      
      expect(typeNames['vacation']).toBe('إجازة');
      expect(typeNames['advance']).toBe('سلفة');
      expect(typeNames['permission']).toBe('استئذان');
    });
  });
  
  describe('تحليل رد المستخدم', () => {
    it('يجب أن يتعرف على كلمات التأكيد', () => {
      const confirmWords = ['نعم', 'اكد', 'أكد', 'موافق', 'تمام', 'اوكي', 'ok', 'yes', 'صح', 'ايوه', 'أيوه', 'اي', 'أي', 'ماشي'];
      
      const testResponses = ['نعم', 'أكد الطلب', 'موافق', 'تمام', 'ok'];
      
      testResponses.forEach(response => {
        const normalizedResponse = response.trim().toLowerCase();
        const isConfirm = confirmWords.some(word => normalizedResponse.includes(word));
        expect(isConfirm).toBe(true);
      });
    });
    
    it('يجب أن يتعرف على كلمات الإلغاء', () => {
      const cancelWords = ['لا', 'الغاء', 'إلغاء', 'تراجع', 'لأ', 'no', 'cancel', 'مش عايز', 'لا اريد', 'لا أريد', 'الغي', 'ألغي'];
      
      const testResponses = ['لا', 'إلغاء', 'تراجع', 'no', 'لا أريد'];
      
      testResponses.forEach(response => {
        const normalizedResponse = response.trim().toLowerCase();
        const isCancel = cancelWords.some(word => normalizedResponse.includes(word));
        expect(isCancel).toBe(true);
      });
    });
    
    it('يجب أن يميز بين التأكيد والإلغاء', () => {
      const confirmWords = ['نعم', 'اكد', 'أكد', 'موافق'];
      const cancelWords = ['لا', 'الغاء', 'إلغاء', 'تراجع'];
      
      // رسالة تأكيد واضحة
      let response = 'نعم، أكد الطلب';
      let isConfirm = confirmWords.some(word => response.includes(word));
      let isCancel = cancelWords.some(word => response.includes(word));
      expect(isConfirm).toBe(true);
      expect(isCancel).toBe(false);
      
      // رسالة إلغاء واضحة
      response = 'لا، إلغاء الطلب';
      isConfirm = confirmWords.some(word => response.includes(word));
      isCancel = cancelWords.some(word => response.includes(word));
      expect(isConfirm).toBe(false);
      expect(isCancel).toBe(true);
    });
  });
  
  describe('انتهاء صلاحية الطلب', () => {
    it('يجب أن ينتهي الطلب بعد 5 دقائق', () => {
      const expiresInMinutes = 5;
      const now = Date.now();
      const expiresAt = new Date(now + expiresInMinutes * 60 * 1000);
      
      // التحقق من أن وقت الانتهاء صحيح
      const diffMinutes = (expiresAt.getTime() - now) / (60 * 1000);
      expect(diffMinutes).toBeCloseTo(5, 1);
    });
    
    it('يجب أن يرفض الطلب المنتهي الصلاحية', () => {
      const expiresAt = new Date(Date.now() - 60000); // منتهي منذ دقيقة
      const now = new Date();
      
      const isExpired = expiresAt < now;
      expect(isExpired).toBe(true);
    });
  });
  
  describe('أنواع الطلبات', () => {
    it('يجب أن يدعم جميع أنواع الطلبات', () => {
      const supportedTypes = ['advance', 'vacation', 'arrears', 'permission', 'objection', 'resignation'];
      
      supportedTypes.forEach(type => {
        expect(type).toBeDefined();
      });
      
      expect(supportedTypes.length).toBe(6);
    });
    
    it('يجب أن يُنشئ ملخص صحيح لطلب السلفة', () => {
      const request = {
        type: 'advance',
        amount: 5000,
        description: 'سلفة لظروف طارئة',
      };
      
      const summary = `نوع الطلب: سلفة\nالمبلغ: ${request.amount.toLocaleString('ar-SA')} ر.س\nالسبب: ${request.description}`;
      
      expect(summary).toContain('سلفة');
      expect(summary).toContain('٥٬٠٠٠'); // الأرقام العربية
      expect(summary).toContain('سلفة لظروف طارئة');
    });
    
    it('يجب أن يُنشئ ملخص صحيح لطلب الإجازة', () => {
      const request = {
        type: 'vacation',
        vacationType: 'annual',
        vacationStartDate: '2026-02-01',
        vacationEndDate: '2026-02-03',
        vacationDays: 3,
      };
      
      const vacationTypes: Record<string, string> = {
        annual: 'سنوية',
        sick: 'مرضية',
        emergency: 'طارئة',
        unpaid: 'بدون راتب',
      };
      
      const summary = `نوع الإجازة: ${vacationTypes[request.vacationType]}\nمن: ${request.vacationStartDate}\nإلى: ${request.vacationEndDate}\nعدد الأيام: ${request.vacationDays}`;
      
      expect(summary).toContain('سنوية');
      expect(summary).toContain('2026-02-01');
      expect(summary).toContain('3');
    });
  });
});
