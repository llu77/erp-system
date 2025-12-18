import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { users } from "../../drizzle/schema";
import * as crypto from "crypto";

let _db: ReturnType<typeof drizzle> | null = null;

async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// تشفير كلمة المرور باستخدام SHA-256 مع salt
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const usedSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, usedSalt, 10000, 64, "sha512")
    .toString("hex");
  return { hash: `${usedSalt}:${hash}`, salt: usedSalt };
}

// التحقق من كلمة المرور
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  
  const { hash: computedHash } = hashPassword(password, salt);
  return computedHash === storedHash;
}

// تسجيل الدخول المحلي
export async function localLogin(username: string, password: string) {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "قاعدة البيانات غير متاحة" };
  }

  try {
    const result = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.username, username),
          eq(users.isActive, true)
        )
      )
      .limit(1);

    if (result.length === 0) {
      return { success: false, error: "اسم المستخدم أو كلمة المرور غير صحيحة" };
    }

    const user = result[0];
    
    if (!user.password) {
      return { success: false, error: "هذا الحساب لا يدعم تسجيل الدخول المحلي" };
    }

    const isValid = verifyPassword(password, user.password);
    if (!isValid) {
      return { success: false, error: "اسم المستخدم أو كلمة المرور غير صحيحة" };
    }

    // تحديث آخر تسجيل دخول
    await db
      .update(users)
      .set({ lastSignedIn: new Date() })
      .where(eq(users.id, user.id));

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        position: user.position,
      },
    };
  } catch (error) {
    console.error("[LocalAuth] Login error:", error);
    return { success: false, error: "حدث خطأ أثناء تسجيل الدخول" };
  }
}

// إنشاء مستخدم محلي جديد
export async function createLocalUser(data: {
  username: string;
  password: string;
  name: string;
  email?: string;
  phone?: string;
  role: "admin" | "manager" | "employee";
  department?: string;
  position?: string;
}) {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "قاعدة البيانات غير متاحة" };
  }

  try {
    // التحقق من عدم وجود اسم المستخدم
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.username, data.username))
      .limit(1);

    if (existing.length > 0) {
      return { success: false, error: "اسم المستخدم موجود بالفعل" };
    }

    // تشفير كلمة المرور
    const { hash } = hashPassword(data.password);

    // إنشاء المستخدم
    await db.insert(users).values({
      username: data.username,
      password: hash,
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      role: data.role,
      department: data.department || null,
      position: data.position || null,
      loginMethod: "local",
      isActive: true,
      lastSignedIn: new Date(),
    });

    return { success: true, message: "تم إنشاء المستخدم بنجاح" };
  } catch (error) {
    console.error("[LocalAuth] Create user error:", error);
    return { success: false, error: "حدث خطأ أثناء إنشاء المستخدم" };
  }
}

// تغيير كلمة المرور
export async function changePassword(userId: number, oldPassword: string, newPassword: string) {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "قاعدة البيانات غير متاحة" };
  }

  try {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (result.length === 0) {
      return { success: false, error: "المستخدم غير موجود" };
    }

    const user = result[0];
    
    if (!user.password) {
      return { success: false, error: "هذا الحساب لا يدعم تغيير كلمة المرور" };
    }

    const isValid = verifyPassword(oldPassword, user.password);
    if (!isValid) {
      return { success: false, error: "كلمة المرور الحالية غير صحيحة" };
    }

    const { hash } = hashPassword(newPassword);
    await db
      .update(users)
      .set({ password: hash })
      .where(eq(users.id, userId));

    return { success: true, message: "تم تغيير كلمة المرور بنجاح" };
  } catch (error) {
    console.error("[LocalAuth] Change password error:", error);
    return { success: false, error: "حدث خطأ أثناء تغيير كلمة المرور" };
  }
}

// إعادة تعيين كلمة المرور (للأدمن فقط)
export async function resetPassword(userId: number, newPassword: string) {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "قاعدة البيانات غير متاحة" };
  }

  try {
    const { hash } = hashPassword(newPassword);
    await db
      .update(users)
      .set({ password: hash })
      .where(eq(users.id, userId));

    return { success: true, message: "تم إعادة تعيين كلمة المرور بنجاح" };
  } catch (error) {
    console.error("[LocalAuth] Reset password error:", error);
    return { success: false, error: "حدث خطأ أثناء إعادة تعيين كلمة المرور" };
  }
}

// التحقق من وجود حساب Admin وإنشائه إذا لم يكن موجوداً
export async function ensureAdminExists() {
  const db = await getDb();
  if (!db) {
    console.warn("[LocalAuth] Cannot ensure admin: database not available");
    return;
  }

  try {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.username, "Admin"))
      .limit(1);

    if (existing.length === 0) {
      console.log("[LocalAuth] Creating default Admin user...");
      const { hash } = hashPassword("Omar101010");
      
      await db.insert(users).values({
        username: "Admin",
        password: hash,
        name: "المدير العام",
        role: "admin",
        loginMethod: "local",
        isActive: true,
        lastSignedIn: new Date(),
      });
      
      console.log("[LocalAuth] Default Admin user created successfully");
    } else {
      // تحديث كلمة مرور Admin إذا كانت موجودة
      const { hash } = hashPassword("Omar101010");
      await db
        .update(users)
        .set({ password: hash })
        .where(eq(users.username, "Admin"));
      console.log("[LocalAuth] Admin password updated");
    }
  } catch (error) {
    console.error("[LocalAuth] Error ensuring admin exists:", error);
  }
}

// الحصول على مستخدم بواسطة ID
export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[LocalAuth] Get user error:", error);
    return null;
  }
}
