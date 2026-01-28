/**
 * Weekly AI Report Service - خدمة التقارير الأسبوعية التلقائية
 * إرسال تقرير AI شامل للمدير كل أسبوع
 */

import { getDb } from "../db";
import { scheduledAIReports, scheduledAIReportLogs, InsertScheduledAIReport, InsertScheduledAIReportLog } from "../../drizzle/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { calculateExecutiveKPIs, getBranchComparison, runPerformanceAnalysis } from "../executive/executiveDashboardService";
import { generateAIRecommendations, assessRisks, generateFinancialPredictions, AIRecommendation, RiskAssessment } from "../ai/aiDecisionEngine";
import { getAuditStatistics, detectAnomalies, generateComplianceReport } from "../audit/auditService";
import { notifyOwner } from "../_core/notification";

// ==================== أنواع البيانات ====================

export interface WeeklyReportData {
  period: {
    startDate: Date;
    endDate: Date;
    weekNumber: number;
  };
  kpis: {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    profitMargin: number;
    revenueGrowth: number;
    expenseGrowth: number;
    employeeCount: number;
  };
  branchPerformance: Array<{
    branchId: number;
    branchName: string;
    revenue: number;
    expenses: number;
    profit: number;
    profitMargin: number;
  }>;
  aiInsights: {
    recommendations: string[];
    risks: Array<{
      type: string;
      severity: string;
      description: string;
    }>;
    predictions: {
      nextMonthRevenue: number;
      nextMonthExpenses: number;
      trend: string;
    };
  };
  auditSummary: {
    totalEvents: number;
    highRiskEvents: number;
    anomaliesDetected: number;
    complianceRate: number;
  };
  performanceScore: number;
  executiveSummary: string;
}

export interface ScheduledReportConfig {
  reportType: "weekly_ai" | "monthly_summary" | "inventory_check" | "payroll_reminder";
  recipients: string[];
  schedule: string; // cron expression
  enabled: boolean;
  lastSentAt?: Date;
  nextScheduledAt?: Date;
}

// ==================== جمع بيانات التقرير ====================

async function collectWeeklyReportData(): Promise<WeeklyReportData> {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  
  const weekNumber = Math.ceil((now.getDate() - now.getDay() + 1) / 7);
  
  // جمع KPIs
  const kpis = await calculateExecutiveKPIs(now.getFullYear(), now.getMonth() + 1);
  
  // مقارنة الفروع
  const branchComparison = await getBranchComparison(now.getFullYear(), now.getMonth() + 1);
  
  // توصيات AI
  const recommendations = await generateAIRecommendations(now.getFullYear(), now.getMonth() + 1);
  
  // تحليل المخاطر
  const risksResult = await assessRisks(now.getFullYear(), now.getMonth() + 1);
  const risks = Array.isArray(risksResult) ? risksResult : ((risksResult as any)?.risks || []);
  
  // التوقعات المالية
  const predictions = await generateFinancialPredictions(now.getFullYear(), now.getMonth() + 1);
  
  // ملخص التدقيق
  const auditStats = await getAuditStatistics(startOfWeek, endOfWeek);
  const complianceReport = await generateComplianceReport(now.getFullYear(), now.getMonth() + 1);
  
  // كشف الشذوذ
  const anomalies = await detectAnomalies(now.getFullYear(), now.getMonth() + 1);
  
  // تحليل الأداء
  const performanceAnalysis = await runPerformanceAnalysis(now.getFullYear(), now.getMonth() + 1);
  
  return {
    period: {
      startDate: startOfWeek,
      endDate: endOfWeek,
      weekNumber,
    },
    kpis: {
      totalRevenue: kpis.totalRevenue,
      totalExpenses: kpis.totalExpenses,
      netProfit: kpis.netProfit,
      profitMargin: kpis.profitMargin,
      revenueGrowth: kpis.revenueGrowth,
      expenseGrowth: kpis.expenseGrowth,
      employeeCount: kpis.totalEmployees,
    },
    branchPerformance: branchComparison.map(b => ({
      branchId: b.branchId,
      branchName: b.branchName,
      revenue: b.revenue,
      expenses: b.expenses,
      profit: b.profit,
      profitMargin: b.profitMargin,
    })),
    aiInsights: {
      recommendations: recommendations.map((r: AIRecommendation) => r.title),
      risks: (risks || []).map((r: RiskAssessment) => ({
        type: r.riskType,
        severity: r.severity,
        description: r.description,
      })),
      predictions: {
        nextMonthRevenue: predictions.find(p => p.metric === 'revenue')?.predictedValue || 0,
        nextMonthExpenses: predictions.find(p => p.metric === 'expenses')?.predictedValue || 0,
        trend: predictions[0]?.trend || "stable",
      },
    },
    auditSummary: {
      totalEvents: auditStats.totalEvents,
      highRiskEvents: (auditStats.byRiskLevel?.['high'] || 0) + (auditStats.byRiskLevel?.['critical'] || 0),
      anomaliesDetected: anomalies.length,
      complianceRate: complianceReport.overallScore || 0,
    },
    performanceScore: performanceAnalysis.overallScore,
    executiveSummary: performanceAnalysis.summary,
  };
}

// ==================== توليد التقرير بالذكاء الاصطناعي ====================

async function generateExecutiveSummary(data: WeeklyReportData): Promise<string> {
  const prompt = `
أنت مستشار مالي خبير. قم بكتابة ملخص تنفيذي احترافي باللغة العربية للتقرير الأسبوعي التالي:

**الفترة:** الأسبوع ${data.period.weekNumber} (${data.period.startDate.toLocaleDateString('ar-SA')} - ${data.period.endDate.toLocaleDateString('ar-SA')})

**المؤشرات المالية:**
- إجمالي الإيرادات: ${data.kpis.totalRevenue.toLocaleString('ar-SA')} ر.س
- إجمالي المصاريف: ${data.kpis.totalExpenses.toLocaleString('ar-SA')} ر.س
- صافي الربح: ${data.kpis.netProfit.toLocaleString('ar-SA')} ر.س
- هامش الربح: ${data.kpis.profitMargin.toFixed(1)}%
- نمو الإيرادات: ${data.kpis.revenueGrowth > 0 ? '+' : ''}${data.kpis.revenueGrowth.toFixed(1)}%
- نمو المصاريف: ${data.kpis.expenseGrowth > 0 ? '+' : ''}${data.kpis.expenseGrowth.toFixed(1)}%

**أداء الفروع:**
${data.branchPerformance.map(b => `- ${b.branchName}: ربح ${b.profit.toLocaleString('ar-SA')} ر.س (هامش ${b.profitMargin.toFixed(1)}%)`).join('\n')}

**المخاطر المكتشفة:**
${data.aiInsights.risks.map(r => `- ${r.type} (${r.severity}): ${r.description}`).join('\n') || 'لا توجد مخاطر'}

**التوقعات:**
- إيرادات الشهر القادم المتوقعة: ${data.aiInsights.predictions.nextMonthRevenue.toLocaleString('ar-SA')} ر.س
- الاتجاه العام: ${data.aiInsights.predictions.trend}

**التدقيق:**
- إجمالي الأحداث: ${data.auditSummary.totalEvents}
- أحداث عالية المخاطر: ${data.auditSummary.highRiskEvents}
- نسبة الامتثال: ${data.auditSummary.complianceRate.toFixed(1)}%

**درجة الأداء العام:** ${data.performanceScore}/100

اكتب ملخصاً تنفيذياً مختصراً (3-4 فقرات) يتضمن:
1. نظرة عامة على الأداء المالي
2. أبرز النقاط الإيجابية والسلبية
3. التوصيات الرئيسية للأسبوع القادم
`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "أنت مستشار مالي خبير متخصص في تحليل أداء الشركات." },
        { role: "user", content: prompt },
      ],
    });
    
    const content = response.choices[0]?.message?.content;
    return typeof content === 'string' ? content : data.executiveSummary;
  } catch (error) {
    console.error("[WeeklyAIReport] Error generating executive summary:", error);
    return data.executiveSummary;
  }
}

// ==================== إنشاء قالب البريد الإلكتروني ====================

function generateEmailHTML(data: WeeklyReportData, executiveSummary: string): string {
  const formatNumber = (n: number) => n.toLocaleString('ar-SA');
  const formatPercent = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
  
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>التقرير الأسبوعي - Symbol AI</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; direction: rtl; }
    .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .header p { margin: 10px 0 0; opacity: 0.8; }
    .content { padding: 30px; }
    .section { margin-bottom: 30px; }
    .section-title { color: #1a1a2e; font-size: 20px; border-bottom: 2px solid #f97316; padding-bottom: 10px; margin-bottom: 20px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
    .kpi-card { background: #f8f9fa; border-radius: 8px; padding: 20px; text-align: center; }
    .kpi-value { font-size: 24px; font-weight: bold; color: #1a1a2e; }
    .kpi-label { font-size: 14px; color: #666; margin-top: 5px; }
    .kpi-change { font-size: 12px; margin-top: 5px; }
    .positive { color: #22c55e; }
    .negative { color: #ef4444; }
    .branch-table { width: 100%; border-collapse: collapse; }
    .branch-table th, .branch-table td { padding: 12px; text-align: right; border-bottom: 1px solid #eee; }
    .branch-table th { background: #f8f9fa; color: #1a1a2e; }
    .risk-item { background: #fef2f2; border-right: 4px solid #ef4444; padding: 15px; margin-bottom: 10px; border-radius: 4px; }
    .risk-critical { border-color: #dc2626; background: #fee2e2; }
    .risk-high { border-color: #f97316; background: #fff7ed; }
    .risk-medium { border-color: #eab308; background: #fefce8; }
    .recommendation-item { background: #f0fdf4; border-right: 4px solid #22c55e; padding: 15px; margin-bottom: 10px; border-radius: 4px; }
    .summary-box { background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 8px; padding: 25px; line-height: 1.8; }
    .score-circle { width: 100px; height: 100px; border-radius: 50%; background: conic-gradient(#22c55e ${data.performanceScore}%, #e5e7eb ${data.performanceScore}%); display: flex; align-items: center; justify-content: center; margin: 0 auto; }
    .score-inner { width: 80px; height: 80px; border-radius: 50%; background: white; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; color: #1a1a2e; }
    .footer { background: #1a1a2e; color: white; padding: 20px; text-align: center; font-size: 14px; }
    .footer a { color: #f97316; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 التقرير الأسبوعي</h1>
      <p>الأسبوع ${data.period.weekNumber} | ${data.period.startDate.toLocaleDateString('ar-SA')} - ${data.period.endDate.toLocaleDateString('ar-SA')}</p>
    </div>
    
    <div class="content">
      <!-- درجة الأداء -->
      <div class="section" style="text-align: center;">
        <div class="score-circle">
          <div class="score-inner">${data.performanceScore}</div>
        </div>
        <p style="margin-top: 15px; color: #666;">درجة الأداء العام</p>
      </div>
      
      <!-- المؤشرات المالية -->
      <div class="section">
        <h2 class="section-title">📈 المؤشرات المالية</h2>
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-value">${formatNumber(data.kpis.totalRevenue)}</div>
            <div class="kpi-label">إجمالي الإيرادات (ر.س)</div>
            <div class="kpi-change ${data.kpis.revenueGrowth >= 0 ? 'positive' : 'negative'}">${formatPercent(data.kpis.revenueGrowth)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value">${formatNumber(data.kpis.totalExpenses)}</div>
            <div class="kpi-label">إجمالي المصاريف (ر.س)</div>
            <div class="kpi-change ${data.kpis.expenseGrowth <= 0 ? 'positive' : 'negative'}">${formatPercent(data.kpis.expenseGrowth)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value" style="color: ${data.kpis.netProfit >= 0 ? '#22c55e' : '#ef4444'}">${formatNumber(data.kpis.netProfit)}</div>
            <div class="kpi-label">صافي الربح (ر.س)</div>
            <div class="kpi-change">${data.kpis.profitMargin.toFixed(1)}% هامش</div>
          </div>
        </div>
      </div>
      
      <!-- أداء الفروع -->
      <div class="section">
        <h2 class="section-title">🏢 أداء الفروع</h2>
        <table class="branch-table">
          <thead>
            <tr>
              <th>الفرع</th>
              <th>الإيرادات</th>
              <th>المصاريف</th>
              <th>الربح</th>
              <th>الهامش</th>
            </tr>
          </thead>
          <tbody>
            ${data.branchPerformance.map(b => `
              <tr>
                <td><strong>${b.branchName}</strong></td>
                <td>${formatNumber(b.revenue)} ر.س</td>
                <td>${formatNumber(b.expenses)} ر.س</td>
                <td style="color: ${b.profit >= 0 ? '#22c55e' : '#ef4444'}">${formatNumber(b.profit)} ر.س</td>
                <td>${b.profitMargin.toFixed(1)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <!-- المخاطر -->
      ${data.aiInsights.risks.length > 0 ? `
      <div class="section">
        <h2 class="section-title">⚠️ المخاطر المكتشفة</h2>
        ${data.aiInsights.risks.map(r => `
          <div class="risk-item risk-${r.severity}">
            <strong>${r.type}</strong> (${r.severity === 'critical' ? 'حرج' : r.severity === 'high' ? 'عالي' : 'متوسط'})
            <p style="margin: 5px 0 0; color: #666;">${r.description}</p>
          </div>
        `).join('')}
      </div>
      ` : ''}
      
      <!-- التوصيات -->
      ${data.aiInsights.recommendations.length > 0 ? `
      <div class="section">
        <h2 class="section-title">💡 التوصيات</h2>
        ${data.aiInsights.recommendations.slice(0, 5).map(r => `
          <div class="recommendation-item">${r}</div>
        `).join('')}
      </div>
      ` : ''}
      
      <!-- التدقيق -->
      <div class="section">
        <h2 class="section-title">🔍 ملخص التدقيق</h2>
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-value">${data.auditSummary.totalEvents}</div>
            <div class="kpi-label">إجمالي الأحداث</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value" style="color: ${data.auditSummary.highRiskEvents > 0 ? '#ef4444' : '#22c55e'}">${data.auditSummary.highRiskEvents}</div>
            <div class="kpi-label">أحداث عالية المخاطر</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value">${data.auditSummary.complianceRate.toFixed(0)}%</div>
            <div class="kpi-label">نسبة الامتثال</div>
          </div>
        </div>
      </div>
      
      <!-- الملخص التنفيذي -->
      <div class="section">
        <h2 class="section-title">📋 الملخص التنفيذي</h2>
        <div class="summary-box">
          ${executiveSummary.split('\n').map(p => p.trim() ? `<p>${p}</p>` : '').join('')}
        </div>
      </div>
    </div>
    
    <div class="footer">
      <p>تم إنشاء هذا التقرير تلقائياً بواسطة <a href="#">Symbol AI</a></p>
      <p>للاطلاع على التفاصيل الكاملة، يرجى تسجيل الدخول إلى لوحة التحكم</p>
    </div>
  </div>
</body>
</html>
`;
}

// ==================== إرسال التقرير ====================

export async function sendWeeklyAIReport(recipientEmails: string[]): Promise<boolean> {
  try {
    // التحقق من عدم إرسال التقرير مسبقاً هذا الأسبوع
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const existingReport = await db
      .select()
      .from(scheduledAIReportLogs)
      .where(
        and(
          eq(scheduledAIReportLogs.reportType, "weekly_ai_summary"),
          gte(scheduledAIReportLogs.createdAt, startOfWeek)
        )
      )
      .limit(1);
    
    if (existingReport.length > 0) {
      console.log("[WeeklyAIReport] Report already sent this week");
      return false;
    }
    
    // جمع البيانات
    console.log("[WeeklyAIReport] Collecting report data...");
    const reportData = await collectWeeklyReportData();
    
    // توليد الملخص التنفيذي
    console.log("[WeeklyAIReport] Generating executive summary...");
    const executiveSummary = await generateExecutiveSummary(reportData);
    
    // إنشاء البريد الإلكتروني
    const emailHTML = generateEmailHTML(reportData, executiveSummary);
    
    // إرسال الإشعار للمالك
    console.log("[WeeklyAIReport] Sending notification to owner...");
    await notifyOwner({
      title: `📊 التقرير الأسبوعي - الأسبوع ${reportData.period.weekNumber}`,
      content: executiveSummary,
    });
    
    // تسجيل الإرسال
    await db.insert(scheduledAIReportLogs).values({
      reportId: 1, // Default report ID
      reportType: "weekly_ai_summary",
      status: "success",
      executionTimeMs: Date.now() - now.getTime(),
      reportContent: {
        summary: executiveSummary,
        recommendations: reportData.aiInsights.recommendations,
        risks: reportData.aiInsights.risks.map(r => r.description),
        kpis: reportData.kpis as Record<string, number>,
      },
      emailsSent: recipientEmails.length,
      recipientList: recipientEmails,
    });
    
    console.log("[WeeklyAIReport] Report sent successfully");
    return true;
    
  } catch (error) {
    console.error("[WeeklyAIReport] Error sending report:", error);
    
    // تسجيل الفشل
    try {
      const dbConn = await getDb();
      if (dbConn) await dbConn.insert(scheduledAIReportLogs).values({
        reportId: 1,
        reportType: "weekly_ai_summary",
        status: "failed",
        errorMessage: String(error),
        emailsSent: 0,
      });
    } catch (logError) {
      console.error("[WeeklyAIReport] Error logging failure:", logError);
    }
    
    return false;
  }
}

// ==================== جدولة التقرير ====================

export async function getReportScheduleStatus(): Promise<{
  lastSentAt: Date | null;
  nextScheduledAt: Date;
  isEnabled: boolean;
}> {
  const db = await getDb();
  if (!db) {
    return {
      lastSentAt: null,
      nextScheduledAt: new Date(),
      isEnabled: false,
    };
  }
  
  const lastReport = await db
    .select()
    .from(scheduledAIReportLogs)
    .where(eq(scheduledAIReportLogs.reportType, "weekly_ai_summary"))
    .orderBy(desc(scheduledAIReportLogs.createdAt))
    .limit(1);
  
  // التقرير يُرسل كل يوم أحد الساعة 8 صباحاً
  const now = new Date();
  const nextSunday = new Date(now);
  nextSunday.setDate(now.getDate() + (7 - now.getDay()) % 7);
  nextSunday.setHours(8, 0, 0, 0);
  
  if (nextSunday <= now) {
    nextSunday.setDate(nextSunday.getDate() + 7);
  }
  
  return {
    lastSentAt: lastReport[0]?.createdAt || null,
    nextScheduledAt: nextSunday,
    isEnabled: true,
  };
}

// ==================== تصدير الدوال ====================

export {
  collectWeeklyReportData,
  generateExecutiveSummary,
  generateEmailHTML,
};
