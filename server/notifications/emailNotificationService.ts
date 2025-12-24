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

// ==================== تصدير الدوال ====================
export default {
  notifyNewEmployeeRequest,
  notifyRequestStatusUpdate,
  notifyBonusRequest,
  notifyWeeklyBonusReport,
  notifyHighExpense,
  notifyNewPurchaseOrder,
  notifyRevenueMismatch,
};
