-- إنشاء جدول عملاء الولاء
CREATE TABLE IF NOT EXISTS loyalty_customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(255),
  status ENUM('active', 'inactive') DEFAULT 'active',
  notes TEXT,
  total_visits INT DEFAULT 0,
  total_discounts INT DEFAULT 0,
  last_visit_date DATETIME,
  registered_by INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- إنشاء جدول زيارات الولاء
CREATE TABLE IF NOT EXISTS loyalty_visits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  customer_name VARCHAR(255),
  customer_phone VARCHAR(20),
  service_type VARCHAR(100),
  branch_id INT,
  branch_name VARCHAR(255),
  visit_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  visit_number_in_month INT DEFAULT 1,
  is_discount_visit BOOLEAN DEFAULT FALSE,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  discount_used BOOLEAN DEFAULT FALSE,
  discount_used_date DATETIME,
  invoice_image_url TEXT,
  invoice_image_key VARCHAR(500),
  notes TEXT,
  recorded_by INT,
  approved_by INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- إنشاء جدول إعدادات الولاء
CREATE TABLE IF NOT EXISTS loyalty_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  required_visits_for_discount INT DEFAULT 4,
  discount_percentage DECIMAL(5,2) DEFAULT 50,
  program_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- إنشاء جدول أنواع الخدمات
CREATE TABLE IF NOT EXISTS loyalty_service_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- إضافة بيانات افتراضية
INSERT IGNORE INTO loyalty_settings (required_visits_for_discount, discount_percentage, program_active) VALUES (4, 50, TRUE);

INSERT IGNORE INTO loyalty_service_types (name, is_active) VALUES 
('حلاقة شعر', TRUE),
('حلاقة ذقن', TRUE),
('قص + حلاقة', TRUE),
('حلاقة رأس + شعر', TRUE),
('صبغة شعر', TRUE),
('علاج شعر', TRUE),
('تنظيف بشرة', TRUE),
('أخرى', TRUE);

-- إضافة عميل اختباري
INSERT IGNORE INTO loyalty_customers (name, phone, email, status) VALUES ('عميل اختباري', '0512345678', 'test@example.com', 'active');
