/**
 * خدمة تحليلات الذكاء الاصطناعي
 * توفر تنبؤات وتوصيات ذكية باستخدام LLM
 */

import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { 
  invoices, customers, products, aiRecommendations, customerSegments,
  aiAnalytics, dailyRevenues, branches
} from "../../drizzle/schema";
import { sql, eq, and, gte, lte, desc, asc } from "drizzle-orm";

// ==================== أنواع البيانات ====================

export interface SalesForecast {
  period: string;
  predicted: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
  factors: { factor: string; impact: string }[];
  trend: 'up' | 'down' | 'stable';
}

export interface CustomerSegmentResult {
  customerId: number;
  customerName: string;
  segment: string;
  rfmScore: string;
  recencyScore: number;
  frequencyScore: number;
  monetaryScore: number;
  totalSpent: number;
  lastPurchaseDate: Date | null;
  churnRisk: number;
  recommendations: string[];
}

export interface AnomalyResult {
  type: 'sales' | 'expense' | 'inventory';
  severity: 'low' | 'medium' | 'high';
  description: string;
  value: number;
  expectedValue: number;
  deviation: number;
  date: Date;
  relatedEntity?: { type: string; id: number; name: string };
}

export interface AIRecommendation {
  type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  actionRequired: string;
  expectedImpact: string;
  confidence: number;
}

// ==================== خدمات التحليل الذكي ====================

/**
 * التنبؤ بالمبيعات
 */
export async function forecastSales(
  branchId?: number,
  days: number = 7
): Promise<SalesForecast[]> {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  // جلب بيانات المبيعات التاريخية (آخر 90 يوم)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90);

  const historicalSales = await db
    .select({
      date: dailyRevenues.date,
      total: sql<number>`COALESCE(SUM(${dailyRevenues.cash} + ${dailyRevenues.network}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(dailyRevenues)
    .where(
      and(
        gte(dailyRevenues.date, startDate),
        lte(dailyRevenues.date, endDate),
        branchId ? eq(dailyRevenues.branchId, branchId) : undefined
      )
    )
    .groupBy(dailyRevenues.date)
    .orderBy(asc(dailyRevenues.date));

  if (historicalSales.length < 7) {
    // بيانات غير كافية للتنبؤ
    return [];
  }

  // حساب المتوسطات والاتجاهات
  const recentSales = historicalSales.slice(-30);
  const avgDailySales = recentSales.reduce((sum, d) => sum + Number(d.total), 0) / recentSales.length;
  
  // حساب الاتجاه (بسيط)
  const firstHalf = recentSales.slice(0, 15);
  const secondHalf = recentSales.slice(15);
  const firstAvg = firstHalf.reduce((sum, d) => sum + Number(d.total), 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, d) => sum + Number(d.total), 0) / secondHalf.length;
  const trend = secondAvg > firstAvg * 1.05 ? 'up' : secondAvg < firstAvg * 0.95 ? 'down' : 'stable';

  // استخدام LLM للتحليل المتقدم
  const salesSummary = {
    avgDailySales: Math.round(avgDailySales),
    trend,
    recentDays: recentSales.slice(-7).map(d => ({
      date: d.date instanceof Date ? d.date.toISOString().split('T')[0] : String(d.date),
      sales: Math.round(Number(d.total))
    }))
  };

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `أنت محلل بيانات متخصص في التنبؤ بالمبيعات. قم بتحليل البيانات وتقديم توقعات للأيام القادمة.
          يجب أن تكون إجابتك بصيغة JSON فقط.`
        },
        {
          role: "user",
          content: `بناءً على بيانات المبيعات التالية، قدم توقعات للـ ${days} أيام القادمة:
          
          متوسط المبيعات اليومية: ${salesSummary.avgDailySales} ريال
          الاتجاه: ${salesSummary.trend}
          آخر 7 أيام: ${JSON.stringify(salesSummary.recentDays)}
          
          قدم التوقعات بالصيغة التالية:
          {
            "forecasts": [
              {
                "period": "اليوم 1",
                "predicted": 5000,
                "lowerBound": 4000,
                "upperBound": 6000,
                "confidence": 0.85,
                "factors": [{"factor": "نهاية الأسبوع", "impact": "+15%"}]
              }
            ],
            "overallTrend": "up"
          }`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "sales_forecast",
          strict: true,
          schema: {
            type: "object",
            properties: {
              forecasts: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    period: { type: "string" },
                    predicted: { type: "number" },
                    lowerBound: { type: "number" },
                    upperBound: { type: "number" },
                    confidence: { type: "number" },
                    factors: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          factor: { type: "string" },
                          impact: { type: "string" }
                        },
                        required: ["factor", "impact"],
                        additionalProperties: false
                      }
                    }
                  },
                  required: ["period", "predicted", "lowerBound", "upperBound", "confidence", "factors"],
                  additionalProperties: false
                }
              },
              overallTrend: { type: "string" }
            },
            required: ["forecasts", "overallTrend"],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0].message.content;
    const result = JSON.parse(typeof content === 'string' ? content : JSON.stringify(content) || '{}');
    return result.forecasts.map((f: any) => ({
      ...f,
      trend: result.overallTrend as 'up' | 'down' | 'stable'
    }));
  } catch (error) {
    // في حالة فشل LLM، نستخدم توقعات بسيطة
    const forecasts: SalesForecast[] = [];
    for (let i = 1; i <= days; i++) {
      const trendMultiplier = trend === 'up' ? 1.02 : trend === 'down' ? 0.98 : 1;
      const predicted = avgDailySales * Math.pow(trendMultiplier, i);
      forecasts.push({
        period: `اليوم ${i}`,
        predicted: Math.round(predicted),
        lowerBound: Math.round(predicted * 0.8),
        upperBound: Math.round(predicted * 1.2),
        confidence: 0.7,
        factors: [],
        trend
      });
    }
    return forecasts;
  }
}

/**
 * تحليل وتصنيف العملاء (RFM)
 */
export async function analyzeCustomerSegments(): Promise<CustomerSegmentResult[]> {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  // جلب بيانات العملاء مع إحصائيات الشراء
  const customerData = await db
    .select({
      customerId: customers.id,
      customerName: customers.name,
      lastPurchase: sql<Date>`MAX(${invoices.createdAt})`,
      purchaseCount: sql<number>`COUNT(${invoices.id})`,
      totalSpent: sql<number>`COALESCE(SUM(${invoices.total}), 0)`,
    })
    .from(customers)
    .leftJoin(invoices, eq(customers.id, invoices.customerId))
    .groupBy(customers.id, customers.name);

  if (customerData.length === 0) return [];

  // حساب الـ percentiles للـ RFM
  const now = new Date();
  const recencyValues = customerData.map(c => {
    const lastPurchase = c.lastPurchase ? new Date(c.lastPurchase) : new Date(0);
    return Math.floor((now.getTime() - lastPurchase.getTime()) / (1000 * 60 * 60 * 24));
  });
  const frequencyValues = customerData.map(c => Number(c.purchaseCount));
  const monetaryValues = customerData.map(c => Number(c.totalSpent));

  // دالة لحساب الـ score (1-5)
  function calculateScore(value: number, values: number[], isRecency: boolean = false): number {
    const sorted = [...values].sort((a, b) => a - b);
    const percentile = sorted.indexOf(value) / sorted.length;
    
    if (isRecency) {
      // للـ recency، القيمة الأقل أفضل
      if (percentile <= 0.2) return 5;
      if (percentile <= 0.4) return 4;
      if (percentile <= 0.6) return 3;
      if (percentile <= 0.8) return 2;
      return 1;
    } else {
      // للـ frequency و monetary، القيمة الأعلى أفضل
      if (percentile >= 0.8) return 5;
      if (percentile >= 0.6) return 4;
      if (percentile >= 0.4) return 3;
      if (percentile >= 0.2) return 2;
      return 1;
    }
  }

  // دالة لتحديد الشريحة
  function determineSegment(r: number, f: number, m: number): string {
    const rfmScore = r * 100 + f * 10 + m;
    
    if (r >= 4 && f >= 4 && m >= 4) return 'champions';
    if (r >= 3 && f >= 3 && m >= 4) return 'loyal_customers';
    if (r >= 4 && f <= 2 && m >= 3) return 'potential_loyalists';
    if (r >= 4 && f <= 2 && m <= 2) return 'new_customers';
    if (r >= 3 && f >= 2 && m >= 2) return 'promising';
    if (r >= 2 && r <= 3 && f >= 2 && m >= 2) return 'need_attention';
    if (r <= 2 && f >= 3 && m >= 3) return 'about_to_sleep';
    if (r <= 2 && f >= 2 && m >= 3) return 'at_risk';
    if (r <= 1 && f >= 4 && m >= 4) return 'cant_lose';
    if (r <= 2 && f <= 2) return 'hibernating';
    return 'lost';
  }

  // دالة لحساب خطر الفقدان
  function calculateChurnRisk(r: number, f: number, segment: string): number {
    const baseRisk = (5 - r) * 0.4 + (5 - f) * 0.3;
    const segmentRisk: Record<string, number> = {
      'champions': 0.05,
      'loyal_customers': 0.1,
      'potential_loyalists': 0.2,
      'new_customers': 0.3,
      'promising': 0.25,
      'need_attention': 0.4,
      'about_to_sleep': 0.5,
      'at_risk': 0.7,
      'cant_lose': 0.6,
      'hibernating': 0.8,
      'lost': 0.95
    };
    return Math.min(baseRisk * 0.5 + (segmentRisk[segment] || 0.5) * 0.5, 1);
  }

  // دالة للحصول على التوصيات
  function getRecommendations(segment: string): string[] {
    const recommendations: Record<string, string[]> = {
      'champions': ['كافئهم ببرنامج VIP', 'اطلب منهم مراجعات وتوصيات', 'أعطهم وصول مبكر للمنتجات الجديدة'],
      'loyal_customers': ['قدم لهم برنامج ولاء', 'اقترح منتجات مكملة', 'أرسل عروض حصرية'],
      'potential_loyalists': ['قدم عروض الانضمام لبرنامج الولاء', 'تواصل معهم بانتظام', 'اقترح منتجات بناءً على مشترياتهم'],
      'new_customers': ['رحب بهم برسالة ترحيب', 'قدم خصم على الشراء الثاني', 'عرّفهم على منتجاتك الأخرى'],
      'promising': ['قدم عروض محدودة الوقت', 'أرسل توصيات شخصية', 'تابع معهم بعد الشراء'],
      'need_attention': ['أرسل عرض خاص لإعادة التفاعل', 'اسأل عن رأيهم في الخدمة', 'قدم خصم على الشراء القادم'],
      'about_to_sleep': ['أرسل حملة إعادة تنشيط', 'قدم عرض لا يمكن رفضه', 'ذكّرهم بما يفوتهم'],
      'at_risk': ['تواصل معهم فوراً', 'قدم عرض استثنائي', 'اسأل عن سبب توقفهم'],
      'cant_lose': ['اتصل بهم شخصياً', 'قدم أفضل عروضك', 'حل أي مشاكل فوراً'],
      'hibernating': ['أرسل حملة "نفتقدك"', 'قدم خصم كبير للعودة', 'عرض منتجات جديدة'],
      'lost': ['حملة استعادة بخصم كبير', 'استبيان لمعرفة السبب', 'عرض تجربة مجانية']
    };
    return recommendations[segment] || [];
  }

  return customerData.map((c, index) => {
    const recency = recencyValues[index];
    const frequency = frequencyValues[index];
    const monetary = monetaryValues[index];

    const rScore = calculateScore(recency, recencyValues, true);
    const fScore = calculateScore(frequency, frequencyValues);
    const mScore = calculateScore(monetary, monetaryValues);

    const segment = determineSegment(rScore, fScore, mScore);

    return {
      customerId: c.customerId,
      customerName: c.customerName || 'عميل',
      segment,
      rfmScore: `${rScore}${fScore}${mScore}`,
      recencyScore: rScore,
      frequencyScore: fScore,
      monetaryScore: mScore,
      totalSpent: Number(c.totalSpent),
      lastPurchaseDate: c.lastPurchase,
      churnRisk: calculateChurnRisk(rScore, fScore, segment),
      recommendations: getRecommendations(segment)
    };
  });
}

/**
 * الكشف عن الشذوذ مع إرسال إشعارات فورية
 */
export async function detectAnomalies(
  dateRange: { startDate: Date; endDate: Date },
  options?: { sendNotifications?: boolean; branchId?: number }
): Promise<AnomalyResult[]> {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  const anomalies: AnomalyResult[] = [];

  // جلب الإيرادات اليومية مع معلومات الفرع
  const dailySales = await db
    .select({
      date: dailyRevenues.date,
      branchId: dailyRevenues.branchId,
      total: sql<number>`COALESCE(SUM(${dailyRevenues.cash} + ${dailyRevenues.network}), 0)`,
    })
    .from(dailyRevenues)
    .where(
      and(
        gte(dailyRevenues.date, dateRange.startDate),
        lte(dailyRevenues.date, dateRange.endDate),
        options?.branchId ? eq(dailyRevenues.branchId, options.branchId) : undefined
      )
    )
    .groupBy(dailyRevenues.date, dailyRevenues.branchId)
    .orderBy(asc(dailyRevenues.date));

  // جلب أسماء الفروع
  const branchesData = await db.select().from(branches);
  const branchMap = new Map(branchesData.map(b => [b.id, b.nameAr || b.name || `فرع ${b.id}`]));

  if (dailySales.length >= 7) {
    // حساب المتوسط والانحراف المعياري
    const values = dailySales.map(d => Number(d.total));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);

    // الكشف عن القيم الشاذة (أكثر من 2 انحراف معياري)
    dailySales.forEach(day => {
      const value = Number(day.total);
      const deviation = Math.abs(value - mean) / stdDev;

      if (deviation > 2) {
        const dateStr = day.date instanceof Date ? day.date.toISOString().split('T')[0] : String(day.date);
        const branchName = branchMap.get(day.branchId) || 'غير محدد';
        const deviationPercent = ((value - mean) / mean) * 100;
        
        anomalies.push({
          type: 'sales',
          severity: deviation > 3 ? 'high' : 'medium',
          description: value > mean 
            ? `إيرادات مرتفعة بشكل غير طبيعي في ${dateStr}`
            : `إيرادات منخفضة بشكل غير طبيعي في ${dateStr}`,
          value,
          expectedValue: mean,
          deviation: Math.round(deviation * 100) / 100,
          date: day.date instanceof Date ? day.date : new Date(day.date),
          relatedEntity: { type: 'branch', id: day.branchId, name: branchName }
        });
      }
    });
  }

  // إرسال إشعارات فورية للشذوذ الحرج والتحذيري
  if (options?.sendNotifications && anomalies.length > 0) {
    try {
      const { sendAnomalyAlert } = await import('../notifications/emailNotificationService');
      
      for (const anomaly of anomalies) {
        if (anomaly.severity === 'high' || anomaly.severity === 'medium') {
          const branchName = anomaly.relatedEntity?.name || 'غير محدد';
          const dateStr = anomaly.date instanceof Date 
            ? anomaly.date.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })
            : String(anomaly.date);
          const deviationPercent = ((anomaly.value - anomaly.expectedValue) / anomaly.expectedValue) * 100;
          
          await sendAnomalyAlert({
            anomalyType: 'revenue_deviation',
            severity: anomaly.severity === 'high' ? 'critical' : 'warning',
            branchName,
            date: dateStr,
            title: anomaly.value > anomaly.expectedValue ? 'ارتفاع غير طبيعي في الإيرادات' : 'انخفاض غير طبيعي في الإيرادات',
            description: anomaly.description,
            currentValue: anomaly.value,
            expectedValue: anomaly.expectedValue,
            deviationPercent: Math.round(deviationPercent * 10) / 10,
            additionalDetails: `معامل الانحراف المعياري: ${anomaly.deviation}σ`,
          });
        }
      }
    } catch (error) {
      console.error('[Anomaly Detection] خطأ في إرسال الإشعارات:', error);
    }
  }

  return anomalies;
}

/**
 * الحصول على التوصيات الذكية
 */
export async function getSmartRecommendations(): Promise<AIRecommendation[]> {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  const recommendations: AIRecommendation[] = [];

  // 1. توصيات المخزون
  const lowStockProducts = await db
    .select({
      id: products.id,
      name: products.name,
      quantity: products.quantity,
      minQuantity: products.minQuantity,
    })
    .from(products)
    .where(
      and(
        eq(products.isActive, true),
        sql`${products.quantity} <= ${products.minQuantity}`
      )
    )
    .limit(10);

  lowStockProducts.forEach(product => {
    recommendations.push({
      type: 'inventory_reorder',
      priority: product.quantity === 0 ? 'critical' : 'high',
      title: `إعادة طلب: ${product.name}`,
      description: `المخزون الحالي (${product.quantity}) أقل من الحد الأدنى (${product.minQuantity})`,
      actionRequired: `اطلب ${(product.minQuantity || 0) * 2 - (product.quantity || 0)} وحدة`,
      expectedImpact: 'تجنب نفاد المخزون وخسارة المبيعات',
      confidence: 0.95
    });
  });

  // 2. توصيات العملاء المعرضين للفقدان
  const segments = await analyzeCustomerSegments();
  const atRiskCustomers = segments.filter(s => s.churnRisk > 0.6).slice(0, 5);

  atRiskCustomers.forEach(customer => {
    recommendations.push({
      type: 'customer_retention',
      priority: customer.churnRisk > 0.8 ? 'high' : 'medium',
      title: `احتفظ بالعميل: ${customer.customerName}`,
      description: `خطر فقدان العميل: ${Math.round(customer.churnRisk * 100)}%`,
      actionRequired: customer.recommendations[0] || 'تواصل مع العميل',
      expectedImpact: `الحفاظ على إيرادات بقيمة ${Math.round(customer.totalSpent)} ريال`,
      confidence: 0.85
    });
  });

  return recommendations;
}

/**
 * تحليل شامل باستخدام AI
 */
export async function getAIInsights(branchId?: number): Promise<{
  summary: string;
  keyFindings: string[];
  recommendations: string[];
  riskLevel: 'low' | 'medium' | 'high';
}> {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  // جمع البيانات للتحليل - استخدام dailyRevenues بدلاً من invoices
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  // جلب الإيرادات الفعلية من dailyRevenues
  const revenueConditions = [
    gte(dailyRevenues.date, startDate),
    lte(dailyRevenues.date, endDate)
  ];
  if (branchId) revenueConditions.push(eq(dailyRevenues.branchId, branchId));

  const [revenueData] = await db
    .select({
      totalRevenue: sql<number>`COALESCE(SUM(${dailyRevenues.cash} + ${dailyRevenues.network}), 0)`,
      daysCount: sql<number>`COUNT(DISTINCT ${dailyRevenues.date})`,
    })
    .from(dailyRevenues)
    .where(and(...revenueConditions));

  const [lowStock] = await db
    .select({
      count: sql<number>`COUNT(*)`,
    })
    .from(products)
    .where(
      and(
        eq(products.isActive, true),
        sql`${products.quantity} <= ${products.minQuantity}`
      )
    );

  // حساب المتوسط اليومي بناءً على 30 يوم
  const totalRevenue = Number(revenueData?.totalRevenue || 0);
  const avgDailyRevenue = totalRevenue / 30;
  const daysWithData = Number(revenueData?.daysCount || 0);

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `أنت محلل أعمال خبير. قم بتحليل البيانات وتقديم رؤى مفيدة باللغة العربية.
          يجب أن تكون إجابتك بصيغة JSON فقط.`
        },
        {
          role: "user",
          content: `قم بتحليل البيانات التالية وقدم رؤى:
          
          - إجمالي الإيرادات (آخر 30 يوم): ${totalRevenue.toFixed(0)} ريال
          - متوسط الإيراد اليومي: ${avgDailyRevenue.toFixed(0)} ريال
          - عدد الأيام المسجلة: ${daysWithData} يوم
          - منتجات منخفضة المخزون: ${lowStock?.count || 0}
          
          قدم التحليل بالصيغة التالية:
          {
            "summary": "ملخص قصير للوضع العام",
            "keyFindings": ["نقطة 1", "نقطة 2"],
            "recommendations": ["توصية 1", "توصية 2"],
            "riskLevel": "low" أو "medium" أو "high"
          }`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "ai_insights",
          strict: true,
          schema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              keyFindings: { type: "array", items: { type: "string" } },
              recommendations: { type: "array", items: { type: "string" } },
              riskLevel: { type: "string", enum: ["low", "medium", "high"] }
            },
            required: ["summary", "keyFindings", "recommendations", "riskLevel"],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0].message.content;
    return JSON.parse(typeof content === 'string' ? content : JSON.stringify(content) || '{}');
  } catch (error) {
    // في حالة فشل LLM - إرجاع تحليل بناءً على البيانات الفعلية
    const riskLevel = totalRevenue === 0 ? 'high' : (lowStock?.count || 0) > 10 ? 'high' : 'medium';
    return {
      summary: totalRevenue > 0 
        ? `إجمالي الإيرادات خلال الشهر الماضي ${totalRevenue.toFixed(0)} ريال بمتوسط يومي ${avgDailyRevenue.toFixed(0)} ريال`
        : 'لا توجد إيرادات مسجلة خلال الفترة المحددة',
      keyFindings: [
        `إجمالي الإيرادات: ${totalRevenue.toFixed(0)} ريال`,
        `متوسط الإيراد اليومي: ${avgDailyRevenue.toFixed(0)} ريال`,
        `عدد الأيام المسجلة: ${daysWithData} يوم`,
        `منتجات منخفضة المخزون: ${lowStock?.count || 0}`
      ],
      recommendations: [
        'راجع المنتجات منخفضة المخزون',
        'تابع أداء الإيرادات اليومية'
      ],
      riskLevel
    };
  }
}
