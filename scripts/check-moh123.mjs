import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: process.env.DB_USER || '3Xn8HZLmRkfJwDT.root',
  password: process.env.DB_PASSWORD || 'Ey2NUMgJhJPxLfFi',
  database: process.env.DB_NAME || 'dslttk22lx4ib7jabif6k8',
  ssl: { rejectUnauthorized: true }
});

const [rows] = await connection.execute('SELECT id, username, name, role, branchId, permissions FROM users WHERE username = ?', ['moh123']);
console.log('User moh123:', JSON.stringify(rows[0], null, 2));

await connection.end();
