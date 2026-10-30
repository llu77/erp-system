/**
 * ملف الموظف: مدخلات الإجراءات وقواعد بناء التحديثات (دوال نقية قابلة للاختبار)
 */

import { z } from "zod";
import type {
  InsertEmployee,
  InsertEmployeeSalarySetting,
} from "../../drizzle/schema";
import { parseDateOnly } from "../../shared/endOfService";
import {
  DEFAULT_SALARY_SETTINGS,
  EMPLOYEE_DOCUMENT_KINDS,
  EMPLOYEE_FILE_MAX_BYTES,
  SALARY_AMOUNT_MAX,
  documentDateToTimestamp,
  documentDay,
  isValidIban,
  normalizeIban,
  normalizeIqamaNumber,
  sanitizeFileName,
  stripDataUrlPrefix,
  validateEmployeeFile,
  type EmployeeDocumentKind,
  type SalarySettingsValues,
} from "../../shared/employeeFile";

// ==================== التواريخ ====================

const ymdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "صيغة التاريخ يجب أن تكون YYYY-MM-DD")
  .refine(value => parseDateOnly(value) !== null, "التاريخ غير صحيح");

/**
 * تاريخ وثيقة: YYYY-MM-DD أو Date (يُحوّل إلى يوم الرياض)
 * عدم الإرسال يبقي القيمة الحالية، وnull يمسحها
 */
export const documentDateInput = z
  .union([z.date(), ymdSchema])
  .transform(value => documentDay(value) as string)
  .nullable()
  .optional();

const hireDateInput = ymdSchema.nullable().optional();

/** نص اختياري: عدم الإرسال يبقي القيمة، وnull أو نص فارغ يمسحها */
const optionalText = (max: number, message: string) =>
  z.string().trim().max(max, message).nullable().optional();

const iqamaNumberInput = z
  .string()
  .transform(normalizeIqamaNumber)
  .pipe(
    z
      .string()
      .regex(/^\d{0,20}$/, "رقم الإقامة يجب أن يكون أرقاماً فقط (حتى 20 رقماً)")
  )
  .nullable()
  .optional();

// ==================== بيانات الموظف ====================

const employeeDataFields = {
  code: z
    .string()
    .trim()
    .min(1, "كود الموظف مطلوب")
    .max(50, "كود الموظف طويل جداً"),
  name: z
    .string()
    .trim()
    .min(1, "اسم الموظف مطلوب")
    .max(255, "اسم الموظف طويل جداً"),
  branchId: z.number().int().positive("اختر فرعاً صحيحاً"),
  phone: optionalText(50, "رقم الهاتف طويل جداً"),
  position: optionalText(100, "المسمى الوظيفي طويل جداً"),
  isActive: z.boolean(),
  iqamaNumber: iqamaNumberInput,
  iqamaExpiryDate: documentDateInput,
  healthCertExpiryDate: documentDateInput,
  contractExpiryDate: documentDateInput,
  hireDate: hireDateInput,
  nationality: optionalText(100, "الجنسية طويلة جداً"),
};

export const employeeCreateSchema = z.object({
  ...employeeDataFields,
  branchId: employeeDataFields.branchId.optional(),
  isActive: employeeDataFields.isActive.optional(),
});

/** تحديث موظف: كل الحقول اختيارية (عدم الإرسال = إبقاء القيمة) */
export const employeeUpdateSchema = z.object({
  id: z.number().int().positive(),
  code: employeeDataFields.code.optional(),
  name: employeeDataFields.name.optional(),
  branchId: employeeDataFields.branchId.optional(),
  phone: employeeDataFields.phone,
  position: employeeDataFields.position,
  isActive: employeeDataFields.isActive.optional(),
  iqamaNumber: employeeDataFields.iqamaNumber,
  iqamaExpiryDate: employeeDataFields.iqamaExpiryDate,
  healthCertExpiryDate: employeeDataFields.healthCertExpiryDate,
  contractExpiryDate: employeeDataFields.contractExpiryDate,
  hireDate: employeeDataFields.hireDate,
  nationality: employeeDataFields.nationality,
});

export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;
export type EmployeeUpdateInput = z.infer<typeof employeeUpdateSchema>;

/** بيانات الوثائق الحالية للموظف (للمقارنة قبل تسجيل من أدخلها) */
export interface EmployeeDocumentSnapshot {
  iqamaNumber: string | null;
  iqamaExpiryDate: Date | string | null;
  healthCertExpiryDate: Date | string | null;
  contractExpiryDate: Date | string | null;
}

const DOCUMENT_DATE_FIELDS = [
  "iqamaExpiryDate",
  "healthCertExpiryDate",
  "contractExpiryDate",
] as const;

function textOrNull(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

/**
 * حقول الوثائق التي ستتغير فعلاً (مقارنة بيوم الرياض ورقم الإقامة الموحد)
 * current = null: موظف جديد (لا قيم سابقة)
 */
export function changedDocumentFields(
  input: Partial<
    Pick<
      EmployeeUpdateInput,
      "iqamaNumber" | (typeof DOCUMENT_DATE_FIELDS)[number]
    >
  >,
  current: EmployeeDocumentSnapshot | null
): string[] {
  const changed: string[] = [];
  if (input.iqamaNumber !== undefined) {
    const next = textOrNull(input.iqamaNumber);
    const prev = current
      ? textOrNull(normalizeIqamaNumber(current.iqamaNumber))
      : null;
    if (next !== prev) changed.push("iqamaNumber");
  }
  for (const field of DOCUMENT_DATE_FIELDS) {
    const value = input[field];
    if (value === undefined) continue;
    const prev = current ? documentDay(current[field]) : null;
    if ((value ?? null) !== prev) changed.push(field);
  }
  return changed;
}

/**
 * بناء تحديث الموظف من مدخلات الموظفين (الإدارة):
 * - الحقل غير المرسل يبقى كما هو، وnull أو النص الفارغ يمسحه
 * - تواريخ الوثائق تُخزن كمنتصف ليل UTC لنفس اليوم
 * - تعديل بيانات الوثائق يسجل من أدخلها ومتى (infoSubmittedBy / infoSubmittedAt)
 */
export function buildEmployeeUpdatePatch(
  input: Omit<EmployeeUpdateInput, "id">,
  current: EmployeeDocumentSnapshot | null,
  actorId: number,
  now: Date = new Date()
): { patch: Partial<InsertEmployee>; documentsChanged: boolean } {
  const patch: Partial<InsertEmployee> = {};
  if (input.code !== undefined) patch.code = input.code;
  if (input.name !== undefined) patch.name = input.name;
  if (input.branchId !== undefined) patch.branchId = input.branchId;
  if (input.isActive !== undefined) patch.isActive = input.isActive;
  if (input.phone !== undefined) patch.phone = textOrNull(input.phone);
  if (input.position !== undefined) patch.position = textOrNull(input.position);
  if (input.nationality !== undefined)
    patch.nationality = textOrNull(input.nationality);
  if (input.hireDate !== undefined) patch.hireDate = input.hireDate;
  if (input.iqamaNumber !== undefined)
    patch.iqamaNumber = textOrNull(input.iqamaNumber);
  for (const field of DOCUMENT_DATE_FIELDS) {
    const value = input[field];
    if (value === undefined) continue;
    patch[field] = value === null ? null : documentDateToTimestamp(value);
  }

  const documentsChanged = changedDocumentFields(input, current).length > 0;
  if (documentsChanged) {
    patch.infoSubmittedBy = actorId;
    patch.infoSubmittedAt = now;
  }
  return { patch, documentsChanged };
}

/** هل المدخلات تحتوي على أي من بيانات الوثائق؟ */
export function hasDocumentFields(
  input: Partial<EmployeeUpdateInput>
): boolean {
  return (
    input.iqamaNumber !== undefined ||
    DOCUMENT_DATE_FIELDS.some(field => input[field] !== undefined)
  );
}

// ==================== رفع الصور والوثائق ====================

export const documentKindSchema = z.enum(
  EMPLOYEE_DOCUMENT_KINDS as [EmployeeDocumentKind, ...EmployeeDocumentKind[]]
);

/** base64 لملف 5 ميجابايت ≈ 7 ملايين حرف */
const MAX_BASE64_LENGTH = Math.ceil((EMPLOYEE_FILE_MAX_BYTES * 4) / 3) + 1024;

export const documentUploadSchema = z.object({
  employeeId: z.number().int().positive(),
  kind: documentKindSchema,
  base64: z
    .string()
    .min(1, "الملف فارغ")
    .max(MAX_BASE64_LENGTH, "حجم الملف يتجاوز 5 ميجابايت"),
  contentType: z.string().max(100),
  fileName: z.string().max(255).default(""),
});

export const documentRemoveSchema = z.object({
  employeeId: z.number().int().positive(),
  kind: documentKindSchema,
});

export type DecodedUpload =
  | { ok: true; buffer: Buffer; contentType: string; fileName: string }
  | { ok: false; error: string };

/** فك الملف المرسل والتحقق من نوعه الحقيقي وحجمه، وتوليد اسم ملف آمن */
export function decodeEmployeeUpload(input: {
  kind: EmployeeDocumentKind;
  base64: string;
  contentType: string;
  fileName: string;
}): DecodedUpload {
  const clean = stripDataUrlPrefix(input.base64);
  if (
    !clean ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(clean) ||
    clean.length % 4 === 1
  ) {
    return { ok: false, error: "تعذر قراءة الملف المرسل" };
  }
  const buffer = Buffer.from(clean, "base64");
  const result = validateEmployeeFile({
    kind: input.kind,
    contentType: input.contentType,
    size: buffer.length,
    bytes: buffer,
  });
  if (!result.ok) return result;
  return {
    ok: true,
    buffer,
    contentType: result.contentType,
    fileName: sanitizeFileName(input.fileName, result.contentType),
  };
}

/** مفتاح التخزين: employee-documents/{id}/{kind}-{time}-{random}-{name} */
export function buildDocumentStorageKey(
  employeeId: number,
  kind: EmployeeDocumentKind,
  safeFileName: string,
  unique: string,
  now: Date = new Date()
): string {
  return `employee-documents/${employeeId}/${kind}-${now.getTime()}-${unique}-${safeFileName}`;
}

// ==================== إعدادات الراتب ====================

const amountInput = z
  .number({ error: "أدخل مبلغاً صحيحاً" })
  .min(0, "لا يمكن أن يكون المبلغ سالباً")
  .max(SALARY_AMOUNT_MAX, "المبلغ أكبر من الحد المسموح");

/** حفظ إعدادات الراتب: الحقل غير المرسل يبقى كما هو (أو القيمة الافتراضية عند أول حفظ) */
export const salarySettingsSaveSchema = z.object({
  employeeId: z.number().int().positive(),
  baseSalary: amountInput.optional(),
  overtimeEnabled: z.boolean().optional(),
  overtimeRate: amountInput.optional(),
  isSupervisor: z.boolean().optional(),
  supervisorIncentive: amountInput.optional(),
  fixedDeduction: amountInput.optional(),
  fixedDeductionReason: optionalText(500, "سبب الخصم طويل جداً"),
  bankName: optionalText(100, "اسم البنك طويل جداً"),
  bankAccount: optionalText(50, "رقم الحساب طويل جداً"),
  iban: z
    .string()
    .max(50, "رقم الآيبان طويل جداً")
    .refine(
      value => !normalizeIban(value) || isValidIban(value),
      "رقم الآيبان غير صحيح"
    )
    .nullable()
    .optional(),
});

export type SalarySettingsSaveInput = z.infer<typeof salarySettingsSaveSchema>;

/** تقريب عشري إلى خانتين (2500.555 -> 2500.56) بدون أخطاء التمثيل الثنائي */
function money(value: number): string {
  const shifted = Number(`${value}e2`);
  const cents = Math.round(Number.isFinite(shifted) ? shifted : value * 100);
  return (cents / 100).toFixed(2);
}

function toNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

/** تحويل صف الإعدادات (المبالغ نصوص عشرية) إلى قيم، أو القيم الافتراضية عند عدم وجوده */
export function effectiveSalarySettings(
  row: Partial<Record<keyof SalarySettingsValues, unknown>> | null | undefined
): SalarySettingsValues {
  if (!row) return { ...DEFAULT_SALARY_SETTINGS };
  const d = DEFAULT_SALARY_SETTINGS;
  const text = (value: unknown) =>
    typeof value === "string" && value.trim() ? value : null;
  return {
    baseSalary: toNumber(row.baseSalary, d.baseSalary),
    overtimeEnabled: !!row.overtimeEnabled,
    overtimeRate: toNumber(row.overtimeRate, d.overtimeRate),
    isSupervisor: !!row.isSupervisor,
    supervisorIncentive: toNumber(
      row.supervisorIncentive,
      d.supervisorIncentive
    ),
    fixedDeduction: toNumber(row.fixedDeduction, d.fixedDeduction),
    fixedDeductionReason: text(row.fixedDeductionReason),
    bankName: text(row.bankName),
    bankAccount: text(row.bankAccount),
    iban: text(row.iban),
  };
}

/** أعمدة التحديث للحقول المرسلة فقط (المبالغ بخانتين عشريتين) */
export function buildSalarySettingsPatch(
  input: Omit<SalarySettingsSaveInput, "employeeId">
): Partial<InsertEmployeeSalarySetting> {
  const patch: Partial<InsertEmployeeSalarySetting> = {};
  if (input.baseSalary !== undefined)
    patch.baseSalary = money(input.baseSalary);
  if (input.overtimeEnabled !== undefined)
    patch.overtimeEnabled = input.overtimeEnabled;
  if (input.overtimeRate !== undefined)
    patch.overtimeRate = money(input.overtimeRate);
  if (input.isSupervisor !== undefined) patch.isSupervisor = input.isSupervisor;
  if (input.supervisorIncentive !== undefined)
    patch.supervisorIncentive = money(input.supervisorIncentive);
  if (input.fixedDeduction !== undefined)
    patch.fixedDeduction = money(input.fixedDeduction);
  if (input.fixedDeductionReason !== undefined)
    patch.fixedDeductionReason = textOrNull(input.fixedDeductionReason);
  if (input.bankName !== undefined) patch.bankName = textOrNull(input.bankName);
  if (input.bankAccount !== undefined)
    patch.bankAccount = textOrNull(input.bankAccount);
  if (input.iban !== undefined) patch.iban = normalizeIban(input.iban) || null;
  return patch;
}

/** القيم بعد تطبيق التحديث */
export function mergeSalarySettings(
  previous: SalarySettingsValues,
  input: Omit<SalarySettingsSaveInput, "employeeId">
): SalarySettingsValues {
  return effectiveSalarySettings({
    ...previous,
    ...buildSalarySettingsPatch(input),
  });
}

/**
 * ما يجب تطبيقه على أسطر المسيرات المفتوحة بعد تغيير الإعدادات:
 * الراتب الأساسي وقيمة البدل تُقرأ من الإعدادات عند إعادة الحساب، أما تفعيل البدل
 * والحافز والخصم الثابت فمحفوظة في السطر نفسه، فتُرسل فقط إذا تغيرت حتى لا تُلغى
 * تعديلات يدوية أخرى على السطر
 */
export function buildOpenPayrollOverride(
  previous: SalarySettingsValues,
  next: SalarySettingsValues
): {
  overtimeEnabled?: boolean;
  incentiveAmount?: number;
  otherDeduction?: number;
  otherDeductionReason?: string | null;
} {
  const override: ReturnType<typeof buildOpenPayrollOverride> = {};
  if (previous.overtimeEnabled !== next.overtimeEnabled) {
    override.overtimeEnabled = next.overtimeEnabled;
  }
  const incentiveChanged =
    previous.isSupervisor !== next.isSupervisor ||
    (next.isSupervisor &&
      previous.supervisorIncentive !== next.supervisorIncentive);
  if (incentiveChanged) {
    override.incentiveAmount = next.isSupervisor ? next.supervisorIncentive : 0;
  }
  if (
    previous.fixedDeduction !== next.fixedDeduction ||
    previous.fixedDeductionReason !== next.fixedDeductionReason
  ) {
    override.otherDeduction = next.fixedDeduction;
    override.otherDeductionReason = next.fixedDeductionReason;
  }
  return override;
}
