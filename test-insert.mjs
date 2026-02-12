import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { loyaltyVisits } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(conn);
  
  try {
    await db.insert(loyaltyVisits).values({
      visitId: 'LV-DRIZZLE-TEST',
      customerId: 270001,
      customerName: 'تجريبي',
      customerPhone: '0599999999',
      serviceType: 'حلاقة',
      visitDate: new Date(),
      branchId: 1,
      branchName: 'Laban',
      invoiceImageUrl: 'https://test.com/img.jpg',
      invoiceImageKey: 'test-key',
      status: 'pending',
      isDiscountVisit: false,
      discountPercentage: 0,
      visitNumberInMonth: 1,
    });
    console.log('DRIZZLE INSERT SUCCESS');
    
    // Cleanup
    await db.delete(loyaltyVisits).where(eq(loyaltyVisits.visitId, 'LV-DRIZZLE-TEST'));
    console.log('Cleanup done');
  } catch (e) {
    console.error('DRIZZLE INSERT ERROR:', e.message);
  }
  
  await conn.end();
}
main();
