import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendNotification() {
  const supervisorEmail = 'Salemalwadai1997@gmail.com';
  const supervisorName = 'سالم الوادعي';
  
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
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
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
    .greeting {
      font-size: 18px;
      color: #333;
      margin-bottom: 20px;
    }
    .message {
      background-color: #f0fdf4;
      border-right: 4px solid #10b981;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .permissions-list {
      background-color: #f8fafc;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .permissions-list h3 {
      color: #10b981;
      margin-top: 0;
    }
    .permissions-list ul {
      margin: 0;
      padding-right: 20px;
    }
    .permissions-list li {
      padding: 8px 0;
      color: #374151;
    }
    .permissions-list li::marker {
      color: #10b981;
    }
    .note {
      background-color: #fef3c7;
      border-right: 4px solid #f59e0b;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .note strong {
      color: #92400e;
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
      color: #10b981;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="icon">🔓</div>
      <h1>تم منحك صلاحيات جديدة</h1>
    </div>
    
    <div class="content">
      <div class="greeting">
        مرحباً <strong>${supervisorName}</strong>،
      </div>
      
      <div class="message">
        <p>يسعدنا إبلاغك بأنه تم منحك صلاحيات جديدة في نظام <strong>Symbol AI</strong> لإدارة طلبات الموظفين.</p>
      </div>
      
      <div class="permissions-list">
        <h3>الصلاحيات الممنوحة:</h3>
        <ul>
          <li><strong>عرض جميع الطلبات</strong> - يمكنك الآن مشاهدة جميع طلبات الموظفين</li>
          <li><strong>الموافقة على الطلبات</strong> - يمكنك الموافقة على طلبات الإجازة والسلف والاستئذان</li>
          <li><strong>رفض الطلبات</strong> - يمكنك رفض الطلبات مع ذكر السبب</li>
          <li><strong>عرض الإحصائيات</strong> - يمكنك مشاهدة إحصائيات الطلبات</li>
          <li><strong>عرض الطلبات المعلقة</strong> - يمكنك متابعة الطلبات التي تحتاج إجراء</li>
        </ul>
      </div>
      
      <div class="note">
        <strong>ملاحظة:</strong> هذه الصلاحيات تمكنك من إدارة طلبات الموظفين بشكل كامل. يرجى التعامل مع الطلبات بحرص ومسؤولية.
      </div>
      
      <p>للوصول إلى صفحة إدارة الطلبات، قم بتسجيل الدخول إلى النظام واختر "إدارة الطلبات" من القائمة الجانبية.</p>
    </div>
    
    <div class="footer">
      <p class="logo">Symbol AI</p>
      <p>نظام إدارة الموارد البشرية والمالية</p>
      <p>تم إرسال هذا البريد تلقائياً - ${new Date().toLocaleDateString('ar-SA')}</p>
    </div>
  </div>
</body>
</html>
  `;

  try {
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Symbol AI <onboarding@resend.dev>',
      to: supervisorEmail,
      subject: '🔓 تم منحك صلاحيات جديدة - إدارة طلبات الموظفين',
      html: htmlContent,
    });
    
    console.log('✅ تم إرسال الإشعار بنجاح!');
    console.log('Email ID:', result.data?.id);
    console.log('المستلم:', supervisorEmail);
    console.log('الاسم:', supervisorName);
  } catch (error) {
    console.error('❌ خطأ في إرسال الإشعار:', error);
  }
}

sendNotification();
