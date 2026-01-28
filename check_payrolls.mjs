import { drizzle } from 'drizzle-orm/mysql2';
import { sql } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL);

// Get all payrolls
const payrolls = await db.execute(sql`SELECT id, branchId, branchName, year, month, status, createdAt FROM payrolls ORDER BY createdAt DESC`);
console.log('All payrolls:', JSON.stringify(payrolls[0], null, 2));

// Get payroll details for branch 1 (Laban)
if (payrolls[0].length > 0) {
  const payrollId = payrolls[0][0].id;
  const details = await db.execute(sql`
    SELECT employeeId, employeeName, leaveDays, leaveDeduction, leaveType, unpaidLeaveDays, unpaidLeaveDeduction, netSalary 
    FROM payrollDetails 
    WHERE payrollId = ${payrollId}
  `);
  console.log('\nPayroll details for latest payroll:', JSON.stringify(details[0], null, 2));
}

process.exit(0);
