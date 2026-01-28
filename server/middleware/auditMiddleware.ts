/**
 * Audit Middleware - التدقيق التلقائي لجميع عمليات tRPC
 * يسجل تلقائياً جميع العمليات الحساسة (Create, Update, Delete)
 */

import { logAuditEvent, AuditEventType, AuditContext } from "../audit/auditService";

// ==================== تصنيف العمليات ====================

interface AuditableOperation {
  eventType: AuditEventType;
  entityType: string;
  extractEntityId?: (input: unknown) => number | undefined;
  extractEntityName?: (input: unknown) => string | undefined;
  extractOldData?: (input: unknown) => Record<string, unknown> | undefined;
  extractNewData?: (input: unknown) => Record<string, unknown> | undefined;
  description?: string;
}

// قائمة العمليات التي يجب تدقيقها تلقائياً
const AUDITABLE_OPERATIONS: Record<string, AuditableOperation> = {
  // ==================== الموظفين ====================
  "employees.create": {
    eventType: "create",
    entityType: "employee",
    extractEntityName: (input: any) => input?.name,
    extractNewData: (input: any) => input,
    description: "إضافة موظف جديد"
  },
  "employees.update": {
    eventType: "update",
    entityType: "employee",
    extractEntityId: (input: any) => input?.id,
    extractEntityName: (input: any) => input?.name,
    extractNewData: (input: any) => input,
    description: "تحديث بيانات موظف"
  },
  "employees.delete": {
    eventType: "delete",
    entityType: "employee",
    extractEntityId: (input: any) => input?.id,
    description: "حذف موظف"
  },
  
  // ==================== المعاملات المالية ====================
  "revenues.create": {
    eventType: "create",
    entityType: "revenue",
    extractNewData: (input: any) => input,
    description: "إضافة إيراد جديد"
  },
  "revenues.update": {
    eventType: "update",
    entityType: "revenue",
    extractEntityId: (input: any) => input?.id,
    extractNewData: (input: any) => input,
    description: "تحديث إيراد"
  },
  "revenues.delete": {
    eventType: "delete",
    entityType: "revenue",
    extractEntityId: (input: any) => input?.id,
    description: "حذف إيراد"
  },
  
  "expenses.create": {
    eventType: "create",
    entityType: "expense",
    extractNewData: (input: any) => input,
    description: "إضافة مصروف جديد"
  },
  "expenses.update": {
    eventType: "update",
    entityType: "expense",
    extractEntityId: (input: any) => input?.id,
    extractNewData: (input: any) => input,
    description: "تحديث مصروف"
  },
  "expenses.delete": {
    eventType: "delete",
    entityType: "expense",
    extractEntityId: (input: any) => input?.id,
    description: "حذف مصروف"
  },
  
  // ==================== الرواتب ====================
  "payrolls.create": {
    eventType: "create",
    entityType: "payroll",
    extractNewData: (input: any) => input,
    description: "إنشاء مسير رواتب"
  },
  "payrolls.update": {
    eventType: "update",
    entityType: "payroll",
    extractEntityId: (input: any) => input?.id,
    extractNewData: (input: any) => input,
    description: "تحديث مسير رواتب"
  },
  "payrolls.delete": {
    eventType: "delete",
    entityType: "payroll",
    extractEntityId: (input: any) => input?.id,
    description: "حذف مسير رواتب"
  },
  
  // ==================== الطلبات ====================
  "requests.create": {
    eventType: "create",
    entityType: "request",
    extractNewData: (input: any) => input,
    description: "تقديم طلب جديد"
  },
  "requests.approve": {
    eventType: "approval",
    entityType: "request",
    extractEntityId: (input: any) => input?.id,
    description: "الموافقة على طلب"
  },
  "requests.reject": {
    eventType: "rejection",
    entityType: "request",
    extractEntityId: (input: any) => input?.id,
    description: "رفض طلب"
  },
  
  // ==================== المخزون ====================
  "inventory.create": {
    eventType: "create",
    entityType: "inventory",
    extractEntityName: (input: any) => input?.name,
    extractNewData: (input: any) => input,
    description: "إضافة منتج جديد"
  },
  "inventory.update": {
    eventType: "update",
    entityType: "inventory",
    extractEntityId: (input: any) => input?.id,
    extractEntityName: (input: any) => input?.name,
    extractNewData: (input: any) => input,
    description: "تحديث منتج"
  },
  "inventory.delete": {
    eventType: "delete",
    entityType: "inventory",
    extractEntityId: (input: any) => input?.id,
    description: "حذف منتج"
  },
  "inventory.adjustStock": {
    eventType: "update",
    entityType: "inventory_stock",
    extractEntityId: (input: any) => input?.productId,
    extractNewData: (input: any) => input,
    description: "تعديل كمية المخزون"
  },
  
  // ==================== أوامر الشراء ====================
  "purchaseOrders.create": {
    eventType: "create",
    entityType: "purchase_order",
    extractNewData: (input: any) => input,
    description: "إنشاء أمر شراء"
  },
  "purchaseOrders.approve": {
    eventType: "approval",
    entityType: "purchase_order",
    extractEntityId: (input: any) => input?.id,
    description: "الموافقة على أمر شراء"
  },
  
  // ==================== المستخدمين والصلاحيات ====================
  "users.create": {
    eventType: "create",
    entityType: "user",
    extractEntityName: (input: any) => input?.username,
    extractNewData: (input: any) => ({ ...input, password: "[REDACTED]" }),
    description: "إنشاء مستخدم جديد"
  },
  "users.updateRole": {
    eventType: "permission_change",
    entityType: "user",
    extractEntityId: (input: any) => input?.id,
    extractNewData: (input: any) => input,
    description: "تغيير صلاحيات مستخدم"
  },
  "users.delete": {
    eventType: "delete",
    entityType: "user",
    extractEntityId: (input: any) => input?.id,
    description: "حذف مستخدم"
  },
  
  // ==================== التقارير ====================
  "reports.export": {
    eventType: "export",
    entityType: "report",
    extractNewData: (input: any) => input,
    description: "تصدير تقرير"
  },
  
  // ==================== الإعدادات ====================
  "settings.update": {
    eventType: "config_change",
    entityType: "settings",
    extractNewData: (input: any) => input,
    description: "تغيير إعدادات النظام"
  },
};

// ==================== دالة التدقيق التلقائي ====================

export interface AuditMiddlewareContext {
  user?: {
    id: number;
    name: string;
    role: string;
    branchId?: number;
  };
  req?: {
    headers?: {
      "x-forwarded-for"?: string;
      "user-agent"?: string;
    };
    ip?: string;
  };
}

/**
 * تسجيل عملية تلقائياً بناءً على اسم الإجراء
 */
export async function auditOperation(
  procedurePath: string,
  input: unknown,
  context: AuditMiddlewareContext,
  result?: unknown,
  error?: Error
): Promise<void> {
  const operation = AUDITABLE_OPERATIONS[procedurePath];
  
  if (!operation) {
    // العملية غير مسجلة للتدقيق
    return;
  }
  
  try {
    const auditContext: AuditContext = {
      userId: context.user?.id,
      userName: context.user?.name,
      userRole: context.user?.role,
      userBranchId: context.user?.branchId,
      ipAddress: context.req?.headers?.["x-forwarded-for"] || context.req?.ip,
      userAgent: context.req?.headers?.["user-agent"],
    };
    
    // استخراج البيانات من المدخلات
    const entityId = operation.extractEntityId?.(input);
    const entityName = operation.extractEntityName?.(input);
    const newData = operation.extractNewData?.(input);
    
    // إضافة معلومات الخطأ إذا وجد
    let description = operation.description || "";
    if (error) {
      description += ` - فشل: ${error.message}`;
    }
    
    // إضافة معرف الكيان المنشأ من النتيجة
    let finalEntityId = entityId;
    if (!finalEntityId && result && typeof result === "object" && "id" in result) {
      finalEntityId = (result as { id: number }).id;
    }
    
    await logAuditEvent({
      eventType: error ? "login_failed" : operation.eventType, // استخدام login_failed للإشارة للفشل
      entityType: operation.entityType,
      entityId: finalEntityId,
      entityName,
      newData: newData as Record<string, unknown>,
      description,
      context: auditContext,
    });
    
  } catch (auditError) {
    // لا نريد أن يفشل التدقيق يوقف العملية الأصلية
    console.error("[AuditMiddleware] Error logging audit event:", auditError);
  }
}

/**
 * تسجيل عملية تسجيل الدخول
 */
export async function auditLogin(
  success: boolean,
  username: string,
  userId?: number,
  context?: AuditMiddlewareContext
): Promise<void> {
  try {
    await logAuditEvent({
      eventType: success ? "login" : "login_failed",
      entityType: "auth",
      entityId: userId,
      entityName: username,
      description: success ? "تسجيل دخول ناجح" : "محاولة تسجيل دخول فاشلة",
      context: {
        userId,
        userName: username,
        ipAddress: context?.req?.headers?.["x-forwarded-for"] || context?.req?.ip,
        userAgent: context?.req?.headers?.["user-agent"],
      },
    });
  } catch (error) {
    console.error("[AuditMiddleware] Error logging login event:", error);
  }
}

/**
 * تسجيل عملية تسجيل الخروج
 */
export async function auditLogout(
  userId: number,
  username: string,
  context?: AuditMiddlewareContext
): Promise<void> {
  try {
    await logAuditEvent({
      eventType: "logout",
      entityType: "auth",
      entityId: userId,
      entityName: username,
      description: "تسجيل خروج",
      context: {
        userId,
        userName: username,
        ipAddress: context?.req?.headers?.["x-forwarded-for"] || context?.req?.ip,
        userAgent: context?.req?.headers?.["user-agent"],
      },
    });
  } catch (error) {
    console.error("[AuditMiddleware] Error logging logout event:", error);
  }
}

/**
 * تسجيل عملية تصدير تقرير
 */
export async function auditReportExport(
  reportType: string,
  reportName: string,
  context: AuditMiddlewareContext,
  filters?: Record<string, unknown>
): Promise<void> {
  try {
    await logAuditEvent({
      eventType: "export",
      entityType: "report",
      entityName: reportName,
      newData: { reportType, filters },
      description: `تصدير تقرير: ${reportName}`,
      context: {
        userId: context.user?.id,
        userName: context.user?.name,
        userRole: context.user?.role,
        userBranchId: context.user?.branchId,
        ipAddress: context.req?.headers?.["x-forwarded-for"] || context.req?.ip,
        userAgent: context.req?.headers?.["user-agent"],
      },
    });
  } catch (error) {
    console.error("[AuditMiddleware] Error logging report export:", error);
  }
}

/**
 * تسجيل عملية مجمعة (bulk operation)
 */
export async function auditBulkOperation(
  operationType: string,
  entityType: string,
  affectedCount: number,
  context: AuditMiddlewareContext,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await logAuditEvent({
      eventType: "bulk_operation",
      entityType,
      newData: { operationType, affectedCount, ...details },
      description: `عملية مجمعة: ${operationType} على ${affectedCount} ${entityType}`,
      context: {
        userId: context.user?.id,
        userName: context.user?.name,
        userRole: context.user?.role,
        userBranchId: context.user?.branchId,
        ipAddress: context.req?.headers?.["x-forwarded-for"] || context.req?.ip,
        userAgent: context.req?.headers?.["user-agent"],
      },
    });
  } catch (error) {
    console.error("[AuditMiddleware] Error logging bulk operation:", error);
  }
}

// ==================== قائمة العمليات المدعومة ====================

export function getAuditableOperations(): string[] {
  return Object.keys(AUDITABLE_OPERATIONS);
}

export function isOperationAuditable(procedurePath: string): boolean {
  return procedurePath in AUDITABLE_OPERATIONS;
}
