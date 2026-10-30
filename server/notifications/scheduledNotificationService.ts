/**
 * نظام الإشعارات المجدولة الموحد - الإصدار المُصحح
 * ========================================
 * 
 * هذا الملف هو المصدر الوحيد لإرسال الإشعارات المجدولة (الجرد والرواتب)
 * 
 * الإصلاحات الجذرية:
 * 1. تتبع مزدوج: في الذاكرة + قاعدة البيانات
 * 2. نوع واحد واضح للتتبع في قاعدة البيانات
 * 3. قفل صارم لمنع التنفيذ المتزامن
 * 4. تسجيل مفصل لكل عملية
 */

import { getDb } from "../db";
import { sentNotifications } from "../../drizzle/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import * as emailNotifications from "./emailNotificationService";
import * as db from "../db";

// ==================== أنواع الإشعارات المجدولة ====================
export type ScheduledNotificationType = 
  | 'inventory_reminder_12'    // تذكير الجرد يوم 12
  | 'inventory_reminder_29'    // تذكير الجرد يوم 29
  | 'payroll_reminder_29';     // تذكير الرواتب يوم 29

// ==================== واجهة نتيجة الإرسال ====================
interface SendResult {
  success: boolean;
  sentCount: number;
  skipped: boolean;
  reason?: string;
  timestamp: string;
}

// ==================== تتبع في الذاكرة (الطبقة الأولى) ====================
// هذا التتبع يعمل حتى لو فشلت قاعدة البيانات
const memorySentToday: Map<string, { date: string; time: string }> = new Map();

function getMemoryKey(type: ScheduledNotificationType): string {
  const today = new Date().toISOString().split('T')[0];
  return `${type}_${today}`;
}

function wasAlreadySentInMemory(type: ScheduledNotificationType): boolean {
  const key = getMemoryKey(type);
  const record = memorySentToday.get(key);
  if (record) {
    console.log(`[Memory] ⚠️ الإشعار ${type} أُرسل مسبقاً في ${record.time}`);
    return true;
  }
  return false;
}

function markAsSentInMemory(type: ScheduledNotificationType): void {
  const key = getMemoryKey(type);
  const now = new Date();
  memorySentToday.set(key, {
    date: now.toISOString().split('T')[0],
    time: now.toISOString()
  });
  console.log(`[Memory] ✅ تم تسجيل الإشعار ${type} في الذاكرة`);
}

// تنظيف الذاكرة من السجلات القديمة (أكثر من يوم)
function cleanupMemory(): void {
  const today = new Date().toISOString().split('T')[0];
  const keysToDelete: string[] = [];
  
  memorySentToday.forEach((record, key) => {
    if (record.date !== today) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => memorySentToday.delete(key));
}

// ==================== تتبع في قاعدة البيانات (الطبقة الثانية) ====================

/**
 * التحقق مما إذا كان الإشعار قد أُرسل اليوم في قاعدة البيانات
 * يبحث عن:
 * 1. الإشعارات الجديدة بتنسيق [SCHEDULED:type]
 * 2. الإشعارات القديمة بتنسيق notificationType = type
 */
async function wasNotificationSentTodayDB(type: ScheduledNotificationType): Promise<boolean> {
  try {
    const database = await getDb();
    if (!database) {
      console.log(`[DB] ⚠️ قاعدة البيانات غير متاحة - الاعتماد على الذاكرة فقط`);
      return false;
    }
    
    // الحصول على بداية اليوم (UTC)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    
    // تحديد أنماط البحث بناءً على نوع الإشعار
    const searchPatterns = getSearchPatternsForType(type);
    
    // البحث عن أي إشعار مطابق أُرسل اليوم
    const result = await database.select({ count: sql<number>`count(*)` })
      .from(sentNotifications)
      .where(
        and(
          gte(sentNotifications.createdAt, today),
          eq(sentNotifications.status, 'sent'),
          // البحث عن أي من الأنماط المطابقة
          sql`(
            ${sentNotifications.subject} LIKE ${`%[SCHEDULED:${type}]%`}
            OR ${sentNotifications.notificationType} = ${type}
            OR ${sentNotifications.subject} LIKE ${searchPatterns.subjectPattern}
          )`
        )
      );
    
    const count = Number(result[0]?.count) || 0;
    
    if (count > 0) {
      console.log(`[DB] ⚠️ الإشعار ${type} أُرسل مسبقاً اليوم (${count} سجل في قاعدة البيانات)`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`[DB] خطأ في فحص قاعدة البيانات:`, error);
    return false;
  }
}

/**
 * الحصول على أنماط البحث لنوع الإشعار
 */
function getSearchPatternsForType(type: ScheduledNotificationType): { subjectPattern: string } {
  switch (type) {
    case 'inventory_reminder_12':
    case 'inventory_reminder_29':
      return { subjectPattern: '%تذكير الجرد%' };
    case 'payroll_reminder_29':
      return { subjectPattern: '%تذكير الرواتب%' };
    default:
      return { subjectPattern: '%' };
  }
}

/**
 * تسجيل الإشعار المرسل في قاعدة البيانات
 */
async function logNotificationSentDB(
  type: ScheduledNotificationType,
  recipientCount: number
): Promise<void> {
  try {
    const database = await getDb();
    if (!database) return;
    
    await database.insert(sentNotifications).values({
      recipientId: 0,
      recipientEmail: 'system@symbolai.net',
      recipientName: 'النظام الآلي',
      notificationType: 'monthly_reminder',
      // نضع النوع الدقيق في subject للبحث عنه لاحقاً
      subject: `[SCHEDULED:${type}] تذكير مجدول - ${recipientCount} مستلم`,
      bodyArabic: `تم إرسال ${recipientCount} إشعار من نوع ${type}`,
      status: 'sent',
      sentAt: new Date(),
    });
    
    console.log(`[DB] ✅ تم تسجيل الإشعار ${type} في قاعدة البيانات`);
  } catch (error) {
    console.error(`[DB] خطأ في تسجيل الإشعار:`, error);
  }
}

// ==================== قفل صارم لمنع التنفيذ المتزامن ====================
const sendingLocks: Map<ScheduledNotificationType, boolean> = new Map();
const lockTimestamps: Map<ScheduledNotificationType, number> = new Map();
const LOCK_TIMEOUT = 5 * 60 * 1000; // 5 دقائق

function acquireLock(type: ScheduledNotificationType): boolean {
  const now = Date.now();
  const lockTime = lockTimestamps.get(type);
  
  // إذا كان القفل موجوداً وانتهت صلاحيته، حرره
  if (sendingLocks.get(type) && lockTime && (now - lockTime > LOCK_TIMEOUT)) {
    console.log(`[Lock] ⏰ انتهت صلاحية القفل ${type} - تحريره`);
    sendingLocks.set(type, false);
  }
  
  if (sendingLocks.get(type)) {
    console.log(`[Lock] ⏳ الإشعار ${type} قيد الإرسال حالياً - تم رفض الطلب`);
    return false;
  }
  
  sendingLocks.set(type, true);
  lockTimestamps.set(type, now);
  console.log(`[Lock] 🔒 تم الحصول على القفل ${type}`);
  return true;
}

function releaseLock(type: ScheduledNotificationType): void {
  sendingLocks.set(type, false);
  lockTimestamps.delete(type);
  console.log(`[Lock] 🔓 تم تحرير القفل ${type}`);
}

// ==================== الدالة الموحدة للتحقق من الإرسال ====================

/**
 * التحقق الشامل: هل تم إرسال هذا الإشعار اليوم؟
 * يفحص الذاكرة أولاً ثم قاعدة البيانات
 */
async function wasAlreadySentToday(type: ScheduledNotificationType): Promise<boolean> {
  // 1. فحص الذاكرة أولاً (أسرع)
  if (wasAlreadySentInMemory(type)) {
    return true;
  }
  
  // 2. فحص قاعدة البيانات
  const sentInDB = await wasNotificationSentTodayDB(type);
  if (sentInDB) {
    // تحديث الذاكرة للتناسق
    markAsSentInMemory(type);
    return true;
  }
  
  return false;
}

// ==================== دوال الإرسال الموحدة ====================

/**
 * إرسال تذكير الجرد - المصدر الوحيد والموحد
 */
export async function sendInventoryReminderUnified(dayOfMonth: 12 | 29): Promise<SendResult> {
  const type: ScheduledNotificationType = dayOfMonth === 12 ? 'inventory_reminder_12' : 'inventory_reminder_29';
  const timestamp = new Date().toISOString();
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`[Inventory] 📦 طلب إرسال تذكير الجرد - يوم ${dayOfMonth}`);
  console.log(`[Inventory] الوقت: ${timestamp}`);
  console.log(`${'='.repeat(70)}`);
  
  // تنظيف الذاكرة من السجلات القديمة
  cleanupMemory();
  
  // 1. محاولة الحصول على القفل
  if (!acquireLock(type)) {
    return {
      success: false,
      sentCount: 0,
      skipped: true,
      reason: 'الإشعار قيد الإرسال حالياً (مقفل)',
      timestamp,
    };
  }
  
  try {
    // 2. التحقق الشامل من الإرسال السابق
    const alreadySent = await wasAlreadySentToday(type);
    if (alreadySent) {
      console.log(`[Inventory] ⛔ تم تخطي الإرسال - أُرسل مسبقاً اليوم`);
      return {
        success: false,
        sentCount: 0,
        skipped: true,
        reason: `تم إرسال تذكير الجرد يوم ${dayOfMonth} مسبقاً اليوم`,
        timestamp,
      };
    }
    
    // 3. تسجيل في الذاكرة فوراً (قبل الإرسال لمنع التكرار)
    markAsSentInMemory(type);
    
    // 4. جمع البيانات
    console.log(`[Inventory] 📊 جمع بيانات الفروع...`);
    const branches = await db.getBranches();
    const inventoryReport = await db.getInventoryReport();
    const branchesInfo = branches.filter(b => b.isActive).map((branch) => ({
      name: branch.nameAr || branch.name,
      productCount: inventoryReport?.products?.length || 0
    }));
    
    // 5. إرسال الإشعار
    console.log(`[Inventory] 📤 إرسال الإشعارات إلى المستلمين...`);
    const result = await emailNotifications.notifyInventoryReminder({
      dayOfMonth,
      branches: branchesInfo
    });
    
    // 6. تسجيل في قاعدة البيانات
    if (result.success) {
      await logNotificationSentDB(type, result.sentCount);
    }
    
    console.log(`[Inventory] ✅ اكتمل الإرسال - ${result.sentCount} مستلم`);
    console.log(`${'='.repeat(70)}\n`);
    
    return {
      success: result.success,
      sentCount: result.sentCount,
      skipped: false,
      timestamp,
    };
    
  } catch (error: any) {
    console.error(`[Inventory] ❌ خطأ:`, error.message);
    return {
      success: false,
      sentCount: 0,
      skipped: false,
      reason: error.message,
      timestamp,
    };
  } finally {
    releaseLock(type);
  }
}

/**
 * إرسال تذكير مسيرات الرواتب - المصدر الوحيد والموحد
 */
export async function sendPayrollReminderUnified(): Promise<SendResult> {
  const type: ScheduledNotificationType = 'payroll_reminder_29';
  const timestamp = new Date().toISOString();
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`[Payroll] 💰 طلب إرسال تذكير مسيرات الرواتب`);
  console.log(`[Payroll] الوقت: ${timestamp}`);
  console.log(`${'='.repeat(70)}`);
  
  // تنظيف الذاكرة من السجلات القديمة
  cleanupMemory();
  
  // 1. محاولة الحصول على القفل
  if (!acquireLock(type)) {
    return {
      success: false,
      sentCount: 0,
      skipped: true,
      reason: 'الإشعار قيد الإرسال حالياً (مقفل)',
      timestamp,
    };
  }
  
  try {
    // 2. التحقق الشامل من الإرسال السابق
    const alreadySent = await wasAlreadySentToday(type);
    if (alreadySent) {
      console.log(`[Payroll] ⛔ تم تخطي الإرسال - أُرسل مسبقاً اليوم`);
      return {
        success: false,
        sentCount: 0,
        skipped: true,
        reason: 'تم إرسال تذكير الرواتب مسبقاً اليوم',
        timestamp,
      };
    }
    
    // 3. تسجيل في الذاكرة فوراً (قبل الإرسال لمنع التكرار)
    markAsSentInMemory(type);
    
    // 4. جمع البيانات
    console.log(`[Payroll] 📊 جمع بيانات الفروع والموظفين...`);
    const today = new Date();
    const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    const currentMonth = monthNames[today.getMonth()];
    const currentYear = today.getFullYear();
    
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
    
    // 5. إرسال الإشعار
    console.log(`[Payroll] 📤 إرسال الإشعارات إلى المستلمين...`);
    const result = await emailNotifications.notifyPayrollReminder({
      month: currentMonth,
      year: currentYear,
      branches: branchesInfo
    });
    
    // 6. تسجيل في قاعدة البيانات
    if (result.success) {
      await logNotificationSentDB(type, result.sentCount);
    }
    
    console.log(`[Payroll] ✅ اكتمل الإرسال - ${result.sentCount} مستلم`);
    console.log(`${'='.repeat(70)}\n`);
    
    return {
      success: result.success,
      sentCount: result.sentCount,
      skipped: false,
      timestamp,
    };
    
  } catch (error: any) {
    console.error(`[Payroll] ❌ خطأ:`, error.message);
    return {
      success: false,
      sentCount: 0,
      skipped: false,
      reason: error.message,
      timestamp,
    };
  } finally {
    releaseLock(type);
  }
}

// ==================== الدالة الرئيسية للجدولة ====================

/**
 * فحص وإرسال التذكيرات الشهرية
 * هذه هي الدالة الوحيدة التي يجب استدعاؤها من نظام الجدولة
 */
export async function checkAndSendScheduledReminders(): Promise<{
  inventoryResult?: SendResult;
  payrollResult?: SendResult;
}> {
  const today = new Date();
  const dayOfMonth = today.getDate();
  
  console.log(`\n${'#'.repeat(80)}`);
  console.log(`# [Scheduler] فحص التذكيرات الشهرية`);
  console.log(`# التاريخ: ${today.toISOString()}`);
  console.log(`# اليوم من الشهر: ${dayOfMonth}`);
  console.log(`${'#'.repeat(80)}\n`);
  
  const results: {
    inventoryResult?: SendResult;
    payrollResult?: SendResult;
  } = {};
  
  // تذكير الجرد (يوم 12 أو 29)
  if (dayOfMonth === 12) {
    console.log(`[Scheduler] 📦 يوم 12 - إرسال تذكير الجرد`);
    results.inventoryResult = await sendInventoryReminderUnified(12);
  } else if (dayOfMonth === 29) {
    console.log(`[Scheduler] 📦 يوم 29 - إرسال تذكير الجرد`);
    results.inventoryResult = await sendInventoryReminderUnified(29);
  } else {
    console.log(`[Scheduler] ℹ️ اليوم ${dayOfMonth} - لا حاجة لتذكير الجرد`);
  }
  
  // تذكير الرواتب (يوم 29 فقط)
  if (dayOfMonth === 29) {
    console.log(`[Scheduler] 💰 يوم 29 - إرسال تذكير الرواتب`);
    results.payrollResult = await sendPayrollReminderUnified();
  } else {
    console.log(`[Scheduler] ℹ️ اليوم ${dayOfMonth} - لا حاجة لتذكير الرواتب`);
  }
  
  // طباعة ملخص
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Scheduler] 📊 ملخص النتائج:`);
  if (results.inventoryResult) {
    const ir = results.inventoryResult;
    console.log(`  - الجرد: ${ir.skipped ? `⏭️ تخطي (${ir.reason})` : ir.success ? `✅ ${ir.sentCount} إشعار` : `❌ فشل (${ir.reason})`}`);
  }
  if (results.payrollResult) {
    const pr = results.payrollResult;
    console.log(`  - الرواتب: ${pr.skipped ? `⏭️ تخطي (${pr.reason})` : pr.success ? `✅ ${pr.sentCount} إشعار` : `❌ فشل (${pr.reason})`}`);
  }
  console.log(`${'='.repeat(60)}\n`);
  
  return results;
}

// ==================== دوال المساعدة ====================

/**
 * الحصول على حالة الإشعارات اليوم
 */
export async function getTodayNotificationStatus(): Promise<{
  date: string;
  inventory12: { sent: boolean; source?: string };
  inventory29: { sent: boolean; source?: string };
  payroll29: { sent: boolean; source?: string };
}> {
  const today = new Date().toISOString().split('T')[0];
  
  const checkStatus = async (type: ScheduledNotificationType) => {
    const inMemory = wasAlreadySentInMemory(type);
    const inDB = await wasNotificationSentTodayDB(type);
    return {
      sent: inMemory || inDB,
      source: inMemory ? 'memory' : inDB ? 'database' : undefined
    };
  };
  
  return {
    date: today,
    inventory12: await checkStatus('inventory_reminder_12'),
    inventory29: await checkStatus('inventory_reminder_29'),
    payroll29: await checkStatus('payroll_reminder_29'),
  };
}

/**
 * إعادة تعيين حالة الإشعارات (للاختبار فقط)
 */
export function resetNotificationStatus(): void {
  memorySentToday.clear();
  sendingLocks.clear();
  lockTimestamps.clear();
  console.log(`[Reset] 🔄 تم إعادة تعيين جميع حالات الإشعارات`);
}

/**
 * الحصول على حالة الذاكرة (للتشخيص)
 */
export function getMemoryStatus(): { entries: number; keys: string[] } {
  return {
    entries: memorySentToday.size,
    keys: Array.from(memorySentToday.keys())
  };
}


// ==================== تقرير البونص الأسبوعي ====================

/**
 * إرسال تقرير أسبوعي بحالة البونص والفروقات
 * يُرسل كل يوم أحد
 */
export async function sendWeeklyBonusReport(): Promise<SendResult> {
  const type = 'weekly_bonus_report' as ScheduledNotificationType;
  const timestamp = new Date().toISOString();
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`[Bonus Report] 📊 طلب إرسال تقرير البونص الأسبوعي`);
  console.log(`[Bonus Report] الوقت: ${timestamp}`);
  console.log(`${'='.repeat(70)}`);
  
  // تنظيف الذاكرة من السجلات القديمة
  cleanupMemory();
  
  try {
    // جمع بيانات الفروع والفروقات
    const branches = await db.getBranches();
    // الفترة الحالية حسب فترات البونص الموحدة (1-7، 8-14، 15-21، 22-28، 29-نهاية الشهر)
    const { getCurrentBonusPeriod } = await import('../bonus/calculator');
    const { weekNumber, month, year } = getCurrentBonusPeriod();
    
    // جمع الفروقات من كل الفروع
    const branchReports: Array<{
      branchName: string;
      hasDiscrepancy: boolean;
      discrepancyCount: number;
      totalDiff: number;
    }> = [];
    
    let totalDiscrepancies = 0;
    
    for (const branch of branches.filter(b => b.isActive)) {
      try {
        const discrepancies = await db.detectBonusDiscrepancies(
          branch.id,
          weekNumber,
          month,
          year
        );
        
        if (discrepancies.hasDiscrepancy) {
          const totalDiff = discrepancies.discrepancies.reduce(
            (sum, d) => sum + Math.abs(d.bonusDiff),
            0
          );
          branchReports.push({
            branchName: branch.nameAr || branch.name,
            hasDiscrepancy: true,
            discrepancyCount: discrepancies.discrepancies.length,
            totalDiff,
          });
          totalDiscrepancies += discrepancies.discrepancies.length;
        } else {
          branchReports.push({
            branchName: branch.nameAr || branch.name,
            hasDiscrepancy: false,
            discrepancyCount: 0,
            totalDiff: 0,
          });
        }
      } catch (error) {
        console.error(`[Bonus Report] خطأ في فرع ${branch.name}:`, error);
      }
    }
    
    // إرسال التقرير بالبريد
    const result = await emailNotifications.sendWeeklyBonusReport({
      weekNumber,
      month,
      year,
      totalDiscrepancies,
      branchReports,
    });
    
    console.log(`[Bonus Report] ✅ اكتمل الإرسال - ${result.sentCount} مستلم`);
    console.log(`${'='.repeat(70)}\n`);
    
    return {
      success: result.success,
      sentCount: result.sentCount,
      skipped: false,
      timestamp,
    };
  } catch (error) {
    console.error(`[Bonus Report] ❌ خطأ:`, error);
    return {
      success: false,
      sentCount: 0,
      skipped: false,
      reason: `خطأ في إرسال التقرير: ${error}`,
      timestamp,
    };
  }
}


// ==================== إشعارات الوثائق المنتهية ====================

/**
 * فحص وإرسال إشعارات الوثائق المنتهية
 * - الإقامة: قبل شهر (30 يوم)
 * - الشهادة الصحية: قبل أسبوع (7 أيام)
 * - عقد العمل: قبل شهرين (60 يوم) + قبل شهر (30 يوم)
 */
export async function checkAndSendDocumentExpiryReminders(): Promise<{
  iqamaReminders: number;
  healthCertReminders: number;
  contractReminders: number;
}> {
  console.log(`\n${'#'.repeat(80)}`);
  console.log(`# [Document Expiry] فحص الوثائق المنتهية`);
  console.log(`# التاريخ: ${new Date().toISOString()}`);
  console.log(`${'#'.repeat(80)}\n`);
  
  const results = {
    iqamaReminders: 0,
    healthCertReminders: 0,
    contractReminders: 0,
  };
  
  try {
    // الحصول على جميع الموظفين النشطين
    const employees = await db.getAllEmployees();
    const branches = await db.getBranches();
    
    const getBranchName = (branchId: number) => {
      const branch = branches.find(b => b.id === branchId);
      return branch?.nameAr || branch?.name || 'غير محدد';
    };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (const employee of employees) {
      if (!employee.isActive) continue;
      
      const emp = employee as any;
      
      // 1. فحص انتهاء الإقامة (قبل 30 يوم)
      if (emp.iqamaExpiryDate && emp.iqamaNumber) {
        const expiryDate = new Date(emp.iqamaExpiryDate);
        const daysRemaining = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        // إرسال إشعار قبل 30 يوم (شهر)
        if (daysRemaining > 0 && daysRemaining <= 30) {
          // التحقق من عدم إرسال إشعار اليوم لهذا الموظف
          const notificationKey = `iqama_${employee.id}_${today.toISOString().split('T')[0]}`;
          const alreadySent = await wasDocumentNotificationSentToday(notificationKey);
          
          if (!alreadySent) {
            console.log(`[Iqama] 📋 إرسال إشعار انتهاء إقامة: ${employee.name} - ${daysRemaining} يوم متبقي`);
            const result = await emailNotifications.notifyIqamaExpiry({
              employeeName: employee.name,
              employeeCode: employee.code,
              iqamaNumber: emp.iqamaNumber,
              expiryDate,
              daysRemaining,
              branchName: getBranchName(employee.branchId),
              branchId: employee.branchId,
            });
            if (result.success) {
              results.iqamaReminders++;
              await markDocumentNotificationSent(notificationKey);
            }
          }
        }
      }
      
      // 2. فحص انتهاء الشهادة الصحية (قبل 7 أيام)
      if (emp.healthCertExpiryDate) {
        const expiryDate = new Date(emp.healthCertExpiryDate);
        const daysRemaining = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        // إرسال إشعار قبل 7 أيام (أسبوع)
        if (daysRemaining > 0 && daysRemaining <= 7) {
          const notificationKey = `health_${employee.id}_${today.toISOString().split('T')[0]}`;
          const alreadySent = await wasDocumentNotificationSentToday(notificationKey);
          
          if (!alreadySent) {
            console.log(`[Health] 🏥 إرسال إشعار انتهاء شهادة صحية: ${employee.name} - ${daysRemaining} يوم متبقي`);
            const result = await emailNotifications.notifyHealthCertExpiry({
              employeeName: employee.name,
              employeeCode: employee.code,
              expiryDate,
              daysRemaining,
              branchName: getBranchName(employee.branchId),
              branchId: employee.branchId,
            });
            if (result.success) {
              results.healthCertReminders++;
              await markDocumentNotificationSent(notificationKey);
            }
          }
        }
      }
      
      // 3. فحص انتهاء عقد العمل (قبل 60 يوم + 30 يوم)
      if (emp.contractExpiryDate) {
        const expiryDate = new Date(emp.contractExpiryDate);
        const daysRemaining = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        // إشعار قبل شهرين (55-60 يوم)
        if (daysRemaining >= 55 && daysRemaining <= 60) {
          const notificationKey = `contract_2m_${employee.id}_${today.toISOString().split('T')[0]}`;
          const alreadySent = await wasDocumentNotificationSentToday(notificationKey);
          
          if (!alreadySent) {
            console.log(`[Contract] 📄 إرسال إشعار انتهاء عقد (شهرين): ${employee.name} - ${daysRemaining} يوم متبقي`);
            const result = await emailNotifications.notifyContractExpiry({
              employeeName: employee.name,
              employeeCode: employee.code,
              expiryDate,
              daysRemaining,
              branchName: getBranchName(employee.branchId),
              branchId: employee.branchId,
              reminderType: 'two_months',
            });
            if (result.success) {
              results.contractReminders++;
              await markDocumentNotificationSent(notificationKey);
            }
          }
        }
        
        // إشعار قبل شهر (25-30 يوم)
        if (daysRemaining >= 25 && daysRemaining <= 30) {
          const notificationKey = `contract_1m_${employee.id}_${today.toISOString().split('T')[0]}`;
          const alreadySent = await wasDocumentNotificationSentToday(notificationKey);
          
          if (!alreadySent) {
            console.log(`[Contract] 📄 إرسال إشعار انتهاء عقد (شهر): ${employee.name} - ${daysRemaining} يوم متبقي`);
            const result = await emailNotifications.notifyContractExpiry({
              employeeName: employee.name,
              employeeCode: employee.code,
              expiryDate,
              daysRemaining,
              branchName: getBranchName(employee.branchId),
              branchId: employee.branchId,
              reminderType: 'one_month',
            });
            if (result.success) {
              results.contractReminders++;
              await markDocumentNotificationSent(notificationKey);
            }
          }
        }
      }
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[Document Expiry] 📊 ملخص النتائج:`);
    console.log(`  - إشعارات الإقامة: ${results.iqamaReminders}`);
    console.log(`  - إشعارات الشهادة الصحية: ${results.healthCertReminders}`);
    console.log(`  - إشعارات عقد العمل: ${results.contractReminders}`);
    console.log(`${'='.repeat(60)}\n`);
    
  } catch (error: any) {
    console.error(`[Document Expiry] ❌ خطأ:`, error.message);
  }
  
  return results;
}

// ==================== تتبع إشعارات الوثائق ====================
const documentNotificationsSent: Map<string, boolean> = new Map();

async function wasDocumentNotificationSentToday(key: string): Promise<boolean> {
  // فحص الذاكرة أولاً
  if (documentNotificationsSent.has(key)) {
    return true;
  }
  
  // فحص قاعدة البيانات
  try {
    const database = await getDb();
    if (!database) return false;
    
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    
    const result = await database.select()
      .from(sentNotifications)
      .where(and(
        sql`${sentNotifications.notificationType} = ${key}`,
        gte(sentNotifications.sentAt, today)
      ))
      .limit(1);
    
    if (result.length > 0) {
      documentNotificationsSent.set(key, true);
      return true;
    }
  } catch (error) {
    console.error(`[Document] خطأ في فحص قاعدة البيانات:`, error);
  }
  
  return false;
}

async function markDocumentNotificationSent(key: string): Promise<void> {
  documentNotificationsSent.set(key, true);
  
  try {
    const database = await getDb();
    if (!database) return;
    
    await database.insert(sentNotifications).values({
      recipientId: 0,
      recipientEmail: 'system',
      recipientName: 'System',
      notificationType: 'document_expiry',
      subject: `Document Expiry: ${key}`,
      bodyArabic: key,
      status: 'sent',
      sentAt: new Date(),
    });
  } catch (error) {
    console.error(`[Document] خطأ في تسجيل الإشعار:`, error);
  }
}


// ==================== تذكيرات وثائق الموظفين ====================

/**
 * إرسال تذكيرات للموظفين الذين لم يكملوا رفع وثائقهم
 * يُرسل كل يوم أحد وأربعاء
 */
export async function sendDocumentReminders(): Promise<SendResult> {
  const type = 'document_reminder' as ScheduledNotificationType;
  const timestamp = new Date().toISOString();
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`[Documents] 📄 طلب إرسال تذكيرات الوثائق`);
  console.log(`[Documents] الوقت: ${timestamp}`);
  console.log(`${'='.repeat(70)}`);
  
  // تنظيف الذاكرة من السجلات القديمة
  cleanupMemory();
  
  try {
    // جلب الموظفين بدون وثائق مكتملة
    const employeesWithoutDocs = await db.getEmployeesWithoutDocuments();
    
    if (!employeesWithoutDocs || employeesWithoutDocs.length === 0) {
      console.log(`[Documents] ✅ جميع الموظفين أكملوا وثائقهم`);
      return {
        success: true,
        sentCount: 0,
        skipped: false,
        reason: 'لا يوجد موظفين بدون وثائق',
        timestamp,
      };
    }
    
    // تجميع الموظفين حسب الفرع
    const employeesByBranch = new Map<string, typeof employeesWithoutDocs>();
    for (const emp of employeesWithoutDocs) {
      const branchName = emp.branchName || 'غير محدد';
      if (!employeesByBranch.has(branchName)) {
        employeesByBranch.set(branchName, []);
      }
      employeesByBranch.get(branchName)!.push(emp);
    }
    
    // إنشاء محتوى الإشعار
    let content = `📄 تذكير: وثائق الموظفين غير المكتملة\n\n`;
    content += `إجمالي الموظفين بدون وثائق مكتملة: ${employeesWithoutDocs.length}\n\n`;
    
    for (const [branchName, employees] of Array.from(employeesByBranch.entries())) {
      content += `\n📍 ${branchName} (${employees.length} موظف):\n`;
      for (const emp of employees.slice(0, 5)) {
        const missing: string[] = [];
        if (emp.missingDocuments.info) missing.push('المعلومات');
        if (emp.missingDocuments.iqamaImage) missing.push('صورة الإقامة');
        if (emp.missingDocuments.healthCertImage) missing.push('صورة الشهادة الصحية');
        if (emp.missingDocuments.contractImage) missing.push('صورة العقد');
        content += `  • ${emp.name} (${emp.code}): ناقص ${missing.join('، ')}\n`;
      }
      if (employees.length > 5) {
        content += `  ... و ${employees.length - 5} موظفين آخرين\n`;
      }
    }
    
    content += `\n\n⚠️ يرجى متابعة الموظفين لإكمال رفع وثائقهم عبر بوابة الموظفين.`;
    
    // إرسال الإشعار للأدمن والمشرف العام
    const result = await emailNotifications.sendDocumentReminderEmail({
      totalEmployees: employeesWithoutDocs.length,
      employeesByBranch: Object.fromEntries(employeesByBranch),
      content,
    });
    
    if (result.success) {
      console.log(`[Documents] ✅ تم إرسال ${result.sentCount} إشعار`);
      return {
        success: true,
        sentCount: result.sentCount || 1,
        skipped: false,
        timestamp,
      };
    } else {
      console.log(`[Documents] ❌ فشل الإرسال: ${result.error}`);
      return {
        success: false,
        sentCount: 0,
        skipped: false,
        reason: result.error,
        timestamp,
      };
    }
    
  } catch (error: any) {
    console.error(`[Documents] ❌ خطأ:`, error.message);
    return {
      success: false,
      sentCount: 0,
      skipped: false,
      reason: error.message,
      timestamp,
    };
  }
}

/**
 * إرسال تذكير لموظف محدد
 */
export async function sendDocumentReminderToEmployee(employeeId: number): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const employee = await db.getEmployeeDocumentInfo(employeeId);
    if (!employee) {
      return { success: false, error: 'الموظف غير موجود' };
    }
    
    // التحقق من وجود وثائق ناقصة
    const missing: string[] = [];
    if (!employee.infoSubmittedAt) missing.push('المعلومات الأساسية');
    if (!employee.iqamaImageUrl) missing.push('صورة الإقامة');
    if (!employee.healthCertImageUrl) missing.push('صورة الشهادة الصحية');
    if (!employee.contractImageUrl) missing.push('صورة عقد العمل');
    
    if (missing.length === 0) {
      return { success: false, error: 'الموظف أكمل جميع وثائقه' };
    }
    
    // إرسال إشعار داخلي للموظف
    await db.createNotification({
      userId: 0, // سيتم تحديده لاحقاً
      title: '📄 تذكير: إكمال الوثائق',
      message: `مرحباً ${employee.name}، يرجى إكمال رفع الوثائق التالية: ${missing.join('، ')}. يمكنك ذلك من خلال بوابة الموظفين > ملفي.`,
      type: 'system',
    });
    
    console.log(`[Documents] ✅ تم إرسال تذكير للموظف ${employee.name}`);
    return { success: true };
    
  } catch (error: any) {
    console.error(`[Documents] ❌ خطأ في إرسال التذكير:`, error.message);
    return { success: false, error: error.message };
  }
}


/**
 * فحص وإرسال تنبيهات انتهاء صلاحية الوثائق
 * يتم إرسال تنبيه للأدمن والمشرف العام عند اقتراب انتهاء صلاحية وثائق الموظفين
 */
export async function checkDocumentExpirations(): Promise<{
  success: boolean;
  expiringCount: number;
  expiredCount: number;
  sentCount: number;
  error?: string;
}> {
  const timestamp = new Date().toISOString();
  console.log(`[DocExpiry] 🔍 بدء فحص انتهاء صلاحية الوثائق - ${timestamp}`);
  
  try {
    // جلب جميع الموظفين النشطين مع معلومات وثائقهم
    const employees = await db.getAllEmployeesWithDocuments();
    
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const expiringDocs: Array<{
      employeeId: number;
      employeeName: string;
      employeeCode: string;
      branchName: string;
      documentType: string;
      expiryDate: Date;
      daysRemaining: number;
      status: 'expired' | 'expiring_soon';
    }> = [];
    
    for (const emp of employees) {
      const checkDocument = (date: Date | null, type: string) => {
        if (!date) return;
        
        const expiryDate = new Date(date);
        const daysRemaining = Math.ceil((expiryDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
        
        if (daysRemaining <= 0) {
          expiringDocs.push({
            employeeId: emp.id,
            employeeName: emp.name,
            employeeCode: emp.code,
            branchName: emp.branchName || 'غير محدد',
            documentType: type,
            expiryDate,
            daysRemaining,
            status: 'expired',
          });
        } else if (daysRemaining <= 30) {
          expiringDocs.push({
            employeeId: emp.id,
            employeeName: emp.name,
            employeeCode: emp.code,
            branchName: emp.branchName || 'غير محدد',
            documentType: type,
            expiryDate,
            daysRemaining,
            status: 'expiring_soon',
          });
        }
      };
      
      checkDocument(emp.iqamaExpiryDate, 'الإقامة');
      checkDocument(emp.healthCertExpiryDate, 'الشهادة الصحية');
      checkDocument(emp.contractExpiryDate, 'عقد العمل');
    }
    
    if (expiringDocs.length === 0) {
      console.log(`[DocExpiry] ✅ لا توجد وثائق منتهية أو قريبة الانتهاء`);
      return {
        success: true,
        expiringCount: 0,
        expiredCount: 0,
        sentCount: 0,
      };
    }
    
    const expiredDocs = expiringDocs.filter(d => d.status === 'expired');
    const expiringDocs2 = expiringDocs.filter(d => d.status === 'expiring_soon');
    
    console.log(`[DocExpiry] ⚠️ وجد ${expiredDocs.length} وثيقة منتهية و ${expiringDocs2.length} وثيقة قريبة الانتهاء`);
    
    // إرسال البريد الإلكتروني للأدمن والمشرف العام
    const result = await emailNotifications.sendDocumentExpiryAlert({
      expiredDocs,
      expiringDocs: expiringDocs2,
    });
    
    if (result.success) {
      console.log(`[DocExpiry] ✅ تم إرسال ${result.sentCount} إشعار`);
      return {
        success: true,
        expiringCount: expiringDocs2.length,
        expiredCount: expiredDocs.length,
        sentCount: result.sentCount || 1,
      };
    } else {
      console.log(`[DocExpiry] ❌ فشل الإرسال: ${result.error}`);
      return {
        success: false,
        expiringCount: expiringDocs2.length,
        expiredCount: expiredDocs.length,
        sentCount: 0,
        error: result.error,
      };
    }
    
  } catch (error: any) {
    console.error(`[DocExpiry] ❌ خطأ:`, error.message);
    return {
      success: false,
      expiringCount: 0,
      expiredCount: 0,
      sentCount: 0,
      error: error.message,
    };
  }
}
