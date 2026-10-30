/**
 * صلاحيات ملف الموظف ولوحة الوثائق
 * - المسؤول والمدير: كل الفروع وكل الأقسام (بما فيها الراتب وحساب البوابة)
 * - مشرف الفرع: موظفو فرعه فقط (البيانات والوثائق)
 * - المشرف العام (viewer): لوحة الوثائق للعرض فقط
 */

import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "../_core/trpc";
import { EmployeeFileError } from "./service";

type StaffUser = { role: string; branchId: number | null };

export function isEmployeeFileManager(user: { role: string }): boolean {
  return user.role === "admin" || user.role === "manager";
}

function assertSupervisorHasBranch(user: StaffUser) {
  if (user.role === "supervisor" && user.branchId == null) {
    throw new TRPCError({ code: "FORBIDDEN", message: "حسابك غير مرتبط بفرع" });
  }
}

/** عرض ملف الموظف وتعديل بياناته ووثائقه: المسؤول والمدير ومشرف الفرع */
export const employeeFileProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!["admin", "manager", "supervisor"].includes(ctx.user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "غير مصرح لك بالوصول إلى ملفات الموظفين",
    });
  }
  assertSupervisorHasBranch(ctx.user);
  return next({ ctx });
});

/** لوحة الوثائق: المسؤول والمدير والمشرف العام (كل الفروع) ومشرف الفرع (فرعه) */
export const documentsOverviewProcedure = protectedProcedure.use(
  ({ ctx, next }) => {
    if (!["admin", "manager", "viewer", "supervisor"].includes(ctx.user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "غير مصرح لك بعرض لوحة الوثائق",
      });
    }
    assertSupervisorHasBranch(ctx.user);
    return next({ ctx });
  }
);

/** مشرف الفرع لا يصل إلا لموظفي فرعه */
export function assertEmployeeBranchAccess(
  user: StaffUser,
  employeeBranchId: number | null | undefined
) {
  if (user.role !== "supervisor") return;
  assertSupervisorHasBranch(user);
  if (employeeBranchId !== user.branchId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "لا يمكنك الوصول إلى موظف من فرع آخر",
    });
  }
}

/** فلتر الفرع الفعلي: المشرف مقيد بفرعه مهما كان الفلتر المطلوب */
export function scopedBranchFilter(
  user: StaffUser,
  requested?: number
): number | undefined {
  if (user.role === "supervisor") {
    assertSupervisorHasBranch(user);
    return user.branchId ?? undefined;
  }
  return requested;
}

function isDuplicateKeyError(error: unknown): boolean {
  const e = error as {
    code?: unknown;
    errno?: unknown;
    cause?: { code?: unknown; errno?: unknown };
  } | null;
  return (
    e?.code === "ER_DUP_ENTRY" ||
    e?.errno === 1062 ||
    e?.cause?.code === "ER_DUP_ENTRY" ||
    e?.cause?.errno === 1062
  );
}

/** تحويل أخطاء ملف الموظف إلى أخطاء tRPC مفهومة */
export async function runEmployeeFileAction<T>(
  action: () => Promise<T>
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    if (error instanceof EmployeeFileError) {
      throw new TRPCError({ code: error.code, message: error.message });
    }
    if (isDuplicateKeyError(error)) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "كود الموظف مستخدم لموظف آخر",
      });
    }
    console.error("[EmployeeFile] خطأ غير متوقع:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "حدث خطأ غير متوقع في ملف الموظف، حاول مرة أخرى",
    });
  }
}
