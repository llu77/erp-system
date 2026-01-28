import { drizzle } from 'drizzle-orm/mysql2';
import { sql, eq } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL);

// Get Alaa's branch
const alaaEmployee = await db.execute(sql`SELECT id, name, branchId FROM employees WHERE id = 30002`);
console.log('Alaa employee:', JSON.stringify(alaaEmployee[0], null, 2));

// Get all employees in Alaa's branch (branchId = 1)
const branchEmployees = await db.execute(sql`SELECT id, name, branchId FROM employees WHERE branchId = 1`);
console.log('\nEmployees in branch 1:', JSON.stringify(branchEmployees[0], null, 2));

// Check if Alaa is in the employees table
const allEmployees = await db.execute(sql`SELECT id, name, branchId FROM employees WHERE name LIKE '%علاء%'`);
console.log('\nEmployees named Alaa:', JSON.stringify(allEmployees[0], null, 2));

process.exit(0);
