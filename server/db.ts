import { eq, desc, sql, and, gte, lte, like, or } from "drizzle-orm";
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
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfYear = new Date(today.getFullYear(), 0, 1);

  // إجمالي المنتجات
  const totalProducts = await db.select({ count: sql<number>`COUNT(*)` }).from(products);
  
  // المنتجات منخفضة المخزون
  const lowStockCount = await db.select({ count: sql<number>`COUNT(*)` }).from(products)
    .where(sql`${products.quantity} <= ${products.minQuantity}`);

  // إجمالي العملاء
  const totalCustomers = await db.select({ count: sql<number>`COUNT(*)` }).from(customers);

  // إجمالي الموردين
  const totalSuppliers = await db.select({ count: sql<number>`COUNT(*)` }).from(suppliers);

  // شروط التصفية حسب الفرع
  const branchCondition = branchId ? eq(invoices.branchId, branchId) : undefined;
  const purchaseBranchCondition = branchId ? eq(purchaseOrders.branchId, branchId) : undefined;

  // مبيعات الشهر
  const monthlySalesConditions = [
    gte(invoices.invoiceDate, startOfMonth),
    eq(invoices.status, 'paid')
  ];
  if (branchCondition) monthlySalesConditions.push(branchCondition);
  
  const monthlySales = await db.select({ 
    total: sql<string>`COALESCE(SUM(total), 0)`,
    count: sql<number>`COUNT(*)`
  }).from(invoices)
    .where(and(...monthlySalesConditions));

  // مبيعات السنة
  const yearlySalesConditions = [
    gte(invoices.invoiceDate, startOfYear),
    eq(invoices.status, 'paid')
  ];
  if (branchCondition) yearlySalesConditions.push(branchCondition);
  
  const yearlySales = await db.select({ 
    total: sql<string>`COALESCE(SUM(total), 0)` 
  }).from(invoices)
    .where(and(...yearlySalesConditions));

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

  // آخر الفواتير
  const recentInvoicesQuery = db.select().from(invoices);
  if (branchId) {
    const recentInvoices = await recentInvoicesQuery
      .where(eq(invoices.branchId, branchId))
      .orderBy(desc(invoices.createdAt))
      .limit(5);
    
    // آخر أوامر الشراء
    const recentPurchases = await db.select().from(purchaseOrders)
      .where(eq(purchaseOrders.branchId, branchId))
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(5);

    return {
      totalProducts: totalProducts[0]?.count || 0,
      lowStockCount: lowStockCount[0]?.count || 0,
      totalCustomers: totalCustomers[0]?.count || 0,
      totalSuppliers: totalSuppliers[0]?.count || 0,
      monthlySales: {
        total: parseFloat(monthlySales[0]?.total || '0'),
        count: monthlySales[0]?.count || 0
      },
      yearlySales: parseFloat(yearlySales[0]?.total || '0'),
      monthlyPurchases: {
        total: parseFloat(monthlyPurchases[0]?.total || '0'),
        count: monthlyPurchases[0]?.count || 0
      },
      recentInvoices,
      recentPurchases,
      branchId
    };
  }

  // آخر الفواتير (بدون تصفية)
  const recentInvoices = await recentInvoicesQuery
    .orderBy(desc(invoices.createdAt))
    .limit(5);

  // آخر أوامر الشراء (بدون تصفية)
  const recentPurchases = await db.select().from(purchaseOrders)
    .orderBy(desc(purchaseOrders.createdAt))
    .limit(5);

  return {
    totalProducts: totalProducts[0]?.count || 0,
    lowStockCount: lowStockCount[0]?.count || 0,
    totalCustomers: totalCustomers[0]?.count || 0,
    totalSuppliers: totalSuppliers[0]?.count || 0,
    monthlySales: {
      total: parseFloat(monthlySales[0]?.total || '0'),
      count: monthlySales[0]?.count || 0
    },
    yearlySales: parseFloat(yearlySales[0]?.total || '0'),
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

// حساب راتب موظف
export function calculateEmployeeSalary(
  baseSalary: number,
  overtimeEnabled: boolean,
  overtimeRate: number,
  isSupervisor: boolean,
  supervisorIncentive: number,
  deductions: number,
  advanceDeduction: number
) {
  const overtime = overtimeEnabled ? overtimeRate : 0;
  const incentive = isSupervisor ? supervisorIncentive : 0;
  
  const grossSalary = baseSalary + overtime + incentive;
  const totalDeductions = deductions + advanceDeduction;
  const netSalary = grossSalary - totalDeductions;
  
  return {
    baseSalary,
    overtimeAmount: overtime,
    incentiveAmount: incentive,
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
    
    const salary = calculateEmployeeSalary(
      parseFloat(settings.baseSalary as string),
      settings.overtimeEnabled as boolean,
      parseFloat(settings.overtimeRate as string),
      settings.isSupervisor as boolean,
      parseFloat(settings.supervisorIncentive as string),
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

export async function getSentNotifications(limit: number = 100) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(sentNotifications)
    .orderBy(desc(sentNotifications.createdAt))
    .limit(limit);
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
