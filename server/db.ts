import { eq, desc, sql, and, gte, lte, lt, like, or, isNotNull, isNull, inArray, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import type { SQL } from "drizzle-orm";
import {
  InsertUser, users,
  InsertCategory, categories,
  InsertProduct, products,
  InsertCustomer, customers,
  InsertSupplier, suppliers,
  InsertInvoice, invoices,
  InsertInvoiceItem, invoiceItems,
  InsertPurchaseOrder, purchaseOrders,
  InsertPurchaseOrderItem, purchaseOrderItems,
  InsertNotification, notifications,
  InsertActivityLog, activityLogs,
  InsertInventoryMovement, inventoryMovements,
  scheduledTasks,
  taskExecutionLogs,
  systemAlerts,
  monitorSettings,
  notificationRecipients,
  sentNotifications,
  deletedRecords,
  InsertDeletedRecord,
  employeeInvoices,
  InsertEmployeeInvoice,
  tasks,
  taskLogs,
  InsertTask,
  InsertTaskLog,
  loyaltyCustomers,
  loyaltyVisits,
  LoyaltyCustomer,
  LoyaltyVisit,
  InsertLoyaltyCustomer,
  InsertLoyaltyVisit,
  receiptVouchers,
  loyaltyVisitDeletionRequests,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { createLogger } from './utils/logger';

// إنشاء logger لنظام الكاشير
const posLogger = createLogger('POS');

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== دوال المستخدمين ====================
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "phone", "department", "position"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }
    if (user.isActive !== undefined) {
      values.isActive = user.isActive;
      updateSet.isActive = user.isActive;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users).orderBy(desc(users.createdAt));
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUser(id: number, data: Partial<InsertUser>) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(data).where(eq(users.id, id));
}

export async function deleteUser(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(users).where(eq(users.id, id));
}

// ==================== دوال الفئات ====================
export async function getAllCategories() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(categories).orderBy(categories.name);
}

export async function getCategoryById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createCategory(data: InsertCategory) {
  const db = await getDb();
  if (!db) return;
  await db.insert(categories).values(data);
}

export async function updateCategory(id: number, data: Partial<InsertCategory>) {
  const db = await getDb();
  if (!db) return;
  await db.update(categories).set(data).where(eq(categories.id, id));
}

export async function deleteCategory(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(categories).where(eq(categories.id, id));
}

// ==================== دوال المنتجات ====================
export async function getAllProducts() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(products).orderBy(desc(products.createdAt));
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getProductBySku(sku: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.sku, sku)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createProduct(data: InsertProduct) {
  const db = await getDb();
  if (!db) return;
  await db.insert(products).values(data);
}

export async function updateProduct(id: number, data: Partial<InsertProduct>) {
  const db = await getDb();
  if (!db) return;
  await db.update(products).set(data).where(eq(products.id, id));
}

export async function deleteProduct(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(products).where(eq(products.id, id));
}

export async function getLowStockProducts(threshold?: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(products)
    .where(sql`${products.quantity} <= ${products.minQuantity}`)
    .orderBy(products.quantity);
}

export async function updateProductQuantity(id: number, quantity: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(products).set({ quantity }).where(eq(products.id, id));
}

// ==================== دوال العملاء ====================
export async function getAllCustomers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(customers).orderBy(desc(customers.createdAt));
}

export async function getCustomerById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createCustomer(data: InsertCustomer) {
  const db = await getDb();
  if (!db) return;
  await db.insert(customers).values(data);
}

export async function updateCustomer(id: number, data: Partial<InsertCustomer>) {
  const db = await getDb();
  if (!db) return;
  await db.update(customers).set(data).where(eq(customers.id, id));
}

export async function deleteCustomer(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(customers).where(eq(customers.id, id));
}

export async function searchCustomers(query: string) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(customers)
    .where(or(
      like(customers.name, `%${query}%`),
      like(customers.code, `%${query}%`),
      like(customers.phone, `%${query}%`)
    ))
    .limit(20);
}

// ==================== دوال الموردين ====================
export async function getAllSuppliers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(suppliers).orderBy(desc(suppliers.createdAt));
}

export async function getSupplierById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createSupplier(data: InsertSupplier) {
  const db = await getDb();
  if (!db) return;
  await db.insert(suppliers).values(data);
}

export async function updateSupplier(id: number, data: Partial<InsertSupplier>) {
  const db = await getDb();
  if (!db) return;
  await db.update(suppliers).set(data).where(eq(suppliers.id, id));
}

export async function deleteSupplier(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(suppliers).where(eq(suppliers.id, id));
}

// ==================== دوال الفواتير ====================
export async function getAllInvoices() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(invoices).orderBy(desc(invoices.createdAt));
}

export async function getInvoiceById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getInvoiceByNumber(invoiceNumber: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(invoices).where(eq(invoices.invoiceNumber, invoiceNumber)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createInvoice(data: InsertInvoice) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(invoices).values(data);
  return result[0].insertId;
}

export async function updateInvoice(id: number, data: Partial<InsertInvoice>) {
  const db = await getDb();
  if (!db) return;
  await db.update(invoices).set(data).where(eq(invoices.id, id));
}

export async function deleteInvoice(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
  await db.delete(invoices).where(eq(invoices.id, id));
}

export async function getInvoiceItems(invoiceId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
}

export async function createInvoiceItem(data: InsertInvoiceItem) {
  const db = await getDb();
  if (!db) return;
  await db.insert(invoiceItems).values(data);
}

export async function deleteInvoiceItems(invoiceId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
}

export async function getInvoicesByDateRange(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(invoices)
    .where(and(
      gte(invoices.invoiceDate, startDate),
      lte(invoices.invoiceDate, endDate)
    ))
    .orderBy(desc(invoices.invoiceDate));
}

export async function getCustomerInvoices(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(invoices)
    .where(eq(invoices.customerId, customerId))
    .orderBy(desc(invoices.createdAt));
}

// ==================== دوال أوامر الشراء ====================
export async function getAllPurchaseOrders() {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({
      id: purchaseOrders.id,
      orderNumber: purchaseOrders.orderNumber,
      supplierId: purchaseOrders.supplierId,
      supplierName: purchaseOrders.supplierName,
      branchId: purchaseOrders.branchId,
      branchName: branches.nameAr,
      orderDate: purchaseOrders.orderDate,
      expectedDate: purchaseOrders.expectedDate,
      receivedDate: purchaseOrders.receivedDate,
      subtotal: purchaseOrders.subtotal,
      taxRate: purchaseOrders.taxRate,
      taxAmount: purchaseOrders.taxAmount,
      shippingCost: purchaseOrders.shippingCost,
      total: purchaseOrders.total,
      paidAmount: purchaseOrders.paidAmount,
      status: purchaseOrders.status,
      notes: purchaseOrders.notes,
      createdBy: purchaseOrders.createdBy,
      createdAt: purchaseOrders.createdAt,
      updatedAt: purchaseOrders.updatedAt,
    })
    .from(purchaseOrders)
    .leftJoin(branches, eq(purchaseOrders.branchId, branches.id))
    .orderBy(desc(purchaseOrders.createdAt));
  return result;
}

export async function getPurchaseOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createPurchaseOrder(data: InsertPurchaseOrder) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(purchaseOrders).values(data);
  return result[0].insertId;
}

export async function updatePurchaseOrder(id: number, data: Partial<InsertPurchaseOrder>) {
  const db = await getDb();
  if (!db) return;
  await db.update(purchaseOrders).set(data).where(eq(purchaseOrders.id, id));
}

export async function deletePurchaseOrder(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, id));
  await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id));
}

export async function getPurchaseOrderItems(purchaseOrderId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));
}

export async function createPurchaseOrderItem(data: InsertPurchaseOrderItem) {
  const db = await getDb();
  if (!db) return;
  await db.insert(purchaseOrderItems).values(data);
}

export async function deletePurchaseOrderItems(purchaseOrderId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));
}

export async function getSupplierPurchaseOrders(supplierId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(purchaseOrders)
    .where(eq(purchaseOrders.supplierId, supplierId))
    .orderBy(desc(purchaseOrders.createdAt));
}

// ==================== دوال الإشعارات ====================
export async function getAllNotifications(userId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (userId) {
    return await db.select().from(notifications)
      .where(or(eq(notifications.userId, userId), sql`${notifications.userId} IS NULL`))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
  }
  return await db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(50);
}

export async function getUnreadNotifications(userId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (userId) {
    return await db.select().from(notifications)
      .where(and(
        or(eq(notifications.userId, userId), sql`${notifications.userId} IS NULL`),
        eq(notifications.isRead, false)
      ))
      .orderBy(desc(notifications.createdAt));
  }
  return await db.select().from(notifications)
    .where(eq(notifications.isRead, false))
    .orderBy(desc(notifications.createdAt));
}

export async function createNotification(data: InsertNotification) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values(data);
}

export async function markNotificationAsRead(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
}

export async function markAllNotificationsAsRead(userId?: number) {
  const db = await getDb();
  if (!db) return;
  if (userId) {
    await db.update(notifications).set({ isRead: true })
      .where(or(eq(notifications.userId, userId), sql`${notifications.userId} IS NULL`));
  } else {
    await db.update(notifications).set({ isRead: true });
  }
}

export async function deleteNotification(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(notifications).where(eq(notifications.id, id));
}

// ==================== دوال سجل الأنشطة ====================
export async function createActivityLog(data: InsertActivityLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityLogs).values(data);
}

export async function getActivityLogs(limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(limit);
}

export async function getUserActivityLogs(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(activityLogs)
    .where(eq(activityLogs.userId, userId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);
}

// ==================== دوال حركات المخزون ====================
export async function createInventoryMovement(data: InsertInventoryMovement) {
  const db = await getDb();
  if (!db) return;
  await db.insert(inventoryMovements).values(data);
}

export async function getProductInventoryMovements(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(inventoryMovements)
    .where(eq(inventoryMovements.productId, productId))
    .orderBy(desc(inventoryMovements.createdAt));
}

// ==================== دوال الإحصائيات ====================
export async function getDashboardStats(branchId?: number) {
  const db = await getDb();
  if (!db) return null;

  const today = new Date();
  // إصلاح timezone - استخدام التاريخ بدون وقت لتجنب مشاكل المنطقة الزمنية
  const startOfMonth = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1, 0, 0, 0));
  const startOfYear = new Date(Date.UTC(today.getFullYear(), 0, 1, 0, 0, 0));

  // إجمالي المنتجات
  const totalProducts = await db.select({ count: sql<number>`COUNT(*)` }).from(products);
  
  // المنتجات منخفضة المخزون
  const lowStockCount = await db.select({ count: sql<number>`COUNT(*)` }).from(products)
    .where(sql`${products.quantity} <= ${products.minQuantity}`);

  // إجمالي العملاء
  const totalCustomers = await db.select({ count: sql<number>`COUNT(*)` }).from(customers);

  // إجمالي الموردين
  const totalSuppliers = await db.select({ count: sql<number>`COUNT(*)` }).from(suppliers);

  // شروط التصفية حسب الفرع للإيرادات اليومية
  const revenueBranchCondition = branchId ? eq(dailyRevenues.branchId, branchId) : undefined;
  const purchaseBranchCondition = branchId ? eq(purchaseOrders.branchId, branchId) : undefined;

  // إيرادات الشهر الفعلية من dailyRevenues (استخدام حقل total = كاش + شبكة)
  const monthlyRevenueConditions = [
    gte(dailyRevenues.date, startOfMonth)
  ];
  if (revenueBranchCondition) monthlyRevenueConditions.push(revenueBranchCondition);
  
  const monthlyRevenue = await db.select({ 
    totalRevenue: sql<string>`COALESCE(SUM(${dailyRevenues.cash} + ${dailyRevenues.network}), 0)`,
    count: sql<number>`COUNT(*)`
  }).from(dailyRevenues)
    .where(and(...monthlyRevenueConditions));

  const monthlyTotal = parseFloat(monthlyRevenue[0]?.totalRevenue || '0');

  // إيرادات السنة الفعلية (استخدام حقل total = كاش + شبكة)
  const yearlyRevenueConditions = [
    gte(dailyRevenues.date, startOfYear)
  ];
  if (revenueBranchCondition) yearlyRevenueConditions.push(revenueBranchCondition);
  
  const yearlyRevenue = await db.select({ 
    totalRevenue: sql<string>`COALESCE(SUM(${dailyRevenues.cash} + ${dailyRevenues.network}), 0)`
  }).from(dailyRevenues)
    .where(and(...yearlyRevenueConditions));

  const yearlyTotal = parseFloat(yearlyRevenue[0]?.totalRevenue || '0');

  // مشتريات الشهر
  const monthlyPurchasesConditions = [
    gte(purchaseOrders.orderDate, startOfMonth),
    eq(purchaseOrders.status, 'received')
  ];
  if (purchaseBranchCondition) monthlyPurchasesConditions.push(purchaseBranchCondition);
  
  const monthlyPurchases = await db.select({ 
    total: sql<string>`COALESCE(SUM(total), 0)`,
    count: sql<number>`COUNT(*)`
  }).from(purchaseOrders)
    .where(and(...monthlyPurchasesConditions));

  // آخر الإيرادات اليومية (بدلاً من الفواتير)
  const recentRevenuesQuery = db.select().from(dailyRevenues);
  if (branchId) {
    const recentRevenues = await recentRevenuesQuery
      .where(eq(dailyRevenues.branchId, branchId))
      .orderBy(desc(dailyRevenues.date))
      .limit(5);
    
    // آخر أوامر الشراء
    const recentPurchases = await db.select().from(purchaseOrders)
      .where(eq(purchaseOrders.branchId, branchId))
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(5);

    // تحويل الإيرادات إلى شكل فواتير للتوافق مع الواجهة (استخدام حقل total)
    const recentInvoices = recentRevenues.map(r => ({
      id: r.id,
      invoiceNumber: `REV-${r.date.toISOString().split('T')[0]}`,
      customerName: 'إيرادات يومية',
      total: String(Number(r.total)),
      invoiceDate: r.date,
      status: r.isMatched ? 'paid' : 'pending'
    }));

    return {
      totalProducts: totalProducts[0]?.count || 0,
      lowStockCount: lowStockCount[0]?.count || 0,
      totalCustomers: totalCustomers[0]?.count || 0,
      totalSuppliers: totalSuppliers[0]?.count || 0,
      monthlySales: {
        total: monthlyTotal,
        count: monthlyRevenue[0]?.count || 0
      },
      yearlySales: yearlyTotal,
      monthlyPurchases: {
        total: parseFloat(monthlyPurchases[0]?.total || '0'),
        count: monthlyPurchases[0]?.count || 0
      },
      recentInvoices,
      recentPurchases,
      branchId
    };
  }

  // آخر الإيرادات (بدون تصفية)
  const recentRevenues = await recentRevenuesQuery
    .orderBy(desc(dailyRevenues.date))
    .limit(5);

  // آخر أوامر الشراء (بدون تصفية)
  const recentPurchases = await db.select().from(purchaseOrders)
    .orderBy(desc(purchaseOrders.createdAt))
    .limit(5);

  // تحويل الإيرادات إلى شكل فواتير للتوافق مع الواجهة (استخدام حقل total)
  const recentInvoices = recentRevenues.map(r => ({
    id: r.id,
    invoiceNumber: `REV-${r.date.toISOString().split('T')[0]}`,
    customerName: 'إيرادات يومية',
    total: String(Number(r.total)),
    invoiceDate: r.date,
    status: r.isMatched ? 'paid' : 'pending'
  }));

  return {
    totalProducts: totalProducts[0]?.count || 0,
    lowStockCount: lowStockCount[0]?.count || 0,
    totalCustomers: totalCustomers[0]?.count || 0,
    totalSuppliers: totalSuppliers[0]?.count || 0,
    monthlySales: {
      total: monthlyTotal,
      count: monthlyRevenue[0]?.count || 0
    },
    yearlySales: yearlyTotal,
    monthlyPurchases: {
      total: parseFloat(monthlyPurchases[0]?.total || '0'),
      count: monthlyPurchases[0]?.count || 0
    },
    recentInvoices,
    recentPurchases
  };
}

export async function getSalesReport(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return null;

  // استخدام dailyRevenues بدلاً من invoices لأنها تحتوي على البيانات الفعلية
  const salesData = await db.select({
    date: sql<string>`DATE(date)`,
    total: sql<string>`SUM(cash + network)`,
    count: sql<number>`COUNT(*)`
  }).from(dailyRevenues)
    .where(and(
      gte(dailyRevenues.date, startDate),
      lte(dailyRevenues.date, endDate)
    ))
    .groupBy(sql`DATE(date)`)
    .orderBy(sql`DATE(date)`);

  const totalSales = await db.select({
    total: sql<string>`COALESCE(SUM(cash + network), 0)`,
    count: sql<number>`COUNT(*)`
  }).from(dailyRevenues)
    .where(and(
      gte(dailyRevenues.date, startDate),
      lte(dailyRevenues.date, endDate)
    ));

  return {
    dailyData: salesData,
    summary: {
      total: parseFloat(totalSales[0]?.total || '0'),
      count: totalSales[0]?.count || 0
    }
  };
}

export async function getPurchasesReport(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return null;

  // تضمين المشتريات الموافق عليها والمستلمة
  const purchasesData = await db.select({
    date: sql<string>`DATE(orderDate)`,
    total: sql<string>`SUM(total)`,
    count: sql<number>`COUNT(*)`
  }).from(purchaseOrders)
    .where(and(
      gte(purchaseOrders.orderDate, startDate),
      lte(purchaseOrders.orderDate, endDate),
      sql`status IN ('approved', 'received')`
    ))
    .groupBy(sql`DATE(orderDate)`)
    .orderBy(sql`DATE(orderDate)`);

  const totalPurchases = await db.select({
    total: sql<string>`COALESCE(SUM(total), 0)`,
    count: sql<number>`COUNT(*)`
  }).from(purchaseOrders)
    .where(and(
      gte(purchaseOrders.orderDate, startDate),
      lte(purchaseOrders.orderDate, endDate),
      sql`status IN ('approved', 'received')`
    ));

  return {
    dailyData: purchasesData,
    summary: {
      total: parseFloat(totalPurchases[0]?.total || '0'),
      count: totalPurchases[0]?.count || 0
    }
  };
}

export async function getInventoryReport() {
  const db = await getDb();
  if (!db) return null;

  const inventoryData = await db.select({
    id: products.id,
    sku: products.sku,
    name: products.name,
    quantity: products.quantity,
    minQuantity: products.minQuantity,
    costPrice: products.costPrice,
    sellingPrice: products.sellingPrice,
    categoryId: products.categoryId
  }).from(products)
    .where(eq(products.isActive, true))
    .orderBy(products.name);

  const totalValue = await db.select({
    costValue: sql<string>`COALESCE(SUM(quantity * costPrice), 0)`,
    sellValue: sql<string>`COALESCE(SUM(quantity * sellingPrice), 0)`
  }).from(products)
    .where(eq(products.isActive, true));

  return {
    products: inventoryData,
    summary: {
      totalCostValue: parseFloat(totalValue[0]?.costValue || '0'),
      totalSellValue: parseFloat(totalValue[0]?.sellValue || '0'),
      totalProducts: inventoryData.length
    }
  };
}

// ==================== دوال توليد الأرقام ====================
export async function generateInvoiceNumber() {
  const db = await getDb();
  if (!db) return `INV-${Date.now()}`;
  
  const lastInvoice = await db.select({ invoiceNumber: invoices.invoiceNumber })
    .from(invoices)
    .orderBy(desc(invoices.id))
    .limit(1);

  const year = new Date().getFullYear();
  if (lastInvoice.length === 0) {
    return `INV-${year}-0001`;
  }

  const lastNumber = lastInvoice[0].invoiceNumber;
  const parts = lastNumber.split('-');
  const sequence = parseInt(parts[2] || '0') + 1;
  return `INV-${year}-${sequence.toString().padStart(4, '0')}`;
}

export async function generatePurchaseOrderNumber() {
  const db = await getDb();
  if (!db) return `PO-${Date.now()}`;
  
  const lastOrder = await db.select({ orderNumber: purchaseOrders.orderNumber })
    .from(purchaseOrders)
    .orderBy(desc(purchaseOrders.id))
    .limit(1);

  const year = new Date().getFullYear();
  if (lastOrder.length === 0) {
    return `PO-${year}-0001`;
  }

  const lastNumber = lastOrder[0].orderNumber;
  const parts = lastNumber.split('-');
  const sequence = parseInt(parts[2] || '0') + 1;
  return `PO-${year}-${sequence.toString().padStart(4, '0')}`;
}

export async function generateCustomerCode() {
  const db = await getDb();
  if (!db) return `CUS-${Date.now()}`;
  
  const lastCustomer = await db.select({ code: customers.code })
    .from(customers)
    .orderBy(desc(customers.id))
    .limit(1);

  if (lastCustomer.length === 0) {
    return `CUS-0001`;
  }

  const lastCode = lastCustomer[0].code;
  const parts = lastCode.split('-');
  const sequence = parseInt(parts[1] || '0') + 1;
  return `CUS-${sequence.toString().padStart(4, '0')}`;
}

export async function generateSupplierCode() {
  const db = await getDb();
  if (!db) return `SUP-${Date.now()}`;
  
  const lastSupplier = await db.select({ code: suppliers.code })
    .from(suppliers)
    .orderBy(desc(suppliers.id))
    .limit(1);

  if (lastSupplier.length === 0) {
    return `SUP-0001`;
  }

  const lastCode = lastSupplier[0].code;
  const parts = lastCode.split('-');
  const sequence = parseInt(parts[1] || '0') + 1;
  return `SUP-${sequence.toString().padStart(4, '0')}`;
}

export async function generateProductSku() {
  const db = await getDb();
  if (!db) return `PRD-${Date.now()}`;
  
  const lastProduct = await db.select({ sku: products.sku })
    .from(products)
    .orderBy(desc(products.id))
    .limit(1);

  if (lastProduct.length === 0) {
    return `PRD-0001`;
  }

  const lastSku = lastProduct[0].sku;
  const parts = lastSku.split('-');
  const sequence = parseInt(parts[1] || '0') + 1;
  return `PRD-${sequence.toString().padStart(4, '0')}`;
}


// ==================== دوال الفروع ====================
import { 
  branches, InsertBranch,
  employees, InsertEmployee,
  monthlyRecords, InsertMonthlyRecord,
  dailyRevenues, InsertDailyRevenue,
  employeeRevenues, InsertEmployeeRevenue,
  weeklyBonuses, InsertWeeklyBonus,
  bonusDetails, InsertBonusDetail,
  bonusAuditLog, InsertBonusAuditLog,
  systemLogs, InsertSystemLog,
} from "../drizzle/schema";

export async function getBranches() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(branches).orderBy(branches.name);
}

export async function getBranchById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(branches).where(eq(branches.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createBranch(data: InsertBranch) {
  const db = await getDb();
  if (!db) return;
  await db.insert(branches).values(data);
}

export async function updateBranch(id: number, data: Partial<InsertBranch>) {
  const db = await getDb();
  if (!db) return;
  await db.update(branches).set(data).where(eq(branches.id, id));
}

export async function deleteBranch(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(branches).where(eq(branches.id, id));
}

// ==================== دوال الموظفين ====================
export async function getAllEmployees() {
  const db = await getDb();
  if (!db) return [];
  const { branches } = await import('../drizzle/schema');
  return await db.select({
    id: employees.id,
    code: employees.code,
    name: employees.name,
    branchId: employees.branchId,
    branchName: branches.nameAr,
    phone: employees.phone,
    email: employees.email,
    emailVerified: employees.emailVerified,
    position: employees.position,
    username: employees.username,
    hasPortalAccess: employees.hasPortalAccess,
    isSupervisor: employees.isSupervisor,
    photoUrl: employees.photoUrl,
    iqamaNumber: employees.iqamaNumber,
    iqamaExpiryDate: employees.iqamaExpiryDate,
    healthCertExpiryDate: employees.healthCertExpiryDate,
    contractExpiryDate: employees.contractExpiryDate,
    isActive: employees.isActive,
    createdAt: employees.createdAt,
    updatedAt: employees.updatedAt,
  })
    .from(employees)
    .leftJoin(branches, eq(employees.branchId, branches.id))
    .orderBy(employees.name);
}

export async function getEmployeesByBranch(branchId: number) {
  const db = await getDb();
  if (!db) return [];
  const { branches } = await import('../drizzle/schema');
  return await db.select({
    id: employees.id,
    code: employees.code,
    name: employees.name,
    branchId: employees.branchId,
    branchName: branches.nameAr,
    phone: employees.phone,
    email: employees.email,
    emailVerified: employees.emailVerified,
    position: employees.position,
    username: employees.username,
    hasPortalAccess: employees.hasPortalAccess,
    isSupervisor: employees.isSupervisor,
    photoUrl: employees.photoUrl,
    iqamaNumber: employees.iqamaNumber,
    iqamaExpiryDate: employees.iqamaExpiryDate,
    healthCertExpiryDate: employees.healthCertExpiryDate,
    contractExpiryDate: employees.contractExpiryDate,
    isActive: employees.isActive,
    createdAt: employees.createdAt,
    updatedAt: employees.updatedAt,
  })
    .from(employees)
    .leftJoin(branches, eq(employees.branchId, branches.id))
    .where(and(eq(employees.branchId, branchId), eq(employees.isActive, true)))
    .orderBy(employees.name);
}

export async function getEmployeeById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createEmployee(data: InsertEmployee) {
  const db = await getDb();
  if (!db) return;
  await db.insert(employees).values(data);
}

export async function updateEmployee(id: number, data: Partial<InsertEmployee>) {
  const db = await getDb();
  if (!db) return;
  await db.update(employees).set(data).where(eq(employees.id, id));
}

export async function deleteEmployee(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(employees).where(eq(employees.id, id));
}

// ==================== دوال السجلات الشهرية ====================
export async function getMonthlyRecord(branchId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(monthlyRecords)
    .where(and(
      eq(monthlyRecords.branchId, branchId),
      eq(monthlyRecords.year, year),
      eq(monthlyRecords.month, month)
    ))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createMonthlyRecord(data: InsertMonthlyRecord) {
  const db = await getDb();
  if (!db) return;
  await db.insert(monthlyRecords).values(data);
}

// ==================== دوال الإيرادات اليومية ====================
export async function createDailyRevenue(data: InsertDailyRevenue) {
  const db = await getDb();
  if (!db) return null;
  return await db.insert(dailyRevenues).values(data);
}

export async function getDailyRevenuesByDateRange(branchId: number, startDate: string, endDate: string) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(dailyRevenues)
    .where(and(
      eq(dailyRevenues.branchId, branchId),
      gte(dailyRevenues.date, new Date(startDate)),
      lte(dailyRevenues.date, new Date(endDate))
    ))
    .orderBy(desc(dailyRevenues.date));
}

export async function getDailyRevenueByDate(branchId: number, date: Date) {
  const db = await getDb();
  if (!db) return null;
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const result = await db.select().from(dailyRevenues)
    .where(and(
      eq(dailyRevenues.branchId, branchId),
      gte(dailyRevenues.date, startOfDay),
      lte(dailyRevenues.date, endOfDay)
    ))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

// ==================== دوال إيرادات الموظفين ====================
export async function createEmployeeRevenue(data: InsertEmployeeRevenue) {
  const db = await getDb();
  if (!db) return;
  await db.insert(employeeRevenues).values(data);
}

// ==================== دوال البونص الأسبوعي ====================
export async function getWeeklyBonusesByBranch(branchId: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(weeklyBonuses)
    .where(eq(weeklyBonuses.branchId, branchId))
    .orderBy(desc(weeklyBonuses.year), desc(weeklyBonuses.month), desc(weeklyBonuses.weekNumber))
    .limit(limit);
}

export async function getCurrentWeekBonus(branchId: number, year: number, month: number, weekNumber: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(weeklyBonuses)
    .where(and(
      eq(weeklyBonuses.branchId, branchId),
      eq(weeklyBonuses.year, year),
      eq(weeklyBonuses.month, month),
      eq(weeklyBonuses.weekNumber, weekNumber)
    ))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getPendingBonusRequests() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(weeklyBonuses)
    .where(eq(weeklyBonuses.status, "requested"))
    .orderBy(desc(weeklyBonuses.requestedAt));
}

// الحصول على جميع طلبات البونص (للعرض في السجل) - جميع الأسابيع التي تم حسابها
export async function getAllBonusRequests(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  // جلب جميع البونصات التي تم حسابها (كل الحالات)
  return await db.select().from(weeklyBonuses)
    .orderBy(desc(weeklyBonuses.year), desc(weeklyBonuses.month), desc(weeklyBonuses.weekNumber))
    .limit(limit);
}

// إحصائيات البونص
export async function getBonusStats() {
  const db = await getDb();
  if (!db) return {
    totalPaidThisMonth: 0,
    totalPaidThisYear: 0,
    totalPaidAllTime: 0,
    totalBeneficiariesThisMonth: 0,
    totalBeneficiariesThisYear: 0,
    pendingRequestsCount: 0,
    approvedNotPaidCount: 0,
    monthlyBreakdown: [] as { month: number; year: number; total: number; count: number }[],
  };

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // جلب جميع البونصات
  const allBonuses = await db.select().from(weeklyBonuses);
  
  // حساب الإحصائيات
  let totalPaidThisMonth = 0;
  let totalPaidThisYear = 0;
  let totalPaidAllTime = 0;
  let pendingRequestsCount = 0;
  let approvedNotPaidCount = 0;
  const monthlyMap = new Map<string, { total: number; count: number }>();

  for (const bonus of allBonuses) {
    const amount = parseFloat(bonus.totalAmount || '0');
    
    // البونصات المصروفة أو الموافق عليها
    if (bonus.status === 'paid' || bonus.status === 'approved') {
      totalPaidAllTime += amount;
      
      if (bonus.year === currentYear) {
        totalPaidThisYear += amount;
        
        if (bonus.month === currentMonth) {
          totalPaidThisMonth += amount;
        }
      }
      
      // تجميع شهري
      const key = `${bonus.year}-${bonus.month}`;
      const existing = monthlyMap.get(key) || { total: 0, count: 0 };
      existing.total += amount;
      existing.count += 1;
      monthlyMap.set(key, existing);
    }
    
    if (bonus.status === 'requested') {
      pendingRequestsCount++;
    }
    
    if (bonus.status === 'approved') {
      approvedNotPaidCount++;
    }
  }

  // حساب عدد المستفيدين
  const thisMonthBonusIds = allBonuses
    .filter(b => b.year === currentYear && b.month === currentMonth && (b.status === 'paid' || b.status === 'approved'))
    .map(b => b.id);
  
  const thisYearBonusIds = allBonuses
    .filter(b => b.year === currentYear && (b.status === 'paid' || b.status === 'approved'))
    .map(b => b.id);

  let totalBeneficiariesThisMonth = 0;
  let totalBeneficiariesThisYear = 0;

  if (thisMonthBonusIds.length > 0) {
    const monthDetails = await db.select()
      .from(bonusDetails)
      .where(and(
        inArray(bonusDetails.weeklyBonusId, thisMonthBonusIds),
        eq(bonusDetails.isEligible, true)
      ));
    totalBeneficiariesThisMonth = monthDetails.length;
  }

  if (thisYearBonusIds.length > 0) {
    const yearDetails = await db.select()
      .from(bonusDetails)
      .where(and(
        inArray(bonusDetails.weeklyBonusId, thisYearBonusIds),
        eq(bonusDetails.isEligible, true)
      ));
    totalBeneficiariesThisYear = yearDetails.length;
  }

  // تحويل التجميع الشهري إلى مصفوفة
  const monthlyBreakdown = Array.from(monthlyMap.entries())
    .map(([key, value]) => {
      const [year, month] = key.split('-').map(Number);
      return { year, month, ...value };
    })
    .sort((a, b) => b.year - a.year || b.month - a.month)
    .slice(0, 12); // آخر 12 شهر

  return {
    totalPaidThisMonth,
    totalPaidThisYear,
    totalPaidAllTime,
    totalBeneficiariesThisMonth,
    totalBeneficiariesThisYear,
    pendingRequestsCount,
    approvedNotPaidCount,
    monthlyBreakdown,
  };
}

export async function getBonusDetails(weeklyBonusId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select({
    id: bonusDetails.id,
    employeeId: bonusDetails.employeeId,
    employeeName: employees.name,
    employeeCode: employees.code,
    weeklyRevenue: bonusDetails.weeklyRevenue,
    bonusAmount: bonusDetails.bonusAmount,
    bonusTier: bonusDetails.bonusTier,
    isEligible: bonusDetails.isEligible,
  })
    .from(bonusDetails)
    .leftJoin(employees, eq(bonusDetails.employeeId, employees.id))
    .where(eq(bonusDetails.weeklyBonusId, weeklyBonusId))
    .orderBy(desc(bonusDetails.bonusAmount));
}

export async function updateWeeklyBonusStatus(
  id: number,
  status: "pending" | "requested" | "approved" | "rejected",
  userId: number,
  rejectionReason?: string
) {
  const db = await getDb();
  if (!db) return;
  
  const updateData: Partial<InsertWeeklyBonus> = { status };
  
  if (status === "requested") {
    updateData.requestedAt = new Date();
    updateData.requestedBy = userId;
  } else if (status === "approved") {
    updateData.approvedAt = new Date();
    updateData.approvedBy = userId;
  } else if (status === "rejected") {
    updateData.rejectedAt = new Date();
    updateData.rejectedBy = userId;
    updateData.rejectionReason = rejectionReason;
  }
  
  await db.update(weeklyBonuses).set(updateData).where(eq(weeklyBonuses.id, id));
}

// ==================== دوال سجل النظام ====================
export async function createSystemLog(data: Omit<InsertSystemLog, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) return;
  await db.insert(systemLogs).values(data);
}

export async function createBonusAuditLog(data: Omit<InsertBonusAuditLog, "id" | "performedAt">) {
  const db = await getDb();
  if (!db) return;
  await db.insert(bonusAuditLog).values(data);
}


// ==================== دوال طلبات الموظفين ====================
import { employeeRequests, employeeRequestLogs, InsertEmployeeRequest, InsertEmployeeRequestLog } from "../drizzle/schema";

// توليد رقم طلب فريد
export function generateRequestNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `REQ-${year}${month}${day}-${random}`;
}

// إنشاء طلب جديد
export async function createEmployeeRequest(data: Omit<InsertEmployeeRequest, "id" | "createdAt" | "updatedAt" | "requestNumber">) {
  const db = await getDb();
  if (!db) return undefined;
  
  const requestNumber = generateRequestNumber();
  const result = await db.insert(employeeRequests).values({
    ...data,
    requestNumber,
  });
  
  return { requestNumber, insertId: result[0].insertId };
}

// الحصول على جميع الطلبات
export async function getAllEmployeeRequests(filters?: {
  status?: string;
  requestType?: string;
  employeeId?: number;
  branchId?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(employeeRequests);
  
  const conditions = [];
  if (filters?.status) {
    conditions.push(eq(employeeRequests.status, filters.status as "pending" | "approved" | "rejected" | "cancelled"));
  }
  if (filters?.requestType) {
    conditions.push(eq(employeeRequests.requestType, filters.requestType as "advance" | "vacation" | "arrears" | "permission" | "objection" | "resignation"));
  }
  if (filters?.employeeId) {
    conditions.push(eq(employeeRequests.employeeId, filters.employeeId));
  }
  if (filters?.branchId) {
    conditions.push(eq(employeeRequests.branchId, filters.branchId));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }
  
  return await query.orderBy(desc(employeeRequests.createdAt));
}

// الحصول على طلب بواسطة المعرف
export async function getEmployeeRequestById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(employeeRequests)
    .where(eq(employeeRequests.id, id))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

// الحصول على طلبات موظف معين
export async function getEmployeeRequestsByEmployeeId(employeeId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(employeeRequests)
    .where(eq(employeeRequests.employeeId, employeeId))
    .orderBy(desc(employeeRequests.createdAt));
}

// الحصول على الطلبات المعلقة
export async function getPendingEmployeeRequests() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(employeeRequests)
    .where(eq(employeeRequests.status, "pending"))
    .orderBy(desc(employeeRequests.createdAt));
}

// تحديث حالة الطلب
export async function updateEmployeeRequestStatus(
  id: number,
  status: "pending" | "approved" | "rejected" | "cancelled",
  reviewedBy: number,
  reviewedByName: string,
  reviewNotes?: string,
  rejectionReason?: string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: 'Database not available' };
  
  try {
    const updateData: Partial<InsertEmployeeRequest> = {
      status,
      reviewedBy,
      reviewedByName,
      reviewedAt: new Date(),
      reviewNotes,
    };
    
    if (status === "rejected" && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }
    
    await db.update(employeeRequests).set(updateData).where(eq(employeeRequests.id, id));
    return { success: true };
  } catch (error) {
    console.error('Error updating employee request status:', error);
    return { success: false, error: 'Failed to update request status' };
  }
}

// تحديث طلب
export async function updateEmployeeRequest(id: number, data: Partial<InsertEmployeeRequest>) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(employeeRequests).set(data).where(eq(employeeRequests.id, id));
}

// حذف طلب
export async function deleteEmployeeRequest(id: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.delete(employeeRequests).where(eq(employeeRequests.id, id));
}

// إنشاء سجل تدقيق للطلب
export async function createEmployeeRequestLog(data: Omit<InsertEmployeeRequestLog, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(employeeRequestLogs).values(data);
}

// الحصول على سجلات طلب معين
export async function getEmployeeRequestLogs(requestId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(employeeRequestLogs)
    .where(eq(employeeRequestLogs.requestId, requestId))
    .orderBy(desc(employeeRequestLogs.createdAt));
}

// إحصائيات الطلبات
export async function getEmployeeRequestsStats() {
  const db = await getDb();
  if (!db) return { total: 0, pending: 0, approved: 0, rejected: 0 };
  
  const all = await db.select().from(employeeRequests);
  
  return {
    total: all.length,
    pending: all.filter(r => r.status === "pending").length,
    approved: all.filter(r => r.status === "approved").length,
    rejected: all.filter(r => r.status === "rejected").length,
  };
}

// الحصول على طلبات حسب النوع
export async function getEmployeeRequestsByType(requestType: string) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(employeeRequests)
    .where(eq(employeeRequests.requestType, requestType as "advance" | "vacation" | "arrears" | "permission" | "objection" | "resignation"))
    .orderBy(desc(employeeRequests.createdAt));
}


// ==================== دوال مسيرات الرواتب ====================
import {
  payrolls, InsertPayroll,
  payrollDetails, InsertPayrollDetail,
  employeeSalarySettings, InsertEmployeeSalarySetting,
  expenses, InsertExpense,
  expenseLogs, InsertExpenseLog,
} from "../drizzle/schema";

// توليد رقم مسيرة الرواتب
export async function generatePayrollNumber() {
  const db = await getDb();
  if (!db) return `PAY-${Date.now()}`;
  
  const lastPayroll = await db.select({ payrollNumber: payrolls.payrollNumber })
    .from(payrolls)
    .orderBy(desc(payrolls.id))
    .limit(1);

  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  if (lastPayroll.length === 0) {
    return `PAY-${year}${month.toString().padStart(2, '0')}-0001`;
  }

  const lastNumber = lastPayroll[0].payrollNumber;
  const parts = lastNumber.split('-');
  const sequence = parseInt(parts[2] || '0') + 1;
  return `PAY-${year}${month.toString().padStart(2, '0')}-${sequence.toString().padStart(4, '0')}`;
}

// الحصول على جميع مسيرات الرواتب
export async function getAllPayrolls() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(payrolls).orderBy(desc(payrolls.year), desc(payrolls.month));
}

// الحصول على مسيرات رواتب فرع معين
export async function getPayrollsByBranch(branchId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(payrolls)
    .where(eq(payrolls.branchId, branchId))
    .orderBy(desc(payrolls.year), desc(payrolls.month));
}

// الحصول على مسيرة رواتب بالمعرف
export async function getPayrollById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(payrolls).where(eq(payrolls.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// الحصول على مسيرة رواتب لفرع وشهر معين
export async function getPayrollByBranchAndMonth(branchId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(payrolls)
    .where(and(
      eq(payrolls.branchId, branchId),
      eq(payrolls.year, year),
      eq(payrolls.month, month)
    ))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// إنشاء مسيرة رواتب
export async function createPayroll(data: InsertPayroll) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(payrolls).values(data);
  return result;
}

// تحديث مسيرة رواتب
export async function updatePayroll(id: number, data: Partial<InsertPayroll>) {
  const db = await getDb();
  if (!db) return;
  await db.update(payrolls).set(data).where(eq(payrolls.id, id));
}

// حذف مسيرة رواتب
export async function deletePayroll(id: number) {
  const db = await getDb();
  if (!db) return;
  // حذف التفاصيل أولاً
  await db.delete(payrollDetails).where(eq(payrollDetails.payrollId, id));
  await db.delete(payrolls).where(eq(payrolls.id, id));
}

// ==================== دوال تفاصيل الرواتب ====================

// الحصول على تفاصيل مسيرة رواتب
export async function getPayrollDetails(payrollId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(payrollDetails)
    .where(eq(payrollDetails.payrollId, payrollId))
    .orderBy(payrollDetails.employeeName);
}

// إنشاء تفاصيل راتب موظف
export async function createPayrollDetail(data: InsertPayrollDetail) {
  const db = await getDb();
  if (!db) return;
  await db.insert(payrollDetails).values(data);
}

// إنشاء تفاصيل رواتب متعددة
export async function createPayrollDetails(data: InsertPayrollDetail[]) {
  const db = await getDb();
  if (!db) return;
  if (data.length > 0) {
    await db.insert(payrollDetails).values(data);
  }
}

// تحديث تفاصيل راتب
export async function updatePayrollDetail(id: number, data: Partial<InsertPayrollDetail>) {
  const db = await getDb();
  if (!db) return;
  await db.update(payrollDetails).set(data).where(eq(payrollDetails.id, id));
}

// ==================== دوال إعدادات رواتب الموظفين ====================

// الحصول على إعدادات راتب موظف
export async function getEmployeeSalarySetting(employeeId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(employeeSalarySettings)
    .where(eq(employeeSalarySettings.employeeId, employeeId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// الحصول على جميع إعدادات الرواتب
export async function getAllEmployeeSalarySettings() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(employeeSalarySettings);
}

// إنشاء أو تحديث إعدادات راتب موظف
export async function upsertEmployeeSalarySetting(data: InsertEmployeeSalarySetting) {
  const db = await getDb();
  if (!db) return;
  
  const existing = await getEmployeeSalarySetting(data.employeeId);
  if (existing) {
    await db.update(employeeSalarySettings)
      .set(data)
      .where(eq(employeeSalarySettings.employeeId, data.employeeId));
  } else {
    await db.insert(employeeSalarySettings).values(data);
  }
}

// حذف إعدادات راتب موظف
export async function deleteEmployeeSalarySetting(employeeId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(employeeSalarySettings).where(eq(employeeSalarySettings.employeeId, employeeId));
}

// ==================== دوال المصاريف ====================

// توليد رقم المصروف
export async function generateExpenseNumber() {
  const db = await getDb();
  if (!db) return `EXP-${Date.now()}`;
  
  const lastExpense = await db.select({ expenseNumber: expenses.expenseNumber })
    .from(expenses)
    .orderBy(desc(expenses.id))
    .limit(1);

  const year = new Date().getFullYear();
  if (lastExpense.length === 0) {
    return `EXP-${year}-0001`;
  }

  const lastNumber = lastExpense[0].expenseNumber;
  const parts = lastNumber.split('-');
  const sequence = parseInt(parts[2] || '0') + 1;
  return `EXP-${year}-${sequence.toString().padStart(4, '0')}`;
}

// الحصول على جميع المصاريف
export async function getAllExpenses() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(expenses).orderBy(desc(expenses.expenseDate));
}

// الحصول على المصاريف حسب الفترة
export async function getExpensesByDateRange(startDate: string, endDate: string) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(expenses)
    .where(and(
      gte(expenses.expenseDate, new Date(startDate)),
      lte(expenses.expenseDate, new Date(endDate))
    ))
    .orderBy(desc(expenses.expenseDate));
}

// الحصول على المصاريف حسب الفرع
export async function getExpensesByBranch(branchId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(expenses)
    .where(eq(expenses.branchId, branchId))
    .orderBy(desc(expenses.expenseDate));
}

// الحصول على المصاريف حسب التصنيف
export async function getExpensesByCategory(category: string) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(expenses)
    .where(eq(expenses.category, category as "shop_supplies" | "printing" | "carpet_cleaning" | "small_needs" | "residency" | "medical_exam" | "transportation" | "electricity" | "internet" | "license_renewal" | "visa" | "residency_renewal" | "health_cert_renewal" | "maintenance" | "health_cert" | "violation" | "emergency" | "shop_rent" | "housing_rent" | "improvements" | "bonus" | "other"))
    .orderBy(desc(expenses.expenseDate));
}

// الحصول على مصروف بالمعرف
export async function getExpenseById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// إنشاء مصروف
export async function createExpense(data: InsertExpense) {
  const db = await getDb();
  if (!db) return null;
  return await db.insert(expenses).values(data);
}

// تحديث مصروف
export async function updateExpense(id: number, data: Partial<InsertExpense>) {
  const db = await getDb();
  if (!db) return;
  await db.update(expenses).set(data).where(eq(expenses.id, id));
}

// حذف مصروف
export async function deleteExpense(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(expenseLogs).where(eq(expenseLogs.expenseId, id));
  await db.delete(expenses).where(eq(expenses.id, id));
}

// تحديث حالة المصروف
export async function updateExpenseStatus(
  id: number,
  status: "pending" | "approved" | "rejected" | "paid",
  approvedBy: number,
  approvedByName: string,
  rejectionReason?: string
) {
  const db = await getDb();
  if (!db) return;
  
  const updateData: Partial<InsertExpense> = { status };
  
  if (status === "approved" || status === "paid") {
    updateData.approvedBy = approvedBy;
    updateData.approvedByName = approvedByName;
    updateData.approvedAt = new Date();
  } else if (status === "rejected") {
    updateData.approvedBy = approvedBy;
    updateData.approvedByName = approvedByName;
    updateData.rejectionReason = rejectionReason;
  }
  
  await db.update(expenses).set(updateData).where(eq(expenses.id, id));
}

// إنشاء سجل مصروف
export async function createExpenseLog(data: Omit<InsertExpenseLog, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) return;
  await db.insert(expenseLogs).values(data);
}

// الحصول على سجلات مصروف
export async function getExpenseLogs(expenseId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(expenseLogs)
    .where(eq(expenseLogs.expenseId, expenseId))
    .orderBy(desc(expenseLogs.createdAt));
}

// إحصائيات المصاريف
export async function getExpensesStats(startDate?: string, endDate?: string) {
  const db = await getDb();
  if (!db) return { total: 0, pending: 0, approved: 0, paid: 0, totalAmount: 0 };
  
  let query = db.select().from(expenses);
  
  if (startDate && endDate) {
    query = query.where(and(
      gte(expenses.expenseDate, new Date(startDate)),
      lte(expenses.expenseDate, new Date(endDate))
    )) as typeof query;
  }
  
  const all = await query;
  
  const totalAmount = all
    .filter(e => e.status === "approved" || e.status === "paid")
    .reduce((sum, e) => sum + parseFloat(e.amount), 0);
  
  return {
    total: all.length,
    pending: all.filter(e => e.status === "pending").length,
    approved: all.filter(e => e.status === "approved").length,
    paid: all.filter(e => e.status === "paid").length,
    totalAmount,
  };
}

// الحصول على المصاريف المعلقة
export async function getPendingExpenses() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(expenses)
    .where(eq(expenses.status, "pending"))
    .orderBy(desc(expenses.createdAt));
}

// ==================== دوال حساب الرواتب ====================

// حساب راتب موظف (محدث مع أيام العمل)
export function calculateEmployeeSalary(
  baseSalary: number,
  overtimeEnabled: boolean,
  overtimeRate: number,
  workDays: number,
  incentiveAmount: number,
  deductions: number,
  advanceDeduction: number
) {
  // الساعات الإضافية (1000 إذا مفعل)
  const overtime = overtimeEnabled ? overtimeRate : 0;
  
  // حساب الراتب اليومي (الأساسي + الساعات الإضافية) / 30
  const dailyRate = (baseSalary + overtime) / 30;
  
  // حساب خصم الغياب (إذا أقل من 30 يوم)
  const absentDays = 30 - workDays;
  const absentDeduction = absentDays > 0 ? dailyRate * absentDays : 0;
  
  // إجمالي الراتب قبل الخصومات
  const grossSalary = baseSalary + overtime + incentiveAmount;
  
  // إجمالي الخصومات
  const totalDeductions = deductions + advanceDeduction + absentDeduction;
  
  // صافي الراتب
  const netSalary = grossSalary - totalDeductions;
  
  return {
    baseSalary,
    overtimeAmount: overtime,
    workDays,
    absentDays,
    absentDeduction,
    incentiveAmount,
    grossSalary,
    totalDeductions,
    netSalary,
  };
}

// إنشاء مسيرة رواتب شهرية لفرع
export async function generateMonthlyPayroll(
  branchId: number,
  branchName: string,
  year: number,
  month: number,
  createdBy: number,
  createdByName: string
) {
  const db = await getDb();
  if (!db) return null;
  
  // التحقق من عدم وجود مسيرة سابقة
  const existing = await getPayrollByBranchAndMonth(branchId, year, month);
  if (existing) {
    throw new Error("توجد مسيرة رواتب لهذا الشهر بالفعل");
  }
  
  // الحصول على موظفي الفرع
  const branchEmployees = await getEmployeesByBranch(branchId);
  if (branchEmployees.length === 0) {
    throw new Error("لا يوجد موظفين في هذا الفرع");
  }
  
  // الحصول على إعدادات الرواتب
  const salarySettings = await getAllEmployeeSalarySettings();
  const settingsMap = new Map(salarySettings.map(s => [s.employeeId, s]));
  
  // الحصول على السلف الموافق عليها لهذا الشهر
  const approvedAdvances = await db.select().from(employeeRequests)
    .where(and(
      eq(employeeRequests.requestType, "advance"),
      eq(employeeRequests.status, "approved")
    ));
  
  const advancesMap = new Map<number, number>();
  approvedAdvances.forEach(adv => {
    const current = advancesMap.get(adv.employeeId) || 0;
    advancesMap.set(adv.employeeId, current + parseFloat(adv.advanceAmount || "0"));
  });
  
  // حساب الرواتب
  const payrollNumber = await generatePayrollNumber();
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0);
  
  let totalBaseSalary = 0;
  let totalOvertime = 0;
  let totalIncentives = 0;
  let totalDeductions = 0;
  let totalNetSalary = 0;
  
  const details: InsertPayrollDetail[] = [];
  
  for (const emp of branchEmployees) {
    const settings = settingsMap.get(emp.id) || {
      baseSalary: "2000.00",
      overtimeEnabled: false,
      overtimeRate: "1000.00",
      isSupervisor: false,
      supervisorIncentive: "400.00",
      fixedDeduction: "0.00",
    };
    
    const advanceDeduction = advancesMap.get(emp.id) || 0;
    
    // حساب الحوافز (للمشرف 400)
    const incentive = settings.isSupervisor ? parseFloat(settings.supervisorIncentive as string) : 0;
    
    const salary = calculateEmployeeSalary(
      parseFloat(settings.baseSalary as string),
      settings.overtimeEnabled as boolean,
      parseFloat(settings.overtimeRate as string),
      30, // أيام العمل الافتراضية
      incentive,
      parseFloat(settings.fixedDeduction as string),
      advanceDeduction
    );
    
    totalBaseSalary += salary.baseSalary;
    totalOvertime += salary.overtimeAmount;
    totalIncentives += salary.incentiveAmount;
    totalDeductions += salary.totalDeductions;
    totalNetSalary += salary.netSalary;
    
    details.push({
      payrollId: 0, // سيتم تحديثه بعد إنشاء المسيرة
      employeeId: emp.id,
      employeeName: emp.name,
      employeeCode: emp.code,
      position: emp.position,
      baseSalary: salary.baseSalary.toFixed(2),
      overtimeAmount: salary.overtimeAmount.toFixed(2),
      overtimeEnabled: settings.overtimeEnabled as boolean,
      incentiveAmount: salary.incentiveAmount.toFixed(2),
      isSupervisor: settings.isSupervisor as boolean,
      deductionAmount: parseFloat(settings.fixedDeduction as string).toFixed(2),
      advanceDeduction: advanceDeduction.toFixed(2),
      grossSalary: salary.grossSalary.toFixed(2),
      totalDeductions: salary.totalDeductions.toFixed(2),
      netSalary: salary.netSalary.toFixed(2),
    });
  }
  
  // إنشاء المسيرة
  await db.insert(payrolls).values({
    payrollNumber,
    branchId,
    branchName,
    year,
    month,
    periodStart,
    periodEnd,
    totalBaseSalary: totalBaseSalary.toFixed(2),
    totalOvertime: totalOvertime.toFixed(2),
    totalIncentives: totalIncentives.toFixed(2),
    totalDeductions: totalDeductions.toFixed(2),
    totalNetSalary: totalNetSalary.toFixed(2),
    employeeCount: branchEmployees.length,
    status: "draft",
    createdBy,
    createdByName,
  });
  
  // الحصول على معرف المسيرة
  const newPayroll = await getPayrollByBranchAndMonth(branchId, year, month);
  if (!newPayroll) {
    throw new Error("فشل في إنشاء مسيرة الرواتب");
  }
  
  // إضافة التفاصيل
  const detailsWithPayrollId = details.map(d => ({ ...d, payrollId: newPayroll.id }));
  await createPayrollDetails(detailsWithPayrollId);
  
  return newPayroll;
}

// إنشاء مسيرة رواتب مع التفاصيل (النموذج الجديد)
export async function createPayrollWithDetails(
  branchId: number,
  branchName: string,
  year: number,
  month: number,
  totalBaseSalary: number,
  totalOvertime: number,
  totalIncentives: number,
  totalDeductions: number,
  totalNetSalary: number,
  employeeCount: number,
  details: any[],
  createdBy: number,
  createdByName: string
) {
  const db = await getDb();
  if (!db) return null;
  
  // التحقق من عدم وجود مسيرة سابقة
  const existing = await getPayrollByBranchAndMonth(branchId, year, month);
  if (existing) {
    throw new Error("توجد مسيرة رواتب لهذا الشهر بالفعل");
  }
  
  // إنشاء رقم المسيرة
  const payrollNumber = await generatePayrollNumber();
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0);
  
  // إنشاء المسيرة بحالة "تحت الإجراء"
  await db.insert(payrolls).values({
    payrollNumber,
    branchId,
    branchName,
    year,
    month,
    periodStart,
    periodEnd,
    totalBaseSalary: totalBaseSalary.toFixed(2),
    totalOvertime: totalOvertime.toFixed(2),
    totalIncentives: totalIncentives.toFixed(2),
    totalDeductions: totalDeductions.toFixed(2),
    totalNetSalary: totalNetSalary.toFixed(2),
    employeeCount,
    status: "pending", // تحت الإجراء لحين الموافقة
    createdBy,
    createdByName,
  });
  
  // الحصول على معرف المسيرة
  const newPayroll = await getPayrollByBranchAndMonth(branchId, year, month);
  if (!newPayroll) {
    throw new Error("فشل في إنشاء مسيرة الرواتب");
  }
  
  // جلب الإجازات المعتمدة لجميع موظفي الفرع
  const branchLeaves = await getApprovedLeavesForBranch(branchId, year, month);
  
  // جلب الفواتير السالبة للموظفين في هذا الشهر
  const negativeInvoices = await getNegativeInvoicesForMonth(branchId, year, month);
  
  // إضافة التفاصيل مع الإجازات والفواتير السالبة
  const detailsWithPayrollId = details.map(d => {
    const empLeaves = branchLeaves.get(d.employeeId);
    const empNegativeInvoices = negativeInvoices.get(d.employeeId);
    let leaveDays = 0;
    let leaveDeduction = 0;
    let leaveType = '';
    let leaveDetails = '';
    
    if (empLeaves && empLeaves.totalDays > 0) {
      leaveDays = empLeaves.totalDays;
      // حساب الخصم لكل إجازة
      const baseSalaryNum = parseFloat(d.baseSalary) || 2000;
      for (const leave of empLeaves.leaves) {
        leaveDeduction += calculateLeaveDeduction(baseSalaryNum, leave.days, leave.type, d.workDays || 30);
      }
      // تجميع أنواع الإجازات
      const types = Array.from(new Set(empLeaves.leaves.map(l => l.type)));
      leaveType = types.join('، ');
      leaveDetails = JSON.stringify(empLeaves.leaves);
    }
    
    // حساب خصم الفواتير السالبة
    // ملاحظة: الفواتير السالبة موجودة بالفعل في d.negativeInvoicesDeduction من الواجهة
    // لذلك نستخدمها فقط لتحديث التفاصيل وليس لإعادة الحساب
    let negativeInvoicesDeduction = parseFloat(d.negativeInvoicesDeduction) || 0;
    let negativeInvoicesDetails = '';
    
    if (empNegativeInvoices && empNegativeInvoices.total > 0) {
      // استخدام القيمة المرسلة من الواجهة (لأنها محسوبة بالفعل)
      negativeInvoicesDetails = JSON.stringify(empNegativeInvoices.invoices.map(inv => ({
        invoiceNumber: inv.invoiceNumber,
        amount: inv.amount,
        reason: inv.reason,
        date: inv.invoiceDate,
      })));
    }
    
    // تحديث الخصومات والصافي (فقط الإجازات - الفواتير السالبة محسوبة بالفعل في الواجهة)
    const currentTotalDeductions = parseFloat(d.totalDeductions) || 0;
    const currentNetSalary = parseFloat(d.netSalary) || 0;
    // إضافة خصم الإجازة فقط (الفواتير السالبة موجودة بالفعل في currentTotalDeductions)
    const newTotalDeductions = currentTotalDeductions + leaveDeduction;
    const newNetSalary = currentNetSalary - leaveDeduction;
    
    return {
      payrollId: newPayroll.id,
      employeeId: d.employeeId,
      employeeName: d.employeeName,
      employeeCode: d.employeeCode,
      position: d.position || '',
      baseSalary: d.baseSalary,
      overtimeEnabled: d.overtimeEnabled,
      overtimeAmount: d.overtimeAmount,
      workDays: d.workDays,
      absentDays: d.absentDays,
      absentDeduction: d.absentDeduction,
      incentiveAmount: d.incentiveAmount,
      deductionAmount: d.deductionAmount,
      advanceDeduction: d.advanceDeduction,
      negativeInvoicesDeduction: negativeInvoicesDeduction.toFixed(2),
      negativeInvoicesDetails: negativeInvoicesDetails || null,
      leaveDays,
      leaveDeduction: leaveDeduction.toFixed(2),
      leaveType: leaveType || null,
      leaveDetails: leaveDetails || null,
      grossSalary: d.grossSalary,
      totalDeductions: newTotalDeductions.toFixed(2),
      netSalary: newNetSalary.toFixed(2),
    };
  });
  
  await createPayrollDetails(detailsWithPayrollId);
  
  return newPayroll;
}

// جلب الفواتير السالبة للموظفين في شهر معين
export async function getNegativeInvoicesForMonth(
  branchId: number,
  year: number,
  month: number
): Promise<Map<number, { total: number; invoices: Array<{ id: number; amount: string; invoiceNumber: string; reason: string | null; invoiceDate: Date }> }>> {
  const db = await getDb();
  const result = new Map<number, { total: number; invoices: Array<{ id: number; amount: string; invoiceNumber: string; reason: string | null; invoiceDate: Date }> }>();
  
  if (!db) return result;
  
  // حساب بداية ونهاية الشهر
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  
  // جلب الفواتير السالبة للفرع في الشهر المحدد
  const invoices = await db.select().from(employeeInvoices)
    .where(and(
      eq(employeeInvoices.branchId, branchId),
      eq(employeeInvoices.type, "negative"),
      gte(employeeInvoices.invoiceDate, startDate),
      lte(employeeInvoices.invoiceDate, endDate)
    ));
  
  // تجميع الفواتير حسب الموظف
  for (const inv of invoices) {
    const existing = result.get(inv.employeeId) || { total: 0, invoices: [] };
    const amount = parseFloat(inv.amount);
    existing.total += amount;
    existing.invoices.push({
      id: inv.id,
      amount: inv.amount,
      invoiceNumber: inv.invoiceNumber,
      reason: inv.reason,
      invoiceDate: inv.invoiceDate,
    });
    result.set(inv.employeeId, existing);
  }
  
  return result;
}

// الحصول على طلبات الموظفين الموافق عليها
export async function getApprovedEmployeeRequests(startDate?: string, endDate?: string) {
  const db = await getDb();
  if (!db) return [];
  
  let conditions = [eq(employeeRequests.status, "approved")];
  
  if (startDate && endDate) {
    conditions.push(gte(employeeRequests.reviewedAt!, new Date(startDate)));
    conditions.push(lte(employeeRequests.reviewedAt!, new Date(endDate)));
  }
  
  return await db.select().from(employeeRequests)
    .where(and(...conditions))
    .orderBy(desc(employeeRequests.reviewedAt));
}

// ==================== دوال إعدادات الشركة ====================
import { companySettings, InsertCompanySetting } from "../drizzle/schema";

export async function getSetting(key: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(companySettings).where(eq(companySettings.key, key)).limit(1);
  return result[0] || null;
}

export async function getAllSettings() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(companySettings).orderBy(companySettings.category, companySettings.key);
}

export async function getSettingsByCategory(category: string) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(companySettings).where(eq(companySettings.category, category));
}

export async function upsertSetting(setting: InsertCompanySetting) {
  const db = await getDb();
  if (!db) return null;
  
  await db.insert(companySettings).values(setting).onDuplicateKeyUpdate({
    set: {
      value: setting.value,
      type: setting.type,
      category: setting.category,
      description: setting.description,
      updatedBy: setting.updatedBy,
    },
  });
  
  return await getSetting(setting.key);
}

export async function deleteSetting(key: string) {
  const db = await getDb();
  if (!db) return false;
  
  await db.delete(companySettings).where(eq(companySettings.key, key));
  return true;
}

// إنشاء الإعدادات الافتراضية
export async function initializeDefaultSettings() {
  const defaultSettings: InsertCompanySetting[] = [
    // معلومات الشركة
    { key: "company_name", value: "شركة ERP", type: "text", category: "company", description: "اسم الشركة" },
    { key: "company_name_en", value: "ERP Company", type: "text", category: "company", description: "اسم الشركة بالإنجليزية" },
    { key: "company_logo", value: "", type: "image", category: "company", description: "شعار الشركة" },
    { key: "company_address", value: "", type: "text", category: "company", description: "عنوان الشركة" },
    { key: "company_phone", value: "", type: "text", category: "company", description: "هاتف الشركة" },
    { key: "company_email", value: "", type: "text", category: "company", description: "بريد الشركة الإلكتروني" },
    { key: "company_website", value: "", type: "text", category: "company", description: "موقع الشركة" },
    { key: "company_tax_number", value: "", type: "text", category: "company", description: "الرقم الضريبي" },
    { key: "company_cr_number", value: "", type: "text", category: "company", description: "رقم السجل التجاري" },
    
    // إعدادات النظام
    { key: "currency", value: "SAR", type: "text", category: "system", description: "العملة الافتراضية" },
    { key: "currency_symbol", value: "ر.س", type: "text", category: "system", description: "رمز العملة" },
    { key: "date_format", value: "yyyy-MM-dd", type: "text", category: "system", description: "تنسيق التاريخ" },
    { key: "timezone", value: "Asia/Riyadh", type: "text", category: "system", description: "المنطقة الزمنية" },
    { key: "language", value: "ar", type: "text", category: "system", description: "اللغة الافتراضية" },
    
    // إعدادات الفواتير
    { key: "invoice_prefix", value: "INV-", type: "text", category: "invoice", description: "بادئة رقم الفاتورة" },
    { key: "invoice_start_number", value: "1000", type: "number", category: "invoice", description: "رقم بداية الفواتير" },
    { key: "invoice_tax_rate", value: "15", type: "number", category: "invoice", description: "نسبة الضريبة %" },
    { key: "invoice_notes", value: "", type: "text", category: "invoice", description: "ملاحظات الفاتورة الافتراضية" },
    { key: "invoice_terms", value: "", type: "text", category: "invoice", description: "شروط وأحكام الفاتورة" },
    
    // إعدادات الرواتب
    { key: "payroll_base_salary", value: "2000", type: "number", category: "payroll", description: "الراتب الأساسي الافتراضي" },
    { key: "payroll_overtime_rate", value: "1000", type: "number", category: "payroll", description: "بدل الساعات الإضافية" },
    { key: "payroll_supervisor_bonus", value: "400", type: "number", category: "payroll", description: "حوافز المشرف" },
    { key: "payroll_day", value: "28", type: "number", category: "payroll", description: "يوم صرف الرواتب" },
    
    // إعدادات المخزون
    { key: "inventory_low_stock_alert", value: "10", type: "number", category: "inventory", description: "حد التنبيه لنفاد المخزون" },
    { key: "inventory_auto_reorder", value: "false", type: "boolean", category: "inventory", description: "إعادة الطلب التلقائي" },
  ];
  
  for (const setting of defaultSettings) {
    const existing = await getSetting(setting.key);
    if (!existing) {
      await upsertSetting(setting);
    }
  }
}


// ==================== دوال مؤشرات الأداء المالي (KPIs) ====================
import { 
  financialKpis, InsertFinancialKpi,
  loginAttempts, InsertLoginAttempt,
  securityAlerts, InsertSecurityAlert,
  priceChangeLogs, InsertPriceChangeLog,
  productBatches, InsertProductBatch,
  inventoryCounts, InsertInventoryCount,
  inventoryCountItems, InsertInventoryCountItem,
  permissions, InsertPermission,
  userPermissions, InsertUserPermission,
  suggestedPurchaseOrders, InsertSuggestedPurchaseOrder,
} from "../drizzle/schema";

// حساب مؤشرات الأداء المالي
export async function calculateFinancialKPIs(startDate: Date, endDate: Date, branchId?: number) {
  const db = await getDb();
  if (!db) return null;

  // الحصول على إجمالي المبيعات
  const invoicesData = await db.select({
    total: sql<string>`COALESCE(SUM(${invoices.total}), 0)`,
    count: sql<number>`COUNT(*)`,
  }).from(invoices).where(
    and(
      gte(invoices.invoiceDate, startDate),
      lte(invoices.invoiceDate, endDate),
      eq(invoices.status, 'paid')
    )
  );

  // الحصول على تكلفة البضاعة المباعة
  const costData = await db.select({
    totalCost: sql<string>`COALESCE(SUM(${invoiceItems.quantity} * p.costPrice), 0)`,
  }).from(invoiceItems)
    .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
    .innerJoin(products, eq(invoiceItems.productId, products.id))
    .where(
      and(
        gte(invoices.invoiceDate, startDate),
        lte(invoices.invoiceDate, endDate),
        eq(invoices.status, 'paid')
      )
    );

  // الحصول على إجمالي المصاريف (جميع الحالات في الفترة)
  const expensesData = await db.select({
    total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
  }).from(expenses).where(
    and(
      gte(expenses.expenseDate, startDate),
      lte(expenses.expenseDate, endDate)
    )
  );

  // الحصول على عدد العملاء الفريدين
  const customersData = await db.select({
    count: sql<number>`COUNT(DISTINCT ${invoices.customerId})`,
  }).from(invoices).where(
    and(
      gte(invoices.invoiceDate, startDate),
      lte(invoices.invoiceDate, endDate)
    )
  );

  const totalRevenue = parseFloat(invoicesData[0]?.total || '0');
  const totalCost = parseFloat(costData[0]?.totalCost || '0');
  const totalExpenses = parseFloat(expensesData[0]?.total || '0');
  const invoiceCount = invoicesData[0]?.count || 0;
  const customerCount = customersData[0]?.count || 0;

  const grossProfit = totalRevenue - totalCost;
  const netProfit = grossProfit - totalExpenses;
  const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const netProfitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const averageOrderValue = invoiceCount > 0 ? totalRevenue / invoiceCount : 0;

  // حساب العائد على الاستثمار (ROI) - نسبة مبسطة
  const totalInvestment = totalCost + totalExpenses;
  const roi = totalInvestment > 0 ? ((netProfit / totalInvestment) * 100) : 0;

  // نسبة السيولة - نسبة الأصول المتداولة إلى الخصوم المتداولة (مبسطة)
  const currentRatio = totalExpenses > 0 ? totalRevenue / totalExpenses : 0;

  return {
    totalRevenue,
    totalCost,
    totalExpenses,
    grossProfit,
    netProfit,
    grossProfitMargin: parseFloat(grossProfitMargin.toFixed(4)),
    netProfitMargin: parseFloat(netProfitMargin.toFixed(4)),
    roi: parseFloat(roi.toFixed(4)),
    currentRatio: parseFloat(currentRatio.toFixed(4)),
    invoiceCount,
    customerCount,
    averageOrderValue: parseFloat(averageOrderValue.toFixed(2)),
  };
}

// حفظ مؤشرات الأداء المالي
export async function saveFinancialKPI(data: Omit<InsertFinancialKpi, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) return null;
  return await db.insert(financialKpis).values(data);
}

// الحصول على مؤشرات الأداء المالي
export async function getFinancialKPIs(periodType: string, limit: number = 12) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(financialKpis)
    .where(eq(financialKpis.periodType, periodType as any))
    .orderBy(desc(financialKpis.periodEnd))
    .limit(limit);
}

// ==================== دوال محاولات تسجيل الدخول ====================

// تسجيل محاولة دخول
export async function createLoginAttempt(data: Omit<InsertLoginAttempt, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) return null;
  return await db.insert(loginAttempts).values(data);
}

// الحصول على محاولات الدخول الفاشلة الأخيرة لمستخدم
export async function getRecentFailedLoginAttempts(username: string, minutes: number = 30) {
  const db = await getDb();
  if (!db) return [];
  
  const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
  return await db.select().from(loginAttempts)
    .where(and(
      eq(loginAttempts.username, username),
      eq(loginAttempts.success, false),
      gte(loginAttempts.createdAt, cutoffTime)
    ))
    .orderBy(desc(loginAttempts.createdAt));
}

// الحصول على جميع محاولات الدخول
export async function getAllLoginAttempts(limit: number = 100) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(loginAttempts)
    .orderBy(desc(loginAttempts.createdAt))
    .limit(limit);
}

// ==================== دوال تنبيهات الأمان ====================

// إنشاء تنبيه أمان
export async function createSecurityAlert(data: Omit<InsertSecurityAlert, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) return null;
  return await db.insert(securityAlerts).values(data);
}

// الحصول على التنبيهات غير المقروءة
export async function getUnreadSecurityAlerts() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(securityAlerts)
    .where(eq(securityAlerts.isRead, false))
    .orderBy(desc(securityAlerts.createdAt));
}

// الحصول على جميع التنبيهات
export async function getAllSecurityAlerts(limit: number = 100) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(securityAlerts)
    .orderBy(desc(securityAlerts.createdAt))
    .limit(limit);
}

// تحديث حالة التنبيه
export async function updateSecurityAlert(id: number, data: { isRead?: boolean; isResolved?: boolean; resolvedBy?: number }) {
  const db = await getDb();
  if (!db) return;
  const updateData: any = { ...data };
  if (data.isResolved) {
    updateData.resolvedAt = new Date();
  }
  await db.update(securityAlerts).set(updateData).where(eq(securityAlerts.id, id));
}

// ==================== دوال سجل تغييرات الأسعار ====================

// تسجيل تغيير سعر
export async function createPriceChangeLog(data: Omit<InsertPriceChangeLog, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) return null;
  return await db.insert(priceChangeLogs).values(data);
}

// الحصول على سجل تغييرات الأسعار لمنتج
export async function getPriceChangeLogsByProduct(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(priceChangeLogs)
    .where(eq(priceChangeLogs.productId, productId))
    .orderBy(desc(priceChangeLogs.createdAt));
}

// الحصول على جميع تغييرات الأسعار
export async function getAllPriceChangeLogs(limit: number = 100) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(priceChangeLogs)
    .orderBy(desc(priceChangeLogs.createdAt))
    .limit(limit);
}

// الحصول على تغييرات الأسعار الكبيرة (أكثر من نسبة معينة)
export async function getLargePriceChanges(minPercentage: number = 20) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(priceChangeLogs)
    .where(sql`ABS(${priceChangeLogs.changePercentage}) >= ${minPercentage}`)
    .orderBy(desc(priceChangeLogs.createdAt));
}

// ==================== دوال تتبع الدفعات (Batch Tracking) ====================

// إنشاء دفعة جديدة
export async function createProductBatch(data: Omit<InsertProductBatch, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) return null;
  return await db.insert(productBatches).values({
    ...data,
    remainingQuantity: data.quantity,
  });
}

// الحصول على دفعات منتج
export async function getProductBatches(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(productBatches)
    .where(eq(productBatches.productId, productId))
    .orderBy(productBatches.expiryDate);
}

// الحصول على الدفعات النشطة (FIFO)
export async function getActiveBatchesFIFO(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(productBatches)
    .where(and(
      eq(productBatches.productId, productId),
      eq(productBatches.status, 'active'),
      sql`${productBatches.remainingQuantity} > 0`
    ))
    .orderBy(productBatches.receivedDate);
}

// الحصول على المنتجات قريبة الانتهاء
export async function getExpiringProducts(daysAhead: number = 30) {
  const db = await getDb();
  if (!db) return [];
  
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  
  return await db.select().from(productBatches)
    .where(and(
      eq(productBatches.status, 'active'),
      sql`${productBatches.remainingQuantity} > 0`,
      lte(productBatches.expiryDate!, futureDate),
      gte(productBatches.expiryDate!, new Date())
    ))
    .orderBy(productBatches.expiryDate);
}

// تحديث كمية الدفعة
export async function updateBatchQuantity(batchId: number, quantityUsed: number) {
  const db = await getDb();
  if (!db) return;
  
  const batch = await db.select().from(productBatches).where(eq(productBatches.id, batchId)).limit(1);
  if (batch.length === 0) return;
  
  const newQuantity = batch[0].remainingQuantity - quantityUsed;
  const status = newQuantity <= 0 ? 'depleted' : 'active';
  
  await db.update(productBatches).set({
    remainingQuantity: Math.max(0, newQuantity),
    status,
  }).where(eq(productBatches.id, batchId));
}

// ==================== دوال الجرد الدوري ====================

// توليد رقم الجرد
export async function generateInventoryCountNumber() {
  const db = await getDb();
  if (!db) return `CNT-${Date.now()}`;
  
  const lastCount = await db.select({ countNumber: inventoryCounts.countNumber })
    .from(inventoryCounts)
    .orderBy(desc(inventoryCounts.id))
    .limit(1);

  const year = new Date().getFullYear();
  if (lastCount.length === 0) {
    return `CNT-${year}-0001`;
  }

  const lastNumber = lastCount[0].countNumber;
  const parts = lastNumber.split('-');
  const sequence = parseInt(parts[2] || '0') + 1;
  return `CNT-${year}-${sequence.toString().padStart(4, '0')}`;
}

// إنشاء جرد جديد
export async function createInventoryCount(data: Omit<InsertInventoryCount, "id" | "createdAt" | "updatedAt" | "countNumber">) {
  const db = await getDb();
  if (!db) return null;
  
  const countNumber = await generateInventoryCountNumber();
  return await db.insert(inventoryCounts).values({
    ...data,
    countNumber,
  });
}

// الحصول على جميع عمليات الجرد
export async function getAllInventoryCounts() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(inventoryCounts)
    .orderBy(desc(inventoryCounts.countDate));
}

// الحصول على جرد بالمعرف
export async function getInventoryCountById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(inventoryCounts).where(eq(inventoryCounts.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// إضافة عنصر للجرد
export async function addInventoryCountItem(data: Omit<InsertInventoryCountItem, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) return null;
  
  const variance = (data.countedQuantity || 0) - (data.systemQuantity || 0);
  const varianceValue = variance * parseFloat(data.unitCost as string);
  
  return await db.insert(inventoryCountItems).values({
    ...data,
    variance,
    varianceValue: varianceValue.toFixed(2),
  });
}

// الحصول على عناصر الجرد
export async function getInventoryCountItems(countId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(inventoryCountItems)
    .where(eq(inventoryCountItems.countId, countId));
}

// تحديث حالة الجرد
export async function updateInventoryCount(id: number, data: Partial<InsertInventoryCount>) {
  const db = await getDb();
  if (!db) return;
  await db.update(inventoryCounts).set(data).where(eq(inventoryCounts.id, id));
}

// حساب إحصائيات الجرد
export async function calculateInventoryCountStats(countId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const items = await getInventoryCountItems(countId);
  
  let totalProducts = items.length;
  let matchedProducts = 0;
  let discrepancyProducts = 0;
  let totalSystemValue = 0;
  let totalCountedValue = 0;
  
  for (const item of items) {
    const unitCost = parseFloat(item.unitCost as string);
    totalSystemValue += item.systemQuantity * unitCost;
    totalCountedValue += item.countedQuantity * unitCost;
    
    if (item.variance === 0) {
      matchedProducts++;
    } else {
      discrepancyProducts++;
    }
  }
  
  const varianceValue = totalCountedValue - totalSystemValue;
  
  await updateInventoryCount(countId, {
    totalProducts,
    matchedProducts,
    discrepancyProducts,
    totalSystemValue: totalSystemValue.toFixed(2),
    totalCountedValue: totalCountedValue.toFixed(2),
    varianceValue: varianceValue.toFixed(2),
  });
  
  return {
    totalProducts,
    matchedProducts,
    discrepancyProducts,
    totalSystemValue,
    totalCountedValue,
    varianceValue,
  };
}

// ==================== دوال الصلاحيات التفصيلية ====================

// إنشاء صلاحية
export async function createPermission(data: Omit<InsertPermission, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) return null;
  return await db.insert(permissions).values(data);
}

// الحصول على جميع الصلاحيات
export async function getAllPermissions() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(permissions).orderBy(permissions.category, permissions.code);
}

// الحصول على صلاحيات مستخدم
export async function getUserPermissions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select({
    id: userPermissions.id,
    permissionId: userPermissions.permissionId,
    code: permissions.code,
    name: permissions.name,
    nameAr: permissions.nameAr,
    category: permissions.category,
    grantedAt: userPermissions.grantedAt,
  }).from(userPermissions)
    .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
    .where(eq(userPermissions.userId, userId));
}

// منح صلاحية لمستخدم
export async function grantPermission(userId: number, permissionId: number, grantedBy: number) {
  const db = await getDb();
  if (!db) return null;
  
  // التحقق من عدم وجود الصلاحية مسبقاً
  const existing = await db.select().from(userPermissions)
    .where(and(
      eq(userPermissions.userId, userId),
      eq(userPermissions.permissionId, permissionId)
    )).limit(1);
  
  if (existing.length > 0) return existing[0];
  
  return await db.insert(userPermissions).values({
    userId,
    permissionId,
    grantedBy,
  });
}

// إلغاء صلاحية من مستخدم
export async function revokePermission(userId: number, permissionId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(userPermissions).where(and(
    eq(userPermissions.userId, userId),
    eq(userPermissions.permissionId, permissionId)
  ));
}

// التحقق من صلاحية مستخدم
export async function hasPermission(userId: number, permissionCode: string) {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db.select().from(userPermissions)
    .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
    .where(and(
      eq(userPermissions.userId, userId),
      eq(permissions.code, permissionCode)
    )).limit(1);
  
  return result.length > 0;
}

// إنشاء الصلاحيات الافتراضية
export async function initializeDefaultPermissions() {
  const defaultPermissions: Omit<InsertPermission, "id" | "createdAt">[] = [
    // صلاحيات المستخدمين
    { code: "users.read", name: "View Users", nameAr: "عرض المستخدمين", category: "users" },
    { code: "users.create", name: "Create Users", nameAr: "إنشاء مستخدمين", category: "users" },
    { code: "users.update", name: "Update Users", nameAr: "تعديل المستخدمين", category: "users" },
    { code: "users.delete", name: "Delete Users", nameAr: "حذف المستخدمين", category: "users" },
    
    // صلاحيات المنتجات
    { code: "products.read", name: "View Products", nameAr: "عرض المنتجات", category: "products" },
    { code: "products.create", name: "Create Products", nameAr: "إنشاء منتجات", category: "products" },
    { code: "products.update", name: "Update Products", nameAr: "تعديل المنتجات", category: "products" },
    { code: "products.delete", name: "Delete Products", nameAr: "حذف المنتجات", category: "products" },
    { code: "products.price", name: "Change Prices", nameAr: "تغيير الأسعار", category: "products" },
    
    // صلاحيات الفواتير
    { code: "invoices.read", name: "View Invoices", nameAr: "عرض الفواتير", category: "invoices" },
    { code: "invoices.create", name: "Create Invoices", nameAr: "إنشاء فواتير", category: "invoices" },
    { code: "invoices.update", name: "Update Invoices", nameAr: "تعديل الفواتير", category: "invoices" },
    { code: "invoices.void", name: "Void Invoices", nameAr: "إلغاء الفواتير", category: "invoices" },
    
    // صلاحيات المشتريات
    { code: "purchases.read", name: "View Purchases", nameAr: "عرض المشتريات", category: "purchases" },
    { code: "purchases.create", name: "Create Purchases", nameAr: "إنشاء أوامر شراء", category: "purchases" },
    { code: "purchases.approve", name: "Approve Purchases", nameAr: "الموافقة على المشتريات", category: "purchases" },
    
    // صلاحيات التقارير
    { code: "reports.sales", name: "View Sales Reports", nameAr: "عرض تقارير المبيعات", category: "reports" },
    { code: "reports.financial", name: "View Financial Reports", nameAr: "عرض التقارير المالية", category: "reports" },
    { code: "reports.inventory", name: "View Inventory Reports", nameAr: "عرض تقارير المخزون", category: "reports" },
    { code: "reports.audit", name: "View Audit Reports", nameAr: "عرض تقارير التدقيق", category: "reports" },
    
    // صلاحيات الإعدادات
    { code: "settings.read", name: "View Settings", nameAr: "عرض الإعدادات", category: "settings" },
    { code: "settings.manage", name: "Manage Settings", nameAr: "إدارة الإعدادات", category: "settings" },
    
    // صلاحيات الأمان
    { code: "security.alerts", name: "View Security Alerts", nameAr: "عرض تنبيهات الأمان", category: "security" },
    { code: "security.audit", name: "View Audit Logs", nameAr: "عرض سجلات التدقيق", category: "security" },
  ];
  
  const db = await getDb();
  if (!db) return;
  
  for (const perm of defaultPermissions) {
    const existing = await db.select().from(permissions).where(eq(permissions.code, perm.code)).limit(1);
    if (!existing || existing.length === 0) {
      await createPermission(perm);
    }
  }
}

// ==================== دوال أوامر الشراء المقترحة ====================

// إنشاء اقتراح شراء
export async function createSuggestedPurchaseOrder(data: Omit<InsertSuggestedPurchaseOrder, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) return null;
  return await db.insert(suggestedPurchaseOrders).values(data);
}

// الحصول على اقتراحات الشراء المعلقة
export async function getPendingSuggestedPurchaseOrders() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(suggestedPurchaseOrders)
    .where(eq(suggestedPurchaseOrders.status, 'pending'))
    .orderBy(desc(suggestedPurchaseOrders.createdAt));
}

// تحديث حالة اقتراح الشراء
export async function updateSuggestedPurchaseOrder(id: number, data: Partial<InsertSuggestedPurchaseOrder>) {
  const db = await getDb();
  if (!db) return;
  await db.update(suggestedPurchaseOrders).set(data).where(eq(suggestedPurchaseOrders.id, id));
}

// فحص المنتجات منخفضة المخزون وإنشاء اقتراحات
export async function checkAndCreateReorderSuggestions() {
  const db = await getDb();
  if (!db) return [];
  
  // الحصول على المنتجات منخفضة المخزون
  const lowStockProducts = await getLowStockProducts();
  const suggestions = [];
  
  for (const product of lowStockProducts) {
    // التحقق من عدم وجود اقتراح معلق لهذا المنتج
    const existingSuggestion = await db.select().from(suggestedPurchaseOrders)
      .where(and(
        eq(suggestedPurchaseOrders.productId, product.id),
        eq(suggestedPurchaseOrders.status, 'pending')
      )).limit(1);
    
    if (existingSuggestion.length > 0) continue;
    
    // حساب الكمية المقترحة (ضعف الحد الأدنى)
    const suggestedQuantity = product.minQuantity * 2;
    
    const suggestion = await createSuggestedPurchaseOrder({
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      currentQuantity: product.quantity,
      minQuantity: product.minQuantity,
      suggestedQuantity,
      averageConsumption: '0.00', // يمكن حسابه من سجل المبيعات
      lastPurchasePrice: product.costPrice,
      status: 'pending',
    });
    
    if (suggestion) {
      suggestions.push(suggestion);
    }
  }
  
  return suggestions;
}

// ==================== دوال تقارير التدقيق ====================

// الحصول على ملخص الأنشطة حسب المستخدم
export async function getActivitySummaryByUser(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select({
    userId: activityLogs.userId,
    userName: activityLogs.userName,
    actionCount: sql<number>`COUNT(*)`,
    createCount: sql<number>`SUM(CASE WHEN ${activityLogs.action} = 'create' THEN 1 ELSE 0 END)`,
    updateCount: sql<number>`SUM(CASE WHEN ${activityLogs.action} = 'update' THEN 1 ELSE 0 END)`,
    deleteCount: sql<number>`SUM(CASE WHEN ${activityLogs.action} = 'delete' THEN 1 ELSE 0 END)`,
  }).from(activityLogs)
    .where(and(
      gte(activityLogs.createdAt, startDate),
      lte(activityLogs.createdAt, endDate)
    ))
    .groupBy(activityLogs.userId, activityLogs.userName);
}

// الحصول على العمليات غير المعتادة
export async function getUnusualActivities(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  
  // العمليات غير المعتادة: حذف كثير، تغييرات أسعار كبيرة، إلخ
  const deleteActivities = await db.select().from(activityLogs)
    .where(and(
      eq(activityLogs.action, 'delete'),
      gte(activityLogs.createdAt, startDate),
      lte(activityLogs.createdAt, endDate)
    ))
    .orderBy(desc(activityLogs.createdAt));
  
  const largePriceChanges = await getLargePriceChanges(20);
  
  return {
    deleteActivities,
    largePriceChanges,
  };
}

// تقرير ABC للمخزون
export async function getABCInventoryReport() {
  const db = await getDb();
  if (!db) return { A: [], B: [], C: [] };
  
  // الحصول على المنتجات مع إجمالي المبيعات
  const productSales = await db.select({
    productId: invoiceItems.productId,
    productName: invoiceItems.productName,
    totalSales: sql<string>`SUM(${invoiceItems.total})`,
    totalQuantity: sql<number>`SUM(${invoiceItems.quantity})`,
  }).from(invoiceItems)
    .groupBy(invoiceItems.productId, invoiceItems.productName)
    .orderBy(sql`SUM(${invoiceItems.total}) DESC`);
  
  // حساب إجمالي المبيعات
  const totalSales = productSales.reduce((sum, p) => sum + parseFloat(p.totalSales || '0'), 0);
  
  // تصنيف المنتجات
  const A: typeof productSales = [];
  const B: typeof productSales = [];
  const C: typeof productSales = [];
  
  let cumulativeSales = 0;
  for (const product of productSales) {
    const productTotal = parseFloat(product.totalSales || '0');
    cumulativeSales += productTotal;
    const percentage = (cumulativeSales / totalSales) * 100;
    
    if (percentage <= 80) {
      A.push(product);
    } else if (percentage <= 95) {
      B.push(product);
    } else {
      C.push(product);
    }
  }
  
  return { A, B, C, totalSales };
}

// تحليل الاتجاهات الشهرية
export async function getMonthlyTrends(months: number = 12) {
  const db = await getDb();
  if (!db) return [];
  
  const trends = [];
  const now = new Date();
  
  for (let i = 0; i < months; i++) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    
    const salesData = await db.select({
      total: sql<string>`COALESCE(SUM(${invoices.total}), 0)`,
      count: sql<number>`COUNT(*)`,
    }).from(invoices)
      .where(and(
        gte(invoices.invoiceDate, monthStart),
        lte(invoices.invoiceDate, monthEnd),
        eq(invoices.status, 'paid')
      ));
    
    const expensesData = await db.select({
      total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
    }).from(expenses)
      .where(and(
        gte(expenses.expenseDate, monthStart),
        lte(expenses.expenseDate, monthEnd),
        eq(expenses.status, 'approved')
      ));
    
    trends.push({
      month: monthStart.toISOString().slice(0, 7),
      monthName: monthStart.toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' }),
      sales: parseFloat(salesData[0]?.total || '0'),
      invoiceCount: salesData[0]?.count || 0,
      expenses: parseFloat(expensesData[0]?.total || '0'),
      profit: parseFloat(salesData[0]?.total || '0') - parseFloat(expensesData[0]?.total || '0'),
    });
  }
  
  return trends.reverse();
}


// ==================== دوال التقارير الدورية ====================

// الحصول على أفضل المنتجات مبيعاً
export async function getTopSellingProducts(limit: number = 5, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(invoices.status, 'paid')];
  if (startDate) conditions.push(gte(invoices.createdAt, startDate));
  if (endDate) conditions.push(lte(invoices.createdAt, endDate));
  
  const result = await db.select({
    productId: invoiceItems.productId,
    name: invoiceItems.productName,
    totalQuantity: sql<number>`SUM(${invoiceItems.quantity})`.as('totalQuantity'),
    totalRevenue: sql<number>`SUM(${invoiceItems.total})`.as('totalRevenue'),
  })
    .from(invoiceItems)
    .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
    .where(and(...conditions))
    .groupBy(invoiceItems.productId, invoiceItems.productName)
    .orderBy(desc(sql`SUM(${invoiceItems.total})`))
    .limit(limit);
  
  return result;
}

// الحصول على أفضل العملاء
export async function getTopCustomers(limit: number = 5, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(invoices.status, 'paid')];
  if (startDate) conditions.push(gte(invoices.createdAt, startDate));
  if (endDate) conditions.push(lte(invoices.createdAt, endDate));
  
  const result = await db.select({
    customerId: invoices.customerId,
    name: sql<string>`COALESCE(${customers.name}, ${invoices.customerName}, 'عميل نقدي')`.as('name'),
    invoiceCount: sql<number>`COUNT(${invoices.id})`.as('invoiceCount'),
    totalPurchases: sql<number>`SUM(${invoices.total})`.as('totalPurchases'),
  })
    .from(invoices)
    .leftJoin(customers, eq(invoices.customerId, customers.id))
    .where(and(...conditions))
    .groupBy(invoices.customerId, customers.name, invoices.customerName)
    .orderBy(desc(sql`SUM(${invoices.total})`))
    .limit(limit);
  
  return result;
}

// الحصول على الدفعات قريبة الانتهاء
export async function getExpiringProductBatches(daysAhead: number = 30) {
  const db = await getDb();
  if (!db) return [];
  
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  
  return await db.select().from(productBatches)
    .where(and(
      eq(productBatches.status, 'active'),
      lte(productBatches.expiryDate, futureDate),
      gte(productBatches.expiryDate, new Date())
    ))
    .orderBy(productBatches.expiryDate);
}


// الحصول على بيانات المبيعات اليومية
export async function getDailySalesData(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select({
    date: sql<string>`DATE(${invoices.createdAt})`.as('date'),
    totalSales: sql<number>`SUM(${invoices.total})`.as('totalSales'),
    invoiceCount: sql<number>`COUNT(${invoices.id})`.as('invoiceCount'),
    avgOrderValue: sql<number>`AVG(${invoices.total})`.as('avgOrderValue'),
  })
    .from(invoices)
    .where(and(
      eq(invoices.status, 'paid'),
      gte(invoices.createdAt, startDate),
      lte(invoices.createdAt, endDate)
    ))
    .groupBy(sql`DATE(${invoices.createdAt})`)
    .orderBy(sql`DATE(${invoices.createdAt})`);
  
  return result;
}

// الحصول على المبيعات حسب الفئة
export async function getSalesByCategory(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(invoices.status, 'paid')];
  if (startDate) conditions.push(gte(invoices.createdAt, startDate));
  if (endDate) conditions.push(lte(invoices.createdAt, endDate));
  
  const result = await db.select({
    categoryId: products.categoryId,
    categoryName: categories.name,
    totalSales: sql<number>`SUM(${invoiceItems.total})`.as('totalSales'),
    totalQuantity: sql<number>`SUM(${invoiceItems.quantity})`.as('totalQuantity'),
    productCount: sql<number>`COUNT(DISTINCT ${invoiceItems.productId})`.as('productCount'),
  })
    .from(invoiceItems)
    .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
    .leftJoin(products, eq(invoiceItems.productId, products.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(...conditions))
    .groupBy(products.categoryId, categories.name)
    .orderBy(desc(sql`SUM(${invoiceItems.total})`));
  
  return result;
}


// ==================== دوال الجدولة ومراقب النظام ====================

// إنشاء مهمة مجدولة
export async function createScheduledTask(data: {
  name: string;
  description?: string;
  taskType: string;
  isEnabled?: boolean;
  frequency?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  hour?: number;
  minute?: number;
  recipientEmails?: string;
  thresholdValue?: string;
  thresholdType?: string;
  createdBy?: number;
}) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(scheduledTasks).values({
    name: data.name,
    description: data.description || null,
    taskType: data.taskType as any,
    isEnabled: data.isEnabled ?? true,
    frequency: (data.frequency || 'weekly') as any,
    dayOfWeek: data.dayOfWeek || 0,
    dayOfMonth: data.dayOfMonth || 1,
    hour: data.hour ?? 9,
    minute: data.minute ?? 0,
    recipientEmails: data.recipientEmails || null,
    thresholdValue: data.thresholdValue || null,
    thresholdType: data.thresholdType as any || null,
    createdBy: data.createdBy || null,
  });
  
  return result;
}

// الحصول على جميع المهام المجدولة
export async function getAllScheduledTasks() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(scheduledTasks).orderBy(desc(scheduledTasks.createdAt));
}

// الحصول على المهام النشطة
export async function getActiveScheduledTasks() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(scheduledTasks).where(eq(scheduledTasks.isEnabled, true));
}

// تحديث مهمة مجدولة
export async function updateScheduledTask(id: number, data: Partial<{
  name: string;
  description: string;
  isEnabled: boolean;
  frequency: string;
  dayOfWeek: number;
  dayOfMonth: number;
  hour: number;
  minute: number;
  recipientEmails: string;
  thresholdValue: string;
}>) {
  const db = await getDb();
  if (!db) return null;
  
  return await db.update(scheduledTasks)
    .set(data as any)
    .where(eq(scheduledTasks.id, id));
}

// تحديث آخر تشغيل للمهمة
export async function updateScheduledTaskLastRun(id: number, status: 'success' | 'failed' | 'skipped', message: string) {
  const db = await getDb();
  if (!db) return null;
  
  const updateData: any = {
    lastRunAt: new Date(),
    lastRunStatus: status,
    lastRunMessage: message,
  };
  
  if (status === 'success') {
    updateData.runCount = sql`${scheduledTasks.runCount} + 1`;
  } else if (status === 'failed') {
    updateData.failCount = sql`${scheduledTasks.failCount} + 1`;
  }
  
  return await db.update(scheduledTasks)
    .set(updateData)
    .where(eq(scheduledTasks.id, id));
}

// حذف مهمة مجدولة
export async function deleteScheduledTask(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  return await db.delete(scheduledTasks).where(eq(scheduledTasks.id, id));
}

// إنشاء سجل تنفيذ مهمة
export async function createTaskExecutionLog(data: {
  taskId: number;
  taskName: string;
  taskType: string;
  status: 'running' | 'success' | 'failed' | 'cancelled';
  message?: string;
  errorDetails?: string;
  emailsSent?: number;
  recipientList?: string;
  duration?: number;
  metadata?: string;
}) {
  const db = await getDb();
  if (!db) return null;
  
  return await db.insert(taskExecutionLogs).values({
    taskId: data.taskId,
    taskName: data.taskName,
    taskType: data.taskType,
    status: data.status,
    message: data.message || null,
    errorDetails: data.errorDetails || null,
    emailsSent: data.emailsSent || 0,
    recipientList: data.recipientList || null,
    duration: data.duration || null,
    metadata: data.metadata || null,
  });
}

// الحصول على سجلات التنفيذ
export async function getTaskExecutionLogs(taskId?: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = taskId ? [eq(taskExecutionLogs.taskId, taskId)] : [];
  
  return await db.select()
    .from(taskExecutionLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(taskExecutionLogs.createdAt))
    .limit(limit);
}

// إنشاء تنبيه نظام
export async function createSystemAlert(data: {
  alertType: string;
  severity?: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: number;
  entityName?: string;
  currentValue?: string;
  thresholdValue?: string;
}) {
  const db = await getDb();
  if (!db) return null;
  
  return await db.insert(systemAlerts).values({
    alertType: data.alertType as any,
    severity: (data.severity || 'info') as any,
    title: data.title,
    message: data.message,
    entityType: data.entityType || null,
    entityId: data.entityId || null,
    entityName: data.entityName || null,
    currentValue: data.currentValue || null,
    thresholdValue: data.thresholdValue || null,
  });
}

// الحصول على تنبيهات النظام
export async function getSystemAlerts(filters?: {
  alertType?: string;
  severity?: string;
  isRead?: boolean;
  isResolved?: boolean;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters?.alertType) conditions.push(eq(systemAlerts.alertType, filters.alertType as any));
  if (filters?.severity) conditions.push(eq(systemAlerts.severity, filters.severity as any));
  if (filters?.isRead !== undefined) conditions.push(eq(systemAlerts.isRead, filters.isRead));
  if (filters?.isResolved !== undefined) conditions.push(eq(systemAlerts.isResolved, filters.isResolved));
  
  return await db.select()
    .from(systemAlerts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(systemAlerts.createdAt))
    .limit(filters?.limit || 100);
}

// تحديث حالة التنبيه
export async function updateSystemAlert(id: number, data: {
  isRead?: boolean;
  isResolved?: boolean;
  resolvedBy?: number;
  resolvedNote?: string;
}) {
  const db = await getDb();
  if (!db) return null;
  
  const updateData: any = { ...data };
  if (data.isResolved) {
    updateData.resolvedAt = new Date();
  }
  
  return await db.update(systemAlerts)
    .set(updateData)
    .where(eq(systemAlerts.id, id));
}

// الحصول على إحصائيات التنبيهات
export async function getAlertStats() {
  const db = await getDb();
  if (!db) return { total: 0, unread: 0, critical: 0, warning: 0, info: 0 };
  
  const total = await db.select({ count: sql<number>`COUNT(*)` })
    .from(systemAlerts);
  
  const unread = await db.select({ count: sql<number>`COUNT(*)` })
    .from(systemAlerts)
    .where(eq(systemAlerts.isRead, false));
  
  const critical = await db.select({ count: sql<number>`COUNT(*)` })
    .from(systemAlerts)
    .where(eq(systemAlerts.severity, 'critical'));
  
  const warning = await db.select({ count: sql<number>`COUNT(*)` })
    .from(systemAlerts)
    .where(eq(systemAlerts.severity, 'warning'));
  
  return {
    total: total[0]?.count || 0,
    unread: unread[0]?.count || 0,
    critical: critical[0]?.count || 0,
    warning: warning[0]?.count || 0,
    info: (total[0]?.count || 0) - (critical[0]?.count || 0) - (warning[0]?.count || 0),
  };
}

// إعدادات المراقبة
export async function getMonitorSetting(key: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(monitorSettings)
    .where(eq(monitorSettings.settingKey, key))
    .limit(1);
  
  return result[0] || null;
}

export async function setMonitorSetting(key: string, value: string, type: string = 'string', description?: string, category?: string) {
  const db = await getDb();
  if (!db) return null;
  
  const existing = await getMonitorSetting(key);
  
  if (existing) {
    return await db.update(monitorSettings)
      .set({ settingValue: value })
      .where(eq(monitorSettings.settingKey, key));
  } else {
    return await db.insert(monitorSettings).values({
      settingKey: key,
      settingValue: value,
      settingType: type as any,
      description: description || null,
      category: category || null,
    });
  }
}

export async function getAllMonitorSettings() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(monitorSettings);
}

// ==================== دوال مستلمي الإشعارات ====================

export async function getNotificationRecipients(branchId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  
  if (branchId === undefined || branchId === null) {
    // جلب جميع المستلمين النشطين
    return await db.select().from(notificationRecipients).where(eq(notificationRecipients.isActive, true));
  }
  
  // جلب الأدمن والمشرف العام + مشرف الفرع المحدد
  return await db.select().from(notificationRecipients).where(
    and(
      eq(notificationRecipients.isActive, true),
      or(
        eq(notificationRecipients.role, 'admin'),
        eq(notificationRecipients.role, 'general_supervisor'),
        eq(notificationRecipients.branchId, branchId)
      )
    )
  );
}

export async function addNotificationRecipient(data: {
  name: string;
  email: string;
  role: 'admin' | 'general_supervisor' | 'branch_supervisor';
  branchId?: number | null;
  branchName?: string | null;
}) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(notificationRecipients).values({
    name: data.name,
    email: data.email,
    role: data.role,
    branchId: data.branchId || null,
    branchName: data.branchName || null,
  });
  
  return result;
}

export async function updateNotificationRecipient(id: number, data: Partial<{
  name: string;
  email: string;
  role: 'admin' | 'general_supervisor' | 'branch_supervisor';
  branchId: number | null;
  branchName: string | null;
  receiveRevenueAlerts: boolean;
  receiveExpenseAlerts: boolean;
  receiveMismatchAlerts: boolean;
  receiveInventoryAlerts: boolean;
  receiveMonthlyReminders: boolean;
  receiveRequestNotifications: boolean;
  receiveReportNotifications: boolean;
  receiveBonusNotifications: boolean;
  isActive: boolean;
}>) {
  const db = await getDb();
  if (!db) return null;
  
  return await db.update(notificationRecipients)
    .set(data)
    .where(eq(notificationRecipients.id, id));
}

export async function deleteNotificationRecipient(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  return await db.delete(notificationRecipients).where(eq(notificationRecipients.id, id));
}

export async function logSentNotification(data: {
  recipientId: number;
  recipientEmail: string;
  recipientName?: string;
  notificationType: string;
  subject: string;
  bodyArabic: string;
  bodyEnglish?: string;
  entityType?: string;
  entityId?: number;
  branchId?: number;
  branchName?: string;
  status: 'pending' | 'sent' | 'failed';
  sentAt?: Date;
  errorMessage?: string;
}) {
  const db = await getDb();
  if (!db) return null;
  
  return await db.insert(sentNotifications).values({
    recipientId: data.recipientId,
    recipientEmail: data.recipientEmail,
    recipientName: data.recipientName || null,
    notificationType: data.notificationType as any,
    subject: data.subject,
    bodyArabic: data.bodyArabic,
    bodyEnglish: data.bodyEnglish || null,
    entityType: data.entityType || null,
    entityId: data.entityId || null,
    branchId: data.branchId || null,
    branchName: data.branchName || null,
    status: data.status,
    sentAt: data.sentAt || null,
    errorMessage: data.errorMessage || null,
  });
}

export async function getSentNotifications(options?: {
  limit?: number;
  startDate?: Date;
  endDate?: Date;
  type?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const { limit = 100, startDate, endDate, type } = options || {};
  
  let query = db.select()
    .from(sentNotifications)
    .orderBy(desc(sentNotifications.createdAt))
    .limit(limit);
  
  // إضافة فلتر التاريخ إذا وُجد
  if (startDate || endDate || type) {
    const conditions = [];
    if (startDate) {
      conditions.push(gte(sentNotifications.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(sentNotifications.createdAt, endDate));
    }
    if (type) {
      conditions.push(eq(sentNotifications.notificationType, type as any));
    }
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
  }
  
  return await query;
}


// ==================== دوال حذف الإيرادات والمصاريف ====================

// حذف إيراد يومي
export async function deleteDailyRevenue(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  return await db.delete(dailyRevenues).where(eq(dailyRevenues.id, id));
}

// حذف إيرادات الموظفين المرتبطة بإيراد يومي
export async function deleteEmployeeRevenuesByDailyId(dailyRevenueId: number) {
  const db = await getDb();
  if (!db) return null;
  
  return await db.delete(employeeRevenues).where(eq(employeeRevenues.dailyRevenueId, dailyRevenueId));
}

// حذف مصروف
export async function deleteExpenseById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  return await db.delete(expenses).where(eq(expenses.id, id));
}


// ==================== دوال السجلات المحذوفة ====================
export async function createDeletedRecord(data: InsertDeletedRecord) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(deletedRecords).values(data);
  return result;
}

export async function getDeletedRecords(entityType?: string, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  
  if (entityType) {
    return await db.select().from(deletedRecords)
      .where(eq(deletedRecords.entityType, entityType as any))
      .orderBy(desc(deletedRecords.deletedAt))
      .limit(limit);
  }
  
  return await db.select().from(deletedRecords)
    .orderBy(desc(deletedRecords.deletedAt))
    .limit(limit);
}

export async function getDeletedRecordById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const results = await db.select().from(deletedRecords)
    .where(eq(deletedRecords.id, id))
    .limit(1);
  
  return results[0] || null;
}


// ==================== دوال إضافية للتقارير ====================
export async function getEmployeeRevenuesByDateRange(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(employeeRevenues)
    .where(and(
      gte(employeeRevenues.createdAt, startDate),
      lte(employeeRevenues.createdAt, endDate)
    ));
}

export async function getAllWeeklyBonusDetails() {
  const db = await getDb();
  if (!db) return [];
  return await db.select({
    id: bonusDetails.id,
    employeeId: bonusDetails.employeeId,
    employeeName: employees.name,
    weeklyRevenue: bonusDetails.weeklyRevenue,
    bonusAmount: bonusDetails.bonusAmount,
    bonusTier: bonusDetails.bonusTier,
    isEligible: bonusDetails.isEligible,
    createdAt: bonusDetails.createdAt,
  })
    .from(bonusDetails)
    .leftJoin(employees, eq(bonusDetails.employeeId, employees.id));
}


// دالة جلب جميع الإيرادات اليومية بنطاق تاريخ (بدون فلتر فرع)
export async function getAllDailyRevenuesByDateRange(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(dailyRevenues)
    .where(and(
      gte(dailyRevenues.date, startDate),
      lte(dailyRevenues.date, endDate)
    ))
    .orderBy(desc(dailyRevenues.date));
}


// ==================== دوال لوحة التحكم التنفيذية ====================

// حساب إجمالي الإيرادات الفعلية من جدول dailyRevenues
export async function getActualRevenues(startDate: Date, endDate: Date, branchId?: number) {
  const db = await getDb();
  if (!db) return { totalCash: 0, totalNetwork: 0, totalBalance: 0, totalRevenue: 0, daysCount: 0 };
  
  const conditions = [
    gte(dailyRevenues.date, startDate),
    lte(dailyRevenues.date, endDate)
  ];
  
  if (branchId) {
    conditions.push(eq(dailyRevenues.branchId, branchId));
  }
  
  const result = await db.select({
    totalCash: sql<string>`COALESCE(SUM(${dailyRevenues.cash}), 0)`,
    totalNetwork: sql<string>`COALESCE(SUM(${dailyRevenues.network}), 0)`,
    totalBalance: sql<string>`COALESCE(SUM(${dailyRevenues.balance}), 0)`,
    totalRevenue: sql<string>`COALESCE(SUM(${dailyRevenues.cash} + ${dailyRevenues.network}), 0)`,
    daysCount: sql<number>`COUNT(DISTINCT DATE(${dailyRevenues.date}))`,
  }).from(dailyRevenues).where(and(...conditions));
  
  return {
    totalCash: parseFloat(result[0]?.totalCash || '0'),
    totalNetwork: parseFloat(result[0]?.totalNetwork || '0'),
    totalBalance: parseFloat(result[0]?.totalBalance || '0'),
    totalRevenue: parseFloat(result[0]?.totalRevenue || '0'),
    daysCount: result[0]?.daysCount || 0,
  };
}

// حساب إجمالي المصاريف الفعلية (جميع الحالات في الفترة)
export async function getActualExpenses(startDate: Date, endDate: Date, branchId?: number) {
  const db = await getDb();
  if (!db) return { totalExpenses: 0, expensesCount: 0 };
  
  const conditions = [
    gte(expenses.expenseDate, startDate),
    lte(expenses.expenseDate, endDate)
  ];
  
  if (branchId) {
    conditions.push(eq(expenses.branchId, branchId));
  }
  
  const result = await db.select({
    totalExpenses: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
    expensesCount: sql<number>`COUNT(*)`,
  }).from(expenses).where(and(...conditions));
  
  return {
    totalExpenses: parseFloat(result[0]?.totalExpenses || '0'),
    expensesCount: result[0]?.expensesCount || 0,
  };
}

// حساب أداء الموظفين (مع استبعاد موظفي النظام)
export async function getEmployeesPerformance(startDate: Date, endDate: Date, branchId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  // الربط مع dailyRevenues للحصول على التاريخ
  const conditions = [
    gte(dailyRevenues.date, startDate),
    lte(dailyRevenues.date, endDate),
    // استبعاد موظفي النظام (النظام، النظم، System)
    sql`${employees.name} NOT LIKE '%النظام%' AND ${employees.name} NOT LIKE '%النظم%' AND ${employees.name} NOT LIKE '%System%' AND ${employees.code} != '0000' AND ${employees.code} != '0000t'`
  ];
  
  if (branchId) {
    conditions.push(eq(employees.branchId, branchId));
  }
  
  const result = await db.select({
    employeeId: employees.id,
    employeeName: employees.name,
    employeeCode: employees.code,
    branchId: employees.branchId,
    totalRevenue: sql<string>`COALESCE(SUM(${employeeRevenues.total}), 0)`,
    daysWorked: sql<number>`COUNT(DISTINCT DATE(${dailyRevenues.date}))`,
  })
    .from(employeeRevenues)
    .innerJoin(employees, eq(employeeRevenues.employeeId, employees.id))
    .innerJoin(dailyRevenues, eq(employeeRevenues.dailyRevenueId, dailyRevenues.id))
    .where(and(...conditions))
    .groupBy(employees.id, employees.name, employees.code, employees.branchId)
    .orderBy(sql`SUM(${employeeRevenues.total}) DESC`);
  
  return result.map(r => ({
    ...r,
    totalRevenue: parseFloat(r.totalRevenue || '0'),
    averageDaily: r.daysWorked > 0 ? parseFloat(r.totalRevenue || '0') / r.daysWorked : 0,
  }));
}

// جلب آخر مسيرة رواتب للفترة المحددة
export async function getLatestPayrollForPeriod(startDate: Date, endDate: Date, branchId?: number) {
  const db = await getDb();
  if (!db) return {
    totalSalaries: 0,
    month: 0,
    year: 0,
    branchName: '',
    employeeCount: 0,
    status: 'none'
  };
  
  // استخراج الشهر والسنة من تاريخ النهاية
  const targetMonth = endDate.getMonth() + 1;
  const targetYear = endDate.getFullYear();
  
  try {
    // إذا كان هناك فرع محدد، نجلب مسيرة هذا الفرع
    if (branchId) {
      const result = await db.select()
        .from(payrolls)
        .where(and(
          eq(payrolls.branchId, branchId),
          eq(payrolls.month, targetMonth),
          eq(payrolls.year, targetYear)
        ))
        .limit(1);
      
      if (result.length > 0) {
        const payroll = result[0];
        return {
          totalSalaries: parseFloat(payroll.totalNetSalary || '0'),
          month: payroll.month,
          year: payroll.year,
          branchName: payroll.branchName || '',
          employeeCount: payroll.employeeCount || 0,
          status: payroll.status || 'none'
        };
      }
    } else {
      // إذا لم يكن هناك فرع محدد، نجلب إجمالي كل المسيرات لهذا الشهر
      const result = await db.select({
        totalSalaries: sql<string>`SUM(${payrolls.totalNetSalary})`,
        employeeCount: sql<number>`SUM(${payrolls.employeeCount})`,
        count: sql<number>`COUNT(*)`
      })
        .from(payrolls)
        .where(and(
          eq(payrolls.month, targetMonth),
          eq(payrolls.year, targetYear)
        ));
      
      if (result.length > 0 && result[0].count > 0) {
        return {
          totalSalaries: parseFloat(result[0].totalSalaries || '0'),
          month: targetMonth,
          year: targetYear,
          branchName: 'جميع الفروع',
          employeeCount: result[0].employeeCount || 0,
          status: 'combined'
        };
      }
    }
    
    // إذا لم توجد مسيرة للشهر الحالي، نجلب آخر مسيرة متاحة
    const conditions = branchId ? [eq(payrolls.branchId, branchId)] : [];
    const lastPayroll = await db.select()
      .from(payrolls)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(payrolls.year), desc(payrolls.month))
      .limit(1);
    
    if (lastPayroll.length > 0) {
      const payroll = lastPayroll[0];
      return {
        totalSalaries: parseFloat(payroll.totalNetSalary || '0'),
        month: payroll.month,
        year: payroll.year,
        branchName: payroll.branchName || '',
        employeeCount: payroll.employeeCount || 0,
        status: payroll.status || 'none'
      };
    }
    
    return {
      totalSalaries: 0,
      month: 0,
      year: 0,
      branchName: '',
      employeeCount: 0,
      status: 'none'
    };
  } catch (error) {
    console.error('Error fetching payroll data:', error);
    return {
      totalSalaries: 0,
      month: 0,
      year: 0,
      branchName: '',
      employeeCount: 0,
      status: 'none'
    };
  }
}

// حساب مؤشرات الأداء الفعلية للوحة التنفيذية
export async function calculateExecutiveKPIs(startDate: Date, endDate: Date, branchId?: number) {
  const revenues = await getActualRevenues(startDate, endDate, branchId);
  const expensesData = await getActualExpenses(startDate, endDate, branchId);
  const employeesPerformance = await getEmployeesPerformance(startDate, endDate, branchId);
  
  // جلب بيانات آخر مسيرة رواتب للفترة المحددة
  const payrollData = await getLatestPayrollForPeriod(startDate, endDate, branchId);
  
  // جلب بيانات سندات القبض
  const receiptVouchersData = await getReceiptVouchersStats(startDate, endDate, branchId);
  
  // إجمالي المصاريف يشمل المصاريف العادية + الرواتب
  const totalExpensesWithPayroll = expensesData.totalExpenses + payrollData.totalSalaries;
  const netProfit = revenues.totalRevenue - totalExpensesWithPayroll;
  const profitMargin = revenues.totalRevenue > 0 ? (netProfit / revenues.totalRevenue) * 100 : 0;
  const averageDailyRevenue = revenues.daysCount > 0 ? revenues.totalRevenue / revenues.daysCount : 0;
  
  // أفضل 5 موظفين
  const topEmployees = employeesPerformance.slice(0, 5);
  
  // إجمالي إيرادات الموظفين
  const totalEmployeeRevenue = employeesPerformance.reduce((sum, emp) => sum + emp.totalRevenue, 0);
  
  return {
    // الإيرادات
    totalRevenue: revenues.totalRevenue,
    totalCash: revenues.totalCash,
    totalNetwork: revenues.totalNetwork,
    totalBalance: revenues.totalBalance,
    daysCount: revenues.daysCount,
    averageDailyRevenue,
    
    // المصاريف والأرباح
    totalExpenses: expensesData.totalExpenses,
    expensesCount: expensesData.expensesCount,
    
    // بيانات الرواتب
    totalSalaries: payrollData.totalSalaries,
    payrollMonth: payrollData.month,
    payrollYear: payrollData.year,
    payrollBranchName: payrollData.branchName,
    payrollEmployeeCount: payrollData.employeeCount,
    payrollStatus: payrollData.status,
    
    // إجمالي الالتزامات (مصاريف + رواتب)
    totalObligations: totalExpensesWithPayroll,
    
    // الربح الحقيقي بعد الرواتب
    netProfit,
    profitMargin,
    
    // أداء الموظفين
    employeesCount: employeesPerformance.length,
    topEmployees,
    totalEmployeeRevenue,
    
    // مؤشرات إضافية
    cashPercentage: revenues.totalRevenue > 0 ? (revenues.totalCash / revenues.totalRevenue) * 100 : 0,
    networkPercentage: revenues.totalRevenue > 0 ? (revenues.totalNetwork / revenues.totalRevenue) * 100 : 0,
    
    // سندات القبض
    receiptVouchersCount: receiptVouchersData.count,
    totalReceiptVouchersAmount: receiptVouchersData.totalAmount,
  };
}

// الحصول على الإيرادات اليومية للرسم البياني
export async function getDailyRevenuesForChart(startDate: Date, endDate: Date, branchId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [
    gte(dailyRevenues.date, startDate),
    lte(dailyRevenues.date, endDate)
  ];
  
  if (branchId) {
    conditions.push(eq(dailyRevenues.branchId, branchId));
  }
  
  // استخدام استعلام SQL مباشر لتجنب مشاكل Drizzle مع التجميع
  const result = await db.execute(
    sql`SELECT 
      DATE(${dailyRevenues.date}) as date,
      COALESCE(SUM(${dailyRevenues.cash}), 0) as totalCash,
      COALESCE(SUM(${dailyRevenues.network}), 0) as totalNetwork,
      COALESCE(SUM(${dailyRevenues.cash} + ${dailyRevenues.network}), 0) as totalRevenue
    FROM ${dailyRevenues}
    WHERE ${and(...conditions)}
    GROUP BY DATE(${dailyRevenues.date})
    ORDER BY DATE(${dailyRevenues.date})`
  );
  
  // النتيجة تأتي كمصفوفة من الصفوف
  const rows = result[0] as unknown as Array<{ date: string; totalCash: string; totalNetwork: string; totalRevenue: string }>;
  
  return rows.map(r => ({
    date: r.date,
    cash: parseFloat(r.totalCash || '0'),
    network: parseFloat(r.totalNetwork || '0'),
    total: parseFloat(r.totalRevenue || '0'),
  }));
}

// مقارنة الأداء بين فترتين
export async function comparePerformance(
  currentStart: Date, 
  currentEnd: Date, 
  previousStart: Date, 
  previousEnd: Date, 
  branchId?: number
) {
  const current = await calculateExecutiveKPIs(currentStart, currentEnd, branchId);
  const previous = await calculateExecutiveKPIs(previousStart, previousEnd, branchId);
  
  const calculateChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / Math.abs(prev)) * 100;
  };
  
  return {
    current,
    previous,
    changes: {
      revenueChange: calculateChange(current.totalRevenue, previous.totalRevenue),
      expensesChange: calculateChange(current.totalExpenses, previous.totalExpenses),
      profitChange: calculateChange(current.netProfit, previous.netProfit),
      employeeRevenueChange: calculateChange(current.totalEmployeeRevenue, previous.totalEmployeeRevenue),
    }
  };
}


// ==================== دوال فواتير الموظفين (سالب ومبيعات) ====================

// إنشاء رقم فاتورة موظف فريد
async function generateEmployeeInvoiceNumber(type: 'negative' | 'sales'): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const prefix = type === 'negative' ? 'NEG' : 'SALE';
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  
  // الحصول على آخر رقم فاتورة
  const lastInvoice = await db.select({ invoiceNumber: employeeInvoices.invoiceNumber })
    .from(employeeInvoices)
    .where(like(employeeInvoices.invoiceNumber, `${prefix}-${year}${month}%`))
    .orderBy(desc(employeeInvoices.id))
    .limit(1);
  
  let sequence = 1;
  if (lastInvoice.length > 0) {
    const lastNum = lastInvoice[0].invoiceNumber.split('-').pop();
    sequence = parseInt(lastNum || '0') + 1;
  }
  
  return `${prefix}-${year}${month}-${sequence.toString().padStart(4, '0')}`;
}

// إنشاء فاتورة موظف جديدة
export async function createEmployeeInvoice(data: {
  type: 'negative' | 'sales';
  employeeId: number;
  employeeName: string;
  branchId: number;
  branchName?: string;
  amount: string;
  customerPhone?: string;
  customerName?: string;
  notes?: string;
  reason?: string;
  createdBy: number;
  createdByName?: string;
}): Promise<{ success: boolean; invoiceNumber: string; invoiceId: number }> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const invoiceNumber = await generateEmployeeInvoiceNumber(data.type);
  
  const result = await db.insert(employeeInvoices).values({
    invoiceNumber,
    type: data.type,
    employeeId: data.employeeId,
    employeeName: data.employeeName,
    branchId: data.branchId,
    branchName: data.branchName,
    amount: data.amount,
    customerPhone: data.customerPhone,
    customerName: data.customerName,
    notes: data.notes,
    reason: data.reason,
    createdBy: data.createdBy,
    createdByName: data.createdByName,
  });
  
  // إذا كانت فاتورة مبيعات، أضفها إلى الإيرادات اليومية
  if (data.type === 'sales') {
    await addSalesInvoiceToRevenue({
      employeeId: data.employeeId,
      branchId: data.branchId,
      amount: parseFloat(data.amount),
      invoiceId: result[0].insertId,
    });
  }
  
  return { 
    success: true, 
    invoiceNumber,
    invoiceId: result[0].insertId 
  };
}

// إضافة فاتورة مبيعات إلى الإيرادات اليومية
async function addSalesInvoiceToRevenue(data: {
  employeeId: number;
  branchId: number;
  amount: number;
  invoiceId: number;
}) {
  const db = await getDb();
  if (!db) return;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // البحث عن إيراد يومي موجود لهذا الفرع اليوم
  const existingDailyRevenue = await db.select()
    .from(dailyRevenues)
    .where(and(
      eq(dailyRevenues.branchId, data.branchId),
      gte(dailyRevenues.date, today),
      lt(dailyRevenues.date, tomorrow)
    ))
    .limit(1);
  
  if (existingDailyRevenue.length > 0) {
    const dailyRevenueId = existingDailyRevenue[0].id;
    
    // البحث عن إيراد الموظف لهذا اليوم
    const existingEmployeeRevenue = await db.select()
      .from(employeeRevenues)
      .where(and(
        eq(employeeRevenues.dailyRevenueId, dailyRevenueId),
        eq(employeeRevenues.employeeId, data.employeeId)
      ))
      .limit(1);
    
    if (existingEmployeeRevenue.length > 0) {
      // تحديث إيراد الموظف الموجود
      const currentTotal = parseFloat(existingEmployeeRevenue[0].total);
      const currentNetwork = parseFloat(existingEmployeeRevenue[0].network);
      await db.update(employeeRevenues)
        .set({
          network: (currentNetwork + data.amount).toFixed(2),
          total: (currentTotal + data.amount).toFixed(2),
        })
        .where(eq(employeeRevenues.id, existingEmployeeRevenue[0].id));
    } else {
      // إنشاء إيراد موظف جديد
      await db.insert(employeeRevenues).values({
        dailyRevenueId,
        employeeId: data.employeeId,
        cash: '0.00',
        network: data.amount.toFixed(2),
        total: data.amount.toFixed(2),
      });
    }
    
    // تحديث إجمالي الإيراد اليومي
    const currentDailyTotal = parseFloat(existingDailyRevenue[0].total);
    const currentDailyNetwork = parseFloat(existingDailyRevenue[0].network);
    await db.update(dailyRevenues)
      .set({
        network: (currentDailyNetwork + data.amount).toFixed(2),
        total: (currentDailyTotal + data.amount).toFixed(2),
      })
      .where(eq(dailyRevenues.id, dailyRevenueId));
  }
  // إذا لم يوجد إيراد يومي، لا نفعل شيء - سيتم إضافة الفاتورة عند إنشاء الإيراد اليومي
}

// الحصول على جميع فواتير الموظفين
export async function getAllEmployeeInvoices(filters?: {
  type?: 'negative' | 'sales';
  branchId?: number;
  employeeId?: number;
  startDate?: Date;
  endDate?: Date;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  
  if (filters?.type) {
    conditions.push(eq(employeeInvoices.type, filters.type));
  }
  if (filters?.branchId) {
    conditions.push(eq(employeeInvoices.branchId, filters.branchId));
  }
  if (filters?.employeeId) {
    conditions.push(eq(employeeInvoices.employeeId, filters.employeeId));
  }
  if (filters?.startDate) {
    conditions.push(gte(employeeInvoices.invoiceDate, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(employeeInvoices.invoiceDate, filters.endDate));
  }
  
  if (conditions.length > 0) {
    return await db.select().from(employeeInvoices)
      .where(and(...conditions))
      .orderBy(desc(employeeInvoices.invoiceDate));
  }
  
  return await db.select().from(employeeInvoices)
    .orderBy(desc(employeeInvoices.invoiceDate));
}

// الحصول على فاتورة موظف بالمعرف
export async function getEmployeeInvoiceById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(employeeInvoices)
    .where(eq(employeeInvoices.id, id))
    .limit(1);
  
  return result[0] || null;
}

// حذف فاتورة موظف (للأدمن فقط)
export async function deleteEmployeeInvoice(id: number, deletedBy: { userId: number; userName: string }) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  // الحصول على بيانات الفاتورة قبل الحذف
  const invoice = await getEmployeeInvoiceById(id);
  if (!invoice) throw new Error('الفاتورة غير موجودة');
  
  // حفظ السجل المحذوف
  await db.insert(deletedRecords).values({
    deletedByUserId: deletedBy.userId,
    deletedByUserName: deletedBy.userName,
    entityType: 'invoice',
    originalId: id,
    originalData: JSON.stringify(invoice),
    branchId: invoice.branchId,
    branchName: invoice.branchName,
  });
  
  // حذف الفاتورة
  await db.delete(employeeInvoices).where(eq(employeeInvoices.id, id));
  
  return { success: true };
}

// إحصائيات فواتير الموظفين
export async function getEmployeeInvoicesStats(branchId?: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return { negativeCount: 0, negativeTotal: 0, salesCount: 0, salesTotal: 0 };
  
  const conditions = [];
  if (branchId) conditions.push(eq(employeeInvoices.branchId, branchId));
  if (startDate) conditions.push(gte(employeeInvoices.invoiceDate, startDate));
  if (endDate) conditions.push(lte(employeeInvoices.invoiceDate, endDate));
  
  // فواتير السالب
  const negativeConditions = [...conditions, eq(employeeInvoices.type, 'negative')];
  const negativeStats = await db.select({
    count: sql<number>`COUNT(*)`,
    total: sql<string>`COALESCE(SUM(${employeeInvoices.amount}), 0)`,
  }).from(employeeInvoices)
    .where(negativeConditions.length > 0 ? and(...negativeConditions) : undefined);
  
  // فواتير المبيعات
  const salesConditions = [...conditions, eq(employeeInvoices.type, 'sales')];
  const salesStats = await db.select({
    count: sql<number>`COUNT(*)`,
    total: sql<string>`COALESCE(SUM(${employeeInvoices.amount}), 0)`,
  }).from(employeeInvoices)
    .where(salesConditions.length > 0 ? and(...salesConditions) : undefined);
  
  return {
    negativeCount: negativeStats[0]?.count || 0,
    negativeTotal: parseFloat(negativeStats[0]?.total || '0'),
    salesCount: salesStats[0]?.count || 0,
    salesTotal: parseFloat(salesStats[0]?.total || '0'),
  };
}


// ==================== دوال الجرد المتقدمة ====================

// بدء جرد جديد مع تحميل جميع المنتجات
export async function startNewInventoryCount(branchId: number | null, branchName: string | null, createdBy: number, createdByName: string) {
  const db = await getDb();
  if (!db) return null;
  
  // إنشاء جرد جديد
  const countNumber = await generateInventoryCountNumber();
  const [result] = await db.insert(inventoryCounts).values({
    countNumber,
    branchId,
    branchName,
    countDate: new Date(),
    status: 'in_progress',
    createdBy,
    createdByName,
  });
  
  const countId = result.insertId;
  
  // تحميل جميع المنتجات إلى الجرد
  const allProducts = await getAllProducts();
  
  for (const product of allProducts) {
    await db.insert(inventoryCountItems).values({
      countId,
      productId: product.id,
      productName: product.name,
      productSku: product.sku || '',
      systemQuantity: product.quantity,
      countedQuantity: 0,
      variance: -product.quantity,
      unitCost: product.costPrice,
      varianceValue: (-product.quantity * parseFloat(product.costPrice)).toFixed(2),
      status: 'pending',
    });
  }
  
  // تحديث إحصائيات الجرد
  await updateInventoryCount(countId, {
    totalProducts: allProducts.length,
  });
  
  return { countId, countNumber };
}

// تحديث كمية منتج في الجرد
export async function updateInventoryCountItemQuantity(
  itemId: number, 
  countedQuantity: number, 
  countedBy: number,
  reason?: string
) {
  const db = await getDb();
  if (!db) return null;
  
  // الحصول على العنصر الحالي
  const [item] = await db.select().from(inventoryCountItems).where(eq(inventoryCountItems.id, itemId)).limit(1);
  if (!item) return null;
  
  const variance = countedQuantity - item.systemQuantity;
  const varianceValue = variance * parseFloat(item.unitCost as string);
  
  await db.update(inventoryCountItems).set({
    countedQuantity,
    variance,
    varianceValue: varianceValue.toFixed(2),
    status: 'counted',
    countedBy,
    countedAt: new Date(),
    reason: reason || null,
  }).where(eq(inventoryCountItems.id, itemId));
  
  // إعادة حساب إحصائيات الجرد
  await calculateInventoryCountStats(item.countId);
  
  return { itemId, countedQuantity, variance, varianceValue };
}

// الحصول على تقرير فروقات الجرد
export async function getInventoryVarianceReport(countId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const count = await getInventoryCountById(countId);
  if (!count) return null;
  
  const items = await db.select().from(inventoryCountItems)
    .where(eq(inventoryCountItems.countId, countId))
    .orderBy(desc(inventoryCountItems.varianceValue));
  
  // تصنيف الفروقات
  const shortages = items.filter(item => item.variance < 0);
  const surpluses = items.filter(item => item.variance > 0);
  const matched = items.filter(item => item.variance === 0);
  
  // حساب الإجماليات
  const totalShortageValue = shortages.reduce((sum, item) => sum + parseFloat(item.varianceValue as string), 0);
  const totalSurplusValue = surpluses.reduce((sum, item) => sum + parseFloat(item.varianceValue as string), 0);
  
  return {
    count,
    items,
    summary: {
      totalProducts: items.length,
      shortages: shortages.length,
      surpluses: surpluses.length,
      matched: matched.length,
      totalShortageValue: Math.abs(totalShortageValue),
      totalSurplusValue,
      netVariance: totalSurplusValue + totalShortageValue,
    },
    shortages,
    surpluses,
    matched,
  };
}

// اعتماد الجرد وتحديث المخزون
export async function approveInventoryCount(
  countId: number, 
  approvedBy: number, 
  approvedByName: string,
  updateStock: boolean = true
) {
  const db = await getDb();
  if (!db) return null;
  
  const count = await getInventoryCountById(countId);
  if (!count || count.status === 'approved') return null;
  
  // تحديث حالة الجرد
  await updateInventoryCount(countId, {
    status: 'approved',
    approvedBy,
    approvedByName,
    approvedAt: new Date(),
  });
  
  // تحديث كميات المخزون إذا مطلوب
  if (updateStock) {
    const items = await getInventoryCountItems(countId);
    
    for (const item of items) {
      if (item.status === 'counted' && item.variance !== 0) {
        // تحديث كمية المنتج
        await db.update(products).set({
          quantity: item.countedQuantity,
        }).where(eq(products.id, item.productId));
        
        // تسجيل في سجل التدقيق
        await createActivityLog({
          userId: approvedBy,
          userName: approvedByName,
          action: 'update',
          entityType: 'product',
          entityId: item.productId,
          details: `تحديث المخزون من الجرد: ${count.countNumber} - الكمية السابقة: ${item.systemQuantity}, الكمية الجديدة: ${item.countedQuantity}, الفرق: ${item.variance}`,
        });
      }
    }
  }
  
  return { success: true, countId, updatedProducts: updateStock };
}

// الحصول على الجرد الجاري
export async function getActiveInventoryCount() {
  const db = await getDb();
  if (!db) return null;
  
  const [result] = await db.select().from(inventoryCounts)
    .where(eq(inventoryCounts.status, 'in_progress'))
    .orderBy(desc(inventoryCounts.createdAt))
    .limit(1);
  
  return result || null;
}

// إلغاء الجرد
export async function cancelInventoryCount(countId: number) {
  const db = await getDb();
  if (!db) return null;
  
  // حذف عناصر الجرد
  await db.delete(inventoryCountItems).where(eq(inventoryCountItems.countId, countId));
  
  // حذف الجرد
  await db.delete(inventoryCounts).where(eq(inventoryCounts.id, countId));
  
  return { success: true };
}

// البحث في عناصر الجرد
export async function searchInventoryCountItems(countId: number, searchTerm: string) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(inventoryCountItems)
    .where(and(
      eq(inventoryCountItems.countId, countId),
      or(
        like(inventoryCountItems.productName, `%${searchTerm}%`),
        like(inventoryCountItems.productSku, `%${searchTerm}%`)
      )
    ));
}

// تحديث سبب الفرق
export async function updateInventoryItemReason(itemId: number, reason: string) {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(inventoryCountItems).set({
    reason,
  }).where(eq(inventoryCountItems.id, itemId));
  
  return { success: true };
}

// تحديث اسم المنتج في الجرد
export async function updateInventoryItemName(itemId: number, productName: string) {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(inventoryCountItems).set({
    productName,
  }).where(eq(inventoryCountItems.id, itemId));
  
  return { success: true };
}

// تحديث المطلوب شهرياً
export async function updateInventoryMonthlyRequired(itemId: number, monthlyRequired: number) {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(inventoryCountItems).set({
    monthlyRequired,
  }).where(eq(inventoryCountItems.id, itemId));
  
  return { success: true };
}


// ==================== دوال نظام المهام ====================

// توليد رقم مرجعي فريد من 6 أرقام
export async function generateTaskReferenceNumber(): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  let referenceNumber: string;
  let exists = true;
  
  while (exists) {
    // توليد رقم عشوائي من 6 أرقام
    referenceNumber = Math.floor(100000 + Math.random() * 900000).toString();
    
    // التحقق من عدم وجوده مسبقاً
    const existing = await db.select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.referenceNumber, referenceNumber))
      .limit(1);
    
    exists = existing.length > 0;
  }
  
  return referenceNumber!;
}

// إنشاء مهمة جديدة
export async function createTask(data: {
  subject: string;
  details?: string;
  requirement: string;
  responseType: 'file_upload' | 'confirmation' | 'text_response' | 'multiple_files';
  confirmationYesText?: string;
  confirmationNoText?: string;
  branchId?: number;
  branchName?: string;
  assignedToId: number;
  assignedToName: string;
  assignedToEmail?: string;
  dueDate?: Date;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  attachments?: string[]; // مرفقات عند إنشاء المهمة
  createdBy: number;
  createdByName?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const referenceNumber = await generateTaskReferenceNumber();
  
  const result = await db.insert(tasks).values({
    referenceNumber,
    subject: data.subject,
    details: data.details,
    requirement: data.requirement,
    responseType: data.responseType,
    confirmationYesText: data.confirmationYesText || 'نعم، قمت بذلك',
    confirmationNoText: data.confirmationNoText || 'لا، لم أقم بذلك حتى الآن',
    branchId: data.branchId,
    branchName: data.branchName,
    assignedToId: data.assignedToId,
    assignedToName: data.assignedToName,
    assignedToEmail: data.assignedToEmail,
    dueDate: data.dueDate,
    priority: data.priority || 'medium',
    attachments: data.attachments ? JSON.stringify(data.attachments) : null,
    createdBy: data.createdBy,
    createdByName: data.createdByName,
    status: 'pending',
  });
  
  const taskId = Number((result as any).insertId || (result as any)[0]?.insertId);
  
  // تسجيل في سجل المهام
  await db.insert(taskLogs).values({
    taskId: taskId,
    action: 'created',
    newStatus: 'pending',
    performedBy: data.createdBy,
    performedByName: data.createdByName,
    notes: `تم إنشاء المهمة برقم مرجعي ${referenceNumber}`,
  });
  
  return { id: taskId, referenceNumber };
}

// البحث عن مهمة بالرقم المرجعي
export async function getTaskByReference(referenceNumber: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(tasks)
    .where(eq(tasks.referenceNumber, referenceNumber))
    .limit(1);
  
  return result[0] || null;
}

// الحصول على مهمة بالـ ID
export async function getTaskById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(tasks)
    .where(eq(tasks.id, id))
    .limit(1);
  
  return result[0] || null;
}

// الحصول على جميع المهام
export async function getAllTasks(filters?: {
  status?: string;
  assignedToId?: number;
  branchId?: number;
  priority?: string;
  createdBy?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  
  if (filters?.status) {
    conditions.push(eq(tasks.status, filters.status as any));
  }
  if (filters?.assignedToId) {
    conditions.push(eq(tasks.assignedToId, filters.assignedToId));
  }
  if (filters?.branchId) {
    conditions.push(eq(tasks.branchId, filters.branchId));
  }
  if (filters?.priority) {
    conditions.push(eq(tasks.priority, filters.priority as any));
  }
  if (filters?.createdBy) {
    conditions.push(eq(tasks.createdBy, filters.createdBy));
  }
  
  const result = await db.select()
    .from(tasks)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(tasks.createdAt));
  
  return result;
}

// الحصول على مهام الموظف
export async function getTasksForEmployee(employeeId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select()
    .from(tasks)
    .where(eq(tasks.assignedToId, employeeId))
    .orderBy(desc(tasks.createdAt));
  
  return result;
}

// تحديث استجابة المهمة (رفع ملف أو تأكيد)
export async function respondToTask(data: {
  taskId: number;
  responseType: 'file_upload' | 'confirmation' | 'text_response' | 'multiple_files';
  responseText?: string;
  responseConfirmation?: boolean;
  responseFiles?: string[];
  respondedBy?: number;
  respondedByName?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const task = await getTaskById(data.taskId);
  if (!task) throw new Error("المهمة غير موجودة");
  
  const updateData: any = {
    status: 'in_progress',
    respondedAt: new Date(),
  };
  
  if (data.responseText) {
    updateData.responseText = data.responseText;
  }
  
  if (data.responseConfirmation !== undefined) {
    updateData.responseConfirmation = data.responseConfirmation;
  }
  
  if (data.responseFiles && data.responseFiles.length > 0) {
    updateData.responseFiles = JSON.stringify(data.responseFiles);
  }
  
  await db.update(tasks)
    .set(updateData)
    .where(eq(tasks.id, data.taskId));
  
  // تسجيل في سجل المهام
  let actionNote = '';
  if (data.responseType === 'file_upload' || data.responseType === 'multiple_files') {
    actionNote = `تم رفع ${data.responseFiles?.length || 1} ملف`;
  } else if (data.responseType === 'confirmation') {
    actionNote = data.responseConfirmation ? 'تم التأكيد بنعم' : 'تم التأكيد بلا';
  } else {
    actionNote = 'تم إرسال رد نصي';
  }
  
  await db.insert(taskLogs).values({
    taskId: data.taskId,
    action: 'responded',
    oldStatus: task.status,
    newStatus: 'in_progress',
    performedBy: data.respondedBy,
    performedByName: data.respondedByName,
    notes: actionNote,
  });
  
  return { success: true };
}

// تحديث حالة المهمة
export async function updateTaskStatus(data: {
  taskId: number;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  updatedBy: number;
  updatedByName?: string;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const task = await getTaskById(data.taskId);
  if (!task) throw new Error("المهمة غير موجودة");
  
  await db.update(tasks)
    .set({ status: data.status })
    .where(eq(tasks.id, data.taskId));
  
  // تسجيل في سجل المهام
  await db.insert(taskLogs).values({
    taskId: data.taskId,
    action: 'status_changed',
    oldStatus: task.status,
    newStatus: data.status,
    performedBy: data.updatedBy,
    performedByName: data.updatedByName,
    notes: data.notes || `تم تغيير الحالة من ${task.status} إلى ${data.status}`,
  });
  
  return { success: true };
}

// تحديث حالة إرسال الإشعار
export async function markTaskEmailSent(taskId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(tasks)
    .set({ 
      emailSent: true,
      emailSentAt: new Date(),
    })
    .where(eq(tasks.id, taskId));
  
  return { success: true };
}

// حذف مهمة
export async function deleteTask(taskId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // حذف سجلات المهمة أولاً
  await db.delete(taskLogs).where(eq(taskLogs.taskId, taskId));
  
  // حذف المهمة
  await db.delete(tasks).where(eq(tasks.id, taskId));
  
  return { success: true };
}

// الحصول على سجل المهمة
export async function getTaskLogs(taskId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select()
    .from(taskLogs)
    .where(eq(taskLogs.taskId, taskId))
    .orderBy(desc(taskLogs.createdAt));
  
  return result;
}

// إحصائيات المهام
export async function getTaskStats() {
  const db = await getDb();
  if (!db) return null;
  
  const stats = await db.select({
    total: sql<number>`COUNT(*)`,
    pending: sql<number>`SUM(CASE WHEN ${tasks.status} = 'pending' THEN 1 ELSE 0 END)`,
    inProgress: sql<number>`SUM(CASE WHEN ${tasks.status} = 'in_progress' THEN 1 ELSE 0 END)`,
    completed: sql<number>`SUM(CASE WHEN ${tasks.status} = 'completed' THEN 1 ELSE 0 END)`,
    cancelled: sql<number>`SUM(CASE WHEN ${tasks.status} = 'cancelled' THEN 1 ELSE 0 END)`,
  }).from(tasks);
  
  return stats[0];
}


// الحصول على المهام المتأخرة
export async function getOverdueTasks() {
  const db = await getDb();
  if (!db) return [];
  
  const now = new Date();
  
  const result = await db.select({
    id: tasks.id,
    referenceNumber: tasks.referenceNumber,
    subject: tasks.subject,
    assignedToName: tasks.assignedToName,
    branchName: tasks.branchName,
    dueDate: tasks.dueDate,
    status: tasks.status,
  })
    .from(tasks)
    .where(
      and(
        isNotNull(tasks.dueDate),
        lt(tasks.dueDate, now),
        inArray(tasks.status, ['pending', 'in_progress'])
      )
    )
    .orderBy(asc(tasks.dueDate));
  
  return result.map(task => ({
    ...task,
    employeeName: task.assignedToName,
    daysOverdue: task.dueDate ? Math.floor((now.getTime() - new Date(task.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : 0,
  }));
}

// الحصول على معلومات منشئ المهمة
export async function getTaskCreatorInfo(taskId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const task = await db.select({
    createdBy: tasks.createdBy,
    createdByName: tasks.createdByName,
  })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);
  
  if (!task.length) return null;
  
  // الحصول على بريد المنشئ من جدول المستخدمين
  const user = await db.select({
    email: users.email,
    name: users.name,
  })
    .from(users)
    .where(eq(users.id, task[0].createdBy))
    .limit(1);
  
  return user.length ? {
    id: task[0].createdBy,
    name: task[0].createdByName || user[0].name,
    email: user[0].email,
  } : null;
}


// ==================== دوال نظام الولاء ====================

// توليد معرف فريد للعميل
export async function generateLoyaltyCustomerId(): Promise<string> {
  const db = await getDb();
  if (!db) return `LC-${Date.now()}`;
  
  const lastCustomer = await db.select({ customerId: loyaltyCustomers.customerId })
    .from(loyaltyCustomers)
    .orderBy(desc(loyaltyCustomers.id))
    .limit(1);
  
  let nextNumber = 1;
  if (lastCustomer.length > 0) {
    const lastId = lastCustomer[0].customerId;
    const match = lastId.match(/LC-(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1]) + 1;
    }
  }
  
  return `LC-${nextNumber.toString().padStart(4, '0')}`;
}

// توليد معرف فريد للزيارة
export async function generateLoyaltyVisitId(): Promise<string> {
  const db = await getDb();
  if (!db) return `LV-${Date.now()}`;
  
  const lastVisit = await db.select({ visitId: loyaltyVisits.visitId })
    .from(loyaltyVisits)
    .orderBy(desc(loyaltyVisits.id))
    .limit(1);
  
  let nextNumber = 1;
  if (lastVisit.length > 0) {
    const lastId = lastVisit[0].visitId;
    const match = lastId.match(/LV-(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1]) + 1;
    }
  }
  
  return `LV-${nextNumber.toString().padStart(6, '0')}`;
}

// تسجيل عميل جديد في برنامج الولاء
export async function registerLoyaltyCustomer(data: {
  name: string;
  phone: string;
  email?: string;
  branchId?: number;
  branchName?: string;
}): Promise<{ success: boolean; customer?: LoyaltyCustomer; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "خطأ في الاتصال بقاعدة البيانات" };
  
  // التحقق من عدم وجود العميل مسبقاً
  const existing = await db.select()
    .from(loyaltyCustomers)
    .where(eq(loyaltyCustomers.phone, data.phone))
    .limit(1);
  
  if (existing.length > 0) {
    return { success: false, error: "رقم الجوال مسجل مسبقاً في برنامج الولاء" };
  }
  
  const customerId = await generateLoyaltyCustomerId();
  
  await db.insert(loyaltyCustomers).values({
    customerId,
    name: data.name,
    phone: data.phone,
    email: data.email || null,
    branchId: data.branchId || null,
    branchName: data.branchName || null,
    totalVisits: 0,
    totalDiscountsUsed: 0,
    isActive: true,
  });
  
  const customer = await db.select()
    .from(loyaltyCustomers)
    .where(eq(loyaltyCustomers.customerId, customerId))
    .limit(1);
  
  return { success: true, customer: customer[0] };
}

// البحث عن عميل برقم الجوال
export async function getLoyaltyCustomerByPhone(phone: string): Promise<LoyaltyCustomer | null> {
  const db = await getDb();
  if (!db) return null;
  
  const customer = await db.select()
    .from(loyaltyCustomers)
    .where(eq(loyaltyCustomers.phone, phone))
    .limit(1);
  
  return customer.length > 0 ? customer[0] : null;
}

// الحصول على عميل بالمعرف
export async function getLoyaltyCustomerById(id: number): Promise<LoyaltyCustomer | null> {
  const db = await getDb();
  if (!db) return null;
  
  const customer = await db.select()
    .from(loyaltyCustomers)
    .where(eq(loyaltyCustomers.id, id))
    .limit(1);
  
  return customer.length > 0 ? customer[0] : null;
}

// الحصول على زيارات العميل في الشهر الحالي
export async function getCustomerVisitsThisMonth(customerId: number): Promise<LoyaltyVisit[]> {
  const db = await getDb();
  if (!db) return [];
  
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  
  // مهم: نحسب الزيارات الموافق عليها فقط (approved)
  // الزيارات المعلقة (pending) والمرفوضة (rejected) لا تُحتسب
  return await db.select()
    .from(loyaltyVisits)
    .where(and(
      eq(loyaltyVisits.customerId, customerId),
      eq(loyaltyVisits.status, 'approved'),
      gte(loyaltyVisits.visitDate, startOfMonth),
      lte(loyaltyVisits.visitDate, endOfMonth)
    ))
    .orderBy(loyaltyVisits.visitDate);
}

// تسجيل زيارة جديدة
export async function registerLoyaltyVisit(data: {
  customerId: number;
  customerName: string;
  customerPhone: string;
  serviceType: string;
  branchId?: number;
  branchName?: string;
  invoiceImageUrl?: string;
  invoiceImageKey?: string;
}): Promise<{ 
  success: boolean; 
  visit?: LoyaltyVisit; 
  isDiscountVisit: boolean;
  discountPercentage: number;
  visitNumberInMonth: number;
  error?: string;
}> {
  const db = await getDb();
  if (!db) return { success: false, isDiscountVisit: false, discountPercentage: 0, visitNumberInMonth: 0, error: "خطأ في الاتصال بقاعدة البيانات" };
  
  // التحقق من عدم وجود زيارة سابقة في نفس اليوم
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  
  const existingVisitToday = await db.select()
    .from(loyaltyVisits)
    .where(
      and(
        eq(loyaltyVisits.customerId, data.customerId),
        gte(loyaltyVisits.visitDate, startOfDay),
        lt(loyaltyVisits.visitDate, endOfDay)
      )
    )
    .limit(1);
  
  if (existingVisitToday.length > 0) {
    return { 
      success: false, 
      isDiscountVisit: false, 
      discountPercentage: 0, 
      visitNumberInMonth: 0, 
      error: "لقد سجلت زيارة اليوم بالفعل. يمكنك تسجيل زيارة جديدة غداً." 
    };
  }
  
  // الحصول على زيارات الشهر الحالي
  const visitsThisMonth = await getCustomerVisitsThisMonth(data.customerId);
  const visitNumberInMonth = visitsThisMonth.length + 1;
  
  // التحقق من استحقاق الخصم (الزيارة الثالثة وكل زيارة ثالثة بعدها)
  const isDiscountVisit = visitNumberInMonth % 3 === 0;
  const discountPercentage = isDiscountVisit ? 60 : 0;
  
  const visitId = await generateLoyaltyVisitId();
  
  await db.insert(loyaltyVisits).values({
    visitId,
    customerId: data.customerId,
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    serviceType: data.serviceType,
    visitDate: new Date(),
    branchId: data.branchId || null,
    branchName: data.branchName || null,
    invoiceImageUrl: data.invoiceImageUrl || null,
    invoiceImageKey: data.invoiceImageKey || null,
    status: 'pending', // الزيارة تحتاج موافقة
    isDiscountVisit,
    discountPercentage,
    visitNumberInMonth,
  });
  
  // ملاحظة مهمة: لا نحدّث totalVisits هنا
  // سيتم التحديث فقط عند الموافقة على الزيارة (approveVisit)
  // إذا تم رفض الزيارة، لن تُحتسب في الإجمالي أبداً
  
  const visit = await db.select()
    .from(loyaltyVisits)
    .where(eq(loyaltyVisits.visitId, visitId))
    .limit(1);
  
  return { 
    success: true, 
    visit: visit[0], 
    isDiscountVisit, 
    discountPercentage,
    visitNumberInMonth
  };
}

// الحصول على جميع عملاء الولاء
export async function getAllLoyaltyCustomers(): Promise<LoyaltyCustomer[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(loyaltyCustomers)
    .orderBy(desc(loyaltyCustomers.createdAt));
}

// الحصول على زيارات عميل معين
export async function getCustomerVisits(customerId: number): Promise<LoyaltyVisit[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(loyaltyVisits)
    .where(eq(loyaltyVisits.customerId, customerId))
    .orderBy(desc(loyaltyVisits.visitDate));
}

// الحصول على إحصائيات برنامج الولاء
export async function getLoyaltyStats(): Promise<{
  totalCustomers: number;
  totalVisits: number;
  totalDiscountsGiven: number;
  customersThisMonth: number;
  visitsThisMonth: number;
}> {
  const db = await getDb();
  if (!db) return { totalCustomers: 0, totalVisits: 0, totalDiscountsGiven: 0, customersThisMonth: 0, visitsThisMonth: 0 };
  
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const customers = await db.select({ count: sql<number>`count(*)` })
    .from(loyaltyCustomers);
  
  // مهم: نحسب الزيارات الموافق عليها فقط (approved)
  const visits = await db.select({ count: sql<number>`count(*)` })
    .from(loyaltyVisits)
    .where(eq(loyaltyVisits.status, 'approved'));
  
  // الخصومات الموافق عليها فقط
  const discounts = await db.select({ count: sql<number>`count(*)` })
    .from(loyaltyVisits)
    .where(and(
      eq(loyaltyVisits.isDiscountVisit, true),
      eq(loyaltyVisits.status, 'approved')
    ));
  
  const customersThisMonth = await db.select({ count: sql<number>`count(*)` })
    .from(loyaltyCustomers)
    .where(gte(loyaltyCustomers.createdAt, startOfMonth));
  
  // زيارات الشهر الموافق عليها فقط
  const visitsThisMonth = await db.select({ count: sql<number>`count(*)` })
    .from(loyaltyVisits)
    .where(and(
      gte(loyaltyVisits.visitDate, startOfMonth),
      eq(loyaltyVisits.status, 'approved')
    ));
  
  return {
    totalCustomers: Number(customers[0]?.count || 0),
    totalVisits: Number(visits[0]?.count || 0),
    totalDiscountsGiven: Number(discounts[0]?.count || 0),
    customersThisMonth: Number(customersThisMonth[0]?.count || 0),
    visitsThisMonth: Number(visitsThisMonth[0]?.count || 0),
  };
}

// الحصول على المشرفين والأدمن لإرسال الإشعارات
export async function getAdminsAndSupervisors(): Promise<Array<{ id: number; name: string | null; email: string | null; role: string }>> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
  })
    .from(users)
    .where(or(
      eq(users.role, 'admin'),
      eq(users.role, 'manager'),
      eq(users.role, 'supervisor')
    ));
}


// ==================== دوال إعدادات نظام الولاء ====================

// الحصول على إعدادات الولاء
export async function getLoyaltySettings(): Promise<{
  requiredVisitsForDiscount: number;
  discountPercentage: number;
}> {
  const db = await getDb();
  if (!db) return { requiredVisitsForDiscount: 3, discountPercentage: 60 };
  
  const { loyaltySettings } = await import('../drizzle/schema');
  const settings = await db.select().from(loyaltySettings).limit(1);
  
  if (settings.length === 0) {
    // إنشاء إعدادات افتراضية
    await db.insert(loyaltySettings).values({
      requiredVisitsForDiscount: 3,
      discountPercentage: 60,
    });
    return { requiredVisitsForDiscount: 3, discountPercentage: 60 };
  }
  
  return {
    requiredVisitsForDiscount: settings[0].requiredVisitsForDiscount,
    discountPercentage: settings[0].discountPercentage,
  };
}

// تحديث إعدادات الولاء
export async function updateLoyaltySettings(data: {
  requiredVisitsForDiscount: number;
  discountPercentage: number;
}): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "خطأ في الاتصال بقاعدة البيانات" };
  
  const { loyaltySettings } = await import('../drizzle/schema');
  const settings = await db.select().from(loyaltySettings).limit(1);
  
  if (settings.length === 0) {
    // إنشاء إعدادات جديدة
    await db.insert(loyaltySettings).values({
      requiredVisitsForDiscount: data.requiredVisitsForDiscount,
      discountPercentage: data.discountPercentage,
    });
  } else {
    // تحديث الإعدادات الموجودة
    await db.update(loyaltySettings)
      .set({
        requiredVisitsForDiscount: data.requiredVisitsForDiscount,
        discountPercentage: data.discountPercentage,
      })
      .where(eq(loyaltySettings.id, settings[0].id));
  }
  
  return { success: true };
}

// الحصول على أنواع الخدمات
export async function getLoyaltyServiceTypes(): Promise<Array<{
  id: number;
  name: string;
  isActive: boolean;
  sortOrder: number;
}>> {
  const db = await getDb();
  if (!db) return [];
  
  const { loyaltyServiceTypes } = await import('../drizzle/schema');
  const { asc } = await import('drizzle-orm');
  
  const types = await db.select().from(loyaltyServiceTypes).orderBy(asc(loyaltyServiceTypes.sortOrder));
  
  // إذا لم توجد خدمات، إنشاء الخدمات الافتراضية
  if (types.length === 0) {
    const defaultServices = [
      { name: 'حلاقة شعر', sortOrder: 1 },
      { name: 'حلاقة ذقن', sortOrder: 2 },
      { name: 'قص + حلاقة', sortOrder: 3 },
      { name: 'حلاقة رأس + شعر', sortOrder: 4 },
      { name: 'صبغة شعر', sortOrder: 5 },
      { name: 'علاج شعر', sortOrder: 6 },
      { name: 'تنظيف بشرة', sortOrder: 7 },
      { name: 'أخرى', sortOrder: 8 },
    ];
    
    for (const service of defaultServices) {
      await db.insert(loyaltyServiceTypes).values(service);
    }
    
    return await db.select().from(loyaltyServiceTypes).orderBy(asc(loyaltyServiceTypes.sortOrder));
  }
  
  return types;
}

// إضافة نوع خدمة جديد
export async function addLoyaltyServiceType(data: {
  name: string;
  sortOrder?: number;
}): Promise<{ success: boolean; id?: number; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "خطأ في الاتصال بقاعدة البيانات" };
  
  const { loyaltyServiceTypes } = await import('../drizzle/schema');
  const { max } = await import('drizzle-orm');
  
  // الحصول على أعلى ترتيب
  const maxOrder = await db.select({ max: max(loyaltyServiceTypes.sortOrder) }).from(loyaltyServiceTypes);
  const sortOrder = data.sortOrder || (Number(maxOrder[0]?.max || 0) + 1);
  
  const result = await db.insert(loyaltyServiceTypes).values({
    name: data.name,
    sortOrder,
  });
  
  return { success: true, id: Number(result[0].insertId) };
}

// تحديث نوع خدمة
export async function updateLoyaltyServiceType(data: {
  id: number;
  name: string;
  isActive?: boolean;
  sortOrder?: number;
}): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "خطأ في الاتصال بقاعدة البيانات" };
  
  const { loyaltyServiceTypes } = await import('../drizzle/schema');
  
  await db.update(loyaltyServiceTypes)
    .set({
      name: data.name,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder,
    })
    .where(eq(loyaltyServiceTypes.id, data.id));
  
  return { success: true };
}

// حذف نوع خدمة
export async function deleteLoyaltyServiceType(id: number): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "خطأ في الاتصال بقاعدة البيانات" };
  
  const { loyaltyServiceTypes } = await import('../drizzle/schema');
  
  await db.delete(loyaltyServiceTypes).where(eq(loyaltyServiceTypes.id, id));
  
  return { success: true };
}


// ==================== دوال إدارة زيارات الولاء ====================

// الحصول على عملاء الولاء حسب الفرع (للمشرفين)
export async function getLoyaltyCustomersByBranch(branchId: number): Promise<LoyaltyCustomer[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(loyaltyCustomers)
    .where(eq(loyaltyCustomers.branchId, branchId))
    .orderBy(desc(loyaltyCustomers.createdAt));
}

// الحصول على زيارات الولاء حسب الفرع (للمشرفين)
export async function getLoyaltyVisitsByBranch(branchId: number): Promise<LoyaltyVisit[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(loyaltyVisits)
    .where(eq(loyaltyVisits.branchId, branchId))
    .orderBy(desc(loyaltyVisits.visitDate));
}

// الحصول على الزيارات المعلقة حسب الفرع
export async function getPendingVisitsByBranch(branchId: number): Promise<LoyaltyVisit[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(loyaltyVisits)
    .where(
      and(
        eq(loyaltyVisits.branchId, branchId),
        eq(loyaltyVisits.status, 'pending')
      )
    )
    .orderBy(desc(loyaltyVisits.visitDate));
}

// الحصول على جميع الزيارات المعلقة (للأدمن)
export async function getAllPendingVisits(): Promise<LoyaltyVisit[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(loyaltyVisits)
    .where(eq(loyaltyVisits.status, 'pending'))
    .orderBy(desc(loyaltyVisits.visitDate));
}

// الموافقة على زيارة
export async function approveVisit(visitId: number, approvedBy: number): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "خطأ في الاتصال بقاعدة البيانات" };
  
  // الحصول على بيانات الزيارة قبل التحديث
  const visit = await db.select()
    .from(loyaltyVisits)
    .where(eq(loyaltyVisits.id, visitId))
    .limit(1);
  
  if (!visit || visit.length === 0) {
    return { success: false, error: "الزيارة غير موجودة" };
  }
  
  const visitData = visit[0];
  
  // تحديث حالة الزيارة
  await db.update(loyaltyVisits)
    .set({
      status: 'approved',
      approvedBy,
      approvedAt: new Date(),
    })
    .where(eq(loyaltyVisits.id, visitId));
  
  // تحديث عدد الزيارات للعميل عند الموافقة فقط
  if (visitData.isDiscountVisit) {
    await db.update(loyaltyCustomers)
      .set({ 
        totalVisits: sql`${loyaltyCustomers.totalVisits} + 1`,
        totalDiscountsUsed: sql`${loyaltyCustomers.totalDiscountsUsed} + 1`
      })
      .where(eq(loyaltyCustomers.id, visitData.customerId));
  } else {
    await db.update(loyaltyCustomers)
      .set({ 
        totalVisits: sql`${loyaltyCustomers.totalVisits} + 1`
      })
      .where(eq(loyaltyCustomers.id, visitData.customerId));
  }
  
  return { success: true };
}

// رفض زيارة
export async function rejectVisit(visitId: number, approvedBy: number, reason: string): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "خطأ في الاتصال بقاعدة البيانات" };
  
  // ملاحظة: لا نحدث totalVisits عند الرفض
  // الزيارة المرفوضة لم تُحتسب أصلاً (كانت pending فقط)
  await db.update(loyaltyVisits)
    .set({
      status: 'rejected',
      approvedBy,
      approvedAt: new Date(),
      rejectionReason: reason,
    })
    .where(eq(loyaltyVisits.id, visitId));
  
  return { success: true };
}

// الحصول على تفاصيل زيارة
export async function getVisitById(visitId: number): Promise<LoyaltyVisit | null> {
  const db = await getDb();
  if (!db) return null;
  
  const visit = await db.select()
    .from(loyaltyVisits)
    .where(eq(loyaltyVisits.id, visitId))
    .limit(1);
  
  return visit[0] || null;
}


// ==================== تقارير برنامج الولاء المتقدمة ====================

// إحصائيات برنامج الولاء الشاملة
export async function getLoyaltyDetailedStats(filters?: {
  period?: 'week' | 'month' | 'quarter' | 'year' | 'all';
  branchId?: number;
}): Promise<{
  overview: {
    totalCustomers: number;
    totalVisits: number;
    totalDiscounts: number;
    discountValue: number;
    periodCustomers: number;
    periodVisits: number;
    periodDiscounts: number;
    previousPeriodCustomers: number;
    previousPeriodVisits: number;
    previousPeriodDiscounts: number;
    customersChange: number;
    visitsChange: number;
    discountsChange: number;
    daysInPeriod: number;
  };
  byBranch: Array<{
    branchId: number;
    branchName: string;
    customers: number;
    visits: number;
    discounts: number;
    pendingVisits: number;
  }>;
  byService: Array<{
    serviceType: string;
    visits: number;
    percentage: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    customers: number;
    visits: number;
    discounts: number;
  }>;
  recentActivity: Array<{
    type: 'registration' | 'visit' | 'discount';
    customerName: string;
    branchName: string | null;
    date: Date;
    details: string;
  }>;
}> {
  const db = await getDb();
  if (!db) {
    return {
      overview: { totalCustomers: 0, totalVisits: 0, totalDiscounts: 0, discountValue: 0, periodCustomers: 0, periodVisits: 0, periodDiscounts: 0, previousPeriodCustomers: 0, previousPeriodVisits: 0, previousPeriodDiscounts: 0, customersChange: 0, visitsChange: 0, discountsChange: 0, daysInPeriod: 0 },
      byBranch: [],
      byService: [],
      monthlyTrend: [],
      recentActivity: [],
    };
  }

  const now = new Date();
  const period = filters?.period || 'month';
  
  // حساب بداية ونهاية الفترة الحالية
  let periodStart: Date;
  let periodEnd: Date = now;
  let previousPeriodStart: Date;
  let previousPeriodEnd: Date;
  
  switch (period) {
    case 'week':
      periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      previousPeriodStart = new Date(periodStart.getTime() - 7 * 24 * 60 * 60 * 1000);
      previousPeriodEnd = new Date(periodStart.getTime() - 1);
      break;
    case 'month':
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousPeriodEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      break;
    case 'quarter':
      const currentQuarter = Math.floor(now.getMonth() / 3);
      periodStart = new Date(now.getFullYear(), currentQuarter * 3, 1);
      previousPeriodStart = new Date(now.getFullYear(), (currentQuarter - 1) * 3, 1);
      previousPeriodEnd = new Date(now.getFullYear(), currentQuarter * 3, 0, 23, 59, 59);
      break;
    case 'year':
      periodStart = new Date(now.getFullYear(), 0, 1);
      previousPeriodStart = new Date(now.getFullYear() - 1, 0, 1);
      previousPeriodEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
      break;
    default: // all
      periodStart = new Date(2020, 0, 1);
      previousPeriodStart = new Date(2020, 0, 1);
      previousPeriodEnd = new Date(2020, 0, 1);
  }
  
  const daysInPeriod = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));

  // ============================================
  // 1. الإحصائيات العامة
  // ============================================
  
  // إجمالي العملاء
  let customersQuery = db.select({ count: sql<number>`count(*)` }).from(loyaltyCustomers);
  if (filters?.branchId) {
    customersQuery = customersQuery.where(eq(loyaltyCustomers.branchId, filters.branchId)) as any;
  }
  const totalCustomersResult = await customersQuery;
  const totalCustomers = Number(totalCustomersResult[0]?.count || 0);

  // إجمالي الزيارات (الموافق عليها فقط)
  const totalVisitsConditions = filters?.branchId
    ? and(
        eq(loyaltyVisits.status, 'approved'),
        eq(loyaltyVisits.branchId, filters.branchId)
      )
    : eq(loyaltyVisits.status, 'approved');
  
  const totalVisitsResult = await db.select({ count: sql<number>`count(*)` })
    .from(loyaltyVisits)
    .where(totalVisitsConditions);
  const totalVisits = Number(totalVisitsResult[0]?.count || 0);

  // إجمالي الخصومات (الموافق عليها فقط)
  const discountsConditions = filters?.branchId
    ? and(
        eq(loyaltyVisits.isDiscountVisit, true),
        eq(loyaltyVisits.status, 'approved'),
        eq(loyaltyVisits.branchId, filters.branchId)
      )
    : and(
        eq(loyaltyVisits.isDiscountVisit, true),
        eq(loyaltyVisits.status, 'approved')
      );
  
  const totalDiscountsResult = await db.select({ count: sql<number>`count(*)` })
    .from(loyaltyVisits)
    .where(discountsConditions);
  const totalDiscounts = Number(totalDiscountsResult[0]?.count || 0);

  // عملاء الفترة الحالية
  const periodCustomersConditions = filters?.branchId
    ? and(
        gte(loyaltyCustomers.createdAt, periodStart),
        lte(loyaltyCustomers.createdAt, periodEnd),
        eq(loyaltyCustomers.branchId, filters.branchId)
      )
    : and(
        gte(loyaltyCustomers.createdAt, periodStart),
        lte(loyaltyCustomers.createdAt, periodEnd)
      );
  
  const periodCustomersResult = await db.select({ count: sql<number>`count(*)` })
    .from(loyaltyCustomers)
    .where(periodCustomersConditions);
  const periodCustomers = Number(periodCustomersResult[0]?.count || 0);

  // زيارات الفترة الحالية (الموافق عليها فقط)
  const periodVisitsConditions = filters?.branchId
    ? and(
        eq(loyaltyVisits.status, 'approved'),
        gte(loyaltyVisits.visitDate, periodStart),
        lte(loyaltyVisits.visitDate, periodEnd),
        eq(loyaltyVisits.branchId, filters.branchId)
      )
    : and(
        eq(loyaltyVisits.status, 'approved'),
        gte(loyaltyVisits.visitDate, periodStart),
        lte(loyaltyVisits.visitDate, periodEnd)
      );
  
  const periodVisitsResult = await db.select({ count: sql<number>`count(*)` })
    .from(loyaltyVisits)
    .where(periodVisitsConditions);
  const periodVisits = Number(periodVisitsResult[0]?.count || 0);

  // خصومات الفترة الحالية (الموافق عليها فقط)
  const periodDiscountsConditions = filters?.branchId
    ? and(
        eq(loyaltyVisits.isDiscountVisit, true),
        eq(loyaltyVisits.status, 'approved'),
        gte(loyaltyVisits.visitDate, periodStart),
        lte(loyaltyVisits.visitDate, periodEnd),
        eq(loyaltyVisits.branchId, filters.branchId)
      )
    : and(
        eq(loyaltyVisits.isDiscountVisit, true),
        eq(loyaltyVisits.status, 'approved'),
        gte(loyaltyVisits.visitDate, periodStart),
        lte(loyaltyVisits.visitDate, periodEnd)
      );
  
  const periodDiscountsResult = await db.select({ count: sql<number>`count(*)` })
    .from(loyaltyVisits)
    .where(periodDiscountsConditions);
  const periodDiscounts = Number(periodDiscountsResult[0]?.count || 0);

  // عملاء الفترة السابقة
  const prevPeriodCustomersConditions = filters?.branchId
    ? and(
        gte(loyaltyCustomers.createdAt, previousPeriodStart),
        lte(loyaltyCustomers.createdAt, previousPeriodEnd),
        eq(loyaltyCustomers.branchId, filters.branchId)
      )
    : and(
        gte(loyaltyCustomers.createdAt, previousPeriodStart),
        lte(loyaltyCustomers.createdAt, previousPeriodEnd)
      );
  
  const prevPeriodCustomersResult = await db.select({ count: sql<number>`count(*)` })
    .from(loyaltyCustomers)
    .where(prevPeriodCustomersConditions);
  const previousPeriodCustomers = Number(prevPeriodCustomersResult[0]?.count || 0);

  // زيارات الفترة السابقة (الموافق عليها فقط)
  const prevPeriodVisitsConditions = filters?.branchId
    ? and(
        eq(loyaltyVisits.status, 'approved'),
        gte(loyaltyVisits.visitDate, previousPeriodStart),
        lte(loyaltyVisits.visitDate, previousPeriodEnd),
        eq(loyaltyVisits.branchId, filters.branchId)
      )
    : and(
        eq(loyaltyVisits.status, 'approved'),
        gte(loyaltyVisits.visitDate, previousPeriodStart),
        lte(loyaltyVisits.visitDate, previousPeriodEnd)
      );
  
  const prevPeriodVisitsResult = await db.select({ count: sql<number>`count(*)` })
    .from(loyaltyVisits)
    .where(prevPeriodVisitsConditions);
  const previousPeriodVisits = Number(prevPeriodVisitsResult[0]?.count || 0);

  // خصومات الفترة السابقة (الموافق عليها فقط)
  const prevPeriodDiscountsConditions = filters?.branchId
    ? and(
        eq(loyaltyVisits.isDiscountVisit, true),
        eq(loyaltyVisits.status, 'approved'),
        gte(loyaltyVisits.visitDate, previousPeriodStart),
        lte(loyaltyVisits.visitDate, previousPeriodEnd),
        eq(loyaltyVisits.branchId, filters.branchId)
      )
    : and(
        eq(loyaltyVisits.isDiscountVisit, true),
        eq(loyaltyVisits.status, 'approved'),
        gte(loyaltyVisits.visitDate, previousPeriodStart),
        lte(loyaltyVisits.visitDate, previousPeriodEnd)
      );
  
  const prevPeriodDiscountsResult = await db.select({ count: sql<number>`count(*)` })
    .from(loyaltyVisits)
    .where(prevPeriodDiscountsConditions);
  const previousPeriodDiscounts = Number(prevPeriodDiscountsResult[0]?.count || 0);

  // حساب نسبة التغيير
  const calculateChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100 * 10) / 10;
  };

  const customersChange = calculateChange(periodCustomers, previousPeriodCustomers);
  const visitsChange = calculateChange(periodVisits, previousPeriodVisits);
  const discountsChange = calculateChange(periodDiscounts, previousPeriodDiscounts);

  // ============================================
  // 2. إحصائيات حسب الفرع
  // ============================================
  const { branches } = await import('../drizzle/schema');
  const allBranches = await db.select().from(branches);
  
  const byBranch: Array<{
    branchId: number;
    branchName: string;
    customers: number;
    visits: number;
    discounts: number;
    pendingVisits: number;
  }> = [];

  for (const branch of allBranches) {
    const branchCustomers = await db.select({ count: sql<number>`count(*)` })
      .from(loyaltyCustomers)
      .where(eq(loyaltyCustomers.branchId, branch.id));
    
    // زيارات الفرع (الموافق عليها فقط)
    const branchVisits = await db.select({ count: sql<number>`count(*)` })
      .from(loyaltyVisits)
      .where(and(
        eq(loyaltyVisits.branchId, branch.id),
        eq(loyaltyVisits.status, 'approved')
      ));
    
    // خصومات الفرع (الموافق عليها فقط)
    const branchDiscounts = await db.select({ count: sql<number>`count(*)` })
      .from(loyaltyVisits)
      .where(
        and(
          eq(loyaltyVisits.branchId, branch.id),
          eq(loyaltyVisits.isDiscountVisit, true),
          eq(loyaltyVisits.status, 'approved')
        )
      );
    
    const branchPending = await db.select({ count: sql<number>`count(*)` })
      .from(loyaltyVisits)
      .where(
        and(
          eq(loyaltyVisits.branchId, branch.id),
          eq(loyaltyVisits.status, 'pending')
        )
      );

    byBranch.push({
      branchId: branch.id,
      branchName: branch.name,
      customers: Number(branchCustomers[0]?.count || 0),
      visits: Number(branchVisits[0]?.count || 0),
      discounts: Number(branchDiscounts[0]?.count || 0),
      pendingVisits: Number(branchPending[0]?.count || 0),
    });
  }

  // ============================================
  // 3. إحصائيات حسب نوع الخدمة (الموافق عليها فقط)
  // ============================================
  const serviceStats = await db.select({
    serviceType: loyaltyVisits.serviceType,
    count: sql<number>`count(*)`,
  })
    .from(loyaltyVisits)
    .where(eq(loyaltyVisits.status, 'approved'))
    .groupBy(loyaltyVisits.serviceType)
    .orderBy(sql`count(*) DESC`);

  const byService = serviceStats.map(s => ({
    serviceType: s.serviceType,
    visits: Number(s.count),
    percentage: totalVisits > 0 ? Math.round((Number(s.count) / totalVisits) * 100) : 0,
  }));

  // ============================================
  // 4. الاتجاه الشهري (آخر 6 أشهر)
  // ============================================
  const monthlyTrend: Array<{
    month: string;
    customers: number;
    visits: number;
    discounts: number;
  }> = [];

  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    
    const monthCustomers = await db.select({ count: sql<number>`count(*)` })
      .from(loyaltyCustomers)
      .where(
        and(
          gte(loyaltyCustomers.createdAt, monthStart),
          lte(loyaltyCustomers.createdAt, monthEnd)
        )
      );
    
    // زيارات الشهر (الموافق عليها فقط)
    const monthVisits = await db.select({ count: sql<number>`count(*)` })
      .from(loyaltyVisits)
      .where(
        and(
          eq(loyaltyVisits.status, 'approved'),
          gte(loyaltyVisits.visitDate, monthStart),
          lte(loyaltyVisits.visitDate, monthEnd)
        )
      );
    
    // خصومات الشهر (الموافق عليها فقط)
    const monthDiscounts = await db.select({ count: sql<number>`count(*)` })
      .from(loyaltyVisits)
      .where(
        and(
          eq(loyaltyVisits.isDiscountVisit, true),
          eq(loyaltyVisits.status, 'approved'),
          gte(loyaltyVisits.visitDate, monthStart),
          lte(loyaltyVisits.visitDate, monthEnd)
        )
      );

    const monthName = monthStart.toLocaleDateString('ar-SA', { month: 'short', year: 'numeric' });
    
    monthlyTrend.push({
      month: monthName,
      customers: Number(monthCustomers[0]?.count || 0),
      visits: Number(monthVisits[0]?.count || 0),
      discounts: Number(monthDiscounts[0]?.count || 0),
    });
  }

  // ============================================
  // 5. النشاط الأخير
  // ============================================
  const recentCustomers = await db.select()
    .from(loyaltyCustomers)
    .orderBy(desc(loyaltyCustomers.createdAt))
    .limit(5);

  const recentVisits = await db.select()
    .from(loyaltyVisits)
    .orderBy(desc(loyaltyVisits.visitDate))
    .limit(10);

  const recentActivity: Array<{
    type: 'registration' | 'visit' | 'discount';
    customerName: string;
    branchName: string | null;
    date: Date;
    details: string;
  }> = [];

  for (const customer of recentCustomers) {
    recentActivity.push({
      type: 'registration',
      customerName: customer.name,
      branchName: customer.branchName,
      date: customer.createdAt,
      details: `تسجيل عميل جديد: ${customer.name}`,
    });
  }

  for (const visit of recentVisits) {
    recentActivity.push({
      type: visit.isDiscountVisit ? 'discount' : 'visit',
      customerName: visit.customerName,
      branchName: visit.branchName,
      date: visit.visitDate,
      details: visit.isDiscountVisit 
        ? `زيارة بخصم ${visit.discountPercentage}%` 
        : `زيارة رقم ${visit.visitNumberInMonth}`,
    });
  }

  // ترتيب حسب التاريخ
  recentActivity.sort((a, b) => b.date.getTime() - a.date.getTime());

  return {
    overview: {
      totalCustomers,
      totalVisits,
      totalDiscounts,
      discountValue: totalDiscounts * 60, // قيمة تقريبية بناءً على نسبة الخصم
      periodCustomers,
      periodVisits,
      periodDiscounts,
      previousPeriodCustomers,
      previousPeriodVisits,
      previousPeriodDiscounts,
      customersChange,
      visitsChange,
      discountsChange,
      daysInPeriod,
    },
    byBranch,
    byService,
    monthlyTrend,
    recentActivity: recentActivity.slice(0, 15),
  };
}

// إحصائيات فرع محدد
export async function getBranchLoyaltyStats(branchId: number): Promise<{
  customers: number;
  visits: number;
  discounts: number;
  pendingVisits: number;
  topCustomers: Array<{
    id: number;
    name: string;
    phone: string;
    totalVisits: number;
    totalDiscounts: number;
  }>;
}> {
  const db = await getDb();
  if (!db) {
    return { customers: 0, visits: 0, discounts: 0, pendingVisits: 0, topCustomers: [] };
  }

  const customersResult = await db.select({ count: sql<number>`count(*)` })
    .from(loyaltyCustomers)
    .where(eq(loyaltyCustomers.branchId, branchId));

  // الزيارات الموافق عليها فقط
  const visitsResult = await db.select({ count: sql<number>`count(*)` })
    .from(loyaltyVisits)
    .where(and(
      eq(loyaltyVisits.branchId, branchId),
      eq(loyaltyVisits.status, 'approved')
    ));

  // الخصومات الموافق عليها فقط
  const discountsResult = await db.select({ count: sql<number>`count(*)` })
    .from(loyaltyVisits)
    .where(
      and(
        eq(loyaltyVisits.branchId, branchId),
        eq(loyaltyVisits.isDiscountVisit, true),
        eq(loyaltyVisits.status, 'approved')
      )
    );

  const pendingResult = await db.select({ count: sql<number>`count(*)` })
    .from(loyaltyVisits)
    .where(
      and(
        eq(loyaltyVisits.branchId, branchId),
        eq(loyaltyVisits.status, 'pending')
      )
    );

  // أفضل العملاء
  const topCustomers = await db.select()
    .from(loyaltyCustomers)
    .where(eq(loyaltyCustomers.branchId, branchId))
    .orderBy(desc(loyaltyCustomers.totalVisits))
    .limit(10);

  return {
    customers: Number(customersResult[0]?.count || 0),
    visits: Number(visitsResult[0]?.count || 0),
    discounts: Number(discountsResult[0]?.count || 0),
    pendingVisits: Number(pendingResult[0]?.count || 0),
    topCustomers: topCustomers.map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      totalVisits: c.totalVisits,
      totalDiscounts: c.totalDiscountsUsed,
    })),
  };
}


// ==================== دوال حساب الإيرادات الأسبوعية (من sync2.ts) ====================

/**
 * الحصول على إيرادات الفرع للأسبوع بشكل تفصيلي
 */
export async function getBranchWeeklyRevenue(
  branchId: number,
  weekStart: Date,
  weekEnd: Date
): Promise<{ total: number; enteredDates: Date[]; dailyBreakdown: Array<{ date: Date; revenue: number }> }> {
  const db = await getDb();
  if (!db) return { total: 0, enteredDates: [], dailyBreakdown: [] };

  const result = await db
    .select({
      date: dailyRevenues.date,
      revenue: dailyRevenues.total,
    })
    .from(dailyRevenues)
    .where(
      and(
        eq(dailyRevenues.branchId, branchId),
        gte(dailyRevenues.date, weekStart),
        lte(dailyRevenues.date, weekEnd)
      )
    )
    .orderBy(dailyRevenues.date);

  const dailyBreakdown = result.map((r) => ({
    date: new Date(r.date),
    revenue: Number(r.revenue || 0),
  }));

  const total = dailyBreakdown.reduce((sum, d) => sum + d.revenue, 0);
  const enteredDates = dailyBreakdown.map((d) => d.date);

  return { total, enteredDates, dailyBreakdown };
}

/**
 * الحصول على إيرادات جميع الموظفين للأسبوع (Batch Query)
 */
export async function getAllEmployeesWeeklyRevenues(
  branchId: number,
  weekStart: Date,
  weekEnd: Date
): Promise<Map<number, { revenue: number; enteredDates: Date[] }>> {
  const db = await getDb();
  if (!db) return new Map();

  const result = await db
    .select({
      employeeId: employeeRevenues.employeeId,
      total: employeeRevenues.total,
      date: dailyRevenues.date,
    })
    .from(employeeRevenues)
    .innerJoin(
      dailyRevenues,
      eq(employeeRevenues.dailyRevenueId, dailyRevenues.id)
    )
    .where(
      and(
        eq(dailyRevenues.branchId, branchId),
        gte(dailyRevenues.date, weekStart),
        lte(dailyRevenues.date, weekEnd)
      )
    );

  // تجميع البيانات حسب الموظف
  const employeeMap = new Map<
    number,
    { revenue: number; enteredDates: Date[] }
  >();

  for (const row of result) {
    const existing = employeeMap.get(row.employeeId) || {
      revenue: 0,
      enteredDates: [],
    };
    existing.revenue += Number(row.total || 0);
    existing.enteredDates.push(new Date(row.date));
    employeeMap.set(row.employeeId, existing);
  }

  return employeeMap;
}

/**
 * الحصول على مجموع إيرادات جميع الموظفين
 */
export async function getTotalEmployeesRevenue(
  branchId: number,
  weekStart: Date,
  weekEnd: Date
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const result = await db
    .select({
      total: sql<string>`COALESCE(SUM(${employeeRevenues.total}), 0)`,
    })
    .from(employeeRevenues)
    .innerJoin(
      dailyRevenues,
      eq(employeeRevenues.dailyRevenueId, dailyRevenues.id)
    )
    .where(
      and(
        eq(dailyRevenues.branchId, branchId),
        gte(dailyRevenues.date, weekStart),
        lte(dailyRevenues.date, weekEnd)
      )
    );

  return Number(result[0]?.total || 0);
}


// ==================== دوال سجل تدقيق البونص ====================

/**
 * الحصول على سجل تدقيق البونص
 */
export async function getBonusAuditLogs(filters?: {
  weeklyBonusId?: number;
  branchId?: number;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  let query = db
    .select({
      id: bonusAuditLog.id,
      weeklyBonusId: bonusAuditLog.weeklyBonusId,
      action: bonusAuditLog.action,
      oldStatus: bonusAuditLog.oldStatus,
      newStatus: bonusAuditLog.newStatus,
      performedBy: bonusAuditLog.performedBy,
      performedAt: bonusAuditLog.performedAt,
      details: bonusAuditLog.details,
      userName: users.name,
      weekNumber: weeklyBonuses.weekNumber,
      month: weeklyBonuses.month,
      year: weeklyBonuses.year,
      branchName: branches.name,
    })
    .from(bonusAuditLog)
    .leftJoin(users, eq(bonusAuditLog.performedBy, users.id))
    .leftJoin(weeklyBonuses, eq(bonusAuditLog.weeklyBonusId, weeklyBonuses.id))
    .leftJoin(branches, eq(weeklyBonuses.branchId, branches.id))
    .orderBy(desc(bonusAuditLog.performedAt));

  if (filters?.weeklyBonusId) {
    query = query.where(eq(bonusAuditLog.weeklyBonusId, filters.weeklyBonusId)) as typeof query;
  }

  if (filters?.branchId) {
    query = query.where(eq(weeklyBonuses.branchId, filters.branchId)) as typeof query;
  }

  if (filters?.limit) {
    query = query.limit(filters.limit) as typeof query;
  }

  if (filters?.offset) {
    query = query.offset(filters.offset) as typeof query;
  }

  return await query;
}

/**
 * الكشف عن فروقات البونص - مقارنة الإيرادات المحسوبة مع البونص المسجل
 */
export async function detectBonusDiscrepancies(branchId: number, weekNumber: number, month: number, year: number) {
  const db = await getDb();
  if (!db) return { hasDiscrepancy: false, discrepancies: [], summary: null };

  // الحصول على البونص المسجل
  const weeklyBonus = await db
    .select()
    .from(weeklyBonuses)
    .where(
      and(
        eq(weeklyBonuses.branchId, branchId),
        eq(weeklyBonuses.weekNumber, weekNumber),
        eq(weeklyBonuses.month, month),
        eq(weeklyBonuses.year, year)
      )
    )
    .limit(1);

  if (weeklyBonus.length === 0) {
    return { hasDiscrepancy: false, discrepancies: [], summary: null };
  }

  const bonusRecord = weeklyBonus[0];

  // الحصول على تفاصيل البونص المسجلة
  const registeredDetails = await db
    .select({
      employeeId: bonusDetails.employeeId,
      employeeName: employees.name,
      registeredRevenue: bonusDetails.weeklyRevenue,
      registeredBonus: bonusDetails.bonusAmount,
      bonusTier: bonusDetails.bonusTier,
    })
    .from(bonusDetails)
    .leftJoin(employees, eq(bonusDetails.employeeId, employees.id))
    .where(eq(bonusDetails.weeklyBonusId, bonusRecord.id));

  // حساب تواريخ الأسبوع بشكل صحيح
  // الأسبوع 1: أيام 1-7
  // الأسبوع 2: أيام 8-14
  // الأسبوع 3: أيام 15-21
  // الأسبوع 4: أيام 22-28
  // الأسبوع 5: أيام 29 إلى نهاية الشهر (يوم أو يومين أو ثلاثة حسب الشهر)
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  
  let startDay: number;
  let endDay: number;
  
  switch (weekNumber) {
    case 1:
      startDay = 1;
      endDay = 7;
      break;
    case 2:
      startDay = 8;
      endDay = 14;
      break;
    case 3:
      startDay = 15;
      endDay = 21;
      break;
    case 4:
      startDay = 22;
      endDay = 28;
      break;
    case 5:
      startDay = 29;
      endDay = lastDayOfMonth; // يوم أو يومين أو ثلاثة حسب الشهر
      break;
    default:
      startDay = 1;
      endDay = 7;
  }
  
  const weekStart = new Date(year, month - 1, startDay);
  weekStart.setUTCHours(0, 0, 0, 0);
  const weekEnd = new Date(year, month - 1, endDay);
  weekEnd.setUTCHours(23, 59, 59, 999);

  // الحصول على الإيرادات الفعلية من قاعدة البيانات
  const actualRevenues = await getAllEmployeesWeeklyRevenues(branchId, weekStart, weekEnd);

  const discrepancies: Array<{
    employeeId: number;
    employeeName: string;
    registeredRevenue: number;
    actualRevenue: number;
    revenueDiff: number;
    registeredBonus: number;
    expectedBonus: number;
    bonusDiff: number;
  }> = [];

  // مقارنة كل موظف
  for (const detail of registeredDetails) {
    const actualData = actualRevenues.get(detail.employeeId);
    const actualRevenue = actualData?.revenue || 0;
    const registeredRevenue = Number(detail.registeredRevenue || 0);
    const registeredBonus = Number(detail.registeredBonus || 0);

    // حساب البونص المتوقع بناءً على الإيراد الفعلي
    const { calculateBonus } = await import('./bonus/calculator');
    const expectedBonusCalc = calculateBonus(actualRevenue);
    const expectedBonus = expectedBonusCalc.amount;

    const revenueDiff = actualRevenue - registeredRevenue;
    const bonusDiff = expectedBonus - registeredBonus;

    // إذا كان هناك فرق كبير (أكثر من 1 ريال في الإيراد أو أكثر من 0.5 ريال في البونص)
    if (Math.abs(revenueDiff) > 1 && Math.abs(bonusDiff) > 0.5) {
      discrepancies.push({
        employeeId: detail.employeeId,
        employeeName: detail.employeeName || 'غير محدد',
        registeredRevenue,
        actualRevenue,
        revenueDiff,
        registeredBonus,
        expectedBonus,
        bonusDiff,
      });
    }
  }

  // التحقق من موظفين لديهم إيرادات لكن غير مسجلين في البونص
  for (const [employeeId, data] of Array.from(actualRevenues.entries())) {
    const isRegistered = registeredDetails.some(d => d.employeeId === employeeId);
    if (!isRegistered && data.revenue > 0) {
      const emp = await db.select({ name: employees.name }).from(employees).where(eq(employees.id, employeeId)).limit(1);
      const { calculateBonus } = await import('./bonus/calculator');
      const expectedBonusCalc = calculateBonus(data.revenue);
      
      discrepancies.push({
        employeeId,
        employeeName: emp[0]?.name || 'غير محدد',
        registeredRevenue: 0,
        actualRevenue: data.revenue,
        revenueDiff: data.revenue,
        registeredBonus: 0,
        expectedBonus: expectedBonusCalc.amount,
        bonusDiff: expectedBonusCalc.amount,
      });
    }
  }

  const summary = {
    weeklyBonusId: bonusRecord.id,
    weekNumber,
    month,
    year,
    branchId,
    totalRegisteredBonus: Number(bonusRecord.totalAmount || 0),
    totalExpectedBonus: discrepancies.reduce((sum, d) => sum + d.expectedBonus, 0) + 
      registeredDetails.filter(d => !discrepancies.some(disc => disc.employeeId === d.employeeId))
        .reduce((sum, d) => sum + Number(d.registeredBonus || 0), 0),
    discrepancyCount: discrepancies.length,
  };

  return {
    hasDiscrepancy: discrepancies.length > 0,
    discrepancies,
    summary,
  };
}


// ==================== دوال سجل تغييرات إعدادات الولاء ====================

// الحصول على نوع خدمة بالمعرف
export async function getLoyaltyServiceTypeById(id: number): Promise<{
  id: number;
  name: string;
  isActive: boolean;
  sortOrder: number;
} | null> {
  const db = await getDb();
  if (!db) return null;
  
  const { loyaltyServiceTypes } = await import('../drizzle/schema');
  
  const result = await db.select().from(loyaltyServiceTypes).where(eq(loyaltyServiceTypes.id, id)).limit(1);
  
  return result[0] || null;
}

// إضافة سجل تغيير في إعدادات الولاء
export async function addLoyaltySettingsAuditLog(data: {
  userId: number;
  userName: string;
  changeType: 'settings' | 'service_add' | 'service_update' | 'service_delete';
  oldValues?: string | null;
  newValues?: string | null;
  description?: string | null;
  serviceId?: number | null;
  serviceName?: string | null;
}): Promise<{ success: boolean; id?: number }> {
  const db = await getDb();
  if (!db) return { success: false };
  
  const { loyaltySettingsAuditLog } = await import('../drizzle/schema');
  
  const result = await db.insert(loyaltySettingsAuditLog).values({
    userId: data.userId,
    userName: data.userName,
    changeType: data.changeType,
    oldValues: data.oldValues,
    newValues: data.newValues,
    description: data.description,
    serviceId: data.serviceId,
    serviceName: data.serviceName,
  });
  
  return { success: true, id: Number(result[0].insertId) };
}

// الحصول على سجل تغييرات إعدادات الولاء
export async function getLoyaltySettingsAuditLog(limit: number = 50): Promise<Array<{
  id: number;
  userId: number;
  userName: string;
  changeType: 'settings' | 'service_add' | 'service_update' | 'service_delete';
  oldValues: string | null;
  newValues: string | null;
  description: string | null;
  serviceId: number | null;
  serviceName: string | null;
  createdAt: Date;
}>> {
  const db = await getDb();
  if (!db) return [];
  
  const { loyaltySettingsAuditLog } = await import('../drizzle/schema');
  
  return await db.select()
    .from(loyaltySettingsAuditLog)
    .orderBy(desc(loyaltySettingsAuditLog.createdAt))
    .limit(limit);
}


// ==================== دوال إعدادات مستويات البونص ====================

// الحصول على جميع مستويات البونص
export async function getBonusTierSettings(): Promise<Array<{
  id: number;
  tierKey: string;
  tierName: string;
  minRevenue: string;
  maxRevenue: string | null;
  bonusAmount: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}>> {
  const db = await getDb();
  if (!db) return [];
  
  const { bonusTierSettings } = await import('../drizzle/schema');
  
  return await db.select()
    .from(bonusTierSettings)
    .orderBy(bonusTierSettings.sortOrder);
}

// الحصول على مستويات البونص النشطة فقط
export async function getActiveBonusTiers(): Promise<Array<{
  tierKey: string;
  tierName: string;
  minRevenue: number;
  maxRevenue: number | null;
  bonusAmount: number;
  color: string;
}>> {
  const db = await getDb();
  if (!db) return [];
  
  const { bonusTierSettings } = await import('../drizzle/schema');
  
  const tiers = await db.select()
    .from(bonusTierSettings)
    .where(eq(bonusTierSettings.isActive, true))
    .orderBy(desc(bonusTierSettings.minRevenue));
  
  return tiers.map(t => ({
    tierKey: t.tierKey,
    tierName: t.tierName,
    minRevenue: parseFloat(t.minRevenue),
    maxRevenue: t.maxRevenue ? parseFloat(t.maxRevenue) : null,
    bonusAmount: parseFloat(t.bonusAmount),
    color: t.color,
  }));
}

// إنشاء مستوى بونص جديد
export async function createBonusTier(data: {
  tierKey: string;
  tierName: string;
  minRevenue: string;
  maxRevenue?: string;
  bonusAmount: string;
  color?: string;
  sortOrder?: number;
}) {
  const db = await getDb();
  if (!db) return null;
  
  const { bonusTierSettings } = await import('../drizzle/schema');
  
  const [result] = await db.insert(bonusTierSettings).values({
    tierKey: data.tierKey,
    tierName: data.tierName,
    minRevenue: data.minRevenue,
    maxRevenue: data.maxRevenue || null,
    bonusAmount: data.bonusAmount,
    color: data.color || 'gray',
    sortOrder: data.sortOrder || 0,
    isActive: true,
  });
  
  return result;
}

// تحديث مستوى بونص
export async function updateBonusTier(id: number, data: {
  tierName?: string;
  minRevenue?: string;
  maxRevenue?: string | null;
  bonusAmount?: string;
  color?: string;
  sortOrder?: number;
  isActive?: boolean;
}) {
  const db = await getDb();
  if (!db) return null;
  
  const { bonusTierSettings } = await import('../drizzle/schema');
  
  return await db.update(bonusTierSettings)
    .set(data as any)
    .where(eq(bonusTierSettings.id, id));
}

// حذف مستوى بونص
export async function deleteBonusTier(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const { bonusTierSettings } = await import('../drizzle/schema');
  
  return await db.delete(bonusTierSettings)
    .where(eq(bonusTierSettings.id, id));
}

// تسجيل تغيير في مستويات البونص
export async function logBonusTierChange(data: {
  userId: number;
  userName: string;
  tierId?: number;
  tierKey?: string;
  changeType: 'create' | 'update' | 'delete';
  oldValues?: object;
  newValues?: object;
  description?: string;
}) {
  const db = await getDb();
  if (!db) return null;
  
  const { bonusTierAuditLog } = await import('../drizzle/schema');
  
  return await db.insert(bonusTierAuditLog).values({
    userId: data.userId,
    userName: data.userName,
    tierId: data.tierId || null,
    tierKey: data.tierKey || null,
    changeType: data.changeType,
    oldValues: data.oldValues ? JSON.stringify(data.oldValues) : null,
    newValues: data.newValues ? JSON.stringify(data.newValues) : null,
    description: data.description || null,
  });
}

// الحصول على سجل تغييرات مستويات البونص
export async function getBonusTierAuditLogs(limit: number = 50): Promise<Array<{
  id: number;
  userId: number;
  userName: string;
  tierId: number | null;
  tierKey: string | null;
  changeType: 'create' | 'update' | 'delete';
  oldValues: string | null;
  newValues: string | null;
  description: string | null;
  createdAt: Date;
}>> {
  const db = await getDb();
  if (!db) return [];
  
  const { bonusTierAuditLog } = await import('../drizzle/schema');
  
  return await db.select()
    .from(bonusTierAuditLog)
    .orderBy(desc(bonusTierAuditLog.createdAt))
    .limit(limit);
}

// تهيئة مستويات البونص الافتراضية
export async function initializeDefaultBonusTiers() {
  const db = await getDb();
  if (!db) return;
  
  const { bonusTierSettings } = await import('../drizzle/schema');
  
  // التحقق من وجود مستويات
  const existing = await db.select().from(bonusTierSettings).limit(1);
  if (existing.length > 0) return; // المستويات موجودة بالفعل
  
  // إضافة المستويات الافتراضية (محدثة 7 يناير 2026)
  const defaultTiers = [
    { tierKey: 'tier_7', tierName: 'المستوى 7', minRevenue: '3200', maxRevenue: null, bonusAmount: '190', color: 'purple', sortOrder: 7 },
    { tierKey: 'tier_6', tierName: 'المستوى 6', minRevenue: '2800', maxRevenue: '3199.99', bonusAmount: '155', color: 'indigo', sortOrder: 6 },
    { tierKey: 'tier_5', tierName: 'المستوى 5', minRevenue: '2500', maxRevenue: '2799.99', bonusAmount: '120', color: 'blue', sortOrder: 5 },
    { tierKey: 'tier_4', tierName: 'المستوى 4', minRevenue: '2200', maxRevenue: '2499.99', bonusAmount: '90', color: 'cyan', sortOrder: 4 },
    { tierKey: 'tier_3', tierName: 'المستوى 3', minRevenue: '1950', maxRevenue: '2199.99', bonusAmount: '65', color: 'green', sortOrder: 3 },
    { tierKey: 'tier_2', tierName: 'المستوى 2', minRevenue: '1750', maxRevenue: '1949.99', bonusAmount: '55', color: 'yellow', sortOrder: 2 },
    { tierKey: 'tier_1', tierName: 'المستوى 1', minRevenue: '1450', maxRevenue: '1749.99', bonusAmount: '35', color: 'orange', sortOrder: 1 },
  ];
  
  for (const tier of defaultTiers) {
    await db.insert(bonusTierSettings).values({
      ...tier,
      isActive: true,
    });
  }
}


// ==================== دوال تتبع صرف البونص ====================

// الحصول على بونص أسبوعي بالمعرف
export async function getWeeklyBonusById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const [result] = await db.select().from(weeklyBonuses)
    .where(eq(weeklyBonuses.id, id))
    .limit(1);
  
  return result || null;
}

// تسجيل صرف البونص
export async function markBonusAsPaid(id: number, data: {
  paidBy: number;
  paymentMethod: 'cash' | 'bank_transfer' | 'check';
  paymentReference?: string;
  paymentNotes?: string;
}) {
  const db = await getDb();
  if (!db) return null;
  
  return await db.update(weeklyBonuses)
    .set({
      status: 'paid',
      paidAt: new Date(),
      paidBy: data.paidBy,
      paymentMethod: data.paymentMethod,
      paymentReference: data.paymentReference || null,
      paymentNotes: data.paymentNotes || null,
    })
    .where(eq(weeklyBonuses.id, id));
}

// الحصول على البونصات الموافق عليها للصرف
export async function getApprovedBonusesForPayment() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(weeklyBonuses)
    .where(eq(weeklyBonuses.status, 'approved'))
    .orderBy(desc(weeklyBonuses.approvedAt));
}

// الحصول على سجل البونصات المصروفة
export async function getPaidBonusHistory(filters?: {
  branchId?: number;
  month?: number;
  year?: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(weeklyBonuses.status, 'paid')];
  
  if (filters?.branchId) {
    conditions.push(eq(weeklyBonuses.branchId, filters.branchId));
  }
  if (filters?.month) {
    conditions.push(eq(weeklyBonuses.month, filters.month));
  }
  if (filters?.year) {
    conditions.push(eq(weeklyBonuses.year, filters.year));
  }
  
  return await db.select().from(weeklyBonuses)
    .where(and(...conditions))
    .orderBy(desc(weeklyBonuses.paidAt))
    .limit(filters?.limit || 50);
}


// ==================== دوال خصم السلف من الرواتب ====================

// الحصول على السلف المعتمدة غير المخصومة لموظف
export async function getUndeductedAdvancesForEmployee(employeeId: number): Promise<Array<{
  id: number;
  employeeId: number;
  employeeName: string;
  amount: number;
  approvedAt: Date | null;
  title: string;
}>> {
  const db = await getDb();
  if (!db) return [];
  
  const results = await db.select({
    id: employeeRequests.id,
    employeeId: employeeRequests.employeeId,
    employeeName: employeeRequests.employeeName,
    amount: employeeRequests.advanceAmount,
    approvedAt: employeeRequests.reviewedAt,
    title: employeeRequests.title,
  })
    .from(employeeRequests)
    .where(and(
      eq(employeeRequests.employeeId, employeeId),
      eq(employeeRequests.requestType, 'advance'),
      eq(employeeRequests.status, 'approved'),
      eq(employeeRequests.isDeductedFromSalary, false)
    ))
    .orderBy(employeeRequests.reviewedAt);
  
  return results.map(r => ({
    ...r,
    amount: r.amount ? parseFloat(r.amount) : 0,
  }));
}

// الحصول على إجمالي السلف غير المخصومة لموظف
export async function getTotalUndeductedAdvances(employeeId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db.select({
    total: sql<string>`COALESCE(SUM(${employeeRequests.advanceAmount}), 0)`
  })
    .from(employeeRequests)
    .where(and(
      eq(employeeRequests.employeeId, employeeId),
      eq(employeeRequests.requestType, 'advance'),
      eq(employeeRequests.status, 'approved'),
      eq(employeeRequests.isDeductedFromSalary, false)
    ));
  
  return parseFloat(result[0]?.total || '0');
}

// تحديث حالة السلفة كمخصومة
export async function markAdvanceAsDeducted(advanceId: number, payrollId: number) {
  const db = await getDb();
  if (!db) return null;
  
  return await db.update(employeeRequests)
    .set({
      isDeductedFromSalary: true,
      deductedInPayrollId: payrollId,
      deductedAt: new Date(),
    })
    .where(eq(employeeRequests.id, advanceId));
}

// الحصول على السلف غير المخصومة لجميع موظفي فرع
export async function getUndeductedAdvancesForBranch(branchId: number): Promise<Array<{
  employeeId: number;
  employeeName: string;
  totalAdvances: number;
  advanceCount: number;
  advances: Array<{
    id: number;
    amount: number;
    approvedAt: Date | null;
    title: string;
  }>;
}>> {
  const db = await getDb();
  if (!db) return [];
  
  // الحصول على جميع السلف المعتمدة غير المخصومة للفرع
  const advances = await db.select({
    id: employeeRequests.id,
    employeeId: employeeRequests.employeeId,
    employeeName: employeeRequests.employeeName,
    amount: employeeRequests.advanceAmount,
    approvedAt: employeeRequests.reviewedAt,
    title: employeeRequests.title,
  })
    .from(employeeRequests)
    .where(and(
      eq(employeeRequests.branchId, branchId),
      eq(employeeRequests.requestType, 'advance'),
      eq(employeeRequests.status, 'approved'),
      eq(employeeRequests.isDeductedFromSalary, false)
    ))
    .orderBy(employeeRequests.employeeId, employeeRequests.reviewedAt);
  
  // تجميع السلف حسب الموظف
  const employeeAdvances = new Map<number, {
    employeeId: number;
    employeeName: string;
    totalAdvances: number;
    advanceCount: number;
    advances: Array<{
      id: number;
      amount: number;
      approvedAt: Date | null;
      title: string;
    }>;
  }>();
  
  for (const adv of advances) {
    const amount = adv.amount ? parseFloat(adv.amount) : 0;
    
    if (!employeeAdvances.has(adv.employeeId)) {
      employeeAdvances.set(adv.employeeId, {
        employeeId: adv.employeeId,
        employeeName: adv.employeeName,
        totalAdvances: 0,
        advanceCount: 0,
        advances: [],
      });
    }
    
    const empData = employeeAdvances.get(adv.employeeId)!;
    empData.totalAdvances += amount;
    empData.advanceCount += 1;
    empData.advances.push({
      id: adv.id,
      amount,
      approvedAt: adv.approvedAt,
      title: adv.title,
    });
  }
  
  return Array.from(employeeAdvances.values());
}


// ==================== دوال عرض السلف المأخوذة ====================

// الحصول على جميع السلف المعتمدة (للعرض في صفحة المصاريف)
export async function getAllApprovedAdvances(branchId?: number): Promise<Array<{
  id: number;
  employeeId: number;
  employeeName: string;
  amount: number;
  title: string;
  reason: string | null;
  repaymentMethod: string | null;
  status: string;
  approvedAt: Date | null;
  approvedBy: string | null;
  isDeducted: boolean;
  deductedAt: Date | null;
  createdAt: Date;
}>> {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [
    eq(employeeRequests.requestType, 'advance'),
    eq(employeeRequests.status, 'approved'),
  ];
  
  if (branchId) {
    conditions.push(eq(employeeRequests.branchId, branchId));
  }
  
  const results = await db.select({
    id: employeeRequests.id,
    employeeId: employeeRequests.employeeId,
    employeeName: employeeRequests.employeeName,
    amount: employeeRequests.advanceAmount,
    title: employeeRequests.title,
    reason: employeeRequests.advanceReason,
    repaymentMethod: employeeRequests.repaymentMethod,
    status: employeeRequests.status,
    approvedAt: employeeRequests.reviewedAt,
    approvedBy: employeeRequests.reviewedByName,
    isDeducted: employeeRequests.isDeductedFromSalary,
    deductedAt: employeeRequests.deductedAt,
    createdAt: employeeRequests.createdAt,
  })
    .from(employeeRequests)
    .where(and(...conditions))
    .orderBy(desc(employeeRequests.reviewedAt));
  
  return results.map(r => ({
    ...r,
    amount: r.amount ? parseFloat(r.amount) : 0,
  }));
}

// الحصول على إحصائيات السلف
export async function getAdvancesStats(branchId?: number): Promise<{
  totalAdvances: number;
  totalAmount: number;
  deductedCount: number;
  deductedAmount: number;
  pendingCount: number;
  pendingAmount: number;
}> {
  const db = await getDb();
  if (!db) return {
    totalAdvances: 0,
    totalAmount: 0,
    deductedCount: 0,
    deductedAmount: 0,
    pendingCount: 0,
    pendingAmount: 0,
  };
  
  const conditions = [
    eq(employeeRequests.requestType, 'advance'),
    eq(employeeRequests.status, 'approved'),
  ];
  
  if (branchId) {
    conditions.push(eq(employeeRequests.branchId, branchId));
  }
  
  // إجمالي السلف
  const totalResult = await db.select({
    count: sql<number>`COUNT(*)`,
    total: sql<string>`COALESCE(SUM(${employeeRequests.advanceAmount}), 0)`,
  })
    .from(employeeRequests)
    .where(and(...conditions));
  
  // السلف المخصومة
  const deductedResult = await db.select({
    count: sql<number>`COUNT(*)`,
    total: sql<string>`COALESCE(SUM(${employeeRequests.advanceAmount}), 0)`,
  })
    .from(employeeRequests)
    .where(and(...conditions, eq(employeeRequests.isDeductedFromSalary, true)));
  
  // السلف غير المخصومة
  const pendingResult = await db.select({
    count: sql<number>`COUNT(*)`,
    total: sql<string>`COALESCE(SUM(${employeeRequests.advanceAmount}), 0)`,
  })
    .from(employeeRequests)
    .where(and(...conditions, eq(employeeRequests.isDeductedFromSalary, false)));
  
  return {
    totalAdvances: Number(totalResult[0]?.count || 0),
    totalAmount: parseFloat(totalResult[0]?.total || '0'),
    deductedCount: Number(deductedResult[0]?.count || 0),
    deductedAmount: parseFloat(deductedResult[0]?.total || '0'),
    pendingCount: Number(pendingResult[0]?.count || 0),
    pendingAmount: parseFloat(pendingResult[0]?.total || '0'),
  };
}


// إحصائيات سندات القبض للفترة المحددة
export async function getReceiptVouchersStats(startDate: Date, endDate: Date, branchId?: number) {
  const db = await getDb();
  if (!db) return { count: 0, totalAmount: 0 };
  
  const conditions = [
    gte(receiptVouchers.voucherDate, startDate),
    lte(receiptVouchers.voucherDate, endDate),
  ];
  
  if (branchId) {
    conditions.push(eq(receiptVouchers.branchId, branchId));
  }
  
  const result = await db.select({
    count: sql<number>`COUNT(*)`,
    totalAmount: sql<string>`COALESCE(SUM(${receiptVouchers.totalAmount}), 0)`,
  })
    .from(receiptVouchers)
    .where(and(...conditions));
  
  return {
    count: Number(result[0]?.count || 0),
    totalAmount: parseFloat(result[0]?.totalAmount || '0'),
  };
}


// ==================== طلبات حذف زيارات الولاء ====================

// إنشاء طلب حذف زيارة
export async function createVisitDeletionRequest(data: {
  visitId: number;
  customerName: string;
  customerPhone: string;
  serviceType?: string;
  visitDate?: Date;
  branchId?: number;
  branchName?: string;
  deletionReason: string;
  requestedBy: number;
  requestedByName?: string;
}) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(loyaltyVisitDeletionRequests).values({
    visitId: data.visitId,
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    serviceType: data.serviceType,
    visitDate: data.visitDate,
    branchId: data.branchId,
    branchName: data.branchName,
    deletionReason: data.deletionReason,
    requestedBy: data.requestedBy,
    requestedByName: data.requestedByName,
    status: 'pending',
  });
  
  return Number((result as any)[0]?.insertId || 0);
}

// الحصول على طلبات الحذف المعلقة
export async function getPendingDeletionRequests() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(loyaltyVisitDeletionRequests)
    .where(eq(loyaltyVisitDeletionRequests.status, 'pending'))
    .orderBy(desc(loyaltyVisitDeletionRequests.requestedAt));
}

// الحصول على جميع طلبات الحذف
export async function getAllDeletionRequests(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(loyaltyVisitDeletionRequests)
    .orderBy(desc(loyaltyVisitDeletionRequests.requestedAt))
    .limit(limit);
}

// الحصول على طلبات الحذف حسب الفرع
export async function getDeletionRequestsByBranch(branchId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(loyaltyVisitDeletionRequests)
    .where(eq(loyaltyVisitDeletionRequests.branchId, branchId))
    .orderBy(desc(loyaltyVisitDeletionRequests.requestedAt));
}

// الحصول على طلب حذف بواسطة ID
export async function getDeletionRequestById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const results = await db.select()
    .from(loyaltyVisitDeletionRequests)
    .where(eq(loyaltyVisitDeletionRequests.id, id))
    .limit(1);
  
  return results[0] || null;
}

// التحقق من وجود طلب حذف معلق للزيارة
export async function hasPendingDeletionRequest(visitId: number) {
  const db = await getDb();
  if (!db) return false;
  
  const results = await db.select({ count: sql<number>`COUNT(*)` })
    .from(loyaltyVisitDeletionRequests)
    .where(and(
      eq(loyaltyVisitDeletionRequests.visitId, visitId),
      eq(loyaltyVisitDeletionRequests.status, 'pending')
    ));
  
  return Number(results[0]?.count || 0) > 0;
}

// الموافقة على طلب الحذف
export async function approveDeletionRequest(
  requestId: number,
  processedBy: number,
  processedByName: string,
  adminNotes?: string
) {
  const db = await getDb();
  if (!db) return { success: false, error: 'Database not available' };
  
  // الحصول على طلب الحذف
  const request = await getDeletionRequestById(requestId);
  if (!request) {
    return { success: false, error: 'طلب الحذف غير موجود' };
  }
  
  if (request.status !== 'pending') {
    return { success: false, error: 'تم معالجة هذا الطلب مسبقاً' };
  }
  
  // تحديث حالة الطلب
  await db.update(loyaltyVisitDeletionRequests)
    .set({
      status: 'approved',
      processedBy,
      processedByName,
      processedAt: new Date(),
      adminNotes,
    })
    .where(eq(loyaltyVisitDeletionRequests.id, requestId));
  
  // حذف الزيارة من جدول الزيارات
  await db.delete(loyaltyVisits)
    .where(eq(loyaltyVisits.id, request.visitId));
  
  return { success: true };
}

// رفض طلب الحذف
export async function rejectDeletionRequest(
  requestId: number,
  processedBy: number,
  processedByName: string,
  adminNotes?: string
) {
  const db = await getDb();
  if (!db) return { success: false, error: 'Database not available' };
  
  // الحصول على طلب الحذف
  const request = await getDeletionRequestById(requestId);
  if (!request) {
    return { success: false, error: 'طلب الحذف غير موجود' };
  }
  
  if (request.status !== 'pending') {
    return { success: false, error: 'تم معالجة هذا الطلب مسبقاً' };
  }
  
  // تحديث حالة الطلب
  await db.update(loyaltyVisitDeletionRequests)
    .set({
      status: 'rejected',
      processedBy,
      processedByName,
      processedAt: new Date(),
      adminNotes,
    })
    .where(eq(loyaltyVisitDeletionRequests.id, requestId));
  
  return { success: true };
}

// إحصائيات طلبات الحذف
export async function getDeletionRequestsStats() {
  const db = await getDb();
  if (!db) return { pending: 0, approved: 0, rejected: 0, total: 0 };
  
  const results = await db.select({
    status: loyaltyVisitDeletionRequests.status,
    count: sql<number>`COUNT(*)`,
  })
    .from(loyaltyVisitDeletionRequests)
    .groupBy(loyaltyVisitDeletionRequests.status);
  
  const stats = { pending: 0, approved: 0, rejected: 0, total: 0 };
  results.forEach(r => {
    if (r.status === 'pending') stats.pending = Number(r.count);
    else if (r.status === 'approved') stats.approved = Number(r.count);
    else if (r.status === 'rejected') stats.rejected = Number(r.count);
    stats.total += Number(r.count);
  });
  
  return stats;
}


// حذف زيارة مباشرة (للأدمن)
export async function deleteLoyaltyVisit(visitId: number): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: 'Database not available' };
  
  try {
    await db.delete(loyaltyVisits)
      .where(eq(loyaltyVisits.id, visitId));
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting loyalty visit:', error);
    return { success: false, error: 'فشل حذف الزيارة' };
  }
}



// ==================== دوال سجل الخصومات ====================

// إنشاء سجل خصم جديد
export async function createDiscountRecord(data: {
  customerId?: number;
  customerName?: string;
  customerPhone?: string;
  branchId?: number;
  branchName?: string;
  originalAmount: number;
  discountPercentage: number;
  discountAmount: number;
  finalAmount: number;
  visitId?: number;
  isPrinted?: boolean;
  createdBy: number;
  createdByName: string;
  notes?: string;
}): Promise<{ success: boolean; id?: number; recordId?: string }> {
  const db = await getDb();
  if (!db) return { success: false };
  
  const { loyaltyDiscountRecords } = await import('../drizzle/schema');
  
  // إنشاء معرف فريد للسجل
  const year = new Date().getFullYear();
  const countResult = await db.select({ count: sql<number>`COUNT(*)` })
    .from(loyaltyDiscountRecords);
  const count = Number(countResult[0]?.count || 0) + 1;
  const recordId = `DR-${year}-${String(count).padStart(4, '0')}`;
  
  const result = await db.insert(loyaltyDiscountRecords).values({
    recordId,
    customerId: data.customerId || null,
    customerName: data.customerName || null,
    customerPhone: data.customerPhone || null,
    branchId: data.branchId || null,
    branchName: data.branchName || null,
    originalAmount: String(data.originalAmount),
    discountPercentage: String(data.discountPercentage),
    discountAmount: String(data.discountAmount),
    finalAmount: String(data.finalAmount),
    visitId: data.visitId || null,
    isPrinted: data.isPrinted || false,
    printedAt: data.isPrinted ? new Date() : null,
    createdBy: data.createdBy,
    createdByName: data.createdByName,
    notes: data.notes || null,
  });
  
  return { success: true, id: Number((result as any)[0]?.insertId || 0), recordId };
}

// الحصول على سجلات الخصومات
export async function getDiscountRecords(filters?: {
  branchId?: number;
  customerId?: number;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}): Promise<Array<{
  id: number;
  recordId: string;
  customerId: number | null;
  customerName: string | null;
  customerPhone: string | null;
  branchId: number | null;
  branchName: string | null;
  originalAmount: number;
  discountPercentage: number;
  discountAmount: number;
  finalAmount: number;
  visitId: number | null;
  isPrinted: boolean;
  printedAt: Date | null;
  createdBy: number;
  createdByName: string;
  notes: string | null;
  createdAt: Date;
}>> {
  const db = await getDb();
  if (!db) return [];
  
  const { loyaltyDiscountRecords } = await import('../drizzle/schema');
  
  const conditions: any[] = [];
  
  if (filters?.branchId) {
    conditions.push(eq(loyaltyDiscountRecords.branchId, filters.branchId));
  }
  if (filters?.customerId) {
    conditions.push(eq(loyaltyDiscountRecords.customerId, filters.customerId));
  }
  if (filters?.startDate) {
    conditions.push(gte(loyaltyDiscountRecords.createdAt, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(loyaltyDiscountRecords.createdAt, filters.endDate));
  }
  
  let query = db.select()
    .from(loyaltyDiscountRecords)
    .orderBy(desc(loyaltyDiscountRecords.createdAt))
    .limit(filters?.limit || 100);
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }
  
  const results = await query;
  
  return results.map(r => ({
    id: r.id,
    recordId: r.recordId,
    customerId: r.customerId,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    branchId: r.branchId,
    branchName: r.branchName,
    originalAmount: parseFloat(r.originalAmount),
    discountPercentage: parseFloat(r.discountPercentage),
    discountAmount: parseFloat(r.discountAmount),
    finalAmount: parseFloat(r.finalAmount),
    visitId: r.visitId,
    isPrinted: r.isPrinted,
    printedAt: r.printedAt,
    createdBy: r.createdBy,
    createdByName: r.createdByName,
    notes: r.notes,
    createdAt: r.createdAt,
  }));
}

// الحصول على إحصائيات الخصومات
export async function getDiscountStats(filters?: {
  branchId?: number;
  startDate?: Date;
  endDate?: Date;
}): Promise<{
  totalRecords: number;
  totalOriginalAmount: number;
  totalDiscountAmount: number;
  totalFinalAmount: number;
  averageDiscount: number;
}> {
  const db = await getDb();
  if (!db) return {
    totalRecords: 0,
    totalOriginalAmount: 0,
    totalDiscountAmount: 0,
    totalFinalAmount: 0,
    averageDiscount: 0,
  };
  
  const { loyaltyDiscountRecords } = await import('../drizzle/schema');
  
  const conditions: any[] = [];
  
  if (filters?.branchId) {
    conditions.push(eq(loyaltyDiscountRecords.branchId, filters.branchId));
  }
  if (filters?.startDate) {
    conditions.push(gte(loyaltyDiscountRecords.createdAt, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(loyaltyDiscountRecords.createdAt, filters.endDate));
  }
  
  let query = db.select({
    count: sql<number>`COUNT(*)`,
    totalOriginal: sql<string>`COALESCE(SUM(${loyaltyDiscountRecords.originalAmount}), 0)`,
    totalDiscount: sql<string>`COALESCE(SUM(${loyaltyDiscountRecords.discountAmount}), 0)`,
    totalFinal: sql<string>`COALESCE(SUM(${loyaltyDiscountRecords.finalAmount}), 0)`,
    avgDiscount: sql<string>`COALESCE(AVG(${loyaltyDiscountRecords.discountPercentage}), 0)`,
  }).from(loyaltyDiscountRecords);
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }
  
  const result = await query;
  
  return {
    totalRecords: Number(result[0]?.count || 0),
    totalOriginalAmount: parseFloat(result[0]?.totalOriginal || '0'),
    totalDiscountAmount: parseFloat(result[0]?.totalDiscount || '0'),
    totalFinalAmount: parseFloat(result[0]?.totalFinal || '0'),
    averageDiscount: parseFloat(result[0]?.avgDiscount || '0'),
  };
}

// تحديث سجل الخصم كمطبوع
export async function markDiscountAsPrinted(id: number): Promise<{ success: boolean }> {
  const db = await getDb();
  if (!db) return { success: false };
  
  const { loyaltyDiscountRecords } = await import('../drizzle/schema');
  
  await db.update(loyaltyDiscountRecords)
    .set({
      isPrinted: true,
      printedAt: new Date(),
    })
    .where(eq(loyaltyDiscountRecords.id, id));
  
  return { success: true };
}


// ==================== نظام حاسبة الخصم الذكي ====================

/**
 * الحصول على العملاء المؤهلين للخصم
 * 
 * شروط الأهلية:
 * 1. العميل أتم 3 زيارات موافق عليها (approved) هذا الشهر
 * 2. العميل لم يحصل على خصم سابق هذا الشهر
 * 3. العميل نشط في النظام
 * 
 * @returns قائمة العملاء المؤهلين مع بياناتهم
 */
export async function getEligibleCustomersForDiscount(branchId?: number): Promise<Array<{
  id: number;
  customerId: string;
  name: string;
  phone: string;
  approvedVisitsThisMonth: number;
  lastVisitDate: Date | null;
  hasUsedDiscountThisMonth: boolean;
  isEligible: boolean;
  eligibilityReason: string;
}>> {
  const db = await getDb();
  if (!db) return [];
  
  const { loyaltyCustomers, loyaltyVisits, loyaltyDiscountRecords } = await import('../drizzle/schema');
  
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  
  // جلب جميع العملاء النشطين
  let customersQuery = db.select()
    .from(loyaltyCustomers)
    .where(eq(loyaltyCustomers.isActive, true));
  
  // تصفية حسب الفرع إذا تم تحديده
  if (branchId) {
    customersQuery = db.select()
      .from(loyaltyCustomers)
      .where(and(
        eq(loyaltyCustomers.isActive, true),
        eq(loyaltyCustomers.branchId, branchId)
      ));
  }
  
  const customers = await customersQuery;
  
  const eligibleCustomers: Array<{
    id: number;
    customerId: string;
    name: string;
    phone: string;
    approvedVisitsThisMonth: number;
    lastVisitDate: Date | null;
    hasUsedDiscountThisMonth: boolean;
    isEligible: boolean;
    eligibilityReason: string;
  }> = [];
  
  for (const customer of customers) {
    // 1. حساب الزيارات الموافق عليها هذا الشهر
    const approvedVisits = await db.select()
      .from(loyaltyVisits)
      .where(and(
        eq(loyaltyVisits.customerId, customer.id),
        eq(loyaltyVisits.status, 'approved'),
        gte(loyaltyVisits.visitDate, startOfMonth),
        lte(loyaltyVisits.visitDate, endOfMonth)
      ))
      .orderBy(desc(loyaltyVisits.visitDate));
    
    const approvedVisitsCount = approvedVisits.length;
    const lastVisitDate = approvedVisits.length > 0 ? approvedVisits[0].visitDate : null;
    
    // 2. التحقق من عدم استخدام خصم هذا الشهر
    const discountsThisMonth = await db.select()
      .from(loyaltyDiscountRecords)
      .where(and(
        eq(loyaltyDiscountRecords.customerId, customer.id),
        gte(loyaltyDiscountRecords.createdAt, startOfMonth),
        lte(loyaltyDiscountRecords.createdAt, endOfMonth)
      ));
    
    const hasUsedDiscountThisMonth = discountsThisMonth.length > 0;
    
    // 3. تحديد الأهلية والسبب
    let isEligible = false;
    let eligibilityReason = '';
    
    if (approvedVisitsCount < 3) {
      eligibilityReason = `العميل أتم ${approvedVisitsCount} زيارات فقط من أصل 3 زيارات مطلوبة`;
    } else if (hasUsedDiscountThisMonth) {
      eligibilityReason = 'العميل حصل على خصم سابق هذا الشهر';
    } else {
      isEligible = true;
      eligibilityReason = `العميل مؤهل للخصم - أتم ${approvedVisitsCount} زيارات موافق عليها`;
    }
    
    eligibleCustomers.push({
      id: customer.id,
      customerId: customer.customerId,
      name: customer.name,
      phone: customer.phone,
      approvedVisitsThisMonth: approvedVisitsCount,
      lastVisitDate,
      hasUsedDiscountThisMonth,
      isEligible,
      eligibilityReason,
    });
  }
  
  // ترتيب: المؤهلون أولاً، ثم حسب عدد الزيارات
  return eligibleCustomers.sort((a, b) => {
    if (a.isEligible && !b.isEligible) return -1;
    if (!a.isEligible && b.isEligible) return 1;
    return b.approvedVisitsThisMonth - a.approvedVisitsThisMonth;
  });
}

/**
 * التحقق من أهلية عميل محدد للخصم
 * 
 * @param customerId معرف العميل
 * @returns نتيجة التحقق مع التفاصيل
 */
export async function verifyCustomerDiscountEligibility(customerId: number): Promise<{
  isEligible: boolean;
  customer: {
    id: number;
    name: string;
    phone: string;
  } | null;
  approvedVisitsThisMonth: number;
  hasUsedDiscountThisMonth: boolean;
  lastDiscountDate: Date | null;
  eligibilityReason: string;
  visitDetails: Array<{
    visitId: string;
    visitDate: Date;
    serviceType: string;
    status: string;
  }>;
}> {
  const db = await getDb();
  if (!db) {
    return {
      isEligible: false,
      customer: null,
      approvedVisitsThisMonth: 0,
      hasUsedDiscountThisMonth: false,
      lastDiscountDate: null,
      eligibilityReason: 'خطأ في الاتصال بقاعدة البيانات',
      visitDetails: [],
    };
  }
  
  const { loyaltyCustomers, loyaltyVisits, loyaltyDiscountRecords } = await import('../drizzle/schema');
  
  // جلب بيانات العميل
  const customerResult = await db.select()
    .from(loyaltyCustomers)
    .where(eq(loyaltyCustomers.id, customerId))
    .limit(1);
  
  if (customerResult.length === 0) {
    return {
      isEligible: false,
      customer: null,
      approvedVisitsThisMonth: 0,
      hasUsedDiscountThisMonth: false,
      lastDiscountDate: null,
      eligibilityReason: 'العميل غير موجود',
      visitDetails: [],
    };
  }
  
  const customer = customerResult[0];
  
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  
  // جلب الزيارات الموافق عليها هذا الشهر
  const approvedVisits = await db.select()
    .from(loyaltyVisits)
    .where(and(
      eq(loyaltyVisits.customerId, customerId),
      eq(loyaltyVisits.status, 'approved'),
      gte(loyaltyVisits.visitDate, startOfMonth),
      lte(loyaltyVisits.visitDate, endOfMonth)
    ))
    .orderBy(desc(loyaltyVisits.visitDate));
  
  // جلب الخصومات هذا الشهر
  const discountsThisMonth = await db.select()
    .from(loyaltyDiscountRecords)
    .where(and(
      eq(loyaltyDiscountRecords.customerId, customerId),
      gte(loyaltyDiscountRecords.createdAt, startOfMonth),
      lte(loyaltyDiscountRecords.createdAt, endOfMonth)
    ))
    .orderBy(desc(loyaltyDiscountRecords.createdAt));
  
  const approvedVisitsCount = approvedVisits.length;
  const hasUsedDiscountThisMonth = discountsThisMonth.length > 0;
  const lastDiscountDate = discountsThisMonth.length > 0 ? discountsThisMonth[0].createdAt : null;
  
  // تحديد الأهلية
  let isEligible = false;
  let eligibilityReason = '';
  
  if (!customer.isActive) {
    eligibilityReason = 'حساب العميل غير نشط';
  } else if (approvedVisitsCount < 3) {
    eligibilityReason = `العميل أتم ${approvedVisitsCount} زيارات فقط من أصل 3 زيارات مطلوبة`;
  } else if (hasUsedDiscountThisMonth) {
    eligibilityReason = `العميل حصل على خصم بتاريخ ${lastDiscountDate?.toLocaleDateString('ar-SA')}`;
  } else {
    isEligible = true;
    eligibilityReason = `العميل مؤهل للخصم - أتم ${approvedVisitsCount} زيارات موافق عليها`;
  }
  
  return {
    isEligible,
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
    },
    approvedVisitsThisMonth: approvedVisitsCount,
    hasUsedDiscountThisMonth,
    lastDiscountDate,
    eligibilityReason,
    visitDetails: approvedVisits.map(v => ({
      visitId: v.visitId,
      visitDate: v.visitDate,
      serviceType: v.serviceType,
      status: v.status,
    })),
  };
}

/**
 * إنشاء سجل خصم مع التحقق من الأهلية
 * 
 * @param data بيانات الخصم
 * @returns نتيجة العملية
 */
export async function createVerifiedDiscountRecord(data: {
  customerId: number;
  originalAmount: number;
  discountPercentage: number;
  discountAmount: number;
  finalAmount: number;
  branchId?: number;
  branchName?: string;
  createdBy: number;
  createdByName: string;
  notes?: string;
}): Promise<{
  success: boolean;
  recordId?: string;
  error?: string;
  aiRiskScore?: number;
  aiRiskLevel?: string;
  aiAnalysisNotes?: string;
}> {
  const db = await getDb();
  if (!db) return { success: false, error: 'خطأ في الاتصال بقاعدة البيانات' };
  
  // التحقق من أهلية العميل
  const eligibility = await verifyCustomerDiscountEligibility(data.customerId);
  
  if (!eligibility.isEligible) {
    return {
      success: false,
      error: `العميل غير مؤهل للخصم: ${eligibility.eligibilityReason}`,
    };
  }
  
  const { loyaltyDiscountRecords } = await import('../drizzle/schema');
  
  // حساب درجة المخاطرة بالذكاء الاصطناعي
  const aiAnalysis = await analyzeDiscountRisk({
    customerId: data.customerId,
    customerName: eligibility.customer?.name || '',
    originalAmount: data.originalAmount,
    approvedVisitsCount: eligibility.approvedVisitsThisMonth,
    createdBy: data.createdBy,
    branchId: data.branchId,
  });
  
  // إنشاء معرف فريد للسجل
  const year = new Date().getFullYear();
  const countResult = await db.select({ count: sql<number>`COUNT(*)` })
    .from(loyaltyDiscountRecords);
  const count = Number(countResult[0]?.count || 0) + 1;
  const recordId = `DR-${year}-${String(count).padStart(4, '0')}`;
  
  // إنشاء السجل
  await db.insert(loyaltyDiscountRecords).values({
    recordId,
    customerId: data.customerId,
    customerName: eligibility.customer?.name || null,
    customerPhone: eligibility.customer?.phone || null,
    branchId: data.branchId || null,
    branchName: data.branchName || null,
    originalAmount: String(data.originalAmount),
    discountPercentage: String(data.discountPercentage),
    discountAmount: String(data.discountAmount),
    finalAmount: String(data.finalAmount),
    isPrinted: true,
    printedAt: new Date(),
    createdBy: data.createdBy,
    createdByName: data.createdByName,
    notes: data.notes || null,
    // حقول التحقق
    isVerified: true,
    eligibilityVerified: true,
    verificationMethod: 'system',
    // حقول الذكاء الاصطناعي
    aiRiskScore: String(aiAnalysis.riskScore),
    aiRiskLevel: aiAnalysis.riskLevel as any,
    aiAnalysisNotes: aiAnalysis.notes,
    approvedVisitsCount: eligibility.approvedVisitsThisMonth,
  });
  
  // إذا كانت درجة المخاطرة عالية، إرسال تنبيه للأدمن
  if (aiAnalysis.riskLevel === 'high' || aiAnalysis.riskLevel === 'critical') {
    // سيتم إرسال التنبيه من خلال نظام الإشعارات
    console.log(`[AI Alert] High risk discount detected: ${recordId}, Score: ${aiAnalysis.riskScore}`);
  }
  
  return {
    success: true,
    recordId,
    aiRiskScore: aiAnalysis.riskScore,
    aiRiskLevel: aiAnalysis.riskLevel,
    aiAnalysisNotes: aiAnalysis.notes,
  };
}

/**
 * تحليل مخاطر الخصم بالذكاء الاصطناعي
 * 
 * يحلل عدة عوامل:
 * 1. تكرار الخصومات للعميل
 * 2. مبلغ الخصم مقارنة بالمتوسط
 * 3. نمط استخدام الخصومات
 * 4. توقيت الخصم
 */
async function analyzeDiscountRisk(data: {
  customerId: number;
  customerName: string;
  originalAmount: number;
  approvedVisitsCount: number;
  createdBy: number;
  branchId?: number;
}): Promise<{
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  notes: string;
}> {
  const db = await getDb();
  if (!db) {
    return { riskScore: 0, riskLevel: 'low', notes: 'لم يتم التحليل' };
  }
  
  const { loyaltyDiscountRecords } = await import('../drizzle/schema');
  
  let riskScore = 0;
  const riskFactors: string[] = [];
  
  // 1. تحليل تاريخ الخصومات للعميل (آخر 6 أشهر)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  const customerDiscountHistory = await db.select()
    .from(loyaltyDiscountRecords)
    .where(and(
      eq(loyaltyDiscountRecords.customerId, data.customerId),
      gte(loyaltyDiscountRecords.createdAt, sixMonthsAgo)
    ));
  
  // إذا كان العميل حصل على أكثر من 3 خصومات في 6 أشهر
  if (customerDiscountHistory.length >= 3) {
    riskScore += 15;
    riskFactors.push(`العميل حصل على ${customerDiscountHistory.length} خصومات في آخر 6 أشهر`);
  }
  
  // 2. تحليل مبلغ الخصم
  // الحصول على متوسط مبالغ الخصومات
  const avgResult = await db.select({
    avg: sql<string>`COALESCE(AVG(${loyaltyDiscountRecords.originalAmount}), 0)`,
  }).from(loyaltyDiscountRecords);
  
  const avgAmount = parseFloat(avgResult[0]?.avg || '0');
  
  if (avgAmount > 0 && data.originalAmount > avgAmount * 2) {
    riskScore += 20;
    riskFactors.push(`مبلغ الفاتورة (${data.originalAmount}) أعلى من ضعف المتوسط (${avgAmount.toFixed(2)})`);
  }
  
  // 3. تحليل توقيت الخصم
  const now = new Date();
  const hour = now.getHours();
  
  // خصومات في أوقات غير اعتيادية (قبل 8 صباحاً أو بعد 10 مساءً)
  if (hour < 8 || hour > 22) {
    riskScore += 10;
    riskFactors.push(`خصم في وقت غير اعتيادي (${hour}:00)`);
  }
  
  // 4. تحليل نمط المستخدم (الموظف الذي أجرى الخصم)
  const userDiscountsToday = await db.select({ count: sql<number>`COUNT(*)` })
    .from(loyaltyDiscountRecords)
    .where(and(
      eq(loyaltyDiscountRecords.createdBy, data.createdBy),
      gte(loyaltyDiscountRecords.createdAt, new Date(now.getFullYear(), now.getMonth(), now.getDate()))
    ));
  
  const userDiscountCount = Number(userDiscountsToday[0]?.count || 0);
  
  if (userDiscountCount >= 5) {
    riskScore += 25;
    riskFactors.push(`الموظف أجرى ${userDiscountCount} خصومات اليوم`);
  } else if (userDiscountCount >= 3) {
    riskScore += 10;
    riskFactors.push(`الموظف أجرى ${userDiscountCount} خصومات اليوم`);
  }
  
  // 5. التحقق من عدد الزيارات (يجب أن يكون 3 بالضبط للخصم الأول)
  if (data.approvedVisitsCount === 3) {
    // طبيعي - لا خطر إضافي
  } else if (data.approvedVisitsCount > 3 && data.approvedVisitsCount < 6) {
    // بين 3 و 6 - طبيعي
  } else if (data.approvedVisitsCount >= 6) {
    riskScore += 5;
    riskFactors.push(`عدد زيارات مرتفع (${data.approvedVisitsCount}) - قد يكون خصم متأخر`);
  }
  
  // تحديد مستوى المخاطرة
  let riskLevel: 'low' | 'medium' | 'high' | 'critical';
  if (riskScore >= 50) {
    riskLevel = 'critical';
  } else if (riskScore >= 35) {
    riskLevel = 'high';
  } else if (riskScore >= 20) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }
  
  const notes = riskFactors.length > 0 
    ? `عوامل الخطر: ${riskFactors.join(' | ')}`
    : 'لا توجد عوامل خطر ملحوظة';
  
  return {
    riskScore,
    riskLevel,
    notes,
  };
}


/**
 * جلب إحصائيات المخاطر الشاملة للوحة التحكم
 */
export async function getDiscountRiskAnalytics(filters?: {
  startDate?: Date;
  endDate?: Date;
  branchId?: number;
}): Promise<{
  totalDiscounts: number;
  totalAmount: number;
  averageRiskScore: number;
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  monthlyTrend: Array<{
    month: string;
    count: number;
    avgRiskScore: number;
  }>;
  topRiskFactors: Array<{
    factor: string;
    count: number;
  }>;
}> {
  const db = await getDb();
  if (!db) {
    return {
      totalDiscounts: 0,
      totalAmount: 0,
      averageRiskScore: 0,
      riskDistribution: { low: 0, medium: 0, high: 0, critical: 0 },
      monthlyTrend: [],
      topRiskFactors: [],
    };
  }
  
  const { loyaltyDiscountRecords } = await import('../drizzle/schema');
  
  // بناء الشروط
  const conditions: SQL[] = [];
  
  if (filters?.startDate) {
    conditions.push(gte(loyaltyDiscountRecords.createdAt, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(loyaltyDiscountRecords.createdAt, filters.endDate));
  }
  if (filters?.branchId) {
    conditions.push(eq(loyaltyDiscountRecords.branchId, filters.branchId));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  // جلب جميع السجلات
  const allRecords = await db.select()
    .from(loyaltyDiscountRecords)
    .where(whereClause)
    .orderBy(desc(loyaltyDiscountRecords.createdAt));
  
  // حساب الإحصائيات
  const totalDiscounts = allRecords.length;
  const totalAmount = allRecords.reduce((sum, r) => sum + parseFloat(r.originalAmount || '0'), 0);
  
  // حساب متوسط درجة المخاطرة
  const riskScores = allRecords
    .filter(r => r.aiRiskScore)
    .map(r => parseFloat(r.aiRiskScore || '0'));
  const averageRiskScore = riskScores.length > 0 
    ? riskScores.reduce((a, b) => a + b, 0) / riskScores.length 
    : 0;
  
  // توزيع المخاطر
  const riskDistribution = {
    low: allRecords.filter(r => r.aiRiskLevel === 'low').length,
    medium: allRecords.filter(r => r.aiRiskLevel === 'medium').length,
    high: allRecords.filter(r => r.aiRiskLevel === 'high').length,
    critical: allRecords.filter(r => r.aiRiskLevel === 'critical').length,
  };
  
  // الاتجاه الشهري
  const monthlyMap = new Map<string, { count: number; totalRisk: number }>();
  allRecords.forEach(r => {
    const date = new Date(r.createdAt!);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const existing = monthlyMap.get(monthKey) || { count: 0, totalRisk: 0 };
    existing.count++;
    existing.totalRisk += parseFloat(r.aiRiskScore || '0');
    monthlyMap.set(monthKey, existing);
  });
  
  const monthlyTrend = Array.from(monthlyMap.entries())
    .map(([month, data]) => ({
      month,
      count: data.count,
      avgRiskScore: data.count > 0 ? data.totalRisk / data.count : 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
  
  // تحليل عوامل الخطر الأكثر شيوعاً
  const factorCounts = new Map<string, number>();
  allRecords.forEach(r => {
    if (r.aiAnalysisNotes) {
      const factors = r.aiAnalysisNotes.replace('عوامل الخطر: ', '').split(' | ');
      factors.forEach(f => {
        if (f && f !== 'لا توجد عوامل خطر ملحوظة') {
          factorCounts.set(f, (factorCounts.get(f) || 0) + 1);
        }
      });
    }
  });
  
  const topRiskFactors = Array.from(factorCounts.entries())
    .map(([factor, count]) => ({ factor, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  return {
    totalDiscounts,
    totalAmount,
    averageRiskScore,
    riskDistribution,
    monthlyTrend,
    topRiskFactors,
  };
}

/**
 * جلب الخصومات ذات المخاطرة العالية والحرجة
 */
export async function getHighRiskDiscounts(options?: {
  limit?: number;
  offset?: number;
  minRiskLevel?: 'medium' | 'high' | 'critical';
  branchId?: number;
  startDate?: Date;
  endDate?: Date;
}): Promise<{
  records: Array<{
    id: number;
    recordId: string;
    customerId: number | null;
    customerName: string | null;
    customerPhone: string | null;
    branchId: number | null;
    branchName: string | null;
    originalAmount: string;
    discountAmount: string;
    finalAmount: string;
    aiRiskScore: string | null;
    aiRiskLevel: string | null;
    aiAnalysisNotes: string | null;
    createdBy: number | null;
    createdByName: string | null;
    createdAt: Date | null;
    approvedVisitsCount: number | null;
  }>;
  total: number;
}> {
  const db = await getDb();
  if (!db) {
    return { records: [], total: 0 };
  }
  
  const { loyaltyDiscountRecords } = await import('../drizzle/schema');
  
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;
  const minRiskLevel = options?.minRiskLevel || 'high';
  
  // تحديد مستويات المخاطرة المطلوبة
  const riskLevels: string[] = [];
  if (minRiskLevel === 'medium') {
    riskLevels.push('medium', 'high', 'critical');
  } else if (minRiskLevel === 'high') {
    riskLevels.push('high', 'critical');
  } else {
    riskLevels.push('critical');
  }
  
  // بناء الشروط
  const conditions: SQL[] = [
    inArray(loyaltyDiscountRecords.aiRiskLevel as any, riskLevels as any)
  ];
  
  if (options?.branchId) {
    conditions.push(eq(loyaltyDiscountRecords.branchId, options.branchId));
  }
  if (options?.startDate) {
    conditions.push(gte(loyaltyDiscountRecords.createdAt, options.startDate));
  }
  if (options?.endDate) {
    conditions.push(lte(loyaltyDiscountRecords.createdAt, options.endDate));
  }
  
  const whereClause = and(...conditions);
  
  // جلب السجلات
  const records = await db.select()
    .from(loyaltyDiscountRecords)
    .where(whereClause)
    .orderBy(desc(sql`CAST(${loyaltyDiscountRecords.aiRiskScore} AS DECIMAL)`))
    .limit(limit)
    .offset(offset);
  
  // حساب الإجمالي
  const countResult = await db.select({ count: sql<number>`COUNT(*)` })
    .from(loyaltyDiscountRecords)
    .where(whereClause);
  
  const total = Number(countResult[0]?.count || 0);
  
  return { records, total };
}

/**
 * جلب تفاصيل خصم معين مع تحليل المخاطر الكامل
 */
export async function getDiscountRiskDetails(recordId: string): Promise<{
  record: any;
  customerHistory: Array<{
    recordId: string;
    originalAmount: string;
    aiRiskScore: string | null;
    aiRiskLevel: string | null;
    createdAt: Date | null;
  }>;
  employeeHistory: Array<{
    recordId: string;
    customerName: string | null;
    originalAmount: string;
    aiRiskScore: string | null;
    createdAt: Date | null;
  }>;
} | null> {
  const db = await getDb();
  if (!db) return null;
  
  const { loyaltyDiscountRecords } = await import('../drizzle/schema');
  
  // جلب السجل الأساسي
  const records = await db.select()
    .from(loyaltyDiscountRecords)
    .where(eq(loyaltyDiscountRecords.recordId, recordId))
    .limit(1);
  
  if (records.length === 0) return null;
  
  const record = records[0];
  
  // جلب تاريخ خصومات العميل
  const customerHistory = record.customerId 
    ? await db.select({
        recordId: loyaltyDiscountRecords.recordId,
        originalAmount: loyaltyDiscountRecords.originalAmount,
        aiRiskScore: loyaltyDiscountRecords.aiRiskScore,
        aiRiskLevel: loyaltyDiscountRecords.aiRiskLevel,
        createdAt: loyaltyDiscountRecords.createdAt,
      })
      .from(loyaltyDiscountRecords)
      .where(eq(loyaltyDiscountRecords.customerId, record.customerId))
      .orderBy(desc(loyaltyDiscountRecords.createdAt))
      .limit(10)
    : [];
  
  // جلب تاريخ خصومات الموظف
  const employeeHistory = record.createdBy
    ? await db.select({
        recordId: loyaltyDiscountRecords.recordId,
        customerName: loyaltyDiscountRecords.customerName,
        originalAmount: loyaltyDiscountRecords.originalAmount,
        aiRiskScore: loyaltyDiscountRecords.aiRiskScore,
        createdAt: loyaltyDiscountRecords.createdAt,
      })
      .from(loyaltyDiscountRecords)
      .where(eq(loyaltyDiscountRecords.createdBy, record.createdBy))
      .orderBy(desc(loyaltyDiscountRecords.createdAt))
      .limit(10)
    : [];
  
  return {
    record,
    customerHistory,
    employeeHistory,
  };
}


// ==================== نظام دورة الولاء (30 يوم لكل عميل) ====================

/**
 * التحقق من حالة دورة الولاء للعميل
 * - إذا لم تبدأ الدورة بعد، تُرجع null
 * - إذا انتهت الدورة (مرّ 30 يوم)، تُرجع expired: true
 * - إذا الدورة نشطة، تُرجع المعلومات الكاملة
 */
export async function getCustomerCycleStatus(customerId: number): Promise<{
  hasCycle: boolean;
  cycleStartDate: Date | null;
  cycleEndDate: Date | null;
  daysRemaining: number;
  isExpired: boolean;
  visitsInCycle: number;
  discountUsed: boolean;
  visitsDetails: Array<{
    id: number;
    visitDate: Date;
    serviceType: string;
    status: string;
  }>;
}> {
  const db = await getDb();
  if (!db) {
    return {
      hasCycle: false,
      cycleStartDate: null,
      cycleEndDate: null,
      daysRemaining: 0,
      isExpired: false,
      visitsInCycle: 0,
      discountUsed: false,
      visitsDetails: [],
    };
  }

  // جلب بيانات العميل
  const customer = await db.select()
    .from(loyaltyCustomers)
    .where(eq(loyaltyCustomers.id, customerId))
    .limit(1);

  if (!customer[0]) {
    return {
      hasCycle: false,
      cycleStartDate: null,
      cycleEndDate: null,
      daysRemaining: 0,
      isExpired: false,
      visitsInCycle: 0,
      discountUsed: false,
      visitsDetails: [],
    };
  }

  const customerData = customer[0];
  const now = new Date();

  // إذا لم تبدأ الدورة بعد
  if (!customerData.cycleStartDate) {
    return {
      hasCycle: false,
      cycleStartDate: null,
      cycleEndDate: null,
      daysRemaining: 30,
      isExpired: false,
      visitsInCycle: 0,
      discountUsed: false,
      visitsDetails: [],
    };
  }

  const cycleStartDate = new Date(customerData.cycleStartDate);
  const cycleEndDate = new Date(cycleStartDate);
  cycleEndDate.setDate(cycleEndDate.getDate() + 30);

  // حساب الأيام المتبقية
  const timeDiff = cycleEndDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
  const isExpired = daysRemaining <= 0;

  // جلب الزيارات الموافق عليها في الدورة الحالية
  const visitsInCycle = await db.select({
    id: loyaltyVisits.id,
    visitDate: loyaltyVisits.visitDate,
    serviceType: loyaltyVisits.serviceType,
    status: loyaltyVisits.status,
  })
    .from(loyaltyVisits)
    .where(and(
      eq(loyaltyVisits.customerId, customerId),
      eq(loyaltyVisits.status, 'approved'),
      gte(loyaltyVisits.visitDate, cycleStartDate),
      lte(loyaltyVisits.visitDate, cycleEndDate)
    ))
    .orderBy(loyaltyVisits.visitDate);

  return {
    hasCycle: true,
    cycleStartDate,
    cycleEndDate,
    daysRemaining: Math.max(0, daysRemaining),
    isExpired,
    visitsInCycle: visitsInCycle.length,
    discountUsed: customerData.cycleDiscountUsed,
    visitsDetails: visitsInCycle.map(v => ({
      id: v.id,
      visitDate: v.visitDate,
      serviceType: v.serviceType,
      status: v.status,
    })),
  };
}

/**
 * بدء دورة ولاء جديدة للعميل
 * تُستدعى عند تسجيل أول زيارة أو عند انتهاء الدورة السابقة
 */
export async function startNewLoyaltyCycle(customerId: number): Promise<{
  success: boolean;
  cycleStartDate: Date;
  cycleEndDate: Date;
}> {
  const db = await getDb();
  if (!db) return { success: false, cycleStartDate: new Date(), cycleEndDate: new Date() };

  const now = new Date();
  const cycleEndDate = new Date(now);
  cycleEndDate.setDate(cycleEndDate.getDate() + 30);

  await db.update(loyaltyCustomers)
    .set({
      cycleStartDate: now,
      cycleVisitsCount: 0,
      cycleDiscountUsed: false,
    })
    .where(eq(loyaltyCustomers.id, customerId));

  return {
    success: true,
    cycleStartDate: now,
    cycleEndDate,
  };
}

/**
 * تحديث عداد زيارات الدورة
 * تُستدعى عند الموافقة على زيارة
 */
export async function incrementCycleVisits(customerId: number): Promise<{
  success: boolean;
  newCount: number;
  isDiscountEligible: boolean;
}> {
  const db = await getDb();
  if (!db) return { success: false, newCount: 0, isDiscountEligible: false };

  // جلب العدد الحالي
  const customer = await db.select()
    .from(loyaltyCustomers)
    .where(eq(loyaltyCustomers.id, customerId))
    .limit(1);

  if (!customer[0]) return { success: false, newCount: 0, isDiscountEligible: false };

  const newCount = (customer[0].cycleVisitsCount || 0) + 1;
  const isDiscountEligible = newCount >= 3 && !customer[0].cycleDiscountUsed;

  await db.update(loyaltyCustomers)
    .set({ cycleVisitsCount: newCount })
    .where(eq(loyaltyCustomers.id, customerId));

  return {
    success: true,
    newCount,
    isDiscountEligible,
  };
}

/**
 * تعليم الخصم كمستخدم في الدورة الحالية
 */
export async function markCycleDiscountUsed(customerId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  await db.update(loyaltyCustomers)
    .set({ cycleDiscountUsed: true })
    .where(eq(loyaltyCustomers.id, customerId));

  return true;
}

/**
 * الحصول على زيارات العميل في دورته الحالية (30 يوم)
 * بديل عن getCustomerVisitsThisMonth
 */
export async function getCustomerVisitsInCycle(customerId: number): Promise<{
  visits: LoyaltyVisit[];
  cycleInfo: {
    startDate: Date | null;
    endDate: Date | null;
    daysRemaining: number;
    isExpired: boolean;
  };
}> {
  const db = await getDb();
  if (!db) return { 
    visits: [], 
    cycleInfo: { startDate: null, endDate: null, daysRemaining: 0, isExpired: false } 
  };

  // جلب بيانات العميل
  const customer = await db.select()
    .from(loyaltyCustomers)
    .where(eq(loyaltyCustomers.id, customerId))
    .limit(1);

  if (!customer[0] || !customer[0].cycleStartDate) {
    return { 
      visits: [], 
      cycleInfo: { startDate: null, endDate: null, daysRemaining: 30, isExpired: false } 
    };
  }

  const cycleStartDate = new Date(customer[0].cycleStartDate);
  const cycleEndDate = new Date(cycleStartDate);
  cycleEndDate.setDate(cycleEndDate.getDate() + 30);

  const now = new Date();
  const timeDiff = cycleEndDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
  const isExpired = daysRemaining <= 0;

  // جلب الزيارات الموافق عليها في الدورة
  const visits = await db.select()
    .from(loyaltyVisits)
    .where(and(
      eq(loyaltyVisits.customerId, customerId),
      eq(loyaltyVisits.status, 'approved'),
      gte(loyaltyVisits.visitDate, cycleStartDate),
      lte(loyaltyVisits.visitDate, cycleEndDate)
    ))
    .orderBy(loyaltyVisits.visitDate);

  return {
    visits,
    cycleInfo: {
      startDate: cycleStartDate,
      endDate: cycleEndDate,
      daysRemaining: Math.max(0, daysRemaining),
      isExpired,
    },
  };
}

/**
 * تسجيل زيارة جديدة مع نظام الدورة (30 يوم)
 * بديل محسّن عن registerLoyaltyVisit
 */
export async function registerLoyaltyVisitWithCycle(data: {
  customerId: number;
  customerName: string;
  customerPhone: string;
  serviceType: string;
  branchId?: number;
  branchName?: string;
  invoiceImageUrl?: string;
  invoiceImageKey?: string;
}): Promise<{ 
  success: boolean; 
  visit?: LoyaltyVisit; 
  isDiscountVisit: boolean;
  discountPercentage: number;
  visitNumberInCycle: number;
  cycleInfo: {
    startDate: Date | null;
    endDate: Date | null;
    daysRemaining: number;
    isNewCycle: boolean;
  };
  error?: string;
}> {
  const db = await getDb();
  if (!db) return { 
    success: false, 
    isDiscountVisit: false, 
    discountPercentage: 0, 
    visitNumberInCycle: 0,
    cycleInfo: { startDate: null, endDate: null, daysRemaining: 0, isNewCycle: false },
    error: "خطأ في الاتصال بقاعدة البيانات" 
  };

  // التحقق من عدم وجود زيارة سابقة في نفس اليوم
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  const existingVisitToday = await db.select()
    .from(loyaltyVisits)
    .where(
      and(
        eq(loyaltyVisits.customerId, data.customerId),
        gte(loyaltyVisits.visitDate, startOfDay),
        lt(loyaltyVisits.visitDate, endOfDay)
      )
    )
    .limit(1);

  if (existingVisitToday.length > 0) {
    return { 
      success: false, 
      isDiscountVisit: false, 
      discountPercentage: 0, 
      visitNumberInCycle: 0,
      cycleInfo: { startDate: null, endDate: null, daysRemaining: 0, isNewCycle: false },
      error: "لقد سجلت زيارة اليوم بالفعل. يمكنك تسجيل زيارة جديدة غداً." 
    };
  }

  // التحقق من حالة الدورة
  const cycleStatus = await getCustomerCycleStatus(data.customerId);
  let isNewCycle = false;

  // إذا لم تبدأ الدورة أو انتهت، نبدأ دورة جديدة
  if (!cycleStatus.hasCycle || cycleStatus.isExpired) {
    await startNewLoyaltyCycle(data.customerId);
    isNewCycle = true;
  }

  // جلب حالة الدورة المحدثة
  const updatedCycleStatus = isNewCycle 
    ? await getCustomerCycleStatus(data.customerId)
    : cycleStatus;

  // حساب رقم الزيارة في الدورة
  const visitNumberInCycle = updatedCycleStatus.visitsInCycle + 1;

  // التحقق من استحقاق الخصم (الزيارة الثالثة)
  const isDiscountVisit = visitNumberInCycle === 3 && !updatedCycleStatus.discountUsed;
  const discountPercentage = isDiscountVisit ? 60 : 0;

  const visitId = await generateLoyaltyVisitId();

  await db.insert(loyaltyVisits).values({
    visitId,
    customerId: data.customerId,
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    serviceType: data.serviceType,
    visitDate: new Date(),
    branchId: data.branchId || null,
    branchName: data.branchName || null,
    invoiceImageUrl: data.invoiceImageUrl || null,
    invoiceImageKey: data.invoiceImageKey || null,
    status: 'pending',
    isDiscountVisit,
    discountPercentage,
    visitNumberInMonth: visitNumberInCycle, // نستخدم نفس الحقل لتوافق البيانات
  });

  const visit = await db.select()
    .from(loyaltyVisits)
    .where(eq(loyaltyVisits.visitId, visitId))
    .limit(1);

  return { 
    success: true, 
    visit: visit[0], 
    isDiscountVisit, 
    discountPercentage,
    visitNumberInCycle,
    cycleInfo: {
      startDate: updatedCycleStatus.cycleStartDate,
      endDate: updatedCycleStatus.cycleEndDate,
      daysRemaining: updatedCycleStatus.daysRemaining,
      isNewCycle,
    },
  };
}

/**
 * الموافقة على زيارة مع تحديث دورة الولاء
 * بديل محسّن عن approveVisit
 */
export async function approveVisitWithCycle(visitId: number, approvedBy: number): Promise<{
  success: boolean;
  visit?: LoyaltyVisit;
  cycleInfo?: {
    visitsInCycle: number;
    isDiscountEligible: boolean;
    daysRemaining: number;
  };
  error?: string;
}> {
  const db = await getDb();
  if (!db) return { success: false, error: "خطأ في الاتصال بقاعدة البيانات" };

  // جلب الزيارة
  const visit = await db.select()
    .from(loyaltyVisits)
    .where(eq(loyaltyVisits.id, visitId))
    .limit(1);

  if (!visit[0]) {
    return { success: false, error: "الزيارة غير موجودة" };
  }

  if (visit[0].status === 'approved') {
    return { success: false, error: "الزيارة موافق عليها مسبقاً" };
  }

  // تحديث حالة الزيارة
  await db.update(loyaltyVisits)
    .set({
      status: 'approved',
      approvedBy,
      approvedAt: new Date(),
    })
    .where(eq(loyaltyVisits.id, visitId));

  // تحديث إحصائيات العميل
  await db.update(loyaltyCustomers)
    .set({
      totalVisits: sql`${loyaltyCustomers.totalVisits} + 1`,
    })
    .where(eq(loyaltyCustomers.id, visit[0].customerId));

  // تحديث عداد زيارات الدورة
  const cycleUpdate = await incrementCycleVisits(visit[0].customerId);

  // جلب حالة الدورة المحدثة
  const cycleStatus = await getCustomerCycleStatus(visit[0].customerId);

  // جلب الزيارة المحدثة
  const updatedVisit = await db.select()
    .from(loyaltyVisits)
    .where(eq(loyaltyVisits.id, visitId))
    .limit(1);

  return {
    success: true,
    visit: updatedVisit[0],
    cycleInfo: {
      visitsInCycle: cycleUpdate.newCount,
      isDiscountEligible: cycleUpdate.isDiscountEligible,
      daysRemaining: cycleStatus.daysRemaining,
    },
  };
}

/**
 * البحث عن عميل بالجوال مع معلومات الدورة
 */
export async function findCustomerByPhoneWithCycle(phone: string): Promise<{
  customer: LoyaltyCustomer | null;
  cycleInfo: {
    hasCycle: boolean;
    startDate: Date | null;
    endDate: Date | null;
    daysRemaining: number;
    isExpired: boolean;
    visitsInCycle: number;
    discountUsed: boolean;
    visitsDetails: Array<{
      id: number;
      visitDate: Date;
      serviceType: string;
      status: string;
    }>;
  };
}> {
  const db = await getDb();
  if (!db) return { 
    customer: null, 
    cycleInfo: {
      hasCycle: false,
      startDate: null,
      endDate: null,
      daysRemaining: 0,
      isExpired: false,
      visitsInCycle: 0,
      discountUsed: false,
      visitsDetails: [],
    }
  };

  const customer = await db.select()
    .from(loyaltyCustomers)
    .where(eq(loyaltyCustomers.phone, phone))
    .limit(1);

  if (!customer[0]) {
    return { 
      customer: null, 
      cycleInfo: {
        hasCycle: false,
        startDate: null,
        endDate: null,
        daysRemaining: 0,
        isExpired: false,
        visitsInCycle: 0,
        discountUsed: false,
        visitsDetails: [],
      }
    };
  }

  const cycleStatus = await getCustomerCycleStatus(customer[0].id);

  return {
    customer: customer[0],
    cycleInfo: {
      hasCycle: cycleStatus.hasCycle,
      startDate: cycleStatus.cycleStartDate,
      endDate: cycleStatus.cycleEndDate,
      daysRemaining: cycleStatus.daysRemaining,
      isExpired: cycleStatus.isExpired,
      visitsInCycle: cycleStatus.visitsInCycle,
      discountUsed: cycleStatus.discountUsed,
      visitsDetails: cycleStatus.visitsDetails,
    },
  };
}


// ==================== دوال ربط الإجازات بمسير الرواتب ====================

// جلب الإجازات المعتمدة لموظف في شهر معين
export async function getApprovedLeavesForEmployee(
  employeeId: number,
  year: number,
  month: number
): Promise<{
  totalDays: number;
  totalDeduction: number;
  leaves: Array<{
    id: number;
    startDate: string;
    endDate: string;
    days: number;
    type: string;
    reason: string;
  }>;
}> {
  const db = await getDb();
  if (!db) return { totalDays: 0, totalDeduction: 0, leaves: [] };

  // حساب بداية ونهاية الشهر
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);

  // جلب طلبات الإجازة المعتمدة للموظف في هذا الشهر
  const leaveRequests = await db.select()
    .from(employeeRequests)
    .where(and(
      eq(employeeRequests.employeeId, employeeId),
      eq(employeeRequests.requestType, 'vacation'),
      eq(employeeRequests.status, 'approved'),
      // الإجازة تتقاطع مع الشهر المطلوب
      lte(employeeRequests.vacationStartDate!, monthEnd),
      gte(employeeRequests.vacationEndDate!, monthStart)
    ));

  if (leaveRequests.length === 0) {
    return { totalDays: 0, totalDeduction: 0, leaves: [] };
  }

  // حساب أيام الإجازة في هذا الشهر فقط
  let totalDays = 0;
  const leaves: Array<{
    id: number;
    startDate: string;
    endDate: string;
    days: number;
    type: string;
    reason: string;
  }> = [];

  for (const leave of leaveRequests) {
    if (!leave.vacationStartDate) continue;
    
    // إذا لم يكن هناك تاريخ نهاية، نستخدم تاريخ البداية + عدد الأيام
    const leaveStart = new Date(leave.vacationStartDate);
    let leaveEnd: Date;
    
    if (leave.vacationEndDate) {
      leaveEnd = new Date(leave.vacationEndDate);
    } else if (leave.vacationDays && leave.vacationDays > 0) {
      // حساب تاريخ النهاية من عدد الأيام
      leaveEnd = new Date(leaveStart);
      leaveEnd.setDate(leaveEnd.getDate() + leave.vacationDays - 1);
    } else {
      // إذا لم يكن هناك تاريخ نهاية ولا عدد أيام، نعتبرها يوم واحد
      leaveEnd = new Date(leaveStart);
    }

    // حساب التقاطع مع الشهر
    const effectiveStart = leaveStart < monthStart ? monthStart : leaveStart;
    const effectiveEnd = leaveEnd > monthEnd ? monthEnd : leaveEnd;

    // حساب عدد الأيام
    const days = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    if (days > 0) {
      totalDays += days;
      leaves.push({
        id: leave.id,
        startDate: effectiveStart.toISOString().split('T')[0],
        endDate: effectiveEnd.toISOString().split('T')[0],
        days,
        type: leave.vacationType || 'بدون راتب',
        reason: leave.description || '',
      });
    }
  }

  return { totalDays, totalDeduction: 0, leaves };
}

// جلب الإجازات المعتمدة لجميع موظفي فرع في شهر معين
export async function getApprovedLeavesForBranch(
  branchId: number,
  year: number,
  month: number
): Promise<Map<number, {
  totalDays: number;
  totalDeduction: number;
  leaves: Array<{
    id: number;
    startDate: string;
    endDate: string;
    days: number;
    type: string;
    reason: string;
  }>;
}>> {
  const db = await getDb();
  const result = new Map();
  if (!db) return result;

  // جلب موظفي الفرع
  const branchEmployees = await db.select()
    .from(employees)
    .where(eq(employees.branchId, branchId));

  // جلب الإجازات لكل موظف
  for (const emp of branchEmployees) {
    const empLeaves = await getApprovedLeavesForEmployee(emp.id, year, month);
    if (empLeaves.totalDays > 0) {
      result.set(emp.id, empLeaves);
    }
  }

  return result;
}

// حساب خصم الإجازة بناءً على الراتب الأساسي
export function calculateLeaveDeduction(
  baseSalary: number,
  leaveDays: number,
  leaveType: string,
  workDays: number = 30
): number {
  // الراتب اليومي
  const dailySalary = baseSalary / workDays;
  
  // توحيد نوع الإجازة (دعم الإنجليزية والعربية)
  const normalizedType = leaveType?.toLowerCase().trim();

  // حساب الخصم حسب نوع الإجازة
  switch (normalizedType) {
    // إجازة سنوية - مدفوعة بالكامل
    case 'سنوية':
    case 'annual':
    // إجازة مرضية - مدفوعة بالكامل
    case 'مرضية':
    case 'sick':
      return 0;
    // إجازة طارئة - خصم 50%
    case 'طارئة':
    case 'emergency':
      return dailySalary * leaveDays * 0.5;
    // إجازة بدون راتب - خصم كامل
    case 'بدون راتب':
    case 'unpaid':
    default:
      return dailySalary * leaveDays;
  }
}

// تحديث تفاصيل الراتب بالإجازات
export async function updatePayrollDetailWithLeaves(
  payrollDetailId: number,
  leaveDays: number,
  leaveDeduction: number,
  leaveType: string,
  leaveDetails: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // جلب تفاصيل الراتب الحالية
  const detail = await db.select().from(payrollDetails)
    .where(eq(payrollDetails.id, payrollDetailId))
    .limit(1);

  if (detail.length === 0) return;

  const currentDetail = detail[0];
  const currentTotalDeductions = parseFloat(currentDetail.totalDeductions as string) || 0;
  const currentNetSalary = parseFloat(currentDetail.netSalary as string) || 0;

  // تحديث الخصومات والصافي
  const newTotalDeductions = currentTotalDeductions + leaveDeduction;
  const newNetSalary = currentNetSalary - leaveDeduction;

  await db.update(payrollDetails)
    .set({
      leaveDays,
      leaveDeduction: leaveDeduction.toFixed(2),
      leaveType,
      leaveDetails,
      totalDeductions: newTotalDeductions.toFixed(2),
      netSalary: newNetSalary.toFixed(2),
    })
    .where(eq(payrollDetails.id, payrollDetailId));
}


// ==================== دوال بوابة الموظفين ====================

// جلب بيانات الموظف الكاملة للملف الشخصي
export async function getEmployeeProfile(employeeId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select({
    id: employees.id,
    code: employees.code,
    name: employees.name,
    branchId: employees.branchId,
    phone: employees.phone,
    email: employees.email,
    emailVerified: employees.emailVerified,
    position: employees.position,
    username: employees.username,
    hasPortalAccess: employees.hasPortalAccess,
    lastLogin: employees.lastLogin,
    isActive: employees.isActive,
    createdAt: employees.createdAt,
    photoUrl: employees.photoUrl,
  })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);

  if (result.length === 0) return null;

  // جلب اسم الفرع
  const branch = await db.select({ name: branches.name })
    .from(branches)
    .where(eq(branches.id, result[0].branchId))
    .limit(1);

  // جلب إعدادات الراتب للموظف
  const salarySettings = await db.select({
    baseSalary: employeeSalarySettings.baseSalary,
    overtimeEnabled: employeeSalarySettings.overtimeEnabled,
    isSupervisor: employeeSalarySettings.isSupervisor,
  })
    .from(employeeSalarySettings)
    .where(eq(employeeSalarySettings.employeeId, employeeId))
    .limit(1);

  return {
    ...result[0],
    branchName: branch[0]?.name || 'غير محدد',
    baseSalary: salarySettings[0]?.baseSalary || '2000.00',
    overtimeEnabled: salarySettings[0]?.overtimeEnabled || false,
    isSupervisor: salarySettings[0]?.isSupervisor || false,
    hireDate: result[0].createdAt, // استخدام تاريخ الإنشاء كتاريخ تعيين
    status: result[0].isActive ? 'active' : 'inactive',
  };
}

// جلب كشف راتب الموظف لشهر محدد
export async function getEmployeeSalarySlip(employeeId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) return null;

  // جلب بيانات الموظف
  const employee = await db.select()
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);

  if (employee.length === 0) return null;

  // جلب مسير الرواتب للشهر المحدد
  const payroll = await db.select()
    .from(payrolls)
    .where(
      and(
        eq(payrolls.branchId, employee[0].branchId),
        eq(payrolls.year, year),
        eq(payrolls.month, month)
      )
    )
    .limit(1);

  if (payroll.length === 0) return null;

  // جلب تفاصيل راتب الموظف
  const salaryDetail = await db.select()
    .from(payrollDetails)
    .where(
      and(
        eq(payrollDetails.payrollId, payroll[0].id),
        eq(payrollDetails.employeeId, employeeId)
      )
    )
    .limit(1);

  if (salaryDetail.length === 0) return null;

  const detail = salaryDetail[0];

  return {
    // معلومات الموظف
    employeeId: employee[0].id,
    employeeName: employee[0].name,
    employeeCode: employee[0].code,
    position: employee[0].position,
    branchId: employee[0].branchId,
    
    // معلومات المسير
    payrollId: payroll[0].id,
    payrollNumber: payroll[0].payrollNumber,
    year,
    month,
    status: payroll[0].status,
    
    // مكونات الراتب
    baseSalary: parseFloat(detail.baseSalary as string) || 0,
    overtimeEnabled: detail.overtimeEnabled,
    overtimeAmount: parseFloat(detail.overtimeAmount as string) || 0,
    
    // أيام العمل
    workDays: detail.workDays,
    absentDays: detail.absentDays,
    absentDeduction: parseFloat(detail.absentDeduction as string) || 0,
    
    // الحوافز
    incentiveAmount: parseFloat(detail.incentiveAmount as string) || 0,
    isSupervisor: detail.isSupervisor,
    
    // الخصومات
    deductionAmount: parseFloat(detail.deductionAmount as string) || 0,
    deductionReason: detail.deductionReason,
    advanceDeduction: parseFloat(detail.advanceDeduction as string) || 0,
    negativeInvoicesDeduction: parseFloat(detail.negativeInvoicesDeduction as string) || 0,
    
    // الإجازات
    leaveDays: detail.leaveDays || 0,
    leaveDeduction: parseFloat(detail.leaveDeduction as string) || 0,
    leaveType: detail.leaveType,
    
    // الإجماليات
    totalEarnings: parseFloat(detail.grossSalary as string) || 0,
    totalDeductions: parseFloat(detail.totalDeductions as string) || 0,
    netSalary: parseFloat(detail.netSalary as string) || 0,
  };
}

// جلب سجل رواتب الموظف
export async function getEmployeeSalaryHistory(employeeId: number, limit: number = 12) {
  const db = await getDb();
  if (!db) return [];

  // جلب بيانات الموظف
  const employee = await db.select()
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);

  if (employee.length === 0) return [];

  // جلب جميع تفاصيل الرواتب للموظف
  const details = await db.select({
    id: payrollDetails.id,
    payrollId: payrollDetails.payrollId,
    baseSalary: payrollDetails.baseSalary,
    grossSalary: payrollDetails.grossSalary,
    totalDeductions: payrollDetails.totalDeductions,
    netSalary: payrollDetails.netSalary,
  })
    .from(payrollDetails)
    .where(eq(payrollDetails.employeeId, employeeId))
    .orderBy(desc(payrollDetails.id))
    .limit(limit);

  // جلب معلومات المسيرات
  const result = [];
  for (const detail of details) {
    const payroll = await db.select({
      payrollNumber: payrolls.payrollNumber,
      year: payrolls.year,
      month: payrolls.month,
      status: payrolls.status,
    })
      .from(payrolls)
      .where(eq(payrolls.id, detail.payrollId))
      .limit(1);

    if (payroll.length > 0) {
      result.push({
        ...detail,
        ...payroll[0],
        baseSalary: parseFloat(detail.baseSalary as string) || 0,
        grossSalary: parseFloat(detail.grossSalary as string) || 0,
        totalDeductions: parseFloat(detail.totalDeductions as string) || 0,
        netSalary: parseFloat(detail.netSalary as string) || 0,
      });
    }
  }

  return result;
}

// جلب رصيد إجازات الموظف
export async function getEmployeeLeaveBalance(employeeId: number, year: number) {
  const db = await getDb();
  if (!db) return null;

  // الرصيد الافتراضي للإجازات السنوية (21 يوم)
  const defaultAnnualLeave = 21;
  const defaultSickLeave = 30;
  const defaultEmergencyLeave = 5;

  // جلب الإجازات المستخدمة من طلبات الموظفين
  const usedLeaves = await db.select({
    vacationType: employeeRequests.vacationType,
    vacationDays: employeeRequests.vacationDays,
  })
    .from(employeeRequests)
    .where(
      and(
        eq(employeeRequests.employeeId, employeeId),
        eq(employeeRequests.requestType, 'vacation'),
        eq(employeeRequests.status, 'approved'),
        sql`YEAR(${employeeRequests.vacationStartDate}) = ${year}`
      )
    );

  // حساب الإجازات المستخدمة حسب النوع
  let usedAnnual = 0;
  let usedSick = 0;
  let usedEmergency = 0;
  let usedUnpaid = 0;

  for (const leave of usedLeaves) {
    const days = leave.vacationDays || 0;
    switch (leave.vacationType) {
      case 'سنوية':
        usedAnnual += days;
        break;
      case 'مرضية':
        usedSick += days;
        break;
      case 'طارئة':
        usedEmergency += days;
        break;
      case 'بدون راتب':
        usedUnpaid += days;
        break;
    }
  }

  return {
    year,
    annual: {
      total: defaultAnnualLeave,
      used: usedAnnual,
      remaining: defaultAnnualLeave - usedAnnual,
    },
    sick: {
      total: defaultSickLeave,
      used: usedSick,
      remaining: defaultSickLeave - usedSick,
    },
    emergency: {
      total: defaultEmergencyLeave,
      used: usedEmergency,
      remaining: defaultEmergencyLeave - usedEmergency,
    },
    unpaid: {
      used: usedUnpaid,
    },
    totalUsed: usedAnnual + usedSick + usedEmergency + usedUnpaid,
  };
}

// جلب سجل إجازات الموظف
export async function getEmployeeLeaveHistory(employeeId: number, year?: number) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [
    eq(employeeRequests.employeeId, employeeId),
    eq(employeeRequests.requestType, 'vacation'),
  ];

  if (year) {
    conditions.push(sql`YEAR(${employeeRequests.vacationStartDate}) = ${year}`);
  }

  return await db.select({
    id: employeeRequests.id,
    requestNumber: employeeRequests.requestNumber,
    vacationType: employeeRequests.vacationType,
    vacationStartDate: employeeRequests.vacationStartDate,
    vacationEndDate: employeeRequests.vacationEndDate,
    vacationDays: employeeRequests.vacationDays,
    status: employeeRequests.status,
    description: employeeRequests.description,
    reviewedAt: employeeRequests.reviewedAt,
    reviewNotes: employeeRequests.reviewNotes,
    createdAt: employeeRequests.createdAt,
  })
    .from(employeeRequests)
    .where(and(...conditions))
    .orderBy(desc(employeeRequests.createdAt));
}

// جلب تقرير البونص للموظف
export async function getEmployeeBonusReport(employeeId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) return null;

  // جلب بيانات الموظف
  const employee = await db.select()
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);

  if (employee.length === 0) return null;

  // جلب سجلات البونص الأسبوعية للفرع في الشهر المحدد
  const weeklyBonusRecords = await db.select()
    .from(weeklyBonuses)
    .where(
      and(
        eq(weeklyBonuses.branchId, employee[0].branchId),
        eq(weeklyBonuses.year, year),
        eq(weeklyBonuses.month, month)
      )
    );

  // جلب تفاصيل البونص للموظف
  const employeeBonusDetails: any[] = [];
  for (const record of weeklyBonusRecords) {
    const details = await db.select()
      .from(bonusDetails)
      .where(
        and(
          eq(bonusDetails.weeklyBonusId, record.id),
          eq(bonusDetails.employeeId, employeeId)
        )
      );
    employeeBonusDetails.push(...details.map(d => ({
      ...d,
      weekNumber: record.weekNumber,
      weekStart: record.weekStart,
      weekEnd: record.weekEnd,
    })));
  }

  // حساب إجمالي البونص
  let totalBonus = 0;
  let totalRevenue = 0;
  const weeklyDetailsResult = employeeBonusDetails.map((detail: any) => {
    const bonus = parseFloat(detail.bonusAmount) || 0;
    const revenue = parseFloat(detail.weeklyRevenue) || 0;
    totalBonus += bonus;
    totalRevenue += revenue;
    return {
      weekNumber: detail.weekNumber,
      startDate: detail.weekStart,
      endDate: detail.weekEnd,
      revenue: revenue,
      bonus: bonus,
    };
  });

  return {
    employeeId,
    employeeName: employee[0].name,
    year,
    month,
    totalRevenue,
    totalBonus,
    bonusPercentage: totalRevenue > 0 ? ((totalBonus / totalRevenue) * 100).toFixed(1) : '0',
    weeksCount: weeklyDetailsResult.length,
    weeks: weeklyDetailsResult,
  };
}

// جلب سجل البونص للموظف
export async function getEmployeeBonusHistory(employeeId: number, limit: number = 6) {
  const db = await getDb();
  if (!db) return [];

  // جلب بيانات الموظف
  const employee = await db.select()
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);

  if (employee.length === 0) return [];

  // جلب تفاصيل البونص للموظف مع بيانات الأسبوع
  const details = await db.select({
    bonusAmount: bonusDetails.bonusAmount,
    weeklyRevenue: bonusDetails.weeklyRevenue,
    year: weeklyBonuses.year,
    month: weeklyBonuses.month,
  })
    .from(bonusDetails)
    .innerJoin(weeklyBonuses, eq(bonusDetails.weeklyBonusId, weeklyBonuses.id))
    .where(eq(bonusDetails.employeeId, employeeId))
    .orderBy(desc(weeklyBonuses.year), desc(weeklyBonuses.month));

  // تجميع حسب الشهر
  const monthlyBonuses = new Map<string, { bonus: number; revenue: number }>();
  for (const detail of details) {
    const key = `${detail.year}-${detail.month}`;
    const current = monthlyBonuses.get(key) || { bonus: 0, revenue: 0 };
    monthlyBonuses.set(key, {
      bonus: current.bonus + (parseFloat(detail.bonusAmount) || 0),
      revenue: current.revenue + (parseFloat(detail.weeklyRevenue || '0') || 0),
    });
  }

  return Array.from(monthlyBonuses.entries())
    .map(([key, data]) => {
      const [year, month] = key.split('-').map(Number);
      return { year, month, totalBonus: data.bonus, totalRevenue: data.revenue };
    })
    .slice(0, limit);
}

// تحديث بيانات الموظف الشخصية
export async function updateEmployeeProfile(
  employeeId: number,
  data: { phone?: string; email?: string }
) {
  const db = await getDb();
  if (!db) return false;

  await db.update(employees)
    .set({
      phone: data.phone,
      email: data.email,
      updatedAt: new Date(),
    })
    .where(eq(employees.id, employeeId));

  return true;
}

// حفظ البريد الإلكتروني عند أول تسجيل دخول
export async function setupEmployeeEmail(employeeId: number, email: string) {
  const db = await getDb();
  if (!db) return false;

  await db.update(employees)
    .set({
      email: email,
      emailVerified: true,
      updatedAt: new Date(),
    })
    .where(eq(employees.id, employeeId));

  return true;
}

// إلغاء طلب موظف (فقط إذا كان قيد المراجعة)
export async function cancelEmployeeRequest(requestId: number, employeeId: number) {
  const db = await getDb();
  if (!db) return { success: false, error: 'خطأ في الاتصال بقاعدة البيانات' };

  // التحقق من الطلب
  const request = await db.select()
    .from(employeeRequests)
    .where(
      and(
        eq(employeeRequests.id, requestId),
        eq(employeeRequests.employeeId, employeeId)
      )
    )
    .limit(1);

  if (request.length === 0) {
    return { success: false, error: 'الطلب غير موجود' };
  }

  if (request[0].status !== 'pending') {
    return { success: false, error: 'لا يمكن إلغاء الطلب بعد المراجعة' };
  }

  // إلغاء الطلب
  await db.update(employeeRequests)
    .set({
      status: 'cancelled',
      updatedAt: new Date(),
    })
    .where(eq(employeeRequests.id, requestId));

  return { success: true };
}

// تحديث طلب موظف من بوابة الموظفين (فقط إذا كان قيد المراجعة)
export async function updateEmployeeRequestFromPortal(
  requestId: number,
  employeeId: number,
  data: {
    description?: string;
    advanceAmount?: string;
    advanceReason?: string;
    vacationStartDate?: Date;
    vacationEndDate?: Date;
    vacationDays?: number;
    permissionDate?: Date;
    permissionStartTime?: string;
    permissionEndTime?: string;
  }
) {
  const db = await getDb();
  if (!db) return { success: false, error: 'خطأ في الاتصال بقاعدة البيانات' };

  // التحقق من الطلب
  const request = await db.select()
    .from(employeeRequests)
    .where(
      and(
        eq(employeeRequests.id, requestId),
        eq(employeeRequests.employeeId, employeeId)
      )
    )
    .limit(1);

  if (request.length === 0) {
    return { success: false, error: 'الطلب غير موجود' };
  }

  if (request[0].status !== 'pending') {
    return { success: false, error: 'لا يمكن تعديل الطلب بعد المراجعة' };
  }

  // تحديث الطلب
  await db.update(employeeRequests)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(employeeRequests.id, requestId));

  return { success: true };
}

// جلب إحصائيات طلبات الموظف من بوابة الموظفين
export async function getEmployeePortalRequestsStats(employeeId: number) {
  const db = await getDb();
  if (!db) return null;

  const requests = await db.select({
    status: employeeRequests.status,
  })
    .from(employeeRequests)
    .where(eq(employeeRequests.employeeId, employeeId));

  let total = 0;
  let pending = 0;
  let approved = 0;
  let rejected = 0;
  let cancelled = 0;

  for (const req of requests) {
    total++;
    switch (req.status) {
      case 'pending':
        pending++;
        break;
      case 'approved':
        approved++;
        break;
      case 'rejected':
        rejected++;
        break;
      case 'cancelled':
        cancelled++;
        break;
    }
  }

  return { total, pending, approved, rejected, cancelled };
}


// ==================== دوال مرفقات الطلبات ====================
import { requestAttachments, requestTimeline, employeeLeaveBalance } from "../drizzle/schema";

// إضافة مرفق لطلب
export async function addRequestAttachment(data: {
  requestId: number;
  fileName: string;
  fileUrl: string;
  fileType?: string;
  fileSize?: number;
  uploadedBy: number;
}) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(requestAttachments).values(data);
  return result;
}

// جلب مرفقات طلب معين
export async function getRequestAttachments(requestId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select()
    .from(requestAttachments)
    .where(eq(requestAttachments.requestId, requestId))
    .orderBy(desc(requestAttachments.createdAt));
}

// حذف مرفق
export async function deleteRequestAttachment(attachmentId: number, employeeId: number) {
  const db = await getDb();
  if (!db) return { success: false, error: 'خطأ في الاتصال بقاعدة البيانات' };
  
  // التحقق من أن المرفق يخص الموظف
  const attachment = await db.select()
    .from(requestAttachments)
    .where(eq(requestAttachments.id, attachmentId))
    .limit(1);
  
  if (attachment.length === 0 || attachment[0].uploadedBy !== employeeId) {
    return { success: false, error: 'غير مصرح بحذف هذا المرفق' };
  }
  
  await db.delete(requestAttachments).where(eq(requestAttachments.id, attachmentId));
  return { success: true };
}

// ==================== دوال تتبع الطلبات ====================

// إضافة مرحلة جديدة في تتبع الطلب
export async function addRequestTimelineEntry(data: {
  requestId: number;
  status: "submitted" | "under_review" | "pending_approval" | "approved" | "rejected" | "cancelled" | "completed";
  notes?: string;
  actionBy?: number;
  actionByName?: string;
}) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(requestTimeline).values(data);
  return result;
}

// جلب تتبع طلب معين
export async function getRequestTimeline(requestId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select()
    .from(requestTimeline)
    .where(eq(requestTimeline.requestId, requestId))
    .orderBy(asc(requestTimeline.createdAt));
}

// ==================== دوال رصيد الإجازات ====================

// جلب رصيد إجازات موظف
export async function getEmployeeLeaveBalanceData(employeeId: number, year: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select()
    .from(employeeLeaveBalance)
    .where(and(
      eq(employeeLeaveBalance.employeeId, employeeId),
      eq(employeeLeaveBalance.year, year)
    ));
}

// تحديث رصيد الإجازات
export async function updateEmployeeLeaveBalance(data: {
  employeeId: number;
  year: number;
  leaveType: "annual" | "sick" | "emergency" | "unpaid";
  totalDays?: number;
  usedDays?: number;
  pendingDays?: number;
}) {
  const db = await getDb();
  if (!db) return { success: false };
  
  const existing = await db.select()
    .from(employeeLeaveBalance)
    .where(and(
      eq(employeeLeaveBalance.employeeId, data.employeeId),
      eq(employeeLeaveBalance.year, data.year),
      eq(employeeLeaveBalance.leaveType, data.leaveType)
    ))
    .limit(1);
  
  if (existing.length > 0) {
    // تحديث السجل الموجود
    await db.update(employeeLeaveBalance)
      .set({
        totalDays: data.totalDays ?? existing[0].totalDays,
        usedDays: data.usedDays ?? existing[0].usedDays,
        pendingDays: data.pendingDays ?? existing[0].pendingDays,
      })
      .where(eq(employeeLeaveBalance.id, existing[0].id));
  } else {
    // إنشاء سجل جديد
    await db.insert(employeeLeaveBalance).values({
      employeeId: data.employeeId,
      year: data.year,
      leaveType: data.leaveType,
      totalDays: data.totalDays ?? 0,
      usedDays: data.usedDays ?? 0,
      pendingDays: data.pendingDays ?? 0,
    });
  }
  
  return { success: true };
}

// تهيئة رصيد إجازات موظف جديد
export async function initializeEmployeeLeaveBalance(employeeId: number, year: number) {
  const db = await getDb();
  if (!db) return { success: false };
  
  const leaveTypes: Array<"annual" | "sick" | "emergency" | "unpaid"> = ["annual", "sick", "emergency", "unpaid"];
  const defaultDays = {
    annual: 21, // 21 يوم سنوية
    sick: 30,   // 30 يوم مرضية
    emergency: 5, // 5 أيام طارئة
    unpaid: 0   // بدون راتب - غير محدود
  };
  
  for (const leaveType of leaveTypes) {
    const existing = await db.select()
      .from(employeeLeaveBalance)
      .where(and(
        eq(employeeLeaveBalance.employeeId, employeeId),
        eq(employeeLeaveBalance.year, year),
        eq(employeeLeaveBalance.leaveType, leaveType)
      ))
      .limit(1);
    
    if (existing.length === 0) {
      await db.insert(employeeLeaveBalance).values({
        employeeId,
        year,
        leaveType,
        totalDays: defaultDays[leaveType],
        usedDays: 0,
        pendingDays: 0,
      });
    }
  }
  
  return { success: true };
}


// ==================== دوال إشعارات الموظفين ====================

/**
 * إنشاء إشعار جديد للموظف
 */
export async function createEmployeeNotification(data: {
  employeeId: number;
  type: 'request_status' | 'salary_ready' | 'task_assigned' | 'leave_balance' | 'bonus_ready' | 'general';
  title: string;
  message: string;
  relatedType?: string;
  relatedId?: number;
}) {
  const { employeeNotifications } = await import('../drizzle/schema');
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const result = await db.insert(employeeNotifications).values({
    employeeId: data.employeeId,
    type: data.type,
    title: data.title,
    message: data.message,
    relatedType: data.relatedType,
    relatedId: data.relatedId,
    isRead: false,
  });
  
  return result;
}

/**
 * جلب إشعارات الموظف
 */
export async function getEmployeeNotifications(employeeId: number, limit = 50) {
  const { employeeNotifications } = await import('../drizzle/schema');
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  return await db.select()
    .from(employeeNotifications)
    .where(eq(employeeNotifications.employeeId, employeeId))
    .orderBy(desc(employeeNotifications.createdAt))
    .limit(limit);
}

/**
 * جلب عدد الإشعارات غير المقروءة
 */
export async function getUnreadNotificationCount(employeeId: number) {
  const { employeeNotifications } = await import('../drizzle/schema');
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(employeeNotifications)
    .where(and(
      eq(employeeNotifications.employeeId, employeeId),
      eq(employeeNotifications.isRead, false)
    ));
  
  return result[0]?.count || 0;
}

/**
 * تحديد إشعار كمقروء
 */
export async function markEmployeeNotificationAsRead(notificationId: number, employeeId: number) {
  const { employeeNotifications } = await import('../drizzle/schema');
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  await db.update(employeeNotifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(
      eq(employeeNotifications.id, notificationId),
      eq(employeeNotifications.employeeId, employeeId)
    ));
  
  return { success: true };
}

/**
 * تحديد جميع الإشعارات كمقروءة
 */
export async function markAllEmployeeNotificationsAsRead(employeeId: number) {
  const { employeeNotifications } = await import('../drizzle/schema');
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  await db.update(employeeNotifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(
      eq(employeeNotifications.employeeId, employeeId),
      eq(employeeNotifications.isRead, false)
    ));
  
  return { success: true };
}

/**
 * إرسال إشعار تغيير حالة الطلب للموظف
 */
export async function notifyEmployeeRequestStatusChange(data: {
  employeeId: number;
  requestId: number;
  requestType: string;
  requestTitle: string;
  oldStatus: string;
  newStatus: string;
  reviewerName?: string;
  rejectionReason?: string;
}) {
  const statusMap: Record<string, string> = {
    'approved': 'تمت الموافقة',
    'rejected': 'تم الرفض',
    'cancelled': 'تم الإلغاء',
    'pending': 'قيد المراجعة',
  };
  
  const statusText = statusMap[data.newStatus] || data.newStatus;
  let message = `${statusText} على طلبك: ${data.requestTitle}`;
  
  if (data.rejectionReason) {
    message += `\nسبب الرفض: ${data.rejectionReason}`;
  }
  
  if (data.reviewerName) {
    message += `\nبواسطة: ${data.reviewerName}`;
  }
  
  return await createEmployeeNotification({
    employeeId: data.employeeId,
    type: 'request_status',
    title: `${statusText} - ${data.requestType}`,
    message,
    relatedType: 'employee_request',
    relatedId: data.requestId,
  });
}

// ==================== دوال الوثائق المنتهية ====================

// الحصول على الموظفين ذوي الوثائق المنتهية أو قريبة الانتهاء
export async function getEmployeesWithExpiringDocuments() {
  const db = await getDb();
  if (!db) return { expiring: { iqama: [], healthCert: [], contract: [] }, expired: { iqama: [], healthCert: [], contract: [] }, summary: { totalExpiring: 0, totalExpired: 0, expiringIqamaCount: 0, expiringHealthCertCount: 0, expiringContractCount: 0, expiredIqamaCount: 0, expiredHealthCertCount: 0, expiredContractCount: 0 } };
  
  const now = new Date();
  const oneMonthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const twoMonthsFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  const { employees, branches } = await import('../drizzle/schema');
  
  const allEmployees = await db
    .select({
      id: employees.id,
      code: employees.code,
      name: employees.name,
      branchId: employees.branchId,
      phone: employees.phone,
      position: employees.position,
      iqamaNumber: employees.iqamaNumber,
      iqamaExpiryDate: employees.iqamaExpiryDate,
      iqamaImageUrl: employees.iqamaImageUrl,
      healthCertExpiryDate: employees.healthCertExpiryDate,
      healthCertImageUrl: employees.healthCertImageUrl,
      contractExpiryDate: employees.contractExpiryDate,
      contractImageUrl: employees.contractImageUrl,
      isActive: employees.isActive,
    })
    .from(employees)
    .where(eq(employees.isActive, true));
  
  const expiringIqama: typeof allEmployees = [];
  const expiringHealthCert: typeof allEmployees = [];
  const expiringContract: typeof allEmployees = [];
  const expiredIqama: typeof allEmployees = [];
  const expiredHealthCert: typeof allEmployees = [];
  const expiredContract: typeof allEmployees = [];
  
  for (const emp of allEmployees) {
    if (emp.iqamaExpiryDate) {
      if (emp.iqamaExpiryDate < now) {
        expiredIqama.push(emp);
      } else if (emp.iqamaExpiryDate <= oneMonthFromNow) {
        expiringIqama.push(emp);
      }
    }
    
    if (emp.healthCertExpiryDate) {
      if (emp.healthCertExpiryDate < now) {
        expiredHealthCert.push(emp);
      } else if (emp.healthCertExpiryDate <= oneWeekFromNow) {
        expiringHealthCert.push(emp);
      }
    }
    
    if (emp.contractExpiryDate) {
      if (emp.contractExpiryDate < now) {
        expiredContract.push(emp);
      } else if (emp.contractExpiryDate <= twoMonthsFromNow) {
        expiringContract.push(emp);
      }
    }
  }
  
  const branchesData = await db.select().from(branches);
  const branchMap = new Map(branchesData.map(b => [b.id, b.name]));
  
  const addBranchName = (emps: typeof allEmployees) => 
    emps.map(emp => ({
      ...emp,
      branchName: branchMap.get(emp.branchId) || 'غير محدد',
    }));
  
  return {
    expiring: {
      iqama: addBranchName(expiringIqama),
      healthCert: addBranchName(expiringHealthCert),
      contract: addBranchName(expiringContract),
    },
    expired: {
      iqama: addBranchName(expiredIqama),
      healthCert: addBranchName(expiredHealthCert),
      contract: addBranchName(expiredContract),
    },
    summary: {
      totalExpiring: expiringIqama.length + expiringHealthCert.length + expiringContract.length,
      totalExpired: expiredIqama.length + expiredHealthCert.length + expiredContract.length,
      expiringIqamaCount: expiringIqama.length,
      expiringHealthCertCount: expiringHealthCert.length,
      expiringContractCount: expiringContract.length,
      expiredIqamaCount: expiredIqama.length,
      expiredHealthCertCount: expiredHealthCert.length,
      expiredContractCount: expiredContract.length,
    },
  };
}

// تحديث صورة وثيقة الموظف
export async function updateEmployeeDocumentImage(
  employeeId: number,
  documentType: 'iqama' | 'healthCert' | 'contract',
  imageUrl: string | null
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: 'فشل الاتصال بقاعدة البيانات' };
  
  try {
    const { employees } = await import('../drizzle/schema');
    const updateData: Record<string, string | null> = {};
    
    switch (documentType) {
      case 'iqama':
        updateData.iqamaImageUrl = imageUrl;
        break;
      case 'healthCert':
        updateData.healthCertImageUrl = imageUrl;
        break;
      case 'contract':
        updateData.contractImageUrl = imageUrl;
        break;
    }
    
    await db
      .update(employees)
      .set(updateData)
      .where(eq(employees.id, employeeId));
    
    return { success: true };
  } catch (error) {
    console.error('خطأ في تحديث صورة الوثيقة:', error);
    return { success: false, error: 'فشل في تحديث صورة الوثيقة' };
  }
}

// الحصول على جميع الموظفين مع بيانات الوثائق للتقرير
export async function getAllEmployeesWithDocuments() {
  const db = await getDb();
  if (!db) return [];
  
  const { employees, branches } = await import('../drizzle/schema');
  
  const employeesData = await db
    .select({
      id: employees.id,
      code: employees.code,
      name: employees.name,
      branchId: employees.branchId,
      phone: employees.phone,
      position: employees.position,
      iqamaNumber: employees.iqamaNumber,
      iqamaExpiryDate: employees.iqamaExpiryDate,
      iqamaImageUrl: employees.iqamaImageUrl,
      healthCertExpiryDate: employees.healthCertExpiryDate,
      healthCertImageUrl: employees.healthCertImageUrl,
      contractExpiryDate: employees.contractExpiryDate,
      contractImageUrl: employees.contractImageUrl,
      isActive: employees.isActive,
    })
    .from(employees)
    .where(eq(employees.isActive, true))
    .orderBy(employees.name);
  
  const branchesData = await db.select().from(branches);
  const branchMap = new Map(branchesData.map(b => [b.id, b.name]));
  
  return employeesData.map(emp => ({
    ...emp,
    branchName: branchMap.get(emp.branchId) || 'غير محدد',
  }));
}


// ==================== دوال معلومات الموظف في بوابة الموظفين ====================

// التحقق مما إذا كان الموظف قد سجل معلوماته
export async function hasEmployeeSubmittedInfo(employeeId: number) {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db.select({ infoSubmittedAt: employees.infoSubmittedAt })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);
  
  return result.length > 0 && result[0].infoSubmittedAt !== null;
}

// تسجيل أو تحديث معلومات الموظف (مسموح للموظف بتعديل بياناته)
export async function submitEmployeeInfo(
  employeeId: number,
  data: {
    iqamaNumber?: string;
    iqamaExpiryDate?: Date;
    healthCertExpiryDate?: Date;
    contractExpiryDate?: Date;
  }
) {
  const db = await getDb();
  if (!db) return { success: false, error: 'خطأ في الاتصال بقاعدة البيانات' };
  
  // التحقق من أن الموظف سجل معلوماته من قبل
  const hasSubmitted = await hasEmployeeSubmittedInfo(employeeId);
  
  await db.update(employees)
    .set({
      iqamaNumber: data.iqamaNumber,
      iqamaExpiryDate: data.iqamaExpiryDate,
      healthCertExpiryDate: data.healthCertExpiryDate,
      contractExpiryDate: data.contractExpiryDate,
      // إذا كانت أول مرة، سجل تاريخ التسجيل
      ...(!hasSubmitted ? { infoSubmittedAt: new Date() } : {}),
      infoSubmittedBy: null, // null يعني الموظف نفسه
      updatedAt: new Date(),
    })
    .where(eq(employees.id, employeeId));
  
  return { success: true, isUpdate: hasSubmitted };
}

// تحديث معلومات الموظف من الأدمن فقط
export async function updateEmployeeInfoByAdmin(
  employeeId: number,
  adminId: number,
  data: {
    iqamaNumber?: string;
    iqamaExpiryDate?: Date | null;
    healthCertExpiryDate?: Date | null;
    contractExpiryDate?: Date | null;
  }
) {
  const db = await getDb();
  if (!db) return { success: false, error: 'خطأ في الاتصال بقاعدة البيانات' };
  
  await db.update(employees)
    .set({
      iqamaNumber: data.iqamaNumber,
      iqamaExpiryDate: data.iqamaExpiryDate,
      healthCertExpiryDate: data.healthCertExpiryDate,
      contractExpiryDate: data.contractExpiryDate,
      infoSubmittedBy: adminId, // تسجيل من قام بالتعديل
      updatedAt: new Date(),
    })
    .where(eq(employees.id, employeeId));
  
  return { success: true };
}

// جلب معلومات الموظف للعرض في بوابة الموظفين
export async function getEmployeeDocumentInfo(employeeId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select({
    id: employees.id,
    code: employees.code,
    name: employees.name,
    phone: employees.phone,
    position: employees.position,
    branchId: employees.branchId,
    iqamaNumber: employees.iqamaNumber,
    iqamaExpiryDate: employees.iqamaExpiryDate,
    iqamaImageUrl: employees.iqamaImageUrl,
    healthCertExpiryDate: employees.healthCertExpiryDate,
    healthCertImageUrl: employees.healthCertImageUrl,
    contractExpiryDate: employees.contractExpiryDate,
    contractImageUrl: employees.contractImageUrl,
    infoSubmittedAt: employees.infoSubmittedAt,
    infoSubmittedBy: employees.infoSubmittedBy,
  })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);
  
  if (result.length === 0) return null;
  
  // جلب اسم الفرع
  const branch = await db.select({ name: branches.name })
    .from(branches)
    .where(eq(branches.id, result[0].branchId))
    .limit(1);
  
  return {
    ...result[0],
    branchName: branch.length > 0 ? branch[0].name : 'غير محدد',
  };
}


// جلب الموظفين الذين لم يرفعوا وثائقهم بعد
export async function getEmployeesWithoutDocuments() {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select({
    id: employees.id,
    code: employees.code,
    name: employees.name,
    phone: employees.phone,
    position: employees.position,
    branchId: employees.branchId,
    infoSubmittedAt: employees.infoSubmittedAt,
    iqamaNumber: employees.iqamaNumber,
    iqamaExpiryDate: employees.iqamaExpiryDate,
    iqamaImageUrl: employees.iqamaImageUrl,
    healthCertExpiryDate: employees.healthCertExpiryDate,
    healthCertImageUrl: employees.healthCertImageUrl,
    contractExpiryDate: employees.contractExpiryDate,
    contractImageUrl: employees.contractImageUrl,
  })
    .from(employees)
    .where(
      and(
        eq(employees.isActive, true),
        or(
          isNull(employees.infoSubmittedAt),
          and(
            isNull(employees.iqamaImageUrl),
            isNull(employees.healthCertImageUrl),
            isNull(employees.contractImageUrl)
          )
        )
      )
    )
    .orderBy(employees.name);
  
  // جلب أسماء الفروع
  const branchIds = Array.from(new Set(result.map(e => e.branchId)));
  const branchesData = await db.select({ id: branches.id, name: branches.name })
    .from(branches)
    .where(inArray(branches.id, branchIds));
  
  const branchMap = new Map(branchesData.map(b => [b.id, b.name]));
  
  return result.map(emp => ({
    ...emp,
    branchName: branchMap.get(emp.branchId) || 'غير محدد',
    missingDocuments: {
      info: !emp.infoSubmittedAt,
      iqamaImage: !emp.iqamaImageUrl,
      healthCertImage: !emp.healthCertImageUrl,
      contractImage: !emp.contractImageUrl,
    },
  }));
}

// جلب إحصائيات الوثائق
export async function getDocumentStatistics() {
  const db = await getDb();
  if (!db) return null;
  
  const allEmployees = await db.select({ id: employees.id })
    .from(employees)
    .where(eq(employees.isActive, true));
  
  const withInfo = await db.select({ id: employees.id })
    .from(employees)
    .where(
      and(
        eq(employees.isActive, true),
        isNotNull(employees.infoSubmittedAt)
      )
    );
  
  const withAllImages = await db.select({ id: employees.id })
    .from(employees)
    .where(
      and(
        eq(employees.isActive, true),
        isNotNull(employees.iqamaImageUrl),
        isNotNull(employees.healthCertImageUrl),
        isNotNull(employees.contractImageUrl)
      )
    );
  
  const withIqamaImage = await db.select({ id: employees.id })
    .from(employees)
    .where(
      and(
        eq(employees.isActive, true),
        isNotNull(employees.iqamaImageUrl)
      )
    );
  
  const withHealthCertImage = await db.select({ id: employees.id })
    .from(employees)
    .where(
      and(
        eq(employees.isActive, true),
        isNotNull(employees.healthCertImageUrl)
      )
    );
  
  const withContractImage = await db.select({ id: employees.id })
    .from(employees)
    .where(
      and(
        eq(employees.isActive, true),
        isNotNull(employees.contractImageUrl)
      )
    );
  
  return {
    totalEmployees: allEmployees.length,
    withInfo: withInfo.length,
    withoutInfo: allEmployees.length - withInfo.length,
    withAllImages: withAllImages.length,
    withIqamaImage: withIqamaImage.length,
    withHealthCertImage: withHealthCertImage.length,
    withContractImage: withContractImage.length,
    completionRate: allEmployees.length > 0 
      ? Math.round((withAllImages.length / allEmployees.length) * 100) 
      : 0,
  };
}


// ==================== دوال لوحة تحكم الأدمن في بوابة الموظفين ====================

// التحقق من صلاحيات الأدمن في بوابة الموظفين
// يبحث في جدول users أولاً، ثم في جدول employees للمشرفين
export async function checkPortalAdminAccess(userId: number): Promise<{
  isAdmin: boolean;
  adminName?: string;
  adminRole?: string;
  branchId?: number;
}> {
  const db = await getDb();
  if (!db) {
    return { isAdmin: false };
  }

  try {
    // البحث في جدول المستخدمين أولاً
    const user = await db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        username: users.username,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length > 0 && (user[0].role === 'admin' || user[0].role === 'manager' || user[0].role === 'supervisor')) {
      return {
        isAdmin: true,
        adminName: user[0].name || user[0].username || 'Admin',
        adminRole: user[0].role,
      };
    }

    // إذا لم يوجد في users، نبحث في employees (للمشرفين الذين يسجلون من بوابة الموظفين)
    const employee = await db
      .select({
        id: employees.id,
        name: employees.name,
        username: employees.username,
        isSupervisor: employees.isSupervisor,
        branchId: employees.branchId,
      })
      .from(employees)
      .where(eq(employees.id, userId))
      .limit(1);

    if (employee.length > 0 && employee[0].isSupervisor) {
      return {
        isAdmin: true,
        adminName: employee[0].name || employee[0].username || 'Supervisor',
        adminRole: 'supervisor',
        branchId: employee[0].branchId,
      };
    }

    return { isAdmin: false };
  } catch (error) {
    console.error('Error checking portal admin access:', error);
    return { isAdmin: false };
  }
}

// جلب قائمة الموظفين للأدمن في بوابة الموظفين
export async function getEmployeesForPortalAdmin(
  branchId?: number,
  search?: string
): Promise<Array<{
  id: number;
  name: string;
  code: string;
  branchId: number;
  branchName: string;
  position: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  iqamaNumber: string | null;
  iqamaExpiryDate: Date | null;
  healthCertExpiryDate: Date | null;
  contractExpiryDate: Date | null;
  hasPortalAccess: boolean;
  lastLogin: Date | null;
  photoUrl: string | null;
  iqamaImageUrl: string | null;
  healthCertImageUrl: string | null;
  contractImageUrl: string | null;
  isSupervisor: boolean;
}>> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  try {
    let query = db
      .select({
        id: employees.id,
        name: employees.name,
        code: employees.code,
        branchId: employees.branchId,
        position: employees.position,
        phone: employees.phone,
        email: employees.email,
        isActive: employees.isActive,
        iqamaNumber: employees.iqamaNumber,
        iqamaExpiryDate: employees.iqamaExpiryDate,
        healthCertExpiryDate: employees.healthCertExpiryDate,
        contractExpiryDate: employees.contractExpiryDate,
        hasPortalAccess: employees.hasPortalAccess,
        lastLogin: employees.lastLogin,
        photoUrl: employees.photoUrl,
        iqamaImageUrl: employees.iqamaImageUrl,
        healthCertImageUrl: employees.healthCertImageUrl,
        contractImageUrl: employees.contractImageUrl,
        isSupervisor: employees.isSupervisor,
      })
      .from(employees)
      .where(eq(employees.isActive, true));

    const emps = await query;

    // جلب أسماء الفروع
    const branchList = await db.select().from(branches);
    const branchMap = new Map(branchList.map((b: { id: number; name: string }) => [b.id, b.name]));

    let result = emps.map((emp: typeof emps[0]) => ({
      ...emp,
      branchName: branchMap.get(emp.branchId) || 'غير محدد',
    }));

    // فلترة حسب الفرع
    if (branchId) {
      result = result.filter(emp => emp.branchId === branchId);
    }

    // فلترة حسب البحث
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(emp => 
        emp.name.toLowerCase().includes(searchLower) ||
        emp.code.toLowerCase().includes(searchLower)
      );
    }

    return result;
  } catch (error) {
    console.error('Error getting employees for portal admin:', error);
    return [];
  }
}

// جلب قائمة الفروع للأدمن في بوابة الموظفين
export async function getBranchesForPortalAdmin(): Promise<Array<{
  id: number;
  name: string;
  employeeCount: number;
}>> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  try {
    const branchList = await db.select().from(branches);
    
    // حساب عدد الموظفين لكل فرع
    const employeeCounts = await db
      .select({
        branchId: employees.branchId,
      })
      .from(employees)
      .where(eq(employees.isActive, true));

    const countMap = new Map<number, number>();
    employeeCounts.forEach((emp: { branchId: number }) => {
      countMap.set(emp.branchId, (countMap.get(emp.branchId) || 0) + 1);
    });

    return branchList.map((branch: { id: number; name: string }) => ({
      id: branch.id,
      name: branch.name,
      employeeCount: countMap.get(branch.id) || 0,
    }));
  } catch (error) {
    console.error('Error getting branches for portal admin:', error);
    return [];
  }
}

// جلب إحصائيات لوحة تحكم الأدمن في بوابة الموظفين
export async function getPortalAdminDashboardStats(): Promise<{
  totalEmployees: number;
  activeEmployees: number;
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  expiringDocuments: number;
  branchCount: number;
}> {
  const db = await getDb();
  if (!db) {
    return {
      totalEmployees: 0,
      activeEmployees: 0,
      pendingRequests: 0,
      approvedRequests: 0,
      rejectedRequests: 0,
      expiringDocuments: 0,
      branchCount: 0,
    };
  }

  try {
    // عدد الموظفين
    const allEmployees = await db.select({ id: employees.id }).from(employees);
    const activeEmps = await db
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.isActive, true));

    // عدد الطلبات
    const allRequests = await db.select({ id: employeeRequests.id, status: employeeRequests.status }).from(employeeRequests);
    const pendingReqs = allRequests.filter((r: { status: string }) => r.status === 'pending').length;
    const approvedReqs = allRequests.filter((r: { status: string }) => r.status === 'approved').length;
    const rejectedReqs = allRequests.filter((r: { status: string }) => r.status === 'rejected').length;

    // عدد الفروع
    const branchList = await db.select({ id: branches.id }).from(branches);

    // الوثائق المنتهية (خلال 30 يوم)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    const expiringDocs = await db
      .select({ id: employees.id })
      .from(employees)
      .where(
        and(
          eq(employees.isActive, true),
          or(
            and(
              isNotNull(employees.iqamaExpiryDate),
              lte(employees.iqamaExpiryDate, thirtyDaysFromNow)
            ),
            and(
              isNotNull(employees.healthCertExpiryDate),
              lte(employees.healthCertExpiryDate, thirtyDaysFromNow)
            ),
            and(
              isNotNull(employees.contractExpiryDate),
              lte(employees.contractExpiryDate, thirtyDaysFromNow)
            )
          )
        )
      );

    return {
      totalEmployees: allEmployees.length,
      activeEmployees: activeEmps.length,
      pendingRequests: pendingReqs,
      approvedRequests: approvedReqs,
      rejectedRequests: rejectedReqs,
      expiringDocuments: expiringDocs.length,
      branchCount: branchList.length,
    };
  } catch (error) {
    console.error('Error getting portal admin dashboard stats:', error);
    return {
      totalEmployees: 0,
      activeEmployees: 0,
      pendingRequests: 0,
      approvedRequests: 0,
      rejectedRequests: 0,
      expiringDocuments: 0,
      branchCount: 0,
    };
  }
}

// جلب تفاصيل موظف للأدمن في بوابة الموظفين
export async function getEmployeeDetailsForPortalAdmin(employeeId: number): Promise<{
  employee: any;
  requests: any[];
  documents: any;
} | null> {
  const db = await getDb();
  if (!db) {
    return null;
  }

  try {
    // جلب بيانات الموظف
    const emp = await db
      .select()
      .from(employees)
      .where(eq(employees.id, employeeId))
      .limit(1);

    if (emp.length === 0) {
      return null;
    }

    const employee = emp[0];

    // جلب اسم الفرع
    const branch = await db
      .select()
      .from(branches)
      .where(eq(branches.id, employee.branchId))
      .limit(1);

    // جلب طلبات الموظف
    const requests = await db
      .select()
      .from(employeeRequests)
      .where(eq(employeeRequests.employeeId, employeeId))
      .orderBy(desc(employeeRequests.createdAt))
      .limit(10);

    return {
      employee: {
        ...employee,
        branchName: branch.length > 0 ? branch[0].name : 'غير محدد',
      },
      requests,
      documents: {
        iqamaNumber: employee.iqamaNumber,
        iqamaExpiryDate: employee.iqamaExpiryDate,
        iqamaImageUrl: employee.iqamaImageUrl,
        healthCertExpiryDate: employee.healthCertExpiryDate,
        healthCertImageUrl: employee.healthCertImageUrl,
        contractExpiryDate: employee.contractExpiryDate,
        contractImageUrl: employee.contractImageUrl,
      },
    };
  } catch (error) {
    console.error('Error getting employee details for portal admin:', error);
    return null;
  }
}


// ==================== تقرير السندات الشهري ====================

export interface VoucherReportFilters {
  startDate: Date;
  endDate: Date;
  voucherType?: 'receipt' | 'payment' | 'all';
  status?: 'draft' | 'approved' | 'paid' | 'cancelled' | 'all';
  branchId?: string;
}

export interface VoucherReportData {
  vouchers: Array<{
    id: number;
    voucherId: string;
    voucherDate: Date;
    dueDate: Date | null;
    dueDateTo: Date | null;
    payeeName: string;
    payeePhone: string | null;
    totalAmount: string;
    status: string;
    branchName: string | null;
    notes: string | null;
    createdByName: string;
    createdAt: Date;
  }>;
  statistics: {
    totalCount: number;
    draftCount: number;
    approvedCount: number;
    paidCount: number;
    cancelledCount: number;
    totalAmount: number;
    draftAmount: number;
    approvedAmount: number;
    paidAmount: number;
  };
  filters: {
    startDate: string;
    endDate: string;
    voucherType: string;
    status: string;
    branchName: string;
  };
}

export async function getVouchersForReport(filters: VoucherReportFilters): Promise<VoucherReportData | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const conditions: SQL[] = [
      gte(receiptVouchers.voucherDate, new Date(filters.startDate)),
      lte(receiptVouchers.voucherDate, new Date(filters.endDate)),
    ];

    if (filters.status && filters.status !== 'all') {
      conditions.push(eq(receiptVouchers.status, filters.status));
    }

    if (filters.branchId) {
      conditions.push(eq(receiptVouchers.branchId, parseInt(filters.branchId)));
    }

    // جلب السندات
    const vouchersResult = await db.select({
      id: receiptVouchers.id,
      voucherId: receiptVouchers.voucherId,
      voucherDate: receiptVouchers.voucherDate,
      dueDate: receiptVouchers.dueDate,
      payeeName: receiptVouchers.payeeName,
      payeePhone: receiptVouchers.payeePhone,
      totalAmount: receiptVouchers.totalAmount,
      status: receiptVouchers.status,
      branchId: receiptVouchers.branchId,
      notes: receiptVouchers.notes,
      createdBy: receiptVouchers.createdBy,
      createdAt: receiptVouchers.createdAt,
    })
      .from(receiptVouchers)
      .where(and(...conditions))
      .orderBy(desc(receiptVouchers.voucherDate));

    // جلب أسماء الفروع والمستخدمين
    const branchIds = Array.from(new Set(vouchersResult.filter(v => v.branchId).map(v => Number(v.branchId!))));
    const userIds = Array.from(new Set(vouchersResult.filter(v => v.createdBy).map(v => v.createdBy!)));

    let branchMap: Record<number, string> = {};
    let userMap: Record<string, string> = {};

    if (branchIds.length > 0) {
      const branchesResult = await db.select({
        id: branches.id,
        name: branches.name,
      }).from(branches).where(inArray(branches.id, branchIds as number[]));
      branchMap = Object.fromEntries(branchesResult.map(b => [b.id, b.name]));
    }

    if (userIds.length > 0) {
      const usersResult = await db.select({
        id: users.id,
        name: users.name,
      }).from(users).where(inArray(users.id, userIds));
      userMap = Object.fromEntries(usersResult.map(u => [u.id, u.name || '']));
    }

    // حساب الإحصائيات
    let totalAmount = 0;
    let draftAmount = 0;
    let approvedAmount = 0;
    let paidAmount = 0;
    let draftCount = 0;
    let approvedCount = 0;
    let paidCount = 0;
    let cancelledCount = 0;

    const vouchers = vouchersResult.map(v => {
      const amount = parseFloat(v.totalAmount || '0');
      totalAmount += amount;

      switch (v.status) {
        case 'draft':
          draftCount++;
          draftAmount += amount;
          break;
        case 'approved':
          approvedCount++;
          approvedAmount += amount;
          break;
        case 'paid':
          paidCount++;
          paidAmount += amount;
          break;
        case 'cancelled':
          cancelledCount++;
          break;
      }

      return {
        id: v.id,
        voucherId: v.voucherId,
        voucherDate: v.voucherDate,
        dueDate: v.dueDate,
        dueDateTo: null,
        payeeName: v.payeeName,
        payeePhone: v.payeePhone,
        totalAmount: v.totalAmount,
        status: v.status,
        branchName: v.branchId ? branchMap[v.branchId] || null : null,
        notes: v.notes,
        createdByName: v.createdBy ? userMap[v.createdBy] || 'غير معروف' : 'غير معروف',
        createdAt: v.createdAt,
      };
    });

    // جلب اسم الفرع للفلتر
    let filterBranchName = 'جميع الفروع';
    if (filters.branchId) {
      const branchResult = await db.select({ name: branches.name })
        .from(branches)
        .where(eq(branches.id, parseInt(filters.branchId)))
        .limit(1);
      if (branchResult.length > 0) {
        filterBranchName = branchResult[0].name;
      }
    }

    return {
      vouchers,
      statistics: {
        totalCount: vouchers.length,
        draftCount,
        approvedCount,
        paidCount,
        cancelledCount,
        totalAmount,
        draftAmount,
        approvedAmount,
        paidAmount,
      },
      filters: {
        startDate: filters.startDate.toISOString(),
        endDate: filters.endDate.toISOString(),
        voucherType: filters.voucherType || 'all',
        status: filters.status || 'all',
        branchName: filterBranchName,
      },
    };
  } catch (error) {
    console.error('Error getting vouchers for report:', error);
    return null;
  }
}


// ==================== دوال التدفق النقدي ====================

/**
 * الحصول على المصاريف مجمعة حسب طريقة الدفع
 * @param branchId معرف الفرع (اختياري)
 * @param startDate تاريخ البداية
 * @param endDate تاريخ النهاية
 */
export async function getExpensesByPaymentMethod(
  startDate: string,
  endDate: string,
  branchId?: number
) {
  const db = await getDb();
  if (!db) return null;

  try {
    const conditions = [
      gte(expenses.expenseDate, new Date(startDate)),
      lte(expenses.expenseDate, new Date(endDate)),
      inArray(expenses.status, ['approved', 'paid']),
    ];

    if (branchId) {
      conditions.push(eq(expenses.branchId, branchId));
    }

    const allExpenses = await db.select().from(expenses)
      .where(and(...conditions))
      .orderBy(desc(expenses.expenseDate));

    // تجميع المصاريف حسب طريقة الدفع
    const byPaymentMethod: Record<string, { count: number; total: number; expenses: typeof allExpenses }> = {
      cash: { count: 0, total: 0, expenses: [] },
      bank_transfer: { count: 0, total: 0, expenses: [] },
      check: { count: 0, total: 0, expenses: [] },
      credit_card: { count: 0, total: 0, expenses: [] },
      other: { count: 0, total: 0, expenses: [] },
    };

    let grandTotal = 0;

    for (const expense of allExpenses) {
      const method = expense.paymentMethod || 'other';
      const amount = parseFloat(expense.amount);
      
      if (byPaymentMethod[method]) {
        byPaymentMethod[method].count++;
        byPaymentMethod[method].total += amount;
        byPaymentMethod[method].expenses.push(expense);
      } else {
        byPaymentMethod.other.count++;
        byPaymentMethod.other.total += amount;
        byPaymentMethod.other.expenses.push(expense);
      }
      
      grandTotal += amount;
    }

    return {
      byPaymentMethod,
      grandTotal,
      totalCount: allExpenses.length,
    };
  } catch (error) {
    console.error('Error getting expenses by payment method:', error);
    return null;
  }
}

/**
 * الحصول على سندات القبض مجمعة حسب طريقة الدفع
 * @param branchId معرف الفرع (اختياري)
 * @param startDate تاريخ البداية
 * @param endDate تاريخ النهاية
 */
export async function getVouchersByPaymentMethod(
  startDate: string,
  endDate: string,
  branchId?: number
) {
  const db = await getDb();
  if (!db) return null;

  try {
    const conditions = [
      gte(receiptVouchers.voucherDate, new Date(startDate)),
      lte(receiptVouchers.voucherDate, new Date(endDate)),
      inArray(receiptVouchers.status, ['draft', 'approved', 'paid']),
    ];

    if (branchId) {
      conditions.push(eq(receiptVouchers.branchId, branchId));
    }

    const allVouchers = await db.select().from(receiptVouchers)
      .where(and(...conditions))
      .orderBy(desc(receiptVouchers.voucherDate));

    // تجميع السندات حسب طريقة الدفع
    const byPaymentMethod: Record<string, { count: number; total: number; vouchers: typeof allVouchers }> = {
      cash: { count: 0, total: 0, vouchers: [] },
      bank_transfer: { count: 0, total: 0, vouchers: [] },
      check: { count: 0, total: 0, vouchers: [] },
      credit_card: { count: 0, total: 0, vouchers: [] },
      other: { count: 0, total: 0, vouchers: [] },
    };

    let grandTotal = 0;

    for (const voucher of allVouchers) {
      const method = voucher.paymentMethod || 'cash';
      const amount = parseFloat(voucher.totalAmount);
      
      if (byPaymentMethod[method]) {
        byPaymentMethod[method].count++;
        byPaymentMethod[method].total += amount;
        byPaymentMethod[method].vouchers.push(voucher);
      } else {
        byPaymentMethod.other.count++;
        byPaymentMethod.other.total += amount;
        byPaymentMethod.other.vouchers.push(voucher);
      }
      
      grandTotal += amount;
    }

    return {
      byPaymentMethod,
      grandTotal,
      totalCount: allVouchers.length,
    };
  } catch (error) {
    console.error('Error getting vouchers by payment method:', error);
    return null;
  }
}

/**
 * الحصول على إيرادات الفرع النقدية
 * @param branchId معرف الفرع
 * @param startDate تاريخ البداية
 * @param endDate تاريخ النهاية
 */
export async function getBranchCashRevenues(
  branchId: number,
  startDate: string,
  endDate: string
) {
  const db = await getDb();
  if (!db) return null;

  try {
    const revenues = await db.select().from(dailyRevenues)
      .where(and(
        eq(dailyRevenues.branchId, branchId),
        gte(dailyRevenues.date, new Date(startDate)),
        lte(dailyRevenues.date, new Date(endDate))
      ))
      .orderBy(desc(dailyRevenues.date));

    let totalCash = 0;
    let totalNetwork = 0;
    let totalBalance = 0;
    let totalRevenue = 0;

    for (const rev of revenues) {
      totalCash += parseFloat(rev.cash);
      totalNetwork += parseFloat(rev.network);
      totalBalance += parseFloat(rev.balance);
      totalRevenue += parseFloat(rev.total);
    }

    return {
      revenues,
      totals: {
        cash: totalCash,
        network: totalNetwork,
        balance: totalBalance,
        total: totalRevenue,
      },
    };
  } catch (error) {
    console.error('Error getting branch cash revenues:', error);
    return null;
  }
}

/**
 * حساب التدفق النقدي للفرع
 * يحسب: إيرادات الكاش - المصاريف النقدية - سندات القبض النقدية = الكاش المتبقي
 * @param branchId معرف الفرع
 * @param startDate تاريخ البداية
 * @param endDate تاريخ النهاية
 */
export async function calculateBranchCashFlow(
  branchId: number,
  startDate: string,
  endDate: string
) {
  const db = await getDb();
  if (!db) return null;

  try {
    // 1. الحصول على إيرادات الكاش
    const revenuesResult = await getBranchCashRevenues(branchId, startDate, endDate);
    const totalCashRevenue = revenuesResult?.totals.cash || 0;

    // 2. الحصول على المصاريف النقدية
    const expensesResult = await getExpensesByPaymentMethod(startDate, endDate, branchId);
    const cashExpenses = expensesResult?.byPaymentMethod.cash.total || 0;

    // 3. الحصول على سندات القبض النقدية
    const vouchersResult = await getVouchersByPaymentMethod(startDate, endDate, branchId);
    const cashVouchers = vouchersResult?.byPaymentMethod.cash.total || 0;

    // 4. الحصول على السلف المعتمدة في نفس الفترة (مصاريف نقدية)
    const advancesResult = await getApprovedAdvancesForCashFlow(startDate, endDate, branchId);
    const cashAdvances = advancesResult?.total || 0;

    // 5. حساب الكاش المتبقي (بعد خصم السلف)
    const remainingCash = totalCashRevenue - cashExpenses - cashVouchers - cashAdvances;

    return {
      // الإيرادات
      revenues: {
        cash: totalCashRevenue,
        network: revenuesResult?.totals.network || 0,
        total: revenuesResult?.totals.total || 0,
        details: revenuesResult?.revenues || [],
      },
      // المصاريف
      expenses: {
        cash: cashExpenses,
        bankTransfer: expensesResult?.byPaymentMethod.bank_transfer.total || 0,
        check: expensesResult?.byPaymentMethod.check.total || 0,
        creditCard: expensesResult?.byPaymentMethod.credit_card.total || 0,
        other: expensesResult?.byPaymentMethod.other.total || 0,
        total: expensesResult?.grandTotal || 0,
        byPaymentMethod: expensesResult?.byPaymentMethod || {},
      },
      // سندات القبض
      vouchers: {
        cash: cashVouchers,
        bankTransfer: vouchersResult?.byPaymentMethod.bank_transfer.total || 0,
        check: vouchersResult?.byPaymentMethod.check.total || 0,
        creditCard: vouchersResult?.byPaymentMethod.credit_card.total || 0,
        other: vouchersResult?.byPaymentMethod.other.total || 0,
        total: vouchersResult?.grandTotal || 0,
        byPaymentMethod: vouchersResult?.byPaymentMethod || {},
      },
      // السلف المعتمدة (مصاريف نقدية)
      advances: {
        cash: cashAdvances,
        count: advancesResult?.count || 0,
        details: advancesResult?.advances || [],
      },
      // الملخص
      summary: {
        totalCashRevenue,
        totalCashExpenses: cashExpenses,
        totalCashVouchers: cashVouchers,
        totalCashAdvances: cashAdvances,
        remainingCash,
        // نسبة الكاش المتبقي من الإيرادات
        cashRetentionRate: totalCashRevenue > 0 
          ? ((remainingCash / totalCashRevenue) * 100).toFixed(2) 
          : '0.00',
      },
    };
  } catch (error) {
    console.error('Error calculating branch cash flow:', error);
    return null;
  }
}

/**
 * تقرير التدفق النقدي الشهري لجميع الفروع
 * @param year السنة
 * @param month الشهر
 */
export async function getMonthlyCashFlowReport(year: number, month: number) {
  const db = await getDb();
  if (!db) return null;

  try {
    // حساب تاريخ البداية والنهاية للشهر
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // الحصول على جميع الفروع
    const allBranches = await db.select().from(branches);

    const branchReports: Array<{
      branchId: number;
      branchName: string;
      cashFlow: Awaited<ReturnType<typeof calculateBranchCashFlow>>;
    }> = [];

    // حساب التدفق النقدي لكل فرع
    for (const branch of allBranches) {
      const cashFlow = await calculateBranchCashFlow(branch.id, startDateStr, endDateStr);
      branchReports.push({
        branchId: branch.id,
        branchName: branch.name,
        cashFlow,
      });
    }

    // حساب الإجماليات
    let totalCashRevenue = 0;
    let totalCashExpenses = 0;
    let totalCashVouchers = 0;
    let totalCashAdvances = 0;
    let totalRemainingCash = 0;

    for (const report of branchReports) {
      if (report.cashFlow) {
        totalCashRevenue += report.cashFlow.summary.totalCashRevenue;
        totalCashExpenses += report.cashFlow.summary.totalCashExpenses;
        totalCashVouchers += report.cashFlow.summary.totalCashVouchers;
        totalCashAdvances += report.cashFlow.summary.totalCashAdvances || 0;
        totalRemainingCash += report.cashFlow.summary.remainingCash;
      }
    }

    return {
      period: {
        year,
        month,
        startDate: startDateStr,
        endDate: endDateStr,
      },
      branches: branchReports,
      totals: {
        cashRevenue: totalCashRevenue,
        cashExpenses: totalCashExpenses,
        cashVouchers: totalCashVouchers,
        cashAdvances: totalCashAdvances,
        remainingCash: totalRemainingCash,
        cashRetentionRate: totalCashRevenue > 0 
          ? ((totalRemainingCash / totalCashRevenue) * 100).toFixed(2) 
          : '0.00',
      },
    };
  } catch (error) {
    console.error('Error getting monthly cash flow report:', error);
    return null;
  }
}


/**
 * جلب السلف المعتمدة في فترة معينة لحساب التدفق النقدي
 * @param startDate تاريخ البداية
 * @param endDate تاريخ النهاية
 * @param branchId معرف الفرع (اختياري)
 */
export async function getApprovedAdvancesForCashFlow(
  startDate: string,
  endDate: string,
  branchId?: number
): Promise<{
  total: number;
  count: number;
  advances: Array<{
    id: number;
    employeeId: number;
    employeeName: string;
    amount: number;
    approvedAt: Date | null;
    title: string | null;
  }>;
}> {
  const db = await getDb();
  if (!db) return { total: 0, count: 0, advances: [] };

  try {
    const conditions = [
      eq(employeeRequests.requestType, 'advance'),
      eq(employeeRequests.status, 'approved'),
      gte(employeeRequests.reviewedAt!, new Date(startDate)),
      lte(employeeRequests.reviewedAt!, new Date(endDate + 'T23:59:59')),
    ];

    if (branchId) {
      conditions.push(eq(employeeRequests.branchId, branchId));
    }

    const results = await db.select({
      id: employeeRequests.id,
      employeeId: employeeRequests.employeeId,
      employeeName: employeeRequests.employeeName,
      amount: employeeRequests.advanceAmount,
      approvedAt: employeeRequests.reviewedAt,
      title: employeeRequests.title,
    })
      .from(employeeRequests)
      .where(and(...conditions))
      .orderBy(desc(employeeRequests.reviewedAt));

    const advances = results.map(r => ({
      ...r,
      amount: r.amount ? parseFloat(r.amount) : 0,
    }));

    const total = advances.reduce((sum, adv) => sum + adv.amount, 0);

    return {
      total,
      count: advances.length,
      advances,
    };
  } catch (error) {
    console.error('Error getting approved advances for cash flow:', error);
    return { total: 0, count: 0, advances: [] };
  }
}


// ==================== بوابة الكاشير (POS System) ====================

import {
  posCategories,
  posServices,
  posInvoices,
  posInvoiceItems,
  posDailySummary,
  posEmployeePerformance,
} from "../drizzle/schema";

// Types for POS
type InsertPosCategory = typeof posCategories.$inferInsert;
type InsertPosService = typeof posServices.$inferInsert;
type InsertPosInvoice = typeof posInvoices.$inferInsert;
type InsertPosInvoiceItem = typeof posInvoiceItems.$inferInsert;

// ==================== إدارة الأقسام ====================

export async function getPosCategories() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(posCategories)
    .where(eq(posCategories.isActive, true))
    .orderBy(asc(posCategories.sortOrder));
}

export async function createPosCategory(data: Omit<InsertPosCategory, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const result = await db.insert(posCategories).values(data);
  return { id: result[0].insertId, ...data };
}

export async function updatePosCategory(id: number, data: Partial<InsertPosCategory>) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  await db.update(posCategories).set(data).where(eq(posCategories.id, id));
  return { success: true };
}

export async function deletePosCategory(id: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  // Soft delete - تعطيل بدلاً من الحذف
  await db.update(posCategories).set({ isActive: false }).where(eq(posCategories.id, id));
  return { success: true };
}

// ==================== إدارة الخدمات ====================

export async function getPosServices() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select({
    id: posServices.id,
    categoryId: posServices.categoryId,
    name: posServices.name,
    nameAr: posServices.nameAr,
    description: posServices.description,
    price: posServices.price,
    duration: posServices.duration,
    sortOrder: posServices.sortOrder,
    isActive: posServices.isActive,
    categoryName: posCategories.nameAr,
  })
    .from(posServices)
    .leftJoin(posCategories, eq(posServices.categoryId, posCategories.id))
    .where(eq(posServices.isActive, true))
    .orderBy(asc(posServices.sortOrder));
}

export async function getPosServicesByCategory(categoryId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(posServices)
    .where(and(
      eq(posServices.categoryId, categoryId),
      eq(posServices.isActive, true)
    ))
    .orderBy(asc(posServices.sortOrder));
}

export async function createPosService(data: { categoryId: number; name: string; nameAr: string; price: number; description?: string; duration?: number; sortOrder?: number }) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const result = await db.insert(posServices).values({
    ...data,
    price: data.price.toString(),
  });
  return { id: result[0].insertId, ...data };
}

export async function updatePosService(id: number, data: { categoryId?: number; name?: string; nameAr?: string; price?: number; description?: string; duration?: number; sortOrder?: number; isActive?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const updateData: Record<string, unknown> = { ...data };
  if (data.price !== undefined) {
    updateData.price = data.price.toString();
  }
  
  await db.update(posServices).set(updateData).where(eq(posServices.id, id));
  return { success: true };
}

export async function deletePosService(id: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  // Soft delete
  await db.update(posServices).set({ isActive: false }).where(eq(posServices.id, id));
  return { success: true };
}

// ==================== إدارة الفواتير ====================

export async function createPosInvoice(data: {
  branchId: number;
  employeeId: number;
  loyaltyCustomerId?: number;
  items: { serviceId: number; quantity: number }[];
  paymentMethod: 'cash' | 'card' | 'split' | 'loyalty';
  cashAmount?: number;
  cardAmount?: number;
  discountAmount?: number;
  discountPercentage?: number;
  discountReason?: string;
  notes?: string;
  createdBy: number;
  createdByName: string;
}) {
  const startTime = Date.now();
  const db = await getDb();
  if (!db) {
    posLogger.error('فشل إنشاء فاتورة: قاعدة البيانات غير متاحة', new Error('Database not available'), {
      branchId: data.branchId,
      employeeId: data.employeeId,
      action: 'createPosInvoice'
    });
    throw new Error('قاعدة البيانات غير متاحة');
  }
  
  try {
    // جلب بيانات الفرع
    const branchData = await db.select().from(branches).where(eq(branches.id, data.branchId)).limit(1);
    const branch = branchData[0];
    if (!branch) {
      posLogger.warn('محاولة إنشاء فاتورة لفرع غير موجود', { branchId: data.branchId });
    }
    
    // جلب بيانات الموظف
    const employeeData = await db.select().from(employees).where(eq(employees.id, data.employeeId)).limit(1);
    const employee = employeeData[0];
    if (!employee) {
      posLogger.warn('محاولة إنشاء فاتورة لموظف غير موجود', { employeeId: data.employeeId });
    }
    
    // جلب بيانات عميل الولاء إذا وجد
    let loyaltyCustomer = null;
    if (data.loyaltyCustomerId) {
      const customerData = await db.select().from(loyaltyCustomers).where(eq(loyaltyCustomers.id, data.loyaltyCustomerId)).limit(1);
      loyaltyCustomer = customerData[0];
    }
  
  // جلب بيانات الخدمات
  const serviceIds = data.items.map(item => item.serviceId);
  const servicesData = await db.select().from(posServices).where(inArray(posServices.id, serviceIds));
  
  // حساب الإجمالي
  let subtotal = 0;
  const invoiceItems: { serviceId: number; serviceName: string; serviceNameAr: string; price: number; quantity: number; total: number }[] = [];
  
  for (const item of data.items) {
    const service = servicesData.find(s => s.id === item.serviceId);
    if (service) {
      const itemTotal = Number(service.price) * item.quantity;
      subtotal += itemTotal;
      invoiceItems.push({
        serviceId: service.id,
        serviceName: service.name,
        serviceNameAr: service.nameAr,
        price: Number(service.price),
        quantity: item.quantity,
        total: itemTotal,
      });
    }
  }
  
  // حساب الخصم والإجمالي النهائي
  const discountAmount = data.discountAmount || 0;
  const total = subtotal - discountAmount;
  
  // تحديد تاريخ الفاتورة (يوم العمل)
  const now = new Date();
  const invoiceDate = getWorkingDate(now);
  
  // إنشاء رقم الفاتورة
  const invoiceNumber = await generatePosInvoiceNumber(data.branchId, invoiceDate);
  
  // إنشاء الفاتورة
  const invoiceResult = await db.insert(posInvoices).values({
    invoiceNumber,
    branchId: data.branchId,
    branchName: branch?.nameAr || '',
    employeeId: data.employeeId,
    employeeName: employee?.name || '',
    loyaltyCustomerId: data.loyaltyCustomerId || null,
    loyaltyCustomerName: loyaltyCustomer?.name || null,
    loyaltyCustomerPhone: loyaltyCustomer?.phone || null,
    subtotal: subtotal.toString(),
    discountAmount: discountAmount.toString(),
    discountPercentage: (data.discountPercentage || 0).toString(),
    discountReason: data.discountReason || null,
    total: total.toString(),
    paymentMethod: data.paymentMethod,
    cashAmount: (data.cashAmount || (data.paymentMethod === 'cash' ? total : 0)).toString(),
    cardAmount: (data.cardAmount || (data.paymentMethod === 'card' ? total : 0)).toString(),
    status: 'completed',
    notes: data.notes || null,
    createdBy: data.createdBy,
    createdByName: data.createdByName,
    invoiceDate,
  });
  
  const invoiceId = invoiceResult[0].insertId;
  
  // إضافة بنود الفاتورة
  for (const item of invoiceItems) {
    await db.insert(posInvoiceItems).values({
      invoiceId,
      serviceId: item.serviceId,
      serviceName: item.serviceName,
      serviceNameAr: item.serviceNameAr,
      price: item.price.toString(),
      quantity: item.quantity,
      total: item.total.toString(),
    });
  }
  
  // تحديث ملخص اليوم
  await updatePosDailySummary(data.branchId, invoiceDate);
  
  // تحديث أداء الموظف
  await updatePosEmployeePerformance(data.employeeId, data.branchId, invoiceDate);
  
    // تسجيل نجاح إنشاء الفاتورة
    const duration = Date.now() - startTime;
    posLogger.info('تم إنشاء فاتورة بنجاح', {
      invoiceId,
      invoiceNumber,
      branchId: data.branchId,
      employeeId: data.employeeId,
      total,
      itemsCount: invoiceItems.length,
      paymentMethod: data.paymentMethod,
      duration,
      action: 'createPosInvoice'
    });
    
    return {
      id: invoiceId,
      invoiceNumber,
      total,
      items: invoiceItems,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    posLogger.error('فشل إنشاء فاتورة', error, {
      branchId: data.branchId,
      employeeId: data.employeeId,
      itemsCount: data.items.length,
      paymentMethod: data.paymentMethod,
      duration,
      action: 'createPosInvoice'
    });
    throw error;
  }
}

// دالة لتحديد يوم العمل (بعد منتصف الليل = يوم جديد)
function getWorkingDate(date: Date): Date {
  const hours = date.getHours();
  // إذا كان الوقت قبل منتصف الليل، نستخدم نفس اليوم
  // إذا كان بعد منتصف الليل، نستخدم اليوم الجديد
  const workingDate = new Date(date);
  workingDate.setHours(0, 0, 0, 0);
  return workingDate;
}

// دالة لإنشاء رقم فاتورة فريد
async function generatePosInvoiceNumber(branchId: number, date: Date): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  // عد الفواتير اليوم لهذا الفرع
  const todayInvoices = await db.select({ count: sql<number>`COUNT(*)` })
    .from(posInvoices)
    .where(and(
      eq(posInvoices.branchId, branchId),
      gte(posInvoices.invoiceDate, startOfDay),
      lte(posInvoices.invoiceDate, endOfDay)
    ));
  
  const count = todayInvoices[0]?.count || 0;
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  
  return `POS-${branchId}-${dateStr}-${String(count + 1).padStart(4, '0')}`;
}

export async function getTodayPosInvoices(branchId: number, date?: Date) {
  const db = await getDb();
  if (!db) return [];
  
  const today = date ? getWorkingDate(date) : getWorkingDate(new Date());
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);
  
  return await db.select()
    .from(posInvoices)
    .where(and(
      eq(posInvoices.branchId, branchId),
      gte(posInvoices.invoiceDate, startOfDay),
      lte(posInvoices.invoiceDate, endOfDay)
    ))
    .orderBy(desc(posInvoices.createdAt));
}

export async function getPosInvoicesByDateRange(branchId: number, startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(posInvoices)
    .where(and(
      eq(posInvoices.branchId, branchId),
      gte(posInvoices.invoiceDate, startDate),
      lte(posInvoices.invoiceDate, endDate)
    ))
    .orderBy(desc(posInvoices.createdAt));
}

export async function getPosInvoiceDetails(invoiceId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const invoice = await db.select()
    .from(posInvoices)
    .where(eq(posInvoices.id, invoiceId))
    .limit(1);
  
  if (!invoice[0]) return null;
  
  const items = await db.select()
    .from(posInvoiceItems)
    .where(eq(posInvoiceItems.invoiceId, invoiceId));
  
  return {
    ...invoice[0],
    items,
  };
}

export async function cancelPosInvoice(invoiceId: number, reason?: string) {
  const db = await getDb();
  if (!db) {
    posLogger.error('فشل إلغاء فاتورة: قاعدة البيانات غير متاحة', new Error('Database not available'), {
      invoiceId,
      action: 'cancelPosInvoice'
    });
    throw new Error('قاعدة البيانات غير متاحة');
  }
  
  try {
    const invoice = await db.select()
      .from(posInvoices)
      .where(eq(posInvoices.id, invoiceId))
      .limit(1);
    
    if (!invoice[0]) {
      posLogger.warn('محاولة إلغاء فاتورة غير موجودة', { invoiceId });
      throw new Error('الفاتورة غير موجودة');
    }
    
    await db.update(posInvoices)
      .set({ 
        status: 'cancelled',
        notes: reason ? `${invoice[0].notes || ''}\n[ملغاة]: ${reason}` : invoice[0].notes,
      })
      .where(eq(posInvoices.id, invoiceId));
    
    // تحديث ملخص اليوم
    await updatePosDailySummary(invoice[0].branchId, new Date(invoice[0].invoiceDate));
    
    posLogger.info('تم إلغاء فاتورة بنجاح', {
      invoiceId,
      invoiceNumber: invoice[0].invoiceNumber,
      branchId: invoice[0].branchId,
      total: invoice[0].total,
      reason,
      action: 'cancelPosInvoice'
    });
    
    return { success: true };
  } catch (error) {
    posLogger.error('فشل إلغاء فاتورة', error, {
      invoiceId,
      reason,
      action: 'cancelPosInvoice'
    });
    throw error;
  }
}

// ==================== تقرير اليوم ====================

async function updatePosDailySummary(branchId: number, date: Date) {
  const db = await getDb();
  if (!db) return;
  
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  // جلب جميع فواتير اليوم
  const invoicesData = await db.select()
    .from(posInvoices)
    .where(and(
      eq(posInvoices.branchId, branchId),
      gte(posInvoices.invoiceDate, startOfDay),
      lte(posInvoices.invoiceDate, endOfDay)
    ));
  
  // حساب الإحصائيات
  let totalAmount = 0;
  let cashTotal = 0;
  let cardTotal = 0;
  let loyaltyTotal = 0;
  let totalDiscounts = 0;
  let cancelledCount = 0;
  let cancelledAmount = 0;
  let completedCount = 0;
  
  for (const inv of invoicesData) {
    if (inv.status === 'cancelled') {
      cancelledCount++;
      cancelledAmount += Number(inv.total);
    } else {
      completedCount++;
      totalAmount += Number(inv.total);
      totalDiscounts += Number(inv.discountAmount);
      
      if (inv.paymentMethod === 'cash') {
        cashTotal += Number(inv.total);
      } else if (inv.paymentMethod === 'card') {
        cardTotal += Number(inv.total);
      } else if (inv.paymentMethod === 'split') {
        cashTotal += Number(inv.cashAmount);
        cardTotal += Number(inv.cardAmount);
      } else if (inv.paymentMethod === 'loyalty') {
        loyaltyTotal += Number(inv.total);
      }
    }
  }
  
  // جلب بيانات الفرع
  const branchData = await db.select().from(branches).where(eq(branches.id, branchId)).limit(1);
  const branch = branchData[0];
  
  // التحقق من وجود ملخص لهذا اليوم
  const existingSummary = await db.select()
    .from(posDailySummary)
    .where(and(
      eq(posDailySummary.branchId, branchId),
      gte(posDailySummary.summaryDate, startOfDay),
      lte(posDailySummary.summaryDate, endOfDay)
    ))
    .limit(1);
  
  if (existingSummary[0]) {
    // تحديث الملخص الموجود
    await db.update(posDailySummary)
      .set({
        totalInvoices: completedCount,
        totalAmount: totalAmount.toString(),
        cashTotal: cashTotal.toString(),
        cardTotal: cardTotal.toString(),
        loyaltyTotal: loyaltyTotal.toString(),
        totalDiscounts: totalDiscounts.toString(),
        cancelledCount,
        cancelledAmount: cancelledAmount.toString(),
      })
      .where(eq(posDailySummary.id, existingSummary[0].id));
  } else {
    // إنشاء ملخص جديد
    await db.insert(posDailySummary).values({
      branchId,
      branchName: branch?.nameAr || '',
      summaryDate: startOfDay,
      totalInvoices: completedCount,
      totalAmount: totalAmount.toString(),
      cashTotal: cashTotal.toString(),
      cardTotal: cardTotal.toString(),
      loyaltyTotal: loyaltyTotal.toString(),
      totalDiscounts: totalDiscounts.toString(),
      cancelledCount,
      cancelledAmount: cancelledAmount.toString(),
    });
  }
}

export async function getPosDailyReport(branchId: number, date: Date) {
  const db = await getDb();
  if (!db) return null;
  
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  // جلب ملخص اليوم
  const summary = await db.select()
    .from(posDailySummary)
    .where(and(
      eq(posDailySummary.branchId, branchId),
      gte(posDailySummary.summaryDate, startOfDay),
      lte(posDailySummary.summaryDate, endOfDay)
    ))
    .limit(1);
  
  // جلب فواتير اليوم
  const invoicesData = await db.select()
    .from(posInvoices)
    .where(and(
      eq(posInvoices.branchId, branchId),
      gte(posInvoices.invoiceDate, startOfDay),
      lte(posInvoices.invoiceDate, endOfDay),
      eq(posInvoices.status, 'completed')
    ))
    .orderBy(desc(posInvoices.createdAt));
  
  return {
    summary: summary[0] || {
      totalInvoices: 0,
      totalAmount: '0',
      cashTotal: '0',
      cardTotal: '0',
      loyaltyTotal: '0',
      totalDiscounts: '0',
      cancelledCount: 0,
      cancelledAmount: '0',
    },
    invoices: invoicesData,
  };
}

// ==================== أداء الموظفين ====================

async function updatePosEmployeePerformance(employeeId: number, branchId: number, date: Date) {
  const db = await getDb();
  if (!db) return;
  
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  // جلب فواتير الموظف لهذا اليوم
  const employeeInvoicesData = await db.select()
    .from(posInvoices)
    .where(and(
      eq(posInvoices.employeeId, employeeId),
      eq(posInvoices.branchId, branchId),
      gte(posInvoices.invoiceDate, startOfDay),
      lte(posInvoices.invoiceDate, endOfDay),
      eq(posInvoices.status, 'completed')
    ));
  
  const invoiceCount = employeeInvoicesData.length;
  const totalRevenue = employeeInvoicesData.reduce((sum, inv) => sum + Number(inv.total), 0);
  const averageInvoice = invoiceCount > 0 ? totalRevenue / invoiceCount : 0;
  
  // جلب بيانات الموظف
  const employeeData = await db.select().from(employees).where(eq(employees.id, employeeId)).limit(1);
  const employee = employeeData[0];
  
  // التحقق من وجود سجل أداء لهذا اليوم
  const existingPerformance = await db.select()
    .from(posEmployeePerformance)
    .where(and(
      eq(posEmployeePerformance.employeeId, employeeId),
      eq(posEmployeePerformance.branchId, branchId),
      gte(posEmployeePerformance.performanceDate, startOfDay),
      lte(posEmployeePerformance.performanceDate, endOfDay)
    ))
    .limit(1);
  
  if (existingPerformance[0]) {
    await db.update(posEmployeePerformance)
      .set({
        invoiceCount,
        totalRevenue: totalRevenue.toString(),
        averageInvoice: averageInvoice.toString(),
      })
      .where(eq(posEmployeePerformance.id, existingPerformance[0].id));
  } else {
    await db.insert(posEmployeePerformance).values({
      employeeId,
      employeeName: employee?.name || '',
      branchId,
      performanceDate: startOfDay,
      invoiceCount,
      totalRevenue: totalRevenue.toString(),
      averageInvoice: averageInvoice.toString(),
    });
  }
}

export async function getPosEmployeePerformance(branchId: number, date: Date) {
  const db = await getDb();
  if (!db) return [];
  
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return await db.select()
    .from(posEmployeePerformance)
    .where(and(
      eq(posEmployeePerformance.branchId, branchId),
      gte(posEmployeePerformance.performanceDate, startOfDay),
      lte(posEmployeePerformance.performanceDate, endOfDay)
    ))
    .orderBy(desc(posEmployeePerformance.totalRevenue));
}

// ==================== عملاء الولاء ====================

export async function searchLoyaltyCustomersForPos(query: string) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(loyaltyCustomers)
    .where(or(
      like(loyaltyCustomers.name, `%${query}%`),
      like(loyaltyCustomers.phone, `%${query}%`)
    ))
    .limit(10);
}

export async function checkLoyaltyCustomerDiscount(customerId: number) {
  const db = await getDb();
  if (!db) return { eligible: false, message: 'قاعدة البيانات غير متاحة' };
  
  const customer = await db.select()
    .from(loyaltyCustomers)
    .where(eq(loyaltyCustomers.id, customerId))
    .limit(1);
  
  if (!customer[0]) {
    return { eligible: false, message: 'العميل غير موجود' };
  }
  
  // جلب زيارات الشهر الحالي
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  
  const monthlyVisits = await db.select({ count: sql<number>`COUNT(*)` })
    .from(loyaltyVisits)
    .where(and(
      eq(loyaltyVisits.customerId, customerId),
      gte(loyaltyVisits.visitDate, startOfMonth),
      lte(loyaltyVisits.visitDate, endOfMonth)
    ));
  
  const visitCount = monthlyVisits[0]?.count || 0;
  const requiredVisits = 3; // عدد الزيارات المطلوبة للخصم
  
  if (visitCount >= requiredVisits) {
    return {
      eligible: true,
      message: `العميل مؤهل للخصم (${visitCount} زيارات هذا الشهر)`,
      visitCount,
      customer: customer[0],
    };
  }
  
  return {
    eligible: false,
    message: `العميل غير مؤهل للخصم (${visitCount}/${requiredVisits} زيارات)`,
    visitCount,
    requiredVisits,
    customer: customer[0],
  };
}

// ==================== الموظفين والفروع ====================

export async function getEmployeesByBranchForPos(branchId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select({
    id: employees.id,
    name: employees.name,
    position: employees.position,
    photoUrl: employees.photoUrl,
  })
    .from(employees)
    .where(eq(employees.branchId, branchId))
    .orderBy(asc(employees.name));
}

export async function getBranchesForPos() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select({
    id: branches.id,
    name: branches.name,
    nameAr: branches.nameAr,
  })
    .from(branches)
    .where(eq(branches.isActive, true))
    .orderBy(asc(branches.name));
}


// ==================== دوال تأكيد وإرسال فواتير الكاشير للإيرادات ====================

// التحقق من حالة التأكيد لليوم
export async function checkPosConfirmationStatus(branchId: number, date: Date) {
  const db = await getDb();
  if (!db) return { isConfirmed: false, confirmedAt: null, confirmedBy: null };
  
  // تحديد بداية ونهاية اليوم
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  // البحث عن إيراد مؤكد من الكاشير لهذا اليوم (البحث في posInvoices المؤكدة)
  const confirmedInvoices = await db.select()
    .from(posInvoices)
    .where(
      and(
        eq(posInvoices.branchId, branchId),
        gte(posInvoices.invoiceDate, startOfDay),
        lte(posInvoices.invoiceDate, endOfDay),
        eq(posInvoices.status, 'completed')
      )
    )
    .limit(1);
  
  // البحث عن إيراد يومي مرتبط
  const existingRevenue = await db.select()
    .from(dailyRevenues)
    .where(
      and(
        eq(dailyRevenues.branchId, branchId),
        gte(dailyRevenues.date, startOfDay),
        lte(dailyRevenues.date, endOfDay)
      )
    )
    .limit(1);
  
  if (existingRevenue.length > 0 && confirmedInvoices.length > 0) {
    return {
      isConfirmed: true,
      confirmedAt: existingRevenue[0].createdAt,
      confirmedBy: null,
      revenueId: existingRevenue[0].id,
    };
  }
  
  return { isConfirmed: false, confirmedAt: null, confirmedBy: null };
}

// إنشاء سجل إيرادات من الكاشير
export async function createRevenueFromPOS(data: {
  branchId: number;
  date: Date;
  totalAmount: number;
  cashAmount: number;
  cardAmount: number;
  balanceImageKey: string;
  balanceImageUrl: string;
  paidInvoices: { customerName: string; amount: number }[];
  loyaltyInfo?: { invoiceCount: number; discountAmount: number };
  notes?: string;
  confirmedBy: number;
  confirmedByName: string;
  posInvoiceIds: number[];
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  // حساب إجمالي فواتير المدفوع
  const totalPaidInvoices = data.paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  
  // الحصول على أو إنشاء السجل الشهري
  const year = data.date.getFullYear();
  const month = data.date.getMonth() + 1;
  
  let monthlyRecord = await db.select()
    .from(monthlyRecords)
    .where(
      and(
        eq(monthlyRecords.branchId, data.branchId),
        eq(monthlyRecords.year, year),
        eq(monthlyRecords.month, month)
      )
    )
    .limit(1);
  
  let monthlyRecordId: number;
  
  if (monthlyRecord.length === 0) {
    // إنشاء سجل شهري جديد
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // آخر يوم في الشهر
    
    const newRecord = await db.insert(monthlyRecords).values({
      branchId: data.branchId,
      year,
      month,
      startDate,
      endDate,
      status: 'active',
    });
    monthlyRecordId = Number(newRecord[0].insertId);
  } else {
    monthlyRecordId = monthlyRecord[0].id;
  }
  
  // إنشاء سجل الإيرادات اليومية
  const result = await db.insert(dailyRevenues).values({
    monthlyRecordId,
    branchId: data.branchId,
    date: data.date,
    cash: String(data.cashAmount),
    network: String(data.cardAmount),
    balance: String(data.cardAmount), // الرصيد = الشبكة
    paidInvoices: String(totalPaidInvoices),
    paidInvoicesNote: data.notes || null,
    paidInvoicesCustomer: data.paidInvoices.length > 0 
      ? data.paidInvoices.map(inv => inv.customerName).join(', ') 
      : null,
    loyalty: String(data.loyaltyInfo?.discountAmount || 0),
    total: String(data.totalAmount),
    isMatched: true,
    balanceImages: [{
      url: data.balanceImageUrl,
      key: data.balanceImageKey,
      uploadedAt: new Date().toISOString(),
    }],
    imageVerificationStatus: 'verified',
    createdBy: data.confirmedBy,
  });
  
  const revenueId = Number(result[0].insertId);
  
  // تحديث فواتير الكاشير بربطها بالإيراد
  if (data.posInvoiceIds.length > 0) {
    await db.update(posInvoices)
      .set({ 
        status: 'completed',
      })
      .where(inArray(posInvoices.id, data.posInvoiceIds));
  }
  
  return { id: revenueId };
}

// تحديث حالة فواتير الكاشير إلى مكتملة
export async function markPosInvoicesAsConfirmed(invoiceIds: number[]) {
  const db = await getDb();
  if (!db) return;
  
  if (invoiceIds.length === 0) return;
  
  await db.update(posInvoices)
    .set({ status: 'completed' })
    .where(inArray(posInvoices.id, invoiceIds));
}


// ==================== ترتيب موظفي الفرع حسب الإيرادات ====================
export async function getBranchEmployeesWithMonthlyRevenue(branchId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) return [];
  
  // حساب بداية ونهاية الشهر الحالي
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  // حساب بداية ونهاية الشهر السابق
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevStartDate = new Date(prevYear, prevMonth - 1, 1);
  const prevEndDate = new Date(prevYear, prevMonth, 0);
  
  // جلب موظفي الفرع مع إيراداتهم الشهرية
  const result = await db.select({
    employeeId: employees.id,
    employeeName: employees.name,
    employeeCode: employees.code,
    position: employees.position,
    photoUrl: employees.photoUrl,
    totalRevenue: sql<number>`COALESCE(SUM(${employeeRevenues.total}), 0)`.as('totalRevenue'),
    invoiceCount: sql<number>`COUNT(DISTINCT ${employeeRevenues.id})`.as('invoiceCount'),
  })
  .from(employees)
  .leftJoin(employeeRevenues, eq(employees.id, employeeRevenues.employeeId))
  .leftJoin(dailyRevenues, and(
    eq(employeeRevenues.dailyRevenueId, dailyRevenues.id),
    gte(dailyRevenues.date, startDate),
    lte(dailyRevenues.date, endDate)
  ))
  .where(and(
    eq(employees.branchId, branchId),
    eq(employees.isActive, true)
  ))
  .groupBy(employees.id, employees.name, employees.code, employees.position, employees.photoUrl)
  .orderBy(desc(sql`totalRevenue`));
  
  // جلب إيرادات الشهر السابق لكل موظف
  const prevMonthRevenues = await db.select({
    employeeId: employees.id,
    totalRevenue: sql<number>`COALESCE(SUM(${employeeRevenues.total}), 0)`.as('totalRevenue'),
  })
  .from(employees)
  .leftJoin(employeeRevenues, eq(employees.id, employeeRevenues.employeeId))
  .leftJoin(dailyRevenues, and(
    eq(employeeRevenues.dailyRevenueId, dailyRevenues.id),
    gte(dailyRevenues.date, prevStartDate),
    lte(dailyRevenues.date, prevEndDate)
  ))
  .where(and(
    eq(employees.branchId, branchId),
    eq(employees.isActive, true)
  ))
  .groupBy(employees.id);
  
  // تحويل إيرادات الشهر السابق إلى Map للوصول السريع
  const prevRevenueMap = new Map<number, number>();
  prevMonthRevenues.forEach(emp => {
    prevRevenueMap.set(emp.employeeId, Number(emp.totalRevenue || 0));
  });
  
  return result.map((emp, index) => {
    const currentRevenue = Number(emp.totalRevenue || 0);
    const previousRevenue = prevRevenueMap.get(emp.employeeId) || 0;
    
    // حساب نسبة التغيير
    let changePercentage = 0;
    if (previousRevenue > 0) {
      changePercentage = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
    } else if (currentRevenue > 0) {
      changePercentage = 100; // إذا لم يكن هناك إيرادات سابقة والآن يوجد
    }
    
    return {
      ...emp,
      rank: index + 1,
      totalRevenue: currentRevenue,
      invoiceCount: Number(emp.invoiceCount || 0),
      previousRevenue,
      changePercentage: Math.round(changePercentage * 10) / 10, // تقريب لرقم عشري واحد
    };
  });
}


// ==================== تقارير أداء الخدمات ====================

/**
 * جلب إحصائيات الخدمات الأكثر طلباً
 * يحسب عدد الطلبات والإيرادات لكل خدمة في فترة زمنية محددة
 */
export async function getServicePerformanceReport(
  startDate: Date,
  endDate: Date,
  branchId?: number,
  limit: number = 20
) {
  const db = await getDb();
  if (!db) return [];
  
  // بناء شرط الفرع
  const branchCondition = branchId 
    ? and(
        gte(posInvoices.invoiceDate, startDate),
        lte(posInvoices.invoiceDate, endDate),
        eq(posInvoices.branchId, branchId),
        eq(posInvoices.status, 'completed')
      )
    : and(
        gte(posInvoices.invoiceDate, startDate),
        lte(posInvoices.invoiceDate, endDate),
        eq(posInvoices.status, 'completed')
      );
  
  const result = await db.select({
    serviceId: posInvoiceItems.serviceId,
    serviceName: posInvoiceItems.serviceName,
    serviceNameAr: posInvoiceItems.serviceNameAr,
    totalQuantity: sql<number>`SUM(${posInvoiceItems.quantity})`.as('totalQuantity'),
    totalRevenue: sql<number>`SUM(${posInvoiceItems.total})`.as('totalRevenue'),
    averagePrice: sql<number>`AVG(${posInvoiceItems.price})`.as('averagePrice'),
    invoiceCount: sql<number>`COUNT(DISTINCT ${posInvoiceItems.invoiceId})`.as('invoiceCount'),
  })
  .from(posInvoiceItems)
  .innerJoin(posInvoices, eq(posInvoiceItems.invoiceId, posInvoices.id))
  .where(branchCondition)
  .groupBy(posInvoiceItems.serviceId, posInvoiceItems.serviceName, posInvoiceItems.serviceNameAr)
  .orderBy(desc(sql`totalQuantity`))
  .limit(limit);
  
  return result.map((item, index) => ({
    rank: index + 1,
    serviceId: item.serviceId,
    serviceName: item.serviceName,
    serviceNameAr: item.serviceNameAr,
    totalQuantity: Number(item.totalQuantity || 0),
    totalRevenue: Number(item.totalRevenue || 0),
    averagePrice: Number(item.averagePrice || 0),
    invoiceCount: Number(item.invoiceCount || 0),
  }));
}

/**
 * جلب ملخص أداء الخدمات حسب الفئة
 */
export async function getServicePerformanceByCategory(
  startDate: Date,
  endDate: Date,
  branchId?: number
) {
  const db = await getDb();
  if (!db) return [];
  
  // بناء شرط الفرع
  const branchCondition = branchId 
    ? and(
        gte(posInvoices.invoiceDate, startDate),
        lte(posInvoices.invoiceDate, endDate),
        eq(posInvoices.branchId, branchId),
        eq(posInvoices.status, 'completed')
      )
    : and(
        gte(posInvoices.invoiceDate, startDate),
        lte(posInvoices.invoiceDate, endDate),
        eq(posInvoices.status, 'completed')
      );
  
  const result = await db.select({
    categoryId: posServices.categoryId,
    categoryName: posCategories.name,
    categoryNameAr: posCategories.nameAr,
    categoryColor: posCategories.color,
    totalQuantity: sql<number>`SUM(${posInvoiceItems.quantity})`.as('totalQuantity'),
    totalRevenue: sql<number>`SUM(${posInvoiceItems.total})`.as('totalRevenue'),
    serviceCount: sql<number>`COUNT(DISTINCT ${posInvoiceItems.serviceId})`.as('serviceCount'),
  })
  .from(posInvoiceItems)
  .innerJoin(posInvoices, eq(posInvoiceItems.invoiceId, posInvoices.id))
  .innerJoin(posServices, eq(posInvoiceItems.serviceId, posServices.id))
  .innerJoin(posCategories, eq(posServices.categoryId, posCategories.id))
  .where(branchCondition)
  .groupBy(posServices.categoryId, posCategories.name, posCategories.nameAr, posCategories.color)
  .orderBy(desc(sql`totalRevenue`));
  
  return result.map(item => ({
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    categoryNameAr: item.categoryNameAr,
    categoryColor: item.categoryColor,
    totalQuantity: Number(item.totalQuantity || 0),
    totalRevenue: Number(item.totalRevenue || 0),
    serviceCount: Number(item.serviceCount || 0),
  }));
}

/**
 * جلب إحصائيات عامة لأداء الخدمات
 */
export async function getServicePerformanceSummary(
  startDate: Date,
  endDate: Date,
  branchId?: number
) {
  const db = await getDb();
  if (!db) return null;
  
  // بناء شرط الفرع
  const branchCondition = branchId 
    ? and(
        gte(posInvoices.invoiceDate, startDate),
        lte(posInvoices.invoiceDate, endDate),
        eq(posInvoices.branchId, branchId),
        eq(posInvoices.status, 'completed')
      )
    : and(
        gte(posInvoices.invoiceDate, startDate),
        lte(posInvoices.invoiceDate, endDate),
        eq(posInvoices.status, 'completed')
      );
  
  const [result] = await db.select({
    totalInvoices: sql<number>`COUNT(DISTINCT ${posInvoices.id})`.as('totalInvoices'),
    totalRevenue: sql<number>`SUM(${posInvoices.total})`.as('totalRevenue'),
    totalServices: sql<number>`SUM(${posInvoiceItems.quantity})`.as('totalServices'),
    uniqueServices: sql<number>`COUNT(DISTINCT ${posInvoiceItems.serviceId})`.as('uniqueServices'),
    averageInvoiceValue: sql<number>`AVG(${posInvoices.total})`.as('averageInvoiceValue'),
  })
  .from(posInvoices)
  .innerJoin(posInvoiceItems, eq(posInvoices.id, posInvoiceItems.invoiceId))
  .where(branchCondition);
  
  // حساب الفترة السابقة للمقارنة
  const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const prevEndDate = new Date(startDate.getTime() - 1);
  const prevStartDate = new Date(prevEndDate.getTime() - (periodDays * 24 * 60 * 60 * 1000));
  
  const prevCondition = branchId 
    ? and(
        gte(posInvoices.invoiceDate, prevStartDate),
        lte(posInvoices.invoiceDate, prevEndDate),
        eq(posInvoices.branchId, branchId),
        eq(posInvoices.status, 'completed')
      )
    : and(
        gte(posInvoices.invoiceDate, prevStartDate),
        lte(posInvoices.invoiceDate, prevEndDate),
        eq(posInvoices.status, 'completed')
      );
  
  const [prevResult] = await db.select({
    totalRevenue: sql<number>`SUM(${posInvoices.total})`.as('totalRevenue'),
    totalServices: sql<number>`SUM(${posInvoiceItems.quantity})`.as('totalServices'),
  })
  .from(posInvoices)
  .innerJoin(posInvoiceItems, eq(posInvoices.id, posInvoiceItems.invoiceId))
  .where(prevCondition);
  
  const currentRevenue = Number(result?.totalRevenue || 0);
  const previousRevenue = Number(prevResult?.totalRevenue || 0);
  const revenueChange = previousRevenue > 0 
    ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 
    : (currentRevenue > 0 ? 100 : 0);
  
  const currentServices = Number(result?.totalServices || 0);
  const previousServices = Number(prevResult?.totalServices || 0);
  const servicesChange = previousServices > 0 
    ? ((currentServices - previousServices) / previousServices) * 100 
    : (currentServices > 0 ? 100 : 0);
  
  return {
    totalInvoices: Number(result?.totalInvoices || 0),
    totalRevenue: currentRevenue,
    totalServices: currentServices,
    uniqueServices: Number(result?.uniqueServices || 0),
    averageInvoiceValue: Number(result?.averageInvoiceValue || 0),
    revenueChange: Math.round(revenueChange * 10) / 10,
    servicesChange: Math.round(servicesChange * 10) / 10,
    previousRevenue,
    previousServices,
  };
}

/**
 * جلب أداء الخدمات اليومي للرسم البياني
 */
export async function getServicePerformanceDaily(
  startDate: Date,
  endDate: Date,
  branchId?: number
) {
  const db = await getDb();
  if (!db) return [];
  
  // بناء شرط الفرع
  const branchCondition = branchId 
    ? and(
        gte(posInvoices.invoiceDate, startDate),
        lte(posInvoices.invoiceDate, endDate),
        eq(posInvoices.branchId, branchId),
        eq(posInvoices.status, 'completed')
      )
    : and(
        gte(posInvoices.invoiceDate, startDate),
        lte(posInvoices.invoiceDate, endDate),
        eq(posInvoices.status, 'completed')
      );
  
  const result = await db.select({
    date: sql<string>`DATE(${posInvoices.invoiceDate})`.as('date'),
    totalRevenue: sql<number>`SUM(${posInvoices.total})`.as('totalRevenue'),
    totalServices: sql<number>`SUM(${posInvoiceItems.quantity})`.as('totalServices'),
    invoiceCount: sql<number>`COUNT(DISTINCT ${posInvoices.id})`.as('invoiceCount'),
  })
  .from(posInvoices)
  .innerJoin(posInvoiceItems, eq(posInvoices.id, posInvoiceItems.invoiceId))
  .where(branchCondition)
  .groupBy(sql`DATE(${posInvoices.invoiceDate})`)
  .orderBy(sql`date`);
  
  return result.map(item => ({
    date: item.date,
    totalRevenue: Number(item.totalRevenue || 0),
    totalServices: Number(item.totalServices || 0),
    invoiceCount: Number(item.invoiceCount || 0),
  }));
}


// ==================== تقرير أداء الموظفين ====================

/**
 * جلب تقرير أداء الموظفين - ترتيب حسب الإيرادات
 */
export async function getEmployeePerformanceReport(
  startDate: Date,
  endDate: Date,
  branchId?: number,
  limit: number = 20
) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [
    gte(posInvoices.invoiceDate, startDate),
    lte(posInvoices.invoiceDate, endDate),
    eq(posInvoices.status, 'completed'),
  ];

  if (branchId) {
    conditions.push(eq(posInvoices.branchId, branchId));
  }

  const result = await db
    .select({
      employeeId: posInvoices.employeeId,
      employeeName: posInvoices.employeeName,
      totalRevenue: sql<number>`COALESCE(SUM(CAST(${posInvoices.total} AS DECIMAL(12,2))), 0)`,
      invoiceCount: sql<number>`COUNT(DISTINCT ${posInvoices.id})`,
      cashAmount: sql<number>`COALESCE(SUM(CAST(${posInvoices.cashAmount} AS DECIMAL(12,2))), 0)`,
      cardAmount: sql<number>`COALESCE(SUM(CAST(${posInvoices.cardAmount} AS DECIMAL(12,2))), 0)`,
    })
    .from(posInvoices)
    .where(and(...conditions))
    .groupBy(posInvoices.employeeId, posInvoices.employeeName)
    .orderBy(sql`totalRevenue DESC`)
    .limit(limit);

  // جلب عدد الخدمات لكل موظف
  const serviceCountResult = await db
    .select({
      employeeId: posInvoices.employeeId,
      serviceCount: sql<number>`COALESCE(SUM(${posInvoiceItems.quantity}), 0)`,
    })
    .from(posInvoices)
    .innerJoin(posInvoiceItems, eq(posInvoices.id, posInvoiceItems.invoiceId))
    .where(and(...conditions))
    .groupBy(posInvoices.employeeId);

  const serviceCountMap = new Map(serviceCountResult.map(r => [r.employeeId, Number(r.serviceCount) || 0]));

  // إضافة صورة الموظف
  const employeeIds = result.map(r => r.employeeId);
  const employeePhotos = employeeIds.length > 0 
    ? await db
        .select({ id: employees.id, photoUrl: employees.photoUrl, position: employees.position })
        .from(employees)
        .where(inArray(employees.id, employeeIds))
    : [];

  const photoMap = new Map(employeePhotos.map(e => [e.id, { photoUrl: e.photoUrl, position: e.position }]));

  return result.map((item, index) => {
    const totalRevenue = Number(item.totalRevenue) || 0;
    const invoiceCount = Number(item.invoiceCount) || 0;
    return {
      rank: index + 1,
      employeeId: item.employeeId,
      employeeName: item.employeeName || 'غير محدد',
      employeePhoto: photoMap.get(item.employeeId)?.photoUrl || null,
      employeePosition: photoMap.get(item.employeeId)?.position || 'موظف',
      totalRevenue,
      invoiceCount,
      serviceCount: serviceCountMap.get(item.employeeId) || 0,
      averageInvoiceValue: invoiceCount > 0 ? Math.round(totalRevenue / invoiceCount) : 0,
      cashAmount: Number(item.cashAmount) || 0,
      cardAmount: Number(item.cardAmount) || 0,
    };
  });
}

/**
 * جلب ملخص أداء الموظفين
 */
export async function getEmployeePerformanceSummary(
  startDate: Date,
  endDate: Date,
  branchId?: number
) {
  const db = await getDb();
  if (!db) return null;

  const conditions = [
    gte(posInvoices.invoiceDate, startDate),
    lte(posInvoices.invoiceDate, endDate),
    eq(posInvoices.status, 'completed'),
  ];

  if (branchId) {
    conditions.push(eq(posInvoices.branchId, branchId));
  }

  // الفترة الحالية
  const currentResult = await db
    .select({
      totalRevenue: sql<number>`COALESCE(SUM(CAST(${posInvoices.total} AS DECIMAL(12,2))), 0)`,
      totalInvoices: sql<number>`COUNT(DISTINCT ${posInvoices.id})`,
      uniqueEmployees: sql<number>`COUNT(DISTINCT ${posInvoices.employeeId})`,
    })
    .from(posInvoices)
    .where(and(...conditions));

  // حساب الفترة السابقة للمقارنة
  const periodLength = endDate.getTime() - startDate.getTime();
  const previousStartDate = new Date(startDate.getTime() - periodLength);
  const previousEndDate = new Date(startDate.getTime() - 1);

  const previousConditions = [
    gte(posInvoices.invoiceDate, previousStartDate),
    lte(posInvoices.invoiceDate, previousEndDate),
    eq(posInvoices.status, 'completed'),
  ];

  if (branchId) {
    previousConditions.push(eq(posInvoices.branchId, branchId));
  }

  const previousResult = await db
    .select({
      totalRevenue: sql<number>`COALESCE(SUM(CAST(${posInvoices.total} AS DECIMAL(12,2))), 0)`,
      totalInvoices: sql<number>`COUNT(DISTINCT ${posInvoices.id})`,
    })
    .from(posInvoices)
    .where(and(...previousConditions));

  const current = currentResult[0];
  const previous = previousResult[0];

  const currentRevenue = Number(current?.totalRevenue) || 0;
  const previousRevenue = Number(previous?.totalRevenue) || 0;
  const currentInvoices = Number(current?.totalInvoices) || 0;
  const previousInvoices = Number(previous?.totalInvoices) || 0;
  const uniqueEmployees = Number(current?.uniqueEmployees) || 0;

  const revenueChange = previousRevenue > 0 
    ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100 * 10) / 10
    : 0;

  const invoicesChange = previousInvoices > 0
    ? Math.round(((currentInvoices - previousInvoices) / previousInvoices) * 100 * 10) / 10
    : 0;

  return {
    totalRevenue: currentRevenue,
    totalInvoices: currentInvoices,
    uniqueEmployees,
    averageInvoiceValue: currentInvoices > 0 ? Math.round(currentRevenue / currentInvoices) : 0,
    averageRevenuePerEmployee: uniqueEmployees > 0 ? Math.round(currentRevenue / uniqueEmployees) : 0,
    revenueChange,
    invoicesChange,
  };
}

/**
 * جلب أداء الموظفين اليومي
 */
export async function getEmployeePerformanceDaily(
  startDate: Date,
  endDate: Date,
  branchId?: number
) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [
    gte(posInvoices.invoiceDate, startDate),
    lte(posInvoices.invoiceDate, endDate),
    eq(posInvoices.status, 'completed'),
  ];

  if (branchId) {
    conditions.push(eq(posInvoices.branchId, branchId));
  }

  const result = await db
    .select({
      date: sql<string>`DATE(${posInvoices.invoiceDate})`,
      totalRevenue: sql<number>`COALESCE(SUM(CAST(${posInvoices.total} AS DECIMAL(12,2))), 0)`,
      invoiceCount: sql<number>`COUNT(DISTINCT ${posInvoices.id})`,
      uniqueEmployees: sql<number>`COUNT(DISTINCT ${posInvoices.employeeId})`,
    })
    .from(posInvoices)
    .where(and(...conditions))
    .groupBy(sql`DATE(${posInvoices.invoiceDate})`)
    .orderBy(sql`DATE(${posInvoices.invoiceDate})`);

  return result.map(item => ({
    date: String(item.date),
    totalRevenue: Number(item.totalRevenue) || 0,
    invoiceCount: Number(item.invoiceCount) || 0,
    uniqueEmployees: Number(item.uniqueEmployees) || 0,
  }));
}

/**
 * جلب تفاصيل الخدمات لموظف معين
 */
export async function getEmployeeServiceDetails(
  employeeId: number,
  startDate: Date,
  endDate: Date,
  branchId?: number
) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [
    gte(posInvoices.invoiceDate, startDate),
    lte(posInvoices.invoiceDate, endDate),
    eq(posInvoices.status, 'completed'),
    eq(posInvoices.employeeId, employeeId),
  ];

  if (branchId) {
    conditions.push(eq(posInvoices.branchId, branchId));
  }

  const result = await db
    .select({
      serviceName: posInvoiceItems.serviceName,
      serviceNameAr: posInvoiceItems.serviceNameAr,
      totalQuantity: sql<number>`SUM(${posInvoiceItems.quantity})`,
      totalRevenue: sql<number>`COALESCE(SUM(CAST(${posInvoiceItems.total} AS DECIMAL(12,2))), 0)`,
    })
    .from(posInvoiceItems)
    .innerJoin(posInvoices, eq(posInvoiceItems.invoiceId, posInvoices.id))
    .where(and(...conditions))
    .groupBy(posInvoiceItems.serviceName, posInvoiceItems.serviceNameAr)
    .orderBy(sql`totalRevenue DESC`);

  return result.map(item => ({
    serviceName: item.serviceName || 'غير محدد',
    serviceNameAr: item.serviceNameAr || item.serviceName || 'غير محدد',
    totalQuantity: Number(item.totalQuantity) || 0,
    totalRevenue: Number(item.totalRevenue) || 0,
  }));
}


// ==================== نظام خصم الزيارة الثالثة (60%) ====================

/**
 * جلب عدد الزيارات الموافق عليها لعميل معين
 * يستخدم نظام الدورة (30 يوم من الزيارة الأولى)
 * بعد الزيارة الثالثة واستخدام الخصم، تبدأ دورة جديدة
 */
export async function getApprovedVisitsCount(customerId: number): Promise<{
  totalApproved: number;
  visitsInCurrentCycle: number;
  isEligibleForDiscount: boolean;
  discountPercentage: number;
  nextDiscountAt: number;
  cycleInfo: {
    startDate: Date | null;
    endDate: Date | null;
    daysRemaining: number;
    isExpired: boolean;
  };
}> {
  const db = await getDb();
  if (!db) return { 
    totalApproved: 0, 
    visitsInCurrentCycle: 0, 
    isEligibleForDiscount: false,
    discountPercentage: 0,
    nextDiscountAt: 3,
    cycleInfo: { startDate: null, endDate: null, daysRemaining: 30, isExpired: false }
  };

  // جلب إعدادات الولاء
  const settings = await getLoyaltySettings();
  const requiredVisits = settings?.requiredVisitsForDiscount || 3;
  const discountPercentage = settings?.discountPercentage || 60;

  // جلب حالة الدورة الحالية للعميل
  const cycleStatus = await getCustomerCycleStatus(customerId);
  
  // جلب إجمالي الزيارات الموافق عليها (للإحصائيات)
  const result = await db.select({ count: sql<number>`COUNT(*)` })
    .from(loyaltyVisits)
    .where(and(
      eq(loyaltyVisits.customerId, customerId),
      eq(loyaltyVisits.status, 'approved')
    ));

  const totalApproved = Number(result[0]?.count) || 0;
  
  // استخدام عدد الزيارات في الدورة الحالية (30 يوم)
  const visitsInCurrentCycle = cycleStatus.visitsInCycle;
  
  // التحقق من الأهلية للخصم:
  // - يجب أن يكون لديه 3 زيارات موافق عليها في الدورة الحالية
  // - يجب ألا يكون قد استخدم الخصم في هذه الدورة
  // - يجب ألا تكون الدورة منتهية
  const isEligibleForDiscount = 
    cycleStatus.hasCycle && 
    !cycleStatus.isExpired && 
    visitsInCurrentCycle >= requiredVisits && 
    !cycleStatus.discountUsed;
  
  // حساب عدد الزيارات المتبقية للخصم
  let nextDiscountAt: number;
  if (!cycleStatus.hasCycle || cycleStatus.isExpired) {
    // لا توجد دورة أو انتهت، يحتاج 3 زيارات جديدة
    nextDiscountAt = requiredVisits;
  } else if (cycleStatus.discountUsed) {
    // استخدم الخصم، ينتظر دورة جديدة
    nextDiscountAt = requiredVisits;
  } else if (visitsInCurrentCycle >= requiredVisits) {
    // مؤهل للخصم الآن
    nextDiscountAt = 0;
  } else {
    // يحتاج زيارات إضافية
    nextDiscountAt = requiredVisits - visitsInCurrentCycle;
  }

  return {
    totalApproved,
    visitsInCurrentCycle,
    isEligibleForDiscount,
    discountPercentage: isEligibleForDiscount ? discountPercentage : 0,
    nextDiscountAt,
    cycleInfo: {
      startDate: cycleStatus.cycleStartDate,
      endDate: cycleStatus.cycleEndDate,
      daysRemaining: cycleStatus.daysRemaining,
      isExpired: cycleStatus.isExpired,
    },
  };
}

/**
 * جلب عملاء الولاء المؤهلين للخصم (لعرضهم في الكاشير)
 * يستخدم نظام الدورة (30 يوم لكل عميل)
 * محسّن للأداء: يستخدم استعلام واحد مع بيانات الدورة من جدول العملاء
 */
export async function getEligibleLoyaltyCustomersForDiscount(branchId?: number): Promise<Array<{
  customerId: number;
  customerName: string;
  customerPhone: string;
  totalApprovedVisits: number;
  discountPercentage: number;
  isEligible: boolean;
  visitsInCycle: number;
  nextDiscountAt: number;
  cycleInfo: {
    startDate: Date | null;
    endDate: Date | null;
    daysRemaining: number;
    isExpired: boolean;
    discountUsed: boolean;
  };
}>> {
  const db = await getDb();
  if (!db) return [];

  // جلب إعدادات الولاء
  const settings = await getLoyaltySettings();
  const requiredVisits = settings?.requiredVisitsForDiscount || 3;
  const discountPercentage = settings?.discountPercentage || 60;

  // جلب جميع العملاء النشطين مع بيانات الدورة وعدد الزيارات في استعلام واحد
  const customersWithData = await db.select({
    id: loyaltyCustomers.id,
    name: loyaltyCustomers.name,
    phone: loyaltyCustomers.phone,
    branchId: loyaltyCustomers.branchId,
    cycleStartDate: loyaltyCustomers.cycleStartDate,
    cycleVisitsCount: loyaltyCustomers.cycleVisitsCount,
    cycleDiscountUsed: loyaltyCustomers.cycleDiscountUsed,
    totalApproved: sql<number>`(
      SELECT COUNT(*) FROM loyaltyVisits 
      WHERE loyaltyVisits.customerId = loyaltyCustomers.id 
      AND loyaltyVisits.status = 'approved'
    )`,
  })
    .from(loyaltyCustomers)
    .where(eq(loyaltyCustomers.isActive, true));

  const now = new Date();

  // معالجة البيانات محلياً
  const results = customersWithData
    .filter(c => !branchId || c.branchId === branchId)
    .map(c => {
      const totalApproved = Number(c.totalApproved) || 0;
      const visitsInCycle = c.cycleVisitsCount || 0;
      
      // حساب حالة الدورة
      let cycleStartDate: Date | null = null;
      let cycleEndDate: Date | null = null;
      let daysRemaining = 30;
      let isExpired = false;
      let hasCycle = false;
      
      if (c.cycleStartDate) {
        cycleStartDate = new Date(c.cycleStartDate);
        cycleEndDate = new Date(cycleStartDate);
        cycleEndDate.setDate(cycleEndDate.getDate() + 30);
        
        const timeDiff = cycleEndDate.getTime() - now.getTime();
        daysRemaining = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));
        isExpired = daysRemaining <= 0;
        hasCycle = true;
      }
      
      // التحقق من الأهلية
      const isEligible = 
        hasCycle && 
        !isExpired && 
        visitsInCycle >= requiredVisits && 
        !c.cycleDiscountUsed;
      
      // حساب الزيارات المتبقية
      let nextDiscountAt: number;
      if (!hasCycle || isExpired) {
        nextDiscountAt = requiredVisits;
      } else if (c.cycleDiscountUsed) {
        nextDiscountAt = requiredVisits;
      } else if (visitsInCycle >= requiredVisits) {
        nextDiscountAt = 0;
      } else {
        nextDiscountAt = requiredVisits - visitsInCycle;
      }

      return {
        customerId: c.id,
        customerName: c.name,
        customerPhone: c.phone,
        totalApprovedVisits: totalApproved,
        discountPercentage: isEligible ? discountPercentage : 0,
        isEligible,
        visitsInCycle,
        nextDiscountAt,
        cycleInfo: {
          startDate: cycleStartDate,
          endDate: cycleEndDate,
          daysRemaining,
          isExpired,
          discountUsed: c.cycleDiscountUsed || false,
        },
      };
    });

  // ترتيب: المؤهلين أولاً، ثم حسب عدد الزيارات
  return results
    .filter(r => r.totalApprovedVisits > 0 || r.visitsInCycle > 0)
    .sort((a, b) => {
      if (a.isEligible && !b.isEligible) return -1;
      if (!a.isEligible && b.isEligible) return 1;
      return b.visitsInCycle - a.visitsInCycle;
    });
}

/**
 * التحقق من خصم عميل برقم الجوال
 * يستخدم في الكاشير للبحث السريع
 * يستخدم نظام الدورة (30 يوم من الزيارة الأولى)
 */
export async function checkLoyaltyDiscountByPhone(phone: string): Promise<{
  found: boolean;
  customer?: {
    id: number;
    name: string;
    phone: string;
  };
  totalApprovedVisits: number;
  isEligibleForDiscount: boolean;
  discountPercentage: number;
  visitsInCycle: number;
  nextDiscountAt: number;
  cycleInfo: {
    startDate: Date | null;
    endDate: Date | null;
    daysRemaining: number;
    isExpired: boolean;
  };
  message: string;
}> {
  const db = await getDb();
  if (!db) return { 
    found: false, 
    totalApprovedVisits: 0,
    isEligibleForDiscount: false,
    discountPercentage: 0,
    visitsInCycle: 0,
    nextDiscountAt: 3,
    cycleInfo: { startDate: null, endDate: null, daysRemaining: 30, isExpired: false },
    message: 'قاعدة البيانات غير متاحة' 
  };

  // البحث عن العميل برقم الجوال
  const customer = await db.select()
    .from(loyaltyCustomers)
    .where(eq(loyaltyCustomers.phone, phone))
    .limit(1);

  if (!customer[0]) {
    return {
      found: false,
      totalApprovedVisits: 0,
      isEligibleForDiscount: false,
      discountPercentage: 0,
      visitsInCycle: 0,
      nextDiscountAt: 3,
      cycleInfo: { startDate: null, endDate: null, daysRemaining: 30, isExpired: false },
      message: 'رقم الجوال غير مسجل في برنامج الولاء',
    };
  }

  // جلب معلومات الخصم مع حالة الدورة
  const discountInfo = await getApprovedVisitsCount(customer[0].id);

  // بناء رسالة مفصلة
  let message: string;
  if (discountInfo.isEligibleForDiscount) {
    message = `🎉 مبروك! العميل مؤهل لخصم ${discountInfo.discountPercentage}%`;
  } else if (discountInfo.cycleInfo.isExpired) {
    message = `انتهت الدورة - يحتاج ${discountInfo.nextDiscountAt} زيارات جديدة للخصم`;
  } else if (!discountInfo.cycleInfo.startDate) {
    message = `عميل جديد - يحتاج ${discountInfo.nextDiscountAt} زيارات للخصم`;
  } else {
    message = `لديه ${discountInfo.visitsInCurrentCycle} زيارات في الدورة - يحتاج ${discountInfo.nextDiscountAt} زيارات إضافية (باقي ${discountInfo.cycleInfo.daysRemaining} يوم)`;
  }

  return {
    found: true,
    customer: {
      id: customer[0].id,
      name: customer[0].name,
      phone: customer[0].phone,
    },
    totalApprovedVisits: discountInfo.totalApproved,
    isEligibleForDiscount: discountInfo.isEligibleForDiscount,
    discountPercentage: discountInfo.discountPercentage,
    visitsInCycle: discountInfo.visitsInCurrentCycle,
    nextDiscountAt: discountInfo.nextDiscountAt,
    cycleInfo: discountInfo.cycleInfo,
    message,
  };
}

/**
 * تسجيل استخدام خصم الولاء في فاتورة
 * يُستخدم لتتبع استخدام الخصومات
 * بعد استخدام الخصم، تبدأ دورة جديدة للعميل
 */
export async function recordLoyaltyDiscountUsage(data: {
  customerId: number;
  invoiceId: number;
  discountPercentage: number;
  discountAmount: number;
  invoiceTotal: number;
  usedBy: number;
  branchId: number;
}): Promise<{ success: boolean; newCycleStarted: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, newCycleStarted: false, error: 'قاعدة البيانات غير متاحة' };

  try {
    // 1. تعليم الخصم كمستخدم في الدورة الحالية
    await markCycleDiscountUsed(data.customerId);
    
    // 2. تحديث إحصائيات العميل
    await db.update(loyaltyCustomers)
      .set({
        totalDiscountsUsed: sql`${loyaltyCustomers.totalDiscountsUsed} + 1`,
      })
      .where(eq(loyaltyCustomers.id, data.customerId));
    
    // 3. بدء دورة جديدة للعميل (بعد استخدام الخصم)
    await startNewLoyaltyCycle(data.customerId);
    
    // 4. تسجيل في سجل النشاط
    await createActivityLog({
      userId: data.usedBy,
      userName: 'نظام الكاشير',
      action: 'create',
      entityType: 'loyalty_discount',
      entityId: data.invoiceId,
      details: `تم تطبيق خصم ولاء ${data.discountPercentage}% (${data.discountAmount} ريال) على فاتورة رقم ${data.invoiceId} للعميل رقم ${data.customerId} - بدأت دورة جديدة`,
    });

    return { success: true, newCycleStarted: true };
  } catch (error) {
    console.error('Error recording loyalty discount usage:', error);
    return { success: false, newCycleStarted: false, error: 'حدث خطأ أثناء تسجيل استخدام الخصم' };
  }
}
