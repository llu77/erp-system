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
});
