/**
 * نظام جدولة المهام الداخلي - الإصدار المُصحح
 * ========================================
 * 
 * الإصلاحات:
 * 1. إزالة الفحص الفوري عند بدء السيرفر (كان يسبب التكرار)
 * 2. استخدام النظام الموحد فقط
 * 3. تأخير أطول قبل بدء الجدولة
 */

import * as db from "../db";
import { sendAdvancedNotification, NotificationType } from "../notifications/advancedNotificationService";
import { checkAndSendScheduledReminders } from "../notifications/scheduledNotificationService";

// حالة الجدولة
let isSchedulerRunning = false;
let dailyReminderInterval: NodeJS.Timeout | null = null;
let weeklyReportInterval: NodeJS.Timeout | null = null;
let monthlyReminderInterval: NodeJS.Timeout | null = null;

// إعدادات الجدولة (بالملي ثانية)
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * حساب الوقت حتى الساعة المحددة
 */
function getTimeUntilHour(targetHour: number, targetMinute: number = 0): number {
  const now = new Date();
  const target = new Date();
  
  // ضبط الوقت المستهدف (توقيت السعودية UTC+3)
  target.setUTCHours(targetHour - 3, targetMinute, 0, 0);
  
  // إذا مر الوقت اليوم، اضبط ليوم غد
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }
  
  return target.getTime() - now.getTime();
}

/**
 * حساب الوقت حتى يوم الأحد القادم
 */
function getTimeUntilSunday(targetHour: number): number {
  const now = new Date();
  const target = new Date();
  
  // ضبط ليوم الأحد القادم
  const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
  target.setDate(now.getDate() + daysUntilSunday);
  target.setUTCHours(targetHour - 3, 0, 0, 0);
  
  // إذا كان اليوم الأحد ومر الوقت، اضبط للأسبوع القادم
  if (target <= now) {
    target.setDate(target.getDate() + 7);
  }
  
  return target.getTime() - now.getTime();
}

/**
 * فحص الإيرادات غير المسجلة وإرسال تذكيرات
 */
export async function checkMissingRevenues(): Promise<{ checked: number; missing: number; sent: number }> {
  console.log("🔔 [Scheduler] بدء فحص الإيرادات غير المسجلة...");
  
  try {
    const branches = await db.getBranches();
    const activeBranches = branches.filter(b => b.isActive);
    
    // تحديد تاريخ أمس
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    const missingBranches: { id: number; name: string }[] = [];
    
    // فحص كل فرع
    for (const branch of activeBranches) {
      const revenues = await db.getDailyRevenuesByDateRange(branch.id, yesterdayStr, yesterdayStr);
      if (revenues.length === 0) {
        missingBranches.push({ id: branch.id, name: branch.nameAr || branch.name });
      }
    }
    
    if (missingBranches.length === 0) {
      console.log("✅ [Scheduler] جميع الفروع سجلت إيراداتها");
      return { checked: activeBranches.length, missing: 0, sent: 0 };
    }
    
    console.log(`⚠️ [Scheduler] ${missingBranches.length} فرع لم يسجل إيراد أمس`);
    
    let sent = 0;
    
    // إرسال تذكيرات
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
        console.log(`✓ [Scheduler] تم إرسال تذكير لفرع: ${branch.name}`);
      } catch (error: any) {
        console.error(`✗ [Scheduler] فشل إرسال تذكير لفرع ${branch.name}:`, error.message);
      }
    }
    
    return { checked: activeBranches.length, missing: missingBranches.length, sent };
    
  } catch (error: any) {
    console.error("✗ [Scheduler] خطأ في فحص الإيرادات:", error.message);
    return { checked: 0, missing: 0, sent: 0 };
  }
}

/**
 * إرسال التقارير الأسبوعية للمشرفين
 */
export async function sendWeeklyReports(): Promise<{ total: number; sent: number }> {
  console.log("📊 [Scheduler] بدء إرسال التقارير الأسبوعية...");
  
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
        console.log(`✓ [Scheduler] تم إرسال التقرير الأسبوعي إلى: ${recipient.name}`);
      } catch (error: any) {
        console.error(`✗ [Scheduler] فشل إرسال التقرير إلى ${recipient.name}:`, error.message);
      }
    }
    
    return { total: activeRecipients.length, sent };
    
  } catch (error: any) {
    console.error("✗ [Scheduler] خطأ في إرسال التقارير:", error.message);
    return { total: 0, sent: 0 };
  }
}

/**
 * بدء نظام الجدولة
 */
export function startScheduler(): void {
  if (isSchedulerRunning) {
    console.log("⚠️ [Scheduler] نظام الجدولة يعمل بالفعل - تجاهل الطلب");
    return;
  }
  
  console.log("\n" + "=".repeat(70));
  console.log("🚀 [Scheduler] بدء نظام الجدولة...");
  console.log("=".repeat(70));
  
  // جدولة التذكير اليومي (الساعة 10 صباحاً بتوقيت السعودية)
  const timeUntilDailyReminder = getTimeUntilHour(10, 0);
  console.log(`📅 [Scheduler] التذكير اليومي القادم بعد ${Math.round(timeUntilDailyReminder / HOUR)} ساعة`);
  
  setTimeout(() => {
    checkMissingRevenues();
    // تكرار يومياً
    dailyReminderInterval = setInterval(checkMissingRevenues, DAY);
  }, timeUntilDailyReminder);
  
  // جدولة التقرير الأسبوعي (الأحد الساعة 8 صباحاً بتوقيت السعودية)
  const timeUntilWeeklyReport = getTimeUntilSunday(8);
  console.log(`📅 [Scheduler] التقرير الأسبوعي القادم بعد ${Math.round(timeUntilWeeklyReport / DAY)} يوم`);
  
  setTimeout(() => {
    sendWeeklyReports();
    // تكرار أسبوعياً
    weeklyReportInterval = setInterval(sendWeeklyReports, 7 * DAY);
  }, timeUntilWeeklyReport);
  
  // جدولة تذكيرات الجرد والرواتب (الساعة 9 صباحاً بتوقيت السعودية)
  // مهم جداً: يستخدم النظام الموحد فقط - لا فحص فوري!
  const timeUntilMonthlyReminder = getTimeUntilHour(9, 0);
  console.log(`📅 [Scheduler] فحص التذكيرات الشهرية بعد ${Math.round(timeUntilMonthlyReminder / HOUR)} ساعة`);
  
  setTimeout(() => {
    console.log(`📅 [Scheduler] بدء فحص التذكيرات الشهرية...`);
    checkAndSendScheduledReminders();
    // تكرار يومياً للفحص
    monthlyReminderInterval = setInterval(checkAndSendScheduledReminders, DAY);
  }, timeUntilMonthlyReminder);
  
  isSchedulerRunning = true;
  console.log("✅ [Scheduler] نظام الجدولة يعمل الآن");
  console.log("=".repeat(70) + "\n");
  
  // ⚠️ تم إزالة الفحص الفوري - كان يسبب التكرار!
  // الفحص سيتم فقط في الساعة 9 صباحاً
}

/**
 * إيقاف نظام الجدولة
 */
export function stopScheduler(): void {
  if (!isSchedulerRunning) {
    console.log("⚠️ [Scheduler] نظام الجدولة متوقف بالفعل");
    return;
  }
  
  if (dailyReminderInterval) {
    clearInterval(dailyReminderInterval);
    dailyReminderInterval = null;
  }
  
  if (weeklyReportInterval) {
    clearInterval(weeklyReportInterval);
    weeklyReportInterval = null;
  }
  
  if (monthlyReminderInterval) {
    clearInterval(monthlyReminderInterval);
    monthlyReminderInterval = null;
  }
  
  isSchedulerRunning = false;
  console.log("🛑 [Scheduler] تم إيقاف نظام الجدولة");
}

/**
 * الحصول على حالة الجدولة
 */
export function getSchedulerStatus(): { running: boolean; nextDailyReminder: Date; nextWeeklyReport: Date } {
  const now = new Date();
  
  const nextDaily = new Date(now.getTime() + getTimeUntilHour(10, 0));
  const nextWeekly = new Date(now.getTime() + getTimeUntilSunday(8));
  
  return {
    running: isSchedulerRunning,
    nextDailyReminder: nextDaily,
    nextWeeklyReport: nextWeekly
  };
}

// ==================== ملاحظات مهمة ====================
// 
// 1. جميع إشعارات الجرد والرواتب تُرسل فقط من:
//    server/notifications/scheduledNotificationService.ts
//
// 2. لا تستدعِ sendInventoryReminderUnified أو sendPayrollReminderUnified
//    مباشرة من أي مكان آخر - استخدم checkAndSendScheduledReminders
//
// 3. النظام الموحد يمنع التكرار عبر:
//    - تتبع في الذاكرة (سريع)
//    - تتبع في قاعدة البيانات (دائم)
//    - قفل لمنع التنفيذ المتزامن
//
// 4. تم إزالة الفحص الفوري عند بدء السيرفر لأنه كان يسبب التكرار
//
// ====================
