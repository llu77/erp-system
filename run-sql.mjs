import mysql from 'mysql2/promise';

const sql = `
-- إنشاء جدول عملاء الولاء
CREATE TABLE IF NOT EXISTS loyalty_customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active',
  notes TEXT,
  total_visits INT DEFAULT 0,
  total_discounts INT DEFAULT 0,
  last_visit_date DATETIME,
  registered_by INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_phone (phone)
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
  is_discount_visit TINYINT(1) DEFAULT 0,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  discount_used TINYINT(1) DEFAULT 0,
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
  program_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- إنشاء جدول أنواع الخدمات
CREATE TABLE IF NOT EXISTS loyalty_service_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
`;

async function runSQL() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    // تنفيذ كل جملة SQL منفصلة
    const statements = sql.split(';').filter(s => s.trim());
    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Executing:', statement.substring(0, 50) + '...');
        await connection.execute(statement);
      }
    }
    
    // إضافة بيانات افتراضية
    console.log('Adding default data...');
    await connection.execute("INSERT IGNORE INTO loyalty_settings (required_visits_for_discount, discount_percentage, program_active) VALUES (4, 50, 1)");
    
    // إضافة عميل اختباري
    await connection.execute("INSERT IGNORE INTO loyalty_customers (name, phone, email, status) VALUES ('عميل اختباري', '0512345678', 'test@example.com', 'active')");
    
    console.log('All tables created successfully!');
    
    // التحقق
    const [tables] = await connection.query("SHOW TABLES LIKE 'loyalty%'");
    console.log('Loyalty tables:', tables);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

runSQL();
