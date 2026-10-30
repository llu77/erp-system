/**
 * Portal Email Notification Service
 * خدمة إرسال البريد الإلكتروني لإشعارات بوابة الموظفين
 */

import { Resend } from "resend";
import { getDb } from "../db";
import { employees } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { NotificationType, NotificationPriority } from "./portalNotificationService";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "info@symbolai.net";
const COMPANY_NAME = "Symbol AI";

// ==================== Types ====================

interface EmployeeEmailInfo {
  id: number;
  name: string;
  email: string | null;
}

interface EmailNotificationInput {
  employeeId: number;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, unknown>;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ==================== Email Templates ====================

function getBaseEmailTemplate(content: string, title: string): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
      direction: rtl;
      text-align: right;
      background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%);
      padding: 20px;
      min-height: 100vh;
    }
    
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    }
    
    .header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      padding: 30px 25px;
      text-align: center;
      position: relative;
    }
    
    .header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #a855f7, #3b82f6, #22c55e, #eab308);
    }
    
    .logo {
      width: 50px;
      height: 50px;
      background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%);
      border-radius: 10px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 12px;
    }
    
    .logo-text {
      color: white;
      font-size: 20px;
      font-weight: bold;
    }
    
    .header h1 {
      color: #ffffff;
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 5px;
    }
    
    .header .subtitle {
      color: rgba(255, 255, 255, 0.7);
      font-size: 13px;
    }
    
    .content {
      padding: 30px 25px;
      background: #ffffff;
    }
    
    .greeting {
      font-size: 15px;
      color: #1a1a2e;
      margin-bottom: 18px;
      line-height: 1.8;
    }
    
    .greeting strong {
      color: #a855f7;
    }
    
    .alert-box {
      padding: 18px;
      border-radius: 10px;
      margin: 18px 0;
      border-right: 4px solid;
    }
    
    .alert-success {
      background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
      border-color: #22c55e;
    }
    
    .alert-error {
      background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
      border-color: #ef4444;
    }
    
    .alert-warning {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border-color: #f59e0b;
    }
    
    .alert-urgent {
      background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
      border-color: #dc2626;
    }
    
    .alert-info {
      background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
      border-color: #3b82f6;
    }
    
    .alert-title {
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .alert-message {
      font-size: 14px;
      line-height: 1.7;
      color: #374151;
    }
    
    .action-button {
      display: inline-block;
      background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%);
      color: white !important;
      text-decoration: none;
      padding: 12px 28px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      margin-top: 20px;
      text-align: center;
    }
    
    .action-button:hover {
      opacity: 0.9;
    }
    
    .footer {
      background: #f8fafc;
      padding: 20px 25px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    
    .footer p {
      color: #64748b;
      font-size: 12px;
      line-height: 1.6;
    }
    
    .footer .company {
      font-weight: 600;
      color: #475569;
    }
    
    @media (max-width: 600px) {
      body { padding: 10px; }
      .header { padding: 25px 20px; }
      .content { padding: 25px 20px; }
      .footer { padding: 18px 20px; }
    }
  </style>
</head>
<body>
  <div class="email-container">
    ${content}
  </div>
</body>
</html>
  `;
}

function getNotificationIcon(type: NotificationType): string {
  const icons: Record<NotificationType, string> = {
    request_approved: "✅",
    request_rejected: "❌",
    request_pending: "⏳",
    document_expiring: "⚠️",
    document_expired: "🚨",
    salary_ready: "💰",
    bonus_approved: "🎉",
    announcement: "📢",
    task_assigned: "📋",
    reminder: "🔔",
    system: "ℹ️",
  };
  return icons[type] || "📬";
}

function getAlertClass(type: NotificationType, priority: NotificationPriority): string {
  if (priority === "urgent") return "alert-urgent";
  
  const classes: Record<NotificationType, string> = {
    request_approved: "alert-success",
    request_rejected: "alert-error",
    request_pending: "alert-warning",
    document_expiring: "alert-warning",
    document_expired: "alert-urgent",
    salary_ready: "alert-success",
    bonus_approved: "alert-success",
    announcement: "alert-info",
    task_assigned: "alert-info",
    reminder: "alert-warning",
    system: "alert-info",
  };
  return classes[type] || "alert-info";
}

function buildNotificationEmail(
  employeeName: string,
  input: EmailNotificationInput
): string {
  const icon = getNotificationIcon(input.type);
  const alertClass = getAlertClass(input.type, input.priority);
  
  const actionButton = input.actionUrl && input.actionLabel
    ? `<a href="${input.actionUrl}" class="action-button">${input.actionLabel}</a>`
    : "";

  const content = `
    <div class="header">
      <div class="logo">
        <span class="logo-text">S</span>
      </div>
      <h1>${COMPANY_NAME}</h1>
      <p class="subtitle">بوابة الموظفين</p>
    </div>
    
    <div class="content">
      <p class="greeting">
        مرحباً <strong>${employeeName}</strong>،
      </p>
      
      <div class="alert-box ${alertClass}">
        <div class="alert-title">
          <span>${icon}</span>
          <span>${input.title}</span>
        </div>
        <p class="alert-message">${input.message}</p>
      </div>
      
      ${actionButton ? `<div style="text-align: center;">${actionButton}</div>` : ""}
    </div>
    
    <div class="footer">
      <p>هذا البريد تم إرساله تلقائياً من نظام <span class="company">${COMPANY_NAME}</span></p>
      <p>يرجى عدم الرد على هذا البريد</p>
    </div>
  `;

  return getBaseEmailTemplate(content, input.title);
}

// ==================== Core Functions ====================

/**
 * الحصول على معلومات البريد الإلكتروني للموظف
 */
async function getEmployeeEmailInfo(employeeId: number): Promise<EmployeeEmailInfo | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select({
      id: employees.id,
      name: employees.name,
      email: employees.email,
    })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);

  return result[0] || null;
}

/**
 * إرسال بريد إلكتروني للموظف
 */
export async function sendNotificationEmail(input: EmailNotificationInput): Promise<EmailResult> {
  try {
    // التحقق من أن الإشعار يستحق إرسال بريد
    const shouldSendEmail = shouldSendEmailForNotification(input.type, input.priority);
    if (!shouldSendEmail) {
      return { success: true, messageId: "skipped" };
    }

    // الحصول على معلومات الموظف
    const employee = await getEmployeeEmailInfo(input.employeeId);
    if (!employee) {
      return { success: false, error: "الموظف غير موجود" };
    }

    if (!employee.email) {
      return { success: false, error: "لا يوجد بريد إلكتروني للموظف" };
    }

    // بناء محتوى البريد
    const html = buildNotificationEmail(employee.name, input);

    // إرسال البريد
    const { data, error } = await resend.emails.send({
      from: `${COMPANY_NAME} <${FROM_EMAIL}>`,
      to: employee.email,
      subject: `${getNotificationIcon(input.type)} ${input.title}`,
      html,
    });

    if (error) {
      console.error("[PortalEmail] Error sending email:", error);
      return { success: false, error: error.message };
    }

    console.log(`[PortalEmail] Email sent to ${employee.email}: ${data?.id}`);
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("[PortalEmail] Exception:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "خطأ غير معروف" 
    };
  }
}

/**
 * تحديد ما إذا كان يجب إرسال بريد إلكتروني لهذا الإشعار
 */
function shouldSendEmailForNotification(
  type: NotificationType, 
  priority: NotificationPriority
): boolean {
  // إرسال بريد للإشعارات العاجلة والمهمة
  if (priority === "urgent" || priority === "high") {
    return true;
  }

  // أنواع الإشعارات التي تستحق بريد إلكتروني دائماً
  const alwaysEmailTypes: NotificationType[] = [
    "request_approved",
    "request_rejected",
    "document_expiring",
    "document_expired",
    "salary_ready",
    "bonus_approved",
  ];

  return alwaysEmailTypes.includes(type);
}

/**
 * إرسال بريد موافقة على طلب
 */
export async function sendRequestApprovedEmail(
  employeeId: number,
  requestId: number,
  requestType: string,
  approverName?: string
): Promise<EmailResult> {
  const typeLabels: Record<string, string> = {
    salary_advance: "سلفة",
    leave: "إجازة",
    arrears: "صرف متأخرات",
    permission: "استئذان",
    objection: "اعتراض",
    resignation: "استقالة",
    end_of_service: "إنهاء خدمة",
  };

  const label = typeLabels[requestType] || requestType;

  return sendNotificationEmail({
    employeeId,
    type: "request_approved",
    title: `تمت الموافقة على طلب ${label}`,
    message: approverName 
      ? `تمت الموافقة على طلبك من قبل ${approverName}. يمكنك الاطلاع على تفاصيل الطلب من خلال بوابة الموظفين.`
      : `تمت الموافقة على طلب ${label} الخاص بك. يمكنك الاطلاع على تفاصيل الطلب من خلال بوابة الموظفين.`,
    priority: "high",
    actionUrl: `/employee-portal?tab=requests`,
    actionLabel: "عرض الطلب",
    metadata: { requestId, requestType },
  });
}

/**
 * إرسال بريد رفض طلب
 */
export async function sendRequestRejectedEmail(
  employeeId: number,
  requestId: number,
  requestType: string,
  reason?: string
): Promise<EmailResult> {
  const typeLabels: Record<string, string> = {
    salary_advance: "سلفة",
    leave: "إجازة",
    arrears: "صرف متأخرات",
    permission: "استئذان",
    objection: "اعتراض",
    resignation: "استقالة",
    end_of_service: "إنهاء خدمة",
  };

  const label = typeLabels[requestType] || requestType;

  return sendNotificationEmail({
    employeeId,
    type: "request_rejected",
    title: `تم رفض طلب ${label}`,
    message: reason 
      ? `نأسف لإبلاغك بأنه تم رفض طلبك. السبب: ${reason}. يمكنك التواصل مع الإدارة لمزيد من التفاصيل.`
      : `نأسف لإبلاغك بأنه تم رفض طلب ${label} الخاص بك. يمكنك التواصل مع الإدارة لمزيد من التفاصيل.`,
    priority: "high",
    actionUrl: `/employee-portal?tab=requests`,
    actionLabel: "عرض التفاصيل",
    metadata: { requestId, requestType },
  });
}

/**
 * إرسال بريد تنبيه انتهاء وثيقة
 */
export async function sendDocumentExpiringEmail(
  employeeId: number,
  documentType: string,
  expiryDate: Date,
  daysRemaining: number
): Promise<EmailResult> {
  const docLabels: Record<string, string> = {
    residency: "الإقامة",
    health_certificate: "الشهادة الصحية",
    contract: "عقد العمل",
  };

  const label = docLabels[documentType] || documentType;
  const priority: NotificationPriority = daysRemaining <= 7 ? "urgent" : "high";

  return sendNotificationEmail({
    employeeId,
    type: "document_expiring",
    title: `تنبيه: ${label} قاربت على الانتهاء`,
    message: `ستنتهي صلاحية ${label} خلال ${daysRemaining} يوم (${expiryDate.toLocaleDateString("ar-SA")}). يرجى المبادرة بتجديدها في أقرب وقت لتجنب أي مشاكل.`,
    priority,
    actionUrl: `/employee-portal?tab=profile`,
    actionLabel: "تحديث البيانات",
    metadata: { documentType, expiryDate: expiryDate.toISOString() },
  });
}

/**
 * إرسال بريد وثيقة منتهية
 */
export async function sendDocumentExpiredEmail(
  employeeId: number,
  documentType: string
): Promise<EmailResult> {
  const docLabels: Record<string, string> = {
    residency: "الإقامة",
    health_certificate: "الشهادة الصحية",
    contract: "عقد العمل",
  };

  const label = docLabels[documentType] || documentType;

  return sendNotificationEmail({
    employeeId,
    type: "document_expired",
    title: `تحذير عاجل: ${label} منتهية الصلاحية`,
    message: `انتهت صلاحية ${label}. يرجى التواصل مع قسم الموارد البشرية فوراً لتجديدها وتجنب أي إجراءات قانونية.`,
    priority: "urgent",
    actionUrl: `/employee-portal?tab=profile`,
    actionLabel: "تحديث البيانات",
    metadata: { documentType },
  });
}

/**
 * إرسال بريد الراتب جاهز
 */
export async function sendSalaryReadyEmail(
  employeeId: number,
  month: string,
  amount: number
): Promise<EmailResult> {
  return sendNotificationEmail({
    employeeId,
    type: "salary_ready",
    title: "الراتب جاهز للصرف",
    message: `يسرنا إبلاغك بأن راتب شهر ${month} بقيمة ${amount.toLocaleString("ar-SA")} ريال جاهز للصرف. شكراً لجهودك المتميزة.`,
    priority: "high",
    actionUrl: `/employee-portal?tab=salary`,
    actionLabel: "عرض كشف الراتب",
    metadata: { month, amount },
  });
}

/**
 * إرسال بريد المكافأة
 */
export async function sendBonusApprovedEmail(
  employeeId: number,
  amount: number,
  reason?: string
): Promise<EmailResult> {
  return sendNotificationEmail({
    employeeId,
    type: "bonus_approved",
    title: "تمت الموافقة على مكافأة",
    message: reason
      ? `تهانينا! تمت الموافقة على مكافأة بقيمة ${amount.toLocaleString("ar-SA")} ريال. السبب: ${reason}`
      : `تهانينا! تمت الموافقة على مكافأة بقيمة ${amount.toLocaleString("ar-SA")} ريال تقديراً لجهودك المتميزة.`,
    priority: "high",
    actionUrl: `/employee-portal?tab=salary`,
    actionLabel: "عرض التفاصيل",
    metadata: { amount, reason },
  });
}

export default {
  sendNotificationEmail,
  sendRequestApprovedEmail,
  sendRequestRejectedEmail,
  sendDocumentExpiringEmail,
  sendDocumentExpiredEmail,
  sendSalaryReadyEmail,
  sendBonusApprovedEmail,
};
