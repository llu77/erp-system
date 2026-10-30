/**
 * أنواع واجهة إنهاء الخدمة (مطابقة لعقد موجّه endOfService في الخادم)
 * تُستخدم لتثبيت شكل البيانات في الواجهة؛ عند اختلاف الخادم يظهر خطأ الأنواع هنا بدلاً من وقت التشغيل.
 */

import type {
  EndOfServiceCalculation,
  EndOfServiceDeductionItem,
  EndOfServiceDocumentData,
  EndOfServiceDocumentKind,
} from "@shared/endOfService";

/** مدخلات نموذج إنهاء الخدمة (create/update/preview) - التواريخ YYYY-MM-DD */
export interface EosFormInput {
  employeeId: number;
  hireDate: string;
  contractEndDate: string;
  lastWorkingDay: string;
  letterDate: string;
  nationality?: string | null;
  idNumber?: string | null;
  position?: string | null;
  baseSalary: number;
  fixedAllowances: number;
  leaveBalanceDaysOverride?: number | null;
  leaveNote?: string | null;
  salaryDaysOverride?: number | null;
  salaryNote?: string | null;
  otherAdditions?: number;
  otherAdditionsNote?: string | null;
  otherDeductions?: number;
  otherDeductionsNote?: string | null;
  notes?: string | null;
}

export interface EosLastPayroll {
  year: number;
  month: number;
  payrollNumber: string;
}

export interface EosWageBreakdownLine {
  label: string;
  amount: number;
}

/** endOfService.defaults */
export interface EosDefaults {
  employee: {
    id: number;
    name: string;
    code: string;
    branchId: number | null;
    branchName: string | null;
    position: string | null;
    nationality: string | null;
    idNumber: string | null;
    hireDate: string | null;
    contractEndDate: string | null;
    isActive: boolean;
  };
  wage: {
    baseSalary: number;
    fixedAllowances: number;
    breakdown: EosWageBreakdownLine[];
  };
  annualLeaveDaysTaken: number;
  lastPayroll: EosLastPayroll | null;
  advances: EndOfServiceDeductionItem[];
  violations: EndOfServiceDeductionItem[];
  existing: { id: number; settlementNumber: string; status: string } | null;
}

/** endOfService.preview */
export interface EosPreview {
  calculation: EndOfServiceCalculation;
  advances: EndOfServiceDeductionItem[];
  violations: EndOfServiceDeductionItem[];
  lastPayroll: EosLastPayroll | null;
  annualLeaveDaysTaken: number;
}

/** صف في endOfService.list */
export interface EosListRow {
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
  status: string;
  createdAt: Date | string;
  approvedAt: Date | string | null;
  paidAt: Date | string | null;
}

/** endOfService.getById */
export interface EosDetail {
  id: number;
  requestId: number;
  status: string;
  settlementNumber: string;
  employeeId: number;
  branchId: number | null;
  document: EndOfServiceDocumentData;
  form: EosFormInput;
  warnings: string[];
  canManage: boolean;
}

export type EosPaymentMethod = "cash" | "bank_transfer" | "check";

export type { EndOfServiceDocumentKind };
