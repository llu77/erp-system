import * as db from '../db';
import { sendEmail, getEmailTemplate, formatCurrency, formatNumber } from '../email/emailService';
import { sendWeeklyReport, sendLowStockAlert, sendMonthlyProfitReport } from '../email/scheduledReports';
import * as advancedNotifications from '../notifications/advancedNotificationService';

// أنواع المهام
export type TaskType = 
  | 'weekly_report'
  | 'daily_stock_alert'
  | 'monthly_profit_report'
  | 'expiry_alert'
  | 'large_transaction_alert'
  | 'monthly_inventory_reminder'
  | 'backup'
  | 'custom';

// أنواع التنبيهات
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

// إعدادات المراقبة الافتراضية
export const DEFAULT_MONITOR_SETTINGS = {
  // المخزون
  low_stock_threshold: 10,
  low_stock_alert_enabled: true,
  
  // انتهاء الصلاحية
  expiry_days_warning: 30,
  expiry_alert_enabled: true,
  
  // العمليات المالية الكبيرة
  large_transaction_threshold: 10000,
  large_transaction_alert_enabled: true,
  
  // تغييرات الأسعار
  price_change_threshold: 20, // نسبة مئوية
  price_change_alert_enabled: true,
  
  // محاولات الدخول الفاشلة
  failed_login_threshold: 5,
  failed_login_alert_enabled: true,
  
  // البريد الإلكتروني
  alert_email_enabled: true,
  alert_email_recipients: 'info@symbolai.net',
};

// ==================== دوال المراقبة ====================

// مراقبة المخزون المنخفض
export async function checkLowStock(): Promise<{ alerts: any[]; count: number }> {
  const lowStockProducts = await db.getLowStockProducts();
  const alerts: any[] = [];
  
  for (const product of lowStockProducts) {
    const alert = {
      alertType: 'low_stock' as AlertType,
      severity: product.quantity <= 0 ? 'critical' : 'warning' as AlertSeverity,
      title: `تنبيه: مخزون منخفض - ${product.name}`,
      message: `الكمية الحالية (${product.quantity}) أقل من الحد الأدنى (${product.minQuantity})`,
      entityType: 'product',
      entityId: product.id,
      entityName: product.name,
      currentValue: product.quantity.toString(),
      thresholdValue: product.minQuantity.toString(),
    };
    alerts.push(alert);
  }
  
  return { alerts, count: alerts.length };
}

// مراقبة المنتجات قريبة الانتهاء
export async function checkExpiringProducts(daysWarning: number = 30): Promise<{ alerts: any[]; count: number }> {
  const expiringBatches = await db.getExpiringProductBatches(daysWarning);
  const alerts: any[] = [];
  
  for (const batch of expiringBatches) {
    const daysLeft = batch.expiryDate 
      ? Math.ceil((new Date(batch.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 0;
    
    const alert = {
      alertType: 'expiring_product' as AlertType,
      severity: daysLeft <= 7 ? 'critical' : daysLeft <= 14 ? 'warning' : 'info' as AlertSeverity,
      title: `تنبيه: منتج قريب الانتهاء - دفعة ${batch.batchNumber}`,
      message: `تاريخ الانتهاء: ${batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString('ar-SA') : 'غير محدد'} (${daysLeft} يوم متبقي)`,
      entityType: 'product_batch',
      entityId: batch.id,
      entityName: batch.batchNumber,
      currentValue: daysLeft.toString(),
      thresholdValue: daysWarning.toString(),
    };
    alerts.push(alert);
  }
  
  return { alerts, count: alerts.length };
}

// مراقبة العمليات المالية الكبيرة
export async function checkLargeTransactions(threshold: number = 10000): Promise<{ alerts: any[]; count: number }> {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  
  const recentInvoices = await db.getInvoicesByDateRange(yesterday, today);
  const alerts: any[] = [];
  
  for (const invoice of recentInvoices) {
    const total = parseFloat(invoice.total || '0');
    if (total >= threshold) {
      const alert = {
        alertType: 'large_transaction' as AlertType,
        severity: total >= threshold * 2 ? 'critical' : 'warning' as AlertSeverity,
        title: `تنبيه: عملية مالية كبيرة - فاتورة ${invoice.invoiceNumber}`,
        message: `قيمة الفاتورة: ${formatCurrency(total)} (أكبر من الحد ${formatCurrency(threshold)})`,
        entityType: 'invoice',
        entityId: invoice.id,
        entityName: invoice.invoiceNumber,
        currentValue: total.toString(),
        thresholdValue: threshold.toString(),
      };
      alerts.push(alert);
    }
  }
  
  return { alerts, count: alerts.length };
}

// ==================== تنفيذ المهام المجدولة ====================

export async function executeScheduledTask(task: any): Promise<{ success: boolean; message: string; emailsSent?: number }> {
  const startTime = Date.now();
  let emailsSent = 0;
  let message = '';
  
  try {
    const recipients = task.recipientEmails?.split(',').map((e: string) => e.trim()).filter(Boolean) || ['info@symbolai.net'];
    
    switch (task.taskType) {
      case 'weekly_report':
        for (const email of recipients) {
          const result = await sendWeeklyReport(email);
          if (result.success) emailsSent++;
        }
        message = `تم إرسال التقرير الأسبوعي إلى ${emailsSent} مستلم`;
        break;
        
      case 'daily_stock_alert':
        for (const email of recipients) {
          const result = await sendLowStockAlert(email);
          if (result.success) emailsSent++;
        }
        message = `تم إرسال تنبيه المخزون إلى ${emailsSent} مستلم`;
        break;
        
      case 'monthly_profit_report':
        for (const email of recipients) {
          const result = await sendMonthlyProfitReport(email);
          if (result.success) emailsSent++;
        }
        message = `تم إرسال تقرير الأرباح الشهري إلى ${emailsSent} مستلم`;
        break;
        
      case 'expiry_alert':
        const expiryCheck = await checkExpiringProducts(30);
        if (expiryCheck.count > 0) {
          const html = generateExpiryAlertEmail(expiryCheck.alerts);
          for (const email of recipients) {
            const result = await sendEmail({
              to: email,
              subject: `⏰ تنبيه انتهاء صلاحية - Symbol AI - ${new Date().toLocaleDateString('ar-SA')}`,
              html: getEmailTemplate(html, 'تنبيه انتهاء الصلاحية'),
            });
            if (result.success) emailsSent++;
          }
        }
        message = `تم فحص ${expiryCheck.count} منتج قريب الانتهاء وإرسال ${emailsSent} إشعار`;
        break;
        
      case 'large_transaction_alert':
        const transactionCheck = await checkLargeTransactions(parseFloat(task.thresholdValue || '10000'));
        if (transactionCheck.count > 0) {
          const html = generateLargeTransactionEmail(transactionCheck.alerts);
          for (const email of recipients) {
            const result = await sendEmail({
              to: email,
              subject: `💰 تنبيه عمليات مالية كبيرة - Symbol AI - ${new Date().toLocaleDateString('ar-SA')}`,
              html: getEmailTemplate(html, 'تنبيه عمليات مالية'),
            });
            if (result.success) emailsSent++;
          }
        }
        message = `تم فحص ${transactionCheck.count} عملية مالية كبيرة وإرسال ${emailsSent} إشعار`;
        break;
        
      case 'monthly_inventory_reminder':
        // تذكير الجرد الشهري (يوم 27)
        const reminderResult = await advancedNotifications.sendMonthlyInventoryReminder();
        emailsSent = reminderResult.result?.sentCount || 0;
        message = `تم إرسال تذكير الجرد الشهري إلى ${emailsSent} مستلم`;
        break;
        
      default:
        message = 'نوع المهمة غير معروف';
        return { success: false, message };
    }
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    // تسجيل التنفيذ
    await db.createTaskExecutionLog({
      taskId: task.id,
      taskName: task.name,
      taskType: task.taskType,
      status: 'success',
      message,
      emailsSent,
      recipientList: recipients.join(', '),
      duration,
    });
    
    // تحديث المهمة
    await db.updateScheduledTaskLastRun(task.id, 'success', message);
    
    return { success: true, message, emailsSent };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
    
    // تسجيل الخطأ
    await db.createTaskExecutionLog({
      taskId: task.id,
      taskName: task.name,
      taskType: task.taskType,
      status: 'failed',
      message: 'فشل في تنفيذ المهمة',
      errorDetails: errorMessage,
      duration: Math.round((Date.now() - startTime) / 1000),
    });
    
    // تحديث المهمة
    await db.updateScheduledTaskLastRun(task.id, 'failed', errorMessage);
    
    return { success: false, message: errorMessage };
  }
}

// ==================== قوالب البريد ====================

function generateExpiryAlertEmail(alerts: any[]): string {
  return `
    <div class="section">
      <div class="section-title">⏰ منتجات قريبة الانتهاء (${alerts.length})</div>
      <table>
        <thead>
          <tr>
            <th>الدفعة</th>
            <th>الأيام المتبقية</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
          ${alerts.map(a => `
            <tr>
              <td>${a.entityName}</td>
              <td>${a.currentValue} يوم</td>
              <td class="${a.severity === 'critical' ? 'negative' : a.severity === 'warning' ? 'warning' : ''}">${
                a.severity === 'critical' ? 'حرج' : a.severity === 'warning' ? 'تحذير' : 'معلومات'
              }</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function generateLargeTransactionEmail(alerts: any[]): string {
  return `
    <div class="section">
      <div class="section-title">💰 عمليات مالية كبيرة (${alerts.length})</div>
      <table>
        <thead>
          <tr>
            <th>رقم الفاتورة</th>
            <th>القيمة</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
          ${alerts.map(a => `
            <tr>
              <td>${a.entityName}</td>
              <td>${formatCurrency(parseFloat(a.currentValue))}</td>
              <td class="${a.severity === 'critical' ? 'negative' : 'warning'}">${
                a.severity === 'critical' ? 'كبيرة جداً' : 'كبيرة'
              }</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ==================== تشغيل المراقبة الدورية ====================

export async function runSystemMonitor(): Promise<{
  lowStock: { alerts: any[]; count: number };
  expiring: { alerts: any[]; count: number };
  largeTransactions: { alerts: any[]; count: number };
  totalAlerts: number;
}> {
  const lowStock = await checkLowStock();
  const expiring = await checkExpiringProducts(30);
  const largeTransactions = await checkLargeTransactions(10000);
  
  const totalAlerts = lowStock.count + expiring.count + largeTransactions.count;
  
  // حفظ التنبيهات في قاعدة البيانات
  for (const alert of [...lowStock.alerts, ...expiring.alerts, ...largeTransactions.alerts]) {
    await db.createSystemAlert(alert);
  }
  
  return {
    lowStock,
    expiring,
    largeTransactions,
    totalAlerts,
  };
}

// حساب وقت التشغيل التالي
export function calculateNextRunTime(task: any): Date {
  const now = new Date();
  const next = new Date();
  
  switch (task.frequency) {
    case 'hourly':
      next.setHours(now.getHours() + 1, task.minute, 0, 0);
      break;
      
    case 'daily':
      next.setDate(now.getDate() + 1);
      next.setHours(task.hour, task.minute, 0, 0);
      break;
      
    case 'weekly':
      const daysUntilTarget = (task.dayOfWeek - now.getDay() + 7) % 7 || 7;
      next.setDate(now.getDate() + daysUntilTarget);
      next.setHours(task.hour, task.minute, 0, 0);
      break;
      
    case 'monthly':
      next.setMonth(now.getMonth() + 1);
      next.setDate(task.dayOfMonth || 1);
      next.setHours(task.hour, task.minute, 0, 0);
      break;
      
    default:
      next.setDate(now.getDate() + 1);
      next.setHours(task.hour, task.minute, 0, 0);
  }
  
  return next;
}
