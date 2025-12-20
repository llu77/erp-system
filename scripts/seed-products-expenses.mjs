import mysql from 'mysql2/promise';

// المنتجات الجديدة
const products = [
  { name: "بيوتي سستم قطن ابيض اسطواني", price: 4.32 },
  { name: "سبا سستم كريم حمام زيت ارغان", price: 17.5 },
  { name: "الخزامى لصقة انف استخدام مرة واحدة", price: 4.34 },
  { name: "صالون سستم مناشف منعشة لافندر", price: 10.75 },
  { name: "بوندس بودرة تالك للجسم", price: 9.32 },
  { name: "كلير كريم زبده الكاكاو", price: 8.82 },
  { name: "بلاديكس امواس حلاقة ازرق", price: 23.05 },
  { name: "فاتيكا شامبو مع زيوت للحماية من تساقط الشعر", price: 12.21 },
  { name: "فاتيكا كريم شعر للحماية من القشرة بالليمون والشاي واللوز", price: 4.64 },
  { name: "فاتيكا كريم نعومة ولمعان الارغان المغربي", price: 4.64 },
  { name: "فاتيكا كريم قوة ولمعان الحبة السوداء", price: 4.64 },
  { name: "فاتيكا كريم للحماية من تساقط الشعر بالصبار والجرجير والزيتون", price: 9.22 },
  { name: "فاتيكا كريم تصفيف الشعر بجوز الهند للشعر الخفيف", price: 9.22 },
  { name: "بلاتينا ماكسي رول", price: 9.71 },
  { name: "بلاتينا مناديل ورقية ناعمة", price: 34.06 },
  { name: "تي أي تي ماكينة حلاقة شفره", price: 44.87 },
  { name: "صالون سستم طاقية حمام بلاستيك", price: 8.33 },
  { name: "صالون سستم ورق رول رقبة حلاقة", price: 10.75 },
  { name: "حناء اميرة اسود", price: 8 },
  { name: "سكن سستم شمع بابلز حبيبات اسود", price: 37.45 },
  { name: "كمامه علبة اسود", price: 3.34 },
  { name: "قفازات فينيل بدون بودرة سوداء", price: 8.75 },
  { name: "لافمي بيوتي قلم تحديد اللحية", price: 9.53 },
  { name: "هير سستم سيروم خالي من السلفات", price: 16.25 },
  { name: "هوبي كريم للشعر ناعم ولامع", price: 9.83 },
  { name: "توتكس كوزماتيك مثبت شعر الترا استرونج", price: 10.75 },
  { name: "السرتي ماء الورد", price: 4.84 },
  { name: "صالون سستم مريلة بلاستيك استخدام واحد", price: 3.13 },
  { name: "هير سستم اسفنجة للشعر الكيرلي", price: 5 },
  { name: "بيوتي سستم اسفنجة مكياج بنفسجي", price: 8 },
  { name: "ويلا كلستون صبغة شعر", price: 10.59 },
  { name: "هير سستم فرشه شعر خشبي طبي", price: 7 },
];

// بنود المصاريف الجديدة
const expenseCategories = [
  "اغراض محل",
  "طباعة ورق",
  "غسيل سجاد",
  "احتياجات بسيطة",
  "اقامة",
  "فحص طبي",
  "مواصلات",
  "كهرباء",
  "انترنت",
  "تجديد رخصة",
  "تاشيره",
  "تجديد اقامة",
  "تجديد شهادة صحيه",
  "صيانة",
  "شهادة صحية",
  "مخالفة",
  "طوارىء",
  "ايجار محل",
  "ايجار سكن",
  "تحسينات",
  "مكافأة",
];

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    console.log("بدء تحديث قاعدة البيانات...");
    
    // حذف المنتجات القديمة
    console.log("حذف المنتجات القديمة...");
    await connection.execute("DELETE FROM products");
    
    // إضافة المنتجات الجديدة
    console.log("إضافة المنتجات الجديدة...");
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const sku = `PRD-${String(i + 1).padStart(4, '0')}`;
      await connection.execute(
        `INSERT INTO products (sku, name, costPrice, sellingPrice, quantity, minQuantity, unit, isActive) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [sku, product.name, product.price * 0.7, product.price, 100, 10, "قطعة", true]
      );
    }
    console.log(`تم إضافة ${products.length} منتج`);
    
    // حذف الفئات القديمة
    console.log("حذف الفئات القديمة...");
    await connection.execute("DELETE FROM categories");
    
    // إضافة فئة واحدة للمنتجات
    console.log("إضافة فئة منتجات الصالون...");
    await connection.execute(
      `INSERT INTO categories (name, description, isActive) VALUES (?, ?, ?)`,
      ["منتجات الصالون", "منتجات العناية بالشعر والجسم", true]
    );
    
    // حذف بنود المصاريف القديمة
    console.log("حذف بنود المصاريف القديمة...");
    await connection.execute("DELETE FROM expense_categories");
    
    // إضافة بنود المصاريف الجديدة
    console.log("إضافة بنود المصاريف الجديدة...");
    for (const category of expenseCategories) {
      await connection.execute(
        `INSERT INTO expense_categories (name, description, isActive) VALUES (?, ?, ?)`,
        [category, category, true]
      );
    }
    console.log(`تم إضافة ${expenseCategories.length} بند مصاريف`);
    
    console.log("تم تحديث قاعدة البيانات بنجاح!");
    
  } catch (error) {
    console.error("خطأ:", error);
    throw error;
  } finally {
    await connection.end();
  }
}

main();
