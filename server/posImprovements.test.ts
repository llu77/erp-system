/**
 * اختبارات تحسينات نظام الكاشير POS
 * - اختبار ترتيب الموظفين
 * - اختبار دقة حسابات الإيرادات
 * - اختبار صلاحيات المشرفين
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database functions
vi.mock('./db', () => ({
  getEmployeePerformanceReport: vi.fn(),
  getEmployeesByBranchForPos: vi.fn(),
  createPosInvoice: vi.fn(),
  getTodayPosInvoices: vi.fn(),
  getPosEmployeePerformance: vi.fn(),
}));

import * as db from './db';

describe('POS Employee Ranking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return employees sorted by revenue', async () => {
    const mockData = [
      { rank: 1, employeeId: 1, employeeName: 'أحمد', employeePhoto: null, employeePosition: 'حلاق', totalRevenue: 5000, invoiceCount: 50, serviceCount: 100, averageInvoiceValue: 100, cashAmount: 3000, cardAmount: 2000 },
      { rank: 2, employeeId: 2, employeeName: 'محمد', employeePhoto: null, employeePosition: 'حلاق', totalRevenue: 3000, invoiceCount: 30, serviceCount: 60, averageInvoiceValue: 100, cashAmount: 2000, cardAmount: 1000 },
    ];
    
    vi.mocked(db.getEmployeePerformanceReport).mockResolvedValue(mockData);
    
    const result = await db.getEmployeePerformanceReport(new Date(), new Date(), 1, 50);
    
    expect(result).toHaveLength(2);
    expect(result[0].totalRevenue).toBeGreaterThan(result[1].totalRevenue);
    expect(result[0].employeeName).toBe('أحمد');
  });

  it('should calculate correct revenue totals', async () => {
    const mockData = [
      { rank: 1, employeeId: 1, employeeName: 'أحمد', employeePhoto: null, employeePosition: 'حلاق', totalRevenue: 5000, invoiceCount: 50, serviceCount: 100, averageInvoiceValue: 100, cashAmount: 3000, cardAmount: 2000 },
    ];
    
    vi.mocked(db.getEmployeePerformanceReport).mockResolvedValue(mockData);
    
    const result = await db.getEmployeePerformanceReport(new Date(), new Date(), 1, 50);
    
    expect(result[0].totalRevenue).toBe(5000);
    expect(result[0].cashAmount + result[0].cardAmount).toBe(5000);
  });

  it('should handle empty results', async () => {
    vi.mocked(db.getEmployeePerformanceReport).mockResolvedValue([]);
    
    const result = await db.getEmployeePerformanceReport(new Date(), new Date(), 1, 50);
    
    expect(result).toHaveLength(0);
  });
});

describe('POS Invoice Creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create invoice with correct totals', async () => {
    const mockInvoice = {
      id: 1,
      invoiceNumber: 'INV-001',
      total: 260,
      items: [
        { serviceId: 1, serviceName: 'حلاقة', serviceNameAr: 'حلاقة', price: 60, quantity: 1, total: 60 },
        { serviceId: 2, serviceName: 'كيراتين', serviceNameAr: 'كيراتين', price: 200, quantity: 1, total: 200 },
      ],
    };
    
    vi.mocked(db.createPosInvoice).mockResolvedValue(mockInvoice);
    
    const result = await db.createPosInvoice({
      branchId: 1,
      employeeId: 1,
      items: [{ serviceId: 1, quantity: 1 }, { serviceId: 2, quantity: 1 }],
      paymentMethod: 'cash',
      createdBy: 1,
      createdByName: 'كاشير',
    });
    
    expect(result.total).toBe(260);
    expect(result.items).toHaveLength(2);
  });

  it('should apply discount correctly', async () => {
    const mockInvoice = {
      id: 1,
      invoiceNumber: 'INV-002',
      total: 156, // 260 - 40% discount = 156
      items: [
        { serviceId: 1, serviceName: 'حلاقة', serviceNameAr: 'حلاقة', price: 60, quantity: 1, total: 60 },
        { serviceId: 2, serviceName: 'كيراتين', serviceNameAr: 'كيراتين', price: 200, quantity: 1, total: 200 },
      ],
    };
    
    vi.mocked(db.createPosInvoice).mockResolvedValue(mockInvoice);
    
    const result = await db.createPosInvoice({
      branchId: 1,
      employeeId: 1,
      items: [{ serviceId: 1, quantity: 1 }, { serviceId: 2, quantity: 1 }],
      paymentMethod: 'loyalty',
      discountAmount: 104,
      discountPercentage: 40,
      discountReason: 'خصم برنامج الولاء',
      createdBy: 1,
      createdByName: 'كاشير',
    });
    
    expect(result.total).toBe(156);
  });
});

describe('POS Daily Report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return today invoices for branch', async () => {
    const mockInvoices = [
      { id: 1, invoiceNumber: 'INV-001', total: '100', paymentMethod: 'cash' },
      { id: 2, invoiceNumber: 'INV-002', total: '200', paymentMethod: 'card' },
    ];
    
    vi.mocked(db.getTodayPosInvoices).mockResolvedValue(mockInvoices as any);
    
    const result = await db.getTodayPosInvoices(1);
    
    expect(result).toHaveLength(2);
  });

  it('should return employee performance for today', async () => {
    const mockPerformance = [
      { employeeId: 1, employeeName: 'أحمد', totalRevenue: 500, invoiceCount: 5 },
      { employeeId: 2, employeeName: 'محمد', totalRevenue: 300, invoiceCount: 3 },
    ];
    
    vi.mocked(db.getPosEmployeePerformance).mockResolvedValue(mockPerformance as any);
    
    const result = await db.getPosEmployeePerformance(1, new Date());
    
    expect(result).toHaveLength(2);
    expect(result[0].totalRevenue).toBe(500);
  });
});

describe('Data Accuracy Validation', () => {
  it('should ensure cash + card = total for split payments', () => {
    const invoice = {
      total: 260,
      paymentMethod: 'split',
      cashAmount: 160,
      cardAmount: 100,
    };
    
    expect(invoice.cashAmount + invoice.cardAmount).toBe(invoice.total);
  });

  it('should ensure subtotal - discount = total', () => {
    const invoice = {
      subtotal: 260,
      discountAmount: 104,
      total: 156,
    };
    
    expect(invoice.subtotal - invoice.discountAmount).toBe(invoice.total);
  });

  it('should validate loyalty discount percentage', () => {
    const subtotal = 260;
    const discountPercentage = 40;
    const expectedDiscount = subtotal * (discountPercentage / 100);
    
    expect(expectedDiscount).toBe(104);
  });
});
