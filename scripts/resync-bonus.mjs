import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

async function resyncBonus() {
  const pool = await mysql.createPool(DATABASE_URL);
  
  console.log('=== إعادة تزامن البونص للأسبوع 1 يناير 2026 ===\n');
  
  // 1. حساب الإيرادات الفعلية للموظفين (استعلام صحيح)
  const [actualRevenues] = await pool.execute(`
    SELECT 
      e.id as employeeId,
      e.name,
      e.code,
      COALESCE(SUM(er.total), 0) as actualRevenue
    FROM employees e
    LEFT JOIN (
      SELECT er.employeeId, er.total
      FROM employeeRevenues er
      INNER JOIN dailyRevenues dr ON er.dailyRevenueId = dr.id 
      WHERE dr.branchId = 1
        AND dr.date >= '2026-01-01' 
        AND dr.date <= '2026-01-07'
    ) er ON er.employeeId = e.id
    WHERE e.branchId = 1 AND e.isActive = 1
    GROUP BY e.id, e.name, e.code
  `);
  
  console.log('الإيرادات الفعلية (1-7 يناير 2026):');
  console.table(actualRevenues);
  
  // 2. الحصول على weeklyBonusId
  const [bonuses] = await pool.execute(`
    SELECT id FROM weeklyBonuses 
    WHERE branchId = 1 AND year = 2026 AND month = 1 AND weekNumber = 1
  `);
  
  if (bonuses.length === 0) {
    console.log('لا يوجد بونص للأسبوع المحدد');
    await pool.end();
    return;
  }
  
  const weeklyBonusId = bonuses[0].id;
  console.log(`\nweeklyBonusId: ${weeklyBonusId}`);
  
  // 3. تحديث bonusDetails بالإيرادات الفعلية
  let totalBonus = 0;
  let eligibleCount = 0;
  
  for (const emp of actualRevenues) {
    const revenue = Number(emp.actualRevenue);
    
    // حساب البونص حسب المستوى
    let bonusAmount = 0;
    let bonusTier = 'none';
    let isEligible = false;
    
    if (revenue >= 8000) {
      bonusAmount = 180; bonusTier = 'tier_5'; isEligible = true;
    } else if (revenue >= 6000) {
      bonusAmount = 120; bonusTier = 'tier_4'; isEligible = true;
    } else if (revenue >= 4000) {
      bonusAmount = 80; bonusTier = 'tier_3'; isEligible = true;
    } else if (revenue >= 2000) {
      bonusAmount = 50; bonusTier = 'tier_2'; isEligible = true;
    } else if (revenue >= 1000) {
      bonusAmount = 35; bonusTier = 'tier_1'; isEligible = true;
    }
    
    totalBonus += bonusAmount;
    if (isEligible) eligibleCount++;
    
    // تحديث bonusDetails
    const [updateResult] = await pool.execute(`
      UPDATE bonusDetails 
      SET weeklyRevenue = ?, bonusAmount = ?, bonusTier = ?, isEligible = ?
      WHERE weeklyBonusId = ? AND employeeId = ?
    `, [revenue, bonusAmount, bonusTier, isEligible ? 1 : 0, weeklyBonusId, emp.employeeId]);
    
    console.log(`تحديث ${emp.name}: ${revenue} ر.س → ${bonusAmount} ر.س (${bonusTier || 'غير مؤهل'})`);
  }
  
  // 4. تحديث إجمالي البونص
  const totalRevenue = actualRevenues.reduce((sum, emp) => sum + Number(emp.actualRevenue), 0);
  
  await pool.execute(`
    UPDATE weeklyBonuses 
    SET totalAmount = ?
    WHERE id = ?
  `, [totalBonus, weeklyBonusId]);
  
  console.log(`\n✅ تم تحديث البونص:`);
  console.log(`   - إجمالي الإيرادات: ${totalRevenue} ر.س`);
  console.log(`   - إجمالي البونص: ${totalBonus} ر.س`);
  console.log(`   - عدد المؤهلين: ${eligibleCount}`);
  
  await pool.end();
}

resyncBonus().catch(console.error);
