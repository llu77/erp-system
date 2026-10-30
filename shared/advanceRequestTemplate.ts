/**
 * طلب السلفة الرسمي (صفحة A4 RTL) - مشترك بين بوابة الموظفين والنظام الرئيسي والخادم (PDF)
 * (واجهة مؤقتة - يُستكمل التنفيذ)
 * - الترويسة باسم مؤسسة فرع الطلب
 * - التوقيعات والختم فقط بعد الموافقة
 */

import type { EmployeeDocumentTemplateOptions } from "./payslipTemplate";

export const REPAYMENT_METHOD_LABELS: Record<string, string> = {
  salary_deduction: "خصم من الراتب",
  installments: "أقساط شهرية",
  full_payment: "سداد كامل",
};

export function repaymentMethodLabel(code: string | null | undefined): string {
  if (!code) return REPAYMENT_METHOD_LABELS.salary_deduction;
  return REPAYMENT_METHOD_LABELS[code] ?? code;
}

export interface AdvanceRequestDocumentData {
  requestId: number;
  requestNumber: string;
  /** تاريخ تقديم الطلب */
  requestDate: string | Date;
  /** pending | approved | rejected | cancelled */
  status: string;
  branchId: number | null;
  branchName: string | null;
  employee: {
    id: number;
    name: string;
    code: string;
    position?: string | null;
    iqamaNumber?: string | null;
    nationality?: string | null;
    phone?: string | null;
    hireDate?: string | null;
  };
  amount: number;
  reason?: string | null;
  /** salary_deduction | installments | full_payment */
  repaymentMethod?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | Date | null;
  reviewNotes?: string | null;
  rejectionReason?: string | null;
  /** أين خُصمت السلفة (إن خُصمت) */
  deduction?: { kind: "payroll" | "end_of_service"; reference: string; period?: string | null } | null;
}

/** التوقيعات والختم: للطلب الموافق عليه فقط */
export function isAdvanceRequestSigned(status: string | null | undefined): boolean {
  return status === "approved";
}

/** طلب السلفة (HTML كامل) */
export function renderAdvanceRequestHtml(
  _data: AdvanceRequestDocumentData,
  _options: EmployeeDocumentTemplateOptions = {}
): string {
  throw new Error("renderAdvanceRequestHtml: not implemented yet");
}
