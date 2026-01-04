import * as db from '../db';
import { sendEmail, getEmailTemplate, formatCurrency, formatNumber } from '../email/emailService';
import { sendWeeklyReport, sendLowStockAlert, sendMonthlyProfitReport } from '../email/scheduledReports';
import * as advancedNotifications from '../notifications/advancedNotificationService';
import { notifyOwner } from '../_core/notification';

// ==================== أنواع البيانات ====================

export type TaskType = 
  | 'weekly_report'
  | 'daily_stock_alert'
  | 'monthly_profit_report'
  | 'expiry_alert'
  | 'large_transaction_alert'
  | 'monthly_inventory_reminder'
  | 'backup'
  | 'custom';

export type AlertType = 
  | 'low_stock'
  | 'expiring_product'
  | 'large_transaction'
  | 'failed_login'
  | 'price_change'
  | 'system_error'
  | 'backup_reminder'
  | 'custom';

export type AlertSeverity = 'info' | 'warning' | 'critical';

// ==================== إعدادات المراقبة ====================

export const DEFAULT_MONITOR_SETTINGS = {
  low_stock_threshold: 10,
  low_stock_alert_enabled: true,
  expiry_days_warning: 30,
  expiry_alert_enabled: true,
  large_transaction_threshold: 10000,
  large_transaction_alert_enabled: true,
  price_change_threshold: 20,
  price_change_alert_enabled: true,
  failed_login_threshold: 5,
  failed_login_alert_enabled: true,
  alert_email_enabled: true,
  alert_email_recipients: 'info@symbolai.net',
  // إعدادات جديدة للتحسينات
  retry_max_attempts: 3,
  retry_delay_ms: 1000,
  duplicate_alert_window_hours: 24,
  alert_deduplication_enabled: true,
};

// ==================== واجهات البيانات ====================

export interface MonitoringAlert {
  alertType: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  entityType: string;
  entityId: number | string;
  entityName: string;
  currentValue: string;
  thresholdValue: string;
  timestamp: Date;
  hash?: string; // للكشف عن التنبيهات المكررة
}

export interface MonitoringResult {
  success: boolean;
  alerts: MonitoringAlert[];
  count: number;
  errors: string[];
  duration: number;
  timestamp: Date;
}

export interface TaskExecutionResult {
  success: boolean;
  message: string;
  emailsSent: number;
  errors: string[];
  duration: number;
  retryCount: number;
}

// ==================== دوال مساعدة ====================

/**
 * حساب hash للتنبيه للكشف عن التنبيهات المكررة
 */
function generateAlertHash(alert: Omit<MonitoringAlert, 'hash' | 'timestamp'>): string {
  const key = `${alert.alertType}:${alert.entityType}:${alert.entityId}`;
  return Buffer.from(key).toString('base64');
}

/**
 * التحقق من وجود تنبيه مماثل مرسل مسبقاً
 */
async function isDuplicateAlert(alert: MonitoringAlert, windowHours: number = 24): Promise<boolean> {
  try {
    const hash = generateAlertHash(alert);
    const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    
    // البحث عن تنبيهات مماثلة في قاعدة البيانات
    // ملاحظة: هذه دالة مساعدة - يمكن تطويرها لاحقاً مع إضافة جدول للتنبيهات
    return false; // حالياً لا نتحقق من التكرار
  } catch (error) {
    console.error('خطأ في التحقق من التنبيهات المكررة:', error);
    return false;
  }
}

/**
 * تسجيل التنبيه في قاعدة البيانات
 */
async function logAlert(alert: MonitoringAlert): Promise<void> {
  try {
    // تسجيل التنبيه في سجل النظام
    await db.createSystemAlert({
      alertType: alert.alertType,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      entityType: alert.entityType,
      entityId: typeof alert.entityId === 'number' ? alert.entityId : parseInt(alert.entityId.toString()),
    });
  } catch (error) {
    console.error('خطأ في تسجيل التنبيه:', error);
  }
}

/**
 * إعادة محاولة العملية مع تأخير متزايد
 */
async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  initialDelayMs: number = 1000
): Promise<{ result: T | null; success: boolean; attempts: number; errors: string[] }> {
  const errors: string[] = [];
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      return { result, success: true, attempts: attempt, errors };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
      errors.push(`محاولة ${attempt}: ${errorMessage}`);
      
      if (attempt < maxAttempts) {
        const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  return { result: null, success: false, attempts: maxAttempts, errors };
}

// ==================== دوال المراقبة المحسّنة ====================

/**
 * مراقبة المخزون المنخفض مع معالجة أخطاء شاملة
 */
export async function checkLowStock(): Promise<MonitoringResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const alerts: MonitoringAlert[] = [];
  
  try {
    // جلب المنتجات بمخزون منخفض مع معالجة الأخطاء
    const { result: lowStockProducts, success } = await retryWithExponentialBackoff(
      () => db.getLowStockProducts(),
      3,
      500
    );
    
    if (!success || !lowStockProducts) {
      errors.push('فشل في جلب المنتجات بمخزون منخفض');
      return {
        success: false,
        alerts: [],
        count: 0,
        errors,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
    
    // معالجة كل منتج
    for (const product of lowStockProducts) {
      try {
        // التحقق من صحة البيانات
        if (!product.id || product.quantity === null || product.minQuantity === null) {
          errors.push(`بيانات غير صحيحة للمنتج: ${product.name}`);
          continue;
        }
        
        const alert: MonitoringAlert = {
          alertType: 'low_stock',
          severity: product.quantity <= 0 ? 'critical' : 'warning',
          title: `تنبيه: مخزون منخفض - ${product.name}`,
          message: `الكمية الحالية (${product.quantity}) أقل من الحد الأدنى (${product.minQuantity})`,
          entityType: 'product',
          entityId: product.id,
          entityName: product.name || 'منتج غير معروف',
          currentValue: product.quantity.toString(),
          thresholdValue: product.minQuantity.toString(),
          timestamp: new Date(),
        };
        
        // التحقق من التنبيهات المكررة
        const isDuplicate = await isDuplicateAlert(alert);
        if (!isDuplicate) {
          alert.hash = generateAlertHash(alert);
          alerts.push(alert);
          await logAlert(alert);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
        errors.push(`خطأ في معالجة المنتج ${product.name}: ${errorMessage}`);
      }
    }
    
    return {
      success: true,
      alerts,
      count: alerts.length,
      errors,
      duration: Date.now() - startTime,
      timestamp: new Date(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
    errors.push(`خطأ عام في checkLowStock: ${errorMessage}`);
    
    // إرسال تنبيه للمسؤولين عن الخطأ
    await notifyOwner({
      title: '❌ خطأ في نظام مراقبة المخزون',
      content: `فشل نظام مراقبة المخزون: ${errorMessage}`,
    }).catch(console.error);
    
    return {
      success: false,
      alerts: [],
      count: 0,
      errors,
      duration: Date.now() - startTime,
      timestamp: new Date(),
    };
  }
}

/**
 * مراقبة المنتجات قريبة الانتهاء مع معالجة أخطاء شاملة
 */
export async function checkExpiringProducts(daysWarning: number = 30): Promise<MonitoringResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const alerts: MonitoringAlert[] = [];
  
  try {
    // التحقق من صحة المدخلات
    if (daysWarning < 1 || daysWarning > 365) {
      errors.push('عدد الأيام غير صحيح (يجب أن يكون بين 1 و 365)');
      daysWarning = 30;
    }
    
    const { result: expiringBatches, success } = await retryWithExponentialBackoff(
      () => db.getExpiringProductBatches(daysWarning),
      3,
      500
    );
    
    if (!success || !expiringBatches) {
      errors.push('فشل في جلب الدفعات قريبة الانتهاء');
      return {
        success: false,
        alerts: [],
        count: 0,
        errors,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
    
    for (const batch of expiringBatches) {
      try {
        // التحقق من صحة البيانات
        if (!batch.id || !batch.batchNumber) {
          errors.push('بيانات غير صحيحة للدفعة');
          continue;
        }
        
        // حساب الأيام المتبقية مع معالجة الأخطاء
        let daysLeft = 0;
        if (batch.expiryDate) {
          try {
            const expiryTime = new Date(batch.expiryDate).getTime();
            const currentTime = Date.now();
            
            // التحقق من صحة التاريخ
            if (isNaN(expiryTime)) {
              errors.push(`تاريخ انتهاء غير صحيح للدفعة ${batch.batchNumber}`);
              continue;
            }
            
            daysLeft = Math.ceil((expiryTime - currentTime) / (1000 * 60 * 60 * 24));
          } catch (error) {
            errors.push(`خطأ في حساب تاريخ الانتهاء للدفعة ${batch.batchNumber}`);
            continue;
          }
        }
        
        const alert: MonitoringAlert = {
          alertType: 'expiring_product',
          severity: daysLeft <= 7 ? 'critical' : daysLeft <= 14 ? 'warning' : 'info',
          title: `تنبيه: منتج قريب الانتهاء - دفعة ${batch.batchNumber}`,
          message: `تاريخ الانتهاء: ${batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString('ar-SA') : 'غير محدد'} (${daysLeft} يوم متبقي)`,
          entityType: 'product_batch',
          entityId: batch.id,
          entityName: batch.batchNumber,
          currentValue: daysLeft.toString(),
          thresholdValue: daysWarning.toString(),
          timestamp: new Date(),
        };
        
        const isDuplicate = await isDuplicateAlert(alert);
        if (!isDuplicate) {
          alert.hash = generateAlertHash(alert);
          alerts.push(alert);
          await logAlert(alert);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
        errors.push(`خطأ في معالجة الدفعة: ${errorMessage}`);
      }
    }
    
    return {
      success: true,
      alerts,
      count: alerts.length,
      errors,
      duration: Date.now() - startTime,
      timestamp: new Date(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
    errors.push(`خطأ عام في checkExpiringProducts: ${errorMessage}`);
    
    await notifyOwner({
      title: '❌ خطأ في نظام مراقبة انتهاء الصلاحية',
      content: `فشل نظام مراقبة انتهاء الصلاحية: ${errorMessage}`,
    }).catch(console.error);
    
    return {
      success: false,
      alerts: [],
      count: 0,
      errors,
      duration: Date.now() - startTime,
      timestamp: new Date(),
    };
  }
}

/**
 * مراقبة العمليات المالية الكبيرة مع معالجة أخطاء شاملة
 */
export async function checkLargeTransactions(threshold: number = 10000): Promise<MonitoringResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const alerts: MonitoringAlert[] = [];
  
  try {
    // التحقق من صحة المدخلات
    if (threshold < 0) {
      errors.push('الحد الأدنى للعملية الكبيرة لا يمكن أن يكون سالباً');
      threshold = 10000;
    }
    
    // حساب التاريخ بشكل صحيح مع المنطقة الزمنية
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { result: recentInvoices, success } = await retryWithExponentialBackoff(
      () => db.getInvoicesByDateRange(yesterday, today),
      3,
      500
    );
    
    if (!success || !recentInvoices) {
      errors.push('فشل في جلب الفواتير');
      return {
        success: false,
        alerts: [],
        count: 0,
        errors,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
    
    for (const invoice of recentInvoices) {
      try {
        // التحقق من صحة البيانات
        if (!invoice.id || !invoice.invoiceNumber) {
          errors.push('بيانات غير صحيحة للفاتورة');
          continue;
        }
        
        // تحويل القيمة إلى رقم مع معالجة الأخطاء
        let total = 0;
        try {
          total = parseFloat(invoice.total || '0');
          
          // التحقق من أن الناتج ليس NaN
          if (isNaN(total)) {
            errors.push(`قيمة غير صحيحة للفاتورة ${invoice.invoiceNumber}`);
            continue;
          }
        } catch (error) {
          errors.push(`خطأ في تحويل قيمة الفاتورة ${invoice.invoiceNumber}`);
          continue;
        }
        
        if (total >= threshold) {
          const alert: MonitoringAlert = {
            alertType: 'large_transaction',
            severity: total >= threshold * 2 ? 'critical' : 'warning',
            title: `تنبيه: عملية مالية كبيرة - فاتورة ${invoice.invoiceNumber}`,
            message: `قيمة الفاتورة: ${formatCurrency(total)} (أكبر من الحد ${formatCurrency(threshold)})`,
            entityType: 'invoice',
            entityId: invoice.id,
            entityName: invoice.invoiceNumber,
            currentValue: total.toString(),
            thresholdValue: threshold.toString(),
            timestamp: new Date(),
          };
          
          const isDuplicate = await isDuplicateAlert(alert);
          if (!isDuplicate) {
            alert.hash = generateAlertHash(alert);
            alerts.push(alert);
            await logAlert(alert);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
        errors.push(`خطأ في معالجة الفاتورة: ${errorMessage}`);
      }
    }
    
    return {
      success: true,
      alerts,
      count: alerts.length,
      errors,
      duration: Date.now() - startTime,
      timestamp: new Date(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
    errors.push(`خطأ عام في checkLargeTransactions: ${errorMessage}`);
    
    await notifyOwner({
      title: '❌ خطأ في نظام مراقبة العمليات المالية',
      content: `فشل نظام مراقبة العمليات المالية الكبيرة: ${errorMessage}`,
    }).catch(console.error);
    
    return {
      success: false,
      alerts: [],
      count: 0,
      errors,
      duration: Date.now() - startTime,
      timestamp: new Date(),
    };
  }
}

/**
 * تنفيذ المهام المجدولة مع Retry Logic
 */
export async function executeScheduledTask(task: any): Promise<TaskExecutionResult> {
  const startTime = Date.now();
  let emailsSent = 0;
  let message = '';
  const errors: string[] = [];
  let retryCount = 0;
  
  try {
    const recipients = task.recipientEmails?.split(',').map((e: string) => e.trim()).filter(Boolean) || ['info@symbolai.net'];
    
    // التحقق من صحة المستقبلين
    if (recipients.length === 0) {
      errors.push('لا توجد عناوين بريد صحيحة');
      return { success: false, message: 'فشل: لا توجد عناوين بريد', emailsSent: 0, errors, duration: Date.now() - startTime, retryCount };
    }
    
    switch (task.taskType) {
      case 'weekly_report':
        for (const email of recipients) {
          const { result, success, attempts } = await retryWithExponentialBackoff(
            () => sendWeeklyReport(email),
            3,
            1000
          );
          retryCount += attempts;
          if (success && result?.success) emailsSent++;
          else errors.push(`فشل إرسال التقرير الأسبوعي إلى ${email}`);
        }
        message = `تم إرسال التقرير الأسبوعي إلى ${emailsSent} مستلم`;
        break;
        
      case 'daily_stock_alert':
        for (const email of recipients) {
          const { result, success, attempts } = await retryWithExponentialBackoff(
            () => sendLowStockAlert(email),
            3,
            1000
          );
          retryCount += attempts;
          if (success && result?.success) emailsSent++;
          else errors.push(`فشل إرسال تنبيه المخزون إلى ${email}`);
        }
        message = `تم إرسال تنبيه المخزون إلى ${emailsSent} مستلم`;
        break;
        
      case 'monthly_profit_report':
        for (const email of recipients) {
          const { result, success, attempts } = await retryWithExponentialBackoff(
            () => sendMonthlyProfitReport(email),
            3,
            1000
          );
          retryCount += attempts;
          if (success && result?.success) emailsSent++;
          else errors.push(`فشل إرسال تقرير الأرباح إلى ${email}`);
        }
        message = `تم إرسال تقرير الأرباح الشهري إلى ${emailsSent} مستلم`;
        break;
        
      default:
        message = 'نوع المهمة غير معروف';
        errors.push(`نوع مهمة غير معروف: ${task.taskType}`);
        return { success: false, message, emailsSent: 0, errors, duration: Date.now() - startTime, retryCount };
    }
    
    // تسجيل التنفيذ
    try {
      await db.createTaskExecutionLog({
        taskId: task.id,
        taskName: task.name,
        taskType: task.taskType,
        status: 'success',
        message,
        emailsSent,
        recipientList: recipients.join(', '),
        duration: Math.round((Date.now() - startTime) / 1000),
        metadata: JSON.stringify({ errorCount: errors.length, retryCount }),
      });
      
      await db.updateScheduledTaskLastRun(task.id, 'success', message);
    } catch (logError) {
      console.error('خطأ في تسجيل تنفيذ المهمة:', logError);
    }
    
    return { success: true, message, emailsSent, errors, duration: Date.now() - startTime, retryCount };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
    errors.push(`خطأ عام في تنفيذ المهمة: ${errorMessage}`);
    
    try {
      await db.createTaskExecutionLog({
        taskId: task.id,
        taskName: task.name,
        taskType: task.taskType,
        status: 'failed',
        message: 'فشل في تنفيذ المهمة',
        errorDetails: errorMessage,
        duration: Math.round((Date.now() - startTime) / 1000),
        metadata: JSON.stringify({ errorCount: errors.length, retryCount }),
      });
      
      await db.updateScheduledTaskLastRun(task.id, 'failed', errorMessage);
    } catch (logError) {
      console.error('خطأ في تسجيل فشل المهمة:', logError);
    }
    
    return { success: false, message: errorMessage, emailsSent: 0, errors, duration: Date.now() - startTime, retryCount };
  }
}

export default {
  checkLowStock,
  checkExpiringProducts,
  checkLargeTransactions,
  executeScheduledTask,
  DEFAULT_MONITOR_SETTINGS,
};
