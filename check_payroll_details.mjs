import { drizzle } from 'drizzle-orm/mysql2';
import { sql } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL);

// Get payroll details for branch 1 (Laban) - December 2025
const details = await db.execute(sql`
  SELECT pd.employeeId, pd.employeeName, pd.leaveDays, pd.leaveDeduction, pd.leaveType, pd.leaveDetails, pd.netSalary 
  FROM payrollDetails pd
  JOIN payrolls p ON pd.payrollId = p.id
  WHERE p.branchId = 1
  ORDER BY pd.employeeName
`);
console.log('Payroll details for Laban branch (Dec 2025):', JSON.stringify(details[0], null, 2));

process.exit(0);
