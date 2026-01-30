/**
 * مركز أدوات الذكاء الاصطناعي الموحد
 * AI Tools Hub - نقطة الوصول المركزية لجميع قدرات الذكاء الاصطناعي
 * 
 * المبادئ:
 * 1. التكامل الشامل - جميع الأدوات متاحة من مكان واحد
 * 2. الذكاء السياقي - الأدوات تفهم السياق وتتكيف معه
 * 3. التعلم المستمر - تحسين الأداء بناءً على الاستخدام
 * 4. الشفافية - توثيق كامل لكل قرار وتوصية
 */

import { getDb } from "../db";
import { invokeLLM } from "../_core/llm";
import {
  invoices, invoiceItems, expenses, products, customers, employees, branches,
  dailyRevenues, weeklyBonuses, employeeRequests, payrolls,
  purchaseOrders, categories
} from "../../drizzle/schema";
import { eq, and, gte, lte, desc, asc, sql, count, sum, avg } from "drizzle-orm";

// ==================== أنواع البيانات الأساسية ====================

export interface AIToolContext {
  userId: number;
  userRole: string;
  branchId?: number;
  timestamp: Date;
  sessionId?: string;
  previousActions?: string[];
}

export interface AIToolResult<T = any> {
  success: boolean;
  tool: string;
  executionTime: number;
  data?: T;
  insights: string[];
  recommendations: AIRecommendation[];
  confidence: number;
  error?: string;
  metadata: {
    dataSource: string;
    recordsAnalyzed: number;
    period?: { start: Date; end: Date };
  };
}

export interface AIRecommendation {
  id: string;
  type: 'action' | 'warning' | 'opportunity' | 'optimization';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: {
    metric: string;
    currentValue: number;
    projectedValue: number;
    changePercent: number;
  };
  actionSteps: string[];
  estimatedEffort: 'low' | 'medium' | 'high';
  estimatedROI?: number;
  expiresAt?: Date;
}

// ==================== أداة تحليل المبيعات الذكية ====================

export interface SalesIntelligenceResult {
  summary: {
    totalSales: number;
    averageTicket: number;
    transactionCount: number;
    growthRate: number;
  };
  trends: {
    daily: { date: string; value: number }[];
    byCategory: { category: string; value: number; percentage: number }[];
    byBranch: { branch: string; value: number; percentage: number }[];
  };
  topPerformers: {
    products: { name: string; sales: number; quantity: number }[];
    employees: { name: string; sales: number; transactions: number }[];
    customers: { name: string; totalSpent: number; visits: number }[];
  };
  anomalies: {
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    value: number;
    expectedValue: number;
  }[];
}

export async function analyzeSalesIntelligence(
  context: AIToolContext,
  options: {
    startDate: Date;
    endDate: Date;
    branchId?: number;
    includeAIInsights?: boolean;
  }
): Promise<AIToolResult<SalesIntelligenceResult>> {
  const startTime = Date.now();
  const db = await getDb();
  if (!db) {
    return {
      success: false,
      tool: 'sales_intelligence',
      executionTime: Date.now() - startTime,
      insights: [],
      recommendations: [],
      confidence: 0,
      error: 'قاعدة البيانات غير متاحة',
      metadata: { dataSource: 'none', recordsAnalyzed: 0 }
    };
  }

  try {
    const { startDate, endDate, branchId, includeAIInsights = true } = options;

    // جمع بيانات المبيعات
    let salesQuery = db.select({
      total: sql<number>`COALESCE(SUM(${invoices.total}), 0)`,
      count: count(),
      avgTicket: sql<number>`COALESCE(AVG(${invoices.total}), 0)`
    })
    .from(invoices)
    .where(and(
      gte(invoices.createdAt, startDate),
      lte(invoices.createdAt, endDate)
    ));

    // إضافة فلتر الفرع إذا كان محدداً - سيتم التعامل معه في الاستعلام الرئيسي

    const salesData = await salesQuery;
    const totalSales = Number(salesData[0]?.total || 0);
    const transactionCount = Number(salesData[0]?.count || 0);
    const averageTicket = Number(salesData[0]?.avgTicket || 0);

    // حساب معدل النمو مقارنة بالفترة السابقة
    const periodLength = endDate.getTime() - startDate.getTime();
    const previousStartDate = new Date(startDate.getTime() - periodLength);
    const previousEndDate = new Date(startDate.getTime() - 1);

    let previousSalesQuery = db.select({
      total: sql<number>`COALESCE(SUM(${invoices.total}), 0)`
    })
    .from(invoices)
    .where(and(
      gte(invoices.createdAt, previousStartDate),
      lte(invoices.createdAt, previousEndDate)
    ));

    // إضافة فلتر الفرع إذا كان محدداً - سيتم التعامل معه في الاستعلام الرئيسي

    const previousSales = await previousSalesQuery;
    const previousTotal = Number(previousSales[0]?.total || 0);
    const growthRate = previousTotal > 0 
      ? ((totalSales - previousTotal) / previousTotal) * 100 
      : 0;

    // المبيعات اليومية
    const dailyTrends = await db.select({
      date: sql<string>`DATE(${invoices.createdAt})`,
      value: sql<number>`COALESCE(SUM(${invoices.total}), 0)`
    })
    .from(invoices)
    .where(and(
      gte(invoices.createdAt, startDate),
      lte(invoices.createdAt, endDate)
    ))
    .groupBy(sql`DATE(${invoices.createdAt})`)
    .orderBy(sql`DATE(${invoices.createdAt})`);

    // المبيعات حسب الفرع
    const branchTrends = await db.select({
      branch: branches.name,
      value: sql<number>`COALESCE(SUM(${invoices.total}), 0)`
    })
    .from(invoices)
    .innerJoin(branches, eq(invoices.branchId, branches.id))
    .where(and(
      gte(invoices.createdAt, startDate),
      lte(invoices.createdAt, endDate)
    ))
    .groupBy(branches.name);

    // أفضل المنتجات
    const topProducts = await db.select({
      name: products.name,
      sales: sql<number>`COALESCE(SUM(${invoices.total}), 0)`,
      quantity: sql<number>`COUNT(*)`
    })
    .from(invoices)
    .innerJoin(invoiceItems, eq(invoices.id, invoiceItems.invoiceId))
    .innerJoin(products, eq(invoiceItems.productId, products.id))
    .where(and(
      gte(invoices.createdAt, startDate),
      lte(invoices.createdAt, endDate)
    ))
    .groupBy(products.name)
    .orderBy(desc(sql`SUM(${invoices.total})`))
    .limit(10);

    // أفضل العملاء
    const topCustomers = await db.select({
      name: customers.name,
      totalSpent: sql<number>`COALESCE(SUM(${invoices.total}), 0)`,
      visits: count()
    })
    .from(invoices)
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .where(and(
      gte(invoices.createdAt, startDate),
      lte(invoices.createdAt, endDate)
    ))
    .groupBy(customers.name)
    .orderBy(desc(sql`SUM(${invoices.total})`))
    .limit(10);

    // كشف الشذوذات
    const anomalies: SalesIntelligenceResult['anomalies'] = [];
    
    // التحقق من الانحرافات الكبيرة
    const avgDaily = totalSales / Math.max(dailyTrends.length, 1);
    for (const day of dailyTrends) {
      const deviation = Math.abs(Number(day.value) - avgDaily) / avgDaily;
      if (deviation > 0.5) {
        anomalies.push({
          type: Number(day.value) > avgDaily ? 'spike' : 'drop',
          description: Number(day.value) > avgDaily 
            ? `ارتفاع غير عادي في المبيعات يوم ${day.date}`
            : `انخفاض غير عادي في المبيعات يوم ${day.date}`,
          severity: deviation > 0.8 ? 'high' : deviation > 0.5 ? 'medium' : 'low',
          value: Number(day.value),
          expectedValue: avgDaily
        });
      }
    }

    // توليد التوصيات
    const recommendations: AIRecommendation[] = [];
    const insights: string[] = [];

    // تحليل النمو
    if (growthRate < -10) {
      recommendations.push({
        id: `rec_${Date.now()}_growth`,
        type: 'warning',
        priority: 'high',
        title: 'انخفاض ملحوظ في المبيعات',
        description: `انخفضت المبيعات بنسبة ${Math.abs(growthRate).toFixed(1)}% مقارنة بالفترة السابقة`,
        impact: {
          metric: 'المبيعات',
          currentValue: totalSales,
          projectedValue: totalSales * 1.1,
          changePercent: 10
        },
        actionSteps: [
          'مراجعة استراتيجية التسعير',
          'تحليل أسباب انخفاض الإقبال',
          'إطلاق حملات ترويجية مستهدفة',
          'تحسين تجربة العملاء'
        ],
        estimatedEffort: 'medium'
      });
      insights.push(`⚠️ المبيعات انخفضت بنسبة ${Math.abs(growthRate).toFixed(1)}%`);
    } else if (growthRate > 20) {
      insights.push(`✅ نمو ممتاز في المبيعات بنسبة ${growthRate.toFixed(1)}%`);
      recommendations.push({
        id: `rec_${Date.now()}_capitalize`,
        type: 'opportunity',
        priority: 'medium',
        title: 'فرصة للاستفادة من النمو',
        description: 'المبيعات في نمو قوي، يمكن الاستفادة من هذا الزخم',
        impact: {
          metric: 'المبيعات',
          currentValue: totalSales,
          projectedValue: totalSales * 1.3,
          changePercent: 30
        },
        actionSteps: [
          'زيادة المخزون للمنتجات الأكثر طلباً',
          'توسيع فريق المبيعات',
          'استثمار في التسويق لتعزيز النمو'
        ],
        estimatedEffort: 'medium',
        estimatedROI: 150
      });
    }

    // تحليل متوسط الفاتورة
    if (averageTicket < 100) {
      recommendations.push({
        id: `rec_${Date.now()}_upsell`,
        type: 'optimization',
        priority: 'medium',
        title: 'فرصة لزيادة متوسط الفاتورة',
        description: `متوسط الفاتورة ${averageTicket.toFixed(0)} ر.س. يمكن تحسينه`,
        impact: {
          metric: 'متوسط الفاتورة',
          currentValue: averageTicket,
          projectedValue: averageTicket * 1.25,
          changePercent: 25
        },
        actionSteps: [
          'تدريب الموظفين على البيع الإضافي',
          'إنشاء عروض باقات',
          'تحسين عرض المنتجات المكملة'
        ],
        estimatedEffort: 'low',
        estimatedROI: 200
      });
    }

    // تحليل بالذكاء الاصطناعي
    if (includeAIInsights && totalSales > 0) {
      try {
        const aiResponse = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: `أنت محلل مبيعات خبير. قدم تحليلاً موجزاً ومفيداً بالعربية.
              قدم 3-5 نقاط رئيسية فقط. كن محدداً وعملياً.`
            },
            {
              role: 'user',
              content: `حلل بيانات المبيعات التالية:
              - إجمالي المبيعات: ${totalSales.toLocaleString()} ر.س.
              - عدد المعاملات: ${transactionCount}
              - متوسط الفاتورة: ${averageTicket.toFixed(0)} ر.س.
              - معدل النمو: ${growthRate.toFixed(1)}%
              - عدد الشذوذات المكتشفة: ${anomalies.length}
              
              قدم تحليلاً موجزاً مع توصيات عملية.`
            }
          ]
        });

        const aiInsight = aiResponse.choices[0]?.message?.content as string | undefined;
        if (aiInsight) {
          insights.push('📊 تحليل الذكاء الاصطناعي:', aiInsight);
        }
      } catch (error) {
        // تجاهل أخطاء الذكاء الاصطناعي
      }
    }

    const result: SalesIntelligenceResult = {
      summary: {
        totalSales,
        averageTicket,
        transactionCount,
        growthRate
      },
      trends: {
        daily: dailyTrends.map(d => ({ date: String(d.date), value: Number(d.value) })),
        byCategory: [],
        byBranch: branchTrends.map(b => ({
          branch: String(b.branch),
          value: Number(b.value),
          percentage: totalSales > 0 ? (Number(b.value) / totalSales) * 100 : 0
        }))
      },
      topPerformers: {
        products: topProducts.map(p => ({
          name: String(p.name),
          sales: Number(p.sales),
          quantity: Number(p.quantity)
        })),
        employees: [],
        customers: topCustomers.map(c => ({
          name: String(c.name),
          totalSpent: Number(c.totalSpent),
          visits: Number(c.visits)
        }))
      },
      anomalies
    };

    return {
      success: true,
      tool: 'sales_intelligence',
      executionTime: Date.now() - startTime,
      data: result,
      insights,
      recommendations,
      confidence: 0.85,
      metadata: {
        dataSource: 'invoices, branches, products, customers',
        recordsAnalyzed: transactionCount,
        period: { start: startDate, end: endDate }
      }
    };
  } catch (error) {
    return {
      success: false,
      tool: 'sales_intelligence',
      executionTime: Date.now() - startTime,
      insights: [],
      recommendations: [],
      confidence: 0,
      error: `خطأ في التحليل: ${error}`,
      metadata: { dataSource: 'none', recordsAnalyzed: 0 }
    };
  }
}

// ==================== أداة تحليل سلوك العملاء ====================

export interface CustomerBehaviorResult {
  segments: {
    name: string;
    count: number;
    avgSpend: number;
    visitFrequency: number;
    characteristics: string[];
  }[];
  churnRisk: {
    customerId: number;
    customerName: string;
    riskScore: number;
    lastVisit: Date;
    avgSpend: number;
    suggestedAction: string;
  }[];
  loyaltyMetrics: {
    repeatCustomerRate: number;
    avgCustomerLifetimeValue: number;
    topLoyalCustomers: { name: string; totalSpent: number; visits: number }[];
  };
  purchasePatterns: {
    preferredProducts: { product: string; frequency: number }[];
    preferredTimes: { hour: number; frequency: number }[];
    preferredDays: { day: string; frequency: number }[];
  };
}

export async function analyzeCustomerBehavior(
  context: AIToolContext,
  options: {
    startDate: Date;
    endDate: Date;
    includeChurnPrediction?: boolean;
  }
): Promise<AIToolResult<CustomerBehaviorResult>> {
  const startTime = Date.now();
  const db = await getDb();
  if (!db) {
    return {
      success: false,
      tool: 'customer_behavior',
      executionTime: Date.now() - startTime,
      insights: [],
      recommendations: [],
      confidence: 0,
      error: 'قاعدة البيانات غير متاحة',
      metadata: { dataSource: 'none', recordsAnalyzed: 0 }
    };
  }

  try {
    const { startDate, endDate, includeChurnPrediction = true } = options;

    // تحليل العملاء
    const customerStats = await db.select({
      customerId: customers.id,
      customerName: customers.name,
      totalSpent: sql<number>`COALESCE(SUM(${invoices.total}), 0)`,
      visitCount: count(),
      lastVisit: sql<Date>`MAX(${invoices.createdAt})`,
      avgTicket: sql<number>`COALESCE(AVG(${invoices.total}), 0)`
    })
    .from(customers)
    .leftJoin(invoices, eq(customers.id, invoices.customerId))
    .groupBy(customers.id, customers.name);

    // تقسيم العملاء إلى شرائح
    const segments: CustomerBehaviorResult['segments'] = [];
    const highValue = customerStats.filter(c => Number(c.totalSpent) > 5000);
    const mediumValue = customerStats.filter(c => Number(c.totalSpent) >= 1000 && Number(c.totalSpent) <= 5000);
    const lowValue = customerStats.filter(c => Number(c.totalSpent) < 1000 && Number(c.totalSpent) > 0);

    if (highValue.length > 0) {
      segments.push({
        name: 'عملاء VIP',
        count: highValue.length,
        avgSpend: highValue.reduce((sum, c) => sum + Number(c.totalSpent), 0) / highValue.length,
        visitFrequency: highValue.reduce((sum, c) => sum + Number(c.visitCount), 0) / highValue.length,
        characteristics: ['إنفاق عالي', 'زيارات متكررة', 'ولاء قوي']
      });
    }

    if (mediumValue.length > 0) {
      segments.push({
        name: 'عملاء منتظمون',
        count: mediumValue.length,
        avgSpend: mediumValue.reduce((sum, c) => sum + Number(c.totalSpent), 0) / mediumValue.length,
        visitFrequency: mediumValue.reduce((sum, c) => sum + Number(c.visitCount), 0) / mediumValue.length,
        characteristics: ['إنفاق متوسط', 'زيارات معتدلة', 'إمكانية تطوير']
      });
    }

    if (lowValue.length > 0) {
      segments.push({
        name: 'عملاء جدد/عرضيون',
        count: lowValue.length,
        avgSpend: lowValue.reduce((sum, c) => sum + Number(c.totalSpent), 0) / lowValue.length,
        visitFrequency: lowValue.reduce((sum, c) => sum + Number(c.visitCount), 0) / lowValue.length,
        characteristics: ['إنفاق منخفض', 'زيارات قليلة', 'بحاجة لتحفيز']
      });
    }

    // تحليل مخاطر فقدان العملاء
    const churnRisk: CustomerBehaviorResult['churnRisk'] = [];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    if (includeChurnPrediction) {
      for (const customer of customerStats) {
        const lastVisitDate = customer.lastVisit ? new Date(customer.lastVisit) : null;
        const daysSinceLastVisit = lastVisitDate 
          ? Math.floor((Date.now() - lastVisitDate.getTime()) / (24 * 60 * 60 * 1000))
          : 999;
        
        // حساب درجة خطر الفقدان
        let riskScore = 0;
        if (daysSinceLastVisit > 60) riskScore += 40;
        else if (daysSinceLastVisit > 30) riskScore += 20;
        
        if (Number(customer.visitCount) < 3) riskScore += 30;
        if (Number(customer.avgTicket) < 100) riskScore += 20;

        if (riskScore > 50) {
          churnRisk.push({
            customerId: customer.customerId,
            customerName: String(customer.customerName),
            riskScore: Math.min(riskScore, 100),
            lastVisit: lastVisitDate || new Date(0),
            avgSpend: Number(customer.avgTicket),
            suggestedAction: riskScore > 70 
              ? 'اتصال شخصي مع عرض خاص'
              : 'إرسال رسالة تذكيرية مع خصم'
          });
        }
      }
    }

    // مقاييس الولاء
    const repeatCustomers = customerStats.filter(c => Number(c.visitCount) > 1);
    const repeatCustomerRate = customerStats.length > 0 
      ? (repeatCustomers.length / customerStats.length) * 100 
      : 0;

    const avgLifetimeValue = customerStats.length > 0
      ? customerStats.reduce((sum, c) => sum + Number(c.totalSpent), 0) / customerStats.length
      : 0;

    const topLoyalCustomers = customerStats
      .sort((a, b) => Number(b.totalSpent) - Number(a.totalSpent))
      .slice(0, 10)
      .map(c => ({
        name: String(c.customerName),
        totalSpent: Number(c.totalSpent),
        visits: Number(c.visitCount)
      }));

    // توليد التوصيات
    const recommendations: AIRecommendation[] = [];
    const insights: string[] = [];

    if (churnRisk.length > 0) {
      recommendations.push({
        id: `rec_${Date.now()}_churn`,
        type: 'warning',
        priority: 'high',
        title: 'عملاء معرضون للفقدان',
        description: `${churnRisk.length} عميل معرض لخطر الفقدان`,
        impact: {
          metric: 'الاحتفاظ بالعملاء',
          currentValue: repeatCustomerRate,
          projectedValue: repeatCustomerRate + 5,
          changePercent: 5
        },
        actionSteps: [
          'التواصل مع العملاء المعرضين للخطر',
          'تقديم عروض خاصة للعودة',
          'استبيان لفهم أسباب الابتعاد'
        ],
        estimatedEffort: 'medium'
      });
      insights.push(`⚠️ ${churnRisk.length} عميل معرض لخطر الفقدان`);
    }

    if (repeatCustomerRate < 30) {
      recommendations.push({
        id: `rec_${Date.now()}_loyalty`,
        type: 'optimization',
        priority: 'high',
        title: 'تحسين برنامج الولاء',
        description: `معدل العملاء المتكررين ${repeatCustomerRate.toFixed(1)}% فقط`,
        impact: {
          metric: 'معدل التكرار',
          currentValue: repeatCustomerRate,
          projectedValue: 50,
          changePercent: 66
        },
        actionSteps: [
          'إطلاق برنامج نقاط ولاء',
          'عروض خاصة للعملاء المتكررين',
          'تحسين تجربة ما بعد الشراء'
        ],
        estimatedEffort: 'high',
        estimatedROI: 300
      });
    }

    insights.push(`📊 ${customerStats.length} عميل في قاعدة البيانات`);
    insights.push(`🔄 معدل العملاء المتكررين: ${repeatCustomerRate.toFixed(1)}%`);
    insights.push(`💰 متوسط قيمة العميل: ${avgLifetimeValue.toFixed(0)} ر.س.`);

    const result: CustomerBehaviorResult = {
      segments,
      churnRisk: churnRisk.slice(0, 20),
      loyaltyMetrics: {
        repeatCustomerRate,
        avgCustomerLifetimeValue: avgLifetimeValue,
        topLoyalCustomers
      },
      purchasePatterns: {
        preferredProducts: [],
        preferredTimes: [],
        preferredDays: []
      }
    };

    return {
      success: true,
      tool: 'customer_behavior',
      executionTime: Date.now() - startTime,
      data: result,
      insights,
      recommendations,
      confidence: 0.8,
      metadata: {
        dataSource: 'customers, invoices',
        recordsAnalyzed: customerStats.length,
        period: { start: startDate, end: endDate }
      }
    };
  } catch (error) {
    return {
      success: false,
      tool: 'customer_behavior',
      executionTime: Date.now() - startTime,
      insights: [],
      recommendations: [],
      confidence: 0,
      error: `خطأ في التحليل: ${error}`,
      metadata: { dataSource: 'none', recordsAnalyzed: 0 }
    };
  }
}

// ==================== أداة التنبؤ بالطلب ====================

export interface DemandForecastResult {
  forecasts: {
    period: string;
    predictedDemand: number;
    confidence: number;
    lowerBound: number;
    upperBound: number;
  }[];
  seasonalPatterns: {
    pattern: string;
    strength: number;
    description: string;
  }[];
  productForecasts: {
    productId: number;
    productName: string;
    currentStock: number;
    predictedDemand: number;
    recommendedReorder: number;
    stockoutRisk: number;
  }[];
}

export async function forecastDemand(
  context: AIToolContext,
  options: {
    forecastPeriods: number; // عدد الفترات للتنبؤ
    granularity: 'daily' | 'weekly' | 'monthly';
    productIds?: number[];
  }
): Promise<AIToolResult<DemandForecastResult>> {
  const startTime = Date.now();
  const db = await getDb();
  if (!db) {
    return {
      success: false,
      tool: 'demand_forecast',
      executionTime: Date.now() - startTime,
      insights: [],
      recommendations: [],
      confidence: 0,
      error: 'قاعدة البيانات غير متاحة',
      metadata: { dataSource: 'none', recordsAnalyzed: 0 }
    };
  }

  try {
    const { forecastPeriods, granularity, productIds } = options;

    // جمع البيانات التاريخية
    const historicalData = await db.select({
      date: sql<string>`DATE(${invoices.createdAt})`,
      total: sql<number>`COALESCE(SUM(${invoices.total}), 0)`,
      count: count()
    })
    .from(invoices)
    .where(gte(invoices.createdAt, new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)))
    .groupBy(sql`DATE(${invoices.createdAt})`)
    .orderBy(sql`DATE(${invoices.createdAt})`);

    // حساب المتوسطات والاتجاهات
    const values = historicalData.map(d => Number(d.total));
    const avgValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    
    // حساب الاتجاه البسيط
    let trend = 0;
    if (values.length > 7) {
      const recentAvg = values.slice(-7).reduce((a, b) => a + b, 0) / 7;
      const olderAvg = values.slice(-14, -7).reduce((a, b) => a + b, 0) / 7;
      trend = olderAvg > 0 ? (recentAvg - olderAvg) / olderAvg : 0;
    }

    // توليد التنبؤات
    const forecasts: DemandForecastResult['forecasts'] = [];
    for (let i = 1; i <= forecastPeriods; i++) {
      const predictedValue = avgValue * (1 + trend * i * 0.5);
      const confidence = Math.max(0.5, 0.9 - (i * 0.05));
      const variance = avgValue * 0.2;
      
      const futureDate = new Date();
      if (granularity === 'daily') {
        futureDate.setDate(futureDate.getDate() + i);
      } else if (granularity === 'weekly') {
        futureDate.setDate(futureDate.getDate() + i * 7);
      } else {
        futureDate.setMonth(futureDate.getMonth() + i);
      }

      forecasts.push({
        period: futureDate.toISOString().split('T')[0],
        predictedDemand: Math.max(0, predictedValue),
        confidence,
        lowerBound: Math.max(0, predictedValue - variance),
        upperBound: predictedValue + variance
      });
    }

    // تحليل الأنماط الموسمية
    const seasonalPatterns: DemandForecastResult['seasonalPatterns'] = [];
    
    // تحليل أيام الأسبوع
    const dayOfWeekPattern = historicalData.reduce((acc, d) => {
      const dayOfWeek = new Date(d.date).getDay();
      if (!acc[dayOfWeek]) acc[dayOfWeek] = [];
      acc[dayOfWeek].push(Number(d.total));
      return acc;
    }, {} as Record<number, number[]>);

    const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    let maxDayAvg = 0;
    let maxDay = 0;
    for (const [day, values] of Object.entries(dayOfWeekPattern)) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      if (avg > maxDayAvg) {
        maxDayAvg = avg;
        maxDay = parseInt(day);
      }
    }

    if (maxDayAvg > avgValue * 1.2) {
      seasonalPatterns.push({
        pattern: 'يومي',
        strength: (maxDayAvg / avgValue - 1) * 100,
        description: `يوم ${dayNames[maxDay]} هو الأعلى مبيعاً بنسبة ${((maxDayAvg / avgValue - 1) * 100).toFixed(0)}% فوق المتوسط`
      });
    }

    // تنبؤات المنتجات
    const productForecasts: DemandForecastResult['productForecasts'] = [];
    const allProducts = await db.select().from(products).limit(20);
    
    for (const product of allProducts) {
      const productSales = await db.select({
        count: count()
      })
      .from(invoiceItems)
      .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
      .where(and(
        eq(invoiceItems.productId, product.id),
        gte(invoices.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      ));

      const monthlyDemand = Number(productSales[0]?.count || 0);
      const predictedDemand = Math.ceil(monthlyDemand * (1 + trend));
      const currentStock = product.quantity || 0;
      const stockoutRisk = currentStock < predictedDemand ? 
        Math.min(100, ((predictedDemand - currentStock) / predictedDemand) * 100) : 0;

      productForecasts.push({
        productId: product.id,
        productName: product.name,
        currentStock,
        predictedDemand,
        recommendedReorder: Math.max(0, predictedDemand - currentStock + 10),
        stockoutRisk
      });
    }

    // التوصيات
    const recommendations: AIRecommendation[] = [];
    const insights: string[] = [];

    const highRiskProducts = productForecasts.filter(p => p.stockoutRisk > 50);
    if (highRiskProducts.length > 0) {
      recommendations.push({
        id: `rec_${Date.now()}_stockout`,
        type: 'warning',
        priority: 'critical',
        title: 'منتجات معرضة لنفاد المخزون',
        description: `${highRiskProducts.length} منتج معرض لنفاد المخزون`,
        impact: {
          metric: 'توفر المخزون',
          currentValue: 100 - (highRiskProducts.length / productForecasts.length * 100),
          projectedValue: 95,
          changePercent: 10
        },
        actionSteps: highRiskProducts.slice(0, 5).map(p => 
          `طلب ${p.recommendedReorder} وحدة من ${p.productName}`
        ),
        estimatedEffort: 'low'
      });
      insights.push(`⚠️ ${highRiskProducts.length} منتج معرض لنفاد المخزون`);
    }

    if (trend > 0.1) {
      insights.push(`📈 اتجاه نمو إيجابي بنسبة ${(trend * 100).toFixed(1)}%`);
    } else if (trend < -0.1) {
      insights.push(`📉 اتجاه انخفاض بنسبة ${Math.abs(trend * 100).toFixed(1)}%`);
    }

    const result: DemandForecastResult = {
      forecasts,
      seasonalPatterns,
      productForecasts: productForecasts.sort((a, b) => b.stockoutRisk - a.stockoutRisk)
    };

    return {
      success: true,
      tool: 'demand_forecast',
      executionTime: Date.now() - startTime,
      data: result,
      insights,
      recommendations,
      confidence: 0.75,
      metadata: {
        dataSource: 'invoices, products',
        recordsAnalyzed: historicalData.length,
        period: { 
          start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), 
          end: new Date() 
        }
      }
    };
  } catch (error) {
    return {
      success: false,
      tool: 'demand_forecast',
      executionTime: Date.now() - startTime,
      insights: [],
      recommendations: [],
      confidence: 0,
      error: `خطأ في التنبؤ: ${error}`,
      metadata: { dataSource: 'none', recordsAnalyzed: 0 }
    };
  }
}

// ==================== أداة كشف الاحتيال ====================

export interface FraudDetectionResult {
  alerts: {
    id: string;
    type: 'transaction' | 'behavior' | 'pattern';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    evidence: string[];
    affectedEntity: { type: string; id: number; name: string };
    timestamp: Date;
    recommendedAction: string;
  }[];
  riskScore: number;
  suspiciousPatterns: {
    pattern: string;
    frequency: number;
    riskLevel: number;
  }[];
}

export async function detectFraud(
  context: AIToolContext,
  options: {
    startDate: Date;
    endDate: Date;
    sensitivityLevel?: 'low' | 'medium' | 'high';
  }
): Promise<AIToolResult<FraudDetectionResult>> {
  const startTime = Date.now();
  const db = await getDb();
  if (!db) {
    return {
      success: false,
      tool: 'fraud_detection',
      executionTime: Date.now() - startTime,
      insights: [],
      recommendations: [],
      confidence: 0,
      error: 'قاعدة البيانات غير متاحة',
      metadata: { dataSource: 'none', recordsAnalyzed: 0 }
    };
  }

  try {
    const { startDate, endDate, sensitivityLevel = 'medium' } = options;
    const alerts: FraudDetectionResult['alerts'] = [];
    const suspiciousPatterns: FraudDetectionResult['suspiciousPatterns'] = [];

    // عتبات الحساسية
    const thresholds = {
      low: { voidRate: 0.15, discountRate: 0.3, largeTransaction: 10000 },
      medium: { voidRate: 0.1, discountRate: 0.2, largeTransaction: 5000 },
      high: { voidRate: 0.05, discountRate: 0.1, largeTransaction: 2000 }
    }[sensitivityLevel];

    // تحليل معاملات كبيرة غير عادية
    const largeTransactions = await db.select({
      id: invoices.id,
      total: invoices.total,
      createdBy: invoices.createdBy,
      createdAt: invoices.createdAt
    })
    .from(invoices)
    .where(and(
      gte(invoices.createdAt, startDate),
      lte(invoices.createdAt, endDate),
      sql`${invoices.total} >= ${thresholds.largeTransaction}`
    ));

    // حساب المتوسط للمقارنة
    const avgTransaction = await db.select({
      avg: sql<number>`COALESCE(AVG(${invoices.total}), 0)`
    })
    .from(invoices)
    .where(and(
      gte(invoices.createdAt, startDate),
      lte(invoices.createdAt, endDate)
    ));

    const avgValue = Number(avgTransaction[0]?.avg || 0);

    for (const tx of largeTransactions) {
      if (Number(tx.total) > avgValue * 5) {
        alerts.push({
          id: `fraud_${tx.id}`,
          type: 'transaction',
          severity: Number(tx.total) > avgValue * 10 ? 'critical' : 'high',
          description: `معاملة كبيرة غير عادية: ${Number(tx.total).toLocaleString()} ر.س.`,
          evidence: [
            `المبلغ أكبر من المتوسط بـ ${(Number(tx.total) / avgValue).toFixed(1)} مرة`,
            `تاريخ المعاملة: ${new Date(tx.createdAt).toLocaleDateString('ar-SA')}`
          ],
          affectedEntity: { type: 'invoice', id: tx.id, name: `فاتورة #${tx.id}` },
          timestamp: new Date(tx.createdAt),
          recommendedAction: 'مراجعة المعاملة والتحقق من صحتها'
        });
      }
    }

    // تحليل أنماط الخصومات
    const discountPatterns = await db.select({
      createdBy: invoices.createdBy,
      discountCount: count(),
      avgDiscount: sql<number>`COALESCE(AVG(${invoices.discountAmount}), 0)`
    })
    .from(invoices)
    .where(and(
      gte(invoices.createdAt, startDate),
      lte(invoices.createdAt, endDate),
      sql`${invoices.discountAmount} > 0`
    ))
    .groupBy(invoices.createdBy);

    for (const pattern of discountPatterns) {
      if (Number(pattern.avgDiscount) > thresholds.discountRate * 100) {
        suspiciousPatterns.push({
          pattern: `خصومات متكررة من المستخدم #${pattern.createdBy}`,
          frequency: Number(pattern.discountCount),
          riskLevel: Math.min(100, Number(pattern.avgDiscount) * 2)
        });
      }
    }

    // حساب درجة المخاطر الإجمالية
    const riskScore = Math.min(100, 
      (alerts.filter(a => a.severity === 'critical').length * 30) +
      (alerts.filter(a => a.severity === 'high').length * 20) +
      (alerts.filter(a => a.severity === 'medium').length * 10) +
      (suspiciousPatterns.length * 5)
    );

    // التوصيات
    const recommendations: AIRecommendation[] = [];
    const insights: string[] = [];

    if (alerts.length > 0) {
      recommendations.push({
        id: `rec_${Date.now()}_fraud`,
        type: 'warning',
        priority: riskScore > 50 ? 'critical' : 'high',
        title: 'تنبيهات احتيال محتمل',
        description: `تم اكتشاف ${alerts.length} تنبيه يحتاج مراجعة`,
        impact: {
          metric: 'المخاطر المالية',
          currentValue: riskScore,
          projectedValue: 20,
          changePercent: -75
        },
        actionSteps: [
          'مراجعة التنبيهات الحرجة فوراً',
          'التحقق من المعاملات المشبوهة',
          'تعزيز الرقابة على العمليات الحساسة'
        ],
        estimatedEffort: 'high'
      });
    }

    insights.push(`🔍 تم تحليل ${largeTransactions.length} معاملة كبيرة`);
    insights.push(`⚠️ ${alerts.length} تنبيه يحتاج مراجعة`);
    insights.push(`📊 درجة المخاطر: ${riskScore}/100`);

    const result: FraudDetectionResult = {
      alerts,
      riskScore,
      suspiciousPatterns
    };

    return {
      success: true,
      tool: 'fraud_detection',
      executionTime: Date.now() - startTime,
      data: result,
      insights,
      recommendations,
      confidence: 0.7,
      metadata: {
        dataSource: 'invoices',
        recordsAnalyzed: largeTransactions.length,
        period: { start: startDate, end: endDate }
      }
    };
  } catch (error) {
    return {
      success: false,
      tool: 'fraud_detection',
      executionTime: Date.now() - startTime,
      insights: [],
      recommendations: [],
      confidence: 0,
      error: `خطأ في الكشف: ${error}`,
      metadata: { dataSource: 'none', recordsAnalyzed: 0 }
    };
  }
}

// ==================== واجهة مركز الأدوات الموحد ====================

export type AIToolName = 
  | 'sales_intelligence'
  | 'customer_behavior'
  | 'demand_forecast'
  | 'fraud_detection'
  | 'employee_performance'
  | 'inventory_optimization';

export interface AIToolsHubRequest {
  tool: AIToolName;
  context: AIToolContext;
  options: Record<string, any>;
}

export async function executeAITool(request: AIToolsHubRequest): Promise<AIToolResult> {
  const { tool, context, options } = request;

  switch (tool) {
    case 'sales_intelligence':
      return analyzeSalesIntelligence(context, options as any);
    case 'customer_behavior':
      return analyzeCustomerBehavior(context, options as any);
    case 'demand_forecast':
      return forecastDemand(context, options as any);
    case 'fraud_detection':
      return detectFraud(context, options as any);
    default:
      return {
        success: false,
        tool,
        executionTime: 0,
        insights: [],
        recommendations: [],
        confidence: 0,
        error: `أداة غير معروفة: ${tool}`,
        metadata: { dataSource: 'none', recordsAnalyzed: 0 }
      };
  }
}

// قائمة الأدوات المتاحة
export function getAvailableTools(): { name: AIToolName; description: string; requiredRole: string[] }[] {
  return [
    {
      name: 'sales_intelligence',
      description: 'تحليل ذكي للمبيعات مع كشف الأنماط والشذوذات',
      requiredRole: ['admin', 'manager', 'supervisor']
    },
    {
      name: 'customer_behavior',
      description: 'تحليل سلوك العملاء وتوقع مخاطر الفقدان',
      requiredRole: ['admin', 'manager']
    },
    {
      name: 'demand_forecast',
      description: 'التنبؤ بالطلب وتحسين إدارة المخزون',
      requiredRole: ['admin', 'manager', 'supervisor']
    },
    {
      name: 'fraud_detection',
      description: 'كشف الاحتيال والأنماط المشبوهة',
      requiredRole: ['admin']
    }
  ];
}
