/**
 * مستندات الموظف على الخادم: بيانات وPDF قسيمة الراتب وطلب السلفة
 * (واجهة مؤقتة - يُستكمل التنفيذ)
 */

import type { PayslipDocumentData } from '../shared/payslipTemplate';
import type { AdvanceRequestDocumentData } from '../shared/advanceRequestTemplate';

/** بيانات قسيمة موظف في مسيرة (null إذا لم يكن الموظف في المسيرة) - لا تتحقق من الصلاحية أو الحالة */
export async function getPayslipDocumentData(_payrollId: number, _employeeId: number): Promise<PayslipDocumentData | null> {
  throw new Error('getPayslipDocumentData: not implemented yet');
}

/** بيانات طلب سلفة (null إذا لم يوجد أو لم يكن سلفة) - لا تتحقق من الصلاحية */
export async function getAdvanceRequestDocumentData(_requestId: number): Promise<AdvanceRequestDocumentData | null> {
  throw new Error('getAdvanceRequestDocumentData: not implemented yet');
}

export async function generatePayslipPDF(_data: PayslipDocumentData): Promise<Buffer> {
  throw new Error('generatePayslipPDF: not implemented yet');
}

export async function generateAdvanceRequestPDF(_data: AdvanceRequestDocumentData): Promise<Buffer> {
  throw new Error('generateAdvanceRequestPDF: not implemented yet');
}

export function payslipFileName(data: Pick<PayslipDocumentData, 'payrollNumber' | 'employee'>): string {
  const safe = (v: string) => String(v).replace(/[^A-Za-z0-9_-]/g, '_');
  return `payslip-${safe(data.payrollNumber)}-${safe(data.employee.code)}.pdf`;
}

export function advanceRequestFileName(data: Pick<AdvanceRequestDocumentData, 'requestNumber'>): string {
  return `advance-request-${String(data.requestNumber).replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`;
}
