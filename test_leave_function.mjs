import { drizzle } from 'drizzle-orm/mysql2';
import { sql, eq, and, lte, gte } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL);

// Test the exact query used in getApprovedLeavesForEmployee
const employeeId = 30002; // Alaa's ID
const year = 2026;
const month = 1;

const monthStart = new Date(year, month - 1, 1);
const monthEnd = new Date(year, month, 0);

console.log('Month Start:', monthStart.toISOString());
console.log('Month End:', monthEnd.toISOString());

// Direct SQL query to test
const result = await db.execute(sql`
  SELECT * FROM employeeRequests 
  WHERE employeeId = ${employeeId}
    AND requestType = 'vacation'
    AND status = 'approved'
    AND vacationStartDate <= ${monthEnd.toISOString().split('T')[0]}
    AND vacationEndDate >= ${monthStart.toISOString().split('T')[0]}
`);

console.log('\nLeave requests for Alaa in January 2026:', JSON.stringify(result[0], null, 2));

// Check if the dates are correct
const alaaRequest = await db.execute(sql`
  SELECT vacationStartDate, vacationEndDate FROM employeeRequests WHERE employeeId = ${employeeId} AND status = 'approved' AND requestType = 'vacation'
`);
console.log('\nAlaa vacation dates:', JSON.stringify(alaaRequest[0], null, 2));

process.exit(0);
