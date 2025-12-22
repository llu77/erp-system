import { Resend } from 'resend';
import mysql from 'mysql2/promise';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "info@symbolai.net";

async function main() {
  // الاتصال بقاعدة البيانات
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  // الحصول على جميع الفروع
  const [branches] = await connection.execute('SELECT id, nameAr FROM branches');
  
  // تحديد تاريخ أمس
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  console.log(`🔍 فحص الإيرادات غير المسجلة ليوم ${yesterdayStr}...`);
  
  // الحصول على مستلمي الإشعارات
  const [recipients] = await connection.execute(
    'SELECT id, name, email, role, branchId FROM notificationRecipients WHERE isActive = 1'
  );
  
  const missingBranches = [];
  
  // فحص كل فرع
  for (const branch of branches) {
    const [revenues] = await connection.execute(
      'SELECT id FROM dailyRevenues WHERE branchId = ? AND DATE(date) = ?',
      [branch.id, yesterdayStr]
    );
    
    if (revenues.length === 0) {
      missingBranches.push({ branchId: branch.id, branchName: branch.nameAr });
    }
  }
  
  console.log(`📊 الفروع التي لم تسجل إيراد: ${missingBranches.length} من ${branches.length}`);
  
  if (missingBranches.length === 0) {
    console.log('✅ جميع الفروع سجلت إيراداتها!');
    await connection.end();
    return;
  }
  
  let sent = 0;
  const errors = [];
  
  // إرسال تذكيرات
  for (const missing of missingBranches) {
    console.log(`⚠️ فرع "${missing.branchName}" لم يسجل إيراد ليوم ${yesterdayStr}`);
    
    // إيجاد المشرفين المسؤولين
    const branchRecipients = recipients.filter(
      r => r.branchId === missing.branchId || r.role === 'admin' || r.role === 'general_supervisor'
    );
    
    for (const recipient of branchRecipients) {
      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: recipient.email,
          subject: `⚠️ تذكير: لم يتم تسجيل إيراد ${missing.branchName} ليوم ${yesterdayStr}`,
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
                  <h2>عزيزي/عزيزتي ${recipient.name}،</h2>
                  <p>نود تذكيرك بأنه <strong>لم يتم تسجيل إيراد</strong> لفرع <strong>${missing.branchName}</strong> ليوم <strong>${yesterdayStr}</strong>.</p>
                  
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
        
        console.log(`  ✓ تم إرسال تذكير إلى: ${recipient.name} (${recipient.email})`);
        sent++;
        
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`  ✗ فشل إرسال تذكير إلى ${recipient.email}:`, error.message);
        errors.push(`${recipient.email}: ${error.message}`);
      }
    }
  }
  
  console.log(`\n📊 النتيجة: تم إرسال ${sent} تذكير`);
  if (errors.length > 0) {
    console.log(`⚠️ الأخطاء: ${errors.length}`);
  }
  
  await connection.end();
}

main().catch(console.error);
