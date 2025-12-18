import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean } from "drizzle-orm/mysql-core";

// ==================== جدول المستخدمين ====================
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(),
  username: varchar("username", { length: 50 }).unique(),
  password: varchar("password", { length: 255 }),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  loginMethod: varchar("loginMethod", { length: 64 }).default("local"),
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


// ==================== جدول الفروع ====================
export const branches = mysqlTable("branches", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  nameAr: varchar("nameAr", { length: 255 }).notNull(),
  address: text("address"),
  phone: varchar("phone", { length: 50 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Branch = typeof branches.$inferSelect;
export type InsertBranch = typeof branches.$inferInsert;

// ==================== جدول الموظفين (للبونص) ====================
export const employees = mysqlTable("employees", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  branchId: int("branchId").notNull(),
  phone: varchar("phone", { length: 50 }),
  position: varchar("position", { length: 100 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = typeof employees.$inferInsert;

// ==================== جدول السجلات الشهرية ====================
export const monthlyRecords = mysqlTable("monthlyRecords", {
  id: int("id").autoincrement().primaryKey(),
  branchId: int("branchId").notNull(),
  year: int("year").notNull(),
  month: int("month").notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  status: mysqlEnum("status", ["active", "closed"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MonthlyRecord = typeof monthlyRecords.$inferSelect;
export type InsertMonthlyRecord = typeof monthlyRecords.$inferInsert;

// ==================== جدول الإيرادات اليومية ====================
export const dailyRevenues = mysqlTable("dailyRevenues", {
  id: int("id").autoincrement().primaryKey(),
  monthlyRecordId: int("monthlyRecordId").notNull(),
  branchId: int("branchId").notNull(),
  date: timestamp("date").notNull(),
  cash: decimal("cash", { precision: 15, scale: 2 }).default("0.00").notNull(),
  network: decimal("network", { precision: 15, scale: 2 }).default("0.00").notNull(),
  balance: decimal("balance", { precision: 15, scale: 2 }).default("0.00").notNull(),
  total: decimal("total", { precision: 15, scale: 2 }).default("0.00").notNull(),
  isMatched: boolean("isMatched").default(true).notNull(),
  unmatchReason: text("unmatchReason"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DailyRevenue = typeof dailyRevenues.$inferSelect;
export type InsertDailyRevenue = typeof dailyRevenues.$inferInsert;

// ==================== جدول إيرادات الموظفين ====================
export const employeeRevenues = mysqlTable("employeeRevenues", {
  id: int("id").autoincrement().primaryKey(),
  dailyRevenueId: int("dailyRevenueId").notNull(),
  employeeId: int("employeeId").notNull(),
  cash: decimal("cash", { precision: 15, scale: 2 }).default("0.00").notNull(),
  network: decimal("network", { precision: 15, scale: 2 }).default("0.00").notNull(),
  total: decimal("total", { precision: 15, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmployeeRevenue = typeof employeeRevenues.$inferSelect;
export type InsertEmployeeRevenue = typeof employeeRevenues.$inferInsert;

// ==================== جدول البونص الأسبوعي ====================
/**
 * Weekly Bonuses - Tracks weekly bonus calculations per branch
 * Week calculation:
 * - Week 1: Days 1-7
 * - Week 2: Days 8-15
 * - Week 3: Days 16-22
 * - Week 4: Days 23-29
 * - Week 5: Days 30-31 (remaining days)
 */
export const weeklyBonuses = mysqlTable("weeklyBonuses", {
  id: int("id").autoincrement().primaryKey(),
  branchId: int("branchId").notNull(),
  weekNumber: int("weekNumber").notNull(), // 1-5
  weekStart: timestamp("weekStart").notNull(),
  weekEnd: timestamp("weekEnd").notNull(),
  month: int("month").notNull(), // 1-12
  year: int("year").notNull(),
  status: mysqlEnum("status", ["pending", "requested", "approved", "rejected"]).default("pending").notNull(),
  requestedAt: timestamp("requestedAt"),
  requestedBy: int("requestedBy"),
  approvedAt: timestamp("approvedAt"),
  approvedBy: int("approvedBy"),
  rejectedAt: timestamp("rejectedAt"),
  rejectedBy: int("rejectedBy"),
  rejectionReason: text("rejectionReason"),
  totalAmount: decimal("totalAmount", { precision: 15, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WeeklyBonus = typeof weeklyBonuses.$inferSelect;
export type InsertWeeklyBonus = typeof weeklyBonuses.$inferInsert;

// ==================== جدول تفاصيل البونص ====================
/**
 * Bonus Details - Individual employee bonus breakdown
 * Bonus tiers:
 * - Tier 5: ≥2400 SAR → 180 SAR
 * - Tier 4: 2100-2399 SAR → 135 SAR
 * - Tier 3: 1800-2099 SAR → 95 SAR
 * - Tier 2: 1500-1799 SAR → 60 SAR
 * - Tier 1: 1200-1499 SAR → 35 SAR
 * - None: <1200 SAR → 0 SAR
 */
export const bonusDetails = mysqlTable("bonusDetails", {
  id: int("id").autoincrement().primaryKey(),
  weeklyBonusId: int("weeklyBonusId").notNull(),
  employeeId: int("employeeId").notNull(),
  weeklyRevenue: decimal("weeklyRevenue", { precision: 15, scale: 2 }).default("0.00").notNull(),
  bonusAmount: decimal("bonusAmount", { precision: 15, scale: 2 }).default("0.00").notNull(),
  bonusTier: mysqlEnum("bonusTier", ["tier_1", "tier_2", "tier_3", "tier_4", "tier_5", "none"]).notNull(),
  isEligible: boolean("isEligible").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BonusDetail = typeof bonusDetails.$inferSelect;
export type InsertBonusDetail = typeof bonusDetails.$inferInsert;

// ==================== جدول سجل البونص ====================
export const bonusAuditLog = mysqlTable("bonusAuditLog", {
  id: int("id").autoincrement().primaryKey(),
  weeklyBonusId: int("weeklyBonusId").notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  oldStatus: varchar("oldStatus", { length: 50 }),
  newStatus: varchar("newStatus", { length: 50 }),
  performedBy: int("performedBy").notNull(),
  performedAt: timestamp("performedAt").defaultNow().notNull(),
  details: text("details"),
});

export type BonusAuditLog = typeof bonusAuditLog.$inferSelect;
export type InsertBonusAuditLog = typeof bonusAuditLog.$inferInsert;

// ==================== جدول سجل النظام ====================
export const systemLogs = mysqlTable("systemLogs", {
  id: int("id").autoincrement().primaryKey(),
  level: mysqlEnum("level", ["info", "warning", "error"]).default("info").notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  message: text("message").notNull(),
  userId: int("userId"),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SystemLog = typeof systemLogs.$inferSelect;
export type InsertSystemLog = typeof systemLogs.$inferInsert;

// ==================== جدول طلبات الموظفين ====================
/**
 * Employee Requests - نظام طلبات الموظفين الشامل
 * أنواع الطلبات:
 * - advance: سلفة مالية
 * - vacation: إجازة
 * - arrears: صرف متأخرات
 * - permission: استئذان
 * - objection: اعتراض على مخالفة
 * - resignation: استقالة
 */
export const employeeRequests = mysqlTable("employeeRequests", {
  id: int("id").autoincrement().primaryKey(),
  requestNumber: varchar("requestNumber", { length: 50 }).notNull().unique(),
  employeeId: int("employeeId").notNull(),
  employeeName: varchar("employeeName", { length: 255 }).notNull(),
  branchId: int("branchId"),
  branchName: varchar("branchName", { length: 255 }),
  
  // نوع الطلب
  requestType: mysqlEnum("requestType", [
    "advance",      // سلفة
    "vacation",     // إجازة
    "arrears",      // صرف متأخرات
    "permission",   // استئذان
    "objection",    // اعتراض على مخالفة
    "resignation"   // استقالة
  ]).notNull(),
  
  // حالة الطلب
  status: mysqlEnum("status", [
    "pending",      // قيد الانتظار
    "approved",     // موافق عليه
    "rejected",     // مرفوض
    "cancelled"     // ملغي
  ]).default("pending").notNull(),
  
  // تفاصيل الطلب العامة
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  
  // حقول خاصة بالسلفة
  advanceAmount: decimal("advanceAmount", { precision: 12, scale: 2 }),
  advanceReason: text("advanceReason"),
  repaymentMethod: varchar("repaymentMethod", { length: 100 }),
  
  // حقول خاصة بالإجازة
  vacationType: varchar("vacationType", { length: 50 }), // سنوية، مرضية، طارئة، بدون راتب
  vacationStartDate: timestamp("vacationStartDate"),
  vacationEndDate: timestamp("vacationEndDate"),
  vacationDays: int("vacationDays"),
  
  // حقول خاصة بصرف المتأخرات
  arrearsAmount: decimal("arrearsAmount", { precision: 12, scale: 2 }),
  arrearsPeriod: varchar("arrearsPeriod", { length: 100 }),
  arrearsDetails: text("arrearsDetails"),
  
  // حقول خاصة بالاستئذان
  permissionDate: timestamp("permissionDate"),
  permissionStartTime: varchar("permissionStartTime", { length: 10 }),
  permissionEndTime: varchar("permissionEndTime", { length: 10 }),
  permissionHours: decimal("permissionHours", { precision: 4, scale: 2 }),
  permissionReason: text("permissionReason"),
  
  // حقول خاصة بالاعتراض
  objectionType: varchar("objectionType", { length: 100 }), // نوع المخالفة
  objectionDate: timestamp("objectionDate"),
  objectionDetails: text("objectionDetails"),
  objectionEvidence: text("objectionEvidence"), // روابط المرفقات
  
  // حقول خاصة بالاستقالة
  resignationDate: timestamp("resignationDate"),
  resignationReason: text("resignationReason"),
  lastWorkingDay: timestamp("lastWorkingDay"),
  noticePeriod: int("noticePeriod"), // فترة الإشعار بالأيام
  
  // حقول الموافقة/الرفض
  reviewedBy: int("reviewedBy"),
  reviewedByName: varchar("reviewedByName", { length: 255 }),
  reviewedAt: timestamp("reviewedAt"),
  reviewNotes: text("reviewNotes"),
  rejectionReason: text("rejectionReason"),
  
  // حقول إضافية
  priority: mysqlEnum("priority", ["low", "normal", "high", "urgent"]).default("normal").notNull(),
  attachments: text("attachments"), // JSON array of attachment URLs
  
  // التتبع
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmployeeRequest = typeof employeeRequests.$inferSelect;
export type InsertEmployeeRequest = typeof employeeRequests.$inferInsert;

// ==================== جدول سجل طلبات الموظفين ====================
export const employeeRequestLogs = mysqlTable("employeeRequestLogs", {
  id: int("id").autoincrement().primaryKey(),
  requestId: int("requestId").notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  oldStatus: varchar("oldStatus", { length: 50 }),
  newStatus: varchar("newStatus", { length: 50 }),
  performedBy: int("performedBy").notNull(),
  performedByName: varchar("performedByName", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmployeeRequestLog = typeof employeeRequestLogs.$inferSelect;
export type InsertEmployeeRequestLog = typeof employeeRequestLogs.$inferInsert;


// ==================== جدول مسيرات الرواتب ====================
/**
 * Payrolls - مسيرات الرواتب الشهرية
 * يتم إنشاؤها في يوم 28 من كل شهر
 */
export const payrolls = mysqlTable("payrolls", {
  id: int("id").autoincrement().primaryKey(),
  payrollNumber: varchar("payrollNumber", { length: 50 }).notNull().unique(),
  branchId: int("branchId").notNull(),
  branchName: varchar("branchName", { length: 255 }).notNull(),
  
  // فترة المسيرة
  year: int("year").notNull(),
  month: int("month").notNull(),
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),
  
  // الإجماليات
  totalBaseSalary: decimal("totalBaseSalary", { precision: 15, scale: 2 }).default("0.00").notNull(),
  totalOvertime: decimal("totalOvertime", { precision: 15, scale: 2 }).default("0.00").notNull(),
  totalIncentives: decimal("totalIncentives", { precision: 15, scale: 2 }).default("0.00").notNull(),
  totalDeductions: decimal("totalDeductions", { precision: 15, scale: 2 }).default("0.00").notNull(),
  totalNetSalary: decimal("totalNetSalary", { precision: 15, scale: 2 }).default("0.00").notNull(),
  employeeCount: int("employeeCount").default(0).notNull(),
  
  // الحالة
  status: mysqlEnum("status", [
    "draft",        // مسودة
    "pending",      // قيد المراجعة
    "approved",     // معتمدة
    "paid",         // مدفوعة
    "cancelled"     // ملغاة
  ]).default("draft").notNull(),
  
  // الموافقة
  approvedBy: int("approvedBy"),
  approvedByName: varchar("approvedByName", { length: 255 }),
  approvedAt: timestamp("approvedAt"),
  paidAt: timestamp("paidAt"),
  
  notes: text("notes"),
  createdBy: int("createdBy").notNull(),
  createdByName: varchar("createdByName", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Payroll = typeof payrolls.$inferSelect;
export type InsertPayroll = typeof payrolls.$inferInsert;

// ==================== جدول تفاصيل الرواتب ====================
/**
 * Payroll Details - تفاصيل راتب كل موظف
 * الراتب الأساسي: 2000 ريال
 * ساعات إضافية: 1000 ريال (إذا مفعل)
 * حوافز المشرف: 400 ريال
 */
export const payrollDetails = mysqlTable("payrollDetails", {
  id: int("id").autoincrement().primaryKey(),
  payrollId: int("payrollId").notNull(),
  employeeId: int("employeeId").notNull(),
  employeeName: varchar("employeeName", { length: 255 }).notNull(),
  employeeCode: varchar("employeeCode", { length: 50 }).notNull(),
  position: varchar("position", { length: 100 }),
  
  // مكونات الراتب
  baseSalary: decimal("baseSalary", { precision: 12, scale: 2 }).default("2000.00").notNull(),
  overtimeAmount: decimal("overtimeAmount", { precision: 12, scale: 2 }).default("0.00").notNull(),
  overtimeEnabled: boolean("overtimeEnabled").default(false).notNull(),
  incentiveAmount: decimal("incentiveAmount", { precision: 12, scale: 2 }).default("0.00").notNull(),
  isSupervisor: boolean("isSupervisor").default(false).notNull(),
  
  // الخصومات
  deductionAmount: decimal("deductionAmount", { precision: 12, scale: 2 }).default("0.00").notNull(),
  deductionReason: text("deductionReason"),
  
  // السلف المخصومة
  advanceDeduction: decimal("advanceDeduction", { precision: 12, scale: 2 }).default("0.00").notNull(),
  
  // الإجمالي
  grossSalary: decimal("grossSalary", { precision: 12, scale: 2 }).default("0.00").notNull(),
  totalDeductions: decimal("totalDeductions", { precision: 12, scale: 2 }).default("0.00").notNull(),
  netSalary: decimal("netSalary", { precision: 12, scale: 2 }).default("0.00").notNull(),
  
  // حالة الدفع
  isPaid: boolean("isPaid").default(false).notNull(),
  paidAt: timestamp("paidAt"),
  paymentMethod: varchar("paymentMethod", { length: 50 }),
  paymentReference: varchar("paymentReference", { length: 100 }),
  
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PayrollDetail = typeof payrollDetails.$inferSelect;
export type InsertPayrollDetail = typeof payrollDetails.$inferInsert;

// ==================== جدول إعدادات الموظفين للرواتب ====================
/**
 * Employee Salary Settings - إعدادات الراتب لكل موظف
 */
export const employeeSalarySettings = mysqlTable("employeeSalarySettings", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employeeId").notNull().unique(),
  
  // الراتب الأساسي (افتراضي 2000)
  baseSalary: decimal("baseSalary", { precision: 12, scale: 2 }).default("2000.00").notNull(),
  
  // الساعات الإضافية
  overtimeEnabled: boolean("overtimeEnabled").default(false).notNull(),
  overtimeRate: decimal("overtimeRate", { precision: 12, scale: 2 }).default("1000.00").notNull(),
  
  // هل هو مشرف (يستحق حوافز 400)
  isSupervisor: boolean("isSupervisor").default(false).notNull(),
  supervisorIncentive: decimal("supervisorIncentive", { precision: 12, scale: 2 }).default("400.00").notNull(),
  
  // خصومات ثابتة
  fixedDeduction: decimal("fixedDeduction", { precision: 12, scale: 2 }).default("0.00").notNull(),
  fixedDeductionReason: text("fixedDeductionReason"),
  
  // معلومات البنك
  bankName: varchar("bankName", { length: 100 }),
  bankAccount: varchar("bankAccount", { length: 50 }),
  iban: varchar("iban", { length: 50 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmployeeSalarySetting = typeof employeeSalarySettings.$inferSelect;
export type InsertEmployeeSalarySetting = typeof employeeSalarySettings.$inferInsert;

// ==================== جدول المصاريف ====================
/**
 * Expenses - المصاريف
 */
export const expenses = mysqlTable("expenses", {
  id: int("id").autoincrement().primaryKey(),
  expenseNumber: varchar("expenseNumber", { length: 50 }).notNull().unique(),
  
  // التصنيف
  category: mysqlEnum("category", [
    "operational",   // تشغيلية
    "administrative", // إدارية
    "marketing",     // تسويقية
    "maintenance",   // صيانة
    "utilities",     // مرافق (كهرباء، ماء، إنترنت)
    "rent",          // إيجار
    "salaries",      // رواتب
    "supplies",      // مستلزمات
    "transportation", // نقل ومواصلات
    "other"          // أخرى
  ]).notNull(),
  
  // التفاصيل
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  
  // الفرع (اختياري)
  branchId: int("branchId"),
  branchName: varchar("branchName", { length: 255 }),
  
  // تاريخ المصروف
  expenseDate: timestamp("expenseDate").notNull(),
  
  // طريقة الدفع
  paymentMethod: mysqlEnum("paymentMethod", [
    "cash",          // نقدي
    "bank_transfer", // تحويل بنكي
    "check",         // شيك
    "credit_card",   // بطاقة ائتمان
    "other"          // أخرى
  ]).default("cash").notNull(),
  paymentReference: varchar("paymentReference", { length: 100 }),
  
  // المورد (اختياري)
  supplierId: int("supplierId"),
  supplierName: varchar("supplierName", { length: 255 }),
  
  // المرفقات
  attachments: text("attachments"), // JSON array
  receiptNumber: varchar("receiptNumber", { length: 100 }),
  
  // الحالة
  status: mysqlEnum("status", [
    "pending",    // قيد المراجعة
    "approved",   // معتمد
    "rejected",   // مرفوض
    "paid"        // مدفوع
  ]).default("pending").notNull(),
  
  // الموافقة
  approvedBy: int("approvedBy"),
  approvedByName: varchar("approvedByName", { length: 255 }),
  approvedAt: timestamp("approvedAt"),
  rejectionReason: text("rejectionReason"),
  
  // التتبع
  createdBy: int("createdBy").notNull(),
  createdByName: varchar("createdByName", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = typeof expenses.$inferInsert;

// ==================== جدول سجل المصاريف ====================
export const expenseLogs = mysqlTable("expenseLogs", {
  id: int("id").autoincrement().primaryKey(),
  expenseId: int("expenseId").notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  oldStatus: varchar("oldStatus", { length: 50 }),
  newStatus: varchar("newStatus", { length: 50 }),
  performedBy: int("performedBy").notNull(),
  performedByName: varchar("performedByName", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ExpenseLog = typeof expenseLogs.$inferSelect;
export type InsertExpenseLog = typeof expenseLogs.$inferInsert;
