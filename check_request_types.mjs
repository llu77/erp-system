import { drizzle } from 'drizzle-orm/mysql2';
import { sql } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL);
const result = await db.execute(sql`SELECT DISTINCT requestType FROM employeeRequests`);
console.log('Request types in database:', JSON.stringify(result[0], null, 2));

// Check leave requests
const leaves = await db.execute(sql`SELECT id, requestNumber, employeeId, employeeName, requestType, status, vacationType, vacationDays, vacationStartDate, vacationEndDate FROM employeeRequests WHERE requestType = 'leave' AND status = 'approved'`);
console.log('\nApproved leave requests:', JSON.stringify(leaves[0], null, 2));

process.exit(0);
