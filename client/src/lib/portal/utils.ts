/**
 * Portal Utilities - Helper functions for Employee and Admin portals
 */

import { DOCUMENT_THRESHOLDS } from './constants';
import type { DocumentStatus, DocumentStatusInfo, DocumentType } from './types';

/**
 * Calculate days remaining until a date
 */
export function getDaysRemaining(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);
  
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Get document status based on days remaining
 */
export function getDocumentStatus(daysRemaining: number | null): DocumentStatus {
  if (daysRemaining === null) return 'missing';
  if (daysRemaining <= DOCUMENT_THRESHOLDS.EXPIRED) return 'expired';
  if (daysRemaining <= DOCUMENT_THRESHOLDS.CRITICAL) return 'critical';
  if (daysRemaining <= DOCUMENT_THRESHOLDS.WARNING) return 'warning';
  if (daysRemaining <= DOCUMENT_THRESHOLDS.UPCOMING) return 'upcoming';
  return 'valid';
}

/**
 * Get document status label in Arabic
 */
export function getDocumentStatusLabel(status: DocumentStatus): string {
  const labels: Record<DocumentStatus, string> = {
    expired: 'منتهي',
    critical: 'حرج',
    warning: 'قريب الانتهاء',
    upcoming: 'يقترب',
    valid: 'ساري',
    missing: 'غير مسجل',
  };
  return labels[status];
}

/**
 * Format date to Arabic locale string
 */
export function formatDateArabic(date: Date | string | null | undefined): string {
  if (!date) return '-';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  return d.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format date to Hijri calendar
 */
export function formatDateHijri(date: Date | string | null | undefined): string {
  if (!date) return '-';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  return d.toLocaleDateString('ar-SA-u-ca-islamic', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format relative time (e.g., "منذ 3 أيام")
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 1) return 'الآن';
  if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;
  if (diffDays < 7) return `منذ ${diffDays} يوم`;
  if (diffDays < 30) return `منذ ${Math.floor(diffDays / 7)} أسبوع`;
  
  return formatDateArabic(d);
}

/**
 * Format currency in SAR
 */
export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return '0 ر.س';
  
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  return new Intl.NumberFormat('ar-SA', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num) + ' ر.س';
}

/**
 * Get initials from name (for avatar)
 */
export function getInitials(name: string): string {
  if (!name) return '؟';
  
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0);
  
  return parts[0].charAt(0) + parts[parts.length - 1].charAt(0);
}

/**
 * Analyze all documents and return status info
 */
export function analyzeDocuments(documentInfo: {
  iqamaExpiryDate?: Date | string | null;
  iqamaImage?: string | null;
  healthCertExpiryDate?: Date | string | null;
  healthCertImage?: string | null;
  contractExpiryDate?: Date | string | null;
  contractImage?: string | null;
}): DocumentStatusInfo[] {
  const documents: { type: DocumentType; name: string; expiryDate: Date | string | null | undefined; image: string | null | undefined }[] = [
    { type: 'iqama', name: 'الإقامة', expiryDate: documentInfo.iqamaExpiryDate, image: documentInfo.iqamaImage },
    { type: 'healthCert', name: 'الشهادة الصحية', expiryDate: documentInfo.healthCertExpiryDate, image: documentInfo.healthCertImage },
    { type: 'contract', name: 'عقد العمل', expiryDate: documentInfo.contractExpiryDate, image: documentInfo.contractImage },
  ];
  
  return documents.map(doc => {
    const daysRemaining = getDaysRemaining(doc.expiryDate);
    const status = getDocumentStatus(daysRemaining);
    
    return {
      type: doc.type,
      name: doc.name,
      expiryDate: doc.expiryDate ? new Date(doc.expiryDate) : null,
      status,
      daysRemaining,
      hasImage: !!doc.image,
    };
  });
}

/**
 * Get overall document health score (0-100)
 */
export function getDocumentHealthScore(documents: DocumentStatusInfo[]): number {
  if (documents.length === 0) return 0;
  
  const scores: Record<DocumentStatus, number> = {
    valid: 100,
    upcoming: 80,
    warning: 50,
    critical: 20,
    expired: 0,
    missing: 0,
  };
  
  const totalScore = documents.reduce((sum, doc) => sum + scores[doc.status], 0);
  return Math.round(totalScore / documents.length);
}

/**
 * Check if user has supervisor privileges
 */
export function isSupervisorOrAdmin(role: string): boolean {
  return ['supervisor', 'admin', 'مشرف', 'مدير'].includes(role.toLowerCase());
}

/**
 * Generate unique ID for messages
 */
export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}
