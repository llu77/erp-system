import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// التحقق من الفروع
const [branches] = await conn.execute(`SELECT id, name, nameAr FROM branches ORDER BY id`);
console.log('الفروع المتاحة:');
console.log(branches);

// التحقق من المسيرات الموجودة
const [payrolls] = await conn.execute(`
  SELECT DISTINCT branchId, branchName, year, month 
  FROM payrolls 
  WHERE year = 2025 AND month = 12
`);
console.log('\nالفروع التي لها مسيرات في ديسمبر 2025:');
console.log(payrolls);

await conn.end();
