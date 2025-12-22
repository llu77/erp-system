import { Resend } from 'resend';
import mysql from 'mysql2/promise';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "info@symbolai.net";

async function main() {
  // الاتصال بقاعدة البيانات
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  // الحصول على مستلمي الإشعارات
  const [recipients] = await connection.execute(
    'SELECT id, name, email, role, branchId FROM notificationRecipients WHERE isActive = 1'
  );
  
  // الحصول على الفروع
  const [branches] = await connection.execute('SELECT id, nameAr FROM branches');
  const branchMap = new Map(branches.map(b => [b.id, b.nameAr]));
  
  console.log(`📧 إرسال رسائل ترحيبية إلى ${recipients.length} مستلم...`);
  
  let sent = 0;
  const errors = [];
  
  for (const recipient of recipients) {
    const branchName = recipient.branchId ? branchMap.get(recipient.branchId) : undefined;
    
    const roleTextMap = {
      admin: "المدير العام",
      general_supervisor: "المشرف العام",
      branch_supervisor: `مشرف فرع ${branchName || ""}`,
      manager: "المدير",
      employee: "الموظف",
      supervisor: "المشرف",
      viewer: "المشاهد",
    };
    const roleText = roleTextMap[recipient.role] || recipient.role;
    
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: recipient.email,
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
                <h2>مرحباً ${recipient.name}!</h2>
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
      
      console.log(`✓ تم إرسال رسالة ترحيبية إلى: ${recipient.name} (${recipient.email})`);
      sent++;
      
      // انتظار قليل بين الرسائل
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`✗ فشل إرسال رسالة إلى ${recipient.email}:`, error.message);
      errors.push(`${recipient.email}: ${error.message}`);
    }
  }
  
  console.log(`\n📊 النتيجة: تم إرسال ${sent} رسالة من أصل ${recipients.length}`);
  if (errors.length > 0) {
    console.log(`⚠️ الأخطاء: ${errors.length}`);
    errors.forEach(e => console.log(`  - ${e}`));
  }
  
  await connection.end();
}

main().catch(console.error);
