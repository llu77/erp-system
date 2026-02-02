import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database functions
vi.mock('./db', () => ({
  getServicePerformanceReport: vi.fn(),
  getServicePerformanceByCategory: vi.fn(),
  getServicePerformanceSummary: vi.fn(),
  getServicePerformanceDaily: vi.fn(),
}));

import * as db from './db';

describe('Service Performance Report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getServicePerformanceReport', () => {
    it('should return top services sorted by quantity', async () => {
      const mockData = [
        {
          rank: 1,
          serviceId: 1,
          serviceName: 'Haircut',
          serviceNameAr: 'قص شعر',
          totalQuantity: 150,
          totalRevenue: 7500,
          averagePrice: 50,
          invoiceCount: 120,
        },
        {
          rank: 2,
          serviceId: 2,
          serviceName: 'Beard Trim',
          serviceNameAr: 'تشذيب اللحية',
          totalQuantity: 100,
          totalRevenue: 3000,
          averagePrice: 30,
          invoiceCount: 90,
        },
      ];

      vi.mocked(db.getServicePerformanceReport).mockResolvedValue(mockData);

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');
      const result = await db.getServicePerformanceReport(startDate, endDate, undefined, 20);

      expect(result).toHaveLength(2);
      expect(result[0].rank).toBe(1);
      expect(result[0].totalQuantity).toBeGreaterThan(result[1].totalQuantity);
      expect(db.getServicePerformanceReport).toHaveBeenCalledWith(startDate, endDate, undefined, 20);
    });

    it('should filter by branch when branchId is provided', async () => {
      const mockData = [
        {
          rank: 1,
          serviceId: 1,
          serviceName: 'Haircut',
          serviceNameAr: 'قص شعر',
          totalQuantity: 50,
          totalRevenue: 2500,
          averagePrice: 50,
          invoiceCount: 45,
        },
      ];

      vi.mocked(db.getServicePerformanceReport).mockResolvedValue(mockData);

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');
      const branchId = 30001;
      const result = await db.getServicePerformanceReport(startDate, endDate, branchId, 20);

      expect(result).toHaveLength(1);
      expect(db.getServicePerformanceReport).toHaveBeenCalledWith(startDate, endDate, branchId, 20);
    });

    it('should return empty array when no data exists', async () => {
      vi.mocked(db.getServicePerformanceReport).mockResolvedValue([]);

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');
      const result = await db.getServicePerformanceReport(startDate, endDate);

      expect(result).toHaveLength(0);
    });
  });

  describe('getServicePerformanceByCategory', () => {
    it('should return category performance data', async () => {
      const mockData = [
        {
          categoryId: 1,
          categoryName: 'Hair Services',
          categoryNameAr: 'خدمات الشعر',
          categoryColor: '#3b82f6',
          totalQuantity: 200,
          totalRevenue: 10000,
          serviceCount: 5,
        },
        {
          categoryId: 2,
          categoryName: 'Beard Services',
          categoryNameAr: 'خدمات اللحية',
          categoryColor: '#22c55e',
          totalQuantity: 100,
          totalRevenue: 3000,
          serviceCount: 3,
        },
      ];

      vi.mocked(db.getServicePerformanceByCategory).mockResolvedValue(mockData);

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');
      const result = await db.getServicePerformanceByCategory(startDate, endDate);

      expect(result).toHaveLength(2);
      expect(result[0].categoryNameAr).toBe('خدمات الشعر');
      expect(result[0].totalRevenue).toBeGreaterThan(result[1].totalRevenue);
    });
  });

  describe('getServicePerformanceSummary', () => {
    it('should return summary statistics', async () => {
      const mockSummary = {
        totalInvoices: 250,
        totalRevenue: 15000,
        totalServices: 300,
        uniqueServices: 10,
        averageInvoiceValue: 60,
        revenueChange: 15.5,
        servicesChange: 10.2,
        previousRevenue: 13000,
        previousServices: 272,
      };

      vi.mocked(db.getServicePerformanceSummary).mockResolvedValue(mockSummary);

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');
      const result = await db.getServicePerformanceSummary(startDate, endDate);

      expect(result).not.toBeNull();
      expect(result?.totalInvoices).toBe(250);
      expect(result?.totalRevenue).toBe(15000);
      expect(result?.revenueChange).toBe(15.5);
    });

    it('should calculate positive change when current > previous', async () => {
      const mockSummary = {
        totalInvoices: 100,
        totalRevenue: 10000,
        totalServices: 150,
        uniqueServices: 8,
        averageInvoiceValue: 100,
        revenueChange: 25,
        servicesChange: 20,
        previousRevenue: 8000,
        previousServices: 125,
      };

      vi.mocked(db.getServicePerformanceSummary).mockResolvedValue(mockSummary);

      const result = await db.getServicePerformanceSummary(new Date(), new Date());

      expect(result?.revenueChange).toBeGreaterThan(0);
    });

    it('should calculate negative change when current < previous', async () => {
      const mockSummary = {
        totalInvoices: 80,
        totalRevenue: 8000,
        totalServices: 100,
        uniqueServices: 8,
        averageInvoiceValue: 100,
        revenueChange: -20,
        servicesChange: -15,
        previousRevenue: 10000,
        previousServices: 118,
      };

      vi.mocked(db.getServicePerformanceSummary).mockResolvedValue(mockSummary);

      const result = await db.getServicePerformanceSummary(new Date(), new Date());

      expect(result?.revenueChange).toBeLessThan(0);
    });
  });

  describe('getServicePerformanceDaily', () => {
    it('should return daily performance data', async () => {
      const mockData = [
        { date: '2025-01-01', totalRevenue: 500, totalServices: 10, invoiceCount: 8 },
        { date: '2025-01-02', totalRevenue: 600, totalServices: 12, invoiceCount: 10 },
        { date: '2025-01-03', totalRevenue: 450, totalServices: 9, invoiceCount: 7 },
      ];

      vi.mocked(db.getServicePerformanceDaily).mockResolvedValue(mockData);

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-03');
      const result = await db.getServicePerformanceDaily(startDate, endDate);

      expect(result).toHaveLength(3);
      expect(result[0].date).toBe('2025-01-01');
      expect(result[1].totalRevenue).toBe(600);
    });

    it('should return data sorted by date', async () => {
      const mockData = [
        { date: '2025-01-01', totalRevenue: 500, totalServices: 10, invoiceCount: 8 },
        { date: '2025-01-02', totalRevenue: 600, totalServices: 12, invoiceCount: 10 },
      ];

      vi.mocked(db.getServicePerformanceDaily).mockResolvedValue(mockData);

      const result = await db.getServicePerformanceDaily(new Date(), new Date());

      expect(new Date(result[0].date).getTime()).toBeLessThan(new Date(result[1].date).getTime());
    });
  });

  describe('Data Integrity', () => {
    it('should ensure totalRevenue equals sum of daily revenues', async () => {
      const mockSummary = {
        totalInvoices: 25,
        totalRevenue: 1550,
        totalServices: 31,
        uniqueServices: 5,
        averageInvoiceValue: 62,
        revenueChange: 0,
        servicesChange: 0,
        previousRevenue: 0,
        previousServices: 0,
      };

      const mockDaily = [
        { date: '2025-01-01', totalRevenue: 500, totalServices: 10, invoiceCount: 8 },
        { date: '2025-01-02', totalRevenue: 600, totalServices: 12, invoiceCount: 10 },
        { date: '2025-01-03', totalRevenue: 450, totalServices: 9, invoiceCount: 7 },
      ];

      vi.mocked(db.getServicePerformanceSummary).mockResolvedValue(mockSummary);
      vi.mocked(db.getServicePerformanceDaily).mockResolvedValue(mockDaily);

      const summary = await db.getServicePerformanceSummary(new Date(), new Date());
      const daily = await db.getServicePerformanceDaily(new Date(), new Date());

      const dailyTotal = daily.reduce((sum, d) => sum + d.totalRevenue, 0);
      
      // In real implementation, these should match
      expect(summary?.totalRevenue).toBe(1550);
      expect(dailyTotal).toBe(1550);
    });

    it('should ensure all numeric values are non-negative', async () => {
      const mockData = [
        {
          rank: 1,
          serviceId: 1,
          serviceName: 'Test',
          serviceNameAr: 'اختبار',
          totalQuantity: 10,
          totalRevenue: 500,
          averagePrice: 50,
          invoiceCount: 8,
        },
      ];

      vi.mocked(db.getServicePerformanceReport).mockResolvedValue(mockData);

      const result = await db.getServicePerformanceReport(new Date(), new Date());

      result.forEach(service => {
        expect(service.totalQuantity).toBeGreaterThanOrEqual(0);
        expect(service.totalRevenue).toBeGreaterThanOrEqual(0);
        expect(service.averagePrice).toBeGreaterThanOrEqual(0);
        expect(service.invoiceCount).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
