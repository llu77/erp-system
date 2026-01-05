import { sendEmail } from './email/emailService';
import { getDb } from './db';
import { users } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

/**
 * إرسال السند عبر البريد الإلكتروني
 * المستقبلون:
 * 1. المدفوع له (إن وجد بريده)
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

    // بناء جدول البنود
    const itemsHtml = data.items
      .map(
        (item, index) =>
          `<tr>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${index + 1}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${item.description}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: left;">${parseFloat(item.amount).toLocaleString('ar-SA')} ر.س</td>
      </tr>`
      )
      .join('');

    // بناء محتوى البريد
    const emailContent = `
      <div dir="rtl" style="font-family: Arial, sans-serif; color: #333;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h1 style="color: #1e40af; margin: 0 0 10px 0;">سند قبض</h1>
          <p style="margin: 5px 0; font-size: 14px;">وثيقة مالية رسمية من نظام Symbol AI</p>
        </div>

        <div style="margin-bottom: 20px;">
          <h2 style="color: #374151; font-size: 16px; margin-bottom: 10px;">بيانات السند</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; font-weight: bold; width: 30%;">رقم السند:</td>
              <td style="padding: 8px;">${data.voucherNumber}</td>
            </tr>
            <tr style="background-color: #f9fafb;">
              <td style="padding: 8px; font-weight: bold;">التاريخ:</td>
              <td style="padding: 8px;">${new Date(data.voucherDate).toLocaleDateString('ar-SA')}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">المدفوع له:</td>
              <td style="padding: 8px;">${data.payeeName}</td>
            </tr>
            ${data.branchName ? `<tr style="background-color: #f9fafb;">
              <td style="padding: 8px; font-weight: bold;">الفرع:</td>
              <td style="padding: 8px;">${data.branchName}</td>
            </tr>` : ''}
          </table>
        </div>

        <div style="margin-bottom: 20px;">
          <h2 style="color: #374151; font-size: 16px; margin-bottom: 10px;">البنود</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #e5e7eb;">
                <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">#</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">الوصف</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              <tr style="background-color: #dbeafe; font-weight: bold;">
                <td colspan="2" style="border: 1px solid #ddd; padding: 8px; text-align: right;">المجموع</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: left;">${parseFloat(data.totalAmount).toLocaleString('ar-SA')} ر.س</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style="margin-bottom: 20px; padding: 15px; background-color: #f0f9ff; border-right: 4px solid #0284c7; border-radius: 4px;">
          <p style="margin: 0; font-size: 13px; color: #0c4a6e;">
            <strong>ملاحظة:</strong> هذا السند تم إنشاؤه بواسطة نظام Symbol AI للإدارة المتكاملة. يرجى الاحتفاظ بنسخة منه للمراجعة.
          </p>
        </div>

        <div style="border-top: 1px solid #e5e7eb; padding-top: 15px; font-size: 12px; color: #6b7280;">
          <p style="margin: 5px 0;">تم الإنشاء بواسطة: ${data.createdByName}</p>
          <p style="margin: 5px 0;">التاريخ: ${new Date().toLocaleString('ar-SA')}</p>
        </div>
      </div>
    `;

    // 1. إرسال للمدفوع له
    if (data.payeeEmail) {
      try {
        await sendEmail({
          to: data.payeeEmail,
          subject: `سند قبض رقم ${data.voucherNumber}`,
          html: emailContent,
        });
        sentTo.push(`${data.payeeName} (${data.payeeEmail})`);
      } catch (error) {
        console.error(`فشل إرسال البريد للمدفوع له: ${error}`);
      }
    }

    // 2. إرسال لمشرف الفرع المختار
    for (const supervisor of branchSupervisors) {
      if (supervisor.email && supervisor.role === 'supervisor') {
        try {
          await sendEmail({
            to: supervisor.email,
            subject: `سند قبض جديد - ${data.voucherNumber} - ${data.payeeName}`,
            html: `
              <div dir="rtl" style="font-family: Arial, sans-serif;">
                <h2>سند قبض جديد بانتظار مراجعتك</h2>
                <p>رقم السند: <strong>${data.voucherNumber}</strong></p>
                <p>المدفوع له: <strong>${data.payeeName}</strong></p>
                <p>المبلغ: <strong>${parseFloat(data.totalAmount).toLocaleString('ar-SA')} ر.س</strong></p>
                <p>الفرع: <strong>${data.branchName || 'غير محدد'}</strong></p>
                <hr/>
                ${emailContent}
              </div>
            `,
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
          await sendEmail({
            to: manager.email,
            subject: `سند قبض جديد - ${data.voucherNumber} - ${data.payeeName}`,
            html: `
              <div dir="rtl" style="font-family: Arial, sans-serif;">
                <h2>سند قبض جديد بانتظار مراجعتك</h2>
                <p>رقم السند: <strong>${data.voucherNumber}</strong></p>
                <p>المدفوع له: <strong>${data.payeeName}</strong></p>
                <p>المبلغ: <strong>${parseFloat(data.totalAmount).toLocaleString('ar-SA')} ر.س</strong></p>
                <p>الفرع: <strong>${data.branchName || 'غير محدد'}</strong></p>
                <p>تم الإنشاء بواسطة: <strong>${data.createdByName}</strong></p>
                <hr/>
                ${emailContent}
              </div>
            `,
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
          await sendEmail({
            to: admin.email,
            subject: `سند قبض جديد - ${data.voucherNumber} - ${data.payeeName}`,
            html: `
              <div dir="rtl" style="font-family: Arial, sans-serif;">
                <h2>سند قبض جديد بانتظار مراجعتك</h2>
                <p>رقم السند: <strong>${data.voucherNumber}</strong></p>
                <p>المدفوع له: <strong>${data.payeeName}</strong></p>
                <p>المبلغ: <strong>${parseFloat(data.totalAmount).toLocaleString('ar-SA')} ر.س</strong></p>
                <p>الفرع: <strong>${data.branchName || 'غير محدد'}</strong></p>
                <p>تم الإنشاء بواسطة: <strong>${data.createdByName}</strong></p>
                <hr/>
                ${emailContent}
              </div>
            `,
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
