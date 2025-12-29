import mysql from 'mysql2/promise';

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  const [rows] = await connection.execute(
    "SELECT id, username, name, role, isActive, loginMethod, password IS NOT NULL as hasPassword FROM users WHERE username = ? OR name LIKE ?",
    ['السيد', '%السيد%']
  );
  
  console.log('Users found:', rows.length);
  rows.forEach(u => console.log(u));
  
  await connection.end();
  process.exit(0);
}

main().catch(console.error);
