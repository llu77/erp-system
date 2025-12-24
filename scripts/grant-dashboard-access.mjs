import mysql from 'mysql2/promise';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // جلب المشرف العام
  const [supervisors] = await conn.execute(`
    SELECT id, name, email, role
    FROM notificationRecipients 
    WHERE role = 'general_supervisor' AND isActive = 1
  `);
  
  console.log('المشرف العام:', supervisors);
  
  if (supervisors.length === 0) {
    console.log('لم يتم العثور على المشرف العام');
    await conn.end();
    return;
  }
  
  const supervisor = supervisors[0];
  const supervisorName = supervisor.name || 'المشرف العام';
  const dashboardUrl = 'https://sym.manus.space/executive-dashboard';
  
  const emailHtml = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 650px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.12); }
    .header { background: linear-gradient(135deg, #1a365d 0%, #2c5282 50%, #3182ce 100%); color: white; padding: 40px 30px; text-align: center; }
    .header .icon { font-size: 48px; margin-bottom: 15px; }
    .header h1 { margin: 0; font-size: 26px; font-weight: 600; }
    .header p { margin: 10px 0 0; opacity: 0.9; font-size: 14px; }
    .content { padding: 40px 30px; }
    .greeting { font-size: 18px; color: #2d3748; margin-bottom: 25px; line-height: 1.8; }
    .highlight-box { background: linear-gradient(135deg, #ebf8ff 0%, #e6fffa 100%); border-right: 5px solid #3182ce; padding: 25px; border-radius: 12px; margin: 25px 0; }
    .highlight-box h3 { color: #2c5282; margin: 0 0 15px 0; font-size: 18px; display: flex; align-items: center; gap: 10px; }
    .highlight-box p { color: #4a5568; margin: 0; line-height: 1.8; }
    .features { background: #f7fafc; padding: 25px; border-radius: 12px; margin: 25px 0; }
    .features h4 { color: #2d3748; margin: 0 0 20px 0; font-size: 16px; }
    .feature-list { list-style: none; padding: 0; margin: 0; }
    .feature-list li { display: flex; align-items: flex-start; gap: 12px; padding: 12px 0; border-bottom: 1px solid #e2e8f0; }
    .feature-list li:last-child { border-bottom: none; }
    .feature-icon { width: 24px; height: 24px; background: #3182ce; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0; }
    .feature-text { color: #4a5568; line-height: 1.6; }
    .cta-section { text-align: center; margin: 35px 0; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #3182ce 0%, #2c5282 100%); color: white; padding: 16px 40px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(49, 130, 206, 0.4); }
    .cta-button:hover { background: linear-gradient(135deg, #2c5282 0%, #1a365d 100%); }
    .security-note { background: #fffaf0; border-right: 4px solid #ed8936; padding: 20px; border-radius: 8px; margin: 25px 0; }
    .security-note h4 { color: #c05621; margin: 0 0 10px 0; font-size: 14px; }
    .security-note p { color: #744210; margin: 0; font-size: 13px; line-height: 1.7; }
    .footer { background: #1a365d; color: white; padding: 30px; text-align: center; }
    .footer .logo { font-size: 24px; margin-bottom: 10px; }
    .footer .company { font-size: 18px; font-weight: 600; margin-bottom: 5px; }
    .footer .tagline { font-size: 12px; opacity: 0.8; }
    .footer .copyright { margin-top: 20px; font-size: 11px; opacity: 0.6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="icon">🎯</div>
      <h1>تم منحك صلاحية الوصول</h1>
      <p>لوحة التحكم التنفيذية - Symbol AI</p>
    </div>
    
    <div class="content">
      <p class="greeting">
        السلام عليكم ورحمة الله وبركاته<br><br>
        الأخ الكريم / <strong>${supervisorName}</strong><br><br>
        يسعدنا إبلاغكم بأنه قد تم منحكم صلاحية الوصول الكامل إلى <strong>لوحة التحكم التنفيذية</strong> في نظام Symbol AI للإدارة.
      </p>
      
      <div class="highlight-box">
        <h3>📊 لوحة التحكم التنفيذية</h3>
        <p>
          توفر لكم نظرة شاملة ومتقدمة على أداء الأعمال، مع تحليلات مالية دقيقة ومؤشرات أداء رئيسية (KPIs) تساعدكم في اتخاذ القرارات الاستراتيجية.
        </p>
      </div>
      
      <div class="features">
        <h4>🔍 الميزات المتاحة لكم:</h4>
        <ul class="feature-list">
          <li>
            <span class="feature-icon">💰</span>
            <span class="feature-text"><strong>التحليل المالي:</strong> إجمالي الإيرادات، صافي الربح، هامش الربح الإجمالي والصافي</span>
          </li>
          <li>
            <span class="feature-icon">📈</span>
            <span class="feature-text"><strong>مؤشرات الأداء:</strong> العائد على الاستثمار (ROI)، نسبة السيولة، معدل دوران المخزون</span>
          </li>
          <li>
            <span class="feature-icon">📊</span>
            <span class="feature-text"><strong>الاتجاهات الشهرية:</strong> مقارنة المبيعات والأرباح والمصاريف خلال آخر 12 شهر</span>
          </li>
          <li>
            <span class="feature-icon">🏢</span>
            <span class="feature-text"><strong>تحليل الفروع:</strong> مقارنة أداء الفروع وتحديد نقاط القوة والضعف</span>
          </li>
          <li>
            <span class="feature-icon">📦</span>
            <span class="feature-text"><strong>تحليل ABC:</strong> تصنيف المنتجات حسب أهميتها في المبيعات</span>
          </li>
          <li>
            <span class="feature-icon">⚠️</span>
            <span class="feature-text"><strong>التنبيهات الذكية:</strong> إشعارات فورية بالمخاطر والفرص</span>
          </li>
        </ul>
      </div>
      
      <div class="cta-section">
        <a href="${dashboardUrl}" class="cta-button">الدخول إلى لوحة التحكم التنفيذية</a>
      </div>
      
      <div class="security-note">
        <h4>🔒 ملاحظة أمنية</h4>
        <p>
          هذه الصلاحية تمنحكم الوصول إلى بيانات حساسة. يرجى الحفاظ على سرية المعلومات وعدم مشاركة بيانات الدخول مع أي شخص آخر.
        </p>
      </div>
      
      <p style="color: #4a5568; line-height: 1.8; margin-top: 30px;">
        في حال وجود أي استفسارات أو صعوبات في الوصول، يرجى التواصل مع الإدارة التقنية.
      </p>
      
      <p style="margin-top: 30px; color: #2d3748;">
        مع خالص التقدير والاحترام،<br>
        <strong>إدارة النظام</strong><br>
        <span style="color: #718096; font-size: 14px;">Symbol AI - نظام إدارة الأعمال المتكامل</span>
      </p>
    </div>
    
    <div class="footer">
      <div class="logo">📊</div>
      <div class="company">Symbol AI</div>
      <div class="tagline">نظام إدارة الأعمال المتكامل</div>
      <div class="copyright">© 2024 جميع الحقوق محفوظة</div>
    </div>
  </div>
</body>
</html>
  `;
  
  try {
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Symbol AI <noreply@resend.dev>',
      to: supervisor.email,
      subject: '🎯 تم منحك صلاحية الوصول إلى لوحة التحكم التنفيذية',
      html: emailHtml,
    });
    
    console.log(`✅ تم إرسال البريد إلى: ${supervisor.name} (${supervisor.email})`);
    console.log('Result:', result);
  } catch (error) {
    console.error(`❌ فشل إرسال البريد إلى: ${supervisor.name}`, error);
  }
  
  await conn.end();
  console.log('\\n✅ تم إرسال بريد منح الصلاحية بنجاح');
}

main().catch(console.error);
