import * as dbModule from '../server/db.ts';
import { users, branches } from '../drizzle/schema.ts';
import { eq, like, or } from 'drizzle-orm';

const db = dbModule.default || dbModule.db;

// البحث عن مشرفين
const supervisors = await db.select().from(users).where(
  eq(users.role, 'supervisor')
);

console.log('=== المشرفين في النظام ===');
for (const user of supervisors) {
  console.log(`
المستخدم: ${user.username}
الاسم: ${user.name}
الدور: ${user.role}
الفرع: ${user.branchId}
الصلاحيات: ${JSON.stringify(user.permissions)}
---`);
}

// البحث عن فرع طويق
const branchList = await db.select().from(branches);
console.log('\n=== الفروع ===');
for (const branch of branchList) {
  console.log(`${branch.id}: ${branch.name}`);
}

process.exit(0);
