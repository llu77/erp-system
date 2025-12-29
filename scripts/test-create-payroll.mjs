import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// التحقق من الفروع والمسيرات الموجودة
const [branches] = await conn.execute(`SELECT id, name, nameAr FROM branches`);
console.log('الفروع:');
console.log(branches);

const [payrolls] = await conn.execute(`
  SELECT id, branchId, branchName, year, month, status 
  FROM payrolls 
  WHERE year = 2025 AND month = 12
`);
console.log('\nالمسيرات الموجودة لديسمبر 2025:');
console.log(payrolls);

// التحقق من الفروع التي ليس لها مسيرات
const existingBranchIds = payrolls.map(p => p.branchId);
const availableBranches = branches.filter(b => !existingBranchIds.includes(b.id));
console.log('\nالفروع المتاحة لإنشاء مسيرة جديدة:');
console.log(availableBranches);

await conn.end();
