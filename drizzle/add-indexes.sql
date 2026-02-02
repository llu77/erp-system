-- =====================================================
-- Performance Optimization: Database Indexes
-- تحسين الأداء: فهارس قاعدة البيانات
-- =====================================================

-- ==================== جدول المستخدمين ====================
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_branchId ON users(branchId);
CREATE INDEX IF NOT EXISTS idx_users_isActive ON users(isActive);
CREATE INDEX IF NOT EXISTS idx_users_role_isActive ON users(role, isActive);

-- ==================== جدول المنتجات ====================
CREATE INDEX IF NOT EXISTS idx_products_categoryId ON products(categoryId);
CREATE INDEX IF NOT EXISTS idx_products_isActive ON products(isActive);
CREATE INDEX IF NOT EXISTS idx_products_quantity ON products(quantity);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_isActive_quantity ON products(isActive, quantity);

-- ==================== جدول العملاء ====================
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_isActive ON customers(isActive);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name(100));

-- ==================== جدول الموردين ====================
CREATE INDEX IF NOT EXISTS idx_suppliers_isActive ON suppliers(isActive);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name(100));

-- ==================== جدول الفواتير ====================
CREATE INDEX IF NOT EXISTS idx_invoices_customerId ON invoices(customerId);
CREATE INDEX IF NOT EXISTS idx_invoices_branchId ON invoices(branchId);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoiceDate ON invoices(invoiceDate);
CREATE INDEX IF NOT EXISTS idx_invoices_createdBy ON invoices(createdBy);
CREATE INDEX IF NOT EXISTS idx_invoices_branchId_status ON invoices(branchId, status);
CREATE INDEX IF NOT EXISTS idx_invoices_branchId_invoiceDate ON invoices(branchId, invoiceDate);
CREATE INDEX IF NOT EXISTS idx_invoices_status_invoiceDate ON invoices(status, invoiceDate);

-- ==================== جدول تفاصيل الفواتير ====================
CREATE INDEX IF NOT EXISTS idx_invoiceItems_invoiceId ON invoiceItems(invoiceId);
CREATE INDEX IF NOT EXISTS idx_invoiceItems_productId ON invoiceItems(productId);

-- ==================== جدول أوامر الشراء ====================
CREATE INDEX IF NOT EXISTS idx_purchaseOrders_supplierId ON purchaseOrders(supplierId);
CREATE INDEX IF NOT EXISTS idx_purchaseOrders_branchId ON purchaseOrders(branchId);
CREATE INDEX IF NOT EXISTS idx_purchaseOrders_status ON purchaseOrders(status);
CREATE INDEX IF NOT EXISTS idx_purchaseOrders_orderDate ON purchaseOrders(orderDate);
CREATE INDEX IF NOT EXISTS idx_purchaseOrders_branchId_status ON purchaseOrders(branchId, status);

-- ==================== جدول تفاصيل أوامر الشراء ====================
CREATE INDEX IF NOT EXISTS idx_purchaseOrderItems_purchaseOrderId ON purchaseOrderItems(purchaseOrderId);
CREATE INDEX IF NOT EXISTS idx_purchaseOrderItems_productId ON purchaseOrderItems(productId);

-- ==================== جدول المصاريف ====================
CREATE INDEX IF NOT EXISTS idx_expenses_branchId ON expenses(branchId);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_expenseDate ON expenses(expenseDate);
CREATE INDEX IF NOT EXISTS idx_expenses_createdBy ON expenses(createdBy);
CREATE INDEX IF NOT EXISTS idx_expenses_branchId_status ON expenses(branchId, status);
CREATE INDEX IF NOT EXISTS idx_expenses_branchId_expenseDate ON expenses(branchId, expenseDate);
CREATE INDEX IF NOT EXISTS idx_expenses_category_status ON expenses(category, status);

-- ==================== جدول سجل المصاريف ====================
CREATE INDEX IF NOT EXISTS idx_expenseLogs_expenseId ON expenseLogs(expenseId);

-- ==================== جدول الفروع ====================
CREATE INDEX IF NOT EXISTS idx_branches_isActive ON branches(isActive);

-- ==================== جدول طلبات الموظفين ====================
CREATE INDEX IF NOT EXISTS idx_employeeRequests_employeeId ON employeeRequests(employeeId);
CREATE INDEX IF NOT EXISTS idx_employeeRequests_branchId ON employeeRequests(branchId);
CREATE INDEX IF NOT EXISTS idx_employeeRequests_status ON employeeRequests(status);
CREATE INDEX IF NOT EXISTS idx_employeeRequests_requestType ON employeeRequests(requestType);
CREATE INDEX IF NOT EXISTS idx_employeeRequests_createdAt ON employeeRequests(createdAt);
CREATE INDEX IF NOT EXISTS idx_employeeRequests_branchId_status ON employeeRequests(branchId, status);

-- ==================== جدول طلبات المنتجات ====================
CREATE INDEX IF NOT EXISTS idx_productRequests_requestedBy ON productRequests(requestedBy);
CREATE INDEX IF NOT EXISTS idx_productRequests_branchId ON productRequests(branchId);
CREATE INDEX IF NOT EXISTS idx_productRequests_status ON productRequests(status);
CREATE INDEX IF NOT EXISTS idx_productRequests_createdAt ON productRequests(createdAt);

-- ==================== جدول الرواتب ====================
CREATE INDEX IF NOT EXISTS idx_payrolls_employeeId ON payrolls(employeeId);
CREATE INDEX IF NOT EXISTS idx_payrolls_branchId ON payrolls(branchId);
CREATE INDEX IF NOT EXISTS idx_payrolls_status ON payrolls(status);
CREATE INDEX IF NOT EXISTS idx_payrolls_month_year ON payrolls(month, year);
CREATE INDEX IF NOT EXISTS idx_payrolls_branchId_status ON payrolls(branchId, status);

-- ==================== جدول الولاء ====================
CREATE INDEX IF NOT EXISTS idx_loyaltyCustomers_phone ON loyaltyCustomers(phone);
CREATE INDEX IF NOT EXISTS idx_loyaltyCustomers_branchId ON loyaltyCustomers(branchId);
CREATE INDEX IF NOT EXISTS idx_loyaltyVisits_customerId ON loyaltyVisits(customerId);
CREATE INDEX IF NOT EXISTS idx_loyaltyVisits_branchId ON loyaltyVisits(branchId);
CREATE INDEX IF NOT EXISTS idx_loyaltyVisits_visitDate ON loyaltyVisits(visitDate);

-- ==================== جدول POS ====================
CREATE INDEX IF NOT EXISTS idx_posInvoices_branchId ON posInvoices(branchId);
CREATE INDEX IF NOT EXISTS idx_posInvoices_employeeId ON posInvoices(employeeId);
CREATE INDEX IF NOT EXISTS idx_posInvoices_status ON posInvoices(status);
CREATE INDEX IF NOT EXISTS idx_posInvoices_invoiceDate ON posInvoices(invoiceDate);
CREATE INDEX IF NOT EXISTS idx_posInvoices_branchId_status ON posInvoices(branchId, status);
CREATE INDEX IF NOT EXISTS idx_posInvoices_branchId_invoiceDate ON posInvoices(branchId, invoiceDate);

CREATE INDEX IF NOT EXISTS idx_posInvoiceItems_invoiceId ON posInvoiceItems(invoiceId);
CREATE INDEX IF NOT EXISTS idx_posInvoiceItems_serviceId ON posInvoiceItems(serviceId);
CREATE INDEX IF NOT EXISTS idx_posInvoiceItems_employeeId ON posInvoiceItems(employeeId);

-- ==================== جدول الملخص اليومي ====================
CREATE INDEX IF NOT EXISTS idx_posDailySummary_branchId ON posDailySummary(branchId);
CREATE INDEX IF NOT EXISTS idx_posDailySummary_summaryDate ON posDailySummary(summaryDate);
CREATE INDEX IF NOT EXISTS idx_posDailySummary_branchId_summaryDate ON posDailySummary(branchId, summaryDate);

-- ==================== جدول أداء الموظفين ====================
CREATE INDEX IF NOT EXISTS idx_posEmployeePerformance_employeeId ON posEmployeePerformance(employeeId);
CREATE INDEX IF NOT EXISTS idx_posEmployeePerformance_branchId ON posEmployeePerformance(branchId);
CREATE INDEX IF NOT EXISTS idx_posEmployeePerformance_performanceDate ON posEmployeePerformance(performanceDate);

-- ==================== جدول المهام ====================
CREATE INDEX IF NOT EXISTS idx_tasks_assignedTo ON tasks(assignedTo);
CREATE INDEX IF NOT EXISTS idx_tasks_branchId ON tasks(branchId);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_dueDate ON tasks(dueDate);

-- ==================== جدول الإشعارات ====================
CREATE INDEX IF NOT EXISTS idx_notifications_userId ON notifications(userId);
CREATE INDEX IF NOT EXISTS idx_notifications_isRead ON notifications(isRead);
CREATE INDEX IF NOT EXISTS idx_notifications_userId_isRead ON notifications(userId, isRead);
CREATE INDEX IF NOT EXISTS idx_notifications_createdAt ON notifications(createdAt);

-- ==================== جدول سجل التدقيق ====================
CREATE INDEX IF NOT EXISTS idx_auditLogs_userId ON auditLogs(userId);
CREATE INDEX IF NOT EXISTS idx_auditLogs_action ON auditLogs(action);
CREATE INDEX IF NOT EXISTS idx_auditLogs_tableName ON auditLogs(tableName);
CREATE INDEX IF NOT EXISTS idx_auditLogs_createdAt ON auditLogs(createdAt);
