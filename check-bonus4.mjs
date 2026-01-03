import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// فحص البونص الأسبوعي
const [bonuses] = await connection.query(`
  SELECT wb.id, wb.branchId, wb.weekNumber, wb.month, wb.year, 
         DATE_FORMAT(wb.weekStart, '%Y-%m-%d') as weekStart, 
         DATE_FORMAT(wb.weekEnd, '%Y-%m-%d') as weekEnd, 
         wb.totalAmount, wb.status,
         DATEDIFF(wb.weekEnd, wb.weekStart) + 1 as daysInWeek
  FROM weeklyBonuses wb
  ORDER BY wb.year DESC, wb.month DESC, wb.weekNumber DESC
  LIMIT 10
`);
console.log('\n=== البونص الأسبوعي ===');
for (const b of bonuses) {
  console.log(`ID: ${b.id}, Branch: ${b.branchId}, Week: ${b.weekNumber}, Month: ${b.month}/${b.year}`);
  console.log(`  Range: ${b.weekStart} to ${b.weekEnd} (${b.daysInWeek} days)`);
  console.log(`  Total: ${b.totalAmount}, Status: ${b.status}`);
  console.log('---');
}

// فحص تفاصيل البونص
const [details] = await connection.query(`
  SELECT bd.id, bd.weeklyBonusId, bd.employeeId, bd.weeklyRevenue, bd.bonusAmount, bd.bonusTier, bd.isEligible
  FROM bonusDetails bd
  ORDER BY bd.weeklyBonusId DESC, bd.bonusAmount DESC
  LIMIT 15
`);
console.log('\n=== تفاصيل البونص ===');
for (const d of details) {
  console.log(`WeeklyBonusID: ${d.weeklyBonusId}, EmpID: ${d.employeeId}, Revenue: ${d.weeklyRevenue}, Bonus: ${d.bonusAmount}, Tier: ${d.bonusTier}, Eligible: ${d.isEligible}`);
}

await connection.end();
