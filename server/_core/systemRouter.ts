import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { 
  startScheduler, 
  stopScheduler, 
  getSchedulerStatus,
  checkMissingRevenues,
  sendWeeklyReports
} from "../scheduler/taskScheduler";
import {
  getQueueStats,
  getDeadLetterNotifications,
  retryFailedNotification,
  retryAllFailedNotifications,
  startNotificationQueue,
  stopNotificationQueue,
} from "../notifications/notificationQueue";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  // ==================== APIs الجدولة ====================

  // الحصول على حالة نظام الجدولة
  getSchedulerStatus: adminProcedure
    .query(() => {
      return getSchedulerStatus();
    }),

  // تشغيل نظام الجدولة
  startScheduler: adminProcedure
    .mutation(() => {
      startScheduler();
      return { success: true, message: "تم تشغيل نظام الجدولة" };
    }),

  // إيقاف نظام الجدولة
  stopScheduler: adminProcedure
    .mutation(() => {
      stopScheduler();
      return { success: true, message: "تم إيقاف نظام الجدولة" };
    }),

  // تشغيل فحص الإيرادات غير المسجلة يدوياً
  runDailyReminder: adminProcedure
    .mutation(async () => {
      const result = await checkMissingRevenues();
      return {
        success: true,
        ...result,
        message: `تم فحص ${result.checked} فرع، ${result.missing} فرع بدون إيراد، تم إرسال ${result.sent} تذكير`
      };
    }),

  // تشغيل التقارير الأسبوعية يدوياً
  runWeeklyReport: adminProcedure
    .mutation(async () => {
      const result = await sendWeeklyReports();
      return {
        success: true,
        ...result,
        message: `تم إرسال ${result.sent}/${result.total} تقرير أسبوعي`
      };
    }),

  // ==================== APIs Queue الإشعارات ====================

  // الحصول على إحصائيات Queue
  getNotificationQueueStats: adminProcedure
    .query(() => {
      return getQueueStats();
    }),

  // الحصول على الإشعارات الفاشلة (Dead Letter)
  getDeadLetterNotifications: adminProcedure
    .query(() => {
      return getDeadLetterNotifications();
    }),

  // إعادة محاولة إشعار فاشل
  retryFailedNotification: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const success = await retryFailedNotification(input.id);
      return {
        success,
        message: success ? 'تم إعادة الإشعار إلى Queue' : 'لم يتم العثور على الإشعار'
      };
    }),

  // إعادة محاولة جميع الإشعارات الفاشلة
  retryAllFailedNotifications: adminProcedure
    .mutation(async () => {
      const count = await retryAllFailedNotifications();
      return {
        success: true,
        count,
        message: `تم إعادة ${count} إشعار إلى Queue`
      };
    }),

  // تشغيل Queue الإشعارات
  startNotificationQueue: adminProcedure
    .mutation(() => {
      startNotificationQueue();
      return { success: true, message: 'تم تشغيل Queue الإشعارات' };
    }),

  // إيقاف Queue الإشعارات
  stopNotificationQueue: adminProcedure
    .mutation(() => {
      stopNotificationQueue();
      return { success: true, message: 'تم إيقاف Queue الإشعارات' };
    }),
});
