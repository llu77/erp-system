import { EMPLOYEE_UNAUTHED_ERR_MSG, NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

// ==================== بوابة الموظفين ====================

/** تعذر التحقق من جلسة البوابة (قاعدة البيانات): خطأ قابل لإعادة المحاولة، لا إعادة توجيه للدخول */
export function employeeLookupFailedError(): TRPCError {
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر التحقق من جلسة البوابة، حاول مرة أخرى" });
}

/** إجراءات الموظف في البوابة: الهوية من كوكي جلسة البوابة فقط (لا تُقبل معرفات من الواجهة) */
export const employeeProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.employee) {
      if (ctx.employeeLookupFailed) throw employeeLookupFailedError();
      throw new TRPCError({ code: "UNAUTHORIZED", message: EMPLOYEE_UNAUTHED_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        employee: ctx.employee,
      },
    });
  }),
);

/** المراجع في بوابة الموظفين (مستخدم النظام أو مشرف من الموظفين) ونطاق فروعه */
export type PortalReviewer = {
  kind: "staff" | "employee";
  /** users.id للمستخدم، employees.id للمشرف */
  id: number;
  name: string;
  role: string;
  /** null = كل الفروع */
  branchId: number | null;
  /** رقم الموظف عند الدخول من البوابة (لمنع اعتماد طلباته بنفسه) */
  employeeId: number | null;
};

const PORTAL_STAFF_REVIEWER_ROLES = ["admin", "manager", "supervisor", "viewer"];

/**
 * تحديد المراجع من السياق (null إذا لم يكن مخولاً).
 * جلسة مشرف البوابة لها الأولوية (مثل واجهة البوابة) حتى يطبق منع اعتماد الطلب الشخصي ونطاق الفرع
 * إذا كان المتصفح يحمل الجلستين معاً؛ وإلا مستخدم النظام الرئيسي
 */
export function resolvePortalReviewer(ctx: Pick<TrpcContext, "user" | "employee">): PortalReviewer | null {
  const employee = ctx.employee;
  if (employee && employee.isSupervisor && employee.branchId != null) {
    return {
      kind: "employee",
      id: employee.id,
      name: employee.name,
      role: "supervisor",
      branchId: employee.branchId,
      employeeId: employee.id,
    };
  }
  const user = ctx.user;
  if (user && PORTAL_STAFF_REVIEWER_ROLES.includes(user.role)) {
    const scoped = user.role === "supervisor" || user.role === "viewer";
    return {
      kind: "staff",
      id: user.id,
      name: user.name || user.username || "مسؤول",
      role: user.role,
      branchId: scoped ? user.branchId ?? null : null,
      employeeId: null,
    };
  }
  return null;
}

/**
 * مراجعة طلبات البوابة: مستخدم النظام (مسؤول/مدير/مشرف/مشرف عام - المشرف بفرعه إن كان مرتبطاً بفرع)
 * أو موظف مشرف بجلسة البوابة (فرعه فقط)
 */
export const portalReviewerProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    const reviewer = resolvePortalReviewer(ctx);

    if (!reviewer) {
      // جلسة البوابة لم يُتحقق منها: قد تكون لمشرف، فلا يُحكم بعدم الصلاحية
      if (ctx.employeeLookupFailed) throw employeeLookupFailedError();
      if (!ctx.user && !ctx.employee) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: EMPLOYEE_UNAUTHED_ERR_MSG });
      }
      throw new TRPCError({ code: "FORBIDDEN", message: "غير مصرح لك بالوصول إلى إدارة البوابة" });
    }

    return next({
      ctx: {
        ...ctx,
        reviewer,
      },
    });
  }),
);
