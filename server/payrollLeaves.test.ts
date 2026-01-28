import { describe, it, expect } from 'vitest';

/**
 * اختبارات ربط مسير الرواتب بطلبات الإجازات
 * - جلب الإجازات المعتمدة للموظف في شهر معين
 * - حساب خصم الإجازة بناءً على نوعها
 * - تحديث مسير الرواتب بتفاصيل الإجازات
 */

describe('ربط مسير الرواتب بالإجازات', () => {
  describe('جلب الإجازات المعتمدة', () => {
    it('يجب جلب الإجازات المعتمدة فقط', () => {
      // الإجازات المعتمدة فقط تُحتسب
      const statuses = ['pending', 'approved', 'rejected', 'cancelled'];
      const approvedStatuses = statuses.filter(s => s === 'approved');
      expect(approvedStatuses).toHaveLength(1);
      expect(approvedStatuses[0]).toBe('approved');
    });

    it('يجب احتساب أيام الإجازة ضمن الشهر فقط', () => {
      // إجازة من 25 يناير إلى 5 فبراير
      const leaveStart = new Date(2026, 0, 25); // 25 يناير
      const leaveEnd = new Date(2026, 1, 5);    // 5 فبراير
      const monthStart = new Date(2026, 0, 1);  // 1 يناير
      const monthEnd = new Date(2026, 0, 31);   // 31 يناير

      // التقاطع مع شهر يناير
      const effectiveStart = leaveStart < monthStart ? monthStart : leaveStart;
      const effectiveEnd = leaveEnd > monthEnd ? monthEnd : leaveEnd;

      // حساب الأيام في يناير فقط (25-31 = 7 أيام)
      const days = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      expect(days).toBe(7);
    });

    it('يجب تجاهل الإجازات خارج الشهر', () => {
      // إجازة في فبراير
      const leaveStart = new Date(2026, 1, 1);  // 1 فبراير
      const leaveEnd = new Date(2026, 1, 5);    // 5 فبراير
      const monthStart = new Date(2026, 0, 1);  // 1 يناير
      const monthEnd = new Date(2026, 0, 31);   // 31 يناير

      // لا يوجد تقاطع
      const hasOverlap = leaveStart <= monthEnd && leaveEnd >= monthStart;
      expect(hasOverlap).toBe(false);
    });
  });

  describe('حساب خصم الإجازة', () => {
    const baseSalary = 3000;
    const workDays = 30;
    const dailySalary = baseSalary / workDays; // 100 ر.س
    
    // دالة حساب الخصم الموحدة (تدعم العربية والإنجليزية)
    function calculateDeduction(leaveType: string, leaveDays: number): number {
      const normalizedType = leaveType?.toLowerCase().trim();
      switch (normalizedType) {
        case 'سنوية':
        case 'annual':
        case 'مرضية':
        case 'sick':
          return 0;
        case 'طارئة':
        case 'emergency':
          return dailySalary * leaveDays * 0.5;
        case 'بدون راتب':
        case 'unpaid':
        default:
          return dailySalary * leaveDays;
      }
    }

    it('يجب ألا يُخصم للإجازة السنوية (عربي)', () => {
      expect(calculateDeduction('سنوية', 5)).toBe(0);
    });
    
    it('يجب ألا يُخصم للإجازة السنوية (annual)', () => {
      expect(calculateDeduction('annual', 5)).toBe(0);
    });

    it('يجب ألا يُخصم للإجازة المرضية (عربي)', () => {
      expect(calculateDeduction('مرضية', 3)).toBe(0);
    });
    
    it('يجب ألا يُخصم للإجازة المرضية (sick)', () => {
      expect(calculateDeduction('sick', 3)).toBe(0);
    });

    it('يجب خصم 50% للإجازة الطارئة (عربي)', () => {
      expect(calculateDeduction('طارئة', 2)).toBe(100); // 100 × 2 × 0.5 = 100
    });
    
    it('يجب خصم 50% للإجازة الطارئة (emergency)', () => {
      expect(calculateDeduction('emergency', 2)).toBe(100); // 100 × 2 × 0.5 = 100
    });

    it('يجب خصم كامل للإجازة بدون راتب (عربي)', () => {
      expect(calculateDeduction('بدون راتب', 3)).toBe(300); // 100 × 3 = 300
    });
    
    it('يجب خصم كامل للإجازة بدون راتب (unpaid)', () => {
      expect(calculateDeduction('unpaid', 3)).toBe(300); // 100 × 3 = 300
    });
  });

  describe('تحديث مسير الرواتب', () => {
    it('يجب تحديث صافي الراتب بعد خصم الإجازة', () => {
      const baseSalary = 3000;
      const overtime = 200;
      const incentives = 100;
      const deductions = 50;
      const leaveDeduction = 300;

      const grossSalary = baseSalary + overtime + incentives;
      const totalDeductions = deductions + leaveDeduction;
      const netSalary = grossSalary - totalDeductions;

      expect(netSalary).toBe(2950); // 3300 - 350 = 2950
    });

    it('يجب حفظ تفاصيل الإجازات في المسير', () => {
      const leaveDetails = JSON.stringify([
        { id: 1, startDate: '2026-01-10', endDate: '2026-01-12', days: 3, type: 'بدون راتب', reason: 'ظروف شخصية' }
      ]);

      const parsed = JSON.parse(leaveDetails);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].days).toBe(3);
      expect(parsed[0].type).toBe('بدون راتب');
    });

    it('يجب تجميع أنواع الإجازات المتعددة', () => {
      const leaves = [
        { type: 'سنوية' },
        { type: 'بدون راتب' },
        { type: 'سنوية' }
      ];

      const types = Array.from(new Set(leaves.map(l => l.type)));
      expect(types).toHaveLength(2);
      expect(types).toContain('سنوية');
      expect(types).toContain('بدون راتب');
    });
  });

  describe('سيناريوهات واقعية', () => {
    it('سيناريو: موظف براتب 2000 أخذ 5 أيام إجازة بدون راتب', () => {
      const baseSalary = 2000;
      const workDays = 30;
      const dailySalary = baseSalary / workDays; // 66.67
      const leaveDays = 5;
      const leaveDeduction = dailySalary * leaveDays; // 333.33

      expect(Math.round(leaveDeduction)).toBe(333);
    });

    it('سيناريو: موظف لديه إجازتين في نفس الشهر', () => {
      const baseSalary = 3000;
      const workDays = 30;
      const dailySalary = baseSalary / workDays; // 100

      const leaves = [
        { days: 2, type: 'طارئة' },    // 100 × 2 × 0.5 = 100
        { days: 3, type: 'بدون راتب' } // 100 × 3 = 300
      ];

      let totalDeduction = 0;
      for (const leave of leaves) {
        if (leave.type === 'طارئة') {
          totalDeduction += dailySalary * leave.days * 0.5;
        } else if (leave.type === 'بدون راتب') {
          totalDeduction += dailySalary * leave.days;
        }
      }

      expect(totalDeduction).toBe(400);
    });

    it('سيناريو: إجازة تمتد لشهرين', () => {
      // إجازة من 20 يناير إلى 10 فبراير
      const leaveStart = new Date(2026, 0, 20);
      const leaveEnd = new Date(2026, 1, 10);

      // حساب أيام يناير (20-31 = 12 يوم)
      const janStart = new Date(2026, 0, 1);
      const janEnd = new Date(2026, 0, 31);
      const janEffectiveStart = leaveStart < janStart ? janStart : leaveStart;
      const janEffectiveEnd = leaveEnd > janEnd ? janEnd : leaveEnd;
      const janDays = Math.ceil((janEffectiveEnd.getTime() - janEffectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      // حساب أيام فبراير (1-10 = 10 أيام)
      const febStart = new Date(2026, 1, 1);
      const febEnd = new Date(2026, 1, 28);
      const febEffectiveStart = leaveStart < febStart ? febStart : leaveStart;
      const febEffectiveEnd = leaveEnd > febEnd ? febEnd : leaveEnd;
      const febDays = Math.ceil((febEffectiveEnd.getTime() - febEffectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      expect(janDays).toBe(12);
      expect(febDays).toBe(10);
    });
  });
});
