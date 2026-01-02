import mysql from 'mysql2/promise';

async function checkTable() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    const [columns] = await connection.query("DESCRIBE loyaltyCustomers");
    console.log('loyaltyCustomers columns:');
    columns.forEach(col => console.log(`  ${col.Field}: ${col.Type}`));
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkTable();
