/**
 * أدوات مشتركة لصفحة الموظفين وملف الموظف ولوحة الوثائق
 */

import {
  validateEmployeeFile,
  type DocumentStatus,
  type EmployeeDocumentKind,
} from "@shared/employeeFile";

/** الأدوار التي تدير ملف الموظف بالكامل (الراتب وحساب البوابة والإضافة والحذف) */
export function canManageEmployees(role: string | null | undefined): boolean {
  return role === "admin" || role === "manager";
}

/** الأدوار التي تفتح صفحة الموظفين وملف الموظف (المشرف: فرعه فقط) */
export function canOpenEmployeeFiles(role: string | null | undefined): boolean {
  return role === "admin" || role === "manager" || role === "supervisor";
}

/** الأدوار التي ترى لوحة الوثائق */
export function canViewDocumentsDashboard(
  role: string | null | undefined
): boolean {
  return canOpenEmployeeFiles(role) || role === "viewer";
}

/** ألوان شارة حالة الوثيقة */
export const DOCUMENT_STATUS_CLASSES: Record<DocumentStatus, string> = {
  expired:
    "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-200 dark:border-red-700",
  critical:
    "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/40 dark:text-orange-200 dark:border-orange-700",
  warning:
    "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700",
  valid:
    "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-700",
  missing:
    "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600",
};

/** لون نقطة التقويم لكل حالة */
export const DOCUMENT_STATUS_DOT: Record<DocumentStatus, string> = {
  expired: "bg-red-500",
  critical: "bg-orange-500",
  warning: "bg-amber-400",
  valid: "bg-emerald-500",
  missing: "bg-slate-400",
};

export function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

export interface PreparedUpload {
  base64: string;
  contentType: string;
  fileName: string;
}

/** قراءة الملف كـ base64 بعد التحقق من نوعه وحجمه (يتحقق الخادم مرة أخرى من محتواه) */
export function prepareEmployeeFile(
  file: File,
  kind: EmployeeDocumentKind
): Promise<PreparedUpload> {
  const check = validateEmployeeFile({
    kind,
    contentType: file.type,
    size: file.size,
  });
  if (!check.ok) return Promise.reject(new Error(check.error));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve({
        base64: result,
        contentType: check.contentType,
        fileName: file.name,
      });
    };
    reader.onerror = () => reject(new Error("تعذر قراءة الملف"));
    reader.readAsDataURL(file);
  });
}

/** هل الرابط لملف PDF (لعرض أيقونة بدلاً من معاينة الصورة) */
export function isPdfUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.pdf(\?|#|$)/i.test(url);
}

/** كلمة مرور قوية عشوائية (بدون أحرف ملتبسة) */
export function generateStrongPassword(length = 12): string {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%*";
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, v => alphabet[v % alphabet.length]).join("");
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** تاريخ ووقت بالتقويم الميلادي (توقيت الرياض) */
export function formatDateTimeAr(
  value: Date | string | null | undefined
): string {
  if (!value) return "-";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("ar-SA-u-ca-gregory", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** الأحرف الأولى من الاسم للصورة الافتراضية */
export function initials(name: string | null | undefined): string {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map(p => p[0])
      .join("") || "؟"
  );
}
