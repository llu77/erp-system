/**
 * سكريبت إضافة خدمات الصالون وأقسامها
 * يتم تشغيله مرة واحدة لإضافة البيانات الأولية
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const categories = [
  { name: 'Haircut', nameAr: 'الحلاقة', icon: 'Scissors', color: '#3B82F6', sortOrder: 1 },
  { name: 'Cleaning', nameAr: 'التنظيف', icon: 'Sparkles', color: '#10B981', sortOrder: 2 },
  { name: 'Coloring', nameAr: 'الصبغات', icon: 'Palette', color: '#8B5CF6', sortOrder: 3 },
  { name: 'Treatment', nameAr: 'العلاجات', icon: 'Heart', color: '#EC4899', sortOrder: 4 },
  { name: 'Moroccan Bath', nameAr: 'الحمام المغربي', icon: 'Droplets', color: '#F59E0B', sortOrder: 5 },
  { name: 'Massage', nameAr: 'المساج', icon: 'Hand', color: '#6366F1', sortOrder: 6 },
  { name: 'Extras', nameAr: 'الإضافات', icon: 'Plus', color: '#64748B', sortOrder: 7 },
];

const services = [
  // قسم الحلاقة
  { categoryName: 'Haircut', name: 'Head and Beard Haircut', nameAr: 'حلاقة رأس ودقن', price: 40, sortOrder: 1 },
  { categoryName: 'Haircut', name: 'Head Haircut', nameAr: 'حلاقة رأس', price: 30, sortOrder: 2 },
  { categoryName: 'Haircut', name: 'Beard Haircut', nameAr: 'حلاقة دقن', price: 20, sortOrder: 3 },
  { categoryName: 'Haircut', name: 'Mustache Trim', nameAr: 'حلاقة شنب', price: 10, sortOrder: 4 },
  { categoryName: 'Haircut', name: 'Kids Haircut', nameAr: 'حلاقة أطفال', price: 30, sortOrder: 5 },
  { categoryName: 'Haircut', name: 'French Haircut', nameAr: 'حلاقة فرنسي', price: 35, sortOrder: 6 },
  { categoryName: 'Haircut', name: 'Zero Haircut', nameAr: 'حلاقة صفر', price: 25, sortOrder: 7 },
  { categoryName: 'Haircut', name: 'Skin Fade', nameAr: 'سكن فيد', price: 35, sortOrder: 8 },
  { categoryName: 'Haircut', name: 'Razor Haircut', nameAr: 'حلاقة موس', price: 30, sortOrder: 9 },
  
  // قسم التنظيف
  { categoryName: 'Cleaning', name: 'Facial Cleaning', nameAr: 'تنظيف بشرة', price: 30, sortOrder: 1 },
  { categoryName: 'Cleaning', name: 'Deep Facial Cleaning', nameAr: 'تنظيف بشرة عميق', price: 45, sortOrder: 2 },
  { categoryName: 'Cleaning', name: 'Steam Facial', nameAr: 'تنظيف بشرة بالبخار', price: 40, sortOrder: 3 },
  { categoryName: 'Cleaning', name: 'Ear Cleaning', nameAr: 'تنظيف أذن', price: 10, sortOrder: 4 },
  { categoryName: 'Cleaning', name: 'Nose Cleaning', nameAr: 'تنظيف أنف', price: 10, sortOrder: 5 },
  { categoryName: 'Cleaning', name: 'Black Mask', nameAr: 'ماسك أسود', price: 25, sortOrder: 6 },
  { categoryName: 'Cleaning', name: 'Gold Mask', nameAr: 'ماسك ذهبي', price: 35, sortOrder: 7 },
  
  // قسم الصبغات
  { categoryName: 'Coloring', name: 'Hair Dye', nameAr: 'صبغة شعر', price: 60, sortOrder: 1 },
  { categoryName: 'Coloring', name: 'Beard Dye', nameAr: 'صبغة دقن', price: 30, sortOrder: 2 },
  { categoryName: 'Coloring', name: 'Highlights', nameAr: 'ميش', price: 60, sortOrder: 3 },
  { categoryName: 'Coloring', name: 'Color Removal', nameAr: 'سحب لون', price: 70, sortOrder: 4 },
  { categoryName: 'Coloring', name: 'Hair Toner', nameAr: 'تونر شعر', price: 40, sortOrder: 5 },
  { categoryName: 'Coloring', name: 'Root Touch Up', nameAr: 'صبغة جذور', price: 45, sortOrder: 6 },
  
  // قسم العلاجات
  { categoryName: 'Treatment', name: 'Keratin Treatment', nameAr: 'كيراتين', price: 200, sortOrder: 1 },
  { categoryName: 'Treatment', name: 'Protein Treatment', nameAr: 'بروتين', price: 250, sortOrder: 2 },
  { categoryName: 'Treatment', name: 'Oil Bath', nameAr: 'حمام زيت', price: 40, sortOrder: 3 },
  { categoryName: 'Treatment', name: 'Hair Mask', nameAr: 'ماسك شعر', price: 35, sortOrder: 4 },
  { categoryName: 'Treatment', name: 'Botox Treatment', nameAr: 'بوتكس شعر', price: 180, sortOrder: 5 },
  { categoryName: 'Treatment', name: 'Hair Vitamin', nameAr: 'فيتامين شعر', price: 20, sortOrder: 6 },
  { categoryName: 'Treatment', name: 'Scalp Treatment', nameAr: 'علاج فروة الرأس', price: 50, sortOrder: 7 },
  
  // قسم الحمام المغربي
  { categoryName: 'Moroccan Bath', name: 'Full Moroccan Bath', nameAr: 'حمام مغربي كامل', price: 150, sortOrder: 1 },
  { categoryName: 'Moroccan Bath', name: 'Body Scrub', nameAr: 'تقشير', price: 80, sortOrder: 2 },
  { categoryName: 'Moroccan Bath', name: 'Moroccan Soap', nameAr: 'صابون مغربي', price: 60, sortOrder: 3 },
  { categoryName: 'Moroccan Bath', name: 'Body Wrap', nameAr: 'لف الجسم', price: 100, sortOrder: 4 },
  { categoryName: 'Moroccan Bath', name: 'Steam Room', nameAr: 'غرفة بخار', price: 50, sortOrder: 5 },
  
  // قسم المساج
  { categoryName: 'Massage', name: 'Full Body Massage', nameAr: 'مساج كامل', price: 120, sortOrder: 1 },
  { categoryName: 'Massage', name: 'Back Massage', nameAr: 'مساج ظهر', price: 60, sortOrder: 2 },
  { categoryName: 'Massage', name: 'Head Massage', nameAr: 'مساج رأس', price: 40, sortOrder: 3 },
  { categoryName: 'Massage', name: 'Foot Massage', nameAr: 'مساج قدم', price: 50, sortOrder: 4 },
  { categoryName: 'Massage', name: 'Neck Massage', nameAr: 'مساج رقبة', price: 45, sortOrder: 5 },
  { categoryName: 'Massage', name: 'Thai Massage', nameAr: 'مساج تايلندي', price: 150, sortOrder: 6 },
  
  // قسم الإضافات
  { categoryName: 'Extras', name: 'Ear Wax', nameAr: 'شمع أذن', price: 15, sortOrder: 1 },
  { categoryName: 'Extras', name: 'Nose Wax', nameAr: 'شمع أنف', price: 15, sortOrder: 2 },
  { categoryName: 'Extras', name: 'Eyebrow Threading', nameAr: 'تشقير حواجب', price: 25, sortOrder: 3 },
  { categoryName: 'Extras', name: 'Face Wax', nameAr: 'شمع وجه', price: 20, sortOrder: 4 },
  { categoryName: 'Extras', name: 'Eyebrow Shaping', nameAr: 'تحديد حواجب', price: 15, sortOrder: 5 },
  { categoryName: 'Extras', name: 'Hot Towel', nameAr: 'فوطة ساخنة', price: 10, sortOrder: 6 },
  { categoryName: 'Extras', name: 'Aftershave', nameAr: 'أفتر شيف', price: 5, sortOrder: 7 },
];

async function seedPosServices() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    console.log('🚀 بدء إضافة الأقسام والخدمات...');
    
    // حذف البيانات القديمة
    await connection.execute('DELETE FROM posServices');
    await connection.execute('DELETE FROM posCategories');
    console.log('✅ تم حذف البيانات القديمة');
    
    // إضافة الأقسام
    const categoryIds = {};
    for (const cat of categories) {
      const [result] = await connection.execute(
        'INSERT INTO posCategories (name, nameAr, icon, color, sortOrder, isActive) VALUES (?, ?, ?, ?, ?, true)',
        [cat.name, cat.nameAr, cat.icon, cat.color, cat.sortOrder]
      );
      categoryIds[cat.name] = result.insertId;
      console.log(`✅ تم إضافة قسم: ${cat.nameAr}`);
    }
    
    // إضافة الخدمات
    for (const svc of services) {
      const categoryId = categoryIds[svc.categoryName];
      await connection.execute(
        'INSERT INTO posServices (categoryId, name, nameAr, price, sortOrder, isActive) VALUES (?, ?, ?, ?, ?, true)',
        [categoryId, svc.name, svc.nameAr, svc.price, svc.sortOrder]
      );
      console.log(`  ✅ تم إضافة خدمة: ${svc.nameAr} - ${svc.price} ر.س`);
    }
    
    console.log('');
    console.log('🎉 تم إضافة جميع الأقسام والخدمات بنجاح!');
    console.log(`📊 الإجمالي: ${categories.length} قسم، ${services.length} خدمة`);
    
  } catch (error) {
    console.error('❌ خطأ:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

seedPosServices();
