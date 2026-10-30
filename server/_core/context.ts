import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { getMainSessionSecret } from "./sessionSecret";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { COOKIE_NAME } from "../../shared/const";
import { jwtVerify } from "jose";
import { parse as parseCookieHeader } from "cookie";
import { getUserById } from "../auth/localAuth";
import { isEmployeePortalAudience, resolvePortalEmployee, type PortalEmployee } from "../auth/employeeSession";

export type { PortalEmployee } from "../auth/employeeSession";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  /** موظف بوابة الموظفين (من كوكي الجلسة الخاص بالبوابة فقط) */
  employee?: PortalEmployee | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    // أولاً: محاولة المصادقة عبر OAuth
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // إذا فشل OAuth، نحاول المصادقة المحلية عبر JWT
    try {
      const cookieHeader = opts.req.headers.cookie;
      const token = cookieHeader ? parseCookieHeader(cookieHeader)[COOKIE_NAME] : undefined;

      // بدون مفتاح في الإنتاج لا تُقبل أي جلسة محلية (لا مفتاح احتياطي معروف)
      const secret = token ? getMainSessionSecret() : null;
      if (token && secret) {
        const { payload } = await jwtVerify(token, secret);

        // رمز جلسة بوابة الموظفين لا يصلح كجلسة للنظام الرئيسي
        if (payload.userId && !isEmployeePortalAudience(payload.aud)) {
          // الحصول على بيانات المستخدم من قاعدة البيانات
          const dbUser = await getUserById(Number(payload.userId));
          if (dbUser) {
            user = dbUser;
          }
        }
      }
    } catch (jwtError) {
      // فشل كلا نوعي المصادقة
      user = null;
    }
  }

  // جلسة بوابة الموظفين (قراءة واحدة من قاعدة البيانات فقط عند وجود كوكي البوابة)
  const employee = await resolvePortalEmployee(opts.req.headers.cookie);

  return {
    req: opts.req,
    res: opts.res,
    user,
    employee,
  };
}
