import { drizzle } from 'drizzle-orm/mysql2';
import { sql } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL);

// Get payrollDetails columns
const columns = await db.execute(sql`DESCRIBE payrollDetails`);
console.log('payrollDetails columns:');
for (const col of columns[0]) {
  console.log(`  ${col.Field}: ${col.Type}`);
}

// Check for leave-related columns
const leaveColumns = columns[0].filter(c => 
  c.Field.toLowerCase().includes('leave') || 
  c.Field.toLowerCase().includes('unpaid')
);
console.log('\nLeave-related columns:', leaveColumns.map(c => c.Field));

process.exit(0);
