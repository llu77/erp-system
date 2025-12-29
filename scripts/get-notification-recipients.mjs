import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

console.log("=== المستلمين للإشعارات ===\n");

// الحصول على جميع المستخدمين مع أدوارهم
const [users] = await connection.execute(`
  SELECT id, name, email, role, branchId 
  FROM users 
  WHERE isActive = 1
  ORDER BY role, name
`);

console.log("جميع المستخدمين النشطين:");
users.forEach(u => {
  console.log(`  - ${u.name} (${u.email}) - الدور: ${u.role} - الفرع: ${u.branchId || 'غير محدد'}`);
});

// البحث عن السيد محمد
const elsayed = users.find(u => u.name.includes('السيد') || u.email.includes('elsayed'));
console.log("\n\nالسيد محمد:", elsayed);

// البحث عن مشرف طويق
const [branches] = await connection.execute("SELECT * FROM branches WHERE nameAr LIKE '%طويق%'");
console.log("\nفرع طويق:", branches);

if (branches.length > 0) {
  const twaiqBranchId = branches[0].id;
  const twaiqSupervisor = users.find(u => u.branchId === twaiqBranchId && (u.role === 'supervisor' || u.role === 'general_supervisor'));
  console.log("مشرف طويق:", twaiqSupervisor);
}

// البحث عن الأدمن
const admins = users.filter(u => u.role === 'admin');
console.log("\nالأدمن:", admins);

await connection.end();
