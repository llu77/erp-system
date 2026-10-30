/**
 * Portal Library - Main export file
 *
 * Shared utilities, types, constants, and hooks for Employee and Admin portals.
 * Portal identity comes from the server session (employeeAuth.me), never from the browser.
 */

// Constants
export * from './constants';

// Types
export * from './types';

// Utilities
export * from './utils';

// Session, routing, formatting and document logic
export {
  ADMIN_PORTAL_PATH,
  EMPLOYEE_PORTAL_PATH,
  PORTAL_LOGIN_PATH,
  portalHomePath,
  resolveAdminPortalAccess,
  resolveAuthRedirect,
  resolvePortalTab,
} from './portalUi';
export { usePortalSession, clearLegacyPortalStorage, type PortalMe } from './usePortalSession';
