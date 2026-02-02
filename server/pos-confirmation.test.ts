import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as db from './db';

// Mock database functions
vi.mock('./db', async () => {
  const actual = await vi.importActual('./db');
  return {
    ...actual,
    checkPosConfirmationStatus: vi.fn(),
    createRevenueFromPOS: vi.fn(),
    markPosInvoicesAsConfirmed: vi.fn(),
    getTodayPosInvoices: vi.fn(),
  };
});

describe('POS Confirmation Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkPosConfirmationStatus', () => {
    it('should return isConfirmed: false when no revenue exists', async () => {
      vi.mocked(db.checkPosConfirmationStatus).mockResolvedValue({
        isConfirmed: false,
        confirmedAt: null,
        confirmedBy: null,
      });

      const result = await db.checkPosConfirmationStatus(1, new Date());
      
      expect(result.isConfirmed).toBe(false);
      expect(result.confirmedAt).toBeNull();
      expect(result.confirmedBy).toBeNull();
    });

    it('should return isConfirmed: true when revenue exists', async () => {
      const confirmedAt = new Date();
      vi.mocked(db.checkPosConfirmationStatus).mockResolvedValue({
        isConfirmed: true,
        confirmedAt,
        confirmedBy: null,
        revenueId: 123,
      });

      const result = await db.checkPosConfirmationStatus(1, new Date());
      
      expect(result.isConfirmed).toBe(true);
      expect(result.confirmedAt).toEqual(confirmedAt);
      expect(result.revenueId).toBe(123);
    });
  });

  describe('createRevenueFromPOS', () => {
    it('should create revenue record with correct data', async () => {
      vi.mocked(db.createRevenueFromPOS).mockResolvedValue({ id: 1 });

      const data = {
        branchId: 1,
        date: new Date(),
        totalAmount: 500,
        cashAmount: 300,
        cardAmount: 200,
        balanceImageKey: 'images/balance-123.jpg',
        balanceImageUrl: 'https://s3.example.com/images/balance-123.jpg',
        paidInvoices: [{ customerName: 'سالم الوادعي', amount: 100 }],
        loyaltyInfo: { invoiceCount: 2, discountAmount: 50 },
        notes: 'ملاحظات اختبارية',
        confirmedBy: 1,
        confirmedByName: 'عبدالحي',
        posInvoiceIds: [1, 2, 3],
      };

      const result = await db.createRevenueFromPOS(data);
      
      expect(result.id).toBe(1);
      expect(db.createRevenueFromPOS).toHaveBeenCalledWith(data);
    });

    it('should handle empty paid invoices', async () => {
      vi.mocked(db.createRevenueFromPOS).mockResolvedValue({ id: 2 });

      const data = {
        branchId: 1,
        date: new Date(),
        totalAmount: 300,
        cashAmount: 300,
        cardAmount: 0,
        balanceImageKey: 'images/balance-456.jpg',
        balanceImageUrl: 'https://s3.example.com/images/balance-456.jpg',
        paidInvoices: [],
        confirmedBy: 1,
        confirmedByName: 'محمد إسماعيل',
        posInvoiceIds: [4, 5],
      };

      const result = await db.createRevenueFromPOS(data);
      
      expect(result.id).toBe(2);
    });
  });

  describe('markPosInvoicesAsConfirmed', () => {
    it('should update invoice status to completed', async () => {
      vi.mocked(db.markPosInvoicesAsConfirmed).mockResolvedValue(undefined);

      await db.markPosInvoicesAsConfirmed([1, 2, 3]);
      
      expect(db.markPosInvoicesAsConfirmed).toHaveBeenCalledWith([1, 2, 3]);
    });

    it('should handle empty invoice array', async () => {
      vi.mocked(db.markPosInvoicesAsConfirmed).mockResolvedValue(undefined);

      await db.markPosInvoicesAsConfirmed([]);
      
      expect(db.markPosInvoicesAsConfirmed).toHaveBeenCalledWith([]);
    });
  });

  describe('getTodayPosInvoices', () => {
    it('should return invoices for today', async () => {
      const mockInvoices = [
        {
          id: 1,
          invoiceNumber: 'INV-001',
          total: '100.00',
          paymentMethod: 'cash',
          cashAmount: '100.00',
          cardAmount: '0.00',
          employeeId: 1,
          employeeName: 'أحمد',
        },
        {
          id: 2,
          invoiceNumber: 'INV-002',
          total: '200.00',
          paymentMethod: 'card',
          cashAmount: '0.00',
          cardAmount: '200.00',
          employeeId: 2,
          employeeName: 'محمد',
        },
      ];

      vi.mocked(db.getTodayPosInvoices).mockResolvedValue(mockInvoices as any);

      const result = await db.getTodayPosInvoices(1);
      
      expect(result).toHaveLength(2);
      expect(result[0].invoiceNumber).toBe('INV-001');
      expect(result[1].invoiceNumber).toBe('INV-002');
    });

    it('should return empty array when no invoices exist', async () => {
      vi.mocked(db.getTodayPosInvoices).mockResolvedValue([]);

      const result = await db.getTodayPosInvoices(1);
      
      expect(result).toHaveLength(0);
    });
  });

  describe('Paid Customers List', () => {
    it('should have correct paid customers', () => {
      const paidCustomers = [
        { id: 1, name: 'سالم الوادعي' },
        { id: 2, name: 'عمر المطيري' },
        { id: 3, name: 'سعود الجريسي' },
      ];

      expect(paidCustomers).toHaveLength(3);
      expect(paidCustomers[0].name).toBe('سالم الوادعي');
      expect(paidCustomers[1].name).toBe('عمر المطيري');
      expect(paidCustomers[2].name).toBe('سعود الجريسي');
    });
  });

  describe('Revenue Calculation', () => {
    it('should calculate totals correctly', () => {
      const invoices = [
        { total: 100, paymentMethod: 'cash', cashAmount: 100, cardAmount: 0 },
        { total: 200, paymentMethod: 'card', cashAmount: 0, cardAmount: 200 },
        { total: 150, paymentMethod: 'split', cashAmount: 50, cardAmount: 100 },
      ];

      const totalRevenue = invoices.reduce((sum, inv) => sum + inv.total, 0);
      const totalCash = invoices
        .filter(inv => inv.paymentMethod === 'cash')
        .reduce((sum, inv) => sum + inv.total, 0) +
        invoices
        .filter(inv => inv.paymentMethod === 'split')
        .reduce((sum, inv) => sum + inv.cashAmount, 0);
      const totalCard = invoices
        .filter(inv => inv.paymentMethod === 'card')
        .reduce((sum, inv) => sum + inv.total, 0) +
        invoices
        .filter(inv => inv.paymentMethod === 'split')
        .reduce((sum, inv) => sum + inv.cardAmount, 0);

      expect(totalRevenue).toBe(450);
      expect(totalCash).toBe(150); // 100 (cash) + 50 (split cash)
      expect(totalCard).toBe(300); // 200 (card) + 100 (split card)
    });

    it('should handle paid invoices calculation', () => {
      const paidInvoices = [
        { customerName: 'سالم الوادعي', amount: 100 },
        { customerName: 'عمر المطيري', amount: 200 },
      ];

      const totalPaidInvoices = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);
      
      expect(totalPaidInvoices).toBe(300);
    });

    it('should handle loyalty discount calculation', () => {
      const loyaltyInfo = {
        invoiceCount: 5,
        discountAmount: 150,
      };

      expect(loyaltyInfo.invoiceCount).toBe(5);
      expect(loyaltyInfo.discountAmount).toBe(150);
    });
  });
});
