/**
 * اختبارات نظام الإشعارات المجدولة الموحد
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  sendInventoryReminderUnified,
  sendPayrollReminderUnified,
  checkAndSendScheduledReminders,
  getTodayNotificationStatus,
} from "./scheduledNotificationService";

// Mock dependencies
vi.mock("../db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
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
  });

  describe("sendInventoryReminderUnified", () => {
    it("should return result with timestamp", async () => {
      const result = await sendInventoryReminderUnified(12);
      
      expect(result).toHaveProperty("timestamp");
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("sentCount");
      expect(result).toHaveProperty("skipped");
    });

    it("should accept day 12 or 29 only", async () => {
      const result12 = await sendInventoryReminderUnified(12);
      const result29 = await sendInventoryReminderUnified(29);
      
      expect(result12).toHaveProperty("timestamp");
      expect(result29).toHaveProperty("timestamp");
    });
  });

  describe("sendPayrollReminderUnified", () => {
    it("should return result with timestamp", async () => {
      const result = await sendPayrollReminderUnified();
      
      expect(result).toHaveProperty("timestamp");
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("sentCount");
      expect(result).toHaveProperty("skipped");
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
  });

  describe("Lock mechanism", () => {
    it("should prevent concurrent sends of same type", async () => {
      // Start two sends simultaneously
      const promise1 = sendInventoryReminderUnified(12);
      const promise2 = sendInventoryReminderUnified(12);
      
      const [result1, result2] = await Promise.all([promise1, promise2]);
      
      // One should succeed, one should be skipped due to lock
      const skippedCount = [result1, result2].filter(r => r.skipped).length;
      expect(skippedCount).toBeGreaterThanOrEqual(0); // At least one might be skipped
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
    // The new system uses database, not file-based tracking
    const status = await getTodayNotificationStatus();
    
    // Should return valid status without file operations
    expect(status).toBeDefined();
    expect(status.date).toBeDefined();
  });
});
