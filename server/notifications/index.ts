/**
 * نقطة الدخول الرئيسية لنظام الإشعارات
 * =====================================
 * 
 * يُصدّر هذا الملف جميع دوال الإشعارات الموحدة
 * استخدم هذا الملف بدلاً من استيراد الملفات الفرعية مباشرة
 */

// تصدير من الخدمة الموحدة
export {
  // دوال الإرسال
  sendLowRevenueAlert,
  sendHighExpenseAlert,
  sendMissingRevenueReminder,
  sendInventoryReminder,
  sendPayrollReminder,
  sendGeneralNotification,
  sendCustomNotification,
  
  // دوال إدارة Queue
  getQueueStats,
  getDeadLetterNotifications,
  retryFailedNotification,
  retryAllFailedNotifications,
  startNotificationQueue,
  stopNotificationQueue,
  
  // الأنواع
  type NotificationRecipient,
  type NotificationOptions,
} from './unifiedNotificationService';

// تصدير من Queue مباشرة للاستخدام المتقدم
export {
  queueEmailNotification,
  queueBatchNotifications,
  notificationQueue,
  type QueuedNotification,
  type NotificationQueueType,
} from './notificationQueue';

// تصدير الخدمات القديمة للتوافقية
export * as advancedNotificationService from './advancedNotificationService';
export * as emailNotificationService from './emailNotificationService';
export * as scheduledNotificationService from './scheduledNotificationService';
