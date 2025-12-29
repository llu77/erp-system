// خدمة إرسال الإشعارات المتقدمة عبر البريد الإلكتروني
// Symbol AI - نظام إدارة الأعمال

import { Resend } from "resend";
import * as db from "../db";
import * as templates from "./emailTemplates";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "info@symbolai.net";

// ==================== أنواع المستلمين ====================
type RecipientRole = 'admin' | 'manager' | 'supervisor' | 'branch_supervisor' | 'general_supervisor';

interface Recipient {
  id: number;
  name: string;
  email: string;
  role: RecipientRole;
  branchId?: number;
  branchName?: string;
}

// ==================== الحصول على المستلمين ====================
async function getRecipientsForNotification(
  notificationType: 'request' | 'bonus' | 'expense' | 'revenue' | 'purchase' | 'general',
  branchId?: number
): Promise<Recipient[]> {
  const recipients: Recipient[] = [];
  
  try {
    // الحصول على جميع المستلمين المسجلين
    const allRecipients = await db.getNotificationRecipients(branchId);
    
    for (const r of allRecipients) {
      // الأدمن يستقبل كل الإشعارات
      if (r.role === 'admin') {
        recipients.push({
          id: r.id,
          name: r.name,
          email: r.email,
          role: 'admin',
          branchId: r.branchId ?? undefined,
          branchName: r.branchName ?? undefined,
        });
        continue;
      }
      
      // المشرف العام يستقبل كل الإشعارات
      if (r.role === 'general_supervisor') {
        recipients.push({
          id: r.id,
          name: r.name,
          email: r.email,
          role: 'general_supervisor',
          branchId: r.branchId ?? undefined,
          branchName: r.branchName ?? undefined,
        });
        continue;
      }
      
      // مشرف الفرع يستقبل إشعارات فرعه فقط
      if ((r.role as string) === 'supervisor' || (r.role as string) === 'branch_supervisor') {
        if (branchId && r.branchId === branchId) {
          // التحقق من تفعيل نوع الإشعار
          let shouldReceive = false;
          switch (notificationType) {
            case 'request':
              shouldReceive = r.receiveRequestNotifications !== false;
              break;
            case 'bonus':
              shouldReceive = r.receiveBonusNotifications !== false;
              break;
            case 'expense':
              shouldReceive = r.receiveExpenseAlerts !== false;
              break;
            case 'revenue':
              shouldReceive = r.receiveRevenueAlerts !== false || r.receiveMismatchAlerts !== false;
              break;
            case 'purchase':
              shouldReceive = r.receiveRequestNotifications !== false;
              break;
            default:
              shouldReceive = true;
          }
          
          if (shouldReceive) {
            recipients.push({
              id: r.id,
              name: r.name,
              email: r.email,
              role: 'branch_supervisor',
              branchId: r.branchId ?? undefined,
              branchName: r.branchName ?? undefined,
            });
          }
        }
      }
      
      // المدير يستقبل الإشعارات المهمة
      if ((r.role as string) === 'manager') {
        recipients.push({
          id: r.id,
          name: r.name,
          email: r.email,
          role: 'manager',
          branchId: r.branchId ?? undefined,
          branchName: r.branchName ?? undefined,
        });
      }
    }
  } catch (error) {
    console.error('خطأ في جلب المستلمين:', error);
  }
  
  return recipients;
}

// ==================== إرسال البريد ====================
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });
    console.log(`✓ تم إرسال البريد إلى: ${to}`);
    return true;
  } catch (error: any) {
    console.error(`✗ فشل إرسال البريد إلى ${to}:`, error.message);
    return false;
  }
}

// ==================== إشعار طلب موظف جديد ====================
export async function notifyNewEmployeeRequest(data: {
  employeeName: string;
  employeeCode?: string;
  requestType: string;
  title: string;
  description?: string;
  priority?: string;
  branchId?: number;
  branchName?: string;
  requestNumber?: string;
  details?: Record<string, any>;
}): Promise<{ success: boolean; sentCount: number }> {
  console.log(`📧 إرسال إشعار طلب موظف جديد: ${data.employeeName} - ${data.requestType}`);
  
  const recipients = await getRecipientsForNotification('request', data.branchId);
  
  if (recipients.length === 0) {
    console.log('⚠️ لا يوجد مستلمين لإشعار الطلب');
    return { success: false, sentCount: 0 };
  }
  
  let sentCount = 0;
  
  for (const recipient of recipients) {
    const roleNames: Record<string, string> = {
      admin: 'مسؤول النظام',
      manager: 'المدير',
      general_supervisor: 'المشرف العام',
      branch_supervisor: 'مشرف الفرع',
      supervisor: 'المشرف',
    };
    
    const { subject, html } = templates.getEmployeeRequestTemplate({
      ...data,
      recipientName: recipient.name,
      recipientRole: roleNames[recipient.role] || recipient.role,
    });
    
    if (await sendEmail(recipient.email, subject, html)) {
      sentCount++;
    }
  }
  
  return { success: sentCount > 0, sentCount };
}

// ==================== إشعار تحديث حالة الطلب ====================
export async function notifyRequestStatusUpdate(data: {
  employeeName: string;
  employeeEmail?: string;
  requestType: string;
  title: string;
  requestNumber?: string;
  oldStatus: string;
  newStatus: string;
  reviewNotes?: string;
  rejectionReason?: string;
  reviewerName: string;
  branchId?: number;
  branchName?: string;
}): Promise<{ success: boolean; sentCount: number }> {
  console.log(`📧 إرسال إشعار تحديث حالة الطلب: ${data.requestNumber} - ${data.newStatus}`);
  
  let sentCount = 0;
  
  // إرسال للموظف صاحب الطلب
  if (data.employeeEmail) {
    const { subject, html } = templates.getRequestStatusUpdateTemplate({
      ...data,
      recipientName: data.employeeName,
    });
    
    if (await sendEmail(data.employeeEmail, subject, html)) {
      sentCount++;
    }
  }
  
  // إرسال للمشرفين والمديرين
  const recipients = await getRecipientsForNotification('request', data.branchId);
  
  for (const recipient of recipients) {
    const { subject, html } = templates.getRequestStatusUpdateTemplate({
      ...data,
      recipientName: recipient.name,
    });
    
    if (await sendEmail(recipient.email, subject, html)) {
      sentCount++;
    }
  }
  
  return { success: sentCount > 0, sentCount };
}

// ==================== إشعار طلب بونص ====================
export async function notifyBonusRequest(data: {
  employeeName: string;
  employeeCode?: string;
  amount: number;
  weekNumber: number;
  month: number;
  year: number;
  branchId?: number;
  branchName?: string;
  weeklyRevenue?: number;
  tier?: string;
}): Promise<{ success: boolean; sentCount: number }> {
  console.log(`📧 إرسال إشعار طلب بونص: ${data.employeeName} - ${data.amount} ر.س`);
  
  const recipients = await getRecipientsForNotification('bonus', data.branchId);
  
  if (recipients.length === 0) {
    console.log('⚠️ لا يوجد مستلمين لإشعار البونص');
    return { success: false, sentCount: 0 };
  }
  
  let sentCount = 0;
  
  for (const recipient of recipients) {
    const roleNames: Record<string, string> = {
      admin: 'مسؤول النظام',
      manager: 'المدير',
      general_supervisor: 'المشرف العام',
      branch_supervisor: 'مشرف الفرع',
      supervisor: 'المشرف',
    };
    
    const { subject, html } = templates.getBonusRequestTemplate({
      ...data,
      recipientName: recipient.name,
      recipientRole: roleNames[recipient.role] || recipient.role,
    });
    
    if (await sendEmail(recipient.email, subject, html)) {
      sentCount++;
    }
  }
  
  return { success: sentCount > 0, sentCount };
}

// ==================== إشعار تقرير البونص الأسبوعي ====================
export async function notifyWeeklyBonusReport(data: {
  branchId: number;
  branchName: string;
  weekNumber: number;
  month: number;
  year: number;
  totalAmount: number;
  eligibleCount: number;
  totalEmployees: number;
  details: Array<{
    employeeName: string;
    weeklyRevenue: number;
    tier: string;
    bonusAmount: number;
    isEligible: boolean;
  }>;
}): Promise<{ success: boolean; sentCount: number }> {
  console.log(`📧 إرسال تقرير البونص الأسبوعي: ${data.branchName} - الأسبوع ${data.weekNumber}`);
  
  const recipients = await getRecipientsForNotification('bonus', data.branchId);
  
  if (recipients.length === 0) {
    console.log('⚠️ لا يوجد مستلمين لتقرير البونص');
    return { success: false, sentCount: 0 };
  }
  
  let sentCount = 0;
  
  for (const recipient of recipients) {
    const { subject, html } = templates.getWeeklyBonusReportTemplate({
      ...data,
      recipientName: recipient.name,
    });
    
    if (await sendEmail(recipient.email, subject, html)) {
      sentCount++;
    }
  }
  
  return { success: sentCount > 0, sentCount };
}

// ==================== إشعار مصروف مرتفع ====================
export async function notifyHighExpense(data: {
  amount: number;
  category: string;
  description?: string;
  branchId?: number;
  branchName?: string;
  date: string;
  threshold?: number;
}): Promise<{ success: boolean; sentCount: number }> {
  console.log(`📧 إرسال إشعار مصروف مرتفع: ${data.amount} ر.س - ${data.category}`);
  
  const recipients = await getRecipientsForNotification('expense', data.branchId);
  
  if (recipients.length === 0) {
    console.log('⚠️ لا يوجد مستلمين لإشعار المصروف');
    return { success: false, sentCount: 0 };
  }
  
  let sentCount = 0;
  
  for (const recipient of recipients) {
    const { subject, html } = templates.getHighExpenseAlertTemplate({
      ...data,
      recipientName: recipient.name,
    });
    
    if (await sendEmail(recipient.email, subject, html)) {
      sentCount++;
    }
  }
  
  return { success: sentCount > 0, sentCount };
}

// ==================== إشعار أمر شراء جديد ====================
export async function notifyNewPurchaseOrder(data: {
  orderNumber: string;
  supplierName?: string;
  totalAmount: number;
  itemsCount: number;
  branchId?: number;
  branchName?: string;
  createdBy: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
}): Promise<{ success: boolean; sentCount: number }> {
  console.log(`📧 إرسال إشعار أمر شراء جديد: ${data.orderNumber} - ${data.totalAmount} ر.س`);
  
  const recipients = await getRecipientsForNotification('purchase', data.branchId);
  
  if (recipients.length === 0) {
    console.log('⚠️ لا يوجد مستلمين لإشعار أمر الشراء');
    return { success: false, sentCount: 0 };
  }
  
  let sentCount = 0;
  
  for (const recipient of recipients) {
    const { subject, html } = templates.getNewPurchaseOrderTemplate({
      ...data,
      recipientName: recipient.name,
    });
    
    if (await sendEmail(recipient.email, subject, html)) {
      sentCount++;
    }
  }
  
  return { success: sentCount > 0, sentCount };
}

// ==================== إشعار إيراد غير متطابق ====================
export async function notifyRevenueMismatch(data: {
  branchId: number;
  branchName: string;
  date: string;
  expectedAmount: number;
  actualAmount: number;
  difference: number;
  reason?: string;
}): Promise<{ success: boolean; sentCount: number }> {
  console.log(`📧 إرسال إشعار إيراد غير متطابق: ${data.branchName} - فرق ${data.difference} ر.س`);
  
  const recipients = await getRecipientsForNotification('revenue', data.branchId);
  
  if (recipients.length === 0) {
    console.log('⚠️ لا يوجد مستلمين لإشعار الإيراد');
    return { success: false, sentCount: 0 };
  }
  
  let sentCount = 0;
  
  for (const recipient of recipients) {
    const { subject, html } = templates.getRevenueMismatchTemplate({
      ...data,
      recipientName: recipient.name,
    });
    
    if (await sendEmail(recipient.email, subject, html)) {
      sentCount++;
    }
  }
  
  return { success: sentCount > 0, sentCount };
}

// ==================== إشعار تذكير الجرد ====================
export async function notifyInventoryReminder(data: {
  dayOfMonth: number;
  branches?: { name: string; productCount: number }[];
}): Promise<{ success: boolean; sentCount: number }> {
  console.log(`📧 إرسال تذكير الجرد - يوم ${data.dayOfMonth}`);
  
  // الحصول على المستلمين المحددين (السيد، مشرف طويق، الأدمن)
  const recipients: { name: string; email: string }[] = [];
  
  try {
    // الحصول على جميع المستخدمين
    const allUsers = await db.getAllUsers();
    
    for (const user of allUsers) {
      if (!user.email || !user.isActive) continue;
      
      const userName = user.name || 'مستخدم';
      const userRole = user.role as string;
      
      // الأدمن
      if (userRole === 'admin') {
        recipients.push({ name: userName, email: user.email });
        continue;
      }
      
      // السيد محمد
      if (userName.includes('السيد') || user.email.toLowerCase().includes('elsayed')) {
        recipients.push({ name: userName, email: user.email });
        continue;
      }
      
      // مشرف طويق (فرع 30001)
      if ((userRole === 'supervisor' || userRole === 'general_supervisor') && user.branchId === 30001) {
        recipients.push({ name: userName, email: user.email });
        continue;
      }
    }
  } catch (error) {
    console.error('خطأ في جلب المستلمين:', error);
  }
  
  if (recipients.length === 0) {
    console.log('⚠️ لا يوجد مستلمين لتذكير الجرد');
    return { success: false, sentCount: 0 };
  }
  
  let sentCount = 0;
  
  for (const recipient of recipients) {
    const { subject, html } = templates.getInventoryReminderTemplate({
      recipientName: recipient.name,
      dayOfMonth: data.dayOfMonth,
      branches: data.branches,
    });
    
    if (await sendEmail(recipient.email, subject, html)) {
      sentCount++;
    }
  }
  
  console.log(`✓ تم إرسال تذكير الجرد إلى ${sentCount} مستلم`);
  return { success: sentCount > 0, sentCount };
}

// ==================== إشعار تذكير مسيرات الرواتب ====================
export async function notifyPayrollReminder(data: {
  month: string;
  year: number;
  branches?: { name: string; employeeCount: number }[];
}): Promise<{ success: boolean; sentCount: number }> {
  console.log(`📧 إرسال تذكير مسيرات الرواتب - ${data.month} ${data.year}`);
  
  // الحصول على جميع المستخدمين النشطين
  const recipients: { name: string; email: string }[] = [];
  
  try {
    const allUsers = await db.getAllUsers();
    
    for (const user of allUsers) {
      if (!user.email || !user.isActive) continue;
      recipients.push({ name: user.name || 'مستخدم', email: user.email });
    }
  } catch (error) {
    console.error('خطأ في جلب المستلمين:', error);
  }
  
  if (recipients.length === 0) {
    console.log('⚠️ لا يوجد مستلمين لتذكير الرواتب');
    return { success: false, sentCount: 0 };
  }
  
  let sentCount = 0;
  
  for (const recipient of recipients) {
    const { subject, html } = templates.getPayrollReminderTemplate({
      recipientName: recipient.name,
      month: data.month,
      year: data.year,
      branches: data.branches,
    });
    
    if (await sendEmail(recipient.email, subject, html)) {
      sentCount++;
    }
  }
  
  console.log(`✓ تم إرسال تذكير الرواتب إلى ${sentCount} مستلم`);
  return { success: sentCount > 0, sentCount };
}

// ==================== تصدير الدوال ====================
export default {
  notifyNewEmployeeRequest,
  notifyRequestStatusUpdate,
  notifyBonusRequest,
  notifyWeeklyBonusReport,
  notifyHighExpense,
  notifyNewPurchaseOrder,
  notifyRevenueMismatch,
  notifyInventoryReminder,
  notifyPayrollReminder,
};


// ==================== إشعار المهام الجديدة ====================
export async function notifyTaskAssignment(data: {
  employeeEmail: string;
  employeeName: string;
  subject: string;
  details?: string;
  requirement: string;
  referenceNumber: string;
  priority: string;
  dueDate?: string;
  branchName?: string;
  createdByName: string;
}): Promise<boolean> {
  try {
    const html = templates.getTaskNotificationTemplate({
      employeeName: data.employeeName,
      subject: data.subject,
      details: data.details,
      requirement: data.requirement,
      referenceNumber: data.referenceNumber,
      priority: data.priority,
      dueDate: data.dueDate,
      branchName: data.branchName,
      createdByName: data.createdByName,
    });

    await resend.emails.send({
      from: FROM_EMAIL,
      to: data.employeeEmail,
      subject: `مهمة جديدة: ${data.subject} - الرقم المرجعي: ${data.referenceNumber}`,
      html,
    });

    // تسجيل الإشعار
    await db.logSentNotification({
      recipientId: 0,
      recipientEmail: data.employeeEmail,
      recipientName: data.employeeName,
      notificationType: 'task_assignment',
      subject: `مهمة جديدة: ${data.subject}`,
      bodyArabic: `مهمة جديدة - الرقم المرجعي: ${data.referenceNumber}`,
      status: 'sent',
      sentAt: new Date(),
    });

    console.log(`[Task Notification] Sent to ${data.employeeName} (${data.employeeEmail}) - Ref: ${data.referenceNumber}`);
    return true;
  } catch (error) {
    console.error('[Task Notification] Error:', error);
    return false;
  }
}


// إشعار المشرف عند استجابة الموظف للمهمة
export async function notifyTaskResponse(data: {
  referenceNumber: string;
  employeeName: string;
  branchName: string;
  subject: string;
  responseType: string;
  responseValue?: string;
  hasAttachment: boolean;
  creatorEmail: string;
  creatorName: string;
}): Promise<boolean> {
  try {
    const { getTaskResponseTemplate } = await import('./emailTemplates');
    
    const html = getTaskResponseTemplate({
      referenceNumber: data.referenceNumber,
      employeeName: data.employeeName,
      branchName: data.branchName,
      subject: data.subject,
      responseType: data.responseType,
      responseValue: data.responseValue,
      responseDate: new Date().toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      hasAttachment: data.hasAttachment,
    });

    await resend.emails.send({
      from: FROM_EMAIL,
      to: data.creatorEmail,
      subject: `استجابة للمهمة: ${data.subject} - الرقم المرجعي: ${data.referenceNumber}`,
      html,
    });

    // تسجيل الإشعار
    await db.logSentNotification({
      recipientId: 0,
      recipientEmail: data.creatorEmail,
      recipientName: data.creatorName,
      notificationType: 'task_response',
      subject: `استجابة للمهمة: ${data.subject}`,
      bodyArabic: `استجابة من ${data.employeeName} - الرقم المرجعي: ${data.referenceNumber}`,
      status: 'sent',
      sentAt: new Date(),
    });

    console.log(`[Task Response Notification] Sent to ${data.creatorName} (${data.creatorEmail}) - Ref: ${data.referenceNumber}`);
    return true;
  } catch (error) {
    console.error('[Task Response Notification] Error:', error);
    return false;
  }
}

// إرسال تقرير المهام المتأخرة
export async function sendOverdueTasksReport(adminEmails: string[]): Promise<boolean> {
  try {
    const { getOverdueTasksReportTemplate } = await import('./emailTemplates');
    
    // الحصول على المهام المتأخرة من قاعدة البيانات
    const overdueTasks = await db.getOverdueTasks();
    
    if (overdueTasks.length === 0) {
      console.log('[Overdue Tasks Report] No overdue tasks found');
      return true;
    }

    const html = getOverdueTasksReportTemplate({
      totalOverdue: overdueTasks.length,
      tasks: overdueTasks.map(task => ({
        referenceNumber: task.referenceNumber,
        subject: task.subject,
        employeeName: task.employeeName || 'غير محدد',
        branchName: task.branchName || 'غير محدد',
        dueDate: task.dueDate ? new Date(task.dueDate).toLocaleDateString('ar-SA') : 'غير محدد',
        daysOverdue: task.daysOverdue || 0,
      })),
      reportDate: new Date().toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    });

    for (const email of adminEmails) {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: `تقرير المهام المتأخرة - ${overdueTasks.length} مهمة`,
        html,
      });
    }

    console.log(`[Overdue Tasks Report] Sent to ${adminEmails.length} admins - ${overdueTasks.length} overdue tasks`);
    return true;
  } catch (error) {
    console.error('[Overdue Tasks Report] Error:', error);
    return false;
  }
}
