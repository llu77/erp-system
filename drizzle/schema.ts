import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json, date } from "drizzle-orm/mysql-core";

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
  role: mysqlEnum("role", ["admin", "manager", "employee", "supervisor", "viewer"]).default("employee").notNull(),
  branchId: int("branchId"), // الفرع المرتبط بالمستخدم (null = كل الفروع)
  permissions: text("permissions"), // صلاحيات مخصصة (JSON)
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
  branchId: int("branchId"),
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
  branchId: int("branchId"),
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
  email: varchar("email", { length: 255 }),
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
  balanceImages: json("balanceImages").$type<Array<{ url: string; key: string; uploadedAt: string }>>(), // صور الموازنة (متعددة)
  imageVerificationStatus: mysqlEnum("imageVerificationStatus", ["pending", "verified", "needs_reupload", "unclear"]).default("pending"), // حالة التحقق من الصورة
  imageVerificationNote: text("imageVerificationNote"), // ملاحظة التحقق
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
  status: mysqlEnum("status", ["pending", "requested", "approved", "rejected", "paid"]).default("pending").notNull(),
  requestedAt: timestamp("requestedAt"),
  requestedBy: int("requestedBy"),
  approvedAt: timestamp("approvedAt"),
  approvedBy: int("approvedBy"),
  rejectedAt: timestamp("rejectedAt"),
  rejectedBy: int("rejectedBy"),
  rejectionReason: text("rejectionReason"),
  totalAmount: decimal("totalAmount", { precision: 15, scale: 2 }).default("0.00").notNull(),
  
  // حقول تتبع الصرف
  paidAt: timestamp("paidAt"), // تاريخ الصرف الفعلي
  paidBy: int("paidBy"), // من قام بالصرف
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "bank_transfer", "check"]), // طريقة الدفع
  paymentReference: varchar("paymentReference", { length: 255 }), // مرجع الدفع (رقم الحوالة/الشيك)
  paymentNotes: text("paymentNotes"), // ملاحظات الصرف
  
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
  bonusTier: mysqlEnum("bonusTier", ["tier_1", "tier_2", "tier_3", "tier_4", "tier_5", "tier_6", "tier_7", "none"]).notNull(),
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
  
  // حقول تتبع خصم السلف من الراتب
  isDeductedFromSalary: boolean("isDeductedFromSalary").default(false).notNull(), // هل تم خصمها من الراتب
  deductedInPayrollId: int("deductedInPayrollId"), // معرف مسيرة الراتب التي تم الخصم فيها
  deductedAt: timestamp("deductedAt"), // تاريخ الخصم
  
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
  
  // الساعات الإضافية
  overtimeEnabled: boolean("overtimeEnabled").default(false).notNull(),
  overtimeAmount: decimal("overtimeAmount", { precision: 12, scale: 2 }).default("1000.00").notNull(),
  
  // أيام العمل (افتراضي 30 يوم)
  workDays: int("workDays").default(30).notNull(),
  absentDays: int("absentDays").default(0).notNull(),
  absentDeduction: decimal("absentDeduction", { precision: 12, scale: 2 }).default("0.00").notNull(),
  
  // الحوافز
  incentiveAmount: decimal("incentiveAmount", { precision: 12, scale: 2 }).default("0.00").notNull(),
  isSupervisor: boolean("isSupervisor").default(false).notNull(),
  
  // الخصومات
  deductionAmount: decimal("deductionAmount", { precision: 12, scale: 2 }).default("0.00").notNull(),
  deductionReason: text("deductionReason"),
  
  // السلف المخصومة
  advanceDeduction: decimal("advanceDeduction", { precision: 12, scale: 2 }).default("0.00").notNull(),
  
  // الإجازات المعتمدة (من طلبات الموظفين)
  leaveDays: int("leaveDays").default(0).notNull(),
  leaveDeduction: decimal("leaveDeduction", { precision: 12, scale: 2 }).default("0.00").notNull(),
  leaveType: varchar("leaveType", { length: 50 }), // نوع الإجازة: سنوية، مرضية، طارئة، بدون راتب
  leaveDetails: text("leaveDetails"), // تفاصيل الإجازات (JSON: [{startDate, endDate, days, type}])
  
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
    "shop_supplies",      // اغراض محل
    "printing",           // طباعة ورق
    "carpet_cleaning",    // غسيل سجاد
    "small_needs",        // احتياجات بسيطة
    "residency",          // اقامة
    "medical_exam",       // فحص طبي
    "transportation",     // مواصلات
    "electricity",        // كهرباء
    "internet",           // انترنت
    "license_renewal",    // تجديد رخصة
    "visa",               // تاشيره
    "residency_renewal",  // تجديد اقامة
    "health_cert_renewal", // تجديد شهادة صحيه
    "maintenance",        // صيانة
    "health_cert",        // شهادة صحية
    "violation",          // مخالفة
    "emergency",          // طوارىء
    "shop_rent",          // ايجار محل
    "housing_rent",       // ايجار سكن
    "improvements",       // تحسينات
    "bonus",              // مكافأة
    "other"               // أخرى
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

// ==================== جدول إعدادات الشركة ====================
export const companySettings = mysqlTable("company_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value"),
  type: mysqlEnum("type", ["text", "number", "boolean", "json", "image"]).default("text").notNull(),
  category: varchar("category", { length: 50 }).default("general").notNull(),
  description: text("description"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  updatedBy: int("updatedBy"),
});

export type CompanySetting = typeof companySettings.$inferSelect;
export type InsertCompanySetting = typeof companySettings.$inferInsert;

// ==================== جدول محاولات تسجيل الدخول ====================
export const loginAttempts = mysqlTable("loginAttempts", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 100 }).notNull(),
  userId: int("userId"),
  success: boolean("success").default(false).notNull(),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  location: varchar("location", { length: 255 }),
  failureReason: varchar("failureReason", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LoginAttempt = typeof loginAttempts.$inferSelect;
export type InsertLoginAttempt = typeof loginAttempts.$inferInsert;

// ==================== جدول تنبيهات الأمان ====================
export const securityAlerts = mysqlTable("securityAlerts", {
  id: int("id").autoincrement().primaryKey(),
  alertType: mysqlEnum("alertType", [
    "failed_login_attempts",    // محاولات دخول فاشلة متتالية
    "price_change",             // تغيير كبير في الأسعار
    "bulk_delete",              // حذف كميات كبيرة
    "new_location",             // وصول من موقع جديد
    "large_transaction",        // عملية مالية كبيرة
    "unusual_activity",         // نشاط غير معتاد
    "low_stock",                // مخزون منخفض
    "expiring_products"         // منتجات قريبة الانتهاء
  ]).notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  userId: int("userId"),
  userName: varchar("userName", { length: 255 }),
  entityType: varchar("entityType", { length: 50 }),
  entityId: int("entityId"),
  metadata: text("metadata"), // JSON للبيانات الإضافية
  isRead: boolean("isRead").default(false).notNull(),
  isResolved: boolean("isResolved").default(false).notNull(),
  resolvedBy: int("resolvedBy"),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SecurityAlert = typeof securityAlerts.$inferSelect;
export type InsertSecurityAlert = typeof securityAlerts.$inferInsert;

// ==================== جدول سجل تغييرات الأسعار ====================
export const priceChangeLogs = mysqlTable("priceChangeLogs", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  productName: varchar("productName", { length: 255 }).notNull(),
  productSku: varchar("productSku", { length: 50 }),
  priceType: mysqlEnum("priceType", ["cost", "selling"]).notNull(),
  oldPrice: decimal("oldPrice", { precision: 12, scale: 2 }).notNull(),
  newPrice: decimal("newPrice", { precision: 12, scale: 2 }).notNull(),
  changePercentage: decimal("changePercentage", { precision: 8, scale: 2 }).notNull(),
  reason: text("reason"),
  changedBy: int("changedBy").notNull(),
  changedByName: varchar("changedByName", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PriceChangeLog = typeof priceChangeLogs.$inferSelect;
export type InsertPriceChangeLog = typeof priceChangeLogs.$inferInsert;

// ==================== جدول تتبع الدفعات (Batch Tracking) ====================
export const productBatches = mysqlTable("productBatches", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  batchNumber: varchar("batchNumber", { length: 100 }).notNull(),
  quantity: int("quantity").default(0).notNull(),
  remainingQuantity: int("remainingQuantity").default(0).notNull(),
  costPrice: decimal("costPrice", { precision: 12, scale: 2 }).notNull(),
  manufacturingDate: timestamp("manufacturingDate"),
  expiryDate: timestamp("expiryDate"),
  supplierId: int("supplierId"),
  purchaseOrderId: int("purchaseOrderId"),
  receivedDate: timestamp("receivedDate").defaultNow().notNull(),
  status: mysqlEnum("status", ["active", "depleted", "expired", "recalled"]).default("active").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductBatch = typeof productBatches.$inferSelect;
export type InsertProductBatch = typeof productBatches.$inferInsert;

// ==================== جدول الجرد الدوري ====================
export const inventoryCounts = mysqlTable("inventoryCounts", {
  id: int("id").autoincrement().primaryKey(),
  countNumber: varchar("countNumber", { length: 50 }).notNull().unique(),
  branchId: int("branchId"),
  branchName: varchar("branchName", { length: 255 }),
  countDate: timestamp("countDate").notNull(),
  status: mysqlEnum("status", ["draft", "in_progress", "completed", "approved"]).default("draft").notNull(),
  totalProducts: int("totalProducts").default(0).notNull(),
  matchedProducts: int("matchedProducts").default(0).notNull(),
  discrepancyProducts: int("discrepancyProducts").default(0).notNull(),
  totalSystemValue: decimal("totalSystemValue", { precision: 15, scale: 2 }).default("0.00").notNull(),
  totalCountedValue: decimal("totalCountedValue", { precision: 15, scale: 2 }).default("0.00").notNull(),
  varianceValue: decimal("varianceValue", { precision: 15, scale: 2 }).default("0.00").notNull(),
  notes: text("notes"),
  createdBy: int("createdBy").notNull(),
  createdByName: varchar("createdByName", { length: 255 }),
  approvedBy: int("approvedBy"),
  approvedByName: varchar("approvedByName", { length: 255 }),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type InventoryCount = typeof inventoryCounts.$inferSelect;
export type InsertInventoryCount = typeof inventoryCounts.$inferInsert;

// ==================== جدول تفاصيل الجرد ====================
export const inventoryCountItems = mysqlTable("inventoryCountItems", {
  id: int("id").autoincrement().primaryKey(),
  countId: int("countId").notNull(),
  productId: int("productId").notNull(),
  productName: varchar("productName", { length: 255 }).notNull(),
  productSku: varchar("productSku", { length: 50 }),
  systemQuantity: int("systemQuantity").default(0).notNull(),
  monthlyRequired: int("monthlyRequired").default(10).notNull(), // المطلوب شهرياً
  countedQuantity: int("countedQuantity").default(0).notNull(),
  variance: int("variance").default(0).notNull(),
  unitCost: decimal("unitCost", { precision: 12, scale: 2 }).default("0.00").notNull(),
  varianceValue: decimal("varianceValue", { precision: 12, scale: 2 }).default("0.00").notNull(),
  reason: text("reason"),
  status: mysqlEnum("status", ["pending", "counted", "verified"]).default("pending").notNull(),
  countedBy: int("countedBy"),
  countedAt: timestamp("countedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InventoryCountItem = typeof inventoryCountItems.$inferSelect;
export type InsertInventoryCountItem = typeof inventoryCountItems.$inferInsert;

// ==================== جدول الصلاحيات التفصيلية ====================
export const permissions = mysqlTable("permissions", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  nameAr: varchar("nameAr", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = typeof permissions.$inferInsert;

// ==================== جدول صلاحيات المستخدمين ====================
export const userPermissions = mysqlTable("userPermissions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  permissionId: int("permissionId").notNull(),
  grantedBy: int("grantedBy").notNull(),
  grantedAt: timestamp("grantedAt").defaultNow().notNull(),
});

export type UserPermission = typeof userPermissions.$inferSelect;
export type InsertUserPermission = typeof userPermissions.$inferInsert;

// ==================== جدول مؤشرات الأداء المالي ====================
export const financialKpis = mysqlTable("financialKpis", {
  id: int("id").autoincrement().primaryKey(),
  periodType: mysqlEnum("periodType", ["daily", "weekly", "monthly", "quarterly", "yearly"]).notNull(),
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),
  branchId: int("branchId"),
  
  // الإيرادات والمصاريف
  totalRevenue: decimal("totalRevenue", { precision: 15, scale: 2 }).default("0.00").notNull(),
  totalCost: decimal("totalCost", { precision: 15, scale: 2 }).default("0.00").notNull(),
  totalExpenses: decimal("totalExpenses", { precision: 15, scale: 2 }).default("0.00").notNull(),
  
  // الأرباح
  grossProfit: decimal("grossProfit", { precision: 15, scale: 2 }).default("0.00").notNull(),
  netProfit: decimal("netProfit", { precision: 15, scale: 2 }).default("0.00").notNull(),
  
  // هوامش الربح
  grossProfitMargin: decimal("grossProfitMargin", { precision: 8, scale: 4 }).default("0.0000").notNull(),
  netProfitMargin: decimal("netProfitMargin", { precision: 8, scale: 4 }).default("0.0000").notNull(),
  
  // مؤشرات إضافية
  roi: decimal("roi", { precision: 8, scale: 4 }).default("0.0000").notNull(),
  currentRatio: decimal("currentRatio", { precision: 8, scale: 4 }).default("0.0000").notNull(),
  
  // إحصائيات
  invoiceCount: int("invoiceCount").default(0).notNull(),
  customerCount: int("customerCount").default(0).notNull(),
  averageOrderValue: decimal("averageOrderValue", { precision: 12, scale: 2 }).default("0.00").notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FinancialKpi = typeof financialKpis.$inferSelect;
export type InsertFinancialKpi = typeof financialKpis.$inferInsert;

// ==================== جدول أوامر الشراء المقترحة (إعادة الطلب التلقائي) ====================
export const suggestedPurchaseOrders = mysqlTable("suggestedPurchaseOrders", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  productName: varchar("productName", { length: 255 }).notNull(),
  productSku: varchar("productSku", { length: 50 }),
  currentQuantity: int("currentQuantity").default(0).notNull(),
  minQuantity: int("minQuantity").default(0).notNull(),
  suggestedQuantity: int("suggestedQuantity").default(0).notNull(),
  averageConsumption: decimal("averageConsumption", { precision: 12, scale: 2 }).default("0.00").notNull(),
  lastPurchasePrice: decimal("lastPurchasePrice", { precision: 12, scale: 2 }),
  preferredSupplierId: int("preferredSupplierId"),
  preferredSupplierName: varchar("preferredSupplierName", { length: 255 }),
  status: mysqlEnum("status", ["pending", "approved", "ordered", "dismissed"]).default("pending").notNull(),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  purchaseOrderId: int("purchaseOrderId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SuggestedPurchaseOrder = typeof suggestedPurchaseOrders.$inferSelect;
export type InsertSuggestedPurchaseOrder = typeof suggestedPurchaseOrders.$inferInsert;


// ==================== جدول إعدادات الجدولة ====================
export const scheduledTasks = mysqlTable("scheduledTasks", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  taskType: mysqlEnum("taskType", [
    "weekly_report",
    "daily_stock_alert",
    "monthly_profit_report",
    "expiry_alert",
    "large_transaction_alert",
    "backup",
    "custom"
  ]).notNull(),
  
  // إعدادات الجدولة
  isEnabled: boolean("isEnabled").default(true).notNull(),
  cronExpression: varchar("cronExpression", { length: 50 }), // مثل: "0 9 * * 0" للأحد 9 صباحاً
  frequency: mysqlEnum("frequency", ["hourly", "daily", "weekly", "monthly", "custom"]).default("weekly").notNull(),
  dayOfWeek: int("dayOfWeek"), // 0-6 (الأحد-السبت)
  dayOfMonth: int("dayOfMonth"), // 1-31
  hour: int("hour").default(9).notNull(), // 0-23
  minute: int("minute").default(0).notNull(), // 0-59
  
  // إعدادات البريد
  recipientEmails: text("recipientEmails"), // قائمة بريد مفصولة بفاصلة
  emailSubjectPrefix: varchar("emailSubjectPrefix", { length: 100 }),
  
  // إعدادات المراقبة
  thresholdValue: decimal("thresholdValue", { precision: 15, scale: 2 }), // للتنبيهات
  thresholdType: mysqlEnum("thresholdType", ["percentage", "amount", "count"]),
  
  // معلومات التنفيذ
  lastRunAt: timestamp("lastRunAt"),
  nextRunAt: timestamp("nextRunAt"),
  lastRunStatus: mysqlEnum("lastRunStatus", ["success", "failed", "skipped"]),
  lastRunMessage: text("lastRunMessage"),
  runCount: int("runCount").default(0).notNull(),
  failCount: int("failCount").default(0).notNull(),
  
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ScheduledTask = typeof scheduledTasks.$inferSelect;
export type InsertScheduledTask = typeof scheduledTasks.$inferInsert;

// ==================== جدول سجل تنفيذ المهام ====================
export const taskExecutionLogs = mysqlTable("taskExecutionLogs", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  taskName: varchar("taskName", { length: 100 }).notNull(),
  taskType: varchar("taskType", { length: 50 }).notNull(),
  
  status: mysqlEnum("status", ["running", "success", "failed", "cancelled"]).notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  duration: int("duration"), // بالثواني
  
  // تفاصيل التنفيذ
  message: text("message"),
  errorDetails: text("errorDetails"),
  emailsSent: int("emailsSent").default(0),
  recipientList: text("recipientList"),
  
  // بيانات إضافية
  metadata: text("metadata"), // JSON للبيانات الإضافية
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TaskExecutionLog = typeof taskExecutionLogs.$inferSelect;
export type InsertTaskExecutionLog = typeof taskExecutionLogs.$inferInsert;

// ==================== جدول تنبيهات مراقب النظام ====================
export const systemAlerts = mysqlTable("systemAlerts", {
  id: int("id").autoincrement().primaryKey(),
  alertType: mysqlEnum("alertType", [
    "low_stock",
    "expiring_product",
    "large_transaction",
    "failed_login",
    "price_change",
    "system_error",
    "backup_reminder",
    "custom"
  ]).notNull(),
  
  severity: mysqlEnum("severity", ["info", "warning", "critical"]).default("info").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  
  // معلومات الكيان المرتبط
  entityType: varchar("entityType", { length: 50 }), // product, invoice, user, etc.
  entityId: int("entityId"),
  entityName: varchar("entityName", { length: 200 }),
  
  // قيم المراقبة
  currentValue: decimal("currentValue", { precision: 15, scale: 2 }),
  thresholdValue: decimal("thresholdValue", { precision: 15, scale: 2 }),
  
  // حالة التنبيه
  isRead: boolean("isRead").default(false).notNull(),
  isResolved: boolean("isResolved").default(false).notNull(),
  resolvedBy: int("resolvedBy"),
  resolvedAt: timestamp("resolvedAt"),
  resolvedNote: text("resolvedNote"),
  
  // إرسال الإشعارات
  emailSent: boolean("emailSent").default(false).notNull(),
  emailSentAt: timestamp("emailSentAt"),
  notificationSent: boolean("notificationSent").default(false).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SystemAlert = typeof systemAlerts.$inferSelect;
export type InsertSystemAlert = typeof systemAlerts.$inferInsert;

// ==================== جدول إعدادات مراقب النظام ====================
export const monitorSettings = mysqlTable("monitorSettings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 100 }).notNull().unique(),
  settingValue: text("settingValue").notNull(),
  settingType: mysqlEnum("settingType", ["string", "number", "boolean", "json"]).default("string").notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }), // stock, financial, security, etc.
  isEnabled: boolean("isEnabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MonitorSetting = typeof monitorSettings.$inferSelect;
export type InsertMonitorSetting = typeof monitorSettings.$inferInsert;

// ==================== جدول مستلمي الإشعارات ====================
export const notificationRecipients = mysqlTable("notificationRecipients", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  role: mysqlEnum("role", ["admin", "general_supervisor", "branch_supervisor"]).notNull(),
  branchId: int("branchId"), // null للأدمن والمشرف العام (يستقبلون كل الإشعارات)
  branchName: varchar("branchName", { length: 100 }),
  
  // أنواع الإشعارات المفعلة
  receiveRevenueAlerts: boolean("receiveRevenueAlerts").default(true).notNull(),
  receiveExpenseAlerts: boolean("receiveExpenseAlerts").default(true).notNull(),
  receiveMismatchAlerts: boolean("receiveMismatchAlerts").default(true).notNull(),
  receiveInventoryAlerts: boolean("receiveInventoryAlerts").default(true).notNull(),
  receiveMonthlyReminders: boolean("receiveMonthlyReminders").default(true).notNull(),
  receiveRequestNotifications: boolean("receiveRequestNotifications").default(true).notNull(),
  receiveReportNotifications: boolean("receiveReportNotifications").default(true).notNull(),
  receiveBonusNotifications: boolean("receiveBonusNotifications").default(true).notNull(),
  
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type NotificationRecipient = typeof notificationRecipients.$inferSelect;
export type InsertNotificationRecipient = typeof notificationRecipients.$inferInsert;

// ==================== جدول سجل الإشعارات المرسلة ====================
export const sentNotifications = mysqlTable("sentNotifications", {
  id: int("id").autoincrement().primaryKey(),
  recipientId: int("recipientId").notNull(),
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  recipientName: varchar("recipientName", { length: 100 }),
  
  notificationType: mysqlEnum("notificationType", [
    "low_revenue",
    "high_expense", 
    "revenue_mismatch",
    "inventory_low",
    "monthly_reminder",
    "employee_request",
    "product_update",
    "payroll_created",
    "weekly_report",
    "monthly_report",
    "bonus_request",
    "general"
  ]).notNull(),
  
  subject: varchar("subject", { length: 500 }).notNull(),
  bodyArabic: text("bodyArabic").notNull(),
  bodyEnglish: text("bodyEnglish"),
  
  // معلومات الكيان المرتبط
  entityType: varchar("entityType", { length: 50 }),
  entityId: int("entityId"),
  branchId: int("branchId"),
  branchName: varchar("branchName", { length: 100 }),
  
  // حالة الإرسال
  status: mysqlEnum("status", ["pending", "sent", "failed"]).default("pending").notNull(),
  sentAt: timestamp("sentAt"),
  errorMessage: text("errorMessage"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SentNotification = typeof sentNotifications.$inferSelect;
export type InsertSentNotification = typeof sentNotifications.$inferInsert;


// ==================== جدول السجلات المحذوفة ====================
export const deletedRecords = mysqlTable("deletedRecords", {
  id: int("id").autoincrement().primaryKey(),
  
  // معلومات المستخدم الذي قام بالحذف
  deletedByUserId: int("deletedByUserId").notNull(),
  deletedByUserName: varchar("deletedByUserName", { length: 200 }).notNull(),
  
  // نوع السجل المحذوف
  entityType: mysqlEnum("entityType", [
    "purchase_order",
    "expense",
    "revenue",
    "employee",
    "product",
    "supplier",
    "customer",
    "invoice",
    "employee_request",
    "bonus_request"
  ]).notNull(),
  
  // معرف السجل الأصلي
  originalId: int("originalId").notNull(),
  
  // البيانات الكاملة للسجل المحذوف (JSON)
  originalData: text("originalData").notNull(),
  
  // معلومات إضافية
  reason: text("reason"),
  branchId: int("branchId"),
  branchName: varchar("branchName", { length: 100 }),
  
  // تاريخ الحذف
  deletedAt: timestamp("deletedAt").defaultNow().notNull(),
});

export type DeletedRecord = typeof deletedRecords.$inferSelect;
export type InsertDeletedRecord = typeof deletedRecords.$inferInsert;


// ==================== جدول فواتير الموظفين (سالب ومبيعات) ====================
export const employeeInvoices = mysqlTable("employeeInvoices", {
  id: int("id").autoincrement().primaryKey(),
  invoiceNumber: varchar("invoiceNumber", { length: 50 }).notNull().unique(),
  
  // نوع الفاتورة: سالب (خصم على الموظف) أو مبيعات (إيراد)
  type: mysqlEnum("type", ["negative", "sales"]).notNull(),
  
  // معلومات الموظف
  employeeId: int("employeeId").notNull(),
  employeeName: varchar("employeeName", { length: 200 }).notNull(),
  
  // معلومات الفرع
  branchId: int("branchId").notNull(),
  branchName: varchar("branchName", { length: 100 }),
  
  // المبلغ
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  
  // معلومات العميل (لفاتورة السالب)
  customerPhone: varchar("customerPhone", { length: 20 }),
  customerName: varchar("customerName", { length: 200 }),
  
  // ملاحظات
  notes: text("notes"),
  reason: text("reason"), // سبب الفاتورة السالب
  
  // معلومات الإنشاء
  createdBy: int("createdBy").notNull(),
  createdByName: varchar("createdByName", { length: 200 }),
  
  // التواريخ
  invoiceDate: timestamp("invoiceDate").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EmployeeInvoice = typeof employeeInvoices.$inferSelect;
export type InsertEmployeeInvoice = typeof employeeInvoices.$inferInsert;


// ==================== جدول المهام ====================
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  
  // الرقم المرجعي (6 أرقام مميزة)
  referenceNumber: varchar("referenceNumber", { length: 6 }).notNull().unique(),
  
  // معلومات المهمة
  subject: varchar("subject", { length: 255 }).notNull(), // موضوع المهمة
  details: text("details"), // تفاصيل المهمة
  requirement: text("requirement").notNull(), // المطلوب من الموظف
  
  // نوع الاستجابة المطلوبة
  responseType: mysqlEnum("responseType", [
    "file_upload",      // رفع ملف
    "confirmation",     // تأكيد (نعم/لا)
    "text_response",    // رد نصي
    "multiple_files"    // رفع عدة ملفات
  ]).default("file_upload").notNull(),
  
  // خيارات التأكيد (إذا كان نوع الاستجابة confirmation)
  confirmationYesText: varchar("confirmationYesText", { length: 255 }).default("نعم، قمت بذلك"),
  confirmationNoText: varchar("confirmationNoText", { length: 255 }).default("لا، لم أقم بذلك حتى الآن"),
  
  // الفرع المستهدف
  branchId: int("branchId"),
  branchName: varchar("branchName", { length: 255 }),
  
  // الموظف المستهدف
  assignedToId: int("assignedToId").notNull(),
  assignedToName: varchar("assignedToName", { length: 255 }).notNull(),
  assignedToEmail: varchar("assignedToEmail", { length: 320 }),
  
  // الحالة
  status: mysqlEnum("status", [
    "pending",      // في انتظار الرد
    "in_progress",  // تحت المعالجة
    "completed",    // مكتملة
    "cancelled"     // ملغاة
  ]).default("pending").notNull(),
  
  // الاستجابة
  responseText: text("responseText"),
  responseConfirmation: boolean("responseConfirmation"),
  responseFiles: text("responseFiles"), // JSON array of file URLs
  respondedAt: timestamp("respondedAt"),
  
  // تاريخ الاستحقاق
  dueDate: timestamp("dueDate"),
  
  // الأولوية
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium").notNull(),
  
  // المنشئ
  createdBy: int("createdBy").notNull(),
  createdByName: varchar("createdByName", { length: 255 }),
  
  // المرفقات عند إنشاء المهمة
  attachments: text("attachments"), // JSON array of file URLs
  
  // الإشعارات
  emailSent: boolean("emailSent").default(false).notNull(),
  emailSentAt: timestamp("emailSentAt"),
  reminderSent: boolean("reminderSent").default(false).notNull(),
  
  // التواريخ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

// ==================== جدول سجل المهام ====================
export const taskLogs = mysqlTable("taskLogs", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  oldStatus: varchar("oldStatus", { length: 50 }),
  newStatus: varchar("newStatus", { length: 50 }),
  performedBy: int("performedBy"),
  performedByName: varchar("performedByName", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TaskLog = typeof taskLogs.$inferSelect;
export type InsertTaskLog = typeof taskLogs.$inferInsert;


// ==================== جدول عملاء الولاء ====================
/**
 * LoyaltyCustomers - عملاء برنامج الولاء
 */
export const loyaltyCustomers = mysqlTable("loyaltyCustomers", {
  id: int("id").autoincrement().primaryKey(),
  customerId: varchar("customerId", { length: 50 }).notNull().unique(), // معرف فريد للعميل
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull().unique(),
  email: varchar("email", { length: 255 }),
  
  // إحصائيات
  totalVisits: int("totalVisits").default(0).notNull(),
  totalDiscountsUsed: int("totalDiscountsUsed").default(0).notNull(),
  
  // الفرع المسجل فيه
  branchId: int("branchId"),
  branchName: varchar("branchName", { length: 255 }),
  
  // الحالة
  isActive: boolean("isActive").default(true).notNull(),
  
  // دورة الولاء (30 يوم لكل عميل)
  cycleStartDate: timestamp("cycleStartDate"), // تاريخ بداية دورة الـ 30 يوم
  cycleVisitsCount: int("cycleVisitsCount").default(0).notNull(), // عدد الزيارات في الدورة الحالية
  cycleDiscountUsed: boolean("cycleDiscountUsed").default(false).notNull(), // هل تم استخدام الخصم في هذه الدورة
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LoyaltyCustomer = typeof loyaltyCustomers.$inferSelect;
export type InsertLoyaltyCustomer = typeof loyaltyCustomers.$inferInsert;

// ==================== جدول زيارات الولاء ====================
/**
 * LoyaltyVisits - زيارات عملاء الولاء
 */
export const loyaltyVisits = mysqlTable("loyaltyVisits", {
  id: int("id").autoincrement().primaryKey(),
  visitId: varchar("visitId", { length: 50 }).notNull().unique(), // معرف فريد للزيارة
  
  // العميل
  customerId: int("customerId").notNull(),
  customerName: varchar("customerName", { length: 255 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 20 }).notNull(),
  
  // تفاصيل الزيارة
  serviceType: varchar("serviceType", { length: 255 }).notNull(), // نوع الخدمة
  visitDate: timestamp("visitDate").defaultNow().notNull(),
  
  // صورة الفاتورة (إجباري)
  invoiceImageUrl: text("invoiceImageUrl"), // رابط صورة الفاتورة
  invoiceImageKey: varchar("invoiceImageKey", { length: 255 }), // مفتاح الصورة في S3
  
  // الفرع
  branchId: int("branchId"),
  branchName: varchar("branchName", { length: 255 }),
  
  // حالة الموافقة
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(), // حالة الزيارة
  approvedBy: int("approvedBy"), // من وافق على الزيارة
  approvedAt: timestamp("approvedAt"), // تاريخ الموافقة
  rejectionReason: text("rejectionReason"), // سبب الرفض
  
  // الخصم
  isDiscountVisit: boolean("isDiscountVisit").default(false).notNull(), // هل هذه زيارة خصم؟
  discountPercentage: int("discountPercentage").default(0).notNull(), // نسبة الخصم
  
  // رقم الزيارة في الشهر (1, 2, 3, 4...)
  visitNumberInMonth: int("visitNumberInMonth").default(1).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LoyaltyVisit = typeof loyaltyVisits.$inferSelect;
export type InsertLoyaltyVisit = typeof loyaltyVisits.$inferInsert;


// ==================== جدول إعدادات نظام الولاء ====================
/**
 * LoyaltySettings - إعدادات نظام الولاء
 */
export const loyaltySettings = mysqlTable("loyaltySettings", {
  id: int("id").autoincrement().primaryKey(),
  
  // إعدادات الخصم
  requiredVisitsForDiscount: int("requiredVisitsForDiscount").default(3).notNull(), // عدد الزيارات المطلوبة للخصم
  discountPercentage: int("discountPercentage").default(60).notNull(), // نسبة الخصم
  
  // إعدادات أخرى
  isActive: boolean("isActive").default(true).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LoyaltySettings = typeof loyaltySettings.$inferSelect;
export type InsertLoyaltySettings = typeof loyaltySettings.$inferInsert;

// ==================== جدول أنواع خدمات الولاء ====================
/**
 * LoyaltyServiceTypes - أنواع الخدمات في نظام الولاء
 */
export const loyaltyServiceTypes = mysqlTable("loyaltyServiceTypes", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(), // اسم الخدمة
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(), // ترتيب العرض
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LoyaltyServiceType = typeof loyaltyServiceTypes.$inferSelect;
export type InsertLoyaltyServiceType = typeof loyaltyServiceTypes.$inferInsert;

// ==================== جدول سجل تغييرات إعدادات الولاء ====================
/**
 * LoyaltySettingsAuditLog - سجل تغييرات إعدادات نظام الولاء
 */
export const loyaltySettingsAuditLog = mysqlTable("loyaltySettingsAuditLog", {
  id: int("id").autoincrement().primaryKey(),
  
  // المستخدم الذي قام بالتغيير
  userId: int("userId").notNull(),
  userName: varchar("userName", { length: 255 }).notNull(),
  
  // نوع التغيير
  changeType: mysqlEnum("changeType", ["settings", "service_add", "service_update", "service_delete"]).notNull(),
  
  // القيم القديمة والجديدة (JSON)
  oldValues: text("oldValues"), // القيم قبل التغيير
  newValues: text("newValues"), // القيم بعد التغيير
  
  // وصف التغيير
  description: text("description"),
  
  // معرف الخدمة (إذا كان التغيير على خدمة)
  serviceId: int("serviceId"),
  serviceName: varchar("serviceName", { length: 255 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LoyaltySettingsAuditLog = typeof loyaltySettingsAuditLog.$inferSelect;
export type InsertLoyaltySettingsAuditLog = typeof loyaltySettingsAuditLog.$inferInsert;


// ==================== جدول مستويات البونص ====================
/**
 * BonusTierSettings - إعدادات مستويات البونص
 * يسمح للأدمن بتعديل حدود ومبالغ كل مستوى
 */
export const bonusTierSettings = mysqlTable("bonusTierSettings", {
  id: int("id").autoincrement().primaryKey(),
  
  // معرف المستوى
  tierKey: varchar("tierKey", { length: 20 }).notNull().unique(), // tier_1, tier_2, tier_3, tier_4, tier_5
  
  // اسم المستوى
  tierName: varchar("tierName", { length: 100 }).notNull(), // المستوى 1, المستوى 2, ...
  
  // الحد الأدنى للإيراد
  minRevenue: decimal("minRevenue", { precision: 10, scale: 2 }).notNull(),
  
  // الحد الأقصى للإيراد (null للمستوى الأعلى)
  maxRevenue: decimal("maxRevenue", { precision: 10, scale: 2 }),
  
  // مبلغ البونص
  bonusAmount: decimal("bonusAmount", { precision: 10, scale: 2 }).notNull(),
  
  // لون المستوى للعرض
  color: varchar("color", { length: 20 }).default("gray").notNull(),
  
  // ترتيب العرض
  sortOrder: int("sortOrder").default(0).notNull(),
  
  // هل المستوى نشط
  isActive: boolean("isActive").default(true).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BonusTierSetting = typeof bonusTierSettings.$inferSelect;
export type InsertBonusTierSetting = typeof bonusTierSettings.$inferInsert;

// ==================== سجل تغييرات مستويات البونص ====================
/**
 * BonusTierAuditLog - سجل تغييرات إعدادات مستويات البونص
 */
export const bonusTierAuditLog = mysqlTable("bonusTierAuditLog", {
  id: int("id").autoincrement().primaryKey(),
  
  // المستخدم الذي قام بالتغيير
  userId: int("userId").notNull(),
  userName: varchar("userName", { length: 255 }).notNull(),
  
  // المستوى المتأثر
  tierId: int("tierId"),
  tierKey: varchar("tierKey", { length: 20 }),
  
  // نوع التغيير
  changeType: mysqlEnum("changeType", ["create", "update", "delete"]).notNull(),
  
  // القيم القديمة والجديدة (JSON)
  oldValues: text("oldValues"),
  newValues: text("newValues"),
  
  // وصف التغيير
  description: text("description"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BonusTierAuditLog = typeof bonusTierAuditLog.$inferSelect;
export type InsertBonusTierAuditLog = typeof bonusTierAuditLog.$inferInsert;


// ==================== جدول سندات القبض ====================
/**
 * ReceiptVouchers - سندات القبض (وثائق مالية رسمية)
 */
export const receiptVouchers = mysqlTable("receiptVouchers", {
  id: int("id").autoincrement().primaryKey(),
  
  // معرف السند
  voucherId: varchar("voucherId", { length: 50 }).notNull().unique(), // RV-2026-001
  
  // بيانات المستند
  voucherDate: date("voucherDate").notNull(),
  dueDate: date("dueDate"),
  
  // بيانات المدفوع له
  payeeName: varchar("payeeName", { length: 255 }).notNull(),
  payeeAddress: text("payeeAddress"),
  payeePhone: varchar("payeePhone", { length: 20 }),
  payeeEmail: varchar("payeeEmail", { length: 320 }),
  
  // بيانات الفرع
  branchId: int("branchId"),
  branchName: varchar("branchName", { length: 100 }),
  
  // الوصف العام
  description: text("description"),
  
  // الملاحظات
  notes: text("notes"),
  
  // المجموع
  totalAmount: decimal("totalAmount", { precision: 12, scale: 2 }).default('0').notNull(),
  
  // حالة السند
  status: mysqlEnum("status", ["draft", "approved", "paid", "cancelled"]).default("draft").notNull(),
  
  // بيانات الموافقة
  approvedBy: int("approvedBy"),
  approvedByName: varchar("approvedByName", { length: 255 }),
  approvedAt: timestamp("approvedAt"),
  
  // بيانات الدفع
  paidBy: int("paidBy"),
  paidByName: varchar("paidByName", { length: 255 }),
  paidAt: timestamp("paidAt"),
  
  // معرفات التوقيع
  signedBy1: varchar("signedBy1", { length: 255 }), // سالم الوادعي
  signedBy2: varchar("signedBy2", { length: 255 }), // عمر المطيري
  
  // المستخدم الذي أنشأ السند
  createdBy: int("createdBy").notNull(),
  createdByName: varchar("createdByName", { length: 255 }).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ReceiptVoucher = typeof receiptVouchers.$inferSelect;
export type InsertReceiptVoucher = typeof receiptVouchers.$inferInsert;

// ==================== جدول بنود سندات القبض ====================
/**
 * ReceiptVoucherItems - بنود سند القبض
 */
export const receiptVoucherItems = mysqlTable("receiptVoucherItems", {
  id: int("id").autoincrement().primaryKey(),
  
  // معرف السند الأب
  voucherId: int("voucherId").notNull(),
  
  // رقم البند
  itemNumber: int("itemNumber").notNull(),
  
  // وصف البند
  description: varchar("description", { length: 500 }).notNull(),
  
  // المبلغ
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  
  // الملاحظات
  notes: text("notes"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ReceiptVoucherItem = typeof receiptVoucherItems.$inferSelect;
export type InsertReceiptVoucherItem = typeof receiptVoucherItems.$inferInsert;


// ==================== جدول التقارير المحفوظة ====================
export const savedReports = mysqlTable("savedReports", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  createdBy: int("createdBy").notNull(),
  config: json("config").notNull(), // إعدادات التقرير
  isPublic: boolean("isPublic").default(false).notNull(),
  category: varchar("category", { length: 50 }), // sales, inventory, hr, finance
  lastRunAt: timestamp("lastRunAt"),
  runCount: int("runCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SavedReport = typeof savedReports.$inferSelect;
export type InsertSavedReport = typeof savedReports.$inferInsert;

// ==================== جدول جدولة التقارير ====================
export const reportSchedules = mysqlTable("reportSchedules", {
  id: int("id").autoincrement().primaryKey(),
  reportId: int("reportId").notNull(),
  scheduleType: mysqlEnum("scheduleType", ["daily", "weekly", "monthly"]).notNull(),
  scheduleTime: varchar("scheduleTime", { length: 10 }).notNull(), // HH:MM
  scheduleDay: int("scheduleDay"), // يوم الأسبوع (0-6) أو الشهر (1-31)
  recipients: json("recipients").notNull(), // قائمة البريد الإلكتروني
  format: mysqlEnum("format", ["pdf", "excel", "csv"]).default("pdf").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  lastRunAt: timestamp("lastRunAt"),
  nextRunAt: timestamp("nextRunAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ReportSchedule = typeof reportSchedules.$inferSelect;
export type InsertReportSchedule = typeof reportSchedules.$inferInsert;

// ==================== جدول سجل تشغيل التقارير ====================
export const reportExecutionLogs = mysqlTable("reportExecutionLogs", {
  id: int("id").autoincrement().primaryKey(),
  reportId: int("reportId").notNull(),
  executedBy: int("executedBy"),
  executionType: mysqlEnum("executionType", ["manual", "scheduled"]).notNull(),
  status: mysqlEnum("status", ["success", "failed"]).notNull(),
  durationMs: int("durationMs"),
  rowsReturned: int("rowsReturned"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ReportExecutionLog = typeof reportExecutionLogs.$inferSelect;
export type InsertReportExecutionLog = typeof reportExecutionLogs.$inferInsert;

// ==================== جدول تحليلات AI المحفوظة ====================
export const aiAnalytics = mysqlTable("aiAnalytics", {
  id: int("id").autoincrement().primaryKey(),
  analysisType: mysqlEnum("analysisType", [
    "sales_forecast",
    "customer_segmentation", 
    "anomaly_detection",
    "inventory_optimization",
    "pricing_recommendation",
    "marketing_recommendation"
  ]).notNull(),
  branchId: int("branchId"),
  dateRange: json("dateRange"), // { startDate, endDate }
  results: json("results").notNull(), // نتائج التحليل
  confidence: decimal("confidence", { precision: 5, scale: 2 }), // نسبة الثقة
  isActive: boolean("isActive").default(true).notNull(),
  expiresAt: timestamp("expiresAt"), // تاريخ انتهاء صلاحية التحليل
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiAnalytics = typeof aiAnalytics.$inferSelect;
export type InsertAiAnalytics = typeof aiAnalytics.$inferInsert;

// ==================== جدول توصيات AI ====================
export const aiRecommendations = mysqlTable("aiRecommendations", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", [
    "inventory_reorder",
    "pricing_change",
    "customer_retention",
    "marketing_campaign",
    "staffing",
    "general"
  ]).notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  actionRequired: text("actionRequired"),
  relatedEntityType: varchar("relatedEntityType", { length: 50 }), // product, customer, employee, branch
  relatedEntityId: int("relatedEntityId"),
  metadata: json("metadata"), // بيانات إضافية
  status: mysqlEnum("status", ["pending", "viewed", "actioned", "dismissed"]).default("pending").notNull(),
  viewedBy: int("viewedBy"),
  viewedAt: timestamp("viewedAt"),
  actionedBy: int("actionedBy"),
  actionedAt: timestamp("actionedAt"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiRecommendation = typeof aiRecommendations.$inferSelect;
export type InsertAiRecommendation = typeof aiRecommendations.$inferInsert;

// ==================== جدول لوحات التحكم المخصصة ====================
export const customDashboards = mysqlTable("customDashboards", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  layout: json("layout").notNull(), // تخطيط الـ widgets
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CustomDashboard = typeof customDashboards.$inferSelect;
export type InsertCustomDashboard = typeof customDashboards.$inferInsert;

// ==================== جدول تصنيف العملاء (RFM) ====================
export const customerSegments = mysqlTable("customerSegments", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  recencyScore: int("recencyScore").notNull(), // 1-5
  frequencyScore: int("frequencyScore").notNull(), // 1-5
  monetaryScore: int("monetaryScore").notNull(), // 1-5
  rfmScore: varchar("rfmScore", { length: 10 }).notNull(), // e.g., "555", "111"
  segment: mysqlEnum("segment", [
    "champions",
    "loyal_customers",
    "potential_loyalists",
    "new_customers",
    "promising",
    "need_attention",
    "about_to_sleep",
    "at_risk",
    "cant_lose",
    "hibernating",
    "lost"
  ]).notNull(),
  lastPurchaseDate: timestamp("lastPurchaseDate"),
  totalPurchases: int("totalPurchases").default(0).notNull(),
  totalSpent: decimal("totalSpent", { precision: 12, scale: 2 }).default("0").notNull(),
  avgOrderValue: decimal("avgOrderValue", { precision: 12, scale: 2 }).default("0").notNull(),
  predictedClv: decimal("predictedClv", { precision: 12, scale: 2 }), // Customer Lifetime Value
  churnRisk: decimal("churnRisk", { precision: 5, scale: 2 }), // نسبة خطر الفقدان
  calculatedAt: timestamp("calculatedAt").defaultNow().notNull(),
});

export type CustomerSegment = typeof customerSegments.$inferSelect;
export type InsertCustomerSegment = typeof customerSegments.$inferInsert;


// ==================== جدول طلبات حذف زيارات الولاء ====================
/**
 * LoyaltyVisitDeletionRequests - طلبات حذف زيارات الولاء
 * يتم تقديم طلب الحذف من المشرف ويحتاج موافقة الأدمن
 */
export const loyaltyVisitDeletionRequests = mysqlTable("loyaltyVisitDeletionRequests", {
  id: int("id").autoincrement().primaryKey(),
  
  // الزيارة المطلوب حذفها
  visitId: int("visitId").notNull(), // معرف الزيارة
  
  // معلومات الزيارة (للحفظ التاريخي)
  customerName: varchar("customerName", { length: 255 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 20 }).notNull(),
  serviceType: varchar("serviceType", { length: 255 }),
  visitDate: timestamp("visitDate"),
  branchId: int("branchId"),
  branchName: varchar("branchName", { length: 255 }),
  
  // سبب طلب الحذف
  deletionReason: text("deletionReason").notNull(),
  
  // مقدم الطلب
  requestedBy: int("requestedBy").notNull(), // المستخدم الذي طلب الحذف
  requestedByName: varchar("requestedByName", { length: 255 }),
  requestedAt: timestamp("requestedAt").defaultNow().notNull(),
  
  // حالة الطلب
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  
  // الموافقة/الرفض
  processedBy: int("processedBy"), // الأدمن الذي وافق أو رفض
  processedByName: varchar("processedByName", { length: 255 }),
  processedAt: timestamp("processedAt"),
  adminNotes: text("adminNotes"), // ملاحظات الأدمن
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LoyaltyVisitDeletionRequest = typeof loyaltyVisitDeletionRequests.$inferSelect;
export type InsertLoyaltyVisitDeletionRequest = typeof loyaltyVisitDeletionRequests.$inferInsert;


// ==================== جدول سجل الخصومات ====================
/**
 * LoyaltyDiscountRecords - سجل الخصومات الممنوحة لعملاء الولاء
 * يحفظ كل عملية خصم تمت طباعتها أو منحها
 */
export const loyaltyDiscountRecords = mysqlTable("loyaltyDiscountRecords", {
  id: int("id").autoincrement().primaryKey(),
  
  // معرف السجل الفريد
  recordId: varchar("recordId", { length: 50 }).notNull().unique(), // DR-2026-001
  
  // بيانات العميل
  customerId: int("customerId"), // معرف العميل (إذا كان مسجل)
  customerName: varchar("customerName", { length: 255 }),
  customerPhone: varchar("customerPhone", { length: 20 }),
  
  // بيانات الفرع
  branchId: int("branchId"),
  branchName: varchar("branchName", { length: 255 }),
  
  // تفاصيل الخصم
  originalAmount: decimal("originalAmount", { precision: 12, scale: 2 }).notNull(), // المبلغ الأصلي
  discountPercentage: decimal("discountPercentage", { precision: 5, scale: 2 }).notNull(), // نسبة الخصم (60%)
  discountAmount: decimal("discountAmount", { precision: 12, scale: 2 }).notNull(), // قيمة الخصم
  finalAmount: decimal("finalAmount", { precision: 12, scale: 2 }).notNull(), // المبلغ النهائي
  
  // معرف الزيارة المرتبطة (إذا وجد)
  visitId: int("visitId"),
  
  // هل تم طباعة الإيصال
  isPrinted: boolean("isPrinted").default(false).notNull(),
  printedAt: timestamp("printedAt"),
  
  // المستخدم الذي أجرى العملية
  createdBy: int("createdBy").notNull(),
  createdByName: varchar("createdByName", { length: 255 }).notNull(),
  
  // ملاحظات
  notes: text("notes"),
  
  // التحقق من الأهلية (نظام مكافحة التلاعب)
  isVerified: boolean("isVerified").default(false).notNull(), // هل تم التحقق من أهلية العميل؟
  eligibilityVerified: boolean("eligibilityVerified").default(false).notNull(), // هل العميل مؤهل فعلاً؟
  verificationMethod: varchar("verificationMethod", { length: 50 }), // طريقة التحقق: 'system' | 'manual'
  
  // نظام الذكاء الاصطناعي للكشف عن التلاعب
  aiRiskScore: decimal("aiRiskScore", { precision: 5, scale: 2 }), // درجة المخاطرة (0-100)
  aiRiskLevel: mysqlEnum("aiRiskLevel", ["low", "medium", "high", "critical"]), // مستوى المخاطرة
  aiAnalysisNotes: text("aiAnalysisNotes"), // ملاحظات تحليل الذكاء الاصطناعي
  
  // عدد الزيارات الموافق عليها عند إنشاء الخصم
  approvedVisitsCount: int("approvedVisitsCount"), // عدد الزيارات الموافق عليها
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LoyaltyDiscountRecord = typeof loyaltyDiscountRecords.$inferSelect;
export type InsertLoyaltyDiscountRecord = typeof loyaltyDiscountRecords.$inferInsert;
