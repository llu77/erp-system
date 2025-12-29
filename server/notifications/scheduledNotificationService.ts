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
    
    // البحث عن إشعار بنفس النوع الدقيق أُرسل اليوم
    // نستخدم subject يحتوي على نوع الإشعار الدقيق
    const result = await database.select({ count: sql<number>`count(*)` })
      .from(sentNotifications)
      .where(
        and(
          gte(sentNotifications.createdAt, today),
          eq(sentNotifications.status, 'sent'),
          // البحث عن النوع الدقيق في subject
          sql`${sentNotifications.subject} LIKE ${`%[SCHEDULED:${type}]%`}`
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
