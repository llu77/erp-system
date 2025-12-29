import crypto from 'crypto';
import mysql from 'mysql2/promise';

// Hash password using PBKDF2
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  const connection = await mysql.createConnection({
    host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
    port: 4000,
    user: '2xKMhANrpN6JsHh.root',
    password: 'BQ3jJDqHB3i5Oeq0',
    database: 'erp_system',
    ssl: { rejectUnauthorized: true }
  });
  
  const hashedPassword = hashPassword('admin123');
  
  await connection.execute(
    'UPDATE users SET password = ? WHERE username = ?',
    [hashedPassword, 'moh123']
  );
  
  console.log('Password updated successfully for moh123');
  
  // Verify
  const [rows] = await connection.execute(
    'SELECT id, username, name FROM users WHERE username = ?',
    ['moh123']
  );
  console.log('User:', rows[0]);
  
  await connection.end();
}

main().catch(console.error);
