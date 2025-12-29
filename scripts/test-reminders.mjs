import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "info@symbolai.net";

// قالب تذكير الجرد
function getInventoryReminderTemplate(data) {
  const branchesHtml = data.branches?.map(b => `
    <div style="padding: 10px; background: #f3f4f6; border-radius: 8px; margin: 5px 0;">
      <strong>🏢 ${b.name}</strong>: ${b.productCount} منتج
    </div>
  `).join('') || '';
  
  return {
    subject: `📦 تذكير: موعد الجرد الدوري - يوم ${data.dayOfMonth} | Symbol AI`,
    html: `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Cairo', sans-serif; direction: rtl; background: #f5f5f5; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; }
          .header { background: linear-gradient(135deg, #1a1a2e, #16213e); padding: 30px; text-align: center; color: white; }
          .content { padding: 30px; }
          .alert { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📦 تذكير بموعد الجرد</h1>
            <p>يوم ${data.dayOfMonth} من الشهر</p>
          </div>
          <div class="content">
            <p>السلام عليكم ورحمة الله وبركاته،</p>
            <p><strong>${data.recipientName}</strong></p>
            <p>نذكركم بأن اليوم هو موعد إجراء الجرد الدوري للمخزون.</p>
            <div class="alert">
              <strong>⚠️ يرجى إجراء الجرد اليوم</strong>
              <p>الجرد الدوري يساعد في الحفاظ على دقة المخزون واكتشاف الفروقات مبكراً</p>
            </div>
            ${branchesHtml ? `<h3>📊 الفروع والمنتجات</h3>${branchesHtml}` : ''}
            <hr>
            <p style="text-align: center; color: #666;">Symbol AI - نظام إدارة الأعمال</p>
          </div>
        </div>
      </body>
      </html>
    `
  };
}

// قالب تذكير الرواتب
function getPayrollReminderTemplate(data) {
  const branchesHtml = data.branches?.map(b => `
    <div style="padding: 10px; background: #f3f4f6; border-radius: 8px; margin: 5px 0;">
      <strong>🏢 ${b.name}</strong>: ${b.employeeCount} موظف
    </div>
  `).join('') || '';
  
  return {
    subject: `💰 تذكير: إنشاء مسيرات رواتب ${data.month} ${data.year} | Symbol AI`,
    html: `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Cairo', sans-serif; direction: rtl; background: #f5f5f5; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; }
          .header { background: linear-gradient(135deg, #1a1a2e, #16213e); padding: 30px; text-align: center; color: white; }
          .content { padding: 30px; }
          .alert { background: #ede9fe; border: 1px solid #7c3aed; padding: 15px; border-radius: 8px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💰 تذكير بإنشاء مسيرات الرواتب</h1>
            <p>${data.month} ${data.year}</p>
          </div>
          <div class="content">
            <p>السلام عليكم ورحمة الله وبركاته،</p>
            <p><strong>${data.recipientName}</strong></p>
            <p>نذكركم بأن اليوم هو موعد إنشاء مسيرات الرواتب الشهرية.</p>
            <div class="alert">
              <strong>💼 حان وقت إعداد الرواتب</strong>
              <p>يرجى إنشاء مسيرات الرواتب لجميع الفروع قبل نهاية الشهر</p>
            </div>
            ${branchesHtml ? `<h3>👥 الفروع والموظفين</h3>${branchesHtml}` : ''}
            <hr>
            <p style="text-align: center; color: #666;">Symbol AI - نظام إدارة الأعمال</p>
          </div>
        </div>
      </body>
      </html>
    `
  };
}

// المستلمين
const inventoryRecipients = [
  { name: 'عمر المطيري', email: 'llu771230@gmail.com' }, // الأدمن
  { name: 'السيد محمد', email: 'elsayed.gouda.mohamed@gmail.com' }, // السيد
  { name: 'محمد', email: 'mohamedismaelebrhem@gmail.com' }, // مشرف طويق
];

const payrollRecipients = [
  { name: 'عمر المطيري', email: 'llu771230@gmail.com' },
  { name: 'عمر المطيري', email: 'nntn127@gmail.com' },
  { name: 'عبدالحي', email: 'Galalbdo766@gmail.com' },
  { name: 'محمد', email: 'mohamedismaelebrhem@gmail.com' },
  { name: 'سالم الوادعي', email: 'Salemalwadai1997@gmail.com' },
  { name: 'السيد محمد', email: 'elsayed.gouda.mohamed@gmail.com' },
];

const branches = [
  { name: 'فرع لبن', productCount: 45, employeeCount: 3 },
  { name: 'فرع طويق- الرياض', productCount: 52, employeeCount: 4 },
];

const today = new Date();
const dayOfMonth = today.getDate();
const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const currentMonth = monthNames[today.getMonth()];
const currentYear = today.getFullYear();

console.log(`\n=== اختبار إرسال التذكيرات - يوم ${dayOfMonth} ===\n`);

// إرسال تذكير الجرد
console.log('📦 إرسال تذكير الجرد...');
let inventorySent = 0;
for (const recipient of inventoryRecipients) {
  const { subject, html } = getInventoryReminderTemplate({
    recipientName: recipient.name,
    dayOfMonth,
    branches
  });
  
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: recipient.email,
      subject,
      html
    });
    console.log(`  ✓ ${recipient.name} (${recipient.email})`);
    inventorySent++;
  } catch (error) {
    console.log(`  ✗ ${recipient.name}: ${error.message}`);
  }
}
console.log(`تم إرسال تذكير الجرد إلى ${inventorySent} من ${inventoryRecipients.length}`);

// إرسال تذكير الرواتب
console.log('\n💰 إرسال تذكير مسيرات الرواتب...');
let payrollSent = 0;
for (const recipient of payrollRecipients) {
  const { subject, html } = getPayrollReminderTemplate({
    recipientName: recipient.name,
    month: currentMonth,
    year: currentYear,
    branches
  });
  
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: recipient.email,
      subject,
      html
    });
    console.log(`  ✓ ${recipient.name} (${recipient.email})`);
    payrollSent++;
  } catch (error) {
    console.log(`  ✗ ${recipient.name}: ${error.message}`);
  }
}
console.log(`تم إرسال تذكير الرواتب إلى ${payrollSent} من ${payrollRecipients.length}`);

console.log('\n=== انتهى الاختبار ===');
