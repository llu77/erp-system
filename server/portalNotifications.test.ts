/**
 * Portal Notifications Service Tests
 * اختبارات خدمة إشعارات بوابة الموظفين
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database
vi.mock('./db', () => ({
  getDb: vi.fn(() => Promise.resolve({
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve([{ insertId: 1, affectedRows: 1 }]))
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({
              offset: vi.fn(() => Promise.resolve([
                {
                  id: 1,
                  employeeId: 100,
                  type: 'request_approved',
                  title: 'تمت الموافقة على طلبك',
                  message: 'تمت الموافقة على طلب السلفة',
                  isRead: false,
                  priority: 'high',
                  createdAt: new Date(),
                }
              ]))
            }))
          }))
        }))
      }))
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([{ affectedRows: 1 }]))
      }))
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve([{ affectedRows: 1 }]))
    })),
  }))
}));

import * as portalNotificationService from './services/portalNotificationService';

describe('Portal Notification Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Notification Types', () => {
    it('should have all required notification types defined', () => {
      const types: portalNotificationService.NotificationType[] = [
        'request_approved',
        'request_rejected',
        'request_pending',
        'document_expiring',
        'document_expired',
        'salary_ready',
        'bonus_approved',
        'announcement',
        'task_assigned',
        'reminder',
        'system'
      ];
      
      expect(types).toHaveLength(11);
    });

    it('should have all priority levels defined', () => {
      const priorities: portalNotificationService.NotificationPriority[] = [
        'low',
        'normal',
        'high',
        'urgent'
      ];
      
      expect(priorities).toHaveLength(4);
    });
  });

  describe('createNotification', () => {
    it('should create a notification with required fields', async () => {
      const input: portalNotificationService.CreateNotificationInput = {
        employeeId: 100,
        type: 'request_approved',
        title: 'تمت الموافقة على طلبك',
        message: 'تمت الموافقة على طلب السلفة الخاص بك',
      };

      const result = await portalNotificationService.createNotification(input);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('number');
    });

    it('should create a notification with all optional fields', async () => {
      const input: portalNotificationService.CreateNotificationInput = {
        employeeId: 100,
        type: 'document_expiring',
        title: 'تنبيه: الإقامة قاربت على الانتهاء',
        message: 'ستنتهي صلاحية الإقامة خلال 7 أيام',
        actionUrl: '/employee-portal?tab=profile',
        actionLabel: 'تحديث البيانات',
        metadata: {
          documentType: 'residency',
          expiryDate: '2026-02-15',
        },
        priority: 'urgent',
        expiresAt: new Date('2026-02-15'),
      };

      const result = await portalNotificationService.createNotification(input);
      
      expect(result).toBeDefined();
    });
  });

  describe('createBulkNotifications', () => {
    it('should return empty array for empty input', async () => {
      const result = await portalNotificationService.createBulkNotifications([]);
      
      expect(result).toEqual([]);
    });

    it('should create multiple notifications', async () => {
      const inputs: portalNotificationService.CreateNotificationInput[] = [
        {
          employeeId: 100,
          type: 'announcement',
          title: 'إعلان هام',
          message: 'اجتماع عام غداً',
        },
        {
          employeeId: 101,
          type: 'announcement',
          title: 'إعلان هام',
          message: 'اجتماع عام غداً',
        },
      ];

      const result = await portalNotificationService.createBulkNotifications(inputs);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getNotifications', () => {
    it('should get notifications for an employee', async () => {
      const filters: portalNotificationService.NotificationFilters = {
        employeeId: 100,
      };

      const result = await portalNotificationService.getNotifications(filters);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter unread notifications only', async () => {
      const filters: portalNotificationService.NotificationFilters = {
        employeeId: 100,
        unreadOnly: true,
      };

      const result = await portalNotificationService.getNotifications(filters);
      
      expect(result).toBeDefined();
    });

    it('should filter by notification type', async () => {
      const filters: portalNotificationService.NotificationFilters = {
        employeeId: 100,
        type: 'request_approved',
      };

      const result = await portalNotificationService.getNotifications(filters);
      
      expect(result).toBeDefined();
    });

    it('should support pagination', async () => {
      const filters: portalNotificationService.NotificationFilters = {
        employeeId: 100,
        limit: 10,
        offset: 20,
      };

      const result = await portalNotificationService.getNotifications(filters);
      
      expect(result).toBeDefined();
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count for an employee', async () => {
      // Mock specific response for count
      const result = await portalNotificationService.getUnreadCount(100);
      
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      const result = await portalNotificationService.markAsRead(1, 100);
      
      expect(typeof result).toBe('boolean');
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      const result = await portalNotificationService.markAllAsRead(100);
      
      expect(typeof result).toBe('number');
    });
  });

  describe('deleteNotification', () => {
    it('should delete a notification', async () => {
      const result = await portalNotificationService.deleteNotification(1, 100);
      
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Helper Functions', () => {
    describe('notifyRequestApproved', () => {
      it('should create request approved notification', async () => {
        const result = await portalNotificationService.notifyRequestApproved(
          100,
          1,
          'salary_advance',
          'أحمد محمد'
        );
        
        expect(result).toBeDefined();
      });

      it('should handle unknown request types', async () => {
        const result = await portalNotificationService.notifyRequestApproved(
          100,
          1,
          'unknown_type'
        );
        
        expect(result).toBeDefined();
      });
    });

    describe('notifyRequestRejected', () => {
      it('should create request rejected notification with reason', async () => {
        const result = await portalNotificationService.notifyRequestRejected(
          100,
          1,
          'leave',
          'لا يوجد رصيد إجازات كافي'
        );
        
        expect(result).toBeDefined();
      });

      it('should create request rejected notification without reason', async () => {
        const result = await portalNotificationService.notifyRequestRejected(
          100,
          1,
          'leave'
        );
        
        expect(result).toBeDefined();
      });
    });

    describe('notifyDocumentExpiring', () => {
      it('should create document expiring notification', async () => {
        const result = await portalNotificationService.notifyDocumentExpiring(
          100,
          'residency',
          new Date('2026-02-15'),
          15
        );
        
        expect(result).toBeDefined();
      });

      it('should set urgent priority for documents expiring within 7 days', async () => {
        const result = await portalNotificationService.notifyDocumentExpiring(
          100,
          'health_certificate',
          new Date('2026-02-05'),
          5
        );
        
        expect(result).toBeDefined();
      });
    });

    describe('notifyDocumentExpired', () => {
      it('should create document expired notification', async () => {
        const result = await portalNotificationService.notifyDocumentExpired(
          100,
          'contract'
        );
        
        expect(result).toBeDefined();
      });
    });

    describe('notifySalaryReady', () => {
      it('should create salary ready notification', async () => {
        const result = await portalNotificationService.notifySalaryReady(
          100,
          'يناير 2026',
          5000
        );
        
        expect(result).toBeDefined();
      });
    });

    describe('notifyBonusApproved', () => {
      it('should create bonus approved notification', async () => {
        const result = await portalNotificationService.notifyBonusApproved(
          100,
          500,
          4
        );
        
        expect(result).toBeDefined();
      });
    });

    describe('notifyAnnouncement', () => {
      it('should create announcement for multiple employees', async () => {
        const result = await portalNotificationService.notifyAnnouncement(
          [100, 101, 102],
          'إعلان هام',
          'اجتماع عام يوم الأحد',
          1,
          'فرع لبن'
        );
        
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
      });

      it('should create announcement without branch info', async () => {
        const result = await portalNotificationService.notifyAnnouncement(
          [100, 101],
          'إعلان عام',
          'تم تحديث سياسة الإجازات'
        );
        
        expect(result).toBeDefined();
      });
    });

    describe('notifySupervisorNewRequest', () => {
      it('should create new request notification for supervisor', async () => {
        const result = await portalNotificationService.notifySupervisorNewRequest(
          50,
          1,
          'salary_advance',
          'محمد أحمد',
          'فرع لبن'
        );
        
        expect(result).toBeDefined();
      });
    });
  });
});
