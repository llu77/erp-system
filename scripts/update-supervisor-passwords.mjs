import { createConnection } from 'mysql2/promise';
import crypto from 'crypto';

// تشفير كلمة المرور باستخدام SHA-256 مع salt
function hashPassword(password, salt) {
  const usedSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, usedSalt, 10000, 64, "sha512")
    .toString("hex");
  return { hash: `${usedSalt}:${hash}`, salt: usedSalt };
}

const connection = await createConnection(process.env.DATABASE_URL);

// تشفير كلمات المرور
const labanPassword = hashPassword('Laban123').hash;
const twiqPassword = hashPassword('Twiq123').hash;

// تحديث كلمة مرور مشرف لبن
await connection.execute(
  "UPDATE employees SET password = ? WHERE username = 'laban'",
  [labanPassword]
);
console.log("✅ تم تحديث كلمة مرور مشرف لبن: Laban123");

// تحديث كلمة مرور مشرف طويق
await connection.execute(
  "UPDATE employees SET password = ? WHERE username = 'twiq'",
  [twiqPassword]
);
console.log("✅ تم تحديث كلمة مرور مشرف طويق: Twiq123");

await connection.end();
console.log("\n✅ تم تحديث كلمات المرور بنجاح!");
console.log("\nبيانات تسجيل الدخول:");
console.log("مشرف لبن: username=laban, password=Laban123");
console.log("مشرف طويق: username=twiq, password=Twiq123");
