import { getDb } from '../server/db';
import { users } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) {
    console.log('Database not connected');
    process.exit(1);
  }
  
  const result = await db.select().from(users).where(eq(users.username, 'moh123'));
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main();
