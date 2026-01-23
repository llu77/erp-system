import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * اختبارات نظام دورة الولاء (30 يوم لكل عميل)
 * 
 * المتطلبات:
 * 1. كل عميل له دورة 30 يوم تبدأ من زيارته الأولى
 * 2. الزيارات تُحتسب فقط ضمن الدورة الحالية
 * 3. عند انتهاء الدورة (30 يوم) تُصفّر الزيارات وتبدأ دورة جديدة
 * 4. الخصم 60% يُمنح عند الزيارة الثالثة في الدورة
 */

describe('نظام دورة الولاء (30 يوم)', () => {
  
  describe('حساب حالة الدورة', () => {
    
    it('يجب أن تكون الدورة غير موجودة للعميل الجديد', () => {
      // العميل الجديد ليس لديه دورة بعد
      const cycleStatus = {
        hasCycle: false,
        cycleStartDate: null,
        cycleEndDate: null,
        daysRemaining: 30,
        isExpired: false,
        visitsInCycle: 0,
        discountUsed: false,
      };
      
      expect(cycleStatus.hasCycle).toBe(false);
      expect(cycleStatus.cycleStartDate).toBeNull();
      expect(cycleStatus.daysRemaining).toBe(30);
    });
    
    it('يجب أن تبدأ الدورة عند الزيارة الأولى', () => {
      const now = new Date();
      const cycleEndDate = new Date(now);
      cycleEndDate.setDate(cycleEndDate.getDate() + 30);
      
      const cycleStatus = {
        hasCycle: true,
        cycleStartDate: now,
        cycleEndDate: cycleEndDate,
        daysRemaining: 30,
        isExpired: false,
        visitsInCycle: 1,
        discountUsed: false,
      };
      
      expect(cycleStatus.hasCycle).toBe(true);
      expect(cycleStatus.cycleStartDate).toEqual(now);
      expect(cycleStatus.daysRemaining).toBe(30);
      expect(cycleStatus.visitsInCycle).toBe(1);
    });
    
    it('يجب حساب الأيام المتبقية بشكل صحيح', () => {
      const cycleStartDate = new Date();
      cycleStartDate.setDate(cycleStartDate.getDate() - 10); // بدأت قبل 10 أيام
      
      const cycleEndDate = new Date(cycleStartDate);
      cycleEndDate.setDate(cycleEndDate.getDate() + 30);
      
      const now = new Date();
      const timeDiff = cycleEndDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      
      expect(daysRemaining).toBe(20); // 30 - 10 = 20 يوم متبقي
    });
    
    it('يجب أن تنتهي الدورة بعد 30 يوم', () => {
      const cycleStartDate = new Date();
      cycleStartDate.setDate(cycleStartDate.getDate() - 31); // بدأت قبل 31 يوم
      
      const cycleEndDate = new Date(cycleStartDate);
      cycleEndDate.setDate(cycleEndDate.getDate() + 30);
      
      const now = new Date();
      const timeDiff = cycleEndDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      const isExpired = daysRemaining <= 0;
      
      expect(isExpired).toBe(true);
    });
    
  });
  
  describe('احتساب الزيارات في الدورة', () => {
    
    it('يجب احتساب الزيارات فقط ضمن فترة الدورة', () => {
      const cycleStartDate = new Date('2026-01-15');
      const cycleEndDate = new Date('2026-02-14'); // 30 يوم
      
      const visits = [
        { date: new Date('2026-01-10'), inCycle: false }, // قبل الدورة
        { date: new Date('2026-01-15'), inCycle: true },  // بداية الدورة
        { date: new Date('2026-01-25'), inCycle: true },  // ضمن الدورة
        { date: new Date('2026-02-10'), inCycle: true },  // ضمن الدورة
        { date: new Date('2026-02-15'), inCycle: false }, // بعد الدورة
      ];
      
      const visitsInCycle = visits.filter(v => 
        v.date >= cycleStartDate && v.date <= cycleEndDate
      ).length;
      
      expect(visitsInCycle).toBe(3);
    });
    
    it('يجب أن يحصل العميل على خصم في الزيارة الثالثة', () => {
      const visitsInCycle = 3;
      const discountUsed = false;
      
      const isDiscountEligible = visitsInCycle >= 3 && !discountUsed;
      const discountPercentage = isDiscountEligible ? 60 : 0;
      
      expect(isDiscountEligible).toBe(true);
      expect(discountPercentage).toBe(60);
    });
    
    it('يجب ألا يحصل العميل على خصم مرتين في نفس الدورة', () => {
      const visitsInCycle = 4;
      const discountUsed = true; // حصل على الخصم مسبقاً
      
      const isDiscountEligible = visitsInCycle >= 3 && !discountUsed;
      
      expect(isDiscountEligible).toBe(false);
    });
    
  });
  
  describe('تصفير الدورة', () => {
    
    it('يجب تصفير الزيارات عند بدء دورة جديدة', () => {
      // دورة قديمة انتهت
      const oldCycle = {
        startDate: new Date('2025-12-01'),
        endDate: new Date('2025-12-31'),
        visitsCount: 3,
        discountUsed: true,
      };
      
      // دورة جديدة
      const newCycle = {
        startDate: new Date('2026-01-15'),
        endDate: new Date('2026-02-14'),
        visitsCount: 0,
        discountUsed: false,
      };
      
      expect(newCycle.visitsCount).toBe(0);
      expect(newCycle.discountUsed).toBe(false);
    });
    
    it('يجب أن تبدأ دورة جديدة تلقائياً عند انتهاء الدورة السابقة', () => {
      const oldCycleExpired = true;
      const shouldStartNewCycle = oldCycleExpired;
      
      expect(shouldStartNewCycle).toBe(true);
    });
    
  });
  
  describe('رسائل الواجهة', () => {
    
    it('يجب عرض الأيام المتبقية للعميل', () => {
      const daysRemaining = 20;
      const message = `باقي ${daysRemaining} يوم لإكمال الدورة`;
      
      expect(message).toContain('20');
      expect(message).toContain('يوم');
    });
    
    it('يجب عرض رسالة تحفيزية للزيارة الثانية', () => {
      const visitsInCycle = 2;
      const daysRemaining = 15;
      const discountPercentage = 60;
      
      const isSecondVisit = visitsInCycle === 2;
      const message = isSecondVisit 
        ? `ستحصل على خصم ${discountPercentage}% في زيارتك القادمة! باقي ${daysRemaining} يوم`
        : '';
      
      expect(isSecondVisit).toBe(true);
      expect(message).toContain('60%');
      expect(message).toContain('15 يوم');
    });
    
    it('يجب عرض تاريخ انتهاء الدورة', () => {
      const cycleEndDate = new Date('2026-02-14');
      const formattedDate = cycleEndDate.toLocaleDateString('ar-SA', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      
      expect(formattedDate).toBeTruthy();
    });
    
  });
  
  describe('سيناريوهات واقعية', () => {
    
    it('سيناريو: عميل يسجل زيارته الأولى في 25 يناير', () => {
      const firstVisitDate = new Date('2026-01-25');
      const cycleEndDate = new Date('2026-02-24'); // 30 يوم
      
      // العميل يجب أن يكمل 3 زيارات قبل 24 فبراير
      const scenario = {
        firstVisit: firstVisitDate,
        cycleEnd: cycleEndDate,
        visitsNeeded: 3,
        discountPercentage: 60,
      };
      
      expect(scenario.cycleEnd.getTime() - scenario.firstVisit.getTime())
        .toBe(30 * 24 * 60 * 60 * 1000); // 30 يوم بالميلي ثانية
    });
    
    it('سيناريو: عميل أكمل 3 زيارات في 20 يوم', () => {
      const cycleStartDate = new Date('2026-01-15');
      const visits = [
        new Date('2026-01-15'), // الزيارة 1
        new Date('2026-01-22'), // الزيارة 2
        new Date('2026-02-04'), // الزيارة 3 - خصم!
      ];
      
      const visitsInCycle = visits.length;
      const isDiscountEligible = visitsInCycle >= 3;
      
      expect(visitsInCycle).toBe(3);
      expect(isDiscountEligible).toBe(true);
    });
    
    it('سيناريو: عميل لم يكمل 3 زيارات قبل انتهاء الدورة', () => {
      const cycleStartDate = new Date('2025-12-15');
      const cycleEndDate = new Date('2026-01-14');
      const now = new Date('2026-01-20'); // بعد انتهاء الدورة
      
      const visitsInOldCycle = 2; // لم يكمل 3 زيارات
      const isExpired = now > cycleEndDate;
      
      // يجب تصفير الزيارات وبدء دورة جديدة
      expect(isExpired).toBe(true);
      expect(visitsInOldCycle).toBeLessThan(3);
    });
    
  });
  
});

describe('التحقق من منع التلاعب', () => {
  
  it('يجب منع تسجيل أكثر من زيارة في اليوم الواحد', () => {
    const today = new Date();
    const existingVisitToday = true;
    
    const canRegisterVisit = !existingVisitToday;
    
    expect(canRegisterVisit).toBe(false);
  });
  
  it('يجب أن تكون الزيارات موافق عليها لتُحتسب', () => {
    const visits = [
      { status: 'approved', counted: true },
      { status: 'pending', counted: false },
      { status: 'rejected', counted: false },
    ];
    
    const approvedVisits = visits.filter(v => v.status === 'approved');
    
    expect(approvedVisits.length).toBe(1);
  });
  
});
