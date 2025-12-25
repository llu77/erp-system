import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// التحقق من المسيرات الموجودة
const [payrolls] = await connection.execute('SELECT * FROM payrolls WHERE branchId = 1 AND year = 2025 AND month = 12');
console.log('Existing payrolls:', payrolls);

await connection.end();
