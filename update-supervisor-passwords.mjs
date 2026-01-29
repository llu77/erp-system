import mysql from 'mysql2/promise';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

function hashPassword(password, salt) {
  const usedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, usedSalt, 10000, 64, 'sha512').toString('hex');
  return { hash: usedSalt + ':' + hash, salt: usedSalt };
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // تحديث كلمة مرور الموظف laban
  const labanPassword = hashPassword('Laban@2024').hash;
  await conn.execute(
    'UPDATE employees SET password = ? WHERE username = ?',
    [labanPassword, 'laban']
  );
  console.log('✅ تم تحديث كلمة مرور laban في جدول employees');
  
  // البحث عن موظف twiq في جدول employees
  const [twiqEmployees] = await conn.execute(
    'SELECT id, username FROM employees WHERE username LIKE ?',
    ['%twiq%']
  );
  
  if (twiqEmployees.length > 0) {
    const twiqPassword = hashPassword('Twiq@2024').hash;
    await conn.execute(
      'UPDATE employees SET password = ? WHERE username LIKE ?',
      [twiqPassword, '%twiq%']
    );
    console.log('✅ تم تحديث كلمة مرور twiq في جدول employees');
  } else {
    console.log('⚠️ لم يتم العثور على موظف twiq في جدول employees');
  }
  
  // التحقق من التحديث
  const [updated] = await conn.execute(
    'SELECT id, name, username FROM employees WHERE username IN (?, ?)',
    ['laban', 'twiq']
  );
  console.log('\\nالموظفين المحدثين:');
  console.table(updated);
  
  await conn.end();
}

main().catch(console.error);
