import { sendEmail, getEmailTemplate } from '../email/emailService';
import { getDb } from '../db';
import { employees, branches } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

// أنواع الطلبات بالعربية
const REQUEST_TYPE_NAMES: Record<string, string> = {
  advance: 'سلفة',
  vacation: 'إجازة',
  arrears: 'صرف متأخرات',
  permission: 'استئذان',
  objection: 'اعتراض على مخالفة',
  resignation: 'استقالة',
  end_of_service: 'إنهاء خدمة',
};

// حالات الطلب بالعربية
const STATUS_NAMES: Record<string, string> = {
  pending: 'قيد المراجعة',
  approved: 'موافق عليه',
  rejected: 'مرفوض',
  cancelled: 'ملغي',
};

// ألوان الحالات
const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  approved: '#10b981',
  rejected: '#ef4444',
  cancelled: '#6b7280',
};

interface RequestNotificationData {
  requestNumber: string;
  employeeId: number;
  employeeName: string;
  requestType: string;
  status: string;
  description?: string;
  reviewerNotes?: string;
  reviewerName?: string;
  // بيانات إضافية حسب نوع الطلب
  amount?: number;
  startDate?: Date;
  endDate?: Date;
  vacationType?: string;
}

/**
 * إرسال إشعار للموظف عند تغيير حالة طلبه
 */
export async function notifyEmployeeOnRequestStatusChange(
  data: RequestNotificationData
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDb();
    if (!db) {
      return { success: false, error: 'فشل الاتصال بقاعدة البيانات' };
    }
    
    // جلب بيانات الموظف مع البريد الإلكتروني
    const [employee] = await db.select().from(employees).where(eq(employees.id, data.employeeId)).limit(1);

    if (!employee) {
      console.warn(`[EmployeeNotification] Employee not found: ${data.employeeId}`);
      return { success: false, error: 'الموظف غير موجود' };
    }

    if (!employee.email) {
      console.warn(`[EmployeeNotification] Employee has no email: ${data.employeeId}`);
      return { success: false, error: 'لا يوجد بريد إلكتروني للموظف' };
    }

    // جلب اسم الفرع
    let branchName = '';
    if (employee.branchId) {
      const [branch] = await db.select().from(branches).where(eq(branches.id, employee.branchId)).limit(1);
      branchName = branch?.name || '';
    }

    const requestTypeName = REQUEST_TYPE_NAMES[data.requestType] || data.requestType;
    const statusName = STATUS_NAMES[data.status] || data.status;
    const statusColor = STATUS_COLORS[data.status] || '#6b7280';

    // إنشاء محتوى البريد الإلكتروني
    const emailContent = generateRequestStatusEmailContent({
      ...data,
      requestTypeName,
      statusName,
      statusColor,
      branchName,
    });

    const subject = getEmailSubject(data.status, requestTypeName, data.requestNumber);

    const htmlContent = getEmailTemplate(emailContent, subject);

    // إرسال البريد الإلكتروني
    const result = await sendEmail({
      to: employee.email,
      subject,
      html: htmlContent,
    });

    if (result.success) {
      console.log(`[EmployeeNotification] Email sent to ${employee.email} for request ${data.requestNumber}`);
    } else {
      console.error(`[EmployeeNotification] Failed to send email: ${result.error}`);
    }

    return result;
  } catch (error) {
    console.error('[EmployeeNotification] Error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'خطأ غير معروف' 
    };
  }
}

function getEmailSubject(status: string, requestType: string, requestNumber: string): string {
  switch (status) {
    case 'approved':
      return `✅ تمت الموافقة على طلب ${requestType} - ${requestNumber}`;
    case 'rejected':
      return `❌ تم رفض طلب ${requestType} - ${requestNumber}`;
    case 'pending':
      return `📋 تم استلام طلب ${requestType} - ${requestNumber}`;
    case 'cancelled':
      return `🚫 تم إلغاء طلب ${requestType} - ${requestNumber}`;
    default:
      return `تحديث على طلب ${requestType} - ${requestNumber}`;
  }
}

interface EmailContentData extends RequestNotificationData {
  requestTypeName: string;
  statusName: string;
  statusColor: string;
  branchName: string;
}

function generateRequestStatusEmailContent(data: EmailContentData): string {
  const statusIcon = getStatusIcon(data.status);
  const statusMessage = getStatusMessage(data.status, data.requestTypeName);
  
  let additionalInfo = '';
  
  // معلومات إضافية حسب نوع الطلب
  if (data.requestType === 'advance' && data.amount) {
    additionalInfo = `
      <div class="section">
        <div class="section-title">تفاصيل السلفة</div>
        <table>
          <tr>
            <td><strong>المبلغ المطلوب:</strong></td>
            <td>${data.amount.toLocaleString('ar-SA')} ر.س</td>
          </tr>
        </table>
      </div>
    `;
  } else if (data.requestType === 'vacation' && data.startDate && data.endDate) {
    const vacationTypeName = data.vacationType === 'annual' ? 'سنوية' :
                             data.vacationType === 'sick' ? 'مرضية' :
                             data.vacationType === 'emergency' ? 'طارئة' :
                             data.vacationType === 'unpaid' ? 'بدون أجر' : data.vacationType;
    additionalInfo = `
      <div class="section">
        <div class="section-title">تفاصيل الإجازة</div>
        <table>
          <tr>
            <td><strong>نوع الإجازة:</strong></td>
            <td>${vacationTypeName}</td>
          </tr>
          <tr>
            <td><strong>من تاريخ:</strong></td>
            <td>${new Date(data.startDate).toLocaleDateString('ar-SA')}</td>
          </tr>
          <tr>
            <td><strong>إلى تاريخ:</strong></td>
            <td>${new Date(data.endDate).toLocaleDateString('ar-SA')}</td>
          </tr>
        </table>
      </div>
    `;
  }

  // ملاحظات المراجع
  let reviewerSection = '';
  if (data.reviewerNotes && (data.status === 'approved' || data.status === 'rejected')) {
    reviewerSection = `
      <div class="section">
        <div class="section-title">ملاحظات المراجع</div>
        <p style="margin: 0; padding: 10px; background-color: #fff; border-radius: 4px;">
          ${data.reviewerNotes}
        </p>
        ${data.reviewerName ? `<p style="margin-top: 10px; font-size: 12px; color: #666;">- ${data.reviewerName}</p>` : ''}
      </div>
    `;
  }

  return `
    <div style="text-align: center; padding: 20px;">
      <div style="font-size: 48px; margin-bottom: 10px;">${statusIcon}</div>
      <h2 style="margin: 0; color: ${data.statusColor};">${statusMessage}</h2>
    </div>

    <div class="section">
      <div class="section-title">معلومات الطلب</div>
      <table>
        <tr>
          <td><strong>رقم الطلب:</strong></td>
          <td>${data.requestNumber}</td>
        </tr>
        <tr>
          <td><strong>نوع الطلب:</strong></td>
          <td>${data.requestTypeName}</td>
        </tr>
        <tr>
          <td><strong>الموظف:</strong></td>
          <td>${data.employeeName}</td>
        </tr>
        ${data.branchName ? `
        <tr>
          <td><strong>الفرع:</strong></td>
          <td>${data.branchName}</td>
        </tr>
        ` : ''}
        <tr>
          <td><strong>الحالة:</strong></td>
          <td style="color: ${data.statusColor}; font-weight: bold;">${data.statusName}</td>
        </tr>
      </table>
    </div>

    ${additionalInfo}

    ${data.description ? `
    <div class="section">
      <div class="section-title">وصف الطلب</div>
      <p style="margin: 0;">${data.description}</p>
    </div>
    ` : ''}

    ${reviewerSection}

    <div style="text-align: center; padding: 20px; background-color: #f0f9ff; border-radius: 8px; margin-top: 20px;">
      <p style="margin: 0; color: #0369a1;">
        يمكنك متابعة حالة طلباتك من خلال بوابة الموظفين
      </p>
    </div>
  `;
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'approved':
      return '✅';
    case 'rejected':
      return '❌';
    case 'pending':
      return '📋';
    case 'cancelled':
      return '🚫';
    default:
      return '📝';
  }
}

function getStatusMessage(status: string, requestType: string): string {
  switch (status) {
    case 'approved':
      return `تمت الموافقة على طلب ${requestType}`;
    case 'rejected':
      return `تم رفض طلب ${requestType}`;
    case 'pending':
      return `تم استلام طلب ${requestType} وهو قيد المراجعة`;
    case 'cancelled':
      return `تم إلغاء طلب ${requestType}`;
    default:
      return `تحديث على طلب ${requestType}`;
  }
}

/**
 * إرسال إشعار للموظف عند تقديم طلب جديد
 */
export async function notifyEmployeeOnNewRequest(
  data: RequestNotificationData
): Promise<{ success: boolean; error?: string }> {
  return notifyEmployeeOnRequestStatusChange({
    ...data,
    status: 'pending',
  });
}
