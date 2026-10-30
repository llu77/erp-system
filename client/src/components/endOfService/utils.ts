/**
 * أدوات مشتركة لصفحات إنهاء الخدمة
 */

import { TRPCClientError } from "@trpc/client";
import { formatVoucherAmount } from "@shared/vouchers";

/** الأدوار التي ترى صفحات إنهاء الخدمة (المشرف: موظفو فرعه فقط - يفرضه الخادم) */
export const EOS_VIEW_ROLES = ["admin", "manager", "viewer", "supervisor"];

/** الأدوار التي تنشئ وتعتمد وتصرف وتلغي */
export function canManageEndOfService(
  role: string | null | undefined
): boolean {
  return role === "admin" || role === "manager";
}

export function canViewEndOfService(role: string | null | undefined): boolean {
  return EOS_VIEW_ROLES.includes(role ?? "");
}

/** المبلغ: 12,345.67 ر.س */
export function formatSar(value: unknown): string {
  return `${formatVoucherAmount(value)} ر.س`;
}

/** الأيام بدون أصفار زائدة: 12.5 */
export function formatDays(value: number | null | undefined): string {
  const n = Number(value) || 0;
  return Number.isInteger(n)
    ? String(n)
    : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

/** رمز خطأ tRPC (CONFLICT / NOT_FOUND / FORBIDDEN ...) */
export function trpcErrorCode(error: unknown): string | undefined {
  if (error instanceof TRPCClientError) {
    const code = (error.data as { code?: unknown } | undefined)?.code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

/** لا تُعاد محاولة الأخطاء النهائية (غير موجود / غير مصرح / مدخلات خاطئة) */
export function retryUnlessFinal(
  failureCount: number,
  error: unknown
): boolean {
  const code = trpcErrorCode(error);
  if (
    code &&
    ["NOT_FOUND", "FORBIDDEN", "UNAUTHORIZED", "BAD_REQUEST"].includes(code)
  )
    return false;
  return failureCount < 2;
}

/** تنزيل ملف PDF من base64 */
export function downloadBase64Pdf(base64: string, filename: string) {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const url = URL.createObjectURL(
    new Blob([bytes], { type: "application/pdf" })
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** ألوان شارة الحالة */
export function eosStatusBadgeClass(status: string): string {
  switch (status) {
    case "draft":
      return "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700";
    case "approved":
      return "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700";
    case "paid":
      return "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700";
    case "cancelled":
      return "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700";
    default:
      return "";
  }
}

/** شهر المسيرة: 03/2026 */
export function formatPayrollMonth(
  ref: { year: number; month: number } | null | undefined
): string {
  if (!ref) return "-";
  return `${String(ref.month).padStart(2, "0")}/${ref.year}`;
}
