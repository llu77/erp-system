import { describe, it, expect } from 'vitest';
import {
  FIXED_COSTS,
  TOTAL_FIXED_COSTS,
  FIXED_COSTS_PER_BRANCH,
  BRANCHES_COUNT,
  calculateProfit,
  calculateBreakEven,
  generateAlerts,
} from './financialForecastService';

describe('Financial Forecast Service', () => {
  describe('Fixed Costs Constants', () => {
    it('should have correct fixed costs breakdown', () => {
      expect(FIXED_COSTS.salaries).toBe(21000);
      expect(FIXED_COSTS.shopRent).toBe(6600);
      expect(FIXED_COSTS.housingRent).toBe(3200);
      expect(FIXED_COSTS.electricity).toBe(800);
      expect(FIXED_COSTS.internet).toBe(600);
    });

    it('should calculate total fixed costs correctly', () => {
      const expectedTotal = 21000 + 6600 + 3200 + 800 + 600;
      expect(TOTAL_FIXED_COSTS).toBe(expectedTotal);
      expect(TOTAL_FIXED_COSTS).toBe(32200);
    });

    it('should have correct branches count', () => {
      expect(BRANCHES_COUNT).toBe(2);
    });

    it('should calculate fixed costs per branch correctly', () => {
      expect(FIXED_COSTS_PER_BRANCH).toBe(TOTAL_FIXED_COSTS / BRANCHES_COUNT);
      expect(FIXED_COSTS_PER_BRANCH).toBe(16100);
    });
  });

  describe('calculateProfit', () => {
    it('should calculate profit correctly with positive result', () => {
      const result = calculateProfit(50000, 30, 16100, 0);
      
      expect(result.revenue).toBe(50000);
      expect(result.variableCosts).toBe(15000); // 50000 * 30%
      expect(result.fixedCosts).toBe(16100);
      expect(result.totalCosts).toBe(31100); // 15000 + 16100
      expect(result.netProfit).toBe(18900); // 50000 - 31100
      expect(result.status).toBe('ربح');
      expect(result.profitMargin).toBeCloseTo(37.8, 1);
    });

    it('should calculate loss correctly with negative result', () => {
      const result = calculateProfit(20000, 30, 16100, 0);
      
      expect(result.revenue).toBe(20000);
      expect(result.variableCosts).toBe(6000); // 20000 * 30%
      expect(result.fixedCosts).toBe(16100);
      expect(result.totalCosts).toBe(22100); // 6000 + 16100
      expect(result.netProfit).toBe(-2100); // 20000 - 22100
      expect(result.status).toBe('خسارة');
    });

    it('should include other expenses in calculation', () => {
      const result = calculateProfit(50000, 30, 16100, 5000);
      
      expect(result.otherExpenses).toBe(5000);
      expect(result.totalCosts).toBe(36100); // 15000 + 16100 + 5000
      expect(result.netProfit).toBe(13900); // 50000 - 36100
    });

    it('should handle zero revenue', () => {
      const result = calculateProfit(0, 30, 16100, 0);
      
      expect(result.revenue).toBe(0);
      expect(result.variableCosts).toBe(0);
      expect(result.netProfit).toBe(-16100);
      expect(result.status).toBe('خسارة');
      expect(result.profitMargin).toBe(0);
    });
  });

  describe('calculateBreakEven', () => {
    it('should calculate break-even correctly', () => {
      const result = calculateBreakEven(16100, 30, 0);
      
      // Break-even = 16100 / (1 - 0.30) = 16100 / 0.70 = 23000
      expect(result.monthly).toBe(23000);
      expect(result.daily).toBe(Math.round(23000 / 30)); // ~767
      expect(result.message).toBeNull();
    });

    it('should handle high variable cost rate', () => {
      const result = calculateBreakEven(16100, 100, 0);
      
      expect(result.daily).toBe(Infinity);
      expect(result.monthly).toBe(Infinity);
      expect(result.message).toBe('نسبة التكاليف المتغيرة عالية جداً - لا يمكن تحقيق التعادل');
    });

    it('should include other expenses in break-even calculation', () => {
      const result = calculateBreakEven(16100, 30, 5000);
      
      // Break-even = (16100 + 5000) / (1 - 0.30) = 21100 / 0.70 = 30143
      expect(result.monthly).toBe(30143);
    });

    it('should calculate break-even for both branches', () => {
      const result = calculateBreakEven(32200, 30, 0);
      
      // Break-even = 32200 / (1 - 0.30) = 32200 / 0.70 = 46000
      expect(result.monthly).toBe(46000);
      expect(result.daily).toBe(Math.round(46000 / 30)); // ~1533
    });
  });

  describe('generateAlerts', () => {
    it('should generate critical alert for loss', () => {
      const breakEven = { daily: 1000, monthly: 30000 };
      const alerts = generateAlerts(25000, breakEven, -5000, false);
      
      expect(alerts.some(a => a.level === 'critical')).toBe(true);
      expect(alerts.some(a => a.message.includes('خسارة'))).toBe(true);
    });

    it('should generate warning alert when below break-even', () => {
      const breakEven = { daily: 1000, monthly: 30000 };
      const alerts = generateAlerts(20000, breakEven, 1000, false);
      
      expect(alerts.some(a => a.level === 'warning')).toBe(true);
      expect(alerts.some(a => a.message.includes('تحت نقطة التعادل'))).toBe(true);
    });

    it('should generate info alert when above break-even', () => {
      const breakEven = { daily: 1000, monthly: 30000 };
      const alerts = generateAlerts(45000, breakEven, 10000, false);
      
      expect(alerts.some(a => a.level === 'info')).toBe(true);
      expect(alerts.some(a => a.message.includes('فوق نقطة التعادل'))).toBe(true);
    });
  });
});
