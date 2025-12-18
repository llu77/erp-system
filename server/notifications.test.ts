import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db module
vi.mock("./db", () => ({
  createNotification: vi.fn().mockResolvedValue({ id: 1 }),
  getAllNotifications: vi.fn().mockResolvedValue([
    {
      id: 1,
      userId: 1,
      title: "إشعار اختباري",
      message: "هذا إشعار اختباري",
      type: "info",
      isRead: false,
      createdAt: new Date(),
    },
  ]),
  getUserNotifications: vi.fn().mockResolvedValue([
    {
      id: 1,
      userId: 1,
      title: "إشعار اختباري",
      message: "هذا إشعار اختباري",
      type: "info",
      isRead: false,
      createdAt: new Date(),
    },
  ]),
  getUnreadNotifications: vi.fn().mockResolvedValue([
    {
      id: 1,
      userId: 1,
      title: "إشعار اختباري",
      message: "هذا إشعار اختباري",
      type: "info",
      isRead: false,
      createdAt: new Date(),
    },
  ]),
  markNotificationAsRead: vi.fn().mockResolvedValue(undefined),
  markAllNotificationsAsRead: vi.fn().mockResolvedValue(undefined),
  deleteNotification: vi.fn().mockResolvedValue(undefined),
  getAllUsers: vi.fn().mockResolvedValue([
    { id: 1, name: "User 1", role: "admin" },
    { id: 2, name: "User 2", role: "employee" },
  ]),
  createActivityLog: vi.fn().mockResolvedValue(undefined),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createManagerContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "manager-user",
    email: "manager@example.com",
    name: "Manager User",
    loginMethod: "manus",
    role: "manager",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createEmployeeContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 3,
    openId: "employee-user",
    email: "employee@example.com",
    name: "Employee User",
    loginMethod: "manus",
    role: "employee",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("notifications router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("notifications.list", () => {
    it("returns notifications for authenticated user", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.notifications.list();

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("إشعار اختباري");
    });
  });

  describe("notifications.unread", () => {
    it("returns unread notifications for authenticated user", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.notifications.unread();

      expect(result).toHaveLength(1);
      expect(result[0].isRead).toBe(false);
    });
  });

  describe("notifications.markAsRead", () => {
    it("marks a notification as read", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.notifications.markAsRead({ id: 1 });

      expect(result.success).toBe(true);
    });
  });

  describe("notifications.markAllAsRead", () => {
    it("marks all notifications as read", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.notifications.markAllAsRead();

      expect(result.success).toBe(true);
    });
  });

  describe("notifications.sendCustom", () => {
    it("allows admin to send custom notification", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.notifications.sendCustom({
        title: "إشعار مخصص",
        message: "هذا إشعار مخصص من المسؤول",
        type: "system",
      });

      expect(result).toEqual({ success: true, message: "تم إرسال الإشعار بنجاح" });
    });

    it("allows manager to send custom notification", async () => {
      const ctx = createManagerContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.notifications.sendCustom({
        title: "إشعار من المدير",
        message: "هذا إشعار من المدير",
        type: "low_stock",
      });

      expect(result).toEqual({ success: true, message: "تم إرسال الإشعار بنجاح" });
    });

    it("allows sending notification to specific user", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.notifications.sendCustom({
        title: "إشعار خاص",
        message: "هذا إشعار خاص لمستخدم محدد",
        type: "system",
        userId: 2,
      });

      expect(result).toEqual({ success: true, message: "تم إرسال الإشعار بنجاح" });
    });
  });

  describe("notifications.delete", () => {
    it("deletes a notification", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.notifications.delete({ id: 1 });

      expect(result.success).toBe(true);
    });
  });
});

describe("role-based access control", () => {
  it("employee cannot send custom notifications", async () => {
    const ctx = createEmployeeContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.notifications.sendCustom({
        title: "إشعار",
        message: "محاولة إرسال",
        type: "system",
      })
    ).rejects.toThrow();
  });
});
