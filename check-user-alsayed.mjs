import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { eq, like, or } from 'drizzle-orm';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

const result = await connection.execute(
  "SELECT id, username, name, password, loginMethod, role, isActive, branchId FROM users WHERE name = 'السيد' OR name LIKE '%السيد%'"
);

console.log('User data:', JSON.stringify(result[0], null, 2));
await connection.end();
