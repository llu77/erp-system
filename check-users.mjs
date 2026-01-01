import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './drizzle/schema.ts';

const DATABASE_URL = process.env.DATABASE_URL;
const connection = await mysql.createConnection(DATABASE_URL);
const db = drizzle(connection, { schema, mode: 'default' });

const users = await db.select({
  id: schema.users.id,
  name: schema.users.name,
  role: schema.users.role,
  permissions: schema.users.permissions
}).from(schema.users);

console.log(JSON.stringify(users, null, 2));
await connection.end();
