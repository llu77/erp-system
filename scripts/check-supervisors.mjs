import { createConnection } from 'mysql2/promise';

const connection = await createConnection(process.env.DATABASE_URL);
const [rows] = await connection.execute(
  "SELECT id, username, name, role, branchId, permissions FROM users WHERE username IN ('Laban', 'Twiq')"
);
console.log(JSON.stringify(rows, null, 2));
await connection.end();
