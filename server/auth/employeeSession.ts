/**
 * جلسة بوابة الموظفين (منفصلة عن جلسة النظام الرئيسي)
 *
 * - كوكي httpOnly باسم EMPLOYEE_COOKIE_NAME يحمل JWT (HS256) موقّعاً بـ JWT_SECRET (بدون سر احتياطي)
 * - audience = 'employee-portal' و subject = رقم الموظف و sv = employees.sessionVersion
 * - الجلسة تسقط فوراً عند زيادة sessionVersion (تغيير/إعادة تعيين كلمة المرور أو إيقاف الدخول)
 */

import type { CookieOptions, Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import { parse as parseCookieHeader } from "cookie";
import { eq } from "drizzle-orm";
import { EMPLOYEE_COOKIE_NAME, EMPLOYEE_SESSION_TTL_MS } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";

export const EMPLOYEE_SESSION_AUDIENCE = "employee-portal";
const EMPLOYEE_SESSION_KIND = "employee";

/** هوية الموظف في سياق tRPC (فقط بعد التحقق من الكوكي وحالة الحساب) */
export interface PortalEmployee {
  id: number;
  name: string;
  code: string;
  branchId: number | null;
  isSupervisor: boolean;
}

export interface EmployeeSessionClaims {
  employeeId: number;
  sessionVersion: number;
}

/** خطأ إعداد الخادم (JWT_SECRET غير مضبوط) */
export class EmployeeSessionConfigError extends Error {
  constructor() {
    super("JWT_SECRET غير مضبوط على الخادم: لا يمكن إنشاء جلسة بوابة الموظفين");
    this.name = "EmployeeSessionConfigError";
  }
}

/** سر التوقيع: JWT_SECRET فقط (لا يوجد سر احتياطي) */
function getSessionKey(): Uint8Array {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) throw new EmployeeSessionConfigError();
  return new TextEncoder().encode(secret);
}

export function isEmployeeSessionConfigured(): boolean {
  return Boolean(process.env.JWT_SECRET?.trim());
}

/** تعذّر التحقق من جلسة صالحة التوقيع بسبب خطأ في قاعدة البيانات (ليس "غير مسجل") */
export class EmployeeSessionLookupError extends Error {
  constructor(cause?: unknown) {
    super("تعذر التحقق من جلسة الموظف");
    this.name = "EmployeeSessionLookupError";
    this.cause = cause;
  }
}

/** توقيع جلسة موظف */
export async function signEmployeeSession(
  claims: EmployeeSessionClaims,
  options: { ttlMs?: number; now?: Date } = {}
): Promise<string> {
  const key = getSessionKey();
  const issuedAtSec = Math.floor((options.now ?? new Date()).getTime() / 1000);
  const ttlSec = Math.floor((options.ttlMs ?? EMPLOYEE_SESSION_TTL_MS) / 1000);
  return new SignJWT({ kind: EMPLOYEE_SESSION_KIND, sv: claims.sessionVersion })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(claims.employeeId))
    .setAudience(EMPLOYEE_SESSION_AUDIENCE)
    .setIssuedAt(issuedAtSec)
    .setExpirationTime(issuedAtSec + ttlSec)
    .sign(key);
}

/** التحقق من رمز الجلسة؛ يُرجع null لأي رمز غير صالح أو منتهي أو موجّه لجمهور آخر */
export async function verifyEmployeeSession(
  token: string | null | undefined
): Promise<EmployeeSessionClaims | null> {
  if (!token) return null;
  let key: Uint8Array;
  try {
    key = getSessionKey();
  } catch {
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, key, {
      audience: EMPLOYEE_SESSION_AUDIENCE,
      algorithms: ["HS256"],
    });
    if (payload.kind !== EMPLOYEE_SESSION_KIND) return null;
    const employeeId = Number(payload.sub);
    const sessionVersion = payload.sv;
    if (!Number.isInteger(employeeId) || employeeId <= 0) return null;
    if (typeof sessionVersion !== "number" || !Number.isInteger(sessionVersion)) return null;
    return { employeeId, sessionVersion };
  } catch {
    return null;
  }
}

/** هل يحمل الرمز جمهور بوابة الموظفين؟ (لرفضه في جلسة النظام الرئيسي) */
export function isEmployeePortalAudience(aud: unknown): boolean {
  if (Array.isArray(aud)) return aud.includes(EMPLOYEE_SESSION_AUDIENCE);
  return aud === EMPLOYEE_SESSION_AUDIENCE;
}

/** خيارات الكوكي: نفس إعدادات النظام لكن sameSite=lax ومدة الجلسة */
export function getEmployeeSessionCookieOptions(req: Request): CookieOptions {
  return {
    ...getSessionCookieOptions(req),
    sameSite: "lax",
    maxAge: EMPLOYEE_SESSION_TTL_MS,
  };
}

export function setEmployeeSessionCookie(req: Request, res: Response, token: string): void {
  res.cookie(EMPLOYEE_COOKIE_NAME, token, getEmployeeSessionCookieOptions(req));
}

export function clearEmployeeSessionCookie(req: Request, res: Response): void {
  const { maxAge: _maxAge, ...options } = getEmployeeSessionCookieOptions(req);
  res.clearCookie(EMPLOYEE_COOKIE_NAME, { ...options, maxAge: -1 });
}

/** قراءة رمز الجلسة من ترويسة الكوكي */
export function readEmployeeSessionToken(cookieHeader: string | undefined | null): string | undefined {
  if (!cookieHeader) return undefined;
  try {
    const parsed = parseCookieHeader(cookieHeader);
    const token = parsed[EMPLOYEE_COOKIE_NAME];
    return token ? token : undefined;
  } catch {
    return undefined;
  }
}

/** سجل الموظف اللازم للتحقق من الجلسة */
export interface EmployeeSessionRecord {
  id: number;
  name: string;
  code: string;
  branchId: number | null;
  isSupervisor: boolean;
  isActive: boolean;
  hasPortalAccess: boolean;
  sessionVersion: number;
}

/** الجلسة صالحة فقط لموظف نشط مفعّل الدخول وبنفس إصدار الجلسة */
export function isEmployeeSessionValid(
  record: EmployeeSessionRecord | null | undefined,
  claims: EmployeeSessionClaims
): record is EmployeeSessionRecord {
  return Boolean(
    record &&
      record.id === claims.employeeId &&
      record.isActive &&
      record.hasPortalAccess &&
      record.sessionVersion === claims.sessionVersion
  );
}

export function toPortalEmployee(record: EmployeeSessionRecord): PortalEmployee {
  return {
    id: record.id,
    name: record.name,
    code: record.code,
    branchId: record.branchId ?? null,
    isSupervisor: Boolean(record.isSupervisor),
  };
}

/** قراءة سجل الموظف (قراءة واحدة من قاعدة البيانات) */
export async function loadEmployeeSessionRecord(employeeId: number): Promise<EmployeeSessionRecord | null> {
  const [{ getDb }, { employees }] = await Promise.all([import("../db"), import("../../drizzle/schema")]);
  const db = await getDb();
  if (!db) throw new EmployeeSessionLookupError("database unavailable");
  const rows = await db
    .select({
      id: employees.id,
      name: employees.name,
      code: employees.code,
      branchId: employees.branchId,
      isSupervisor: employees.isSupervisor,
      isActive: employees.isActive,
      hasPortalAccess: employees.hasPortalAccess,
      sessionVersion: employees.sessionVersion,
    })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * هوية الموظف من الطلب: null إذا لم يوجد كوكي أو كان غير صالح أو الحساب موقوف أو تغيّر إصدار الجلسة
 * (قراءة قاعدة البيانات فقط عند وجود كوكي موقّع صالح).
 * خطأ قاعدة البيانات يُرمى EmployeeSessionLookupError حتى لا يُعامل الموظف كأنه غير مسجل
 */
export async function resolvePortalEmployee(
  cookieHeader: string | undefined | null,
  loadRecord: (employeeId: number) => Promise<EmployeeSessionRecord | null> = loadEmployeeSessionRecord
): Promise<PortalEmployee | null> {
  const token = readEmployeeSessionToken(cookieHeader);
  if (!token) return null;
  const claims = await verifyEmployeeSession(token);
  if (!claims) return null;
  let record: EmployeeSessionRecord | null;
  try {
    record = await loadRecord(claims.employeeId);
  } catch (error) {
    console.error("[EmployeeSession] فشل التحقق من جلسة الموظف:", error);
    throw error instanceof EmployeeSessionLookupError ? error : new EmployeeSessionLookupError(error);
  }
  return isEmployeeSessionValid(record, claims) ? toPortalEmployee(record!) : null;
}
