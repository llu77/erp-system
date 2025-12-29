import { drizzle } from 'drizzle-orm/mysql2';
import { eq, like, or } from 'drizzle-orm';
import * as schema from './drizzle/schema.js';

const db = drizzle(process.env.DATABASE_URL);

async function main() {
  const users = await db.select({
    id: schema.users.id,
    username: schema.users.username,
    name: schema.users.name,
    role: schema.users.role,
    isActive: schema.users.isActive,
    loginMethod: schema.users.loginMethod,
    hasPassword: schema.users.password,
  }).from(schema.users).where(
    or(
      eq(schema.users.username, 'السيد'),
      like(schema.users.name, '%السيد%')
    )
  );
  
  console.log('Users found:', users.length);
  users.forEach(u => {
    console.log({
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      isActive: u.isActive,
      loginMethod: u.loginMethod,
      hasPassword: !!u.hasPassword
    });
  });
  
  process.exit(0);
}

main().catch(console.error);
