/**
 * useDocumentStatus - Hook for document status management
 */

import { useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { analyzeDocuments, getDocumentHealthScore } from '../utils';
import type { DocumentStatusInfo } from '../types';

interface UseDocumentStatusOptions {
  employeeId: number;
  enabled?: boolean;
}

interface UseDocumentStatusReturn {
  documents: DocumentStatusInfo[];
  healthScore: number;
  hasSubmitted: boolean;
  expiredCount: number;
  criticalCount: number;
  warningCount: number;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

export function useDocumentStatus({ employeeId, enabled = true }: UseDocumentStatusOptions): UseDocumentStatusReturn {
  // Check if employee has submitted info
  const {
    data: submissionStatus,
    isLoading: checkingSubmission,
  } = trpc.employeePortal.hasSubmittedInfo.useQuery(
    { employeeId },
    {
      enabled: enabled && employeeId > 0,
      retry: 1,
    }
  );

  // Get document info
  const {
    data: documentInfo,
    isLoading: loadingInfo,
    isError,
    error,
    refetch,
  } = trpc.employeePortal.getDocumentInfo.useQuery(
    { employeeId },
    {
      enabled: enabled && employeeId > 0,
      retry: 1,
    }
  );

  // Analyze documents
  const documents = useMemo(() => {
    if (!documentInfo) return [];
    return analyzeDocuments({
      iqamaExpiryDate: documentInfo.iqamaExpiryDate,
      iqamaImage: documentInfo.iqamaImageUrl,
      healthCertExpiryDate: documentInfo.healthCertExpiryDate,
      healthCertImage: documentInfo.healthCertImageUrl,
      contractExpiryDate: documentInfo.contractExpiryDate,
      contractImage: documentInfo.contractImageUrl,
    });
  }, [documentInfo]);

  // Calculate health score
  const healthScore = useMemo(() => {
    return getDocumentHealthScore(documents);
  }, [documents]);

  // Count by status
  const { expiredCount, criticalCount, warningCount } = useMemo(() => {
    let expired = 0;
    let critical = 0;
    let warning = 0;

    documents.forEach(doc => {
      if (doc.status === 'expired') expired++;
      else if (doc.status === 'critical') critical++;
      else if (doc.status === 'warning') warning++;
    });

    return { expiredCount: expired, criticalCount: critical, warningCount: warning };
  }, [documents]);

  return {
    documents,
    healthScore,
    hasSubmitted: submissionStatus?.hasSubmitted ?? false,
    expiredCount,
    criticalCount,
    warningCount,
    isLoading: checkingSubmission || loadingInfo,
    isError,
    error,
    refetch,
  };
}

/**
 * useDocumentSubmission - Hook for submitting/updating documents
 */
interface UseDocumentSubmissionOptions {
  employeeId: number;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}

export function useDocumentSubmission({ employeeId, onSuccess, onError }: UseDocumentSubmissionOptions) {
  const utils = trpc.useUtils();

  const submitMutation = trpc.employeePortal.submitInfo.useMutation({
    onSuccess: () => {
      // Invalidate related queries
      utils.employeePortal.hasSubmittedInfo.invalidate({ employeeId });
      utils.employeePortal.getDocumentInfo.invalidate({ employeeId });
      onSuccess?.();
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  const uploadImageMutation = trpc.employeePortal.uploadDocumentImage.useMutation({
    onSuccess: () => {
      utils.employeePortal.getDocumentInfo.invalidate({ employeeId });
    },
  });

  return {
    submitInfo: submitMutation.mutateAsync,
    uploadImage: uploadImageMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,
    isUploading: uploadImageMutation.isPending,
    submitError: submitMutation.error,
    uploadError: uploadImageMutation.error,
  };
}

/**
 * useSupervisorDocuments - Hook for supervisors to view all employees' documents
 */
interface UseSupervisorDocumentsOptions {
  branchId?: number;
  enabled?: boolean;
}

export function useSupervisorDocuments({ branchId, enabled = true }: UseSupervisorDocumentsOptions) {
  const {
    data: expiringDocuments,
    isLoading,
    refetch,
  } = trpc.employees.getExpiringDocuments.useQuery(
    undefined,
    {
      enabled,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  // Group by status - handle the complex return type
  const { expired, critical, warning, totalExpiring } = useMemo(() => {
    if (!expiringDocuments) {
      return { expired: [], critical: [], warning: [], totalExpiring: 0 };
    }

    // The API returns { expiring, expired, summary }
    const data = expiringDocuments as any;
    
    // Flatten all expiring documents
    const allExpiring: any[] = [];
    const allExpired: any[] = [];
    
    if (data.expiring) {
      if (data.expiring.iqama) allExpiring.push(...data.expiring.iqama.map((e: any) => ({ ...e, docType: 'iqama' })));
      if (data.expiring.healthCert) allExpiring.push(...data.expiring.healthCert.map((e: any) => ({ ...e, docType: 'healthCert' })));
      if (data.expiring.contract) allExpiring.push(...data.expiring.contract.map((e: any) => ({ ...e, docType: 'contract' })));
    }
    
    if (data.expired) {
      if (data.expired.iqama) allExpired.push(...data.expired.iqama.map((e: any) => ({ ...e, docType: 'iqama' })));
      if (data.expired.healthCert) allExpired.push(...data.expired.healthCert.map((e: any) => ({ ...e, docType: 'healthCert' })));
      if (data.expired.contract) allExpired.push(...data.expired.contract.map((e: any) => ({ ...e, docType: 'contract' })));
    }

    // Filter by branchId if provided
    const filterByBranch = (items: any[]) => {
      if (!branchId) return items;
      return items.filter((item: any) => item.branchId === branchId);
    };

    return {
      expired: filterByBranch(allExpired),
      critical: filterByBranch(allExpiring.filter((d: any) => {
        const days = getDaysUntilExpiry(d);
        return days !== null && days <= 7;
      })),
      warning: filterByBranch(allExpiring.filter((d: any) => {
        const days = getDaysUntilExpiry(d);
        return days !== null && days > 7 && days <= 30;
      })),
      totalExpiring: filterByBranch(allExpiring).length + filterByBranch(allExpired).length,
    };
  }, [expiringDocuments, branchId]);

  return {
    expiringDocuments: [...expired, ...critical, ...warning],
    expired,
    critical,
    warning,
    totalExpiring,
    isLoading,
    refetch,
  };
}

// Helper function
function getDaysUntilExpiry(doc: any): number | null {
  const expiryField = doc.docType === 'iqama' ? 'iqamaExpiryDate' 
    : doc.docType === 'healthCert' ? 'healthCertExpiryDate' 
    : 'contractExpiryDate';
  
  const expiryDate = doc[expiryField];
  if (!expiryDate) return null;
  
  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
