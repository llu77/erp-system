/**
 * نظام الإشعارات المجدولة الموحد
 * ========================================
 * 
 * هذا الملف هو المصدر الوحيد لإرسال الإشعارات المجدولة (الجرد والرواتب)
 * يستخدم قاعدة البيانات للتتبع ومنع التكرار
 * 
 * مهم جداً: لا تستدعِ دوال الإرسال من أي مكان آخر!
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

// ==================== دوال التتبع في قاعدة البيانات ====================

/**
 * التحقق مما إذا كان الإشعار قد أُرسل اليوم
 * يستخدم قاعدة البيانات للتتبع (أكثر موثوقية من الملفات)
 */
async function wasNotificationSentTodayDB(type: ScheduledNotificationType): Promise<boolean> {
  const database = await getDb();
  if (!database) return false;
  
  // الحصول على بداية اليوم
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // تحويل نوع الإشعار إلى النوع المخزن في قاعدة البيانات
  const dbType = type.startsWith('inventory') ? 'monthly_reminder' : 'payroll_created';
  
  try {
    // البحث عن إشعار من نفس النوع أُرسل اليوم
    const result = await database.select({ count: sql<number>`count(*)` })
      .from(sentNotifications)
      .where(
        and(
          eq(sentNotifications.notificationType, dbType),
          gte(sentNotifications.createdAt, today),
          eq(sentNotifications.status, 'sent'),
          // إضافة فلتر للتمييز بين أنواع التذكيرات
          sql`${sentNotifications.subject} LIKE ${`%${type.includes('12') ? 'يوم 12' : type.includes('29') ? 'يوم 29' : 'الرواتب'}%`}`
        )
      );
    
    const count = result[0]?.count || 0;
    
    if (count > 0) {
      console.log(`[ScheduledNotifications] ⚠️ الإشعار ${type} أُرسل مسبقاً اليوم (${count} سجل)`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`[ScheduledNotifications] خطأ في فحص قاعدة البيانات:`, error);
    return false;
  }
}

/**
 * تسجيل الإشعار المرسل في قاعدة البيانات
 */
async function logNotificationSent(
  type: ScheduledNotificationType,
  recipientCount: number,
  subject: string
): Promise<void> {
  const database = await getDb();
  if (!database) return;
  
  const dbType = type.startsWith('inventory') ? 'monthly_reminder' : 'payroll_created';
  
  try {
    await database.insert(sentNotifications).values({
      recipientId: 0, // نظام
      recipientEmail: 'system@symbolai.net',
      recipientName: 'النظام',
      notificationType: dbType,
      subject: `[${type}] ${subject}`,
      bodyArabic: `تم إرسال ${recipientCount} إشعار`,
      status: 'sent',
      sentAt: new Date(),
    });
    
    console.log(`[ScheduledNotifications] ✅ تم تسجيل الإشعار ${type} في قاعدة البيانات`);
  } catch (error) {
    console.error(`[ScheduledNotifications] خطأ في تسجيل الإشعار:`, error);
  }
}

// ==================== قفل لمنع التنفيذ المتزامن ====================
const sendingLocks: Map<ScheduledNotificationType, boolean> = new Map();

function acquireLock(type: ScheduledNotificationType): boolean {
  if (sendingLocks.get(type)) {
    console.log(`[ScheduledNotifications] ⏳ الإشعار ${type} قيد الإرسال حالياً...`);
    return false;
  }
  sendingLocks.set(type, true);
  return true;
}

function releaseLock(type: ScheduledNotificationType): void {
  sendingLocks.set(type, false);
}

// ==================== دوال الإرسال الموحدة ====================

/**
 * إرسال تذكير الجرد - المصدر الوحيد والموحد
 * يُستدعى فقط من نظام الجدولة المركزي
 */
export async function sendInventoryReminderUnified(dayOfMonth: 12 | 29): Promise<SendResult> {
  const type: ScheduledNotificationType = dayOfMonth === 12 ? 'inventory_reminder_12' : 'inventory_reminder_29';
  const timestamp = new Date().toISOString();
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[ScheduledNotifications] 📦 بدء إرسال تذكير الجرد - يوم ${dayOfMonth}`);
  console.log(`[ScheduledNotifications] الوقت: ${timestamp}`);
  console.log(`${'='.repeat(60)}\n`);
  
  // 1. محاولة الحصول على القفل
  if (!acquireLock(type)) {
    return {
      success: false,
      sentCount: 0,
      skipped: true,
      reason: 'الإشعار قيد الإرسال حالياً',
      timestamp,
    };
  }
  
  try {
    // 2. التحقق من قاعدة البيانات
    const alreadySent = await wasNotificationSentTodayDB(type);
    if (alreadySent) {
      return {
        success: false,
        sentCount: 0,
        skipped: true,
        reason: `تم إرسال تذكير الجرد يوم ${dayOfMonth} مسبقاً اليوم`,
        timestamp,
      };
    }
    
    // 3. جمع البيانات
    const branches = await db.getBranches();
    const inventoryReport = await db.getInventoryReport();
    const branchesInfo = branches.filter(b => b.isActive).map((branch) => ({
      name: branch.nameAr || branch.name,
      productCount: inventoryReport?.products?.length || 0
    }));
    
    // 4. إرسال الإشعار
    console.log(`[ScheduledNotifications] 📤 إرسال الإشعارات...`);
    const result = await emailNotifications.notifyInventoryReminder({
      dayOfMonth,
      branches: branchesInfo
    });
    
    // 5. تسجيل في قاعدة البيانات
    if (result.success) {
      await logNotificationSent(type, result.sentCount, `تذكير الجرد - يوم ${dayOfMonth}`);
    }
    
    console.log(`[ScheduledNotifications] ✅ تم إرسال ${result.sentCount} تذكير جرد`);
    
    return {
      success: result.success,
      sentCount: result.sentCount,
      skipped: false,
      timestamp,
    };
    
  } catch (error: any) {
    console.error(`[ScheduledNotifications] ❌ خطأ في إرسال تذكير الجرد:`, error.message);
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
 * يُستدعى فقط من نظام الجدولة المركزي
 */
export async function sendPayrollReminderUnified(): Promise<SendResult> {
  const type: ScheduledNotificationType = 'payroll_reminder_29';
  const timestamp = new Date().toISOString();
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[ScheduledNotifications] 💰 بدء إرسال تذكير مسيرات الرواتب`);
  console.log(`[ScheduledNotifications] الوقت: ${timestamp}`);
  console.log(`${'='.repeat(60)}\n`);
  
  // 1. محاولة الحصول على القفل
  if (!acquireLock(type)) {
    return {
      success: false,
      sentCount: 0,
      skipped: true,
      reason: 'الإشعار قيد الإرسال حالياً',
      timestamp,
    };
  }
  
  try {
    // 2. التحقق من قاعدة البيانات
    const alreadySent = await wasNotificationSentTodayDB(type);
    if (alreadySent) {
      return {
        success: false,
        sentCount: 0,
        skipped: true,
        reason: 'تم إرسال تذكير الرواتب مسبقاً اليوم',
        timestamp,
      };
    }
    
    // 3. جمع البيانات
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
    
    // 4. إرسال الإشعار
    console.log(`[ScheduledNotifications] 📤 إرسال الإشعارات...`);
    const result = await emailNotifications.notifyPayrollReminder({
      month: currentMonth,
      year: currentYear,
      branches: branchesInfo
    });
    
    // 5. تسجيل في قاعدة البيانات
    if (result.success) {
      await logNotificationSent(type, result.sentCount, `تذكير الرواتب - ${currentMonth} ${currentYear}`);
    }
    
    console.log(`[ScheduledNotifications] ✅ تم إرسال ${result.sentCount} تذكير رواتب`);
    
    return {
      success: result.success,
      sentCount: result.sentCount,
      skipped: false,
      timestamp,
    };
    
  } catch (error: any) {
    console.error(`[ScheduledNotifications] ❌ خطأ في إرسال تذكير الرواتب:`, error.message);
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
  
  console.log(`\n${'#'.repeat(70)}`);
  console.log(`# [ScheduledNotifications] فحص التذكيرات الشهرية - يوم ${dayOfMonth}`);
  console.log(`# الوقت: ${today.toISOString()}`);
  console.log(`${'#'.repeat(70)}\n`);
  
  const results: {
    inventoryResult?: SendResult;
    payrollResult?: SendResult;
  } = {};
  
  // تذكير الجرد (يوم 12 أو 29)
  if (dayOfMonth === 12) {
    results.inventoryResult = await sendInventoryReminderUnified(12);
  } else if (dayOfMonth === 29) {
    results.inventoryResult = await sendInventoryReminderUnified(29);
  }
  
  // تذكير الرواتب (يوم 29 فقط)
  if (dayOfMonth === 29) {
    results.payrollResult = await sendPayrollReminderUnified();
  }
  
  // طباعة ملخص
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[ScheduledNotifications] 📊 ملخص التذكيرات:`);
  if (results.inventoryResult) {
    console.log(`  - الجرد: ${results.inventoryResult.skipped ? 'تم التخطي' : results.inventoryResult.success ? `✅ ${results.inventoryResult.sentCount} إشعار` : '❌ فشل'}`);
  }
  if (results.payrollResult) {
    console.log(`  - الرواتب: ${results.payrollResult.skipped ? 'تم التخطي' : results.payrollResult.success ? `✅ ${results.payrollResult.sentCount} إشعار` : '❌ فشل'}`);
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
  inventory12: { sent: boolean; time?: string };
  inventory29: { sent: boolean; time?: string };
  payroll29: { sent: boolean; time?: string };
}> {
  const today = new Date().toISOString().split('T')[0];
  
  return {
    date: today,
    inventory12: { sent: await wasNotificationSentTodayDB('inventory_reminder_12') },
    inventory29: { sent: await wasNotificationSentTodayDB('inventory_reminder_29') },
    payroll29: { sent: await wasNotificationSentTodayDB('payroll_reminder_29') },
  };
}
