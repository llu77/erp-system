import { getDb } from '../db';
import { employees, branches, users } from '../../drizzle/schema';
import { eq, and, like, or, sql } from 'drizzle-orm';
import { hashPassword, verifyPassword } from './localAuth';

// إنشاء اسم مستخدم من اسم الموظف
export function generateUsername(name: string, code: string = ''): string {
  // إزالة المسافات والأحرف الخاصة
  const cleanName = name.replace(/\s+/g, '').toLowerCase();
  // استخدام أول 8 أحرف من الاسم + الكود
  const shortName = cleanName.substring(0, 8);
  return `${shortName}${code}`.toLowerCase();
}

// إنشاء كلمة مرور عشوائية
export function generatePassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// إنشاء حسابات للموظفين
export async function createEmployeeAccounts(): Promise<{
  success: boolean;
  created: Array<{ id: number; name: string; username: string; password: string }>;
  errors: string[];
}> {
  const db = await getDb();
  if (!db) {
    return { success: false, created: [], errors: ['قاعدة البيانات غير متاحة'] };
  }

  const created: Array<{ id: number; name: string; username: string; password: string }> = [];
  const errors: string[] = [];

  try {
    // جلب جميع الموظفين النشطين بدون حساب
    const employeesWithoutAccount = await db
      .select()
      .from(employees)
      .where(and(
        eq(employees.isActive, true),
        eq(employees.hasPortalAccess, false)
      ));

    for (const emp of employeesWithoutAccount) {
      try {
        const username = generateUsername(emp.name, emp.code);
        const password = generatePassword();
        const hashedPassword = hashPassword(password).hash;

        await db
          .update(employees)
          .set({
            username,
            password: hashedPassword,
            hasPortalAccess: true,
          })
          .where(eq(employees.id, emp.id));

        created.push({
          id: emp.id,
          name: emp.name,
          username,
          password, // كلمة المرور الأصلية (غير مشفرة) للعرض مرة واحدة
        });
      } catch (err) {
        errors.push(`خطأ في إنشاء حساب للموظف ${emp.name}: ${err}`);
      }
    }

    return { success: true, created, errors };
  } catch (error) {
    return { success: false, created, errors: [`خطأ عام: ${error}`] };
  }
}

// تسجيل دخول الموظف (يدعم الموظفين والمشرفين والأدمن)
export async function employeeLogin(username: string, password: string): Promise<{
  success: boolean;
  employee?: {
    id: number;
    name: string;
    code: string;
    branchId: number;
    branchName: string;
    position: string | null;
    email: string | null;
    emailVerified: boolean;
    isSupervisor: boolean;
    isAdmin?: boolean;
    role?: string;
  };
  error?: string;
}> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: 'قاعدة البيانات غير متاحة' };
  }

  try {
    // البحث أولاً في جدول الموظفين
    const emp = await db
      .select()
      .from(employees)
      .where(and(
        eq(employees.username, username.toLowerCase()),
        eq(employees.isActive, true),
        eq(employees.hasPortalAccess, true)
      ))
      .limit(1);

    if (emp.length > 0) {
      const employee = emp[0];

      // التحقق من كلمة المرور
      if (!employee.password) {
        return { success: false, error: 'الحساب غير مفعل' };
      }

      const isValid = await verifyPassword(password, employee.password);
      if (!isValid) {
        return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
      }

      // تحديث آخر تسجيل دخول
      await db
        .update(employees)
        .set({ lastLogin: new Date() })
        .where(eq(employees.id, employee.id));

      // جلب اسم الفرع
      let branchName = 'غير محدد';
      const branch = await db
        .select()
        .from(branches)
        .where(eq(branches.id, employee.branchId))
        .limit(1);
      
      if (branch.length > 0) {
        branchName = branch[0].name;
      }

      return {
        success: true,
        employee: {
          id: employee.id,
          name: employee.name,
          code: employee.code,
          branchId: employee.branchId,
          branchName,
          position: employee.position,
          email: employee.email,
          emailVerified: employee.emailVerified,
          isSupervisor: employee.isSupervisor || false,
          isAdmin: false,
          role: 'employee',
        },
      };
    }

    // إذا لم يُوجد في جدول الموظفين، ابحث في جدول المستخدمين (للمشرفين والأدمن)
    // استخدام LOWER للمقارنة بدون حساسية لحالة الأحرف
    const user = await db
      .select()
      .from(users)
      .where(and(
        sql`LOWER(${users.username}) = ${username.toLowerCase()}`,
        eq(users.isActive, true)
      ))
      .limit(1);

    if (user.length === 0) {
      return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
    }

    const foundUser = user[0];

    // التحقق من كلمة المرور
    if (!foundUser.password) {
      return { success: false, error: 'الحساب غير مفعل' };
    }

    const isValid = await verifyPassword(password, foundUser.password);
    if (!isValid) {
      return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
    }

    // تحديث آخر تسجيل دخول
    await db
      .update(users)
      .set({ lastSignedIn: new Date() })
      .where(eq(users.id, foundUser.id));

    // جلب اسم الفرع إذا كان موجوداً
    let branchName = 'جميع الفروع';
    if (foundUser.branchId) {
      const branch = await db
        .select()
        .from(branches)
        .where(eq(branches.id, foundUser.branchId))
        .limit(1);
      
      if (branch.length > 0) {
        branchName = branch[0].name;
      }
    }

    return {
      success: true,
      employee: {
        id: foundUser.id,
        name: foundUser.name || foundUser.username || 'مستخدم',
        code: `USR-${foundUser.id.toString().padStart(3, '0')}`,
        branchId: foundUser.branchId || 0,
        branchName,
        position: foundUser.position || foundUser.role,
        email: foundUser.email,
        emailVerified: true,
        isSupervisor: foundUser.role === 'supervisor' || foundUser.role === 'admin',
        isAdmin: foundUser.role === 'admin',
        role: foundUser.role,
      },
    };
  } catch (error) {
    return { success: false, error: `خطأ في تسجيل الدخول: ${error}` };
  }
}

// تغيير كلمة مرور الموظف
export async function changeEmployeePassword(
  employeeId: number,
  oldPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: 'قاعدة البيانات غير متاحة' };
  }

  try {
    const emp = await db
      .select()
      .from(employees)
      .where(eq(employees.id, employeeId))
      .limit(1);

    if (emp.length === 0) {
      return { success: false, error: 'الموظف غير موجود' };
    }

    const employee = emp[0];

    if (!employee.password) {
      return { success: false, error: 'الحساب غير مفعل' };
    }

    const isValid = await verifyPassword(oldPassword, employee.password);
    if (!isValid) {
      return { success: false, error: 'كلمة المرور الحالية غير صحيحة' };
    }

    const hashedPassword = hashPassword(newPassword).hash;
    await db
      .update(employees)
      .set({ password: hashedPassword })
      .where(eq(employees.id, employeeId));

    return { success: true };
  } catch (error) {
    return { success: false, error: `خطأ في تغيير كلمة المرور: ${error}` };
  }
}

// إعادة تعيين كلمة مرور الموظف (للأدمن)
export async function resetEmployeePassword(employeeId: number): Promise<{
  success: boolean;
  newPassword?: string;
  error?: string;
}> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: 'قاعدة البيانات غير متاحة' };
  }

  try {
    const newPassword = generatePassword();
    const hashedPassword = hashPassword(newPassword).hash;

    await db
      .update(employees)
      .set({ password: hashedPassword })
      .where(eq(employees.id, employeeId));

    return { success: true, newPassword };
  } catch (error) {
    return { success: false, error: `خطأ في إعادة تعيين كلمة المرور: ${error}` };
  }
}

// جلب جميع حسابات الموظفين
export async function getEmployeeAccounts(): Promise<{
  success: boolean;
  accounts: Array<{
    id: number;
    name: string;
    code: string;
    username: string | null;
    branchId: number;
    branchName: string;
    hasPortalAccess: boolean;
    lastLogin: Date | null;
  }>;
  error?: string;
}> {
  const db = await getDb();
  if (!db) {
    return { success: false, accounts: [], error: 'قاعدة البيانات غير متاحة' };
  }

  try {
    const emps = await db
      .select({
        id: employees.id,
        name: employees.name,
        code: employees.code,
        username: employees.username,
        branchId: employees.branchId,
        hasPortalAccess: employees.hasPortalAccess,
        lastLogin: employees.lastLogin,
      })
      .from(employees)
      .where(eq(employees.isActive, true));

    // جلب أسماء الفروع
    const branchList = await db.select().from(branches);
    const branchMap = new Map(branchList.map((b: { id: number; name: string }) => [b.id, b.name]));

    const accounts = emps.map((emp: typeof emps[0]) => ({
      ...emp,
      branchName: branchMap.get(emp.branchId) || 'غير محدد',
    }));

    return { success: true, accounts };
  } catch (error) {
    return { success: false, accounts: [], error: `خطأ في جلب الحسابات: ${error}` };
  }
}
