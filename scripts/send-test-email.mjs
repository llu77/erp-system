import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM_EMAIL || 'info@symbolai.net';
const toEmail = 'info@symbolai.net';

async function sendTestEmail() {
  console.log('🚀 إرسال بريد اختباري...');
  console.log(`📧 من: ${fromEmail}`);
  console.log(`📬 إلى: ${toEmail}`);
  
  try {
    const { data, error } = await resend.emails.send({
      from: `Symbol AI <${fromEmail}>`,
      to: [toEmail],
      subject: `✅ اختبار نظام البريد - Symbol AI - ${new Date().toLocaleDateString('ar-SA')}`,
      html: `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>اختبار نظام البريد</title>
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
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
      color: white;
      padding: 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .content {
      padding: 30px;
      text-align: center;
    }
    .success-icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    .message {
      font-size: 18px;
      color: #333;
      margin-bottom: 20px;
    }
    .details {
      background-color: #f8f9fa;
      padding: 15px;
      border-radius: 6px;
      text-align: right;
    }
    .details p {
      margin: 8px 0;
      color: #666;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 15px;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Symbol AI</h1>
      <p style="margin: 5px 0 0 0; opacity: 0.9;">اختبار نظام البريد الإلكتروني</p>
    </div>
    <div class="content">
      <div class="success-icon">✅</div>
      <div class="message">
        <strong>تم إرسال البريد بنجاح!</strong>
        <p>نظام البريد الإلكتروني يعمل بشكل صحيح</p>
      </div>
      <div class="details">
        <p><strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-SA')}</p>
        <p><strong>الوقت:</strong> ${new Date().toLocaleTimeString('ar-SA')}</p>
        <p><strong>الخدمة:</strong> Resend API</p>
        <p><strong>الحالة:</strong> متصل ويعمل</p>
      </div>
    </div>
    <div class="footer">
      <p>هذا البريد تم إرساله تلقائياً من Symbol AI</p>
      <p>© ${new Date().getFullYear()} جميع الحقوق محفوظة</p>
    </div>
  </div>
</body>
</html>
      `,
    });

    if (error) {
      console.error('❌ خطأ في إرسال البريد:', error);
      process.exit(1);
    }

    console.log('✅ تم إرسال البريد بنجاح!');
    console.log(`📨 معرف الرسالة: ${data?.id}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ خطأ:', err);
    process.exit(1);
  }
}

sendTestEmail();
