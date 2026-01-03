import { createConnection } from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute('SELECT * FROM loyaltySettings');
console.log('Loyalty Settings:', JSON.stringify(rows, null, 2));
await conn.end();
