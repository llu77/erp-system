/**
 * خدمة تحليلات BI المتقدمة
 * توفر تحليلات شاملة للمبيعات والمخزون والمالية
 */

import { getDb } from "../db";
import { 
  invoices, invoiceItems, products, customers, branches, 
  expenses, employees, dailyRevenues, purchaseOrders,
  inventoryMovements, categories
} from "../../drizzle/schema";
import { sql, eq, and, gte, lte, desc, asc, sum, count, avg } from "drizzle-orm";

// ==================== أنواع البيانات ====================

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface KPIData {
  value: number;
  previousValue: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

export interface ExecutiveSummary {
  totalSales: KPIData;
  totalExpenses: KPIData;
  netProfit: KPIData;
  totalCustomers: KPIData;
  totalInvoices: KPIData;
  avgInvoiceValue: KPIData;
  topBranches: { branchId: number; branchName: string; sales: number }[];
  topEmployees: { employeeId: number; employeeName: string; sales: number }[];
  alerts: { type: string; message: string; priority: 'low' | 'medium' | 'high' }[];
}

export interface SalesAnalytics {
  totalSales: number;
  totalInvoices: number;
  avgInvoiceValue: number;
  salesByDay: { date: string; sales: number; invoices: number }[];
  salesByBranch: { branchId: number; branchName: string; sales: number; percentage: number }[];
  salesByCategory: { categoryId: number; categoryName: string; sales: number; percentage: number }[];
  topProducts: { productId: number; productName: string; quantity: number; sales: number }[];
  topCustomers: { customerId: number; customerName: string; invoices: number; sales: number }[];
  salesHeatmap: { hour: number; day: number; sales: number }[];
}

export interface InventoryAnalytics {
  totalValue: number;
  totalProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  expiringProducts: number;
  turnoverRate: number;
  abcAnalysis: {
    A: { count: number; value: number; percentage: number };
    B: { count: number; value: number; percentage: number };
    C: { count: number; value: number; percentage: number };
  };
  productsByCategory: { categoryId: number; categoryName: string; count: number; value: number }[];
  reorderSuggestions: { productId: number; productName: string; currentStock: number; reorderPoint: number; suggestedQuantity: number }[];
}

export interface FinancialAnalytics {
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  grossMargin: number;
  operatingExpenses: number;
  netProfit: number;
  netMargin: number;
  expensesByCategory: { category: string; amount: number; percentage: number }[];
  revenueVsExpenses: { date: string; revenue: number; expenses: number; profit: number }[];
  cashFlow: { date: string; inflow: number; outflow: number; balance: number }[];
}

// ==================== دوال مساعدة ====================

function calculateKPI(current: number, previous: number): KPIData {
  const change = current - previous;
  const changePercent = previous !== 0 ? (change / previous) * 100 : 0;
  return {
    value: current,
    previousValue: previous,
    change,
    changePercent: Math.round(changePercent * 100) / 100,
    trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
  };
}

function getPreviousPeriod(startDate: Date, endDate: Date): DateRange {
  const duration = endDate.getTime() - startDate.getTime();
  return {
    startDate: new Date(startDate.getTime() - duration),
    endDate: new Date(startDate.getTime() - 1)
  };
}

// ==================== خدمات التحليل ====================

/**
 * الحصول على الملخص التنفيذي
 */
export async function getExecutiveSummary(
  dateRange: DateRange,
  branchId?: number
): Promise<ExecutiveSummary> {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');
  const { startDate, endDate } = dateRange;
  const previousPeriod = getPreviousPeriod(startDate, endDate);

  // استعلام الإيرادات الحالية (من جدول الإيرادات اليومية)
  const currentSalesQuery = db
    .select({
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
    );

  // استعلام الإيرادات السابقة (من جدول الإيرادات اليومية)
  const previousSalesQuery = db
    .select({
      total: sql<number>`COALESCE(SUM(${dailyRevenues.cash} + ${dailyRevenues.network}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(dailyRevenues)
    .where(
      and(
        gte(dailyRevenues.date, previousPeriod.startDate),
        lte(dailyRevenues.date, previousPeriod.endDate),
        branchId ? eq(dailyRevenues.branchId, branchId) : undefined
      )
    );

  // استعلام المصاريف الحالية
  const currentExpensesQuery = db
    .select({
      total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)`,
    })
    .from(expenses)
    .where(
      and(
        gte(expenses.createdAt, startDate),
        lte(expenses.createdAt, endDate),
        branchId ? eq(expenses.branchId, branchId) : undefined
      )
    );

  // استعلام المصاريف السابقة
  const previousExpensesQuery = db
    .select({
      total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)`,
    })
    .from(expenses)
    .where(
      and(
        gte(expenses.createdAt, previousPeriod.startDate),
        lte(expenses.createdAt, previousPeriod.endDate),
        branchId ? eq(expenses.branchId, branchId) : undefined
      )
    );

  // استعلام أفضل الفروع (من جدول الإيرادات اليومية)
  const topBranchesQuery = db
    .select({
      branchId: dailyRevenues.branchId,
      branchName: branches.name,
      sales: sql<number>`COALESCE(SUM(${dailyRevenues.cash} + ${dailyRevenues.network}), 0)`,
    })
    .from(dailyRevenues)
    .leftJoin(branches, eq(dailyRevenues.branchId, branches.id))
    .where(
      and(
        gte(dailyRevenues.date, startDate),
        lte(dailyRevenues.date, endDate)
      )
    )
    .groupBy(dailyRevenues.branchId, branches.name)
    .orderBy(desc(sql`SUM(${dailyRevenues.cash} + ${dailyRevenues.network})`))
    .limit(5);

  // تنفيذ جميع الاستعلامات
  const [
    [currentSales],
    [previousSales],
    [currentExpenses],
    [previousExpenses],
    topBranches
  ] = await Promise.all([
    currentSalesQuery,
    previousSalesQuery,
    currentExpensesQuery,
    previousExpensesQuery,
    topBranchesQuery
  ]);

  const currentSalesTotal = Number(currentSales?.total || 0);
  const previousSalesTotal = Number(previousSales?.total || 0);
  const currentExpensesTotal = Number(currentExpenses?.total || 0);
  const previousExpensesTotal = Number(previousExpenses?.total || 0);
  const currentInvoicesCount = Number(currentSales?.count || 0);
  const previousInvoicesCount = Number(previousSales?.count || 0);

  const currentNetProfit = currentSalesTotal - currentExpensesTotal;
  const previousNetProfit = previousSalesTotal - previousExpensesTotal;

  const currentAvgInvoice = currentInvoicesCount > 0 ? currentSalesTotal / currentInvoicesCount : 0;
  const previousAvgInvoice = previousInvoicesCount > 0 ? previousSalesTotal / previousInvoicesCount : 0;

  // إنشاء التنبيهات
  const alerts: ExecutiveSummary['alerts'] = [];
  
  if (currentSalesTotal < previousSalesTotal * 0.8) {
    alerts.push({
      type: 'sales_decline',
      message: `انخفاض المبيعات بنسبة ${Math.round((1 - currentSalesTotal / previousSalesTotal) * 100)}%`,
      priority: 'high'
    });
  }

  if (currentExpensesTotal > previousExpensesTotal * 1.2) {
    alerts.push({
      type: 'expense_increase',
      message: `زيادة المصاريف بنسبة ${Math.round((currentExpensesTotal / previousExpensesTotal - 1) * 100)}%`,
      priority: 'medium'
    });
  }

  return {
    totalSales: calculateKPI(currentSalesTotal, previousSalesTotal),
    totalExpenses: calculateKPI(currentExpensesTotal, previousExpensesTotal),
    netProfit: calculateKPI(currentNetProfit, previousNetProfit),
    totalCustomers: calculateKPI(0, 0), // TODO: حساب العملاء الفعليين
    totalInvoices: calculateKPI(currentInvoicesCount, previousInvoicesCount),
    avgInvoiceValue: calculateKPI(currentAvgInvoice, previousAvgInvoice),
    topBranches: topBranches.map((b: any) => ({
      branchId: b.branchId || 0,
      branchName: b.branchName || 'غير محدد',
      sales: Number(b.sales)
    })),
    topEmployees: [], // TODO: إضافة أفضل الموظفين
    alerts
  };
}

/**
 * الحصول على تحليلات المبيعات
 */
export async function getSalesAnalytics(
  dateRange: DateRange,
  branchId?: number,
  groupBy: 'day' | 'week' | 'month' = 'day'
): Promise<SalesAnalytics> {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');
  const { startDate, endDate } = dateRange;

  // الإيرادات الإجمالية (من جدول الإيرادات اليومية)
  const [totals] = await db
    .select({
      totalSales: sql<number>`COALESCE(SUM(${dailyRevenues.cash} + ${dailyRevenues.network}), 0)`,
      totalInvoices: sql<number>`COUNT(*)`,
    })
    .from(dailyRevenues)
    .where(
      and(
        gte(dailyRevenues.date, startDate),
        lte(dailyRevenues.date, endDate),
        branchId ? eq(dailyRevenues.branchId, branchId) : undefined
      )
    );

  // الإيرادات حسب اليوم (من جدول الإيرادات اليومية)
  const salesByDay = await db
    .select({
      date: dailyRevenues.date,
      sales: sql<number>`COALESCE(SUM(${dailyRevenues.cash} + ${dailyRevenues.network}), 0)`,
      invoices: sql<number>`COUNT(*)`,
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

  // الإيرادات حسب الفرع (من جدول الإيرادات اليومية)
  const salesByBranch = await db
    .select({
      branchId: dailyRevenues.branchId,
      branchName: branches.name,
      sales: sql<number>`COALESCE(SUM(${dailyRevenues.cash} + ${dailyRevenues.network}), 0)`,
    })
    .from(dailyRevenues)
    .leftJoin(branches, eq(dailyRevenues.branchId, branches.id))
    .where(
      and(
        gte(dailyRevenues.date, startDate),
        lte(dailyRevenues.date, endDate)
      )
    )
    .groupBy(dailyRevenues.branchId, branches.name)
    .orderBy(desc(sql`SUM(${dailyRevenues.cash} + ${dailyRevenues.network})`));

  // أفضل المنتجات
  const topProducts = await db
    .select({
      productId: invoiceItems.productId,
      productName: products.name,
      quantity: sql<number>`SUM(${invoiceItems.quantity})`,
      sales: sql<number>`SUM(${invoiceItems.total})`,
    })
    .from(invoiceItems)
    .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
    .leftJoin(products, eq(invoiceItems.productId, products.id))
    .where(
      and(
        gte(invoices.createdAt, startDate),
        lte(invoices.createdAt, endDate),
        branchId ? eq(invoices.branchId, branchId) : undefined
      )
    )
    .groupBy(invoiceItems.productId, products.name)
    .orderBy(desc(sql`SUM(${invoiceItems.total})`))
    .limit(10);

  // أفضل العملاء
  const topCustomers = await db
    .select({
      customerId: invoices.customerId,
      customerName: customers.name,
      invoices: sql<number>`COUNT(*)`,
      sales: sql<number>`COALESCE(SUM(${invoices.total}), 0)`,
    })
    .from(invoices)
    .leftJoin(customers, eq(invoices.customerId, customers.id))
    .where(
      and(
        gte(invoices.createdAt, startDate),
        lte(invoices.createdAt, endDate),
        branchId ? eq(invoices.branchId, branchId) : undefined
      )
    )
    .groupBy(invoices.customerId, customers.name)
    .orderBy(desc(sql`SUM(${invoices.total})`))
    .limit(10);

  const totalSalesValue = Number(totals?.totalSales || 0);

  return {
    totalSales: totalSalesValue,
    totalInvoices: Number(totals?.totalInvoices || 0),
    avgInvoiceValue: Number(totals?.totalInvoices || 0) > 0 
      ? totalSalesValue / Number(totals?.totalInvoices || 1) 
      : 0,
    salesByDay: salesByDay.map((d: any) => ({
      date: d.date instanceof Date ? d.date.toISOString().split('T')[0] : String(d.date),
      sales: Number(d.sales),
      invoices: Number(d.invoices)
    })),
    salesByBranch: salesByBranch.map((b: any) => ({
      branchId: b.branchId || 0,
      branchName: b.branchName || 'غير محدد',
      sales: Number(b.sales),
      percentage: totalSalesValue > 0 ? (Number(b.sales) / totalSalesValue) * 100 : 0
    })),
    salesByCategory: [], // TODO: إضافة المبيعات حسب الفئة
    topProducts: topProducts.map((p: any) => ({
      productId: p.productId || 0,
      productName: p.productName || 'غير محدد',
      quantity: Number(p.quantity),
      sales: Number(p.sales)
    })),
    topCustomers: topCustomers.map((c: any) => ({
      customerId: c.customerId || 0,
      customerName: c.customerName || 'عميل نقدي',
      invoices: Number(c.invoices),
      sales: Number(c.sales)
    })),
    salesHeatmap: [] // TODO: إضافة خريطة الحرارة
  };
}

/**
 * الحصول على تحليلات المخزون
 */
export async function getInventoryAnalytics(branchId?: number): Promise<InventoryAnalytics> {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');
  // إجمالي المنتجات والقيمة
  const [totals] = await db
    .select({
      totalProducts: sql<number>`COUNT(*)`,
      totalValue: sql<number>`COALESCE(SUM(${products.quantity} * ${products.costPrice}), 0)`,
      lowStock: sql<number>`SUM(CASE WHEN ${products.quantity} <= ${products.minQuantity} AND ${products.quantity} > 0 THEN 1 ELSE 0 END)`,
      outOfStock: sql<number>`SUM(CASE WHEN ${products.quantity} = 0 THEN 1 ELSE 0 END)`,
    })
    .from(products)
    .where(eq(products.isActive, true));

  // المنتجات حسب الفئة
  const productsByCategory = await db
    .select({
      categoryId: products.categoryId,
      categoryName: categories.name,
      count: sql<number>`COUNT(*)`,
      value: sql<number>`COALESCE(SUM(${products.quantity} * ${products.costPrice}), 0)`,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.isActive, true))
    .groupBy(products.categoryId, categories.name)
    .orderBy(desc(sql`SUM(${products.quantity} * ${products.costPrice})`));

  // اقتراحات إعادة الطلب
  const reorderSuggestions = await db
    .select({
      productId: products.id,
      productName: products.name,
      currentStock: products.quantity,
      reorderPoint: products.minQuantity,
    })
    .from(products)
    .where(
      and(
        eq(products.isActive, true),
        sql`${products.quantity} <= ${products.minQuantity}`
      )
    )
    .orderBy(asc(products.quantity))
    .limit(20);

  const totalValue = Number(totals?.totalValue || 0);

  // تحليل ABC (تقريبي)
  const allProducts = await db
    .select({
      value: sql<number>`${products.quantity} * ${products.costPrice}`,
    })
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(desc(sql`${products.quantity} * ${products.costPrice}`));

  let cumulativeValue = 0;
  let aCount = 0, bCount = 0, cCount = 0;
  let aValue = 0, bValue = 0, cValue = 0;

  for (const p of allProducts) {
    const value = Number(p.value || 0);
    cumulativeValue += value;
    const percentage = (cumulativeValue / totalValue) * 100;

    if (percentage <= 80) {
      aCount++;
      aValue += value;
    } else if (percentage <= 95) {
      bCount++;
      bValue += value;
    } else {
      cCount++;
      cValue += value;
    }
  }

  return {
    totalValue,
    totalProducts: Number(totals?.totalProducts || 0),
    lowStockProducts: Number(totals?.lowStock || 0),
    outOfStockProducts: Number(totals?.outOfStock || 0),
    expiringProducts: 0, // TODO: حساب المنتجات قريبة الانتهاء
    turnoverRate: 0, // TODO: حساب معدل الدوران
    abcAnalysis: {
      A: { count: aCount, value: aValue, percentage: totalValue > 0 ? (aValue / totalValue) * 100 : 0 },
      B: { count: bCount, value: bValue, percentage: totalValue > 0 ? (bValue / totalValue) * 100 : 0 },
      C: { count: cCount, value: cValue, percentage: totalValue > 0 ? (cValue / totalValue) * 100 : 0 },
    },
    productsByCategory: productsByCategory.map((c: any) => ({
      categoryId: c.categoryId || 0,
      categoryName: c.categoryName || 'غير مصنف',
      count: Number(c.count),
      value: Number(c.value)
    })),
    reorderSuggestions: reorderSuggestions.map((p: any) => ({
      productId: p.productId,
      productName: p.productName,
      currentStock: p.currentStock || 0,
      reorderPoint: p.reorderPoint || 0,
      suggestedQuantity: Math.max((p.reorderPoint || 0) * 2 - (p.currentStock || 0), 0)
    }))
  };
}

/**
 * الحصول على تحليلات مالية
 */
export async function getFinancialAnalytics(dateRange: DateRange, branchId?: number): Promise<FinancialAnalytics> {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');
  const { startDate, endDate } = dateRange;

  // الإيرادات (من جدول الإيرادات اليومية)
  const [revenueData] = await db
    .select({
      revenue: sql<number>`COALESCE(SUM(${dailyRevenues.cash} + ${dailyRevenues.network}), 0)`,
    })
    .from(dailyRevenues)
    .where(
      and(
        gte(dailyRevenues.date, startDate),
        lte(dailyRevenues.date, endDate),
        branchId ? eq(dailyRevenues.branchId, branchId) : undefined
      )
    );

  // تكلفة البضاعة المباعة
  const [cogsData] = await db
    .select({
      cogs: sql<number>`COALESCE(SUM(${invoiceItems.quantity} * ${products.costPrice}), 0)`,
    })
    .from(invoiceItems)
    .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
    .leftJoin(products, eq(invoiceItems.productId, products.id))
    .where(
      and(
        gte(invoices.createdAt, startDate),
        lte(invoices.createdAt, endDate),
        branchId ? eq(invoices.branchId, branchId) : undefined
      )
    );

  // المصاريف التشغيلية
  const [expensesData] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)`,
    })
    .from(expenses)
    .where(
      and(
        gte(expenses.createdAt, startDate),
        lte(expenses.createdAt, endDate),
        branchId ? eq(expenses.branchId, branchId) : undefined
      )
    );

  // المصاريف حسب الفئة
  const expensesByCategory = await db
    .select({
      category: expenses.category,
      amount: sql<number>`COALESCE(SUM(${expenses.amount}), 0)`,
    })
    .from(expenses)
    .where(
      and(
        gte(expenses.createdAt, startDate),
        lte(expenses.createdAt, endDate),
        branchId ? eq(expenses.branchId, branchId) : undefined
      )
    )
    .groupBy(expenses.category)
    .orderBy(desc(sql`SUM(${expenses.amount})`));

  // الإيرادات مقابل المصاريف حسب اليوم (من جدول الإيرادات اليومية)
  const revenueByDay = await db
    .select({
      date: dailyRevenues.date,
      revenue: sql<number>`COALESCE(SUM(${dailyRevenues.cash} + ${dailyRevenues.network}), 0)`,
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

  const expensesByDay = await db
    .select({
      date: expenses.expenseDate,
      expenses: sql<number>`COALESCE(SUM(${expenses.amount}), 0)`,
    })
    .from(expenses)
    .where(
      and(
        gte(expenses.expenseDate, startDate),
        lte(expenses.expenseDate, endDate),
        branchId ? eq(expenses.branchId, branchId) : undefined
      )
    )
    .groupBy(expenses.expenseDate)
    .orderBy(asc(expenses.expenseDate));

  const revenue = Number(revenueData?.revenue || 0);
  const cogs = Number(cogsData?.cogs || 0);
  const operatingExpenses = Number(expensesData?.total || 0);
  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - operatingExpenses;

  // دمج الإيرادات والمصاريف
  const expenseMap = new Map(expensesByDay.map((e: { date: Date | null; expenses: number }) => {
    const dateStr = e.date ? (e.date instanceof Date ? e.date.toISOString().split('T')[0] : String(e.date)) : '';
    return [dateStr, Number(e.expenses)];
  }));
  const revenueVsExpenses = revenueByDay.map((r: { date: Date | null; revenue: number }) => {
    const dateStr = r.date ? (r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date)) : '';
    const rev = Number(r.revenue);
    const exp = expenseMap.get(dateStr) || 0;
    return {
      date: dateStr,
      revenue: rev,
      expenses: exp,
      profit: rev - exp
    };
  });

  const totalExpenses = operatingExpenses;

  return {
    revenue,
    costOfGoodsSold: cogs,
    grossProfit,
    grossMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
    operatingExpenses,
    netProfit,
    netMargin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
    expensesByCategory: expensesByCategory.map((e: { category: string | null; amount: number }) => ({
      category: e.category || 'أخرى',
      amount: Number(e.amount),
      percentage: totalExpenses > 0 ? (Number(e.amount) / totalExpenses) * 100 : 0
    })),
    revenueVsExpenses,
    cashFlow: [] // TODO: حساب التدفق النقدي
  };
}

/**
 * مقارنة الفروع
 */
export async function getBranchComparison(
  dateRange: DateRange,
  metric: 'sales' | 'expenses' | 'profit' | 'customers'
) {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');
  const { startDate, endDate } = dateRange;

  if (metric === 'sales') {
    return db
      .select({
        branchId: dailyRevenues.branchId,
        branchName: branches.name,
        value: sql<number>`COALESCE(SUM(${dailyRevenues.cash} + ${dailyRevenues.network}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(dailyRevenues)
      .leftJoin(branches, eq(dailyRevenues.branchId, branches.id))
      .where(
        and(
          gte(dailyRevenues.date, startDate),
          lte(dailyRevenues.date, endDate)
        )
      )
      .groupBy(dailyRevenues.branchId, branches.name)
      .orderBy(desc(sql`SUM(${dailyRevenues.cash} + ${dailyRevenues.network})`));
  }

  if (metric === 'expenses') {
    return db
      .select({
        branchId: expenses.branchId,
        branchName: branches.name,
        value: sql<number>`COALESCE(SUM(${expenses.amount}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(expenses)
      .leftJoin(branches, eq(expenses.branchId, branches.id))
      .where(
        and(
          gte(expenses.createdAt, startDate),
          lte(expenses.createdAt, endDate)
        )
      )
      .groupBy(expenses.branchId, branches.name)
      .orderBy(desc(sql`SUM(${expenses.amount})`));
  }

  return [];
}
