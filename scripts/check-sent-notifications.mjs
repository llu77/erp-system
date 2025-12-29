import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

console.log("=== الإشعارات المرسلة ===\n");

// عرض هيكل جدول sentNotifications
const [columns] = await connection.execute("DESCRIBE sentNotifications");
console.log("هيكل جدول sentNotifications:", columns.map(c => c.Field));

// عرض جميع الإشعارات المرسلة
const [notifications] = await connection.execute("SELECT * FROM sentNotifications ORDER BY sentAt DESC LIMIT 50");
console.log("\nالإشعارات المرسلة:");
notifications.forEach((n, i) => {
  console.log(`\n--- إشعار ${i+1} ---`);
  console.log(`النوع: ${n.type}`);
  console.log(`القناة: ${n.channel}`);
  console.log(`المستلم: ${n.recipientEmail || n.recipientId}`);
  console.log(`العنوان: ${n.subject}`);
  console.log(`الحالة: ${n.status}`);
  console.log(`تاريخ الإرسال: ${n.sentAt}`);
});

// عرض إحصائيات
const [stats] = await connection.execute(`
  SELECT 
    type,
    channel,
    COUNT(*) as count,
    MIN(sentAt) as firstSent,
    MAX(sentAt) as lastSent
  FROM sentNotifications 
  GROUP BY type, channel
  ORDER BY lastSent DESC
`);
console.log("\n\n=== إحصائيات الإشعارات ===");
stats.forEach(s => {
  console.log(`${s.type} (${s.channel}): ${s.count} إشعار - من ${s.firstSent} إلى ${s.lastSent}`);
});

await connection.end();
