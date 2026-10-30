/**
 * Bonus Access - صلاحيات البونص
 *
 * - المسؤول والمدير: كل الفروع + تحديد المستويات + الموافقة/الرفض/الصرف
 * - مشرف الفرع: فرعه فقط (عرض + احتساب + طلب صرف)
 * - المشرف العام (viewer): عرض فقط (مقيد بفرعه إن كان مرتبطاً بفرع)
 */

import { TRPCError } from "@trpc/server";
import { isValidBonusPeriod } from "../../shared/bonusHelpers";

type BonusUser = { id: number; role: string; branchId: number | null };

export function isBonusManager(user: Pick<BonusUser, "role">): boolean {
  return user.role === "admin" || user.role === "manager";
}

/** نطاق الفرع للمستخدم: null = كل الفروع */
export function getBonusBranchScope(user: Pick<BonusUser, "role" | "branchId">): number | null {
  if (isBonusManager(user)) return null;
  // مشرف الفرع غير المرتبط بفرع لا يحصل على صلاحية كل الفروع
  if (user.role === "supervisor" && user.branchId == null) {
    throw new TRPCError({ code: "FORBIDDEN", message: "حساب المشرف غير مرتبط بفرع" });
  }
  return user.branchId ?? null;
}

/** التحقق من صلاحية الوصول لفرع (نفس منطق checkBranchAccess) */
export function assertBonusBranchAccess(user: Pick<BonusUser, "role" | "branchId">, branchId: number): void {
  const scope = getBonusBranchScope(user);
  if (scope !== null && scope !== branchId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك الوصول لبونص فرع آخر" });
  }
}

/** العمليات (احتساب / طلب صرف): المسؤول والمدير ومشرف الفرع */
export function assertBonusOperator(user: Pick<BonusUser, "role">): void {
  if (!["admin", "manager", "supervisor"].includes(user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "هذا الإجراء متاح للمسؤول والمدير ومشرف الفرع فقط" });
  }
}

/** العرض: المسؤول والمدير والمشرف والمشرف العام */
export function assertBonusViewer(user: Pick<BonusUser, "role">): void {
  if (!["admin", "manager", "supervisor", "viewer"].includes(user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "غير مصرح لك بعرض البونص" });
  }
}

export function assertValidBonusPeriod(weekNumber: number, month: number, year: number): void {
  if (!isValidBonusPeriod(weekNumber, month, year)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `الفترة ${weekNumber} غير موجودة في الشهر ${month}/${year}` });
  }
}
