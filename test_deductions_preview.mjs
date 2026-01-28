import { drizzle } from 'drizzle-orm/mysql2';
import { sql, eq, and, lte, gte } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL);

const branchId = 1;
const year = 2026;
const month = 1;

console.log('Testing getDeductionsPreview for branch 1, January 2026...');

// Simulate getApprovedLeavesForBranch
const monthStart = new Date(year, month - 1, 1);
const monthEnd = new Date(year, month, 0);

console.log('Month range:', monthStart.toISOString(), 'to', monthEnd.toISOString());

// Get employees in branch
const branchEmployees = await db.execute(sql`SELECT id, name FROM employees WHERE branchId = ${branchId}`);
console.log('\nEmployees in branch:', branchEmployees[0].length);

const leavesMap = new Map();

for (const emp of branchEmployees[0]) {
  const leaveRequests = await db.execute(sql`
    SELECT id, vacationType, vacationDays, vacationStartDate, vacationEndDate 
    FROM employeeRequests 
    WHERE employeeId = ${emp.id}
      AND requestType = 'vacation'
      AND status = 'approved'
      AND vacationStartDate <= ${monthEnd.toISOString().split('T')[0]}
      AND vacationEndDate >= ${monthStart.toISOString().split('T')[0]}
  `);
  
  if (leaveRequests[0].length > 0) {
    console.log(`\nEmployee ${emp.name} (ID: ${emp.id}) has leaves:`, JSON.stringify(leaveRequests[0], null, 2));
    
    let totalDays = 0;
    const leaves = [];
    
    for (const leave of leaveRequests[0]) {
      const leaveStart = new Date(leave.vacationStartDate);
      let leaveEnd;
      
      if (leave.vacationEndDate) {
        leaveEnd = new Date(leave.vacationEndDate);
      } else if (leave.vacationDays && leave.vacationDays > 0) {
        leaveEnd = new Date(leaveStart);
        leaveEnd.setDate(leaveEnd.getDate() + leave.vacationDays - 1);
      } else {
        leaveEnd = new Date(leaveStart);
      }
      
      const effectiveStart = leaveStart < monthStart ? monthStart : leaveStart;
      const effectiveEnd = leaveEnd > monthEnd ? monthEnd : leaveEnd;
      
      const days = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      if (days > 0) {
        totalDays += days;
        leaves.push({
          id: leave.id,
          startDate: effectiveStart.toISOString().split('T')[0],
          endDate: effectiveEnd.toISOString().split('T')[0],
          days,
          type: leave.vacationType || 'بدون راتب',
        });
      }
    }
    
    if (totalDays > 0) {
      leavesMap.set(emp.id, { totalDays, totalDeduction: 0, leaves });
    }
  }
}

console.log('\n=== Final Leaves Map ===');
leavesMap.forEach((value, key) => {
  console.log(`Employee ID ${key}:`, JSON.stringify(value, null, 2));
});

process.exit(0);
