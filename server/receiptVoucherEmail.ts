import { sendEmail } from './email/emailService';
import { getDb } from './db';
import { users } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

/**
 * تنسيق المبلغ بالريال السعودي
 */
function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return num.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * تنسيق التاريخ بالعربية
 */
function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * قالب البريد الإلكتروني الاحترافي للمستلم
 */
function getRecipientEmailTemplate(data: {
  voucherNumber: string;
  voucherDate: string;
  payeeName: string;
  totalAmount: string;
  branchName?: string;
  items: Array<{ description: string; amount: string }>;
  createdByName: string;
}): string {
  const itemsHtml = data.items
    .map(
      (item, index) =>
        `<tr>
          <td style="border: 1px solid #e5e7eb; padding: 12px; text-align: center; font-weight: 600; color: #374151;">${index + 1}</td>
          <td style="border: 1px solid #e5e7eb; padding: 12px; text-align: right;">${item.description}</td>
          <td style="border: 1px solid #e5e7eb; padding: 12px; text-align: left; font-weight: 600; color: #1e40af;">${formatCurrency(item.amount)} ر.س</td>
        </tr>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>سند قبض - ${data.voucherNumber}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 650px; margin: 0 auto; background-color: #ffffff;">
    
    <!-- الشريط العلوي -->
    <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px 40px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">سند قبض</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">وثيقة مالية رسمية من نظام Symbol AI</p>
    </div>
    
    <!-- رقم السند -->
    <div style="background-color: #f0f9ff; padding: 20px 40px; border-bottom: 3px solid #0284c7;">
      <table style="width: 100%;">
        <tr>
          <td style="text-align: right;">
            <span style="color: #0369a1; font-size: 14px;">رقم السند</span>
            <div style="color: #0c4a6e; font-size: 24px; font-weight: 700; margin-top: 5px;">${data.voucherNumber}</div>
          </td>
          <td style="text-align: left;">
            <span style="color: #0369a1; font-size: 14px;">التاريخ</span>
            <div style="color: #0c4a6e; font-size: 18px; font-weight: 600; margin-top: 5px;">${formatDate(data.voucherDate)}</div>
          </td>
        </tr>
      </table>
    </div>
    
    <!-- المحتوى الرئيسي -->
    <div style="padding: 40px;">
      
      <!-- رسالة ترحيبية -->
      <div style="margin-bottom: 30px;">
        <h2 style="color: #1f2937; font-size: 20px; margin: 0 0 10px 0;">السيد/ة ${data.payeeName} المحترم/ة</h2>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.8; margin: 0;">
          نشكركم على تعاملكم معنا. نرفق لكم سند القبض الخاص بالمبالغ المستلمة. يرجى الاحتفاظ بهذا السند كمرجع لسجلاتكم المالية.
        </p>
      </div>
      
      <!-- بيانات المستلم -->
      <div style="background-color: #f9fafb; border-radius: 12px; padding: 25px; margin-bottom: 30px;">
        <h3 style="color: #374151; font-size: 16px; margin: 0 0 15px 0; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
          <span style="margin-left: 8px;">👤</span> بيانات المستلم
        </h3>
        <table style="width: 100%;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; width: 35%;">الاسم:</td>
            <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">${data.payeeName}</td>
          </tr>
          ${data.branchName ? `
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">الفرع:</td>
            <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">${data.branchName}</td>
          </tr>
          ` : ''}
        </table>
      </div>
      
      <!-- تفاصيل البنود -->
      <div style="margin-bottom: 30px;">
        <h3 style="color: #374151; font-size: 16px; margin: 0 0 15px 0;">
          <span style="margin-left: 8px;">📋</span> تفاصيل السند
        </h3>
        <table style="width: 100%; border-collapse: collapse; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);">
              <th style="border: 1px solid #1e40af; padding: 14px; text-align: center; color: #ffffff; font-weight: 600; width: 60px;">#</th>
              <th style="border: 1px solid #1e40af; padding: 14px; text-align: right; color: #ffffff; font-weight: 600;">الوصف</th>
              <th style="border: 1px solid #1e40af; padding: 14px; text-align: left; color: #ffffff; font-weight: 600; width: 150px;">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr style="background: linear-gradient(135deg, #059669 0%, #10b981 100%);">
              <td colspan="2" style="border: 1px solid #059669; padding: 16px; text-align: right; color: #ffffff; font-weight: 700; font-size: 16px;">المجموع الكلي</td>
              <td style="border: 1px solid #059669; padding: 16px; text-align: left; color: #ffffff; font-weight: 700; font-size: 18px;">${formatCurrency(data.totalAmount)} ر.س</td>
            </tr>
          </tfoot>
        </table>
      </div>
      
      <!-- المبلغ الإجمالي (بارز) -->
      <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #22c55e; border-radius: 12px; padding: 25px; text-align: center; margin-bottom: 30px;">
        <p style="color: #166534; font-size: 14px; margin: 0 0 8px 0;">المبلغ الإجمالي المستلم</p>
        <p style="color: #15803d; font-size: 32px; font-weight: 700; margin: 0;">${formatCurrency(data.totalAmount)} ر.س</p>
        <p style="color: #166534; font-size: 12px; margin: 8px 0 0 0;">ريال سعودي</p>
      </div>
      
      <!-- ملاحظة -->
      <div style="background-color: #fffbeb; border-right: 4px solid #f59e0b; border-radius: 4px; padding: 15px; margin-bottom: 20px;">
        <p style="color: #92400e; font-size: 13px; margin: 0; line-height: 1.6;">
          <strong>ملاحظة هامة:</strong> هذا السند يعتبر إثباتاً رسمياً للمبالغ المستلمة. يرجى الاحتفاظ به في سجلاتكم المالية للمراجعة عند الحاجة.
        </p>
      </div>
      
    </div>
    
    <!-- الذيل -->
    <div style="background-color: #1f2937; padding: 25px 40px; text-align: center;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0 0 5px 0;">تم الإنشاء بواسطة: ${data.createdByName}</p>
      <p style="color: #6b7280; font-size: 11px; margin: 0;">
        نظام Symbol AI للإدارة المتكاملة | جميع الحقوق محفوظة © ${new Date().getFullYear()}
      </p>
    </div>
    
  </div>
</body>
</html>
  `;
}

/**
 * قالب البريد الإلكتروني للمشرفين والإدارة
 */
function getAdminEmailTemplate(data: {
  voucherNumber: string;
  voucherDate: string;
  payeeName: string;
  totalAmount: string;
  branchName?: string;
  items: Array<{ description: string; amount: string }>;
  createdByName: string;
  recipientRole: 'supervisor' | 'manager' | 'admin';
}): string {
  const roleTitle = {
    supervisor: 'مشرف الفرع',
    manager: 'المشرف العام',
    admin: 'المسؤول',
  }[data.recipientRole];

  const itemsHtml = data.items
    .map(
      (item, index) =>
        `<tr>
          <td style="border: 1px solid #e5e7eb; padding: 10px; text-align: center;">${index + 1}</td>
          <td style="border: 1px solid #e5e7eb; padding: 10px; text-align: right;">${item.description}</td>
          <td style="border: 1px solid #e5e7eb; padding: 10px; text-align: left; font-weight: 600;">${formatCurrency(item.amount)} ر.س</td>
        </tr>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>سند قبض جديد - ${data.voucherNumber}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    
    <!-- الشريط العلوي -->
    <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 25px 30px;">
      <h1 style="color: #ffffff; margin: 0; font-size: 22px;">🔔 سند قبض جديد بانتظار المراجعة</h1>
      <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0 0; font-size: 13px;">تم إنشاء سند قبض جديد في النظام</p>
    </div>
    
    <!-- الملخص السريع -->
    <div style="background-color: #faf5ff; padding: 20px 30px; border-bottom: 2px solid #e9d5ff;">
      <table style="width: 100%;">
        <tr>
          <td style="width: 50%;">
            <p style="color: #7c3aed; font-size: 12px; margin: 0;">رقم السند</p>
            <p style="color: #581c87; font-size: 20px; font-weight: 700; margin: 5px 0 0 0;">${data.voucherNumber}</p>
          </td>
          <td style="width: 50%; text-align: left;">
            <p style="color: #7c3aed; font-size: 12px; margin: 0;">المبلغ الإجمالي</p>
            <p style="color: #15803d; font-size: 20px; font-weight: 700; margin: 5px 0 0 0;">${formatCurrency(data.totalAmount)} ر.س</p>
          </td>
        </tr>
      </table>
    </div>
    
    <!-- المحتوى -->
    <div style="padding: 30px;">
      
      <p style="color: #4b5563; font-size: 14px; margin: 0 0 20px 0;">
        عزيزي ${roleTitle}، تم إنشاء سند قبض جديد يحتاج إلى مراجعتك.
      </p>
      
      <!-- بيانات السند -->
      <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="color: #374151; font-size: 15px; margin: 0 0 15px 0;">📄 بيانات السند</h3>
        <table style="width: 100%;">
          <tr>
            <td style="padding: 6px 0; color: #6b7280; width: 35%;">التاريخ:</td>
            <td style="padding: 6px 0; color: #1f2937; font-weight: 500;">${formatDate(data.voucherDate)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280;">المدفوع له:</td>
            <td style="padding: 6px 0; color: #1f2937; font-weight: 500;">${data.payeeName}</td>
          </tr>
          ${data.branchName ? `
          <tr>
            <td style="padding: 6px 0; color: #6b7280;">الفرع:</td>
            <td style="padding: 6px 0; color: #1f2937; font-weight: 500;">${data.branchName}</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 6px 0; color: #6b7280;">تم الإنشاء بواسطة:</td>
            <td style="padding: 6px 0; color: #1f2937; font-weight: 500;">${data.createdByName}</td>
          </tr>
        </table>
      </div>
      
      <!-- البنود -->
      <div style="margin-bottom: 20px;">
        <h3 style="color: #374151; font-size: 15px; margin: 0 0 10px 0;">📋 البنود</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #e5e7eb;">
              <th style="border: 1px solid #d1d5db; padding: 10px; text-align: center; width: 50px;">#</th>
              <th style="border: 1px solid #d1d5db; padding: 10px; text-align: right;">الوصف</th>
              <th style="border: 1px solid #d1d5db; padding: 10px; text-align: left; width: 120px;">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr style="background-color: #dbeafe;">
              <td colspan="2" style="border: 1px solid #93c5fd; padding: 12px; text-align: right; font-weight: 700;">المجموع</td>
              <td style="border: 1px solid #93c5fd; padding: 12px; text-align: left; font-weight: 700; color: #1e40af;">${formatCurrency(data.totalAmount)} ر.س</td>
            </tr>
          </tfoot>
        </table>
      </div>
      
    </div>
    
    <!-- الذيل -->
    <div style="background-color: #f3f4f6; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 11px; margin: 0;">
        نظام Symbol AI للإدارة المتكاملة | ${new Date().toLocaleString('ar-SA')}
      </p>
    </div>
    
  </div>
</body>
</html>
  `;
}

/**
 * إرسال السند عبر البريد الإلكتروني
 * المستقبلون:
 * 1. المدفوع له (إن وجد بريده) - قالب احترافي خاص
 * 2. مشرف الفرع المختار
 * 3. المشرف العام
 * 4. الأدمن
 */
export async function sendReceiptVoucherEmail(data: {
  voucherId: string;
  voucherNumber: string;
  voucherDate: string;
  payeeName: string;
  payeeEmail?: string;
  payeePhone?: string;
  totalAmount: string;
  branchId?: number;
  branchName?: string;
  items: Array<{
    description: string;
    amount: string;
  }>;
  createdByName: string;
}): Promise<{ success: boolean; sentTo: string[]; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, sentTo: [], error: 'خطأ في الاتصال بقاعدة البيانات' };

  try {
    const sentTo: string[] = [];

    // الحصول على المشرفين والأدمن
    const admins = await db.select()
      .from(users)
      .where(eq(users.role, 'admin'));

    const managers = await db.select()
      .from(users)
      .where(eq(users.role, 'manager'));

    let branchSupervisors: typeof users.$inferSelect[] = [];
    if (data.branchId) {
      branchSupervisors = await db.select()
        .from(users)
        .where(eq(users.branchId, data.branchId));
    }

    // 1. إرسال للمدفوع له (قالب احترافي خاص)
    if (data.payeeEmail) {
      try {
        const recipientHtml = getRecipientEmailTemplate({
          voucherNumber: data.voucherNumber,
          voucherDate: data.voucherDate,
          payeeName: data.payeeName,
          totalAmount: data.totalAmount,
          branchName: data.branchName,
          items: data.items,
          createdByName: data.createdByName,
        });

        await sendEmail({
          to: data.payeeEmail,
          subject: `✅ سند قبض رقم ${data.voucherNumber} - ${formatCurrency(data.totalAmount)} ر.س`,
          html: recipientHtml,
        });
        sentTo.push(`المستلم: ${data.payeeName} (${data.payeeEmail})`);
      } catch (error) {
        console.error(`فشل إرسال البريد للمدفوع له: ${error}`);
      }
    }

    // 2. إرسال لمشرف الفرع المختار
    for (const supervisor of branchSupervisors) {
      if (supervisor.email && supervisor.role === 'supervisor') {
        try {
          const adminHtml = getAdminEmailTemplate({
            voucherNumber: data.voucherNumber,
            voucherDate: data.voucherDate,
            payeeName: data.payeeName,
            totalAmount: data.totalAmount,
            branchName: data.branchName,
            items: data.items,
            createdByName: data.createdByName,
            recipientRole: 'supervisor',
          });

          await sendEmail({
            to: supervisor.email,
            subject: `🔔 سند قبض جديد - ${data.voucherNumber} - ${data.payeeName}`,
            html: adminHtml,
          });
          sentTo.push(`مشرف الفرع: ${supervisor.name || supervisor.username} (${supervisor.email})`);
        } catch (error) {
          console.error(`فشل إرسال البريد لمشرف الفرع: ${error}`);
        }
      }
    }

    // 3. إرسال للمشرف العام (manager)
    for (const manager of managers) {
      if (manager.email) {
        try {
          const adminHtml = getAdminEmailTemplate({
            voucherNumber: data.voucherNumber,
            voucherDate: data.voucherDate,
            payeeName: data.payeeName,
            totalAmount: data.totalAmount,
            branchName: data.branchName,
            items: data.items,
            createdByName: data.createdByName,
            recipientRole: 'manager',
          });

          await sendEmail({
            to: manager.email,
            subject: `🔔 سند قبض جديد - ${data.voucherNumber} - ${data.payeeName}`,
            html: adminHtml,
          });
          sentTo.push(`المشرف العام: ${manager.name || manager.username} (${manager.email})`);
        } catch (error) {
          console.error(`فشل إرسال البريد للمشرف العام: ${error}`);
        }
      }
    }

    // 4. إرسال للأدمن
    for (const admin of admins) {
      if (admin.email) {
        try {
          const adminHtml = getAdminEmailTemplate({
            voucherNumber: data.voucherNumber,
            voucherDate: data.voucherDate,
            payeeName: data.payeeName,
            totalAmount: data.totalAmount,
            branchName: data.branchName,
            items: data.items,
            createdByName: data.createdByName,
            recipientRole: 'admin',
          });

          await sendEmail({
            to: admin.email,
            subject: `🔔 سند قبض جديد - ${data.voucherNumber} - ${data.payeeName}`,
            html: adminHtml,
          });
          sentTo.push(`الأدمن: ${admin.name || admin.username} (${admin.email})`);
        } catch (error) {
          console.error(`فشل إرسال البريد للأدمن: ${error}`);
        }
      }
    }

    return {
      success: sentTo.length > 0,
      sentTo,
      error: sentTo.length === 0 ? 'لم يتم إرسال البريد لأي مستقبل' : undefined,
    };
  } catch (error) {
    console.error('خطأ في إرسال البريد:', error);
    return {
      success: false,
      sentTo: [],
      error: 'حدث خطأ أثناء إرسال البريد',
    };
  }
}

/**
 * إرسال إشعار SMS للمستلم (اختياري)
 */
export async function sendReceiptVoucherSMS(data: {
  payeePhone: string;
  payeeName: string;
  voucherNumber: string;
  totalAmount: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { sendSMS } = await import('./notifications/twilioService');
    
    const message = `السيد/ة ${data.payeeName}، تم إصدار سند قبض رقم ${data.voucherNumber} بمبلغ ${formatCurrency(data.totalAmount)} ر.س. شكراً لتعاملكم معنا - Symbol AI`;
    
    const result = await sendSMS({ to: data.payeePhone, body: message });
    
    return { success: result.success };
  } catch (error) {
    console.error('خطأ في إرسال SMS:', error);
    return { success: false, error: 'فشل إرسال الرسالة النصية' };
  }
}
