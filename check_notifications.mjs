import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function checkNotifications() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  console.log('\n=== الإشعارات المرسلة خلال 24 ساعة ===\n');
  
  const [rows] = await connection.execute(`
    SELECT id, recipientEmail, recipientName, notificationType, 
           SUBSTRING(subject, 1, 80) as subject_preview, 
           status, sentAt, createdAt 
    FROM sentNotifications 
    WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    ORDER BY createdAt DESC
  `);
  
  console.log(`عدد السجلات: ${rows.length}\n`);
  
  rows.forEach((row, i) => {
    console.log(`${i+1}. [${row.notificationType}] ${row.subject_preview}`);
    console.log(`   المستلم: ${row.recipientName || row.recipientEmail}`);
    console.log(`   الحالة: ${row.status} | الوقت: ${row.createdAt}`);
    console.log('');
  });
  
  // فحص الإشعارات المجدولة
  console.log('\n=== الإشعارات المجدولة (SCHEDULED) ===\n');
  
  const [scheduled] = await connection.execute(`
    SELECT id, subject, createdAt 
    FROM sentNotifications 
    WHERE subject LIKE '%[SCHEDULED:%'
    ORDER BY createdAt DESC
    LIMIT 20
  `);
  
  console.log(`عدد الإشعارات المجدولة: ${scheduled.length}\n`);
  scheduled.forEach((row, i) => {
    console.log(`${i+1}. ${row.subject}`);
    console.log(`   الوقت: ${row.createdAt}`);
    console.log('');
  });
  
  // فحص إشعارات الرواتب والجرد
  console.log('\n=== إشعارات الرواتب والجرد (آخر 7 أيام) ===\n');
  
  const [payrollInventory] = await connection.execute(`
    SELECT id, subject, createdAt 
    FROM sentNotifications 
    WHERE (subject LIKE '%رواتب%' OR subject LIKE '%جرد%' OR subject LIKE '%payroll%' OR subject LIKE '%inventory%')
    AND createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    ORDER BY createdAt DESC
  `);
  
  console.log(`عدد إشعارات الرواتب/الجرد: ${payrollInventory.length}\n`);
  payrollInventory.forEach((row, i) => {
    console.log(`${i+1}. ${row.subject}`);
    console.log(`   الوقت: ${row.createdAt}`);
    console.log('');
  });
  
  await connection.end();
}

checkNotifications().catch(console.error);
