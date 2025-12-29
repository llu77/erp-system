import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// التحقق من المسيرات لفرع لبن (id=1)
const [payrolls] = await conn.execute(`
  SELECT id, payrollNumber, branchId, branchName, year, month, status 
  FROM payrolls 
  WHERE branchId = 1 AND year = 2025 AND month = 12
`);
console.log('مسيرات فرع لبن لشهر ديسمبر 2025:');
console.log(payrolls);

await conn.end();
