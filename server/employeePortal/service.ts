/**
 * خدمات بوابة الموظفين: الملكية (الموظف يرى طلباته ومستنداته فقط)، طلب السلفة،
 * قسيمة الراتب وطلب السلفة PDF، تتبع الطلب، والتحقق من الملفات المرفوعة.
 */

import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { isRequestVisibleToEmployee } from "../endOfService/service";
import * as portalNotificationService from "../services/portalNotificationService";
import * as emailNotifications from "../notifications/emailNotificationService";
import { notifyOwner } from "../_core/notification";
import { notificationLogger, requestsLogger } from "../utils/logger";
import type { PayslipDocumentData } from "../../shared/payslipTemplate";
import type { AdvanceRequestDocumentData } from "../../shared/advanceRequestTemplate";

// ==================== الملكية ====================

type RequestRow = NonNullable<Awaited<ReturnType<typeof db.getEmployeeRequestById>>>;

const REQUEST_NOT_FOUND = "الطلب غير موجود";

/** طلب يخص الموظف ويُسمح له برؤيته (وإلا NOT_FOUND دون كشف وجوده) */
export async function getOwnVisibleRequest(employeeId: number, requestId: number): Promise<RequestRow> {
  const request = await db.getEmployeeRequestById(requestId);
  if (!request || request.employeeId !== employeeId || !isRequestVisibleToEmployee(request)) {
    throw new TRPCError({ code: "NOT_FOUND", message: REQUEST_NOT_FOUND });
  }
  return request;
}

// ==================== تتبع الطلب ====================

export interface RequestTimelineEntry {
  id: string;
  requestId: number;
  status: string;
  notes: string | null;
  actionByName: string | null;
  createdAt: Date;
}

const LOG_STATUS_TO_TIMELINE: Record<string, string> = {
  pending: "submitted",
  approved: "approved",
  rejected: "rejected",
  cancelled: "cancelled",
};

/**
 * تتبع الطلب: سجل الطلب (employeeRequestLogs) + جدول التتبع القديم، مرتبة زمنياً
 * (يُضاف "تم التقديم" من تاريخ الطلب إن لم يوجد له سجل إنشاء)
 */
export function buildRequestTimeline(
  request: { id: number; createdAt: Date },
  timelineRows: Array<{ id: number; requestId: number; status: string; notes: string | null; actionByName: string | null; createdAt: Date }>,
  logs: Array<{ id: number; requestId: number; newStatus: string | null; notes: string | null; performedByName: string | null; createdAt: Date }>
): RequestTimelineEntry[] {
  const entries: RequestTimelineEntry[] = [];
  for (const row of timelineRows) {
    entries.push({
      id: `t-${row.id}`,
      requestId: row.requestId,
      status: row.status,
      notes: row.notes ?? null,
      actionByName: row.actionByName ?? null,
      createdAt: row.createdAt,
    });
  }
  for (const log of logs) {
    const status = log.newStatus ? LOG_STATUS_TO_TIMELINE[log.newStatus] : undefined;
    if (!status) continue;
    entries.push({
      id: `l-${log.id}`,
      requestId: log.requestId,
      status,
      notes: log.notes ?? null,
      actionByName: log.performedByName ?? null,
      createdAt: log.createdAt,
    });
  }
  if (!entries.some(e => e.status === "submitted")) {
    entries.push({
      id: `r-${request.id}`,
      requestId: request.id,
      status: "submitted",
      notes: null,
      actionByName: null,
      createdAt: request.createdAt,
    });
  }
  return entries.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export async function getOwnRequestTimeline(employeeId: number, requestId: number): Promise<RequestTimelineEntry[]> {
  const request = await getOwnVisibleRequest(employeeId, requestId);
  const [timelineRows, logs] = await Promise.all([
    db.getRequestTimeline(request.id),
    db.getEmployeeRequestLogs(request.id),
  ]);
  return buildRequestTimeline(request, timelineRows, logs);
}

// ==================== الملفات المرفوعة ====================

export const PORTAL_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

const FILE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

export const PORTAL_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"] as const;
export const PORTAL_ATTACHMENT_TYPES = [...PORTAL_IMAGE_TYPES, "application/pdf"] as const;

/** نوع الملف الفعلي من أول البايتات (لا يُعتمد على النوع المرسل فقط) */
export function detectFileType(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  if (buffer.length >= 6 && /^GIF8[79]a$/.test(buffer.toString("ascii", 0, 6))) return "image/gif";
  if (buffer.length >= 5 && buffer.toString("ascii", 0, 5) === "%PDF-") return "application/pdf";
  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp") {
    const brand = buffer.toString("ascii", 8, 12);
    if (["heic", "heix", "hevc", "hevx", "heim", "heis"].includes(brand)) return "image/heic";
    if (["mif1", "msf1"].includes(brand)) return "image/heif";
  }
  return null;
}

const UNSAFE_FILE_NAME_CHARS = new RegExp("[^\\p{L}\\p{N}_-]+", "gu");

/** اسم ملف آمن للتخزين (بدون مسارات أو أحرف خاصة) مع الامتداد الصحيح */
export function sanitizeUploadFileName(fileName: string, extension: string): string {
  const base = String(fileName || "")
    .split(/[\\/]/)
    .pop()!
    .replace(/\.[^.]*$/, "")
    .normalize("NFKC")
    .replace(UNSAFE_FILE_NAME_CHARS, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${base || "file"}.${extension}`;
}

export interface DecodedUpload {
  buffer: Buffer;
  contentType: string;
  extension: string;
  safeFileName: string;
}

/** فك ترميز ملف مرفوع (base64) والتحقق من نوعه الفعلي وحجمه */
export function decodePortalUpload(params: {
  data: string;
  contentType: string;
  fileName: string;
  allowedTypes: readonly string[];
  maxBytes?: number;
}): DecodedUpload {
  const maxBytes = params.maxBytes ?? PORTAL_UPLOAD_MAX_BYTES;
  const declared = String(params.contentType || "").trim().toLowerCase();
  if (!params.allowedTypes.includes(declared)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "نوع الملف غير مدعوم" });
  }
  const base64 = String(params.data || "")
    .replace(/^data:[^;,]*;base64,/, "")
    .replace(/\s+/g, "");
  if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "بيانات الملف غير صالحة" });
  }
  // تقدير الحجم قبل فك الترميز لتجنب تحميل ملفات ضخمة في الذاكرة
  if (Math.floor((base64.length * 3) / 4) > maxBytes + 3) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `حجم الملف يجب أن يكون أقل من ${Math.round(maxBytes / (1024 * 1024))} ميجابايت` });
  }
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "الملف فارغ" });
  }
  if (buffer.length > maxBytes) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `حجم الملف يجب أن يكون أقل من ${Math.round(maxBytes / (1024 * 1024))} ميجابايت` });
  }
  const actual = detectFileType(buffer);
  const sameFamily = actual === declared || (actual === "image/heic" && declared === "image/heif") || (actual === "image/heif" && declared === "image/heic");
  if (!actual || !params.allowedTypes.includes(actual) || !sameFamily) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "محتوى الملف لا يطابق نوعه أو غير مدعوم" });
  }
  const extension = FILE_EXTENSIONS[actual] ?? "bin";
  return { buffer, contentType: actual, extension, safeFileName: sanitizeUploadFileName(params.fileName, extension) };
}

// ==================== طلب السلفة ====================

export const ADVANCE_REPAYMENT_METHODS = ["salary_deduction", "installments", "full_payment"] as const;
export type AdvanceRepaymentMethod = (typeof ADVANCE_REPAYMENT_METHODS)[number];

export interface CreateAdvanceRequestInput {
  amount: number;
  reason: string;
  repaymentMethod: AdvanceRepaymentMethod;
}

function isDuplicateKeyError(error: unknown): boolean {
  const e = error as { code?: string; errno?: number; cause?: { code?: string; errno?: number } } | null;
  return e?.code === "ER_DUP_ENTRY" || e?.errno === 1062 || e?.cause?.code === "ER_DUP_ENTRY" || e?.cause?.errno === 1062;
}

const REPAYMENT_LABELS: Record<AdvanceRepaymentMethod, string> = {
  salary_deduction: "خصم من الراتب",
  installments: "أقساط شهرية",
  full_payment: "سداد كامل",
};

/** تقديم طلب سلفة من البوابة (للموظف نفسه فقط) */
export async function createPortalAdvanceRequest(
  employeeId: number,
  input: CreateAdvanceRequestInput
): Promise<{ id: number; requestNumber: string }> {
  const employee = await db.getEmployeeById(employeeId);
  if (!employee || !employee.isActive) {
    throw new TRPCError({ code: "NOT_FOUND", message: "الموظف غير موجود" });
  }
  const branch = employee.branchId ? await db.getBranchById(employee.branchId) : undefined;
  const branchName = branch ? branch.nameAr || branch.name : null;
  const amount = Math.round(input.amount * 100) / 100;
  const reason = input.reason.trim();

  let created: { requestNumber: string; insertId: number | string } | undefined;
  for (let attempt = 0; attempt < 3 && !created; attempt++) {
    try {
      created = await db.createEmployeeRequest({
        employeeId: employee.id,
        employeeName: employee.name,
        branchId: employee.branchId,
        branchName,
        requestType: "advance",
        title: "طلب سلفة",
        description: reason,
        advanceAmount: amount.toFixed(2),
        advanceReason: reason,
        repaymentMethod: input.repaymentMethod,
        priority: "normal",
      });
    } catch (error) {
      // رقم الطلب عشوائي يومي: نعيد المحاولة عند التكرار النادر
      if (!isDuplicateKeyError(error) || attempt === 2) throw error;
    }
  }
  if (!created) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر حفظ الطلب" });
  }
  const requestId = Number(created.insertId);
  const requestNumber = created.requestNumber;

  try {
    await db.createEmployeeRequestLog({
      requestId,
      action: "إنشاء طلب",
      newStatus: "pending",
      performedBy: employee.id,
      performedByName: `${employee.name} (بوابة الموظفين)`,
      notes: `تم تقديم طلب سلفة بمبلغ ${amount.toFixed(2)} ر.س`,
    });
  } catch (error) {
    requestsLogger.error("خطأ في تسجيل إنشاء طلب السلفة", error);
  }

  notifyAdvanceRequestCreated({
    requestId,
    requestNumber,
    employee: { id: employee.id, name: employee.name, email: employee.email, branchId: employee.branchId },
    branchName,
    amount,
    reason,
    repaymentMethod: input.repaymentMethod,
  }).catch(error => notificationLogger.error("خطأ في إشعارات طلب السلفة", error));

  return { id: requestId, requestNumber };
}

/** إشعار الإدارة ومشرفي الفرع بطلب سلفة جديد (لا يُفشل تقديم الطلب) */
async function notifyAdvanceRequestCreated(params: {
  requestId: number;
  requestNumber: string;
  employee: { id: number; name: string; email: string | null; branchId: number | null };
  branchName: string | null;
  amount: number;
  reason: string;
  repaymentMethod: AdvanceRepaymentMethod;
}): Promise<void> {
  const { requestId, requestNumber, employee, branchName, amount, reason, repaymentMethod } = params;

  notifyOwner({
    title: "طلب جديد من موظف",
    content: `قدم ${employee.name} طلب سلفة بمبلغ ${amount.toFixed(2)} ر.س من بوابة الموظفين`,
  }).catch(err => notificationLogger.warn("تعذر إشعار المالك بطلب السلفة", { error: String(err) }));

  try {
    await db.createNotification({
      type: "system",
      title: "طلب جديد",
      message: `قدم ${employee.name} طلب سلفة (${requestNumber})`,
      relatedType: "employee_request",
      relatedId: requestId,
    });
  } catch (error) {
    notificationLogger.error("خطأ في الإشعار الداخلي لطلب السلفة", error);
  }

  emailNotifications
    .notifyNewEmployeeRequest({
      employeeName: employee.name,
      requestType: "advance",
      title: "طلب سلفة",
      description: reason,
      priority: "normal",
      branchId: employee.branchId ?? undefined,
      branchName: branchName ?? undefined,
      requestNumber,
      details: {
        "المبلغ المطلوب": `${amount.toFixed(2)} ر.س`,
        "سبب السلفة": reason,
        "طريقة السداد": REPAYMENT_LABELS[repaymentMethod],
      },
    })
    .catch(err => notificationLogger.error("خطأ في إرسال إشعار البريد لطلب السلفة", err));

  if (employee.email) {
    emailNotifications
      .notifyEmployeeRequestSubmitted({
        employeeEmail: employee.email,
        employeeName: employee.name,
        requestType: "advance",
        requestId,
        details: reason,
        submittedAt: new Date(),
      })
      .catch(err => notificationLogger.error("خطأ في إرسال تأكيد الطلب للموظف", err));
  }

  // مشرفو الفرع في البوابة (عدا مقدم الطلب)
  if (employee.branchId) {
    try {
      const supervisorIds = await db.getPortalSupervisorIdsForBranch(employee.branchId);
      await Promise.allSettled(
        supervisorIds
          .filter(id => id !== employee.id)
          .map(id =>
            portalNotificationService.notifySupervisorNewRequest(id, requestId, "advance", employee.name, branchName || "غير محدد")
          )
      );
    } catch (error) {
      notificationLogger.error("خطأ في إشعار مشرفي الفرع بطلب السلفة", error);
    }
  }
}

// ==================== المستندات (PDF) ====================

const PAYSLIP_NOT_FOUND = "قسيمة الراتب غير متاحة";

function wrapDocumentError(error: unknown, message: string): never {
  if (error instanceof TRPCError) throw error;
  console.error(`[EmployeePortal] ${message}:`, error);
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
}

/** قسيمة راتب الموظف نفسه في مسيرة معتمدة أو مصروفة فقط */
export async function getOwnPayslipData(employeeId: number, payrollId: number): Promise<PayslipDocumentData> {
  const visible = await db.isEmployeeSlipVisible(employeeId, payrollId);
  if (!visible) throw new TRPCError({ code: "NOT_FOUND", message: PAYSLIP_NOT_FOUND });
  let data: PayslipDocumentData | null;
  try {
    const { getPayslipDocumentData } = await import("../employeeDocumentsPdf");
    data = await getPayslipDocumentData(payrollId, employeeId);
  } catch (error) {
    wrapDocumentError(error, "تعذر تحميل قسيمة الراتب");
  }
  if (!data || data.employee.id !== employeeId || (data.status !== "approved" && data.status !== "paid")) {
    throw new TRPCError({ code: "NOT_FOUND", message: PAYSLIP_NOT_FOUND });
  }
  return data;
}

export async function getOwnPayslipPdf(employeeId: number, payrollId: number): Promise<{ pdf: string; filename: string }> {
  const data = await getOwnPayslipData(employeeId, payrollId);
  try {
    const { generatePayslipPDF, payslipFileName } = await import("../employeeDocumentsPdf");
    const pdf = await generatePayslipPDF(data);
    return { pdf: pdf.toString("base64"), filename: payslipFileName(data) };
  } catch (error) {
    wrapDocumentError(error, "تعذر إنشاء ملف PDF لقسيمة الراتب");
  }
}

/** طلب السلفة الخاص بالموظف نفسه (أي حالة) */
export async function getOwnAdvanceRequestData(employeeId: number, requestId: number): Promise<AdvanceRequestDocumentData> {
  const request = await getOwnVisibleRequest(employeeId, requestId);
  if (request.requestType !== "advance") {
    throw new TRPCError({ code: "NOT_FOUND", message: REQUEST_NOT_FOUND });
  }
  let data: AdvanceRequestDocumentData | null;
  try {
    const { getAdvanceRequestDocumentData } = await import("../employeeDocumentsPdf");
    data = await getAdvanceRequestDocumentData(request.id);
  } catch (error) {
    wrapDocumentError(error, "تعذر تحميل طلب السلفة");
  }
  if (!data || data.employee.id !== employeeId) {
    throw new TRPCError({ code: "NOT_FOUND", message: REQUEST_NOT_FOUND });
  }
  return data;
}

export async function getOwnAdvanceRequestPdf(employeeId: number, requestId: number): Promise<{ pdf: string; filename: string }> {
  const data = await getOwnAdvanceRequestData(employeeId, requestId);
  try {
    const { generateAdvanceRequestPDF, advanceRequestFileName } = await import("../employeeDocumentsPdf");
    const pdf = await generateAdvanceRequestPDF(data);
    return { pdf: pdf.toString("base64"), filename: advanceRequestFileName(data) };
  } catch (error) {
    wrapDocumentError(error, "تعذر إنشاء ملف PDF لطلب السلفة");
  }
}

// ==================== نطاق فروع المراجع ====================

type ExpiringDocumentsData = Awaited<ReturnType<typeof db.getEmployeesWithExpiringDocuments>>;

/** تقييد بيانات الوثائق المنتهية بفرع المراجع (null = كل الفروع) مع إعادة حساب الملخص */
export function scopeExpiringDocuments(data: ExpiringDocumentsData, branchId: number | null): ExpiringDocumentsData {
  if (branchId == null) return data;
  const pick = <T extends { branchId: number }>(rows: T[]) => rows.filter(row => row.branchId === branchId);
  const expiring = {
    iqama: pick(data.expiring.iqama),
    healthCert: pick(data.expiring.healthCert),
    contract: pick(data.expiring.contract),
  };
  const expired = {
    iqama: pick(data.expired.iqama),
    healthCert: pick(data.expired.healthCert),
    contract: pick(data.expired.contract),
  };
  return {
    expiring,
    expired,
    summary: {
      totalExpiring: expiring.iqama.length + expiring.healthCert.length + expiring.contract.length,
      totalExpired: expired.iqama.length + expired.healthCert.length + expired.contract.length,
      expiringIqamaCount: expiring.iqama.length,
      expiringHealthCertCount: expiring.healthCert.length,
      expiringContractCount: expiring.contract.length,
      expiredIqamaCount: expired.iqama.length,
      expiredHealthCertCount: expired.healthCert.length,
      expiredContractCount: expired.contract.length,
    },
  };
}
