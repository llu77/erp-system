import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

console.log("=== البحث عن إشعارات الجرد ومسيرات الرواتب ===\n");

// البحث عن إشعارات تحتوي على كلمة جرد أو inventory
const [inventoryNotifications] = await connection.execute(`
  SELECT * FROM sentNotifications 
  WHERE subject LIKE '%جرد%' OR subject LIKE '%inventory%' OR subject LIKE '%Inventory%'
  ORDER BY sentAt DESC
`);
console.log("إشعارات الجرد:", inventoryNotifications.length);
inventoryNotifications.forEach((n, i) => {
  console.log(`  ${i+1}. ${n.subject} - ${n.recipientEmail} - ${n.sentAt}`);
});

// البحث عن إشعارات تحتوي على كلمة رواتب أو payroll
const [payrollNotifications] = await connection.execute(`
  SELECT * FROM sentNotifications 
  WHERE subject LIKE '%رواتب%' OR subject LIKE '%payroll%' OR subject LIKE '%Payroll%' OR subject LIKE '%مسيرة%'
  ORDER BY sentAt DESC
`);
console.log("\nإشعارات مسيرات الرواتب:", payrollNotifications.length);
payrollNotifications.forEach((n, i) => {
  console.log(`  ${i+1}. ${n.subject} - ${n.recipientEmail} - ${n.sentAt}`);
});

// البحث عن إشعارات الصيانة
const [maintenanceNotifications] = await connection.execute(`
  SELECT * FROM sentNotifications 
  WHERE subject LIKE '%صيانة%' OR subject LIKE '%maintenance%' OR subject LIKE '%Maintenance%'
  ORDER BY sentAt DESC
`);
console.log("\nإشعارات الصيانة:", maintenanceNotifications.length);
maintenanceNotifications.forEach((n, i) => {
  console.log(`  ${i+1}. ${n.subject} - ${n.recipientEmail} - ${n.sentAt}`);
});

// عرض جميع أنواع الإشعارات الفريدة
const [uniqueSubjects] = await connection.execute(`
  SELECT DISTINCT subject, COUNT(*) as count, MAX(sentAt) as lastSent
  FROM sentNotifications 
  GROUP BY subject
  ORDER BY lastSent DESC
`);
console.log("\n=== جميع أنواع الإشعارات المرسلة ===");
uniqueSubjects.forEach((s, i) => {
  console.log(`${i+1}. "${s.subject}" - ${s.count} مرة - آخر إرسال: ${s.lastSent}`);
});

await connection.end();
