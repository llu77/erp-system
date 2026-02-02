import { describe, it, expect, vi } from 'vitest';

// Mock database functions
vi.mock('./db', () => ({
  getEmployeePerformanceReport: vi.fn().mockResolvedValue([
    {
      rank: 1,
      employeeId: 90001,
      employeeName: 'أحمد محمد',
      employeePhoto: null,
      employeePosition: 'حلاق',
      totalRevenue: 15000,
      invoiceCount: 50,
      serviceCount: 75,
      averageInvoiceValue: 300,
      cashAmount: 10000,
      cardAmount: 5000,
    },
    {
      rank: 2,
      employeeId: 90002,
      employeeName: 'خالد علي',
      employeePhoto: null,
      employeePosition: 'حلاق',
      totalRevenue: 12000,
      invoiceCount: 40,
      serviceCount: 60,
      averageInvoiceValue: 300,
      cashAmount: 8000,
      cardAmount: 4000,
    },
  ]),
  getEmployeePerformanceSummary: vi.fn().mockResolvedValue({
    totalRevenue: 27000,
    totalInvoices: 90,
    uniqueEmployees: 2,
    averageInvoiceValue: 300,
    averageRevenuePerEmployee: 13500,
    revenueChange: 15.5,
    invoicesChange: 10.2,
  }),
  getEmployeePerformanceDaily: vi.fn().mockResolvedValue([
    { date: '2026-01-01', totalRevenue: 5000, invoiceCount: 15, uniqueEmployees: 2 },
    { date: '2026-01-02', totalRevenue: 6000, invoiceCount: 20, uniqueEmployees: 2 },
    { date: '2026-01-03', totalRevenue: 4500, invoiceCount: 12, uniqueEmployees: 2 },
  ]),
  getEmployeeServiceDetails: vi.fn().mockResolvedValue([
    { serviceName: 'Haircut', serviceNameAr: 'قص شعر', totalQuantity: 30, totalRevenue: 6000 },
    { serviceName: 'Beard Trim', serviceNameAr: 'تهذيب لحية', totalQuantity: 20, totalRevenue: 3000 },
  ]),
}));

describe('Employee Performance Report', () => {
  describe('getEmployeePerformanceReport', () => {
    it('should return employee performance data with correct structure', async () => {
      const { getEmployeePerformanceReport } = await import('./db');
      
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');
      
      const result = await getEmployeePerformanceReport(startDate, endDate);
      
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      
      const firstEmployee = result[0];
      expect(firstEmployee).toHaveProperty('rank');
      expect(firstEmployee).toHaveProperty('employeeId');
      expect(firstEmployee).toHaveProperty('employeeName');
      expect(firstEmployee).toHaveProperty('totalRevenue');
      expect(firstEmployee).toHaveProperty('invoiceCount');
      expect(firstEmployee).toHaveProperty('serviceCount');
      expect(firstEmployee).toHaveProperty('averageInvoiceValue');
    });

    it('should return employees sorted by revenue (descending)', async () => {
      const { getEmployeePerformanceReport } = await import('./db');
      
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');
      
      const result = await getEmployeePerformanceReport(startDate, endDate);
      
      expect(result[0].totalRevenue).toBeGreaterThanOrEqual(result[1].totalRevenue);
    });

    it('should correctly calculate rank', async () => {
      const { getEmployeePerformanceReport } = await import('./db');
      
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');
      
      const result = await getEmployeePerformanceReport(startDate, endDate);
      
      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(2);
    });
  });

  describe('getEmployeePerformanceSummary', () => {
    it('should return summary with correct structure', async () => {
      const { getEmployeePerformanceSummary } = await import('./db');
      
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');
      
      const result = await getEmployeePerformanceSummary(startDate, endDate);
      
      expect(result).toHaveProperty('totalRevenue');
      expect(result).toHaveProperty('totalInvoices');
      expect(result).toHaveProperty('uniqueEmployees');
      expect(result).toHaveProperty('averageInvoiceValue');
      expect(result).toHaveProperty('averageRevenuePerEmployee');
      expect(result).toHaveProperty('revenueChange');
      expect(result).toHaveProperty('invoicesChange');
    });

    it('should calculate average revenue per employee correctly', async () => {
      const { getEmployeePerformanceSummary } = await import('./db');
      
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');
      
      const result = await getEmployeePerformanceSummary(startDate, endDate);
      
      expect(result?.averageRevenuePerEmployee).toBe(13500);
    });
  });

  describe('getEmployeePerformanceDaily', () => {
    it('should return daily data with correct structure', async () => {
      const { getEmployeePerformanceDaily } = await import('./db');
      
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');
      
      const result = await getEmployeePerformanceDaily(startDate, endDate);
      
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      
      const firstDay = result[0];
      expect(firstDay).toHaveProperty('date');
      expect(firstDay).toHaveProperty('totalRevenue');
      expect(firstDay).toHaveProperty('invoiceCount');
      expect(firstDay).toHaveProperty('uniqueEmployees');
    });
  });

  describe('getEmployeeServiceDetails', () => {
    it('should return service details for specific employee', async () => {
      const { getEmployeeServiceDetails } = await import('./db');
      
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');
      
      const result = await getEmployeeServiceDetails(90001, startDate, endDate);
      
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      
      const firstService = result[0];
      expect(firstService).toHaveProperty('serviceName');
      expect(firstService).toHaveProperty('serviceNameAr');
      expect(firstService).toHaveProperty('totalQuantity');
      expect(firstService).toHaveProperty('totalRevenue');
    });
  });
});

describe('Employee Performance Report - Data Validation', () => {
  it('should have non-negative revenue values', async () => {
    const { getEmployeePerformanceReport } = await import('./db');
    
    const startDate = new Date('2026-01-01');
    const endDate = new Date('2026-01-31');
    
    const result = await getEmployeePerformanceReport(startDate, endDate);
    
    result.forEach(employee => {
      expect(employee.totalRevenue).toBeGreaterThanOrEqual(0);
      expect(employee.invoiceCount).toBeGreaterThanOrEqual(0);
      expect(employee.serviceCount).toBeGreaterThanOrEqual(0);
    });
  });

  it('should have valid employee names', async () => {
    const { getEmployeePerformanceReport } = await import('./db');
    
    const startDate = new Date('2026-01-01');
    const endDate = new Date('2026-01-31');
    
    const result = await getEmployeePerformanceReport(startDate, endDate);
    
    result.forEach(employee => {
      expect(employee.employeeName).toBeTruthy();
      expect(typeof employee.employeeName).toBe('string');
    });
  });
});
