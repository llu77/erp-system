import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function syncBonusWeek3() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // الأسبوع 3: 16-22 ديسمبر
  const weekStart = new Date(2025, 11, 16, 0, 0, 0);
  const weekEnd = new Date(2025, 11, 22, 23, 59, 59);
  
  console.log('Week 3 Range:', weekStart.toISOString(), '-', weekEnd.toISOString());
  
  // الحصول على الإيرادات اليومية في الأسبوع 3
  const [dailyRevs] = await conn.execute(
    `SELECT id, branchId FROM dailyRevenues WHERE date >= ? AND date <= ?`,
    [weekStart, weekEnd]
  );
  
  console.log('Daily revenues found:', dailyRevs.length);
  
  for (const dr of dailyRevs) {
    console.log(`Processing daily revenue ${dr.id} for branch ${dr.branchId}`);
    
    // الحصول على إيرادات الموظفين لهذا اليوم
    const [empRevs] = await conn.execute(
      `SELECT er.employeeId, er.total, e.name 
       FROM employeeRevenues er 
       LEFT JOIN employees e ON er.employeeId = e.id 
       WHERE er.dailyRevenueId = ?`,
      [dr.id]
    );
    
    console.log(`  Found ${empRevs.length} employee revenues`);
    
    // الحصول على أو إنشاء سجل البونص الأسبوعي
    let [weeklyBonus] = await conn.execute(
      `SELECT id FROM weeklyBonuses WHERE branchId = ? AND weekNumber = 3 AND month = 12 AND year = 2025`,
      [dr.branchId]
    );
    
    let weeklyBonusId;
    if (weeklyBonus.length === 0) {
      const [result] = await conn.execute(
        `INSERT INTO weeklyBonuses (branchId, weekNumber, weekStart, weekEnd, month, year, status, totalAmount) 
         VALUES (?, 3, ?, ?, 12, 2025, 'pending', '0.00')`,
        [dr.branchId, weekStart, weekEnd]
      );
      weeklyBonusId = result.insertId;
      console.log(`  Created weekly bonus ${weeklyBonusId}`);
    } else {
      weeklyBonusId = weeklyBonus[0].id;
      console.log(`  Using existing weekly bonus ${weeklyBonusId}`);
    }
    
    // تحديث إيرادات كل موظف
    for (const emp of empRevs) {
      // حساب إجمالي إيرادات الموظف للأسبوع
      const [totalRevenue] = await conn.execute(
        `SELECT COALESCE(SUM(CAST(er.total AS DECIMAL(10,2))), 0) as total 
         FROM employeeRevenues er 
         JOIN dailyRevenues dr ON er.dailyRevenueId = dr.id 
         WHERE er.employeeId = ? AND dr.branchId = ? AND dr.date >= ? AND dr.date <= ?`,
        [emp.employeeId, dr.branchId, weekStart, weekEnd]
      );
      
      const weeklyRevenue = parseFloat(totalRevenue[0].total);
      console.log(`  Employee ${emp.name || emp.employeeId}: ${weeklyRevenue} SAR`);
      
      // حساب البونص
      let bonusTier = 'none';
      let bonusAmount = 0;
      let isEligible = false;
      
      if (weeklyRevenue >= 2400) { bonusTier = 'tier_5'; bonusAmount = 180; isEligible = true; }
      else if (weeklyRevenue >= 2100) { bonusTier = 'tier_4'; bonusAmount = 135; isEligible = true; }
      else if (weeklyRevenue >= 1800) { bonusTier = 'tier_3'; bonusAmount = 95; isEligible = true; }
      else if (weeklyRevenue >= 1500) { bonusTier = 'tier_2'; bonusAmount = 60; isEligible = true; }
      else if (weeklyRevenue >= 1200) { bonusTier = 'tier_1'; bonusAmount = 35; isEligible = true; }
      
      // تحديث أو إنشاء تفاصيل البونص
      const [existing] = await conn.execute(
        `SELECT id FROM bonusDetails WHERE weeklyBonusId = ? AND employeeId = ?`,
        [weeklyBonusId, emp.employeeId]
      );
      
      if (existing.length > 0) {
        await conn.execute(
          `UPDATE bonusDetails SET weeklyRevenue = ?, bonusAmount = ?, bonusTier = ?, isEligible = ?, updatedAt = NOW() 
           WHERE id = ?`,
          [weeklyRevenue.toFixed(2), bonusAmount.toFixed(2), bonusTier, isEligible, existing[0].id]
        );
        console.log(`    Updated bonus detail ${existing[0].id}`);
      } else {
        await conn.execute(
          `INSERT INTO bonusDetails (weeklyBonusId, employeeId, weeklyRevenue, bonusAmount, bonusTier, isEligible) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [weeklyBonusId, emp.employeeId, weeklyRevenue.toFixed(2), bonusAmount.toFixed(2), bonusTier, isEligible]
        );
        console.log(`    Created new bonus detail`);
      }
    }
    
    // تحديث إجمالي البونص الأسبوعي
    const [totalBonus] = await conn.execute(
      `SELECT COALESCE(SUM(CAST(bonusAmount AS DECIMAL(10,2))), 0) as total FROM bonusDetails WHERE weeklyBonusId = ?`,
      [weeklyBonusId]
    );
    
    await conn.execute(
      `UPDATE weeklyBonuses SET totalAmount = ?, updatedAt = NOW() WHERE id = ?`,
      [totalBonus[0].total, weeklyBonusId]
    );
    
    console.log(`  Total bonus for week: ${totalBonus[0].total} SAR`);
  }
  
  await conn.end();
  console.log('Done!');
}

syncBonusWeek3().catch(console.error);
