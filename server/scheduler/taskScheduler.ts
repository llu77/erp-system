/**
 * نظام جدولة المهام الداخلي
 * يعمل مع التطبيق ويدير التذكيرات والتقارير تلقائياً
 */

import * as db from "../db";
import { sendAdvancedNotification, NotificationType } from "../notifications/advancedNotificationService";
import * as emailNotifications from "../notifications/emailNotificationService";

// حالة الجدولة
let isSchedulerRunning = false;
let dailyReminderInterval: NodeJS.Timeout | null = null;
let weeklyReportInterval: NodeJS.Timeout | null = null;
let inventoryReminderInterval: NodeJS.Timeout | null = null;
let payrollReminderInterval: NodeJS.Timeout | null = null;

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
 * حساب الوقت حتى يوم محدد من الشهر
 */
function getTimeUntilDayOfMonth(targetDay: number, targetHour: number): number {
  const now = new Date();
  const target = new Date();
  
  // ضبط اليوم والوقت المستهدف (توقيت السعودية UTC+3)
  target.setDate(targetDay);
  target.setUTCHours(targetHour - 3, 0, 0, 0);
  
  // إذا مر الوقت هذا الشهر، اضبط للشهر القادم
  if (target <= now) {
    target.setMonth(target.getMonth() + 1);
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
 * إرسال تذكير الجرد (يوم 12 و 29 من كل شهر)
 */
export async function sendInventoryReminder(): Promise<{ success: boolean; sentCount: number }> {
  const today = new Date();
  const dayOfMonth = today.getDate();
  
  // التحقق من أن اليوم هو 12 أو 29
  if (dayOfMonth !== 12 && dayOfMonth !== 29) {
    console.log(`📅 [Scheduler] اليوم ${dayOfMonth} - ليس موعد تذكير الجرد`);
    return { success: false, sentCount: 0 };
  }
  
  console.log(`📦 [Scheduler] إرسال تذكير الجرد - يوم ${dayOfMonth}`);
  
  try {
    // الحصول على معلومات الفروع وعدد المنتجات
    const branches = await db.getBranches();
    const inventoryReport = await db.getInventoryReport();
    const branchesInfo = branches.filter(b => b.isActive).map((branch) => {
      return {
        name: branch.nameAr || branch.name,
        productCount: inventoryReport?.products?.length || 0
      };
    });
    
    const result = await emailNotifications.notifyInventoryReminder({
      dayOfMonth,
      branches: branchesInfo
    });
    
    return result;
  } catch (error: any) {
    console.error("✗ [Scheduler] خطأ في إرسال تذكير الجرد:", error.message);
    return { success: false, sentCount: 0 };
  }
}

/**
 * إرسال تذكير مسيرات الرواتب (يوم 29 من كل شهر)
 */
export async function sendPayrollReminder(): Promise<{ success: boolean; sentCount: number }> {
  const today = new Date();
  const dayOfMonth = today.getDate();
  
  // التحقق من أن اليوم هو 29
  if (dayOfMonth !== 29) {
    console.log(`📅 [Scheduler] اليوم ${dayOfMonth} - ليس موعد تذكير الرواتب`);
    return { success: false, sentCount: 0 };
  }
  
  console.log(`💰 [Scheduler] إرسال تذكير مسيرات الرواتب - يوم ${dayOfMonth}`);
  
  try {
    const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    const currentMonth = monthNames[today.getMonth()];
    const currentYear = today.getFullYear();
    
    // الحصول على معلومات الفروع وعدد الموظفين
    const branches = await db.getBranches();
    const branchesInfo = await Promise.all(
      branches.filter(b => b.isActive).map(async (branch) => {
        const employees = await db.getEmployeesByBranch(branch.id);
        return {
          name: branch.nameAr || branch.name,
          employeeCount: employees?.length || 0
        };
      })
    );
    
    const result = await emailNotifications.notifyPayrollReminder({
      month: currentMonth,
      year: currentYear,
      branches: branchesInfo
    });
    
    return result;
  } catch (error: any) {
    console.error("✗ [Scheduler] خطأ في إرسال تذكير الرواتب:", error.message);
    return { success: false, sentCount: 0 };
  }
}

/**
 * فحص وإرسال تذكيرات الجرد والرواتب يومياً
 */
async function checkAndSendMonthlyReminders(): Promise<void> {
  const today = new Date();
  const dayOfMonth = today.getDate();
  
  console.log(`📅 [Scheduler] فحص التذكيرات الشهرية - يوم ${dayOfMonth}`);
  
  // تذكير الجرد (يوم 12 و 29)
  if (dayOfMonth === 12 || dayOfMonth === 29) {
    await sendInventoryReminder();
  }
  
  // تذكير الرواتب (يوم 29 فقط)
  if (dayOfMonth === 29) {
    await sendPayrollReminder();
  }
}

/**
 * بدء نظام الجدولة
 */
export function startScheduler(): void {
  if (isSchedulerRunning) {
    console.log("⚠️ [Scheduler] نظام الجدولة يعمل بالفعل");
    return;
  }
  
  console.log("🚀 [Scheduler] بدء نظام الجدولة...");
  
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
  const timeUntilMonthlyReminder = getTimeUntilHour(9, 0);
  console.log(`📅 [Scheduler] فحص التذكيرات الشهرية بعد ${Math.round(timeUntilMonthlyReminder / HOUR)} ساعة`);
  
  setTimeout(() => {
    checkAndSendMonthlyReminders();
    // تكرار يومياً للفحص
    inventoryReminderInterval = setInterval(checkAndSendMonthlyReminders, DAY);
  }, timeUntilMonthlyReminder);
  
  isSchedulerRunning = true;
  console.log("✅ [Scheduler] نظام الجدولة يعمل الآن");
  
  // فحص فوري إذا كان اليوم 12 أو 29
  const today = new Date();
  if (today.getDate() === 12 || today.getDate() === 29) {
    console.log(`📅 [Scheduler] اليوم ${today.getDate()} - فحص فوري للتذكيرات`);
    // تأخير 5 ثواني للتأكد من اكتمال بدء النظام
    setTimeout(checkAndSendMonthlyReminders, 5000);
  }
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
  
  if (inventoryReminderInterval) {
    clearInterval(inventoryReminderInterval);
    inventoryReminderInterval = null;
  }
  
  if (payrollReminderInterval) {
    clearInterval(payrollReminderInterval);
    payrollReminderInterval = null;
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
