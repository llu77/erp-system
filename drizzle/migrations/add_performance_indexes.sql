-- =====================================================
-- فهارس تحسين الأداء لنظام ERP
-- تاريخ الإنشاء: 2026-01-31
-- الهدف: تحسين أداء الاستعلامات بنسبة 50-80%
-- =====================================================

-- ==================== فهارس جدول الإيرادات ====================
-- فهرس التاريخ - للتقارير اليومية والشهرية
CREATE INDEX IF NOT EXISTS idx_revenues_date ON revenues(date);

-- فهرس الفرع - للفلترة حسب الفرع
CREATE INDEX IF NOT EXISTS idx_revenues_branch_id ON revenues(branchId);

-- فهرس مركب للتقارير الفرعية
CREATE INDEX IF NOT EXISTS idx_revenues_branch_date ON revenues(branchId, date);

-- فهرس المستخدم المنشئ
CREATE INDEX IF NOT EXISTS idx_revenues_created_by ON revenues(createdBy);

-- ==================== فهارس جدول المصروفات ====================
-- فهرس التاريخ
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);

-- فهرس الفرع
CREATE INDEX IF NOT EXISTS idx_expenses_branch_id ON expenses(branchId);

-- فهرس مركب
CREATE INDEX IF NOT EXISTS idx_expenses_branch_date ON expenses(branchId, date);

-- فهرس الفئة
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- ==================== فهارس جدول الفواتير ====================
-- فهرس تاريخ الفاتورة
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoiceDate);

-- فهرس الحالة
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- فهرس العميل
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customerId);

-- فهرس الفرع
CREATE INDEX IF NOT EXISTS idx_invoices_branch_id ON invoices(branchId);

-- فهرس مركب للتقارير
CREATE INDEX IF NOT EXISTS idx_invoices_status_date ON invoices(status, invoiceDate);

-- ==================== فهارس جدول المستخدمين ====================
-- فهرس الفرع
CREATE INDEX IF NOT EXISTS idx_users_branch_id ON users(branchId);

-- فهرس الدور
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- فهرس الحالة
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(isActive);

-- ==================== فهارس جدول سجل النشاط ====================
-- فهرس تاريخ الإنشاء
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activityLogs(createdAt);

-- فهرس المستخدم
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activityLogs(userId);

-- فهرس نوع العملية
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activityLogs(action);

-- ==================== فهارس جدول الولاء ====================
-- فهرس تاريخ الزيارة
CREATE INDEX IF NOT EXISTS idx_loyalty_visits_date ON loyaltyVisits(visitDate);

-- فهرس العميل
CREATE INDEX IF NOT EXISTS idx_loyalty_visits_customer_id ON loyaltyVisits(customerId);

-- فهرس الفرع
CREATE INDEX IF NOT EXISTS idx_loyalty_visits_branch_id ON loyaltyVisits(branchId);

-- فهرس مركب للتقارير الشهرية
CREATE INDEX IF NOT EXISTS idx_loyalty_visits_customer_date ON loyaltyVisits(customerId, visitDate);

-- ==================== فهارس جدول عملاء الولاء ====================
-- فهرس رقم الهاتف
CREATE INDEX IF NOT EXISTS idx_loyalty_customers_phone ON loyaltyCustomers(phone);

-- فهرس الفرع
CREATE INDEX IF NOT EXISTS idx_loyalty_customers_branch_id ON loyaltyCustomers(branchId);

-- ==================== فهارس جدول أوامر الشراء ====================
-- فهرس التاريخ
CREATE INDEX IF NOT EXISTS idx_purchase_orders_date ON purchaseOrders(orderDate);

-- فهرس الحالة
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchaseOrders(status);

-- فهرس الفرع
CREATE INDEX IF NOT EXISTS idx_purchase_orders_branch_id ON purchaseOrders(branchId);

-- ==================== فهارس جدول المنتجات ====================
-- فهرس الفئة
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(categoryId);

-- فهرس الحالة
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(isActive);

-- فهرس الكمية (للتنبيهات)
CREATE INDEX IF NOT EXISTS idx_products_quantity ON products(quantity);

-- ==================== فهارس جدول سندات القبض ====================
-- فهرس التاريخ
CREATE INDEX IF NOT EXISTS idx_receipt_vouchers_date ON receiptVouchers(voucherDate);

-- فهرس الحالة
CREATE INDEX IF NOT EXISTS idx_receipt_vouchers_status ON receiptVouchers(status);

-- فهرس المدفوع له
CREATE INDEX IF NOT EXISTS idx_receipt_vouchers_payee ON receiptVouchers(payeeName);

-- ==================== فهارس جدول الإشعارات ====================
-- فهرس تاريخ الإنشاء
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(createdAt);

-- فهرس المستخدم
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(userId);

-- فهرس حالة القراءة
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(isRead);

-- ==================== فهارس جدول المهام ====================
-- فهرس تاريخ الاستحقاق
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(dueDate);

-- فهرس الحالة
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- فهرس المسؤول
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assignedTo);

-- ==================== فهارس جدول الرواتب ====================
-- فهرس الشهر
CREATE INDEX IF NOT EXISTS idx_payrolls_month ON payrolls(month);

-- فهرس السنة
CREATE INDEX IF NOT EXISTS idx_payrolls_year ON payrolls(year);

-- فهرس الموظف
CREATE INDEX IF NOT EXISTS idx_payrolls_employee_id ON payrolls(employeeId);

-- =====================================================
-- ملاحظة: تشغيل هذا الملف قد يستغرق بضع دقائق
-- حسب حجم البيانات الموجودة في الجداول
-- =====================================================
