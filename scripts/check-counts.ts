import { getDb } from '../server/db';
import { inventoryCounts } from '../drizzle/schema';
import { desc, eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) {
    console.log('Database not connected');
    process.exit(1);
  }
  
  // جلب جميع عمليات الجرد
  const result = await db.select().from(inventoryCounts).orderBy(desc(inventoryCounts.id)).limit(10);
  console.log('All inventory counts:');
  console.log(JSON.stringify(result, null, 2));
  
  // جلب الجرد النشط
  const active = await db.select().from(inventoryCounts).where(eq(inventoryCounts.status, 'in_progress'));
  console.log('\nActive counts:');
  console.log(JSON.stringify(active, null, 2));
  
  process.exit(0);
}

main();
