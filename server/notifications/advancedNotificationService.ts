import * as db from "../db";
import { Resend } from "resend";

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
        subject: `💰 تم إنشاء مسيرة رواتب${branchText} | Payroll Created`,
        bodyArabic: `
          <div style="direction: rtl; text-align: right; font-family: 'Segoe UI', Tahoma, sans-serif;">
            <h2 style="color: #27ae60;">💰 تم إنشاء مسيرة رواتب</h2>
            <p>عزيزي مشرف النظام،</p>
            <p>تم إنشاء مسيرة رواتب جديدة.</p>
            <ul>
              <li><strong>الفرع:</strong> ${data.branchName || 'غير محدد'}</li>
              <li><strong>الشهر:</strong> ${data.customData?.month || 'غير محدد'}</li>
              <li><strong>إجمالي المبلغ:</strong> ${data.amount?.toFixed(2)} ر.س.</li>
              <li><strong>عدد الموظفين:</strong> ${data.customData?.employeeCount || 0}</li>
            </ul>
            <p>الرجاء مراجعة المسيرة والموافقة عليها.</p>
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

// إرسال تذكير الجرد الشهري (يوم 27)
export async function sendMonthlyInventoryReminder(): Promise<{ success: boolean; result?: any }> {
  console.log(`📅 إرسال تذكير الجرد الشهري...`);
  const result = await sendAdvancedNotification({
    type: "monthly_reminder",
    date: new Date().toLocaleDateString('ar-SA'),
  });
  return { success: result.success, result };
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
