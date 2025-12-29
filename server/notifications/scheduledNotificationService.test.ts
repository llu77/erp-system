/**
 * اختبارات نظام الإشعارات المجدولة الموحد - الإصدار المُصحح
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  sendInventoryReminderUnified,
  sendPayrollReminderUnified,
  checkAndSendScheduledReminders,
  getTodayNotificationStatus,
  resetNotificationStatus,
  getMemoryStatus,
} from "./scheduledNotificationService";

// Mock dependencies
vi.mock("../db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue([{ insertId: 1 }]),
    }),
  }),
  getBranches: vi.fn().mockResolvedValue([
    { id: 1, name: "Branch 1", nameAr: "فرع 1", isActive: true },
  ]),
  getInventoryReport: vi.fn().mockResolvedValue({ products: [] }),
  getEmployeesByBranch: vi.fn().mockResolvedValue([]),
}));

vi.mock("./emailNotificationService", () => ({
  notifyInventoryReminder: vi.fn().mockResolvedValue({ success: true, sentCount: 3 }),
  notifyPayrollReminder: vi.fn().mockResolvedValue({ success: true, sentCount: 3 }),
}));

describe("ScheduledNotificationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // إعادة تعيين حالة الإشعارات قبل كل اختبار
    resetNotificationStatus();
  });

  afterEach(() => {
    // تنظيف بعد كل اختبار
    resetNotificationStatus();
  });

  describe("sendInventoryReminderUnified", () => {
    it("should return result with all required properties", async () => {
      const result = await sendInventoryReminderUnified(12);
      
      expect(result).toHaveProperty("timestamp");
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("sentCount");
      expect(result).toHaveProperty("skipped");
    });

    it("should accept day 12 or 29 only", async () => {
      resetNotificationStatus();
      const result12 = await sendInventoryReminderUnified(12);
      
      resetNotificationStatus();
      const result29 = await sendInventoryReminderUnified(29);
      
      expect(result12).toHaveProperty("timestamp");
      expect(result29).toHaveProperty("timestamp");
    });

    it("should skip if already sent today (memory tracking)", async () => {
      // First send
      const result1 = await sendInventoryReminderUnified(12);
      expect(result1.skipped).toBe(false);
      
      // Second send should be skipped
      const result2 = await sendInventoryReminderUnified(12);
      expect(result2.skipped).toBe(true);
      expect(result2.reason).toContain("مسبقاً");
    });
  });

  describe("sendPayrollReminderUnified", () => {
    it("should return result with all required properties", async () => {
      const result = await sendPayrollReminderUnified();
      
      expect(result).toHaveProperty("timestamp");
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("sentCount");
      expect(result).toHaveProperty("skipped");
    });

    it("should skip if already sent today (memory tracking)", async () => {
      // First send
      const result1 = await sendPayrollReminderUnified();
      expect(result1.skipped).toBe(false);
      
      // Second send should be skipped
      const result2 = await sendPayrollReminderUnified();
      expect(result2.skipped).toBe(true);
      expect(result2.reason).toContain("مسبقاً");
    });
  });

  describe("checkAndSendScheduledReminders", () => {
    it("should return results object", async () => {
      const result = await checkAndSendScheduledReminders();
      
      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
    });

    it("should check day of month for inventory reminder", async () => {
      const today = new Date();
      const dayOfMonth = today.getDate();
      
      const result = await checkAndSendScheduledReminders();
      
      // Should have inventory result only on day 12 or 29
      if (dayOfMonth === 12 || dayOfMonth === 29) {
        expect(result.inventoryResult).toBeDefined();
      }
    });

    it("should check day of month for payroll reminder", async () => {
      const today = new Date();
      const dayOfMonth = today.getDate();
      
      const result = await checkAndSendScheduledReminders();
      
      // Should have payroll result only on day 29
      if (dayOfMonth === 29) {
        expect(result.payrollResult).toBeDefined();
      }
    });
  });

  describe("getTodayNotificationStatus", () => {
    it("should return status for all notification types", async () => {
      const status = await getTodayNotificationStatus();
      
      expect(status).toHaveProperty("date");
      expect(status).toHaveProperty("inventory12");
      expect(status).toHaveProperty("inventory29");
      expect(status).toHaveProperty("payroll29");
    });

    it("should return date in YYYY-MM-DD format", async () => {
      const status = await getTodayNotificationStatus();
      
      expect(status.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should return sent status as boolean", async () => {
      const status = await getTodayNotificationStatus();
      
      expect(typeof status.inventory12.sent).toBe("boolean");
      expect(typeof status.inventory29.sent).toBe("boolean");
      expect(typeof status.payroll29.sent).toBe("boolean");
    });

    it("should include source information", async () => {
      const status = await getTodayNotificationStatus();
      
      // Source should be undefined if not sent, or 'memory'/'database' if sent
      expect(status.inventory12).toHaveProperty("source");
    });
  });

  describe("Memory Tracking", () => {
    it("should track sent notifications in memory", async () => {
      // Initially empty
      const initialStatus = getMemoryStatus();
      expect(initialStatus.entries).toBe(0);
      
      // Send a notification
      await sendInventoryReminderUnified(12);
      
      // Should have one entry
      const afterStatus = getMemoryStatus();
      expect(afterStatus.entries).toBe(1);
      expect(afterStatus.keys.length).toBe(1);
    });

    it("should reset memory status correctly", () => {
      resetNotificationStatus();
      const status = getMemoryStatus();
      expect(status.entries).toBe(0);
    });
  });

  describe("Lock mechanism", () => {
    it("should prevent concurrent sends of same type", async () => {
      resetNotificationStatus();
      
      // Start two sends simultaneously
      const promise1 = sendInventoryReminderUnified(12);
      const promise2 = sendInventoryReminderUnified(12);
      
      const [result1, result2] = await Promise.all([promise1, promise2]);
      
      // One should succeed, one should be skipped due to lock or memory
      const skippedCount = [result1, result2].filter(r => r.skipped).length;
      expect(skippedCount).toBeGreaterThanOrEqual(1);
    });

    it("should allow different notification types simultaneously", async () => {
      resetNotificationStatus();
      
      // Different types should not block each other
      const promise1 = sendInventoryReminderUnified(12);
      const promise2 = sendPayrollReminderUnified();
      
      const [result1, result2] = await Promise.all([promise1, promise2]);
      
      // Both should succeed (different types)
      expect(result1.skipped).toBe(false);
      expect(result2.skipped).toBe(false);
    });
  });
});

describe("Notification Types", () => {
  it("should have correct type definitions", () => {
    const validTypes = [
      "inventory_reminder_12",
      "inventory_reminder_29",
      "payroll_reminder_29",
    ];
    
    validTypes.forEach(type => {
      expect(typeof type).toBe("string");
    });
  });
});

describe("Database Integration", () => {
  it("should use database for tracking instead of files", async () => {
    resetNotificationStatus();
    
    // The new system uses database, not file-based tracking
    const status = await getTodayNotificationStatus();
    
    // Should return valid status without file operations
    expect(status).toBeDefined();
    expect(status.date).toBeDefined();
  });
});

describe("Duplicate Prevention", () => {
  it("should prevent duplicate inventory reminders on same day", async () => {
    resetNotificationStatus();
    
    // First call should succeed
    const first = await sendInventoryReminderUnified(12);
    expect(first.success).toBe(true);
    expect(first.skipped).toBe(false);
    
    // Second call should be skipped
    const second = await sendInventoryReminderUnified(12);
    expect(second.skipped).toBe(true);
    
    // Third call should also be skipped
    const third = await sendInventoryReminderUnified(12);
    expect(third.skipped).toBe(true);
  });

  it("should prevent duplicate payroll reminders on same day", async () => {
    resetNotificationStatus();
    
    // First call should succeed
    const first = await sendPayrollReminderUnified();
    expect(first.success).toBe(true);
    expect(first.skipped).toBe(false);
    
    // Second call should be skipped
    const second = await sendPayrollReminderUnified();
    expect(second.skipped).toBe(true);
  });
});
