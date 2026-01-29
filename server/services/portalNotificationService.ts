/**
 * Portal Notification Service
 * خدمة إشعارات بوابة الموظفين والمشرفين
 */

import { getDb } from "../db";
import { portalNotifications, PortalNotification } from "../../drizzle/schema";
import { eq, and, desc, isNull, or, lte, sql } from "drizzle-orm";

// ==================== Types ====================

export type NotificationType = 
  | "request_approved"
  | "request_rejected"
  | "request_pending"
  | "document_expiring"
  | "document_expired"
  | "salary_ready"
  | "bonus_approved"
  | "announcement"
  | "task_assigned"
  | "reminder"
  | "system";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export interface CreateNotificationInput {
  employeeId: number;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: {
    requestId?: number;
    requestType?: string;
    documentType?: string;
    expiryDate?: string;
    amount?: number;
    branchId?: number;
    branchName?: string;
  };
  priority?: NotificationPriority;
  expiresAt?: Date;
}

export interface NotificationFilters {
  employeeId: number;
  unreadOnly?: boolean;
  type?: NotificationType;
  limit?: number;
  offset?: number;
}

// ==================== Core Functions ====================

/**
 * إنشاء إشعار جديد
 */
export async function createNotification(input: CreateNotificationInput): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const result = await db.insert(portalNotifications).values({
    employeeId: input.employeeId,
    type: input.type,
    title: input.title,
    message: input.message,
    actionUrl: input.actionUrl || null,
    actionLabel: input.actionLabel || null,
    metadata: input.metadata || null,
    priority: input.priority || "normal",
    expiresAt: input.expiresAt || null,
    isRead: false,
  });

  return (result[0] as any)?.insertId || 0;
}

/**
 * إنشاء إشعارات متعددة (bulk)
 */
export async function createBulkNotifications(inputs: CreateNotificationInput[]): Promise<number[]> {
  if (inputs.length === 0) return [];

  const db = await getDb();
  if (!db) return [];

  const values = inputs.map(input => ({
    employeeId: input.employeeId,
    type: input.type,
    title: input.title,
    message: input.message,
    actionUrl: input.actionUrl || null,
    actionLabel: input.actionLabel || null,
    metadata: input.metadata || null,
    priority: input.priority || "normal",
    expiresAt: input.expiresAt || null,
    isRead: false,
  }));

  const result = await db.insert(portalNotifications).values(values);
  
  // Return array of IDs starting from insertId
  const startId = (result[0] as any)?.insertId || 0;
  return Array.from({ length: inputs.length }, (_, i) => startId + i);
}

/**
 * جلب إشعارات الموظف
 */
export async function getNotifications(filters: NotificationFilters): Promise<PortalNotification[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(portalNotifications.employeeId, filters.employeeId)];

  // فلترة غير المقروءة فقط
  if (filters.unreadOnly) {
    conditions.push(eq(portalNotifications.isRead, false));
  }

  // فلترة حسب النوع
  if (filters.type) {
    conditions.push(eq(portalNotifications.type, filters.type));
  }

  // استبعاد المنتهية الصلاحية
  conditions.push(
    or(
      isNull(portalNotifications.expiresAt),
      lte(sql`NOW()`, portalNotifications.expiresAt)
    )!
  );

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const notifications = await db
    .select()
    .from(portalNotifications)
    .where(and(...conditions))
    .orderBy(desc(portalNotifications.createdAt))
    .limit(limit)
    .offset(offset);

  return notifications;
}

/**
 * عدد الإشعارات غير المقروءة
 */
export async function getUnreadCount(employeeId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(portalNotifications)
    .where(
      and(
        eq(portalNotifications.employeeId, employeeId),
        eq(portalNotifications.isRead, false),
        or(
          isNull(portalNotifications.expiresAt),
          lte(sql`NOW()`, portalNotifications.expiresAt)
        )
      )
    );

  return result[0]?.count || 0;
}

/**
 * تحديد إشعار كمقروء
 */
export async function markAsRead(notificationId: number, employeeId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db
    .update(portalNotifications)
    .set({ 
      isRead: true, 
      readAt: new Date() 
    })
    .where(
      and(
        eq(portalNotifications.id, notificationId),
        eq(portalNotifications.employeeId, employeeId)
      )
    );

  return (result[0] as any)?.affectedRows > 0;
}

/**
 * تحديد جميع الإشعارات كمقروءة
 */
export async function markAllAsRead(employeeId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const result = await db
    .update(portalNotifications)
    .set({ 
      isRead: true, 
      readAt: new Date() 
    })
    .where(
      and(
        eq(portalNotifications.employeeId, employeeId),
        eq(portalNotifications.isRead, false)
      )
    );

  return (result[0] as any)?.affectedRows || 0;
}

/**
 * حذف إشعار
 */
export async function deleteNotification(notificationId: number, employeeId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db
    .delete(portalNotifications)
    .where(
      and(
        eq(portalNotifications.id, notificationId),
        eq(portalNotifications.employeeId, employeeId)
      )
    );

  return (result[0] as any)?.affectedRows > 0;
}

/**
 * حذف الإشعارات المنتهية الصلاحية
 */
export async function deleteExpiredNotifications(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const result = await db
    .delete(portalNotifications)
    .where(
      and(
        lte(portalNotifications.expiresAt, new Date()),
        eq(portalNotifications.isRead, true)
      )
    );

  return (result[0] as any)?.affectedRows || 0;
}

// ==================== Helper Functions for Common Notifications ====================

/**
 * إشعار الموافقة على طلب
 */
export async function notifyRequestApproved(
  employeeId: number,
  requestId: number,
  requestType: string,
  approverName?: string
): Promise<number> {
  const typeLabels: Record<string, string> = {
    salary_advance: "سلفة",
    leave: "إجازة",
    arrears: "صرف متأخرات",
    permission: "استئذان",
    objection: "اعتراض",
    resignation: "استقالة",
  };

  const label = typeLabels[requestType] || requestType;

  return createNotification({
    employeeId,
    type: "request_approved",
    title: `تمت الموافقة على طلب ${label}`,
    message: approverName 
      ? `تمت الموافقة على طلبك من قبل ${approverName}`
      : `تمت الموافقة على طلب ${label} الخاص بك`,
    actionUrl: `/employee-portal?tab=requests`,
    actionLabel: "عرض الطلب",
    metadata: { requestId, requestType },
    priority: "high",
  });
}

/**
 * إشعار رفض طلب
 */
export async function notifyRequestRejected(
  employeeId: number,
  requestId: number,
  requestType: string,
  reason?: string
): Promise<number> {
  const typeLabels: Record<string, string> = {
    salary_advance: "سلفة",
    leave: "إجازة",
    arrears: "صرف متأخرات",
    permission: "استئذان",
    objection: "اعتراض",
    resignation: "استقالة",
  };

  const label = typeLabels[requestType] || requestType;

  return createNotification({
    employeeId,
    type: "request_rejected",
    title: `تم رفض طلب ${label}`,
    message: reason 
      ? `تم رفض طلبك. السبب: ${reason}`
      : `تم رفض طلب ${label} الخاص بك`,
    actionUrl: `/employee-portal?tab=requests`,
    actionLabel: "عرض التفاصيل",
    metadata: { requestId, requestType },
    priority: "high",
  });
}

/**
 * إشعار وثيقة قاربت على الانتهاء
 */
export async function notifyDocumentExpiring(
  employeeId: number,
  documentType: string,
  expiryDate: Date,
  daysRemaining: number
): Promise<number> {
  const docLabels: Record<string, string> = {
    residency: "الإقامة",
    health_certificate: "الشهادة الصحية",
    contract: "عقد العمل",
  };

  const label = docLabels[documentType] || documentType;

  return createNotification({
    employeeId,
    type: "document_expiring",
    title: `تنبيه: ${label} قاربت على الانتهاء`,
    message: `ستنتهي صلاحية ${label} خلال ${daysRemaining} يوم. يرجى تجديدها قبل ${expiryDate.toLocaleDateString("ar-SA")}`,
    actionUrl: `/employee-portal?tab=profile`,
    actionLabel: "تحديث البيانات",
    metadata: { 
      documentType, 
      expiryDate: expiryDate.toISOString() 
    },
    priority: daysRemaining <= 7 ? "urgent" : "high",
  });
}

/**
 * إشعار وثيقة منتهية
 */
export async function notifyDocumentExpired(
  employeeId: number,
  documentType: string
): Promise<number> {
  const docLabels: Record<string, string> = {
    residency: "الإقامة",
    health_certificate: "الشهادة الصحية",
    contract: "عقد العمل",
  };

  const label = docLabels[documentType] || documentType;

  return createNotification({
    employeeId,
    type: "document_expired",
    title: `تحذير: ${label} منتهية الصلاحية`,
    message: `انتهت صلاحية ${label}. يرجى تجديدها فوراً`,
    actionUrl: `/employee-portal?tab=profile`,
    actionLabel: "تحديث البيانات",
    metadata: { documentType },
    priority: "urgent",
  });
}

/**
 * إشعار الراتب جاهز
 */
export async function notifySalaryReady(
  employeeId: number,
  month: string,
  amount: number
): Promise<number> {
  return createNotification({
    employeeId,
    type: "salary_ready",
    title: "الراتب جاهز للصرف",
    message: `راتب شهر ${month} بقيمة ${amount.toLocaleString("ar-SA")} ريال جاهز للصرف`,
    actionUrl: `/employee-portal?tab=salary`,
    actionLabel: "عرض التفاصيل",
    metadata: { amount },
    priority: "high",
  });
}

/**
 * إشعار الموافقة على البونص
 */
export async function notifyBonusApproved(
  employeeId: number,
  amount: number,
  weekNumber: number
): Promise<number> {
  return createNotification({
    employeeId,
    type: "bonus_approved",
    title: "تمت الموافقة على البونص",
    message: `تمت الموافقة على بونص الأسبوع ${weekNumber} بقيمة ${amount.toLocaleString("ar-SA")} ريال`,
    actionUrl: `/employee-portal?tab=bonus`,
    actionLabel: "عرض التفاصيل",
    metadata: { amount },
    priority: "normal",
  });
}

/**
 * إشعار إعلان عام
 */
export async function notifyAnnouncement(
  employeeIds: number[],
  title: string,
  message: string,
  branchId?: number,
  branchName?: string
): Promise<number[]> {
  const inputs: CreateNotificationInput[] = employeeIds.map(employeeId => ({
    employeeId,
    type: "announcement" as NotificationType,
    title,
    message,
    metadata: branchId ? { branchId, branchName } : undefined,
    priority: "normal" as NotificationPriority,
  }));

  return createBulkNotifications(inputs);
}

/**
 * إشعار طلب جديد للمشرف
 */
export async function notifySupervisorNewRequest(
  supervisorEmployeeId: number,
  requestId: number,
  requestType: string,
  employeeName: string,
  branchName: string
): Promise<number> {
  const typeLabels: Record<string, string> = {
    salary_advance: "سلفة",
    leave: "إجازة",
    arrears: "صرف متأخرات",
    permission: "استئذان",
    objection: "اعتراض",
    resignation: "استقالة",
  };

  const label = typeLabels[requestType] || requestType;

  return createNotification({
    employeeId: supervisorEmployeeId,
    type: "request_pending",
    title: `طلب ${label} جديد`,
    message: `قدم ${employeeName} طلب ${label} في فرع ${branchName}`,
    actionUrl: `/admin-employee-portal?tab=requests`,
    actionLabel: "مراجعة الطلب",
    metadata: { requestId, requestType, branchName },
    priority: "normal",
  });
}
