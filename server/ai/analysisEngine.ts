/**
 * محرك التحليل الذكي - AI Analysis Engine
 * يستخدم Claude/GPT مع Chain of Thought للتحليل العميق
 */

import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { dailyRevenues, expenses, branches } from "../../drizzle/schema";
import { eq, and, gte, lte, desc, avg } from "drizzle-orm";

// أنواع البيانات
export interface AnalysisContext {
  type: "revenue" | "expense" | "weekly" | "justification";
  data: any;
  historicalData?: any;
  branchId?: number;
  branchName?: string;
}

export interface AnalysisResult {
  severity: "low" | "medium" | "high" | "critical";
  severityScore: number;
  chainOfThought: ChainOfThoughtStep[];
  summary: string;
  summaryAr: string;
  questions?: string[];
  recommendations?: string[];
  requiresJustification: boolean;
  deadline?: string;
  notifications: NotificationTarget[];
}

export interface ChainOfThoughtStep {
  step: number;
  name: string;
  nameAr: string;
  action: string;
  data: any;
  reasoning: string;
  reasoningAr: string;
}

export interface NotificationTarget {
  role: "branchSupervisor" | "generalSupervisor" | "admin";
  email?: string;
  type: "alert" | "justificationRequest" | "info" | "escalation";
  priority: "low" | "medium" | "high" | "urgent";
}

// ثوابت التحليل
const THRESHOLDS = {
  lowRevenue: 500,
  highExpense: 500,
  criticalDeviationPercent: 50,
  warningDeviationPercent: 30,
  justificationDeadlineHours: 24,
  escalationDeadlineHours: 48,
};

/**
 * تحليل الإيرادات مع Chain of Thought
 */
export async function analyzeRevenue(
  revenue: {
    id: number;
    branchId: number;
    date: string;
    cashRevenue: number;
    networkRevenue: number;
    madaRevenue: number;
    totalRevenue: number;
    isMatching: boolean;
    mismatchReason?: string;
  }
): Promise<AnalysisResult> {
  const chainOfThought: ChainOfThoughtStep[] = [];
  
  // الخطوة 1: جمع السياق والبيانات التاريخية
  const step1 = await gatherRevenueContext(revenue);
  chainOfThought.push(step1);
  
  // الخطوة 2: تحليل الانحراف
  const step2 = analyzeDeviation(revenue.totalRevenue, step1.data);
  chainOfThought.push(step2);
  
  // الخطوة 3: تقييم مستوى الخطورة
  const step3 = assessSeverity(step2.data, revenue.isMatching);
  chainOfThought.push(step3);
  
  // الخطوة 4: استخدام LLM للتحليل العميق
  const step4 = await deepAnalysisWithLLM(revenue, step1.data, step2.data, step3.data);
  chainOfThought.push(step4);
  
  // الخطوة 5: توليد الأسئلة والتوصيات
  const step5 = generateQuestionsAndRecommendations(step3.data, step4.data);
  chainOfThought.push(step5);
  
  // الخطوة 6: تحديد الإجراءات
  const step6 = determineActions(step3.data, revenue.branchId);
  chainOfThought.push(step6);
  
  return {
    severity: step3.data.severity,
    severityScore: step3.data.severityScore,
    chainOfThought,
    summary: step4.data.summary,
    summaryAr: step4.data.summaryAr,
    questions: step5.data.questions,
    recommendations: step5.data.recommendations,
    requiresJustification: step3.data.requiresJustification,
    deadline: step3.data.requiresJustification ? `${THRESHOLDS.justificationDeadlineHours} ساعة` : undefined,
    notifications: step6.data.notifications,
  };
}

/**
 * الخطوة 1: جمع السياق والبيانات التاريخية
 */
async function gatherRevenueContext(revenue: any): Promise<ChainOfThoughtStep> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // جلب البيانات التاريخية
  const db = await getDb();
  const historicalRevenues = await db!
    .select()
    .from(dailyRevenues)
    .where(
      and(
        eq(dailyRevenues.branchId, revenue.branchId),
        gte(dailyRevenues.date, thirtyDaysAgo)
      )
    )
    .orderBy(desc(dailyRevenues.date));
  
  // حساب المتوسطات
  const totalRevenues = historicalRevenues.map((r: typeof dailyRevenues.$inferSelect) => Number(r.total) || 0);
  const avgRevenue = totalRevenues.length > 0 
    ? totalRevenues.reduce((a: number, b: number) => a + b, 0) / totalRevenues.length 
    : 0;
  
  // حساب متوسط نفس اليوم من الأسبوع
  const dayOfWeek = new Date(revenue.date).getDay();
  const sameDayRevenues = historicalRevenues.filter((r: typeof dailyRevenues.$inferSelect) => 
    new Date(r.date).getDay() === dayOfWeek
  );
  const sameDayAvg = sameDayRevenues.length > 0
    ? sameDayRevenues.map((r: typeof dailyRevenues.$inferSelect) => Number(r.total) || 0).reduce((a: number, b: number) => a + b, 0) / sameDayRevenues.length
    : avgRevenue;
  
  // الحد الأدنى والأقصى
  const minRevenue = Math.min(...totalRevenues, revenue.totalRevenue);
  const maxRevenue = Math.max(...totalRevenues, revenue.totalRevenue);
  
  // جلب اسم الفرع
  const branch = await db!
    .select()
    .from(branches)
    .where(eq(branches.id, revenue.branchId))
    .limit(1);
  
  const contextData = {
    branchName: branch[0]?.nameAr || "غير معروف",
    averageRevenue: Math.round(avgRevenue),
    sameDayAverage: Math.round(sameDayAvg),
    lastWeekSameDay: Number(sameDayRevenues[0]?.total) || avgRevenue,
    last30DaysMin: minRevenue,
    last30DaysMax: maxRevenue,
    dataPointsCount: historicalRevenues.length,
    dayOfWeekAr: getDayNameAr(dayOfWeek),
  };
  
  return {
    step: 1,
    name: "Context Gathering",
    nameAr: "جمع السياق",
    action: "جمع البيانات التاريخية للـ 30 يوم الماضية",
    data: contextData,
    reasoning: `Collected ${historicalRevenues.length} historical data points for branch ${revenue.branchId}`,
    reasoningAr: `تم جمع ${historicalRevenues.length} نقطة بيانات تاريخية لفرع ${contextData.branchName}`,
  };
}

/**
 * الخطوة 2: تحليل الانحراف
 */
function analyzeDeviation(currentRevenue: number, contextData: any): ChainOfThoughtStep {
  const deviationFromAvg = contextData.averageRevenue > 0
    ? ((currentRevenue - contextData.averageRevenue) / contextData.averageRevenue) * 100
    : 0;
  
  const deviationFromSameDay = contextData.sameDayAverage > 0
    ? ((currentRevenue - contextData.sameDayAverage) / contextData.sameDayAverage) * 100
    : 0;
  
  const isHistoricalLow = currentRevenue < contextData.last30DaysMin;
  const isHistoricalHigh = currentRevenue > contextData.last30DaysMax;
  
  const deviationData = {
    currentRevenue,
    deviationFromAverage: Math.round(deviationFromAvg * 10) / 10,
    deviationFromSameDay: Math.round(deviationFromSameDay * 10) / 10,
    isHistoricalLow,
    isHistoricalHigh,
    isSignificantDeviation: Math.abs(deviationFromAvg) > THRESHOLDS.warningDeviationPercent,
    isCriticalDeviation: Math.abs(deviationFromAvg) > THRESHOLDS.criticalDeviationPercent,
  };
  
  return {
    step: 2,
    name: "Deviation Analysis",
    nameAr: "تحليل الانحراف",
    action: "حساب نسبة الانحراف عن المتوسطات",
    data: deviationData,
    reasoning: `Revenue ${currentRevenue} deviates ${deviationFromAvg.toFixed(1)}% from average ${contextData.averageRevenue}`,
    reasoningAr: `الإيراد ${currentRevenue} ينحرف ${deviationFromAvg.toFixed(1)}% عن المتوسط ${contextData.averageRevenue}`,
  };
}

/**
 * الخطوة 3: تقييم مستوى الخطورة
 */
function assessSeverity(deviationData: any, isMatching: boolean): ChainOfThoughtStep {
  let severityScore = 0;
  const rules: { condition: string; points: number; matched: boolean }[] = [];
  
  // قاعدة 1: الإيراد أقل من الحد الأدنى
  if (deviationData.currentRevenue < THRESHOLDS.lowRevenue) {
    severityScore += 30;
    rules.push({ condition: `إيراد أقل من ${THRESHOLDS.lowRevenue}`, points: 30, matched: true });
  }
  
  // قاعدة 2: انحراف حرج
  if (deviationData.isCriticalDeviation && deviationData.deviationFromAverage < 0) {
    severityScore += 35;
    rules.push({ condition: "انحراف حرج (> 50%)", points: 35, matched: true });
  } else if (deviationData.isSignificantDeviation && deviationData.deviationFromAverage < 0) {
    severityScore += 20;
    rules.push({ condition: "انحراف ملحوظ (> 30%)", points: 20, matched: true });
  }
  
  // قاعدة 3: أقل من الحد الأدنى التاريخي
  if (deviationData.isHistoricalLow) {
    severityScore += 25;
    rules.push({ condition: "أقل من الحد الأدنى التاريخي", points: 25, matched: true });
  }
  
  // قاعدة 4: عدم التطابق
  if (!isMatching) {
    severityScore += 15;
    rules.push({ condition: "عدم تطابق الموازنة", points: 15, matched: true });
  }
  
  // تحديد مستوى الخطورة
  let severity: "low" | "medium" | "high" | "critical";
  if (severityScore >= 70) severity = "critical";
  else if (severityScore >= 50) severity = "high";
  else if (severityScore >= 30) severity = "medium";
  else severity = "low";
  
  const requiresJustification = severity === "critical" || severity === "high" || !isMatching;
  
  return {
    step: 3,
    name: "Severity Assessment",
    nameAr: "تقييم الخطورة",
    action: "تحديد مستوى الخطورة بناءً على القواعد",
    data: {
      severity,
      severityScore,
      rules: rules.filter(r => r.matched),
      requiresJustification,
    },
    reasoning: `Severity score ${severityScore}/100 based on ${rules.filter(r => r.matched).length} matched rules`,
    reasoningAr: `درجة الخطورة ${severityScore}/100 بناءً على ${rules.filter(r => r.matched).length} قواعد مطابقة`,
  };
}

/**
 * الخطوة 4: التحليل العميق باستخدام LLM
 */
async function deepAnalysisWithLLM(
  revenue: any,
  contextData: any,
  deviationData: any,
  severityData: any
): Promise<ChainOfThoughtStep> {
  const prompt = `أنت محلل مالي خبير لنظام ERP. قم بتحليل الإيراد التالي:

## البيانات الحالية:
- الفرع: ${contextData.branchName}
- التاريخ: ${revenue.date} (${contextData.dayOfWeekAr})
- الإيراد الإجمالي: ${revenue.totalRevenue} ر.س.
- نقدي: ${revenue.cashRevenue} | شبكة: ${revenue.networkRevenue} | مدى: ${revenue.madaRevenue}
- حالة الموازنة: ${revenue.isMatching ? "مطابق" : "غير مطابق"}
${revenue.mismatchReason ? `- سبب عدم التطابق: ${revenue.mismatchReason}` : ""}

## البيانات التاريخية:
- متوسط الإيراد (30 يوم): ${contextData.averageRevenue} ر.س.
- متوسط ${contextData.dayOfWeekAr}: ${contextData.sameDayAverage} ر.س.
- الحد الأدنى (30 يوم): ${contextData.last30DaysMin} ر.س.
- الحد الأقصى (30 يوم): ${contextData.last30DaysMax} ر.س.

## تحليل الانحراف:
- الانحراف عن المتوسط: ${deviationData.deviationFromAverage}%
- الانحراف عن متوسط ${contextData.dayOfWeekAr}: ${deviationData.deviationFromSameDay}%
- هل هو أقل إيراد تاريخياً؟ ${deviationData.isHistoricalLow ? "نعم" : "لا"}

## مستوى الخطورة: ${severityData.severity} (${severityData.severityScore}/100)

قم بتقديم:
1. ملخص موجز للوضع (جملتين)
2. 3 فرضيات محتملة للأسباب مع نسبة احتمال لكل منها
3. هل هذا الوضع يستدعي القلق؟

أجب بصيغة JSON:
{
  "summary": "ملخص بالإنجليزية",
  "summaryAr": "ملخص بالعربية",
  "hypotheses": [
    {"reason": "السبب", "probability": 40},
    {"reason": "السبب", "probability": 35},
    {"reason": "السبب", "probability": 25}
  ],
  "concernLevel": "none|low|moderate|high",
  "additionalInsights": "ملاحظات إضافية"
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "أنت محلل مالي خبير. أجب دائماً بصيغة JSON صالحة." },
        { role: "user", content: prompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "revenue_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              summaryAr: { type: "string" },
              hypotheses: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    reason: { type: "string" },
                    probability: { type: "number" }
                  },
                  required: ["reason", "probability"],
                  additionalProperties: false
                }
              },
              concernLevel: { type: "string", enum: ["none", "low", "moderate", "high"] },
              additionalInsights: { type: "string" }
            },
            required: ["summary", "summaryAr", "hypotheses", "concernLevel", "additionalInsights"],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0].message.content;
    const analysis = JSON.parse(typeof content === 'string' ? content : "{}");
    
    return {
      step: 4,
      name: "Deep Analysis with LLM",
      nameAr: "التحليل العميق بالذكاء الاصطناعي",
      action: "استخدام Claude/GPT للتحليل المتقدم",
      data: analysis,
      reasoning: `LLM analysis completed with concern level: ${analysis.concernLevel}`,
      reasoningAr: `اكتمل التحليل بالذكاء الاصطناعي - مستوى القلق: ${analysis.concernLevel}`,
    };
  } catch (error) {
    // في حالة فشل LLM، نستخدم تحليل بديل
    return {
      step: 4,
      name: "Deep Analysis (Fallback)",
      nameAr: "التحليل العميق (بديل)",
      action: "تحليل بديل بسبب عدم توفر LLM",
      data: {
        summary: `Revenue of ${revenue.totalRevenue} SAR shows ${deviationData.deviationFromAverage}% deviation from average`,
        summaryAr: `إيراد ${revenue.totalRevenue} ر.س. يظهر انحرافاً بنسبة ${deviationData.deviationFromAverage}% عن المتوسط`,
        hypotheses: [
          { reason: "ظروف تشغيلية غير معتادة", probability: 40 },
          { reason: "مشكلة في التسجيل", probability: 35 },
          { reason: "عوامل خارجية", probability: 25 }
        ],
        concernLevel: severityData.severity === "critical" ? "high" : severityData.severity,
        additionalInsights: "يُنصح بالتحقق من سجلات الفرع"
      },
      reasoning: "Fallback analysis used due to LLM unavailability",
      reasoningAr: "تم استخدام التحليل البديل بسبب عدم توفر الذكاء الاصطناعي",
    };
  }
}

/**
 * الخطوة 5: توليد الأسئلة والتوصيات
 */
function generateQuestionsAndRecommendations(
  severityData: any,
  llmAnalysis: any
): ChainOfThoughtStep {
  const questions: string[] = [];
  const recommendations: string[] = [];
  
  // توليد الأسئلة بناءً على الخطورة
  if (severityData.requiresJustification) {
    questions.push("هل كان الفرع مفتوحاً طوال ساعات العمل المعتادة؟");
    questions.push("هل واجهتم أي مشاكل تقنية في أنظمة الدفع أو الكاشير؟");
    questions.push("هل تم تسجيل جميع المبيعات في النظام؟");
    questions.push("هل هناك ظروف خاصة أثرت على حركة العملاء؟");
  }
  
  // توليد التوصيات
  if (severityData.severity === "critical" || severityData.severity === "high") {
    recommendations.push("مراجعة سجلات الكاشير والمبيعات للتاريخ المحدد");
    recommendations.push("التواصل مع مشرف الفرع للحصول على توضيح فوري");
  }
  
  if (llmAnalysis.concernLevel === "high" || llmAnalysis.concernLevel === "moderate") {
    recommendations.push("مقارنة الأداء مع الأيام المماثلة في الأسابيع السابقة");
    recommendations.push("التحقق من أي أحداث أو عوامل خارجية قد تؤثر على المبيعات");
  }
  
  return {
    step: 5,
    name: "Questions & Recommendations",
    nameAr: "الأسئلة والتوصيات",
    action: "توليد الأسئلة للمشرف والتوصيات للإدارة",
    data: {
      questions,
      recommendations,
      questionsCount: questions.length,
      recommendationsCount: recommendations.length,
    },
    reasoning: `Generated ${questions.length} questions and ${recommendations.length} recommendations`,
    reasoningAr: `تم توليد ${questions.length} أسئلة و ${recommendations.length} توصيات`,
  };
}

/**
 * الخطوة 6: تحديد الإجراءات والإشعارات
 */
function determineActions(severityData: any, branchId: number): ChainOfThoughtStep {
  const notifications: NotificationTarget[] = [];
  
  // إشعار مشرف الفرع
  notifications.push({
    role: "branchSupervisor",
    type: severityData.requiresJustification ? "justificationRequest" : "alert",
    priority: severityData.severity === "critical" ? "urgent" : 
              severityData.severity === "high" ? "high" : "medium",
  });
  
  // إشعار المشرف العام
  if (severityData.severity !== "low") {
    notifications.push({
      role: "generalSupervisor",
      type: "info",
      priority: severityData.severity === "critical" ? "high" : "medium",
    });
  }
  
  // إشعار الأدمن
  if (severityData.severity === "critical" || severityData.severity === "high") {
    notifications.push({
      role: "admin",
      type: "alert",
      priority: severityData.severity === "critical" ? "urgent" : "high",
    });
  }
  
  return {
    step: 6,
    name: "Action Determination",
    nameAr: "تحديد الإجراءات",
    action: "تحديد الإشعارات والإجراءات المطلوبة",
    data: {
      notifications,
      notificationsCount: notifications.length,
      requiresEscalation: severityData.severity === "critical",
      escalationDeadline: severityData.severity === "critical" 
        ? `${THRESHOLDS.escalationDeadlineHours} ساعة` 
        : null,
    },
    reasoning: `Determined ${notifications.length} notifications with ${severityData.requiresJustification ? "justification required" : "no justification needed"}`,
    reasoningAr: `تم تحديد ${notifications.length} إشعارات ${severityData.requiresJustification ? "مع طلب مبررات" : "بدون طلب مبررات"}`,
  };
}

/**
 * تحليل المصاريف
 */
export async function analyzeExpense(expense: {
  id: number;
  branchId: number;
  category: string;
  amount: number;
  description: string;
  date: string;
}): Promise<AnalysisResult> {
  // تنفيذ مشابه لتحليل الإيرادات مع تعديلات للمصاريف
  const chainOfThought: ChainOfThoughtStep[] = [];
  
  // جمع السياق
  const dbExp = await getDb();
  const historicalExpenses = await dbExp!
    .select()
    .from(expenses)
    .where(eq(expenses.branchId, expense.branchId))
    .orderBy(desc(expenses.createdAt))
    .limit(30);
  
  const amounts = historicalExpenses.map((e: typeof expenses.$inferSelect) => Number(e.amount) || 0);
  const avgAmount = amounts.length > 0 
    ? amounts.reduce((a: number, b: number) => a + b, 0) / amounts.length 
    : expense.amount;
  
  const deviation = avgAmount > 0 
    ? ((expense.amount - avgAmount) / avgAmount) * 100 
    : 0;
  
  // تقييم الخطورة
  let severityScore = 0;
  if (expense.amount > THRESHOLDS.highExpense) severityScore += 25;
  if (deviation > 200) severityScore += 35;
  else if (deviation > 100) severityScore += 20;
  
  let severity: "low" | "medium" | "high" | "critical";
  if (severityScore >= 50) severity = "high";
  else if (severityScore >= 25) severity = "medium";
  else severity = "low";
  
  const requiresJustification = severity === "high" || expense.amount > THRESHOLDS.highExpense * 2;
  
  return {
    severity,
    severityScore,
    chainOfThought: [
      {
        step: 1,
        name: "Expense Analysis",
        nameAr: "تحليل المصروف",
        action: "تحليل المصروف مقارنة بالمتوسط",
        data: {
          amount: expense.amount,
          category: expense.category,
          avgAmount: Math.round(avgAmount),
          deviation: Math.round(deviation),
        },
        reasoning: `Expense ${expense.amount} SAR in ${expense.category} deviates ${deviation.toFixed(1)}% from average`,
        reasoningAr: `مصروف ${expense.amount} ر.س. في ${expense.category} ينحرف ${deviation.toFixed(1)}% عن المتوسط`,
      }
    ],
    summary: `Expense of ${expense.amount} SAR in ${expense.category} - ${severity} severity`,
    summaryAr: `مصروف ${expense.amount} ر.س. في ${expense.category} - خطورة ${severity === "high" ? "عالية" : severity === "medium" ? "متوسطة" : "منخفضة"}`,
    questions: requiresJustification ? [
      "هل تم الحصول على عروض أسعار متعددة؟",
      "هل هذا مصروف طارئ أم مخطط له؟",
      "هل يوجد بديل أقل تكلفة؟"
    ] : undefined,
    recommendations: severity !== "low" ? [
      "مراجعة ميزانية هذا التصنيف",
      "مقارنة الأسعار مع موردين آخرين"
    ] : undefined,
    requiresJustification,
    deadline: requiresJustification ? "24 ساعة" : undefined,
    notifications: [
      {
        role: "branchSupervisor",
        type: requiresJustification ? "justificationRequest" : "info",
        priority: severity === "high" ? "high" : "medium",
      }
    ],
  };
}

// دوال مساعدة
function getDayNameAr(dayIndex: number): string {
  const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  return days[dayIndex];
}

export { THRESHOLDS };
