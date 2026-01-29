import mysql from 'mysql2/promise';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  const computedHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return (salt + ':' + computedHash) === storedHash;
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // جلب كلمة المرور للموظف
  const [employees] = await conn.execute(
    'SELECT id, name, username, password FROM employees WHERE username = ?',
    ['laban']
  );
  
  if (employees.length > 0) {
    const emp = employees[0];
    console.log('Employee:', emp.name, '- Username:', emp.username);
    console.log('Has password:', emp.password ? 'YES' : 'NO');
    
    if (emp.password) {
      const isValid = verifyPassword('Laban@2024', emp.password);
      console.log('Password Laban@2024 valid:', isValid);
    }
  }
  
  await conn.end();
}

main().catch(console.error);
