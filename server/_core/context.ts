import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { COOKIE_NAME } from "../../shared/const";
import { jwtVerify } from "jose";
import { getUserById } from "../auth/localAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
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
      const cookies = opts.req.headers.cookie || "";
      const cookieMap = Object.fromEntries(
        cookies.split(";").map(c => {
          const [key, ...val] = c.trim().split("=");
          return [key, val.join("=")];
        })
      );
      
      const token = cookieMap[COOKIE_NAME];
      
      if (token) {
        const secret = new TextEncoder().encode(process.env.JWT_SECRET || "fallback-secret");
        const { payload } = await jwtVerify(token, secret);
        
        if (payload.userId) {
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

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
