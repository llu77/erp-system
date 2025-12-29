/**
 * نظام تتبع الإشعارات لمنع التكرار
 * يتتبع الإشعارات المرسلة ويمنع إرسالها أكثر من مرة في اليوم
 */

import * as fs from 'fs';
import * as path from 'path';

// أنواع الإشعارات المتتبعة
export type TrackedNotificationType = 
  | 'inventory_reminder'
  | 'payroll_reminder'
  | 'monthly_inventory_reminder'
  | 'weekly_report'
  | 'daily_revenue_reminder'
  | 'low_stock_alert';

// واجهة سجل الإشعار
interface NotificationRecord {
  type: TrackedNotificationType;
  date: string; // YYYY-MM-DD
  sentAt: string; // ISO string
  recipientCount: number;
  details?: string;
}

// تخزين مؤقت في الذاكرة
const memoryCache: Map<string, NotificationRecord> = new Map();

// مسار ملف التتبع
const TRACKER_FILE = path.join(process.cwd(), '.notification-tracker.json');

/**
 * الحصول على تاريخ اليوم بصيغة YYYY-MM-DD
 */
export function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * إنشاء مفتاح فريد للإشعار
 */
function createKey(type: TrackedNotificationType, date: string): string {
  return `${type}:${date}`;
}

/**
 * تحميل السجلات من الملف
 */
function loadFromFile(): void {
  try {
    if (fs.existsSync(TRACKER_FILE)) {
      const data = JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf-8'));
      const today = getTodayDate();
      
      // تحميل فقط سجلات اليوم
      Object.entries(data).forEach(([key, record]: [string, any]) => {
        if (key.endsWith(`:${today}`)) {
          memoryCache.set(key, record as NotificationRecord);
        }
      });
      console.log(`[NotificationTracker] تم تحميل ${memoryCache.size} سجل من الملف`);
    }
  } catch (error) {
    console.error('[NotificationTracker] خطأ في تحميل الملف:', error);
  }
}

/**
 * حفظ السجلات إلى الملف
 */
function saveToFile(): void {
  try {
    const data: Record<string, NotificationRecord> = {};
    memoryCache.forEach((record, key) => {
      data[key] = record;
    });
    fs.writeFileSync(TRACKER_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('[NotificationTracker] خطأ في حفظ الملف:', error);
  }
}

// تحميل السجلات عند بدء التشغيل
loadFromFile();

/**
 * التحقق مما إذا كان الإشعار قد أُرسل اليوم
 */
export async function wasNotificationSentToday(type: TrackedNotificationType): Promise<boolean> {
  const today = getTodayDate();
  const key = createKey(type, today);
  
  // فحص الذاكرة المؤقتة
  if (memoryCache.has(key)) {
    const record = memoryCache.get(key)!;
    const sentTime = new Date(record.sentAt).toLocaleTimeString('ar-SA');
    console.log(`[NotificationTracker] ⚠️ الإشعار ${type} أُرسل مسبقاً اليوم في ${sentTime}`);
    return true;
  }
  
  return false;
}

/**
 * تسجيل إرسال الإشعار
 */
export async function markNotificationAsSent(
  type: TrackedNotificationType,
  recipientCount: number,
  details?: string
): Promise<void> {
  const today = getTodayDate();
  const key = createKey(type, today);
  const now = new Date();
  
  // تحديث الذاكرة المؤقتة
  memoryCache.set(key, {
    type,
    date: today,
    sentAt: now.toISOString(),
    recipientCount,
    details,
  });
  
  // حفظ في الملف
  saveToFile();
  console.log(`[NotificationTracker] ✅ تم تسجيل الإشعار ${type} - ${recipientCount} مستلم`);
}

/**
 * التحقق والإرسال مع منع التكرار
 * يُرجع true إذا تم الإرسال، false إذا تم التخطي
 */
export async function checkAndSend(
  type: TrackedNotificationType,
  sendFunction: () => Promise<{ success: boolean; sentCount?: number; recipientCount?: number }>
): Promise<{ sent: boolean; skipped: boolean; reason?: string; result?: any }> {
  // التحقق من الإرسال السابق
  const alreadySent = await wasNotificationSentToday(type);
  
  if (alreadySent) {
    console.log(`[NotificationTracker] ⏭️ تخطي ${type} - تم الإرسال مسبقاً اليوم`);
    return {
      sent: false,
      skipped: true,
      reason: 'تم إرسال هذا الإشعار مسبقاً اليوم',
    };
  }
  
  // تنفيذ الإرسال
  try {
    console.log(`[NotificationTracker] 📤 إرسال ${type}...`);
    const result = await sendFunction();
    
    if (result.success) {
      const count = result.sentCount || result.recipientCount || 1;
      await markNotificationAsSent(type, count, `تم الإرسال بنجاح إلى ${count} مستلم`);
      console.log(`[NotificationTracker] ✅ تم إرسال ${type} بنجاح`);
      return {
        sent: true,
        skipped: false,
        result,
      };
    } else {
      console.log(`[NotificationTracker] ❌ فشل إرسال ${type}`);
      return {
        sent: false,
        skipped: false,
        reason: 'فشل في الإرسال',
        result,
      };
    }
  } catch (error) {
    console.error(`[NotificationTracker] خطأ في إرسال ${type}:`, error);
    return {
      sent: false,
      skipped: false,
      reason: error instanceof Error ? error.message : 'خطأ غير معروف',
    };
  }
}

/**
 * مسح الذاكرة المؤقتة (للاختبارات)
 */
export function clearCache(): void {
  memoryCache.clear();
  // حذف الملف أيضاً
  try {
    if (fs.existsSync(TRACKER_FILE)) {
      fs.unlinkSync(TRACKER_FILE);
    }
  } catch (error) {
    console.error('[NotificationTracker] خطأ في حذف الملف:', error);
  }
}

/**
 * الحصول على سجلات اليوم
 */
export async function getTodayRecords(): Promise<NotificationRecord[]> {
  const today = getTodayDate();
  const records: NotificationRecord[] = [];
  
  memoryCache.forEach((record, key) => {
    if (key.endsWith(`:${today}`)) {
      records.push(record);
    }
  });
  
  return records;
}

/**
 * الحصول على حالة الإشعارات اليوم
 */
export async function getNotificationStatus(): Promise<{
  date: string;
  notifications: {
    type: TrackedNotificationType;
    sent: boolean;
    sentAt?: string;
    recipientCount?: number;
  }[];
}> {
  const today = getTodayDate();
  const types: TrackedNotificationType[] = [
    'inventory_reminder',
    'payroll_reminder',
    'monthly_inventory_reminder',
    'weekly_report',
    'daily_revenue_reminder',
    'low_stock_alert',
  ];
  
  const notifications = await Promise.all(
    types.map(async (type) => {
      const sent = await wasNotificationSentToday(type);
      const key = createKey(type, today);
      const record = memoryCache.get(key);
      
      return {
        type,
        sent,
        sentAt: record?.sentAt,
        recipientCount: record?.recipientCount,
      };
    })
  );
  
  return { date: today, notifications };
}
