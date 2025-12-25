import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// الحصول على الفروع
const [branches] = await connection.execute('SELECT * FROM branches');
console.log('Branches:', branches);

// التحقق من المسيرات لفرع لبن (branchId = 2)
const [payrolls] = await connection.execute('SELECT * FROM payrolls WHERE year = 2025 AND month = 12');
console.log('All December 2025 payrolls:', payrolls);

await connection.end();
