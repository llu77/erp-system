// خدمة إرسال الإشعارات المتقدمة عبر البريد الإلكتروني
// Symbol AI - نظام إدارة الأعمال

import { Resend } from "resend";
import * as db from "../db";
import * as templates from "./emailTemplates";
import { 
  EmailException, 
  SMTPException, 
  NotificationException,
  TemplateException 
} from "../exceptions";

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
    // التحقق من صحة البريد الإلكتروني
    if (!to || !isValidEmail(to)) {
      console.error(`✗ عنوان بريد إلكتروني غير صالح: ${to}`);
      return false;
    }
    
    // التحقق من وجود المحتوى
    if (!html || html.trim().length === 0) {
      throw new TemplateException(
        'محتوى البريد فارغ',
        'email',
        'email',
        undefined,
        undefined,
        { recipient: to, subject }
      );
    }
    
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });
    console.log(`✓ تم إرسال البريد إلى: ${to}`);
    return true;
  } catch (error: any) {
    // تحليل نوع الخطأ
    const errorMessage = error.message || 'خطأ غير معروف';
    const errorCode = error.statusCode || error.code;
    
    // أخطاء SMTP محددة
    if (errorCode >= 500 && errorCode < 600) {
      console.error(`✗ خطأ SMTP (${errorCode}):`, errorMessage);
      // لا نرمي الاستثناء - نرجع false للسماح بالاستمرار
      return false;
    }
    
    // أخطاء المصادقة أو التكوين
    if (errorCode === 401 || errorCode === 403) {
      console.error(`✗ خطأ مصادقة البريد:`, errorMessage);
      return false;
    }
    
    // أخطاء تجاوز الحد
    if (errorCode === 429) {
      console.error(`✗ تجاوز حد إرسال البريد`);
      return false;
    }
    
    console.error(`✗ فشل إرسال البريد إلى ${to}:`, errorMessage);
    return false;
  }
}

// التحقق من صحة البريد الإلكتروني
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
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

// ==================== إشعار إنشاء مسيرة رواتب جديدة ====================
export async function notifyNewPayrollCreated(data: {
  createdByName: string;
  createdByRole: string;
  branchId: number;
  branchName: string;
  month: string;
  year: number;
  employeeCount: number;
  totalNetSalary: number;
}): Promise<{ success: boolean; sentCount: number }> {
  console.log(`📧 إرسال إشعار مسيرة رواتب جديدة - ${data.branchName} - ${data.month} ${data.year}`);
  
  // الحصول على الأدمن والمدير فقط (للاعتماد)
  const recipients: { name: string; email: string }[] = [];
  
  try {
    const allUsers = await db.getAllUsers();
    
    for (const user of allUsers) {
      if (!user.email || !user.isActive) continue;
      // إرسال للأدمن والمدير فقط
      if (user.role === 'admin' || user.role === 'manager') {
        recipients.push({ name: user.name || 'مسؤول', email: user.email });
      }
    }
  } catch (error) {
    console.error('خطأ في جلب المستلمين:', error);
  }
  
  if (recipients.length === 0) {
    console.log('⚠️ لا يوجد مستلمين لإشعار مسيرة الرواتب');
    return { success: false, sentCount: 0 };
  }
  
  let sentCount = 0;
  
  for (const recipient of recipients) {
    const { subject, html } = templates.getNewPayrollCreatedTemplate({
      recipientName: recipient.name,
      createdByName: data.createdByName,
      createdByRole: data.createdByRole,
      branchName: data.branchName,
      month: data.month,
      year: data.year,
      employeeCount: data.employeeCount,
      totalNetSalary: data.totalNetSalary,
    });
    
    if (await sendEmail(recipient.email, subject, html)) {
      sentCount++;
    }
  }
  
  console.log(`✓ تم إرسال إشعار مسيرة الرواتب إلى ${sentCount} مستلم`);
  return { success: sentCount > 0, sentCount };
}

// ==================== إشعار الموظفين بالراتب ====================
export async function notifyEmployeesPayslip(data: {
  payrollId: number;
  payrollNumber: string;
  branchName: string;
  month: string;
  year: number;
  employees: Array<{
    employeeId: number;
    employeeName: string;
    employeeCode?: string;
    email?: string;
    baseSalary: number;
    overtimeAmount: number;
    incentiveAmount: number;
    absentDeduction: number;
    deductionAmount: number;
    advanceDeduction: number;
    netSalary: number;
    workDays?: number;
    absentDays?: number;
  }>;
}): Promise<{ success: boolean; sentCount: number; failedCount: number }> {
  console.log(`📧 إرسال إشعارات الراتب للموظفين - ${data.branchName} - ${data.month} ${data.year}`);
  
  let sentCount = 0;
  let failedCount = 0;
  
  for (const employee of data.employees) {
    // تخطي الموظفين بدون بريد إلكتروني
    if (!employee.email) {
      console.log(`⚠️ الموظف ${employee.employeeName} ليس لديه بريد إلكتروني`);
      failedCount++;
      continue;
    }
    
    try {
      const { subject, html } = templates.getEmployeePayslipTemplate({
        employeeName: employee.employeeName,
        employeeCode: employee.employeeCode || '',
        branchName: data.branchName,
        month: data.month,
        year: data.year,
        baseSalary: employee.baseSalary,
        overtimeAmount: employee.overtimeAmount,
        incentiveAmount: employee.incentiveAmount,
        absentDeduction: employee.absentDeduction,
        deductionAmount: employee.deductionAmount,
        advanceDeduction: employee.advanceDeduction,
        netSalary: employee.netSalary,
        payrollNumber: data.payrollNumber,
        workDays: employee.workDays,
        absentDays: employee.absentDays,
      });
      
      if (await sendEmail(employee.email, subject, html)) {
        sentCount++;
        console.log(`✓ تم إرسال قسيمة الراتب إلى ${employee.employeeName}`);
      } else {
        failedCount++;
      }
    } catch (error) {
      console.error(`خطأ في إرسال قسيمة الراتب للموظف ${employee.employeeName}:`, error);
      failedCount++;
    }
  }
  
  console.log(`✓ تم إرسال ${sentCount} قسيمة راتب، فشل ${failedCount}`);
  return { success: sentCount > 0, sentCount, failedCount };
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
  notifyNewPayrollCreated,
  notifyEmployeesPayslip,
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


// ==================== تنبيه فروقات البونص ====================
export interface BonusDiscrepancyAlertData {
  branchName: string;
  weekNumber: number;
  month: number;
  year: number;
  discrepancies: Array<{
    employeeName: string;
    registeredRevenue: number;
    actualRevenue: number;
    revenueDiff: number;
    registeredBonus: number;
    expectedBonus: number;
    bonusDiff: number;
  }>;
}

export async function sendBonusDiscrepancyAlert(
  recipientEmail: string,
  data: BonusDiscrepancyAlertData
): Promise<boolean> {
  try {
    const html = `
      <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px; background: #fff; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 20px; border-radius: 12px 12px 0 0;">
          <h2 style="color: white; margin: 0;">⚠️ تنبيه: فروقات في حساب البونص</h2>
        </div>
        
        <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
          <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 5px 0;"><strong>الفرع:</strong> ${data.branchName}</p>
            <p style="margin: 5px 0;"><strong>الأسبوع:</strong> ${data.weekNumber}</p>
            <p style="margin: 5px 0;"><strong>الفترة:</strong> ${data.month}/${data.year}</p>
          </div>
          
          <h3 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 10px;">
            الفروقات المكتشفة (${data.discrepancies.length})
          </h3>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <thead>
              <tr style="background: #1f2937; color: white;">
                <th style="padding: 12px 8px; text-align: right; border: 1px solid #374151;">الموظف</th>
                <th style="padding: 12px 8px; text-align: center; border: 1px solid #374151;">إيراد مسجل</th>
                <th style="padding: 12px 8px; text-align: center; border: 1px solid #374151;">إيراد فعلي</th>
                <th style="padding: 12px 8px; text-align: center; border: 1px solid #374151;">الفرق</th>
              </tr>
            </thead>
            <tbody>
              ${data.discrepancies.map((d, i) => `
                <tr style="background: ${i % 2 === 0 ? '#f9fafb' : '#ffffff'};">
                  <td style="padding: 10px 8px; border: 1px solid #e5e7eb;">${d.employeeName}</td>
                  <td style="padding: 10px 8px; border: 1px solid #e5e7eb; text-align: center;">${d.registeredRevenue.toFixed(2)} ر.س</td>
                  <td style="padding: 10px 8px; border: 1px solid #e5e7eb; text-align: center;">${d.actualRevenue.toFixed(2)} ر.س</td>
                  <td style="padding: 10px 8px; border: 1px solid #e5e7eb; text-align: center; color: ${d.revenueDiff > 0 ? '#16a34a' : '#dc2626'}; font-weight: bold;">
                    ${d.revenueDiff > 0 ? '+' : ''}${d.revenueDiff.toFixed(2)} ر.س
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div style="margin-top: 25px; padding: 15px; background: #fef3c7; border-radius: 8px; border-right: 4px solid #f59e0b;">
            <p style="margin: 0; color: #92400e;">
              <strong>⚡ إجراء مطلوب:</strong> يرجى مراجعة الإيرادات المدخلة وإعادة تزامن البونص من لوحة التحكم.
            </p>
          </div>
        </div>
        
        <div style="background: #1f2937; padding: 15px; border-radius: 0 0 12px 12px; text-align: center;">
          <p style="color: #9ca3af; margin: 0; font-size: 12px;">
            Symbol AI - نظام إدارة الأعمال
          </p>
        </div>
      </div>
    `;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: recipientEmail,
      subject: `⚠️ تنبيه فروقات البونص - ${data.branchName} - الأسبوع ${data.weekNumber}`,
      html,
    });

    console.log(`✓ تم إرسال تنبيه فروقات البونص إلى: ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error(`✗ فشل إرسال تنبيه فروقات البونص إلى ${recipientEmail}:`, error);
    return false;
  }
}


// ==================== تقرير البونص الأسبوعي ====================
export interface WeeklyBonusReportData {
  weekNumber: number;
  month: number;
  year: number;
  totalDiscrepancies: number;
  branchReports: Array<{
    branchName: string;
    hasDiscrepancy: boolean;
    discrepancyCount: number;
    totalDiff: number;
  }>;
}

export async function sendWeeklyBonusReport(
  data: WeeklyBonusReportData
): Promise<{ success: boolean; sentCount: number }> {
  try {
    const recipients = await getRecipientsForNotification('bonus');
    const adminRecipients = recipients.filter(r => r.role === 'admin' || r.role === 'general_supervisor');
    
    if (adminRecipients.length === 0) {
      console.log('[Weekly Bonus Report] لا يوجد مستلمين');
      return { success: true, sentCount: 0 };
    }

    const branchesWithIssues = data.branchReports.filter(b => b.hasDiscrepancy);
    const branchesOK = data.branchReports.filter(b => !b.hasDiscrepancy);
    
    const statusColor = data.totalDiscrepancies > 0 ? '#dc2626' : '#16a34a';
    const statusIcon = data.totalDiscrepancies > 0 ? '⚠️' : '✅';
    const statusText = data.totalDiscrepancies > 0 
      ? `${data.totalDiscrepancies} فروقات تحتاج مراجعة`
      : 'جميع الفروع متطابقة';

    const html = `
      <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px; background: #f9fafb; max-width: 700px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1f2937, #374151); padding: 25px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">📊 تقرير البونص الأسبوعي</h1>
          <p style="color: #9ca3af; margin: 10px 0 0 0;">
            الأسبوع ${data.weekNumber} - ${data.month}/${data.year}
          </p>
        </div>
        
        <div style="background: white; padding: 25px; border: 1px solid #e5e7eb; border-top: none;">
          <!-- ملخص الحالة -->
          <div style="background: ${statusColor}15; border: 1px solid ${statusColor}40; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 24px;">${statusIcon}</span>
              <div>
                <p style="margin: 0; font-weight: bold; color: ${statusColor}; font-size: 18px;">
                  ${statusText}
                </p>
                <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">
                  ${data.branchReports.length} فرع تم فحصهم
                </p>
              </div>
            </div>
          </div>
          
          ${branchesWithIssues.length > 0 ? `
          <!-- الفروع التي بها فروقات -->
          <h3 style="color: #dc2626; margin-bottom: 15px; border-bottom: 2px solid #dc2626; padding-bottom: 10px;">
            ⚠️ فروع تحتاج مراجعة (${branchesWithIssues.length})
          </h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
            <thead>
              <tr style="background: #fef2f2;">
                <th style="padding: 12px; text-align: right; border: 1px solid #fecaca;">الفرع</th>
                <th style="padding: 12px; text-align: center; border: 1px solid #fecaca;">عدد الفروقات</th>
                <th style="padding: 12px; text-align: center; border: 1px solid #fecaca;">إجمالي الفرق</th>
              </tr>
            </thead>
            <tbody>
              ${branchesWithIssues.map((branch, i) => `
                <tr style="background: ${i % 2 === 0 ? '#fff' : '#fef2f2'};">
                  <td style="padding: 10px; border: 1px solid #fecaca; font-weight: bold;">${branch.branchName}</td>
                  <td style="padding: 10px; border: 1px solid #fecaca; text-align: center; color: #dc2626;">${branch.discrepancyCount}</td>
                  <td style="padding: 10px; border: 1px solid #fecaca; text-align: center; color: #dc2626;">${branch.totalDiff.toFixed(2)} ر.س</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ` : ''}
          
          ${branchesOK.length > 0 ? `
          <!-- الفروع المتطابقة -->
          <h3 style="color: #16a34a; margin-bottom: 15px; border-bottom: 2px solid #16a34a; padding-bottom: 10px;">
            ✅ فروع متطابقة (${branchesOK.length})
          </h3>
          <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px;">
            ${branchesOK.map(branch => `
              <span style="background: #dcfce7; color: #166534; padding: 8px 15px; border-radius: 20px; font-size: 14px;">
                ${branch.branchName}
              </span>
            `).join('')}
          </div>
          ` : ''}
          
          <div style="margin-top: 25px; padding: 15px; background: #f3f4f6; border-radius: 8px;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              💡 لمراجعة التفاصيل وإصلاح الفروقات، يرجى زيارة صفحة البونص في لوحة التحكم.
            </p>
          </div>
        </div>
        
        <div style="background: #1f2937; padding: 15px; border-radius: 0 0 12px 12px; text-align: center;">
          <p style="color: #9ca3af; margin: 0; font-size: 12px;">
            Symbol AI - نظام إدارة الأعمال | تقرير تلقائي أسبوعي
          </p>
        </div>
      </div>
    `;

    let sentCount = 0;
    for (const recipient of adminRecipients) {
      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: recipient.email,
          subject: `📊 تقرير البونص الأسبوعي - الأسبوع ${data.weekNumber} - ${data.month}/${data.year}`,
          html,
        });
        sentCount++;
        console.log(`✓ تم إرسال تقرير البونص الأسبوعي إلى: ${recipient.email}`);
      } catch (error) {
        console.error(`✗ فشل إرسال تقرير البونص إلى ${recipient.email}:`, error);
      }
    }

    return { success: true, sentCount };
  } catch (error) {
    console.error('[Weekly Bonus Report] خطأ:', error);
    return { success: false, sentCount: 0 };
  }
}
