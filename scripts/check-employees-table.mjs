import { createConnection } from 'mysql2/promise';

const connection = await createConnection(process.env.DATABASE_URL);
const [rows] = await connection.execute(
  "SELECT id, name, username, hasPortalAccess, isActive, isSupervisor, branchId FROM employees WHERE username IN ('laban', 'twiq', 'Laban', 'Twiq') OR isSupervisor = 1"
);
console.log("الموظفون المشرفون في جدول employees:");
console.log(JSON.stringify(rows, null, 2));
await connection.end();
