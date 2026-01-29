/**
 * useRequestManagement - Hook for managing employee requests
 */

import { useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import type { FilterOptions } from '../types';

interface UseRequestsOptions {
  employeeId: number;
  enabled?: boolean;
}

interface UseRequestsReturn {
  requests: any[];
  stats: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

export function useEmployeeRequests({ employeeId, enabled = true }: UseRequestsOptions): UseRequestsReturn {
  const {
    data: requests,
    isLoading: loadingRequests,
    isError,
    error,
    refetch: refetchRequests,
  } = trpc.employeeRequests.list.useQuery(
    { employeeId },
    {
      enabled: enabled && employeeId > 0,
      retry: 1,
    }
  );

  const {
    data: stats,
    isLoading: loadingStats,
    refetch: refetchStats,
  } = trpc.employeePortal.getRequestsStats.useQuery(
    { employeeId },
    {
      enabled: enabled && employeeId > 0,
      retry: 1,
    }
  );

  const formattedRequests = useMemo(() => {
    if (!requests) return [];
    return requests.map((req: any) => ({
      ...req,
      createdAt: new Date(req.createdAt),
      updatedAt: new Date(req.updatedAt),
    }));
  }, [requests]);

  return {
    requests: formattedRequests,
    stats: stats ?? { total: 0, pending: 0, approved: 0, rejected: 0 },
    isLoading: loadingRequests || loadingStats,
    isError,
    error,
    refetch: () => {
      refetchRequests();
      refetchStats();
    },
  };
}

/**
 * useRequestMutations - Hook for request CRUD operations
 */
interface UseRequestMutationsOptions {
  employeeId: number;
  onSuccess?: (action: 'create' | 'update' | 'cancel') => void;
  onError?: (error: unknown) => void;
}

export function useRequestMutations({ employeeId, onSuccess, onError }: UseRequestMutationsOptions) {
  const utils = trpc.useUtils();

  const invalidateQueries = () => {
    utils.employeeRequests.list.invalidate({ employeeId });
    utils.employeePortal.getRequestsStats.invalidate({ employeeId });
  };

  const cancelMutation = trpc.employeePortal.cancelRequest.useMutation({
    onSuccess: () => {
      invalidateQueries();
      onSuccess?.('cancel');
    },
    onError: (error) => onError?.(error),
  });

  const updateMutation = trpc.employeePortal.updateRequest.useMutation({
    onSuccess: () => {
      invalidateQueries();
      onSuccess?.('update');
    },
    onError: (error) => onError?.(error),
  });

  return {
    cancelRequest: (requestId: number) => cancelMutation.mutateAsync({ requestId, employeeId }),
    updateRequest: (requestId: number, data: any) => updateMutation.mutateAsync({ requestId, employeeId, ...data }),
    isCancelling: cancelMutation.isPending,
    isUpdating: updateMutation.isPending,
    cancelError: cancelMutation.error,
    updateError: updateMutation.error,
  };
}

/**
 * useSupervisorRequests - Hook for supervisors to manage all requests
 */
interface UseSupervisorRequestsOptions {
  branchId?: number;
  filters?: FilterOptions;
  enabled?: boolean;
}

export function useSupervisorRequests({ branchId, filters, enabled = true }: UseSupervisorRequestsOptions) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const {
    data: requestsData,
    isLoading,
    refetch,
  } = trpc.employeeRequests.list.useQuery(
    {
      branchId,
      status: filters?.status,
      requestType: filters?.requestType,
    },
    {
      enabled,
      retry: 1,
    }
  );

  const updateStatusMutation = trpc.employeeRequests.updateStatus.useMutation({
    onSuccess: () => refetch(),
  });

  return {
    requests: requestsData ?? [],
    totalCount: (requestsData ?? []).length,
    page,
    pageSize,
    setPage,
    setPageSize,
    isLoading,
    refetch,
    approveRequest: (id: number, note?: string) => updateStatusMutation.mutateAsync({ id, status: 'approved', reviewNotes: note }),
    rejectRequest: (id: number, note?: string) => updateStatusMutation.mutateAsync({ id, status: 'rejected', rejectionReason: note }),
    isApproving: updateStatusMutation.isPending,
    isRejecting: updateStatusMutation.isPending,
  };
}

/**
 * useRequestAttachments - Hook for managing request attachments
 */
interface UseAttachmentsOptions {
  requestId: number;
  employeeId: number;
  enabled?: boolean;
}

export function useRequestAttachments({ requestId, employeeId, enabled = true }: UseAttachmentsOptions) {
  const {
    data: attachments,
    isLoading,
    refetch,
  } = trpc.employeePortal.getAttachments.useQuery(
    { requestId },
    {
      enabled: enabled && requestId > 0,
      retry: 1,
    }
  );

  const uploadMutation = trpc.employeePortal.uploadAttachment.useMutation({
    onSuccess: () => refetch(),
  });

  const deleteMutation = trpc.employeePortal.deleteAttachment.useMutation({
    onSuccess: () => refetch(),
  });

  return {
    attachments: attachments ?? [],
    isLoading,
    refetch,
    uploadAttachment: (file: { fileName: string; base64Data: string; contentType: string }) =>
      uploadMutation.mutateAsync({ requestId, employeeId, ...file }),
    deleteAttachment: (attachmentId: number) =>
      deleteMutation.mutateAsync({ attachmentId, employeeId }),
    isUploading: uploadMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
