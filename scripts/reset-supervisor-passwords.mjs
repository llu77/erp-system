import crypto from 'crypto';
import mysql from 'mysql2/promise';

// Hash password function (same as in localAuth.ts)
function hashPassword(password, salt) {
  const usedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, usedSalt, 10000, 64, 'sha512')
    .toString('hex');
  return { hash: `${usedSalt}:${hash}`, salt: usedSalt };
}

async function main() {
  // Get DATABASE_URL from environment
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const connection = await mysql.createConnection(dbUrl);

  // تحديث كلمة مرور مشرف لبن
  const labanPassword = hashPassword('Laban@123');
  await connection.execute(
    "UPDATE employees SET password = ? WHERE username = 'laban'",
    [labanPassword.hash]
  );
  console.log('✅ تم تحديث كلمة مرور مشرف لبن (Laban@123)');

  // تحديث كلمة مرور مشرف طويق
  const twiqPassword = hashPassword('Twiq@123');
  await connection.execute(
    "UPDATE employees SET password = ? WHERE username = 'twiq'",
    [twiqPassword.hash]
  );
  console.log('✅ تم تحديث كلمة مرور مشرف طويق (Twiq@123)');

  // التحقق
  const [rows] = await connection.execute(
    "SELECT id, name, username, isSupervisor FROM employees WHERE username IN ('laban', 'twiq')"
  );
  console.log('\n📋 المشرفون:');
  console.table(rows);

  await connection.end();
}

main().catch(console.error);
