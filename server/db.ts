import { eq, desc, sql, and, gte, lte, lt, like, or, isNotNull, inArray, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
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
} from "../drizzle/schema";
import { ENV } from './_core/env';

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
  return await db.select().from(purchaseOrders).orderBy(desc(purchaseOrders.createdAt));
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

  const salesData = await db.select({
    date: sql<string>`DATE(invoiceDate)`,
    total: sql<string>`SUM(total)`,
    count: sql<number>`COUNT(*)`
  }).from(invoices)
    .where(and(
      gte(invoices.invoiceDate, startDate),
      lte(invoices.invoiceDate, endDate),
      eq(invoices.status, 'paid')
    ))
    .groupBy(sql`DATE(invoiceDate)`)
    .orderBy(sql`DATE(invoiceDate)`);

  const totalSales = await db.select({
    total: sql<string>`COALESCE(SUM(total), 0)`,
    count: sql<number>`COUNT(*)`
  }).from(invoices)
    .where(and(
      gte(invoices.invoiceDate, startDate),
      lte(invoices.invoiceDate, endDate),
      eq(invoices.status, 'paid')
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

  const purchasesData = await db.select({
    date: sql<string>`DATE(orderDate)`,
    total: sql<string>`SUM(total)`,
    count: sql<number>`COUNT(*)`
  }).from(purchaseOrders)
    .where(and(
      gte(purchaseOrders.orderDate, startDate),
      lte(purchaseOrders.orderDate, endDate),
      eq(purchaseOrders.status, 'received')
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
      eq(purchaseOrders.status, 'received')
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
  return await db.select().from(employees).orderBy(employees.name);
}

export async function getEmployeesByBranch(branchId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(employees)
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
) {
  const db = await getDb();
  if (!db) return;
  
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
  
  // إضافة التفاصيل
  const detailsWithPayrollId = details.map(d => ({
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
    grossSalary: d.grossSalary,
    totalDeductions: d.totalDeductions,
    netSalary: d.netSalary,
  }));
  
  await createPayrollDetails(detailsWithPayrollId);
  
  return newPayroll;
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

  // الحصول على إجمالي المصاريف
  const expensesData = await db.select({
    total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
  }).from(expenses).where(
    and(
      gte(expenses.expenseDate, startDate),
      lte(expenses.expenseDate, endDate),
      eq(expenses.status, 'approved')
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

// حساب إجمالي المصاريف الفعلية
export async function getActualExpenses(startDate: Date, endDate: Date, branchId?: number) {
  const db = await getDb();
  if (!db) return { totalExpenses: 0, expensesCount: 0 };
  
  const conditions = [
    gte(expenses.expenseDate, startDate),
    lte(expenses.expenseDate, endDate),
    eq(expenses.status, 'approved')
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
  
  return await db.select()
    .from(loyaltyVisits)
    .where(and(
      eq(loyaltyVisits.customerId, customerId),
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
  
  // التحقق من استحقاق الخصم (الزيارة الرابعة أو أكثر)
  const isDiscountVisit = visitNumberInMonth >= 4 && (visitNumberInMonth - 1) % 3 === 0;
  const discountPercentage = isDiscountVisit ? 50 : 0;
  
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
    isDiscountVisit,
    discountPercentage,
    visitNumberInMonth,
  });
  
  // تحديث عدد الزيارات للعميل
  if (isDiscountVisit) {
    await db.update(loyaltyCustomers)
      .set({ 
        totalVisits: sql`${loyaltyCustomers.totalVisits} + 1`,
        totalDiscountsUsed: sql`${loyaltyCustomers.totalDiscountsUsed} + 1`
      })
      .where(eq(loyaltyCustomers.id, data.customerId));
  } else {
    await db.update(loyaltyCustomers)
      .set({ 
        totalVisits: sql`${loyaltyCustomers.totalVisits} + 1`
      })
      .where(eq(loyaltyCustomers.id, data.customerId));
  }
  
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
  
  const visits = await db.select({ count: sql<number>`count(*)` })
    .from(loyaltyVisits);
  
  const discounts = await db.select({ count: sql<number>`count(*)` })
    .from(loyaltyVisits)
    .where(eq(loyaltyVisits.isDiscountVisit, true));
  
  const customersThisMonth = await db.select({ count: sql<number>`count(*)` })
    .from(loyaltyCustomers)
    .where(gte(loyaltyCustomers.createdAt, startOfMonth));
  
  const visitsThisMonth = await db.select({ count: sql<number>`count(*)` })
    .from(loyaltyVisits)
    .where(gte(loyaltyVisits.visitDate, startOfMonth));
  
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
  if (!db) return { requiredVisitsForDiscount: 4, discountPercentage: 50 };
  
  const { loyaltySettings } = await import('../drizzle/schema');
  const settings = await db.select().from(loyaltySettings).limit(1);
  
  if (settings.length === 0) {
    // إنشاء إعدادات افتراضية
    await db.insert(loyaltySettings).values({
      requiredVisitsForDiscount: 4,
      discountPercentage: 50,
    });
    return { requiredVisitsForDiscount: 4, discountPercentage: 50 };
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
