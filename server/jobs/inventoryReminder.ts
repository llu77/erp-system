/**
 * تذكيرات الجرد الدوري
 * يتم تشغيل هذا السكريبت يومياً للتحقق من مواعيد الجرد
 * مواعيد الجرد: يوم 12 و 27 من كل شهر
 */

import { Resend } from 'resend';
import { notifyOwner } from '../_core/notification';

const resend = new Resend(process.env.RESEND_API_KEY);

interface InventoryReminderConfig {
  // أيام الجرد في الشهر
  inventoryDays: number[];
  // عدد الأيام قبل الموعد للتذكير
  reminderDaysBefore: number[];
  // قائمة البريد الإلكتروني للمستلمين
  recipientEmails: string[];
}

const defaultConfig: InventoryReminderConfig = {
  inventoryDays: [12, 27],
  reminderDaysBefore: [3, 1, 0], // تذكير قبل 3 أيام، يوم واحد، واليوم نفسه
  recipientEmails: [
    'llu771230@gmail.com', // الأدمن
    'Salemalwadai1997@gmail.com', // المشرف العام
    'elsayed.gouda.mohamed@gmail.com', // مشرف المخزون - السيد محمد
  ],
};

/**
 * التحقق من موعد الجرد القادم
 */
export function getNextInventoryDate(): { date: Date; daysUntil: number; dayOfMonth: number } {
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  let nextDate: Date;
  let dayOfMonth: number;
  
  if (currentDay < 12) {
    nextDate = new Date(currentYear, currentMonth, 12);
    dayOfMonth = 12;
  } else if (currentDay < 27) {
    nextDate = new Date(currentYear, currentMonth, 27);
    dayOfMonth = 27;
  } else {
    nextDate = new Date(currentYear, currentMonth + 1, 12);
    dayOfMonth = 12;
  }
  
  const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  return { date: nextDate, daysUntil, dayOfMonth };
}

/**
 * إرسال تذكير الجرد بالبريد الإلكتروني
 */
export async function sendInventoryReminderEmail(
  recipientEmail: string,
  daysUntil: number,
  inventoryDate: Date
): Promise<boolean> {
  const formattedDate = inventoryDate.toLocaleDateString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  
  const urgencyLevel = daysUntil === 0 ? 'اليوم' : daysUntil === 1 ? 'غداً' : `بعد ${daysUntil} أيام`;
  const urgencyColor = daysUntil === 0 ? '#dc2626' : daysUntil <= 1 ? '#f59e0b' : '#3b82f6';
  
  const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f5f5f5;
      margin: 0;
      padding: 20px;
      direction: rtl;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, ${urgencyColor} 0%, ${urgencyColor}dd 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .header .icon {
      font-size: 48px;
      margin-bottom: 15px;
    }
    .content {
      padding: 30px;
    }
    .urgency-badge {
      display: inline-block;
      background-color: ${urgencyColor}20;
      color: ${urgencyColor};
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: bold;
      margin-bottom: 20px;
    }
    .date-box {
      background-color: #f8fafc;
      border-right: 4px solid ${urgencyColor};
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .date-box h3 {
      margin: 0 0 10px 0;
      color: #374151;
    }
    .date-box p {
      margin: 0;
      font-size: 18px;
      font-weight: bold;
      color: ${urgencyColor};
    }
    .checklist {
      background-color: #f0fdf4;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .checklist h3 {
      color: #166534;
      margin-top: 0;
    }
    .checklist ul {
      margin: 0;
      padding-right: 20px;
    }
    .checklist li {
      padding: 5px 0;
      color: #374151;
    }
    .footer {
      background-color: #f8fafc;
      padding: 20px;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
    }
    .logo {
      font-weight: bold;
      color: #3b82f6;
    }
    .cta-button {
      display: inline-block;
      background-color: ${urgencyColor};
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: bold;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="icon">📋</div>
      <h1>تذكير: موعد الجرد الدوري</h1>
    </div>
    
    <div class="content">
      <div class="urgency-badge">⏰ ${urgencyLevel}</div>
      
      <div class="date-box">
        <h3>موعد الجرد</h3>
        <p>${formattedDate}</p>
      </div>
      
      <div class="checklist">
        <h3>قائمة التحضير للجرد:</h3>
        <ul>
          <li>✅ تجهيز قوائم المنتجات للجرد</li>
          <li>✅ التأكد من توفر الموظفين المسؤولين</li>
          <li>✅ إعداد أدوات الجرد (ماسحات الباركود، أوراق الجرد)</li>
          <li>✅ مراجعة المنتجات قريبة الانتهاء</li>
          <li>✅ التحقق من المنتجات منخفضة المخزون</li>
        </ul>
      </div>
      
      <p>يرجى التأكد من إتمام الجرد في الموعد المحدد لضمان دقة بيانات المخزون.</p>
      
      <center>
        <a href="#" class="cta-button">فتح صفحة المخزون المتقدم</a>
      </center>
    </div>
    
    <div class="footer">
      <p class="logo">Symbol AI</p>
      <p>نظام إدارة المخزون والموارد</p>
      <p>تم إرسال هذا التذكير تلقائياً - ${new Date().toLocaleDateString('ar-SA')}</p>
    </div>
  </div>
</body>
</html>
  `;
  
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Symbol AI <onboarding@resend.dev>',
      to: recipientEmail,
      subject: `📋 تذكير: موعد الجرد الدوري ${urgencyLevel} - ${formattedDate}`,
      html: htmlContent,
    });
    return true;
  } catch (error) {
    console.error('خطأ في إرسال تذكير الجرد:', error);
    return false;
  }
}

/**
 * التحقق وإرسال تذكيرات الجرد
 */
export async function checkAndSendInventoryReminders(
  config: InventoryReminderConfig = defaultConfig
): Promise<{ sent: number; failed: number; skipped: boolean }> {
  const { date: nextDate, daysUntil } = getNextInventoryDate();
  
  // التحقق من أن اليوم هو يوم تذكير
  if (!config.reminderDaysBefore.includes(daysUntil)) {
    return { sent: 0, failed: 0, skipped: true };
  }
  
  let sent = 0;
  let failed = 0;
  
  // إرسال التذكيرات لجميع المستلمين
  for (const email of config.recipientEmails) {
    const success = await sendInventoryReminderEmail(email, daysUntil, nextDate);
    if (success) {
      sent++;
    } else {
      failed++;
    }
  }
  
  // إرسال إشعار للمالك أيضاً
  if (daysUntil <= 1) {
    await notifyOwner({
      title: `تذكير: موعد الجرد الدوري ${daysUntil === 0 ? 'اليوم' : 'غداً'}`,
      content: `موعد الجرد الدوري ${nextDate.toLocaleDateString('ar-SA')}. يرجى التأكد من إتمام الجرد في الموعد المحدد.`,
    });
  }
  
  return { sent, failed, skipped: false };
}

/**
 * تشغيل فحص التذكيرات (يتم استدعاؤه من cron job)
 */
export async function runInventoryReminderJob(): Promise<void> {
  console.log('🔔 بدء فحص تذكيرات الجرد...');
  
  const result = await checkAndSendInventoryReminders();
  
  if (result.skipped) {
    console.log('⏭️ تم تخطي التذكيرات - ليس يوم تذكير');
  } else {
    console.log(`✅ تم إرسال ${result.sent} تذكير بنجاح`);
    if (result.failed > 0) {
      console.log(`❌ فشل إرسال ${result.failed} تذكير`);
    }
  }
}

// تصدير الدوال للاستخدام في الاختبارات
export { defaultConfig };
