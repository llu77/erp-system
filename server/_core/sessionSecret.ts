/**
 * مفتاح توقيع جلسة النظام الرئيسي (JWT محلي)
 * في الإنتاج لا يوجد مفتاح احتياطي: بدون JWT_SECRET تُرفض الجلسات بدلاً من توقيعها بنص معروف
 * يمكن لأي أحد تزوير جلسة مسؤول به. في التطوير يُستخدم مفتاح محلي ثابت.
 */

const DEVELOPMENT_ONLY_SECRET = "local-development-session-secret";

export class MainSessionSecretMissingError extends Error {
  constructor() {
    super("JWT_SECRET غير مضبوط: لا يمكن إنشاء أو التحقق من جلسات الدخول في بيئة الإنتاج");
    this.name = "MainSessionSecretMissingError";
  }
}

/** مفتاح التوقيع، أو null في الإنتاج بدون JWT_SECRET */
export function getMainSessionSecret(env: NodeJS.ProcessEnv = process.env): Uint8Array | null {
  const configured = env.JWT_SECRET?.trim();
  if (configured) return new TextEncoder().encode(configured);
  if (env.NODE_ENV === "production") return null;
  return new TextEncoder().encode(DEVELOPMENT_ONLY_SECRET);
}

/** مفتاح التوقيع أو خطأ واضح (لتسجيل الدخول) */
export function requireMainSessionSecret(env: NodeJS.ProcessEnv = process.env): Uint8Array {
  const secret = getMainSessionSecret(env);
  if (!secret) throw new MainSessionSecretMissingError();
  return secret;
}
