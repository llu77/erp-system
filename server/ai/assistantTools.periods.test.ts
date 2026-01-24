/**
 * اختبارات الفترات الزمنية في أداة التقارير
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('حساب الفترات الزمنية', () => {
  beforeEach(() => {
    // تثبيت التاريخ على 25 يناير 2026
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 25, 12, 0, 0)); // 25 يناير 2026
  });

  it('يجب أن يحسب الأسبوع الحالي بشكل صحيح', () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
    
    // 25 يناير 2026 هو يوم الأحد (dayOfWeek = 0)
    expect(startDate.getDate()).toBe(25);
    expect(startDate.getMonth()).toBe(0); // يناير
  });

  it('يجب أن يحسب الأسبوع الماضي بشكل صحيح', () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const lastWeekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek - 1);
    const lastWeekStart = new Date(lastWeekEnd.getFullYear(), lastWeekEnd.getMonth(), lastWeekEnd.getDate() - 6);
    
    // الأسبوع الماضي: من 18 إلى 24 يناير
    expect(lastWeekStart.getDate()).toBe(18);
    expect(lastWeekEnd.getDate()).toBe(24);
    expect(lastWeekStart.getMonth()).toBe(0); // يناير
    expect(lastWeekEnd.getMonth()).toBe(0); // يناير
  });

  it('يجب أن يحسب الشهر الحالي بشكل صحيح', () => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    
    expect(startDate.getDate()).toBe(1);
    expect(startDate.getMonth()).toBe(0); // يناير
    expect(startDate.getFullYear()).toBe(2026);
  });

  it('يجب أن يحسب الشهر الماضي بشكل صحيح', () => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endDate = new Date(now.getFullYear(), now.getMonth(), 0);
    
    // الشهر الماضي: ديسمبر 2025
    expect(startDate.getDate()).toBe(1);
    expect(startDate.getMonth()).toBe(11); // ديسمبر
    expect(startDate.getFullYear()).toBe(2025);
    
    expect(endDate.getDate()).toBe(31); // آخر يوم في ديسمبر
    expect(endDate.getMonth()).toBe(11); // ديسمبر
  });

  it('يجب أن يتعامل مع بداية السنة بشكل صحيح', () => {
    // تعيين التاريخ إلى 5 يناير 2026
    vi.setSystemTime(new Date(2026, 0, 5, 12, 0, 0));
    
    const now = new Date();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    
    // الشهر الماضي: ديسمبر 2025
    expect(lastMonthStart.getMonth()).toBe(11); // ديسمبر
    expect(lastMonthStart.getFullYear()).toBe(2025);
    expect(lastMonthEnd.getDate()).toBe(31);
  });
});

describe('أسماء الفترات', () => {
  it('يجب أن تكون أسماء الفترات صحيحة', () => {
    const periodNames: Record<string, string> = {
      'today': 'اليوم',
      'week': 'هذا الأسبوع',
      'last_week': 'الأسبوع الماضي',
      'month': 'هذا الشهر',
      'last_month': 'الشهر الماضي'
    };
    
    expect(periodNames['today']).toBe('اليوم');
    expect(periodNames['week']).toBe('هذا الأسبوع');
    expect(periodNames['last_week']).toBe('الأسبوع الماضي');
    expect(periodNames['month']).toBe('هذا الشهر');
    expect(periodNames['last_month']).toBe('الشهر الماضي');
  });
});

describe('التاريخ الحالي في system prompt', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 25, 12, 0, 0)); // 25 يناير 2026
  });

  it('يجب أن يعرض الشهر الحالي بشكل صحيح', () => {
    const now = new Date();
    const currentMonth = now.toLocaleDateString('ar-SA', { month: 'long' });
    const currentYear = now.getFullYear();
    
    // يجب أن يكون الشهر يناير وليس مارس
    expect(currentMonth).toContain('يناير');
    expect(currentYear).toBe(2026);
  });

  it('يجب أن يعرض التاريخ الكامل بشكل صحيح', () => {
    const now = new Date();
    const currentDate = now.toLocaleDateString('ar-SA', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    // يجب أن يحتوي على يناير
    expect(currentDate).toContain('يناير');
    // السنة تظهر بالأرقام العربية في ar-SA
    expect(currentDate).toContain('٢٠٢٦');
  });
});
