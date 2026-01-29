/**
 * Portal Types - Shared type definitions for Employee and Admin portals
 */

// User roles
export type UserRole = 'employee' | 'supervisor' | 'admin';

// Request types
export type RequestType = 'advance' | 'vacation' | 'arrears' | 'permission' | 'objection' | 'resignation';

// Request status
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

// Document types
export type DocumentType = 'iqama' | 'healthCert' | 'contract';

// Document status
export type DocumentStatus = 'expired' | 'critical' | 'warning' | 'upcoming' | 'valid' | 'missing';

// Employee info interface
export interface EmployeeInfo {
  id: number;
  name: string;
  code: string;
  branchId: number;
  branchName: string;
  position: string | null;
  email: string | null;
  emailVerified: boolean;
  isSupervisor?: boolean;
}

// Admin/Supervisor info interface
export interface AdminInfo {
  id: number;
  name: string;
  username: string;
  role: string;
  branchId?: number;
  branchName?: string;
  isAdmin: boolean;
  isSupervisor: boolean;
  accessAllBranches: boolean;
}

// Portal user - unified type
export interface PortalUser {
  id: number;
  name: string;
  role: UserRole;
  branchId?: number;
  branchName?: string;
  email?: string | null;
  isSupervisor: boolean;
  isAdmin: boolean;
  accessAllBranches: boolean;
}

// Request interface
export interface EmployeeRequest {
  id: number;
  requestNumber: string;
  employeeId: number;
  employeeName: string;
  employeeCode: string;
  branchId: number;
  branchName: string;
  requestType: RequestType;
  status: RequestStatus;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  // Type-specific fields
  advanceAmount?: string;
  advanceReason?: string;
  vacationStartDate?: Date;
  vacationEndDate?: Date;
  vacationDays?: number;
  permissionDate?: Date;
  permissionStartTime?: string;
  permissionEndTime?: string;
  // Response fields
  responseNote?: string;
  respondedBy?: number;
  respondedAt?: Date;
}

// Document info interface
export interface DocumentInfo {
  iqamaNumber?: string;
  iqamaExpiryDate?: Date | null;
  iqamaImage?: string | null;
  healthCertExpiryDate?: Date | null;
  healthCertImage?: string | null;
  contractExpiryDate?: Date | null;
  contractImage?: string | null;
  submittedAt?: Date | null;
}

// Document status info
export interface DocumentStatusInfo {
  type: DocumentType;
  name: string;
  expiryDate: Date | null;
  status: DocumentStatus;
  daysRemaining: number | null;
  hasImage: boolean;
}

// Portal statistics
export interface PortalStats {
  totalEmployees: number;
  pendingRequests: number;
  approvedRequests: number;
  expiredDocuments: number;
  expiringDocuments: number;
}

// Salary slip interface
export interface SalarySlip {
  id: number;
  employeeId: number;
  year: number;
  month: number;
  basicSalary: string;
  allowances: string;
  deductions: string;
  bonus: string;
  netSalary: string;
  paidAt?: Date;
}

// Leave balance interface
export interface LeaveBalance {
  annualTotal: number;
  annualUsed: number;
  annualRemaining: number;
  sickTotal: number;
  sickUsed: number;
  sickRemaining: number;
}

// Chat message interface
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  hasPendingRequest?: boolean;
  pendingRequestType?: string;
}

// Tab configuration
export interface TabConfig {
  id: string;
  label: string;
  icon: string;
  badge?: number;
  disabled?: boolean;
}

// Filter options
export interface FilterOptions {
  branch?: string;
  status?: string;
  requestType?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}
