/**
 * خدمة مساعد التقارير الذكي - Nawab AI
 * تحليل أسئلة المستخدم بالعربية وتوليد تقارير تلقائية
 */

import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { 
  invoices, invoiceItems, products, customers, suppliers, 
  employees, branches, expenses, purchaseOrders 
} from "../../drizzle/schema";
import { sql, eq, gte, lte, and, desc, asc } from "drizzle-orm";

// ==================== الأنواع ====================

export type ReportType = 
  | 'sales_summary'      // ملخص المبيعات
  | 'sales_by_product'   // المبيعات حسب المنتج
  | 'sales_by_customer'  // المبيعات حسب العميل
  | 'sales_by_employee'  // المبيعات حسب الموظف
  | 'sales_by_branch'    // المبيعات حسب الفرع
  | 'inventory_status'   // حالة المخزون
  | 'low_stock'          // المنتجات منخفضة المخزون
  | 'expenses_summary'   // ملخص المصروفات
  | 'expenses_by_category' // المصروفات حسب الفئة
  | 'profit_loss'        // الأرباح والخسائر
  | 'customer_analysis'  // تحليل العملاء
  | 'employee_performance' // أداء الموظفين
  | 'purchase_orders'    // أوامر الشراء
  | 'comparison'         // مقارنة فترات
  | 'custom';            // تقرير مخصص

export type ChartType = 
  | 'bar'      // أعمدة
  | 'line'     // خطي
  | 'pie'      // دائري
  | 'doughnut' // حلقي
  | 'area'     // مساحة
  | 'table'    // جدول
  | 'kpi';     // مؤشرات

export interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

export interface ReportFilter {
  branchId?: number;
  employeeId?: number;
  customerId?: number;
  categoryId?: number;
  productId?: number;
}

export interface AnalyzedQuestion {
  originalQuestion: string;
  reportType: ReportType;
  chartType: ChartType;
  dateRange: DateRange;
  filters: ReportFilter;
  groupBy?: string;
  orderBy?: string;
  limit?: number;
  comparison?: {
    enabled: boolean;
    previousPeriod: DateRange;
  };
  confidence: number;
  interpretation: string;
}

export interface ReportDataItem {
  id?: number | null;
  label: string;
  value: number;
  sku?: string;
  code?: string;
  quantity?: number;
  count?: number;
  invoiceCount?: number;
  avgInvoice?: number;
  percentage?: number;
  minQuantity?: number;
  deficit?: number;
  estimatedCost?: number;
  status?: string;
  date?: Date | string;
  supplier?: string;
  lastPurchase?: string;
  avgPurchase?: number;
  type?: string;
  suffix?: string;
}

export interface ReportData {
  title: string;
  subtitle?: string;
  type: ReportType;
  chartType: ChartType;
  data: ReportDataItem[];
  summary: {
    total?: number;
    count?: number;
    average?: number;
    change?: number;
    changePercent?: number;
  };
  insights: string[];
  recommendations: string[];
  generatedAt: Date;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  reportData?: ReportData;
  timestamp: Date;
}

// ==================== تحليل الأسئلة ====================

/**
 * تحليل سؤال المستخدم باستخدام الذكاء الاصطناعي
 */
export async function analyzeQuestion(
  question: string,
  conversationHistory: ConversationMessage[] = []
): Promise<AnalyzedQuestion> {
  const today = new Date();
  const systemPrompt = `أنت مساعد ذكي متخصص في تحليل الأسئلة المتعلقة بالتقارير المالية والإدارية.

مهمتك: تحليل سؤال المستخدم وتحديد:
1. نوع التقرير المطلوب
2. الفترة الزمنية
3. الفلاتر المطلوبة
4. نوع الرسم البياني المناسب

أنواع التقارير المتاحة:
- sales_summary: ملخص المبيعات
- sales_by_product: المبيعات حسب المنتج
- sales_by_customer: المبيعات حسب العميل
- sales_by_employee: المبيعات حسب الموظف
- sales_by_branch: المبيعات حسب الفرع
- inventory_status: حالة المخزون
- low_stock: المنتجات منخفضة المخزون
- expenses_summary: ملخص المصروفات
- expenses_by_category: المصروفات حسب الفئة
- profit_loss: الأرباح والخسائر
- customer_analysis: تحليل العملاء
- employee_performance: أداء الموظفين
- purchase_orders: أوامر الشراء

أنواع الرسوم البيانية:
- bar: أعمدة (للمقارنات)
- line: خطي (للاتجاهات)
- pie: دائري (للنسب)
- doughnut: حلقي (للتوزيعات)
- area: مساحة (للتراكمات)
- table: جدول (للتفاصيل)
- kpi: مؤشرات (للأرقام الرئيسية)

التاريخ الحالي: ${today.toISOString().split('T')[0]}

أجب بـ JSON فقط بالتنسيق التالي:
{
  "reportType": "نوع التقرير",
  "chartType": "نوع الرسم",
  "dateRange": {
    "start": "YYYY-MM-DD",
    "end": "YYYY-MM-DD",
    "label": "وصف الفترة"
  },
  "filters": {
    "branchId": null,
    "employeeId": null,
    "customerId": null
  },
  "groupBy": "الحقل للتجميع (اختياري)",
  "orderBy": "الحقل للترتيب (اختياري)",
  "limit": 10,
  "comparison": {
    "enabled": false,
    "previousPeriod": null
  },
  "confidence": 0.95,
  "interpretation": "تفسير السؤال بالعربية"
}`;

  const contextMessages = conversationHistory.slice(-5).map(msg => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.content
  }));

  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        ...contextMessages,
        { role: 'user', content: question }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'question_analysis',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              reportType: { 
                type: 'string',
                enum: ['sales_summary', 'sales_by_product', 'sales_by_customer', 'sales_by_employee', 
                       'sales_by_branch', 'inventory_status', 'low_stock', 'expenses_summary',
                       'expenses_by_category', 'profit_loss', 'customer_analysis', 'employee_performance',
                       'purchase_orders', 'comparison', 'custom']
              },
              chartType: { 
                type: 'string',
                enum: ['bar', 'line', 'pie', 'doughnut', 'area', 'table', 'kpi']
              },
              dateRange: {
                type: 'object',
                properties: {
                  start: { type: 'string' },
                  end: { type: 'string' },
                  label: { type: 'string' }
                },
                required: ['start', 'end', 'label'],
                additionalProperties: false
              },
              filters: {
                type: 'object',
                properties: {
                  branchId: { type: ['number', 'null'] },
                  employeeId: { type: ['number', 'null'] },
                  customerId: { type: ['number', 'null'] },
                  categoryId: { type: ['number', 'null'] },
                  productId: { type: ['number', 'null'] }
                },
                required: [],
                additionalProperties: false
              },
              groupBy: { type: ['string', 'null'] },
              orderBy: { type: ['string', 'null'] },
              limit: { type: 'number' },
              comparison: {
                type: 'object',
                properties: {
                  enabled: { type: 'boolean' },
                  previousPeriod: { 
                    type: ['object', 'null'],
                    properties: {
                      start: { type: 'string' },
                      end: { type: 'string' },
                      label: { type: 'string' }
                    }
                  }
                },
                required: ['enabled'],
                additionalProperties: false
              },
              confidence: { type: 'number' },
              interpretation: { type: 'string' }
            },
            required: ['reportType', 'chartType', 'dateRange', 'confidence', 'interpretation'],
            additionalProperties: false
          }
        }
      },
      temperature: 0.3
    });

    const content = response.choices[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new Error('استجابة غير صالحة من الذكاء الاصطناعي');
    }

    const analysis = JSON.parse(content);
    
    return {
      originalQuestion: question,
      reportType: analysis.reportType,
      chartType: analysis.chartType,
      dateRange: {
        start: new Date(analysis.dateRange.start),
        end: new Date(analysis.dateRange.end),
        label: analysis.dateRange.label
      },
      filters: analysis.filters || {},
      groupBy: analysis.groupBy,
      orderBy: analysis.orderBy,
      limit: analysis.limit || 10,
      comparison: analysis.comparison?.enabled ? {
        enabled: true,
        previousPeriod: analysis.comparison.previousPeriod ? {
          start: new Date(analysis.comparison.previousPeriod.start),
          end: new Date(analysis.comparison.previousPeriod.end),
          label: analysis.comparison.previousPeriod.label
        } : calculatePreviousPeriod(
          new Date(analysis.dateRange.start),
          new Date(analysis.dateRange.end)
        )
      } : undefined,
      confidence: analysis.confidence,
      interpretation: analysis.interpretation
    };
  } catch (error) {
    console.error('خطأ في تحليل السؤال:', error);
    return getDefaultAnalysis(question);
  }
}

/**
 * حساب الفترة السابقة للمقارنة
 */
function calculatePreviousPeriod(start: Date, end: Date): DateRange {
  const duration = end.getTime() - start.getTime();
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - duration);
  
  return {
    start: previousStart,
    end: previousEnd,
    label: 'الفترة السابقة'
  };
}

/**
 * تحليل افتراضي في حالة فشل الذكاء الاصطناعي
 */
function getDefaultAnalysis(question: string): AnalyzedQuestion {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  let reportType: ReportType = 'sales_summary';
  let chartType: ChartType = 'bar';
  
  const lowerQuestion = question.toLowerCase();
  
  if (lowerQuestion.includes('مخزون') || lowerQuestion.includes('منتج')) {
    reportType = 'inventory_status';
    chartType = 'table';
  } else if (lowerQuestion.includes('مصروف') || lowerQuestion.includes('نفقات')) {
    reportType = 'expenses_summary';
    chartType = 'pie';
  } else if (lowerQuestion.includes('عميل') || lowerQuestion.includes('زبون')) {
    reportType = 'customer_analysis';
    chartType = 'bar';
  } else if (lowerQuestion.includes('موظف') || lowerQuestion.includes('أداء')) {
    reportType = 'employee_performance';
    chartType = 'bar';
  } else if (lowerQuestion.includes('ربح') || lowerQuestion.includes('خسار')) {
    reportType = 'profit_loss';
    chartType = 'kpi';
  }
  
  return {
    originalQuestion: question,
    reportType,
    chartType,
    dateRange: {
      start: startOfMonth,
      end: today,
      label: 'الشهر الحالي'
    },
    filters: {},
    limit: 10,
    confidence: 0.5,
    interpretation: 'تم تحليل السؤال باستخدام الكلمات المفتاحية'
  };
}

// ==================== توليد التقارير ====================

/**
 * إنشاء تقرير فارغ
 */
function createEmptyReport(title: string, type: ReportType, chartType: ChartType): ReportData {
  return {
    title,
    subtitle: 'لا توجد بيانات متاحة',
    type,
    chartType,
    data: [],
    summary: { total: 0, count: 0 },
    insights: ['لا توجد بيانات كافية للتحليل'],
    recommendations: ['تأكد من وجود بيانات في النظام'],
    generatedAt: new Date()
  };
}

/**
 * توليد تقرير بناءً على التحليل
 */
export async function generateReport(analysis: AnalyzedQuestion): Promise<ReportData> {
  switch (analysis.reportType) {
    case 'sales_summary':
      return generateSalesSummary(analysis);
    case 'sales_by_product':
      return generateSalesByProduct(analysis);
    case 'sales_by_customer':
      return generateSalesByCustomer(analysis);
    case 'sales_by_employee':
      return generateSalesByEmployee(analysis);
    case 'sales_by_branch':
      return generateSalesByBranch(analysis);
    case 'inventory_status':
      return generateInventoryStatus(analysis);
    case 'low_stock':
      return generateLowStock(analysis);
    case 'expenses_summary':
      return generateExpensesSummary(analysis);
    case 'expenses_by_category':
      return generateExpensesByCategory(analysis);
    case 'profit_loss':
      return generateProfitLoss(analysis);
    case 'customer_analysis':
      return generateCustomerAnalysis(analysis);
    case 'employee_performance':
      return generateEmployeePerformance(analysis);
    case 'purchase_orders':
      return generatePurchaseOrders(analysis);
    default:
      return generateSalesSummary(analysis);
  }
}

/**
 * ملخص المبيعات
 */
async function generateSalesSummary(analysis: AnalyzedQuestion): Promise<ReportData> {
  const db = await getDb();
  if (!db) return createEmptyReport('ملخص المبيعات', 'sales_summary', analysis.chartType);
  
  const { dateRange, filters, comparison } = analysis;
  
  const [currentData] = await db
    .select({
      totalSales: sql<number>`COALESCE(SUM(${invoices.total}), 0)`,
      invoiceCount: sql<number>`COUNT(*)`,
      avgInvoice: sql<number>`COALESCE(AVG(${invoices.total}), 0)`
    })
    .from(invoices)
    .where(
      and(
        gte(invoices.createdAt, dateRange.start),
        lte(invoices.createdAt, dateRange.end),
        filters.branchId ? eq(invoices.branchId, filters.branchId) : undefined
      )
    );
  
  let change = 0;
  let changePercent = 0;
  
  if (comparison?.enabled && comparison.previousPeriod) {
    const [previousData] = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(${invoices.total}), 0)`
      })
      .from(invoices)
      .where(
        and(
          gte(invoices.createdAt, comparison.previousPeriod.start),
          lte(invoices.createdAt, comparison.previousPeriod.end),
          filters.branchId ? eq(invoices.branchId, filters.branchId) : undefined
        )
      );
    
    if (previousData && Number(previousData.totalSales) > 0) {
      change = Number(currentData.totalSales) - Number(previousData.totalSales);
      changePercent = (change / Number(previousData.totalSales)) * 100;
    }
  }
  
  const dailySales = await db
    .select({
      date: sql<string>`DATE(${invoices.createdAt})`,
      total: sql<number>`COALESCE(SUM(${invoices.total}), 0)`,
      count: sql<number>`COUNT(*)`
    })
    .from(invoices)
    .where(
      and(
        gte(invoices.createdAt, dateRange.start),
        lte(invoices.createdAt, dateRange.end),
        filters.branchId ? eq(invoices.branchId, filters.branchId) : undefined
      )
    )
    .groupBy(sql`DATE(${invoices.createdAt})`)
    .orderBy(sql`DATE(${invoices.createdAt})`);
  
  const insights = await generateInsights('sales_summary', { currentData, changePercent, dailySales });
  
  return {
    title: 'ملخص المبيعات',
    subtitle: dateRange.label,
    type: 'sales_summary',
    chartType: analysis.chartType,
    data: dailySales.map(d => ({
      label: d.date,
      value: Number(d.total),
      count: Number(d.count)
    })),
    summary: {
      total: Number(currentData.totalSales),
      count: Number(currentData.invoiceCount),
      average: Number(currentData.avgInvoice),
      change,
      changePercent
    },
    insights: insights.insights,
    recommendations: insights.recommendations,
    generatedAt: new Date()
  };
}

/**
 * المبيعات حسب المنتج
 */
async function generateSalesByProduct(analysis: AnalyzedQuestion): Promise<ReportData> {
  const db = await getDb();
  if (!db) return createEmptyReport('المبيعات حسب المنتج', 'sales_by_product', analysis.chartType);
  
  const { dateRange, filters, limit } = analysis;
  
  const productSales = await db
    .select({
      productId: invoiceItems.productId,
      productName: products.name,
      productSku: products.sku,
      quantity: sql<number>`SUM(${invoiceItems.quantity})`,
      total: sql<number>`SUM(${invoiceItems.total})`,
      invoiceCount: sql<number>`COUNT(DISTINCT ${invoiceItems.invoiceId})`
    })
    .from(invoiceItems)
    .innerJoin(products, eq(invoiceItems.productId, products.id))
    .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
    .where(
      and(
        gte(invoices.createdAt, dateRange.start),
        lte(invoices.createdAt, dateRange.end),
        filters.branchId ? eq(invoices.branchId, filters.branchId) : undefined
      )
    )
    .groupBy(invoiceItems.productId, products.name, products.sku)
    .orderBy(desc(sql`SUM(${invoiceItems.total})`))
    .limit(limit || 10);
  
  const totalSales = productSales.reduce((sum: number, p) => sum + Number(p.total), 0);
  const insights = await generateInsights('sales_by_product', { products: productSales, totalSales });
  
  return {
    title: 'المبيعات حسب المنتج',
    subtitle: `أعلى ${limit || 10} منتجات مبيعاً - ${dateRange.label}`,
    type: 'sales_by_product',
    chartType: analysis.chartType,
    data: productSales.map(p => ({
      id: p.productId,
      label: p.productName,
      sku: p.productSku,
      value: Number(p.total),
      quantity: Number(p.quantity),
      invoiceCount: Number(p.invoiceCount),
      percentage: totalSales > 0 ? (Number(p.total) / totalSales) * 100 : 0
    })),
    summary: { total: totalSales, count: productSales.length },
    insights: insights.insights,
    recommendations: insights.recommendations,
    generatedAt: new Date()
  };
}

/**
 * المبيعات حسب العميل
 */
async function generateSalesByCustomer(analysis: AnalyzedQuestion): Promise<ReportData> {
  const db = await getDb();
  if (!db) return createEmptyReport('المبيعات حسب العميل', 'sales_by_customer', analysis.chartType);
  
  const { dateRange, filters, limit } = analysis;
  
  const customerSales = await db
    .select({
      customerId: invoices.customerId,
      customerName: customers.name,
      customerCode: customers.code,
      total: sql<number>`SUM(${invoices.total})`,
      invoiceCount: sql<number>`COUNT(*)`,
      avgInvoice: sql<number>`AVG(${invoices.total})`
    })
    .from(invoices)
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .where(
      and(
        gte(invoices.createdAt, dateRange.start),
        lte(invoices.createdAt, dateRange.end),
        filters.branchId ? eq(invoices.branchId, filters.branchId) : undefined
      )
    )
    .groupBy(invoices.customerId, customers.name, customers.code)
    .orderBy(desc(sql`SUM(${invoices.total})`))
    .limit(limit || 10);
  
  const totalSales = customerSales.reduce((sum: number, c) => sum + Number(c.total), 0);
  const insights = await generateInsights('sales_by_customer', { customers: customerSales, totalSales });
  
  return {
    title: 'المبيعات حسب العميل',
    subtitle: `أعلى ${limit || 10} عملاء - ${dateRange.label}`,
    type: 'sales_by_customer',
    chartType: analysis.chartType,
    data: customerSales.map(c => ({
      id: c.customerId,
      label: c.customerName,
      code: c.customerCode,
      value: Number(c.total),
      invoiceCount: Number(c.invoiceCount),
      avgInvoice: Number(c.avgInvoice),
      percentage: totalSales > 0 ? (Number(c.total) / totalSales) * 100 : 0
    })),
    summary: { total: totalSales, count: customerSales.length },
    insights: insights.insights,
    recommendations: insights.recommendations,
    generatedAt: new Date()
  };
}

/**
 * المبيعات حسب الموظف
 */
async function generateSalesByEmployee(analysis: AnalyzedQuestion): Promise<ReportData> {
  const db = await getDb();
  if (!db) return createEmptyReport('المبيعات حسب الموظف', 'sales_by_employee', analysis.chartType);
  
  const { dateRange, filters, limit } = analysis;
  
  const employeeSales = await db
    .select({
      employeeId: invoices.createdBy,
      employeeName: employees.name,
      employeeCode: employees.code,
      total: sql<number>`SUM(${invoices.total})`,
      invoiceCount: sql<number>`COUNT(*)`,
      avgInvoice: sql<number>`AVG(${invoices.total})`
    })
    .from(invoices)
    .innerJoin(employees, eq(invoices.createdBy, employees.id))
    .where(
      and(
        gte(invoices.createdAt, dateRange.start),
        lte(invoices.createdAt, dateRange.end),
        filters.branchId ? eq(invoices.branchId, filters.branchId) : undefined
      )
    )
    .groupBy(invoices.createdBy, employees.name, employees.code)
    .orderBy(desc(sql`SUM(${invoices.total})`))
    .limit(limit || 10);
  
  const totalSales = employeeSales.reduce((sum: number, e) => sum + Number(e.total), 0);
  const insights = await generateInsights('sales_by_employee', { employees: employeeSales, totalSales });
  
  return {
    title: 'المبيعات حسب الموظف',
    subtitle: `أداء الموظفين - ${dateRange.label}`,
    type: 'sales_by_employee',
    chartType: analysis.chartType,
    data: employeeSales.map(e => ({
      id: e.employeeId,
      label: e.employeeName,
      code: e.employeeCode,
      value: Number(e.total),
      invoiceCount: Number(e.invoiceCount),
      avgInvoice: Number(e.avgInvoice),
      percentage: totalSales > 0 ? (Number(e.total) / totalSales) * 100 : 0
    })),
    summary: { total: totalSales, count: employeeSales.length },
    insights: insights.insights,
    recommendations: insights.recommendations,
    generatedAt: new Date()
  };
}

/**
 * المبيعات حسب الفرع
 */
async function generateSalesByBranch(analysis: AnalyzedQuestion): Promise<ReportData> {
  const db = await getDb();
  if (!db) return createEmptyReport('المبيعات حسب الفرع', 'sales_by_branch', analysis.chartType);
  
  const { dateRange, limit } = analysis;
  
  const branchSales = await db
    .select({
      branchId: invoices.branchId,
      branchName: branches.name,
      branchCode: branches.code,
      total: sql<number>`SUM(${invoices.total})`,
      invoiceCount: sql<number>`COUNT(*)`,
      avgInvoice: sql<number>`AVG(${invoices.total})`
    })
    .from(invoices)
    .innerJoin(branches, eq(invoices.branchId, branches.id))
    .where(
      and(
        gte(invoices.createdAt, dateRange.start),
        lte(invoices.createdAt, dateRange.end)
      )
    )
    .groupBy(invoices.branchId, branches.name, branches.code)
    .orderBy(desc(sql`SUM(${invoices.total})`))
    .limit(limit || 10);
  
  const totalSales = branchSales.reduce((sum: number, b) => sum + Number(b.total), 0);
  const insights = await generateInsights('sales_by_branch', { branches: branchSales, totalSales });
  
  return {
    title: 'المبيعات حسب الفرع',
    subtitle: `أداء الفروع - ${dateRange.label}`,
    type: 'sales_by_branch',
    chartType: analysis.chartType,
    data: branchSales.map(b => ({
      id: b.branchId,
      label: b.branchName,
      code: b.branchCode,
      value: Number(b.total),
      invoiceCount: Number(b.invoiceCount),
      avgInvoice: Number(b.avgInvoice),
      percentage: totalSales > 0 ? (Number(b.total) / totalSales) * 100 : 0
    })),
    summary: { total: totalSales, count: branchSales.length },
    insights: insights.insights,
    recommendations: insights.recommendations,
    generatedAt: new Date()
  };
}

/**
 * حالة المخزون
 */
async function generateInventoryStatus(analysis: AnalyzedQuestion): Promise<ReportData> {
  const db = await getDb();
  if (!db) return createEmptyReport('حالة المخزون', 'inventory_status', 'table');
  
  const { limit } = analysis;
  
  const inventoryData = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      quantity: products.quantity,
      minQuantity: products.minQuantity,
      costPrice: products.costPrice
    })
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(asc(products.quantity))
    .limit(limit || 50);
  
  const totalValue = inventoryData.reduce(
    (sum: number, p) => sum + (Number(p.quantity) * Number(p.costPrice)), 0
  );
  const totalItems = inventoryData.reduce((sum: number, p) => sum + Number(p.quantity), 0);
  const lowStockCount = inventoryData.filter(
    p => Number(p.quantity) <= Number(p.minQuantity)
  ).length;
  
  const insights = await generateInsights('inventory_status', { totalValue, totalItems, lowStockCount });
  
  return {
    title: 'حالة المخزون',
    subtitle: 'نظرة عامة على المخزون الحالي',
    type: 'inventory_status',
    chartType: 'table',
    data: inventoryData.map(p => ({
      id: p.id,
      label: p.name,
      sku: p.sku,
      quantity: Number(p.quantity),
      minQuantity: Number(p.minQuantity),
      value: Number(p.quantity) * Number(p.costPrice),
      status: Number(p.quantity) <= Number(p.minQuantity) ? 'low' : 
              Number(p.quantity) <= Number(p.minQuantity) * 2 ? 'medium' : 'good'
    })),
    summary: { total: totalValue, count: totalItems, average: inventoryData.length > 0 ? totalItems / inventoryData.length : 0 },
    insights: insights.insights,
    recommendations: insights.recommendations,
    generatedAt: new Date()
  };
}

/**
 * المنتجات منخفضة المخزون
 */
async function generateLowStock(analysis: AnalyzedQuestion): Promise<ReportData> {
  const db = await getDb();
  if (!db) return createEmptyReport('تنبيه نفاد المخزون', 'low_stock', 'table');
  
  const lowStockProducts = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      quantity: products.quantity,
      minQuantity: products.minQuantity,
      costPrice: products.costPrice
    })
    .from(products)
    .where(
      and(
        eq(products.isActive, true),
        sql`${products.quantity} <= ${products.minQuantity}`
      )
    )
    .orderBy(asc(products.quantity));
  
  const insights = await generateInsights('low_stock', { count: lowStockProducts.length });
  
  return {
    title: 'تنبيه نفاد المخزون',
    subtitle: `${lowStockProducts.length} منتج يحتاج إعادة طلب`,
    type: 'low_stock',
    chartType: 'table',
    data: lowStockProducts.map(p => ({
      id: p.id,
      label: p.name,
      sku: p.sku,
      quantity: Number(p.quantity),
      minQuantity: Number(p.minQuantity),
      deficit: Number(p.minQuantity) - Number(p.quantity),
      estimatedCost: (Number(p.minQuantity) * 2 - Number(p.quantity)) * Number(p.costPrice),
      value: 0
    })),
    summary: { count: lowStockProducts.length },
    insights: insights.insights,
    recommendations: insights.recommendations,
    generatedAt: new Date()
  };
}

/**
 * ملخص المصروفات
 */
async function generateExpensesSummary(analysis: AnalyzedQuestion): Promise<ReportData> {
  const db = await getDb();
  if (!db) return createEmptyReport('ملخص المصروفات', 'expenses_summary', analysis.chartType);
  
  const { dateRange, filters } = analysis;
  
  const expensesData = await db
    .select({
      category: expenses.category,
      total: sql<number>`SUM(${expenses.amount})`,
      count: sql<number>`COUNT(*)`
    })
    .from(expenses)
    .where(
      and(
        gte(expenses.expenseDate, dateRange.start),
        lte(expenses.expenseDate, dateRange.end),
        filters.branchId ? eq(expenses.branchId, filters.branchId) : undefined
      )
    )
    .groupBy(expenses.category)
    .orderBy(desc(sql`SUM(${expenses.amount})`));
  
  const totalExpenses = expensesData.reduce((sum: number, e) => sum + Number(e.total), 0);
  const insights = await generateInsights('expenses_summary', { expenses: expensesData, totalExpenses });
  
  return {
    title: 'ملخص المصروفات',
    subtitle: dateRange.label,
    type: 'expenses_summary',
    chartType: analysis.chartType,
    data: expensesData.map(e => ({
      label: e.category || 'غير مصنف',
      value: Number(e.total),
      count: Number(e.count),
      percentage: totalExpenses > 0 ? (Number(e.total) / totalExpenses) * 100 : 0
    })),
    summary: {
      total: totalExpenses,
      count: expensesData.reduce((sum: number, e) => sum + Number(e.count), 0)
    },
    insights: insights.insights,
    recommendations: insights.recommendations,
    generatedAt: new Date()
  };
}

/**
 * المصروفات حسب الفئة
 */
async function generateExpensesByCategory(analysis: AnalyzedQuestion): Promise<ReportData> {
  return generateExpensesSummary({ ...analysis, chartType: 'pie' });
}

/**
 * الأرباح والخسائر
 */
async function generateProfitLoss(analysis: AnalyzedQuestion): Promise<ReportData> {
  const db = await getDb();
  if (!db) return createEmptyReport('تقرير الأرباح والخسائر', 'profit_loss', 'kpi');
  
  const { dateRange, filters } = analysis;
  
  const [salesData] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${invoices.total}), 0)`
    })
    .from(invoices)
    .where(
      and(
        gte(invoices.createdAt, dateRange.start),
        lte(invoices.createdAt, dateRange.end),
        filters.branchId ? eq(invoices.branchId, filters.branchId) : undefined
      )
    );
  
  const [expensesData] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)`
    })
    .from(expenses)
    .where(
      and(
        gte(expenses.expenseDate, dateRange.start),
        lte(expenses.expenseDate, dateRange.end),
        filters.branchId ? eq(expenses.branchId, filters.branchId) : undefined
      )
    );
  
  const [cogsData] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${invoiceItems.quantity} * ${products.costPrice}), 0)`
    })
    .from(invoiceItems)
    .innerJoin(products, eq(invoiceItems.productId, products.id))
    .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
    .where(
      and(
        gte(invoices.createdAt, dateRange.start),
        lte(invoices.createdAt, dateRange.end),
        filters.branchId ? eq(invoices.branchId, filters.branchId) : undefined
      )
    );
  
  const revenue = Number(salesData.total);
  const cogs = Number(cogsData.total);
  const grossProfit = revenue - cogs;
  const operatingExpenses = Number(expensesData.total);
  const netProfit = grossProfit - operatingExpenses;
  const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  
  const insights = await generateInsights('profit_loss', { revenue, cogs, grossProfit, operatingExpenses, netProfit, profitMargin });
  
  return {
    title: 'تقرير الأرباح والخسائر',
    subtitle: dateRange.label,
    type: 'profit_loss',
    chartType: 'kpi',
    data: [
      { label: 'إجمالي الإيرادات', value: revenue, type: 'revenue' },
      { label: 'تكلفة البضاعة المباعة', value: cogs, type: 'cost' },
      { label: 'إجمالي الربح', value: grossProfit, type: 'gross_profit' },
      { label: 'المصروفات التشغيلية', value: operatingExpenses, type: 'expenses' },
      { label: 'صافي الربح', value: netProfit, type: 'net_profit' },
      { label: 'هامش الربح', value: profitMargin, type: 'margin', suffix: '%' }
    ],
    summary: { total: netProfit, average: profitMargin },
    insights: insights.insights,
    recommendations: insights.recommendations,
    generatedAt: new Date()
  };
}

/**
 * تحليل العملاء
 */
async function generateCustomerAnalysis(analysis: AnalyzedQuestion): Promise<ReportData> {
  const db = await getDb();
  if (!db) return createEmptyReport('تحليل العملاء', 'customer_analysis', analysis.chartType);
  
  const { dateRange, limit } = analysis;
  
  const customerStats = await db
    .select({
      customerId: invoices.customerId,
      customerName: customers.name,
      totalPurchases: sql<number>`SUM(${invoices.total})`,
      invoiceCount: sql<number>`COUNT(*)`,
      avgPurchase: sql<number>`AVG(${invoices.total})`,
      lastPurchase: sql<string>`MAX(${invoices.createdAt})`
    })
    .from(invoices)
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .where(
      and(
        gte(invoices.createdAt, dateRange.start),
        lte(invoices.createdAt, dateRange.end)
      )
    )
    .groupBy(invoices.customerId, customers.name)
    .orderBy(desc(sql`SUM(${invoices.total})`))
    .limit(limit || 20);
  
  const totalCustomers = customerStats.length;
  const totalRevenue = customerStats.reduce((sum: number, c) => sum + Number(c.totalPurchases), 0);
  
  const insights = await generateInsights('customer_analysis', { totalCustomers, totalRevenue });
  
  return {
    title: 'تحليل العملاء',
    subtitle: dateRange.label,
    type: 'customer_analysis',
    chartType: analysis.chartType,
    data: customerStats.map(c => ({
      id: c.customerId,
      label: c.customerName,
      value: Number(c.totalPurchases),
      invoiceCount: Number(c.invoiceCount),
      avgPurchase: Number(c.avgPurchase),
      lastPurchase: c.lastPurchase,
      percentage: totalRevenue > 0 ? (Number(c.totalPurchases) / totalRevenue) * 100 : 0
    })),
    summary: {
      total: totalRevenue,
      count: totalCustomers,
      average: totalCustomers > 0 ? totalRevenue / totalCustomers : 0
    },
    insights: insights.insights,
    recommendations: insights.recommendations,
    generatedAt: new Date()
  };
}

/**
 * أداء الموظفين
 */
async function generateEmployeePerformance(analysis: AnalyzedQuestion): Promise<ReportData> {
  return generateSalesByEmployee({ ...analysis, chartType: 'bar' });
}

/**
 * أوامر الشراء
 */
async function generatePurchaseOrders(analysis: AnalyzedQuestion): Promise<ReportData> {
  const db = await getDb();
  if (!db) return createEmptyReport('أوامر الشراء', 'purchase_orders', 'table');
  
  const { dateRange, filters, limit } = analysis;
  
  const orders = await db
    .select({
      id: purchaseOrders.id,
      orderNumber: purchaseOrders.orderNumber,
      supplierName: suppliers.name,
      total: purchaseOrders.total,
      status: purchaseOrders.status,
      createdAt: purchaseOrders.createdAt
    })
    .from(purchaseOrders)
    .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .where(
      and(
        gte(purchaseOrders.createdAt, dateRange.start),
        lte(purchaseOrders.createdAt, dateRange.end),
        filters.branchId ? eq(purchaseOrders.branchId, filters.branchId) : undefined
      )
    )
    .orderBy(desc(purchaseOrders.createdAt))
    .limit(limit || 20);
  
  const totalAmount = orders.reduce((sum: number, o) => sum + Number(o.total), 0);
  const insights = await generateInsights('purchase_orders', { count: orders.length, totalAmount });
  
  return {
    title: 'أوامر الشراء',
    subtitle: dateRange.label,
    type: 'purchase_orders',
    chartType: 'table',
    data: orders.map(o => ({
      id: o.id,
      label: o.orderNumber,
      supplier: o.supplierName,
      value: Number(o.total),
      status: o.status,
      date: o.createdAt
    })),
    summary: { total: totalAmount, count: orders.length },
    insights: insights.insights,
    recommendations: insights.recommendations,
    generatedAt: new Date()
  };
}

// ==================== توليد التحليلات ====================

interface InsightsResult {
  insights: string[];
  recommendations: string[];
}

async function generateInsights(
  reportType: string,
  data: Record<string, unknown>
): Promise<InsightsResult> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `أنت محلل أعمال خبير. قم بتحليل البيانات التالية وقدم:
1. 3-5 ملاحظات تحليلية مهمة (insights)
2. 2-3 توصيات عملية قابلة للتنفيذ

أجب بـ JSON فقط:
{
  "insights": ["ملاحظة 1", "ملاحظة 2", ...],
  "recommendations": ["توصية 1", "توصية 2", ...]
}`
        },
        {
          role: 'user',
          content: `نوع التقرير: ${reportType}\n\nالبيانات:\n${JSON.stringify(data, null, 2)}`
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'insights_response',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              insights: { type: 'array', items: { type: 'string' } },
              recommendations: { type: 'array', items: { type: 'string' } }
            },
            required: ['insights', 'recommendations'],
            additionalProperties: false
          }
        }
      },
      temperature: 0.5
    });

    const content = response.choices[0]?.message?.content;
    if (typeof content === 'string') {
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('خطأ في توليد التحليلات:', error);
  }
  
  return {
    insights: ['تم توليد التقرير بنجاح'],
    recommendations: ['راجع البيانات بعناية لاتخاذ القرارات المناسبة']
  };
}

// ==================== توليد الرد النصي ====================

export async function generateResponse(
  question: string,
  reportData: ReportData
): Promise<string> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `أنت مساعد تقارير ذكي يدعى "نواب AI". قم بتلخيص التقرير التالي بأسلوب محادثة طبيعي بالعربية.
- كن موجزاً ومفيداً
- اذكر الأرقام الرئيسية
- أشر للتحليلات المهمة
- لا تكرر كل البيانات، فقط الأهم`
        },
        {
          role: 'user',
          content: `السؤال: ${question}\n\nالتقرير:\n${JSON.stringify(reportData, null, 2)}`
        }
      ],
      temperature: 0.7
    });

    const content = response.choices[0]?.message?.content;
    if (typeof content === 'string') {
      return content;
    }
  } catch (error) {
    console.error('خطأ في توليد الرد:', error);
  }
  
  return `تم إنشاء ${reportData.title}. ${reportData.subtitle || ''}
  
الملخص:
- الإجمالي: ${reportData.summary.total?.toLocaleString('ar-SA')} ر.س.
${reportData.summary.count ? `- العدد: ${reportData.summary.count}` : ''}
${reportData.summary.changePercent ? `- التغير: ${reportData.summary.changePercent.toFixed(1)}%` : ''}

${reportData.insights.length > 0 ? `التحليلات:\n${reportData.insights.map(i => `• ${i}`).join('\n')}` : ''}`;
}

// ==================== الأسئلة المقترحة ====================

export function getSuggestedQuestions(): string[] {
  return [
    'ما هي المبيعات هذا الشهر؟',
    'أعطني تقرير المنتجات الأكثر مبيعاً',
    'كم عدد الفواتير اليوم؟',
    'ما هي المنتجات التي تحتاج إعادة طلب؟',
    'أظهر لي تقرير الأرباح والخسائر',
    'من هم أفضل العملاء؟',
    'ما هي المصروفات هذا الأسبوع؟',
    'قارن مبيعات هذا الشهر بالشهر الماضي',
    'أداء الموظفين في المبيعات',
    'تقرير أوامر الشراء المعلقة'
  ];
}
