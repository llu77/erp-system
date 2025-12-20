/**
 * نظام Triggers للأتمتة
 * يدير الأحداث والإجراءات التلقائية
 */

import { analyzeRevenue, analyzeExpense, AnalysisResult } from "./analysisEngine";
import { sendAdvancedNotification, NotificationType } from "../notifications/advancedNotificationService";
import { getDb } from "../db";
import { notificationRecipients, sentNotifications } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// أنواع الـ Triggers
export type TriggerType = 
  | "onRevenueCreated"
  | "onExpenseCreated"
  | "onMismatchDetected"
  | "onDailyReport"
  | "onWeeklyReport"
  | "onJustificationRequired"
  | "onJustificationReceived";

export interface TriggerEvent {
  type: TriggerType;
  data: any;
  timestamp: Date;
  branchId?: number;
  userId?: number;
}

export interface TriggerAction {
  type: "analyze" | "notify" | "export" | "escalate" | "log";
  target?: string;
  data?: any;
}

// ثوابت الـ Triggers
const TRIGGER_CONFIG = {
  lowRevenueThreshold: 500,
  highExpenseThreshold: 500,
  criticalDeviationPercent: 50,
  justificationDeadlineHours: 24,
  escalationDeadlineHours: 48,
};

/**
 * معالج Trigger إنشاء إيراد
 */
export async function handleRevenueCreated(revenue: {
  id: number;
  branchId: number;
  date: string;
  cashRevenue: number;
  networkRevenue: number;
  madaRevenue: number;
  totalRevenue: number;
  isMatching: boolean;
  mismatchReason?: string;
}): Promise<{ analysis: AnalysisResult; actions: string[] }> {
  const actions: string[] = [];
  
  // تحليل الإيراد
  const analysis = await analyzeRevenue(revenue);
  actions.push(`تحليل الإيراد - الخطورة: ${analysis.severity}`);
  
  // تحديد الإجراءات بناءً على التحليل
  if (analysis.requiresJustification) {
    // إرسال طلب مبررات
    await sendJustificationRequest(revenue, analysis);
    actions.push("إرسال طلب مبررات للمشرف");
  }
  
  // إرسال الإشعارات
  for (const notification of analysis.notifications) {
    await sendTriggerNotification(notification, revenue, analysis);
    actions.push(`إشعار ${notification.role} - ${notification.type}`);
  }
  
  // تسجيل في قاعدة البيانات
  await logTriggerExecution("onRevenueCreated", revenue, analysis);
  actions.push("تسجيل في سجل التنفيذ");
  
  return { analysis, actions };
}

/**
 * معالج Trigger إنشاء مصروف
 */
export async function handleExpenseCreated(expense: {
  id: number;
  branchId: number;
  category: string;
  amount: number;
  description: string;
  date: string;
}): Promise<{ analysis: AnalysisResult; actions: string[] }> {
  const actions: string[] = [];
  
  // تحليل المصروف
  const analysis = await analyzeExpense(expense);
  actions.push(`تحليل المصروف - الخطورة: ${analysis.severity}`);
  
  // إرسال الإشعارات إذا كان المصروف مرتفعاً
  if (analysis.severity !== "low") {
    for (const notification of analysis.notifications) {
      await sendTriggerNotification(notification, expense, analysis);
      actions.push(`إشعار ${notification.role} - ${notification.type}`);
    }
  }
  
  // تسجيل في قاعدة البيانات
  await logTriggerExecution("onExpenseCreated", expense, analysis);
  actions.push("تسجيل في سجل التنفيذ");
  
  return { analysis, actions };
}

/**
 * إرسال طلب مبررات
 */
async function sendJustificationRequest(
  data: any,
  analysis: AnalysisResult
): Promise<void> {
  const db = await getDb();
  
  // جلب مستلمي الإشعارات للفرع
  const recipients = await db!
    .select()
    .from(notificationRecipients)
    .where(
      and(
        eq(notificationRecipients.isActive, true),
        eq(notificationRecipients.branchId, data.branchId)
      )
    );
  
  // إضافة المستلمين العامين (الأدمن والمشرف العام - branchId = null)
  const globalRecipients = await db!
    .select()
    .from(notificationRecipients)
    .where(eq(notificationRecipients.isActive, true));
  
  const allRecipients = [...recipients, ...globalRecipients];
  
  // إنشاء محتوى طلب المبررات
  const content = `
## 🔴 طلب مبررات عاجل

### تفاصيل الإيراد:
- **التاريخ:** ${data.date}
- **المبلغ:** ${data.totalRevenue} ر.س.
- **حالة الموازنة:** ${data.isMatching ? "مطابق" : "غير مطابق"}

### التحليل:
${analysis.summaryAr}

### مستوى الخطورة: ${analysis.severity === "critical" ? "حرج 🔴" : analysis.severity === "high" ? "عالي 🟠" : "متوسط 🟡"}

### الأسئلة المطلوب الإجابة عليها:
${analysis.questions?.map((q, i) => `${i + 1}. ${q}`).join("\n") || "لا توجد أسئلة محددة"}

### المهلة: ${analysis.deadline}

---
يرجى الرد على هذا البريد مع توضيح الأسباب.
  `.trim();
  
  // إرسال لكل مستلم
  for (const recipient of allRecipients) {
    try {
      await sendAdvancedNotification({
        type: "low_revenue" as NotificationType,
        branchId: data.branchId,
        amount: data.totalRevenue,
        date: data.date,
        reason: analysis.summaryAr,
        customData: {
          analysis: analysis.summaryAr,
          questions: analysis.questions,
        },
      });
    } catch (error) {
      console.error(`فشل إرسال طلب مبررات إلى ${recipient.email}:`, error);
    }
  }
}

/**
 * إرسال إشعار Trigger
 */
async function sendTriggerNotification(
  notification: any,
  data: any,
  analysis: AnalysisResult
): Promise<void> {
  const notificationType: NotificationType = 
    notification.type === "justificationRequest" ? "low_revenue" :
    notification.type === "alert" ? "high_expense" :
    "general";
  
  await sendAdvancedNotification({
    type: notificationType,
    branchId: data.branchId,
    amount: data.totalRevenue || data.amount,
    date: data.date,
    reason: analysis.summaryAr,
    customData: {
      severity: analysis.severity,
      summary: analysis.summaryAr,
    },
  });
}

/**
 * تسجيل تنفيذ Trigger
 */
async function logTriggerExecution(
  triggerType: TriggerType,
  data: any,
  analysis: AnalysisResult
): Promise<void> {
  const db = await getDb();
  
  await db!.insert(sentNotifications).values({
    recipientId: 1, // سجل النظام
    recipientEmail: "system@erp.local",
    notificationType: "general",
    subject: `Trigger: ${triggerType}`,
    bodyArabic: JSON.stringify({
      triggerType,
      data,
      analysis: {
        severity: analysis.severity,
        severityScore: analysis.severityScore,
        summary: analysis.summary,
        requiresJustification: analysis.requiresJustification,
      },
    }),
    status: "sent",
    sentAt: new Date(),
  });
}

/**
 * التحقق من المبررات المعلقة وتصعيدها
 */
export async function checkPendingJustifications(): Promise<{
  pending: number;
  escalated: number;
}> {
  // هذه الدالة ستتحقق من المبررات المعلقة وتصعيدها إذا تجاوزت المهلة
  // سيتم تنفيذها لاحقاً مع نظام المتابعة
  return { pending: 0, escalated: 0 };
}

/**
 * توليد التقرير اليومي
 */
export async function generateDailyReport(date?: Date): Promise<{
  report: string;
  sent: boolean;
}> {
  const reportDate = date || new Date();
  
  // جمع بيانات اليوم
  // سيتم تنفيذها لاحقاً مع نظام التقارير
  
  return {
    report: `تقرير يوم ${reportDate.toISOString().split('T')[0]}`,
    sent: false,
  };
}

/**
 * توليد التقرير الأسبوعي
 */
export async function generateWeeklyReport(): Promise<{
  report: string;
  sent: boolean;
}> {
  // سيتم تنفيذها لاحقاً مع نظام التقارير
  return {
    report: "التقرير الأسبوعي",
    sent: false,
  };
}

export { TRIGGER_CONFIG };
