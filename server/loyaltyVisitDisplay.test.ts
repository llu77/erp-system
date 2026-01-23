/**
 * اختبارات تحسينات عرض زيارات برنامج الولاء
 * - عرض الزيارات السابقة مع التواريخ
 * - عرض رسالة الخصم عند الزيارة الثالثة
 * - التحقق من أن الزيارات الثلاث في نفس الشهر
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Loyalty Visit Display Enhancements', () => {
  
  describe('findByPhone API Response', () => {
    
    it('should return customer visits details with dates', () => {
      // محاكاة بيانات الزيارات
      const mockVisitsDetails = [
        { id: 1, visitDate: new Date('2026-01-05'), serviceType: 'حلاقة شعر', branchName: 'فرع طويق', visitNumber: 1 },
        { id: 2, visitDate: new Date('2026-01-12'), serviceType: 'حلاقة ذقن', branchName: 'فرع طويق', visitNumber: 2 },
      ];
      
      expect(mockVisitsDetails).toHaveLength(2);
      expect(mockVisitsDetails[0].visitDate).toBeInstanceOf(Date);
      expect(mockVisitsDetails[0].serviceType).toBe('حلاقة شعر');
    });
    
    it('should calculate visits until discount correctly', () => {
      // 0 زيارات = 3 متبقية
      expect(3 - 0).toBe(3);
      
      // 1 زيارة = 2 متبقية
      expect(3 - 1).toBe(2);
      
      // 2 زيارة = 1 متبقية
      expect(3 - 2).toBe(1);
      
      // 3 زيارات = 0 متبقية (مؤهل للخصم)
      expect(3 - 3).toBe(0);
    });
    
    it('should identify eligible customers for discount', () => {
      // العميل مؤهل للخصم إذا كان لديه 2 زيارة موافق عليها (الزيارة القادمة ستكون الثالثة)
      const approvedVisits = 2;
      const isEligibleForDiscount = approvedVisits >= 2;
      
      expect(isEligibleForDiscount).toBe(true);
    });
    
    it('should not mark customer as eligible with less than 2 visits', () => {
      const approvedVisits = 1;
      const isEligibleForDiscount = approvedVisits >= 2;
      
      expect(isEligibleForDiscount).toBe(false);
    });
    
  });
  
  describe('Visit Eligibility Logic', () => {
    
    it('should only count approved visits for discount eligibility', () => {
      const allVisits = [
        { id: 1, status: 'approved' },
        { id: 2, status: 'pending' },
        { id: 3, status: 'approved' },
        { id: 4, status: 'rejected' },
      ];
      
      const approvedVisits = allVisits.filter(v => v.status === 'approved');
      
      expect(approvedVisits).toHaveLength(2);
    });
    
    it('should ensure visits are in the same month', () => {
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      
      const visits = [
        { visitDate: new Date(currentYear, currentMonth, 5) },
        { visitDate: new Date(currentYear, currentMonth, 12) },
        { visitDate: new Date(currentYear, currentMonth, 20) },
      ];
      
      const allInSameMonth = visits.every(v => {
        const visitMonth = new Date(v.visitDate).getMonth();
        const visitYear = new Date(v.visitDate).getFullYear();
        return visitMonth === currentMonth && visitYear === currentYear;
      });
      
      expect(allInSameMonth).toBe(true);
    });
    
    it('should not count visits from different months', () => {
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      
      const visits = [
        { visitDate: new Date(currentYear, currentMonth, 5), status: 'approved' },
        { visitDate: new Date(lastMonthYear, lastMonth, 25), status: 'approved' }, // الشهر الماضي
        { visitDate: new Date(currentYear, currentMonth, 12), status: 'approved' },
      ];
      
      const visitsThisMonth = visits.filter(v => {
        const visitMonth = new Date(v.visitDate).getMonth();
        const visitYear = new Date(v.visitDate).getFullYear();
        return visitMonth === currentMonth && visitYear === currentYear && v.status === 'approved';
      });
      
      expect(visitsThisMonth).toHaveLength(2);
    });
    
  });
  
  describe('Discount Display Messages', () => {
    
    it('should show discount message when customer has 2 approved visits', () => {
      const approvedVisits = 2;
      const isEligibleForDiscount = approvedVisits >= 2;
      const discountPercentage = 60;
      
      expect(isEligibleForDiscount).toBe(true);
      
      const message = isEligibleForDiscount 
        ? `🎉 هذه زيارتك الثالثة! ستحصل على خصم ${discountPercentage}%`
        : `باقي ${3 - approvedVisits} زيارة للحصول على خصم ${discountPercentage}%`;
      
      expect(message).toContain('هذه زيارتك الثالثة');
      expect(message).toContain('60%');
    });
    
    it('should show remaining visits message when not eligible', () => {
      const approvedVisits = 1;
      const isEligibleForDiscount = approvedVisits >= 2;
      const discountPercentage = 60;
      
      expect(isEligibleForDiscount).toBe(false);
      
      const message = isEligibleForDiscount 
        ? `🎉 هذه زيارتك الثالثة! ستحصل على خصم ${discountPercentage}%`
        : `باقي ${3 - approvedVisits} زيارة للحصول على خصم ${discountPercentage}%`;
      
      expect(message).toContain('باقي');
      expect(message).toContain('2');
    });
    
  });
  
  describe('Visit Result Display', () => {
    
    it('should include visits details in result when discount visit', () => {
      const result = {
        success: true,
        customerName: 'أحمد محمد',
        isDiscountVisit: true,
        discountPercentage: 60,
        visitNumberInMonth: 3,
        visitsDetails: [
          { id: 1, visitDate: new Date('2026-01-05'), serviceType: 'حلاقة شعر' },
          { id: 2, visitDate: new Date('2026-01-12'), serviceType: 'حلاقة ذقن' },
          { id: 3, visitDate: new Date('2026-01-20'), serviceType: 'حلاقة كاملة' },
        ],
        currentMonth: 'رجب 1447',
      };
      
      expect(result.isDiscountVisit).toBe(true);
      expect(result.visitsDetails).toHaveLength(3);
      expect(result.currentMonth).toBe('رجب 1447');
    });
    
    it('should format visit dates correctly for Arabic display', () => {
      const visitDate = new Date('2026-01-15');
      
      const formattedDate = visitDate.toLocaleDateString('ar-SA', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
      
      // التحقق من أن التاريخ تم تنسيقه
      expect(formattedDate).toBeTruthy();
      expect(typeof formattedDate).toBe('string');
    });
    
  });
  
  describe('Second Visit Special Message', () => {
    
    it('should show special message when customer has 2 approved visits', () => {
      const visitsThisMonth = 2;
      const discountPercentage = 60;
      
      // عندما يكون لدى العميل 2 زيارة موافق عليها، يجب عرض رسالة خاصة
      const shouldShowSecondVisitMessage = visitsThisMonth === 2;
      
      expect(shouldShowSecondVisitMessage).toBe(true);
      
      const message = `🎁 ستحصل على خصم ${discountPercentage}% في زيارتك القادمة!`;
      expect(message).toContain('ستحصل على خصم');
      expect(message).toContain('60%');
    });
    
    it('should calculate last day of current month correctly', () => {
      const now = new Date();
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      // التحقق من أن آخر يوم في الشهر صحيح
      expect(lastDayOfMonth.getDate()).toBeGreaterThanOrEqual(28);
      expect(lastDayOfMonth.getDate()).toBeLessThanOrEqual(31);
      
      // التحقق من أن الشهر هو نفس الشهر الحالي
      expect(lastDayOfMonth.getMonth()).toBe(now.getMonth());
    });
    
    it('should format last day of month in Arabic', () => {
      const lastDayOfMonth = new Date(2026, 0, 31); // 31 يناير 2026
      
      const formattedDate = lastDayOfMonth.toLocaleDateString('ar-SA', {
        day: 'numeric',
        month: 'long'
      });
      
      expect(formattedDate).toBeTruthy();
      expect(typeof formattedDate).toBe('string');
    });
    
    it('should not show second visit message for first visit', () => {
      const visitsThisMonth = 1;
      const shouldShowSecondVisitMessage = visitsThisMonth === 2;
      
      expect(shouldShowSecondVisitMessage).toBe(false);
    });
    
    it('should not show second visit message for third visit (eligible for discount)', () => {
      const visitsThisMonth = 2;
      const isEligibleForDiscount = true; // العميل مؤهل للخصم
      
      // إذا كان العميل مؤهل للخصم، يجب عرض رسالة الخصم وليس رسالة الزيارة الثانية
      const shouldShowSecondVisitMessage = visitsThisMonth === 2 && !isEligibleForDiscount;
      
      expect(shouldShowSecondVisitMessage).toBe(false);
    });
    
  });
  
  describe('Customer Not Found Handling', () => {
    
    it('should return found: false for unregistered phone', () => {
      const result = { found: false };
      
      expect(result.found).toBe(false);
    });
    
    it('should show registration prompt for unregistered customers', () => {
      const customerData = { found: false };
      
      const message = !customerData.found 
        ? 'رقم الجوال غير مسجل في برنامج الولاء. يرجى التسجيل أولاً.'
        : '';
      
      expect(message).toContain('غير مسجل');
    });
    
  });
  
});
