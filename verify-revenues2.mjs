import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);

console.log('\n=== فحص الإيرادات اليومية ===\n');

// فحص هيكل الجدول
console.log('0. هيكل جدول dailyRevenues:');
const [columns] = await connection.query(`DESCRIBE dailyRevenues`);
columns.forEach(c => console.log(`   ${c.Field} (${c.Type})`));

// فحص الإيرادات في يناير 2026
console.log('\n1. الإيرادات اليومية في يناير 2026:');
const [janRevenues] = await connection.query(`
  SELECT dr.date, dr.branchId, b.name as branchName, dr.total
  FROM dailyRevenues dr
  JOIN branches b ON dr.branchId = b.id
  WHERE dr.date >= '2026-01-01' AND dr.date <= '2026-01-31'
  ORDER BY dr.date, dr.branchId
`);
console.log(`   عدد السجلات: ${janRevenues.length}`);
janRevenues.forEach(r => {
  console.log(`   ${r.date} | ${r.branchName} | ${r.total} ر.س`);
});

// فحص الإيرادات في ديسمبر 2025
console.log('\n2. الإيرادات اليومية في ديسمبر 2025 (آخر 7 أيام):');
const [decRevenues] = await connection.query(`
  SELECT dr.date, dr.branchId, b.name as branchName, dr.total
  FROM dailyRevenues dr
  JOIN branches b ON dr.branchId = b.id
  WHERE dr.date >= '2025-12-25' AND dr.date <= '2025-12-31'
  ORDER BY dr.date, dr.branchId
`);
console.log(`   عدد السجلات: ${decRevenues.length}`);
decRevenues.forEach(r => {
  console.log(`   ${r.date} | ${r.branchName} | ${r.total} ر.س`);
});

// فحص إيرادات الموظفين في يناير 2026
console.log('\n3. إيرادات الموظفين في يناير 2026 (الأسبوع 1: 1-7):');
const [empRevJan] = await connection.query(`
  SELECT e.name as employeeName, e.id as employeeId, b.name as branchName,
         dr.date, er.total
  FROM employeeRevenues er
  JOIN employees e ON er.employeeId = e.id
  JOIN dailyRevenues dr ON er.dailyRevenueId = dr.id
  JOIN branches b ON e.branchId = b.id
  WHERE dr.date >= '2026-01-01' AND dr.date <= '2026-01-07'
  ORDER BY e.branchId, e.name, dr.date
`);
console.log(`   عدد السجلات: ${empRevJan.length}`);
empRevJan.forEach(r => {
  console.log(`   ${r.date} | ${r.branchName} | ${r.employeeName} | ${r.total} ر.س`);
});

// حساب مجموع إيرادات كل موظف في الأسبوع 1
console.log('\n4. مجموع إيرادات كل موظف في الأسبوع 1 (1-7 يناير 2026):');
const [empTotals] = await connection.query(`
  SELECT e.name as employeeName, e.id as employeeId, b.name as branchName,
         SUM(er.total) as weeklyTotal,
         COUNT(*) as daysWorked
  FROM employeeRevenues er
  JOIN employees e ON er.employeeId = e.id
  JOIN dailyRevenues dr ON er.dailyRevenueId = dr.id
  JOIN branches b ON e.branchId = b.id
  WHERE dr.date >= '2026-01-01' AND dr.date <= '2026-01-07'
  GROUP BY e.id, e.name, b.name
  ORDER BY b.name, weeklyTotal DESC
`);
empTotals.forEach(r => {
  console.log(`   ${r.branchName} | ${r.employeeName} | ${r.weeklyTotal} ر.س (${r.daysWorked} أيام)`);
});

// مقارنة مع البونص المحسوب
console.log('\n5. البونص المحسوب حالياً للأسبوع 1 يناير 2026:');
const [bonusDetails] = await connection.query(`
  SELECT bd.*, e.name as employeeName, wb.weekStart, wb.weekEnd
  FROM bonusDetails bd
  JOIN weeklyBonuses wb ON bd.weeklyBonusId = wb.id
  JOIN employees e ON bd.employeeId = e.id
  WHERE wb.year = 2026 AND wb.month = 1 AND wb.weekNumber = 1
  ORDER BY bd.weeklyRevenue DESC
`);
bonusDetails.forEach(r => {
  console.log(`   ${r.employeeName} | إيراد: ${r.weeklyRevenue} ر.س | بونص: ${r.bonusAmount} ر.س | ${r.weekStart} - ${r.weekEnd}`);
});

await connection.end();
