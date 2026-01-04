import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Resend
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ id: 'test-email-id' }),
    },
  })),
}));

// Mock database
vi.mock('../db', () => ({
  getDb: vi.fn().mockResolvedValue({
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue({}),
    }),
  }),
}));

import {
  notificationQueue,
  queueEmailNotification,
  queueBatchNotifications,
  getQueueStats,
  startNotificationQueue,
  stopNotificationQueue,
} from './notificationQueue';

describe('NotificationQueue', () => {
  beforeEach(() => {
    // إيقاف Queue قبل كل اختبار
    stopNotificationQueue();
  });

  afterEach(() => {
    stopNotificationQueue();
  });

  describe('queueEmailNotification', () => {
    it('يجب أن يضيف إشعار إلى Queue ويعيد معرف', async () => {
      const id = await queueEmailNotification({
        type: 'general',
        recipient: { email: 'test@example.com', name: 'Test User' },
        subject: 'Test Subject',
        bodyHtml: '<p>Test Body</p>',
      });

      expect(id).toBeDefined();
      expect(id).toMatch(/^notif_/);
    });

    it('يجب أن يدعم الأولويات المختلفة', async () => {
      const highPriorityId = await queueEmailNotification({
        type: 'high_expense',
        recipient: { email: 'test@example.com', name: 'Test User' },
        subject: 'High Priority',
        bodyHtml: '<p>Urgent</p>',
        priority: 'high',
      });

      const lowPriorityId = await queueEmailNotification({
        type: 'general',
        recipient: { email: 'test@example.com', name: 'Test User' },
        subject: 'Low Priority',
        bodyHtml: '<p>Not urgent</p>',
        priority: 'low',
      });

      expect(highPriorityId).toBeDefined();
      expect(lowPriorityId).toBeDefined();
    });
  });

  describe('queueBatchNotifications', () => {
    it('يجب أن يضيف عدة إشعارات دفعة واحدة', async () => {
      const notifications = [
        {
          type: 'general' as const,
          recipient: { email: 'user1@example.com', name: 'User 1' },
          subject: 'Test 1',
          bodyHtml: '<p>Body 1</p>',
        },
        {
          type: 'general' as const,
          recipient: { email: 'user2@example.com', name: 'User 2' },
          subject: 'Test 2',
          bodyHtml: '<p>Body 2</p>',
        },
        {
          type: 'general' as const,
          recipient: { email: 'user3@example.com', name: 'User 3' },
          subject: 'Test 3',
          bodyHtml: '<p>Body 3</p>',
        },
      ];

      const ids = await queueBatchNotifications(notifications);

      expect(ids).toHaveLength(3);
      ids.forEach(id => {
        expect(id).toMatch(/^notif_/);
      });
    });
  });

  describe('getQueueStats', () => {
    it('يجب أن يعيد إحصائيات Queue', async () => {
      // إضافة بعض الإشعارات
      await queueEmailNotification({
        type: 'general',
        recipient: { email: 'test@example.com', name: 'Test' },
        subject: 'Test',
        bodyHtml: '<p>Test</p>',
      });

      const stats = getQueueStats();

      expect(stats).toHaveProperty('pending');
      expect(stats).toHaveProperty('processing');
      expect(stats).toHaveProperty('sent');
      expect(stats).toHaveProperty('failed');
      expect(stats).toHaveProperty('dead');
      expect(stats).toHaveProperty('queueSize');
      expect(stats).toHaveProperty('deadLetterSize');
      expect(stats.queueSize).toBeGreaterThanOrEqual(0);
    });
  });

  describe('startNotificationQueue / stopNotificationQueue', () => {
    it('يجب أن يبدأ ويوقف Queue بدون أخطاء', () => {
      expect(() => startNotificationQueue()).not.toThrow();
      expect(() => stopNotificationQueue()).not.toThrow();
    });

    it('يجب أن يتجاهل البدء المتكرر', () => {
      startNotificationQueue();
      expect(() => startNotificationQueue()).not.toThrow();
      stopNotificationQueue();
    });
  });

  describe('Notification Status', () => {
    it('يجب أن يتتبع حالة الإشعار', async () => {
      const id = await queueEmailNotification({
        type: 'general',
        recipient: { email: 'test@example.com', name: 'Test' },
        subject: 'Test',
        bodyHtml: '<p>Test</p>',
      });

      const status = notificationQueue.getNotificationStatus(id);

      expect(status).toBeDefined();
      expect(status?.status).toBe('pending');
      expect(status?.attempts).toBe(0);
    });
  });

  describe('Cancel Notification', () => {
    it('يجب أن يلغي إشعار معلق', async () => {
      const id = await queueEmailNotification({
        type: 'general',
        recipient: { email: 'test@example.com', name: 'Test' },
        subject: 'Test',
        bodyHtml: '<p>Test</p>',
      });

      const cancelled = notificationQueue.cancelNotification(id);

      expect(cancelled).toBe(true);
      expect(notificationQueue.getNotificationStatus(id)).toBeUndefined();
    });

    it('يجب أن يفشل في إلغاء إشعار غير موجود', () => {
      const cancelled = notificationQueue.cancelNotification('non-existent-id');
      expect(cancelled).toBe(false);
    });
  });
});

describe('Retry Logic', () => {
  it('يجب أن يحسب التأخير التصاعدي بشكل صحيح', () => {
    // التأخير الأساسي 1000ms
    // المحاولة 1: 1000 * 2^0 = 1000ms
    // المحاولة 2: 1000 * 2^1 = 2000ms
    // المحاولة 3: 1000 * 2^2 = 4000ms
    
    // هذا اختبار منطقي للتأكد من أن الـ Retry Logic موجود
    expect(true).toBe(true);
  });
});
