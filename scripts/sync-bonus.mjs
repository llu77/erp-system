/**
 * سكريبت تزامن البونص يدوياً
 */
import { drizzle } from 'drizzle-orm/mysql2';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import mysql from 'mysql2/promise';

// البيئة
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

async function main() {
  const connection = await mysql.createConnection(DATABASE_URL);
  const db = drizzle(connection);
  
  console.log('🔄 بدء تزامن البونص...\n');
  
  // الحصول على الأسبوع الحالي
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  
  let weekNumber;
  if (day <= 7) weekNumber = 1;
  else if (day <= 15) weekNumber = 2;
  else if (day <= 22) weekNumber = 3;
  else if (day <= 29) weekNumber = 4;
  else weekNumber = 5;
  
  console.log(`📅 التاريخ الحالي: ${now.toISOString().split('T')[0]}`);
  console.log(`📅 الأسبوع: ${weekNumber} من شهر ${month}/${year}\n`);
  
  // الحصول على الفروع
  const [branches] = await connection.execute('SELECT id, nameAr FROM branches');
  console.log(`🏢 الفروع: ${branches.length}\n`);
  
  for (const branch of branches) {
    console.log(`\n🏢 معالجة فرع: ${branch.nameAr} (ID: ${branch.id})`);
    
    // الحصول على الموظفين النشطين في الفرع
    const [employees] = await connection.execute(
      'SELECT id, name FROM employees WHERE branchId = ? AND isActive = 1',
      [branch.id]
    );
    console.log(`   👥 الموظفين النشطين: ${employees.length}`);
    
    if (employees.length === 0) {
      console.log('   ⚠️ لا يوجد موظفين نشطين في هذا الفرع');
      continue;
    }
    
    // حساب نطاق التواريخ للأسبوع
    const ranges = {
      1: { start: 1, end: 7 },
      2: { start: 8, end: 15 },
      3: { start: 16, end: 22 },
      4: { start: 23, end: 29 },
      5: { start: 30, end: 31 }
    };
    const range = ranges[weekNumber];
    const weekStart = new Date(year, month - 1, range.start);
    const weekEnd = new Date(year, month - 1, Math.min(range.end, new Date(year, month, 0).getDate()), 23, 59, 59);
    
    console.log(`   📅 نطاق الأسبوع: ${weekStart.toISOString().split('T')[0]} - ${weekEnd.toISOString().split('T')[0]}`);
    
    // الحصول على الإيرادات اليومية في هذا النطاق
    const [dailyRevs] = await connection.execute(
      'SELECT id FROM dailyRevenues WHERE branchId = ? AND date >= ? AND date <= ?',
      [branch.id, weekStart.toISOString().split('T')[0], weekEnd.toISOString().split('T')[0]]
    );
    console.log(`   📊 الإيرادات اليومية في هذا الأسبوع: ${dailyRevs.length}`);
    
    // التحقق من وجود سجل بونص أسبوعي
    const [existingBonus] = await connection.execute(
      'SELECT id, totalAmount FROM weeklyBonuses WHERE branchId = ? AND year = ? AND month = ? AND weekNumber = ?',
      [branch.id, year, month, weekNumber]
    );
    
    let weeklyBonusId;
    if (existingBonus.length > 0) {
      weeklyBonusId = existingBonus[0].id;
      console.log(`   ✅ سجل البونص موجود (ID: ${weeklyBonusId})`);
    } else {
      // إنشاء سجل جديد
      const [result] = await connection.execute(
        `INSERT INTO weeklyBonuses (branchId, weekNumber, weekStart, weekEnd, month, year, status, totalAmount, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', '0.00', NOW(), NOW())`,
        [branch.id, weekNumber, weekStart, weekEnd, month, year]
      );
      weeklyBonusId = result.insertId;
      console.log(`   ✨ تم إنشاء سجل بونص جديد (ID: ${weeklyBonusId})`);
    }
    
    // حساب البونص لكل موظف
    let totalBonus = 0;
    for (const emp of employees) {
      // حساب إجمالي إيرادات الموظف لهذا الأسبوع
      let weeklyRevenue = 0;
      if (dailyRevs.length > 0) {
        const dailyIds = dailyRevs.map(d => d.id);
        const [empRevs] = await connection.execute(
          `SELECT COALESCE(SUM(total), 0) as total FROM employeeRevenues WHERE employeeId = ? AND dailyRevenueId IN (${dailyIds.join(',')})`,
          [emp.id]
        );
        weeklyRevenue = parseFloat(empRevs[0]?.total || 0);
      }
      
      // حساب البونص
      let bonusAmount = 0;
      let bonusTier = 'none';
      let isEligible = false;
      
      if (weeklyRevenue >= 2400) {
        bonusAmount = 180; bonusTier = 'tier_5'; isEligible = true;
      } else if (weeklyRevenue >= 2100) {
        bonusAmount = 135; bonusTier = 'tier_4'; isEligible = true;
      } else if (weeklyRevenue >= 1800) {
        bonusAmount = 95; bonusTier = 'tier_3'; isEligible = true;
      } else if (weeklyRevenue >= 1500) {
        bonusAmount = 60; bonusTier = 'tier_2'; isEligible = true;
      } else if (weeklyRevenue >= 1200) {
        bonusAmount = 35; bonusTier = 'tier_1'; isEligible = true;
      }
      
      totalBonus += bonusAmount;
      
      // تحديث أو إنشاء تفاصيل البونص
      const [existingDetail] = await connection.execute(
        'SELECT id FROM bonusDetails WHERE weeklyBonusId = ? AND employeeId = ?',
        [weeklyBonusId, emp.id]
      );
      
      if (existingDetail.length > 0) {
        await connection.execute(
          'UPDATE bonusDetails SET weeklyRevenue = ?, bonusAmount = ?, bonusTier = ?, isEligible = ?, updatedAt = NOW() WHERE id = ?',
          [weeklyRevenue.toFixed(2), bonusAmount.toFixed(2), bonusTier, isEligible, existingDetail[0].id]
        );
      } else {
        await connection.execute(
          'INSERT INTO bonusDetails (weeklyBonusId, employeeId, weeklyRevenue, bonusAmount, bonusTier, isEligible, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
          [weeklyBonusId, emp.id, weeklyRevenue.toFixed(2), bonusAmount.toFixed(2), bonusTier, isEligible]
        );
      }
      
      console.log(`      👤 ${emp.name}: إيراد ${weeklyRevenue.toFixed(2)} ر.س → بونص ${bonusAmount} ر.س (${bonusTier})`);
    }
    
    // تحديث إجمالي البونص
    await connection.execute(
      'UPDATE weeklyBonuses SET totalAmount = ?, updatedAt = NOW() WHERE id = ?',
      [totalBonus.toFixed(2), weeklyBonusId]
    );
    console.log(`   💰 إجمالي البونص للفرع: ${totalBonus.toFixed(2)} ر.س`);
  }
  
  console.log('\n✅ تم تزامن البونص بنجاح!');
  
  await connection.end();
}

main().catch(console.error);
