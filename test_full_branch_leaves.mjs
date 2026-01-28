import { drizzle } from 'drizzle-orm/mysql2';
import { sql, eq, and, lte, gte } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL);

const branchId = 1;
const year = 2026;
const month = 1;

const monthStart = new Date(year, month - 1, 1);
const monthEnd = new Date(year, month, 0);

console.log('Testing getApprovedLeavesForBranch logic...');
console.log('Branch ID:', branchId);
console.log('Year:', year, 'Month:', month);
console.log('Month Start:', monthStart.toISOString());
console.log('Month End:', monthEnd.toISOString());

// Get all employees in branch
const branchEmployees = await db.execute(sql`SELECT id, name FROM employees WHERE branchId = ${branchId}`);
console.log('\nEmployees in branch:', branchEmployees[0].length);

// For each employee, check leaves
for (const emp of branchEmployees[0]) {
  console.log(`\nChecking employee: ${emp.name} (ID: ${emp.id})`);
  
  const leaveRequests = await db.execute(sql`
    SELECT id, requestNumber, vacationType, vacationDays, vacationStartDate, vacationEndDate 
    FROM employeeRequests 
    WHERE employeeId = ${emp.id}
      AND requestType = 'vacation'
      AND status = 'approved'
      AND vacationStartDate <= ${monthEnd.toISOString().split('T')[0]}
      AND vacationEndDate >= ${monthStart.toISOString().split('T')[0]}
  `);
  
  if (leaveRequests[0].length > 0) {
    console.log('  Found leaves:', JSON.stringify(leaveRequests[0], null, 2));
  } else {
    console.log('  No leaves found');
  }
}

process.exit(0);
