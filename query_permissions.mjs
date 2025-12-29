import mysql from 'mysql2/promise';

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  // عرض صلاحيات المخزون
  const [permissions] = await connection.execute(`
    SELECT id, code, name, nameAr, category 
    FROM permissions 
    WHERE category = 'inventory' 
       OR code LIKE '%inventory%' 
       OR code LIKE '%stock%' 
       OR code LIKE '%product%'
       OR code LIKE '%batch%'
    ORDER BY category, code
  `);
  
  console.log('صلاحيات المخزون المتاحة:');
  console.table(permissions);
  
  // عرض صلاحيات المستخدم moh123 الحالية
  const [userPerms] = await connection.execute(`
    SELECT u.id, u.username, u.name, u.role, u.permissions
    FROM users u
    WHERE u.username = 'moh123'
  `);
  
  console.log('\nبيانات المستخدم moh123:');
  console.table(userPerms);
  
  // عرض صلاحيات المستخدم من جدول userPermissions
  const [userPermissions] = await connection.execute(`
    SELECT up.id, p.code, p.nameAr, p.category
    FROM userPermissions up
    JOIN permissions p ON up.permissionId = p.id
    JOIN users u ON up.userId = u.id
    WHERE u.username = 'moh123'
  `);
  
  console.log('\nصلاحيات المستخدم moh123 من جدول userPermissions:');
  console.table(userPermissions);
  
  await connection.end();
}

main().catch(console.error);
