import { describe, it, expect } from 'vitest';

/**
 * اختبارات منع اختيار العروض في الزيارة الثالثة
 * 
 * المنطق:
 * - عند الزيارة الثالثة (زيارة الخصم 60%)
 * - لا يمكن اختيار أي خدمة تحتوي على كلمة "عرض"
 * - لأن الخصم لا يشمل العروض
 */

describe('Loyalty Offer Restriction - منع اختيار العروض في الزيارة الثالثة', () => {
  
  // دالة للتحقق من أن الخدمة تحتوي على كلمة "عرض"
  const isOfferService = (name: string): boolean => {
    return name.includes('عرض');
  };
  
  // دالة للتحقق من أن الزيارة القادمة هي الثالثة
  const isThirdVisit = (currentVisits: number, visitsRequired: number): boolean => {
    return currentVisits === visitsRequired - 1;
  };
  
  // دالة للتحقق من إمكانية اختيار الخدمة
  const canSelectService = (
    serviceName: string, 
    currentVisits: number, 
    visitsRequired: number
  ): boolean => {
    const isThird = isThirdVisit(currentVisits, visitsRequired);
    const isOffer = isOfferService(serviceName);
    
    // إذا كانت الزيارة الثالثة والخدمة عرض، لا يمكن الاختيار
    if (isThird && isOffer) {
      return false;
    }
    return true;
  };

  describe('isOfferService - التحقق من الخدمات التي تحتوي على عرض', () => {
    
    it('يجب أن يكتشف الخدمات التي تحتوي على كلمة عرض', () => {
      expect(isOfferService('عرض المحل')).toBe(true);
      expect(isOfferService('عرض خاص')).toBe(true);
      expect(isOfferService('حلاقة + عرض')).toBe(true);
      expect(isOfferService('عرض الصيف')).toBe(true);
    });
    
    it('يجب أن لا يكتشف الخدمات العادية', () => {
      expect(isOfferService('حلاقة شعر')).toBe(false);
      expect(isOfferService('حلاقة ذقن')).toBe(false);
      expect(isOfferService('حلاقة كاملة')).toBe(false);
      expect(isOfferService('صبغة')).toBe(false);
      expect(isOfferService('علاج شعر')).toBe(false);
    });
    
  });

  describe('isThirdVisit - التحقق من الزيارة الثالثة', () => {
    
    it('يجب أن يكتشف أن الزيارة القادمة هي الثالثة عندما يكون لدى العميل زيارتين', () => {
      expect(isThirdVisit(2, 3)).toBe(true); // زيارتين سابقتين، الثالثة هي التالية
    });
    
    it('يجب أن لا يكتشف الزيارة الثالثة عندما يكون لدى العميل زيارة واحدة', () => {
      expect(isThirdVisit(1, 3)).toBe(false); // زيارة واحدة، الثانية هي التالية
    });
    
    it('يجب أن لا يكتشف الزيارة الثالثة عندما لا يوجد زيارات', () => {
      expect(isThirdVisit(0, 3)).toBe(false); // لا زيارات، الأولى هي التالية
    });
    
    it('يجب أن يعمل مع إعدادات مختلفة لعدد الزيارات المطلوبة', () => {
      expect(isThirdVisit(3, 4)).toBe(true); // 3 زيارات، الرابعة هي التالية (إعداد 4 زيارات)
      expect(isThirdVisit(4, 5)).toBe(true); // 4 زيارات، الخامسة هي التالية (إعداد 5 زيارات)
    });
    
  });

  describe('canSelectService - التحقق من إمكانية اختيار الخدمة', () => {
    
    it('يجب أن يمنع اختيار العروض في الزيارة الثالثة', () => {
      expect(canSelectService('عرض المحل', 2, 3)).toBe(false);
      expect(canSelectService('عرض خاص', 2, 3)).toBe(false);
      expect(canSelectService('حلاقة + عرض', 2, 3)).toBe(false);
    });
    
    it('يجب أن يسمح باختيار الخدمات العادية في الزيارة الثالثة', () => {
      expect(canSelectService('حلاقة شعر', 2, 3)).toBe(true);
      expect(canSelectService('حلاقة ذقن', 2, 3)).toBe(true);
      expect(canSelectService('حلاقة كاملة', 2, 3)).toBe(true);
      expect(canSelectService('صبغة', 2, 3)).toBe(true);
    });
    
    it('يجب أن يسمح باختيار العروض في الزيارات الأخرى', () => {
      // الزيارة الأولى
      expect(canSelectService('عرض المحل', 0, 3)).toBe(true);
      // الزيارة الثانية
      expect(canSelectService('عرض المحل', 1, 3)).toBe(true);
      // بعد الزيارة الثالثة (دورة جديدة)
      expect(canSelectService('عرض المحل', 3, 3)).toBe(true);
    });
    
    it('يجب أن يسمح باختيار الخدمات العادية في جميع الزيارات', () => {
      expect(canSelectService('حلاقة شعر', 0, 3)).toBe(true);
      expect(canSelectService('حلاقة شعر', 1, 3)).toBe(true);
      expect(canSelectService('حلاقة شعر', 2, 3)).toBe(true);
      expect(canSelectService('حلاقة شعر', 3, 3)).toBe(true);
    });
    
  });

  describe('سيناريوهات واقعية', () => {
    
    it('سيناريو: عميل جديد يسجل زيارته الأولى بعرض المحل', () => {
      const currentVisits = 0;
      const visitsRequired = 3;
      const serviceName = 'عرض المحل';
      
      expect(canSelectService(serviceName, currentVisits, visitsRequired)).toBe(true);
    });
    
    it('سيناريو: عميل لديه زيارتين يحاول تسجيل الثالثة بعرض المحل', () => {
      const currentVisits = 2;
      const visitsRequired = 3;
      const serviceName = 'عرض المحل';
      
      expect(canSelectService(serviceName, currentVisits, visitsRequired)).toBe(false);
    });
    
    it('سيناريو: عميل لديه زيارتين يسجل الثالثة بحلاقة كاملة', () => {
      const currentVisits = 2;
      const visitsRequired = 3;
      const serviceName = 'حلاقة كاملة';
      
      expect(canSelectService(serviceName, currentVisits, visitsRequired)).toBe(true);
    });
    
    it('سيناريو: عميل أكمل دورة (3 زيارات) ويبدأ دورة جديدة بعرض', () => {
      const currentVisits = 0; // بعد تصفير الدورة
      const visitsRequired = 3;
      const serviceName = 'عرض خاص';
      
      expect(canSelectService(serviceName, currentVisits, visitsRequired)).toBe(true);
    });
    
  });

  describe('حالات حدية', () => {
    
    it('يجب أن يتعامل مع الخدمات الفارغة', () => {
      expect(isOfferService('')).toBe(false);
      expect(canSelectService('', 2, 3)).toBe(true);
    });
    
    it('يجب أن يتعامل مع عدد زيارات سالب', () => {
      expect(isThirdVisit(-1, 3)).toBe(false);
      expect(canSelectService('عرض المحل', -1, 3)).toBe(true);
    });
    
    it('يجب أن يكتشف كلمة عرض في أي موقع', () => {
      expect(isOfferService('عرض')).toBe(true);
      expect(isOfferService('خدمة عرض خاص')).toBe(true);
      expect(isOfferService('حلاقة مع عرض')).toBe(true);
    });
    
  });

});
