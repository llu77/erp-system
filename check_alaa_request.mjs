import { drizzle } from 'drizzle-orm/mysql2';
import { sql } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL);

// Check Alaa's approved vacation request
const alaaRequest = await db.execute(sql`
  SELECT id, requestNumber, employeeId, employeeName, requestType, status, vacationType, vacationDays, vacationStartDate, vacationEndDate 
  FROM employeeRequests 
  WHERE requestNumber = 'REQ-260123-6102'
`);
console.log('Alaa Request:', JSON.stringify(alaaRequest[0], null, 2));

// Check all approved vacation requests
const approvedVacations = await db.execute(sql`
  SELECT id, requestNumber, employeeId, employeeName, requestType, status, vacationType, vacationDays, vacationStartDate, vacationEndDate 
  FROM employeeRequests 
  WHERE requestType = 'vacation' AND status = 'approved'
`);
console.log('\nAll approved vacation requests:', JSON.stringify(approvedVacations[0], null, 2));

process.exit(0);
