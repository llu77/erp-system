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
export async function getDashboardStats() {
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

  // مبيعات الشهر
  const monthlySales = await db.select({ 
    total: sql<string>`COALESCE(SUM(total), 0)`,
    count: sql<number>`COUNT(*)`
  }).from(invoices)
    .where(and(
      gte(invoices.invoiceDate, startOfMonth),
      eq(invoices.status, 'paid')
    ));

  // مبيعات السنة
  const yearlySales = await db.select({ 
    total: sql<string>`COALESCE(SUM(total), 0)` 
  }).from(invoices)
    .where(and(
      gte(invoices.invoiceDate, startOfYear),
      eq(invoices.status, 'paid')
    ));

  // مشتريات الشهر
  const monthlyPurchases = await db.select({ 
    total: sql<string>`COALESCE(SUM(total), 0)`,
    count: sql<number>`COUNT(*)`
  }).from(purchaseOrders)
    .where(and(
      gte(purchaseOrders.orderDate, startOfMonth),
      eq(purchaseOrders.status, 'received')
    ));

  // آخر الفواتير
  const recentInvoices = await db.select().from(invoices)
    .orderBy(desc(invoices.createdAt))
    .limit(5);

  // آخر أوامر الشراء
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
    .where(eq(expenses.category, category as "operational" | "administrative" | "marketing" | "maintenance" | "utilities" | "rent" | "salaries" | "supplies" | "transportation" | "other"))
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
