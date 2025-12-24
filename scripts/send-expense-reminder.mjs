import mysql from 'mysql2/promise';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // جلب مشرفي الفروع
  const [supervisors] = await conn.execute(`
    SELECT nr.id, nr.name, nr.email, nr.branchId, b.name as branchName
    FROM notificationRecipients nr
    LEFT JOIN branches b ON nr.branchId = b.id
    WHERE nr.role = 'branch_supervisor' AND nr.isActive = 1
  `);
  
  console.log('مشرفو الفروع:', supervisors);
  
  for (const supervisor of supervisors) {
    const branchName = supervisor.branchName || 'الفرع';
    const supervisorName = supervisor.name.split(' - ')[0] || supervisor.name;
    
    const emailHtml = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .header .logo { font-size: 32px; margin-bottom: 10px; }
    .content { padding: 30px; }
    .greeting { font-size: 18px; color: #333; margin-bottom: 20px; }
    .message-box { background: #fff3cd; border-right: 4px solid #ffc107; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .message-box h3 { color: #856404; margin: 0 0 10px 0; }
    .message-box p { color: #856404; margin: 0; line-height: 1.8; }
    .action-items { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .action-items h4 { color: #1e3a5f; margin: 0 0 15px 0; }
    .action-items ul { margin: 0; padding-right: 20px; }
    .action-items li { color: #555; margin-bottom: 10px; line-height: 1.6; }
    .deadline { background: #dc3545; color: white; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; }
    .deadline strong { font-size: 18px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
    .footer .company { font-weight: bold; color: #1e3a5f; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">📊</div>
      <h1>نظام Symbol AI للإدارة</h1>
    </div>
    <div class="content">
      <p class="greeting">السلام عليكم ورحمة الله وبركاته</p>
      <p class="greeting">الأخ الكريم / <strong>${supervisorName}</strong></p>
      <p class="greeting">مشرف <strong>${branchName}</strong></p>
      
      <div class="message-box">
        <h3>⚠️ تذكير هام</h3>
        <p>نود تذكيركم بضرورة إكمال تسجيل جميع مصاريف شهر <strong>ديسمبر 2024</strong> في النظام قبل نهاية الشهر.</p>
      </div>
      
      <div class="action-items">
        <h4>📋 المطلوب:</h4>
        <ul>
          <li>مراجعة جميع المصاريف المسجلة للتأكد من اكتمالها</li>
          <li>إضافة أي مصاريف لم يتم تسجيلها بعد</li>
          <li>التأكد من إرفاق المستندات الداعمة لكل مصروف</li>
          <li>مراجعة تصنيفات المصاريف والتأكد من صحتها</li>
        </ul>
      </div>
      
      <div class="deadline">
        <strong>⏰ الموعد النهائي: 31 ديسمبر 2024</strong>
      </div>
      
      <p style="color: #666; line-height: 1.8;">
        في حال وجود أي استفسارات أو صعوبات في التسجيل، يرجى التواصل مع الإدارة.
      </p>
      
      <p style="margin-top: 30px; color: #333;">
        مع خالص التقدير والاحترام،<br>
        <strong>إدارة النظام</strong>
      </p>
    </div>
    <div class="footer">
      <p class="company">Symbol AI - نظام إدارة الأعمال المتكامل</p>
      <p>هذه رسالة آلية من النظام - يرجى عدم الرد عليها مباشرة</p>
    </div>
  </div>
</body>
</html>
    `;
    
    try {
      const result = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'Symbol AI <noreply@resend.dev>',
        to: supervisor.email,
        subject: `⚠️ تذكير: تسجيل مصاريف شهر ديسمبر - ${branchName}`,
        html: emailHtml,
      });
      
      console.log(`✅ تم إرسال التذكير إلى: ${supervisor.name} (${supervisor.email})`);
      console.log('Result:', result);
    } catch (error) {
      console.error(`❌ فشل إرسال التذكير إلى: ${supervisor.name}`, error);
    }
  }
  
  await conn.end();
  console.log('\\n✅ تم إرسال جميع التذكيرات بنجاح');
}

main().catch(console.error);
