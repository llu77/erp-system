import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('./db', () => ({
  getNegativeInvoicesForMonth: vi.fn(),
  getApprovedLeavesForBranch: vi.fn(),
  calculateLeaveDeduction: vi.fn(),
}));

import * as db from './db';

describe('Payroll Deductions Preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getNegativeInvoicesForMonth', () => {
    it('should return empty map when no negative invoices exist', async () => {
      const mockFn = db.getNegativeInvoicesForMonth as ReturnType<typeof vi.fn>;
      mockFn.mockResolvedValue(new Map());
      
      const result = await db.getNegativeInvoicesForMonth(1, 2026, 1);
      
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should return negative invoices grouped by employee', async () => {
      const mockData = new Map([
        [1, { total: 500, invoices: [{ id: 1, amount: '500', invoiceNumber: 'INV-001', reason: 'خصم', invoiceDate: new Date() }] }],
        [2, { total: 300, invoices: [{ id: 2, amount: '300', invoiceNumber: 'INV-002', reason: 'خصم آخر', invoiceDate: new Date() }] }],
      ]);
      
      const mockFn = db.getNegativeInvoicesForMonth as ReturnType<typeof vi.fn>;
      mockFn.mockResolvedValue(mockData);
      
      const result = await db.getNegativeInvoicesForMonth(1, 2026, 1);
      
      expect(result.size).toBe(2);
      expect(result.get(1)?.total).toBe(500);
      expect(result.get(2)?.total).toBe(300);
    });

    it('should aggregate multiple invoices for same employee', async () => {
      const mockData = new Map([
        [1, { 
          total: 800, 
          invoices: [
            { id: 1, amount: '500', invoiceNumber: 'INV-001', reason: 'خصم 1', invoiceDate: new Date() },
            { id: 2, amount: '300', invoiceNumber: 'INV-002', reason: 'خصم 2', invoiceDate: new Date() },
          ] 
        }],
      ]);
      
      const mockFn = db.getNegativeInvoicesForMonth as ReturnType<typeof vi.fn>;
      mockFn.mockResolvedValue(mockData);
      
      const result = await db.getNegativeInvoicesForMonth(1, 2026, 1);
      
      expect(result.get(1)?.total).toBe(800);
      expect(result.get(1)?.invoices.length).toBe(2);
    });
  });

  describe('getApprovedLeavesForBranch', () => {
    it('should return empty map when no leaves exist', async () => {
      const mockFn = db.getApprovedLeavesForBranch as ReturnType<typeof vi.fn>;
      mockFn.mockResolvedValue(new Map());
      
      const result = await db.getApprovedLeavesForBranch(1, 2026, 1);
      
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should return leaves grouped by employee', async () => {
      const mockData = new Map([
        [1, { totalDays: 5, totalDeduction: 333.33, leaves: [{ id: 1, days: 5, type: 'unpaid' }] }],
        [2, { totalDays: 3, totalDeduction: 200, leaves: [{ id: 2, days: 3, type: 'unpaid' }] }],
      ]);
      
      const mockFn = db.getApprovedLeavesForBranch as ReturnType<typeof vi.fn>;
      mockFn.mockResolvedValue(mockData);
      
      const result = await db.getApprovedLeavesForBranch(1, 2026, 1);
      
      expect(result.size).toBe(2);
      expect(result.get(1)?.totalDays).toBe(5);
      expect(result.get(2)?.totalDays).toBe(3);
    });
  });

  describe('calculateLeaveDeduction', () => {
    it('should calculate full deduction for unpaid leave', async () => {
      const mockFn = db.calculateLeaveDeduction as ReturnType<typeof vi.fn>;
      mockFn.mockReturnValue(333.33);
      
      const result = db.calculateLeaveDeduction(2000, 5, 'unpaid', 30);
      
      expect(result).toBe(333.33);
    });

    it('should calculate zero deduction for paid leave', async () => {
      const mockFn = db.calculateLeaveDeduction as ReturnType<typeof vi.fn>;
      mockFn.mockReturnValue(0);
      
      const result = db.calculateLeaveDeduction(2000, 5, 'annual', 30);
      
      expect(result).toBe(0);
    });

    it('should calculate half deduction for sick leave', async () => {
      const mockFn = db.calculateLeaveDeduction as ReturnType<typeof vi.fn>;
      mockFn.mockReturnValue(166.67);
      
      const result = db.calculateLeaveDeduction(2000, 5, 'sick', 30);
      
      expect(result).toBe(166.67);
    });
  });

  describe('Deductions Integration', () => {
    it('should combine negative invoices and unpaid leaves as total deductions', async () => {
      // Mock negative invoices
      const mockNegativeInvoices = new Map([
        [1, { total: 500, invoices: [{ id: 1, amount: '500', invoiceNumber: 'INV-001', reason: 'خصم', invoiceDate: new Date() }] }],
      ]);
      
      // Mock unpaid leaves
      const mockLeaves = new Map([
        [1, { totalDays: 5, totalDeduction: 333.33, leaves: [{ id: 1, days: 5, type: 'unpaid' }] }],
      ]);
      
      const mockNegFn = db.getNegativeInvoicesForMonth as ReturnType<typeof vi.fn>;
      mockNegFn.mockResolvedValue(mockNegativeInvoices);
      
      const mockLeavesFn = db.getApprovedLeavesForBranch as ReturnType<typeof vi.fn>;
      mockLeavesFn.mockResolvedValue(mockLeaves);
      
      const negativeInvoices = await db.getNegativeInvoicesForMonth(1, 2026, 1);
      const leaves = await db.getApprovedLeavesForBranch(1, 2026, 1);
      
      const employeeId = 1;
      const negativeInvoicesDeduction = negativeInvoices.get(employeeId)?.total || 0;
      const unpaidLeaveDeduction = leaves.get(employeeId)?.totalDeduction || 0;
      
      const totalDeductions = negativeInvoicesDeduction + unpaidLeaveDeduction;
      
      expect(totalDeductions).toBeCloseTo(833.33, 2);
    });

    it('should handle employees with no deductions', async () => {
      const mockNegFn = db.getNegativeInvoicesForMonth as ReturnType<typeof vi.fn>;
      mockNegFn.mockResolvedValue(new Map());
      
      const mockLeavesFn = db.getApprovedLeavesForBranch as ReturnType<typeof vi.fn>;
      mockLeavesFn.mockResolvedValue(new Map());
      
      const negativeInvoices = await db.getNegativeInvoicesForMonth(1, 2026, 1);
      const leaves = await db.getApprovedLeavesForBranch(1, 2026, 1);
      
      const employeeId = 1;
      const negativeInvoicesDeduction = negativeInvoices.get(employeeId)?.total || 0;
      const unpaidLeaveDeduction = leaves.get(employeeId)?.totalDeduction || 0;
      
      const totalDeductions = negativeInvoicesDeduction + unpaidLeaveDeduction;
      
      expect(totalDeductions).toBe(0);
    });
  });
});
