/**
 * محرك التوصيات المتقدم
 * Advanced Recommendation Engine
 * 
 * نظام توصيات ذكي يتعلم من البيانات ويقدم اقتراحات مخصصة
 * مع تحليل سياقي وتتبع فعالية التوصيات
 */

import { getDb } from "../db";
import { invokeLLM } from "../_core/llm";
import {
  invoices, invoiceItems, products, customers, employees, branches,
  dailyRevenues, expenses, purchaseOrders
} from "../../drizzle/schema";
import { eq, and, gte, lte, desc, asc, sql, count, sum, avg } from "drizzle-orm";

// ==================== أنواع البيانات ====================

export interface RecommendationContext {
  userId: number;
  userRole: string;
  branchId?: number;
  currentPage?: string;
  recentActions?: string[];
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  dayOfWeek: number;
  isEndOfMonth: boolean;
  isEndOfWeek: boolean;
}

export interface Recommendation {
  id: string;
  type: RecommendationType;
  category: RecommendationCategory;
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  reasoning: string;
  confidence: number;
  impact: {
    metric: string;
    currentValue: number;
    projectedValue: number;
    changePercent: number;
    timeframe: string;
  };
  actions: RecommendationAction[];
  relatedData?: any;
  expiresAt?: Date;
  createdAt: Date;
  status: 'pending' | 'viewed' | 'applied' | 'dismissed' | 'expired';
}

export type RecommendationType = 
  | 'action'      // إجراء مطلوب
  | 'warning'     // تحذير
  | 'opportunity' // فرصة
  | 'optimization'// تحسين
  | 'insight'     // رؤية
  | 'prediction'; // تنبؤ

export type RecommendationCategory =
  | 'sales'       // مبيعات
  | 'inventory'   // مخزون
  | 'finance'     // مالية
  | 'customers'   // عملاء
  | 'employees'   // موظفين
  | 'operations'  // عمليات
  | 'compliance'; // امتثال

export interface RecommendationAction {
  id: string;
  label: string;
  type: 'navigate' | 'execute' | 'confirm' | 'external';
  target?: string;
  params?: Record<string, any>;
  requiresConfirmation?: boolean;
}

export interface RecommendationFeedback {
  recommendationId: string;
  userId: number;
  action: 'applied' | 'dismissed' | 'helpful' | 'not_helpful';
  feedback?: string;
  timestamp: Date;
}

// ==================== محرك التوصيات ====================

export class RecommendationEngine {
  private context: RecommendationContext;
  private recommendations: Recommendation[] = [];

  constructor(context: RecommendationContext) {
    this.context = context;
  }

  /**
   * توليد جميع التوصيات المتاحة
   */
  async generateAllRecommendations(): Promise<Recommendation[]> {
    this.recommendations = [];

    // توليد التوصيات بالتوازي
    const [
      salesRecs,
      inventoryRecs,
      financeRecs,
      customerRecs,
      operationalRecs
    ] = await Promise.all([
      this.generateSalesRecommendations(),
      this.generateInventoryRecommendations(),
      this.generateFinanceRecommendations(),
      this.generateCustomerRecommendations(),
      this.generateOperationalRecommendations()
    ]);

    this.recommendations = [
      ...salesRecs,
      ...inventoryRecs,
      ...financeRecs,
      ...customerRecs,
      ...operationalRecs
    ];

    // ترتيب حسب الأولوية والثقة
    return this.prioritizeRecommendations();
  }

  /**
   * توصيات المبيعات
   */
  private async generateSalesRecommendations(): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const db = await getDb();
    if (!db) return recommendations;

    try {
      // تحليل اتجاه المبيعات
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);

      // مبيعات الشهر الحالي
      const currentMonthSales = await db.select({
        total: sql<number>`COALESCE(SUM(${invoices.total}), 0)`,
        count: count()
      })
      .from(invoices)
      .where(gte(invoices.createdAt, thirtyDaysAgo));

      // مبيعات الشهر السابق
      const previousMonthSales = await db.select({
        total: sql<number>`COALESCE(SUM(${invoices.total}), 0)`,
        count: count()
      })
      .from(invoices)
      .where(and(
        gte(invoices.createdAt, sixtyDaysAgo),
        lte(invoices.createdAt, thirtyDaysAgo)
      ));

      const currentTotal = Number(currentMonthSales[0]?.total || 0);
      const previousTotal = Number(previousMonthSales[0]?.total || 0);
      const growthRate = previousTotal > 0 
        ? ((currentTotal - previousTotal) / previousTotal) * 100 
        : 0;

      // توصية بناءً على اتجاه المبيعات
      if (growthRate < -15) {
        recommendations.push({
          id: `rec_sales_decline_${Date.now()}`,
          type: 'warning',
          category: 'sales',
          priority: 'high',
          title: 'انخفاض ملحوظ في المبيعات',
          description: `انخفضت المبيعات بنسبة ${Math.abs(growthRate).toFixed(1)}% مقارنة بالشهر السابق`,
          reasoning: 'تحليل مقارن للمبيعات يظهر انخفاضاً يتطلب اهتماماً فورياً',
          confidence: 0.9,
          impact: {
            metric: 'المبيعات الشهرية',
            currentValue: currentTotal,
            projectedValue: currentTotal * 1.15,
            changePercent: 15,
            timeframe: 'الشهر القادم'
          },
          actions: [
            {
              id: 'analyze_causes',
              label: 'تحليل الأسباب',
              type: 'navigate',
              target: '/analytics/sales'
            },
            {
              id: 'create_promotion',
              label: 'إنشاء حملة ترويجية',
              type: 'navigate',
              target: '/marketing/campaigns/new'
            }
          ],
          createdAt: new Date(),
          status: 'pending'
        });
      } else if (growthRate > 20) {
        recommendations.push({
          id: `rec_sales_growth_${Date.now()}`,
          type: 'opportunity',
          category: 'sales',
          priority: 'medium',
          title: 'فرصة للاستفادة من النمو',
          description: `المبيعات في نمو قوي بنسبة ${growthRate.toFixed(1)}%`,
          reasoning: 'الزخم الإيجابي يمكن تعزيزه بإجراءات استباقية',
          confidence: 0.85,
          impact: {
            metric: 'المبيعات الشهرية',
            currentValue: currentTotal,
            projectedValue: currentTotal * 1.3,
            changePercent: 30,
            timeframe: 'الشهر القادم'
          },
          actions: [
            {
              id: 'increase_inventory',
              label: 'زيادة المخزون',
              type: 'navigate',
              target: '/inventory/reorder'
            },
            {
              id: 'expand_marketing',
              label: 'توسيع التسويق',
              type: 'navigate',
              target: '/marketing'
            }
          ],
          createdAt: new Date(),
          status: 'pending'
        });
      }

      // تحليل أفضل المنتجات
      const topProducts = await db.select({
        productId: invoiceItems.productId,
        productName: invoiceItems.productName,
        totalSales: sql<number>`COALESCE(SUM(${invoiceItems.total}), 0)`,
        quantity: sql<number>`SUM(${invoiceItems.quantity})`
      })
      .from(invoiceItems)
      .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
      .where(gte(invoices.createdAt, thirtyDaysAgo))
      .groupBy(invoiceItems.productId, invoiceItems.productName)
      .orderBy(desc(sql`SUM(${invoiceItems.total})`))
      .limit(5);

      if (topProducts.length > 0) {
        const topProduct = topProducts[0];
        recommendations.push({
          id: `rec_top_product_${Date.now()}`,
          type: 'insight',
          category: 'sales',
          priority: 'low',
          title: 'المنتج الأكثر مبيعاً',
          description: `${topProduct.productName} هو الأكثر مبيعاً بإجمالي ${Number(topProduct.totalSales).toLocaleString()} ر.س.`,
          reasoning: 'تحليل بيانات المبيعات للشهر الحالي',
          confidence: 0.95,
          impact: {
            metric: 'مبيعات المنتج',
            currentValue: Number(topProduct.totalSales),
            projectedValue: Number(topProduct.totalSales) * 1.1,
            changePercent: 10,
            timeframe: 'الشهر القادم'
          },
          actions: [
            {
              id: 'view_product',
              label: 'عرض تفاصيل المنتج',
              type: 'navigate',
              target: `/products/${topProduct.productId}`
            }
          ],
          relatedData: { topProducts },
          createdAt: new Date(),
          status: 'pending'
        });
      }
    } catch (error) {
      console.error('Error generating sales recommendations:', error);
    }

    return recommendations;
  }

  /**
   * توصيات المخزون
   */
  private async generateInventoryRecommendations(): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const db = await getDb();
    if (!db) return recommendations;

    try {
      // المنتجات منخفضة المخزون
      const lowStockProducts = await db.select({
        id: products.id,
        name: products.name,
        quantity: products.quantity,
        minQuantity: products.minQuantity,
        sellingPrice: products.sellingPrice
      })
      .from(products)
      .where(and(
        eq(products.isActive, true),
        sql`${products.quantity} <= ${products.minQuantity}`
      ))
      .limit(10);

      if (lowStockProducts.length > 0) {
        const criticalProducts = lowStockProducts.filter(p => p.quantity === 0);
        const warningProducts = lowStockProducts.filter(p => p.quantity > 0);

        if (criticalProducts.length > 0) {
          recommendations.push({
            id: `rec_stockout_${Date.now()}`,
            type: 'warning',
            category: 'inventory',
            priority: 'critical',
            title: 'منتجات نفدت من المخزون',
            description: `${criticalProducts.length} منتج نفد من المخزون ويحتاج إعادة طلب فورية`,
            reasoning: 'نفاد المخزون يؤدي لخسارة مبيعات وعملاء',
            confidence: 1.0,
            impact: {
              metric: 'المبيعات المفقودة',
              currentValue: 0,
              projectedValue: criticalProducts.reduce((sum, p) => sum + Number(p.sellingPrice) * 10, 0),
              changePercent: 100,
              timeframe: 'فوري'
            },
            actions: [
              {
                id: 'create_po',
                label: 'إنشاء أمر شراء',
                type: 'navigate',
                target: '/purchase-orders/new'
              },
              {
                id: 'view_products',
                label: 'عرض المنتجات',
                type: 'navigate',
                target: '/inventory?filter=out_of_stock'
              }
            ],
            relatedData: { products: criticalProducts },
            createdAt: new Date(),
            status: 'pending'
          });
        }

        if (warningProducts.length > 0) {
          recommendations.push({
            id: `rec_low_stock_${Date.now()}`,
            type: 'action',
            category: 'inventory',
            priority: 'high',
            title: 'منتجات قاربت على النفاد',
            description: `${warningProducts.length} منتج وصل للحد الأدنى ويحتاج إعادة طلب`,
            reasoning: 'التخطيط المسبق يمنع انقطاع المخزون',
            confidence: 0.95,
            impact: {
              metric: 'استمرارية التوريد',
              currentValue: 70,
              projectedValue: 100,
              changePercent: 43,
              timeframe: 'أسبوع'
            },
            actions: [
              {
                id: 'review_inventory',
                label: 'مراجعة المخزون',
                type: 'navigate',
                target: '/inventory?filter=low_stock'
              }
            ],
            relatedData: { products: warningProducts },
            createdAt: new Date(),
            status: 'pending'
          });
        }
      }

      // المنتجات الراكدة
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const allProducts = await db.select({
        id: products.id,
        name: products.name,
        quantity: products.quantity,
        costPrice: products.costPrice
      })
      .from(products)
      .where(and(
        eq(products.isActive, true),
        sql`${products.quantity} > 0`
      ));

      const soldProductIds = await db.select({
        productId: invoiceItems.productId
      })
      .from(invoiceItems)
      .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
      .where(gte(invoices.createdAt, thirtyDaysAgo))
      .groupBy(invoiceItems.productId);

      const soldIds = new Set(soldProductIds.map(p => p.productId));
      const stagnantProducts = allProducts.filter(p => !soldIds.has(p.id));

      if (stagnantProducts.length > 5) {
        const stagnantValue = stagnantProducts.reduce(
          (sum, p) => sum + Number(p.costPrice) * p.quantity, 0
        );

        recommendations.push({
          id: `rec_stagnant_${Date.now()}`,
          type: 'optimization',
          category: 'inventory',
          priority: 'medium',
          title: 'منتجات راكدة تحتاج تصريف',
          description: `${stagnantProducts.length} منتج لم يُباع منذ 30 يوم بقيمة ${stagnantValue.toLocaleString()} ر.س.`,
          reasoning: 'المخزون الراكد يجمد رأس المال ويتعرض للتلف',
          confidence: 0.85,
          impact: {
            metric: 'رأس المال المجمد',
            currentValue: stagnantValue,
            projectedValue: stagnantValue * 0.3,
            changePercent: -70,
            timeframe: 'شهر'
          },
          actions: [
            {
              id: 'create_discount',
              label: 'إنشاء عرض خصم',
              type: 'navigate',
              target: '/promotions/new'
            },
            {
              id: 'view_stagnant',
              label: 'عرض المنتجات الراكدة',
              type: 'navigate',
              target: '/inventory?filter=stagnant'
            }
          ],
          relatedData: { products: stagnantProducts.slice(0, 10), totalValue: stagnantValue },
          createdAt: new Date(),
          status: 'pending'
        });
      }
    } catch (error) {
      console.error('Error generating inventory recommendations:', error);
    }

    return recommendations;
  }

  /**
   * توصيات مالية
   */
  private async generateFinanceRecommendations(): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const db = await getDb();
    if (!db) return recommendations;

    try {
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      // تحليل المصروفات
      const monthlyExpenses = await db.select({
        category: expenses.category,
        total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)`
      })
      .from(expenses)
      .where(gte(expenses.expenseDate, thirtyDaysAgo))
      .groupBy(expenses.category)
      .orderBy(desc(sql`SUM(${expenses.amount})`));

      const totalExpenses = monthlyExpenses.reduce((sum, e) => sum + Number(e.total), 0);

      // التحقق من المصروفات المرتفعة
      for (const expense of monthlyExpenses) {
        const percentage = (Number(expense.total) / totalExpenses) * 100;
        if (percentage > 40) {
          recommendations.push({
            id: `rec_high_expense_${Date.now()}_${expense.category}`,
            type: 'warning',
            category: 'finance',
            priority: 'medium',
            title: `مصروفات ${expense.category} مرتفعة`,
            description: `تشكل ${percentage.toFixed(1)}% من إجمالي المصروفات`,
            reasoning: 'تركز المصروفات في فئة واحدة قد يشير لمشكلة',
            confidence: 0.8,
            impact: {
              metric: 'المصروفات الشهرية',
              currentValue: Number(expense.total),
              projectedValue: Number(expense.total) * 0.8,
              changePercent: -20,
              timeframe: 'شهر'
            },
            actions: [
              {
                id: 'analyze_expenses',
                label: 'تحليل المصروفات',
                type: 'navigate',
                target: `/expenses?category=${expense.category}`
              }
            ],
            createdAt: new Date(),
            status: 'pending'
          });
        }
      }

      // تحليل الإيرادات مقابل المصروفات
      const monthlyRevenue = await db.select({
        total: sql<number>`COALESCE(SUM(${dailyRevenues.total}), 0)`
      })
      .from(dailyRevenues)
      .where(sql`${dailyRevenues.date} >= ${thirtyDaysAgo.toISOString().split('T')[0]}`);

      const revenue = Number(monthlyRevenue[0]?.total || 0);
      const profitMargin = revenue > 0 ? ((revenue - totalExpenses) / revenue) * 100 : 0;

      if (profitMargin < 10 && revenue > 0) {
        recommendations.push({
          id: `rec_low_margin_${Date.now()}`,
          type: 'warning',
          category: 'finance',
          priority: 'high',
          title: 'هامش الربح منخفض',
          description: `هامش الربح ${profitMargin.toFixed(1)}% فقط`,
          reasoning: 'هامش ربح أقل من 10% يهدد استدامة العمل',
          confidence: 0.9,
          impact: {
            metric: 'هامش الربح',
            currentValue: profitMargin,
            projectedValue: 15,
            changePercent: (15 - profitMargin) / profitMargin * 100,
            timeframe: 'ربع سنوي'
          },
          actions: [
            {
              id: 'review_pricing',
              label: 'مراجعة الأسعار',
              type: 'navigate',
              target: '/products/pricing'
            },
            {
              id: 'reduce_costs',
              label: 'تقليل التكاليف',
              type: 'navigate',
              target: '/expenses/analysis'
            }
          ],
          createdAt: new Date(),
          status: 'pending'
        });
      }

      // توصية نهاية الشهر
      if (this.context.isEndOfMonth) {
        recommendations.push({
          id: `rec_month_end_${Date.now()}`,
          type: 'action',
          category: 'finance',
          priority: 'high',
          title: 'إغلاق الشهر المالي',
          description: 'حان وقت مراجعة وإغلاق الحسابات الشهرية',
          reasoning: 'الإغلاق الشهري ضروري للتقارير المالية الدقيقة',
          confidence: 1.0,
          impact: {
            metric: 'دقة التقارير',
            currentValue: 80,
            projectedValue: 100,
            changePercent: 25,
            timeframe: 'فوري'
          },
          actions: [
            {
              id: 'close_month',
              label: 'إغلاق الشهر',
              type: 'navigate',
              target: '/finance/close-month'
            },
            {
              id: 'generate_reports',
              label: 'توليد التقارير',
              type: 'navigate',
              target: '/reports/monthly'
            }
          ],
          createdAt: new Date(),
          status: 'pending'
        });
      }
    } catch (error) {
      console.error('Error generating finance recommendations:', error);
    }

    return recommendations;
  }

  /**
   * توصيات العملاء
   */
  private async generateCustomerRecommendations(): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const db = await getDb();
    if (!db) return recommendations;

    try {
      // العملاء الذين لم يشتروا منذ فترة
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const inactiveCustomers = await db.select({
        id: customers.id,
        name: customers.name,
        lastPurchase: sql<Date>`MAX(${invoices.createdAt})`,
        totalSpent: sql<number>`COALESCE(SUM(${invoices.total}), 0)`
      })
      .from(customers)
      .leftJoin(invoices, eq(customers.id, invoices.customerId))
      .groupBy(customers.id, customers.name)
      .having(sql`MAX(${invoices.createdAt}) < ${thirtyDaysAgo} OR MAX(${invoices.createdAt}) IS NULL`);

      const valuableInactive = inactiveCustomers.filter(c => Number(c.totalSpent) > 1000);

      if (valuableInactive.length > 0) {
        recommendations.push({
          id: `rec_inactive_customers_${Date.now()}`,
          type: 'opportunity',
          category: 'customers',
          priority: 'medium',
          title: 'عملاء قيّمون غير نشطين',
          description: `${valuableInactive.length} عميل قيّم لم يشترِ منذ 30 يوم`,
          reasoning: 'استعادة العملاء الحاليين أسهل من اكتساب جدد',
          confidence: 0.85,
          impact: {
            metric: 'الإيرادات المحتملة',
            currentValue: 0,
            projectedValue: valuableInactive.reduce((sum, c) => sum + Number(c.totalSpent) * 0.3, 0),
            changePercent: 100,
            timeframe: 'شهر'
          },
          actions: [
            {
              id: 'send_campaign',
              label: 'إرسال حملة استعادة',
              type: 'navigate',
              target: '/marketing/reactivation'
            },
            {
              id: 'view_customers',
              label: 'عرض العملاء',
              type: 'navigate',
              target: '/customers?filter=inactive'
            }
          ],
          relatedData: { customers: valuableInactive.slice(0, 10) },
          createdAt: new Date(),
          status: 'pending'
        });
      }

      // أفضل العملاء
      const topCustomers = await db.select({
        id: customers.id,
        name: customers.name,
        totalSpent: sql<number>`COALESCE(SUM(${invoices.total}), 0)`,
        orderCount: count()
      })
      .from(customers)
      .innerJoin(invoices, eq(customers.id, invoices.customerId))
      .groupBy(customers.id, customers.name)
      .orderBy(desc(sql`SUM(${invoices.total})`))
      .limit(10);

      if (topCustomers.length > 0) {
        recommendations.push({
          id: `rec_vip_customers_${Date.now()}`,
          type: 'insight',
          category: 'customers',
          priority: 'low',
          title: 'عملاء VIP',
          description: `أفضل 10 عملاء يمثلون جزءاً كبيراً من الإيرادات`,
          reasoning: 'الحفاظ على العملاء الكبار أولوية قصوى',
          confidence: 0.95,
          impact: {
            metric: 'رضا العملاء',
            currentValue: 80,
            projectedValue: 95,
            changePercent: 19,
            timeframe: 'مستمر'
          },
          actions: [
            {
              id: 'view_vip',
              label: 'عرض عملاء VIP',
              type: 'navigate',
              target: '/customers?filter=vip'
            }
          ],
          relatedData: { customers: topCustomers },
          createdAt: new Date(),
          status: 'pending'
        });
      }
    } catch (error) {
      console.error('Error generating customer recommendations:', error);
    }

    return recommendations;
  }

  /**
   * توصيات تشغيلية
   */
  private async generateOperationalRecommendations(): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // توصيات بناءً على الوقت
    if (this.context.timeOfDay === 'morning' && this.context.dayOfWeek === 0) {
      recommendations.push({
        id: `rec_weekly_review_${Date.now()}`,
        type: 'action',
        category: 'operations',
        priority: 'medium',
        title: 'مراجعة أسبوعية',
        description: 'بداية الأسبوع - وقت مثالي لمراجعة الأداء',
        reasoning: 'المراجعة الأسبوعية تساعد في التخطيط الفعال',
        confidence: 0.9,
        impact: {
          metric: 'الإنتاجية',
          currentValue: 80,
          projectedValue: 90,
          changePercent: 12.5,
          timeframe: 'أسبوع'
        },
        actions: [
          {
            id: 'view_dashboard',
            label: 'لوحة التحكم',
            type: 'navigate',
            target: '/dashboard'
          },
          {
            id: 'view_reports',
            label: 'التقارير الأسبوعية',
            type: 'navigate',
            target: '/reports/weekly'
          }
        ],
        createdAt: new Date(),
        status: 'pending'
      });
    }

    // توصية نهاية الأسبوع
    if (this.context.isEndOfWeek) {
      recommendations.push({
        id: `rec_week_end_${Date.now()}`,
        type: 'action',
        category: 'operations',
        priority: 'low',
        title: 'تلخيص الأسبوع',
        description: 'نهاية الأسبوع - وقت مناسب لتلخيص الإنجازات',
        reasoning: 'التوثيق الأسبوعي يحسن المتابعة والتخطيط',
        confidence: 0.85,
        impact: {
          metric: 'التوثيق',
          currentValue: 70,
          projectedValue: 90,
          changePercent: 28.5,
          timeframe: 'أسبوع'
        },
        actions: [
          {
            id: 'create_summary',
            label: 'إنشاء ملخص',
            type: 'navigate',
            target: '/reports/create-summary'
          }
        ],
        createdAt: new Date(),
        status: 'pending'
      });
    }

    return recommendations;
  }

  /**
   * ترتيب التوصيات حسب الأولوية
   */
  private prioritizeRecommendations(): Recommendation[] {
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    
    return this.recommendations.sort((a, b) => {
      // أولاً حسب الأولوية
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // ثانياً حسب الثقة
      return b.confidence - a.confidence;
    });
  }

  /**
   * الحصول على توصيات لصفحة محددة
   */
  getRecommendationsForPage(page: string): Recommendation[] {
    const pageCategories: Record<string, RecommendationCategory[]> = {
      '/dashboard': ['sales', 'inventory', 'finance', 'operations'],
      '/sales': ['sales', 'customers'],
      '/inventory': ['inventory'],
      '/finance': ['finance'],
      '/customers': ['customers'],
      '/employees': ['employees'],
      '/reports': ['finance', 'sales', 'operations']
    };

    const categories = pageCategories[page] || ['operations'];
    return this.recommendations.filter(r => categories.includes(r.category));
  }
}

// ==================== دوال مساعدة ====================

export function createRecommendationContext(
  userId: number,
  userRole: string,
  branchId?: number
): RecommendationContext {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  let timeOfDay: RecommendationContext['timeOfDay'];
  if (hour >= 6 && hour < 12) timeOfDay = 'morning';
  else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
  else if (hour >= 17 && hour < 21) timeOfDay = 'evening';
  else timeOfDay = 'night';

  return {
    userId,
    userRole,
    branchId,
    timeOfDay,
    dayOfWeek,
    isEndOfMonth: dayOfMonth >= daysInMonth - 2,
    isEndOfWeek: dayOfWeek === 4 || dayOfWeek === 5 // الخميس أو الجمعة
  };
}

export async function generateRecommendations(
  userId: number,
  userRole: string,
  branchId?: number
): Promise<Recommendation[]> {
  const context = createRecommendationContext(userId, userRole, branchId);
  const engine = new RecommendationEngine(context);
  return engine.generateAllRecommendations();
}
