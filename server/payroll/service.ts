/**
 * خدمة مسيرات الرواتب - الخادم هو المصدر الوحيد للأرقام
 *
 * - المعاينة والإنشاء وإعادة الحساب تستخدم نفس الدالة (buildPayrollLines)
 * - السلف والمخالفات المعتمدة تُربط بالمسيرة عند إنشائها (deductedInPayrollId)
 *   فلا تُخصم مرتين، وتُحرر تلقائياً عند إلغاء أو حذف المسيرة
 * - اعتماد سلفة/إجازة/مخالفة جديدة يُحدّث المسيرة المفتوحة (مسودة/تحت الإجراء) مباشرة
 * - إجماليات المسيرة = مجموع أسطرها دائماً
 */

import { and, asc, desc, eq, gte, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  employees,
  employeeSalarySettings,
  employeeRequests,
  employeeInvoices,
  employeeViolations,
  payrolls,
  payrollDetails,
  type Payroll,
  type PayrollDetail,
  type InsertPayrollDetail,
} from "../../drizzle/schema";
import {
  calculatePayrollLine,
  sumPayrollTotals,
  countOverlapDays,
  normalizeLeaveKind,
  toKsaDateParts,
  addDaysToParts,
  formatDateParts,
  ksaMonthBounds,
  parseLinkedItems,
  parseJsonArray,
  canTransitionPayroll,
  isPayrollEditable,
  roundMoney,
  toAmount,
  clampWorkDays,
  LEAVE_KIND_LABELS,
  DEFAULT_BASE_SALARY,
  DEFAULT_OVERTIME_AMOUNT,
  DEFAULT_SUPERVISOR_INCENTIVE,
  type PayrollLineResult,
  type PayrollAdvanceItem,
  type PayrollViolationItem,
  type PayrollLeaveItem,
  type PayrollNegativeInvoiceItem,
} from "../../shared/payroll";

// ==================== الأنواع ====================

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Exec = Db | Tx;

export type PayrollStatus = Payroll["status"];

export interface PayrollActor {
  id: number;
  name: string | null;
  role: string;
  branchId: number | null;
}

/** المدخلات اليدوية القابلة للتعديل لكل موظف */
export interface PayrollAdjustment {
  employeeId: number;
  overtimeEnabled?: boolean;
  workDays?: number;
  incentiveAmount?: number;
  otherDeduction?: number;
  otherDeductionReason?: string | null;
  deferredAdvanceIds?: number[];
  deferredViolationIds?: number[];
  notes?: string | null;
}

export interface ResolvedAdjustment {
  overtimeEnabled: boolean;
  workDays: number;
  incentiveAmount: number;
  otherDeduction: number;
  otherDeductionReason: string | null;
  deferredAdvanceIds: number[];
  deferredViolationIds: number[];
  notes: string | null;
}

export interface PayrollPreviewLine {
  employeeId: number;
  employeeName: string;
  employeeCode: string;
  position: string | null;
  isSupervisor: boolean;
  overtimeRate: number;
  inputs: ResolvedAdjustment;
  advances: Array<PayrollAdvanceItem & { deferred: boolean }>;
  violations: Array<PayrollViolationItem & { deferred: boolean }>;
  leaves: PayrollLeaveItem[];
  negativeInvoices: PayrollNegativeInvoiceItem[];
  calc: PayrollLineResult;
}

export class PayrollError extends Error {
  constructor(
    message: string,
    public code: "NOT_FOUND" | "CONFLICT" | "BAD_REQUEST" | "FORBIDDEN" = "BAD_REQUEST"
  ) {
    super(message);
  }
}

async function requireDb(): Promise<Db> {
  const db = await getDb();
  if (!db) throw new PayrollError("قاعدة البيانات غير متاحة");
  return db;
}

/** قفل صف الفرع داخل المعاملة لمنع إنشاء/تعديل متزامن لمسيرات نفس الفرع */
async function lockBranch(tx: Tx, branchId: number) {
  await tx.execute(sql`SELECT id FROM branches WHERE id = ${branchId} FOR UPDATE`);
}

function affectedRows(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { affectedRows?: number })?.affectedRows ?? 0);
}

function insertId(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { insertId?: number })?.insertId ?? 0);
}

function isoOrNull(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ==================== تجميع بيانات المصادر ====================

interface EmployeeRow {
  id: number;
  name: string;
  code: string;
  position: string | null;
}

interface SourceData {
  settings: Map<number, typeof employeeSalarySettings.$inferSelect>;
  advances: Map<number, PayrollAdvanceItem[]>;
  violations: Map<number, PayrollViolationItem[]>;
  leaves: Map<number, PayrollLeaveItem[]>;
  negativeInvoices: Map<number, PayrollNegativeInvoiceItem[]>;
}

function pushTo<T>(map: Map<number, T[]>, key: number, value: T) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/**
 * تحميل جميع مصادر الخصم لمجموعة موظفين في شهر معين.
 * payrollId: البنود المرتبطة بهذه المسيرة تُعتبر متاحة لها (لإعادة الحساب)
 */
async function loadSources(
  q: Exec,
  employeeIds: number[],
  year: number,
  month: number,
  payrollId: number | null
): Promise<SourceData> {
  const data: SourceData = {
    settings: new Map(),
    advances: new Map(),
    violations: new Map(),
    leaves: new Map(),
    negativeInvoices: new Map(),
  };
  if (employeeIds.length === 0) return data;

  const { start, endExclusive } = ksaMonthBounds(year, month);

  const availableForPayroll = <T extends { isDeductedFromSalary: any; deductedInPayrollId: any }>(table: T) =>
    payrollId
      ? or(eq(table.isDeductedFromSalary, false), eq(table.deductedInPayrollId, payrollId))
      : eq(table.isDeductedFromSalary, false);

  const [settingsRows, advanceRows, violationRows, leaveRows, invoiceRows] = await Promise.all([
    q.select().from(employeeSalarySettings).where(inArray(employeeSalarySettings.employeeId, employeeIds)),
    // السلف المعتمدة حتى نهاية شهر المسيرة وغير المخصومة بعد
    q
      .select({
        id: employeeRequests.id,
        employeeId: employeeRequests.employeeId,
        amount: employeeRequests.advanceAmount,
        title: employeeRequests.title,
        reviewedAt: employeeRequests.reviewedAt,
        updatedAt: employeeRequests.updatedAt,
      })
      .from(employeeRequests)
      .where(
        and(
          inArray(employeeRequests.employeeId, employeeIds),
          eq(employeeRequests.requestType, "advance"),
          eq(employeeRequests.status, "approved"),
          availableForPayroll(employeeRequests),
          lt(sql`COALESCE(${employeeRequests.reviewedAt}, ${employeeRequests.updatedAt})`, endExclusive)
        )
      )
      .orderBy(asc(employeeRequests.id)),
    // المخالفات المعتمدة التي وقعت حتى نهاية الشهر وغير المخصومة بعد
    q
      .select()
      .from(employeeViolations)
      .where(
        and(
          inArray(employeeViolations.employeeId, employeeIds),
          eq(employeeViolations.status, "approved"),
          availableForPayroll(employeeViolations),
          lt(employeeViolations.violationDate, endExclusive)
        )
      )
      .orderBy(asc(employeeViolations.violationDate)),
    // الإجازات المعتمدة المتقاطعة مع الشهر (بما فيها التي ليس لها تاريخ نهاية)
    q
      .select({
        id: employeeRequests.id,
        employeeId: employeeRequests.employeeId,
        vacationType: employeeRequests.vacationType,
        vacationStartDate: employeeRequests.vacationStartDate,
        vacationEndDate: employeeRequests.vacationEndDate,
        vacationDays: employeeRequests.vacationDays,
      })
      .from(employeeRequests)
      .where(
        and(
          inArray(employeeRequests.employeeId, employeeIds),
          eq(employeeRequests.requestType, "vacation"),
          eq(employeeRequests.status, "approved"),
          lt(employeeRequests.vacationStartDate, endExclusive),
          or(
            isNull(employeeRequests.vacationEndDate),
            gte(employeeRequests.vacationEndDate, new Date(start.getTime() - 24 * 60 * 60 * 1000))
          )
        )
      ),
    // الفواتير السالبة للموظفين خلال الشهر
    q
      .select()
      .from(employeeInvoices)
      .where(
        and(
          inArray(employeeInvoices.employeeId, employeeIds),
          eq(employeeInvoices.type, "negative"),
          gte(employeeInvoices.invoiceDate, start),
          lt(employeeInvoices.invoiceDate, endExclusive)
        )
      )
      .orderBy(asc(employeeInvoices.invoiceDate)),
  ]);

  for (const s of settingsRows) data.settings.set(s.employeeId, s);

  for (const a of advanceRows) {
    const amount = roundMoney(toAmount(a.amount));
    if (amount <= 0) continue;
    pushTo(data.advances, a.employeeId, {
      id: a.id,
      amount,
      title: a.title,
      approvedAt: isoOrNull(a.reviewedAt ?? a.updatedAt),
    });
  }

  for (const v of violationRows) {
    const amount = roundMoney(toAmount(v.amount));
    if (amount <= 0) continue;
    pushTo(data.violations, v.employeeId, {
      id: v.id,
      amount,
      violationType: v.violationType,
      violationDate: formatDateParts(toKsaDateParts(v.violationDate)),
      description: v.description,
    });
  }

  for (const leave of leaveRows) {
    if (!leave.vacationStartDate) continue;
    const startParts = toKsaDateParts(leave.vacationStartDate);
    const endParts = leave.vacationEndDate
      ? toKsaDateParts(leave.vacationEndDate)
      : addDaysToParts(startParts, Math.max(1, leave.vacationDays ?? 1) - 1);
    const days = countOverlapDays(startParts, endParts, year, month);
    if (days <= 0) continue;
    const kind = normalizeLeaveKind(leave.vacationType);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const clippedStart =
      startParts.year === year && startParts.month === month ? startParts : { year, month, day: 1 };
    const clippedEnd =
      endParts.year === year && endParts.month === month ? endParts : { year, month, day: lastDay };
    pushTo(data.leaves, leave.employeeId, {
      requestId: leave.id,
      type: leave.vacationType || LEAVE_KIND_LABELS[kind],
      kind,
      days,
      startDate: formatDateParts(clippedStart),
      endDate: formatDateParts(clippedEnd),
    });
  }

  for (const inv of invoiceRows) {
    const amount = roundMoney(toAmount(inv.amount));
    if (amount <= 0) continue;
    pushTo(data.negativeInvoices, inv.employeeId, {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      amount,
      reason: inv.reason ?? inv.notes ?? null,
      invoiceDate: formatDateParts(toKsaDateParts(inv.invoiceDate)),
    });
  }

  return data;
}

// ==================== بناء أسطر المسيرة ====================

function resolveAdjustment(
  employeeId: number,
  settings: typeof employeeSalarySettings.$inferSelect | undefined,
  stored: ResolvedAdjustment | undefined,
  override: PayrollAdjustment | undefined
): ResolvedAdjustment {
  const isSupervisor = !!settings?.isSupervisor;
  const base: ResolvedAdjustment = stored ?? {
    overtimeEnabled: !!settings?.overtimeEnabled,
    workDays: 30,
    incentiveAmount: isSupervisor ? toAmount(settings?.supervisorIncentive ?? DEFAULT_SUPERVISOR_INCENTIVE) : 0,
    otherDeduction: toAmount(settings?.fixedDeduction ?? 0),
    otherDeductionReason: settings?.fixedDeductionReason ?? null,
    deferredAdvanceIds: [],
    deferredViolationIds: [],
    notes: null,
  };
  if (!override || override.employeeId !== employeeId) return base;
  return {
    overtimeEnabled: override.overtimeEnabled ?? base.overtimeEnabled,
    workDays: override.workDays !== undefined ? clampWorkDays(override.workDays) : base.workDays,
    incentiveAmount: override.incentiveAmount !== undefined ? toAmount(override.incentiveAmount) : base.incentiveAmount,
    otherDeduction: override.otherDeduction !== undefined ? toAmount(override.otherDeduction) : base.otherDeduction,
    otherDeductionReason:
      override.otherDeductionReason !== undefined ? override.otherDeductionReason || null : base.otherDeductionReason,
    deferredAdvanceIds: override.deferredAdvanceIds ?? base.deferredAdvanceIds,
    deferredViolationIds: override.deferredViolationIds ?? base.deferredViolationIds,
    notes: override.notes !== undefined ? override.notes || null : base.notes,
  };
}

function buildLine(
  emp: EmployeeRow,
  sources: SourceData,
  inputs: ResolvedAdjustment
): PayrollPreviewLine {
  const settings = sources.settings.get(emp.id);
  const baseSalary = settings ? toAmount(settings.baseSalary) : DEFAULT_BASE_SALARY;
  const overtimeRate = settings ? toAmount(settings.overtimeRate) : DEFAULT_OVERTIME_AMOUNT;

  const deferredAdvances = new Set(inputs.deferredAdvanceIds);
  const deferredViolations = new Set(inputs.deferredViolationIds);
  const advances = (sources.advances.get(emp.id) ?? []).map(a => ({ ...a, deferred: deferredAdvances.has(a.id) }));
  const violations = (sources.violations.get(emp.id) ?? []).map(v => ({ ...v, deferred: deferredViolations.has(v.id) }));
  const leaves = sources.leaves.get(emp.id) ?? [];
  const negativeInvoices = sources.negativeInvoices.get(emp.id) ?? [];

  // الاحتفاظ فقط بمعرّفات التأجيل التي ما زالت قائمة
  const cleanedInputs: ResolvedAdjustment = {
    ...inputs,
    deferredAdvanceIds: advances.filter(a => a.deferred).map(a => a.id),
    deferredViolationIds: violations.filter(v => v.deferred).map(v => v.id),
  };

  const calc = calculatePayrollLine({
    baseSalary,
    overtimeEnabled: inputs.overtimeEnabled,
    overtimeRate,
    workDays: inputs.workDays,
    incentiveAmount: inputs.incentiveAmount,
    otherDeduction: inputs.otherDeduction,
    advanceDeduction: advances.filter(a => !a.deferred).reduce((s, a) => s + a.amount, 0),
    violationsDeduction: violations.filter(v => !v.deferred).reduce((s, v) => s + v.amount, 0),
    negativeInvoicesDeduction: negativeInvoices.reduce((s, i) => s + i.amount, 0),
    leaves: leaves.map(l => ({ type: l.kind, days: l.days })),
  });

  return {
    employeeId: emp.id,
    employeeName: emp.name,
    employeeCode: emp.code,
    position: emp.position,
    isSupervisor: !!settings?.isSupervisor,
    overtimeRate,
    inputs: cleanedInputs,
    advances,
    violations,
    leaves,
    negativeInvoices,
    calc,
  };
}

/** استخراج المدخلات اليدوية المحفوظة في سطر مسيرة */
function storedAdjustment(detail: PayrollDetail): ResolvedAdjustment {
  return {
    overtimeEnabled: !!detail.overtimeEnabled,
    workDays: clampWorkDays(detail.workDays),
    incentiveAmount: toAmount(detail.incentiveAmount),
    otherDeduction: toAmount(detail.deductionAmount),
    otherDeductionReason: detail.deductionReason ?? null,
    deferredAdvanceIds: parseLinkedItems<PayrollAdvanceItem>(detail.advanceDetails).deferredIds,
    deferredViolationIds: parseLinkedItems<PayrollViolationItem>(detail.violationsDetails).deferredIds,
    notes: detail.notes ?? null,
  };
}

function lineToDetailValues(line: PayrollPreviewLine): Omit<InsertPayrollDetail, "payrollId"> {
  const c = line.calc;
  const leaveKinds = Array.from(new Set(line.leaves.map(l => LEAVE_KIND_LABELS[l.kind])));
  return {
    employeeId: line.employeeId,
    employeeName: line.employeeName,
    employeeCode: line.employeeCode,
    position: line.position,
    baseSalary: c.baseSalary.toFixed(2),
    overtimeEnabled: c.overtimeEnabled,
    overtimeAmount: c.overtimeAmount.toFixed(2),
    workDays: c.workDays,
    absentDays: c.absentDays,
    absentDeduction: c.absentDeduction.toFixed(2),
    incentiveAmount: c.incentiveAmount.toFixed(2),
    isSupervisor: line.isSupervisor,
    deductionAmount: c.otherDeduction.toFixed(2),
    deductionReason: line.inputs.otherDeductionReason,
    advanceDeduction: c.advanceDeduction.toFixed(2),
    advanceDetails: JSON.stringify({
      items: line.advances.filter(a => !a.deferred).map(({ deferred, ...a }) => a),
      deferredIds: line.inputs.deferredAdvanceIds,
    }),
    violationsDeduction: c.violationsDeduction.toFixed(2),
    violationsDetails: JSON.stringify({
      items: line.violations.filter(v => !v.deferred).map(({ deferred, ...v }) => v),
      deferredIds: line.inputs.deferredViolationIds,
    }),
    negativeInvoicesDeduction: c.negativeInvoicesDeduction.toFixed(2),
    negativeInvoicesDetails: line.negativeInvoices.length ? JSON.stringify(line.negativeInvoices) : null,
    leaveDays: c.leaveDays,
    leaveDeduction: c.leaveDeduction.toFixed(2),
    leaveType: leaveKinds.length ? leaveKinds.join("، ").slice(0, 50) : null,
    leaveDetails: line.leaves.length ? JSON.stringify(line.leaves) : null,
    grossSalary: c.grossSalary.toFixed(2),
    totalDeductions: c.totalDeductions.toFixed(2),
    netSalary: c.netSalary.toFixed(2),
    notes: line.inputs.notes,
  };
}

async function getActiveBranchEmployees(q: Exec, branchId: number): Promise<EmployeeRow[]> {
  return await q
    .select({ id: employees.id, name: employees.name, code: employees.code, position: employees.position })
    .from(employees)
    .where(and(eq(employees.branchId, branchId), eq(employees.isActive, true)))
    .orderBy(asc(employees.name));
}

// ==================== المعاينة ====================

/** معاينة مسيرة فرع لشهر معين (نفس الحساب المستخدم عند الحفظ) */
export async function previewPayroll(branchId: number, year: number, month: number) {
  const db = await requireDb();
  const emps = await getActiveBranchEmployees(db, branchId);
  const sources = await loadSources(db, emps.map(e => e.id), year, month, null);
  const lines = emps.map(emp =>
    buildLine(emp, sources, resolveAdjustment(emp.id, sources.settings.get(emp.id), undefined, undefined))
  );
  const existing = await findActivePayroll(db, branchId, year, month);
  return {
    lines,
    totals: sumPayrollTotals(lines.map(l => l.calc)),
    existingPayroll: existing ? { id: existing.id, payrollNumber: existing.payrollNumber, status: existing.status } : null,
  };
}

async function findActivePayroll(q: Exec, branchId: number, year: number, month: number) {
  const rows = await q
    .select()
    .from(payrolls)
    .where(
      and(
        eq(payrolls.branchId, branchId),
        eq(payrolls.year, year),
        eq(payrolls.month, month),
        ne(payrolls.status, "cancelled")
      )
    )
    .limit(1);
  return rows[0];
}

// ==================== ربط السلف والمخالفات ====================

async function releaseLinkedItems(tx: Tx, payrollId: number, employeeIds?: number[]) {
  const advanceScope = employeeIds?.length
    ? and(eq(employeeRequests.deductedInPayrollId, payrollId), inArray(employeeRequests.employeeId, employeeIds))
    : eq(employeeRequests.deductedInPayrollId, payrollId);
  await tx
    .update(employeeRequests)
    .set({ isDeductedFromSalary: false, deductedInPayrollId: null, deductedAt: null })
    .where(advanceScope);

  const violationScope = employeeIds?.length
    ? and(eq(employeeViolations.deductedInPayrollId, payrollId), inArray(employeeViolations.employeeId, employeeIds))
    : eq(employeeViolations.deductedInPayrollId, payrollId);
  await tx
    .update(employeeViolations)
    .set({ isDeductedFromSalary: false, deductedInPayrollId: null, deductedAt: null })
    .where(violationScope);
}

async function linkItems(tx: Tx, payrollId: number, lines: PayrollPreviewLine[]) {
  const now = new Date();
  const advanceIds = lines.flatMap(l => l.advances.filter(a => !a.deferred).map(a => a.id));
  if (advanceIds.length) {
    const res = await tx
      .update(employeeRequests)
      .set({ isDeductedFromSalary: true, deductedInPayrollId: payrollId, deductedAt: now })
      .where(
        and(
          inArray(employeeRequests.id, advanceIds),
          or(eq(employeeRequests.isDeductedFromSalary, false), eq(employeeRequests.deductedInPayrollId, payrollId))
        )
      );
    if (affectedRows(res) < advanceIds.length) {
      // بعض السلف رُبطت بمسيرة أخرى أثناء العملية
      const linked = await tx
        .select({ id: employeeRequests.id })
        .from(employeeRequests)
        .where(and(inArray(employeeRequests.id, advanceIds), eq(employeeRequests.deductedInPayrollId, payrollId)));
      if (linked.length < advanceIds.length) {
        throw new PayrollError("تم خصم بعض السلف في مسيرة أخرى، يرجى إعادة المحاولة", "CONFLICT");
      }
    }
  }

  const violationIds = lines.flatMap(l => l.violations.filter(v => !v.deferred).map(v => v.id));
  if (violationIds.length) {
    await tx
      .update(employeeViolations)
      .set({ isDeductedFromSalary: true, deductedInPayrollId: payrollId, deductedAt: now })
      .where(
        and(
          inArray(employeeViolations.id, violationIds),
          or(eq(employeeViolations.isDeductedFromSalary, false), eq(employeeViolations.deductedInPayrollId, payrollId))
        )
      );
    const linked = await tx
      .select({ id: employeeViolations.id })
      .from(employeeViolations)
      .where(and(inArray(employeeViolations.id, violationIds), eq(employeeViolations.deductedInPayrollId, payrollId)));
    if (linked.length < violationIds.length) {
      throw new PayrollError("تم خصم بعض المخالفات في مسيرة أخرى، يرجى إعادة المحاولة", "CONFLICT");
    }
  }
}

async function refreshPayrollTotals(tx: Tx, payrollId: number) {
  const details = await tx.select().from(payrollDetails).where(eq(payrollDetails.payrollId, payrollId));
  const totals = sumPayrollTotals(
    details.map(d => ({
      baseSalary: toAmount(d.baseSalary),
      overtimeAmount: toAmount(d.overtimeAmount),
      incentiveAmount: toAmount(d.incentiveAmount),
      totalDeductions: toAmount(d.totalDeductions),
      // الصافي قد يكون سالباً (خصومات تتجاوز الراتب) فلا نستخدم toAmount
      netSalary: parseFloat(String(d.netSalary)) || 0,
    }))
  );
  await tx
    .update(payrolls)
    .set({
      totalBaseSalary: totals.totalBaseSalary.toFixed(2),
      totalOvertime: totals.totalOvertime.toFixed(2),
      totalIncentives: totals.totalIncentives.toFixed(2),
      totalDeductions: totals.totalDeductions.toFixed(2),
      totalNetSalary: totals.totalNetSalary.toFixed(2),
      employeeCount: totals.employeeCount,
    })
    .where(eq(payrolls.id, payrollId));
  return totals;
}

// ==================== رقم المسيرة ====================

async function nextPayrollNumber(tx: Tx, year: number, month: number): Promise<string> {
  const prefix = `PAY-${year}${String(month).padStart(2, "0")}-`;
  const rows = await tx
    .select({ payrollNumber: payrolls.payrollNumber })
    .from(payrolls)
    .orderBy(desc(payrolls.id))
    .limit(50);
  let maxSeq = 0;
  for (const r of rows) {
    const seq = parseInt(r.payrollNumber.split("-").pop() || "0", 10);
    if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
  }
  return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
}

function isDuplicateKeyError(error: unknown): boolean {
  const e = error as { code?: string; errno?: number; cause?: { code?: string; errno?: number } };
  return e?.code === "ER_DUP_ENTRY" || e?.errno === 1062 || e?.cause?.code === "ER_DUP_ENTRY" || e?.cause?.errno === 1062;
}

// ==================== الإنشاء ====================

export async function createPayroll(input: {
  branchId: number;
  branchName: string;
  year: number;
  month: number;
  adjustments: PayrollAdjustment[];
  actor: PayrollActor;
}): Promise<Payroll> {
  const db = await requireDb();
  const overrides = new Map(input.adjustments.map(a => [a.employeeId, a]));

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const payrollId = await db.transaction(async tx => {
        await lockBranch(tx, input.branchId);

        const existing = await findActivePayroll(tx, input.branchId, input.year, input.month);
        if (existing) {
          throw new PayrollError(`توجد مسيرة رواتب لهذا الشهر بالفعل (${existing.payrollNumber})`, "CONFLICT");
        }

        const emps = await getActiveBranchEmployees(tx, input.branchId);
        if (emps.length === 0) throw new PayrollError("لا يوجد موظفين نشطين في هذا الفرع");

        const sources = await loadSources(tx, emps.map(e => e.id), input.year, input.month, null);
        const lines = emps.map(emp =>
          buildLine(emp, sources, resolveAdjustment(emp.id, sources.settings.get(emp.id), undefined, overrides.get(emp.id)))
        );
        const totals = sumPayrollTotals(lines.map(l => l.calc));
        const { start, endExclusive } = ksaMonthBounds(input.year, input.month);

        const headerResult = await tx.insert(payrolls).values({
          payrollNumber: await nextPayrollNumber(tx, input.year, input.month),
          branchId: input.branchId,
          branchName: input.branchName,
          year: input.year,
          month: input.month,
          periodStart: start,
          periodEnd: new Date(endExclusive.getTime() - 1000),
          totalBaseSalary: totals.totalBaseSalary.toFixed(2),
          totalOvertime: totals.totalOvertime.toFixed(2),
          totalIncentives: totals.totalIncentives.toFixed(2),
          totalDeductions: totals.totalDeductions.toFixed(2),
          totalNetSalary: totals.totalNetSalary.toFixed(2),
          employeeCount: totals.employeeCount,
          status: "pending",
          createdBy: input.actor.id,
          createdByName: input.actor.name || "مستخدم",
        });
        const id = insertId(headerResult);
        if (!id) throw new PayrollError("فشل في إنشاء مسيرة الرواتب");

        await tx.insert(payrollDetails).values(lines.map(line => ({ ...lineToDetailValues(line), payrollId: id })));
        await linkItems(tx, id, lines);
        return id;
      });

      const created = await db.select().from(payrolls).where(eq(payrolls.id, payrollId)).limit(1);
      return created[0];
    } catch (error) {
      if (isDuplicateKeyError(error) && attempt < 2) continue; // تعارض رقم المسيرة - إعادة المحاولة
      throw error;
    }
  }
  throw new PayrollError("تعذر إنشاء رقم مسيرة فريد، يرجى إعادة المحاولة", "CONFLICT");
}

// ==================== إعادة الحساب والتعديل ====================

/**
 * إعادة بناء أسطر مسيرة مفتوحة من قاعدة البيانات مع الحفاظ على المدخلات اليدوية.
 * employeeIds: لإعادة حساب موظفين محددين فقط
 */
async function rebuildPayrollInTx(
  tx: Tx,
  payroll: Payroll,
  options: { employeeIds?: number[]; override?: PayrollAdjustment } = {}
) {
  const details = await tx.select().from(payrollDetails).where(eq(payrollDetails.payrollId, payroll.id));
  const scope = options.employeeIds?.length
    ? details.filter(d => options.employeeIds!.includes(d.employeeId))
    : details;
  if (scope.length === 0) return;

  const employeeIds = scope.map(d => d.employeeId);
  await releaseLinkedItems(tx, payroll.id, employeeIds);

  const sources = await loadSources(tx, employeeIds, payroll.year, payroll.month, payroll.id);
  const lines = scope.map(d =>
    buildLine(
      { id: d.employeeId, name: d.employeeName, code: d.employeeCode, position: d.position },
      sources,
      resolveAdjustment(d.employeeId, sources.settings.get(d.employeeId), storedAdjustment(d), options.override)
    )
  );

  for (let i = 0; i < scope.length; i++) {
    await tx.update(payrollDetails).set(lineToDetailValues(lines[i])).where(eq(payrollDetails.id, scope[i].id));
  }
  await linkItems(tx, payroll.id, lines);
  await refreshPayrollTotals(tx, payroll.id);
}

async function loadEditablePayroll(tx: Tx, payrollId: number): Promise<Payroll> {
  const rows = await tx.select().from(payrolls).where(eq(payrolls.id, payrollId)).limit(1);
  const payroll = rows[0];
  if (!payroll) throw new PayrollError("المسيرة غير موجودة", "NOT_FOUND");
  if (!isPayrollEditable(payroll.status)) {
    throw new PayrollError("لا يمكن تعديل مسيرة معتمدة أو مدفوعة أو ملغاة", "CONFLICT");
  }
  return payroll;
}

/** إعادة حساب مسيرة مفتوحة بالكامل (سحب السلف/المخالفات/الإجازات الجديدة) */
export async function recalculatePayroll(payrollId: number) {
  const db = await requireDb();
  return await db.transaction(async tx => {
    const head = await tx.select({ branchId: payrolls.branchId }).from(payrolls).where(eq(payrolls.id, payrollId)).limit(1);
    if (!head[0]) throw new PayrollError("المسيرة غير موجودة", "NOT_FOUND");
    await lockBranch(tx, head[0].branchId);
    const payroll = await loadEditablePayroll(tx, payrollId);
    await rebuildPayrollInTx(tx, payroll);
    return { success: true };
  });
}

/** تعديل المدخلات اليدوية لسطر موظف ثم إعادة حسابه وحساب إجماليات المسيرة */
export async function updatePayrollLine(detailId: number, adjustment: Omit<PayrollAdjustment, "employeeId">) {
  const db = await requireDb();
  return await db.transaction(async tx => {
    const rows = await tx.select().from(payrollDetails).where(eq(payrollDetails.id, detailId)).limit(1);
    const detail = rows[0];
    if (!detail) throw new PayrollError("سطر المسيرة غير موجود", "NOT_FOUND");
    const head = await tx.select({ branchId: payrolls.branchId }).from(payrolls).where(eq(payrolls.id, detail.payrollId)).limit(1);
    if (!head[0]) throw new PayrollError("المسيرة غير موجودة", "NOT_FOUND");
    await lockBranch(tx, head[0].branchId);
    const payroll = await loadEditablePayroll(tx, detail.payrollId);
    await rebuildPayrollInTx(tx, payroll, {
      employeeIds: [detail.employeeId],
      override: { ...adjustment, employeeId: detail.employeeId },
    });
    return { success: true, payrollId: payroll.id };
  });
}

/**
 * يُستدعى عند اعتماد/إلغاء سلفة أو إجازة أو مخالفة لموظف:
 * يحدّث سطر الموظف في المسيرات المفتوحة (الأقدم أولاً) ليُخصم البند مباشرة.
 */
export async function syncOpenPayrollsForEmployee(employeeId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const open = await db
    .select({ id: payrolls.id, branchId: payrolls.branchId })
    .from(payrolls)
    .innerJoin(payrollDetails, eq(payrollDetails.payrollId, payrolls.id))
    .where(and(eq(payrollDetails.employeeId, employeeId), inArray(payrolls.status, ["draft", "pending"])))
    .orderBy(asc(payrolls.year), asc(payrolls.month));

  let updated = 0;
  for (const p of open) {
    await db.transaction(async tx => {
      await lockBranch(tx, p.branchId);
      const rows = await tx.select().from(payrolls).where(eq(payrolls.id, p.id)).limit(1);
      if (!rows[0] || !isPayrollEditable(rows[0].status)) return;
      await rebuildPayrollInTx(tx, rows[0], { employeeIds: [employeeId] });
      updated++;
    });
  }
  return updated;
}

/**
 * التحقق قبل إلغاء/حذف سلفة أو مخالفة: يُمنع إذا كانت مخصومة في مسيرة معتمدة أو مدفوعة
 */
export async function assertSourceNotLocked(kind: "advance" | "violation", sourceId: number) {
  const db = await getDb();
  if (!db) return;
  const table = kind === "advance" ? employeeRequests : employeeViolations;
  const rows = await db
    .select({ payrollId: table.deductedInPayrollId })
    .from(table)
    .where(eq(table.id, sourceId))
    .limit(1);
  const payrollId = rows[0]?.payrollId;
  if (!payrollId) return;
  const p = await db
    .select({ status: payrolls.status, payrollNumber: payrolls.payrollNumber })
    .from(payrolls)
    .where(eq(payrolls.id, payrollId))
    .limit(1);
  if (p[0] && (p[0].status === "approved" || p[0].status === "paid")) {
    throw new PayrollError(
      `لا يمكن إلغاء ${kind === "advance" ? "السلفة" : "المخالفة"} لأنها مخصومة في المسيرة المعتمدة ${p[0].payrollNumber}`,
      "CONFLICT"
    );
  }
}

// ==================== الحالات ====================

const APPROVER_ROLES = new Set(["admin", "manager"]);

export function canActorTransition(actor: PayrollActor, payroll: Pick<Payroll, "branchId">, to: string): boolean {
  if (APPROVER_ROLES.has(actor.role)) return true;
  // مشرف الفرع: إرسال مسيرة فرعه للمراجعة فقط
  if (actor.role === "supervisor") {
    return to === "pending" && (!actor.branchId || actor.branchId === payroll.branchId);
  }
  return false;
}

export async function transitionPayrollStatus(payrollId: number, to: PayrollStatus, actor: PayrollActor) {
  const db = await requireDb();
  return await db.transaction(async tx => {
    const head = await tx.select().from(payrolls).where(eq(payrolls.id, payrollId)).limit(1);
    const payroll = head[0];
    if (!payroll) throw new PayrollError("المسيرة غير موجودة", "NOT_FOUND");
    await lockBranch(tx, payroll.branchId);

    if (!canActorTransition(actor, payroll, to)) {
      throw new PayrollError("ليس لديك صلاحية لتنفيذ هذا الإجراء على المسيرة", "FORBIDDEN");
    }
    if (!canTransitionPayroll(payroll.status, to)) {
      throw new PayrollError(`لا يمكن تحويل المسيرة من "${payroll.status}" إلى "${to}"`, "CONFLICT");
    }

    const now = new Date();
    const update: Partial<typeof payrolls.$inferInsert> = { status: to };
    if (to === "approved") {
      update.approvedBy = actor.id;
      update.approvedByName = actor.name;
      update.approvedAt = now;
    } else if (to === "paid") {
      update.paidAt = now;
      await tx.update(payrollDetails).set({ isPaid: true, paidAt: now }).where(eq(payrollDetails.payrollId, payrollId));
    } else if (to === "cancelled") {
      await releaseLinkedItems(tx, payrollId);
    }

    const res = await tx
      .update(payrolls)
      .set(update)
      .where(and(eq(payrolls.id, payrollId), eq(payrolls.status, payroll.status)));
    if (affectedRows(res) === 0) throw new PayrollError("تم تعديل المسيرة من مستخدم آخر، يرجى التحديث", "CONFLICT");
    return { from: payroll.status, to, payroll };
  });
}

/** حذف مسيرة (غير مدفوعة) مع تحرير السلف والمخالفات المرتبطة */
export async function deletePayrollSafely(payrollId: number) {
  const db = await requireDb();
  await db.transaction(async tx => {
    const head = await tx.select().from(payrolls).where(eq(payrolls.id, payrollId)).limit(1);
    if (!head[0]) throw new PayrollError("المسيرة غير موجودة", "NOT_FOUND");
    if (head[0].status === "paid") throw new PayrollError("لا يمكن حذف مسيرة مدفوعة", "CONFLICT");
    await lockBranch(tx, head[0].branchId);
    await releaseLinkedItems(tx, payrollId);
    await tx.delete(payrollDetails).where(eq(payrollDetails.payrollId, payrollId));
    await tx.delete(payrolls).where(eq(payrolls.id, payrollId));
  });
}

/** تفاصيل المسيرة مع البريد الإلكتروني للموظفين (لإرسال القسائم) */
export async function getPayrollDetailsWithEmails(payrollId: number) {
  const db = await requireDb();
  return await db
    .select({ detail: payrollDetails, email: employees.email })
    .from(payrollDetails)
    .leftJoin(employees, eq(employees.id, payrollDetails.employeeId))
    .where(eq(payrollDetails.payrollId, payrollId))
    .orderBy(asc(payrollDetails.employeeName));
}

// ==================== المخالفات ====================

export async function listViolations(filters: {
  branchId?: number | null;
  employeeId?: number;
  status?: "pending" | "approved" | "rejected" | "cancelled";
  limit?: number;
}) {
  const db = await requireDb();
  const conditions = [];
  if (filters.branchId) conditions.push(eq(employeeViolations.branchId, filters.branchId));
  if (filters.employeeId) conditions.push(eq(employeeViolations.employeeId, filters.employeeId));
  if (filters.status) conditions.push(eq(employeeViolations.status, filters.status));
  const rows = await db
    .select({ violation: employeeViolations, payrollNumber: payrolls.payrollNumber, payrollStatus: payrolls.status })
    .from(employeeViolations)
    .leftJoin(payrolls, eq(payrolls.id, employeeViolations.deductedInPayrollId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(employeeViolations.violationDate), desc(employeeViolations.id))
    .limit(filters.limit ?? 500);
  return rows.map(r => ({ ...r.violation, payrollNumber: r.payrollNumber, payrollStatus: r.payrollStatus }));
}

export async function getViolation(id: number) {
  const db = await requireDb();
  const rows = await db.select().from(employeeViolations).where(eq(employeeViolations.id, id)).limit(1);
  return rows[0];
}

export async function createViolation(input: {
  employeeId: number;
  violationDate: Date;
  violationType: string;
  description?: string | null;
  amount: number;
  actor: PayrollActor;
  branchName?: string | null;
}) {
  const db = await requireDb();
  const empRows = await db.select().from(employees).where(eq(employees.id, input.employeeId)).limit(1);
  const emp = empRows[0];
  if (!emp) throw new PayrollError("الموظف غير موجود", "NOT_FOUND");
  if (input.actor.role === "supervisor" && input.actor.branchId && input.actor.branchId !== emp.branchId) {
    throw new PayrollError("لا يمكنك تسجيل مخالفة لموظف في فرع آخر", "FORBIDDEN");
  }
  const autoApprove = APPROVER_ROLES.has(input.actor.role);
  const now = new Date();
  const res = await db.insert(employeeViolations).values({
    employeeId: emp.id,
    employeeName: emp.name,
    branchId: emp.branchId,
    branchName: input.branchName ?? null,
    violationDate: input.violationDate,
    violationType: input.violationType,
    description: input.description ?? null,
    amount: roundMoney(input.amount).toFixed(2),
    status: autoApprove ? "approved" : "pending",
    createdBy: input.actor.id,
    createdByName: input.actor.name,
    reviewedBy: autoApprove ? input.actor.id : null,
    reviewedByName: autoApprove ? input.actor.name : null,
    reviewedAt: autoApprove ? now : null,
  });
  if (autoApprove) await syncOpenPayrollsForEmployee(emp.id);
  return { id: insertId(res), status: autoApprove ? "approved" : "pending" };
}

export async function reviewViolation(
  id: number,
  to: "approved" | "rejected" | "cancelled",
  actor: PayrollActor,
  notes?: string | null
) {
  const db = await requireDb();
  const violation = await getViolation(id);
  if (!violation) throw new PayrollError("المخالفة غير موجودة", "NOT_FOUND");
  const allowedFrom: Record<string, string[]> = {
    approved: ["pending"],
    rejected: ["pending"],
    cancelled: ["pending", "approved"],
  };
  if (!allowedFrom[to].includes(violation.status)) {
    throw new PayrollError("لا يمكن تنفيذ هذا الإجراء على المخالفة في حالتها الحالية", "CONFLICT");
  }
  if (to === "cancelled") await assertSourceNotLocked("violation", id);

  const res = await db
    .update(employeeViolations)
    .set({ status: to, reviewedBy: actor.id, reviewedByName: actor.name, reviewedAt: new Date(), reviewNotes: notes ?? null })
    .where(and(eq(employeeViolations.id, id), eq(employeeViolations.status, violation.status)));
  if (affectedRows(res) === 0) throw new PayrollError("تم تعديل المخالفة من مستخدم آخر", "CONFLICT");

  await syncOpenPayrollsForEmployee(violation.employeeId);
  return { success: true };
}

export async function deleteViolation(id: number) {
  const db = await requireDb();
  const violation = await getViolation(id);
  if (!violation) throw new PayrollError("المخالفة غير موجودة", "NOT_FOUND");
  await assertSourceNotLocked("violation", id);
  await db.delete(employeeViolations).where(eq(employeeViolations.id, id));
  if (violation.deductedInPayrollId) await syncOpenPayrollsForEmployee(violation.employeeId);
  return { success: true };
}

// ==================== أدوات للعرض ====================

export function describeDetail(detail: PayrollDetail) {
  return {
    advances: parseLinkedItems<PayrollAdvanceItem>(detail.advanceDetails).items,
    violations: parseLinkedItems<PayrollViolationItem>(detail.violationsDetails).items,
    leaves: parseJsonArray<PayrollLeaveItem>(detail.leaveDetails),
    negativeInvoices: parseJsonArray<PayrollNegativeInvoiceItem>(detail.negativeInvoicesDetails),
  };
}

/** للاختبارات فقط */
export const _internal = { buildLine, resolveAdjustment, lineToDetailValues, storedAdjustment };
