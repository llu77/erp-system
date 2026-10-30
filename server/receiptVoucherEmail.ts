import { sendEmail, type EmailAttachment } from './email/emailService';
import { getDb } from './db';
import { users } from '../drizzle/schema';
import { and, eq, inArray } from 'drizzle-orm';
import {
  VOUCHER_TITLES,
  amountToArabicWords,
  amountToEnglishWords,
  escapeHtml,
  formatPaymentSplitText,
  formatVoucherAmount,
  formatVoucherDate,
  getVoucherStatusLabel,
  isVoucherSigned,
  type VoucherType,
} from '../shared/vouchers';
import type { VoucherTemplateData } from '../shared/voucherTemplate';
import { generateVoucherPDF, renderVoucherHtmlEmbedded, voucherFileName } from './voucherPdf';
import { getVoucherWithItems } from './receiptVoucher';

/** بيانات السند للبريد (صف السند + البنود) */
export type VoucherEmailData = VoucherTemplateData & {
  branchId?: number | null;
  payeeEmail?: string | null;
};

function typeOf(v: VoucherEmailData): VoucherType {
  return v.voucherType === 'payment' ? 'payment' : 'receipt';
}

/**
 * محتوى البريد: ملخص ثنائي اللغة (جداول بأنماط مضمّنة تعمل في كل برامج البريد)
 * جميع النصوص المُدخلة من المستخدم مُهرّبة. السند الكامل يُرفق كملف PDF.
 */
export function buildVoucherEmailHtml(v: VoucherEmailData, intro?: string): string {
  const type = typeOf(v);
  const titles = VOUCHER_TITLES[type];
  const status = getVoucherStatusLabel(v.status, type);
  const total = Number(v.totalAmount) || 0;
  const accent = type === 'receipt' ? '#1f3a5f' : '#7a1f1f';
  const row = (labelAr: string, labelEn: string, value: string, shaded = false) => `
        <tr${shaded ? ' style="background-color:#f9fafb;"' : ''}>
          <td style="padding:8px;font-weight:bold;width:35%;border-bottom:1px solid #eee;">${labelAr} <span style="color:#888;font-weight:normal;font-size:12px;">/ ${labelEn}</span></td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${value}</td>
        </tr>`;

  const items = (v.items ?? []).map((item, index) => `
          <tr>
            <td style="border:1px solid #ddd;padding:6px;text-align:center;">${index + 1}</td>
            <td style="border:1px solid #ddd;padding:6px;">${escapeHtml(item.description)}</td>
            <td style="border:1px solid #ddd;padding:6px;text-align:left;direction:ltr;">${formatVoucherAmount(item.amount)}</td>
          </tr>`).join('');

  const receivedBy = type === 'receipt' && v.payeeName && v.payeeName !== v.partyName
    ? row('المستلم', 'Received By', escapeHtml(v.payeeName), true)
    : '';

  return `
    <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;color:#222;max-width:640px;margin:0 auto;">
      <div style="background-color:${accent};color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:22px;">${escapeHtml(titles.ar)} <span style="font-size:14px;opacity:0.85;">/ ${escapeHtml(titles.en)}</span></h1>
        <p style="margin:6px 0 0;font-size:14px;direction:ltr;text-align:right;">${escapeHtml(v.voucherId)}</p>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:none;padding:16px 20px;border-radius:0 0 8px 8px;">
        ${intro ? `<p style="margin:0 0 12px;font-size:14px;">${escapeHtml(intro)}</p>` : ''}
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          ${row('التاريخ', 'Date', escapeHtml(formatVoucherDate(v.voucherDate)))}
          ${row(titles.partyAr, titles.partyEn, escapeHtml(v.partyName || v.payeeName || '-'), true)}
          ${receivedBy}
          ${row('المبلغ', 'Amount', `<b>${formatVoucherAmount(total)} SAR</b>`)}
          ${row('مبلغاً وقدره', 'The Sum of', `${escapeHtml(amountToArabicWords(total))}<br><span style="color:#555;font-size:12px;direction:ltr;">${escapeHtml(amountToEnglishWords(total))}</span>`, true)}
          ${row('وذلك عن', 'Being for', escapeHtml(v.description || '-'))}
          ${row('طريقة الدفع', 'Payment', escapeHtml(formatPaymentSplitText(v) || '-'), true)}
          ${row('الفرع', 'Branch', escapeHtml(v.branchName || '-'))}
          ${row('الحالة', 'Status', escapeHtml(`${status.ar} / ${status.en}`), true)}
          ${row('أُعد بواسطة', 'Prepared By', escapeHtml(v.createdByName || '-'))}
        </table>
        ${items ? `
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:14px;">
          <thead>
            <tr style="background-color:#f3f4f6;">
              <th style="border:1px solid #ddd;padding:6px;width:8%;">#</th>
              <th style="border:1px solid #ddd;padding:6px;">البيان / Description</th>
              <th style="border:1px solid #ddd;padding:6px;width:28%;">المبلغ / Amount</th>
            </tr>
          </thead>
          <tbody>${items}</tbody>
        </table>` : ''}
        <p style="margin:14px 0 0;padding:10px;background-color:#f0f9ff;border-right:4px solid #0284c7;font-size:12px;color:#0c4a6e;">
          ${isVoucherSigned(v.status)
            ? 'السند معتمد من الإدارة. النسخة الرسمية الموقعة والمختومة مرفقة بهذا البريد.'
            : 'السند بانتظار اعتماد الإدارة؛ النسخة المرفقة غير موقعة ولا تُعد سنداً نهائياً حتى الاعتماد.'}
        </p>
      </div>
    </div>`;
}

/** مرفق السند: PDF، أو HTML قابل للطباعة إذا تعذر توليد PDF */
async function buildVoucherAttachment(v: VoucherEmailData): Promise<EmailAttachment | null> {
  try {
    const pdf = await generateVoucherPDF(v);
    return { filename: voucherFileName(v, 'pdf'), content: pdf, contentType: 'application/pdf' };
  } catch (error) {
    console.warn('[Vouchers] تعذر توليد PDF للبريد، سيتم إرفاق نسخة HTML:', error);
    try {
      const html = renderVoucherHtmlEmbedded(v, { includeFont: false });
      return { filename: voucherFileName(v, 'html'), content: Buffer.from(html, 'utf8'), contentType: 'text/html' };
    } catch {
      return null;
    }
  }
}

/**
 * إرسال السند عبر البريد الإلكتروني
 * المستقبلون (كل مستقبل برسالة مستقلة، بدون تكرار):
 * 1. الطرف / المستلم (إن وجد بريده)
 * 2. مشرف الفرع
 * 3. المديرون
 * 4. المسؤولون
 */
/** نتيجة إرسال السند: failed يذكر المستقبلين الذين فشل الإرسال إليهم، وpartial عند نجاح البعض وفشل البعض */
export type VoucherEmailResult = {
  success: boolean;
  sentTo: string[];
  failed: Array<{ email: string; error: string }>;
  partial: boolean;
  error?: string;
};

export async function sendVoucherEmail(v: VoucherEmailData): Promise<VoucherEmailResult> {
  const db = await getDb();
  if (!db) return { success: false, sentTo: [], failed: [], partial: false, error: 'خطأ في الاتصال بقاعدة البيانات' };

  try {
    const type = typeOf(v);
    const titles = VOUCHER_TITLES[type];
    const staff = await db
      .select({ id: users.id, name: users.name, username: users.username, email: users.email, role: users.role, branchId: users.branchId })
      .from(users)
      // الحسابات المعطلة لا تستقبل بريد السندات
      .where(and(inArray(users.role, ['admin', 'manager', 'supervisor']), eq(users.isActive, true)));

    const recipients: Array<{ email: string; label: string; intro?: string }> = [];
    const seen = new Set<string>();
    const add = (email: string | null | undefined, label: string, intro?: string) => {
      const e = String(email ?? '').trim();
      if (!e || !e.includes('@') || seen.has(e.toLowerCase())) return;
      seen.add(e.toLowerCase());
      recipients.push({ email: e, label, intro });
    };

    const partyLabel = v.partyName || v.payeeName || '';
    add(v.payeeEmail, partyLabel);
    if (v.branchId) {
      for (const s of staff.filter(u => u.role === 'supervisor' && u.branchId === v.branchId)) {
        add(s.email, `مشرف الفرع: ${s.name || s.username || ''}`);
      }
    }
    // طلب المراجعة للمسودات فقط (الملغي والمعتمد لا ينتظران اعتماداً)
    const reviewIntro = v.status === 'draft' ? `${titles.ar} جديد بانتظار مراجعتك واعتمادك.` : undefined;
    for (const m of staff.filter(u => u.role === 'manager')) add(m.email, `المدير: ${m.name || m.username || ''}`, reviewIntro);
    for (const a of staff.filter(u => u.role === 'admin')) add(a.email, `المسؤول: ${a.name || a.username || ''}`, reviewIntro);

    if (recipients.length === 0) {
      return { success: false, sentTo: [], failed: [], partial: false, error: 'لا يوجد مستقبلون لديهم بريد إلكتروني' };
    }

    const attachment = await buildVoucherAttachment(v);
    const subject = `${titles.ar} رقم ${v.voucherId}${partyLabel ? ` - ${partyLabel}` : ''}`.replace(/[\r\n]+/g, ' ');
    const sentTo: string[] = [];
    const failed: VoucherEmailResult['failed'] = [];
    for (const r of recipients) {
      const result = await sendEmail({
        to: r.email,
        subject,
        html: buildVoucherEmailHtml(v, r.intro),
        attachments: attachment ? [attachment] : undefined,
      });
      if (result.success) sentTo.push(`${r.label} (${r.email})`);
      else {
        const reason = result.error || 'خطأ غير معروف';
        failed.push({ email: r.email, error: reason });
        console.error(`فشل إرسال السند إلى ${r.email}: ${reason}`);
      }
    }

    return {
      success: sentTo.length > 0,
      sentTo,
      failed,
      partial: sentTo.length > 0 && failed.length > 0,
      error: sentTo.length === 0 ? 'لم يتم إرسال البريد لأي مستقبل' : undefined,
    };
  } catch (error) {
    console.error('خطأ في إرسال البريد:', error);
    return { success: false, sentTo: [], failed: [], partial: false, error: 'حدث خطأ أثناء إرسال البريد' };
  }
}

/**
 * @deprecated استخدم sendVoucherEmail - يبقى للتوافق مع الاستدعاءات القديمة
 */
export async function sendReceiptVoucherEmail(data: {
  voucherId: string;
  voucherNumber?: string;
  [key: string]: unknown;
}): Promise<VoucherEmailResult> {
  const voucher = await getVoucherWithItems(data.voucherNumber || data.voucherId);
  if (!voucher) return { success: false, sentTo: [], failed: [], partial: false, error: 'السند غير موجود' };
  return sendVoucherEmail(voucher);
}
