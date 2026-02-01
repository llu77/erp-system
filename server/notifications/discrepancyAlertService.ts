/**
 * خدمة تنبيهات الفروقات
 * ========================
 * 
 * تقوم بإرسال تنبيهات فورية عند اكتشاف فروقات بين:
 * - المبلغ المدخل والمبلغ المستخرج من صورة الموازنة
 * - التاريخ المدخل والتاريخ المستخرج من الإيصال
 * 
 * الميزات:
 * 1. إرسال فوري عبر البريد الإلكتروني
 * 2. تسجيل الفروقات في قاعدة البيانات
 * 3. دعم الهرمية في الإشعارات (Admin, مشرف عام, مشرف فرع)
 * 4. قوالب احترافية بالعربية والإنجليزية
 */

import { notificationQueue } from './notificationQueue';
import * as db from '../db';
import type { BalanceVerificationResult, OCRWarning } from '../ocr/balanceImageOCR';

// ==================== أنواع البيانات ====================

export interface DiscrepancyDetails {
  branchId: number;
  branchName: string;
  employeeName: string;
  date: string;
  
  // تفاصيل المبالغ
  enteredAmount: number;
  extractedAmount: number | null;
  difference: number | null;
  isAmountMatched: boolean;
  
  // تفاصيل التاريخ
  enteredDate: string;
  extractedDate: string | null;
  isDateMatched: boolean;
  
  // معلومات إضافية
  confidence: string;
  warnings: OCRWarning[];
  sections?: Array<{
    name: string;
    hostTotal: number;
    terminalTotal: number;
    count: number;
  }>;
  
  // رابط الصورة
  imageUrl?: string;
}

export interface DiscrepancyAlertResult {
  success: boolean;
  alertsSent: number;
  recipients: string[];
  logId?: number;
  error?: string;
}

// ==================== إعدادات التنبيهات ====================

const ALERT_CONFIG = {
  // الحد الأدنى للفرق الذي يستدعي تنبيه (بالريال)
  minAmountDifference: 1,
  
  // أنواع الفروقات التي تستدعي تنبيه
  alertTypes: {
    amount_mismatch: true,
    date_mismatch: true,
    low_confidence: true,
    unclear_image: true,
    no_sections: true,
  },
  
  // أولوية التنبيهات
  priority: 'high' as const,
};

// ==================== قوالب الإشعارات ====================

function generateArabicEmailTemplate(details: DiscrepancyDetails): { subject: string; html: string; text: string } {
  const subject = `🚨 تنبيه فوري: فرق في موازنة ${details.branchName} - ${details.date}`;
  
  const severityEmoji = details.isAmountMatched ? '⚠️' : '🚨';
  const amountStatus = details.isAmountMatched ? '✅ مطابق' : '❌ غير مطابق';
  const dateStatus = details.isDateMatched ? '✅ مطابق' : '❌ غير مطابق';
  
  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #dc2626, #991b1b); color: white; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .header .subtitle { margin-top: 8px; opacity: 0.9; font-size: 14px; }
    .content { padding: 24px; }
    .alert-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
    .alert-box.warning { background: #fffbeb; border-color: #fde68a; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    .info-item { background: #f8fafc; border-radius: 8px; padding: 12px; }
    .info-label { font-size: 12px; color: #64748b; margin-bottom: 4px; }
    .info-value { font-size: 16px; font-weight: 600; color: #1e293b; }
    .info-value.error { color: #dc2626; }
    .info-value.success { color: #16a34a; }
    .details-table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    .details-table th, .details-table td { padding: 12px; text-align: right; border-bottom: 1px solid #e2e8f0; }
    .details-table th { background: #f1f5f9; font-weight: 600; color: #475569; }
    .sections-list { background: #f8fafc; border-radius: 8px; padding: 16px; margin-top: 16px; }
    .section-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
    .section-item:last-child { border-bottom: none; }
    .footer { background: #f8fafc; padding: 16px 24px; text-align: center; font-size: 12px; color: #64748b; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .badge.error { background: #fef2f2; color: #dc2626; }
    .badge.success { background: #f0fdf4; color: #16a34a; }
    .badge.warning { background: #fffbeb; color: #d97706; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${severityEmoji} تنبيه فروقات الموازنة</h1>
      <div class="subtitle">تم اكتشاف فرق يتطلب المراجعة</div>
    </div>
    
    <div class="content">
      <div class="alert-box ${details.isAmountMatched ? 'warning' : ''}">
        <strong>📍 الفرع:</strong> ${details.branchName}<br>
        <strong>👤 الموظف:</strong> ${details.employeeName}<br>
        <strong>📅 التاريخ:</strong> ${details.date}
      </div>
      
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">المبلغ المدخل</div>
          <div class="info-value">${details.enteredAmount.toFixed(2)} ر.س</div>
        </div>
        <div class="info-item">
          <div class="info-label">المبلغ المستخرج</div>
          <div class="info-value ${details.isAmountMatched ? 'success' : 'error'}">
            ${details.extractedAmount !== null ? details.extractedAmount.toFixed(2) + ' ر.س' : 'غير محدد'}
          </div>
        </div>
        <div class="info-item">
          <div class="info-label">الفرق</div>
          <div class="info-value ${details.difference && details.difference > 0 ? 'error' : 'success'}">
            ${details.difference !== null ? details.difference.toFixed(2) + ' ر.س' : '-'}
          </div>
        </div>
        <div class="info-item">
          <div class="info-label">مستوى الثقة</div>
          <div class="info-value">
            <span class="badge ${details.confidence === 'high' ? 'success' : details.confidence === 'medium' ? 'warning' : 'error'}">
              ${details.confidence === 'high' ? 'عالي' : details.confidence === 'medium' ? 'متوسط' : 'منخفض'}
            </span>
          </div>
        </div>
      </div>
      
      <table class="details-table">
        <tr>
          <th>البيان</th>
          <th>المدخل</th>
          <th>المستخرج</th>
          <th>الحالة</th>
        </tr>
        <tr>
          <td>المبلغ</td>
          <td>${details.enteredAmount.toFixed(2)} ر.س</td>
          <td>${details.extractedAmount !== null ? details.extractedAmount.toFixed(2) + ' ر.س' : 'غير محدد'}</td>
          <td><span class="badge ${details.isAmountMatched ? 'success' : 'error'}">${amountStatus}</span></td>
        </tr>
        <tr>
          <td>التاريخ</td>
          <td>${details.enteredDate}</td>
          <td>${details.extractedDate || 'غير محدد'}</td>
          <td><span class="badge ${details.isDateMatched ? 'success' : 'error'}">${dateStatus}</span></td>
        </tr>
      </table>
      
      ${details.sections && details.sections.length > 0 ? `
      <div class="sections-list">
        <strong>📊 تفاصيل الأقسام المستخرجة:</strong>
        ${details.sections.filter(s => s.terminalTotal > 0).map(s => `
          <div class="section-item">
            <span>${s.name}</span>
            <span>${s.terminalTotal.toFixed(2)} ر.س (${s.count} معاملة)</span>
          </div>
        `).join('')}
      </div>
      ` : ''}
      
      ${details.warnings && details.warnings.length > 0 ? `
      <div class="alert-box warning" style="margin-top: 16px;">
        <strong>⚠️ تحذيرات:</strong>
        <ul style="margin: 8px 0 0 0; padding-right: 20px;">
          ${details.warnings.map(w => `<li>${w.message}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
    </div>
    
    <div class="footer">
      <p>هذا تنبيه تلقائي من نظام Symbol AI ERP</p>
      <p>يرجى مراجعة الفرق واتخاذ الإجراء المناسب</p>
    </div>
  </div>
</body>
</html>
  `.trim();
  
  const text = `
🚨 تنبيه فروقات الموازنة

الفرع: ${details.branchName}
الموظف: ${details.employeeName}
التاريخ: ${details.date}

تفاصيل المبالغ:
- المبلغ المدخل: ${details.enteredAmount.toFixed(2)} ر.س
- المبلغ المستخرج: ${details.extractedAmount !== null ? details.extractedAmount.toFixed(2) + ' ر.س' : 'غير محدد'}
- الفرق: ${details.difference !== null ? details.difference.toFixed(2) + ' ر.س' : '-'}
- حالة المبلغ: ${amountStatus}

تفاصيل التاريخ:
- التاريخ المدخل: ${details.enteredDate}
- التاريخ المستخرج: ${details.extractedDate || 'غير محدد'}
- حالة التاريخ: ${dateStatus}

مستوى الثقة: ${details.confidence === 'high' ? 'عالي' : details.confidence === 'medium' ? 'متوسط' : 'منخفض'}

---
هذا تنبيه تلقائي من نظام Symbol AI ERP
  `.trim();
  
  return { subject, html, text };
}

function generateEnglishEmailTemplate(details: DiscrepancyDetails): { subject: string; html: string; text: string } {
  const subject = `🚨 Urgent Alert: Balance Discrepancy at ${details.branchName} - ${details.date}`;
  
  const amountStatus = details.isAmountMatched ? '✅ Matched' : '❌ Mismatched';
  const dateStatus = details.isDateMatched ? '✅ Matched' : '❌ Mismatched';
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #dc2626, #991b1b); color: white; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 24px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    .info-item { background: #f8fafc; border-radius: 8px; padding: 12px; }
    .info-label { font-size: 12px; color: #64748b; margin-bottom: 4px; }
    .info-value { font-size: 16px; font-weight: 600; color: #1e293b; }
    .info-value.error { color: #dc2626; }
    .info-value.success { color: #16a34a; }
    .footer { background: #f8fafc; padding: 16px 24px; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚨 Balance Discrepancy Alert</h1>
    </div>
    <div class="content">
      <p><strong>Branch:</strong> ${details.branchName}</p>
      <p><strong>Employee:</strong> ${details.employeeName}</p>
      <p><strong>Date:</strong> ${details.date}</p>
      
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Entered Amount</div>
          <div class="info-value">${details.enteredAmount.toFixed(2)} SAR</div>
        </div>
        <div class="info-item">
          <div class="info-label">Extracted Amount</div>
          <div class="info-value ${details.isAmountMatched ? 'success' : 'error'}">
            ${details.extractedAmount !== null ? details.extractedAmount.toFixed(2) + ' SAR' : 'Unknown'}
          </div>
        </div>
      </div>
      
      <p><strong>Amount Status:</strong> ${amountStatus}</p>
      <p><strong>Date Status:</strong> ${dateStatus}</p>
      <p><strong>Difference:</strong> ${details.difference !== null ? details.difference.toFixed(2) + ' SAR' : '-'}</p>
    </div>
    <div class="footer">
      <p>Automatic alert from Symbol AI ERP System</p>
    </div>
  </div>
</body>
</html>
  `.trim();
  
  const text = `
🚨 Balance Discrepancy Alert

Branch: ${details.branchName}
Employee: ${details.employeeName}
Date: ${details.date}

Amount Details:
- Entered: ${details.enteredAmount.toFixed(2)} SAR
- Extracted: ${details.extractedAmount !== null ? details.extractedAmount.toFixed(2) + ' SAR' : 'Unknown'}
- Difference: ${details.difference !== null ? details.difference.toFixed(2) + ' SAR' : '-'}
- Status: ${amountStatus}

Date Details:
- Entered: ${details.enteredDate}
- Extracted: ${details.extractedDate || 'Unknown'}
- Status: ${dateStatus}

---
Automatic alert from Symbol AI ERP System
  `.trim();
  
  return { subject, html, text };
}

// ==================== الدوال الرئيسية ====================

/**
 * إرسال تنبيه فوري عند اكتشاف فرق
 */
export async function sendDiscrepancyAlert(details: DiscrepancyDetails): Promise<DiscrepancyAlertResult> {
  try {
    // التحقق من أن هناك فرق يستدعي تنبيه
    if (details.isAmountMatched && details.isDateMatched) {
      return {
        success: true,
        alertsSent: 0,
        recipients: [],
      };
    }
    
    // جلب المستلمين المناسبين
    const recipients = await db.getNotificationRecipients(details.branchId);
    
    if (!recipients || recipients.length === 0) {
      console.warn('[DiscrepancyAlert] لا يوجد مستلمين للإشعارات');
      return {
        success: false,
        alertsSent: 0,
        recipients: [],
        error: 'لا يوجد مستلمين للإشعارات',
      };
    }
    
    // تصفية المستلمين النشطين
    const activeRecipients = recipients.filter(r => r.isActive);
    
    if (activeRecipients.length === 0) {
      return {
        success: false,
        alertsSent: 0,
        recipients: [],
        error: 'جميع المستلمين غير نشطين',
      };
    }
    
    // إنشاء قوالب الإشعارات
    const arabicTemplate = generateArabicEmailTemplate(details);
    const englishTemplate = generateEnglishEmailTemplate(details);
    
    // إضافة الإشعارات إلى Queue
    const sentRecipients: string[] = [];
    
    for (const recipient of activeRecipients) {
      // اختيار القالب حسب اللغة المفضلة (افتراضي: عربي)
      const template = arabicTemplate; // يمكن إضافة حقل لغة للمستلم لاحقاً
      
      await notificationQueue.enqueue({
        type: 'revenue_mismatch',
        recipient: {
          email: recipient.email,
          name: recipient.name,
          id: recipient.id,
        },
        subject: template.subject,
        bodyHtml: template.html,
        bodyText: template.text,
        priority: ALERT_CONFIG.priority,
        maxAttempts: 3,
        metadata: {
          branchId: details.branchId,
          branchName: details.branchName,
          date: details.date,
          enteredAmount: details.enteredAmount,
          extractedAmount: details.extractedAmount,
          difference: details.difference,
        },
      });
      
      sentRecipients.push(recipient.email);
    }
    
    // تسجيل التنبيه في قاعدة البيانات
    const logId = await logDiscrepancyAlert(details, sentRecipients);
    
    console.log(`[DiscrepancyAlert] ✅ تم إرسال ${sentRecipients.length} تنبيه للفرق في ${details.branchName}`);
    
    return {
      success: true,
      alertsSent: sentRecipients.length,
      recipients: sentRecipients,
      logId,
    };
    
  } catch (error: any) {
    console.error('[DiscrepancyAlert] خطأ في إرسال التنبيه:', error);
    return {
      success: false,
      alertsSent: 0,
      recipients: [],
      error: error.message,
    };
  }
}

/**
 * إنشاء تفاصيل الفرق من نتيجة التحقق
 */
export function createDiscrepancyDetails(
  verificationResult: BalanceVerificationResult,
  branchId: number,
  branchName: string,
  employeeName: string,
  enteredAmount: number,
  enteredDate: string,
  imageUrl?: string
): DiscrepancyDetails {
  return {
    branchId,
    branchName,
    employeeName,
    date: enteredDate,
    enteredAmount,
    extractedAmount: verificationResult.extractedAmount,
    difference: verificationResult.difference,
    isAmountMatched: verificationResult.isMatched,
    enteredDate,
    extractedDate: verificationResult.extractedDate,
    isDateMatched: verificationResult.isDateMatched,
    confidence: verificationResult.confidence,
    warnings: verificationResult.warnings || [],
    sections: verificationResult.sections,
    imageUrl,
  };
}

/**
 * تسجيل تنبيه الفرق في قاعدة البيانات
 */
async function logDiscrepancyAlert(details: DiscrepancyDetails, recipients: string[]): Promise<number | undefined> {
  try {
    const database = await db.getDb();
    if (!database) return undefined;
    
    // يمكن إضافة جدول خاص لسجل الفروقات لاحقاً
    // حالياً نستخدم جدول الإشعارات المرسلة
    
    await db.logSentNotification({
      recipientId: 0,
      recipientEmail: recipients.join(', '),
      recipientName: 'Multiple Recipients',
      notificationType: 'revenue_mismatch',
      subject: `فرق في موازنة ${details.branchName}`,
      bodyArabic: JSON.stringify({
        branchId: details.branchId,
        branchName: details.branchName,
        date: details.date,
        enteredAmount: details.enteredAmount,
        extractedAmount: details.extractedAmount,
        difference: details.difference,
        isAmountMatched: details.isAmountMatched,
        isDateMatched: details.isDateMatched,
      }),
      status: 'sent',
    });
    
    return 1;
  } catch (error: any) {
    console.error('[DiscrepancyAlert] خطأ في تسجيل التنبيه:', error);
    return undefined;
  }
}

/**
 * التحقق مما إذا كان يجب إرسال تنبيه
 */
export function shouldSendAlert(
  verificationResult: BalanceVerificationResult,
  minDifference: number = ALERT_CONFIG.minAmountDifference
): boolean {
  // إذا كان هناك عدم تطابق في المبلغ
  if (!verificationResult.isMatched && verificationResult.difference !== null) {
    if (verificationResult.difference >= minDifference) {
      return true;
    }
  }
  
  // إذا كان هناك عدم تطابق في التاريخ
  if (!verificationResult.isDateMatched) {
    return true;
  }
  
  // إذا كانت الثقة منخفضة جداً
  if (verificationResult.confidence === 'none' || verificationResult.confidence === 'low') {
    return true;
  }
  
  return false;
}

export default {
  sendDiscrepancyAlert,
  createDiscrepancyDetails,
  shouldSendAlert,
};
