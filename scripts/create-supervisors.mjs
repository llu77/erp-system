import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import * as crypto from "crypto";

// تشفير كلمة المرور
function hashPassword(password, salt) {
  const usedSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, usedSalt, 10000, 64, "sha512")
    .toString("hex");
  return { hash: `${usedSalt}:${hash}`, salt: usedSalt };
}

async function createSupervisors() {
  const db = drizzle(process.env.DATABASE_URL);
  
  // الحصول على معرفات الفروع
  const branches = await db.execute("SELECT id, name, nameAr FROM branches");
  console.log("الفروع المتاحة:", branches[0]);
  
  const labanBranch = branches[0].find(b => b.nameAr.includes("لبن") || b.name.toLowerCase().includes("laban"));
  const tuwaiqBranch = branches[0].find(b => b.nameAr.includes("طويق") || b.name.toLowerCase().includes("tuwaiq") || b.name.toLowerCase().includes("twiq"));
  
  console.log("فرع لبن:", labanBranch);
  console.log("فرع طويق:", tuwaiqBranch);
  
  if (!labanBranch || !tuwaiqBranch) {
    console.error("لم يتم العثور على الفروع!");
    process.exit(1);
  }

  // صلاحيات المشرف (إدخال فقط بدون تعديل أو حذف)
  const supervisorPermissions = JSON.stringify({
    canCreate: true,
    canRead: true,
    canUpdate: false,
    canDelete: false,
    canExport: true,
    canPrint: true,
    modules: ["revenues", "expenses", "requests", "reports"]
  });

  // صلاحيات المشاهد (مشاهدة وطباعة فقط)
  const viewerPermissions = JSON.stringify({
    canCreate: false,
    canRead: true,
    canUpdate: false,
    canDelete: false,
    canExport: true,
    canPrint: true,
    modules: ["all"]
  });

  const supervisors = [
    {
      username: "Laban",
      password: "admin1234",
      name: "عبدالحي",
      email: "Galalbdo766@gmail.com",
      role: "supervisor",
      branchId: labanBranch.id,
      permissions: supervisorPermissions,
      position: "مشرف فرع لبن"
    },
    {
      username: "Twiq",
      password: "admin1234",
      name: "محمد",
      email: "mohamedismaelebrhem@gmail.com",
      role: "supervisor",
      branchId: tuwaiqBranch.id,
      permissions: supervisorPermissions,
      position: "مشرف فرع طويق"
    },
    {
      username: "GeneralSupervisor",
      password: "admin1234",
      name: "سالم الوادعي",
      email: "Salemalwadai1997@gmail.com",
      role: "viewer",
      branchId: null, // كل الفروع
      permissions: viewerPermissions,
      position: "المشرف العام"
    }
  ];

  for (const sup of supervisors) {
    try {
      // التحقق من عدم وجود المستخدم
      const existing = await db.execute(`SELECT id FROM users WHERE username = '${sup.username}'`);
      
      if (existing[0].length > 0) {
        console.log(`المستخدم ${sup.username} موجود بالفعل، جاري التحديث...`);
        const { hash } = hashPassword(sup.password);
        await db.execute(`
          UPDATE users SET 
            password = '${hash}',
            name = '${sup.name}',
            email = '${sup.email}',
            role = '${sup.role}',
            branchId = ${sup.branchId || 'NULL'},
            permissions = '${sup.permissions}',
            position = '${sup.position}'
          WHERE username = '${sup.username}'
        `);
        console.log(`✓ تم تحديث ${sup.username}`);
      } else {
        const { hash } = hashPassword(sup.password);
        await db.execute(`
          INSERT INTO users (username, password, name, email, role, branchId, permissions, position, loginMethod, isActive, lastSignedIn, createdAt, updatedAt)
          VALUES ('${sup.username}', '${hash}', '${sup.name}', '${sup.email}', '${sup.role}', ${sup.branchId || 'NULL'}, '${sup.permissions}', '${sup.position}', 'local', 1, NOW(), NOW(), NOW())
        `);
        console.log(`✓ تم إنشاء ${sup.username}`);
      }
    } catch (error) {
      console.error(`خطأ في إنشاء ${sup.username}:`, error.message);
    }
  }

  // إضافة مستلمي الإشعارات
  console.log("\nإضافة مستلمي الإشعارات...");
  
  const recipients = [
    {
      name: "عبدالحي - مشرف لبن",
      email: "Galalbdo766@gmail.com",
      branchId: labanBranch.id,
      notificationTypes: JSON.stringify(["revenue", "expense", "request", "alert"]),
      isActive: true
    },
    {
      name: "محمد - مشرف طويق",
      email: "mohamedismaelebrhem@gmail.com",
      branchId: tuwaiqBranch.id,
      notificationTypes: JSON.stringify(["revenue", "expense", "request", "alert"]),
      isActive: true
    },
    {
      name: "سالم الوادعي - المشرف العام",
      email: "Salemalwadai1997@gmail.com",
      branchId: null,
      notificationTypes: JSON.stringify(["all"]),
      isActive: true
    }
  ];

  for (const rec of recipients) {
    try {
      const existing = await db.execute(`SELECT id FROM notificationRecipients WHERE email = '${rec.email}'`);
      
      if (existing[0].length > 0) {
        console.log(`مستلم الإشعارات ${rec.email} موجود بالفعل، جاري التحديث...`);
        await db.execute(`
          UPDATE notificationRecipients SET 
            name = '${rec.name}',
            branchId = ${rec.branchId || 'NULL'},
            notificationTypes = '${rec.notificationTypes}',
            isActive = ${rec.isActive ? 1 : 0}
          WHERE email = '${rec.email}'
        `);
      } else {
        await db.execute(`
          INSERT INTO notificationRecipients (name, email, branchId, notificationTypes, isActive, createdAt, updatedAt)
          VALUES ('${rec.name}', '${rec.email}', ${rec.branchId || 'NULL'}, '${rec.notificationTypes}', ${rec.isActive ? 1 : 0}, NOW(), NOW())
        `);
        console.log(`✓ تم إضافة مستلم الإشعارات ${rec.email}`);
      }
    } catch (error) {
      console.error(`خطأ في إضافة مستلم الإشعارات ${rec.email}:`, error.message);
    }
  }

  console.log("\n✓ تم إنشاء جميع المشرفين ومستلمي الإشعارات بنجاح!");
  process.exit(0);
}

createSupervisors().catch(console.error);
