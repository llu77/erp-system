import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { EMPLOYEE_COOKIE_NAME, EMPLOYEE_SESSION_TTL_MS } from "../shared/const";
import {
  EMPLOYEE_SESSION_AUDIENCE,
  EmployeeSessionConfigError,
  EmployeeSessionLookupError,
  clearEmployeeSessionCookie,
  getEmployeeSessionCookieOptions,
  isEmployeeSessionValid,
  readEmployeeSessionToken,
  resolvePortalEmployee,
  setEmployeeSessionCookie,
  signEmployeeSession,
  verifyEmployeeSession,
  type EmployeeSessionRecord,
} from "./auth/employeeSession";
import { LoginFailureLimiter, loginLimiterKey } from "./auth/employeeAuth";

const SECRET = "test-secret-for-employee-sessions-0123456789";

function record(overrides: Partial<EmployeeSessionRecord> = {}): EmployeeSessionRecord {
  return {
    id: 7,
    name: "أحمد",
    code: "E007",
    branchId: 2,
    isSupervisor: false,
    isActive: true,
    hasPortalAccess: true,
    sessionVersion: 3,
    ...overrides,
  };
}

function cookieHeader(token: string) {
  return `other=1; ${EMPLOYEE_COOKIE_NAME}=${token}; app_session_id=abc`;
}

let previousSecret: string | undefined;

beforeEach(() => {
  previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = SECRET;
});

afterEach(() => {
  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;
});

describe("signEmployeeSession / verifyEmployeeSession", () => {
  it("round-trips the employee id and session version", async () => {
    const token = await signEmployeeSession({ employeeId: 7, sessionVersion: 3 });
    await expect(verifyEmployeeSession(token)).resolves.toEqual({ employeeId: 7, sessionVersion: 3 });
  });

  it("rejects empty, malformed and tampered tokens", async () => {
    const token = await signEmployeeSession({ employeeId: 7, sessionVersion: 3 });
    await expect(verifyEmployeeSession(undefined)).resolves.toBeNull();
    await expect(verifyEmployeeSession("")).resolves.toBeNull();
    await expect(verifyEmployeeSession("not-a-jwt")).resolves.toBeNull();
    const [header, payload, signature] = token.split(".");
    const tampered = `${header}.${payload}.${signature.slice(0, -2)}${signature.endsWith("AA") ? "BB" : "AA"}`;
    await expect(verifyEmployeeSession(tampered)).resolves.toBeNull();
  });

  it("rejects tokens signed with another secret", async () => {
    const token = await signEmployeeSession({ employeeId: 7, sessionVersion: 3 });
    process.env.JWT_SECRET = "another-secret-another-secret-another";
    await expect(verifyEmployeeSession(token)).resolves.toBeNull();
  });

  it("rejects expired tokens", async () => {
    const token = await signEmployeeSession(
      { employeeId: 7, sessionVersion: 3 },
      { now: new Date(Date.now() - EMPLOYEE_SESSION_TTL_MS - 60_000) }
    );
    await expect(verifyEmployeeSession(token)).resolves.toBeNull();
  });

  it("separates audiences: a main-system token is not an employee session", async () => {
    const key = new TextEncoder().encode(SECRET);
    // جلسة النظام الرئيسي (بدون aud)
    const mainToken = await new SignJWT({ userId: 1, username: "admin", role: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(key);
    await expect(verifyEmployeeSession(mainToken)).resolves.toBeNull();

    // نفس الحمولة لكن لجمهور آخر
    const otherAudience = await new SignJWT({ kind: "employee", sv: 0 })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("7")
      .setAudience("another-app")
      .setExpirationTime("1h")
      .sign(key);
    await expect(verifyEmployeeSession(otherAudience)).resolves.toBeNull();

    // الجمهور الصحيح بدون نوع الجلسة
    const noKind = await new SignJWT({ sv: 0 })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("7")
      .setAudience(EMPLOYEE_SESSION_AUDIENCE)
      .setExpirationTime("1h")
      .sign(key);
    await expect(verifyEmployeeSession(noKind)).resolves.toBeNull();
  });

  it("rejects invalid subjects and session versions", async () => {
    const key = new TextEncoder().encode(SECRET);
    const sign = (sub: string, sv: unknown) =>
      new SignJWT({ kind: "employee", sv: sv as number })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(sub)
        .setAudience(EMPLOYEE_SESSION_AUDIENCE)
        .setExpirationTime("1h")
        .sign(key);
    await expect(verifyEmployeeSession(await sign("abc", 1))).resolves.toBeNull();
    await expect(verifyEmployeeSession(await sign("0", 1))).resolves.toBeNull();
    await expect(verifyEmployeeSession(await sign("7", "1"))).resolves.toBeNull();
  });

  it("refuses to sign without JWT_SECRET and treats every token as invalid", async () => {
    const token = await signEmployeeSession({ employeeId: 7, sessionVersion: 3 });
    delete process.env.JWT_SECRET;
    await expect(signEmployeeSession({ employeeId: 7, sessionVersion: 3 })).rejects.toBeInstanceOf(EmployeeSessionConfigError);
    await expect(verifyEmployeeSession(token)).resolves.toBeNull();
  });
});

describe("isEmployeeSessionValid", () => {
  const claims = { employeeId: 7, sessionVersion: 3 };

  it("accepts an active portal employee with the same session version", () => {
    expect(isEmployeeSessionValid(record(), claims)).toBe(true);
  });

  it("rejects a bumped session version (password change, reset or revoke)", () => {
    expect(isEmployeeSessionValid(record({ sessionVersion: 4 }), claims)).toBe(false);
  });

  it("rejects inactive employees, revoked portal access, missing or other records", () => {
    expect(isEmployeeSessionValid(record({ isActive: false }), claims)).toBe(false);
    expect(isEmployeeSessionValid(record({ hasPortalAccess: false }), claims)).toBe(false);
    expect(isEmployeeSessionValid(null, claims)).toBe(false);
    expect(isEmployeeSessionValid(record({ id: 8 }), claims)).toBe(false);
  });
});

describe("resolvePortalEmployee", () => {
  it("returns the employee identity for a valid cookie (one record read)", async () => {
    const token = await signEmployeeSession({ employeeId: 7, sessionVersion: 3 });
    const load = vi.fn().mockResolvedValue(record({ isSupervisor: true }));
    await expect(resolvePortalEmployee(cookieHeader(token), load)).resolves.toEqual({
      id: 7,
      name: "أحمد",
      code: "E007",
      branchId: 2,
      isSupervisor: true,
    });
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith(7);
  });

  it("does not touch the database without a valid cookie", async () => {
    const load = vi.fn();
    await expect(resolvePortalEmployee(undefined, load)).resolves.toBeNull();
    await expect(resolvePortalEmployee("app_session_id=abc", load)).resolves.toBeNull();
    await expect(resolvePortalEmployee(`${EMPLOYEE_COOKIE_NAME}=garbage`, load)).resolves.toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it("returns null when the session version no longer matches", async () => {
    const token = await signEmployeeSession({ employeeId: 7, sessionVersion: 3 });
    const load = vi.fn().mockResolvedValue(record({ sessionVersion: 4 }));
    await expect(resolvePortalEmployee(cookieHeader(token), load)).resolves.toBeNull();
  });

  it("throws a lookup error (not \"signed out\") when loading the record fails", async () => {
    const token = await signEmployeeSession({ employeeId: 7, sessionVersion: 3 });
    const load = vi.fn().mockRejectedValue(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(resolvePortalEmployee(cookieHeader(token), load)).rejects.toBeInstanceOf(EmployeeSessionLookupError);
    spy.mockRestore();
  });
});

describe("cookie helpers", () => {
  const req = (protocol: string, headers: Record<string, string> = {}) =>
    ({ protocol, headers }) as unknown as Parameters<typeof getEmployeeSessionCookieOptions>[0];

  it("uses an httpOnly lax cookie with the session TTL, secure on https", () => {
    const https = getEmployeeSessionCookieOptions(req("https"));
    expect(https).toMatchObject({ httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: EMPLOYEE_SESSION_TTL_MS });
    expect(getEmployeeSessionCookieOptions(req("http")).secure).toBe(false);
    expect(getEmployeeSessionCookieOptions(req("http", { "x-forwarded-proto": "https" })).secure).toBe(true);
  });

  it("sets and clears the portal cookie by name", () => {
    const res = { cookie: vi.fn(), clearCookie: vi.fn() };
    setEmployeeSessionCookie(req("https"), res as any, "tok");
    expect(res.cookie).toHaveBeenCalledWith(EMPLOYEE_COOKIE_NAME, "tok", expect.objectContaining({ httpOnly: true, sameSite: "lax" }));
    clearEmployeeSessionCookie(req("https"), res as any);
    expect(res.clearCookie).toHaveBeenCalledWith(EMPLOYEE_COOKIE_NAME, expect.objectContaining({ maxAge: -1 }));
  });

  it("reads the token from a cookie header", () => {
    expect(readEmployeeSessionToken(cookieHeader("abc.def.ghi"))).toBe("abc.def.ghi");
    expect(readEmployeeSessionToken("app_session_id=abc")).toBeUndefined();
    expect(readEmployeeSessionToken(undefined)).toBeUndefined();
  });
});

describe("LoginFailureLimiter", () => {
  it("blocks after 5 failures within the window and resets after it", () => {
    const limiter = new LoginFailureLimiter(5, 15 * 60 * 1000);
    const key = loginLimiterKey("1.2.3.4", "  Ahmed ");
    expect(key).toBe("1.2.3.4|ahmed");
    const t0 = 1_000_000;
    for (let i = 0; i < 4; i++) limiter.recordFailure(key, t0 + i);
    expect(limiter.blockedForMs(key, t0 + 10)).toBe(0);
    limiter.recordFailure(key, t0 + 5);
    expect(limiter.blockedForMs(key, t0 + 10)).toBeGreaterThan(0);
    // مفتاح آخر (IP أو اسم مستخدم مختلف) غير متأثر
    expect(limiter.blockedForMs(loginLimiterKey("5.6.7.8", "ahmed"), t0 + 10)).toBe(0);
    expect(limiter.blockedForMs(key, t0 + 15 * 60 * 1000 + 1)).toBe(0);
  });

  it("reserves each attempt before the password check so parallel attempts cannot exceed the cap", () => {
    const limiter = new LoginFailureLimiter(5, 60_000);
    // 50 محاولة متزامنة (طلب مجمّع): تُحجز كل محاولة قبل أي انتظار، فلا يمر منها إلا 5
    const allowed = Array.from({ length: 50 }, () => limiter.reserveAttempt("burst", 100)).filter(ms => ms === 0).length;
    expect(allowed).toBe(5);
    // نجاح الدخول يصفّر العداد
    limiter.reset("burst");
    expect(limiter.reserveAttempt("burst", 101)).toBe(0);
  });

  it("releases a reserved attempt when the server fails before checking the password", () => {
    const limiter = new LoginFailureLimiter(2, 60_000);
    expect(limiter.reserveAttempt("k", 0)).toBe(0);
    limiter.release("k");
    expect(limiter.reserveAttempt("k", 1)).toBe(0);
    expect(limiter.reserveAttempt("k", 2)).toBe(0);
    expect(limiter.reserveAttempt("k", 3)).toBeGreaterThan(0);
    // مفتاح غير موجود: لا شيء
    limiter.release("missing");
    expect(limiter.blockedForMs("missing", 4)).toBe(0);
  });

  it("clears failures after a successful login", () => {
    const limiter = new LoginFailureLimiter(2, 60_000);
    limiter.recordFailure("k", 0);
    limiter.recordFailure("k", 1);
    expect(limiter.blockedForMs("k", 2)).toBeGreaterThan(0);
    limiter.reset("k");
    expect(limiter.blockedForMs("k", 3)).toBe(0);
  });
});

describe("main-system context", () => {
  it("never accepts an employee-portal token as a main-system session", async () => {
    vi.resetModules();
    const getUserById = vi.fn().mockResolvedValue({ id: 1, role: "admin" });
    vi.doMock("./_core/sdk", () => ({ sdk: { authenticateRequest: vi.fn().mockRejectedValue(new Error("no oauth")) } }));
    vi.doMock("./auth/localAuth", () => ({ getUserById }));
    vi.doMock("./db", () => ({ getDb: vi.fn().mockResolvedValue(null) }));
    const { createContext } = await import("./_core/context");

    // رمز يحمل userId لكنه موجّه لبوابة الموظفين
    const key = new TextEncoder().encode(SECRET);
    const forged = await new SignJWT({ userId: 1, kind: "employee", sv: 0 })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("1")
      .setAudience(EMPLOYEE_SESSION_AUDIENCE)
      .setExpirationTime("1h")
      .sign(key);

    const ctx = await createContext({
      req: { headers: { cookie: `app_session_id=${forged}` } },
      res: {},
    } as any);
    expect(ctx.user).toBeNull();
    expect(getUserById).not.toHaveBeenCalled();
    expect(ctx.employee).toBeNull();

    vi.doUnmock("./_core/sdk");
    vi.doUnmock("./auth/localAuth");
    vi.doUnmock("./db");
  });

  it("flags a portal session it could not verify instead of treating it as signed out", async () => {
    vi.resetModules();
    vi.doMock("./_core/sdk", () => ({ sdk: { authenticateRequest: vi.fn().mockRejectedValue(new Error("no oauth")) } }));
    vi.doMock("./auth/localAuth", () => ({ getUserById: vi.fn() }));
    vi.doMock("./db", () => ({ getDb: vi.fn().mockResolvedValue(null) }));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { createContext } = await import("./_core/context");
    const token = await signEmployeeSession({ employeeId: 7, sessionVersion: 3 });

    const ctx = await createContext({ req: { headers: { cookie: cookieHeader(token) } }, res: {} } as any);
    expect(ctx.employee).toBeNull();
    expect(ctx.employeeLookupFailed).toBe(true);

    spy.mockRestore();
    vi.doUnmock("./_core/sdk");
    vi.doUnmock("./auth/localAuth");
    vi.doUnmock("./db");
  });
});

describe("resolvePortalReviewer", () => {
  it("prefers a portal supervisor session over a staff session in the same browser", async () => {
    const { resolvePortalReviewer } = await import("./_core/trpc");
    const staff = { id: 9, role: "manager", name: "مدير", username: "m", branchId: null } as any;
    const supervisor = { id: 41, name: "علي", code: "E41", branchId: 2, isSupervisor: true };
    const both = resolvePortalReviewer({ user: staff, employee: supervisor });
    expect(both).toMatchObject({ kind: "employee", id: 41, employeeId: 41, branchId: 2 });
    expect(resolvePortalReviewer({ user: staff, employee: null })).toMatchObject({ kind: "staff", id: 9, branchId: null });
    // موظف غير مشرف مع جلسة موظفين: يبقى مستخدم النظام هو المراجع
    expect(resolvePortalReviewer({ user: staff, employee: { ...supervisor, isSupervisor: false } })).toMatchObject({ kind: "staff" });
    expect(resolvePortalReviewer({ user: null, employee: { ...supervisor, isSupervisor: false } })).toBeNull();
  });
});
