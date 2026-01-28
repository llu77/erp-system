/**
 * AI Decision Engine - محرك الذكاء الاصطناعي للقرارات
 * توقعات مالية، تنبيهات مخاطر، توصيات ذكية
 */

import { getDb } from "../db";
import { 
  aiPredictions, aiAdvancedRecommendations, riskAlerts,
  invoices, expenses, payrolls, employees, branches,
  InsertAIPrediction, InsertRiskAlert
} from "../../drizzle/schema";
import { eq, desc, and, gte, lte, sql, count, avg, sum } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

// ==================== أنواع البيانات ====================

export interface FinancialPrediction {
  metric: string;
  currentValue: number;
  predictedValue: number;
  confidence: number;
  trend: "up" | "down" | "stable";
  changePercent: number;
  timeframe: string;
  factors: string[];
}

export interface RiskAssessment {
  riskType: string;
  severity: "low" | "medium" | "high" | "critical";
  probability: number;
  impact: number;
  riskScore: number;
  description: string;
  mitigationSteps: string[];
}

export interface AIRecommendation {
  type: string;
  priority: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  expectedImpact: {
    metric: string;
    currentValue: number;
    projectedValue: number;
    changePercent: number;
  };
  actionSteps: string[];
  estimatedEffort: string;
  estimatedROI: number;
}

export interface HistoricalData {
  period: string;
  revenue: number;
  expenses: number;
  profit: number;
  employeeCount: number;
}

// ==================== جمع البيانات التاريخية ====================

async function getHistoricalData(months: number = 12): Promise<HistoricalData[]> {
  const db = await getDb();
  if (!db) return [];
  
  const data: HistoricalData[] = [];
  const now = new Date();
  
  for (let i = 0; i < months; i++) {
    const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;
    
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    
    // الإيرادات
    const revenue = await db.select({
      total: sql<number>`COALESCE(SUM(${invoices.total}), 0)`
    })
      .from(invoices)
      .where(and(
        gte(invoices.createdAt, startDate),
        lte(invoices.createdAt, endDate)
      ));
    
    // المصاريف
    const expensesResult = await db.select({
      total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)`
    })
      .from(expenses)
      .where(and(
        gte(expenses.createdAt, startDate),
        lte(expenses.createdAt, endDate)
      ));
    
    // الموظفين
    const employeeCount = await db.select({ count: count() })
      .from(employees)
      .where(lte(employees.createdAt, endDate));
    
    const revenueTotal = Number(revenue[0]?.total || 0);
    const expensesTotal = Number(expensesResult[0]?.total || 0);
    
    data.unshift({
      period: `${year}-${String(month).padStart(2, '0')}`,
      revenue: revenueTotal,
      expenses: expensesTotal,
      profit: revenueTotal - expensesTotal,
      employeeCount: employeeCount[0]?.count || 0,
    });
  }
  
  return data;
}

// ==================== التنبؤ المالي باستخدام الذكاء الاصطناعي ====================

export async function generateFinancialPredictions(
  year: number,
  month: number
): Promise<FinancialPrediction[]> {
  const historicalData = await getHistoricalData(12);
  
  if (historicalData.length < 3) {
    return getDefaultPredictions();
  }
  
  // حساب المتوسطات والاتجاهات
  const recentMonths = historicalData.slice(-3);
  const olderMonths = historicalData.slice(-6, -3);
  
  const avgRecentRevenue = recentMonths.reduce((sum, d) => sum + d.revenue, 0) / recentMonths.length;
  const avgOlderRevenue = olderMonths.length > 0 
    ? olderMonths.reduce((sum, d) => sum + d.revenue, 0) / olderMonths.length 
    : avgRecentRevenue;
  
  const avgRecentExpenses = recentMonths.reduce((sum, d) => sum + d.expenses, 0) / recentMonths.length;
  const avgOlderExpenses = olderMonths.length > 0 
    ? olderMonths.reduce((sum, d) => sum + d.expenses, 0) / olderMonths.length 
    : avgRecentExpenses;
  
  const avgRecentProfit = recentMonths.reduce((sum, d) => sum + d.profit, 0) / recentMonths.length;
  const avgOlderProfit = olderMonths.length > 0 
    ? olderMonths.reduce((sum, d) => sum + d.profit, 0) / olderMonths.length 
    : avgRecentProfit;
  
  // حساب معدل النمو
  const revenueGrowthRate = avgOlderRevenue > 0 
    ? (avgRecentRevenue - avgOlderRevenue) / avgOlderRevenue 
    : 0;
  const expenseGrowthRate = avgOlderExpenses > 0 
    ? (avgRecentExpenses - avgOlderExpenses) / avgOlderExpenses 
    : 0;
  const profitGrowthRate = avgOlderProfit !== 0 
    ? (avgRecentProfit - avgOlderProfit) / Math.abs(avgOlderProfit) 
    : 0;
  
  // التنبؤ للشهر القادم
  const predictedRevenue = avgRecentRevenue * (1 + revenueGrowthRate * 0.5);
  const predictedExpenses = avgRecentExpenses * (1 + expenseGrowthRate * 0.5);
  const predictedProfit = predictedRevenue - predictedExpenses;
  
  // حساب الثقة بناءً على استقرار البيانات
  const revenueVariance = calculateVariance(recentMonths.map(d => d.revenue));
  const confidenceRevenue = Math.max(0.5, 1 - (revenueVariance / avgRecentRevenue) * 0.5);
  
  const predictions: FinancialPrediction[] = [
    {
      metric: "الإيرادات",
      currentValue: avgRecentRevenue,
      predictedValue: predictedRevenue,
      confidence: Math.min(0.95, confidenceRevenue),
      trend: revenueGrowthRate > 0.02 ? "up" : revenueGrowthRate < -0.02 ? "down" : "stable",
      changePercent: revenueGrowthRate * 100,
      timeframe: "الشهر القادم",
      factors: getRevenuePredictionFactors(revenueGrowthRate, historicalData),
    },
    {
      metric: "المصاريف",
      currentValue: avgRecentExpenses,
      predictedValue: predictedExpenses,
      confidence: Math.min(0.90, confidenceRevenue * 0.95),
      trend: expenseGrowthRate > 0.02 ? "up" : expenseGrowthRate < -0.02 ? "down" : "stable",
      changePercent: expenseGrowthRate * 100,
      timeframe: "الشهر القادم",
      factors: getExpensePredictionFactors(expenseGrowthRate, historicalData),
    },
    {
      metric: "صافي الربح",
      currentValue: avgRecentProfit,
      predictedValue: predictedProfit,
      confidence: Math.min(0.85, confidenceRevenue * 0.9),
      trend: profitGrowthRate > 0.02 ? "up" : profitGrowthRate < -0.02 ? "down" : "stable",
      changePercent: profitGrowthRate * 100,
      timeframe: "الشهر القادم",
      factors: getProfitPredictionFactors(profitGrowthRate, historicalData),
    },
  ];
  
  // حفظ التنبؤات في قاعدة البيانات
  await savePredictions(predictions, year, month);
  
  return predictions;
}

// ==================== تقييم المخاطر ====================

export async function assessRisks(
  year: number,
  month: number
): Promise<RiskAssessment[]> {
  const historicalData = await getHistoricalData(6);
  const db = await getDb();
  if (!db) return [];
  
  const risks: RiskAssessment[] = [];
  
  // 1. مخاطر السيولة
  const recentProfit = historicalData.slice(-3).reduce((sum, d) => sum + d.profit, 0) / 3;
  const recentExpenses = historicalData.slice(-3).reduce((sum, d) => sum + d.expenses, 0) / 3;
  
  if (recentProfit < recentExpenses * 0.1) {
    const severity = recentProfit < 0 ? "critical" : recentProfit < recentExpenses * 0.05 ? "high" : "medium";
    risks.push({
      riskType: "مخاطر السيولة",
      severity,
      probability: 0.7,
      impact: 0.9,
      riskScore: 0.7 * 0.9,
      description: "هامش الربح منخفض جداً مما يهدد السيولة النقدية",
      mitigationSteps: [
        "مراجعة هيكل التكاليف وتحديد فرص التخفيض",
        "تحسين استراتيجية التسعير",
        "تسريع تحصيل المستحقات",
        "التفاوض على شروط دفع أفضل مع الموردين",
      ],
    });
  }
  
  // 2. مخاطر تركز الإيرادات
  const allBranches = await db.select().from(branches);
  if (allBranches.length > 1) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    
    const branchRevenues: number[] = [];
    for (const branch of allBranches) {
      const revenue = await db.select({
        total: sql<number>`COALESCE(SUM(${invoices.total}), 0)`
      })
        .from(invoices)
        .where(and(
          eq(invoices.branchId, branch.id),
          gte(invoices.createdAt, startDate),
          lte(invoices.createdAt, endDate)
        ));
      branchRevenues.push(Number(revenue[0]?.total || 0));
    }
    
    const totalRevenue = branchRevenues.reduce((a, b) => a + b, 0);
    const maxBranchRevenue = Math.max(...branchRevenues);
    const concentration = totalRevenue > 0 ? maxBranchRevenue / totalRevenue : 0;
    
    if (concentration > 0.7) {
      risks.push({
        riskType: "تركز الإيرادات",
        severity: concentration > 0.85 ? "high" : "medium",
        probability: 0.6,
        impact: 0.7,
        riskScore: 0.6 * 0.7,
        description: `${(concentration * 100).toFixed(0)}% من الإيرادات تأتي من فرع واحد`,
        mitigationSteps: [
          "تطوير استراتيجية لتنويع مصادر الإيرادات",
          "زيادة الاستثمار في الفروع الأخرى",
          "تحليل أسباب ضعف أداء الفروع الأخرى",
        ],
      });
    }
  }
  
  // 3. مخاطر الموارد البشرية (الوثائق المنتهية)
  const expiringDocs = await db.select({ count: count() })
    .from(employees)
    .where(and(
      eq(employees.isActive, true),
      lte(employees.iqamaExpiryDate, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
    ));
  
  const totalActiveEmployees = await db.select({ count: count() })
    .from(employees)
    .where(eq(employees.isActive, true));
  
  const expiringRatio = totalActiveEmployees[0]?.count > 0 
    ? (expiringDocs[0]?.count || 0) / totalActiveEmployees[0].count 
    : 0;
  
  if (expiringRatio > 0.1) {
    risks.push({
      riskType: "مخاطر الامتثال",
      severity: expiringRatio > 0.25 ? "critical" : expiringRatio > 0.15 ? "high" : "medium",
      probability: 0.9,
      impact: 0.8,
      riskScore: 0.9 * 0.8,
      description: `${(expiringRatio * 100).toFixed(0)}% من الموظفين لديهم وثائق تنتهي خلال 30 يوم`,
      mitigationSteps: [
        "إعداد قائمة بالموظفين المتأثرين",
        "بدء إجراءات التجديد فوراً",
        "تخصيص ميزانية للتجديدات",
        "وضع نظام تنبيه مبكر للوثائق",
      ],
    });
  }
  
  // 4. مخاطر تقلب الإيرادات
  if (historicalData.length >= 6) {
    const revenues = historicalData.map(d => d.revenue);
    const avgRevenue = revenues.reduce((a, b) => a + b, 0) / revenues.length;
    const variance = calculateVariance(revenues);
    const coefficientOfVariation = avgRevenue > 0 ? Math.sqrt(variance) / avgRevenue : 0;
    
    if (coefficientOfVariation > 0.3) {
      risks.push({
        riskType: "تقلب الإيرادات",
        severity: coefficientOfVariation > 0.5 ? "high" : "medium",
        probability: 0.5,
        impact: 0.6,
        riskScore: 0.5 * 0.6,
        description: "تقلب كبير في الإيرادات الشهرية يصعب التخطيط المالي",
        mitigationSteps: [
          "تحليل أسباب التقلب الموسمي",
          "تطوير مصادر إيرادات أكثر استقراراً",
          "بناء احتياطي نقدي للأشهر الضعيفة",
          "تنويع قاعدة العملاء",
        ],
      });
    }
  }
  
  // حفظ تنبيهات المخاطر
  await saveRiskAlerts(risks, year, month);
  
  return risks;
}

// ==================== توليد التوصيات الذكية ====================

export async function generateAIRecommendations(
  year: number,
  month: number
): Promise<AIRecommendation[]> {
  const historicalData = await getHistoricalData(6);
  const risks = await assessRisks(year, month);
  const predictions = await generateFinancialPredictions(year, month);
  
  const recommendations: AIRecommendation[] = [];
  
  // 1. توصيات بناءً على الاتجاهات
  const revenuePrediction = predictions.find(p => p.metric === "الإيرادات");
  const expensePrediction = predictions.find(p => p.metric === "المصاريف");
  
  if (revenuePrediction && revenuePrediction.trend === "down") {
    recommendations.push({
      type: "زيادة الإيرادات",
      priority: revenuePrediction.changePercent < -10 ? "critical" : "high",
      title: "خطة لتحسين الإيرادات",
      description: "الإيرادات في اتجاه هبوطي، يُنصح باتخاذ إجراءات لتحسين المبيعات",
      expectedImpact: {
        metric: "الإيرادات",
        currentValue: revenuePrediction.currentValue,
        projectedValue: revenuePrediction.currentValue * 1.15,
        changePercent: 15,
      },
      actionSteps: [
        "تحليل أسباب انخفاض المبيعات",
        "مراجعة استراتيجية التسعير",
        "إطلاق حملات تسويقية مستهدفة",
        "تحسين تجربة العملاء",
        "تدريب فريق المبيعات",
      ],
      estimatedEffort: "متوسط - 2-4 أسابيع",
      estimatedROI: 2.5,
    });
  }
  
  if (expensePrediction && expensePrediction.trend === "up" && expensePrediction.changePercent > 10) {
    recommendations.push({
      type: "تقليل التكاليف",
      priority: expensePrediction.changePercent > 20 ? "high" : "medium",
      title: "خطة لضبط المصاريف",
      description: "المصاريف في ارتفاع مستمر، يُنصح بمراجعة بنود الإنفاق",
      expectedImpact: {
        metric: "المصاريف",
        currentValue: expensePrediction.currentValue,
        projectedValue: expensePrediction.currentValue * 0.9,
        changePercent: -10,
      },
      actionSteps: [
        "تحليل تفصيلي لبنود المصاريف",
        "تحديد المصاريف غير الضرورية",
        "التفاوض مع الموردين للحصول على أسعار أفضل",
        "تحسين كفاءة استهلاك الموارد",
        "أتمتة العمليات اليدوية",
      ],
      estimatedEffort: "منخفض - 1-2 أسابيع",
      estimatedROI: 3.0,
    });
  }
  
  // 2. توصيات بناءً على المخاطر
  for (const risk of risks) {
    if (risk.severity === "critical" || risk.severity === "high") {
      recommendations.push({
        type: "تخفيف المخاطر",
        priority: risk.severity === "critical" ? "critical" : "high",
        title: `معالجة ${risk.riskType}`,
        description: risk.description,
        expectedImpact: {
          metric: "مستوى المخاطر",
          currentValue: risk.riskScore * 100,
          projectedValue: risk.riskScore * 100 * 0.5,
          changePercent: -50,
        },
        actionSteps: risk.mitigationSteps,
        estimatedEffort: "متوسط - 2-3 أسابيع",
        estimatedROI: 4.0,
      });
    }
  }
  
  // 3. توصيات تحسين الكفاءة
  if (historicalData.length >= 3) {
    const avgEmployeeProductivity = historicalData.slice(-3).reduce((sum, d) => {
      return sum + (d.employeeCount > 0 ? d.revenue / d.employeeCount : 0);
    }, 0) / 3;
    
    const industryBenchmark = 50000; // معيار افتراضي
    
    if (avgEmployeeProductivity < industryBenchmark * 0.8) {
      recommendations.push({
        type: "تحسين الكفاءة",
        priority: "medium",
        title: "تحسين إنتاجية الموظفين",
        description: "إنتاجية الموظف أقل من المعيار المتوقع",
        expectedImpact: {
          metric: "إنتاجية الموظف",
          currentValue: avgEmployeeProductivity,
          projectedValue: industryBenchmark,
          changePercent: ((industryBenchmark - avgEmployeeProductivity) / avgEmployeeProductivity) * 100,
        },
        actionSteps: [
          "تحليل توزيع المهام والأعباء",
          "تحديد الاختناقات في سير العمل",
          "توفير أدوات وتقنيات أفضل",
          "برامج تدريب وتطوير",
          "نظام حوافز مرتبط بالأداء",
        ],
        estimatedEffort: "عالي - 4-8 أسابيع",
        estimatedROI: 2.0,
      });
    }
  }
  
  // ترتيب التوصيات حسب الأولوية وROI
  recommendations.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.estimatedROI - a.estimatedROI;
  });
  
  return recommendations;
}

// ==================== تحليل شامل باستخدام LLM ====================

export async function generateAIInsights(
  year: number,
  month: number
): Promise<string> {
  const historicalData = await getHistoricalData(6);
  const predictions = await generateFinancialPredictions(year, month);
  const risks = await assessRisks(year, month);
  
  const prompt = `
أنت محلل مالي خبير. قم بتحليل البيانات التالية وتقديم رؤى استراتيجية:

البيانات التاريخية (آخر 6 أشهر):
${JSON.stringify(historicalData, null, 2)}

التنبؤات:
${JSON.stringify(predictions, null, 2)}

المخاطر المحددة:
${JSON.stringify(risks, null, 2)}

قدم تحليلاً موجزاً يتضمن:
1. ملخص الوضع المالي الحالي
2. أهم 3 نقاط قوة
3. أهم 3 تحديات
4. توصيات استراتيجية للشهر القادم
5. مؤشرات يجب مراقبتها

اكتب بالعربية بأسلوب مهني ومختصر.
`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "أنت محلل مالي خبير متخصص في تحليل أداء الشركات الصغيرة والمتوسطة." },
        { role: "user", content: prompt },
      ],
    });
    
    const content = response.choices[0]?.message?.content;
    return typeof content === 'string' ? content : "لم يتم توليد تحليل";
  } catch (error) {
    console.error("Error generating AI insights:", error);
    return "حدث خطأ في توليد التحليل الذكي";
  }
}

// ==================== دوال مساعدة ====================

function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
}

function getRevenuePredictionFactors(growthRate: number, data: HistoricalData[]): string[] {
  const factors: string[] = [];
  
  if (growthRate > 0.05) {
    factors.push("نمو مستمر في المبيعات");
    factors.push("أداء قوي في الأشهر الأخيرة");
  } else if (growthRate < -0.05) {
    factors.push("انخفاض في حجم المبيعات");
    factors.push("تراجع في الطلب");
  } else {
    factors.push("استقرار في حجم المبيعات");
  }
  
  // تحليل الموسمية
  if (data.length >= 12) {
    factors.push("تأثير العوامل الموسمية");
  }
  
  return factors;
}

function getExpensePredictionFactors(growthRate: number, data: HistoricalData[]): string[] {
  const factors: string[] = [];
  
  if (growthRate > 0.1) {
    factors.push("ارتفاع في تكاليف التشغيل");
    factors.push("زيادة في أسعار المواد الخام");
  } else if (growthRate < -0.05) {
    factors.push("تحسن في كفاءة التكاليف");
    factors.push("نجاح برامج ضبط المصاريف");
  } else {
    factors.push("استقرار في هيكل التكاليف");
  }
  
  return factors;
}

function getProfitPredictionFactors(growthRate: number, data: HistoricalData[]): string[] {
  const factors: string[] = [];
  
  if (growthRate > 0.1) {
    factors.push("تحسن في هامش الربح");
    factors.push("نمو الإيرادات أسرع من المصاريف");
  } else if (growthRate < -0.1) {
    factors.push("ضغط على هامش الربح");
    factors.push("ارتفاع التكاليف مقارنة بالإيرادات");
  } else {
    factors.push("استقرار في الربحية");
  }
  
  return factors;
}

function getDefaultPredictions(): FinancialPrediction[] {
  return [
    {
      metric: "الإيرادات",
      currentValue: 0,
      predictedValue: 0,
      confidence: 0.5,
      trend: "stable",
      changePercent: 0,
      timeframe: "الشهر القادم",
      factors: ["بيانات غير كافية للتنبؤ"],
    },
  ];
}

async function savePredictions(
  predictions: FinancialPrediction[],
  year: number,
  month: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  for (const prediction of predictions) {
    const insert: InsertAIPrediction = {
      predictionType: prediction.metric === "الإيرادات" ? "revenue_forecast" 
        : prediction.metric === "المصاريف" ? "expense_forecast" 
        : "profit_forecast",
      targetPeriod: "month",
      targetDate: new Date(year, month, 1),
      predictedValue: String(prediction.predictedValue),
      confidenceLevel: String(prediction.confidence * 100),
      factors: prediction.factors.map(f => ({ name: f, impact: 0, description: f })),
      modelVersion: "v1.0",
    };
    
    await db.insert(aiPredictions).values(insert);
  }
}

async function saveRiskAlerts(
  risks: RiskAssessment[],
  year: number,
  month: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  for (const risk of risks) {
    const insert: InsertRiskAlert = {
      riskType: risk.riskType.includes("سيولة") ? "liquidity" 
        : risk.riskType.includes("امتثال") ? "compliance"
        : risk.riskType.includes("تركز") ? "financial"
        : risk.riskType.includes("تقلب") ? "market"
        : "operational",
      riskLevel: risk.severity,
      riskScore: String(risk.riskScore * 100),
      title: risk.riskType,
      titleAr: risk.riskType,
      description: risk.description,
      descriptionAr: risk.description,
      potentialImpact: {
        financial: risk.impact * 100000,
        operational: risk.description,
        timeline: "شهر واحد",
      },
      mitigationPlan: risk.mitigationSteps.map((step, i) => ({
        action: step,
        actionAr: step,
        priority: i + 1,
      })),
      status: "active",
    };
    
    await db.insert(riskAlerts).values(insert);
  }
}
