import { randomInt } from 'crypto';
import { TRPCError } from '@trpc/server';
import { getDb } from '../db';
import { employees, branches } from '../../drizzle/schema';
import { eq, and, ne, isNull, sql } from 'drizzle-orm';
import { hashPassword, verifyPassword } from './localAuth';
import { getEstablishmentForBranch } from '../../shared/branding';

// ==================== أدوات عامة ====================

// إنشاء اسم مستخدم من اسم الموظف
export function generateUsername(name: string, code: string = ''): string {
  // اسم دخول بأحرف إنجليزية صغيرة وأرقام فقط (يطابق PORTAL_USERNAME_PATTERN):
  // أول 8 أحرف لاتينية من الاسم (أو emp للأسماء العربية) + الكود
  const latinName = name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 8);
  const cleanCode = code.toLowerCase().replace(/[^a-z0-9]/g, '');
  const username = `${latinName || 'emp'}${cleanCode}`.substring(0, 30);
  return username.length >= 3 ? username : username.padEnd(3, '0');
}

// أحرف كلمة المرور المولدة (بدون الأحرف المتشابهة: 0 O o 1 l I)
const PASSWORD_ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** إنشاء كلمة مرور عشوائية قوية (مولد أرقام عشوائية آمن) */
export function generatePassword(length: number = 10): string {
  let password = '';
  for (let i = 0; i < length; i++) {
    password += PASSWORD_ALPHABET.charAt(randomInt(PASSWORD_ALPHABET.length));
  }
  return password;
}

/** اسم مستخدم البوابة: أحرف إنجليزية صغيرة وأرقام و . _ - (3 إلى 30) */
export const PORTAL_USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;
export const PORTAL_PASSWORD_MIN_LENGTH = 8;
export const PORTAL_PASSWORD_MAX_LENGTH = 128;

export function normalizePortalUsername(username: string): string {
  return username.trim().toLowerCase();
}

/** كلمة مرور البوابة: 8 أحرف على الأقل (يُرجع رسالة الخطأ أو null) */
export function validatePortalPassword(password: string): string | null {
  if (password.length < PORTAL_PASSWORD_MIN_LENGTH) {
    return `كلمة المرور يجب أن تكون ${PORTAL_PASSWORD_MIN_LENGTH} أحرف على الأقل`;
  }
  if (password.length > PORTAL_PASSWORD_MAX_LENGTH) {
    return 'كلمة المرور طويلة جداً';
  }
  return null;
}

async function requireDb() {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'قاعدة البيانات غير متاحة' });
  }
  return db;
}

function isDuplicateKeyError(error: unknown): boolean {
  const e = error as { code?: string; errno?: number; cause?: { code?: string; errno?: number } } | null;
  return e?.code === 'ER_DUP_ENTRY' || e?.errno === 1062 || e?.cause?.code === 'ER_DUP_ENTRY' || e?.cause?.errno === 1062;
}

// ==================== حد محاولات الدخول الفاشلة ====================

export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;

/** حد المحاولات الفاشلة في الذاكرة (لكل IP + اسم مستخدم) */
export class LoginFailureLimiter {
  private failures = new Map<string, { count: number; firstAt: number }>();

  constructor(
    private readonly maxFailures: number = LOGIN_MAX_FAILURES,
    private readonly windowMs: number = LOGIN_FAILURE_WINDOW_MS
  ) {}

  /** المدة المتبقية للحظر بالمللي ثانية (0 = غير محظور) */
  blockedForMs(key: string, now: number = Date.now()): number {
    const entry = this.failures.get(key);
    if (!entry) return 0;
    if (now - entry.firstAt >= this.windowMs) {
      this.failures.delete(key);
      return 0;
    }
    return entry.count >= this.maxFailures ? this.windowMs - (now - entry.firstAt) : 0;
  }

  recordFailure(key: string, now: number = Date.now()): void {
    const entry = this.failures.get(key);
    if (!entry || now - entry.firstAt >= this.windowMs) {
      this.failures.set(key, { count: 1, firstAt: now });
    } else {
      entry.count += 1;
    }
    // تنظيف بسيط لمنع تضخم الذاكرة
    if (this.failures.size > 10_000) {
      this.failures.forEach((value, k) => {
        if (now - value.firstAt >= this.windowMs) this.failures.delete(k);
      });
    }
  }

  /**
   * يحجز محاولة قبل التحقق من كلمة المرور (بشكل متزامن قبل أي انتظار): تُحسب المحاولة فاشلة
   * إلى أن تنجح فيُصفّر العداد. هكذا لا تتجاوز المحاولات المتوازية (طلبات مجمّعة) الحد.
   * يُرجع مدة الحظر المتبقية (0 = مسموح)
   */
  reserveAttempt(key: string, now: number = Date.now()): number {
    const blocked = this.blockedForMs(key, now);
    if (blocked > 0) return blocked;
    this.recordFailure(key, now);
    return 0;
  }

  /** يعيد محاولة محجوزة لم تُحسم (خطأ في الخادم وليس كلمة مرور خاطئة) */
  release(key: string): void {
    const entry = this.failures.get(key);
    if (!entry) return;
    entry.count -= 1;
    if (entry.count <= 0) this.failures.delete(key);
  }

  reset(key: string): void {
    this.failures.delete(key);
  }
}

export const employeeLoginLimiter = new LoginFailureLimiter();

export function loginLimiterKey(ip: string | null | undefined, username: string): string {
  return `${ip || 'unknown'}|${normalizePortalUsername(username)}`;
}

// تجزئة وهمية لموازنة زمن الاستجابة عند عدم وجود المستخدم
let dummyHash: string | null = null;
function getDummyHash(): string {
  if (!dummyHash) dummyHash = hashPassword(generatePassword(16)).hash;
  return dummyHash;
}

// ==================== تسجيل الدخول ====================

export interface PortalMe {
  id: number;
  name: string;
  code: string;
  position: string | null;
  branchId: number | null;
  branchName: string | null;
  establishmentName: string;
  isSupervisor: boolean;
  photoUrl: string | null;
  email: string | null;
  emailVerified: boolean;
}

/** بيانات الموظف المسجل في البوابة (null إذا لم يوجد) */
export async function getPortalMe(employeeId: number): Promise<PortalMe | null> {
  const db = await requireDb();
  const rows = await db
    .select({
      id: employees.id,
      name: employees.name,
      code: employees.code,
      position: employees.position,
      branchId: employees.branchId,
      isSupervisor: employees.isSupervisor,
      photoUrl: employees.photoUrl,
      email: employees.email,
      emailVerified: employees.emailVerified,
      branchName: branches.name,
      branchNameAr: branches.nameAr,
    })
    .from(employees)
    .leftJoin(branches, eq(branches.id, employees.branchId))
    .where(eq(employees.id, employeeId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const branchName = row.branchNameAr || row.branchName || null;
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    position: row.position ?? null,
    branchId: row.branchId ?? null,
    branchName,
    establishmentName: getEstablishmentForBranch({ nameAr: row.branchNameAr, name: row.branchName }).nameAr,
    isSupervisor: Boolean(row.isSupervisor),
    photoUrl: row.photoUrl ?? null,
    email: row.email ?? null,
    emailVerified: Boolean(row.emailVerified),
  };
}

export type EmployeeLoginResult =
  | { success: true; employeeId: number; sessionVersion: number }
  | { success: false; error: string };

const INVALID_CREDENTIALS = 'اسم المستخدم أو كلمة المرور غير صحيحة';

/**
 * التحقق من بيانات دخول الموظف (جدول الموظفين فقط - لا يوجد رجوع لجدول المستخدمين)
 * لا تصدر الجلسة هنا: الإجراء يوقّع الكوكي بعد النجاح
 */
export async function employeeLogin(username: string, password: string): Promise<EmployeeLoginResult> {
  const db = await requireDb();
  const normalized = normalizePortalUsername(username);

  const rows = await db
    .select({
      id: employees.id,
      password: employees.password,
      isActive: employees.isActive,
      hasPortalAccess: employees.hasPortalAccess,
      sessionVersion: employees.sessionVersion,
    })
    .from(employees)
    .where(eq(employees.username, normalized))
    .limit(1);

  const employee = rows[0];
  const storedHash = employee?.password || null;
  // نفس كلفة التحقق دائماً (حتى لو لم يوجد المستخدم) لعدم كشف أسماء المستخدمين
  const passwordOk = await verifyPassword(password, storedHash ?? getDummyHash());

  if (!employee || !storedHash || !passwordOk || !employee.isActive || !employee.hasPortalAccess) {
    return { success: false, error: INVALID_CREDENTIALS };
  }

  try {
    await db.update(employees).set({ lastLogin: new Date() }).where(eq(employees.id, employee.id));
  } catch (error) {
    console.warn('[EmployeeAuth] تعذر تحديث آخر دخول:', error);
  }

  return { success: true, employeeId: employee.id, sessionVersion: employee.sessionVersion };
}

// ==================== كلمة المرور والجلسات ====================

async function readSessionVersion(employeeId: number): Promise<number> {
  const db = await requireDb();
  const rows = await db
    .select({ sessionVersion: employees.sessionVersion })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);
  if (!rows[0]) throw new TRPCError({ code: 'NOT_FOUND', message: 'الموظف غير موجود' });
  return rows[0].sessionVersion;
}

/** تغيير كلمة مرور الموظف (من البوابة): يُلغي الجلسات الأخرى ويُرجع إصدار الجلسة الجديد */
export async function changeEmployeePassword(
  employeeId: number,
  currentPassword: string,
  newPassword: string
): Promise<{ sessionVersion: number }> {
  const db = await requireDb();
  const rows = await db
    .select({ password: employees.password })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);
  if (!rows[0]) throw new TRPCError({ code: 'NOT_FOUND', message: 'الموظف غير موجود' });
  if (!rows[0].password) throw new TRPCError({ code: 'BAD_REQUEST', message: 'الحساب غير مفعل' });

  const isValid = await verifyPassword(currentPassword, rows[0].password);
  if (!isValid) throw new TRPCError({ code: 'BAD_REQUEST', message: 'كلمة المرور الحالية غير صحيحة' });

  const policyError = validatePortalPassword(newPassword);
  if (policyError) throw new TRPCError({ code: 'BAD_REQUEST', message: policyError });
  if (newPassword === currentPassword) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'كلمة المرور الجديدة يجب أن تختلف عن الحالية' });
  }

  await db
    .update(employees)
    .set({ password: hashPassword(newPassword).hash, sessionVersion: sql`${employees.sessionVersion} + 1` })
    .where(eq(employees.id, employeeId));

  return { sessionVersion: await readSessionVersion(employeeId) };
}

/** إعادة تعيين كلمة مرور الموظف (للإدارة): يتطلب حساباً له اسم مستخدم، ويُلغي الجلسات القائمة */
export async function resetEmployeePassword(
  employeeId: number
): Promise<{ success: true; password: string; newPassword: string; error?: undefined }> {
  const db = await requireDb();
  const rows = await db
    .select({ id: employees.id, username: employees.username })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);
  if (!rows[0]) throw new TRPCError({ code: 'NOT_FOUND', message: 'الموظف غير موجود' });
  if (!rows[0].username) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يوجد حساب بوابة لهذا الموظف. أنشئ اسم مستخدم أولاً' });
  }

  const password = generatePassword();
  await db
    .update(employees)
    .set({ password: hashPassword(password).hash, sessionVersion: sql`${employees.sessionVersion} + 1` })
    .where(eq(employees.id, employeeId));

  return { success: true, password, newPassword: password };
}

// ==================== إدارة حساب البوابة لموظف ====================

export interface EmployeePortalAccount {
  employeeId: number;
  username: string | null;
  hasPortalAccess: boolean;
  hasPassword: boolean;
  lastLogin: Date | null;
}

export async function getEmployeeAccount(employeeId: number): Promise<EmployeePortalAccount> {
  const db = await requireDb();
  const rows = await db
    .select({
      id: employees.id,
      username: employees.username,
      hasPortalAccess: employees.hasPortalAccess,
      password: employees.password,
      lastLogin: employees.lastLogin,
    })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'الموظف غير موجود' });
  return {
    employeeId: row.id,
    username: row.username ?? null,
    hasPortalAccess: Boolean(row.hasPortalAccess),
    hasPassword: Boolean(row.password),
    lastLogin: row.lastLogin ?? null,
  };
}

export interface SaveEmployeeAccountInput {
  employeeId: number;
  username: string;
  password?: string | null;
  enabled: boolean;
}

/**
 * حفظ حساب البوابة لموظف: اسم المستخدم (فريد)، كلمة مرور اختيارية، وتفعيل/إيقاف الدخول
 * - التفعيل بدون أي كلمة مرور: تُولد كلمة مرور قوية وتُعاد مرة واحدة
 * - الإيقاف أو تغيير كلمة المرور يُلغي الجلسات القائمة
 */
export async function saveEmployeeAccount(
  input: SaveEmployeeAccountInput
): Promise<{ success: true; generatedPassword?: string }> {
  const db = await requireDb();
  const username = normalizePortalUsername(input.username);
  const newPassword = input.password ? input.password : null;
  if (newPassword) {
    const policyError = validatePortalPassword(newPassword);
    if (policyError) throw new TRPCError({ code: 'BAD_REQUEST', message: policyError });
  }

  const rows = await db
    .select({ id: employees.id, username: employees.username, password: employees.password, hasPortalAccess: employees.hasPortalAccess })
    .from(employees)
    .where(eq(employees.id, input.employeeId))
    .limit(1);
  const existing = rows[0];
  if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'الموظف غير موجود' });

  // اسم الدخول المحفوظ سابقاً (قد يكون بصيغة قديمة) يُقبل كما هو حتى يمكن إيقاف الحساب أو تغيير كلمة مروره؛
  // النمط يُطبق على الاسم الجديد فقط
  const usernameChanged = username !== normalizePortalUsername(existing.username ?? '');
  if (usernameChanged && !PORTAL_USERNAME_PATTERN.test(username)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'اسم المستخدم يجب أن يكون من 3 إلى 30 حرفاً إنجليزياً صغيراً أو رقماً أو (. _ -)',
    });
  }
  if (!username) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'اسم المستخدم مطلوب' });
  }
  const taken = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.username, username), ne(employees.id, input.employeeId)))
    .limit(1);
  if (taken.length > 0) {
    throw new TRPCError({ code: 'CONFLICT', message: 'اسم المستخدم مستخدم لموظف آخر' });
  }

  let generatedPassword: string | undefined;
  let passwordToSet = newPassword;
  if (!passwordToSet && input.enabled && !existing.password) {
    generatedPassword = generatePassword();
    passwordToSet = generatedPassword;
  }

  const revokeSessions = Boolean(passwordToSet) || (!input.enabled && existing.hasPortalAccess);

  try {
    await db
      .update(employees)
      .set({
        username,
        hasPortalAccess: input.enabled,
        ...(passwordToSet ? { password: hashPassword(passwordToSet).hash } : {}),
        ...(revokeSessions ? { sessionVersion: sql`${employees.sessionVersion} + 1` } : {}),
      })
      .where(eq(employees.id, input.employeeId));
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new TRPCError({ code: 'CONFLICT', message: 'اسم المستخدم مستخدم لموظف آخر' });
    }
    throw error;
  }

  return generatedPassword ? { success: true, generatedPassword } : { success: true };
}

// ==================== الإنشاء الجماعي والقائمة (صفحة حسابات الموظفين) ====================

// إنشاء حسابات للموظفين
export async function createEmployeeAccounts(): Promise<{
  success: boolean;
  created: Array<{ id: number; name: string; username: string; password: string }>;
  errors: string[];
}> {
  const db = await getDb();
  if (!db) {
    return { success: false, created: [], errors: ['قاعدة البيانات غير متاحة'] };
  }

  const created: Array<{ id: number; name: string; username: string; password: string }> = [];
  const errors: string[] = [];

  try {
    // جلب جميع الموظفين النشطين بدون حساب
    const employeesWithoutAccount = await db
      .select({ id: employees.id, name: employees.name, code: employees.code })
      .from(employees)
      .where(and(
        eq(employees.isActive, true),
        eq(employees.hasPortalAccess, false),
        // فقط من لا حساب له أصلاً: الحساب الذي أوقفه المدير لا يُعاد تفعيله تلقائياً
        isNull(employees.username),
        isNull(employees.password)
      ));

    for (const emp of employeesWithoutAccount) {
      try {
        const username = generateUsername(emp.name, emp.code);
        const password = generatePassword();
        const hashedPassword = hashPassword(password).hash;

        await db
          .update(employees)
          .set({
            username,
            password: hashedPassword,
            hasPortalAccess: true,
            sessionVersion: sql`${employees.sessionVersion} + 1`,
          })
          .where(eq(employees.id, emp.id));

        created.push({
          id: emp.id,
          name: emp.name,
          username,
          password, // كلمة المرور الأصلية (غير مشفرة) للعرض مرة واحدة
        });
      } catch (err) {
        errors.push(`خطأ في إنشاء حساب للموظف ${emp.name}: ${isDuplicateKeyError(err) ? 'اسم المستخدم مستخدم مسبقاً' : 'خطأ غير متوقع'}`);
      }
    }

    return { success: true, created, errors };
  } catch (error) {
    console.error('[EmployeeAuth] خطأ في إنشاء الحسابات:', error);
    return { success: false, created, errors: ['حدث خطأ غير متوقع أثناء إنشاء الحسابات'] };
  }
}

// جلب جميع حسابات الموظفين
export async function getEmployeeAccounts(): Promise<{
  success: boolean;
  accounts: Array<{
    id: number;
    name: string;
    code: string;
    username: string | null;
    branchId: number;
    branchName: string;
    hasPortalAccess: boolean;
    lastLogin: Date | null;
  }>;
  error?: string;
}> {
  const db = await getDb();
  if (!db) {
    return { success: false, accounts: [], error: 'قاعدة البيانات غير متاحة' };
  }

  try {
    const emps = await db
      .select({
        id: employees.id,
        name: employees.name,
        code: employees.code,
        username: employees.username,
        branchId: employees.branchId,
        hasPortalAccess: employees.hasPortalAccess,
        lastLogin: employees.lastLogin,
      })
      .from(employees)
      .where(eq(employees.isActive, true));

    // جلب أسماء الفروع
    const branchList = await db.select().from(branches);
    const branchMap = new Map(branchList.map((b: { id: number; name: string }) => [b.id, b.name]));

    const accounts = emps.map((emp: typeof emps[0]) => ({
      ...emp,
      branchName: branchMap.get(emp.branchId) || 'غير محدد',
    }));

    return { success: true, accounts };
  } catch (error) {
    console.error('[EmployeeAuth] خطأ في جلب الحسابات:', error);
    return { success: false, accounts: [], error: 'تعذر جلب حسابات الموظفين' };
  }
}
