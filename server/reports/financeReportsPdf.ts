/**
 * تقريرا الإيرادات والمصاريف على الخادم: البيانات من الجداول مباشرة ثم PDF من القوالب الرسمية
 * - الإيرادات: صفوف dailyRevenues للفترة (تُحفظ منتصف ليل UTC ليوم العمل)، والإيراد الرسمي = النقدي + الشبكة
 * - المصاريف: المعتمدة والمدفوعة بتاريخ المصروف داخل الشهر (UTC) مع مصدر الصف (يدوي / ثابت / مسير)
 * - الترويسة والختم لمؤسسة الفرع (من اسميه العربي والإنجليزي)، وجميع الفروع بالهوية العامة
 * - الخط والصور تُضمَّن كـ data URI (loadVoucherAssets) حتى يعمل PDF بدون شبكة
 * - هذه الدوال لا تتحقق من الصلاحية: يحدد الإجراء المستدعي الفرع المسموح
 */

import { and, asc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { branches, dailyRevenues, employeeRevenues, employees, expenses } from "../../drizzle/schema";
import { getDb } from "../db";
import { loadVoucherAssets, renderHtmlToPdf } from "../voucherPdf";
import { GROUP_ESTABLISHMENT, getEstablishmentForBranch, type Establishment } from "../../shared/branding";
import { EXPENSE_CATEGORIES, utcMonthRange, type ExpenseCategory } from "../../shared/expenses";
import { parseDateOnly } from "../../shared/endOfService";
import { monthDateRange } from "../../shared/financialReportBase";
import {
  renderRevenueReportHtml,
  type RevenueReportData,
} from "../../shared/revenueReportTemplate";
import {
  EXPENSE_REPORT_STATUSES,
  renderExpenseReportHtml,
  type ExpenseReportData,
  type ExpenseReportStatus,
} from "../../shared/expenseReportTemplate";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  return db;
}

/** حدود فترة أيام العمل بتوقيت UTC: [from 00:00, اليوم التالي لـ to 00:00) */
export function utcDayRange(from: string, to: string): { start: Date; endExclusive: Date } {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return { start: new Date(Date.UTC(fy, fm - 1, fd)), endExclusive: new Date(Date.UTC(ty, tm - 1, td + 1)) };
}

/**
 * فرع التقرير: اسمه للعرض (العربي أولاً) ومؤسسته من الاسمين معاً؛
 * بدون فرع = جميع الفروع بالهوية العامة، وundefined إذا لم يوجد الفرع
 */
async function resolveReportBranch(
  branchId: number | null
): Promise<{ branchName: string | null; establishment: Establishment } | undefined> {
  if (branchId == null) return { branchName: null, establishment: GROUP_ESTABLISHMENT };
  const db = await requireDb();
  const [row] = await db
    .select({ name: branches.name, nameAr: branches.nameAr })
    .from(branches)
    .where(eq(branches.id, branchId))
    .limit(1);
  if (!row) return undefined;
  return { branchName: row.nameAr || row.name, establishment: getEstablishmentForBranch(row) };
}

/** صور المستند (الشعار والختم والخط) لمؤسسة التقرير كـ data URI */
function reportAssets(data: { branchName: string | null; establishment?: Establishment | null }) {
  return loadVoucherAssets({ establishment: data.establishment ?? getEstablishmentForBranch(data.branchName) });
}

// ==================== تقرير الإيرادات ====================

export interface RevenueReportParams {
  /** null = كل الفروع */
  branchId: number | null;
  /** الفترة YYYY-MM-DD (شاملة) */
  from: string;
  to: string;
  /** شهر التقرير عندما تكون الفترة شهراً كاملاً */
  year?: number | null;
  month?: number | null;
  /** إضافة جدول إيرادات الموظفين */
  includeEmployees?: boolean;
  preparedByName?: string | null;
}

/** بيانات تقرير الإيرادات (null إذا لم يوجد الفرع) */
export async function getRevenueReportData(params: RevenueReportParams): Promise<RevenueReportData | null> {
  const db = await requireDb();
  const branch = await resolveReportBranch(params.branchId);
  if (!branch) return null;

  const { start, endExclusive } = utcDayRange(params.from, params.to);
  const where = [gte(dailyRevenues.date, start), lt(dailyRevenues.date, endExclusive)];
  if (params.branchId != null) where.push(eq(dailyRevenues.branchId, params.branchId));

  const rows = await db
    .select({
      id: dailyRevenues.id,
      date: dailyRevenues.date,
      branchId: dailyRevenues.branchId,
      branchName: branches.name,
      branchNameAr: branches.nameAr,
      cash: dailyRevenues.cash,
      network: dailyRevenues.network,
      paidInvoices: dailyRevenues.paidInvoices,
      loyalty: dailyRevenues.loyalty,
      isMatched: dailyRevenues.isMatched,
    })
    .from(dailyRevenues)
    .leftJoin(branches, eq(dailyRevenues.branchId, branches.id))
    .where(and(...where))
    .orderBy(asc(dailyRevenues.date), asc(dailyRevenues.branchId));

  let employeeRows: RevenueReportData["employees"] = null;
  if (params.includeEmployees && rows.length > 0) {
    const totals = await db
      .select({
        employeeId: employeeRevenues.employeeId,
        name: employees.name,
        code: employees.code,
        total: sql<string>`COALESCE(SUM(${employeeRevenues.total}), 0)`,
      })
      .from(employeeRevenues)
      .leftJoin(employees, eq(employeeRevenues.employeeId, employees.id))
      .where(inArray(employeeRevenues.dailyRevenueId, rows.map(r => r.id)))
      .groupBy(employeeRevenues.employeeId, employees.name, employees.code);
    employeeRows = totals.map(e => ({
      name: e.name || `موظف رقم ${e.employeeId}`,
      code: e.code,
      total: e.total,
    }));
  }

  return {
    branchName: branch.branchName,
    establishment: branch.establishment,
    from: params.from,
    to: params.to,
    year: params.year ?? null,
    month: params.month ?? null,
    rows: rows.map(r => ({
      date: r.date,
      branchId: r.branchId,
      branchName: r.branchNameAr || r.branchName,
      cash: r.cash,
      network: r.network,
      paidInvoices: r.paidInvoices,
      loyalty: r.loyalty,
      isMatched: r.isMatched,
    })),
    employees: employeeRows,
    preparedByName: params.preparedByName ?? null,
  };
}

export async function generateRevenueReportPDF(data: RevenueReportData): Promise<Buffer> {
  return renderHtmlToPdf(renderRevenueReportHtml(data, { assets: reportAssets(data) }));
}

function branchSuffix(branchId: number | null): string {
  return branchId != null ? `branch-${branchId}` : "all-branches";
}

/** اسم ملف تقرير الإيرادات: revenue-report-2026-10-branch-2.pdf */
export function revenueReportFileName(params: Pick<RevenueReportParams, "branchId" | "from" | "to" | "year" | "month">): string {
  const period =
    params.year && params.month
      ? `${params.year}-${String(params.month).padStart(2, "0")}`
      : `${params.from}_${params.to}`;
  return `revenue-report-${period}-${branchSuffix(params.branchId)}.pdf`;
}

// ==================== تقرير المصاريف ====================

export interface ExpenseReportParams {
  year: number;
  month: number;
  /** null = كل الفروع */
  branchId: number | null;
  category?: ExpenseCategory | null;
  /** معتمد أو مدفوع فقط (الافتراضي: الاثنان) */
  status?: ExpenseReportStatus | null;
  preparedByName?: string | null;
}

/** بيانات تقرير المصاريف: المعتمدة والمدفوعة فقط (null إذا لم يوجد الفرع) */
export async function getExpenseReportData(params: ExpenseReportParams): Promise<ExpenseReportData | null> {
  const db = await requireDb();
  const branch = await resolveReportBranch(params.branchId);
  if (!branch) return null;

  const { start, endExclusive } = utcMonthRange(params.year, params.month);
  const statuses: ExpenseReportStatus[] = params.status ? [params.status] : [...EXPENSE_REPORT_STATUSES];
  const where = [
    gte(expenses.expenseDate, start),
    lt(expenses.expenseDate, endExclusive),
    inArray(expenses.status, statuses),
  ];
  if (params.branchId != null) where.push(eq(expenses.branchId, params.branchId));
  if (params.category) where.push(eq(expenses.category, params.category));

  const rows = await db
    .select({
      expenseNumber: expenses.expenseNumber,
      title: expenses.title,
      category: expenses.category,
      source: expenses.source,
      amount: expenses.amount,
      expenseDate: expenses.expenseDate,
      paymentMethod: expenses.paymentMethod,
      status: expenses.status,
      branchName: expenses.branchName,
      branchNameAr: branches.nameAr,
    })
    .from(expenses)
    .leftJoin(branches, eq(expenses.branchId, branches.id))
    .where(and(...where))
    .orderBy(asc(expenses.expenseDate), asc(expenses.id));

  return {
    year: params.year,
    month: params.month,
    branchName: branch.branchName,
    establishment: branch.establishment,
    rows: rows.map(r => ({
      expenseNumber: r.expenseNumber,
      title: r.title,
      category: r.category,
      source: r.source,
      amount: r.amount,
      expenseDate: r.expenseDate,
      paymentMethod: r.paymentMethod,
      status: r.status,
      branchName: r.branchNameAr || r.branchName,
    })),
    category: params.category ?? null,
    status: params.status ?? null,
    preparedByName: params.preparedByName ?? null,
  };
}

export async function generateExpenseReportPDF(data: ExpenseReportData): Promise<Buffer> {
  return renderHtmlToPdf(renderExpenseReportHtml(data, { assets: reportAssets(data) }));
}

/** اسم ملف تقرير المصاريف: expense-report-2026-10-branch-2.pdf */
export function expenseReportFileName(params: Pick<ExpenseReportParams, "branchId" | "year" | "month">): string {
  return `expense-report-${params.year}-${String(params.month).padStart(2, "0")}-${branchSuffix(params.branchId)}.pdf`;
}

// ==================== مدخلات الإجراءات ====================

/** أطول فترة لتقرير الإيرادات (يوم) */
export const MAX_REVENUE_REPORT_DAYS = 366;

/** تقرير الإيرادات: شهر (year + month) أو فترة (from - to بصيغة YYYY-MM-DD)، والفرع اختياري */
export const revenueReportInput = z.object({
  branchId: z.number().int().positive().nullable().optional(),
  year: z.number().int().min(2020).max(2100).optional(),
  month: z.number().int().min(1).max(12).optional(),
  from: z.string().max(10).optional(),
  to: z.string().max(10).optional(),
});

export type RevenueReportPeriod = { from: string; to: string; year: number | null; month: number | null };

/** فترة تقرير الإيرادات من المدخلات، أو رسالة خطأ للمستخدم */
export function resolveRevenueReportPeriod(
  input: z.infer<typeof revenueReportInput>
): RevenueReportPeriod | { error: string } {
  if (input.year && input.month) {
    return { ...monthDateRange(input.year, input.month), year: input.year, month: input.month };
  }
  if (!input.from || !input.to) return { error: "حدد الشهر أو فترة التقرير" };
  const from = parseDateOnly(input.from);
  const to = parseDateOnly(input.to);
  if (!from || !to) return { error: "تاريخ الفترة غير صحيح" };
  const startMs = Date.UTC(from.year, from.month - 1, from.day);
  const endMs = Date.UTC(to.year, to.month - 1, to.day);
  if (startMs > endMs) return { error: "تاريخ البداية بعد تاريخ النهاية" };
  if ((endMs - startMs) / 86400000 + 1 > MAX_REVENUE_REPORT_DAYS) return { error: "فترة التقرير أطول من سنة" };
  const key = (d: { year: number; month: number; day: number }) =>
    `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
  return { from: key(from), to: key(to), year: null, month: null };
}

/** تقرير المصاريف الشهري: الفرع والتصنيف والحالة (معتمد / مدفوع) اختيارية */
export const expenseReportInput = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  branchId: z.number().int().positive().nullable().optional(),
  category: z.enum(EXPENSE_CATEGORIES).nullable().optional(),
  status: z.enum(EXPENSE_REPORT_STATUSES).nullable().optional(),
});
