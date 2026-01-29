/**
 * Portal Library - Main export file
 * 
 * Shared utilities, types, constants, and hooks for Employee and Admin portals
 */

// Constants
export * from './constants';

// Types
export * from './types';

// Utilities
export * from './utils';

// Hooks
export { useEmployeeData, useEmployeeSalary, useEmployeeLeaves, useEmployeeBonus } from './hooks/useEmployeeData';
export { useDocumentStatus, useDocumentSubmission, useSupervisorDocuments } from './hooks/useDocumentStatus';
export { useEmployeeRequests, useRequestMutations, useSupervisorRequests, useRequestAttachments } from './hooks/useRequestManagement';
