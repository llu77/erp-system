/**
 * useEmployeeData - Hook for fetching and managing employee data
 */

import { useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import type { EmployeeInfo, PortalUser } from '../types';

interface UseEmployeeDataOptions {
  employeeId: number;
  enabled?: boolean;
}

interface UseEmployeeDataReturn {
  employee: EmployeeInfo | null;
  portalUser: PortalUser | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useEmployeeData({ employeeId, enabled = true }: UseEmployeeDataOptions): UseEmployeeDataReturn {
  const {
    data: profile,
    isLoading,
    isError,
    error,
    refetch,
  } = trpc.employeePortal.getProfile.useQuery(
    { employeeId },
    { 
      enabled: enabled && employeeId > 0,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  const employee: EmployeeInfo | null = useMemo(() => {
    if (!profile) return null;
    
    return {
      id: profile.id,
      name: profile.name,
      code: profile.code,
      branchId: profile.branchId,
      branchName: profile.branchName,
      position: profile.position,
      email: profile.email,
      emailVerified: profile.emailVerified ?? false,
      isSupervisor: profile.isSupervisor ?? false,
    };
  }, [profile]);

  const portalUser: PortalUser | null = useMemo(() => {
    if (!employee) return null;
    
    return {
      id: employee.id,
      name: employee.name,
      role: employee.isSupervisor ? 'supervisor' : 'employee',
      branchId: employee.branchId,
      branchName: employee.branchName,
      email: employee.email,
      isSupervisor: employee.isSupervisor ?? false,
      isAdmin: false,
      accessAllBranches: false,
    };
  }, [employee]);

  return {
    employee,
    portalUser,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}

/**
 * useEmployeeSalary - Hook for salary data
 */
interface UseSalaryOptions {
  employeeId: number;
  year: number;
  month: number;
  enabled?: boolean;
}

export function useEmployeeSalary({ employeeId, year, month, enabled = true }: UseSalaryOptions) {
  const {
    data: salarySlip,
    isLoading,
    isError,
    error,
    refetch,
  } = trpc.employeePortal.getSalarySlip.useQuery(
    { employeeId, year, month },
    {
      enabled: enabled && employeeId > 0,
      retry: 1,
    }
  );

  const { data: salaryHistory } = trpc.employeePortal.getSalaryHistory.useQuery(
    { employeeId, limit: 12 },
    {
      enabled: enabled && employeeId > 0,
      retry: 1,
    }
  );

  return {
    salarySlip,
    salaryHistory: salaryHistory ?? [],
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}

/**
 * useEmployeeLeaves - Hook for leave balance and history
 */
interface UseLeavesOptions {
  employeeId: number;
  year: number;
  enabled?: boolean;
}

export function useEmployeeLeaves({ employeeId, year, enabled = true }: UseLeavesOptions) {
  const {
    data: leaveBalance,
    isLoading: loadingBalance,
    refetch: refetchBalance,
  } = trpc.employeePortal.getLeaveBalance.useQuery(
    { employeeId, year },
    {
      enabled: enabled && employeeId > 0,
      retry: 1,
    }
  );

  const {
    data: leaveHistory,
    isLoading: loadingHistory,
    refetch: refetchHistory,
  } = trpc.employeePortal.getLeaveHistory.useQuery(
    { employeeId, year },
    {
      enabled: enabled && employeeId > 0,
      retry: 1,
    }
  );

  return {
    leaveBalance,
    leaveHistory: leaveHistory ?? [],
    isLoading: loadingBalance || loadingHistory,
    refetch: () => {
      refetchBalance();
      refetchHistory();
    },
  };
}

/**
 * useEmployeeBonus - Hook for bonus data
 */
interface UseBonusOptions {
  employeeId: number;
  year: number;
  month: number;
  enabled?: boolean;
}

export function useEmployeeBonus({ employeeId, year, month, enabled = true }: UseBonusOptions) {
  const {
    data: bonusReport,
    isLoading: loadingReport,
    refetch: refetchReport,
  } = trpc.employeePortal.getBonusReport.useQuery(
    { employeeId, year, month },
    {
      enabled: enabled && employeeId > 0,
      retry: 1,
    }
  );

  const {
    data: bonusHistory,
    isLoading: loadingHistory,
    refetch: refetchHistory,
  } = trpc.employeePortal.getBonusHistory.useQuery(
    { employeeId, limit: 6 },
    {
      enabled: enabled && employeeId > 0,
      retry: 1,
    }
  );

  return {
    bonusReport,
    bonusHistory: bonusHistory ?? [],
    isLoading: loadingReport || loadingHistory,
    refetch: () => {
      refetchReport();
      refetchHistory();
    },
  };
}
