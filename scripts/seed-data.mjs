import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

async function seed() {
  console.log("🌱 بدء إضافة البيانات التجريبية...");
  
  const connection = await mysql.createConnection(DATABASE_URL);
  const db = drizzle(connection);

  try {
    // 1. إضافة الفروع
    console.log("📍 إضافة الفروع...");
    const branches = [
      { name: "Main Branch - Riyadh", nameAr: "الفرع الرئيسي - الرياض", code: "RYD-001", address: "شارع الملك فهد، الرياض", phone: "0112345678", isActive: true },
      { name: "Jeddah Branch", nameAr: "فرع جدة", code: "JED-001", address: "شارع التحلية، جدة", phone: "0123456789", isActive: true },
      { name: "Dammam Branch", nameAr: "فرع الدمام", code: "DMM-001", address: "شارع الملك سعود، الدمام", phone: "0134567890", isActive: true },
      { name: "Makkah Branch", nameAr: "فرع مكة المكرمة", code: "MKH-001", address: "شارع إبراهيم الخليل، مكة", phone: "0125678901", isActive: true },
      { name: "Madinah Branch", nameAr: "فرع المدينة المنورة", code: "MED-001", address: "شارع قباء، المدينة", phone: "0146789012", isActive: true },
    ];

    for (const branch of branches) {
      await connection.execute(
        `INSERT INTO branches (name, nameAr, code, address, phone, isActive, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        [branch.name, branch.nameAr, branch.code, branch.address, branch.phone, branch.isActive]
      );
    }
    console.log("✅ تم إضافة 5 فروع");

    // 2. إضافة الفئات
    console.log("📦 إضافة الفئات...");
    const categories = [
      { name: "إلكترونيات", description: "الأجهزة الإلكترونية والكهربائية" },
      { name: "أثاث مكتبي", description: "الأثاث والمكاتب والكراسي" },
      { name: "قرطاسية", description: "الأدوات المكتبية والقرطاسية" },
      { name: "أجهزة كمبيوتر", description: "أجهزة الحاسب الآلي وملحقاتها" },
      { name: "مستلزمات طباعة", description: "الطابعات والأحبار والورق" },
    ];

    for (const cat of categories) {
      await connection.execute(
        `INSERT INTO categories (name, description, createdAt, updatedAt) 
         VALUES (?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE description = VALUES(description)`,
        [cat.name, cat.description]
      );
    }
    console.log("✅ تم إضافة 5 فئات");

    // الحصول على IDs الفئات
    const [catRows] = await connection.execute("SELECT id, name FROM categories");
    const categoryMap = {};
    catRows.forEach(row => categoryMap[row.name] = row.id);

    // 3. إضافة المنتجات
    console.log("🛍️ إضافة المنتجات...");
    const products = [
      { name: "لابتوب HP ProBook", sku: "HP-PB-001", categoryId: categoryMap["أجهزة كمبيوتر"], sellingPrice: 3500, costPrice: 3000, quantity: 25, minQuantity: 5 },
      { name: "لابتوب Dell Latitude", sku: "DL-LT-001", categoryId: categoryMap["أجهزة كمبيوتر"], sellingPrice: 4200, costPrice: 3600, quantity: 20, minQuantity: 5 },
      { name: "شاشة Samsung 27 بوصة", sku: "SM-MN-001", categoryId: categoryMap["إلكترونيات"], sellingPrice: 1200, costPrice: 950, quantity: 30, minQuantity: 10 },
      { name: "طابعة HP LaserJet", sku: "HP-LJ-001", categoryId: categoryMap["مستلزمات طباعة"], sellingPrice: 1800, costPrice: 1400, quantity: 15, minQuantity: 3 },
      { name: "كرسي مكتبي دوار", sku: "CH-OF-001", categoryId: categoryMap["أثاث مكتبي"], sellingPrice: 450, costPrice: 300, quantity: 50, minQuantity: 10 },
      { name: "مكتب خشبي 120سم", sku: "DK-WD-001", categoryId: categoryMap["أثاث مكتبي"], sellingPrice: 850, costPrice: 600, quantity: 20, minQuantity: 5 },
      { name: "ماوس لاسلكي Logitech", sku: "LG-MS-001", categoryId: categoryMap["أجهزة كمبيوتر"], sellingPrice: 120, costPrice: 80, quantity: 100, minQuantity: 20 },
      { name: "لوحة مفاتيح لاسلكية", sku: "KB-WL-001", categoryId: categoryMap["أجهزة كمبيوتر"], sellingPrice: 180, costPrice: 120, quantity: 80, minQuantity: 15 },
      { name: "حبر طابعة HP أسود", sku: "HP-INK-001", categoryId: categoryMap["مستلزمات طباعة"], sellingPrice: 250, costPrice: 180, quantity: 60, minQuantity: 20 },
      { name: "ورق A4 - 5 رزم", sku: "PP-A4-001", categoryId: categoryMap["قرطاسية"], sellingPrice: 85, costPrice: 60, quantity: 200, minQuantity: 50 },
      { name: "دباسة معدنية كبيرة", sku: "ST-MT-001", categoryId: categoryMap["قرطاسية"], sellingPrice: 35, costPrice: 20, quantity: 100, minQuantity: 20 },
      { name: "مقص مكتبي", sku: "SC-OF-001", categoryId: categoryMap["قرطاسية"], sellingPrice: 15, costPrice: 8, quantity: 150, minQuantity: 30 },
      { name: "USB Flash 32GB", sku: "USB-32-001", categoryId: categoryMap["إلكترونيات"], sellingPrice: 45, costPrice: 25, quantity: 200, minQuantity: 50 },
      { name: "هارد ديسك خارجي 1TB", sku: "HD-EX-001", categoryId: categoryMap["أجهزة كمبيوتر"], sellingPrice: 280, costPrice: 200, quantity: 40, minQuantity: 10 },
      { name: "كابل HDMI 2 متر", sku: "CB-HD-001", categoryId: categoryMap["إلكترونيات"], sellingPrice: 35, costPrice: 20, quantity: 100, minQuantity: 25 },
      { name: "شاحن لابتوب عام", sku: "CH-LP-001", categoryId: categoryMap["إلكترونيات"], sellingPrice: 150, costPrice: 90, quantity: 50, minQuantity: 15 },
      { name: "حامل لابتوب قابل للتعديل", sku: "ST-LP-001", categoryId: categoryMap["أثاث مكتبي"], sellingPrice: 180, costPrice: 120, quantity: 35, minQuantity: 10 },
      { name: "سماعات رأس USB", sku: "HP-USB-001", categoryId: categoryMap["إلكترونيات"], sellingPrice: 220, costPrice: 150, quantity: 45, minQuantity: 10 },
      { name: "كاميرا ويب HD", sku: "WC-HD-001", categoryId: categoryMap["إلكترونيات"], sellingPrice: 350, costPrice: 250, quantity: 30, minQuantity: 8 },
      { name: "ملفات بلاستيكية - 10 قطع", sku: "FL-PL-001", categoryId: categoryMap["قرطاسية"], sellingPrice: 25, costPrice: 15, quantity: 300, minQuantity: 50 },
    ];

    for (const prod of products) {
      await connection.execute(
        `INSERT INTO products (name, sku, categoryId, sellingPrice, costPrice, quantity, minQuantity, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE sellingPrice = VALUES(sellingPrice)`,
        [prod.name, prod.sku, prod.categoryId, prod.sellingPrice, prod.costPrice, prod.quantity, prod.minQuantity]
      );
    }
    console.log("✅ تم إضافة 20 منتج");

    // الحصول على IDs الفروع
    const [branchRows] = await connection.execute("SELECT id, nameAr FROM branches");
    const branchMap = {};
    branchRows.forEach(row => branchMap[row.nameAr] = row.id);

    // 4. إضافة الموظفين
    console.log("👥 إضافة الموظفين...");
    const employees = [
      { name: "أحمد محمد العتيبي", code: "EMP-001", branchId: branchMap["الفرع الرئيسي - الرياض"], position: "supervisor", phone: "0551234567" },
      { name: "محمد عبدالله السعيد", code: "EMP-002", branchId: branchMap["الفرع الرئيسي - الرياض"], position: "employee", phone: "0552345678" },
      { name: "خالد سعد الغامدي", code: "EMP-003", branchId: branchMap["الفرع الرئيسي - الرياض"], position: "employee", phone: "0553456789" },
      { name: "فهد عبدالرحمن القحطاني", code: "EMP-004", branchId: branchMap["فرع جدة"], position: "supervisor", phone: "0554567890" },
      { name: "سعود ناصر الدوسري", code: "EMP-005", branchId: branchMap["فرع جدة"], position: "employee", phone: "0555678901" },
      { name: "عبدالعزيز خالد المالكي", code: "EMP-006", branchId: branchMap["فرع جدة"], position: "employee", phone: "0556789012" },
      { name: "يوسف أحمد الشهري", code: "EMP-007", branchId: branchMap["فرع الدمام"], position: "supervisor", phone: "0557890123" },
      { name: "عمر محمد الزهراني", code: "EMP-008", branchId: branchMap["فرع الدمام"], position: "employee", phone: "0558901234" },
      { name: "ماجد سلطان العنزي", code: "EMP-009", branchId: branchMap["فرع الدمام"], position: "employee", phone: "0559012345" },
      { name: "تركي فيصل الحربي", code: "EMP-010", branchId: branchMap["فرع مكة المكرمة"], position: "supervisor", phone: "0560123456" },
      { name: "بندر عادل السبيعي", code: "EMP-011", branchId: branchMap["فرع مكة المكرمة"], position: "employee", phone: "0561234567" },
      { name: "نايف حمد المطيري", code: "EMP-012", branchId: branchMap["فرع مكة المكرمة"], position: "employee", phone: "0562345678" },
      { name: "راشد علي الشمري", code: "EMP-013", branchId: branchMap["فرع المدينة المنورة"], position: "supervisor", phone: "0563456789" },
      { name: "سلمان يوسف البلوي", code: "EMP-014", branchId: branchMap["فرع المدينة المنورة"], position: "employee", phone: "0564567890" },
      { name: "عبدالله سعيد الرشيدي", code: "EMP-015", branchId: branchMap["فرع المدينة المنورة"], position: "employee", phone: "0565678901" },
    ];

    for (const emp of employees) {
      await connection.execute(
        `INSERT INTO employees (name, code, branchId, position, phone, isActive, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, true, NOW(), NOW())
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        [emp.name, emp.code, emp.branchId, emp.position, emp.phone]
      );
    }
    console.log("✅ تم إضافة 15 موظف");

    // 5. إضافة العملاء
    console.log("🧑‍💼 إضافة العملاء...");
    const customers = [
      { code: "CUS-001", name: "شركة الفجر للتقنية", email: "info@alfajr.com", phone: "0501234567", address: "الرياض، حي العليا" },
      { code: "CUS-002", name: "مؤسسة النور التجارية", email: "sales@alnoor.sa", phone: "0502345678", address: "جدة، حي الروضة" },
      { code: "CUS-003", name: "شركة الأمل للمقاولات", email: "contact@alamal.com", phone: "0503456789", address: "الدمام، حي الفيصلية" },
      { code: "CUS-004", name: "مجموعة السلام القابضة", email: "info@alsalam.com", phone: "0504567890", address: "الرياض، حي الملز" },
      { code: "CUS-005", name: "شركة الرياض للتطوير", email: "dev@riyadh-dev.com", phone: "0505678901", address: "الرياض، حي النخيل" },
      { code: "CUS-006", name: "مؤسسة الخليج للتوريدات", email: "supply@gulf.sa", phone: "0506789012", address: "الدمام، حي الخبر" },
      { code: "CUS-007", name: "شركة المستقبل للتقنية", email: "tech@future.com", phone: "0507890123", address: "جدة، حي الصفا" },
      { code: "CUS-008", name: "مؤسسة البناء الحديث", email: "build@modern.sa", phone: "0508901234", address: "مكة، حي العزيزية" },
      { code: "CUS-009", name: "شركة الوفاء للخدمات", email: "services@wafa.com", phone: "0509012345", address: "المدينة، حي قربان" },
      { code: "CUS-010", name: "مجموعة الإبداع للأعمال", email: "business@ibdaa.sa", phone: "0510123456", address: "الرياض، حي السليمانية" },
    ];

    for (const cust of customers) {
      await connection.execute(
        `INSERT INTO customers (code, name, email, phone, address, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE address = VALUES(address)`,
        [cust.code, cust.name, cust.email, cust.phone, cust.address]
      );
    }
    console.log("✅ تم إضافة 10 عملاء");

    // 6. إضافة الموردين
    console.log("🚚 إضافة الموردين...");
    const suppliers = [
      { code: "SUP-001", name: "شركة HP السعودية", email: "orders@hp.sa", phone: "0112223344", address: "الرياض، المنطقة الصناعية" },
      { code: "SUP-002", name: "موزع Dell المعتمد", email: "sales@dell-sa.com", phone: "0113334455", address: "جدة، حي الصناعية" },
      { code: "SUP-003", name: "مؤسسة الأثاث المكتبي", email: "furniture@office.sa", phone: "0114445566", address: "الرياض، طريق الملك فهد" },
      { code: "SUP-004", name: "شركة القرطاسية المتحدة", email: "stationery@united.com", phone: "0115556677", address: "الدمام، حي الصناعية" },
      { code: "SUP-005", name: "موزع Samsung الرسمي", email: "orders@samsung-sa.com", phone: "0116667788", address: "الرياض، حي الملقا" },
    ];

    for (const sup of suppliers) {
      await connection.execute(
        `INSERT INTO suppliers (code, name, email, phone, address, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE address = VALUES(address)`,
        [sup.code, sup.name, sup.email, sup.phone, sup.address]
      );
    }
    console.log("✅ تم إضافة 5 موردين");

    // الحصول على IDs
    const [customerRows] = await connection.execute("SELECT id FROM customers LIMIT 10");
    const [supplierRows] = await connection.execute("SELECT id FROM suppliers LIMIT 5");
    const [productRows] = await connection.execute("SELECT id, sellingPrice, costPrice FROM products LIMIT 20");

    // 7. إضافة فواتير المبيعات
    console.log("🧾 إضافة فواتير المبيعات...");
    const invoiceStatuses = ["paid", "pending", "paid", "paid", "pending"];
    
    for (let i = 0; i < 10; i++) {
      const customerId = customerRows[i % customerRows.length].id;
      const status = invoiceStatuses[i % invoiceStatuses.length];
      const invoiceNumber = `INV-2024-${String(i + 1).padStart(4, "0")}`;
      
      // حساب المجموع
      const selectedProducts = productRows.slice(i % 5, (i % 5) + 3);
      let subtotal = 0;
      const items = selectedProducts.map((p, idx) => {
        const qty = (idx + 1) * 2;
        subtotal += Number(p.sellingPrice) * qty;
        return { productId: p.id, quantity: qty, unitPrice: Number(p.sellingPrice) };
      });
      
      const tax = subtotal * 0.15;
      const total = subtotal + tax;

      const [invoiceResult] = await connection.execute(
        `INSERT INTO invoices (invoiceNumber, customerId, subtotal, taxAmount, total, status, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY), NOW())
         ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
        [invoiceNumber, customerId, subtotal, tax, total, status, i * 3]
      );

      const invoiceId = invoiceResult.insertId;

      for (const item of items) {
        await connection.execute(
          `INSERT INTO invoiceItems (invoiceId, productId, productName, quantity, unitPrice, total, createdAt) 
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [invoiceId, item.productId, 'منتج', item.quantity, item.unitPrice, item.unitPrice * item.quantity]
        );
      }
    }
    console.log("✅ تم إضافة 10 فواتير مبيعات");

    // 8. إضافة أوامر الشراء
    console.log("📋 إضافة أوامر الشراء...");
    const poStatuses = ["received", "pending", "received", "ordered", "received"];
    
    for (let i = 0; i < 5; i++) {
      const supplierId = supplierRows[i].id;
      const status = poStatuses[i];
      const poNumber = `PO-2024-${String(i + 1).padStart(4, "0")}`;
      
      const selectedProducts = productRows.slice(i * 2, i * 2 + 4);
      let total = 0;
      const items = selectedProducts.map((p, idx) => {
        const qty = (idx + 1) * 5;
        total += Number(p.costPrice) * qty;
        return { productId: p.id, quantity: qty, unitCost: Number(p.costPrice) };
      });

      const [poResult] = await connection.execute(
        `INSERT INTO purchaseOrders (orderNumber, supplierId, subtotal, total, status, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY), NOW())
         ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
        [poNumber, supplierId, total, total, status, i * 5]
      );

      const poId = poResult.insertId;

      for (const item of items) {
        await connection.execute(
          `INSERT INTO purchaseOrderItems (purchaseOrderId, productId, productName, quantity, unitCost, total, createdAt) 
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [poId, item.productId, 'منتج', item.quantity, item.unitCost, item.unitCost * item.quantity]
        );
      }
    }
    console.log("✅ تم إضافة 5 أوامر شراء");

    // 9. إضافة المصاريف
    console.log("💰 إضافة المصاريف...");
    const expenseCategories = ["rent", "utilities", "marketing", "maintenance", "supplies", "transportation"];
    const expenseDescriptions = [
      "إيجار المكتب الشهري",
      "فاتورة الكهرباء",
      "حملة إعلانية على السوشيال ميديا",
      "صيانة أجهزة الكمبيوتر",
      "شراء مستلزمات مكتبية",
      "مصاريف نقل البضائع",
      "فاتورة الإنترنت",
      "صيانة المكيفات",
    ];

    for (let i = 0; i < 8; i++) {
      const category = expenseCategories[i % expenseCategories.length];
      const amount = [5000, 1200, 3500, 800, 500, 1500, 600, 1000][i];
      
      await connection.execute(
        `INSERT INTO expenses (description, amount, category, status, createdAt, updatedAt) 
         VALUES (?, ?, ?, 'approved', DATE_SUB(NOW(), INTERVAL ? DAY), NOW())`,
        [expenseDescriptions[i], amount, category, i * 4]
      );
    }
    console.log("✅ تم إضافة 8 مصاريف");

    // 10. إضافة إيرادات يومية
    console.log("📊 إضافة إيرادات يومية...");
    const [empRows] = await connection.execute("SELECT id, branchId FROM employees WHERE position = 'supervisor'");
    
    for (const emp of empRows) {
      for (let day = 0; day < 7; day++) {
        const amount = 15000 + Math.floor(Math.random() * 10000);
        await connection.execute(
          `INSERT INTO dailyRevenues (branchId, date, amount, enteredBy, createdAt, updatedAt) 
           VALUES (?, DATE_SUB(CURDATE(), INTERVAL ? DAY), ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE amount = VALUES(amount)`,
          [emp.branchId, day, amount, emp.id]
        );
      }
    }
    console.log("✅ تم إضافة إيرادات يومية للأسبوع الماضي");

    console.log("\n🎉 تم إضافة جميع البيانات التجريبية بنجاح!");
    console.log("📊 ملخص البيانات المضافة:");
    console.log("   - 5 فروع");
    console.log("   - 15 موظف");
    console.log("   - 5 فئات");
    console.log("   - 20 منتج");
    console.log("   - 10 عملاء");
    console.log("   - 5 موردين");
    console.log("   - 10 فواتير مبيعات");
    console.log("   - 5 أوامر شراء");
    console.log("   - 8 مصاريف");
    console.log("   - إيرادات يومية لـ 7 أيام");

  } catch (error) {
    console.error("❌ خطأ:", error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

seed().catch(console.error);
