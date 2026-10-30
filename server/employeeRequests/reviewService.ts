/**
 * مراجعة طلبات الموظفين (موافقة / رفض / إلغاء)
 *
 * خدمة واحدة يستخدمها النظام الرئيسي (employeeRequests.updateStatus) وبوابة الموظفين
 * (portalAdmin.updateRequestStatus) حتى تطبق نفس القواعد في المسارين:
 * - الانتقال من "قيد الانتظار" فقط (لا يُعاد اعتماد طلب تمت مراجعته ولا يتغير تاريخ مراجعته)
 * - المراجع يقتصر على فرعه، ولا يراجع طلبه بنفسه
 * - إنهاء الخدمة يُدار من صفحة إنهاء الخدمة فقط
 * - سجل الطلب، تحديث المسيرات المفتوحة، وإشعار الموظف (البوابة + البريد + الرسائل)
 */

import { TRPCError } from "@trpc/server";
import * as db from "../db";
import * as payrollService from "../payroll/service";
import * as portalNotificationService from "../services/portalNotificationService";
import * as emailNotifications from "../notifications/emailNotificationService";
import * as twilioService from "../notifications/twilioService";
import { payrollLogger, requestsLogger } from "../utils/logger";

export type RequestReviewStatus = "approved" | "rejected" | "cancelled";

/** من يراجع الطلب */
export interface RequestReviewer {
  /** staff = مستخدم النظام الرئيسي، employee = مشرف من بوابة الموظفين */
  kind: "staff" | "employee";
  /** users.id لمستخدم النظام، employees.id لمشرف البوابة */
  id: number;
  name: string;
  /** نطاق الفروع: null = كل الفروع */
  branchId: number | null;
  /** رقم الموظف الخاص بالمراجع (لمنع مراجعة طلبه بنفسه) */
  employeeId: number | null;
}

export interface ReviewRequestInput {
  requestId: number;
  status: RequestReviewStatus;
  reviewNotes?: string | null;
  rejectionReason?: string | null;
}

/** الحقول اللازمة لقرار المراجعة */
export interface ReviewableRequest {
  id: number;
  employeeId: number;
  branchId: number | null;
  requestType: string;
  status: string;
  reviewedAt: Date | string | null;
}

export interface ReviewBlock {
  code: "BAD_REQUEST" | "FORBIDDEN" | "CONFLICT";
  message: string;
}

const REQUEST_TYPE_NAMES: Record<string, string> = {
  advance: "سلفة",
  vacation: "إجازة",
  arrears: "صرف متأخرات",
  permission: "استئذان",
  objection: "اعتراض",
  resignation: "استقالة",
  end_of_service: "إنهاء خدمة",
};

export function requestTypeName(type: string): string {
  return REQUEST_TYPE_NAMES[type] || type;
}

const STATUS_NAMES: Record<string, string> = {
  pending: "قيد الانتظار",
  approved: "موافق عليه",
  rejected: "مرفوض",
  cancelled: "ملغي",
};

/**
 * هل يجوز للمراجع تغيير حالة الطلب؟ (null = مسموح)
 * employeeBranchId: فرع الموظف الحالي (أو فرع الطلب إن لم يوجد الموظف)
 */
export function getReviewBlock(params: {
  request: ReviewableRequest;
  status: RequestReviewStatus;
  reviewer: RequestReviewer;
  employeeBranchId: number | null;
}): ReviewBlock | null {
  const { request, reviewer, employeeBranchId } = params;

  // حالة طلب إنهاء الخدمة تتبع مخالصته (اعتماد/إلغاء) ولا تُغيّر من هنا
  if (request.requestType === "end_of_service") {
    return { code: "BAD_REQUEST", message: "يُدار إنهاء الخدمة من صفحة إنهاء الخدمة" };
  }

  // المراجع المرتبط بفرع يراجع طلبات موظفي فرعه فقط
  if (reviewer.branchId != null && (employeeBranchId == null || employeeBranchId !== reviewer.branchId)) {
    return { code: "FORBIDDEN", message: "لا يمكنك مراجعة طلبات فرع آخر" };
  }

  // لا يراجع المشرف طلبه بنفسه
  if (reviewer.employeeId != null && reviewer.employeeId === request.employeeId) {
    return { code: "FORBIDDEN", message: "لا يمكنك مراجعة طلبك بنفسك" };
  }

  // الانتقال من "قيد الانتظار" فقط، وتاريخ المراجعة لا يتغير بعد تسجيله
  if (request.status !== "pending" || request.reviewedAt) {
    const current = STATUS_NAMES[request.status] || request.status;
    return { code: "CONFLICT", message: `تمت مراجعة هذا الطلب مسبقاً (الحالة الحالية: ${current})` };
  }

  return null;
}

function cleanText(value: string | null | undefined, max = 2000): string | undefined {
  if (value == null) return undefined;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

export interface ReviewRequestResult {
  success: true;
  requestId: number;
  oldStatus: string;
  newStatus: RequestReviewStatus;
  message: string;
}

/**
 * مراجعة طلب موظف (المسار الوحيد لتغيير حالة طلب من قيد الانتظار)
 * تُرمى TRPCError عند الرفض؛ الإشعارات وتحديث المسيرات لا تُفشل العملية بعد حفظها
 */
export async function reviewEmployeeRequest(
  input: ReviewRequestInput,
  reviewer: RequestReviewer
): Promise<ReviewRequestResult> {
  const request = await db.getEmployeeRequestById(input.requestId);
  if (!request) {
    throw new TRPCError({ code: "NOT_FOUND", message: "الطلب غير موجود" });
  }

  // نطاق الفرع حسب فرع الموظف الفعلي (وفرع الطلب إن لم يوجد الموظف)
  const employee = await db.getEmployeeById(request.employeeId);
  const employeeBranchId = employee?.branchId ?? request.branchId ?? null;

  const block = getReviewBlock({ request, status: input.status, reviewer, employeeBranchId });
  if (block) {
    throw new TRPCError({ code: block.code, message: block.message });
  }

  // لا تُغيّر سلفة مخصومة في مسيرة معتمدة أو مخالصة نهائية
  if (request.requestType === "advance") {
    try {
      await payrollService.assertSourceNotLocked("advance", request.id);
    } catch (error) {
      if (error instanceof payrollService.PayrollError) {
        throw new TRPCError({ code: error.code, message: error.message });
      }
      throw error;
    }
  }

  const reviewNotes = cleanText(input.reviewNotes);
  const rejectionReason = input.status === "rejected" ? cleanText(input.rejectionReason) ?? reviewNotes : undefined;

  // تحديث ذري: ينجح فقط إن كان الطلب ما زال قيد الانتظار ولم يُراجع
  const updated = await db.reviewPendingEmployeeRequest(request.id, {
    status: input.status,
    reviewedBy: reviewer.id,
    reviewedByName: reviewer.name,
    reviewNotes: reviewNotes ?? null,
    rejectionReason: rejectionReason ?? null,
  });
  if (!updated) {
    throw new TRPCError({ code: "CONFLICT", message: "تمت مراجعة هذا الطلب مسبقاً" });
  }

  const oldStatus = request.status;
  const actionLabel = input.status === "approved" ? "موافقة" : input.status === "rejected" ? "رفض" : "إلغاء";

  // سجل الطلب (التغيير محفوظ، فلا يُفشل العملية)
  try {
    await db.createEmployeeRequestLog({
      requestId: request.id,
      action: actionLabel,
      oldStatus,
      newStatus: input.status,
      performedBy: reviewer.id,
      performedByName: reviewer.kind === "employee" ? `${reviewer.name} (مشرف - بوابة الموظفين)` : reviewer.name,
      notes: rejectionReason || reviewNotes || null,
    });
  } catch (error) {
    requestsLogger.error("خطأ في تسجيل مراجعة الطلب", error);
  }

  // السلف والإجازات تنعكس مباشرة على مسيرة الرواتب المفتوحة للموظف
  if (request.requestType === "advance" || request.requestType === "vacation") {
    try {
      await payrollService.syncOpenPayrollsForEmployee(request.employeeId);
    } catch (error) {
      payrollLogger.error("خطأ في تحديث مسيرة الرواتب بعد تغيير حالة الطلب", error);
    }
  }

  await notifyRequestReviewed({
    request,
    employee: employee ?? null,
    oldStatus,
    status: input.status,
    reviewerName: reviewer.name,
    reviewNotes,
    rejectionReason,
  });

  const statusText = input.status === "approved" ? "الموافقة على" : input.status === "rejected" ? "رفض" : "إلغاء";
  return {
    success: true,
    requestId: request.id,
    oldStatus,
    newStatus: input.status,
    message: `تم ${statusText} الطلب بنجاح`,
  };
}

type RequestRow = NonNullable<Awaited<ReturnType<typeof db.getEmployeeRequestById>>>;
type EmployeeRow = NonNullable<Awaited<ReturnType<typeof db.getEmployeeById>>>;

/** إشعارات ما بعد المراجعة: كل قناة مستقلة ولا يُفشل خطؤها المراجعة المحفوظة */
async function notifyRequestReviewed(params: {
  request: RequestRow;
  employee: EmployeeRow | null;
  oldStatus: string;
  status: RequestReviewStatus;
  reviewerName: string;
  reviewNotes?: string;
  rejectionReason?: string;
}): Promise<void> {
  const { request, employee, oldStatus, status, reviewerName, reviewNotes, rejectionReason } = params;

  // إشعار بوابة الموظفين (جرس الإشعارات)
  try {
    if (status === "approved") {
      await portalNotificationService.notifyRequestApproved(request.employeeId, request.id, request.requestType, reviewerName);
    } else if (status === "rejected") {
      await portalNotificationService.notifyRequestRejected(request.employeeId, request.id, request.requestType, rejectionReason);
    }
  } catch (error) {
    requestsLogger.error("خطأ في إرسال إشعار البوابة للموظف", error);
  }

  // إشعار داخلي في النظام الرئيسي
  const statusText = status === "approved" ? "تمت الموافقة على" : status === "rejected" ? "تم رفض" : "تم إلغاء";
  try {
    await db.createNotification({
      type: "system",
      title: `${statusText} طلب`,
      message: `${statusText} طلب ${request.employeeName}: ${request.title}${rejectionReason ? ` - السبب: ${rejectionReason}` : ""}`,
      relatedType: "employee_request",
      relatedId: request.id,
    });
  } catch (error) {
    requestsLogger.error("خطأ في إنشاء الإشعار الداخلي", error);
  }

  // بريد الإدارة بتحديث الحالة
  emailNotifications
    .notifyRequestStatusUpdate({
      employeeName: request.employeeName,
      requestType: request.requestType,
      title: request.title,
      requestNumber: request.requestNumber,
      oldStatus,
      newStatus: status,
      reviewNotes,
      rejectionReason,
      reviewerName,
      branchId: request.branchId ?? undefined,
      branchName: request.branchName ?? undefined,
    })
    .catch(err => requestsLogger.error("خطأ في إرسال إشعار تحديث الحالة", err));

  // بريد الموظف
  if (employee?.email) {
    if (status === "approved") {
      emailNotifications
        .notifyEmployeeRequestApproved({
          employeeEmail: employee.email,
          employeeName: request.employeeName,
          requestType: request.requestType,
          requestId: request.id,
          approvedBy: reviewerName,
          approvedAt: new Date(),
          notes: reviewNotes,
        })
        .catch(err => requestsLogger.error("خطأ في إرسال إشعار الموافقة للموظف", err));
    } else if (status === "rejected") {
      emailNotifications
        .notifyEmployeeRequestRejected({
          employeeEmail: employee.email,
          employeeName: request.employeeName,
          requestType: request.requestType,
          requestId: request.id,
          rejectedBy: reviewerName,
          rejectedAt: new Date(),
          reason: rejectionReason,
        })
        .catch(err => requestsLogger.error("خطأ في إرسال إشعار الرفض للموظف", err));
    }
  }

  // رسالة SMS للموظف
  if (employee?.phone) {
    const typeName = requestTypeName(request.requestType);
    const reference = request.requestNumber || String(request.id);
    if (status === "approved") {
      twilioService
        .sendRequestApprovedNotification(employee.phone, request.employeeName, typeName, reference, reviewNotes)
        .catch(err => requestsLogger.error("خطأ في إرسال SMS الموافقة للموظف", err));
    } else if (status === "rejected") {
      twilioService
        .sendRequestRejectedNotification(employee.phone, request.employeeName, typeName, reference, rejectionReason)
        .catch(err => requestsLogger.error("خطأ في إرسال SMS الرفض للموظف", err));
    }
  }
}
