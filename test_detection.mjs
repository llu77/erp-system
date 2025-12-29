import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function testDetection() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  // الحصول على بداية اليوم (UTC)
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  
  console.log('\n=== اختبار كشف الإشعارات ===\n');
  console.log(`بداية اليوم (UTC): ${today.toISOString()}`);
  
  // البحث عن إشعارات الرواتب بالأنماط المختلفة
  const patterns = [
    { name: 'تنسيق جديد [SCHEDULED:payroll_reminder_29]', pattern: '%[SCHEDULED:payroll_reminder_29]%' },
    { name: 'نوع payroll_reminder_29', pattern: null, type: 'payroll_reminder_29' },
    { name: 'موضوع يحتوي تذكير الرواتب', pattern: '%تذكير الرواتب%' },
  ];
  
  for (const p of patterns) {
    let query, params;
    if (p.type) {
      query = `SELECT COUNT(*) as count FROM sentNotifications 
               WHERE createdAt >= ? AND status = 'sent' AND notificationType = ?`;
      params = [today, p.type];
    } else {
      query = `SELECT COUNT(*) as count FROM sentNotifications 
               WHERE createdAt >= ? AND status = 'sent' AND subject LIKE ?`;
      params = [today, p.pattern];
    }
    
    const [rows] = await connection.execute(query, params);
    console.log(`${p.name}: ${rows[0].count} سجل`);
  }
  
  // البحث المجمع (كما في الكود الجديد)
  const [combined] = await connection.execute(`
    SELECT COUNT(*) as count FROM sentNotifications 
    WHERE createdAt >= ? AND status = 'sent' AND (
      subject LIKE '%[SCHEDULED:payroll_reminder_29]%'
      OR notificationType = 'payroll_reminder_29'
      OR subject LIKE '%تذكير الرواتب%'
    )
  `, [today]);
  
  console.log(`\n=== البحث المجمع ===`);
  console.log(`إجمالي الإشعارات المكتشفة: ${combined[0].count}`);
  
  if (combined[0].count > 0) {
    console.log(`\n✅ النظام سيكتشف الإشعارات السابقة ويمنع التكرار!`);
  } else {
    console.log(`\n⚠️ لم يتم العثور على إشعارات - قد يتم الإرسال`);
  }
  
  await connection.end();
}

testDetection().catch(console.error);
