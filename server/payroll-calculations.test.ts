import { describe, it, expect } from 'vitest';

// الثوابت المستخدمة في حساب الرواتب
const BASE_SALARY = 2000;
const OVERTIME_AMOUNT = 1000;

// نوع بيانات الإجازة
interface LeaveData {
  type: string;
  days: number;
}

// دالة حساب خصم الإجازة
function calculateLeaveDeduction(
  baseSalary: number,
  overtimeAmount: number,
  leavesData: LeaveData[]
): number {
  let unpaidLeaveDeduction = 0;
  if (leavesData.length > 0) {
    const dailySalary = (baseSalary + overtimeAmount) / 30;
    for (const leave of leavesData) {
      const leaveType = leave.type?.toLowerCase().trim();
      // إجازة سنوية أو مرضية - مدفوعة بالكامل
      if (leaveType === 'annual' || leaveType === 'سنوية' || leaveType === 'sick' || leaveType === 'مرضية') {
        continue;
      }
      // إجازة طارئة - خصم 50%
      if (leaveType === 'emergency' || leaveType === 'طارئة') {
        unpaidLeaveDeduction += dailySalary * leave.days * 0.5;
      } else {
        // إجازة بدون راتب - خصم كامل
        unpaidLeaveDeduction += dailySalary * leave.days;
      }
    }
  }
  return unpaidLeaveDeduction;
}

// دالة حساب الراتب الصافي
function calculateNetSalary(
  baseSalary: number,
  overtimeEnabled: boolean,
  incentiveAmount: number,
  deductionAmount: number,
  advanceDeduction: number,
  negativeInvoicesDeduction: number,
  unpaidLeaveDeduction: number,
  absentDeduction: number
): { grossSalary: number; totalDeductions: number; netSalary: number } {
  const overtimeAmount = overtimeEnabled ? OVERTIME_AMOUNT : 0;
  const grossSalary = baseSalary + overtimeAmount + incentiveAmount;
  const totalDeductions = deductionAmount + advanceDeduction + negativeInvoicesDeduction + unpaidLeaveDeduction + absentDeduction;
  const netSalary = grossSalary - totalDeductions;
  return { grossSalary, totalDeductions, netSalary };
}

describe('حسابات مسيرات الرواتب', () => {
  describe('خصم الإجازة بدون راتب', () => {
    it('يجب أن يحسب خصم الإجازة بدون راتب مع ساعات إضافية بشكل صحيح', () => {
      // مشكلة علاء: مع ساعات إضافية (2000 + 1000) / 30 = 100 ر.س/يوم
      const baseSalary = 2000;
      const overtimeAmount = 1000;
      const leavesData: LeaveData[] = [{ type: 'unpaid', days: 1 }];
      
      const deduction = calculateLeaveDeduction(baseSalary, overtimeAmount, leavesData);
      
      expect(deduction).toBe(100); // (2000 + 1000) / 30 = 100
    });

    it('يجب أن يحسب خصم الإجازة بدون راتب بدون ساعات إضافية بشكل صحيح', () => {
      // بدون ساعات إضافية: 2000 / 30 = 66.67 ر.س/يوم
      const baseSalary = 2000;
      const overtimeAmount = 0;
      const leavesData: LeaveData[] = [{ type: 'unpaid', days: 1 }];
      
      const deduction = calculateLeaveDeduction(baseSalary, overtimeAmount, leavesData);
      
      expect(deduction).toBeCloseTo(66.67, 2);
    });

    it('يجب أن لا يخصم للإجازة السنوية', () => {
      const baseSalary = 2000;
      const overtimeAmount = 1000;
      const leavesData: LeaveData[] = [{ type: 'annual', days: 5 }];
      
      const deduction = calculateLeaveDeduction(baseSalary, overtimeAmount, leavesData);
      
      expect(deduction).toBe(0);
    });

    it('يجب أن لا يخصم للإجازة المرضية', () => {
      const baseSalary = 2000;
      const overtimeAmount = 1000;
      const leavesData: LeaveData[] = [{ type: 'sick', days: 3 }];
      
      const deduction = calculateLeaveDeduction(baseSalary, overtimeAmount, leavesData);
      
      expect(deduction).toBe(0);
    });

    it('يجب أن يخصم 50% للإجازة الطارئة', () => {
      const baseSalary = 2000;
      const overtimeAmount = 1000;
      const leavesData: LeaveData[] = [{ type: 'emergency', days: 2 }];
      
      const deduction = calculateLeaveDeduction(baseSalary, overtimeAmount, leavesData);
      
      // (2000 + 1000) / 30 * 2 * 0.5 = 100
      expect(deduction).toBe(100);
    });
  });

  describe('حساب الراتب الصافي', () => {
    it('يجب أن يحسب الراتب الصافي مع الفواتير السالبة بشكل صحيح (مشكلة السيد)', () => {
      // مشكلة السيد: فاتورة سالبة -55، راتب 3150، يجب أن يكون الناتج 3095
      const baseSalary = 2000;
      const overtimeEnabled = true; // مع ساعات إضافية
      const incentiveAmount = 150; // حوافز
      const deductionAmount = 0;
      const advanceDeduction = 0;
      const negativeInvoicesDeduction = 55; // فاتورة سالبة
      const unpaidLeaveDeduction = 0;
      const absentDeduction = 0;
      
      const result = calculateNetSalary(
        baseSalary,
        overtimeEnabled,
        incentiveAmount,
        deductionAmount,
        advanceDeduction,
        negativeInvoicesDeduction,
        unpaidLeaveDeduction,
        absentDeduction
      );
      
      // إجمالي = 2000 + 1000 + 150 = 3150
      expect(result.grossSalary).toBe(3150);
      // خصومات = 55
      expect(result.totalDeductions).toBe(55);
      // صافي = 3150 - 55 = 3095
      expect(result.netSalary).toBe(3095);
    });

    it('يجب أن لا يخصم الفواتير السالبة مرتين', () => {
      // التأكد من أن الفواتير السالبة تُخصم مرة واحدة فقط
      const baseSalary = 2000;
      const overtimeEnabled = false;
      const incentiveAmount = 0;
      const deductionAmount = 0;
      const advanceDeduction = 0;
      const negativeInvoicesDeduction = 100;
      const unpaidLeaveDeduction = 0;
      const absentDeduction = 0;
      
      const result = calculateNetSalary(
        baseSalary,
        overtimeEnabled,
        incentiveAmount,
        deductionAmount,
        advanceDeduction,
        negativeInvoicesDeduction,
        unpaidLeaveDeduction,
        absentDeduction
      );
      
      // إجمالي = 2000
      expect(result.grossSalary).toBe(2000);
      // خصومات = 100 (مرة واحدة فقط)
      expect(result.totalDeductions).toBe(100);
      // صافي = 2000 - 100 = 1900
      expect(result.netSalary).toBe(1900);
    });

    it('يجب أن يحسب الراتب مع جميع الخصومات بشكل صحيح', () => {
      const baseSalary = 2000;
      const overtimeEnabled = true;
      const incentiveAmount = 200;
      const deductionAmount = 50; // خصومات أخرى
      const advanceDeduction = 500; // سلف
      const negativeInvoicesDeduction = 100; // فواتير سالبة
      const unpaidLeaveDeduction = 100; // إجازة بدون راتب
      const absentDeduction = 200; // غياب
      
      const result = calculateNetSalary(
        baseSalary,
        overtimeEnabled,
        incentiveAmount,
        deductionAmount,
        advanceDeduction,
        negativeInvoicesDeduction,
        unpaidLeaveDeduction,
        absentDeduction
      );
      
      // إجمالي = 2000 + 1000 + 200 = 3200
      expect(result.grossSalary).toBe(3200);
      // خصومات = 50 + 500 + 100 + 100 + 200 = 950
      expect(result.totalDeductions).toBe(950);
      // صافي = 3200 - 950 = 2250
      expect(result.netSalary).toBe(2250);
    });
  });

  describe('سيناريوهات واقعية', () => {
    it('سيناريو السيد: فاتورة سالبة -55 مع راتب 3150', () => {
      // السيد: راتب أساسي 2000 + ساعات إضافية 1000 + حوافز 150 = 3150
      // فاتورة سالبة = 55
      // الصافي المتوقع = 3150 - 55 = 3095
      
      const baseSalary = 2000;
      const overtimeAmount = 1000;
      const incentiveAmount = 150;
      const negativeInvoicesDeduction = 55;
      
      const grossSalary = baseSalary + overtimeAmount + incentiveAmount;
      const netSalary = grossSalary - negativeInvoicesDeduction;
      
      expect(grossSalary).toBe(3150);
      expect(netSalary).toBe(3095);
    });

    it('سيناريو علاء: خصم يوم إجازة مع ساعات إضافية', () => {
      // علاء: راتب أساسي 2000 + ساعات إضافية 1000 = 3000
      // إجازة يوم بدون راتب = (2000 + 1000) / 30 = 100 ر.س
      // الصافي المتوقع = 3000 - 100 = 2900
      
      const baseSalary = 2000;
      const overtimeAmount = 1000;
      const leavesData: LeaveData[] = [{ type: 'unpaid', days: 1 }];
      
      const leaveDeduction = calculateLeaveDeduction(baseSalary, overtimeAmount, leavesData);
      const grossSalary = baseSalary + overtimeAmount;
      const netSalary = grossSalary - leaveDeduction;
      
      expect(leaveDeduction).toBe(100);
      expect(grossSalary).toBe(3000);
      expect(netSalary).toBe(2900);
    });
  });
});
