import { getDb } from '../server/db';
import { users } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../server/auth/localAuth';

async function main() {
  const db = await getDb();
  if (!db) {
    console.log('Database not connected');
    process.exit(1);
  }
  
  // كلمة المرور الجديدة
  const newPassword = "moh123456";
  const { hash } = hashPassword(newPassword);
  
  // تحديث كلمة المرور
  await db.update(users)
    .set({ password: hash })
    .where(eq(users.username, "moh123"));
  
  console.log("✅ تم إعادة تعيين كلمة المرور بنجاح");
  console.log("📧 اسم المستخدم: moh123");
  console.log("🔑 كلمة المرور الجديدة:", newPassword);
  process.exit(0);
}

main();
