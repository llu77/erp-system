/**
 * خدمة التقارير الذكية والأتمتة
 * Symbol AI - نظام إدارة الأعمال
 * 
 * تتضمن:
 * - تقارير أداء تلقائية (أسبوعية/شهرية)
 * - كشف الشذوذ في البيانات المالية
 * - تنبيهات ذكية للمهام المتأخرة
 */

import * as db from '../db';
import { sendEmail } from '../email/emailService';
import { getBaseTemplate } from '../notifications/emailTemplates';

// ==================== أنواع البيانات ====================

interface PerformanceMetrics {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  revenueGrowth: number;
  expenseGrowth: number;
  topBranch: { name: string; revenue: number };
  bottomBranch: { name: string; revenue: number };
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  expiringDocuments: number;
}

interface AnomalyAlert {
  type: 'revenue_drop' | 'expense_spike' | 'unusual_pattern' | 'missing_data';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: string;
  branchName?: string;
  amount?: number;
  threshold?: number;
}

interface TaskReminder {
  taskId: number;
  taskType: string;
  assigneeName: string;
  assigneeEmail: string;
  dueDate: Date;
  daysOverdue: number;
  description: string;
}

// ==================== دوال المساعدة ====================

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('ar-SA', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + ' ر.س';
};

const formatPercentage = (value: number): string => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// ==================== تحليل الأداء ====================

/**
 * حساب مؤشرات الأداء للفترة المحددة
 */
export async function calculatePerformanceMetrics(
  startDate: string,
  endDate: string
): Promise<PerformanceMetrics> {
  // جلب البيانات من قاعدة البيانات
  const branches = await db.getBranches();
  let totalRevenue = 0;
  let totalExpenses = 0;
  let topBranch = { name: '', revenue: 0 };
  let bottomBranch = { name: '', revenue: Infinity };

  for (const branch of branches) {
    const branchRevenueData = await db.getActualRevenues(new Date(startDate), new Date(endDate), branch.id);
    const branchExpensesData = await db.getActualExpenses(new Date(startDate), new Date(endDate), branch.id);
    const branchRevenue = branchRevenueData.totalRevenue;
    const branchExpenses = branchExpensesData.totalExpenses;
    
    totalRevenue += branchRevenue;
    totalExpenses += branchExpenses;

    if (branchRevenue > topBranch.revenue) {
      topBranch = { name: branch.name, revenue: branchRevenue };
    }
    if (branchRevenue < bottomBranch.revenue && branchRevenue > 0) {
      bottomBranch = { name: branch.name, revenue: branchRevenue };
    }
  }

  // حساب الفترة السابقة للمقارنة
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);
  const periodDays = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));
  
  const prevEndDate = new Date(startDateObj);
  prevEndDate.setDate(prevEndDate.getDate() - 1);
  const prevStartDate = new Date(prevEndDate);
  prevStartDate.setDate(prevStartDate.getDate() - periodDays);

  let prevTotalRevenue = 0;
  let prevTotalExpenses = 0;

  for (const branch of branches) {
    const prevRevenueData = await db.getActualRevenues(new Date(prevStartDate), new Date(prevEndDate), branch.id);
    const prevExpensesData = await db.getActualExpenses(new Date(prevStartDate), new Date(prevEndDate), branch.id);
    prevTotalRevenue += prevRevenueData.totalRevenue;
    prevTotalExpenses += prevExpensesData.totalExpenses;
  }

  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const revenueGrowth = prevTotalRevenue > 0 
    ? ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100 
    : 0;
  const expenseGrowth = prevTotalExpenses > 0 
    ? ((totalExpenses - prevTotalExpenses) / prevTotalExpenses) * 100 
    : 0;

  // جلب إحصائيات الطلبات
  const allRequests = await db.getAllEmployeeRequests();
  const requestStats = {
    pending: allRequests.filter((r: any) => r.status === 'pending').length,
    approved: allRequests.filter((r: any) => r.status === 'approved').length,
    rejected: allRequests.filter((r: any) => r.status === 'rejected').length,
  };

  // جلب الوثائق المنتهية
  const expiringDocsData = await db.getEmployeesWithExpiringDocuments();
  const expiringDocs = expiringDocsData.summary.totalExpiring + expiringDocsData.summary.totalExpired;

  return {
    totalRevenue,
    totalExpenses,
    netProfit,
    profitMargin,
    revenueGrowth,
    expenseGrowth,
    topBranch,
    bottomBranch: bottomBranch.revenue === Infinity ? { name: '-', revenue: 0 } : bottomBranch,
    pendingRequests: requestStats.pending || 0,
    approvedRequests: requestStats.approved || 0,
    rejectedRequests: requestStats.rejected || 0,
    expiringDocuments: expiringDocs,
  };
}

// ==================== كشف الشذوذ ====================

/**
 * كشف الشذوذ في البيانات المالية
 */
export async function detectAnomalies(
  startDate: string,
  endDate: string
): Promise<AnomalyAlert[]> {
  const alerts: AnomalyAlert[] = [];
  const branches = await db.getBranches();

  // حساب المتوسطات التاريخية
  const historicalDays = 90;
  const histEndDate = new Date(startDate);
  histEndDate.setDate(histEndDate.getDate() - 1);
  const histStartDate = new Date(histEndDate);
  histStartDate.setDate(histStartDate.getDate() - historicalDays);

  for (const branch of branches) {
    // إيرادات الفترة الحالية
    const currentRevenueData = await db.getActualRevenues(new Date(startDate), new Date(endDate), branch.id);
    const currentRevenue = currentRevenueData.totalRevenue;
    
    // إيرادات الفترة التاريخية
    const histRevenueData = await db.getActualRevenues(histStartDate, histEndDate, branch.id);
    const histRevenue = histRevenueData.totalRevenue;

    // حساب المتوسط اليومي التاريخي
    const avgDailyRevenue = histRevenue / historicalDays;
    const periodDays = Math.ceil(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    const expectedRevenue = avgDailyRevenue * periodDays;

    // كشف انخفاض الإيرادات (أكثر من 30%)
    if (expectedRevenue > 0 && currentRevenue < expectedRevenue * 0.7) {
      const dropPercentage = ((expectedRevenue - currentRevenue) / expectedRevenue) * 100;
      alerts.push({
        type: 'revenue_drop',
        severity: dropPercentage > 50 ? 'critical' : dropPercentage > 40 ? 'high' : 'medium',
        message: `انخفاض كبير في إيرادات فرع ${branch.name}`,
        details: `انخفضت الإيرادات بنسبة ${dropPercentage.toFixed(1)}% مقارنة بالمتوسط التاريخي`,
        branchName: branch.name,
        amount: currentRevenue,
        threshold: expectedRevenue,
      });
    }

    // كشف ارتفاع المصاريف (أكثر من 50%)
    const expStartDate = new Date(startDate);
    const expEndDate = new Date(endDate);
    const currentExpensesData = await db.getActualExpenses(expStartDate, expEndDate, branch.id);
    const histExpensesData = await db.getActualExpenses(
      histStartDate,
      histEndDate,
      branch.id
    );
    const currentExpensesAmount = currentExpensesData.totalExpenses;
    const histExpensesAmount = histExpensesData.totalExpenses;
    const avgDailyExpenses = histExpensesAmount / historicalDays;
    const expectedExpenses = avgDailyExpenses * periodDays;

    if (expectedExpenses > 0 && currentExpensesAmount > expectedExpenses * 1.5) {
      const spikePercentage = ((currentExpensesAmount - expectedExpenses) / expectedExpenses) * 100;
      alerts.push({
        type: 'expense_spike',
        severity: spikePercentage > 100 ? 'critical' : spikePercentage > 75 ? 'high' : 'medium',
        message: `ارتفاع غير طبيعي في مصاريف فرع ${branch.name}`,
        details: `ارتفعت المصاريف بنسبة ${spikePercentage.toFixed(1)}% مقارنة بالمتوسط التاريخي`,
        branchName: branch.name,
        amount: currentExpensesAmount,
        threshold: expectedExpenses,
      });
    }
  }

  return alerts;
}

// ==================== قوالب البريد ====================

/**
 * قالب تقرير الأداء الأسبوعي
 */
function getWeeklyReportTemplate(
  metrics: PerformanceMetrics,
  alerts: AnomalyAlert[],
  startDate: string,
  endDate: string
): string {
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' || a.severity === 'high');
  
  const content = `
    <div class="header">
      <div class="logo">
        <span class="logo-text">S</span>
      </div>
      <h1>📊 تقرير الأداء الأسبوعي</h1>
      <div class="subtitle">
        الفترة: ${formatDate(new Date(startDate))} - ${formatDate(new Date(endDate))}
      </div>
    </div>
    
    <div class="content">
      <div class="greeting">
        مرحباً،<br>
        إليك ملخص أداء الأعمال للأسبوع الماضي:
      </div>
      
      <!-- ملخص الأداء -->
      <div class="info-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 25px;">
        <div class="info-item" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 20px; border-radius: 12px; text-align: center;">
          <div class="label" style="color: #166534; font-size: 12px;">إجمالي الإيرادات</div>
          <div class="value" style="color: #22c55e; font-size: 24px; font-weight: 700;">${formatCurrency(metrics.totalRevenue)}</div>
          <div style="color: ${metrics.revenueGrowth >= 0 ? '#22c55e' : '#ef4444'}; font-size: 12px; margin-top: 5px;">
            ${formatPercentage(metrics.revenueGrowth)} عن الأسبوع السابق
          </div>
        </div>
        
        <div class="info-item" style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); padding: 20px; border-radius: 12px; text-align: center;">
          <div class="label" style="color: #991b1b; font-size: 12px;">إجمالي المصاريف</div>
          <div class="value" style="color: #ef4444; font-size: 24px; font-weight: 700;">${formatCurrency(metrics.totalExpenses)}</div>
          <div style="color: ${metrics.expenseGrowth <= 0 ? '#22c55e' : '#ef4444'}; font-size: 12px; margin-top: 5px;">
            ${formatPercentage(metrics.expenseGrowth)} عن الأسبوع السابق
          </div>
        </div>
        
        <div class="info-item" style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); padding: 20px; border-radius: 12px; text-align: center;">
          <div class="label" style="color: #1e40af; font-size: 12px;">صافي الربح</div>
          <div class="value" style="color: ${metrics.netProfit >= 0 ? '#3b82f6' : '#ef4444'}; font-size: 24px; font-weight: 700;">${formatCurrency(metrics.netProfit)}</div>
          <div style="color: #64748b; font-size: 12px; margin-top: 5px;">
            هامش الربح: ${metrics.profitMargin.toFixed(1)}%
          </div>
        </div>
        
        <div class="info-item" style="background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%); padding: 20px; border-radius: 12px; text-align: center;">
          <div class="label" style="color: #7c3aed; font-size: 12px;">الطلبات</div>
          <div class="value" style="color: #a855f7; font-size: 24px; font-weight: 700;">${metrics.pendingRequests}</div>
          <div style="color: #64748b; font-size: 12px; margin-top: 5px;">
            طلب قيد الانتظار
          </div>
        </div>
      </div>
      
      <!-- أفضل وأضعف فرع -->
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 25px;">
        <div style="background: #f8fafc; padding: 15px; border-radius: 10px; border-right: 4px solid #22c55e;">
          <div style="font-size: 12px; color: #64748b;">🏆 أفضل فرع</div>
          <div style="font-size: 16px; font-weight: 600; color: #1a1a2e;">${metrics.topBranch.name}</div>
          <div style="font-size: 14px; color: #22c55e;">${formatCurrency(metrics.topBranch.revenue)}</div>
        </div>
        <div style="background: #f8fafc; padding: 15px; border-radius: 10px; border-right: 4px solid #f97316;">
          <div style="font-size: 12px; color: #64748b;">📉 يحتاج تحسين</div>
          <div style="font-size: 16px; font-weight: 600; color: #1a1a2e;">${metrics.bottomBranch.name}</div>
          <div style="font-size: 14px; color: #f97316;">${formatCurrency(metrics.bottomBranch.revenue)}</div>
        </div>
      </div>
      
      ${criticalAlerts.length > 0 ? `
      <!-- تنبيهات هامة -->
      <div class="alert-box" style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border: 1px solid #fecaca; margin-bottom: 25px;">
        <div style="font-weight: 600; color: #991b1b; margin-bottom: 10px;">⚠️ تنبيهات تحتاج انتباهك</div>
        ${criticalAlerts.map(alert => `
          <div style="background: white; padding: 10px; border-radius: 8px; margin-bottom: 8px;">
            <div style="font-weight: 600; color: #1a1a2e;">${alert.message}</div>
            <div style="font-size: 12px; color: #64748b;">${alert.details}</div>
          </div>
        `).join('')}
      </div>
      ` : ''}
      
      <!-- تنبيهات الوثائق -->
      ${metrics.expiringDocuments > 0 ? `
      <div class="alert-box" style="background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%); border: 1px solid #fed7aa;">
        <div style="font-weight: 600; color: #9a3412;">📋 وثائق تحتاج تجديد</div>
        <div style="color: #64748b; margin-top: 5px;">
          يوجد <strong>${metrics.expiringDocuments}</strong> وثيقة ستنتهي خلال 30 يوماً
        </div>
      </div>
      ` : ''}
      
      <div class="divider"></div>
      
      <div style="text-align: center;">
        <a href="#" class="cta-button">عرض التقرير الكامل</a>
      </div>
    </div>
  `;

  return getBaseTemplate(content, 'تقرير الأداء الأسبوعي - Symbol AI');
}

// ==================== إرسال التقارير ====================

/**
 * إرسال تقرير الأداء الأسبوعي
 */
export async function sendWeeklyPerformanceReport(): Promise<{ success: boolean; error?: string }> {
  try {
    // حساب تواريخ الأسبوع الماضي
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 1);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // حساب المؤشرات
    const metrics = await calculatePerformanceMetrics(startDateStr, endDateStr);
    
    // كشف الشذوذ
    const alerts = await detectAnomalies(startDateStr, endDateStr);

    // إنشاء قالب البريد
    const emailContent = getWeeklyReportTemplate(metrics, alerts, startDateStr, endDateStr);

    // جلب قائمة المستلمين (المشرفين والإدارة)
    const recipients = await db.getNotificationRecipients();
    const adminRecipients = recipients.filter(r => 
      r.receiveRevenueAlerts && r.email
    );

    // إرسال البريد
    for (const recipient of adminRecipients) {
      await sendEmail({
        to: recipient.email!,
        subject: `📊 تقرير الأداء الأسبوعي - ${formatDate(startDate)} إلى ${formatDate(endDate)}`,
        html: emailContent,
      });
    }

    console.log(`[SmartReports] Weekly report sent to ${adminRecipients.length} recipients`);
    return { success: true };
  } catch (error) {
    console.error('[SmartReports] Error sending weekly report:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * إرسال تنبيهات الشذوذ الفورية
 */
export async function sendAnomalyAlerts(): Promise<{ success: boolean; alertsSent: number }> {
  try {
    // حساب تواريخ آخر 7 أيام
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // كشف الشذوذ
    const alerts = await detectAnomalies(startDateStr, endDateStr);
    const criticalAlerts = alerts.filter(a => a.severity === 'critical' || a.severity === 'high');

    if (criticalAlerts.length === 0) {
      return { success: true, alertsSent: 0 };
    }

    // إنشاء محتوى التنبيه
    const alertContent = `
      <div class="header">
        <div class="logo">
          <span class="logo-text">S</span>
        </div>
        <h1>⚠️ تنبيهات هامة</h1>
        <div class="subtitle">تم اكتشاف أنماط غير طبيعية في البيانات المالية</div>
      </div>
      
      <div class="content">
        <div class="greeting">
          مرحباً،<br>
          تم اكتشاف التنبيهات التالية التي تحتاج انتباهك الفوري:
        </div>
        
        ${criticalAlerts.map(alert => `
          <div class="alert-box" style="background: ${alert.severity === 'critical' ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)' : 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)'}; border: 1px solid ${alert.severity === 'critical' ? '#fecaca' : '#fed7aa'}; margin-bottom: 15px;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
              <span class="badge ${alert.severity === 'critical' ? 'urgent' : 'high'}">${alert.severity === 'critical' ? 'حرج' : 'عالي'}</span>
              <span style="font-weight: 600; color: #1a1a2e;">${alert.message}</span>
            </div>
            <div style="color: #64748b; font-size: 14px;">${alert.details}</div>
            ${alert.branchName ? `<div style="color: #94a3b8; font-size: 12px; margin-top: 5px;">الفرع: ${alert.branchName}</div>` : ''}
          </div>
        `).join('')}
        
        <div class="divider"></div>
        
        <div style="text-align: center;">
          <a href="#" class="cta-button">مراجعة التفاصيل</a>
        </div>
      </div>
    `;

    const emailHtml = getBaseTemplate(alertContent, 'تنبيهات هامة - Symbol AI');

    // جلب قائمة المستلمين
    const recipients = await db.getNotificationRecipients();
    const adminRecipients = recipients.filter(r => r.receiveRevenueAlerts && r.email);

    // إرسال البريد
    for (const recipient of adminRecipients) {
      await sendEmail({
        to: recipient.email!,
        subject: `⚠️ تنبيهات هامة - ${criticalAlerts.length} تنبيه يحتاج انتباهك`,
        html: emailHtml,
      });
    }

    console.log(`[SmartReports] Anomaly alerts sent to ${adminRecipients.length} recipients`);
    return { success: true, alertsSent: criticalAlerts.length };
  } catch (error) {
    console.error('[SmartReports] Error sending anomaly alerts:', error);
    return { success: false, alertsSent: 0 };
  }
}

export default {
  calculatePerformanceMetrics,
  detectAnomalies,
  sendWeeklyPerformanceReport,
  sendAnomalyAlerts,
};
