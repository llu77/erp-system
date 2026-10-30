/**
 * مستندات الموظف على الخادم: بيانات وPDF مسيرة الراتب وطلب السلفة
 * - البيانات من لقطة المسيرة / الطلب وقت إصداره (فرع المسيرة أو الطلب، لا فرع الموظف الحالي)
 * - الصور (التوقيعات وختم المؤسسة) والخط تُضمَّن كـ data URI حتى يعمل PDF بدون شبكة
 * - هذه الدوال لا تتحقق من الصلاحية أو الحالة: يتحقق منها الإجراء المستدعي
 */

import { and, eq } from "drizzle-orm";
import {
  branches,
  employeeRequests,
  employeeSalarySettings,
  employees,
  endOfServiceSettlements,
  payrollDetails,
  payrolls,
} from "../drizzle/schema";
import {
  buildPayslipDocumentData,
  renderPayslipHtml,
  type PayslipDocumentData,
} from "../shared/payslipTemplate";
import {
  buildAdvanceRequestDocumentData,
  renderAdvanceRequestHtml,
  type AdvanceDeductionSource,
  type AdvanceRequestDocumentData,
} from "../shared/advanceRequestTemplate";
import { getDb } from "./db";
import { loadDocumentAssetsForBranch, renderHtmlToPdf } from "./voucherPdf";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  return db;
}

/** بيانات مسيرة راتب موظف في مسيرة (null إذا لم يكن الموظف في المسيرة) - لا تتحقق من الصلاحية أو الحالة */
export async function getPayslipDocumentData(
  payrollId: number,
  employeeId: number
): Promise<PayslipDocumentData | null> {
  const db = await requireDb();
  const [payroll] = await db
    .select()
    .from(payrolls)
    .where(eq(payrolls.id, payrollId))
    .limit(1);
  if (!payroll) return null;
  const [detail] = await db
    .select()
    .from(payrollDetails)
    .where(
      and(
        eq(payrollDetails.payrollId, payrollId),
        eq(payrollDetails.employeeId, employeeId)
      )
    )
    .limit(1);
  if (!detail) return null;

  const [[employee], [settings]] = await Promise.all([
    db
      .select({
        iqamaNumber: employees.iqamaNumber,
        nationality: employees.nationality,
        hireDate: employees.hireDate,
      })
      .from(employees)
      .where(eq(employees.id, employeeId))
      .limit(1),
    db
      .select({
        bankName: employeeSalarySettings.bankName,
        iban: employeeSalarySettings.iban,
      })
      .from(employeeSalarySettings)
      .where(eq(employeeSalarySettings.employeeId, employeeId))
      .limit(1),
  ]);

  return buildPayslipDocumentData(payroll, detail, {
    iqamaNumber: employee?.iqamaNumber ?? null,
    nationality: employee?.nationality ?? null,
    hireDate: employee?.hireDate ?? null,
    bankName: settings?.bankName ?? null,
    iban: settings?.iban ?? null,
  });
}

/** بيانات طلب سلفة (null إذا لم يوجد أو لم يكن سلفة) - لا تتحقق من الصلاحية */
export async function getAdvanceRequestDocumentData(
  requestId: number
): Promise<AdvanceRequestDocumentData | null> {
  const db = await requireDb();
  const [request] = await db
    .select()
    .from(employeeRequests)
    .where(eq(employeeRequests.id, requestId))
    .limit(1);
  if (!request || request.requestType !== "advance") return null;

  const [employee] = await db
    .select({
      code: employees.code,
      isSupervisor: employees.isSupervisor,
      iqamaNumber: employees.iqamaNumber,
      nationality: employees.nationality,
      phone: employees.phone,
      hireDate: employees.hireDate,
      branchId: employees.branchId,
    })
    .from(employees)
    .where(eq(employees.id, request.employeeId))
    .limit(1);

  // فرع الطلب كما حُفظ وقت تقديمه؛ وإلا اسم فرعه الحالي من جدول الفروع
  let branchName = request.branchName?.trim() || null;
  const branchId = request.branchId ?? employee?.branchId ?? null;
  if (!branchName && branchId) {
    const [branch] = await db
      .select({ name: branches.name, nameAr: branches.nameAr })
      .from(branches)
      .where(eq(branches.id, branchId))
      .limit(1);
    branchName = branch ? branch.nameAr || branch.name : null;
  }

  const deduction: AdvanceDeductionSource = {};
  if (request.deductedInPayrollId) {
    const [payroll] = await db
      .select({
        payrollNumber: payrolls.payrollNumber,
        year: payrolls.year,
        month: payrolls.month,
        status: payrolls.status,
      })
      .from(payrolls)
      .where(eq(payrolls.id, request.deductedInPayrollId))
      .limit(1);
    deduction.payroll = payroll ?? null;
  }
  if (request.settledInEndOfServiceId) {
    const [settlement] = await db
      .select({
        settlementNumber: endOfServiceSettlements.settlementNumber,
        status: endOfServiceSettlements.status,
      })
      .from(endOfServiceSettlements)
      .where(eq(endOfServiceSettlements.id, request.settledInEndOfServiceId))
      .limit(1);
    deduction.settlement = settlement ?? null;
  }

  return buildAdvanceRequestDocumentData(
    { ...request, branchId, branchName },
    employee ?? null,
    deduction
  );
}

/** HTML مسيرة الراتب بصور وخط مضمّنة (شعار وختم مؤسسة فرع المسيرة) */
export function renderPayslipHtmlEmbedded(
  data: PayslipDocumentData,
  options: { includeFont?: boolean; printedAt?: Date } = {}
): string {
  return renderPayslipHtml(data, {
    assets: loadDocumentAssetsForBranch(data.branchName, {
      includeFont: options.includeFont,
    }),
    printedAt: options.printedAt,
  });
}

/** HTML طلب السلفة بصور وخط مضمّنة (شعار وختم مؤسسة فرع الطلب) */
export function renderAdvanceRequestHtmlEmbedded(
  data: AdvanceRequestDocumentData,
  options: { includeFont?: boolean; printedAt?: Date } = {}
): string {
  return renderAdvanceRequestHtml(data, {
    assets: loadDocumentAssetsForBranch(data.branchName, {
      includeFont: options.includeFont,
    }),
    printedAt: options.printedAt,
  });
}

export async function generatePayslipPDF(
  data: PayslipDocumentData
): Promise<Buffer> {
  return renderHtmlToPdf(renderPayslipHtmlEmbedded(data));
}

export async function generateAdvanceRequestPDF(
  data: AdvanceRequestDocumentData
): Promise<Buffer> {
  return renderHtmlToPdf(renderAdvanceRequestHtmlEmbedded(data));
}

export function payslipFileName(
  data: Pick<PayslipDocumentData, "payrollNumber" | "employee">
): string {
  const safe = (v: string) => String(v).replace(/[^A-Za-z0-9_-]/g, "_");
  return `payroll-statement-${safe(data.payrollNumber)}-${safe(data.employee.code)}.pdf`;
}

export function advanceRequestFileName(
  data: Pick<AdvanceRequestDocumentData, "requestNumber">
): string {
  return `advance-request-${String(data.requestNumber).replace(/[^A-Za-z0-9_-]/g, "_")}.pdf`;
}
