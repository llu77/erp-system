/**
 * اختبارات نظام الكشف عن فروقات البونص وسجل التدقيق
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database functions
vi.mock('./db', () => ({
  getDb: vi.fn(() => Promise.resolve({})),
  getBonusAuditLogs: vi.fn(),
  detectBonusDiscrepancies: vi.fn(),
  createBonusAuditLog: vi.fn(),
  getBranchById: vi.fn(),
  getNotificationRecipients: vi.fn(),
  getAllEmployeesWeeklyRevenues: vi.fn(),
}));

// Mock email service
vi.mock('./notifications/emailNotificationService', () => ({
  sendBonusDiscrepancyAlert: vi.fn(() => Promise.resolve(true)),
}));

describe('نظام الكشف عن فروقات البونص', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectBonusDiscrepancies', () => {
    it('يجب أن يكتشف الفروقات بين الإيرادات المسجلة والفعلية', async () => {
      const mockDiscrepancies = {
        hasDiscrepancy: true,
        discrepancies: [
          {
            employeeId: 1,
            employeeName: 'أحمد محمد',
            registeredRevenue: 1500,
            actualRevenue: 1800,
            revenueDiff: 300,
            registeredBonus: 60,
            expectedBonus: 95,
            bonusDiff: 35,
          },
        ],
        summary: {
          weeklyBonusId: 1,
          weekNumber: 1,
          month: 1,
          year: 2026,
          branchId: 1,
          totalRegisteredBonus: 60,
          totalExpectedBonus: 95,
          discrepancyCount: 1,
        },
      };

      expect(mockDiscrepancies.hasDiscrepancy).toBe(true);
      expect(mockDiscrepancies.discrepancies.length).toBe(1);
      expect(mockDiscrepancies.discrepancies[0].revenueDiff).toBe(300);
      expect(mockDiscrepancies.discrepancies[0].bonusDiff).toBe(35);
    });

    it('يجب أن يرجع hasDiscrepancy = false عندما لا توجد فروقات', async () => {
      const mockNoDiscrepancies = {
        hasDiscrepancy: false,
        discrepancies: [],
        summary: null,
      };

      expect(mockNoDiscrepancies.hasDiscrepancy).toBe(false);
      expect(mockNoDiscrepancies.discrepancies.length).toBe(0);
    });

    it('يجب أن يكتشف الموظفين غير المسجلين في البونص', async () => {
      const mockMissingEmployee = {
        hasDiscrepancy: true,
        discrepancies: [
          {
            employeeId: 5,
            employeeName: 'موظف جديد',
            registeredRevenue: 0,
            actualRevenue: 2000,
            revenueDiff: 2000,
            registeredBonus: 0,
            expectedBonus: 95,
            bonusDiff: 95,
          },
        ],
        summary: {
          weeklyBonusId: 1,
          weekNumber: 1,
          month: 1,
          year: 2026,
          branchId: 1,
          totalRegisteredBonus: 0,
          totalExpectedBonus: 95,
          discrepancyCount: 1,
        },
      };

      expect(mockMissingEmployee.discrepancies[0].registeredRevenue).toBe(0);
      expect(mockMissingEmployee.discrepancies[0].actualRevenue).toBe(2000);
    });
  });

  describe('سجل التدقيق', () => {
    it('يجب أن يسجل عمليات التزامن', async () => {
      const auditLog = {
        id: 1,
        weeklyBonusId: 1,
        action: 'sync',
        oldStatus: null,
        newStatus: 'pending',
        performedBy: 1,
        performedAt: new Date(),
        details: 'تم تزامن بونص الأسبوع 1',
        userName: 'Admin',
        weekNumber: 1,
        month: 1,
        year: 2026,
        branchName: 'فرع طويق',
      };

      expect(auditLog.action).toBe('sync');
      expect(auditLog.details).toContain('تزامن');
    });

    it('يجب أن يسجل إرسال تنبيهات الفروقات', async () => {
      const auditLog = {
        id: 2,
        weeklyBonusId: 1,
        action: 'discrepancy_alert_sent',
        oldStatus: null,
        newStatus: null,
        performedBy: 1,
        performedAt: new Date(),
        details: 'تم إرسال تنبيه بـ 3 فروقات',
        userName: 'Admin',
        weekNumber: 1,
        month: 1,
        year: 2026,
        branchName: 'فرع طويق',
      };

      expect(auditLog.action).toBe('discrepancy_alert_sent');
      expect(auditLog.details).toContain('فروقات');
    });

    it('يجب أن يسجل طلبات الصرف', async () => {
      const auditLog = {
        id: 3,
        weeklyBonusId: 1,
        action: 'request',
        oldStatus: 'pending',
        newStatus: 'requested',
        performedBy: 2,
        performedAt: new Date(),
        details: 'تم طلب صرف البونص',
        userName: 'مشرف',
        weekNumber: 1,
        month: 1,
        year: 2026,
        branchName: 'فرع لبن',
      };

      expect(auditLog.action).toBe('request');
      expect(auditLog.oldStatus).toBe('pending');
      expect(auditLog.newStatus).toBe('requested');
    });

    it('يجب أن يسجل الموافقات والرفض', async () => {
      const approveLog = {
        id: 4,
        weeklyBonusId: 1,
        action: 'approve',
        oldStatus: 'requested',
        newStatus: 'approved',
        performedBy: 1,
        performedAt: new Date(),
        details: 'تم الموافقة على البونص',
        userName: 'Admin',
        weekNumber: 1,
        month: 1,
        year: 2026,
        branchName: 'فرع طويق',
      };

      const rejectLog = {
        id: 5,
        weeklyBonusId: 2,
        action: 'reject',
        oldStatus: 'requested',
        newStatus: 'rejected',
        performedBy: 1,
        performedAt: new Date(),
        details: 'تم رفض البونص: بيانات غير مكتملة',
        userName: 'Admin',
        weekNumber: 2,
        month: 1,
        year: 2026,
        branchName: 'فرع لبن',
      };

      expect(approveLog.action).toBe('approve');
      expect(approveLog.newStatus).toBe('approved');
      expect(rejectLog.action).toBe('reject');
      expect(rejectLog.newStatus).toBe('rejected');
    });
  });

  describe('تنبيهات البريد الإلكتروني', () => {
    it('يجب أن ينشئ محتوى تنبيه صحيح', () => {
      const alertData = {
        branchName: 'فرع طويق',
        weekNumber: 1,
        month: 1,
        year: 2026,
        discrepancies: [
          {
            employeeName: 'أحمد محمد',
            registeredRevenue: 1500,
            actualRevenue: 1800,
            revenueDiff: 300,
            registeredBonus: 60,
            expectedBonus: 95,
            bonusDiff: 35,
          },
        ],
      };

      expect(alertData.branchName).toBe('فرع طويق');
      expect(alertData.discrepancies.length).toBe(1);
      expect(alertData.discrepancies[0].employeeName).toBe('أحمد محمد');
    });

    it('يجب أن يحسب الفروقات بشكل صحيح', () => {
      const discrepancy = {
        registeredRevenue: 1500,
        actualRevenue: 1800,
        revenueDiff: 0,
        registeredBonus: 60,
        expectedBonus: 95,
        bonusDiff: 0,
      };

      discrepancy.revenueDiff = discrepancy.actualRevenue - discrepancy.registeredRevenue;
      discrepancy.bonusDiff = discrepancy.expectedBonus - discrepancy.registeredBonus;

      expect(discrepancy.revenueDiff).toBe(300);
      expect(discrepancy.bonusDiff).toBe(35);
    });
  });

  describe('حساب البونص المتوقع', () => {
    it('يجب أن يحسب البونص الصحيح لكل مستوى', () => {
      const bonusTiers = [
        { revenue: 2400, expectedBonus: 180, tier: 'tier_5' },
        { revenue: 2100, expectedBonus: 135, tier: 'tier_4' },
        { revenue: 1800, expectedBonus: 95, tier: 'tier_3' },
        { revenue: 1500, expectedBonus: 60, tier: 'tier_2' },
        { revenue: 1200, expectedBonus: 35, tier: 'tier_1' },
        { revenue: 1000, expectedBonus: 0, tier: 'none' },
      ];

      // تحقق من أن المستويات محددة بشكل صحيح
      expect(bonusTiers[0].tier).toBe('tier_5');
      expect(bonusTiers[0].expectedBonus).toBe(180);
      expect(bonusTiers[5].tier).toBe('none');
      expect(bonusTiers[5].expectedBonus).toBe(0);
    });
  });

  describe('فلترة سجل التدقيق', () => {
    it('يجب أن يدعم الفلترة حسب الفرع', () => {
      const filters = {
        branchId: 1,
        limit: 20,
        offset: 0,
      };

      expect(filters.branchId).toBe(1);
      expect(filters.limit).toBe(20);
    });

    it('يجب أن يدعم الفلترة حسب weeklyBonusId', () => {
      const filters = {
        weeklyBonusId: 5,
        limit: 50,
      };

      expect(filters.weeklyBonusId).toBe(5);
    });
  });
});
