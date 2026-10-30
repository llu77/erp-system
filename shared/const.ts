export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';
// جلسة بوابة الموظفين (منفصلة عن جلسة النظام الرئيسي)
export const EMPLOYEE_COOKIE_NAME = "emp_session";
export const EMPLOYEE_UNAUTHED_ERR_MSG = 'Employee login required (10003)';
export const EMPLOYEE_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;
