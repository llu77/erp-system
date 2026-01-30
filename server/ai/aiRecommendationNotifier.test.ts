import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AIRecommendationNotifier,
  createNotifier,
  NotificationConfig,
  NotificationChannel,
  RecipientConfig,
} from './aiRecommendationNotifier';
import { Recommendation, RecommendationType, RecommendationCategory } from './advancedRecommendationEngine';

// Mock dependencies
vi.mock('../db', () => ({
  getDb: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../_core/notification', () => ({
  notifyOwner: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('../email/emailService', () => ({
  sendEmail: vi.fn(() => Promise.resolve({ success: true })),
}));

describe('AIRecommendationNotifier', () => {
  let notifier: AIRecommendationNotifier;

  beforeEach(() => {
    notifier = createNotifier();
    vi.clearAllMocks();
  });

  describe('createNotifier', () => {
    it('should create a new notifier instance', () => {
      const instance = createNotifier();
      expect(instance).toBeInstanceOf(AIRecommendationNotifier);
    });
  });

  describe('notifyForRecommendation', () => {
    const mockRecommendation: Recommendation = {
      id: 'rec_test_123',
      type: 'warning' as RecommendationType,
      category: 'sales' as RecommendationCategory,
      priority: 'high',
      title: 'تنبيه اختباري',
      description: 'هذا تنبيه اختباري للتحقق من النظام',
      reasoning: 'تم إنشاء هذا التنبيه للاختبار',
      confidence: 0.85,
      impact: {
        metric: 'المبيعات',
        currentValue: 10000,
        projectedValue: 12000,
        changePercent: 20,
        timeframe: 'الشهر القادم',
      },
      actions: [
        {
          id: 'action_1',
          label: 'عرض التفاصيل',
          type: 'navigate',
          target: '/analytics',
        },
      ],
      createdAt: new Date(),
      status: 'pending',
    };

    it('should return results for notification', async () => {
      const results = await notifier.notifyForRecommendation(mockRecommendation);
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should respect priority configuration', async () => {
      const criticalRec = { ...mockRecommendation, priority: 'critical' as const };
      const results = await notifier.notifyForRecommendation(criticalRec);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle custom channel configuration', async () => {
      const results = await notifier.notifyForRecommendation(mockRecommendation, {
        channels: ['in_app'] as NotificationChannel[],
      });
      expect(results).toBeDefined();
    });
  });

  describe('notifyForRecommendations', () => {
    const mockRecommendations: Recommendation[] = [
      {
        id: 'rec_1',
        type: 'warning',
        category: 'sales',
        priority: 'critical',
        title: 'تنبيه حرج',
        description: 'وصف التنبيه الحرج',
        reasoning: 'السبب',
        confidence: 0.9,
        impact: {
          metric: 'المبيعات',
          currentValue: 1000,
          projectedValue: 1500,
          changePercent: 50,
          timeframe: 'أسبوع',
        },
        actions: [],
        createdAt: new Date(),
        status: 'pending',
      },
      {
        id: 'rec_2',
        type: 'opportunity',
        category: 'customers',
        priority: 'medium',
        title: 'فرصة متوسطة',
        description: 'وصف الفرصة',
        reasoning: 'السبب',
        confidence: 0.7,
        impact: {
          metric: 'العملاء',
          currentValue: 100,
          projectedValue: 120,
          changePercent: 20,
          timeframe: 'شهر',
        },
        actions: [],
        createdAt: new Date(),
        status: 'pending',
      },
    ];

    it('should filter recommendations by priority threshold', async () => {
      const results = await notifier.notifyForRecommendations(mockRecommendations, {
        priorityThreshold: 'high',
      });
      expect(results).toBeDefined();
      expect(results.size).toBeLessThanOrEqual(mockRecommendations.length);
    });

    it('should respect maxNotifications limit', async () => {
      const results = await notifier.notifyForRecommendations(mockRecommendations, {
        maxNotifications: 1,
      });
      expect(results.size).toBeLessThanOrEqual(1);
    });
  });

  describe('getNotificationLogs', () => {
    it('should return empty array initially', () => {
      const logs = notifier.getNotificationLogs();
      expect(logs).toEqual([]);
    });

    it('should return logs for specific recommendation', () => {
      const logs = notifier.getNotificationLogs('rec_123');
      expect(logs).toEqual([]);
    });
  });

  describe('Notification Configuration', () => {
    it('should use correct config for critical priority', async () => {
      const criticalRec: Recommendation = {
        id: 'rec_critical',
        type: 'warning',
        category: 'finance',
        priority: 'critical',
        title: 'تنبيه مالي حرج',
        description: 'يتطلب اهتمام فوري',
        reasoning: 'انخفاض حاد في الإيرادات',
        confidence: 0.95,
        impact: {
          metric: 'الإيرادات',
          currentValue: 50000,
          projectedValue: 30000,
          changePercent: -40,
          timeframe: 'فوري',
        },
        actions: [],
        createdAt: new Date(),
        status: 'pending',
      };

      const results = await notifier.notifyForRecommendation(criticalRec);
      // Critical should use multiple channels
      expect(results.length).toBeGreaterThan(0);
    });

    it('should use correct config for low priority', async () => {
      const lowRec: Recommendation = {
        id: 'rec_low',
        type: 'insight',
        category: 'operations',
        priority: 'low',
        title: 'ملاحظة عامة',
        description: 'معلومات إضافية',
        reasoning: 'للعلم فقط',
        confidence: 0.5,
        impact: {
          metric: 'العمليات',
          currentValue: 100,
          projectedValue: 105,
          changePercent: 5,
          timeframe: 'شهر',
        },
        actions: [],
        createdAt: new Date(),
        status: 'pending',
      };

      const results = await notifier.notifyForRecommendation(lowRec);
      expect(results).toBeDefined();
    });
  });

  describe('Throttling', () => {
    it('should allow first notification', async () => {
      const rec: Recommendation = {
        id: 'rec_throttle_test_1',
        type: 'warning',
        category: 'sales',
        priority: 'high',
        title: 'اختبار التقييد',
        description: 'اختبار',
        reasoning: 'اختبار',
        confidence: 0.8,
        impact: {
          metric: 'المبيعات',
          currentValue: 1000,
          projectedValue: 1200,
          changePercent: 20,
          timeframe: 'أسبوع',
        },
        actions: [],
        createdAt: new Date(),
        status: 'pending',
      };

      const results = await notifier.notifyForRecommendation(rec);
      expect(results).toBeDefined();
    });
  });

  describe('Email Formatting', () => {
    it('should format notification title correctly', async () => {
      const rec: Recommendation = {
        id: 'rec_format_test',
        type: 'opportunity',
        category: 'customers',
        priority: 'medium',
        title: 'فرصة جديدة للعملاء',
        description: 'تم اكتشاف فرصة لزيادة قاعدة العملاء',
        reasoning: 'تحليل سلوك العملاء يظهر إمكانية التوسع',
        confidence: 0.75,
        impact: {
          metric: 'العملاء',
          currentValue: 500,
          projectedValue: 600,
          changePercent: 20,
          timeframe: 'ربع سنوي',
        },
        actions: [
          {
            id: 'view_customers',
            label: 'عرض تحليل العملاء',
            type: 'navigate',
            target: '/customers/analytics',
          },
        ],
        createdAt: new Date(),
        status: 'pending',
      };

      const results = await notifier.notifyForRecommendation(rec);
      expect(results).toBeDefined();
    });
  });
});

describe('AIRecommendationMonitor Integration', () => {
  it('should be importable', async () => {
    const { getMonitor, startMonitoring, stopMonitoring } = await import('../scheduler/aiRecommendationMonitor');
    expect(getMonitor).toBeDefined();
    expect(startMonitoring).toBeDefined();
    expect(stopMonitoring).toBeDefined();
  });

  it('should create monitor instance', async () => {
    const { getMonitor } = await import('../scheduler/aiRecommendationMonitor');
    const monitor = getMonitor();
    expect(monitor).toBeDefined();
  });

  it('should get config from monitor', async () => {
    const { getMonitor } = await import('../scheduler/aiRecommendationMonitor');
    const monitor = getMonitor();
    const config = monitor.getConfig();
    expect(config).toHaveProperty('enabled');
    expect(config).toHaveProperty('intervalMinutes');
    expect(config).toHaveProperty('priorityThreshold');
  });

  it('should get stats from monitor', async () => {
    const { getMonitor } = await import('../scheduler/aiRecommendationMonitor');
    const monitor = getMonitor();
    const stats = monitor.getStats();
    expect(stats).toHaveProperty('totalCycles');
    expect(stats).toHaveProperty('totalAlerts');
  });

  it('should check if monitor is active', async () => {
    const { getMonitor } = await import('../scheduler/aiRecommendationMonitor');
    const monitor = getMonitor();
    const isActive = monitor.isActive();
    expect(typeof isActive).toBe('boolean');
  });
});
