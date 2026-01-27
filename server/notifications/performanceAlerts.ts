/**
 * نظام إشعارات تراجع أداء الموظفين
 * يقوم بتحليل أداء الموظفين وإرسال تنبيهات للمشرفين عند تراجع الأداء
 */

import { getDb } from '../db';
import { employees, dailyRevenues, branches, sentNotifications, employeeRevenues } from '../../drizzle/schema';
import { eq, and, gte, lte, sql, inArray } from 'drizzle-orm';
import { sendEmail } from '../email/emailService';
import { notifyOwner } from '../_core/notification';

// حدود تراجع الأداء
const PERFORMANCE_THRESHOLDS = {
  DECLINE_PERCENTAGE: 30,
  MIN_COMPARISON_DAYS: 7,
  CURRENT_PERIOD_DAYS: 7,
  PREVIOUS_PERIOD_DAYS: 7,
};

interface EmployeePerformance {
  employeeId: number;
  employeeName: string;
  employeeCode: string;
  branchId: number;
  branchName: string;
  currentRevenue: number;
  previousRevenue: number;
  declinePercentage: number;
  currentDays: number;
  previousDays: number;
}

interface SupervisorAlert {
  supervisorId: number;
  supervisorName: string;
  supervisorEmail: string | null;
  branchId: number;
  branchName: string;
  declinedEmployees: EmployeePerformance[];
}

/**
 * تحليل أداء الموظفين ومقارنة الفترة الحالية بالسابقة
 */
export async function analyzeEmployeePerformance(branchId?: number): Promise<EmployeePerformance[]> {
  const db = await getDb();
  if (!db) return [];

  const today = new Date();
  const currentPeriodStart = new Date(today);
  currentPeriodStart.setDate(today.getDate() - PERFORMANCE_THRESHOLDS.CURRENT_PERIOD_DAYS);
  
  const previousPeriodEnd = new Date(currentPeriodStart);
  previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1);
  
  const previousPeriodStart = new Date(previousPeriodEnd);
  previousPeriodStart.setDate(previousPeriodEnd.getDate() - PERFORMANCE_THRESHOLDS.PREVIOUS_PERIOD_DAYS);

  try {
    // جلب الموظفين النشطين
    const whereConditions = branchId 
      ? and(eq(employees.isActive, true), eq(employees.branchId, branchId))
      : eq(employees.isActive, true);

    const activeEmployees = await db
      .select({
        id: employees.id,
        name: employees.name,
        code: employees.code,
        branchId: employees.branchId,
      })
      .from(employees)
      .where(whereConditions);

    const employeeIds = activeEmployees.map((e: {id: number}) => e.id);
    if (employeeIds.length === 0) return [];

    // جلب إيرادات الفترة الحالية
    const currentRevenueData: Array<{employeeId: number; totalRevenue: string; daysCount: number}> = await db
      .select({
        employeeId: employeeRevenues.employeeId,
        totalRevenue: sql<string>`SUM(${employeeRevenues.total})`,
        daysCount: sql<number>`COUNT(DISTINCT ${dailyRevenues.date})`,
      })
      .from(employeeRevenues).innerJoin(dailyRevenues, eq(employeeRevenues.dailyRevenueId, dailyRevenues.id))
      .where(and(
        inArray(employeeRevenues.employeeId, employeeIds),
        gte(dailyRevenues.date, currentPeriodStart),
        lte(dailyRevenues.date, today)
      ))
      .groupBy(employeeRevenues.employeeId);

    // جلب إيرادات الفترة السابقة
    const previousRevenueData: Array<{employeeId: number; totalRevenue: string; daysCount: number}> = await db
      .select({
        employeeId: employeeRevenues.employeeId,
        totalRevenue: sql<string>`SUM(${employeeRevenues.total})`,
        daysCount: sql<number>`COUNT(DISTINCT ${dailyRevenues.date})`,
      })
      .from(employeeRevenues).innerJoin(dailyRevenues, eq(employeeRevenues.dailyRevenueId, dailyRevenues.id))
      .where(and(
        inArray(employeeRevenues.employeeId, employeeIds),
        gte(dailyRevenues.date, previousPeriodStart),
        lte(dailyRevenues.date, previousPeriodEnd)
      ))
      .groupBy(employeeRevenues.employeeId);

    // جلب أسماء الفروع
    const branchesData = await db.select().from(branches);
    const branchMap = new Map(branchesData.map((b: {id: number; name: string}) => [b.id, b.name]));

    // تحليل الأداء
    const currentMap = new Map(currentRevenueData.map(r => [r.employeeId, r]));
    const previousMap = new Map(previousRevenueData.map(r => [r.employeeId, r]));

    const declinedEmployees: EmployeePerformance[] = [];

    for (const emp of activeEmployees) {
      const current = currentMap.get(emp.id);
      const previous = previousMap.get(emp.id);

      if (!current || !previous) continue;
      if (current.daysCount < 3 || previous.daysCount < 3) continue;

      const currentAvg = Number(current.totalRevenue) / current.daysCount;
      const previousAvg = Number(previous.totalRevenue) / previous.daysCount;

      if (previousAvg <= 0) continue;

      const declinePercentage = ((previousAvg - currentAvg) / previousAvg) * 100;

      if (declinePercentage >= PERFORMANCE_THRESHOLDS.DECLINE_PERCENTAGE) {
        declinedEmployees.push({
          employeeId: emp.id,
          employeeName: emp.name,
          employeeCode: emp.code,
          branchId: emp.branchId,
          branchName: branchMap.get(emp.branchId) ?? 'غير محدد',
          currentRevenue: Number(current.totalRevenue),
          previousRevenue: Number(previous.totalRevenue),
          declinePercentage: Math.round(declinePercentage * 10) / 10,
          currentDays: current.daysCount,
          previousDays: previous.daysCount,
        });
      }
    }

    return declinedEmployees.sort((a, b) => b.declinePercentage - a.declinePercentage);
  } catch (error) {
    console.error('[PerformanceAlerts] Error analyzing performance:', error);
    return [];
  }
}

/**
 * جلب المشرفين وتجميع التنبيهات حسب الفرع
 */
export async function getSupervisorAlerts(): Promise<SupervisorAlert[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const supervisors = await db
      .select({
        id: employees.id,
        name: employees.name,
        email: employees.email,
        branchId: employees.branchId,
      })
      .from(employees)
      .where(and(
        eq(employees.isSupervisor, true),
        eq(employees.isActive, true)
      ));

    const branchesData = await db.select().from(branches);
    const branchMap = new Map(branchesData.map((b: {id: number; name: string}) => [b.id, b.name]));

    const alerts: SupervisorAlert[] = [];

    for (const supervisor of supervisors) {
      const declinedEmployees = await analyzeEmployeePerformance(supervisor.branchId);
      const filteredEmployees = declinedEmployees.filter(e => e.employeeId !== supervisor.id);

      if (filteredEmployees.length > 0) {
        alerts.push({
          supervisorId: supervisor.id,
          supervisorName: supervisor.name,
          supervisorEmail: supervisor.email,
          branchId: supervisor.branchId,
          branchName: branchMap.get(supervisor.branchId) || 'غير محدد',
          declinedEmployees: filteredEmployees,
        });
      }
    }

    return alerts;
  } catch (error) {
    console.error('[PerformanceAlerts] Error getting supervisor alerts:', error);
    return [];
  }
}

/**
 * إرسال تنبيهات للمشرفين
 */
export async function sendPerformanceAlerts(): Promise<{
  success: boolean;
  alertsSent: number;
  errors: string[];
}> {
  const db = await getDb();
  if (!db) {
    return { success: false, alertsSent: 0, errors: ['قاعدة البيانات غير متاحة'] };
  }

  const errors: string[] = [];
  let alertsSent = 0;

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingAlerts = await db
      .select()
      .from(sentNotifications)
      .where(and(
        eq(sentNotifications.notificationType, 'performance_alert'),
        gte(sentNotifications.sentAt, today)
      ))
      .limit(1);

    if (existingAlerts.length > 0) {
      console.log('[PerformanceAlerts] Alerts already sent today, skipping...');
      return { success: true, alertsSent: 0, errors: [] };
    }

    const alerts = await getSupervisorAlerts();

    for (const alert of alerts) {
      const emailContent = generateAlertEmailContent(alert);

      if (alert.supervisorEmail) {
        try {
          await sendEmail({
            to: alert.supervisorEmail,
            subject: `⚠️ تنبيه: تراجع أداء موظفين في فرع ${alert.branchName}`,
            html: emailContent.html,
            text: emailContent.text,
          });

          await db.insert(sentNotifications).values({
            recipientId: alert.supervisorId,
            recipientEmail: alert.supervisorEmail,
            recipientName: alert.supervisorName,
            notificationType: 'performance_alert',
            subject: `تنبيه تراجع أداء - فرع ${alert.branchName}`,
            bodyArabic: emailContent.text,
            branchId: alert.branchId,
            branchName: alert.branchName,
            status: 'sent',
            sentAt: new Date(),
          });

          alertsSent++;
        } catch (emailError) {
          errors.push(`فشل إرسال البريد للمشرف ${alert.supervisorName}: ${emailError}`);
        }
      }

      try {
        await notifyOwner({
          title: `⚠️ تراجع أداء في فرع ${alert.branchName}`,
          content: `المشرف: ${alert.supervisorName}\nعدد الموظفين المتراجعين: ${alert.declinedEmployees.length}\n\n${alert.declinedEmployees.map(e => `- ${e.employeeName}: تراجع ${e.declinePercentage}%`).join('\n')}`,
        });
      } catch (notifyError) {
        console.error('[PerformanceAlerts] Error notifying owner:', notifyError);
      }
    }

    return { success: true, alertsSent, errors };
  } catch (error) {
    console.error('[PerformanceAlerts] Error sending alerts:', error);
    return { success: false, alertsSent, errors: [`خطأ عام: ${error}`] };
  }
}

/**
 * إنشاء محتوى البريد الإلكتروني للتنبيه
 */
function generateAlertEmailContent(alert: SupervisorAlert): { html: string; text: string } {
  const employeeRows = alert.declinedEmployees
    .map(e => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${e.employeeName}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${e.employeeCode}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; color: #dc2626; font-weight: bold;">${e.declinePercentage}%</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${e.previousRevenue.toLocaleString('ar-SA')} ر.س</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${e.currentRevenue.toLocaleString('ar-SA')} ر.س</td>
      </tr>
    `)
    .join('');

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 700px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .alert-badge { background: #dc2626; color: white; padding: 5px 15px; border-radius: 20px; display: inline-block; margin-top: 10px; }
    .content { padding: 20px; background: #f9fafb; border-radius: 0 0 10px 10px; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; margin: 20px 0; }
    th { background: #1f2937; color: white; padding: 12px; text-align: right; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ تنبيه تراجع الأداء</h1>
      <div class="alert-badge">يتطلب انتباهك</div>
    </div>
    <div class="content">
      <p>السلام عليكم ورحمة الله وبركاته،</p>
      <p><strong>المشرف ${alert.supervisorName}</strong>،</p>
      <p>نود إعلامكم بأن النظام رصد تراجعاً ملحوظاً في أداء بعض موظفي فرع <strong>${alert.branchName}</strong> خلال الأسبوع الماضي.</p>
      
      <h3>📊 الموظفون المتراجعون:</h3>
      <table>
        <thead>
          <tr>
            <th>الموظف</th>
            <th>الكود</th>
            <th>نسبة التراجع</th>
            <th>الفترة السابقة</th>
            <th>الفترة الحالية</th>
          </tr>
        </thead>
        <tbody>
          ${employeeRows}
        </tbody>
      </table>
      
      <h3>💡 توصيات:</h3>
      <ul>
        <li>مراجعة أسباب التراجع مع كل موظف على حدة</li>
        <li>تقديم الدعم والتوجيه اللازم</li>
        <li>متابعة الأداء بشكل يومي خلال الأسبوع القادم</li>
      </ul>
    </div>
    <div class="footer">
      <p>هذا تنبيه آلي من نظام Symbol AI ERP</p>
      <p>تاريخ الإرسال: ${new Date().toLocaleDateString('ar-SA')}</p>
    </div>
  </div>
</body>
</html>`;

  const text = `⚠️ تنبيه تراجع الأداء - فرع ${alert.branchName}

السلام عليكم ورحمة الله وبركاته،

المشرف ${alert.supervisorName}،

نود إعلامكم بأن النظام رصد تراجعاً ملحوظاً في أداء بعض موظفي فرع ${alert.branchName} خلال الأسبوع الماضي.

📊 الموظفون المتراجعون:
${alert.declinedEmployees.map(e => `- ${e.employeeName} (${e.employeeCode}): تراجع ${e.declinePercentage}%`).join('\n')}

💡 توصيات:
- مراجعة أسباب التراجع مع كل موظف على حدة
- تقديم الدعم والتوجيه اللازم
- متابعة الأداء بشكل يومي خلال الأسبوع القادم

---
هذا تنبيه آلي من نظام Symbol AI ERP`;

  return { html, text };
}

/**
 * جلب تنبيهات الأداء لمشرف معين (للاستخدام في المساعد الذكي)
 */
export async function getPerformanceAlertsForSupervisor(supervisorId: number, branchId: number): Promise<{
  hasAlerts: boolean;
  declinedEmployees: EmployeePerformance[];
  summary: string;
}> {
  const declinedEmployees = await analyzeEmployeePerformance(branchId);
  const filteredEmployees = declinedEmployees.filter(e => e.employeeId !== supervisorId);
  
  if (filteredEmployees.length === 0) {
    return {
      hasAlerts: false,
      declinedEmployees: [],
      summary: 'لا توجد تنبيهات تراجع أداء حالياً. جميع الموظفين يحافظون على مستوى أدائهم.',
    };
  }

  const summary = `⚠️ تنبيه: ${filteredEmployees.length} موظف(ين) يظهرون تراجعاً في الأداء خلال الأسبوع الماضي:\n\n` +
    filteredEmployees.map((e, i) => 
      `${i + 1}. ${e.employeeName} (${e.employeeCode}): تراجع ${e.declinePercentage}%`
    ).join('\n') +
    '\n\nيُنصح بمراجعة أسباب التراجع وتقديم الدعم اللازم.';

  return {
    hasAlerts: true,
    declinedEmployees: filteredEmployees,
    summary,
  };
}
