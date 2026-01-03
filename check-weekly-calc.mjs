import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// فحص حساب البونص للأسبوع الأول من يناير 2026 (1-7)
console.log('\n=== حساب البونص للأسبوع الأول من يناير 2026 (1-7) ===');

const [weeklyRevenues] = await connection.query(`
  SELECT 
    e.id as employeeId,
    e.name as employeeName,
    e.branchId,
    SUM(er.total) as weeklyTotal
  FROM employees e
  LEFT JOIN employeeRevenues er ON er.employeeId = e.id
  LEFT JOIN dailyRevenues dr ON er.dailyRevenueId = dr.id
  WHERE dr.date >= '2026-01-01' AND dr.date <= '2026-01-07'
    AND e.isActive = 1
  GROUP BY e.id, e.name, e.branchId
  ORDER BY e.branchId, weeklyTotal DESC
`);

console.log('\nإيرادات الموظفين الأسبوعية (1-7 يناير 2026):');
let currentBranch = null;
let branchTotal = 0;
for (const r of weeklyRevenues) {
  if (r.branchId !== currentBranch) {
    if (currentBranch !== null) {
      console.log(`  --- إجمالي الفرع: ${branchTotal} ---\n`);
    }
    console.log(`\n=== الفرع ${r.branchId} ===`);
    currentBranch = r.branchId;
    branchTotal = 0;
  }
  const total = parseFloat(r.weeklyTotal || 0);
  branchTotal += total;
  
  // حساب البونص
  let tier = 'none', bonus = 0;
  if (total >= 2400) { tier = 'tier_5'; bonus = 180; }
  else if (total >= 2100) { tier = 'tier_4'; bonus = 135; }
  else if (total >= 1800) { tier = 'tier_3'; bonus = 95; }
  else if (total >= 1500) { tier = 'tier_2'; bonus = 60; }
  else if (total >= 1200) { tier = 'tier_1'; bonus = 35; }
  
  console.log(`  ${r.employeeName}: ${total} ر.س → ${tier} (${bonus} ر.س)`);
}
if (currentBranch !== null) {
  console.log(`  --- إجمالي الفرع: ${branchTotal} ---`);
}

// فحص البونص المسجل في قاعدة البيانات للأسبوع الأول
console.log('\n\n=== البونص المسجل في قاعدة البيانات للأسبوع الأول من يناير 2026 ===');
const [storedBonus] = await connection.query(`
  SELECT wb.id, wb.branchId, wb.weekNumber, wb.month, wb.year,
         DATE_FORMAT(wb.weekStart, '%Y-%m-%d') as weekStart,
         DATE_FORMAT(wb.weekEnd, '%Y-%m-%d') as weekEnd,
         wb.totalAmount
  FROM weeklyBonuses wb
  WHERE wb.year = 2026 AND wb.month = 1 AND wb.weekNumber = 1
`);
console.log('البونص المسجل:');
for (const b of storedBonus) {
  console.log(`  Branch ${b.branchId}: Week ${b.weekNumber}, ${b.weekStart} to ${b.weekEnd}, Total: ${b.totalAmount}`);
}

// فحص تفاصيل البونص المسجلة
if (storedBonus.length > 0) {
  const [storedDetails] = await connection.query(`
    SELECT bd.weeklyBonusId, e.name, bd.weeklyRevenue, bd.bonusAmount, bd.bonusTier
    FROM bonusDetails bd
    LEFT JOIN employees e ON bd.employeeId = e.id
    WHERE bd.weeklyBonusId IN (${storedBonus.map(b => b.id).join(',')})
    ORDER BY bd.weeklyBonusId, bd.bonusAmount DESC
  `);
  console.log('\nتفاصيل البونص المسجلة:');
  for (const d of storedDetails) {
    console.log(`  ${d.name || 'غير محدد'}: ${d.weeklyRevenue} → ${d.bonusTier} (${d.bonusAmount})`);
  }
}

await connection.end();
