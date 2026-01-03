import { createConnection } from 'mysql2/promise';
import 'dotenv/config';

const conn = await createConnection(process.env.DATABASE_URL);

// محاولة إدخال عميل جديد
const customerId = `LC-${String(Date.now()).slice(-6)}`;
try {
  const [result] = await conn.execute(
    `INSERT INTO loyaltyCustomers (customerId, name, phone, email, totalVisits, totalDiscountsUsed, branchId, branchName, isActive) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [customerId, 'عميل اختبار', '0599999999', null, 0, 0, null, null, true]
  );
  console.log('✓ Insert successful:', result);
  
  // حذف العميل الاختباري
  await conn.execute('DELETE FROM loyaltyCustomers WHERE customerId = ?', [customerId]);
  console.log('✓ Test customer deleted');
} catch (err) {
  console.error('❌ Error:', err.message);
}

await conn.end();
