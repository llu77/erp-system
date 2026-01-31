/**
 * خدمة التحقق من صحة البيانات المالية
 * Financial Data Validation Service
 * 
 * نظام شامل للتحقق من صحة جميع البيانات المالية على مستوى الخادم
 */

import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { branches, employees, customers } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// ==================== أنواع البيانات ====================

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  value?: unknown;
}

export interface ValidationResult<T = unknown> {
  success: boolean;
  data?: T;
  errors: ValidationError[];
}

export interface AmountValidationOptions {
  allowNegative?: boolean;
  allowZero?: boolean;
  min?: number;
  max?: number;
  precision?: number;
  fieldName?: string;
}

export interface DateValidationOptions {
  allowFuture?: boolean;
  allowPast?: boolean;
  maxDaysInPast?: number;
  maxDaysInFuture?: number;
  fieldName?: string;
}

// ==================== ثوابت التحقق ====================

export const VALIDATION_LIMITS = {
  // حدود المبالغ
  MAX_AMOUNT: 10_000_000, // 10 مليون ريال كحد أقصى
  MIN_AMOUNT: 0,
  MAX_DECIMAL_PLACES: 2,
  
  // حدود التواريخ
  MAX_DAYS_IN_PAST: 365, // سنة كحد أقصى للتواريخ القديمة
  MAX_DAYS_IN_FUTURE: 30, // شهر كحد أقصى للتواريخ المستقبلية
  
  // حدود النصوص
  MAX_NOTE_LENGTH: 1000,
  MAX_REASON_LENGTH: 500,
  
  // حدود الملفات
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 ميجابايت
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
} as const;

// ==================== رسائل الخطأ ====================

export const ERROR_MESSAGES = {
  // أخطاء المبالغ
  AMOUNT_REQUIRED: "المبلغ مطلوب",
  AMOUNT_INVALID: "المبلغ يجب أن يكون رقماً صالحاً",
  AMOUNT_NEGATIVE: "المبلغ لا يمكن أن يكون سالباً",
  AMOUNT_ZERO: "المبلغ لا يمكن أن يكون صفراً",
  AMOUNT_TOO_SMALL: "المبلغ أقل من الحد الأدنى المسموح",
  AMOUNT_TOO_LARGE: "المبلغ يتجاوز الحد الأقصى المسموح",
  AMOUNT_PRECISION: "المبلغ يجب ألا يتجاوز خانتين عشريتين",
  
  // أخطاء التواريخ
  DATE_REQUIRED: "التاريخ مطلوب",
  DATE_INVALID: "التاريخ غير صالح",
  DATE_FUTURE: "لا يمكن إدخال تاريخ مستقبلي",
  DATE_TOO_OLD: "التاريخ قديم جداً",
  DATE_TOO_FAR_FUTURE: "التاريخ بعيد جداً في المستقبل",
  
  // أخطاء العلاقات
  BRANCH_NOT_FOUND: "الفرع غير موجود",
  EMPLOYEE_NOT_FOUND: "الموظف غير موجود",
  CUSTOMER_NOT_FOUND: "العميل غير موجود",
  
  // أخطاء الملفات
  FILE_REQUIRED: "الملف مطلوب",
  FILE_TOO_LARGE: "حجم الملف يتجاوز الحد المسموح",
  FILE_TYPE_INVALID: "نوع الملف غير مدعوم",
  
  // أخطاء عامة
  FIELD_REQUIRED: "هذا الحقل مطلوب",
  FIELD_TOO_LONG: "النص يتجاوز الحد المسموح",
} as const;

// ==================== دوال التحقق الأساسية ====================

/**
 * التحقق من صحة المبلغ المالي
 */
export function validateAmount(
  value: unknown,
  options: AmountValidationOptions = {}
): ValidationResult<number> {
  const {
    allowNegative = false,
    allowZero = true,
    min = VALIDATION_LIMITS.MIN_AMOUNT,
    max = VALIDATION_LIMITS.MAX_AMOUNT,
    precision = VALIDATION_LIMITS.MAX_DECIMAL_PLACES,
    fieldName = "المبلغ",
  } = options;

  const errors: ValidationError[] = [];

  // التحقق من وجود القيمة
  if (value === null || value === undefined || value === "") {
    errors.push({
      code: "AMOUNT_REQUIRED",
      message: `${fieldName} مطلوب`,
      field: fieldName,
      value,
    });
    return { success: false, errors };
  }

  // تحويل القيمة إلى رقم
  const num = typeof value === "string" ? parseFloat(value) : Number(value);

  // التحقق من أن القيمة رقم صالح
  if (Number.isNaN(num)) {
    errors.push({
      code: "AMOUNT_INVALID",
      message: `${fieldName} يجب أن يكون رقماً صالحاً`,
      field: fieldName,
      value,
    });
    return { success: false, errors };
  }

  // التحقق من أن الرقم محدود
  if (!Number.isFinite(num)) {
    errors.push({
      code: "AMOUNT_INVALID",
      message: `${fieldName} يجب أن يكون رقماً محدوداً`,
      field: fieldName,
      value,
    });
    return { success: false, errors };
  }

  // التحقق من الأرقام السالبة
  if (!allowNegative && num < 0) {
    errors.push({
      code: "AMOUNT_NEGATIVE",
      message: `${fieldName} لا يمكن أن يكون سالباً`,
      field: fieldName,
      value,
    });
    return { success: false, errors };
  }

  // التحقق من الصفر
  if (!allowZero && num === 0) {
    errors.push({
      code: "AMOUNT_ZERO",
      message: `${fieldName} لا يمكن أن يكون صفراً`,
      field: fieldName,
      value,
    });
    return { success: false, errors };
  }

  // التحقق من الحد الأدنى (فقط إذا لم يكن الرقم سالباً مسموحاً به)
  if (!allowNegative && num < min) {
    errors.push({
      code: "AMOUNT_TOO_SMALL",
      message: `${fieldName} يجب أن يكون أكبر من أو يساوي ${min}`,
      field: fieldName,
      value,
    });
    return { success: false, errors };
  }

  // التحقق من الحد الأقصى
  if (num > max) {
    errors.push({
      code: "AMOUNT_TOO_LARGE",
      message: `${fieldName} يجب أن يكون أقل من أو يساوي ${max.toLocaleString("ar-SA")} ريال`,
      field: fieldName,
      value,
    });
    return { success: false, errors };
  }

  // التحقق من دقة الأرقام العشرية
  const decimalPart = num.toString().split(".")[1];
  if (decimalPart && decimalPart.length > precision) {
    errors.push({
      code: "AMOUNT_PRECISION",
      message: `${fieldName} يجب ألا يتجاوز ${precision} خانات عشرية`,
      field: fieldName,
      value,
    });
    return { success: false, errors };
  }

  return { success: true, data: num, errors: [] };
}

/**
 * التحقق من صحة التاريخ
 */
export function validateDate(
  value: unknown,
  options: DateValidationOptions = {}
): ValidationResult<Date> {
  const {
    // السماح بالتواريخ المستقبلية افتراضياً (مع قيد عدم التكرار لنفس التاريخ)
    allowFuture = true,
    allowPast = true,
    maxDaysInPast = VALIDATION_LIMITS.MAX_DAYS_IN_PAST,
    maxDaysInFuture = VALIDATION_LIMITS.MAX_DAYS_IN_FUTURE,
    fieldName = "التاريخ",
  } = options;

  const errors: ValidationError[] = [];

  // التحقق من وجود القيمة
  if (value === null || value === undefined || value === "") {
    errors.push({
      code: "DATE_REQUIRED",
      message: `${fieldName} مطلوب`,
      field: fieldName,
      value,
    });
    return { success: false, errors };
  }

  // تحويل القيمة إلى تاريخ
  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "string" || typeof value === "number") {
    date = new Date(value);
  } else {
    errors.push({
      code: "DATE_INVALID",
      message: `${fieldName} يجب أن يكون تاريخاً صالحاً`,
      field: fieldName,
      value,
    });
    return { success: false, errors };
  }

  // التحقق من صلاحية التاريخ
  if (Number.isNaN(date.getTime())) {
    errors.push({
      code: "DATE_INVALID",
      message: `${fieldName} غير صالح`,
      field: fieldName,
      value,
    });
    return { success: false, errors };
  }

  const now = new Date();
  // إضافة هامش 24 ساعة للتعامل مع اختلافات المناطق الزمنية
  const todayWithBuffer = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  todayWithBuffer.setHours(23, 59, 59, 999); // نهاية اليوم الحالي
  const inputDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  // التحقق من التواريخ المستقبلية (السماح بتاريخ اليوم الحالي)
  if (!allowFuture && inputDate > todayWithBuffer) {
    errors.push({
      code: "DATE_FUTURE",
      message: `${fieldName} لا يمكن أن يكون في المستقبل (التاريخ المدخل: ${inputDate.toLocaleDateString('ar-SA')})`,
      field: fieldName,
      value,
    });
    return { success: false, errors };
  }

  // التحقق من التواريخ القديمة جداً
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (allowPast && maxDaysInPast > 0) {
    const minDate = new Date(today);
    minDate.setDate(minDate.getDate() - maxDaysInPast);
    if (inputDate < minDate) {
      errors.push({
        code: "DATE_TOO_OLD",
        message: `${fieldName} لا يمكن أن يكون أقدم من ${maxDaysInPast} يوم`,
        field: fieldName,
        value,
      });
      return { success: false, errors };
    }
  }

  // التحقق من التواريخ البعيدة في المستقبل
  if (allowFuture && maxDaysInFuture > 0) {
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + maxDaysInFuture);
    if (inputDate > maxDate) {
      errors.push({
        code: "DATE_TOO_FAR_FUTURE",
        message: `${fieldName} لا يمكن أن يكون أبعد من ${maxDaysInFuture} يوم في المستقبل`,
        field: fieldName,
        value,
      });
      return { success: false, errors };
    }
  }

  return { success: true, data: date, errors: [] };
}

/**
 * التحقق من صحة النص
 */
export function validateText(
  value: unknown,
  options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    fieldName?: string;
  } = {}
): ValidationResult<string> {
  const {
    required = false,
    minLength = 0,
    maxLength = VALIDATION_LIMITS.MAX_NOTE_LENGTH,
    fieldName = "النص",
  } = options;

  const errors: ValidationError[] = [];

  // التحقق من وجود القيمة
  if (value === null || value === undefined || value === "") {
    if (required) {
      errors.push({
        code: "FIELD_REQUIRED",
        message: `${fieldName} مطلوب`,
        field: fieldName,
        value,
      });
      return { success: false, errors };
    }
    return { success: true, data: "", errors: [] };
  }

  const text = String(value).trim();

  // التحقق من الحد الأدنى للطول
  if (text.length < minLength) {
    errors.push({
      code: "FIELD_TOO_SHORT",
      message: `${fieldName} يجب أن يكون على الأقل ${minLength} حرف`,
      field: fieldName,
      value,
    });
    return { success: false, errors };
  }

  // التحقق من الحد الأقصى للطول
  if (text.length > maxLength) {
    errors.push({
      code: "FIELD_TOO_LONG",
      message: `${fieldName} يجب ألا يتجاوز ${maxLength} حرف`,
      field: fieldName,
      value,
    });
    return { success: false, errors };
  }

  return { success: true, data: text, errors: [] };
}

// ==================== دوال التحقق من العلاقات ====================

/**
 * التحقق من وجود الفرع
 */
export async function validateBranchExists(
  branchId: number
): Promise<ValidationResult<number>> {
  const errors: ValidationError[] = [];

  const idValidation = validateAmount(branchId, {
    allowZero: false,
    fieldName: "معرف الفرع",
  });

  if (!idValidation.success) {
    return idValidation;
  }

  try {
    const db = await getDb();
    if (!db) {
      errors.push({
        code: "DATABASE_ERROR",
        message: "قاعدة البيانات غير متاحة",
        field: "branchId",
        value: branchId,
      });
      return { success: false, errors };
    }
    const branch = await db
      .select({ id: branches.id })
      .from(branches)
      .where(eq(branches.id, branchId))
      .limit(1);

    if (branch.length === 0) {
      errors.push({
        code: "BRANCH_NOT_FOUND",
        message: ERROR_MESSAGES.BRANCH_NOT_FOUND,
        field: "branchId",
        value: branchId,
      });
      return { success: false, errors };
    }

    return { success: true, data: branchId, errors: [] };
  } catch (error) {
    errors.push({
      code: "DATABASE_ERROR",
      message: "خطأ في التحقق من الفرع",
      field: "branchId",
      value: branchId,
    });
    return { success: false, errors };
  }
}

/**
 * التحقق من وجود الموظف
 */
export async function validateEmployeeExists(
  employeeId: number
): Promise<ValidationResult<number>> {
  const errors: ValidationError[] = [];

  const idValidation = validateAmount(employeeId, {
    allowZero: false,
    fieldName: "معرف الموظف",
  });

  if (!idValidation.success) {
    return idValidation;
  }

  try {
    const db = await getDb();
    if (!db) {
      errors.push({
        code: "DATABASE_ERROR",
        message: "قاعدة البيانات غير متاحة",
        field: "employeeId",
        value: employeeId,
      });
      return { success: false, errors };
    }
    const employee = await db
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.id, employeeId))
      .limit(1);

    if (employee.length === 0) {
      errors.push({
        code: "EMPLOYEE_NOT_FOUND",
        message: ERROR_MESSAGES.EMPLOYEE_NOT_FOUND,
        field: "employeeId",
        value: employeeId,
      });
      return { success: false, errors };
    }

    return { success: true, data: employeeId, errors: [] };
  } catch (error) {
    errors.push({
      code: "DATABASE_ERROR",
      message: "خطأ في التحقق من الموظف",
      field: "employeeId",
      value: employeeId,
    });
    return { success: false, errors };
  }
}

/**
 * التحقق من وجود العميل
 */
export async function validateCustomerExists(
  customerId: number
): Promise<ValidationResult<number>> {
  const errors: ValidationError[] = [];

  const idValidation = validateAmount(customerId, {
    allowZero: false,
    fieldName: "معرف العميل",
  });

  if (!idValidation.success) {
    return idValidation;
  }

  try {
    const db = await getDb();
    if (!db) {
      errors.push({
        code: "DATABASE_ERROR",
        message: "قاعدة البيانات غير متاحة",
        field: "customerId",
        value: customerId,
      });
      return { success: false, errors };
    }
    const customer = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);

    if (customer.length === 0) {
      errors.push({
        code: "CUSTOMER_NOT_FOUND",
        message: ERROR_MESSAGES.CUSTOMER_NOT_FOUND,
        field: "customerId",
        value: customerId,
      });
      return { success: false, errors };
    }

    return { success: true, data: customerId, errors: [] };
  } catch (error) {
    errors.push({
      code: "DATABASE_ERROR",
      message: "خطأ في التحقق من العميل",
      field: "customerId",
      value: customerId,
    });
    return { success: false, errors };
  }
}

// ==================== دوال التحقق المركبة ====================

/**
 * التحقق من بيانات الإيراد اليومي
 */
export interface DailyRevenueInput {
  branchId: number;
  date: Date | string;
  cash: number | string;
  network: number | string;
  paidInvoices?: number | string;
  loyalty?: number | string;
  paidInvoicesNote?: string;
  paidInvoicesCustomer?: string;
}

export async function validateDailyRevenueInput(
  input: DailyRevenueInput
): Promise<ValidationResult<{
  branchId: number;
  date: Date;
  cash: number;
  network: number;
  paidInvoices: number;
  loyalty: number;
  total: number;
  paidInvoicesNote?: string;
  paidInvoicesCustomer?: string;
}>> {
  const errors: ValidationError[] = [];

  // التحقق من الفرع
  const branchValidation = await validateBranchExists(input.branchId);
  if (!branchValidation.success) {
    errors.push(...branchValidation.errors);
  }

  // التحقق من التاريخ
  const dateValidation = validateDate(input.date, {
    allowFuture: false,
    maxDaysInPast: 30, // السماح بإدخال إيرادات حتى 30 يوم في الماضي
    fieldName: "تاريخ الإيراد",
  });
  if (!dateValidation.success) {
    errors.push(...dateValidation.errors);
  }

  // التحقق من الكاش
  const cashValidation = validateAmount(input.cash, {
    fieldName: "الكاش",
  });
  if (!cashValidation.success) {
    errors.push(...cashValidation.errors);
  }

  // التحقق من الشبكة
  const networkValidation = validateAmount(input.network, {
    fieldName: "الشبكة",
  });
  if (!networkValidation.success) {
    errors.push(...networkValidation.errors);
  }

  // التحقق من فواتير المدفوع (اختياري)
  let paidInvoices = 0;
  if (input.paidInvoices !== undefined && input.paidInvoices !== null && input.paidInvoices !== "") {
    const paidInvoicesValidation = validateAmount(input.paidInvoices, {
      fieldName: "فواتير المدفوع",
    });
    if (!paidInvoicesValidation.success) {
      errors.push(...paidInvoicesValidation.errors);
    } else {
      paidInvoices = paidInvoicesValidation.data!;
      
      // إذا كان هناك مبلغ مدفوع، يجب وجود سبب واسم عميل
      if (paidInvoices > 0) {
        if (!input.paidInvoicesNote || input.paidInvoicesNote.trim() === "") {
          errors.push({
            code: "PAID_INVOICES_NOTE_REQUIRED",
            message: "يجب إدخال سبب فواتير المدفوع",
            field: "paidInvoicesNote",
          });
        }
        if (!input.paidInvoicesCustomer || input.paidInvoicesCustomer.trim() === "") {
          errors.push({
            code: "PAID_INVOICES_CUSTOMER_REQUIRED",
            message: "يجب اختيار اسم العميل لفواتير المدفوع",
            field: "paidInvoicesCustomer",
          });
        }
      }
    }
  }

  // التحقق من الولاء (اختياري)
  let loyalty = 0;
  if (input.loyalty !== undefined && input.loyalty !== null && input.loyalty !== "") {
    const loyaltyValidation = validateAmount(input.loyalty, {
      fieldName: "الولاء",
    });
    if (!loyaltyValidation.success) {
      errors.push(...loyaltyValidation.errors);
    } else {
      loyalty = loyaltyValidation.data!;
    }
  }

  // إذا كانت هناك أخطاء، إرجاعها
  if (errors.length > 0) {
    return { success: false, errors };
  }

  // حساب الإجمالي
  const cash = cashValidation.data!;
  const network = networkValidation.data!;
  const total = cash + network + paidInvoices + loyalty;

  return {
    success: true,
    data: {
      branchId: branchValidation.data!,
      date: dateValidation.data!,
      cash,
      network,
      paidInvoices,
      loyalty,
      total,
      paidInvoicesNote: input.paidInvoicesNote?.trim(),
      paidInvoicesCustomer: input.paidInvoicesCustomer?.trim(),
    },
    errors: [],
  };
}

/**
 * التحقق من بيانات المصروف
 */
export interface ExpenseInput {
  branchId: number;
  categoryId: number;
  amount: number | string;
  description: string;
  expenseDate: Date | string;
}

export async function validateExpenseInput(
  input: ExpenseInput
): Promise<ValidationResult<{
  branchId: number;
  categoryId: number;
  amount: number;
  description: string;
  expenseDate: Date;
}>> {
  const errors: ValidationError[] = [];

  // التحقق من الفرع
  const branchValidation = await validateBranchExists(input.branchId);
  if (!branchValidation.success) {
    errors.push(...branchValidation.errors);
  }

  // التحقق من التصنيف
  const categoryValidation = validateAmount(input.categoryId, {
    allowZero: false,
    fieldName: "تصنيف المصروف",
  });
  if (!categoryValidation.success) {
    errors.push(...categoryValidation.errors);
  }

  // التحقق من المبلغ
  const amountValidation = validateAmount(input.amount, {
    allowZero: false,
    fieldName: "مبلغ المصروف",
  });
  if (!amountValidation.success) {
    errors.push(...amountValidation.errors);
  }

  // التحقق من الوصف
  const descriptionValidation = validateText(input.description, {
    required: true,
    minLength: 3,
    maxLength: 500,
    fieldName: "وصف المصروف",
  });
  if (!descriptionValidation.success) {
    errors.push(...descriptionValidation.errors);
  }

  // التحقق من التاريخ
  const dateValidation = validateDate(input.expenseDate, {
    allowFuture: false,
    maxDaysInPast: 90, // السماح بإدخال مصروفات حتى 90 يوم في الماضي
    fieldName: "تاريخ المصروف",
  });
  if (!dateValidation.success) {
    errors.push(...dateValidation.errors);
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      branchId: branchValidation.data!,
      categoryId: categoryValidation.data!,
      amount: amountValidation.data!,
      description: descriptionValidation.data!,
      expenseDate: dateValidation.data!,
    },
    errors: [],
  };
}

// ==================== دالة مساعدة لرمي أخطاء tRPC ====================

/**
 * تحويل أخطاء التحقق إلى خطأ tRPC
 */
export function throwValidationError(errors: ValidationError[]): never {
  const message = errors.map((e) => e.message).join("، ");
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: `خطأ في التحقق: ${message}`,
    cause: errors,
  });
}

/**
 * التحقق ورمي الخطأ إذا فشل
 */
export function assertValid<T>(result: ValidationResult<T>): T {
  if (!result.success) {
    throwValidationError(result.errors);
  }
  return result.data!;
}
