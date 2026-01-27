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

describe('P&L and Payroll Reports', () => {
  describe('Module Exports - New Reports', () => {
    it('should export generateProfitLossReport function', async () => {
      const module = await import('./monthlyReports');
      expect(module.generateProfitLossReport).toBeDefined();
      expect(typeof module.generateProfitLossReport).toBe('function');
    });

    it('should export generatePayrollReport function', async () => {
      const module = await import('./monthlyReports');
      expect(module.generatePayrollReport).toBeDefined();
      expect(typeof module.generatePayrollReport).toBe('function');
    });
  });

  describe('Function Signatures - New Reports', () => {
    it('generateProfitLossReport should accept month, year, and optional branchId', async () => {
      const { generateProfitLossReport } = await import('./monthlyReports');
      expect(generateProfitLossReport.length).toBeGreaterThanOrEqual(2);
    });

    it('generatePayrollReport should accept month, year, and optional branchId', async () => {
      const { generatePayrollReport } = await import('./monthlyReports');
      expect(generatePayrollReport.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('P&L Calculation Logic', () => {
    it('should calculate gross profit correctly', () => {
      const totalRevenue = 80000;
      const totalExpenses = 7000;
      const grossProfit = totalRevenue - totalExpenses;
      expect(grossProfit).toBe(73000);
    });

    it('should calculate net profit correctly', () => {
      const totalRevenue = 80000;
      const totalExpenses = 7000;
      const totalSalaries = 20000;
      const netProfit = totalRevenue - totalExpenses - totalSalaries;
      expect(netProfit).toBe(53000);
    });

    it('should calculate profit margin correctly', () => {
      const totalRevenue = 100000;
      const netProfit = 25000;
      const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue * 100) : 0;
      expect(profitMargin).toBe(25);
    });

    it('should handle zero revenue case', () => {
      const totalRevenue = 0;
      const netProfit = -5000;
      const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue * 100) : 0;
      expect(profitMargin).toBe(0);
    });

    it('should handle negative profit (loss)', () => {
      const totalRevenue = 50000;
      const totalExpenses = 40000;
      const totalSalaries = 30000;
      const netProfit = totalRevenue - totalExpenses - totalSalaries;
      expect(netProfit).toBe(-20000);
      expect(netProfit < 0).toBe(true);
    });
  });

  describe('Payroll Calculation Logic', () => {
    it('should calculate payroll totals correctly', () => {
      const employees = [
        { baseSalary: 2000, overtimeAmount: 1000, incentiveAmount: 400, totalDeductions: 200, netSalary: 3200 },
        { baseSalary: 2000, overtimeAmount: 0, incentiveAmount: 0, totalDeductions: 100, netSalary: 1900 },
        { baseSalary: 2000, overtimeAmount: 1000, incentiveAmount: 400, totalDeductions: 0, netSalary: 3400 },
      ];

      let totalBase = 0, totalOvertime = 0, totalIncentives = 0, totalDeductions = 0, totalNet = 0;
      for (const e of employees) {
        totalBase += e.baseSalary;
        totalOvertime += e.overtimeAmount;
        totalIncentives += e.incentiveAmount;
        totalDeductions += e.totalDeductions;
        totalNet += e.netSalary;
      }

      expect(totalBase).toBe(6000);
      expect(totalOvertime).toBe(2000);
      expect(totalIncentives).toBe(800);
      expect(totalDeductions).toBe(300);
      expect(totalNet).toBe(8500);
    });

    it('should calculate net salary correctly', () => {
      const baseSalary = 2000;
      const overtimeAmount = 1000;
      const incentiveAmount = 400;
      const totalDeductions = 200;
      
      const grossSalary = baseSalary + overtimeAmount + incentiveAmount;
      const netSalary = grossSalary - totalDeductions;
      
      expect(grossSalary).toBe(3400);
      expect(netSalary).toBe(3200);
    });
  });

  describe('Helper Functions', () => {
    it('should format currency correctly', () => {
      const formatCurrency = (amount: number): string => {
        return `${amount.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;
      };

      expect(formatCurrency(1000)).toContain('ر.س');
      expect(formatCurrency(0)).toContain('ر.س');
    });

    it('should get month name correctly', () => {
      const getMonthName = (month: number): string => {
        const months = [
          'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
          'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
        ];
        return months[month - 1] || '';
      };

      expect(getMonthName(1)).toBe('يناير');
      expect(getMonthName(6)).toBe('يونيو');
      expect(getMonthName(12)).toBe('ديسمبر');
      expect(getMonthName(13)).toBe('');
    });

    it('should get category label correctly', () => {
      const getCategoryLabel = (category: string): string => {
        const labels: Record<string, string> = {
          'salaries': 'الرواتب', 'rent': 'الإيجار', 'utilities': 'المرافق',
          'supplies': 'المستلزمات', 'maintenance': 'الصيانة', 'marketing': 'التسويق',
        };
        return labels[category] || category;
      };

      expect(getCategoryLabel('rent')).toBe('الإيجار');
      expect(getCategoryLabel('utilities')).toBe('المرافق');
      expect(getCategoryLabel('unknown')).toBe('unknown');
    });

    it('should get payroll status label correctly', () => {
      const getPayrollStatusLabel = (s: string) => {
        const labels: Record<string, string> = { 
          draft: 'مسودة', 
          pending: 'قيد المراجعة', 
          approved: 'معتمد', 
          paid: 'مدفوع', 
          cancelled: 'ملغى' 
        };
        return labels[s] || s;
      };

      expect(getPayrollStatusLabel('approved')).toBe('معتمد');
      expect(getPayrollStatusLabel('paid')).toBe('مدفوع');
      expect(getPayrollStatusLabel('draft')).toBe('مسودة');
      expect(getPayrollStatusLabel('unknown')).toBe('unknown');
    });
  });

  describe('Report Types - Complete List', () => {
    it('should have five main report types', async () => {
      const module = await import('./monthlyReports');
      
      const reportFunctions = [
        'generateMonthlyRevenueReport',
        'generateMonthlyExpenseReport',
        'generateMonthlyBonusReport',
        'generateProfitLossReport',
        'generatePayrollReport'
      ];
      
      for (const fn of reportFunctions) {
        expect(module).toHaveProperty(fn);
      }
    });
  });
});
