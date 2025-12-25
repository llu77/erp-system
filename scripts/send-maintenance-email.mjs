import { Resend } from 'resend';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

const resend = new Resend(process.env.RESEND_API_KEY);

// إنشاء اتصال بقاعدة البيانات
const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

// الحصول على جميع المستخدمين مع بريدهم الإلكتروني
const [users] = await connection.execute(`
  SELECT id, name, email, role, username 
  FROM users 
  WHERE email IS NOT NULL AND email != ''
`);

console.log('المستخدمون المسجلون:', users.length);

// قالب البريد الإلكتروني الاحترافي
const createEmailTemplate = (userName) => `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>إشعار صيانة النظام - Symbol AI</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0a; color: #ffffff;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <!-- Header -->
    <div style="text-align: center; padding: 30px 0; border-bottom: 2px solid #3b82f6;">
      <h1 style="margin: 0; color: #3b82f6; font-size: 28px; font-weight: bold;">Symbol AI</h1>
      <p style="margin: 5px 0 0 0; color: #94a3b8; font-size: 14px;">نظام إدارة الموارد المؤسسية</p>
    </div>

    <!-- Alert Banner -->
    <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 20px; border-radius: 12px; margin: 30px 0; text-align: center;">
      <div style="font-size: 40px; margin-bottom: 10px;">⚠️</div>
      <h2 style="margin: 0; color: #ffffff; font-size: 22px;">إشعار صيانة النظام</h2>
    </div>

    <!-- Main Content -->
    <div style="background-color: #1a1a2e; padding: 30px; border-radius: 12px; margin: 20px 0;">
      <p style="color: #e2e8f0; font-size: 16px; line-height: 1.8; margin: 0 0 20px 0;">
        السلام عليكم ورحمة الله وبركاته،
      </p>
      
      <p style="color: #e2e8f0; font-size: 16px; line-height: 1.8; margin: 0 0 20px 0;">
        <strong style="color: #ffffff;">عزيزي/عزيزتي ${userName}،</strong>
      </p>

      <div style="background-color: #0f172a; padding: 25px; border-radius: 10px; border-right: 4px solid #f59e0b; margin: 20px 0;">
        <p style="color: #f1f5f9; font-size: 16px; line-height: 1.8; margin: 0;">
          <strong style="color: #f59e0b;">من مراقب النظام Symbol AI:</strong>
        </p>
        <p style="color: #e2e8f0; font-size: 16px; line-height: 1.8; margin: 15px 0 0 0;">
          برجاء <strong style="color: #ef4444;">عدم استخدام النظام</strong> حتى الساعة <strong style="color: #22c55e; font-size: 18px;">10:30 مساءً</strong>
        </p>
      </div>

      <div style="background-color: #0f172a; padding: 20px; border-radius: 10px; margin: 20px 0;">
        <h3 style="color: #3b82f6; margin: 0 0 15px 0; font-size: 18px;">🚀 سبب الصيانة:</h3>
        <p style="color: #e2e8f0; font-size: 15px; line-height: 1.8; margin: 0;">
          تدشين وتحديث الصفحات التالية:
        </p>
        <ul style="color: #94a3b8; font-size: 15px; line-height: 2; margin: 15px 0 0 0; padding-right: 20px;">
          <li style="color: #22c55e;">📄 صفحات الفواتير</li>
          <li style="color: #3b82f6;">💰 صفحات المبيعات</li>
          <li style="color: #f59e0b;">📦 صفحات المخزون</li>
          <li style="color: #a855f7;">📋 صفحات الجرد</li>
        </ul>
      </div>

      <p style="color: #94a3b8; font-size: 14px; line-height: 1.8; margin: 20px 0 0 0; text-align: center;">
        نعتذر عن أي إزعاج قد يسببه ذلك، ونشكركم على تفهمكم وتعاونكم.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 25px 0; border-top: 1px solid #334155; margin-top: 20px;">
      <p style="color: #64748b; font-size: 13px; margin: 0 0 10px 0;">
        مع أطيب التحيات،
      </p>
      <p style="color: #3b82f6; font-size: 16px; font-weight: bold; margin: 0;">
        فريق Symbol AI
      </p>
      <p style="color: #475569; font-size: 12px; margin: 15px 0 0 0;">
        📅 ${new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </p>
    </div>

  </div>
</body>
</html>
`;

// إرسال البريد لكل مستخدم
const results = [];

for (const user of users) {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Symbol AI <noreply@symbolai.com>',
      to: user.email,
      subject: '⚠️ إشعار صيانة النظام - Symbol AI | برجاء عدم استخدام النظام حتى 10:30 مساءً',
      html: createEmailTemplate(user.name || user.username),
    });

    if (error) {
      console.error(`❌ فشل إرسال البريد إلى ${user.name} (${user.email}):`, error);
      results.push({ user: user.name, email: user.email, status: 'failed', error: error.message });
    } else {
      console.log(`✅ تم إرسال البريد إلى ${user.name} (${user.email}) - ID: ${data.id}`);
      results.push({ user: user.name, email: user.email, status: 'sent', id: data.id });
    }
  } catch (err) {
    console.error(`❌ خطأ في إرسال البريد إلى ${user.name}:`, err.message);
    results.push({ user: user.name, email: user.email, status: 'error', error: err.message });
  }
}

// ملخص النتائج
console.log('\n========== ملخص الإرسال ==========');
console.log(`إجمالي المستخدمين: ${users.length}`);
console.log(`تم الإرسال بنجاح: ${results.filter(r => r.status === 'sent').length}`);
console.log(`فشل الإرسال: ${results.filter(r => r.status !== 'sent').length}`);
console.log('\nتفاصيل الإرسال:');
results.forEach(r => {
  console.log(`- ${r.user} (${r.email}): ${r.status === 'sent' ? '✅ تم' : '❌ فشل'}`);
});

await connection.end();
