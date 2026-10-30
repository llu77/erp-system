import * as db from "../db";
import { Resend } from "resend";
import { wasNotificationSentToday, markNotificationAsSent } from './notificationTracker';
import { formatBonusPeriodLabel } from "../../shared/bonus";
import { getTierDisplayName, getTierColorHex } from "../../shared/bonusHelpers";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "info@symbolai.net";

// أنواع الإشعارات
export type NotificationType = 
  | "low_revenue"
  | "high_expense"
  | "revenue_mismatch"
  | "inventory_low"
  | "monthly_reminder"
  | "employee_request"
  | "product_update"
  | "payroll_created"
  | "weekly_report"
  | "monthly_report"
  | "bonus_request"
  | "missing_revenue"
  | "general";

// واجهة بيانات الإشعار
interface NotificationData {
  type: NotificationType;
  branchId?: number | null;
  branchName?: string;
  entityType?: string;
  entityId?: number;
  amount?: number;
  date?: string;
  reason?: string;
  employeeName?: string;
  productName?: string;
  customData?: Record<string, any>;
}

// الحصول على المستلمين حسب نوع الإشعار والفرع
export async function getRecipients(type: NotificationType, branchId?: number | null) {
  const recipients = await db.getNotificationRecipients(branchId);
  
  return recipients.filter((recipient: any) => {
    // الأدمن والمشرف العام يستقبلون كل الإشعارات
    if (recipient.role === "admin" || recipient.role === "general_supervisor") {
      return checkNotificationType(recipient, type);
    }
    
    // مشرف الفرع يستقبل إشعارات فرعه فقط
    if (recipient.role === "branch_supervisor") {
      if (branchId === null || branchId === undefined) {
        return false; // إشعار عام، لا يُرسل لمشرفي الفروع
      }
      return recipient.branchId === branchId && checkNotificationType(recipient, type);
    }
    
    return false;
  });
}

// التحقق من تفعيل نوع الإشعار للمستلم
function checkNotificationType(recipient: any, type: NotificationType): boolean {
  switch (type) {
    case "low_revenue":
    case "high_expense":
      return recipient.receiveRevenueAlerts || recipient.receiveExpenseAlerts;
    case "revenue_mismatch":
      return recipient.receiveMismatchAlerts;
    case "inventory_low":
      return recipient.receiveInventoryAlerts;
    case "monthly_reminder":
      return recipient.receiveMonthlyReminders;
    case "employee_request":
    case "product_update":
    case "payroll_created":
      return recipient.receiveRequestNotifications;
    case "weekly_report":
    case "monthly_report":
      return recipient.receiveReportNotifications;
    case "bonus_request":
      return recipient.receiveBonusNotifications;
    default:
      return true;
  }
}

// إنشاء محتوى الإشعار بالعربي والإنجليزي
function generateNotificationContent(data: NotificationData): { subject: string; bodyArabic: string; bodyEnglish: string } {
  const date = data.date || new Date().toLocaleDateString('ar-SA');
  const branchText = data.branchName ? ` - ${data.branchName}` : '';
  
  switch (data.type) {
    case "low_revenue":
      return {
        subject: `⚠️ تنبيه: إيراد منخفض${branchText} | Low Revenue Alert`,
        bodyArabic: `
          <div style="direction: rtl; text-align: right; font-family: 'Segoe UI', Tahoma, sans-serif;">
            <h2 style="color: #e74c3c;">⚠️ تنبيه إيراد منخفض</h2>
            <p>عزيزي مشرف النظام،</p>
            <p>تم ملاحظة أنه تم تسجيل إيراد منخفض بتاريخ <strong>${date}</strong>.</p>
            <ul>
              <li><strong>المبلغ:</strong> ${data.amount?.toFixed(2)} ر.س.</li>
              <li><strong>الفرع:</strong> ${data.branchName || 'غير محدد'}</li>
              ${data.reason ? `<li><strong>السبب:</strong> ${data.reason}</li>` : ''}
            </ul>
            <p>للمزيد من التفاصيل، الرجاء مراجعة النظام.</p>
            <hr style="border: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">Symbol AI - نظام إدارة الأعمال</p>
          </div>
        `,
        bodyEnglish: `
          <div style="font-family: 'Segoe UI', Tahoma, sans-serif;">
            <h2 style="color: #e74c3c;">⚠️ Low Revenue Alert</h2>
            <p>Dear System Supervisor,</p>
            <p>A low revenue has been recorded on <strong>${date}</strong>.</p>
            <ul>
              <li><strong>Amount:</strong> ${data.amount?.toFixed(2)} SAR</li>
              <li><strong>Branch:</strong> ${data.branchName || 'Not specified'}</li>
              ${data.reason ? `<li><strong>Reason:</strong> ${data.reason}</li>` : ''}
            </ul>
            <p>For more details, please check the system.</p>
            <hr style="border: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">Symbol AI - Business Management System</p>
          </div>
        `
      };
      
    case "high_expense":
      return {
        subject: `⚠️ تنبيه: مصروف مرتفع${branchText} | High Expense Alert`,
        bodyArabic: `
          <div style="direction: rtl; text-align: right; font-family: 'Segoe UI', Tahoma, sans-serif;">
            <h2 style="color: #e74c3c;">⚠️ تنبيه مصروف مرتفع</h2>
            <p>عزيزي مشرف النظام،</p>
            <p>تم ملاحظة أنه تم تسجيل مصروف مرتفع بتاريخ <strong>${date}</strong>.</p>
            <ul>
              <li><strong>المبلغ:</strong> ${data.amount?.toFixed(2)} ر.س.</li>
              <li><strong>الفرع:</strong> ${data.branchName || 'غير محدد'}</li>
              ${data.reason ? `<li><strong>البند:</strong> ${data.reason}</li>` : ''}
            </ul>
            <p>للمزيد من التفاصيل، الرجاء مراجعة النظام.</p>
            <hr style="border: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">Symbol AI - نظام إدارة الأعمال</p>
          </div>
        `,
        bodyEnglish: `
          <div style="font-family: 'Segoe UI', Tahoma, sans-serif;">
            <h2 style="color: #e74c3c;">⚠️ High Expense Alert</h2>
            <p>Dear System Supervisor,</p>
            <p>A high expense has been recorded on <strong>${date}</strong>.</p>
            <ul>
              <li><strong>Amount:</strong> ${data.amount?.toFixed(2)} SAR</li>
              <li><strong>Branch:</strong> ${data.branchName || 'Not specified'}</li>
              ${data.reason ? `<li><strong>Category:</strong> ${data.reason}</li>` : ''}
            </ul>
            <p>For more details, please check the system.</p>
            <hr style="border: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">Symbol AI - Business Management System</p>
          </div>
        `
      };
      
    case "revenue_mismatch":
      return {
        subject: `🔴 تنبيه: إيراد غير متطابق${branchText} | Revenue Mismatch Alert`,
        bodyArabic: `
          <div style="direction: rtl; text-align: right; font-family: 'Segoe UI', Tahoma, sans-serif;">
            <h2 style="color: #c0392b;">🔴 تنبيه إيراد غير متطابق</h2>
            <p>عزيزي مشرف النظام، المدير العام،</p>
            <p>تم ملاحظة النظام أنه تم تسجيل إيراد غير متطابق بتاريخ <strong>${date}</strong>.</p>
            <ul>
              <li><strong>الفرع:</strong> ${data.branchName || 'غير محدد'}</li>
              ${data.reason ? `<li><strong>السبب المسجل:</strong> ${data.reason}</li>` : ''}
              ${data.amount ? `<li><strong>الفرق:</strong> ${data.amount?.toFixed(2)} ر.س.</li>` : ''}
            </ul>
            <p><strong>للمزيد من التفاصيل، الرجاء مراجعة النظام.</strong></p>
            <hr style="border: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">Symbol AI - نظام إدارة الأعمال</p>
          </div>
        `,
        bodyEnglish: `
          <div style="font-family: 'Segoe UI', Tahoma, sans-serif;">
            <h2 style="color: #c0392b;">🔴 Revenue Mismatch Alert</h2>
            <p>Dear System Supervisor, General Manager,</p>
            <p>The system has detected a revenue mismatch recorded on <strong>${date}</strong>.</p>
            <ul>
              <li><strong>Branch:</strong> ${data.branchName || 'Not specified'}</li>
              ${data.reason ? `<li><strong>Recorded Reason:</strong> ${data.reason}</li>` : ''}
              ${data.amount ? `<li><strong>Difference:</strong> ${data.amount?.toFixed(2)} SAR</li>` : ''}
            </ul>
            <p><strong>For more details, please check the system.</strong></p>
            <hr style="border: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">Symbol AI - Business Management System</p>
          </div>
        `
      };
      
    case "monthly_reminder":
      return {
        subject: `📅 تذكير: موعد الجرد والتدقيق الشهري | Monthly Audit Reminder`,
        bodyArabic: `
          <div style="direction: rtl; text-align: right; font-family: 'Segoe UI', Tahoma, sans-serif;">
            <h2 style="color: #3498db;">📅 تذكير الجرد والتدقيق الشهري</h2>
            <p>عزيزي مشرف النظام،</p>
            <p>هذا تذكير بموعد الجرد والتدقيق الشهري (يوم 27 من الشهر).</p>
            <h3>المهام المطلوبة:</h3>
            <ul>
              <li>✅ إجراء جرد المخزون</li>
              <li>✅ مراجعة الإيرادات والمصاريف</li>
              <li>✅ التحقق من التقارير المالية</li>
              <li>✅ إعداد مسيرات الرواتب</li>
            </ul>
            <p>الرجاء إتمام هذه المهام قبل نهاية الشهر.</p>
            <hr style="border: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">Symbol AI - نظام إدارة الأعمال</p>
          </div>
        `,
        bodyEnglish: `
          <div style="font-family: 'Segoe UI', Tahoma, sans-serif;">
            <h2 style="color: #3498db;">📅 Monthly Audit Reminder</h2>
            <p>Dear System Supervisor,</p>
            <p>This is a reminder for the monthly inventory audit and review (27th of each month).</p>
            <h3>Required Tasks:</h3>
            <ul>
              <li>✅ Conduct inventory count</li>
              <li>✅ Review revenues and expenses</li>
              <li>✅ Verify financial reports</li>
              <li>✅ Prepare payroll</li>
            </ul>
            <p>Please complete these tasks before the end of the month.</p>
            <hr style="border: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">Symbol AI - Business Management System</p>
          </div>
        `
      };
      
    case "employee_request":
      return {
        subject: `📋 طلب موظف جديد${branchText} | New Employee Request`,
        bodyArabic: `
          <div style="direction: rtl; text-align: right; font-family: 'Segoe UI', Tahoma, sans-serif;">
            <h2 style="color: #9b59b6;">📋 طلب موظف جديد</h2>
            <p>عزيزي مشرف النظام،</p>
            <p>تم ${data.customData?.isUpdate ? 'تحديث' : 'إنشاء'} طلب موظف جديد.</p>
            <ul>
              <li><strong>الموظف:</strong> ${data.employeeName || 'غير محدد'}</li>
              <li><strong>نوع الطلب:</strong> ${data.customData?.requestType || 'غير محدد'}</li>
              <li><strong>الفرع:</strong> ${data.branchName || 'غير محدد'}</li>
              <li><strong>التاريخ:</strong> ${date}</li>
            </ul>
            <p>الرجاء مراجعة الطلب واتخاذ الإجراء المناسب.</p>
            <hr style="border: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">Symbol AI - نظام إدارة الأعمال</p>
          </div>
        `,
        bodyEnglish: `
          <div style="font-family: 'Segoe UI', Tahoma, sans-serif;">
            <h2 style="color: #9b59b6;">📋 New Employee Request</h2>
            <p>Dear System Supervisor,</p>
            <p>An employee request has been ${data.customData?.isUpdate ? 'updated' : 'created'}.</p>
            <ul>
              <li><strong>Employee:</strong> ${data.employeeName || 'Not specified'}</li>
              <li><strong>Request Type:</strong> ${data.customData?.requestType || 'Not specified'}</li>
              <li><strong>Branch:</strong> ${data.branchName || 'Not specified'}</li>
              <li><strong>Date:</strong> ${date}</li>
            </ul>
            <p>Please review the request and take appropriate action.</p>
            <hr style="border: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">Symbol AI - Business Management System</p>
          </div>
        `
      };
      
    case "bonus_request":
      return {
        subject: `🎁 طلب بونص جديد${branchText} | New Bonus Request`,
        bodyArabic: `
          <div style="direction: rtl; text-align: right; font-family: 'Segoe UI', Tahoma, sans-serif;">
            <h2 style="color: #f39c12;">🎁 طلب بونص جديد</h2>
            <p>عزيزي مشرف النظام،</p>
            <p>تم تقديم طلب بونص جديد.</p>
            <ul>
              <li><strong>الموظف:</strong> ${data.employeeName || 'غير محدد'}</li>
              <li><strong>المبلغ:</strong> ${data.amount?.toFixed(2)} ر.س.</li>
              <li><strong>الفرع:</strong> ${data.branchName || 'غير محدد'}</li>
              <li><strong>التاريخ:</strong> ${date}</li>
            </ul>
            <p>الرجاء مراجعة الطلب واتخاذ الإجراء المناسب.</p>
            <hr style="border: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">Symbol AI - نظام إدارة الأعمال</p>
          </div>
        `,
        bodyEnglish: `
          <div style="font-family: 'Segoe UI', Tahoma, sans-serif;">
            <h2 style="color: #f39c12;">🎁 New Bonus Request</h2>
            <p>Dear System Supervisor,</p>
            <p>A new bonus request has been submitted.</p>
            <ul>
              <li><strong>Employee:</strong> ${data.employeeName || 'Not specified'}</li>
              <li><strong>Amount:</strong> ${data.amount?.toFixed(2)} SAR</li>
              <li><strong>Branch:</strong> ${data.branchName || 'Not specified'}</li>
              <li><strong>Date:</strong> ${date}</li>
            </ul>
            <p>Please review the request and take appropriate action.</p>
            <hr style="border: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">Symbol AI - Business Management System</p>
          </div>
        `
      };
      
    case "payroll_created":
      return {
        subject: `💰 تم إنشاء مسير رواتب${branchText} | Payroll Created`,
        bodyArabic: `
          <div style="direction: rtl; text-align: right; font-family: 'Segoe UI', Tahoma, sans-serif;">
            <h2 style="color: #27ae60;">💰 تم إنشاء مسير رواتب</h2>
            <p>عزيزي مشرف النظام،</p>
            <p>تم إنشاء مسير رواتب جديد.</p>
            <ul>
              <li><strong>الفرع:</strong> ${data.branchName || 'غير محدد'}</li>
              <li><strong>الشهر:</strong> ${data.customData?.month || 'غير محدد'}</li>
              <li><strong>إجمالي المبلغ:</strong> ${data.amount?.toFixed(2)} ر.س.</li>
              <li><strong>عدد الموظفين:</strong> ${data.customData?.employeeCount || 0}</li>
            </ul>
            <p>الرجاء مراجعة المسير والموافقة عليه.</p>
            <hr style="border: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">Symbol AI - نظام إدارة الأعمال</p>
          </div>
        `,
        bodyEnglish: `
          <div style="font-family: 'Segoe UI', Tahoma, sans-serif;">
            <h2 style="color: #27ae60;">💰 Payroll Created</h2>
            <p>Dear System Supervisor,</p>
            <p>A new payroll has been created.</p>
            <ul>
              <li><strong>Branch:</strong> ${data.branchName || 'Not specified'}</li>
              <li><strong>Month:</strong> ${data.customData?.month || 'Not specified'}</li>
              <li><strong>Total Amount:</strong> ${data.amount?.toFixed(2)} SAR</li>
              <li><strong>Employee Count:</strong> ${data.customData?.employeeCount || 0}</li>
            </ul>
            <p>Please review and approve the payroll.</p>
            <hr style="border: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">Symbol AI - Business Management System</p>
          </div>
        `
      };
      
    default:
      return {
        subject: `📢 إشعار من Symbol AI | Notification from Symbol AI`,
        bodyArabic: `
          <div style="direction: rtl; text-align: right; font-family: 'Segoe UI', Tahoma, sans-serif;">
            <h2 style="color: #3498db;">📢 إشعار جديد</h2>
            <p>عزيزي مشرف النظام،</p>
            <p>لديك إشعار جديد في النظام.</p>
            <p>الرجاء مراجعة النظام للمزيد من التفاصيل.</p>
            <hr style="border: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">Symbol AI - نظام إدارة الأعمال</p>
          </div>
        `,
        bodyEnglish: `
          <div style="font-family: 'Segoe UI', Tahoma, sans-serif;">
            <h2 style="color: #3498db;">📢 New Notification</h2>
            <p>Dear System Supervisor,</p>
            <p>You have a new notification in the system.</p>
            <p>Please check the system for more details.</p>
            <hr style="border: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">Symbol AI - Business Management System</p>
          </div>
        `
      };
  }
}

// إرسال الإشعار
export async function sendAdvancedNotification(data: NotificationData): Promise<{ success: boolean; sentCount: number; errors: string[] }> {
  const recipients = await getRecipients(data.type, data.branchId);
  const content = generateNotificationContent(data);
  const errors: string[] = [];
  let sentCount = 0;
  
  for (const recipient of recipients) {
    try {
      // إنشاء HTML مجمع (عربي + إنجليزي)
      const combinedHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { margin: 0; padding: 20px; background: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 20px; text-align: center; }
            .header img { height: 50px; }
            .header h1 { color: white; margin: 10px 0 0; font-size: 18px; }
            .content { padding: 20px; }
            .divider { border-top: 2px solid #eee; margin: 20px 0; }
            .footer { background: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Symbol AI</h1>
            </div>
            <div class="content">
              ${content.bodyArabic}
              <div class="divider"></div>
              ${content.bodyEnglish}
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Symbol AI - جميع الحقوق محفوظة</p>
            </div>
          </div>
        </body>
        </html>
      `;
      
      // إرسال البريد
      const result = await resend.emails.send({
        from: FROM_EMAIL,
        to: recipient.email,
        subject: content.subject,
        html: combinedHtml,
      });
      
      // تسجيل الإرسال
      await db.logSentNotification({
        recipientId: recipient.id,
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        notificationType: data.type,
        subject: content.subject,
        bodyArabic: content.bodyArabic,
        bodyEnglish: content.bodyEnglish,
        entityType: data.entityType,
        entityId: data.entityId,
        branchId: data.branchId || undefined,
        branchName: data.branchName,
        status: "sent",
        sentAt: new Date(),
      });
      
      sentCount++;
      console.log(`✓ تم إرسال الإشعار إلى: ${recipient.name} (${recipient.email})`);
      
    } catch (error: any) {
      console.error(`✗ فشل إرسال الإشعار إلى ${recipient.email}:`, error.message);
      errors.push(`${recipient.email}: ${error.message}`);
      
      // تسجيل الفشل
      await db.logSentNotification({
        recipientId: recipient.id,
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        notificationType: data.type,
        subject: content.subject,
        bodyArabic: content.bodyArabic,
        bodyEnglish: content.bodyEnglish,
        entityType: data.entityType,
        entityId: data.entityId,
        branchId: data.branchId || undefined,
        branchName: data.branchName,
        status: "failed",
        errorMessage: error.message,
      });
    }
  }
  
  return { success: errors.length === 0, sentCount, errors };
}




// ==================== دوال التنبيهات التلقائية ====================

// حدود التنبيهات
const REVENUE_THRESHOLD = 500; // تنبيه إذا كان الإيراد أقل من 500 ر.س.
const EXPENSE_THRESHOLD = 500; // تنبيه إذا كان المصروف أكثر من 500 ر.س.

// التحقق من الإيراد وإرسال تنبيه إذا كان منخفضاً
export async function checkAndNotifyLowRevenue(data: {
  amount: number;
  branchId: number;
  branchName: string;
  date: string;
  reason?: string;
}): Promise<{ triggered: boolean; result?: any }> {
  if (data.amount < REVENUE_THRESHOLD) {
    console.log(`⚠️ تنبيه: إيراد منخفض (${data.amount} ر.س.) في فرع ${data.branchName}`);
    const result = await sendAdvancedNotification({
      type: "low_revenue",
      branchId: data.branchId,
      branchName: data.branchName,
      amount: data.amount,
      date: data.date,
      reason: data.reason,
    });
    return { triggered: true, result };
  }
  return { triggered: false };
}

// التحقق من المصروف وإرسال تنبيه إذا كان مرتفعاً
export async function checkAndNotifyHighExpense(data: {
  amount: number;
  branchId?: number;
  branchName?: string;
  date: string;
  category?: string;
}): Promise<{ triggered: boolean; result?: any }> {
  if (data.amount > EXPENSE_THRESHOLD) {
    console.log(`⚠️ تنبيه: مصروف مرتفع (${data.amount} ر.س.) - ${data.category || 'غير محدد'}`);
    const result = await sendAdvancedNotification({
      type: "high_expense",
      branchId: data.branchId,
      branchName: data.branchName || 'عام',
      amount: data.amount,
      date: data.date,
      reason: data.category,
    });
    return { triggered: true, result };
  }
  return { triggered: false };
}

// إرسال تنبيه إيراد غير متطابق
export async function notifyRevenueMismatch(data: {
  branchId: number;
  branchName: string;
  date: string;
  reason: string;
  difference?: number;
}): Promise<{ success: boolean; result?: any }> {
  console.log(`🔴 تنبيه: إيراد غير متطابق في فرع ${data.branchName} بتاريخ ${data.date}`);
  const result = await sendAdvancedNotification({
    type: "revenue_mismatch",
    branchId: data.branchId,
    branchName: data.branchName,
    date: data.date,
    reason: data.reason,
    amount: data.difference,
  });
  return { success: result.success, result };
}

// إرسال تذكير الجرد الشهري
// مهم: هذه الدالة معطلة - استخدم scheduledNotificationService.ts بدلاً منها
// السبب: منع تكرار الإشعارات من مصادر متعددة

export async function sendMonthlyInventoryReminder(): Promise<{ success: boolean; result?: any; skipped?: boolean }> {
  console.log(`⚠️ [DEPRECATED] sendMonthlyInventoryReminder - استخدم scheduledNotificationService.checkAndSendScheduledReminders() بدلاً`);
  
  // استخدام النظام الموحد
  const { sendInventoryReminderUnified } = await import('./scheduledNotificationService');
  const today = new Date();
  const dayOfMonth = today.getDate();
  
  // إرسال فقط إذا كان اليوم 12 أو 29
  if (dayOfMonth === 12 || dayOfMonth === 29) {
    const result = await sendInventoryReminderUnified(dayOfMonth as 12 | 29);
    return { 
      success: result.success, 
      result: { sentCount: result.sentCount },
      skipped: result.skipped 
    };
  }
  
  return { success: false, skipped: true };
}

// إرسال إشعار طلب موظف
export async function notifyEmployeeRequest(data: {
  employeeName: string;
  requestType: string;
  branchId?: number;
  branchName?: string;
  isUpdate?: boolean;
}): Promise<{ success: boolean; result?: any }> {
  console.log(`📋 إشعار طلب موظف: ${data.employeeName} - ${data.requestType}`);
  const result = await sendAdvancedNotification({
    type: "employee_request",
    branchId: data.branchId,
    branchName: data.branchName,
    employeeName: data.employeeName,
    customData: {
      requestType: data.requestType,
      isUpdate: data.isUpdate,
    },
  });
  return { success: result.success, result };
}

// إرسال إشعار طلب بونص
export async function notifyBonusRequest(data: {
  employeeName: string;
  amount: number;
  branchId?: number;
  branchName?: string;
}): Promise<{ success: boolean; result?: any }> {
  console.log(`🎁 إشعار طلب بونص: ${data.employeeName} - ${data.amount} ر.س.`);
  const result = await sendAdvancedNotification({
    type: "bonus_request",
    branchId: data.branchId,
    branchName: data.branchName,
    employeeName: data.employeeName,
    amount: data.amount,
  });
  return { success: result.success, result };
}

// إرسال إشعار إنشاء مسيرة رواتب
export async function notifyPayrollCreated(data: {
  branchId?: number;
  branchName?: string;
  month: string;
  totalAmount: number;
  employeeCount: number;
}): Promise<{ success: boolean; result?: any }> {
  console.log(`💰 إشعار إنشاء مسيرة رواتب: ${data.month} - ${data.totalAmount} ر.س.`);
  const result = await sendAdvancedNotification({
    type: "payroll_created",
    branchId: data.branchId,
    branchName: data.branchName,
    amount: data.totalAmount,
    customData: {
      month: data.month,
      employeeCount: data.employeeCount,
    },
  });
  return { success: result.success, result };
}

// إرسال إشعار تحديث منتج
export async function notifyProductUpdate(data: {
  productName: string;
  updateType: 'created' | 'updated' | 'deleted' | 'low_stock';
  branchId?: number;
  branchName?: string;
}): Promise<{ success: boolean; result?: any }> {
  console.log(`📦 إشعار تحديث منتج: ${data.productName} - ${data.updateType}`);
  const result = await sendAdvancedNotification({
    type: "product_update",
    branchId: data.branchId,
    branchName: data.branchName,
    productName: data.productName,
    customData: {
      updateType: data.updateType,
    },
  });
  return { success: result.success, result };
}

// إرسال بريد اختباري
export async function sendTestNotification(recipientEmail: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: recipientEmail,
      subject: "🧪 بريد اختباري من Symbol AI | Test Email from Symbol AI",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { margin: 0; padding: 20px; background: #f5f5f5; font-family: 'Segoe UI', Tahoma, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 20px; text-align: center; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { padding: 30px; }
            .success { color: #27ae60; font-size: 48px; text-align: center; }
            .message { text-align: center; margin: 20px 0; }
            .footer { background: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Symbol AI</h1>
            </div>
            <div class="content">
              <div class="success">✅</div>
              <div class="message">
                <h2 style="direction: rtl;">تم إرسال البريد الاختباري بنجاح!</h2>
                <p style="direction: rtl; color: #666;">هذا البريد يؤكد أن نظام الإشعارات يعمل بشكل صحيح.</p>
                <hr style="border: 1px solid #eee; margin: 20px 0;">
                <h2>Test Email Sent Successfully!</h2>
                <p style="color: #666;">This email confirms that the notification system is working correctly.</p>
              </div>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Symbol AI - جميع الحقوق محفوظة</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
    
    console.log(`✓ تم إرسال بريد اختباري إلى: ${recipientEmail}`);
    return { success: true };
  } catch (error: any) {
    console.error(`✗ فشل إرسال البريد الاختباري إلى ${recipientEmail}:`, error.message);
    return { success: false, error: error.message };
  }
}


// إرسال إشعار اكتمال حساب البونص الأسبوعي
export async function notifyBonusCalculationCompleted(data: {
  branchId?: number;
  branchName?: string;
  weekNumber: number;
  month: number;
  year: number;
  totalAmount: number;
  eligibleCount: number;
  totalEmployees: number;
  details: Array<{
    employeeName: string;
    weeklyRevenue: number;
    bonusAmount: number;
    bonusTier: string;
    /** اسم المستوى المحفوظ وقت الاحتساب */
    tierName?: string | null;
  }>;
}): Promise<{ success: boolean; result?: any }> {
  const periodText = formatBonusPeriodLabel(data.weekNumber, data.month, data.year);
  console.log(`🎁 إشعار اكتمال حساب البونص: ${periodText}`);
  
  const eligibilityPercentage = data.totalEmployees > 0 
    ? ((data.eligibleCount / data.totalEmployees) * 100).toFixed(0) 
    : 0;
  
  const detailsRows = data.details.map((detail, index) => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 10px; text-align: right;">${index + 1}</td>
      <td style="padding: 10px; text-align: right;">${detail.employeeName}</td>
      <td style="padding: 10px; text-align: right;">${detail.weeklyRevenue.toFixed(2)} ر.س</td>
      <td style="padding: 10px; text-align: right;">
        <span style="background-color: ${getTierColorHex(detail.bonusTier)}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px;">
          ${getTierDisplayName(detail.bonusTier, detail.tierName)}
        </span>
      </td>
      <td style="padding: 10px; text-align: right; font-weight: bold; color: #22c55e;">${detail.bonusAmount.toFixed(2)} ر.س</td>
    </tr>
  `).join('');
  
  const recipients = await getRecipients("bonus_request", data.branchId);
  
  if (recipients.length === 0) {
    console.log("⚠️ لا يوجد مستلمين لإشعار البونص");
    return { success: false, result: "No recipients found" };
  }
  
  const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, sans-serif; direction: rtl; text-align: right; }
        .container { max-width: 700px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .header .subtitle { margin-top: 10px; opacity: 0.9; }
        .content { background: white; padding: 30px; border: 1px solid #e2e8f0; }
        .summary { display: flex; justify-content: space-around; margin-bottom: 30px; flex-wrap: wrap; }
        .summary-item { text-align: center; padding: 15px; min-width: 120px; }
        .summary-item .value { font-size: 28px; font-weight: bold; margin-bottom: 5px; }
        .summary-item .label { font-size: 12px; color: #64748b; }
        .purple { color: #a855f7; }
        .green { color: #22c55e; }
        .blue { color: #3b82f6; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #f8fafc; padding: 12px; text-align: right; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
        td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
        .footer { background: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 12px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none; }
        .total-row { background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%); color: white; font-weight: bold; }
        .total-row td { border: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎁 تقرير البونص الأسبوعي</h1>
          <div class="subtitle">فرع ${data.branchName || 'غير محدد'} - الفترة ${periodText}</div>
        </div>
        
        <div class="content">
          <div class="summary">
            <div class="summary-item">
              <div class="value purple">${data.totalAmount.toFixed(2)} ر.س</div>
              <div class="label">إجمالي البونص</div>
            </div>
            <div class="summary-item">
              <div class="value green">${data.eligibleCount}</div>
              <div class="label">موظفين مؤهلين</div>
            </div>
            <div class="summary-item">
              <div class="value blue">${data.totalEmployees}</div>
              <div class="label">إجمالي الموظفين</div>
            </div>
            <div class="summary-item">
              <div class="value" style="color: #eab308;">${eligibilityPercentage}%</div>
              <div class="label">نسبة الأهلية</div>
            </div>
          </div>
          
          <h3 style="color: #1a1a2e; margin-bottom: 15px;">📋 تفاصيل البونص</h3>
          
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>اسم الموظف</th>
                <th>الإيراد الأسبوعي</th>
                <th>المستوى</th>
                <th>البونص</th>
              </tr>
            </thead>
            <tbody>
              ${detailsRows}
              <tr class="total-row">
                <td colspan="4" style="padding: 12px;">الإجمالي</td>
                <td style="padding: 12px;">${data.totalAmount.toFixed(2)} ر.س</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div class="footer">
          <p>تم إنشاء هذا التقرير تلقائياً بواسطة Symbol AI</p>
          <p>${new Date().toLocaleDateString('ar-SA')} ${new Date().toLocaleTimeString('ar-SA')}</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  let successCount = 0;
  for (const recipient of recipients) {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: recipient.email,
        subject: `🎁 تقرير البونص الأسبوعي - ${data.branchName || 'غير محدد'} - ${periodText}`,
        html: htmlContent,
      });
      console.log(`✓ تم إرسال تقرير البونص إلى: ${recipient.name} (${recipient.email})`);
      successCount++;
    } catch (error: any) {
      console.error(`✗ فشل إرسال تقرير البونص إلى ${recipient.email}:`, error.message);
    }
  }
  
  return { 
    success: successCount > 0, 
    result: { 
      sent: successCount, 
      total: recipients.length 
    } 
  };
}
