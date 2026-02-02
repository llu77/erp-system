import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  // عرض جميع الموظفين
  const [employees] = await connection.execute('SELECT id, name, photoUrl, branchId FROM employees');
  console.log('=== جميع الموظفين ===');
  employees.forEach(emp => {
    console.log(`ID: ${emp.id}, Name: ${emp.name}, Branch: ${emp.branchId}, Photo: ${emp.photoUrl ? 'موجودة' : 'غير موجودة'}`);
  });
  
  // تحديث صورة محمد إسماعيل (فرع 2 - الرياض)
  const photoUrl = 'https://files.manuscdn.com/user_upload_by_module/session_file/310419663030110188/vQGHEbfeZDqvqZTH.jpeg';
  
  // البحث عن محمد في فرع 2
  const [mohamedResults] = await connection.execute(
    "SELECT id, name FROM employees WHERE branchId = 2 AND (name LIKE '%Mohamed%' OR name LIKE '%محمد%')"
  );
  
  if (mohamedResults.length > 0) {
    const mohamed = mohamedResults[0];
    console.log(`\n=== تحديث صورة ${mohamed.name} (ID: ${mohamed.id}) ===`);
    await connection.execute(
      'UPDATE employees SET photoUrl = ? WHERE id = ?',
      [photoUrl, mohamed.id]
    );
    console.log('✅ تم تحديث الصورة بنجاح');
  } else {
    console.log('\n❌ لم يتم العثور على محمد في فرع الرياض');
    // محاولة تحديث أي موظف اسمه محمد
    const [anyMohamed] = await connection.execute(
      "SELECT id, name, branchId FROM employees WHERE name LIKE '%Mohamed%' OR name LIKE '%محمد%'"
    );
    if (anyMohamed.length > 0) {
      console.log('الموظفون الذين يحتوي اسمهم على محمد:');
      anyMohamed.forEach(emp => {
        console.log(`  - ID: ${emp.id}, Name: ${emp.name}, Branch: ${emp.branchId}`);
      });
    }
  }
  
  await connection.end();
}

main().catch(console.error);
