/**
 * خدمة المراقبة الذكية الشاملة
 * تدمج محرك التحليل مع نظام Triggers والإشعارات
 */

import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { 
  dailyRevenues, 
  expenses, 
  branches,
  sentNotifications,
  notificationRecipients 
} from "../../drizzle/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import { analyzeRevenue, analyzeExpense, AnalysisResult, THRESHOLDS } from "./analysisEngine";
import { handleRevenueCreated, handleExpenseCreated } from "./triggerManager";
import { sendAdvancedNotification, NotificationType } from "../notifications/advancedNotificationService";

// ثوابت المراقبة
const MONITORING_CONFIG = {
  // حدود التنبيه
  lowRevenueThreshold: 500,
  highExpenseThreshold: 500,
  criticalDeviationPercent: 50,
  warningDeviationPercent: 30,
  
  // مهل المبررات
  justificationDeadlineHours: 24,
  escalationDeadlineHours: 48,
  
  // جدولة التقارير
  dailyReportHour: 22, // 10 مساءً
  weeklyReportDay: 0, // الأحد
  monthlyReminderDay: 27,
};

/**
 * واجهة نتيجة المراقبة
 */
export interface MonitoringResult {
  timestamp: Date;
  type: "revenue" | "expense" | "report" | "escalation";
  severity: "info" | "warning" | "alert" | "critical";
  analysis: AnalysisResult | null;
  actions: string[];
  notifications: {
    sent: number;
    failed: number;
  };
  chainOfThought?: any[];
}

/**
 * مراقبة إيراد جديد
 */
export async function monitorNewRevenue(revenue: {
  id: number;
  branchId: number;
  date: string;
  cash: number;
  network: number;
  mada: number;
  total: number;
  isMatched: boolean;
  unmatchReason?: string;
}): Promise<MonitoringResult> {
  const startTime = Date.now();
  const actions: string[] = [];
  let notificationsSent = 0;
  let notificationsFailed = 0;
  
  // تحويل البيانات للتحليل
  const revenueData = {
    id: revenue.id,
    branchId: revenue.branchId,
    date: revenue.date,
    cashRevenue: revenue.cash,
    networkRevenue: revenue.network,
    madaRevenue: revenue.mada,
    totalRevenue: revenue.total,
    isMatching: revenue.isMatched,
    mismatchReason: revenue.unmatchReason,
  };
  
  // تحليل الإيراد
  const analysis = await analyzeRevenue(revenueData);
  actions.push(`تحليل الإيراد - الخطورة: ${analysis.severity} (${analysis.severityScore}/100)`);
  
  // التحقق من الحالات الحرجة
  if (analysis.severity === "critical" || analysis.severity === "high") {
    // إرسال طلب مبررات
    const justificationResult = await sendJustificationRequest(revenueData, analysis);
    notificationsSent += justificationResult.sent;
    notificationsFailed += justificationResult.failed;
    actions.push(`إرسال طلب مبررات - ${justificationResult.sent} ناجح، ${justificationResult.failed} فاشل`);
  }
  
  // إرسال الإشعارات العادية
  if (analysis.severity !== "low") {
    const notifyResult = await sendAnalysisNotifications(revenueData, analysis, "revenue");
    notificationsSent += notifyResult.sent;
    notificationsFailed += notifyResult.failed;
    actions.push(`إرسال إشعارات - ${notifyResult.sent} ناجح`);
  }
  
  // تسجيل في السجل
  await logMonitoringEvent("revenue", revenueData, analysis);
  actions.push("تسجيل في سجل المراقبة");
  
  const processingTime = Date.now() - startTime;
  actions.push(`وقت المعالجة: ${processingTime}ms`);
  
  return {
    timestamp: new Date(),
    type: "revenue",
    severity: mapSeverity(analysis.severity),
    analysis,
    actions,
    notifications: {
      sent: notificationsSent,
      failed: notificationsFailed,
    },
    chainOfThought: analysis.chainOfThought,
  };
}

/**
 * مراقبة مصروف جديد
 */
export async function monitorNewExpense(expense: {
  id: number;
  branchId: number;
  category: string;
  amount: number;
  description: string;
  date: string;
}): Promise<MonitoringResult> {
  const startTime = Date.now();
  const actions: string[] = [];
  let notificationsSent = 0;
  let notificationsFailed = 0;
  
  // تحليل المصروف
  const analysis = await analyzeExpense(expense);
  actions.push(`تحليل المصروف - الخطورة: ${analysis.severity}`);
  
  // إرسال الإشعارات إذا كان المصروف مرتفعاً
  if (analysis.severity !== "low") {
    const notifyResult = await sendAnalysisNotifications(expense, analysis, "expense");
    notificationsSent += notifyResult.sent;
    notificationsFailed += notifyResult.failed;
    actions.push(`إرسال إشعارات - ${notifyResult.sent} ناجح`);
  }
  
  // تسجيل في السجل
  await logMonitoringEvent("expense", expense, analysis);
  actions.push("تسجيل في سجل المراقبة");
  
  const processingTime = Date.now() - startTime;
  actions.push(`وقت المعالجة: ${processingTime}ms`);
  
  return {
    timestamp: new Date(),
    type: "expense",
    severity: mapSeverity(analysis.severity),
    analysis,
    actions,
    notifications: {
      sent: notificationsSent,
      failed: notificationsFailed,
    },
    chainOfThought: analysis.chainOfThought,
  };
}

/**
 * توليد التقرير اليومي الذكي
 */
export async function generateSmartDailyReport(date?: Date): Promise<MonitoringResult> {
  const reportDate = date || new Date();
  const dateStr = reportDate.toISOString().split('T')[0];
  const actions: string[] = [];
  let notificationsSent = 0;
  let notificationsFailed = 0;
  
  const db = await getDb();
  
  // جمع بيانات اليوم
  const todayRevenues = await db!
    .select()
    .from(dailyRevenues)
    .where(eq(dailyRevenues.date, reportDate));
  
  const todayExpenses = await db!
    .select()
    .from(expenses)
    .where(gte(expenses.createdAt, new Date(dateStr)));
  
  // جلب أسماء الفروع
  const allBranches = await db!.select().from(branches);
  const branchMap = new Map(allBranches.map(b => [b.id, b.nameAr]));
  
  // حساب الإحصائيات
  const stats = {
    totalRevenue: todayRevenues.reduce((sum, r) => sum + Number(r.total), 0),
    totalExpenses: todayExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
    revenueByBranch: {} as Record<string, number>,
    expensesByBranch: {} as Record<string, number>,
    mismatchedRevenues: todayRevenues.filter(r => !r.isMatched).length,
    highExpenses: todayExpenses.filter(e => Number(e.amount) > MONITORING_CONFIG.highExpenseThreshold).length,
  };
  
  // تجميع حسب الفرع
  for (const rev of todayRevenues) {
    const branchName = branchMap.get(rev.branchId) || "غير معروف";
    stats.revenueByBranch[branchName] = (stats.revenueByBranch[branchName] || 0) + Number(rev.total);
  }
  
  for (const exp of todayExpenses) {
    const branchName = exp.branchId ? branchMap.get(exp.branchId) || "غير معروف" : "عام";
    stats.expensesByBranch[branchName] = (stats.expensesByBranch[branchName] || 0) + Number(exp.amount);
  }
  
  actions.push(`جمع البيانات: ${todayRevenues.length} إيراد، ${todayExpenses.length} مصروف`);
  
  // توليد التقرير بالذكاء الاصطناعي
  const reportContent = await generateAIReport(stats, dateStr);
  actions.push("توليد التقرير بالذكاء الاصطناعي");
  
  // إرسال التقرير
  const notifyResult = await sendDailyReport(reportContent, stats, dateStr);
  notificationsSent = notifyResult.sent;
  notificationsFailed = notifyResult.failed;
  actions.push(`إرسال التقرير - ${notifyResult.sent} ناجح`);
  
  return {
    timestamp: new Date(),
    type: "report",
    severity: stats.mismatchedRevenues > 0 || stats.highExpenses > 0 ? "warning" : "info",
    analysis: null,
    actions,
    notifications: {
      sent: notificationsSent,
      failed: notificationsFailed,
    },
  };
}

/**
 * توليد تقرير ذكي بالـ LLM
 */
async function generateAIReport(stats: any, date: string): Promise<{
  titleAr: string;
  titleEn: string;
  summaryAr: string;
  summaryEn: string;
  insights: string[];
  recommendations: string[];
}> {
  const prompt = `أنت محلل مالي خبير. قم بتحليل البيانات التالية وتوليد تقرير يومي:

## بيانات يوم ${date}:
- إجمالي الإيرادات: ${stats.totalRevenue} ر.س.
- إجمالي المصاريف: ${stats.totalExpenses} ر.س.
- صافي الربح: ${stats.totalRevenue - stats.totalExpenses} ر.س.

## الإيرادات حسب الفرع:
${Object.entries(stats.revenueByBranch).map(([branch, amount]) => `- ${branch}: ${amount} ر.س.`).join("\n")}

## المصاريف حسب الفرع:
${Object.entries(stats.expensesByBranch).map(([branch, amount]) => `- ${branch}: ${amount} ر.س.`).join("\n")}

## تنبيهات:
- إيرادات غير مطابقة: ${stats.mismatchedRevenues}
- مصاريف مرتفعة: ${stats.highExpenses}

قم بتوليد:
1. عنوان التقرير (عربي وإنجليزي)
2. ملخص تنفيذي (جملتين)
3. 3 رؤى/ملاحظات مهمة
4. 2 توصيات عملية

أجب بصيغة JSON.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "أنت محلل مالي خبير. أجب دائماً بصيغة JSON صالحة." },
        { role: "user", content: prompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "daily_report",
          strict: true,
          schema: {
            type: "object",
            properties: {
              titleAr: { type: "string" },
              titleEn: { type: "string" },
              summaryAr: { type: "string" },
              summaryEn: { type: "string" },
              insights: { type: "array", items: { type: "string" } },
              recommendations: { type: "array", items: { type: "string" } }
            },
            required: ["titleAr", "titleEn", "summaryAr", "summaryEn", "insights", "recommendations"],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0].message.content;
    return JSON.parse(typeof content === 'string' ? content : "{}");
  } catch (error) {
    // تقرير بديل
    return {
      titleAr: `التقرير اليومي - ${date}`,
      titleEn: `Daily Report - ${date}`,
      summaryAr: `إجمالي الإيرادات ${stats.totalRevenue} ر.س.، المصاريف ${stats.totalExpenses} ر.س.`,
      summaryEn: `Total revenue ${stats.totalRevenue} SAR, expenses ${stats.totalExpenses} SAR`,
      insights: [
        `صافي الربح: ${stats.totalRevenue - stats.totalExpenses} ر.س.`,
        `عدد الإيرادات غير المطابقة: ${stats.mismatchedRevenues}`,
        `عدد المصاريف المرتفعة: ${stats.highExpenses}`
      ],
      recommendations: [
        "مراجعة الإيرادات غير المطابقة",
        "متابعة المصاريف المرتفعة"
      ]
    };
  }
}

/**
 * إرسال طلب مبررات
 */
async function sendJustificationRequest(
  data: any,
  analysis: AnalysisResult
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  
  const db = await getDb();
  
  // جلب المستلمين
  const recipients = await db!
    .select()
    .from(notificationRecipients)
    .where(eq(notificationRecipients.isActive, true));
  
  // تصفية المستلمين المعنيين
  const targetRecipients = recipients.filter(r => 
    (r.branchId !== null && r.branchId === data.branchId) || 
    r.role === "admin" || 
    r.role === "general_supervisor"
  );
  
  for (const recipient of targetRecipients) {
    try {
      await sendAdvancedNotification({
        type: "low_revenue",
        branchId: data.branchId,
        amount: data.totalRevenue,
        date: data.date,
        reason: analysis.summaryAr,
        customData: {
          requiresJustification: true,
          deadline: analysis.deadline,
          questions: analysis.questions,
          chainOfThought: analysis.chainOfThought,
        },
      });
      sent++;
    } catch (error) {
      failed++;
      console.error(`فشل إرسال طلب مبررات إلى ${recipient.email}:`, error);
    }
  }
  
  return { sent, failed };
}

/**
 * إرسال إشعارات التحليل
 */
async function sendAnalysisNotifications(
  data: any,
  analysis: AnalysisResult,
  type: "revenue" | "expense"
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  
  const notificationType: NotificationType = 
    type === "revenue" ? "low_revenue" : "high_expense";
  
  try {
    await sendAdvancedNotification({
      type: notificationType,
      branchId: data.branchId,
      amount: data.totalRevenue || data.amount,
      date: data.date,
      reason: analysis.summaryAr,
      customData: {
        severity: analysis.severity,
        severityScore: analysis.severityScore,
      },
    });
    sent++;
  } catch (error) {
    failed++;
    console.error("فشل إرسال إشعار التحليل:", error);
  }
  
  return { sent, failed };
}

/**
 * إرسال التقرير اليومي
 */
async function sendDailyReport(
  report: any,
  stats: any,
  date: string
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  
  try {
    await sendAdvancedNotification({
      type: "monthly_report",
      branchId: null,
      date,
      customData: {
        report,
        stats,
      },
    });
    sent++;
  } catch (error) {
    failed++;
    console.error("فشل إرسال التقرير اليومي:", error);
  }
  
  return { sent, failed };
}

/**
 * تسجيل حدث المراقبة
 */
async function logMonitoringEvent(
  eventType: string,
  data: any,
  analysis: AnalysisResult | null
): Promise<void> {
  const db = await getDb();
  
  await db!.insert(sentNotifications).values({
    recipientId: 1,
    recipientEmail: "monitoring@system.local",
    notificationType: "general",
    subject: `Monitoring: ${eventType}`,
    bodyArabic: JSON.stringify({
      eventType,
      data,
      analysis: analysis ? {
        severity: analysis.severity,
        severityScore: analysis.severityScore,
        requiresJustification: analysis.requiresJustification,
      } : null,
      timestamp: new Date().toISOString(),
    }),
    status: "sent",
    sentAt: new Date(),
  });
}

/**
 * تحويل مستوى الخطورة
 */
function mapSeverity(severity: string): "info" | "warning" | "alert" | "critical" {
  switch (severity) {
    case "critical": return "critical";
    case "high": return "alert";
    case "medium": return "warning";
    default: return "info";
  }
}

/**
 * التحقق من المبررات المعلقة
 */
export async function checkPendingJustifications(): Promise<{
  pending: number;
  escalated: number;
  details: any[];
}> {
  // سيتم تنفيذها لاحقاً مع نظام المتابعة
  return {
    pending: 0,
    escalated: 0,
    details: [],
  };
}

export { MONITORING_CONFIG };
