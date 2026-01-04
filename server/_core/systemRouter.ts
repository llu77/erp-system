import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { 
  startScheduler, 
  stopScheduler, 
  getSchedulerStatus,
  checkMissingRevenues,
  sendWeeklyReports,
  getJobs,
  getJob,
  toggleJob,
  runJobManually,
  getExecutions,
  getDeadLetterQueue as getSchedulerDeadLetter,
  retryDeadLetter as retrySchedulerDeadLetter,
  clearDeadLetterQueue,
} from "../scheduler/cronScheduler";
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

  // ==================== APIs الجدولة المتقدمة ====================

  // الحصول على قائمة المهام المجدولة
  getScheduledJobs: adminProcedure
    .query(() => {
      return getJobs();
    }),

  // الحصول على مهمة بمعرفها
  getScheduledJob: adminProcedure
    .input(z.object({ jobId: z.string() }))
    .query(({ input }) => {
      return getJob(input.jobId);
    }),

  // تفعيل/تعطيل مهمة
  toggleScheduledJob: adminProcedure
    .input(z.object({ jobId: z.string(), isActive: z.boolean() }))
    .mutation(({ input }) => {
      const success = toggleJob(input.jobId, input.isActive);
      return {
        success,
        message: success 
          ? `تم ${input.isActive ? 'تفعيل' : 'تعطيل'} المهمة`
          : 'المهمة غير موجودة'
      };
    }),

  // تشغيل مهمة يدوياً
  runScheduledJobManually: adminProcedure
    .input(z.object({ jobId: z.string() }))
    .mutation(async ({ input }) => {
      return await runJobManually(input.jobId);
    }),

  // الحصول على سجل التنفيذات
  getJobExecutions: adminProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(({ input }) => {
      return getExecutions(input?.limit || 20);
    }),

  // الحصول على Dead Letter Queue للجدولة
  getSchedulerDeadLetter: adminProcedure
    .query(() => {
      return getSchedulerDeadLetter();
    }),

  // إعادة محاولة مهمة فاشلة
  retrySchedulerDeadLetter: adminProcedure
    .input(z.object({ jobId: z.string() }))
    .mutation(async ({ input }) => {
      const success = await retrySchedulerDeadLetter(input.jobId);
      return {
        success,
        message: success ? 'تم إعادة تشغيل المهمة' : 'فشل إعادة التشغيل'
      };
    }),

  // مسح Dead Letter Queue
  clearSchedulerDeadLetter: adminProcedure
    .mutation(() => {
      const count = clearDeadLetterQueue();
      return {
        success: true,
        count,
        message: `تم مسح ${count} مهمة فاشلة`
      };
    }),
});
