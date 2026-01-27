/**
 * اختبارات cron job تنبيهات تراجع الأداء
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the database
vi.mock('../db', () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue({}),
  }),
}));

// Mock email service
vi.mock('../email/emailService', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock notification service
vi.mock('../_core/notification', () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

describe('Performance Alerts Cron Job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sendPerformanceAlerts', () => {
    it('should have the correct function signature', async () => {
      const { sendPerformanceAlerts } = await import('../notifications/performanceAlerts');
      expect(typeof sendPerformanceAlerts).toBe('function');
    });

    it('should return correct structure', async () => {
      const { sendPerformanceAlerts } = await import('../notifications/performanceAlerts');
      const result = await sendPerformanceAlerts();
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('alertsSent');
      expect(result).toHaveProperty('errors');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.alertsSent).toBe('number');
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });

  describe('analyzeEmployeePerformance', () => {
    it('should have the correct function signature', async () => {
      const { analyzeEmployeePerformance } = await import('../notifications/performanceAlerts');
      expect(typeof analyzeEmployeePerformance).toBe('function');
    });

    it('should accept optional branchId parameter', async () => {
      const { analyzeEmployeePerformance } = await import('../notifications/performanceAlerts');
      
      // Should not throw when called without parameters
      const result1 = await analyzeEmployeePerformance();
      expect(Array.isArray(result1)).toBe(true);
      
      // Should not throw when called with branchId
      const result2 = await analyzeEmployeePerformance(1);
      expect(Array.isArray(result2)).toBe(true);
    });
  });

  describe('getSupervisorAlerts', () => {
    it('should have the correct function signature', async () => {
      const { getSupervisorAlerts } = await import('../notifications/performanceAlerts');
      expect(typeof getSupervisorAlerts).toBe('function');
    });

    it('should return an array', async () => {
      const { getSupervisorAlerts } = await import('../notifications/performanceAlerts');
      const result = await getSupervisorAlerts();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getPerformanceAlertsForSupervisor', () => {
    it('should have the correct function signature', async () => {
      const { getPerformanceAlertsForSupervisor } = await import('../notifications/performanceAlerts');
      expect(typeof getPerformanceAlertsForSupervisor).toBe('function');
    });

    it('should return correct structure', async () => {
      const { getPerformanceAlertsForSupervisor } = await import('../notifications/performanceAlerts');
      const result = await getPerformanceAlertsForSupervisor(1, 1);
      
      expect(result).toHaveProperty('hasAlerts');
      expect(result).toHaveProperty('declinedEmployees');
      expect(result).toHaveProperty('summary');
      expect(typeof result.hasAlerts).toBe('boolean');
      expect(Array.isArray(result.declinedEmployees)).toBe(true);
      expect(typeof result.summary).toBe('string');
    });
  });

  describe('Cron Scheduler Integration', () => {
    it('should have performance_alerts job defined in createScheduledJobs', async () => {
      // التحقق من وجود المهمة في الكود
      const fs = await import('fs');
      const path = await import('path');
      const cronSchedulerPath = path.join(process.cwd(), 'server/scheduler/cronScheduler.ts');
      const content = fs.readFileSync(cronSchedulerPath, 'utf-8');
      
      expect(content).toContain("id: 'performance_alerts'");
      expect(content).toContain('تنبيهات تراجع الأداء');
      expect(content).toContain("cronExpression: '30 7 * * *'");
    });
  });

  describe('Duplicate Prevention', () => {
    it('should have duplicate prevention logic in sendPerformanceAlerts', async () => {
      // التحقق من وجود منطق منع التكرار في الكود
      const fs = await import('fs');
      const path = await import('path');
      const alertsPath = path.join(process.cwd(), 'server/notifications/performanceAlerts.ts');
      const content = fs.readFileSync(alertsPath, 'utf-8');
      
      // يجب أن يحتوي على فحص الإشعارات المرسلة سابقاً
      expect(content).toContain('existingAlerts');
      expect(content).toContain('performance_alert');
      expect(content).toContain('Alerts already sent today');
    });
  });
});
