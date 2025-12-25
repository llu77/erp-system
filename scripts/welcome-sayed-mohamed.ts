/**
 * إرسال رسالة ترحيب للسيد محمد - مشرف المخزون والجرد
 */

import { Resend } from 'resend';
import 'dotenv/config';

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendWelcomeEmail() {
  const recipientEmail = 'elsayed.gouda.mohamed@gmail.com';
  const recipientName = 'السيد محمد';
  const username = 'moh123';
  const password = 'admin1234';
  const branchName = 'فرع لبن';
  
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
      max-width: 650px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      color: white;
      padding: 40px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      margin-bottom: 10px;
    }
    .header p {
      margin: 0;
      opacity: 0.9;
      font-size: 16px;
    }
    .welcome-icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    .content {
      padding: 40px;
    }
    .greeting {
      font-size: 20px;
      color: #1f2937;
      margin-bottom: 20px;
    }
    .intro {
      color: #4b5563;
      line-height: 1.8;
      margin-bottom: 30px;
    }
    .credentials-box {
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
      border: 2px solid #3b82f6;
      border-radius: 12px;
      padding: 25px;
      margin-bottom: 30px;
    }
    .credentials-box h3 {
      color: #1d4ed8;
      margin-top: 0;
      margin-bottom: 15px;
      font-size: 18px;
    }
    .credential-item {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #bfdbfe;
    }
    .credential-item:last-child {
      border-bottom: none;
    }
    .credential-label {
      color: #6b7280;
      font-weight: 500;
    }
    .credential-value {
      color: #1f2937;
      font-weight: bold;
      font-family: 'Courier New', monospace;
      background-color: #dbeafe;
      padding: 4px 12px;
      border-radius: 6px;
    }
    .permissions-section {
      background-color: #f0fdf4;
      border-radius: 12px;
      padding: 25px;
      margin-bottom: 30px;
    }
    .permissions-section h3 {
      color: #166534;
      margin-top: 0;
      margin-bottom: 15px;
    }
    .permission-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    .permission-item {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #374151;
      padding: 8px;
      background-color: white;
      border-radius: 8px;
    }
    .permission-icon {
      color: #22c55e;
    }
    .branch-info {
      background-color: #fef3c7;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 30px;
      text-align: center;
    }
    .branch-info h4 {
      color: #92400e;
      margin: 0 0 5px 0;
    }
    .branch-info p {
      color: #78350f;
      margin: 0;
      font-size: 20px;
      font-weight: bold;
    }
    .features-list {
      margin-bottom: 30px;
    }
    .features-list h3 {
      color: #1f2937;
      margin-bottom: 15px;
    }
    .feature-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .feature-item:last-child {
      border-bottom: none;
    }
    .feature-icon {
      font-size: 24px;
    }
    .feature-text h4 {
      margin: 0 0 5px 0;
      color: #1f2937;
    }
    .feature-text p {
      margin: 0;
      color: #6b7280;
      font-size: 14px;
    }
    .cta-section {
      text-align: center;
      margin-bottom: 30px;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      color: white;
      padding: 16px 40px;
      border-radius: 10px;
      text-decoration: none;
      font-weight: bold;
      font-size: 16px;
      box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
    }
    .support-section {
      background-color: #f8fafc;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
    }
    .support-section p {
      color: #6b7280;
      margin: 0;
    }
    .support-section a {
      color: #3b82f6;
      text-decoration: none;
      font-weight: 500;
    }
    .footer {
      background-color: #1f2937;
      color: #9ca3af;
      padding: 30px;
      text-align: center;
    }
    .footer .logo {
      font-size: 24px;
      font-weight: bold;
      color: #3b82f6;
      margin-bottom: 10px;
    }
    .footer p {
      margin: 5px 0;
      font-size: 14px;
    }
    .security-note {
      background-color: #fef2f2;
      border-right: 4px solid #ef4444;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .security-note p {
      color: #991b1b;
      margin: 0;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="welcome-icon">🎉</div>
      <h1>مرحباً بك في نظام Symbol AI</h1>
      <p>نظام إدارة المخزون والموارد المتكامل</p>
    </div>
    
    <div class="content">
      <p class="greeting">أهلاً وسهلاً <strong>${recipientName}</strong>،</p>
      
      <p class="intro">
        يسعدنا انضمامك إلى فريق العمل كـ <strong>مشرف المخزون والجرد</strong>. 
        تم إنشاء حسابك بنجاح ويمكنك الآن الوصول إلى النظام باستخدام بيانات الدخول أدناه.
      </p>
      
      <div class="credentials-box">
        <h3>🔐 بيانات تسجيل الدخول</h3>
        <div class="credential-item">
          <span class="credential-label">اسم المستخدم:</span>
          <span class="credential-value">${username}</span>
        </div>
        <div class="credential-item">
          <span class="credential-label">كلمة المرور:</span>
          <span class="credential-value">${password}</span>
        </div>
      </div>
      
      <div class="security-note">
        <p>⚠️ <strong>ملاحظة أمنية:</strong> يُنصح بتغيير كلمة المرور عند أول تسجيل دخول للحفاظ على أمان حسابك.</p>
      </div>
      
      <div class="branch-info">
        <h4>📍 الفرع المعين</h4>
        <p>${branchName}</p>
      </div>
      
      <div class="permissions-section">
        <h3>✅ صلاحياتك في النظام</h3>
        <div class="permission-grid">
          <div class="permission-item">
            <span class="permission-icon">✓</span>
            <span>إدارة المخزون</span>
          </div>
          <div class="permission-item">
            <span class="permission-icon">✓</span>
            <span>الجرد الدوري</span>
          </div>
          <div class="permission-item">
            <span class="permission-icon">✓</span>
            <span>طلبات المنتجات</span>
          </div>
          <div class="permission-item">
            <span class="permission-icon">✓</span>
            <span>فواتير المبيعات</span>
          </div>
          <div class="permission-item">
            <span class="permission-icon">✓</span>
            <span>اقتراحات إعادة الطلب</span>
          </div>
          <div class="permission-item">
            <span class="permission-icon">✓</span>
            <span>إدارة الدفعات</span>
          </div>
        </div>
      </div>
      
      <div class="features-list">
        <h3>🚀 ما يمكنك فعله في النظام</h3>
        
        <div class="feature-item">
          <span class="feature-icon">📦</span>
          <div class="feature-text">
            <h4>إدارة المخزون المتقدمة</h4>
            <p>تتبع الدفعات، تواريخ الانتهاء، والكميات المتاحة في الوقت الفعلي</p>
          </div>
        </div>
        
        <div class="feature-item">
          <span class="feature-icon">📋</span>
          <div class="feature-text">
            <h4>الجرد الدوري</h4>
            <p>إجراء عمليات الجرد يوم 12 و 27 من كل شهر مع تقارير الفروقات</p>
          </div>
        </div>
        
        <div class="feature-item">
          <span class="feature-icon">🛒</span>
          <div class="feature-text">
            <h4>طلبات المنتجات</h4>
            <p>إنشاء ومتابعة طلبات المنتجات الجديدة والموافقة عليها</p>
          </div>
        </div>
        
        <div class="feature-item">
          <span class="feature-icon">🧾</span>
          <div class="feature-text">
            <h4>فواتير المبيعات</h4>
            <p>تسجيل فواتير المبيعات وفواتير السالب على الموظفين</p>
          </div>
        </div>
        
        <div class="feature-item">
          <span class="feature-icon">🔔</span>
          <div class="feature-text">
            <h4>الإشعارات والتذكيرات</h4>
            <p>استلام تذكيرات الجرد وإشعارات المنتجات قريبة الانتهاء</p>
          </div>
        </div>
      </div>
      
      <div class="cta-section">
        <a href="#" class="cta-button">🚀 ابدأ الآن - تسجيل الدخول</a>
      </div>
      
      <div class="support-section">
        <p>هل تحتاج مساعدة؟ تواصل مع فريق الدعم الفني</p>
        <p><a href="mailto:support@symbol-ai.com">support@symbol-ai.com</a></p>
      </div>
    </div>
    
    <div class="footer">
      <div class="logo">Symbol AI</div>
      <p>نظام إدارة المخزون والموارد المتكامل</p>
      <p>© ${new Date().getFullYear()} جميع الحقوق محفوظة</p>
      <p style="margin-top: 15px; font-size: 12px;">
        تم إرسال هذه الرسالة في ${new Date().toLocaleDateString('ar-SA', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </p>
    </div>
  </div>
</body>
</html>
  `;
  
  try {
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Symbol AI <onboarding@resend.dev>',
      to: recipientEmail,
      subject: '🎉 مرحباً بك في نظام Symbol AI - بيانات حسابك الجديد',
      html: htmlContent,
    });
    
    console.log('✅ تم إرسال رسالة الترحيب بنجاح');
    console.log('📧 المستلم:', recipientEmail);
    console.log('📝 معرف الرسالة:', result.data?.id);
    return true;
  } catch (error) {
    console.error('❌ خطأ في إرسال رسالة الترحيب:', error);
    return false;
  }
}

sendWelcomeEmail();
