import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

const [rows] = await connection.execute(
  "SELECT id, name, role, permissions FROM users WHERE id = 870017"
);

console.log('User permissions:', JSON.stringify(rows, null, 2));
if (rows[0]?.permissions) {
  console.log('Parsed permissions:', JSON.stringify(JSON.parse(rows[0].permissions), null, 2));
}
await connection.end();
