import { describe, it, expect } from 'vitest';

describe('Monthly Reports Module', () => {
  describe('Module Exports', () => {
    it('should export generateMonthlyRevenueReport function', async () => {
      const module = await import('./monthlyReports');
      expect(module.generateMonthlyRevenueReport).toBeDefined();
      expect(typeof module.generateMonthlyRevenueReport).toBe('function');
    });

    it('should export generateMonthlyExpenseReport function', async () => {
      const module = await import('./monthlyReports');
      expect(module.generateMonthlyExpenseReport).toBeDefined();
      expect(typeof module.generateMonthlyExpenseReport).toBe('function');
    });

    it('should export generateMonthlyBonusReport function', async () => {
      const module = await import('./monthlyReports');
      expect(module.generateMonthlyBonusReport).toBeDefined();
      expect(typeof module.generateMonthlyBonusReport).toBe('function');
    });
  });

  describe('Function Signatures', () => {
    it('generateMonthlyRevenueReport should accept month, year, and optional branchId', async () => {
      const { generateMonthlyRevenueReport } = await import('./monthlyReports');
      
      // Check function length (number of required parameters)
      expect(generateMonthlyRevenueReport.length).toBeGreaterThanOrEqual(2); // month and year are required
    });

    it('generateMonthlyExpenseReport should accept month, year, and optional branchId', async () => {
      const { generateMonthlyExpenseReport } = await import('./monthlyReports');
      
      expect(generateMonthlyExpenseReport.length).toBeGreaterThanOrEqual(2);
    });

    it('generateMonthlyBonusReport should accept month, year, and optional branchId', async () => {
      const { generateMonthlyBonusReport } = await import('./monthlyReports');
      
      expect(generateMonthlyBonusReport.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Report Types', () => {
    it('should have three main report types', async () => {
      const module = await import('./monthlyReports');
      
      const reportFunctions = [
        'generateMonthlyRevenueReport',
        'generateMonthlyExpenseReport',
        'generateMonthlyBonusReport'
      ];
      
      for (const fn of reportFunctions) {
        expect(module).toHaveProperty(fn);
      }
    });
  });
});
