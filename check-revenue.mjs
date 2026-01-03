import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// فحص الإيرادات اليومية ومقارنتها مع إيرادات الموظفين
const [dailyRevs] = await connection.query(`
  SELECT 
    dr.id,
    DATE_FORMAT(dr.date, '%Y-%m-%d') as date, 
    dr.branchId,
    dr.total as branchTotal,
    (SELECT COALESCE(SUM(er.total), 0) FROM employeeRevenues er WHERE er.dailyRevenueId = dr.id) as employeesTotal,
    dr.total - (SELECT COALESCE(SUM(er.total), 0) FROM employeeRevenues er WHERE er.dailyRevenueId = dr.id) as difference
  FROM dailyRevenues dr
  ORDER BY dr.date DESC
  LIMIT 15
`);
console.log('\n=== مقارنة إيرادات الفرع مع إيرادات الموظفين ===');
for (const d of dailyRevs) {
  const diff = parseFloat(d.difference);
  const status = Math.abs(diff) < 1 ? '✅' : '❌';
  console.log(`${d.date} | Branch: ${d.branchId} | Fرع: ${d.branchTotal} | موظفين: ${d.employeesTotal} | فرق: ${d.difference} ${status}`);
}

// فحص تفاصيل إيرادات الموظفين ليوم معين
const [empDetails] = await connection.query(`
  SELECT 
    er.dailyRevenueId,
    DATE_FORMAT(dr.date, '%Y-%m-%d') as date,
    e.name as employeeName,
    er.total as empTotal
  FROM employeeRevenues er
  LEFT JOIN employees e ON er.employeeId = e.id
  LEFT JOIN dailyRevenues dr ON er.dailyRevenueId = dr.id
  WHERE dr.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
  ORDER BY dr.date DESC, er.total DESC
`);
console.log('\n=== تفاصيل إيرادات الموظفين (آخر 7 أيام) ===');
let currentDate = '';
for (const d of empDetails) {
  if (d.date !== currentDate) {
    console.log(`\n--- ${d.date} ---`);
    currentDate = d.date;
  }
  console.log(`  ${d.employeeName || 'غير محدد'}: ${d.empTotal}`);
}

await connection.end();
