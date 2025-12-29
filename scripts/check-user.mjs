import { db } from '../server/db.js';
import { users } from '../drizzle/schema.js';
import { eq } from 'drizzle-orm';

const result = await db.select().from(users).where(eq(users.username, 'moh123'));
console.log(JSON.stringify(result, null, 2));
process.exit(0);
