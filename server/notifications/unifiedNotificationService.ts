/**
 * خدمة الإشعارات الموحدة
 * =======================
 * 
 * هذا الملف هو نقطة الدخول الموحدة لجميع الإشعارات في النظام.
 * يوفر واجهة بسيطة لإرسال الإشعارات مع دعم:
 * - Queue للإرسال غير المتزامن
 * - Retry Logic تلقائي
 * - قوالب جاهزة للإشعارات
 * - تسجيل شامل
 */

import { 
  queueEmailNotification, 
  queueBatchNotifications,
  NotificationQueueType,
  getQueueStats,
  getDeadLetterNotifications,
  retryFailedNotification,
  retryAllFailedNotifications,
  startNotificationQueue,
  stopNotificationQueue,
} from './notificationQueue';
import * as db from '../db';

// ==================== أنواع البيانات ====================

export interface NotificationRecipient {
  id?: number;
  email: string;
  name: string;
  role?: string;
  branchId?: number | null;
}

export interface NotificationOptions {
  priority?: 'high' | 'normal' | 'low';
  maxAttempts?: number;
  metadata?: Record<string, any>;
}

// ==================== قوالب الإشعارات ====================

const TEMPLATES = {
  // تنبيه إيراد منخفض
  lowRevenue: (data: { amount: number; branchName?: string; date: string; reason?: string }) => ({
    subject: `⚠️ تنبيه: إيراد منخفض${data.branchName ? ` - ${data.branchName}` : ''} | Low Revenue Alert`,
    bodyHtml: `
      <div style="direction: rtl; text-align: right; font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #e74c3c, #c0392b); color: white; padding: 20px; border-radius: 10px 10px 0 0;">
          <h2 style="margin: 0;">⚠️ تنبيه إيراد منخفض</h2>
        </div>
        <div style="background: #fff; padding: 20px; border: 1px solid #eee; border-top: none;">
          <p>عزيزي مشرف النظام،</p>
          <p>تم ملاحظة أنه تم تسجيل إيراد منخفض بتاريخ <strong>${data.date}</strong>.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
            <tr style="background: #f8f9fa;">
              <td style="padding: 10px; border: 1px solid #eee;"><strong>المبلغ:</strong></td>
              <td style="padding: 10px; border: 1px solid #eee;">${data.amount.toFixed(2)} ر.س.</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #eee;"><strong>الفرع:</strong></td>
              <td style="padding: 10px; border: 1px solid #eee;">${data.branchName || 'غير محدد'}</td>
            </tr>
            ${data.reason ? `<tr style="background: #f8f9fa;">
              <td style="padding: 10px; border: 1px solid #eee;"><strong>السبب:</strong></td>
              <td style="padding: 10px; border: 1px solid #eee;">${data.reason}</td>
            </tr>` : ''}
          </table>
          <p>للمزيد من التفاصيل، الرجاء مراجعة النظام.</p>
        </div>
        <div style="background: #f8f9fa; padding: 15px; text-align: center; border-radius: 0 0 10px 10px;">
          <p style="color: #666; font-size: 12px; margin: 0;">Symbol AI - نظام إدارة الأعمال</p>
        </div>
      </div>
    `,
  }),

  // تنبيه مصروف مرتفع
  highExpense: (data: { amount: number; category: string; branchName?: string; date: string; threshold: number }) => ({
    subject: `⚠️ تنبيه: مصروف مرتفع${data.branchName ? ` - ${data.branchName}` : ''} | High Expense Alert`,
    bodyHtml: `
      <div style="direction: rtl; text-align: right; font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #e67e22, #d35400); color: white; padding: 20px; border-radius: 10px 10px 0 0;">
          <h2 style="margin: 0;">⚠️ تنبيه مصروف مرتفع</h2>
        </div>
        <div style="background: #fff; padding: 20px; border: 1px solid #eee; border-top: none;">
          <p>عزيزي مشرف النظام،</p>
          <p>تم تسجيل مصروف يتجاوز الحد المسموح (${data.threshold} ر.س.) بتاريخ <strong>${data.date}</strong>.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
            <tr style="background: #f8f9fa;">
              <td style="padding: 10px; border: 1px solid #eee;"><strong>المبلغ:</strong></td>
              <td style="padding: 10px; border: 1px solid #eee; color: #e74c3c; font-weight: bold;">${data.amount.toFixed(2)} ر.س.</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #eee;"><strong>البند:</strong></td>
              <td style="padding: 10px; border: 1px solid #eee;">${data.category}</td>
            </tr>
            <tr style="background: #f8f9fa;">
              <td style="padding: 10px; border: 1px solid #eee;"><strong>الفرع:</strong></td>
              <td style="padding: 10px; border: 1px solid #eee;">${data.branchName || 'غير محدد'}</td>
            </tr>
          </table>
          <p>للمزيد من التفاصيل، الرجاء مراجعة النظام.</p>
        </div>
        <div style="background: #f8f9fa; padding: 15px; text-align: center; border-radius: 0 0 10px 10px;">
          <p style="color: #666; font-size: 12px; margin: 0;">Symbol AI - نظام إدارة الأعمال</p>
        </div>
      </div>
    `,
  }),

  // تذكير الإيراد الناقص
  missingRevenue: (data: { branchName: string; date: string }) => ({
    subject: `⚠️ تذكير: إيراد غير مسجل - ${data.branchName} | Missing Revenue Reminder`,
    bodyHtml: `
      <div style="direction: rtl; text-align: right; font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f39c12, #e67e22); color: white; padding: 20px; border-radius: 10px 10px 0 0;">
          <h2 style="margin: 0;">⚠️ تذكير: إيراد غير مسجل</h2>
        </div>
        <div style="background: #fff; padding: 20px; border: 1px solid #eee; border-top: none;">
          <p>عزيزي مشرف النظام،</p>
          <p>لم يتم تسجيل إيراد <strong>${data.branchName}</strong> ليوم <strong>${data.date}</strong>.</p>
          <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p style="margin: 0;"><strong>⏰ يرجى تسجيل الإيراد في أقرب وقت ممكن.</strong></p>
          </div>
        </div>
        <div style="background: #f8f9fa; padding: 15px; text-align: center; border-radius: 0 0 10px 10px;">
          <p style="color: #666; font-size: 12px; margin: 0;">Symbol AI - نظام إدارة الأعمال</p>
        </div>
      </div>
    `,
  }),

  // تذكير الجرد
  inventoryReminder: (data: { dayOfMonth: number; branches: { name: string; productCount: number }[] }) => ({
    subject: `📦 تذكير الجرد الشهري - يوم ${data.dayOfMonth} | Monthly Inventory Reminder`,
    bodyHtml: `
      <div style="direction: rtl; text-align: right; font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #3498db, #2980b9); color: white; padding: 20px; border-radius: 10px 10px 0 0;">
          <h2 style="margin: 0;">📦 تذكير الجرد الشهري</h2>
        </div>
        <div style="background: #fff; padding: 20px; border: 1px solid #eee; border-top: none;">
          <p>عزيزي مشرف النظام،</p>
          <p>هذا تذكير بموعد الجرد الشهري (يوم ${data.dayOfMonth} من الشهر).</p>
          <h3>المهام المطلوبة:</h3>
          <ul style="list-style: none; padding: 0;">
            <li style="padding: 8px 0;">✅ إجراء جرد المخزون</li>
            <li style="padding: 8px 0;">✅ مراجعة الكميات</li>
            <li style="padding: 8px 0;">✅ تحديث النظام</li>
          </ul>
          ${data.branches.length > 0 ? `
          <h3>الفروع:</h3>
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
            <tr style="background: #3498db; color: white;">
              <th style="padding: 10px; border: 1px solid #eee;">الفرع</th>
              <th style="padding: 10px; border: 1px solid #eee;">عدد المنتجات</th>
            </tr>
            ${data.branches.map((b, i) => `
              <tr style="background: ${i % 2 === 0 ? '#f8f9fa' : '#fff'};">
                <td style="padding: 10px; border: 1px solid #eee;">${b.name}</td>
                <td style="padding: 10px; border: 1px solid #eee;">${b.productCount}</td>
              </tr>
            `).join('')}
          </table>
          ` : ''}
        </div>
        <div style="background: #f8f9fa; padding: 15px; text-align: center; border-radius: 0 0 10px 10px;">
          <p style="color: #666; font-size: 12px; margin: 0;">Symbol AI - نظام إدارة الأعمال</p>
        </div>
      </div>
    `,
  }),

  // تذكير الرواتب
  payrollReminder: (data: { month: string; year: number; employeeCount: number }) => ({
    subject: `💰 تذكير مسيرات الرواتب - ${data.month} ${data.year} | Payroll Reminder`,
    bodyHtml: `
      <div style="direction: rtl; text-align: right; font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #27ae60, #2ecc71); color: white; padding: 20px; border-radius: 10px 10px 0 0;">
          <h2 style="margin: 0;">💰 تذكير مسيرات الرواتب</h2>
        </div>
        <div style="background: #fff; padding: 20px; border: 1px solid #eee; border-top: none;">
          <p>عزيزي مشرف النظام،</p>
          <p>هذا تذكير بإعداد مسيرات رواتب شهر <strong>${data.month} ${data.year}</strong>.</p>
          <div style="background: #d4edda; border: 1px solid #28a745; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p style="margin: 0;"><strong>👥 عدد الموظفين: ${data.employeeCount}</strong></p>
          </div>
          <h3>المهام المطلوبة:</h3>
          <ul style="list-style: none; padding: 0;">
            <li style="padding: 8px 0;">✅ مراجعة ساعات العمل الإضافي</li>
            <li style="padding: 8px 0;">✅ احتساب الحوافز والخصومات</li>
            <li style="padding: 8px 0;">✅ إعداد المسيرات</li>
            <li style="padding: 8px 0;">✅ اعتماد المسيرات</li>
          </ul>
        </div>
        <div style="background: #f8f9fa; padding: 15px; text-align: center; border-radius: 0 0 10px 10px;">
          <p style="color: #666; font-size: 12px; margin: 0;">Symbol AI - نظام إدارة الأعمال</p>
        </div>
      </div>
    `,
  }),

  // إشعار عام
  general: (data: { title: string; message: string; actionUrl?: string; actionText?: string }) => ({
    subject: `📢 ${data.title} | Symbol AI`,
    bodyHtml: `
      <div style="direction: rtl; text-align: right; font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #9b59b6, #8e44ad); color: white; padding: 20px; border-radius: 10px 10px 0 0;">
          <h2 style="margin: 0;">📢 ${data.title}</h2>
        </div>
        <div style="background: #fff; padding: 20px; border: 1px solid #eee; border-top: none;">
          <p>${data.message}</p>
          ${data.actionUrl ? `
          <div style="text-align: center; margin: 20px 0;">
            <a href="${data.actionUrl}" style="background: #9b59b6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              ${data.actionText || 'عرض التفاصيل'}
            </a>
          </div>
          ` : ''}
        </div>
        <div style="background: #f8f9fa; padding: 15px; text-align: center; border-radius: 0 0 10px 10px;">
          <p style="color: #666; font-size: 12px; margin: 0;">Symbol AI - نظام إدارة الأعمال</p>
        </div>
      </div>
    `,
  }),
};

// ==================== دوال الإرسال الموحدة ====================

/**
 * إرسال إشعار إيراد منخفض
 */
export async function sendLowRevenueAlert(
  data: { amount: number; branchId?: number; branchName?: string; date: string; reason?: string },
  options?: NotificationOptions
): Promise<string[]> {
  const recipients = await getRecipientsForType('low_revenue', data.branchId);
  const template = TEMPLATES.lowRevenue(data);
  
  return sendToRecipients(recipients, 'low_revenue', template, { ...options, priority: 'high' });
}

/**
 * إرسال إشعار مصروف مرتفع
 */
export async function sendHighExpenseAlert(
  data: { amount: number; category: string; branchId?: number; branchName?: string; date: string; threshold: number },
  options?: NotificationOptions
): Promise<string[]> {
  const recipients = await getRecipientsForType('high_expense', data.branchId);
  const template = TEMPLATES.highExpense(data);
  
  return sendToRecipients(recipients, 'high_expense', template, { ...options, priority: 'high' });
}

/**
 * إرسال تذكير إيراد ناقص
 */
export async function sendMissingRevenueReminder(
  data: { branchId: number; branchName: string; date: string },
  options?: NotificationOptions
): Promise<string[]> {
  const recipients = await getRecipientsForType('missing_revenue', data.branchId);
  const template = TEMPLATES.missingRevenue(data);
  
  return sendToRecipients(recipients, 'missing_revenue', template, options);
}

/**
 * إرسال تذكير الجرد
 */
export async function sendInventoryReminder(
  data: { dayOfMonth: number; branches: { name: string; productCount: number }[] },
  options?: NotificationOptions
): Promise<string[]> {
  const recipients = await getRecipientsForType('inventory_reminder');
  const template = TEMPLATES.inventoryReminder(data);
  
  return sendToRecipients(recipients, 'inventory_reminder', template, options);
}

/**
 * إرسال تذكير الرواتب
 */
export async function sendPayrollReminder(
  data: { month: string; year: number; employeeCount: number },
  options?: NotificationOptions
): Promise<string[]> {
  const recipients = await getRecipientsForType('payroll_reminder');
  const template = TEMPLATES.payrollReminder(data);
  
  return sendToRecipients(recipients, 'payroll_reminder', template, options);
}

/**
 * إرسال إشعار عام
 */
export async function sendGeneralNotification(
  data: { title: string; message: string; actionUrl?: string; actionText?: string },
  recipientIds?: number[],
  options?: NotificationOptions
): Promise<string[]> {
  let recipients: NotificationRecipient[];
  
  if (recipientIds && recipientIds.length > 0) {
    recipients = await getRecipientsByIds(recipientIds);
  } else {
    recipients = await getRecipientsForType('general');
  }
  
  const template = TEMPLATES.general(data);
  
  return sendToRecipients(recipients, 'general', template, options);
}

/**
 * إرسال إشعار مخصص
 */
export async function sendCustomNotification(
  recipients: NotificationRecipient[],
  type: NotificationQueueType,
  subject: string,
  bodyHtml: string,
  options?: NotificationOptions
): Promise<string[]> {
  return sendToRecipients(recipients, type, { subject, bodyHtml }, options);
}

// ==================== دوال مساعدة ====================

/**
 * الحصول على المستلمين حسب نوع الإشعار
 */
async function getRecipientsForType(type: NotificationQueueType, branchId?: number): Promise<NotificationRecipient[]> {
  try {
    const allRecipients = await db.getNotificationRecipients(branchId);
    
    return allRecipients
      .filter((r: any) => r.isActive && r.email)
      .filter((r: any) => {
        // الأدمن والمشرف العام يستقبلون كل الإشعارات
        if (r.role === 'admin' || r.role === 'general_supervisor') {
          return checkNotificationPreference(r, type);
        }
        
        // مشرف الفرع يستقبل إشعارات فرعه فقط
        if (r.role === 'branch_supervisor') {
          if (!branchId) return false;
          return r.branchId === branchId && checkNotificationPreference(r, type);
        }
        
        return false;
      })
      .map((r: any) => ({
        id: r.id,
        email: r.email,
        name: r.name,
        role: r.role,
        branchId: r.branchId,
      }));
  } catch (error: any) {
    console.error(`[UnifiedNotification] خطأ في جلب المستلمين: ${error.message}`);
    return [];
  }
}

/**
 * الحصول على مستلمين بمعرفاتهم
 */
async function getRecipientsByIds(ids: number[]): Promise<NotificationRecipient[]> {
  try {
    const allRecipients = await db.getNotificationRecipients();
    
    return allRecipients
      .filter((r: any) => ids.includes(r.id) && r.isActive && r.email)
      .map((r: any) => ({
        id: r.id,
        email: r.email,
        name: r.name,
        role: r.role,
        branchId: r.branchId,
      }));
  } catch (error: any) {
    console.error(`[UnifiedNotification] خطأ في جلب المستلمين: ${error.message}`);
    return [];
  }
}

/**
 * التحقق من تفضيلات الإشعارات
 */
function checkNotificationPreference(recipient: any, type: NotificationQueueType): boolean {
  switch (type) {
    case 'low_revenue':
    case 'high_expense':
      return recipient.receiveRevenueAlerts || recipient.receiveExpenseAlerts;
    case 'revenue_mismatch':
      return recipient.receiveMismatchAlerts;
    case 'inventory_low':
    case 'inventory_reminder':
      return recipient.receiveInventoryAlerts;
    case 'monthly_reminder':
    case 'payroll_reminder':
      return recipient.receiveMonthlyReminders;
    case 'employee_request':
    case 'product_update':
    case 'payroll_created':
      return recipient.receiveRequestNotifications;
    case 'weekly_report':
    case 'monthly_report':
      return recipient.receiveReportNotifications;
    case 'bonus_request':
      return recipient.receiveBonusNotifications;
    case 'missing_revenue':
      return recipient.receiveRevenueAlerts;
    default:
      return true;
  }
}

/**
 * إرسال إلى قائمة المستلمين
 */
async function sendToRecipients(
  recipients: NotificationRecipient[],
  type: NotificationQueueType,
  template: { subject: string; bodyHtml: string },
  options?: NotificationOptions
): Promise<string[]> {
  if (recipients.length === 0) {
    console.log(`[UnifiedNotification] لا يوجد مستلمون للإشعار من نوع: ${type}`);
    return [];
  }

  console.log(`[UnifiedNotification] إرسال ${type} إلى ${recipients.length} مستلم`);

  const notifications = recipients.map(recipient => ({
    type,
    recipient: {
      id: recipient.id,
      email: recipient.email,
      name: recipient.name,
    },
    subject: template.subject,
    bodyHtml: template.bodyHtml,
    priority: options?.priority || 'normal' as const,
    maxAttempts: options?.maxAttempts,
    metadata: options?.metadata,
  }));

  return queueBatchNotifications(notifications);
}

// ==================== تصدير دوال Queue ====================

export {
  getQueueStats,
  getDeadLetterNotifications,
  retryFailedNotification,
  retryAllFailedNotifications,
  startNotificationQueue,
  stopNotificationQueue,
};
