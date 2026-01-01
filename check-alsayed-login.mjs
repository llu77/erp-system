import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

const [rows] = await connection.execute(
  "SELECT id, username, name, password, loginMethod, role, isActive, branchId FROM users WHERE id = 870017"
);

console.log('User login data:', JSON.stringify(rows, null, 2));
await connection.end();
