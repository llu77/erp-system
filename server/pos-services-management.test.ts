import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from '../drizzle/schema';
import { eq } from 'drizzle-orm';

/**
 * اختبارات إدارة خدمات الكاشير
 * 
 * هذا الملف يختبر:
 * 1. جلب قائمة الأقسام
 * 2. جلب قائمة الخدمات
 * 3. إضافة قسم جديد
 * 4. إضافة خدمة جديدة
 * 5. تحديث قسم
 * 6. تحديث خدمة
 * 7. حذف خدمة
 * 8. حذف قسم
 */

describe('POS Services Management', () => {
  let connection: mysql.Connection;
  let db: ReturnType<typeof drizzle>;
  
  // بيانات الاختبار
  let testCategoryId: number;
  let testServiceId: number;
  
  beforeAll(async () => {
    // الاتصال بقاعدة البيانات
    connection = await mysql.createConnection(process.env.DATABASE_URL!);
    db = drizzle(connection, { schema, mode: 'default' });
  });
  
  afterAll(async () => {
    // تنظيف بيانات الاختبار
    if (testServiceId) {
      await db.delete(schema.posServices).where(eq(schema.posServices.id, testServiceId));
    }
    if (testCategoryId) {
      await db.delete(schema.posCategories).where(eq(schema.posCategories.id, testCategoryId));
    }
    
    await connection.end();
  });
  
  describe('Categories', () => {
    it('should list all categories', async () => {
      const categories = await db.select().from(schema.posCategories);
      
      expect(Array.isArray(categories)).toBe(true);
      // يجب أن يكون هناك أقسام موجودة مسبقاً
      expect(categories.length).toBeGreaterThan(0);
    });
    
    it('should create a new category', async () => {
      const newCategory = {
        name: 'Test Category',
        nameAr: 'قسم اختبار',
        icon: 'test-icon',
        color: '#ff0000',
        sortOrder: 999,
        isActive: true,
      };
      
      const result = await db.insert(schema.posCategories).values(newCategory);
      testCategoryId = Number(result[0].insertId);
      
      expect(testCategoryId).toBeGreaterThan(0);
      
      // التحقق من إنشاء القسم
      const [created] = await db
        .select()
        .from(schema.posCategories)
        .where(eq(schema.posCategories.id, testCategoryId));
      
      expect(created).toBeDefined();
      expect(created.name).toBe(newCategory.name);
      expect(created.nameAr).toBe(newCategory.nameAr);
      expect(created.color).toBe(newCategory.color);
    });
    
    it('should update a category', async () => {
      const updatedName = 'Updated Test Category';
      const updatedNameAr = 'قسم اختبار محدث';
      
      await db
        .update(schema.posCategories)
        .set({ name: updatedName, nameAr: updatedNameAr })
        .where(eq(schema.posCategories.id, testCategoryId));
      
      const [updated] = await db
        .select()
        .from(schema.posCategories)
        .where(eq(schema.posCategories.id, testCategoryId));
      
      expect(updated.name).toBe(updatedName);
      expect(updated.nameAr).toBe(updatedNameAr);
    });
  });
  
  describe('Services', () => {
    it('should list all services', async () => {
      const services = await db.select().from(schema.posServices);
      
      expect(Array.isArray(services)).toBe(true);
      // يجب أن يكون هناك خدمات موجودة مسبقاً
      expect(services.length).toBeGreaterThan(0);
    });
    
    it('should create a new service', async () => {
      // التأكد من وجود قسم للاختبار
      expect(testCategoryId).toBeGreaterThan(0);
      
      const newService = {
        categoryId: testCategoryId,
        name: 'Test Service',
        nameAr: 'خدمة اختبار',
        description: 'Test service description',
        price: '50.00',
        duration: 30,
        sortOrder: 999,
        isActive: true,
      };
      
      const result = await db.insert(schema.posServices).values(newService);
      testServiceId = Number(result[0].insertId);
      
      expect(testServiceId).toBeGreaterThan(0);
      
      // التحقق من إنشاء الخدمة
      const [created] = await db
        .select()
        .from(schema.posServices)
        .where(eq(schema.posServices.id, testServiceId));
      
      expect(created).toBeDefined();
      expect(created.name).toBe(newService.name);
      expect(created.nameAr).toBe(newService.nameAr);
      expect(created.price).toBe(newService.price);
      expect(created.categoryId).toBe(testCategoryId);
    });
    
    it('should update a service', async () => {
      const updatedName = 'Updated Test Service';
      const updatedPrice = '75.00';
      
      await db
        .update(schema.posServices)
        .set({ name: updatedName, price: updatedPrice })
        .where(eq(schema.posServices.id, testServiceId));
      
      const [updated] = await db
        .select()
        .from(schema.posServices)
        .where(eq(schema.posServices.id, testServiceId));
      
      expect(updated.name).toBe(updatedName);
      expect(updated.price).toBe(updatedPrice);
    });
    
    it('should filter services by category', async () => {
      const services = await db
        .select()
        .from(schema.posServices)
        .where(eq(schema.posServices.categoryId, testCategoryId));
      
      expect(Array.isArray(services)).toBe(true);
      expect(services.length).toBeGreaterThan(0);
      
      // التحقق من أن جميع الخدمات تنتمي للقسم المحدد
      services.forEach(service => {
        expect(service.categoryId).toBe(testCategoryId);
      });
    });
    
    it('should delete a service', async () => {
      await db
        .delete(schema.posServices)
        .where(eq(schema.posServices.id, testServiceId));
      
      const [deleted] = await db
        .select()
        .from(schema.posServices)
        .where(eq(schema.posServices.id, testServiceId));
      
      expect(deleted).toBeUndefined();
      
      // إعادة تعيين testServiceId لتجنب محاولة الحذف مرة أخرى في afterAll
      testServiceId = 0;
    });
  });
  
  describe('Employee Photo URL', () => {
    it('should return photoUrl in employee data for POS', async () => {
      // جلب موظف من فرع طويق (30001) للتحقق من وجود photoUrl
      const employees = await db
        .select({
          id: schema.employees.id,
          name: schema.employees.name,
          photoUrl: schema.employees.photoUrl,
        })
        .from(schema.employees)
        .where(eq(schema.employees.branchId, 30001));
      
      expect(Array.isArray(employees)).toBe(true);
      expect(employees.length).toBeGreaterThan(0);
      
      // التحقق من أن البيانات تحتوي على حقل photoUrl
      employees.forEach(emp => {
        expect(emp).toHaveProperty('photoUrl');
      });
      
      // التحقق من وجود موظف بصورة (محمد إسماعيل)
      const employeeWithPhoto = employees.find(e => e.photoUrl !== null);
      if (employeeWithPhoto) {
        expect(employeeWithPhoto.photoUrl).toBeTruthy();
        expect(typeof employeeWithPhoto.photoUrl).toBe('string');
      }
    });
  });
});
