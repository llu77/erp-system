import { createConnection } from 'mysql2/promise';
import 'dotenv/config';

const conn = await createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute("DESCRIBE loyaltyCustomers");
console.log("Columns in loyaltyCustomers:");
rows.forEach(r => console.log(`  - ${r.Field}: ${r.Type} ${r.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${r.Default ? `DEFAULT ${r.Default}` : ''}`));
await conn.end();
