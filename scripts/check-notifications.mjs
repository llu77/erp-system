import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// التحقق من الإشعارات المرسلة
console.log("=== سجل الإشعارات المرسلة ===\n");

// البحث عن جدول الإشعارات
const [tables] = await connection.execute("SHOW TABLES LIKE '%notification%'");
console.log("جداول الإشعارات:", tables);

// البحث عن جدول سجل البريد الإلكتروني
const [emailTables] = await connection.execute("SHOW TABLES LIKE '%email%'");
console.log("جداول البريد:", emailTables);

// البحث عن جدول السجلات
const [logTables] = await connection.execute("SHOW TABLES LIKE '%log%'");
console.log("جداول السجلات:", logTables);

// عرض جميع الجداول
const [allTables] = await connection.execute("SHOW TABLES");
console.log("\nجميع الجداول:", allTables.map(t => Object.values(t)[0]));

await connection.end();
