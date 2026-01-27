/**
 * Symbol AI - نظام إشعارات انتهاء الوثائق
 * إرسال إشعارات تلقائية عند اقتراب انتهاء صلاحية الوثائق
 */

import { Resend } from "resend";
import * as db from "../db";
import { wasNotificationSentToday, markNotificationAsSent, TrackedNotificationType } from './notificationTracker';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "info@symbolai.net";

// أنواع الوثائق
type DocumentType = 'iqama' | 'healthCert' | 'contract';

// واجهة بيانات الموظف مع الوثائق
interface EmployeeDocument {
  employeeId: number;
  employeeName: string;
  employeeCode: string;
  branchId: number;
  branchName: string;
  documentType: DocumentType;
  documentName: string;
  expiryDate: Date;
  daysRemaining: number;
  supervisorEmail?: string;
}

// الحصول على الوثائق القريبة من الانتهاء (30 يوم أو أقل)
export async function getExpiringDocuments(daysThreshold: number = 30): Promise<EmployeeDocument[]> {
  const data = await db.getEmployeesWithExpiringDocuments();
  const expiringDocs: EmployeeDocument[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // معالجة الإقامات المنتهية
  for (const emp of data.expired.iqama) {
    const expiryDate = new Date(emp.iqamaExpiryDate!);
    const daysRemaining = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    expiringDocs.push({
      employeeId: emp.id,
      employeeName: emp.name,
      employeeCode: emp.code,
      branchId: emp.branchId,
      branchName: emp.branchName,
      documentType: 'iqama',
      documentName: 'الإقامة',
      expiryDate,
      daysRemaining,
    });
  }

  // معالجة الإقامات القريبة من الانتهاء
  for (const emp of data.expiring.iqama) {
    const expiryDate = new Date(emp.iqamaExpiryDate!);
    const daysRemaining = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysRemaining <= daysThreshold) {
      expiringDocs.push({
        employeeId: emp.id,
        employeeName: emp.name,
        employeeCode: emp.code,
        branchId: emp.branchId,
        branchName: emp.branchName,
        documentType: 'iqama',
        documentName: 'الإقامة',
        expiryDate,
        daysRemaining,
      });
    }
  }

  // معالجة الشهادات الصحية المنتهية
  for (const emp of data.expired.healthCert) {
    const expiryDate = new Date(emp.healthCertExpiryDate!);
    const daysRemaining = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    expiringDocs.push({
      employeeId: emp.id,
      employeeName: emp.name,
      employeeCode: emp.code,
      branchId: emp.branchId,
      branchName: emp.branchName,
      documentType: 'healthCert',
      documentName: 'الشهادة الصحية',
      expiryDate,
      daysRemaining,
    });
  }

  // معالجة الشهادات الصحية القريبة من الانتهاء
  for (const emp of data.expiring.healthCert) {
    const expiryDate = new Date(emp.healthCertExpiryDate!);
    const daysRemaining = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysRemaining <= daysThreshold) {
      expiringDocs.push({
        employeeId: emp.id,
        employeeName: emp.name,
        employeeCode: emp.code,
        branchId: emp.branchId,
        branchName: emp.branchName,
        documentType: 'healthCert',
        documentName: 'الشهادة الصحية',
        expiryDate,
        daysRemaining,
      });
    }
  }

  // معالجة العقود المنتهية
  for (const emp of data.expired.contract) {
    const expiryDate = new Date(emp.contractExpiryDate!);
    const daysRemaining = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    expiringDocs.push({
      employeeId: emp.id,
      employeeName: emp.name,
      employeeCode: emp.code,
      branchId: emp.branchId,
      branchName: emp.branchName,
      documentType: 'contract',
      documentName: 'عقد العمل',
      expiryDate,
      daysRemaining,
    });
  }

  // معالجة العقود القريبة من الانتهاء
  for (const emp of data.expiring.contract) {
    const expiryDate = new Date(emp.contractExpiryDate!);
    const daysRemaining = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysRemaining <= daysThreshold) {
      expiringDocs.push({
        employeeId: emp.id,
        employeeName: emp.name,
        employeeCode: emp.code,
        branchId: emp.branchId,
        branchName: emp.branchName,
        documentType: 'contract',
        documentName: 'عقد العمل',
        expiryDate,
        daysRemaining,
      });
    }
  }

  // ترتيب حسب الأيام المتبقية (الأقل أولاً)
  return expiringDocs.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

// تصنيف الوثائق حسب الحالة
export function categorizeDocuments(docs: EmployeeDocument[]): {
  expired: EmployeeDocument[];
  critical: EmployeeDocument[];  // 0-7 أيام
  warning: EmployeeDocument[];   // 8-14 يوم
  upcoming: EmployeeDocument[];  // 15-30 يوم
} {
  return {
    expired: docs.filter(d => d.daysRemaining < 0),
    critical: docs.filter(d => d.daysRemaining >= 0 && d.daysRemaining <= 7),
    warning: docs.filter(d => d.daysRemaining > 7 && d.daysRemaining <= 14),
    upcoming: docs.filter(d => d.daysRemaining > 14 && d.daysRemaining <= 30),
  };
}

// إنشاء محتوى البريد الإلكتروني
function generateDocumentExpiryEmail(docs: EmployeeDocument[], recipientName: string): string {
  const categorized = categorizeDocuments(docs);
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ar-SA', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getStatusBadge = (days: number) => {
    if (days < 0) return '<span style="background: #e74c3c; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">منتهية</span>';
    if (days <= 7) return '<span style="background: #e74c3c; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">حرج</span>';
    if (days <= 14) return '<span style="background: #f39c12; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">تحذير</span>';
    return '<span style="background: #3498db; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">قريب</span>';
  };

  const generateTable = (documents: EmployeeDocument[], title: string, color: string) => {
    if (documents.length === 0) return '';
    
    return `
      <div style="margin-bottom: 25px;">
        <h3 style="color: ${color}; margin-bottom: 10px; border-bottom: 2px solid ${color}; padding-bottom: 5px;">
          ${title} (${documents.length})
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <thead>
            <tr style="background: #f8f9fa;">
              <th style="padding: 10px; text-align: right; border: 1px solid #ddd;">الموظف</th>
              <th style="padding: 10px; text-align: right; border: 1px solid #ddd;">الفرع</th>
              <th style="padding: 10px; text-align: right; border: 1px solid #ddd;">الوثيقة</th>
              <th style="padding: 10px; text-align: right; border: 1px solid #ddd;">تاريخ الانتهاء</th>
              <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${documents.map(doc => `
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd;">${doc.employeeName}<br><small style="color: #666;">${doc.employeeCode}</small></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${doc.branchName}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${doc.documentName}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${formatDate(doc.expiryDate)}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">
                  ${getStatusBadge(doc.daysRemaining)}
                  <br><small>${doc.daysRemaining < 0 ? `منتهية منذ ${Math.abs(doc.daysRemaining)} يوم` : `${doc.daysRemaining} يوم`}</small>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <style>
        body { margin: 0; padding: 20px; background: #f5f5f5; font-family: 'Segoe UI', Tahoma, sans-serif; }
        .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 25px; text-align: center; }
        .header h1 { color: #f39c12; margin: 0; font-size: 24px; }
        .header p { color: #ccc; margin: 10px 0 0; }
        .content { padding: 25px; }
        .summary { display: flex; gap: 15px; margin-bottom: 25px; flex-wrap: wrap; }
        .summary-card { flex: 1; min-width: 120px; padding: 15px; border-radius: 8px; text-align: center; }
        .summary-card.expired { background: #fde8e8; border-left: 4px solid #e74c3c; }
        .summary-card.critical { background: #fef3e2; border-left: 4px solid #f39c12; }
        .summary-card.warning { background: #fff8e1; border-left: 4px solid #ffc107; }
        .summary-card.upcoming { background: #e3f2fd; border-left: 4px solid #2196f3; }
        .summary-card h2 { margin: 0; font-size: 28px; }
        .summary-card p { margin: 5px 0 0; font-size: 12px; color: #666; }
        .footer { background: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #eee; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📋 تقرير الوثائق المنتهية والقريبة من الانتهاء</h1>
          <p>Symbol AI - نظام إدارة الأعمال</p>
        </div>
        
        <div class="content">
          <p style="margin-bottom: 20px;">مرحباً ${recipientName}،</p>
          <p style="margin-bottom: 25px;">فيما يلي ملخص حالة وثائق الموظفين التي تحتاج إلى متابعة:</p>
          
          <div class="summary">
            <div class="summary-card expired">
              <h2 style="color: #e74c3c;">${categorized.expired.length}</h2>
              <p>منتهية</p>
            </div>
            <div class="summary-card critical">
              <h2 style="color: #f39c12;">${categorized.critical.length}</h2>
              <p>حرجة (0-7 أيام)</p>
            </div>
            <div class="summary-card warning">
              <h2 style="color: #ffc107;">${categorized.warning.length}</h2>
              <p>تحذير (8-14 يوم)</p>
            </div>
            <div class="summary-card upcoming">
              <h2 style="color: #2196f3;">${categorized.upcoming.length}</h2>
              <p>قريبة (15-30 يوم)</p>
            </div>
          </div>
          
          ${generateTable(categorized.expired, '⛔ وثائق منتهية - تتطلب إجراء فوري', '#e74c3c')}
          ${generateTable(categorized.critical, '🔴 وثائق حرجة - تنتهي خلال أسبوع', '#f39c12')}
          ${generateTable(categorized.warning, '🟡 وثائق تحذيرية - تنتهي خلال أسبوعين', '#ffc107')}
          ${generateTable(categorized.upcoming, '🔵 وثائق قريبة الانتهاء - خلال شهر', '#2196f3')}
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 20px;">
            <h4 style="margin: 0 0 10px; color: #333;">📌 ملاحظات هامة:</h4>
            <ul style="margin: 0; padding-right: 20px; color: #666;">
              <li>الوثائق المنتهية تتطلب إجراء فوري لتجنب المخالفات القانونية</li>
              <li>يُنصح بتجديد الوثائق قبل 30 يوماً على الأقل من انتهائها</li>
              <li>يمكنك الوصول إلى لوحة الوثائق من خلال النظام لمزيد من التفاصيل</li>
            </ul>
          </div>
        </div>
        
        <div class="footer">
          <p>تم إرسال هذا البريد تلقائياً من نظام Symbol AI</p>
          <p>التاريخ: ${new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// إرسال إشعارات الوثائق المنتهية
export async function sendDocumentExpiryNotifications(): Promise<{
  success: boolean;
  sentCount: number;
  totalDocuments: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let sentCount = 0;

  try {
    // التحقق من عدم إرسال الإشعار اليوم
    const notificationType: TrackedNotificationType = 'document_expiry';
    if (await wasNotificationSentToday(notificationType)) {
      return {
        success: true,
        sentCount: 0,
        totalDocuments: 0,
        errors: ['تم إرسال إشعار الوثائق اليوم بالفعل'],
      };
    }

    // جلب الوثائق القريبة من الانتهاء
    const expiringDocs = await getExpiringDocuments(30);
    
    if (expiringDocs.length === 0) {
      return {
        success: true,
        sentCount: 0,
        totalDocuments: 0,
        errors: [],
      };
    }

    // جلب المستلمين (الأدمن والمشرف العام)
    const recipients = await db.getNotificationRecipients(null);
    const adminRecipients = recipients.filter(
      (r: any) => (r.role === 'admin' || r.role === 'general_supervisor') && r.email
    );

    // إرسال للأدمن والمشرف العام
    for (const recipient of adminRecipients) {
      try {
        const html = generateDocumentExpiryEmail(expiringDocs, recipient.name || 'المسؤول');
        
        await resend.emails.send({
          from: FROM_EMAIL,
          to: recipient.email,
          subject: `📋 تقرير الوثائق - ${expiringDocs.length} وثيقة تحتاج متابعة | Symbol AI`,
          html,
        });
        
        sentCount++;
        console.log(`✓ تم إرسال تقرير الوثائق إلى ${recipient.email}`);
      } catch (error) {
        const errorMsg = `فشل إرسال البريد إلى ${recipient.email}: ${error}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    // إرسال لمشرفي الفروع (وثائق فرعهم فقط)
    const branchSupervisors = recipients.filter(
      (r: any) => r.role === 'branch_supervisor' && r.email && r.branchId
    );

    for (const supervisor of branchSupervisors) {
      const branchDocs = expiringDocs.filter(d => d.branchId === supervisor.branchId);
      
      if (branchDocs.length === 0) continue;
      
      try {
        const html = generateDocumentExpiryEmail(branchDocs, supervisor.name || 'المشرف');
        
        await resend.emails.send({
          from: FROM_EMAIL,
          to: supervisor.email,
          subject: `📋 تقرير وثائق فرعك - ${branchDocs.length} وثيقة تحتاج متابعة | Symbol AI`,
          html,
        });
        
        sentCount++;
        console.log(`✓ تم إرسال تقرير الوثائق إلى مشرف الفرع ${supervisor.email}`);
      } catch (error) {
        const errorMsg = `فشل إرسال البريد إلى ${supervisor.email}: ${error}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    // تسجيل الإرسال
    await markNotificationAsSent(notificationType, sentCount);

    return {
      success: true,
      sentCount,
      totalDocuments: expiringDocs.length,
      errors,
    };
  } catch (error) {
    const errorMsg = `خطأ عام في إرسال إشعارات الوثائق: ${error}`;
    errors.push(errorMsg);
    console.error(errorMsg);
    
    return {
      success: false,
      sentCount,
      totalDocuments: 0,
      errors,
    };
  }
}

// إرسال إشعار فوري لوثيقة محددة
export async function sendSingleDocumentExpiryAlert(doc: EmployeeDocument): Promise<boolean> {
  try {
    const recipients = await db.getNotificationRecipients(doc.branchId);
    const relevantRecipients = recipients.filter(
      (r: any) => (r.role === 'admin' || r.role === 'general_supervisor' || 
        (r.role === 'branch_supervisor' && r.branchId === doc.branchId)) && r.email
    );

    const statusText = doc.daysRemaining < 0 
      ? `منتهية منذ ${Math.abs(doc.daysRemaining)} يوم`
      : `تنتهي خلال ${doc.daysRemaining} يوم`;

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, sans-serif; background: #f5f5f5; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">⚠️ تنبيه عاجل - وثيقة ${doc.daysRemaining < 0 ? 'منتهية' : 'قريبة الانتهاء'}</h1>
          </div>
          <div style="padding: 25px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">الموظف:</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${doc.employeeName} (${doc.employeeCode})</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">الفرع:</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${doc.branchName}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">الوثيقة:</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${doc.documentName}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">تاريخ الانتهاء:</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${doc.expiryDate.toLocaleDateString('ar-SA')}</td>
              </tr>
              <tr>
                <td style="padding: 10px; font-weight: bold;">الحالة:</td>
                <td style="padding: 10px; color: ${doc.daysRemaining < 0 ? '#e74c3c' : '#f39c12'}; font-weight: bold;">${statusText}</td>
              </tr>
            </table>
            <p style="margin-top: 20px; padding: 15px; background: #fef3e2; border-radius: 8px; color: #856404;">
              <strong>⚡ إجراء مطلوب:</strong> يرجى اتخاذ الإجراءات اللازمة لتجديد هذه الوثيقة في أقرب وقت ممكن.
            </p>
          </div>
          <div style="background: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #666;">
            Symbol AI - نظام إدارة الأعمال
          </div>
        </div>
      </body>
      </html>
    `;

    for (const recipient of relevantRecipients) {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: recipient.email,
        subject: `⚠️ تنبيه عاجل: ${doc.documentName} - ${doc.employeeName} | Symbol AI`,
        html,
      });
    }

    return true;
  } catch (error) {
    console.error(`فشل إرسال تنبيه الوثيقة: ${error}`);
    return false;
  }
}
