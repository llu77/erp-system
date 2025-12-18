import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean } from "drizzle-orm/mysql-core";

// ==================== جدول المستخدمين ====================
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["admin", "manager", "employee"]).default("employee").notNull(),
  department: varchar("department", { length: 100 }),
  position: varchar("position", { length: 100 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ==================== جدول الفئات ====================
export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  parentId: int("parentId"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

// ==================== جدول المنتجات ====================
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  sku: varchar("sku", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  categoryId: int("categoryId"),
  costPrice: decimal("costPrice", { precision: 12, scale: 2 }).notNull(),
  sellingPrice: decimal("sellingPrice", { precision: 12, scale: 2 }).notNull(),
  quantity: int("quantity").default(0).notNull(),
  minQuantity: int("minQuantity").default(10).notNull(),
  unit: varchar("unit", { length: 20 }).default("قطعة"),
  barcode: varchar("barcode", { length: 50 }),
  imageUrl: text("imageUrl"),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// ==================== جدول العملاء ====================
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  phone2: varchar("phone2", { length: 20 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  country: varchar("country", { length: 100 }),
  taxNumber: varchar("taxNumber", { length: 50 }),
  creditLimit: decimal("creditLimit", { precision: 12, scale: 2 }).default("0"),
  balance: decimal("balance", { precision: 12, scale: 2 }).default("0"),
  notes: text("notes"),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

// ==================== جدول الموردين ====================
export const suppliers = mysqlTable("suppliers", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  phone2: varchar("phone2", { length: 20 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  country: varchar("country", { length: 100 }),
  taxNumber: varchar("taxNumber", { length: 50 }),
  contactPerson: varchar("contactPerson", { length: 100 }),
  paymentTerms: varchar("paymentTerms", { length: 100 }),
  balance: decimal("balance", { precision: 12, scale: 2 }).default("0"),
  notes: text("notes"),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;

// ==================== جدول فواتير المبيعات ====================
export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  invoiceNumber: varchar("invoiceNumber", { length: 50 }).notNull().unique(),
  customerId: int("customerId"),
  customerName: varchar("customerName", { length: 200 }),
  invoiceDate: timestamp("invoiceDate").defaultNow().notNull(),
  dueDate: timestamp("dueDate"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  taxRate: decimal("taxRate", { precision: 5, scale: 2 }).default("0"),
  taxAmount: decimal("taxAmount", { precision: 12, scale: 2 }).default("0"),
  discountRate: decimal("discountRate", { precision: 5, scale: 2 }).default("0"),
  discountAmount: decimal("discountAmount", { precision: 12, scale: 2 }).default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  paidAmount: decimal("paidAmount", { precision: 12, scale: 2 }).default("0"),
  status: mysqlEnum("status", ["draft", "pending", "paid", "partial", "cancelled"]).default("draft").notNull(),
  paymentMethod: varchar("paymentMethod", { length: 50 }),
  notes: text("notes"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

// ==================== جدول تفاصيل الفواتير ====================
export const invoiceItems = mysqlTable("invoiceItems", {
  id: int("id").autoincrement().primaryKey(),
  invoiceId: int("invoiceId").notNull(),
  productId: int("productId"),
  productName: varchar("productName", { length: 200 }).notNull(),
  productSku: varchar("productSku", { length: 50 }),
  quantity: int("quantity").notNull(),
  unitPrice: decimal("unitPrice", { precision: 12, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 12, scale: 2 }).default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type InsertInvoiceItem = typeof invoiceItems.$inferInsert;

// ==================== جدول أوامر الشراء ====================
export const purchaseOrders = mysqlTable("purchaseOrders", {
  id: int("id").autoincrement().primaryKey(),
  orderNumber: varchar("orderNumber", { length: 50 }).notNull().unique(),
  supplierId: int("supplierId"),
  supplierName: varchar("supplierName", { length: 200 }),
  orderDate: timestamp("orderDate").defaultNow().notNull(),
  expectedDate: timestamp("expectedDate"),
  receivedDate: timestamp("receivedDate"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  taxRate: decimal("taxRate", { precision: 5, scale: 2 }).default("0"),
  taxAmount: decimal("taxAmount", { precision: 12, scale: 2 }).default("0"),
  shippingCost: decimal("shippingCost", { precision: 12, scale: 2 }).default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  paidAmount: decimal("paidAmount", { precision: 12, scale: 2 }).default("0"),
  status: mysqlEnum("status", ["draft", "pending", "approved", "received", "partial", "cancelled"]).default("draft").notNull(),
  paymentStatus: mysqlEnum("paymentStatus", ["unpaid", "partial", "paid"]).default("unpaid").notNull(),
  notes: text("notes"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type InsertPurchaseOrder = typeof purchaseOrders.$inferInsert;

// ==================== جدول تفاصيل أوامر الشراء ====================
export const purchaseOrderItems = mysqlTable("purchaseOrderItems", {
  id: int("id").autoincrement().primaryKey(),
  purchaseOrderId: int("purchaseOrderId").notNull(),
  productId: int("productId"),
  productName: varchar("productName", { length: 200 }).notNull(),
  productSku: varchar("productSku", { length: 50 }),
  quantity: int("quantity").notNull(),
  receivedQuantity: int("receivedQuantity").default(0),
  unitCost: decimal("unitCost", { precision: 12, scale: 2 }).notNull(),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type InsertPurchaseOrderItem = typeof purchaseOrderItems.$inferInsert;

// ==================== جدول الإشعارات ====================
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  type: mysqlEnum("type", ["low_stock", "new_order", "large_sale", "payment_due", "system"]).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  relatedId: int("relatedId"),
  relatedType: varchar("relatedType", { length: 50 }),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ==================== جدول سجل الأنشطة ====================
export const activityLogs = mysqlTable("activityLogs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  userName: varchar("userName", { length: 200 }),
  action: varchar("action", { length: 50 }).notNull(),
  entityType: varchar("entityType", { length: 50 }).notNull(),
  entityId: int("entityId"),
  details: text("details"),
  ipAddress: varchar("ipAddress", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;

// ==================== جدول حركات المخزون ====================
export const inventoryMovements = mysqlTable("inventoryMovements", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  type: mysqlEnum("type", ["in", "out", "adjustment"]).notNull(),
  quantity: int("quantity").notNull(),
  previousQuantity: int("previousQuantity").notNull(),
  newQuantity: int("newQuantity").notNull(),
  referenceType: varchar("referenceType", { length: 50 }),
  referenceId: int("referenceId"),
  notes: text("notes"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type InsertInventoryMovement = typeof inventoryMovements.$inferInsert;
