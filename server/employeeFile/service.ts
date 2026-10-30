/**
 * ملف الموظف في النظام الرئيسي: القراءة من قاعدة البيانات وروابط الصور وإعدادات الراتب
 */

import { and, asc, eq, inArray } from "drizzle-orm";
import {
  branches,
  employeeSalarySettings,
  employees,
  payrollDetails,
  payrolls,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { getEstablishmentForBranch } from "../../shared/branding";
import {
  EXPIRING_DOCUMENT_KINDS,
  compareDocumentStatus,
  describeDocumentExpiry,
  documentDay,
  employeeJobTitle,
  worstDocumentStatus,
  type DocumentStatus,
  type EmployeeDocumentKind,
  type ExpiringDocumentKind,
  type SalarySettingsValues,
} from "../../shared/employeeFile";
import * as payrollService from "../payroll/service";
import {
  buildOpenPayrollOverride,
  buildSalarySettingsPatch,
  effectiveSalarySettings,
  type SalarySettingsSaveInput,
} from "./schemas";

type BaseEmployeeListRow = Awaited<
  ReturnType<typeof import("../db").getAllEmployees>
>[number];

/** صف قائمة الموظفين: روابط صور الوثائق null إلا في قائمة صفحة الموظفين (withImages) */
export type EmployeeListRow = BaseEmployeeListRow & {
  iqamaImageUrl: string | null;
  healthCertImageUrl: string | null;
  contractImageUrl: string | null;
};

export function toEmployeeListRow(row: BaseEmployeeListRow): EmployeeListRow {
  return {
    ...row,
    iqamaImageUrl: null,
    healthCertImageUrl: null,
    contractImageUrl: null,
  };
}

export class EmployeeFileError extends Error {
  constructor(
    message: string,
    public code:
      | "NOT_FOUND"
      | "BAD_REQUEST"
      | "FORBIDDEN"
      | "CONFLICT"
      | "INTERNAL_SERVER_ERROR" = "BAD_REQUEST"
  ) {
    super(message);
    this.name = "EmployeeFileError";
  }
}

async function requireDb() {
  const db = await getDb();
  if (!db)
    throw new EmployeeFileError(
      "قاعدة البيانات غير متاحة",
      "INTERNAL_SERVER_ERROR"
    );
  return db;
}

// ==================== أعمدة الصور ====================

export const IMAGE_COLUMNS = {
  photo: { url: "photoUrl", key: "photoKey" },
  iqama: { url: "iqamaImageUrl", key: "iqamaImageKey" },
  health: { url: "healthCertImageUrl", key: "healthCertImageKey" },
  contract: { url: "contractImageUrl", key: "contractImageKey" },
} as const satisfies Record<EmployeeDocumentKind, { url: string; key: string }>;

const EXPIRY_COLUMNS = {
  iqama: "iqamaExpiryDate",
  health: "healthCertExpiryDate",
  contract: "contractExpiryDate",
} as const satisfies Record<ExpiringDocumentKind, string>;

// ==================== تجديد روابط الصور ====================

const URL_CACHE_TTL_MS = 20 * 60 * 1000;
/** بعد فشل خدمة التخزين: مدة استخدام الروابط المحفوظة قبل إعادة المحاولة */
export const URL_FAILURE_TTL_MS = 60 * 1000;
const URL_CACHE_MAX = 5000;
const STORAGE_TIMEOUT_MS = 5000;
const urlCache = new Map<string, { url: string | null; expiresAt: number }>();
/** قاطع دائرة لخدمة التخزين: بعد أي فشل أو مهلة تُستخدم الروابط المحفوظة حتى هذا الوقت */
let storageDownUntil = 0;

function rememberUrl(key: string, url: string | null, ttl: number) {
  if (urlCache.size >= URL_CACHE_MAX) {
    // حذف الأقدم (ترتيب الإدراج)
    const oldest = Array.from(urlCache.keys()).slice(
      0,
      Math.ceil(URL_CACHE_MAX / 5)
    );
    oldest.forEach(k => urlCache.delete(k));
  }
  urlCache.set(key, { url, expiresAt: Date.now() + ttl });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("storage timeout")), ms);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * رابط الملف من مفتاح التخزين (الروابط المحفوظة قد تنتهي)، مع الرجوع للرابط المحفوظ عند التعذر
 */
export async function resolveStoredFileUrl(
  key: string | null | undefined,
  storedUrl: string | null | undefined
): Promise<string | null> {
  const fallback = storedUrl || null;
  if (!key) return fallback;
  const cached = urlCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.url ?? fallback;
  // خدمة التخزين متعطلة مؤخراً: الرابط المحفوظ فوراً بدل انتظار مهلة كل ملف (قوائم الموظفين والوثائق)
  if (Date.now() < storageDownUntil) return fallback;
  try {
    const { storageGet } = await import("../storage");
    const { url } = await withTimeout(storageGet(key), STORAGE_TIMEOUT_MS);
    rememberUrl(key, url || null, URL_CACHE_TTL_MS);
    return url || fallback;
  } catch (error) {
    rememberUrl(key, null, URL_FAILURE_TTL_MS);
    if (isStorageOutage(error)) storageDownUntil = Date.now() + URL_FAILURE_TTL_MS;
    return fallback;
  }
}

/**
 * تعطل عام لخدمة التخزين (مهلة، فشل اتصال، 5xx، 429، 401) وليس خطأ ملف واحد (مثل 404 لمفتاح غير موجود)
 */
function isStorageOutage(error: unknown): boolean {
  const status = (error as { details?: { statusCode?: unknown } } | null)?.details?.statusCode;
  if (typeof status !== "number") return true;
  return status >= 500 || status === 429 || status === 401;
}

/** للاختبارات: إعادة ضبط حالة خدمة التخزين */
export function resetStorageCircuitForTests() {
  storageDownUntil = 0;
  urlCache.clear();
}

/** تحديث الذاكرة المؤقتة بعد رفع ملف جديد */
export function cacheUploadedFileUrl(key: string, url: string) {
  rememberUrl(key, url, URL_CACHE_TTL_MS);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await fn(items[index]);
      }
    }
  );
  await Promise.all(workers);
  return results;
}

type ImageColumnsRow = {
  [K in EmployeeDocumentKind as (typeof IMAGE_COLUMNS)[K]["url"]]:
    | string
    | null;
} & {
  [K in EmployeeDocumentKind as (typeof IMAGE_COLUMNS)[K]["key"]]:
    | string
    | null;
};

type ResolvedImages = Record<EmployeeDocumentKind, string | null>;

async function resolveRowImages(
  row: ImageColumnsRow,
  kinds: readonly EmployeeDocumentKind[]
): Promise<ResolvedImages> {
  const resolved: ResolvedImages = {
    photo: null,
    iqama: null,
    health: null,
    contract: null,
  };
  await Promise.all(
    kinds.map(async kind => {
      const cols = IMAGE_COLUMNS[kind];
      resolved[kind] = await resolveStoredFileUrl(row[cols.key], row[cols.url]);
    })
  );
  return resolved;
}

const imageSelection = {
  photoUrl: employees.photoUrl,
  photoKey: employees.photoKey,
  iqamaImageUrl: employees.iqamaImageUrl,
  iqamaImageKey: employees.iqamaImageKey,
  healthCertImageUrl: employees.healthCertImageUrl,
  healthCertImageKey: employees.healthCertImageKey,
  contractImageUrl: employees.contractImageUrl,
  contractImageKey: employees.contractImageKey,
};

function branchDisplayName(
  nameAr: string | null | undefined,
  name: string | null | undefined
): string | null {
  return nameAr?.trim() || name?.trim() || null;
}

// ==================== قائمة الموظفين مع الصور ====================

/**
 * قائمة الموظفين بنفس حقول employees.list مع روابط الصور المجددة
 * (لصفحة الموظفين فقط: الصور لا تُرجع لبقية الصفحات)
 */
export async function listEmployeesWithImages(
  branchId?: number
): Promise<EmployeeListRow[]> {
  const db = await requireDb();
  const rows = await db
    .select({
      id: employees.id,
      code: employees.code,
      name: employees.name,
      branchId: employees.branchId,
      branchName: branches.nameAr,
      phone: employees.phone,
      email: employees.email,
      emailVerified: employees.emailVerified,
      position: employees.position,
      username: employees.username,
      hasPortalAccess: employees.hasPortalAccess,
      isSupervisor: employees.isSupervisor,
      iqamaNumber: employees.iqamaNumber,
      iqamaExpiryDate: employees.iqamaExpiryDate,
      healthCertExpiryDate: employees.healthCertExpiryDate,
      contractExpiryDate: employees.contractExpiryDate,
      hireDate: employees.hireDate,
      nationality: employees.nationality,
      isActive: employees.isActive,
      createdAt: employees.createdAt,
      updatedAt: employees.updatedAt,
      ...imageSelection,
    })
    .from(employees)
    .leftJoin(branches, eq(employees.branchId, branches.id))
    .where(branchId ? eq(employees.branchId, branchId) : undefined)
    .orderBy(employees.name);

  return mapWithConcurrency(rows, 6, async row => {
    const images = await resolveRowImages(row, [
      "photo",
      "iqama",
      "health",
      "contract",
    ]);
    const {
      photoKey,
      iqamaImageKey,
      healthCertImageKey,
      contractImageKey,
      ...rest
    } = row;
    return {
      ...rest,
      photoUrl: images.photo,
      iqamaImageUrl: images.iqama,
      healthCertImageUrl: images.health,
      contractImageUrl: images.contract,
    };
  });
}

// ==================== ملف الموظف ====================

export interface EmployeeDocumentState {
  expiry: string | null;
  daysLeft: number | null;
  imageUrl: string | null;
  status: DocumentStatus;
}

export interface EmployeeFileSalary extends SalarySettingsValues {
  /** لا توجد إعدادات محفوظة: تُطبق القيم الافتراضية */
  isDefault: boolean;
  /** صلاحية مشرف البوابة لا تطابق حافز المشرف في الراتب (تُوحّد عند الحفظ) */
  supervisorFlagMismatch: boolean;
}

export async function getEmployeeFile(
  employeeId: number,
  now: Date = new Date()
) {
  const db = await requireDb();
  const rows = await db
    .select({
      employee: employees,
      branchNameAr: branches.nameAr,
      branchName: branches.name,
    })
    .from(employees)
    .leftJoin(branches, eq(employees.branchId, branches.id))
    .where(eq(employees.id, employeeId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new EmployeeFileError("الموظف غير موجود", "NOT_FOUND");
  const e = row.employee;

  const settingsRows = await db
    .select()
    .from(employeeSalarySettings)
    .where(eq(employeeSalarySettings.employeeId, employeeId))
    .limit(1);
  const settings = settingsRows[0];
  const values = effectiveSalarySettings(settings);
  // يُعرض ما تطبقه المسيرة فعلاً (إعدادات الراتب، أو الافتراضي بدون حافز إشراف)،
  // مع تنبيه إن اختلفت علامة المشرف في البوابة
  const salary: EmployeeFileSalary = {
    ...values,
    isDefault: !settings,
    supervisorFlagMismatch: values.isSupervisor !== e.isSupervisor,
  };

  const images = await resolveRowImages(e, [
    "photo",
    "iqama",
    "health",
    "contract",
  ]);
  const doc = (kind: ExpiringDocumentKind): EmployeeDocumentState => ({
    ...describeDocumentExpiry(kind, e[EXPIRY_COLUMNS[kind]], now),
    imageUrl: images[kind],
  });
  const iqama = doc("iqama");
  const health = doc("health");
  const contract = doc("contract");
  const branchName = branchDisplayName(row.branchNameAr, row.branchName);

  return {
    employee: {
      id: e.id,
      code: e.code,
      name: e.name,
      branchId: e.branchId,
      phone: e.phone,
      email: e.email,
      emailVerified: e.emailVerified,
      position: employeeJobTitle(e.isSupervisor),
      username: e.username,
      hasPortalAccess: e.hasPortalAccess,
      isSupervisor: e.isSupervisor,
      lastLogin: e.lastLogin,
      photoUrl: images.photo,
      iqamaNumber: e.iqamaNumber,
      iqamaExpiryDate: iqama.expiry,
      iqamaImageUrl: images.iqama,
      healthCertExpiryDate: health.expiry,
      healthCertImageUrl: images.health,
      contractExpiryDate: contract.expiry,
      contractImageUrl: images.contract,
      hireDate: documentDay(e.hireDate),
      nationality: e.nationality,
      infoSubmittedAt: e.infoSubmittedAt,
      infoSubmittedBy: e.infoSubmittedBy,
      isActive: e.isActive,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    },
    branchName,
    establishmentName: getEstablishmentForBranch({
      nameAr: row.branchNameAr,
      name: row.branchName,
    }).nameAr,
    salary,
    documents: {
      photo: { url: images.photo },
      iqama: { number: e.iqamaNumber, ...iqama },
      health,
      contract,
      worstStatus: worstDocumentStatus([
        iqama.status,
        health.status,
        contract.status,
      ]),
    },
    account: {
      username: e.username,
      hasPortalAccess: e.hasPortalAccess,
      lastLogin: e.lastLogin,
    },
  };
}

export type EmployeeFile = Awaited<ReturnType<typeof getEmployeeFile>>;

// ==================== صور الوثائق ====================

export async function setEmployeeImage(
  employeeId: number,
  kind: EmployeeDocumentKind,
  file: { url: string; key: string } | null
) {
  const db = await requireDb();
  const cols = IMAGE_COLUMNS[kind];
  await db
    .update(employees)
    .set({ [cols.url]: file?.url ?? null, [cols.key]: file?.key ?? null })
    .where(eq(employees.id, employeeId));
}

// ==================== لوحة الوثائق ====================

export interface DocumentsOverviewRow {
  employeeId: number;
  name: string;
  code: string;
  position: string | null;
  branchId: number;
  branchName: string | null;
  photoUrl: string | null;
  iqamaNumber: string | null;
  iqama: EmployeeDocumentState;
  health: EmployeeDocumentState;
  contract: EmployeeDocumentState;
  worstStatus: DocumentStatus;
}

export type DocumentsSummary = Record<DocumentStatus, number>;

function emptySummary(): DocumentsSummary {
  return { expired: 0, critical: 0, warning: 0, valid: 0, missing: 0 };
}

/** كل الموظفين النشطين ووثائقهم الثلاث (بما فيها السارية وبدون تاريخ) */
export async function getDocumentsOverview(
  options: { branchId?: number } = {},
  now: Date = new Date()
) {
  const db = await requireDb();
  const conditions = [eq(employees.isActive, true)];
  if (options.branchId)
    conditions.push(eq(employees.branchId, options.branchId));
  const rows = await db
    .select({
      id: employees.id,
      code: employees.code,
      name: employees.name,
      isSupervisor: employees.isSupervisor,
      branchId: employees.branchId,
      branchNameAr: branches.nameAr,
      branchName: branches.name,
      iqamaNumber: employees.iqamaNumber,
      iqamaExpiryDate: employees.iqamaExpiryDate,
      healthCertExpiryDate: employees.healthCertExpiryDate,
      contractExpiryDate: employees.contractExpiryDate,
      ...imageSelection,
    })
    .from(employees)
    .leftJoin(branches, eq(employees.branchId, branches.id))
    .where(and(...conditions))
    .orderBy(employees.name);

  const result = await mapWithConcurrency(
    rows,
    6,
    async (row): Promise<DocumentsOverviewRow> => {
      const images = await resolveRowImages(row, [
        "photo",
        "iqama",
        "health",
        "contract",
      ]);
      const doc = (kind: ExpiringDocumentKind): EmployeeDocumentState => ({
        ...describeDocumentExpiry(kind, row[EXPIRY_COLUMNS[kind]], now),
        imageUrl: images[kind],
      });
      const iqama = doc("iqama");
      const health = doc("health");
      const contract = doc("contract");
      return {
        employeeId: row.id,
        name: row.name,
        code: row.code,
        position: employeeJobTitle(row.isSupervisor),
        branchId: row.branchId,
        branchName: branchDisplayName(row.branchNameAr, row.branchName),
        photoUrl: images.photo,
        iqamaNumber: row.iqamaNumber,
        iqama,
        health,
        contract,
        worstStatus: worstDocumentStatus([
          iqama.status,
          health.status,
          contract.status,
        ]),
      };
    }
  );

  const summary = emptySummary();
  const byKind: Record<ExpiringDocumentKind, DocumentsSummary> = {
    iqama: emptySummary(),
    health: emptySummary(),
    contract: emptySummary(),
  };
  for (const row of result) {
    for (const kind of EXPIRING_DOCUMENT_KINDS) {
      summary[row[kind].status]++;
      byKind[kind][row[kind].status]++;
    }
  }

  // الأكثر إلحاحاً أولاً ثم الأقرب انتهاءً
  const soonest = (row: DocumentsOverviewRow) =>
    Math.min(
      ...EXPIRING_DOCUMENT_KINDS.map(
        kind => row[kind].daysLeft ?? Number.POSITIVE_INFINITY
      )
    );
  result.sort(
    (a, b) =>
      compareDocumentStatus(a.worstStatus, b.worstStatus) ||
      soonest(a) - soonest(b) ||
      a.name.localeCompare(b.name, "ar")
  );

  return { rows: result, summary, byKind, today: documentDay(now) as string };
}

// ==================== إعدادات الراتب ====================

/**
 * حفظ إعدادات الراتب (الحقول المرسلة فقط) وتوحيد علامة المشرف في جدول الموظفين
 * داخل معاملة واحدة، وإرجاع القيم قبل وبعد لتحديث المسيرات المفتوحة
 */
export async function saveSalarySettings(input: SalarySettingsSaveInput) {
  const db = await requireDb();
  const { employeeId, ...fields } = input;
  const patch = buildSalarySettingsPatch(fields);

  return db.transaction(async tx => {
    const employeeRows = await tx
      .select({ id: employees.id, isSupervisor: employees.isSupervisor, position: employees.position })
      .from(employees)
      .where(eq(employees.id, employeeId))
      .for("update")
      .limit(1);
    if (!employeeRows[0])
      throw new EmployeeFileError("الموظف غير موجود", "NOT_FOUND");

    const existing = await tx
      .select()
      .from(employeeSalarySettings)
      .where(eq(employeeSalarySettings.employeeId, employeeId))
      .for("update")
      .limit(1);
    const previous = effectiveSalarySettings(existing[0]);

    if (existing[0]) {
      if (Object.keys(patch).length > 0) {
        await tx
          .update(employeeSalarySettings)
          .set(patch)
          .where(eq(employeeSalarySettings.employeeId, employeeId));
      }
    } else {
      await tx
        .insert(employeeSalarySettings)
        .values({ employeeId, ...patch })
        .onDuplicateKeyUpdate({
          set: Object.keys(patch).length > 0 ? patch : { employeeId },
        });
    }

    const savedRows = await tx
      .select()
      .from(employeeSalarySettings)
      .where(eq(employeeSalarySettings.employeeId, employeeId))
      .limit(1);
    const next = effectiveSalarySettings(savedRows[0]);

    // علامة "مشرف فرع" واحدة: تمنح حافز المشرف وصلاحية مراجعة طلبات الفرع في البوابة،
    // وتحدد المسمى الوظيفي (مشرف / حلاق)
    const jobTitle = employeeJobTitle(next.isSupervisor);
    if (employeeRows[0].isSupervisor !== next.isSupervisor || employeeRows[0].position !== jobTitle) {
      await tx
        .update(employees)
        .set({ isSupervisor: next.isSupervisor, position: jobTitle })
        .where(eq(employees.id, employeeId));
    }

    return { previous, next, created: !existing[0] };
  });
}

/**
 * تطبيق تغيير الإعدادات على المسيرات المفتوحة للموظف:
 * - الراتب الأساسي وقيمة البدل: إعادة حساب السطر
 * - تفعيل البدل / حافز المشرف / الخصم الثابت: تُرسل كتعديل للسطر عند تغيرها فقط
 * فشل التحديث لا يلغي حفظ الإعدادات (يمكن إعادة الحساب من صفحة المسيرة)
 */
export async function applySalaryChangeToOpenPayrolls(
  employeeId: number,
  previous: SalarySettingsValues,
  next: SalarySettingsValues
): Promise<{ updated: number; failed: number }> {
  const override = buildOpenPayrollOverride(previous, next);
  try {
    if (Object.keys(override).length === 0) {
      return {
        updated: await payrollService.syncOpenPayrollsForEmployee(employeeId),
        failed: 0,
      };
    }
    let updated = 0;
    let failed = 0;
    for (const lineId of await getOpenPayrollLineIds(employeeId)) {
      try {
        await payrollService.updatePayrollLine(lineId, override);
        updated++;
      } catch (error) {
        failed++;
        console.error(
          `[EmployeeFile] تعذر تحديث سطر المسيرة ${lineId} للموظف ${employeeId}:`,
          error
        );
      }
    }
    return { updated, failed };
  } catch (error) {
    console.error(
      `[EmployeeFile] تعذر تحديث المسيرات المفتوحة للموظف ${employeeId}:`,
      error
    );
    return { updated: 0, failed: 1 };
  }
}

/** أسطر الموظف في المسيرات المفتوحة (مسودة / بانتظار الاعتماد)، الأقدم أولاً */
export async function getOpenPayrollLineIds(
  employeeId: number
): Promise<number[]> {
  const db = await requireDb();
  const rows = await db
    .select({ id: payrollDetails.id })
    .from(payrollDetails)
    .innerJoin(payrolls, eq(payrollDetails.payrollId, payrolls.id))
    .where(
      and(
        eq(payrollDetails.employeeId, employeeId),
        inArray(payrolls.status, ["draft", "pending"])
      )
    )
    .orderBy(asc(payrolls.year), asc(payrolls.month));
  return rows.map(r => r.id);
}
