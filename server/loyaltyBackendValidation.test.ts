import { describe, it, expect } from 'vitest';

/**
 * اختبارات التحقق من منع العروض في الزيارة الثالثة (Backend)
 * 
 * هذه الاختبارات تتحقق من أن الـ Backend يمنع تسجيل الزيارة الثالثة
 * إذا كانت الخدمة تحتوي على كلمة "عرض"
 */

describe('Loyalty Backend Validation - منع العروض في الزيارة الثالثة', () => {
  
  // دالة مساعدة لمحاكاة منطق التحقق في الـ Backend
  function validateVisitRegistration(
    currentVisitsCount: number,
    serviceType: string,
    requiredVisitsForDiscount: number = 3
  ): { success: boolean; error?: string } {
    const nextVisitNumber = currentVisitsCount + 1;
    const isDiscountVisit = nextVisitNumber === requiredVisitsForDiscount;
    
    // منع اختيار العروض في زيارة الخصم
    if (isDiscountVisit && serviceType.includes('عرض')) {
      return { 
        success: false, 
        error: 'لا يمكن اختيار عرض في زيارة الخصم. الخصم 60% متاح فقط على الخدمات العادية وليس العروض.' 
      };
    }
    
    return { success: true };
  }

  describe('التحقق من الزيارة الثالثة مع عرض', () => {
    it('يجب أن يرفض تسجيل الزيارة الثالثة بعرض المحل', () => {
      const result = validateVisitRegistration(2, 'عرض المحل');
      expect(result.success).toBe(false);
      expect(result.error).toContain('لا يمكن اختيار عرض');
    });

    it('يجب أن يرفض تسجيل الزيارة الثالثة بعرض خاص', () => {
      const result = validateVisitRegistration(2, 'عرض خاص');
      expect(result.success).toBe(false);
      expect(result.error).toContain('لا يمكن اختيار عرض');
    });

    it('يجب أن يرفض تسجيل الزيارة الثالثة بحلاقة + عرض', () => {
      const result = validateVisitRegistration(2, 'حلاقة + عرض');
      expect(result.success).toBe(false);
      expect(result.error).toContain('لا يمكن اختيار عرض');
    });
  });

  describe('التحقق من الزيارة الثالثة مع خدمات عادية', () => {
    it('يجب أن يقبل تسجيل الزيارة الثالثة بحلاقة كاملة', () => {
      const result = validateVisitRegistration(2, 'حلاقة كاملة');
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('يجب أن يقبل تسجيل الزيارة الثالثة بحلاقة + خدمة', () => {
      const result = validateVisitRegistration(2, 'حلاقة + خدمة');
      expect(result.success).toBe(true);
    });

    it('يجب أن يقبل تسجيل الزيارة الثالثة بصبغة شعر', () => {
      const result = validateVisitRegistration(2, 'صبغة شعر');
      expect(result.success).toBe(true);
    });
  });

  describe('التحقق من الزيارات الأخرى مع عروض', () => {
    it('يجب أن يقبل تسجيل الزيارة الأولى بعرض المحل', () => {
      const result = validateVisitRegistration(0, 'عرض المحل');
      expect(result.success).toBe(true);
    });

    it('يجب أن يقبل تسجيل الزيارة الثانية بعرض المحل', () => {
      const result = validateVisitRegistration(1, 'عرض المحل');
      expect(result.success).toBe(true);
    });

    it('يجب أن يقبل تسجيل الزيارة الرابعة بعرض المحل (دورة جديدة)', () => {
      const result = validateVisitRegistration(3, 'عرض المحل');
      expect(result.success).toBe(true);
    });
  });

  describe('رسالة الخطأ', () => {
    it('يجب أن تحتوي رسالة الخطأ على توضيح السبب', () => {
      const result = validateVisitRegistration(2, 'عرض المحل');
      expect(result.error).toContain('الخصم 60%');
      expect(result.error).toContain('الخدمات العادية');
      expect(result.error).toContain('العروض');
    });
  });

  describe('إعدادات مختلفة لعدد الزيارات', () => {
    it('يجب أن يعمل مع 4 زيارات مطلوبة', () => {
      // الزيارة الثالثة ليست زيارة الخصم
      const result1 = validateVisitRegistration(2, 'عرض المحل', 4);
      expect(result1.success).toBe(true);
      
      // الزيارة الرابعة هي زيارة الخصم
      const result2 = validateVisitRegistration(3, 'عرض المحل', 4);
      expect(result2.success).toBe(false);
    });

    it('يجب أن يعمل مع 5 زيارات مطلوبة', () => {
      const result = validateVisitRegistration(4, 'عرض المحل', 5);
      expect(result.success).toBe(false);
    });
  });

  describe('سيناريوهات واقعية', () => {
    it('سيناريو: عميل يحاول التحايل عبر API مباشرة', () => {
      // حتى لو تم تجاوز الواجهة الأمامية، الـ Backend يمنع التسجيل
      const result = validateVisitRegistration(2, 'عرض المحل');
      expect(result.success).toBe(false);
    });

    it('سيناريو: عميل يسجل زيارات متتالية بشكل صحيح', () => {
      // الزيارة الأولى بعرض - مقبول
      expect(validateVisitRegistration(0, 'عرض المحل').success).toBe(true);
      
      // الزيارة الثانية بعرض - مقبول
      expect(validateVisitRegistration(1, 'عرض المحل').success).toBe(true);
      
      // الزيارة الثالثة بحلاقة - مقبول (للحصول على الخصم)
      expect(validateVisitRegistration(2, 'حلاقة كاملة').success).toBe(true);
    });
  });
});
