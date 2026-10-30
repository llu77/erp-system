/**
 * مسارات بوابة الموظفين وإعادة التوجيه عند انتهاء الجلسة
 * (ملف خفيف بدون اعتماديات حتى يُستورد في main.tsx دون تكبير الحزمة الرئيسية)
 */

import { EMPLOYEE_UNAUTHED_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";

export const PORTAL_LOGIN_PATH = "/employee-login";
export const EMPLOYEE_PORTAL_PATH = "/employee-portal";
export const ADMIN_PORTAL_PATH = "/admin-employee-portal";

const PORTAL_PATHS = [
  PORTAL_LOGIN_PATH,
  EMPLOYEE_PORTAL_PATH,
  ADMIN_PORTAL_PATH,
];

export function isPortalPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return PORTAL_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * إعادة التوجيه عند خطأ عدم تسجيل الدخول:
 * - انتهاء جلسة البوابة -> صفحة دخول الموظفين (وليس دخول النظام)
 * - انتهاء جلسة النظام داخل صفحات البوابة -> لا شيء (البوابة تدير جلستها بنفسها)
 */
export function resolveAuthRedirect(
  message: string | null | undefined,
  pathname: string | null | undefined
): "employee-login" | "oauth-login" | null {
  if (message === EMPLOYEE_UNAUTHED_ERR_MSG) {
    return pathname === PORTAL_LOGIN_PATH ? null : "employee-login";
  }
  if (message === UNAUTHED_ERR_MSG) {
    return isPortalPath(pathname) ? null : "oauth-login";
  }
  return null;
}

/** الصفحة الرئيسية للموظف بعد الدخول: المشرف -> لوحة المشرف، غيره -> البوابة */
export function portalHomePath(me: { isSupervisor: boolean }): string {
  return me.isSupervisor ? ADMIN_PORTAL_PATH : EMPLOYEE_PORTAL_PATH;
}
