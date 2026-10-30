/**
 * خدمة إنهاء الخدمة (انتهاء العقد وعدم التجديد) والمخالصة النهائية
 *
 * - الحساب من shared/endOfService.ts فقط (الخادم مصدر الأرقام، لا يُوثق بأرقام الواجهة)
 * - كل مخالصة يقابلها طلب من نوع end_of_service في الطلبات (requestId) يُدار من هنا فقط
 * - الاعتماد يعيد الحساب من البيانات الحالية: إن تغيرت الأرقام تُحفظ الجديدة ويُرفض الاعتماد للمراجعة،
 *   وإلا تُربط السلف والمخالفات المخصومة (settledInEndOfServiceId) ويُعطّل الموظف فلا يدخل مسيرات لاحقة
 * - الإلغاء بعد الاعتماد يحرر الربط ويعيد تفعيل الموظف، ولا إلغاء بعد الصرف
 * - تغيير الحالة بتحديث مشروط (WHERE status = الحالة الحالية) داخل معاملة مع قفل صف الموظف ثم المخالصة
 */

import { and, desc, eq, inArray, isNull, like, ne, sql } from "drizzle-orm";
import { generateRequestNumber, getDb } from "../db";
import {
  branches,
  employees,
  employeeRequestLogs,
  employeeRequests,
  employeeSalarySettings,
  employeeViolations,
  endOfServiceSettlements,
  payrollDetails,
  payrolls,
  type Employee,
  type EmployeeSalarySetting,
  type EndOfServiceSettlement,
  type InsertEndOfServiceSettlement,
} from "../../drizzle/schema";
import {
  END_OF_SERVICE_PAYMENT_METHODS,
  END_OF_SERVICE_REASON_LABELS,
  END_OF_SERVICE_STATUSES,
  calculateEndOfServiceSettlement,
  canTransitionEndOfService,
  formatEndOfServiceNumber,
  getEndOfServiceStatusLabel,
  isEndOfServiceEditable,
  parseDateOnly,
  settlementTotalsChanged,
  type EndOfServiceCalcInput,
  type EndOfServiceCalculation,
  type EndOfServiceDeductionItem,
  type EndOfServiceDocumentData,
  type EndOfServiceStatus,
  type PayrollMonthRef,
} from "../../shared/endOfService";
import {
  DEFAULT_BASE_SALARY,
  parseJsonArray,
  roundMoney,
  toAmount,
} from "../../shared/payroll";
import { todayVoucherDate, toVoucherDateString } from "../../shared/vouchers";
import { employeeJobTitle } from "../../shared/employeeFile";

// ==================== الأنواع ====================

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Exec = Db | Tx;

export interface EndOfServiceActor {
  id: number;
  name: string | null;
  role: string;
  branchId: number | null;
}

/** المستخدم الذي يعرض المخالصات (لتحديد نطاق الفروع) */
export type EndOfServiceViewer = Pick<EndOfServiceActor, "role" | "branchId">;

export class EndOfServiceError extends Error {
  constructor(
    message: string,
    public code:
      | "BAD_REQUEST"
      | "NOT_FOUND"
      | "CONFLICT"
      | "FORBIDDEN" = "BAD_REQUEST"
  ) {
    super(message);
    this.name = "EndOfServiceError";
  }
}

/** مدخلات نموذج إنهاء الخدمة (التواريخ YYYY-MM-DD) */
export interface EndOfServiceForm {
  employeeId: number;
  hireDate: string;
  contractEndDate: string;
  lastWorkingDay: string;
  letterDate: string;
  nationality?: string | null;
  idNumber?: string | null;
  baseSalary: number;
  fixedAllowances: number;
  salaryDaysOverride?: number | null;
  salaryNote?: string | null;
  otherAdditions?: number;
  otherAdditionsNote?: string | null;
  otherDeductions?: number;
  otherDeductionsNote?: string | null;
  notes?: string | null;
}

export type EndOfServicePaymentMethod = "cash" | "bank_transfer" | "check";

export interface WageBreakdownLine {
  label: string;
  amount: number;
}

export interface WageDefaults {
  baseSalary: number;
  fixedAllowances: number;
  breakdown: WageBreakdownLine[];
}

export interface LastPayrollRef extends PayrollMonthRef {
  payrollNumber: string;
}

/** كل ما يلزم الحساب من قاعدة البيانات لموظف */
export interface EmployeeContext {
  employee: Employee;
  branchName: string | null;
  wage: WageDefaults;
  lastPayroll: LastPayrollRef | null;
  advances: EndOfServiceDeductionItem[];
  violations: EndOfServiceDeductionItem[];
}

/** بيانات الحساب المطلوبة من قاعدة البيانات */
type CalcContext = Pick<
  EmployeeContext,
  "lastPayroll" | "advances" | "violations"
>;

export interface EndOfServiceListRow {
  id: number;
  settlementNumber: string;
  requestId: number;
  employeeId: number;
  employeeName: string;
  employeeCode: string;
  branchId: number | null;
  branchName: string | null;
  lastWorkingDay: string;
  netAmount: number;
  status: EndOfServiceStatus;
  createdAt: Date;
  approvedAt: Date | null;
  paidAt: Date | null;
}

export const END_OF_SERVICE_REQUEST_TITLE =
  "إنهاء خدمة - انتهاء العقد وعدم التجديد";

const SETTLEMENTS_CHANGED_MESSAGE =
  "تغيرت أرقام المخالصة منذ آخر حفظ (سلف/مخالفات/مسيرات). راجع الأرقام الجديدة ثم اعتمد";

// ==================== أدوات عامة ====================

async function requireDb(): Promise<Db> {
  const db = await getDb();
  if (!db) throw new EndOfServiceError("قاعدة البيانات غير متاحة");
  return db;
}

function affectedRows(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { affectedRows?: number })?.affectedRows ?? 0);
}

function insertId(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { insertId?: number })?.insertId ?? 0);
}

function isDuplicateKeyError(error: unknown): boolean {
  const e = error as {
    code?: string;
    errno?: number;
    cause?: { code?: string; errno?: number };
  };
  return (
    e?.code === "ER_DUP_ENTRY" ||
    e?.errno === 1062 ||
    e?.cause?.code === "ER_DUP_ENTRY" ||
    e?.cause?.errno === 1062
  );
}

/** رقم من عمود DECIMAL مع الحفاظ على الإشارة (الصافي قد يكون سالباً) */
function signedAmount(value: unknown): number {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : 0;
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

function cleanText(value: unknown, maxLength?: number): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;
  return maxLength ? s.slice(0, maxLength) : s;
}

function money(value: number): string {
  return roundMoney(value).toFixed(2);
}

/** بداية يوم YYYY-MM-DD بتوقيت الرياض (لأعمدة timestamp القديمة في الطلبات) */
function riyadhMidnight(ymd: string): Date {
  return new Date(`${ymd}T00:00:00+03:00`);
}

function actorName(actor: EndOfServiceActor): string {
  return cleanText(actor.name, 255) || "مستخدم";
}

// ==================== الصلاحيات ====================

const MANAGER_ROLES = new Set(["admin", "manager"]);

export function canManageEndOfService(
  role: string | null | undefined
): boolean {
  return MANAGER_ROLES.has(String(role ?? ""));
}

/**
 * نطاق العرض: المسؤول والمدير والمشرف العام كل الفروع،
 * ومشرف الفرع فرعه فقط (ولا صلاحية لمشرف غير مرتبط بفرع)، وغيرهم لا يعرضون المخالصات
 * branchId = null يعني كل الفروع
 */
export function resolveViewScope(viewer: EndOfServiceViewer): {
  branchId: number | null;
} {
  if (
    viewer.role === "admin" ||
    viewer.role === "manager" ||
    viewer.role === "viewer"
  )
    return { branchId: null };
  if (viewer.role === "supervisor") {
    if (viewer.branchId == null)
      throw new EndOfServiceError("حسابك غير مرتبط بفرع", "FORBIDDEN");
    return { branchId: viewer.branchId };
  }
  throw new EndOfServiceError(
    "غير مصرح لك بعرض مخالصات إنهاء الخدمة",
    "FORBIDDEN"
  );
}

export function assertCanViewSettlement(
  viewer: EndOfServiceViewer,
  settlement: { branchId: number | null }
) {
  const scope = resolveViewScope(viewer);
  if (scope.branchId !== null && settlement.branchId !== scope.branchId) {
    throw new EndOfServiceError(
      "لا يمكنك الوصول لمخالصات موظفي فرع آخر",
      "FORBIDDEN"
    );
  }
}

/**
 * هل يمكن عرض طلب في صفحات الطلبات العامة: طلبات إنهاء الخدمة تتبع صلاحيات المخالصات
 * (المسؤول والمدير والمشرف العام كل الفروع، ومشرف الفرع فرعه فقط، وغيرهم لا)
 */
export function canViewEndOfServiceRequest(
  viewer: EndOfServiceViewer,
  request: { requestType: string; branchId: number | null }
): boolean {
  if (request.requestType !== "end_of_service") return true;
  try {
    assertCanViewSettlement(viewer, { branchId: request.branchId });
    return true;
  } catch {
    return false;
  }
}

// ==================== حسابات مساعدة (دوال نقية) ====================

/** الأجر الافتراضي من إعدادات الراتب: الأساسي + الساعات الإضافية الثابتة (إن فُعّلت) + حافز الإشراف */
export function buildWageDefaults(
  settings:
    | Pick<
        EmployeeSalarySetting,
        | "baseSalary"
        | "overtimeEnabled"
        | "overtimeRate"
        | "isSupervisor"
        | "supervisorIncentive"
      >
    | null
    | undefined
): WageDefaults {
  const baseSalary = settings
    ? roundMoney(toAmount(settings.baseSalary))
    : DEFAULT_BASE_SALARY;
  const overtime = settings?.overtimeEnabled
    ? roundMoney(toAmount(settings.overtimeRate))
    : 0;
  const incentive = settings?.isSupervisor
    ? roundMoney(toAmount(settings.supervisorIncentive))
    : 0;
  const breakdown: WageBreakdownLine[] = [
    { label: "الأجر الأساسي", amount: baseSalary },
  ];
  if (overtime > 0)
    breakdown.push({ label: "الساعات الإضافية الثابتة", amount: overtime });
  if (incentive > 0)
    breakdown.push({ label: "حافز الإشراف", amount: incentive });
  return {
    baseSalary,
    fixedAllowances: roundMoney(overtime + incentive),
    breakdown,
  };
}

/** تحقق التواريخ قبل الحساب */
export function validateFormDates(
  form: Pick<
    EndOfServiceForm,
    "hireDate" | "contractEndDate" | "lastWorkingDay" | "letterDate"
  >
) {
  if (!parseDateOnly(form.hireDate))
    throw new EndOfServiceError("تاريخ مباشرة العمل غير صحيح");
  if (!parseDateOnly(form.contractEndDate))
    throw new EndOfServiceError("تاريخ انتهاء العقد غير صحيح");
  if (!parseDateOnly(form.lastWorkingDay))
    throw new EndOfServiceError("تاريخ آخر يوم عمل غير صحيح");
  if (!parseDateOnly(form.letterDate))
    throw new EndOfServiceError("تاريخ الخطاب غير صحيح");
  if (form.contractEndDate < form.hireDate) {
    throw new EndOfServiceError(
      "تاريخ انتهاء العقد يجب أن يكون بعد تاريخ مباشرة العمل"
    );
  }
  if (form.lastWorkingDay < form.hireDate) {
    throw new EndOfServiceError(
      "آخر يوم عمل يجب أن يكون بعد تاريخ مباشرة العمل"
    );
  }
}

/** مدخلات الحساب من النموذج + بيانات قاعدة البيانات */
export function toCalcInput(
  form: EndOfServiceForm,
  ctx: CalcContext
): EndOfServiceCalcInput {
  return {
    hireDate: form.hireDate,
    lastWorkingDay: form.lastWorkingDay,
    baseSalary: form.baseSalary,
    fixedAllowances: form.fixedAllowances,
    lastPayrollMonth: ctx.lastPayroll
      ? { year: ctx.lastPayroll.year, month: ctx.lastPayroll.month }
      : null,
    salaryDaysOverride: form.salaryDaysOverride ?? null,
    otherAdditions: form.otherAdditions ?? 0,
    advances: ctx.advances,
    violations: ctx.violations,
    otherDeductions: form.otherDeductions ?? 0,
  };
}

export function calculateOrThrow(
  form: EndOfServiceForm,
  ctx: CalcContext
): EndOfServiceCalculation {
  validateFormDates(form);
  const result = calculateEndOfServiceSettlement(toCalcInput(form, ctx));
  if (!result.ok) throw new EndOfServiceError(result.error);
  return result.calculation;
}

/** قيم أعمدة المخالصة المحسوبة (بدون الرقم والطلب والتتبع) */
export function buildSettlementValues(
  form: EndOfServiceForm,
  ctx: EmployeeContext,
  calc: EndOfServiceCalculation
) {
  const emp = ctx.employee;
  const salaryOverride = form.salaryDaysOverride ?? null;
  return {
    employeeId: emp.id,
    branchId: emp.branchId ?? null,
    reason: "contract_expiry",
    letterDate: form.letterDate,
    hireDate: form.hireDate,
    contractEndDate: form.contractEndDate,
    lastWorkingDay: form.lastWorkingDay,
    employeeName: emp.name,
    employeeCode: emp.code,
    nationality:
      form.nationality !== undefined
        ? cleanText(form.nationality, 100)
        : cleanText(emp.nationality, 100),
    idNumber:
      form.idNumber !== undefined
        ? cleanText(form.idNumber, 50)
        : cleanText(emp.iqamaNumber, 50),
    position: employeeJobTitle(emp.isSupervisor),
    branchName: cleanText(ctx.branchName, 255),
    baseSalary: money(form.baseSalary),
    fixedAllowances: money(form.fixedAllowances),
    monthlyWage: money(calc.monthlyWage),
    serviceYears: calc.service.years,
    serviceMonths: calc.service.months,
    serviceDays: calc.service.days,
    serviceTotalDays: calc.service.totalDays,
    eosAward: money(calc.eosAward),
    salaryDays: calc.salaryDays.toFixed(2),
    salaryDaysOverride:
      salaryOverride === null ? null : Number(salaryOverride).toFixed(2),
    salaryDue: money(calc.salaryDue),
    otherAdditions: money(calc.otherAdditions),
    otherDeductions: money(calc.otherDeductions),
    advancesDeduction: money(calc.advancesDeduction),
    violationsDeduction: money(calc.violationsDeduction),
    totalEntitlements: money(calc.totalEntitlements),
    totalDeductions: money(calc.totalDeductions),
    netAmount: money(calc.netAmount),
    salaryNote: cleanText(form.salaryNote),
    otherAdditionsNote: cleanText(form.otherAdditionsNote),
    otherDeductionsNote: cleanText(form.otherDeductionsNote),
    notes: cleanText(form.notes),
    advancesDetails: JSON.stringify(ctx.advances),
    violationsDetails: JSON.stringify(ctx.violations),
    calculationSnapshot: JSON.stringify(calc),
    lastPayrollYear: ctx.lastPayroll?.year ?? null,
    lastPayrollMonth: ctx.lastPayroll?.month ?? null,
  } satisfies Partial<InsertEndOfServiceSettlement>;
}

/** النموذج المحفوظ في المخالصة (لتعبئة التعديل ولإعادة الحساب عند الاعتماد) */
export function settlementToForm(
  row: EndOfServiceSettlement
): EndOfServiceForm {
  return {
    employeeId: row.employeeId,
    hireDate: toVoucherDateString(row.hireDate) ?? String(row.hireDate),
    contractEndDate:
      toVoucherDateString(row.contractEndDate) ?? String(row.contractEndDate),
    lastWorkingDay:
      toVoucherDateString(row.lastWorkingDay) ?? String(row.lastWorkingDay),
    letterDate: toVoucherDateString(row.letterDate) ?? String(row.letterDate),
    nationality: row.nationality ?? null,
    idNumber: row.idNumber ?? null,
    baseSalary: toAmount(row.baseSalary),
    fixedAllowances: toAmount(row.fixedAllowances),
    salaryDaysOverride: optionalNumber(row.salaryDaysOverride),
    salaryNote: row.salaryNote ?? null,
    otherAdditions: toAmount(row.otherAdditions),
    otherAdditionsNote: row.otherAdditionsNote ?? null,
    otherDeductions: toAmount(row.otherDeductions),
    otherDeductionsNote: row.otherDeductionsNote ?? null,
    notes: row.notes ?? null,
  };
}

function storedAdvances(
  row: Pick<EndOfServiceSettlement, "advancesDetails">
): EndOfServiceDeductionItem[] {
  return parseJsonArray<EndOfServiceDeductionItem>(row.advancesDetails);
}

function storedViolations(
  row: Pick<EndOfServiceSettlement, "violationsDetails">
): EndOfServiceDeductionItem[] {
  return parseJsonArray<EndOfServiceDeductionItem>(row.violationsDetails);
}

function storedLastPayroll(
  row: Pick<EndOfServiceSettlement, "lastPayrollYear" | "lastPayrollMonth">
): LastPayrollRef | null {
  if (!row.lastPayrollYear || !row.lastPayrollMonth) return null;
  return {
    year: row.lastPayrollYear,
    month: row.lastPayrollMonth,
    payrollNumber: "",
  };
}

function parseCalculationSnapshot(
  raw: string | null | undefined
): EndOfServiceCalculation | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.netAmount === "number" &&
      typeof parsed.totalEntitlements === "number" &&
      parsed.service &&
      typeof parsed.service === "object" &&
      Array.isArray(parsed.warnings)
    ) {
      return parsed as EndOfServiceCalculation;
    }
  } catch {
    // يُعاد الحساب من الأعمدة المحفوظة
  }
  return null;
}

/** الحساب المحفوظ للمخالصة (اللقطة، وإلا إعادة الحساب من الأعمدة المحفوظة) */
export function storedCalculation(
  row: EndOfServiceSettlement
): EndOfServiceCalculation {
  const snapshot = parseCalculationSnapshot(row.calculationSnapshot);
  if (snapshot) return snapshot;
  const result = calculateEndOfServiceSettlement(
    toCalcInput(settlementToForm(row), {
      lastPayroll: storedLastPayroll(row),
      advances: storedAdvances(row),
      violations: storedViolations(row),
    })
  );
  if (!result.ok)
    throw new EndOfServiceError(
      `بيانات المخالصة ${row.settlementNumber} غير مكتملة: ${result.error}`
    );
  return result.calculation;
}

/** بيانات قالب الطباعة (الخطاب والمخالصة) من صف المخالصة */
export function toDocumentData(
  row: EndOfServiceSettlement
): EndOfServiceDocumentData {
  return {
    settlementNumber: row.settlementNumber,
    status: row.status,
    reason: row.reason,
    letterDate: toVoucherDateString(row.letterDate) ?? String(row.letterDate),
    employeeName: row.employeeName,
    employeeCode: row.employeeCode,
    nationality: row.nationality ?? null,
    idNumber: row.idNumber ?? null,
    position: row.position ?? null,
    branchName: row.branchName ?? null,
    hireDate: toVoucherDateString(row.hireDate) ?? String(row.hireDate),
    contractEndDate:
      toVoucherDateString(row.contractEndDate) ?? String(row.contractEndDate),
    lastWorkingDay:
      toVoucherDateString(row.lastWorkingDay) ?? String(row.lastWorkingDay),
    baseSalary: toAmount(row.baseSalary),
    fixedAllowances: toAmount(row.fixedAllowances),
    calculation: storedCalculation(row),
    advances: storedAdvances(row),
    violations: storedViolations(row),
    otherAdditionsNote: row.otherAdditionsNote ?? null,
    otherDeductionsNote: row.otherDeductionsNote ?? null,
    salaryNote: row.salaryNote ?? null,
    notes: row.notes ?? null,
    paymentMethod: row.paymentMethod ?? null,
    paymentReference: row.paymentReference ?? null,
    createdByName: row.createdByName ?? null,
    createdAt: row.createdAt ?? null,
    approvedByName: row.approvedByName ?? null,
    approvedAt: row.approvedAt ?? null,
    paidByName: row.paidByName ?? null,
    paidAt: row.paidAt ?? null,
    cancelledByName: row.cancelledByName ?? null,
    cancelledAt: row.cancelledAt ?? null,
    cancellationReason: row.cancellationReason ?? null,
  };
}

export function toListRow(row: EndOfServiceSettlement): EndOfServiceListRow {
  return {
    id: row.id,
    settlementNumber: row.settlementNumber,
    requestId: row.requestId,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    employeeCode: row.employeeCode,
    branchId: row.branchId ?? null,
    branchName: row.branchName ?? null,
    lastWorkingDay:
      toVoucherDateString(row.lastWorkingDay) ?? String(row.lastWorkingDay),
    netAmount: signedAmount(row.netAmount),
    status: row.status,
    createdAt: row.createdAt,
    approvedAt: row.approvedAt ?? null,
    paidAt: row.paidAt ?? null,
  };
}

function requestDescription(
  form: EndOfServiceForm,
  calc: EndOfServiceCalculation,
  settlementNumber: string
): string {
  return [
    `${END_OF_SERVICE_REASON_LABELS.contract_expiry.ar} - مخالصة ${settlementNumber}`,
    `تاريخ انتهاء العقد: ${form.contractEndDate}`,
    `آخر يوم عمل: ${form.lastWorkingDay}`,
    `مدة الخدمة: ${calc.serviceText}`,
    `صافي المخالصة: ${calc.netAmount.toFixed(2)} ر.س`,
  ].join("\n");
}

// ==================== تحميل البيانات ====================

async function loadEmployee(
  q: Exec,
  employeeId: number,
  lock: boolean
): Promise<Employee> {
  const rows = lock
    ? await q
        .select()
        .from(employees)
        .where(eq(employees.id, employeeId))
        .for("update")
        .limit(1)
    : await q
        .select()
        .from(employees)
        .where(eq(employees.id, employeeId))
        .limit(1);
  if (!rows[0]) throw new EndOfServiceError("الموظف غير موجود", "NOT_FOUND");
  return rows[0];
}

async function loadBranchName(
  q: Exec,
  branchId: number | null
): Promise<string | null> {
  if (!branchId) return null;
  const rows = await q
    .select({ name: branches.name, nameAr: branches.nameAr })
    .from(branches)
    .where(eq(branches.id, branchId))
    .limit(1);
  return rows[0] ? rows[0].nameAr || rows[0].name : null;
}

async function loadLastPayroll(
  q: Exec,
  employeeId: number
): Promise<LastPayrollRef | null> {
  const rows = await q
    .select({
      year: payrolls.year,
      month: payrolls.month,
      payrollNumber: payrolls.payrollNumber,
    })
    .from(payrollDetails)
    .innerJoin(payrolls, eq(payrolls.id, payrollDetails.payrollId))
    .where(
      and(
        eq(payrollDetails.employeeId, employeeId),
        ne(payrolls.status, "cancelled")
      )
    )
    .orderBy(desc(payrolls.year), desc(payrolls.month))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * بيانات الحساب للموظف (داخل المعاملة عند التعديل)
 * - السلف والمخالفات: المعتمدة غير المخصومة في مسيرة ولا في مخالصة أخرى
 */
async function loadEmployeeContext(
  q: Exec,
  employeeId: number,
  options: {
    lock?: boolean;
    employee?: Employee;
  } = {}
): Promise<EmployeeContext> {
  const employee =
    options.employee ?? (await loadEmployee(q, employeeId, !!options.lock));

  const [branchName, settingsRows, lastPayroll, advanceRows, violationRows] =
    await Promise.all([
      loadBranchName(q, employee.branchId ?? null),
      q
        .select()
        .from(employeeSalarySettings)
        .where(eq(employeeSalarySettings.employeeId, employeeId))
        .limit(1),
      loadLastPayroll(q, employeeId),
      q
        .select({
          id: employeeRequests.id,
          requestNumber: employeeRequests.requestNumber,
          amount: employeeRequests.advanceAmount,
          reviewedAt: employeeRequests.reviewedAt,
          createdAt: employeeRequests.createdAt,
        })
        .from(employeeRequests)
        .where(
          and(
            eq(employeeRequests.employeeId, employeeId),
            eq(employeeRequests.requestType, "advance"),
            eq(employeeRequests.status, "approved"),
            eq(employeeRequests.isDeductedFromSalary, false),
            isNull(employeeRequests.settledInEndOfServiceId)
          )
        )
        .orderBy(employeeRequests.id),
      q
        .select({
          id: employeeViolations.id,
          violationType: employeeViolations.violationType,
          amount: employeeViolations.amount,
          violationDate: employeeViolations.violationDate,
        })
        .from(employeeViolations)
        .where(
          and(
            eq(employeeViolations.employeeId, employeeId),
            eq(employeeViolations.status, "approved"),
            eq(employeeViolations.isDeductedFromSalary, false),
            isNull(employeeViolations.settledInEndOfServiceId)
          )
        )
        .orderBy(employeeViolations.violationDate, employeeViolations.id),
    ]);

  const advances: EndOfServiceDeductionItem[] = [];
  for (const a of advanceRows) {
    const amount = roundMoney(toAmount(a.amount));
    if (amount <= 0) continue;
    advances.push({
      id: a.id,
      label: `سلفة ${a.requestNumber}`,
      amount,
      date: toVoucherDateString(a.reviewedAt ?? a.createdAt),
    });
  }
  const violations: EndOfServiceDeductionItem[] = [];
  for (const v of violationRows) {
    const amount = roundMoney(toAmount(v.amount));
    if (amount <= 0) continue;
    violations.push({
      id: v.id,
      label: v.violationType,
      amount,
      date: toVoucherDateString(v.violationDate),
    });
  }

  return {
    employee,
    branchName,
    wage: buildWageDefaults(settingsRows[0]),
    lastPayroll,
    advances,
    violations,
  };
}

async function findActiveSettlement(q: Exec, employeeId: number) {
  const rows = await q
    .select({
      id: endOfServiceSettlements.id,
      settlementNumber: endOfServiceSettlements.settlementNumber,
      status: endOfServiceSettlements.status,
    })
    .from(endOfServiceSettlements)
    .where(
      and(
        eq(endOfServiceSettlements.employeeId, employeeId),
        ne(endOfServiceSettlements.status, "cancelled")
      )
    )
    .orderBy(desc(endOfServiceSettlements.id))
    .limit(1);
  return rows[0] ?? null;
}

async function maxSequenceFor(q: Exec, year: number): Promise<number> {
  const rows = await q
    .select({
      maxSeq: sql<
        string | number | null
      >`MAX(CAST(SUBSTRING_INDEX(${endOfServiceSettlements.settlementNumber}, '-', -1) AS UNSIGNED))`,
    })
    .from(endOfServiceSettlements)
    .where(like(endOfServiceSettlements.settlementNumber, `EOS-${year}-%`));
  const n = Number(rows[0]?.maxSeq ?? 0);
  return Number.isFinite(n) ? n : 0;
}

async function loadSettlement(
  q: Exec,
  id: number
): Promise<EndOfServiceSettlement> {
  const rows = await q
    .select()
    .from(endOfServiceSettlements)
    .where(eq(endOfServiceSettlements.id, id))
    .limit(1);
  if (!rows[0]) throw new EndOfServiceError("المخالصة غير موجودة", "NOT_FOUND");
  return rows[0];
}

async function loadSettlementForUpdate(
  tx: Tx,
  id: number
): Promise<EndOfServiceSettlement> {
  const rows = await tx
    .select()
    .from(endOfServiceSettlements)
    .where(eq(endOfServiceSettlements.id, id))
    .for("update")
    .limit(1);
  if (!rows[0]) throw new EndOfServiceError("المخالصة غير موجودة", "NOT_FOUND");
  return rows[0];
}

/**
 * موظف المخالصة يُقرأ خارج المعاملة (لا يتغير)، وداخلها يُقفل صف الموظف أولاً ثم المخالصة
 * بنفس الترتيب في كل العمليات حتى لا يحدث تعارض أقفال
 */
/** فرع الموظف (قراءة خارج المعاملة لمعرفة الفرع الذي يُقفل أولاً) */
async function employeeBranchId(
  q: Exec,
  employeeId: number
): Promise<number | null> {
  return (await loadEmployee(q, employeeId, false)).branchId ?? null;
}

/**
 * قفل فرع الموظف ثم صف الموظف، كأول عبارة في المعاملة.
 * المسيرات تُنشأ تحت قفل الفرع نفسه، فلا تتزامن مخالصة مع إنشاء مسيرة تشمل الموظف،
 * وتُقرأ مسيرات الموظف بعد القفل فتظهر أي مسيرة اكتملت قبله
 */
async function lockBranchThenEmployee(
  tx: Tx,
  employeeId: number,
  branchId: number | null
): Promise<Employee> {
  if (branchId != null)
    await tx.execute(
      sql`SELECT id FROM branches WHERE id = ${branchId} FOR UPDATE`
    );
  const employee = await loadEmployee(tx, employeeId, true);
  if ((employee.branchId ?? null) !== branchId) {
    throw new EndOfServiceError(
      "تغير فرع الموظف أثناء العملية، يرجى إعادة المحاولة",
      "CONFLICT"
    );
  }
  return employee;
}

async function lockEmployeeAndSettlement(
  tx: Tx,
  employeeId: number,
  id: number,
  branchId: number | null
) {
  const employee = await lockBranchThenEmployee(tx, employeeId, branchId);
  const settlement = await loadSettlementForUpdate(tx, id);
  if (settlement.employeeId !== employeeId)
    throw new EndOfServiceError("تم تعديل المخالصة، يرجى التحديث", "CONFLICT");
  return { employee, settlement };
}

async function addRequestLog(
  q: Exec,
  requestId: number,
  actor: EndOfServiceActor,
  action: string,
  oldStatus: string | null,
  newStatus: string | null,
  notes?: string | null
) {
  await q.insert(employeeRequestLogs).values({
    requestId,
    action,
    oldStatus,
    newStatus,
    performedBy: actor.id,
    performedByName: actorName(actor),
    notes: notes ?? null,
  });
}

/** تحديث تاريخ المباشرة والجنسية ورقم الهوية في ملف الموظف من بيانات المخالصة */
async function syncEmployeeProfile(
  tx: Tx,
  employee: Employee,
  form: EndOfServiceForm
) {
  const update: Partial<typeof employees.$inferInsert> = {};
  if (form.hireDate && toVoucherDateString(employee.hireDate) !== form.hireDate)
    update.hireDate = form.hireDate;
  const nationality = cleanText(form.nationality, 100);
  if (nationality && nationality !== (employee.nationality ?? ""))
    update.nationality = nationality;
  // رقم الإقامة في ملف الموظف 20 حرفاً كحد أقصى: الأطول يبقى في لقطة المخالصة فقط
  const idNumber = cleanText(form.idNumber);
  if (idNumber && idNumber.length <= 20 && !cleanText(employee.iqamaNumber))
    update.iqamaNumber = idNumber;
  if (Object.keys(update).length > 0) {
    await tx.update(employees).set(update).where(eq(employees.id, employee.id));
  }
}

// ==================== القراءة ====================

/** البيانات الافتراضية لنموذج إنهاء الخدمة */
export async function getDefaults(employeeId: number) {
  const db = await requireDb();
  const ctx = await loadEmployeeContext(db, employeeId);
  const existing = await findActiveSettlement(db, employeeId);
  const emp = ctx.employee;
  return {
    employee: {
      id: emp.id,
      name: emp.name,
      code: emp.code,
      branchId: emp.branchId ?? null,
      branchName: ctx.branchName,
      position: employeeJobTitle(emp.isSupervisor),
      nationality: emp.nationality ?? null,
      idNumber: emp.iqamaNumber ?? null,
      hireDate: toVoucherDateString(emp.hireDate),
      contractEndDate: toVoucherDateString(emp.contractExpiryDate),
      isActive: emp.isActive,
    },
    wage: ctx.wage,
    lastPayroll: ctx.lastPayroll,
    advances: ctx.advances,
    violations: ctx.violations,
    existing,
  };
}

/** معاينة الحساب بنفس دالة الحفظ */
export async function previewSettlement(form: EndOfServiceForm) {
  const db = await requireDb();
  validateFormDates(form);
  const ctx = await loadEmployeeContext(db, form.employeeId);
  const calculation = calculateOrThrow(form, ctx);
  return {
    calculation,
    advances: ctx.advances,
    violations: ctx.violations,
    lastPayroll: ctx.lastPayroll,
  };
}

export async function listSettlements(
  filters: { status?: string | null; branchId?: number | null } | undefined,
  viewer: EndOfServiceViewer
): Promise<EndOfServiceListRow[]> {
  const scope = resolveViewScope(viewer);
  const db = await requireDb();
  const conditions = [];
  const status = filters?.status;
  if (status && (END_OF_SERVICE_STATUSES as string[]).includes(status)) {
    conditions.push(
      eq(endOfServiceSettlements.status, status as EndOfServiceStatus)
    );
  }
  const branchId = scope.branchId ?? filters?.branchId ?? null;
  if (branchId) conditions.push(eq(endOfServiceSettlements.branchId, branchId));
  const rows = await db
    .select()
    .from(endOfServiceSettlements)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(
      desc(endOfServiceSettlements.createdAt),
      desc(endOfServiceSettlements.id)
    )
    .limit(500);
  return rows.map(toListRow);
}

export async function getSettlementForViewer(
  id: number,
  viewer: EndOfServiceViewer
): Promise<EndOfServiceSettlement> {
  resolveViewScope(viewer);
  const db = await requireDb();
  const row = await loadSettlement(db, id);
  assertCanViewSettlement(viewer, row);
  return row;
}

export async function getSettlementById(
  id: number,
  viewer: EndOfServiceViewer
) {
  const row = await getSettlementForViewer(id, viewer);
  const document = toDocumentData(row);
  return {
    id: row.id,
    requestId: row.requestId,
    status: row.status,
    statusLabel: getEndOfServiceStatusLabel(row.status),
    settlementNumber: row.settlementNumber,
    employeeId: row.employeeId,
    branchId: row.branchId ?? null,
    document,
    form: settlementToForm(row),
    warnings: document.calculation.warnings,
    canManage: canManageEndOfService(viewer.role),
  };
}

export async function getSettlementByRequestId(
  requestId: number,
  viewer: EndOfServiceViewer
): Promise<{ id: number } | null> {
  resolveViewScope(viewer);
  const db = await requireDb();
  const rows = await db
    .select({
      id: endOfServiceSettlements.id,
      branchId: endOfServiceSettlements.branchId,
    })
    .from(endOfServiceSettlements)
    .where(eq(endOfServiceSettlements.requestId, requestId))
    .limit(1);
  if (!rows[0]) return null;
  assertCanViewSettlement(viewer, rows[0]);
  return { id: rows[0].id };
}

/** بيانات مستند الطباعة بعد التحقق من صلاحية العرض */
export async function getDocumentData(
  id: number,
  viewer: EndOfServiceViewer
): Promise<EndOfServiceDocumentData> {
  return toDocumentData(await getSettlementForViewer(id, viewer));
}

// ==================== الإنشاء والتعديل ====================

export async function createSettlement(
  form: EndOfServiceForm,
  actor: EndOfServiceActor
) {
  validateFormDates(form);
  const db = await requireDb();

  const branchId = await employeeBranchId(db, form.employeeId);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.transaction(async tx => {
        const employee = await lockBranchThenEmployee(
          tx,
          form.employeeId,
          branchId
        );
        if (!employee.isActive)
          throw new EndOfServiceError(
            "الموظف غير نشط، لا يمكن إنشاء إنهاء خدمة له",
            "CONFLICT"
          );

        const existing = await findActiveSettlement(tx, employee.id);
        if (existing) {
          throw new EndOfServiceError(
            `توجد مخالصة إنهاء خدمة قائمة لهذا الموظف (${existing.settlementNumber})`,
            "CONFLICT"
          );
        }

        const ctx = await loadEmployeeContext(tx, employee.id, {
          employee,
        });
        const calc = calculateOrThrow(form, ctx);
        const year = Number(todayVoucherDate().slice(0, 4));
        const settlementNumber = formatEndOfServiceNumber(
          year,
          (await maxSequenceFor(tx, year)) + 1
        );
        const name = actorName(actor);

        const requestResult = await tx.insert(employeeRequests).values({
          requestNumber: generateRequestNumber(),
          employeeId: employee.id,
          employeeName: employee.name,
          branchId: employee.branchId ?? null,
          branchName: ctx.branchName,
          requestType: "end_of_service",
          status: "pending",
          title: END_OF_SERVICE_REQUEST_TITLE,
          description: requestDescription(form, calc, settlementNumber),
          lastWorkingDay: riyadhMidnight(form.lastWorkingDay),
          priority: "normal",
        });
        const requestId = insertId(requestResult);
        if (!requestId)
          throw new EndOfServiceError("فشل في إنشاء طلب إنهاء الخدمة");

        const settlementResult = await tx
          .insert(endOfServiceSettlements)
          .values({
            ...buildSettlementValues(form, ctx, calc),
            settlementNumber,
            requestId,
            status: "draft",
            createdBy: actor.id,
            createdByName: name,
          });
        const id = insertId(settlementResult);
        if (!id) throw new EndOfServiceError("فشل في إنشاء المخالصة النهائية");

        await syncEmployeeProfile(tx, employee, form);
        await addRequestLog(
          tx,
          requestId,
          actor,
          "إنشاء طلب إنهاء خدمة",
          null,
          "pending",
          `تم إعداد خطاب إنهاء الخدمة والمخالصة النهائية ${settlementNumber}`
        );

        return {
          id,
          requestId,
          settlementNumber,
          message: `تم إنشاء إنهاء الخدمة والمخالصة ${settlementNumber} وهي بانتظار الاعتماد`,
        };
      });
    } catch (error) {
      if (isDuplicateKeyError(error) && attempt < 2) continue; // تعارض رقم المخالصة أو الطلب - إعادة المحاولة
      throw error;
    }
  }
  throw new EndOfServiceError(
    "تعذر إنشاء رقم مخالصة فريد، يرجى إعادة المحاولة",
    "CONFLICT"
  );
}

export async function updateSettlement(
  id: number,
  form: EndOfServiceForm,
  actor: EndOfServiceActor
) {
  validateFormDates(form);
  const db = await requireDb();
  const current = await loadSettlement(db, id);
  const branchId = await employeeBranchId(db, current.employeeId);
  if (form.employeeId !== current.employeeId) {
    throw new EndOfServiceError("لا يمكن تغيير الموظف في المخالصة");
  }

  return await db.transaction(async tx => {
    const { employee, settlement } = await lockEmployeeAndSettlement(
      tx,
      current.employeeId,
      id,
      branchId
    );
    if (!isEndOfServiceEditable(settlement.status)) {
      throw new EndOfServiceError(
        "لا يمكن تعديل مخالصة معتمدة أو مصروفة أو ملغاة",
        "CONFLICT"
      );
    }

    const ctx = await loadEmployeeContext(tx, employee.id, {
      employee,
    });
    const calc = calculateOrThrow(form, ctx);

    const res = await tx
      .update(endOfServiceSettlements)
      .set(buildSettlementValues(form, ctx, calc))
      .where(
        and(
          eq(endOfServiceSettlements.id, id),
          eq(endOfServiceSettlements.status, "draft")
        )
      );
    if (affectedRows(res) === 0)
      throw new EndOfServiceError(
        "تم تعديل المخالصة من مستخدم آخر، يرجى التحديث",
        "CONFLICT"
      );

    await tx
      .update(employeeRequests)
      .set({
        employeeName: employee.name,
        description: requestDescription(
          form,
          calc,
          settlement.settlementNumber
        ),
        lastWorkingDay: riyadhMidnight(form.lastWorkingDay),
      })
      .where(eq(employeeRequests.id, settlement.requestId));

    await syncEmployeeProfile(tx, employee, form);
    await addRequestLog(
      tx,
      settlement.requestId,
      actor,
      "تعديل المخالصة النهائية",
      "pending",
      "pending",
      `صافي المخالصة: ${calc.netAmount.toFixed(2)} ر.س`
    );

    return {
      success: true as const,
      message: "تم حفظ تعديلات المخالصة وإعادة الحساب",
      calculation: calc,
    };
  });
}

// ==================== الحالات ====================

/**
 * ربط السلف والمخالفات بالمخالصة بتحديث مشروط: أي بند خُصم في مسيرة أو مخالصة أخرى أثناء العملية
 * يُفشل الاعتماد بالكامل (تراجع المعاملة)
 */
async function linkSettledItems(
  tx: Tx,
  settlementId: number,
  employeeId: number,
  advances: EndOfServiceDeductionItem[],
  violations: EndOfServiceDeductionItem[]
) {
  const now = new Date();
  const advanceIds = Array.from(new Set(advances.map(a => a.id)));
  if (advanceIds.length) {
    const res = await tx
      .update(employeeRequests)
      .set({
        isDeductedFromSalary: true,
        deductedAt: now,
        settledInEndOfServiceId: settlementId,
      })
      .where(
        and(
          inArray(employeeRequests.id, advanceIds),
          eq(employeeRequests.employeeId, employeeId),
          eq(employeeRequests.requestType, "advance"),
          eq(employeeRequests.status, "approved"),
          eq(employeeRequests.isDeductedFromSalary, false),
          isNull(employeeRequests.settledInEndOfServiceId)
        )
      );
    if (affectedRows(res) !== advanceIds.length) {
      throw new EndOfServiceError(
        "تغيرت سلف الموظف أثناء الاعتماد (خُصم بعضها في مسير أو أُلغي)، يرجى إعادة المحاولة",
        "CONFLICT"
      );
    }
  }

  const violationIds = Array.from(new Set(violations.map(v => v.id)));
  if (violationIds.length) {
    const res = await tx
      .update(employeeViolations)
      .set({
        isDeductedFromSalary: true,
        deductedAt: now,
        settledInEndOfServiceId: settlementId,
      })
      .where(
        and(
          inArray(employeeViolations.id, violationIds),
          eq(employeeViolations.employeeId, employeeId),
          eq(employeeViolations.status, "approved"),
          eq(employeeViolations.isDeductedFromSalary, false),
          isNull(employeeViolations.settledInEndOfServiceId)
        )
      );
    if (affectedRows(res) !== violationIds.length) {
      throw new EndOfServiceError(
        "تغيرت مخالفات الموظف أثناء الاعتماد (خُصم بعضها في مسير أو أُلغي)، يرجى إعادة المحاولة",
        "CONFLICT"
      );
    }
  }
}

/** تحرير السلف والمخالفات المرتبطة بالمخالصة (عند إلغائها بعد الاعتماد) */
async function releaseSettledItems(tx: Tx, settlementId: number) {
  await tx
    .update(employeeRequests)
    .set({
      isDeductedFromSalary: false,
      deductedAt: null,
      settledInEndOfServiceId: null,
    })
    .where(eq(employeeRequests.settledInEndOfServiceId, settlementId));
  await tx
    .update(employeeViolations)
    .set({
      isDeductedFromSalary: false,
      deductedAt: null,
      settledInEndOfServiceId: null,
    })
    .where(eq(employeeViolations.settledInEndOfServiceId, settlementId));
}

/**
 * تحديث مسيرات الرواتب المفتوحة بعد تغيّر بنود الموظف (تحرير سلف/مخالفات بإلغاء المخالصة).
 * فشل التحديث لا يُلغي العملية المحفوظة، ويمكن إعادة الحساب من صفحة المسيرة
 */
async function syncOpenPayrollsSafely(employeeId: number) {
  try {
    const { syncOpenPayrollsForEmployee } = await import("../payroll/service");
    await syncOpenPayrollsForEmployee(employeeId);
  } catch (error) {
    console.error(
      `[EndOfService] تعذر تحديث المسيرات المفتوحة للموظف ${employeeId}:`,
      error
    );
  }
}

export async function approveSettlement(id: number, actor: EndOfServiceActor) {
  const db = await requireDb();
  const current = await loadSettlement(db, id);
  const branchId = await employeeBranchId(db, current.employeeId);

  const outcome = await db.transaction(async tx => {
    const { employee, settlement } = await lockEmployeeAndSettlement(
      tx,
      current.employeeId,
      id,
      branchId
    );
    if (!canTransitionEndOfService(settlement.status, "approved")) {
      throw new EndOfServiceError(
        `لا يمكن اعتماد مخالصة حالتها "${getEndOfServiceStatusLabel(settlement.status).ar}"`,
        "CONFLICT"
      );
    }

    // إعادة الحساب من البيانات الحالية بنفس المدخلات اليدوية المحفوظة
    const form = settlementToForm(settlement);
    const ctx = await loadEmployeeContext(tx, employee.id, {
      employee,
    });
    const calc = calculateOrThrow(form, ctx);
    const values = buildSettlementValues(form, ctx, calc);
    const stored = {
      totalEntitlements: signedAmount(settlement.totalEntitlements),
      totalDeductions: signedAmount(settlement.totalDeductions),
      netAmount: signedAmount(settlement.netAmount),
    };

    if (settlementTotalsChanged(stored, calc)) {
      const res = await tx
        .update(endOfServiceSettlements)
        .set(values)
        .where(
          and(
            eq(endOfServiceSettlements.id, id),
            eq(endOfServiceSettlements.status, "draft")
          )
        );
      if (affectedRows(res) === 0)
        throw new EndOfServiceError(
          "تم تعديل المخالصة من مستخدم آخر، يرجى التحديث",
          "CONFLICT"
        );
      // وصف الطلب يحمل صافي المخالصة: يُحدّث مع الأرقام الجديدة
      await tx
        .update(employeeRequests)
        .set({
          description: requestDescription(
            form,
            calc,
            settlement.settlementNumber
          ),
        })
        .where(eq(employeeRequests.id, settlement.requestId));
      await addRequestLog(
        tx,
        settlement.requestId,
        actor,
        "إعادة حساب المخالصة قبل الاعتماد",
        "pending",
        "pending",
        `الصافي الجديد: ${calc.netAmount.toFixed(2)} ر.س`
      );
      return { changed: true as const };
    }

    await linkSettledItems(tx, id, employee.id, ctx.advances, ctx.violations);

    const now = new Date();
    const name = actorName(actor);
    const res = await tx
      .update(endOfServiceSettlements)
      .set({
        ...values,
        status: "approved",
        approvedBy: actor.id,
        approvedByName: name,
        approvedAt: now,
      })
      .where(
        and(
          eq(endOfServiceSettlements.id, id),
          eq(endOfServiceSettlements.status, "draft")
        )
      );
    if (affectedRows(res) === 0)
      throw new EndOfServiceError(
        "تم تعديل المخالصة من مستخدم آخر، يرجى التحديث",
        "CONFLICT"
      );

    await tx
      .update(employeeRequests)
      .set({
        status: "approved",
        reviewedBy: actor.id,
        reviewedByName: name,
        reviewedAt: now,
        description: requestDescription(
          form,
          calc,
          settlement.settlementNumber
        ),
      })
      .where(eq(employeeRequests.id, settlement.requestId));

    // انتهاء الخدمة: الموظف لا يدخل مسيرات الرواتب اللاحقة
    await tx
      .update(employees)
      .set({ isActive: false })
      .where(eq(employees.id, employee.id));

    await addRequestLog(
      tx,
      settlement.requestId,
      actor,
      "اعتماد إنهاء الخدمة والمخالصة",
      "pending",
      "approved",
      `صافي المخالصة: ${calc.netAmount.toFixed(2)} ر.س`
    );
    return {
      changed: false as const,
      settlementNumber: settlement.settlementNumber,
    };
  });

  if (outcome.changed)
    throw new EndOfServiceError(SETTLEMENTS_CHANGED_MESSAGE, "CONFLICT");
  await syncOpenPayrollsSafely(current.employeeId);
  return {
    success: true as const,
    message: `تم اعتماد المخالصة ${outcome.settlementNumber} وإنهاء خدمة الموظف`,
  };
}

export async function markSettlementPaid(
  id: number,
  paymentMethod: EndOfServicePaymentMethod,
  paymentReference: string | null | undefined,
  actor: EndOfServiceActor
) {
  if (!END_OF_SERVICE_PAYMENT_METHODS[paymentMethod])
    throw new EndOfServiceError("طريقة الصرف غير صحيحة");
  const db = await requireDb();
  return await db.transaction(async tx => {
    const settlement = await loadSettlementForUpdate(tx, id);
    if (!canTransitionEndOfService(settlement.status, "paid")) {
      throw new EndOfServiceError(
        "لا يمكن صرف المخالصة قبل اعتمادها أو بعد إلغائها",
        "CONFLICT"
      );
    }
    const name = actorName(actor);
    const res = await tx
      .update(endOfServiceSettlements)
      .set({
        status: "paid",
        paymentMethod,
        paymentReference: cleanText(paymentReference, 100),
        paidBy: actor.id,
        paidByName: name,
        paidAt: new Date(),
      })
      .where(
        and(
          eq(endOfServiceSettlements.id, id),
          eq(endOfServiceSettlements.status, "approved")
        )
      );
    if (affectedRows(res) === 0)
      throw new EndOfServiceError(
        "تم تعديل المخالصة من مستخدم آخر، يرجى التحديث",
        "CONFLICT"
      );
    await addRequestLog(
      tx,
      settlement.requestId,
      actor,
      "صرف المخالصة النهائية",
      "approved",
      "approved",
      `${END_OF_SERVICE_PAYMENT_METHODS[paymentMethod].ar} - ${signedAmount(settlement.netAmount).toFixed(2)} ر.س`
    );
    return {
      success: true as const,
      message: `تم تسجيل صرف المخالصة ${settlement.settlementNumber}`,
    };
  });
}

export async function cancelSettlement(
  id: number,
  reason: string,
  actor: EndOfServiceActor
) {
  const cleanReason = cleanText(reason, 1000);
  if (!cleanReason || cleanReason.length < 3)
    throw new EndOfServiceError("سبب الإلغاء مطلوب");
  const db = await requireDb();
  const current = await loadSettlement(db, id);
  const branchId = await employeeBranchId(db, current.employeeId);

  const result = await db.transaction(async tx => {
    const { employee, settlement } = await lockEmployeeAndSettlement(
      tx,
      current.employeeId,
      id,
      branchId
    );
    if (settlement.status === "paid")
      throw new EndOfServiceError("لا يمكن إلغاء مخالصة تم صرفها");
    if (!canTransitionEndOfService(settlement.status, "cancelled")) {
      throw new EndOfServiceError("المخالصة ملغاة بالفعل", "CONFLICT");
    }

    const wasApproved = settlement.status === "approved";
    if (wasApproved) {
      await releaseSettledItems(tx, id);
      await tx
        .update(employees)
        .set({ isActive: true })
        .where(eq(employees.id, employee.id));
    }

    const now = new Date();
    const name = actorName(actor);
    const res = await tx
      .update(endOfServiceSettlements)
      .set({
        status: "cancelled",
        cancelledBy: actor.id,
        cancelledByName: name,
        cancelledAt: now,
        cancellationReason: cleanReason,
      })
      .where(
        and(
          eq(endOfServiceSettlements.id, id),
          eq(endOfServiceSettlements.status, settlement.status)
        )
      );
    if (affectedRows(res) === 0)
      throw new EndOfServiceError(
        "تم تعديل المخالصة من مستخدم آخر، يرجى التحديث",
        "CONFLICT"
      );

    const oldRequestStatus = wasApproved ? "approved" : "pending";
    await tx
      .update(employeeRequests)
      .set({
        status: "cancelled",
        rejectionReason: cleanReason,
        reviewedBy: actor.id,
        reviewedByName: name,
        reviewedAt: now,
      })
      .where(eq(employeeRequests.id, settlement.requestId));
    await addRequestLog(
      tx,
      settlement.requestId,
      actor,
      "إلغاء إنهاء الخدمة والمخالصة",
      oldRequestStatus,
      "cancelled",
      cleanReason
    );

    return { wasApproved, settlementNumber: settlement.settlementNumber };
  });

  if (result.wasApproved) await syncOpenPayrollsSafely(current.employeeId);
  return {
    success: true as const,
    message: result.wasApproved
      ? `تم إلغاء المخالصة ${result.settlementNumber} وإعادة تفعيل الموظف وتحرير السلف والمخالفات`
      : `تم إلغاء المخالصة ${result.settlementNumber}`,
  };
}

// ==================== التكامل مع الطلبات ====================

/**
 * طلب إنهاء الخدمة يظهر للموظف (بوابة الموظف / طلباتي) بعد اعتماده فقط:
 * المسودة قرار إداري لم يصدر بعد، والملغى قبل الاعتماد لم يُبلّغ به
 */
export function isRequestVisibleToEmployee(request: {
  requestType: string;
  status: string;
}): boolean {
  return (
    request.requestType !== "end_of_service" || request.status === "approved"
  );
}

/**
 * حذف طلب إنهاء خدمة (للمسؤول): مسموح فقط إذا كانت مخالصته ملغاة، وتُحذف معه
 * يُرجع false إذا لم يكن الطلب من نوع إنهاء الخدمة
 */
export async function deleteEndOfServiceRequest(
  requestId: number
): Promise<boolean> {
  const db = await requireDb();
  return await db.transaction(async tx => {
    // نفس ترتيب الأقفال في الاعتماد والإلغاء: المخالصة ثم الطلب
    const settlements = await tx
      .select({
        id: endOfServiceSettlements.id,
        status: endOfServiceSettlements.status,
      })
      .from(endOfServiceSettlements)
      .where(eq(endOfServiceSettlements.requestId, requestId))
      .for("update")
      .limit(1);
    const requests = await tx
      .select({
        id: employeeRequests.id,
        requestType: employeeRequests.requestType,
      })
      .from(employeeRequests)
      .where(eq(employeeRequests.id, requestId))
      .for("update")
      .limit(1);
    if (!requests[0] || requests[0].requestType !== "end_of_service")
      return false;

    const settlement = settlements[0];
    if (settlement && settlement.status !== "cancelled") {
      throw new EndOfServiceError("ألغِ المخالصة أولاً");
    }
    if (settlement)
      await tx
        .delete(endOfServiceSettlements)
        .where(eq(endOfServiceSettlements.id, settlement.id));
    await tx.delete(employeeRequests).where(eq(employeeRequests.id, requestId));
    return true;
  });
}

/** للاختبارات فقط */
export const _internal = {
  parseCalculationSnapshot,
  requestDescription,
  riyadhMidnight,
};
