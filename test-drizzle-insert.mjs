import { drizzle } from 'drizzle-orm/mysql2';
import { createConnection } from 'mysql2/promise';
import * as schema from './drizzle/schema.js';
import 'dotenv/config';

const conn = await createConnection(process.env.DATABASE_URL);
const db = drizzle(conn, { schema, mode: 'default' });

const customerId = `LC-TEST-${Date.now()}`;

try {
  console.log('Attempting to insert customer with Drizzle...');
  
  await db.insert(schema.loyaltyCustomers).values({
    customerId,
    name: 'عميل اختبار Drizzle',
    phone: '0599111222',
    email: null,
    branchId: null,
    branchName: null,
    totalVisits: 0,
    totalDiscountsUsed: 0,
    isActive: true,
  });
  
  console.log('✓ Insert successful!');
  
  // حذف العميل الاختباري
  await conn.execute('DELETE FROM loyaltyCustomers WHERE customerId = ?', [customerId]);
  console.log('✓ Test customer deleted');
  
} catch (err) {
  console.error('❌ Error:', err.message);
  console.error('Full error:', err);
}

await conn.end();
