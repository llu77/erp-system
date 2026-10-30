/**
 * المصاريف التلقائية
 * - رقم مصروف آمن (EXP-YYYY-NNNN) يعمل داخل المعاملات وخارجها مع إعادة المحاولة عند التعارض،
 *   ويستخدمه الإدخال اليدوي أيضاً حتى لا يتعارض اليدوي مع التلقائي
 * - المصاريف الثابتة الشهرية (قسم "مصاريف ثابتة"): قوالب لكل فرع تُضاف تلقائياً مرة كل شهر
 *   (مفتاح فريد sourceKey يمنع التكرار مهما تعددت مرات التشغيل أو تزامنت)
 * - مسير الرواتب المعتمد يُسجل مصروفاً واحداً (رواتب)، يصبح "مدفوع" مع المسير،
 *   ويُحذف عند إلغاء المسير المعتمد أو حذفه
 */

import { and, asc, eq, gte, inArray, isNull, like, lt, ne, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  branches,
  expenseLogs,
  expenses,
  payrollDetails,
  payrolls,
  recurringExpenses,
  type InsertExpense,
  type InsertRecurringExpense,
  type Payroll,
} from "../../drizzle/schema";
import { matchEstablishmentKey } from "../../shared/branding";
import { arabicMonthName } from "../../shared/employeeDocumentBase";
import {
  DEFAULT_FIXED_EXPENSES,
  EXPENSE_SOURCE_LABELS,
  autoExpenseDate,
  fixedExpenseSourceKey,
  isMonthOnOrAfter,
  monthKey,
  payrollExpenseAmount,
  payrollExpenseSourceKey,
  utcMonthRange,
  type ExpensePaymentMethod,
  type ExpenseSource,
  type ManualExpenseCategory,
} from "../../shared/expenses";
import { toKsaDateParts } from "../../shared/payroll";
import { formatVoucherAmount, roundMoney } from "../../shared/vouchers";
import { createLogger } from "../utils/logger";

const logger = createLogger("AutoExpenses");

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Exec = Db | Tx;

export type NewExpenseRow = Omit<InsertExpense, "id" | "expenseNumber">;

/** اسم المعتمد للمصاريف الثابتة التلقائية */
export const FIXED_EXPENSE_APPROVER_NAME = "تلقائي (مصاريف ثابتة)";
/** اسم المُنشئ للمصاريف التي يضيفها النظام */
export const SYSTEM_CREATOR_NAME = "النظام";

export type ExpenseRuleErrorCode = "BAD_REQUEST" | "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "INTERNAL_SERVER_ERROR";

/**
 * خطأ قاعدة عمل في المصاريف (يُحوّل في الموجّه إلى TRPCError بنفس الرمز)
 * INTERNAL_SERVER_ERROR لأعطال النظام (قاعدة البيانات غير متاحة) وليس لخطأ من المستخدم
 */
export class ExpenseRuleError extends Error {
  constructor(message: string, public code: ExpenseRuleErrorCode = "BAD_REQUEST") {
    super(message);
    this.name = "ExpenseRuleError";
  }
}

export const DB_UNAVAILABLE_MESSAGE = "قاعدة البيانات غير متاحة، حاول مرة أخرى";

/** تعطل قاعدة البيانات عطل في النظام وليس تعارضاً من المستخدم */
export function databaseUnavailableError(): ExpenseRuleError {
  return new ExpenseRuleError(DB_UNAVAILABLE_MESSAGE, "INTERNAL_SERVER_ERROR");
}

// ==================== أدوات عامة ====================

function insertId(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { insertId?: number })?.insertId ?? 0);
}

export function isDuplicateKeyError(error: unknown): boolean {
  const e = error as { code?: string; errno?: number; cause?: { code?: string; errno?: number } };
  return e?.code === "ER_DUP_ENTRY" || e?.errno === 1062 || e?.cause?.code === "ER_DUP_ENTRY" || e?.cause?.errno === 1062;
}

/** أي مفتاح فريد تعارض: sourceKey (المصروف التلقائي موجود) أو expenseNumber (رقم مكرر) */
export function duplicateKeyTarget(error: unknown): "sourceKey" | "expenseNumber" | "other" | null {
  if (!isDuplicateKeyError(error)) return null;
  const e = error as { message?: string; sqlMessage?: string; cause?: { message?: string; sqlMessage?: string } };
  const text = [e?.message, e?.sqlMessage, e?.cause?.message, e?.cause?.sqlMessage].filter(Boolean).join(" ");
  if (/sourceKey/i.test(text)) return "sourceKey";
  if (/expenseNumber/i.test(text)) return "expenseNumber";
  return "other";
}

/** الشهر الحالي بتوقيت الرياض */
export function currentRiyadhMonth(now: Date = new Date()): { year: number; month: number } {
  const parts = toKsaDateParts(now);
  return { year: parts.year, month: parts.month };
}

// ==================== رقم المصروف ====================

const MAX_NUMBER_ATTEMPTS = 8;

export function formatExpenseNumber(year: number, sequence: number): string {
  return `EXP-${year}-${String(sequence).padStart(4, "0")}`;
}

/** تسلسل رقم بصيغة EXP-YYYY-NNNN فقط (أي صيغة أخرى = 0 فلا تُفسد الترقيم) */
export function parseExpenseSequence(expenseNumber: string | null | undefined, year?: number): number {
  const match = /^EXP-(\d{4})-(\d+)$/.exec(String(expenseNumber ?? "").trim());
  if (!match) return 0;
  if (year != null && Number(match[1]) !== year) return 0;
  return Number(match[2]);
}

async function maxExpenseSequence(exec: Exec, year: number): Promise<number> {
  const rows = await exec
    .select({
      maxSeq: sql<string | number | null>`MAX(CAST(SUBSTRING_INDEX(${expenses.expenseNumber}, '-', -1) AS UNSIGNED))`,
    })
    .from(expenses)
    .where(and(like(expenses.expenseNumber, `EXP-${year}-%`), sql`${expenses.expenseNumber} REGEXP ${`^EXP-${year}-[0-9]+$`}`));
  const n = Number(rows[0]?.maxSeq ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * إدراج مصروف برقم EXP-YYYY-NNNN فريد (داخل معاملة أو خارجها)
 * - تعارض الرقم (إدراج متزامن) -> الرقم التالي (حتى داخل معاملة تقرأ نسخة ثابتة)
 * - تعارض sourceKey -> المصروف التلقائي موجود مسبقاً: يُرجع null
 */
export async function insertExpenseWithNumber(
  exec: Exec,
  values: NewExpenseRow,
  now: Date = new Date()
): Promise<{ id: number; expenseNumber: string } | null> {
  const year = currentRiyadhMonth(now).year;
  let candidate = 0;
  for (let attempt = 0; attempt < MAX_NUMBER_ATTEMPTS; attempt++) {
    candidate = Math.max((await maxExpenseSequence(exec, year)) + 1, candidate + 1);
    const expenseNumber = formatExpenseNumber(year, candidate);
    try {
      const result = await exec.insert(expenses).values({ ...values, expenseNumber });
      return { id: insertId(result), expenseNumber };
    } catch (error) {
      const target = duplicateKeyTarget(error);
      if (target === null) throw error;
      if (target === "sourceKey") return null;
      if (target === "other" && values.sourceKey) {
        const existing = await exec
          .select({ id: expenses.id })
          .from(expenses)
          .where(eq(expenses.sourceKey, values.sourceKey))
          .limit(1);
        if (existing[0]) return null;
      }
      // تعارض رقم المصروف: إعادة المحاولة بالرقم التالي
    }
  }
  throw new ExpenseRuleError("تعذر توليد رقم مصروف فريد، يرجى إعادة المحاولة", "CONFLICT");
}

/** إنشاء مصروف (يدوي) برقم فريد */
export async function createExpenseWithNumber(values: NewExpenseRow): Promise<{ id: number; expenseNumber: string }> {
  const db = await getDb();
  if (!db) throw databaseUnavailableError();
  const created = await insertExpenseWithNumber(db, values);
  if (!created) throw new ExpenseRuleError("المصروف مسجل مسبقاً", "CONFLICT");
  return created;
}

// ==================== حماية المصاريف التلقائية ====================

export const PAYROLL_EXPENSE_LOCKED_MESSAGE =
  "هذا المصروف مسجل تلقائياً من مسير الرواتب المعتمد ولا يُعدّل أو يُحذف من المصاريف؛ يُدار من صفحة مسيرات الرواتب (الدفع أو الإلغاء)";
export const FIXED_EXPENSE_DELETE_MESSAGE =
  "لا يمكن حذف مصروف ثابت؛ ارفضه لهذا الشهر، أو أوقف قالبه من «إدارة المصاريف الثابتة» حتى لا يُضاف في الشهور القادمة";
export const FIXED_EXPENSE_EDIT_MESSAGE =
  "المصروف الثابت يُعدّل مبلغه وملاحظاته فقط؛ لتغيير البند أو طريقة دفعه عدّل القالب من «إدارة المصاريف الثابتة»";

/** الحقول المسموح تعديلها في صف مصروف ثابت لهذا الشهر */
const FIXED_EDITABLE_FIELDS = new Set(["amount", "description", "paymentReference", "receiptNumber"]);

type GuardedExpense = { source?: ExpenseSource | string | null } & Record<string, unknown>;

/** هل يُسمح بالتعديل؟ (يرمي ExpenseRuleError بالسبب) */
export function assertExpenseEditable(existing: GuardedExpense, changes: Record<string, unknown>) {
  if (existing.source === "payroll") throw new ExpenseRuleError(PAYROLL_EXPENSE_LOCKED_MESSAGE, "FORBIDDEN");
  if (existing.source !== "fixed") return;
  for (const [field, value] of Object.entries(changes)) {
    if (value === undefined || FIXED_EDITABLE_FIELDS.has(field)) continue;
    const current = existing[field];
    const same =
      field === "expenseDate"
        ? current != null && new Date(current as string).toISOString().slice(0, 10) === new Date(value as string).toISOString().slice(0, 10)
        : String(current ?? "") === String(value ?? "");
    if (!same) throw new ExpenseRuleError(FIXED_EXPENSE_EDIT_MESSAGE);
  }
}

/** تعديل صف مصروف ثابت: الحقول المسموح بها فقط (البند والتاريخ وطريقة الدفع تبقى كما أُضيفت) */
export function pickFixedExpenseEditableFields<T extends Record<string, unknown>>(changes: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(changes).filter(([field, value]) => value !== undefined && FIXED_EDITABLE_FIELDS.has(field))
  ) as Partial<T>;
}

export function assertExpenseStatusChangeable(existing: GuardedExpense) {
  if (existing.source === "payroll") throw new ExpenseRuleError(PAYROLL_EXPENSE_LOCKED_MESSAGE, "FORBIDDEN");
}

export function assertExpenseDeletable(existing: GuardedExpense) {
  if (existing.source === "payroll") throw new ExpenseRuleError(PAYROLL_EXPENSE_LOCKED_MESSAGE, "FORBIDDEN");
  if (existing.source === "fixed") throw new ExpenseRuleError(FIXED_EXPENSE_DELETE_MESSAGE);
}

// ==================== قوالب المصاريف الثابتة ====================

export interface BranchForTemplates {
  id: number;
  name: string | null;
  nameAr: string | null;
  isActive: boolean | null;
}

/** القوالب الافتراضية لكل فرع نشط مرتبط بمؤسسة (لبن/طويق)؛ غير ذلك بلا قوالب (دالة نقية) */
export function planDefaultFixedTemplates(branchRows: BranchForTemplates[], startsOn: string): InsertRecurringExpense[] {
  const rows: InsertRecurringExpense[] = [];
  for (const branch of branchRows) {
    if (!branch.isActive) continue;
    const key = matchEstablishmentKey(branch.nameAr, branch.name);
    if (!key) continue;
    DEFAULT_FIXED_EXPENSES[key].forEach((item, index) => {
      rows.push({
        branchId: branch.id,
        category: item.category,
        title: item.title,
        amount: roundMoney(item.amount).toFixed(2),
        paymentMethod: item.paymentMethod,
        isActive: true,
        sortOrder: index,
        startsOn,
      });
    });
  }
  return rows;
}

/**
 * إنشاء القوالب الافتراضية عند أول تشغيل (جدول القوالب فارغ)
 * بداية القوالب = الشهر الحالي بتوقيت الرياض، فلا تُنشأ شهور سابقة بأثر رجعي
 */
export async function ensureDefaultFixedExpenseTemplates(now: Date = new Date()): Promise<{ created: number; branchIds: number[] }> {
  const db = await getDb();
  if (!db) return { created: 0, branchIds: [] };
  const existing = await db.select({ id: recurringExpenses.id }).from(recurringExpenses).limit(1);
  if (existing[0]) return { created: 0, branchIds: [] };

  const { year, month } = currentRiyadhMonth(now);
  return await db.transaction(async tx => {
    // قفل صفوف الفروع: تشغيلان متزامنان لا يُنشئان القوالب مرتين (الثاني ينتظر ثم يجد القوالب)
    const branchRows = await tx
      .select({ id: branches.id, name: branches.name, nameAr: branches.nameAr, isActive: branches.isActive })
      .from(branches)
      .for("update");
    const again = await tx.select({ id: recurringExpenses.id }).from(recurringExpenses).limit(1);
    if (again[0]) return { created: 0, branchIds: [] };
    const rows = planDefaultFixedTemplates(branchRows, monthKey(year, month));
    if (rows.length > 0) await tx.insert(recurringExpenses).values(rows);
    const branchIds = Array.from(new Set(rows.map(r => r.branchId)));
    if (rows.length > 0) logger.info(`تم إنشاء ${rows.length} قالب مصاريف ثابتة لـ ${branchIds.length} فرع`);
    return { created: rows.length, branchIds };
  });
}

// ==================== توليد المصاريف الثابتة للشهر ====================

export interface FixedTemplateForMonth {
  id: number;
  branchId: number;
  branchName: string | null;
  category: ManualExpenseCategory;
  title: string;
  amount: string | number;
  paymentMethod: ExpensePaymentMethod;
  startsOn: string;
}

export function fixedExpenseTitle(title: string, year: number, month: number): string {
  return `${title} - ${arabicMonthName(month)} ${year}`;
}

export function manualExpenseKey(branchId: number | null | undefined, category: string): string {
  return `${branchId ?? 0}:${category}`;
}

/** صف المصروف الثابت لشهر (دالة نقية) */
export function buildFixedExpenseRow(template: FixedTemplateForMonth, year: number, month: number, now: Date): NewExpenseRow {
  return {
    source: "fixed",
    sourceKey: fixedExpenseSourceKey(template.branchId, year, month, template.id),
    category: template.category,
    title: fixedExpenseTitle(template.title, year, month).slice(0, 255),
    description: `مصروف ثابت شهري يُضاف تلقائياً (${arabicMonthName(month)} ${year})`,
    amount: roundMoney(template.amount).toFixed(2),
    branchId: template.branchId,
    branchName: template.branchName,
    expenseDate: autoExpenseDate(year, month),
    paymentMethod: template.paymentMethod,
    status: "approved",
    approvedBy: null,
    approvedByName: FIXED_EXPENSE_APPROVER_NAME,
    approvedAt: now,
    createdBy: 0,
    createdByName: SYSTEM_CREATOR_NAME,
  };
}

export interface FixedExpensePlan {
  toCreate: Array<{ template: FixedTemplateForMonth; row: NewExpenseRow }>;
  existing: number;
  notStarted: number;
  /** قالب لم يُضف لأن مصروفاً يدوياً بنفس التصنيف موجود للفرع في نفس الشهر */
  skippedManual: FixedTemplateForMonth[];
}

/**
 * ما يجب إنشاؤه لشهر (دالة نقية):
 * - القالب يبدأ بعد هذا الشهر -> لا شيء
 * - صف بنفس المفتاح موجود (حتى لو مرفوض) -> لا شيء
 * - مصروف يدوي غير مرفوض لنفس الفرع والتصنيف في الشهر -> لا شيء (الإيجار المدخل يدوياً لا يتكرر)
 */
export function planFixedExpensesForMonth(
  year: number,
  month: number,
  templates: FixedTemplateForMonth[],
  existingSourceKeys: Set<string>,
  manualBranchCategories: Set<string>,
  now: Date
): FixedExpensePlan {
  const plan: FixedExpensePlan = { toCreate: [], existing: 0, notStarted: 0, skippedManual: [] };
  for (const template of templates) {
    if (!isMonthOnOrAfter(year, month, template.startsOn)) {
      plan.notStarted++;
      continue;
    }
    const row = buildFixedExpenseRow(template, year, month, now);
    if (existingSourceKeys.has(row.sourceKey as string)) {
      plan.existing++;
      continue;
    }
    if (manualBranchCategories.has(manualExpenseKey(template.branchId, template.category))) {
      plan.skippedManual.push(template);
      continue;
    }
    plan.toCreate.push({ template, row });
  }
  return plan;
}

export interface FixedExpensesMonthResult {
  year: number;
  month: number;
  templates: number;
  created: number;
  existing: number;
  skippedManual: number;
}

/** إضافة المصاريف الثابتة لشهر (آمنة للتكرار والتزامن) */
export async function ensureFixedExpensesForMonth(year: number, month: number, now: Date = new Date()): Promise<FixedExpensesMonthResult> {
  const result: FixedExpensesMonthResult = { year, month, templates: 0, created: 0, existing: 0, skippedManual: 0 };
  const db = await getDb();
  if (!db) return result;

  const rows = await db
    .select({
      id: recurringExpenses.id,
      branchId: recurringExpenses.branchId,
      branchNameAr: branches.nameAr,
      branchNameEn: branches.name,
      category: recurringExpenses.category,
      title: recurringExpenses.title,
      amount: recurringExpenses.amount,
      paymentMethod: recurringExpenses.paymentMethod,
      startsOn: recurringExpenses.startsOn,
    })
    .from(recurringExpenses)
    .innerJoin(branches, eq(branches.id, recurringExpenses.branchId))
    .where(and(eq(recurringExpenses.isActive, true), eq(branches.isActive, true)))
    .orderBy(asc(recurringExpenses.branchId), asc(recurringExpenses.sortOrder), asc(recurringExpenses.id));
  const templates: FixedTemplateForMonth[] = rows.map(r => ({
    id: r.id,
    branchId: r.branchId,
    branchName: r.branchNameAr || r.branchNameEn,
    category: r.category,
    title: r.title,
    amount: r.amount,
    paymentMethod: r.paymentMethod,
    startsOn: r.startsOn,
  }));
  result.templates = templates.length;
  if (templates.length === 0) return result;

  const keys = templates.map(t => fixedExpenseSourceKey(t.branchId, year, month, t.id));
  const existingRows = await db.select({ sourceKey: expenses.sourceKey }).from(expenses).where(inArray(expenses.sourceKey, keys));
  const existingKeys = new Set(existingRows.map(r => r.sourceKey).filter((k): k is string => !!k));

  const { start, endExclusive } = utcMonthRange(year, month);
  const manualRows = await db
    .select({ branchId: expenses.branchId, category: expenses.category })
    .from(expenses)
    .where(
      and(
        eq(expenses.source, "manual"),
        ne(expenses.status, "rejected"),
        gte(expenses.expenseDate, start),
        lt(expenses.expenseDate, endExclusive),
        inArray(expenses.branchId, Array.from(new Set(templates.map(t => t.branchId)))),
        inArray(expenses.category, Array.from(new Set(templates.map(t => t.category))))
      )
    );
  const manualKeys = new Set(manualRows.map(r => manualExpenseKey(r.branchId, r.category)));

  const plan = planFixedExpensesForMonth(year, month, templates, existingKeys, manualKeys, now);
  result.existing = plan.existing;
  for (const skipped of plan.skippedManual) {
    result.skippedManual++;
    logger.info(
      `لم يُضف المصروف الثابت "${skipped.title}" لفرع ${skipped.branchName ?? skipped.branchId} لشهر ${monthKey(year, month)}: يوجد مصروف يدوي بنفس التصنيف`,
      { templateId: skipped.id, branchId: skipped.branchId }
    );
  }
  for (const { row } of plan.toCreate) {
    const created = await insertExpenseWithNumber(db, row, now);
    if (created) result.created++;
    else result.existing++;
  }
  if (result.created > 0) logger.info(`أُضيف ${result.created} مصروف ثابت لشهر ${monthKey(year, month)}`);
  return result;
}

/** شهر الرياض الحالي، مع تذكر آخر تشغيل حتى لا تتكرر الاستعلامات مع كل فتح لقائمة المصاريف */
let lastLazyEnsure: { key: string; at: number } | null = null;
const LAZY_ENSURE_TTL_MS = 10 * 60 * 1000;

export function resetLazyFixedExpensesCache() {
  lastLazyEnsure = null;
}

/**
 * ضمان مصاريف الشهر الحالي الثابتة (عند فتح المصاريف أو تقرير الربح والخسارة)؛ الفشل لا يوقف الطلب
 * (ينشئ القوالب الافتراضية أيضاً إن لم تُنشأ عند تشغيل الخادم، مثلاً لتعطل قاعدة البيانات وقتها)
 */
export async function ensureCurrentMonthFixedExpenses(now: Date = new Date()): Promise<FixedExpensesMonthResult | null> {
  const { year, month } = currentRiyadhMonth(now);
  const key = monthKey(year, month);
  if (lastLazyEnsure && lastLazyEnsure.key === key && now.getTime() - lastLazyEnsure.at < LAZY_ENSURE_TTL_MS) return null;
  try {
    await ensureDefaultFixedExpenseTemplates(now);
    const result = await ensureFixedExpensesForMonth(year, month, now);
    lastLazyEnsure = { key, at: now.getTime() };
    return result;
  } catch (error) {
    logger.error("تعذر إضافة المصاريف الثابتة للشهر الحالي", error);
    return null;
  }
}

/**
 * ضمان المصاريف الثابتة لشهر يُعرض (أرباح الشركاء، تقرير الربح والخسارة) قبل قراءة أرقامه:
 * الشهر الحالي بنفس الحماية من التكرار، والشهور السابقة تُكمل إن نقصت، ولا شيء لشهر مستقبلي؛ الفشل لا يوقف الطلب
 */
export async function ensureFixedExpensesForViewedMonth(
  year: number,
  month: number,
  now: Date = new Date()
): Promise<FixedExpensesMonthResult | null> {
  const current = currentRiyadhMonth(now);
  const key = monthKey(year, month);
  const currentKey = monthKey(current.year, current.month);
  if (key > currentKey) return null;
  if (key === currentKey) return ensureCurrentMonthFixedExpenses(now);
  try {
    return await ensureFixedExpensesForMonth(year, month, now);
  } catch (error) {
    logger.error(`تعذر إضافة المصاريف الثابتة لشهر ${key}`, error);
    return null;
  }
}

/**
 * التشغيل الدوري (بداية كل شهر) وعند تشغيل الخادم:
 * القوالب الافتراضية + مصاريف الشهر الحالي الثابتة (+ مصاريف المسيرات المعتمدة القديمة عند التشغيل)
 */
export async function runAutoExpensesMaintenance(options: { backfillPayroll?: boolean; now?: Date } = {}) {
  const now = options.now ?? new Date();
  const templates = await ensureDefaultFixedExpenseTemplates(now);
  const { year, month } = currentRiyadhMonth(now);
  const fixed = await ensureFixedExpensesForMonth(year, month, now);
  lastLazyEnsure = { key: monthKey(year, month), at: now.getTime() };
  const payroll = options.backfillPayroll ? await ensurePayrollExpensesBackfill(now) : null;
  return { templates, fixed, payroll };
}

// ==================== إدارة القوالب (للمسؤول) ====================

export interface FixedTemplateInput {
  id?: number;
  branchId: number;
  category: ManualExpenseCategory;
  title: string;
  amount: number;
  paymentMethod: ExpensePaymentMethod;
  isActive?: boolean;
  sortOrder?: number;
  startsOn?: string;
}

async function requireDb(): Promise<Db> {
  const db = await getDb();
  if (!db) throw databaseUnavailableError();
  return db;
}

export async function listFixedExpenseTemplates() {
  const db = await requireDb();
  const rows = await db
    .select({
      id: recurringExpenses.id,
      branchId: recurringExpenses.branchId,
      branchNameAr: branches.nameAr,
      branchNameEn: branches.name,
      branchIsActive: branches.isActive,
      category: recurringExpenses.category,
      title: recurringExpenses.title,
      amount: recurringExpenses.amount,
      paymentMethod: recurringExpenses.paymentMethod,
      isActive: recurringExpenses.isActive,
      sortOrder: recurringExpenses.sortOrder,
      startsOn: recurringExpenses.startsOn,
      updatedAt: recurringExpenses.updatedAt,
    })
    .from(recurringExpenses)
    .leftJoin(branches, eq(branches.id, recurringExpenses.branchId))
    .orderBy(asc(recurringExpenses.branchId), asc(recurringExpenses.sortOrder), asc(recurringExpenses.id));
  return rows.map(({ branchNameAr, branchNameEn, ...r }) => ({
    ...r,
    branchName: branchNameAr || branchNameEn || `فرع ${r.branchId}`,
    amount: roundMoney(r.amount),
  }));
}

/** إنشاء أو تعديل قالب؛ التعديل يسري على الشهور التي لم تُضف بعد فقط */
export async function saveFixedExpenseTemplate(input: FixedTemplateInput, now: Date = new Date()) {
  const db = await requireDb();
  const title = input.title.trim();
  if (title.length < 2) throw new ExpenseRuleError("اسم المصروف الثابت مطلوب");
  const amount = roundMoney(input.amount);
  if (!(amount > 0)) throw new ExpenseRuleError("مبلغ المصروف الثابت يجب أن يكون أكبر من صفر");

  const branchRows = await db.select({ id: branches.id }).from(branches).where(eq(branches.id, input.branchId)).limit(1);
  if (!branchRows[0]) throw new ExpenseRuleError("الفرع غير موجود", "NOT_FOUND");

  const values = {
    category: input.category,
    title: title.slice(0, 255),
    amount: amount.toFixed(2),
    paymentMethod: input.paymentMethod,
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    ...(input.startsOn ? { startsOn: input.startsOn } : {}),
  };

  let id = input.id;
  if (id) {
    const existing = await db.select().from(recurringExpenses).where(eq(recurringExpenses.id, id)).limit(1);
    if (!existing[0]) throw new ExpenseRuleError("القالب غير موجود", "NOT_FOUND");
    if (existing[0].branchId !== input.branchId) {
      throw new ExpenseRuleError("لا يمكن نقل قالب إلى فرع آخر؛ أوقفه وأنشئ قالباً جديداً للفرع الآخر");
    }
    await db.update(recurringExpenses).set(values).where(eq(recurringExpenses.id, id));
  } else {
    const { year, month } = currentRiyadhMonth(now);
    const sortRows = await db
      .select({ maxSort: sql<number | null>`MAX(${recurringExpenses.sortOrder})` })
      .from(recurringExpenses)
      .where(eq(recurringExpenses.branchId, input.branchId));
    const result = await db.insert(recurringExpenses).values({
      branchId: input.branchId,
      isActive: true,
      sortOrder: Number(sortRows[0]?.maxSort ?? -1) + 1,
      startsOn: monthKey(year, month),
      ...values,
    });
    id = insertId(result);
  }

  // قالب جديد أو مُفعّل يبدأ هذا الشهر: يُضاف مصروفه الآن (الصفوف المضافة سابقاً لا تتغير)
  resetLazyFixedExpensesCache();
  const { year, month } = currentRiyadhMonth(now);
  const ensured = await ensureFixedExpensesForMonth(year, month, now);
  return { id, currentMonth: ensured };
}

/** إيقاف قالب (لا يُحذف): لا يُضاف من الشهور القادمة، ومصروف الشهر المضاف يبقى ويمكن رفضه */
export async function deactivateFixedExpenseTemplate(id: number) {
  const db = await requireDb();
  const existing = await db.select({ id: recurringExpenses.id }).from(recurringExpenses).where(eq(recurringExpenses.id, id)).limit(1);
  if (!existing[0]) throw new ExpenseRuleError("القالب غير موجود", "NOT_FOUND");
  await db.update(recurringExpenses).set({ isActive: false }).where(eq(recurringExpenses.id, id));
  return { id };
}

// ==================== مسير الرواتب كمصروف ====================

export interface PayrollExpenseActor {
  id: number;
  name: string | null;
}

type PayrollForExpense = Pick<
  Payroll,
  "id" | "payrollNumber" | "branchId" | "branchName" | "year" | "month" | "totalNetSalary" | "approvedBy" | "approvedByName" | "approvedAt"
>;

export function payrollExpenseTitle(payroll: Pick<Payroll, "branchName" | "year" | "month" | "payrollNumber">): string {
  return `مسير رواتب ${payroll.branchName} ${arabicMonthName(payroll.month)} ${payroll.year} (${payroll.payrollNumber})`;
}

/** صف مصروف المسير (دالة نقية): المبلغ = صافي المسير + السلف المستردة فيه */
export function buildPayrollExpenseRow(
  payroll: PayrollForExpense,
  recoveredAdvances: number,
  status: "approved" | "paid",
  actor: PayrollExpenseActor,
  now: Date
): NewExpenseRow {
  const net = roundMoney(payroll.totalNetSalary);
  const advances = roundMoney(recoveredAdvances);
  const amount = payrollExpenseAmount(net, advances);
  const description =
    advances > 0
      ? `صافي الرواتب ${formatVoucherAmount(net)} ر.س + السلف المستردة في المسير ${formatVoucherAmount(advances)} ر.س (صُرفت سابقاً) = ${formatVoucherAmount(amount)} ر.س`
      : `صافي الرواتب ${formatVoucherAmount(net)} ر.س (لا سلف مستردة في المسير)`;
  return {
    source: "payroll",
    sourceKey: payrollExpenseSourceKey(payroll.id),
    category: "salaries",
    title: payrollExpenseTitle(payroll).slice(0, 255),
    description,
    amount: amount.toFixed(2),
    branchId: payroll.branchId,
    branchName: payroll.branchName,
    expenseDate: autoExpenseDate(payroll.year, payroll.month),
    paymentMethod: "bank_transfer",
    paymentReference: payroll.payrollNumber,
    status,
    approvedBy: payroll.approvedBy ?? actor.id,
    approvedByName: payroll.approvedByName ?? actor.name ?? SYSTEM_CREATOR_NAME,
    approvedAt: payroll.approvedAt ?? now,
    createdBy: actor.id,
    createdByName: actor.name || SYSTEM_CREATOR_NAME,
  };
}

async function findPayrollExpenseId(exec: Exec, payrollId: number): Promise<number | null> {
  const rows = await exec
    .select({ id: expenses.id })
    .from(expenses)
    .where(eq(expenses.sourceKey, payrollExpenseSourceKey(payrollId)))
    .limit(1);
  return rows[0]?.id ?? null;
}

async function deleteExpenseRow(exec: Exec, expenseId: number) {
  await exec.delete(expenseLogs).where(eq(expenseLogs.expenseId, expenseId));
  await exec.delete(expenses).where(eq(expenses.id, expenseId));
}

/**
 * تسجيل مسير الرواتب مصروفاً (داخل معاملة المسير): ينشئ الصف أو يحدّثه (لا يتكرر)
 * مسير صافيه وسلفه صفر لا يُسجل
 */
export async function recordPayrollExpense(
  tx: Exec,
  payrollId: number,
  actor: PayrollExpenseActor,
  status: "approved" | "paid" = "approved",
  now: Date = new Date()
): Promise<{ expenseId: number | null; created: boolean }> {
  const rows = await tx.select().from(payrolls).where(eq(payrolls.id, payrollId)).limit(1);
  const payroll = rows[0];
  if (!payroll) return { expenseId: null, created: false };
  const advances = await tx
    .select({ total: sql<string>`COALESCE(SUM(${payrollDetails.advanceDeduction}), 0)` })
    .from(payrollDetails)
    .where(eq(payrollDetails.payrollId, payrollId));
  const row = buildPayrollExpenseRow(payroll, Number(advances[0]?.total ?? 0), status, actor, now);
  const existingId = await findPayrollExpenseId(tx, payrollId);

  if (!(Number(row.amount) > 0)) {
    if (existingId) await deleteExpenseRow(tx, existingId);
    return { expenseId: null, created: false };
  }

  if (!existingId) {
    const inserted = await insertExpenseWithNumber(tx, row, now);
    if (inserted) return { expenseId: inserted.id, created: true };
  }
  // موجود (أو أُنشئ للتو من تشغيل متزامن): تحديث بأرقام المسير الحالية
  const { source: _source, sourceKey, createdBy: _createdBy, createdByName: _createdByName, ...update } = row;
  await tx.update(expenses).set(update).where(eq(expenses.sourceKey, sourceKey as string));
  return { expenseId: existingId ?? (await findPayrollExpenseId(tx, payrollId)), created: false };
}

/** دفع المسير: صف المصروف يصبح "مدفوع" (ويُنشأ إن لم يكن موجوداً لمسير قديم) */
export async function markPayrollExpensePaid(tx: Exec, payrollId: number, actor: PayrollExpenseActor, now: Date = new Date()) {
  const existingId = await findPayrollExpenseId(tx, payrollId);
  if (existingId) {
    await tx.update(expenses).set({ status: "paid" }).where(eq(expenses.id, existingId));
    return { expenseId: existingId, created: false };
  }
  return await recordPayrollExpense(tx, payrollId, actor, "paid", now);
}

/** إلغاء المسير المعتمد أو حذفه: حذف صف المصروف وسجلاته */
export async function removePayrollExpense(tx: Exec, payrollId: number): Promise<boolean> {
  const existingId = await findPayrollExpenseId(tx, payrollId);
  if (!existingId) return false;
  await deleteExpenseRow(tx, existingId);
  return true;
}

/** المسيرات المعتمدة والمدفوعة التي ليس لها صف مصروف بعد (من قبل هذه الميزة) */
export async function ensurePayrollExpensesBackfill(now: Date = new Date()): Promise<{ checked: number; created: number }> {
  const db = await getDb();
  if (!db) return { checked: 0, created: 0 };
  const missing = await db
    .select({ id: payrolls.id })
    .from(payrolls)
    .leftJoin(expenses, eq(expenses.sourceKey, sql`CONCAT('payroll:', ${payrolls.id})`))
    .where(and(inArray(payrolls.status, ["approved", "paid"]), isNull(expenses.id)));

  let created = 0;
  for (const { id } of missing) {
    try {
      const result = await db.transaction(async tx => {
        // قفل المسير: لا يتعارض مع إلغاء أو دفع متزامن
        const locked = await tx.select().from(payrolls).where(eq(payrolls.id, id)).for("update").limit(1);
        const payroll = locked[0];
        if (!payroll || (payroll.status !== "approved" && payroll.status !== "paid")) return null;
        const actor: PayrollExpenseActor = { id: 0, name: SYSTEM_CREATOR_NAME };
        return await recordPayrollExpense(tx, id, actor, payroll.status, now);
      });
      if (result?.created) created++;
    } catch (error) {
      logger.error(`تعذر تسجيل مصروف المسير ${id}`, error);
    }
  }
  if (created > 0) logger.info(`سُجلت ${created} مسيرة رواتب معتمدة سابقة في المصاريف`);
  return { checked: missing.length, created };
}

/** وصف مصدر المصروف للعرض (يدوي / مصاريف ثابتة / مسير رواتب) */
export function expenseSourceLabel(source: string | null | undefined): string {
  return EXPENSE_SOURCE_LABELS[(source ?? "manual") as ExpenseSource] ?? EXPENSE_SOURCE_LABELS.manual;
}
