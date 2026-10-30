/**
 * ملف الموظف: قواعد مشتركة بين الواجهة والخادم
 * - حالة الوثائق (الإقامة / الشهادة الصحية / العقد) حسب يوم الرياض
 * - التحقق من ملفات الصور والوثائق قبل الرفع
 * - القيم الافتراضية لإعدادات الراتب والتحقق من الآيبان
 * - المسمى الوظيفي الثابت (حلاق / مشرف)
 */

import { toVoucherDateString } from "./vouchers";
import {
  DEFAULT_BASE_SALARY,
  DEFAULT_OVERTIME_AMOUNT,
  DEFAULT_SUPERVISOR_INCENTIVE,
} from "./payroll";

// ==================== المسمى الوظيفي ====================

export const JOB_TITLE_BARBER = "حلاق";
export const JOB_TITLE_SUPERVISOR = "مشرف";

/**
 * المسمى الوظيفي دائماً من علامة "مشرف فرع" في ملف الموظف (تبويب الراتب)، ولا يُدخل يدوياً:
 * مشرف لحساب المشرف، وحلاق لغيره
 */
export function employeeJobTitle(isSupervisor: boolean | number | null | undefined): string {
  return isSupervisor ? JOB_TITLE_SUPERVISOR : JOB_TITLE_BARBER;
}

// ==================== أنواع الوثائق ====================

export type EmployeeDocumentKind = "photo" | "iqama" | "health" | "contract";
export type ExpiringDocumentKind = Exclude<EmployeeDocumentKind, "photo">;

export const EMPLOYEE_DOCUMENT_KINDS: EmployeeDocumentKind[] = [
  "photo",
  "iqama",
  "health",
  "contract",
];
export const EXPIRING_DOCUMENT_KINDS: ExpiringDocumentKind[] = [
  "iqama",
  "health",
  "contract",
];

export const DOCUMENT_KIND_LABELS: Record<EmployeeDocumentKind, string> = {
  photo: "الصورة الشخصية",
  iqama: "الإقامة",
  health: "الشهادة الصحية",
  contract: "عقد العمل",
};

// ==================== حالة الوثيقة ====================

export type DocumentStatus =
  | "expired"
  | "critical"
  | "warning"
  | "valid"
  | "missing";

export const DOCUMENT_STATUSES: DocumentStatus[] = [
  "expired",
  "critical",
  "warning",
  "missing",
  "valid",
];

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  expired: "منتهية",
  critical: "حرجة",
  warning: "قريبة الانتهاء",
  valid: "سارية",
  missing: "بدون تاريخ",
};

/** خلال 7 أيام أو أقل: حرجة */
export const DOCUMENT_CRITICAL_DAYS = 7;

/** نافذة التنبيه لكل وثيقة (العقد يُتابع قبل شهرين لتجهيز التجديد أو إنهاء الخدمة) */
export const DOCUMENT_WARNING_DAYS: Record<ExpiringDocumentKind, number> = {
  iqama: 30,
  health: 30,
  contract: 60,
};

/** ترتيب الخطورة: الأعلى أولاً */
const STATUS_SEVERITY: Record<DocumentStatus, number> = {
  expired: 4,
  critical: 3,
  warning: 2,
  missing: 1,
  valid: 0,
};

const DAY_MS = 86_400_000;

function ymdToUtcMs(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** تاريخ الوثيقة كيوم في الرياض (YYYY-MM-DD) أو null */
export function documentDay(
  value: Date | string | null | undefined
): string | null {
  return toVoucherDateString(value ?? null);
}

/**
 * عدد الأيام من اليوم (حسب الرياض) حتى تاريخ الانتهاء
 * 0 = تنتهي اليوم، سالب = منتهية
 */
export function daysUntil(
  expiry: Date | string | null | undefined,
  now: Date | string = new Date()
): number | null {
  const expiryDay = documentDay(expiry);
  const today = documentDay(now);
  if (!expiryDay || !today) return null;
  return Math.round((ymdToUtcMs(expiryDay) - ymdToUtcMs(today)) / DAY_MS);
}

/** حالة الوثيقة من الأيام المتبقية */
export function documentStatusFor(
  kind: ExpiringDocumentKind,
  daysLeft: number | null
): DocumentStatus {
  if (daysLeft === null) return "missing";
  if (daysLeft < 0) return "expired";
  if (daysLeft <= DOCUMENT_CRITICAL_DAYS) return "critical";
  if (daysLeft <= DOCUMENT_WARNING_DAYS[kind]) return "warning";
  return "valid";
}

export interface DocumentExpiryInfo {
  /** YYYY-MM-DD (يوم الرياض) أو null */
  expiry: string | null;
  daysLeft: number | null;
  status: DocumentStatus;
}

export function describeDocumentExpiry(
  kind: ExpiringDocumentKind,
  expiry: Date | string | null | undefined,
  now: Date | string = new Date()
): DocumentExpiryInfo {
  const day = documentDay(expiry);
  const daysLeft = day ? daysUntil(day, now) : null;
  return { expiry: day, daysLeft, status: documentStatusFor(kind, daysLeft) };
}

/** أسوأ حالة بين عدة وثائق (لشارة واحدة في الجدول) */
export function worstDocumentStatus(
  statuses: DocumentStatus[]
): DocumentStatus {
  if (statuses.length === 0) return "missing";
  return statuses.reduce((worst, s) =>
    STATUS_SEVERITY[s] > STATUS_SEVERITY[worst] ? s : worst
  );
}

export function compareDocumentStatus(
  a: DocumentStatus,
  b: DocumentStatus
): number {
  return STATUS_SEVERITY[b] - STATUS_SEVERITY[a];
}

/** وصف الأيام المتبقية: "منتهية منذ 3 يوم" / "تنتهي اليوم" / "متبقي 12 يوم" */
export function formatDaysLeft(daysLeft: number | null): string {
  if (daysLeft === null) return "لا يوجد تاريخ";
  if (daysLeft < 0) return `منتهية منذ ${Math.abs(daysLeft)} يوم`;
  if (daysLeft === 0) return "تنتهي اليوم";
  if (daysLeft === 1) return "تنتهي غداً";
  return `متبقي ${daysLeft} يوم`;
}

const ARABIC_DATE_FORMAT = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

/** تاريخ ميلادي بالعربية: ٣٠ أكتوبر ٢٠٢٦ (أو "-") */
export function formatArabicDate(
  value: Date | string | null | undefined
): string {
  const day = documentDay(value);
  if (!day) return "-";
  return ARABIC_DATE_FORMAT.format(new Date(ymdToUtcMs(day)));
}

/**
 * قيمة التاريخ للتخزين في أعمدة timestamp: منتصف الليل UTC لنفس اليوم
 * (يقرأه الخادم والمتصفح كنفس يوم الرياض)
 */
export function documentDateToTimestamp(day: string): Date {
  return new Date(ymdToUtcMs(day));
}

// ==================== ملفات الصور والوثائق ====================

/** الحد الأقصى لحجم الملف: 5 ميجابايت */
export const EMPLOYEE_FILE_MAX_BYTES = 5 * 1024 * 1024;

export const EMPLOYEE_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const EMPLOYEE_DOCUMENT_TYPES = [
  ...EMPLOYEE_IMAGE_TYPES,
  "application/pdf",
] as const;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** الأنواع المسموحة: الصورة الشخصية صور فقط، والوثائق صور أو PDF */
export function allowedContentTypes(
  kind: EmployeeDocumentKind
): readonly string[] {
  return kind === "photo" ? EMPLOYEE_IMAGE_TYPES : EMPLOYEE_DOCUMENT_TYPES;
}

/** قيمة accept لحقل اختيار الملف */
export function fileAcceptAttribute(kind: EmployeeDocumentKind): string {
  return allowedContentTypes(kind).join(",");
}

export function normalizeContentType(value: string | null | undefined): string {
  const type = String(value ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  return type === "image/jpg" || type === "image/pjpeg" ? "image/jpeg" : type;
}

export function extensionForContentType(contentType: string): string {
  return EXTENSIONS[normalizeContentType(contentType)] ?? "bin";
}

/** إزالة بادئة data:...;base64, والمسافات */
export function stripDataUrlPrefix(base64: string): string {
  return base64.replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
}

/** حجم الملف بعد فك base64 (بدون فكه فعلياً) */
export function base64ByteLength(base64: string): number {
  const clean = stripDataUrlPrefix(base64);
  if (!clean) return 0;
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - padding;
}

/** نوع الملف الحقيقي من أول البايتات (لا نثق بالنوع المرسل من المتصفح) */
export function sniffContentType(bytes: Uint8Array): string | null {
  const at = (i: number) => bytes[i];
  if (bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff)
    return "image/jpeg";
  if (
    bytes.length >= 8 &&
    at(0) === 0x89 &&
    at(1) === 0x50 &&
    at(2) === 0x4e &&
    at(3) === 0x47 &&
    at(4) === 0x0d &&
    at(5) === 0x0a &&
    at(6) === 0x1a &&
    at(7) === 0x0a
  )
    return "image/png";
  if (
    bytes.length >= 12 &&
    at(0) === 0x52 && // R
    at(1) === 0x49 && // I
    at(2) === 0x46 && // F
    at(3) === 0x46 && // F
    at(8) === 0x57 && // W
    at(9) === 0x45 && // E
    at(10) === 0x42 && // B
    at(11) === 0x50 // P
  )
    return "image/webp";
  if (
    bytes.length >= 5 &&
    at(0) === 0x25 && // %
    at(1) === 0x50 && // P
    at(2) === 0x44 && // D
    at(3) === 0x46 && // F
    at(4) === 0x2d // -
  )
    return "application/pdf";
  return null;
}

export type FileValidationResult =
  | { ok: true; contentType: string }
  | { ok: false; error: string };

function allowedTypesLabel(kind: EmployeeDocumentKind): string {
  return kind === "photo" ? "JPG أو PNG أو WEBP" : "JPG أو PNG أو WEBP أو PDF";
}

/**
 * التحقق من ملف قبل الرفع: النوع والحجم، ومطابقة محتواه للنوع (إن توفرت البايتات)
 */
export function validateEmployeeFile(input: {
  kind: EmployeeDocumentKind;
  contentType: string;
  size: number;
  bytes?: Uint8Array;
}): FileValidationResult {
  const contentType = normalizeContentType(input.contentType);
  const allowed = allowedContentTypes(input.kind);
  if (!allowed.includes(contentType)) {
    return {
      ok: false,
      error: `نوع الملف غير مدعوم، المسموح: ${allowedTypesLabel(input.kind)}`,
    };
  }
  if (!Number.isFinite(input.size) || input.size <= 0) {
    return { ok: false, error: "الملف فارغ" };
  }
  if (input.size > EMPLOYEE_FILE_MAX_BYTES) {
    return { ok: false, error: "حجم الملف يتجاوز 5 ميجابايت" };
  }
  if (input.bytes) {
    const actual = sniffContentType(input.bytes);
    if (actual !== contentType) {
      return { ok: false, error: "محتوى الملف لا يطابق نوعه أو أن الملف تالف" };
    }
  }
  return { ok: true, contentType };
}

/**
 * اسم ملف آمن لمفتاح التخزين: أحرف لاتينية وأرقام و . _ - فقط،
 * بطول محدود وبامتداد يطابق النوع الحقيقي
 */
export function sanitizeFileName(name: string, contentType: string): string {
  const ext = extensionForContentType(contentType);
  const base = String(name ?? "")
    .split(/[\\/]/)
    .pop()!
    .replace(/\.[^.]*$/, "")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/[-.]{2,}/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "")
    .slice(0, 60);
  return `${base || "file"}.${ext}`;
}

// ==================== رقم الإقامة ====================

/** توحيد رقم الإقامة: الأرقام العربية إلى لاتينية وبدون مسافات أو شرطات */
export function normalizeIqamaNumber(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\s-]+/g, "");
}

// ==================== إعدادات الراتب ====================

export interface SalarySettingsValues {
  baseSalary: number;
  overtimeEnabled: boolean;
  overtimeRate: number;
  isSupervisor: boolean;
  supervisorIncentive: number;
  fixedDeduction: number;
  fixedDeductionReason: string | null;
  bankName: string | null;
  bankAccount: string | null;
  iban: string | null;
}

/** القيم التي يطبقها محرك الرواتب عند عدم وجود إعدادات للموظف */
export const DEFAULT_SALARY_SETTINGS: SalarySettingsValues = {
  baseSalary: DEFAULT_BASE_SALARY,
  overtimeEnabled: false,
  overtimeRate: DEFAULT_OVERTIME_AMOUNT,
  isSupervisor: false,
  supervisorIncentive: DEFAULT_SUPERVISOR_INCENTIVE,
  fixedDeduction: 0,
  fixedDeductionReason: null,
  bankName: null,
  bankAccount: null,
  iban: null,
};

/** الحد الأعلى المعقول لأي مبلغ شهري في الإعدادات */
export const SALARY_AMOUNT_MAX = 1_000_000;

/** توحيد الآيبان: بدون مسافات وبأحرف كبيرة */
export function normalizeIban(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/[\s-]+/g, "")
    .toUpperCase();
}

/** التحقق من الآيبان (الصيغة + رقم التحقق mod 97)، والآيبان السعودي 24 خانة */
export function isValidIban(value: string | null | undefined): boolean {
  const iban = normalizeIban(value);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  if (iban.startsWith("SA") && !/^SA\d{22}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    const digits = code >= 65 ? String(code - 55) : ch;
    for (const digit of digits) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder === 1;
}
