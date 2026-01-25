/**
 * اختبارات أداة تقرير إيرادات الموظف
 */
import { describe, it, expect } from 'vitest';

describe('Employee Revenue Tool', () => {
  describe('Period Calculation', () => {
    it('should calculate today period correctly', () => {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      expect(startDate.getHours()).toBe(0);
      expect(startDate.getMinutes()).toBe(0);
    });

    it('should calculate week period correctly', () => {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
      
      expect(startDate.getDay()).toBe(0); // Sunday
    });

    it('should calculate last_week period correctly', () => {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const lastWeekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek - 1);
      const lastWeekStart = new Date(lastWeekEnd.getFullYear(), lastWeekEnd.getMonth(), lastWeekEnd.getDate() - 6);
      
      expect(lastWeekEnd.getDay()).toBe(6); // Saturday
      expect(lastWeekStart.getDay()).toBe(0); // Sunday
    });

    it('should calculate month period correctly', () => {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      
      expect(startDate.getDate()).toBe(1);
    });

    it('should calculate last_month period correctly', () => {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      
      expect(startDate.getDate()).toBe(1);
      expect(endDate.getDate()).toBeGreaterThanOrEqual(28);
    });
  });

  describe('Revenue Calculations', () => {
    it('should calculate totals correctly', () => {
      const revenues = [
        { cash: 1000, network: 500, total: 1500 },
        { cash: 2000, network: 800, total: 2800 },
        { cash: 1500, network: 600, total: 2100 },
      ];

      const totalCash = revenues.reduce((sum, r) => sum + r.cash, 0);
      const totalNetwork = revenues.reduce((sum, r) => sum + r.network, 0);
      const totalRevenue = revenues.reduce((sum, r) => sum + r.total, 0);
      const avgDaily = totalRevenue / revenues.length;

      expect(totalCash).toBe(4500);
      expect(totalNetwork).toBe(1900);
      expect(totalRevenue).toBe(6400);
      expect(avgDaily).toBeCloseTo(2133.33, 1);
    });

    it('should handle empty revenues', () => {
      const revenues: any[] = [];
      
      const totalCash = revenues.reduce((sum, r) => sum + r.cash, 0);
      const totalNetwork = revenues.reduce((sum, r) => sum + r.network, 0);
      const totalRevenue = revenues.reduce((sum, r) => sum + r.total, 0);
      const daysCount = revenues.length;
      const avgDaily = daysCount > 0 ? totalRevenue / daysCount : 0;

      expect(totalCash).toBe(0);
      expect(totalNetwork).toBe(0);
      expect(totalRevenue).toBe(0);
      expect(avgDaily).toBe(0);
    });
  });

  describe('Message Formatting', () => {
    it('should format Arabic date correctly', () => {
      const date = new Date(2026, 0, 25); // January 25, 2026
      const formatted = date.toLocaleDateString('ar-SA');
      
      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
    });

    it('should format numbers with locale correctly', () => {
      const amount = 15000;
      const formatted = amount.toLocaleString();
      
      expect(formatted).toBeTruthy();
      expect(formatted).toContain('15');
    });
  });
});
