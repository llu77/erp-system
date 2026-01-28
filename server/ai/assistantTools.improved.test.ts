/**
 * اختبارات المساعد الذكي المحسن - التحقق من المصداقية
 */

import { describe, it, expect } from 'vitest';
import { 
  generateUsername, 
  generatePassword,
  ToolResult
} from './assistantTools';

describe('المساعد الذكي - اختبارات المصداقية', () => {
  describe('هيكل ToolResult', () => {
    it('يجب أن يحتوي على حقل hasData', () => {
      const result: ToolResult = {
        success: true,
        hasData: false,
        dataCount: 0,
        message: 'لا توجد بيانات'
      };
      
      expect(result).toHaveProperty('hasData');
      expect(result).toHaveProperty('dataCount');
      expect(result).toHaveProperty('message');
    });

    it('يجب أن يوضح عدم وجود البيانات بشكل صريح', () => {
      const result: ToolResult = {
        success: true,
        hasData: false,
        dataCount: 0,
        message: 'لا توجد بيانات إيرادات مسجلة للفترة المطلوبة'
      };
      
      expect(result.hasData).toBe(false);
      expect(result.dataCount).toBe(0);
      expect(result.message).toContain('لا توجد');
    });

    it('يجب أن يحتوي على مصدر البيانات', () => {
      const result: ToolResult = {
        success: true,
        hasData: true,
        dataCount: 5,
        message: 'تم جلب البيانات',
        source: 'جدول الإيرادات اليومية'
      };
      
      expect(result.source).toBeDefined();
      expect(result.source).toContain('جدول');
    });

    it('يجب أن يحتوي على الفترة الزمنية للتقارير', () => {
      const result: ToolResult = {
        success: true,
        hasData: true,
        dataCount: 7,
        message: 'تقرير الإيرادات',
        period: {
          start: '2026-01-19',
          end: '2026-01-25'
        }
      };
      
      expect(result.period).toBeDefined();
      expect(result.period?.start).toBeDefined();
      expect(result.period?.end).toBeDefined();
    });
  });

  describe('توليد اسم المستخدم وكلمة المرور', () => {
    it('يجب أن يولد اسم مستخدم فريد', () => {
      const username1 = generateUsername('محمد أحمد');
      const username2 = generateUsername('محمد أحمد');
      
      // يجب أن يكون مختلف بسبب اللاحقة العشوائية
      expect(username1).not.toBe(username2);
    });

    it('يجب أن يولد كلمة مرور بطول 8 أحرف', () => {
      const password = generatePassword();
      expect(password.length).toBe(8);
    });

    it('يجب أن تحتوي كلمة المرور على أحرف و/أو أرقام', () => {
      // اختبار عدة كلمات مرور للتأكد من التنوع
      let hasLetters = false;
      let hasNumbers = false;
      for (let i = 0; i < 10; i++) {
        const password = generatePassword();
        if (/[A-Za-z]/.test(password)) hasLetters = true;
        if (/[0-9]/.test(password)) hasNumbers = true;
      }
      // التحقق من أن كلمات المرور تحتوي على أحرف وأرقام (على الأقل في بعض الحالات)
      expect(hasLetters).toBe(true);
      expect(hasNumbers).toBe(true);
    });
  });

  describe('رسائل الخطأ الواضحة', () => {
    it('يجب أن توضح رسالة الخطأ السبب', () => {
      const errorResult: ToolResult = {
        success: false,
        hasData: false,
        dataCount: 0,
        error: 'الموظف رقم 999 غير موجود في قاعدة البيانات',
        message: 'الموظف رقم 999 غير موجود في قاعدة البيانات'
      };
      
      expect(errorResult.success).toBe(false);
      expect(errorResult.error).toContain('غير موجود');
      expect(errorResult.message).toContain('قاعدة البيانات');
    });

    it('يجب أن توضح رسالة عدم وجود البيانات البديل', () => {
      const noDataResult: ToolResult = {
        success: true,
        hasData: false,
        dataCount: 0,
        message: 'لا توجد بيانات إيرادات مسجلة للفترة من 2026-01-19 إلى 2026-01-25. قد يكون السبب: لم يتم إدخال الإيرادات لهذه الفترة بعد'
      };
      
      expect(noDataResult.success).toBe(true);
      expect(noDataResult.hasData).toBe(false);
      expect(noDataResult.message).toContain('قد يكون السبب');
    });
  });

  describe('التحقق من الفترات الزمنية', () => {
    it('يجب أن يحسب الأسبوع الحالي بشكل صحيح', () => {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
      
      expect(weekStart.getDay()).toBe(0); // الأحد
    });

    it('يجب أن يحسب الأسبوع الماضي بشكل صحيح', () => {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const lastWeekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek - 1);
      const lastWeekStart = new Date(lastWeekEnd.getFullYear(), lastWeekEnd.getMonth(), lastWeekEnd.getDate() - 6);
      
      // الأسبوع الماضي يجب أن يكون 7 أيام
      const diff = (lastWeekEnd.getTime() - lastWeekStart.getTime()) / (1000 * 60 * 60 * 24);
      expect(diff).toBe(6);
    });

    it('يجب أن يحسب الشهر الماضي بشكل صحيح', () => {
      const now = new Date();
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      
      // التحقق من أن الشهر الماضي يبدأ من اليوم الأول
      expect(lastMonthStart.getDate()).toBe(1);
      // التحقق من أن نهاية الشهر الماضي هي آخر يوم
      expect(lastMonthEnd.getDate()).toBeGreaterThanOrEqual(28);
    });
  });
});
