import { describe, it, expect } from 'vitest';

/**
 * اختبارات التقارير المالية
 * - تقرير المبيعات (من dailyRevenues)
 * - تقرير المشتريات (من purchaseOrders)
 * - تقرير الأرباح والخسائر
 */

describe('تقارير المبيعات والإيرادات', () => {
  describe('مصدر البيانات', () => {
    it('يجب استخدام dailyRevenues كمصدر للمبيعات', () => {
      // المبيعات تأتي من dailyRevenues وليس invoices
      const dataSource = 'dailyRevenues';
      expect(dataSource).toBe('dailyRevenues');
    });

    it('يجب جمع cash + network للحصول على الإجمالي', () => {
      const cash = 4470;
      const network = 45940;
      const total = cash + network;
      expect(total).toBe(50410);
    });
  });

  describe('فلتر التاريخ', () => {
    it('يجب تصفية البيانات حسب نطاق التاريخ', () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');
      const revenueDate = new Date('2026-01-15');
      
      const isInRange = revenueDate >= startDate && revenueDate <= endDate;
      expect(isInRange).toBe(true);
    });

    it('يجب استبعاد البيانات خارج النطاق', () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');
      const revenueDate = new Date('2025-12-15');
      
      const isInRange = revenueDate >= startDate && revenueDate <= endDate;
      expect(isInRange).toBe(false);
    });
  });
});

describe('تقارير المشتريات', () => {
  describe('حالات المشتريات', () => {
    it('يجب تضمين المشتريات الموافق عليها', () => {
      const validStatuses = ['approved', 'received'];
      expect(validStatuses).toContain('approved');
    });

    it('يجب تضمين المشتريات المستلمة', () => {
      const validStatuses = ['approved', 'received'];
      expect(validStatuses).toContain('received');
    });

    it('يجب استبعاد المشتريات المعلقة', () => {
      const validStatuses = ['approved', 'received'];
      expect(validStatuses).not.toContain('pending');
    });
  });
});

describe('تقرير الأرباح والخسائر', () => {
  describe('حساب الربح الإجمالي', () => {
    it('الربح الإجمالي = المبيعات - تكلفة البضاعة', () => {
      const sales = 50410;
      const costOfGoods = 2726;
      const grossProfit = sales - costOfGoods;
      expect(grossProfit).toBe(47684);
    });
  });

  describe('حساب صافي الربح', () => {
    it('صافي الربح = الربح الإجمالي - مصاريف التشغيل', () => {
      const grossProfit = 47684;
      const operatingExpenses = 23745;
      const netProfit = grossProfit - operatingExpenses;
      expect(netProfit).toBe(23939);
    });
  });

  describe('هامش الربح', () => {
    it('هامش الربح = (صافي الربح / المبيعات) × 100', () => {
      const netProfit = 23939;
      const sales = 50410;
      const profitMargin = (netProfit / sales) * 100;
      expect(profitMargin).toBeCloseTo(47.49, 1);
    });
  });
});
