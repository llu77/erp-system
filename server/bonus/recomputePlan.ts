/**
 * Bonus Recompute Plan - منطق إعادة احتساب البونص (دوال نقية قابلة للاختبار)
 *
 * يُستخدم من recomputeWeeklyBonus داخل المعاملة:
 * - مجموعة الموظفين = (كل من له إيراد في الفترة مهما كان فرعه/حالته الحالية) ∪ (الموظفون النشطون في الفرع بإيراد صفر)
 * - الفترات المقفلة (بانتظار الموافقة / موافق عليها / مصروفة) لا تتغير
 * - الفترة المرفوضة يُعاد احتسابها وتعود لحالة "قيد الاحتساب"
 */

import { resolveBonusTier, type BonusTierRule, type BonusTierResultKey } from "../../shared/bonus";
import { isLockedBonusStatus } from "../../shared/bonusHelpers";

export interface ComputedEmployeeBonus {
  employeeId: number;
  weeklyRevenue: number;
  bonusTier: BonusTierResultKey;
  tierName: string;
  bonusAmount: number;
  isEligible: boolean;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * حساب بونص كل موظف في الفترة
 * @param revenueByEmployee إيراد كل موظف في الفترة (من employeeRevenues)
 * @param activeEmployeeIds الموظفون النشطون حالياً في الفرع (يظهرون بإيراد صفر)
 */
export function computeEmployeeBonuses(
  revenueByEmployee: Map<number, number>,
  activeEmployeeIds: number[],
  tiers: BonusTierRule[] | null | undefined
): ComputedEmployeeBonus[] {
  const ids = new Set<number>([...Array.from(revenueByEmployee.keys()), ...activeEmployeeIds]);

  return Array.from(ids)
    .sort((a, b) => a - b)
    .map(employeeId => {
      const weeklyRevenue = round2(Math.max(0, revenueByEmployee.get(employeeId) ?? 0));
      const match = resolveBonusTier(weeklyRevenue, tiers);
      return {
        employeeId,
        weeklyRevenue,
        bonusTier: match.tier,
        tierName: match.tierName,
        bonusAmount: round2(match.amount),
        isEligible: match.isEligible,
      };
    });
}

export function sumBonusAmounts(details: Array<{ bonusAmount: number | string }>): number {
  return round2(details.reduce((sum, d) => sum + Number(d.bonusAmount || 0), 0));
}

export function sumRevenues(details: Array<{ weeklyRevenue: number | string }>): number {
  return round2(details.reduce((sum, d) => sum + Number(d.weeklyRevenue || 0), 0));
}

export interface ExistingDetailRow {
  id: number;
  employeeId: number;
}

/**
 * تحديد عمليات الكتابة على تفاصيل البونص:
 * - تحديث صف موجود لكل موظف محسوب
 * - إدراج الموظفين الجدد
 * - حذف التفاصيل القديمة (موظف لم يعد ضمن المجموعة) والصفوف المكررة لنفس الموظف
 */
export function planDetailWrites(
  existing: ExistingDetailRow[],
  computed: ComputedEmployeeBonus[]
): {
  toUpdate: Array<{ id: number; data: ComputedEmployeeBonus }>;
  toInsert: ComputedEmployeeBonus[];
  toDeleteIds: number[];
} {
  const keepByEmployee = new Map<number, number>();
  const toDeleteIds: number[] = [];

  for (const row of [...existing].sort((a, b) => a.id - b.id)) {
    if (keepByEmployee.has(row.employeeId)) {
      toDeleteIds.push(row.id); // صف مكرر لنفس الموظف
    } else {
      keepByEmployee.set(row.employeeId, row.id);
    }
  }

  const computedIds = new Set(computed.map(c => c.employeeId));
  keepByEmployee.forEach((id, employeeId) => {
    if (!computedIds.has(employeeId)) toDeleteIds.push(id);
  });

  const toUpdate: Array<{ id: number; data: ComputedEmployeeBonus }> = [];
  const toInsert: ComputedEmployeeBonus[] = [];
  for (const c of computed) {
    const id = keepByEmployee.get(c.employeeId);
    if (id !== undefined) toUpdate.push({ id, data: c });
    else toInsert.push(c);
  }

  return { toUpdate, toInsert, toDeleteIds: toDeleteIds.sort((a, b) => a - b) };
}

export type RecomputeAction = "update" | "reset_rejected" | "locked";

/** القرار حسب حالة الفترة الحالية */
export function decideRecomputeAction(status: string | null | undefined): RecomputeAction {
  if (isLockedBonusStatus(status)) return "locked";
  if (status === "rejected") return "reset_rejected";
  return "update";
}

/**
 * اختيار صف البونص الأسبوعي من بين صفوف مكررة (بيانات قديمة):
 * يُفضل الصف المقفل إن وجد (حتى لا يُعدل بونص تم طلبه)، وإلا أقدم صف
 */
export function pickWeeklyBonusRow<T extends { id: number; status: string }>(rows: T[]): T | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => a.id - b.id);
  return sorted.find(r => isLockedBonusStatus(r.status)) ?? sorted[0];
}

/** هل تغيرت الإيرادات/المبالغ بشكل يستحق التسجيل؟ */
export function hasMeaningfulChange(oldValue: number, newValue: number, tolerance = 0.009): boolean {
  return Math.abs(Number(oldValue || 0) - Number(newValue || 0)) > tolerance;
}

/**
 * تحذير عدم تطابق إيراد الفرع مع إيرادات الموظفين (تحذير فقط - لا يمنع الاحتساب)
 */
export function buildRevenueMismatchWarning(branchCashNetwork: number, employeesTotal: number): string | null {
  const diff = round2(Math.abs(branchCashNetwork - employeesTotal));
  if (diff <= 0.01) return null;
  return `تحذير: إيراد الفرع (كاش + شبكة) ${branchCashNetwork.toFixed(2)} ر.س لا يطابق مجموع إيرادات الموظفين ${employeesTotal.toFixed(2)} ر.س (فرق ${diff.toFixed(2)} ر.س)`;
}
