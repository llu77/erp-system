/**
 * Document Status Service
 * 
 * Provides utilities for analyzing and managing employee document statuses
 * including expiry tracking, health scoring, and reminder scheduling.
 */

import * as db from '../db';

// Types
export interface DocumentInfo {
  type: 'iqama' | 'healthCert' | 'contract';
  expiryDate: Date | null;
  hasImage: boolean;
}

export interface DocumentStatus {
  type: 'iqama' | 'healthCert' | 'contract';
  name: string;
  status: 'expired' | 'critical' | 'warning' | 'upcoming' | 'valid' | 'missing';
  expiryDate: Date | null;
  daysRemaining: number | null;
  hasImage: boolean;
}

export interface EmployeeDocumentSummary {
  employeeId: number;
  employeeName: string;
  branchId: number;
  branchName: string;
  documents: DocumentStatus[];
  healthScore: number;
  hasIssues: boolean;
}

export interface DocumentReminder {
  employeeId: number;
  employeeName: string;
  branchId: number;
  branchName: string;
  documentType: string;
  documentName: string;
  expiryDate: Date;
  daysRemaining: number;
  status: 'critical' | 'warning' | 'upcoming';
}

// Constants
const DOCUMENT_NAMES: Record<string, string> = {
  iqama: 'الإقامة',
  healthCert: 'الشهادة الصحية',
  contract: 'عقد العمل',
};

const THRESHOLDS = {
  critical: 7,    // 7 days or less
  warning: 30,    // 30 days or less
  upcoming: 60,   // 60 days or less
};

/**
 * Calculate days remaining until expiry
 */
function getDaysRemaining(expiryDate: Date | null): number | null {
  if (!expiryDate) return null;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  
  const diffTime = expiry.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Determine document status based on days remaining
 */
function getDocumentStatus(daysRemaining: number | null, hasImage: boolean): DocumentStatus['status'] {
  if (daysRemaining === null) return 'missing';
  if (daysRemaining <= 0) return 'expired';
  if (daysRemaining <= THRESHOLDS.critical) return 'critical';
  if (daysRemaining <= THRESHOLDS.warning) return 'warning';
  if (daysRemaining <= THRESHOLDS.upcoming) return 'upcoming';
  return 'valid';
}

/**
 * Calculate document health score (0-100)
 */
function calculateHealthScore(documents: DocumentStatus[]): number {
  if (documents.length === 0) return 0;
  
  let score = 0;
  const maxScore = documents.length * 100;
  
  for (const doc of documents) {
    switch (doc.status) {
      case 'valid':
        score += 100;
        break;
      case 'upcoming':
        score += 80;
        break;
      case 'warning':
        score += 50;
        break;
      case 'critical':
        score += 20;
        break;
      case 'expired':
        score += 0;
        break;
      case 'missing':
        score += 0;
        break;
    }
  }
  
  return Math.round((score / maxScore) * 100);
}

/**
 * Analyze a single employee's documents
 */
export function analyzeEmployeeDocuments(employee: {
  iqamaExpiryDate: Date | null;
  iqamaImageUrl: string | null;
  healthCertExpiryDate: Date | null;
  healthCertImageUrl: string | null;
  contractExpiryDate: Date | null;
  contractImageUrl: string | null;
}): DocumentStatus[] {
  const documents: DocumentStatus[] = [];
  
  // Iqama
  const iqamaDays = getDaysRemaining(employee.iqamaExpiryDate);
  documents.push({
    type: 'iqama',
    name: DOCUMENT_NAMES.iqama,
    status: getDocumentStatus(iqamaDays, !!employee.iqamaImageUrl),
    expiryDate: employee.iqamaExpiryDate,
    daysRemaining: iqamaDays,
    hasImage: !!employee.iqamaImageUrl,
  });
  
  // Health Certificate
  const healthDays = getDaysRemaining(employee.healthCertExpiryDate);
  documents.push({
    type: 'healthCert',
    name: DOCUMENT_NAMES.healthCert,
    status: getDocumentStatus(healthDays, !!employee.healthCertImageUrl),
    expiryDate: employee.healthCertExpiryDate,
    daysRemaining: healthDays,
    hasImage: !!employee.healthCertImageUrl,
  });
  
  // Contract
  const contractDays = getDaysRemaining(employee.contractExpiryDate);
  documents.push({
    type: 'contract',
    name: DOCUMENT_NAMES.contract,
    status: getDocumentStatus(contractDays, !!employee.contractImageUrl),
    expiryDate: employee.contractExpiryDate,
    daysRemaining: contractDays,
    hasImage: !!employee.contractImageUrl,
  });
  
  return documents;
}

/**
 * Get document status summary for a single employee
 */
export async function getEmployeeDocumentSummary(employeeId: number): Promise<EmployeeDocumentSummary | null> {
  const employee = await db.getEmployeeById(employeeId);
  if (!employee) return null;
  
  const documents = analyzeEmployeeDocuments({
    iqamaExpiryDate: employee.iqamaExpiryDate,
    iqamaImageUrl: employee.iqamaImageUrl,
    healthCertExpiryDate: employee.healthCertExpiryDate,
    healthCertImageUrl: employee.healthCertImageUrl,
    contractExpiryDate: employee.contractExpiryDate,
    contractImageUrl: employee.contractImageUrl,
  });
  
  const healthScore = calculateHealthScore(documents);
  const hasIssues = documents.some(d => 
    d.status === 'expired' || d.status === 'critical' || d.status === 'warning'
  );
  
  return {
    employeeId: employee.id,
    employeeName: employee.name,
    branchId: employee.branchId,
    branchName: (employee as any).branchName || '',
    documents,
    healthScore,
    hasIssues,
  };
}

/**
 * Get all employees with document issues (for supervisor/admin dashboard)
 */
export async function getEmployeesWithDocumentIssues(options?: {
  branchId?: number;
  daysThreshold?: number;
}): Promise<EmployeeDocumentSummary[]> {
  const threshold = options?.daysThreshold ?? THRESHOLDS.warning;
  
  // Get expiring documents from database
  const expiringData = await db.getEmployeesWithExpiringDocuments();
  
  // Process and group by employee
  const employeeMap = new Map<number, EmployeeDocumentSummary>();
  
  // Process expiring iqama
  for (const emp of expiringData.expiring.iqama) {
    if (options?.branchId && emp.branchId !== options.branchId) continue;
    
    if (!employeeMap.has(emp.id)) {
      const documents = analyzeEmployeeDocuments({
        iqamaExpiryDate: emp.iqamaExpiryDate,
        iqamaImageUrl: emp.iqamaImageUrl,
        healthCertExpiryDate: emp.healthCertExpiryDate,
        healthCertImageUrl: emp.healthCertImageUrl,
        contractExpiryDate: emp.contractExpiryDate,
        contractImageUrl: emp.contractImageUrl,
      });
      
      employeeMap.set(emp.id, {
        employeeId: emp.id,
        employeeName: emp.name,
        branchId: emp.branchId,
        branchName: emp.branchName || '',
        documents,
        healthScore: calculateHealthScore(documents),
        hasIssues: true,
      });
    }
  }
  
  // Process expired iqama
  for (const emp of expiringData.expired.iqama) {
    if (options?.branchId && emp.branchId !== options.branchId) continue;
    
    if (!employeeMap.has(emp.id)) {
      const documents = analyzeEmployeeDocuments({
        iqamaExpiryDate: emp.iqamaExpiryDate,
        iqamaImageUrl: emp.iqamaImageUrl,
        healthCertExpiryDate: emp.healthCertExpiryDate,
        healthCertImageUrl: emp.healthCertImageUrl,
        contractExpiryDate: emp.contractExpiryDate,
        contractImageUrl: emp.contractImageUrl,
      });
      
      employeeMap.set(emp.id, {
        employeeId: emp.id,
        employeeName: emp.name,
        branchId: emp.branchId,
        branchName: emp.branchName || '',
        documents,
        healthScore: calculateHealthScore(documents),
        hasIssues: true,
      });
    }
  }
  
  // Sort by health score (lowest first = most urgent)
  return Array.from(employeeMap.values()).sort((a, b) => a.healthScore - b.healthScore);
}

/**
 * Get document reminders for notification purposes
 */
export async function getDocumentReminders(options?: {
  branchId?: number;
  daysThreshold?: number;
}): Promise<DocumentReminder[]> {
  const threshold = options?.daysThreshold ?? THRESHOLDS.warning;
  const reminders: DocumentReminder[] = [];
  
  const expiringData = await db.getEmployeesWithExpiringDocuments();
  
  // Helper to add reminder
  const addReminder = (
    emp: any, 
    docType: string, 
    docName: string, 
    expiryDate: Date | null
  ) => {
    if (!expiryDate) return;
    if (options?.branchId && emp.branchId !== options.branchId) return;
    
    const daysRemaining = getDaysRemaining(expiryDate);
    if (daysRemaining === null || daysRemaining > threshold) return;
    
    let status: 'critical' | 'warning' | 'upcoming';
    if (daysRemaining <= THRESHOLDS.critical) status = 'critical';
    else if (daysRemaining <= THRESHOLDS.warning) status = 'warning';
    else status = 'upcoming';
    
    reminders.push({
      employeeId: emp.id,
      employeeName: emp.name,
      branchId: emp.branchId,
      branchName: emp.branchName || '',
      documentType: docType,
      documentName: docName,
      expiryDate,
      daysRemaining,
      status,
    });
  };
  
  // Process all expiring documents
  for (const emp of expiringData.expiring.iqama) {
    addReminder(emp, 'iqama', DOCUMENT_NAMES.iqama, emp.iqamaExpiryDate);
  }
  for (const emp of expiringData.expiring.healthCert) {
    addReminder(emp, 'healthCert', DOCUMENT_NAMES.healthCert, emp.healthCertExpiryDate);
  }
  for (const emp of expiringData.expiring.contract) {
    addReminder(emp, 'contract', DOCUMENT_NAMES.contract, emp.contractExpiryDate);
  }
  
  // Sort by days remaining (most urgent first)
  return reminders.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

/**
 * Get document completion status for an employee
 */
export async function getDocumentCompletionStatus(employeeId: number): Promise<{
  isComplete: boolean;
  completionPercentage: number;
  missingDocuments: string[];
}> {
  const summary = await getEmployeeDocumentSummary(employeeId);
  
  if (!summary) {
    return {
      isComplete: false,
      completionPercentage: 0,
      missingDocuments: ['الإقامة', 'الشهادة الصحية', 'عقد العمل'],
    };
  }
  
  const missingDocuments: string[] = [];
  let completedCount = 0;
  
  for (const doc of summary.documents) {
    if (doc.status !== 'missing' && doc.expiryDate) {
      completedCount++;
    } else {
      missingDocuments.push(doc.name);
    }
  }
  
  return {
    isComplete: missingDocuments.length === 0,
    completionPercentage: Math.round((completedCount / summary.documents.length) * 100),
    missingDocuments,
  };
}
