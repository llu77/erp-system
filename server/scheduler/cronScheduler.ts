/**
 * نظام جدولة المهام المتقدم باستخدام node-cron
 * =============================================
 * 
 * الميزات:
 * 1. استخدام Cron Expressions للجدولة الدقيقة
 * 2. تسجيل شامل لجميع التنفيذات
 * 3. Dead Letter Queue للمهام الفاشلة
 * 4. واجهة API لإدارة المهام
 * 5. دعم المنطقة الزمنية (السعودية UTC+3)
 */

import cron, { ScheduledTask } from 'node-cron';
import * as db from "../db";
import { sendAdvancedNotification, NotificationType } from "../notifications/advancedNotificationService";
import { checkAndSendScheduledReminders, checkAndSendDocumentExpiryReminders } from "../notifications/scheduledNotificationService";
import { sendPerformanceAlerts } from "../notifications/performanceAlerts";
import { runAutoExpensesMaintenance } from "../expenses/autoExpenses";

// ==================== أنواع البيانات ====================

export interface ScheduledJob {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  cronExpression: string;
  timezone: string;
  isActive: boolean;
  lastRun?: Date;
  lastStatus?: 'success' | 'failed';
  lastError?: string;
  nextRun?: Date;
  runCount: number;
  failCount: number;
  task: ScheduledTask | null;
}

export interface JobExecution {
  id: string;
  jobId: string;
  jobName: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'success' | 'failed';
  error?: string;
  result?: any;
}

export interface DeadLetterJob {
  id: string;
  jobId: string;
  jobName: string;
  failedAt: Date;
  error: string;
  retryCount: number;
  maxRetries: number;
  lastRetryAt?: Date;
}

// ==================== إعدادات الجدولة ====================

const TIMEZONE = 'Asia/Riyadh'; // UTC+3
const MAX_RETRIES = 3;
const RETRY_DELAY = 5 * 60 * 1000; // 5 دقائق

// ==================== حالة النظام ====================

const jobs: Map<string, ScheduledJob> = new Map();
const executions: JobExecution[] = [];
const deadLetterQueue: Map<string, DeadLetterJob> = new Map();
let isSchedulerRunning = false;

// ==================== دوال المهام ====================

/**
 * فحص الإيرادات غير المسجلة وإرسال تذكيرات
 */
async function checkMissingRevenues(): Promise<{ checked: number; missing: number; sent: number }> {
  console.log("🔔 [CronScheduler] بدء فحص الإيرادات غير المسجلة...");
  
  try {
    const branches = await db.getBranches();
    const activeBranches = branches.filter(b => b.isActive);
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    const missingBranches: { id: number; name: string }[] = [];
    
    for (const branch of activeBranches) {
      const revenues = await db.getDailyRevenuesByDateRange(branch.id, yesterdayStr, yesterdayStr);
      if (revenues.length === 0) {
        missingBranches.push({ id: branch.id, name: branch.nameAr || branch.name });
      }
    }
    
    if (missingBranches.length === 0) {
      console.log("✅ [CronScheduler] جميع الفروع سجلت إيراداتها");
      return { checked: activeBranches.length, missing: 0, sent: 0 };
    }
    
    console.log(`⚠️ [CronScheduler] ${missingBranches.length} فرع لم يسجل إيراد أمس`);
    
    let sent = 0;
    
    for (const branch of missingBranches) {
      try {
        await sendAdvancedNotification({
          type: "missing_revenue" as NotificationType,
          branchId: branch.id,
          branchName: branch.name,
          date: yesterdayStr,
          customData: {
            title: `⚠️ تذكير: إيراد غير مسجل - ${branch.name}`,
            message: `لم يتم تسجيل إيراد ${branch.name} ليوم ${yesterdayStr}. يرجى تسجيل الإيراد في أقرب وقت ممكن.`
          }
        });
        sent++;
        console.log(`✓ [CronScheduler] تم إرسال تذكير لفرع: ${branch.name}`);
      } catch (error: any) {
        console.error(`✗ [CronScheduler] فشل إرسال تذكير لفرع ${branch.name}:`, error.message);
      }
    }
    
    return { checked: activeBranches.length, missing: missingBranches.length, sent };
    
  } catch (error: any) {
    console.error("✗ [CronScheduler] خطأ في فحص الإيرادات:", error.message);
    throw error;
  }
}

/**
 * إرسال التقارير الأسبوعية للمشرفين
 */
async function sendWeeklyReports(): Promise<{ total: number; sent: number }> {
  console.log("📊 [CronScheduler] بدء إرسال التقارير الأسبوعية...");
  
  try {
    const recipients = await db.getNotificationRecipients();
    const activeRecipients = recipients.filter(r => r.isActive);
    
    let sent = 0;
    
    for (const recipient of activeRecipients) {
      try {
        await sendAdvancedNotification({
          type: "weekly_report",
          branchId: recipient.branchId,
          customData: {
            recipientName: recipient.name,
            recipientEmail: recipient.email,
            recipientRole: recipient.role
          }
        });
        sent++;
        console.log(`✓ [CronScheduler] تم إرسال التقرير الأسبوعي إلى: ${recipient.name}`);
      } catch (error: any) {
        console.error(`✗ [CronScheduler] فشل إرسال التقرير إلى ${recipient.name}:`, error.message);
      }
    }
    
    return { total: activeRecipients.length, sent };
    
  } catch (error: any) {
    console.error("✗ [CronScheduler] خطأ في إرسال التقارير:", error.message);
    throw error;
  }
}

// ==================== إدارة المهام ====================

/**
 * تسجيل بدء تنفيذ مهمة
 */
function startExecution(jobId: string, jobName: string): string {
  const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const execution: JobExecution = {
    id: executionId,
    jobId,
    jobName,
    startTime: new Date(),
    status: 'running',
  };
  
  executions.unshift(execution);
  
  // الاحتفاظ بآخر 100 تنفيذ فقط
  if (executions.length > 100) {
    executions.pop();
  }
  
  return executionId;
}

/**
 * تسجيل انتهاء تنفيذ مهمة
 */
function endExecution(executionId: string, status: 'success' | 'failed', result?: any, error?: string): void {
  const execution = executions.find(e => e.id === executionId);
  if (execution) {
    execution.endTime = new Date();
    execution.status = status;
    execution.result = result;
    execution.error = error;
  }
}

/**
 * تنفيذ مهمة مع التسجيل
 */
async function executeJob(job: ScheduledJob, taskFn: () => Promise<any>): Promise<void> {
  const executionId = startExecution(job.id, job.name);
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[CronScheduler] 🚀 بدء تنفيذ: ${job.nameAr}`);
  console.log(`[CronScheduler] الوقت: ${new Date().toISOString()}`);
  console.log(`${'='.repeat(60)}`);
  
  try {
    const result = await taskFn();
    
    // تحديث حالة المهمة
    job.lastRun = new Date();
    job.lastStatus = 'success';
    job.lastError = undefined;
    job.runCount++;
    
    endExecution(executionId, 'success', result);
    
    console.log(`[CronScheduler] ✅ اكتمل: ${job.nameAr}`);
    console.log(`${'='.repeat(60)}\n`);
    
  } catch (error: any) {
    // تحديث حالة المهمة
    job.lastRun = new Date();
    job.lastStatus = 'failed';
    job.lastError = error.message;
    job.failCount++;
    
    endExecution(executionId, 'failed', undefined, error.message);
    
    console.error(`[CronScheduler] ❌ فشل: ${job.nameAr}`);
    console.error(`[CronScheduler] الخطأ: ${error.message}`);
    console.log(`${'='.repeat(60)}\n`);
    
    // إضافة إلى Dead Letter Queue
    addToDeadLetter(job, error.message);
  }
}

/**
 * إضافة مهمة فاشلة إلى Dead Letter Queue
 */
function addToDeadLetter(job: ScheduledJob, error: string): void {
  const existing = deadLetterQueue.get(job.id);
  
  if (existing) {
    existing.retryCount++;
    existing.lastRetryAt = new Date();
    existing.error = error;
  } else {
    const deadLetter: DeadLetterJob = {
      id: `dead_${Date.now()}`,
      jobId: job.id,
      jobName: job.nameAr,
      failedAt: new Date(),
      error,
      retryCount: 1,
      maxRetries: MAX_RETRIES,
    };
    deadLetterQueue.set(job.id, deadLetter);
  }
  
  console.log(`[CronScheduler] 💀 تمت إضافة ${job.nameAr} إلى Dead Letter Queue`);
}

/**
 * حساب وقت التنفيذ التالي
 */
function calculateNextRun(cronExpression: string): Date | undefined {
  try {
    // node-cron لا يوفر دالة مباشرة لحساب التنفيذ التالي
    // نستخدم حساب تقريبي
    const now = new Date();
    const parts = cronExpression.split(' ');
    
    if (parts.length >= 5) {
      const [minute, hour] = parts;
      const next = new Date(now);
      
      if (minute !== '*') next.setMinutes(parseInt(minute));
      if (hour !== '*') next.setHours(parseInt(hour));
      next.setSeconds(0);
      next.setMilliseconds(0);
      
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      
      return next;
    }
    
    return undefined;
  } catch {
    return undefined;
  }
}

// ==================== تعريف المهام ====================

/**
 * إنشاء المهام المجدولة
 */
function createScheduledJobs(): void {
  // مهمة فحص الإيرادات اليومية (10:00 صباحاً بتوقيت السعودية)
  const dailyRevenueJob: ScheduledJob = {
    id: 'daily_revenue_check',
    name: 'Daily Revenue Check',
    nameAr: 'فحص الإيرادات اليومية',
    description: 'فحص الفروع التي لم تسجل إيراداتها وإرسال تذكيرات',
    cronExpression: '0 10 * * *', // كل يوم الساعة 10:00
    timezone: TIMEZONE,
    isActive: true,
    runCount: 0,
    failCount: 0,
    task: null,
  };
  
  // مهمة التقرير الأسبوعي (الأحد 8:00 صباحاً)
  const weeklyReportJob: ScheduledJob = {
    id: 'weekly_report',
    name: 'Weekly Report',
    nameAr: 'التقرير الأسبوعي',
    description: 'إرسال التقارير الأسبوعية للمشرفين',
    cronExpression: '0 8 * * 0', // كل أحد الساعة 8:00
    timezone: TIMEZONE,
    isActive: true,
    runCount: 0,
    failCount: 0,
    task: null,
  };
  
  // مهمة تذكيرات الجرد والرواتب (9:00 صباحاً يومياً)
  const monthlyRemindersJob: ScheduledJob = {
    id: 'monthly_reminders',
    name: 'Monthly Reminders',
    nameAr: 'تذكيرات الجرد والرواتب',
    description: 'فحص وإرسال تذكيرات الجرد والرواتب في الأيام المحددة',
    cronExpression: '0 9 * * *', // كل يوم الساعة 9:00
    timezone: TIMEZONE,
    isActive: true,
    runCount: 0,
    failCount: 0,
    task: null,
  };
  
  // مهمة فحص الوثائق المنتهية (الإقامة، الشهادة الصحية، عقد العمل) - 8:00 صباحاً يومياً
  const documentExpiryJob: ScheduledJob = {
    id: 'document_expiry_check',
    name: 'Document Expiry Check',
    nameAr: 'فحص الوثائق المنتهية',
    description: 'فحص وإرسال إشعارات انتهاء الإقامة والشهادة الصحية وعقد العمل',
    cronExpression: '0 8 * * *', // كل يوم الساعة 8:00
    timezone: TIMEZONE,
    isActive: true,
    runCount: 0,
    failCount: 0,
    task: null,
  };
  
  // مهمة تنبيهات تراجع أداء الموظفين - 7:30 صباحاً يومياً
  const performanceAlertsJob: ScheduledJob = {
    id: 'performance_alerts',
    name: 'Performance Alerts',
    nameAr: 'تنبيهات تراجع الأداء',
    description: 'إرسال تنبيهات للمشرفين عند تراجع أداء الموظفين بنسبة 30% أو أكثر',
    cronExpression: '30 7 * * *', // كل يوم الساعة 7:30 صباحاً
    timezone: TIMEZONE,
    isActive: true,
    runCount: 0,
    failCount: 0,
    task: null,
  };
  
  // مهمة المصاريف الثابتة الشهرية (إيجار المحل والسكن والإنترنت) - أول يوم من كل شهر 12:05 صباحاً
  const monthlyFixedExpensesJob: ScheduledJob = {
    id: 'monthly_fixed_expenses',
    name: 'Monthly Fixed Expenses',
    nameAr: 'المصاريف الثابتة الشهرية',
    description: 'إضافة المصاريف الثابتة لكل فرع (إيجار محل، إيجار سكن، إنترنت) تلقائياً في بداية الشهر',
    cronExpression: '5 0 1 * *', // أول يوم من كل شهر الساعة 00:05
    timezone: TIMEZONE,
    isActive: true,
    runCount: 0,
    failCount: 0,
    task: null,
  };

  jobs.set(dailyRevenueJob.id, dailyRevenueJob);
  jobs.set(weeklyReportJob.id, weeklyReportJob);
  jobs.set(monthlyRemindersJob.id, monthlyRemindersJob);
  jobs.set(documentExpiryJob.id, documentExpiryJob);
  jobs.set(performanceAlertsJob.id, performanceAlertsJob);
  jobs.set(monthlyFixedExpensesJob.id, monthlyFixedExpensesJob);
}

/** المصاريف الثابتة للشهر الحالي (آمنة للتكرار: لا تُضاف مرتين) */
async function addMonthlyFixedExpenses() {
  const result = await runAutoExpensesMaintenance();
  console.log(`[CronScheduler] 🧾 المصاريف الثابتة ${result.fixed.year}-${String(result.fixed.month).padStart(2, '0')}: أُضيف ${result.fixed.created}، موجود ${result.fixed.existing}، تُرك لوجود إدخال يدوي ${result.fixed.skippedManual}`);
  return result;
}

/**
 * جدولة مهمة
 */
function scheduleJob(job: ScheduledJob, taskFn: () => Promise<any>): void {
  if (job.task) {
    job.task.stop();
  }
  
  job.task = cron.schedule(job.cronExpression, () => {
    if (job.isActive) {
      executeJob(job, taskFn);
    }
  }, {
    timezone: job.timezone,
  });
  
  job.nextRun = calculateNextRun(job.cronExpression);
  
  console.log(`[CronScheduler] 📅 تم جدولة: ${job.nameAr} (${job.cronExpression})`);
}

// ==================== واجهة API ====================

/**
 * بدء نظام الجدولة
 */
export function startScheduler(): void {
  if (isSchedulerRunning) {
    console.log("⚠️ [CronScheduler] نظام الجدولة يعمل بالفعل");
    return;
  }
  
  console.log("\n" + "=".repeat(70));
  console.log("🚀 [CronScheduler] بدء نظام الجدولة المتقدم (node-cron)...");
  console.log(`📍 المنطقة الزمنية: ${TIMEZONE}`);
  console.log("=".repeat(70));
  
  // إنشاء المهام
  createScheduledJobs();
  
  // جدولة المهام
  const dailyJob = jobs.get('daily_revenue_check')!;
  scheduleJob(dailyJob, checkMissingRevenues);
  
  const weeklyJob = jobs.get('weekly_report')!;
  scheduleJob(weeklyJob, sendWeeklyReports);
  
  const monthlyJob = jobs.get('monthly_reminders')!;
  scheduleJob(monthlyJob, checkAndSendScheduledReminders);
  
  const documentExpiryJob = jobs.get('document_expiry_check')!;
  scheduleJob(documentExpiryJob, checkAndSendDocumentExpiryReminders);
  
  const performanceAlertsJob = jobs.get('performance_alerts')!;
  scheduleJob(performanceAlertsJob, async () => {
    console.log("📉 [CronScheduler] بدء إرسال تنبيهات تراجع الأداء...");
    const result = await sendPerformanceAlerts();
    console.log(`✅ [CronScheduler] تم إرسال ${result.alertsSent} تنبيه`);
    return result;
  });

  const monthlyFixedExpensesJob = jobs.get('monthly_fixed_expenses')!;
  scheduleJob(monthlyFixedExpensesJob, addMonthlyFixedExpenses);
  
  isSchedulerRunning = true;
  
  console.log("✅ [CronScheduler] نظام الجدولة يعمل الآن");
  console.log(`📊 عدد المهام: ${jobs.size}`);
  console.log("=".repeat(70) + "\n");
}

/**
 * إيقاف نظام الجدولة
 */
export function stopScheduler(): void {
  if (!isSchedulerRunning) {
    console.log("⚠️ [CronScheduler] نظام الجدولة متوقف بالفعل");
    return;
  }
  
  for (const job of Array.from(jobs.values())) {
    if (job.task) {
      job.task.stop();
      job.task = null;
    }
  }
  
  isSchedulerRunning = false;
  console.log("🛑 [CronScheduler] تم إيقاف نظام الجدولة");
}

/**
 * الحصول على حالة نظام الجدولة
 */
export function getSchedulerStatus(): {
  running: boolean;
  timezone: string;
  jobCount: number;
  activeJobCount: number;
  nextDailyReminder: Date | undefined;
  nextWeeklyReport: Date | undefined;
} {
  const dailyJob = jobs.get('daily_revenue_check');
  const weeklyJob = jobs.get('weekly_report');
  
  return {
    running: isSchedulerRunning,
    timezone: TIMEZONE,
    jobCount: jobs.size,
    activeJobCount: Array.from(jobs.values()).filter(j => j.isActive).length,
    nextDailyReminder: dailyJob?.nextRun,
    nextWeeklyReport: weeklyJob?.nextRun,
  };
}

/**
 * الحصول على قائمة المهام
 */
export function getJobs(): ScheduledJob[] {
  return Array.from(jobs.values()).map(job => ({
    ...job,
    task: null, // لا نُرسل كائن المهمة
  }));
}

/**
 * الحصول على مهمة بمعرفها
 */
export function getJob(jobId: string): ScheduledJob | undefined {
  const job = jobs.get(jobId);
  if (job) {
    return { ...job, task: null };
  }
  return undefined;
}

/**
 * تفعيل/تعطيل مهمة
 */
export function toggleJob(jobId: string, isActive: boolean): boolean {
  const job = jobs.get(jobId);
  if (!job) return false;
  
  job.isActive = isActive;
  console.log(`[CronScheduler] ${isActive ? '✅' : '⏸️'} ${job.nameAr}: ${isActive ? 'مفعّل' : 'معطّل'}`);
  return true;
}

/**
 * تشغيل مهمة يدوياً
 */
export async function runJobManually(jobId: string): Promise<{ success: boolean; result?: any; error?: string }> {
  const job = jobs.get(jobId);
  if (!job) {
    return { success: false, error: 'المهمة غير موجودة' };
  }
  
  console.log(`[CronScheduler] 🔧 تشغيل يدوي: ${job.nameAr}`);
  
  try {
    let result: any;
    
    switch (jobId) {
      case 'daily_revenue_check':
        result = await checkMissingRevenues();
        break;
      case 'weekly_report':
        result = await sendWeeklyReports();
        break;
      case 'monthly_reminders':
        result = await checkAndSendScheduledReminders();
        break;
      case 'monthly_fixed_expenses':
        result = await addMonthlyFixedExpenses();
        break;
      default:
        return { success: false, error: 'مهمة غير معروفة' };
    }
    
    job.lastRun = new Date();
    job.lastStatus = 'success';
    job.runCount++;
    
    return { success: true, result };
    
  } catch (error: any) {
    job.lastRun = new Date();
    job.lastStatus = 'failed';
    job.lastError = error.message;
    job.failCount++;
    
    return { success: false, error: error.message };
  }
}

/**
 * الحصول على سجل التنفيذات
 */
export function getExecutions(limit: number = 20): JobExecution[] {
  return executions.slice(0, limit);
}

/**
 * الحصول على Dead Letter Queue
 */
export function getDeadLetterQueue(): DeadLetterJob[] {
  return Array.from(deadLetterQueue.values());
}

/**
 * إعادة محاولة مهمة من Dead Letter Queue
 */
export async function retryDeadLetter(jobId: string): Promise<boolean> {
  const deadLetter = deadLetterQueue.get(jobId);
  if (!deadLetter) return false;
  
  if (deadLetter.retryCount >= deadLetter.maxRetries) {
    console.log(`[CronScheduler] ⛔ تجاوز الحد الأقصى للمحاولات: ${deadLetter.jobName}`);
    return false;
  }
  
  const result = await runJobManually(jobId);
  
  if (result.success) {
    deadLetterQueue.delete(jobId);
    console.log(`[CronScheduler] ✅ تم إزالة ${deadLetter.jobName} من Dead Letter Queue`);
  }
  
  return result.success;
}

/**
 * مسح Dead Letter Queue
 */
export function clearDeadLetterQueue(): number {
  const count = deadLetterQueue.size;
  deadLetterQueue.clear();
  console.log(`[CronScheduler] 🧹 تم مسح ${count} مهمة من Dead Letter Queue`);
  return count;
}

// ==================== تصدير للتوافقية مع النظام القديم ====================

export { checkMissingRevenues, sendWeeklyReports };
