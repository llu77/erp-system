/**
 * قسيمة الراتب الرسمية (صفحة A4 RTL) - مشتركة بين بوابة الموظفين والنظام الرئيسي والخادم (PDF)
 * (واجهة مؤقتة - يُستكمل التنفيذ)
 * - الترويسة باسم مؤسسة فرع المسيرة (getEstablishmentForBranch)
 * - التوقيعات والختم فقط للمسيرة المعتمدة أو المصروفة
 */

import type { Establishment } from "./branding";
import type { VoucherTemplateAssets } from "./voucherTemplate";

export interface PayslipItem {
  label: string;
  amount: number;
  date?: string | null;
  note?: string | null;
}

/** بيانات القسيمة (من لقطة المسيرة وقت إصدارها، لا من بيانات الموظف الحالية) */
export interface PayslipDocumentData {
  payrollId: number;
  payrollNumber: string;
  year: number;
  month: number;
  /** YYYY-MM-DD */
  periodStart?: string | null;
  periodEnd?: string | null;
  /** draft | pending | approved | paid | cancelled */
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
    hireDate?: string | null;
    bankName?: string | null;
    iban?: string | null;
  };
  earnings: {
    baseSalary: number;
    overtimeEnabled: boolean;
    overtimeAmount: number;
    incentiveAmount: number;
    isSupervisor: boolean;
  };
  attendance: {
    workDays: number;
    absentDays: number;
    leaveDays: number;
    leaveType?: string | null;
  };
  deductions: {
    absentDeduction: number;
    leaveDeduction: number;
    advanceDeduction: number;
    violationsDeduction: number;
    negativeInvoicesDeduction: number;
    otherDeduction: number;
    otherDeductionReason?: string | null;
  };
  /** تفاصيل البنود (من لقطات JSON في سطر المسيرة) */
  items: {
    advances: PayslipItem[];
    violations: PayslipItem[];
    leaves: PayslipItem[];
    negativeInvoices: PayslipItem[];
  };
  totals: {
    grossSalary: number;
    totalDeductions: number;
    netSalary: number;
  };
  notes?: string | null;
  createdByName?: string | null;
  createdAt?: string | Date | null;
  approvedByName?: string | null;
  approvedAt?: string | Date | null;
  paidAt?: string | Date | null;
  paymentMethod?: string | null;
  paymentReference?: string | null;
}

/** خيارات قوالب مستندات الموظف (القسيمة وطلب السلفة) */
export interface EmployeeDocumentTemplateOptions {
  /** أساس روابط الصور (مثال: window.location.origin). يُتجاهل للصور المُمررة صراحةً في assets */
  assetBaseUrl?: string;
  /** صور وخط مُمررة صراحةً (data URIs في الخادم) */
  assets?: VoucherTemplateAssets;
  /** تجاوز المؤسسة (الافتراضي: مؤسسة الفرع) */
  establishment?: Establishment;
  /** سكربت طباعة تلقائية بعد التحميل */
  autoPrint?: boolean;
  /** وقت الطباعة (للاختبارات) */
  printedAt?: Date;
}

/** التوقيعات والختم: للمسيرة المعتمدة أو المصروفة فقط */
export function isPayslipSigned(status: string | null | undefined): boolean {
  return status === "approved" || status === "paid";
}

/** قسيمة الراتب (HTML كامل) */
export function renderPayslipHtml(_data: PayslipDocumentData, _options: EmployeeDocumentTemplateOptions = {}): string {
  throw new Error("renderPayslipHtml: not implemented yet");
}
