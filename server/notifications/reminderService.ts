import * as db from "../db";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "info@symbolai.net";

// إرسال تذكير للإيرادات غير المسجلة
export async function sendMissingRevenueReminder(data: {
  branchId: number;
  branchName: string;
  date: string;
  supervisorEmail: string;
  supervisorName: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`⚠️ تذكير إيراد غير مسجل: ${data.branchName} - ${data.date}`);
    
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.supervisorEmail,
      subject: `⚠️ تذكير: لم يتم تسجيل إيراد ${data.branchName} ليوم ${data.date}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { margin: 0; padding: 20px; background: #f5f5f5; font-family: 'Segoe UI', Tahoma, sans-serif; direction: rtl; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); padding: 20px; text-align: center; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { padding: 30px; text-align: right; }
            .warning-icon { font-size: 48px; text-align: center; margin-bottom: 20px; }
            .info-box { background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin: 20px 0; }
            .footer { background: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ تذكير هام</h1>
            </div>
            <div class="content">
              <div class="warning-icon">📊</div>
              <h2>عزيزي/عزيزتي ${data.supervisorName}،</h2>
              <p>نود تذكيرك بأنه <strong>لم يتم تسجيل إيراد</strong> لفرع <strong>${data.branchName}</strong> ليوم <strong>${data.date}</strong>.</p>
              
              <div class="info-box">
                <h3 style="margin-top: 0; color: #856404;">📋 المطلوب:</h3>
                <ul style="color: #856404;">
                  <li>تسجيل الإيراد اليومي في النظام</li>
                  <li>رفع صور الموازنة</li>
                  <li>التأكد من مطابقة الإيرادات</li>
                </ul>
              </div>
              
              <p>الرجاء تسجيل الإيراد في أقرب وقت ممكن.</p>
              <p style="color: #666; font-size: 14px;">في حال وجود أي استفسار، يرجى التواصل مع الإدارة.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Symbol AI - نظام إدارة الأعمال</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
    
    // تسجيل الإشعار في قاعدة البيانات
    await db.logSentNotification({
      recipientId: 0,
      recipientEmail: data.supervisorEmail,
      notificationType: "missing_revenue_reminder",
      subject: `تذكير: لم يتم تسجيل إيراد ${data.branchName} ليوم ${data.date}`,
      bodyArabic: `تذكير بتسجيل إيراد فرع ${data.branchName} ليوم ${data.date}`,
      status: "sent",
    });
    
    console.log(`✓ تم إرسال تذكير إلى: ${data.supervisorEmail}`);
    return { success: true };
  } catch (error: any) {
    console.error(`✗ فشل إرسال التذكير إلى ${data.supervisorEmail}:`, error.message);
    return { success: false, error: error.message };
  }
}

// إرسال رسالة ترحيبية
export async function sendWelcomeMessage(data: {
  email: string;
  name: string;
  role: string;
  branchName?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`👋 إرسال رسالة ترحيبية إلى: ${data.name} (${data.email})`);
    
    const roleTextMap: Record<string, string> = {
      admin: "المدير العام",
      general_supervisor: "المشرف العام",
      branch_supervisor: `مشرف فرع ${data.branchName || ""}`,
      manager: "المدير",
      employee: "الموظف",
      supervisor: "المشرف",
      viewer: "المشاهد",
    };
    const roleText = roleTextMap[data.role] || data.role;
    
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: `🎉 مرحباً بك في Symbol AI - نظام إدارة الأعمال`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { margin: 0; padding: 20px; background: #f5f5f5; font-family: 'Segoe UI', Tahoma, sans-serif; direction: rtl; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; text-align: center; }
            .header h1 { color: #00d4ff; margin: 0; font-size: 28px; }
            .header p { color: #ccc; margin: 10px 0 0; }
            .content { padding: 30px; text-align: right; }
            .welcome-icon { font-size: 64px; text-align: center; margin-bottom: 20px; }
            .role-badge { display: inline-block; background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%); color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; margin: 10px 0; }
            .features { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .features h3 { margin-top: 0; color: #1a1a2e; }
            .features ul { padding-right: 20px; }
            .features li { margin: 10px 0; color: #555; }
            .footer { background: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Symbol AI</h1>
              <p>نظام إدارة الأعمال المتكامل</p>
            </div>
            <div class="content">
              <div class="welcome-icon">🎉</div>
              <h2>مرحباً ${data.name}!</h2>
              <p>يسعدنا انضمامك إلى نظام Symbol AI لإدارة الأعمال.</p>
              
              <p>دورك في النظام: <span class="role-badge">${roleText}</span></p>
              
              <div class="features">
                <h3>📋 ما يمكنك فعله في النظام:</h3>
                <ul>
                  <li>✅ تسجيل ومتابعة الإيرادات اليومية</li>
                  <li>✅ إدارة المصاريف والمشتريات</li>
                  <li>✅ متابعة طلبات الموظفين</li>
                  <li>✅ عرض التقارير والإحصائيات</li>
                  <li>✅ استلام الإشعارات والتنبيهات</li>
                </ul>
              </div>
              
              <p>إذا كان لديك أي استفسار، لا تتردد في التواصل مع فريق الدعم.</p>
              
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                مع أطيب التحيات،<br>
                <strong>فريق Symbol AI</strong>
              </p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Symbol AI - جميع الحقوق محفوظة</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
    
    // تسجيل الإشعار في قاعدة البيانات
    await db.logSentNotification({
      recipientId: 0,
      recipientEmail: data.email,
      notificationType: "welcome_message",
      subject: `مرحباً بك في Symbol AI`,
      bodyArabic: `رسالة ترحيبية لـ ${data.name} - ${roleText}`,
      status: "sent",
    });
    
    console.log(`✓ تم إرسال رسالة ترحيبية إلى: ${data.email}`);
    return { success: true };
  } catch (error: any) {
    console.error(`✗ فشل إرسال الرسالة الترحيبية إلى ${data.email}:`, error.message);
    return { success: false, error: error.message };
  }
}

// فحص وإرسال تذكيرات الإيرادات غير المسجلة
export async function checkAndSendMissingRevenueReminders(): Promise<{
  checked: number;
  missing: number;
  sent: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let sent = 0;
  
  try {
    // الحصول على جميع الفروع
    const branches = await db.getBranches();
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    console.log(`🔍 فحص الإيرادات غير المسجلة ليوم ${yesterdayStr}...`);
    
    // الحصول على مستلمي الإشعارات
    const recipients = await db.getNotificationRecipients(null);
    
    const missingBranches: { branchId: number; branchName: string }[] = [];
    
    // فحص كل فرع
    for (const branch of branches) {
      const revenue = await db.getDailyRevenueByDate(branch.id, new Date(yesterdayStr));
      if (!revenue) {
        missingBranches.push({ branchId: branch.id, branchName: branch.nameAr });
      }
    }
    
    console.log(`📊 الفروع التي لم تسجل إيراد: ${missingBranches.length} من ${branches.length}`);
    
    // إرسال تذكيرات
    for (const missing of missingBranches) {
      // إيجاد المشرف المسؤول عن الفرع
      const branchRecipients = recipients.filter(
        (r: any) => r.branchId === missing.branchId || r.role === 'admin' || r.role === 'general_supervisor'
      );
      
      for (const recipient of branchRecipients) {
        const result = await sendMissingRevenueReminder({
          branchId: missing.branchId,
          branchName: missing.branchName,
          date: yesterdayStr,
          supervisorEmail: recipient.email,
          supervisorName: recipient.name,
        });
        
        if (result.success) {
          sent++;
        } else {
          errors.push(`فشل إرسال تذكير إلى ${recipient.email}: ${result.error}`);
        }
      }
    }
    
    return {
      checked: branches.length,
      missing: missingBranches.length,
      sent,
      errors,
    };
  } catch (error: any) {
    console.error('خطأ في فحص الإيرادات غير المسجلة:', error);
    errors.push(error.message);
    return { checked: 0, missing: 0, sent: 0, errors };
  }
}

// إرسال رسائل ترحيبية لجميع المستلمين
export async function sendWelcomeMessagesToAll(): Promise<{
  total: number;
  sent: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let sent = 0;
  
  try {
    // الحصول على جميع مستلمي الإشعارات
    const recipients = await db.getNotificationRecipients(null);
    
    console.log(`📧 إرسال رسائل ترحيبية إلى ${recipients.length} مستلم...`);
    
    // الحصول على الفروع لربط الأسماء
    const branches = await db.getBranches();
    const branchMap = new Map(branches.map((b: any) => [b.id, b.nameAr]));
    
    for (const recipient of recipients) {
      const branchName = recipient.branchId ? branchMap.get(recipient.branchId) : undefined;
      
      const result = await sendWelcomeMessage({
        email: recipient.email,
        name: recipient.name,
        role: recipient.role,
        branchName: branchName as string | undefined,
      });
      
      if (result.success) {
        sent++;
      } else {
        errors.push(`فشل إرسال رسالة ترحيبية إلى ${recipient.email}: ${result.error}`);
      }
      
      // انتظار قليل بين الرسائل لتجنب rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return {
      total: recipients.length,
      sent,
      errors,
    };
  } catch (error: any) {
    console.error('خطأ في إرسال الرسائل الترحيبية:', error);
    errors.push(error.message);
    return { total: 0, sent: 0, errors };
  }
}
