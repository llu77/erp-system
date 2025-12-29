import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module
vi.mock('../db', () => ({
  getNotificationRecipients: vi.fn(),
  logSentNotification: vi.fn(),
}));

// Mock Resend
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ id: 'test-email-id' }),
    },
  })),
}));

import * as db from '../db';
import {
  getRecipients,
  sendAdvancedNotification,
  checkAndNotifyLowRevenue,
  checkAndNotifyHighExpense,
  notifyRevenueMismatch,
  sendMonthlyInventoryReminder,
  notifyEmployeeRequest,
  notifyBonusRequest,
  notifyPayrollCreated,
  sendTestNotification,
} from './advancedNotificationService';

describe('Advanced Notification Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRecipients', () => {
    it('should return all active recipients when no branchId is specified', async () => {
      const mockRecipients = [
        { id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', isActive: true, receiveRevenueAlerts: true },
        { id: 2, name: 'Manager', email: 'manager@test.com', role: 'general_supervisor', isActive: true, receiveRevenueAlerts: true },
      ];
      
      vi.mocked(db.getNotificationRecipients).mockResolvedValue(mockRecipients);
      
      const recipients = await getRecipients('low_revenue');
      
      expect(recipients.length).toBe(2);
    });

    it('should filter branch supervisors by branchId', async () => {
      const mockRecipients = [
        { id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', isActive: true, receiveRevenueAlerts: true },
        { id: 2, name: 'Branch 1 Supervisor', email: 'branch1@test.com', role: 'branch_supervisor', branchId: 1, isActive: true, receiveRevenueAlerts: true },
        { id: 3, name: 'Branch 2 Supervisor', email: 'branch2@test.com', role: 'branch_supervisor', branchId: 2, isActive: true, receiveRevenueAlerts: true },
      ];
      
      vi.mocked(db.getNotificationRecipients).mockResolvedValue(mockRecipients);
      
      const recipients = await getRecipients('low_revenue', 1);
      
      // Admin + Branch 1 Supervisor (not Branch 2)
      expect(recipients.length).toBe(2);
      expect(recipients.some((r: any) => r.branchId === 2)).toBe(false);
    });

    it('should filter recipients based on notification type preferences', async () => {
      const mockRecipients = [
        { id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', isActive: true, receiveRevenueAlerts: true, receiveExpenseAlerts: false },
        { id: 2, name: 'Manager', email: 'manager@test.com', role: 'general_supervisor', isActive: true, receiveRevenueAlerts: false, receiveExpenseAlerts: false },
      ];
      
      vi.mocked(db.getNotificationRecipients).mockResolvedValue(mockRecipients);
      
      const recipients = await getRecipients('low_revenue');
      
      // Only Admin has receiveRevenueAlerts enabled (Manager has both false)
      expect(recipients.length).toBe(1);
      expect(recipients[0].name).toBe('Admin');
    });
  });

  describe('checkAndNotifyLowRevenue', () => {
    it('should trigger notification when revenue is below threshold (500)', async () => {
      const mockRecipients = [
        { id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', isActive: true, receiveRevenueAlerts: true },
      ];
      
      vi.mocked(db.getNotificationRecipients).mockResolvedValue(mockRecipients);
      vi.mocked(db.logSentNotification).mockResolvedValue(null);
      
      const result = await checkAndNotifyLowRevenue({
        amount: 400,
        branchId: 1,
        branchName: 'فرع طويق',
        date: '2024-01-15',
      });
      
      expect(result.triggered).toBe(true);
    });

    it('should not trigger notification when revenue is above threshold', async () => {
      const result = await checkAndNotifyLowRevenue({
        amount: 600,
        branchId: 1,
        branchName: 'فرع طويق',
        date: '2024-01-15',
      });
      
      expect(result.triggered).toBe(false);
    });
  });

  describe('checkAndNotifyHighExpense', () => {
    it('should trigger notification when expense is above threshold (500)', async () => {
      const mockRecipients = [
        { id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', isActive: true, receiveExpenseAlerts: true },
      ];
      
      vi.mocked(db.getNotificationRecipients).mockResolvedValue(mockRecipients);
      vi.mocked(db.logSentNotification).mockResolvedValue(null);
      
      const result = await checkAndNotifyHighExpense({
        amount: 600,
        branchId: 1,
        branchName: 'فرع طويق',
        date: '2024-01-15',
        category: 'إيجار',
      });
      
      expect(result.triggered).toBe(true);
    });

    it('should not trigger notification when expense is below threshold', async () => {
      const result = await checkAndNotifyHighExpense({
        amount: 400,
        date: '2024-01-15',
      });
      
      expect(result.triggered).toBe(false);
    });
  });

  describe('notifyRevenueMismatch', () => {
    it('should send mismatch notification', async () => {
      const mockRecipients = [
        { id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', isActive: true, receiveMismatchAlerts: true },
      ];
      
      vi.mocked(db.getNotificationRecipients).mockResolvedValue(mockRecipients);
      vi.mocked(db.logSentNotification).mockResolvedValue(null);
      
      const result = await notifyRevenueMismatch({
        branchId: 1,
        branchName: 'فرع طويق',
        date: '2024-01-15',
        reason: 'فرق في النقدية',
        difference: 50,
      });
      
      expect(result.success).toBe(true);
    });
  });

  describe('sendMonthlyInventoryReminder', () => {
    it('should return result with skipped flag when not on reminder day', async () => {
      // هذه الدالة معطلة وتستخدم النظام الموحد
      // ترجع skipped: true إذا لم يكن اليوم 12 أو 29
      const today = new Date();
      const dayOfMonth = today.getDate();
      
      const result = await sendMonthlyInventoryReminder();
      
      // الدالة ترجع skipped: true إذا لم يكن اليوم 12 أو 29
      if (dayOfMonth !== 12 && dayOfMonth !== 29) {
        expect(result.skipped).toBe(true);
      } else {
        // في يوم 12 أو 29، يمكن أن تنجح أو تُتخطى (إذا أُرسلت مسبقاً)
        expect(result).toHaveProperty('success');
      }
    });
  });

  describe('notifyEmployeeRequest', () => {
    it('should send employee request notification', async () => {
      const mockRecipients = [
        { id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', isActive: true, receiveRequestNotifications: true },
      ];
      
      vi.mocked(db.getNotificationRecipients).mockResolvedValue(mockRecipients);
      vi.mocked(db.logSentNotification).mockResolvedValue(null);
      
      const result = await notifyEmployeeRequest({
        employeeName: 'محمد أحمد',
        requestType: 'إجازة',
        branchId: 1,
        branchName: 'فرع طويق',
      });
      
      expect(result.success).toBe(true);
    });
  });

  describe('notifyBonusRequest', () => {
    it('should send bonus request notification', async () => {
      const mockRecipients = [
        { id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', isActive: true, receiveBonusNotifications: true },
      ];
      
      vi.mocked(db.getNotificationRecipients).mockResolvedValue(mockRecipients);
      vi.mocked(db.logSentNotification).mockResolvedValue(null);
      
      const result = await notifyBonusRequest({
        employeeName: 'محمد أحمد',
        amount: 500,
        branchId: 1,
        branchName: 'فرع طويق',
      });
      
      expect(result.success).toBe(true);
    });
  });

  describe('notifyPayrollCreated', () => {
    it('should send payroll creation notification', async () => {
      const mockRecipients = [
        { id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', isActive: true, receiveRequestNotifications: true },
      ];
      
      vi.mocked(db.getNotificationRecipients).mockResolvedValue(mockRecipients);
      vi.mocked(db.logSentNotification).mockResolvedValue(null);
      
      const result = await notifyPayrollCreated({
        branchId: 1,
        branchName: 'فرع طويق',
        month: 'يناير 2024',
        totalAmount: 50000,
        employeeCount: 10,
      });
      
      expect(result.success).toBe(true);
    });
  });

  describe('Notification Thresholds', () => {
    it('should use 500 SAR as low revenue threshold', async () => {
      // Test at boundary
      const result499 = await checkAndNotifyLowRevenue({
        amount: 499,
        branchId: 1,
        branchName: 'Test',
        date: '2024-01-15',
      });
      expect(result499.triggered).toBe(true);
      
      const result500 = await checkAndNotifyLowRevenue({
        amount: 500,
        branchId: 1,
        branchName: 'Test',
        date: '2024-01-15',
      });
      expect(result500.triggered).toBe(false);
    });

    it('should use 500 SAR as high expense threshold', async () => {
      // Test at boundary
      const result500 = await checkAndNotifyHighExpense({
        amount: 500,
        date: '2024-01-15',
      });
      expect(result500.triggered).toBe(false);
      
      const result501 = await checkAndNotifyHighExpense({
        amount: 501,
        date: '2024-01-15',
      });
      expect(result501.triggered).toBe(true);
    });
  });

  describe('Branch-specific notifications', () => {
    it('should send to branch supervisor only for their branch', async () => {
      const mockRecipients = [
        { id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', isActive: true, receiveRevenueAlerts: true },
        { id: 2, name: 'Tuwaiq Supervisor', email: 'tuwaiq@test.com', role: 'branch_supervisor', branchId: 1, isActive: true, receiveRevenueAlerts: true },
        { id: 3, name: 'Laban Supervisor', email: 'laban@test.com', role: 'branch_supervisor', branchId: 2, isActive: true, receiveRevenueAlerts: true },
      ];
      
      vi.mocked(db.getNotificationRecipients).mockResolvedValue(mockRecipients);
      
      // Get recipients for branch 1 (Tuwaiq)
      const recipientsBranch1 = await getRecipients('low_revenue', 1);
      
      // Should include Admin and Tuwaiq Supervisor, but not Laban Supervisor
      expect(recipientsBranch1.length).toBe(2);
      expect(recipientsBranch1.some((r: any) => r.email === 'admin@test.com')).toBe(true);
      expect(recipientsBranch1.some((r: any) => r.email === 'tuwaiq@test.com')).toBe(true);
      expect(recipientsBranch1.some((r: any) => r.email === 'laban@test.com')).toBe(false);
    });
  });
});
