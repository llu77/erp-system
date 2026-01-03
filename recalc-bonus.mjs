import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);

console.log('\n=== إعادة حساب بونص يناير 2026 بالنظام الجديد ===\n');

// حذف بيانات البونص القديمة ليناير 2026
console.log('1. حذف بيانات البونص القديمة ليناير 2026...');
const [oldBonuses] = await connection.query(`
  SELECT id FROM weeklyBonuses WHERE year = 2026 AND month = 1
`);
if (oldBonuses.length > 0) {
  const ids = oldBonuses.map(b => b.id).join(',');
  await connection.query(`DELETE FROM bonusDetails WHERE weeklyBonusId IN (${ids})`);
  await connection.query(`DELETE FROM weeklyBonuses WHERE id IN (${ids})`);
  console.log(`   تم حذف ${oldBonuses.length} سجل بونص أسبوعي`);
} else {
  console.log('   لا توجد بيانات قديمة للحذف');
}

// الحصول على الفروع
const [branches] = await connection.query(`SELECT id, name FROM branches WHERE isActive = 1`);
console.log(`\n2. الفروع النشطة: ${branches.length}`);

// نظام الأسابيع الجديد (كل 7 أيام)
const weeks = [
  { num: 1, start: '2026-01-01', end: '2026-01-07' },
  // الأسبوع 2 لم ينتهِ بعد (8-14)
];

// حساب البونص لكل فرع وكل أسبوع
for (const branch of branches) {
  console.log(`\n=== الفرع: ${branch.name} (${branch.id}) ===`);
  
  for (const week of weeks) {
    console.log(`\n--- الأسبوع ${week.num}: ${week.start} إلى ${week.end} ---`);
    
    // الحصول على إيرادات الموظفين للأسبوع
    const [revenues] = await connection.query(`
      SELECT 
        e.id as employeeId,
        e.name as employeeName,
        COALESCE(SUM(er.total), 0) as weeklyRevenue
      FROM employees e
      LEFT JOIN employeeRevenues er ON er.employeeId = e.id
      LEFT JOIN dailyRevenues dr ON er.dailyRevenueId = dr.id
        AND dr.date >= ? AND dr.date <= ?
      WHERE e.branchId = ? AND e.isActive = 1
      GROUP BY e.id, e.name
      ORDER BY weeklyRevenue DESC
    `, [week.start, week.end, branch.id]);
    
    // حساب البونص لكل موظف
    let totalBonus = 0;
    const details = [];
    
    for (const emp of revenues) {
      const revenue = parseFloat(emp.weeklyRevenue || 0);
      let tier = 'none', bonus = 0, isEligible = 0;
      
      if (revenue >= 2400) { tier = 'tier_5'; bonus = 180; isEligible = 1; }
      else if (revenue >= 2100) { tier = 'tier_4'; bonus = 135; isEligible = 1; }
      else if (revenue >= 1800) { tier = 'tier_3'; bonus = 95; isEligible = 1; }
      else if (revenue >= 1500) { tier = 'tier_2'; bonus = 60; isEligible = 1; }
      else if (revenue >= 1200) { tier = 'tier_1'; bonus = 35; isEligible = 1; }
      
      totalBonus += bonus;
      details.push({ employeeId: emp.employeeId, name: emp.employeeName, revenue, tier, bonus, isEligible });
      
      console.log(`   ${emp.employeeName}: ${revenue} ر.س → ${tier} (${bonus} ر.س)`);
    }
    
    console.log(`   --- إجمالي البونص: ${totalBonus} ر.س ---`);
    
    // إدراج سجل البونص الأسبوعي
    const [result] = await connection.query(`
      INSERT INTO weeklyBonuses (branchId, weekNumber, month, year, weekStart, weekEnd, totalAmount, status)
      VALUES (?, ?, 1, 2026, ?, ?, ?, 'pending')
    `, [branch.id, week.num, week.start, week.end, totalBonus]);
    
    const weeklyBonusId = result.insertId;
    
    // إدراج تفاصيل البونص
    for (const d of details) {
      await connection.query(`
        INSERT INTO bonusDetails (weeklyBonusId, employeeId, weeklyRevenue, bonusAmount, bonusTier, isEligible)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [weeklyBonusId, d.employeeId, d.revenue, d.bonus, d.tier, d.isEligible]);
    }
  }
}

console.log('\n\n✅ تم إعادة حساب البونص بنجاح!');

await connection.end();
