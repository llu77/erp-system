import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// فحص البونص الأسبوعي
const [bonuses] = await connection.query(`
  SELECT wb.id, wb.branchId, b.nameAr as branchName, wb.weekNumber, wb.month, wb.year, 
         DATE_FORMAT(wb.weekStart, '%Y-%m-%d') as weekStart, 
         DATE_FORMAT(wb.weekEnd, '%Y-%m-%d') as weekEnd, 
         wb.totalAmount, wb.status,
         DATEDIFF(wb.weekEnd, wb.weekStart) + 1 as daysInWeek
  FROM weeklyBonuses wb
  LEFT JOIN branches b ON wb.branchId = b.id
  ORDER BY wb.year DESC, wb.month DESC, wb.weekNumber DESC
  LIMIT 10
`);
console.log('\n=== البونص الأسبوعي ===');
console.table(bonuses);

// فحص تفاصيل البونص
const [details] = await connection.query(`
  SELECT bd.id, bd.weeklyBonusId, e.name as employeeName, 
         bd.weeklyRevenue, bd.bonusAmount, bd.bonusTier, bd.isEligible
  FROM bonusDetails bd
  LEFT JOIN employees e ON bd.employeeId = e.id
  ORDER BY bd.weeklyBonusId DESC, bd.bonusAmount DESC
  LIMIT 20
`);
console.log('\n=== تفاصيل البونص ===');
console.table(details);

await connection.end();
