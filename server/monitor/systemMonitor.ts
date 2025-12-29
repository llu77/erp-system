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
        // تذكير الجرد الشهري - يستخدم النظام الموحد
        const { checkAndSendScheduledReminders } = await import('../notifications/scheduledNotificationService');
        const scheduledResult = await checkAndSendScheduledReminders();
        emailsSent = scheduledResult.inventoryResult?.sentCount || 0;
        if (scheduledResult.inventoryResult?.skipped) {
          message = `تم تخطي تذكير الجرد - أُرسل مسبقاً اليوم`;
        } else {
          message = `تم إرسال تذكير الجرد الشهري إلى ${emailsSent} مستلم`;
        }
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


// ==================== تذكير الإيرادات غير المسجلة ====================

export async function checkAndSendMissingRevenueReminders(): Promise<{
  checked: number;
  missing: number;
  sent: number;
  errors: string[];
}> {
  const result = {
    checked: 0,
    missing: 0,
    sent: 0,
    errors: [] as string[],
  };

  try {
    // الحصول على جميع الفروع
    const branches = await db.getBranches();
    result.checked = branches.length;

    // تحديد تاريخ أمس
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // الحصول على مستلمي الإشعارات
    const recipients = await db.getNotificationRecipients(null);

    const missingBranches: { branchId: number; branchName: string }[] = [];

    // فحص كل فرع
    for (const branch of branches) {
      const revenue = await db.getDailyRevenueByDate(branch.id, new Date(yesterdayStr));
      if (!revenue) {
        missingBranches.push({ branchId: branch.id, branchName: branch.nameAr });
      }
    }

    result.missing = missingBranches.length;

    if (missingBranches.length === 0) {
      console.log('✅ جميع الفروع سجلت إيراداتها');
      return result;
    }

    // إرسال تذكيرات
    for (const missing of missingBranches) {
      // إيجاد المشرفين المسؤولين
      const branchRecipients = recipients.filter(
        (r: any) => r.branchId === missing.branchId || r.role === 'admin' || r.role === 'general_supervisor'
      );

      for (const recipient of branchRecipients) {
        try {
          await advancedNotifications.sendAdvancedNotification({
            type: 'missing_revenue',
            branchId: missing.branchId,
            branchName: missing.branchName,
            date: yesterdayStr,
            amount: 0,
          });
          result.sent++;
        } catch (error) {
          result.errors.push(`${recipient.email}: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
        }
      }
    }

    return result;
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'خطأ غير معروف');
    return result;
  }
}

// ==================== التقرير الأسبوعي للمشرفين ====================

export async function generateSupervisorWeeklyReport(branchId: number): Promise<string> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekAgoStr = weekAgo.toISOString().split('T')[0];
  const nowStr = now.toISOString().split('T')[0];

  // الحصول على بيانات الفرع
  const branch = await db.getBranchById(branchId);
  const branchName = branch?.nameAr || 'غير محدد';

  // الحصول على الإيرادات اليومية
  const revenues = await db.getDailyRevenuesByDateRange(branchId, weekAgoStr, nowStr);
  
  // حساب إجمالي الإيرادات
  let totalCash = 0;
  let totalNetwork = 0;
  let totalBalance = 0;
  let matchedDays = 0;
  let unmatchedDays = 0;

  for (const rev of revenues) {
    totalCash += parseFloat(rev.cash || '0');
    totalNetwork += parseFloat(rev.network || '0');
    totalBalance += parseFloat(rev.balance || '0');
    if (rev.isMatched) {
      matchedDays++;
    } else {
      unmatchedDays++;
    }
  }

  const totalRevenue = totalCash + totalNetwork;

  // الحصول على المصاريف
  const weekAgoStr2 = weekAgo.toISOString().split('T')[0];
  const nowStr2 = now.toISOString().split('T')[0];
  const allExpenses = await db.getExpensesByDateRange(weekAgoStr2, nowStr2);
  const expenses = allExpenses.filter((e: any) => e.branchId === branchId);
  let totalExpenses = 0;
  const expensesByCategory: { [key: string]: number } = {};

  for (const exp of expenses) {
    const amount = parseFloat(exp.amount || '0');
    totalExpenses += amount;
    const category = exp.category || 'أخرى';
    expensesByCategory[category] = (expensesByCategory[category] || 0) + amount;
  }

  // إنشاء التقرير
  const content = `
    <div style="direction: rtl; font-family: 'Segoe UI', Tahoma, sans-serif;">
      <h2 style="color: #1a1a2e; border-bottom: 2px solid #00d4ff; padding-bottom: 10px;">
        📊 التقرير الأسبوعي - ${branchName}
      </h2>
      <p style="color: #666;">الفترة: ${weekAgoStr} إلى ${nowStr}</p>

      <div style="background: #f8f9fa; border-radius: 10px; padding: 20px; margin: 20px 0;">
        <h3 style="color: #1a1a2e; margin-top: 0;">💰 ملخص الإيرادات</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>إجمالي النقدي</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd; color: #27ae60;">${formatCurrency(totalCash)}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>إجمالي الشبكة</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd; color: #27ae60;">${formatCurrency(totalNetwork)}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>إجمالي الموازنة</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${formatCurrency(totalBalance)}</td>
          </tr>
          <tr style="background: #e9ecef;">
            <td style="padding: 10px;"><strong>الإجمالي الكلي</strong></td>
            <td style="padding: 10px; color: #27ae60; font-size: 18px;"><strong>${formatCurrency(totalRevenue)}</strong></td>
          </tr>
        </table>
        <p style="margin-top: 15px;">
          <span style="color: #27ae60;">✅ ${matchedDays} يوم متطابق</span> | 
          <span style="color: ${unmatchedDays > 0 ? '#e74c3c' : '#27ae60'};">${unmatchedDays > 0 ? '⚠️' : '✅'} ${unmatchedDays} يوم غير متطابق</span>
        </p>
      </div>

      <div style="background: #fff3cd; border-radius: 10px; padding: 20px; margin: 20px 0;">
        <h3 style="color: #856404; margin-top: 0;">📤 ملخص المصاريف</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${Object.entries(expensesByCategory).map(([category, amount]) => `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ffc107;">${category}</td>
              <td style="padding: 8px; border-bottom: 1px solid #ffc107; color: #e74c3c;">${formatCurrency(amount)}</td>
            </tr>
          `).join('')}
          <tr style="background: #ffeeba;">
            <td style="padding: 10px;"><strong>إجمالي المصاريف</strong></td>
            <td style="padding: 10px; color: #e74c3c; font-size: 18px;"><strong>${formatCurrency(totalExpenses)}</strong></td>
          </tr>
        </table>
      </div>

      <div style="background: ${totalRevenue - totalExpenses >= 0 ? '#d4edda' : '#f8d7da'}; border-radius: 10px; padding: 20px; margin: 20px 0;">
        <h3 style="color: ${totalRevenue - totalExpenses >= 0 ? '#155724' : '#721c24'}; margin-top: 0;">📈 صافي الأسبوع</h3>
        <p style="font-size: 24px; text-align: center; color: ${totalRevenue - totalExpenses >= 0 ? '#27ae60' : '#e74c3c'};">
          <strong>${formatCurrency(totalRevenue - totalExpenses)}</strong>
        </p>
      </div>

      <p style="color: #666; font-size: 12px; text-align: center; margin-top: 30px;">
        تم إنشاء هذا التقرير تلقائياً بواسطة Symbol AI
      </p>
    </div>
  `;

  return content;
}

export async function sendSupervisorWeeklyReports(): Promise<{
  total: number;
  sent: number;
  errors: string[];
}> {
  const result = {
    total: 0,
    sent: 0,
    errors: [] as string[],
  };

  try {
    // الحصول على مستلمي الإشعارات
    const recipients = await db.getNotificationRecipients(null);
    result.total = recipients.length;

    // الحصول على الفروع
    const branches = await db.getBranches();
    const branchMap = new Map(branches.map((b: any) => [b.id, b.nameAr]));

    for (const recipient of recipients) {
      try {
        let reportContent = '';
        let branchName = 'جميع الفروع';

        if (recipient.branchId) {
          // مشرف فرع محدد
          reportContent = await generateSupervisorWeeklyReport(recipient.branchId);
          branchName = branchMap.get(recipient.branchId) || 'غير محدد';
        } else {
          // المشرف العام أو الأدمن - تقرير لجميع الفروع
          let allBranchesContent = '';
          for (const branch of branches) {
            allBranchesContent += await generateSupervisorWeeklyReport(branch.id);
            allBranchesContent += '<hr style="margin: 30px 0; border: none; border-top: 2px dashed #ccc;">';
          }
          reportContent = allBranchesContent;
        }

        // إرسال البريد
        await sendEmail({
          to: recipient.email,
          subject: `📊 التقرير الأسبوعي - ${branchName} - ${new Date().toLocaleDateString('ar-SA')}`,
          html: getEmailTemplate(reportContent, 'التقرير الأسبوعي للمشرف'),
        });

        result.sent++;
        console.log(`✓ تم إرسال التقرير الأسبوعي إلى: ${recipient.name} (${recipient.email})`);
      } catch (error) {
        result.errors.push(`${recipient.email}: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
      }
    }

    return result;
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'خطأ غير معروف');
    return result;
  }
}
