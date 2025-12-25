import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// قائمة المستخدمين
const users = [
  { name: 'عمر المطيري', email: 'llu771230@gmail.com', role: 'admin' },
  { name: 'عمر المطيري', email: 'nntn127@gmail.com', role: 'employee' },
  { name: 'عبدالحي', email: 'Galalbdo766@gmail.com', role: 'supervisor' },
  { name: 'محمد', email: 'mohamedismaelebrhem@gmail.com', role: 'supervisor' },
  { name: 'سالم الوادعي', email: 'Salemalwadai1997@gmail.com', role: 'viewer' },
];

// قالب البريد الإلكتروني
const getEmailHtml = (userName: string) => `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تحديثات نظام Symbol AI</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; color: #e2e8f0; margin: 0; padding: 20px; direction: rtl;">
  <div style="max-width: 650px; margin: 0 auto; background-color: #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 40px 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">
        🚀 Symbol AI
      </h1>
      <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 16px;">
        نظام إدارة الأعمال المتكامل
      </p>
    </div>
    
    <!-- Content -->
    <div style="padding: 40px 30px;">
      
      <!-- Greeting -->
      <p style="font-size: 18px; color: #f1f5f9; margin: 0 0 25px 0;">
        السلام عليكم ورحمة الله وبركاته،
      </p>
      <p style="font-size: 16px; color: #cbd5e1; margin: 0 0 30px 0;">
        الأخ الكريم / <strong style="color: #60a5fa;">${userName}</strong>
      </p>
      
      <!-- Introduction -->
      <p style="font-size: 15px; color: #94a3b8; line-height: 1.8; margin: 0 0 30px 0;">
        يسعدنا إبلاغكم بإطلاق مجموعة من التحديثات الجديدة على نظام <strong style="color: #a78bfa;">Symbol AI</strong> لتحسين تجربة العمل وتسهيل متابعة الأداء. نرجو منكم الاطلاع على التفاصيل التالية:
      </p>
      
      <!-- Feature 1: Sales Dashboard -->
      <div style="background-color: #0f172a; border-radius: 12px; padding: 25px; margin-bottom: 20px; border-right: 4px solid #22c55e;">
        <h3 style="color: #22c55e; margin: 0 0 15px 0; font-size: 18px; display: flex; align-items: center;">
          📊 لوحة تحكم المبيعات
        </h3>
        <p style="color: #94a3b8; margin: 0; font-size: 14px; line-height: 1.7;">
          تتيح لكم هذه اللوحة متابعة أداء المبيعات بشكل تفصيلي، وتشمل:
        </p>
        <ul style="color: #cbd5e1; margin: 15px 0 0 0; padding-right: 20px; font-size: 14px; line-height: 2;">
          <li>إجمالي الإيرادات وصافي الربح</li>
          <li>متوسط الإيراد اليومي وأفضل يوم مبيعات</li>
          <li>توزيع المدفوعات (نقدي / شبكة)</li>
          <li>رسم بياني للإيرادات اليومية</li>
          <li>ترتيب الموظفين حسب الأداء</li>
        </ul>
      </div>
      
      <!-- Feature 2: Executive Dashboard -->
      <div style="background-color: #0f172a; border-radius: 12px; padding: 25px; margin-bottom: 20px; border-right: 4px solid #f59e0b;">
        <h3 style="color: #f59e0b; margin: 0 0 15px 0; font-size: 18px;">
          📈 لوحة التحكم التنفيذية
        </h3>
        <p style="color: #94a3b8; margin: 0; font-size: 14px; line-height: 1.7;">
          نظرة شاملة على أداء الأعمال تتضمن:
        </p>
        <ul style="color: #cbd5e1; margin: 15px 0 0 0; padding-right: 20px; font-size: 14px; line-height: 2;">
          <li>مؤشرات الأداء الرئيسية (KPIs)</li>
          <li>هامش الربح ومقارنة الأداء</li>
          <li>إجمالي المصاريف والإيرادات</li>
          <li>تحليل أداء الموظفين</li>
          <li>فلترة البيانات حسب الفرع والفترة الزمنية</li>
        </ul>
      </div>
      
      <!-- Feature 3: System Monitor -->
      <div style="background-color: #0f172a; border-radius: 12px; padding: 25px; margin-bottom: 20px; border-right: 4px solid #3b82f6;">
        <h3 style="color: #3b82f6; margin: 0 0 15px 0; font-size: 18px;">
          🔔 تفعيل مراقب النظام
        </h3>
        <p style="color: #94a3b8; margin: 0; font-size: 14px; line-height: 1.7;">
          تم تفعيل نظام المراقبة الذكي الذي يقوم بـ:
        </p>
        <ul style="color: #cbd5e1; margin: 15px 0 0 0; padding-right: 20px; font-size: 14px; line-height: 2;">
          <li>مراقبة المخزون المنخفض تلقائياً</li>
          <li>تنبيهات العمليات المالية الكبيرة</li>
          <li>متابعة انتهاء صلاحية المنتجات</li>
          <li>إرسال التقارير الدورية</li>
        </ul>
      </div>
      
      <!-- Coming Soon -->
      <div style="background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%); border-radius: 12px; padding: 25px; margin-bottom: 30px;">
        <h3 style="color: #ffffff; margin: 0 0 15px 0; font-size: 18px;">
          🎉 قريباً: صفحة الفواتير الجديدة
        </h3>
        <p style="color: #f3e8ff; margin: 0; font-size: 14px; line-height: 1.7;">
          نعمل حالياً على إطلاق صفحة الفواتير المتكاملة والتي ستتيح لكم:
        </p>
        <ul style="color: #fce7f3; margin: 15px 0 0 0; padding-right: 20px; font-size: 14px; line-height: 2;">
          <li>تسجيل فواتير السالب (المرتجعات)</li>
          <li>إنشاء فواتير المبيعات</li>
          <li>إدارة فواتير المنتجات</li>
          <li>طباعة وتصدير الفواتير</li>
        </ul>
      </div>
      
      <!-- Important Notice -->
      <div style="background-color: #fef3c7; border-radius: 12px; padding: 20px; margin-bottom: 30px; border: 1px solid #fbbf24;">
        <p style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.7;">
          <strong>⚠️ ملاحظة هامة:</strong><br>
          في حال ملاحظة أي بيانات غير دقيقة أو وجود أي ملاحظات على النظام، نرجو التواصل معنا فوراً للإبلاغ عنها وتصحيحها في أسرع وقت ممكن.
        </p>
      </div>
      
      <!-- Signature -->
      <div style="border-top: 1px solid #334155; padding-top: 25px; margin-top: 30px;">
        <p style="color: #94a3b8; margin: 0 0 10px 0; font-size: 14px;">
          مع أطيب التحيات،
        </p>
        <p style="color: #f1f5f9; margin: 0; font-size: 16px; font-weight: bold;">
          فريق Symbol AI
        </p>
        <p style="color: #64748b; margin: 10px 0 0 0; font-size: 12px;">
          نظام إدارة الأعمال المتكامل
        </p>
      </div>
      
    </div>
    
    <!-- Footer -->
    <div style="background-color: #0f172a; padding: 20px 30px; text-align: center; border-top: 1px solid #1e293b;">
      <p style="color: #64748b; margin: 0; font-size: 12px;">
        هذه الرسالة مرسلة تلقائياً من نظام Symbol AI
      </p>
      <p style="color: #475569; margin: 10px 0 0 0; font-size: 11px;">
        © 2025 Symbol AI - جميع الحقوق محفوظة
      </p>
    </div>
    
  </div>
</body>
</html>
`;

async function sendEmails() {
  console.log('🚀 بدء إرسال البريد الإلكتروني...\n');
  
  const results = [];
  
  for (const user of users) {
    try {
      console.log(`📧 إرسال إلى: ${user.name} (${user.email})...`);
      
      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'Symbol AI <noreply@resend.dev>',
        to: user.email,
        subject: '🚀 تحديثات جديدة على نظام Symbol AI - لوحات التحكم ومراقب النظام',
        html: getEmailHtml(user.name),
      });
      
      if (error) {
        console.log(`   ❌ فشل: ${error.message}`);
        results.push({ ...user, status: 'failed', error: error.message });
      } else {
        console.log(`   ✅ نجاح: ${data?.id}`);
        results.push({ ...user, status: 'success', id: data?.id });
      }
    } catch (err: any) {
      console.log(`   ❌ خطأ: ${err.message}`);
      results.push({ ...user, status: 'error', error: err.message });
    }
    
    // انتظار قصير بين الرسائل
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n📊 ملخص الإرسال:');
  console.log(`   ✅ نجح: ${results.filter(r => r.status === 'success').length}`);
  console.log(`   ❌ فشل: ${results.filter(r => r.status !== 'success').length}`);
  
  return results;
}

sendEmails()
  .then(results => {
    console.log('\n✅ اكتمل الإرسال');
    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ خطأ:', err);
    process.exit(1);
  });
