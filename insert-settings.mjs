import { createConnection } from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await createConnection(process.env.DATABASE_URL);

// التحقق من وجود إعدادات
const [existing] = await conn.execute('SELECT * FROM loyaltySettings');
console.log('Existing settings:', existing);

if (existing.length === 0) {
  // إدراج إعدادات جديدة
  await conn.execute(`
    INSERT INTO loyaltySettings (requiredVisitsForDiscount, discountPercentage, isActive) 
    VALUES (3, 60, true)
  `);
  console.log('Settings inserted: 3 visits, 60% discount');
} else {
  // تحديث الإعدادات الموجودة
  await conn.execute(`
    UPDATE loyaltySettings 
    SET requiredVisitsForDiscount = 3, discountPercentage = 60 
    WHERE id = ?
  `, [existing[0].id]);
  console.log('Settings updated: 3 visits, 60% discount');
}

// التحقق
const [updated] = await conn.execute('SELECT * FROM loyaltySettings');
console.log('Updated settings:', updated);

await conn.end();
