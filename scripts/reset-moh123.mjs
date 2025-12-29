import crypto from "crypto";

// تشفير كلمة المرور باستخدام SHA-256 مع salt
function hashPassword(password, salt) {
  const usedSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, usedSalt, 10000, 64, "sha512")
    .toString("hex");
  return { hash: `${usedSalt}:${hash}`, salt: usedSalt };
}

const { hash } = hashPassword("moh123");
console.log("New hash for password 'moh123':");
console.log(hash);
