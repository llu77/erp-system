/**
 * Revenue Sync - تزامن الإيرادات مع البونص
 * يتم تحديث البونص تلقائياً عند إدخال إيرادات جديدة
 */

import { getDb } from "../db";
import { 
  dailyRevenues, 
  employeeRevenues, 
  weeklyBonuses, 
  bonusDetails, 
  employees,
  branches
} from "../../drizzle/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { calculateBonus, getWeekInfo, getWeekDateRange } from "./calculator";
import { notifyBonusCalculationCompleted } from "../notifications/advancedNotificationService";
import * as emailNotifications from "../notifications/emailNotificationService";

/**
 * تزامن البونص عند تغيير الإيرادات
 */
export async function syncBonusOnRevenueChange(
  employeeId: number,
  branchId: number,
  date: Date
): Promise<{ success: boolean; message: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, message: "فشل الاتصال بقاعدة البيانات" };
  }

  try {
    const weekInfo = getWeekInfo(date);
    console.log(`[Bonus Sync] Syncing bonus for employee ${employeeId}, week ${weekInfo.weekNumber}`);

    // الحصول على إيرادات الموظف لهذا الأسبوع
    const weeklyRevenue = await getEmployeeWeeklyRevenue(
      db,
      employeeId,
      branchId,
      weekInfo.weekStart,
      weekInfo.weekEnd
    );

    // حساب البونص
    const bonusCalc = calculateBonus(weeklyRevenue);

    // الحصول على أو إنشاء سجل البونص الأسبوعي
    let weeklyBonusId = await getOrCreateWeeklyBonus(
      db,
      branchId,
      weekInfo.weekNumber,
      weekInfo.month,
      weekInfo.year,
      weekInfo.weekStart,
      weekInfo.weekEnd
    );

    // تحديث تفاصيل البونص للموظف
    await upsertBonusDetail(
      db,
      weeklyBonusId,
      employeeId,
      weeklyRevenue,
      bonusCalc.amount,
      bonusCalc.tier,
      bonusCalc.isEligible
    );

    // تحديث إجمالي البونص الأسبوعي
    await updateWeeklyBonusTotal(db, weeklyBonusId);

    return { 
      success: true, 
      message: `تم تحديث البونص للموظف ${employeeId}` 
    };

  } catch (error) {
    console.error("[Bonus Sync] Error:", error);
    return { 
      success: false, 
      message: `فشل تزامن البونص: ${error instanceof Error ? error.message : "خطأ غير معروف"}` 
    };
  }
}

/**
 * الحصول على إيرادات الموظف الأسبوعية
 */
async function getEmployeeWeeklyRevenue(
  db: ReturnType<typeof import("drizzle-orm/mysql2").drizzle>,
  employeeId: number,
  branchId: number,
  weekStart: Date,
  weekEnd: Date
): Promise<number> {
  // الحصول على الإيرادات اليومية في هذا النطاق
  const dailyRevenuesList = await db
    .select({ id: dailyRevenues.id })
    .from(dailyRevenues)
    .where(and(
      eq(dailyRevenues.branchId, branchId),
      gte(dailyRevenues.date, weekStart),
      lte(dailyRevenues.date, weekEnd)
    ));

  if (dailyRevenuesList.length === 0) {
    return 0;
  }

  const dailyRevenueIds = dailyRevenuesList.map(dr => dr.id);

  // حساب مجموع إيرادات الموظف
  const result = await db
    .select({
      totalRevenue: sql<string>`COALESCE(SUM(${employeeRevenues.total}), 0)`,
    })
    .from(employeeRevenues)
    .where(and(
      eq(employeeRevenues.employeeId, employeeId),
      sql`${employeeRevenues.dailyRevenueId} IN (${sql.join(dailyRevenueIds, sql`, `)})`
    ));

  return Number(result[0]?.totalRevenue || 0);
}

/**
 * الحصول على أو إنشاء سجل البونص الأسبوعي
 */
async function getOrCreateWeeklyBonus(
  db: ReturnType<typeof import("drizzle-orm/mysql2").drizzle>,
  branchId: number,
  weekNumber: number,
  month: number,
  year: number,
  weekStart: Date,
  weekEnd: Date
): Promise<number> {
  // البحث عن سجل موجود
  const existing = await db
    .select({ id: weeklyBonuses.id })
    .from(weeklyBonuses)
    .where(and(
      eq(weeklyBonuses.branchId, branchId),
      eq(weeklyBonuses.weekNumber, weekNumber),
      eq(weeklyBonuses.month, month),
      eq(weeklyBonuses.year, year)
    ))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  // إنشاء سجل جديد
  const result = await db
    .insert(weeklyBonuses)
    .values({
      branchId,
      weekNumber,
      weekStart,
      weekEnd,
      month,
      year,
      status: "pending",
      totalAmount: "0.00",
    });

  // الحصول على ID السجل الجديد
  const newRecord = await db
    .select({ id: weeklyBonuses.id })
    .from(weeklyBonuses)
    .where(and(
      eq(weeklyBonuses.branchId, branchId),
      eq(weeklyBonuses.weekNumber, weekNumber),
      eq(weeklyBonuses.month, month),
      eq(weeklyBonuses.year, year)
    ))
    .limit(1);

  return newRecord[0].id;
}

/**
 * تحديث أو إنشاء تفاصيل البونص للموظف
 */
async function upsertBonusDetail(
  db: ReturnType<typeof import("drizzle-orm/mysql2").drizzle>,
  weeklyBonusId: number,
  employeeId: number,
  weeklyRevenue: number,
  bonusAmount: number,
  bonusTier: "tier_1" | "tier_2" | "tier_3" | "tier_4" | "tier_5" | "none",
  isEligible: boolean
): Promise<void> {
  // البحث عن تفاصيل موجودة
  const existing = await db
    .select({ id: bonusDetails.id })
    .from(bonusDetails)
    .where(and(
      eq(bonusDetails.weeklyBonusId, weeklyBonusId),
      eq(bonusDetails.employeeId, employeeId)
    ))
    .limit(1);

  if (existing.length > 0) {
    // تحديث السجل الموجود
    await db
      .update(bonusDetails)
      .set({
        weeklyRevenue: weeklyRevenue.toFixed(2),
        bonusAmount: bonusAmount.toFixed(2),
        bonusTier,
        isEligible,
        updatedAt: new Date(),
      })
      .where(eq(bonusDetails.id, existing[0].id));
  } else {
    // إنشاء سجل جديد
    await db
      .insert(bonusDetails)
      .values({
        weeklyBonusId,
        employeeId,
        weeklyRevenue: weeklyRevenue.toFixed(2),
        bonusAmount: bonusAmount.toFixed(2),
        bonusTier,
        isEligible,
      });
  }
}

/**
 * تحديث إجمالي البونص الأسبوعي
 */
async function updateWeeklyBonusTotal(
  db: ReturnType<typeof import("drizzle-orm/mysql2").drizzle>,
  weeklyBonusId: number
): Promise<void> {
  // حساب إجمالي البونص
  const result = await db
    .select({
      total: sql<string>`COALESCE(SUM(${bonusDetails.bonusAmount}), 0)`,
    })
    .from(bonusDetails)
    .where(eq(bonusDetails.weeklyBonusId, weeklyBonusId));

  const totalAmount = result[0]?.total || "0.00";

  // تحديث السجل
  await db
    .update(weeklyBonuses)
    .set({
      totalAmount,
      updatedAt: new Date(),
    })
    .where(eq(weeklyBonuses.id, weeklyBonusId));
}

/**
 * تزامن جميع الموظفين لأسبوع معين
 */
export async function syncWeeklyBonusForBranch(
  branchId: number,
  weekNumber: number,
  month: number,
  year: number
): Promise<{ success: boolean; message: string; data?: { employeeCount: number; totalAmount: number } }> {
  const db = await getDb();
  if (!db) {
    return { success: false, message: "فشل الاتصال بقاعدة البيانات" };
  }

  try {
    const { start, end } = getWeekDateRange(weekNumber, month, year);

    // الحصول على جميع الموظفين النشطين في الفرع
    const branchEmployees = await db
      .select()
      .from(employees)
      .where(and(
        eq(employees.branchId, branchId),
        eq(employees.isActive, true)
      ));

    if (branchEmployees.length === 0) {
      return { success: false, message: "لا يوجد موظفين نشطين في هذا الفرع" };
    }

    // تزامن كل موظف
    for (const employee of branchEmployees) {
      await syncBonusOnRevenueChange(employee.id, branchId, start);
    }

    // الحصول على إجمالي البونص
    const weeklyBonus = await db
      .select()
      .from(weeklyBonuses)
      .where(and(
        eq(weeklyBonuses.branchId, branchId),
        eq(weeklyBonuses.weekNumber, weekNumber),
        eq(weeklyBonuses.month, month),
        eq(weeklyBonuses.year, year)
      ))
      .limit(1);

    // الحصول على اسم الفرع
    const branchData = await db
      .select({ nameAr: branches.nameAr })
      .from(branches)
      .where(eq(branches.id, branchId))
      .limit(1);
    
    const branchName = branchData[0]?.nameAr || 'غير محدد';
    
    // الحصول على تفاصيل البونص للإشعار
    const bonusDetailsList = await db
      .select({
        employeeName: employees.name,
        weeklyRevenue: bonusDetails.weeklyRevenue,
        bonusAmount: bonusDetails.bonusAmount,
        bonusTier: bonusDetails.bonusTier,
      })
      .from(bonusDetails)
      .leftJoin(employees, eq(bonusDetails.employeeId, employees.id))
      .where(eq(bonusDetails.weeklyBonusId, weeklyBonus[0]?.id || 0));
    
    const eligibleCount = bonusDetailsList.filter(d => Number(d.bonusAmount) > 0).length;
    
    // إرسال إشعار البريد الإلكتروني المتقدم
    try {
      // إشعار المالك (الطريقة القديمة)
      await notifyBonusCalculationCompleted({
        branchId,
        branchName,
        weekNumber,
        month,
        year,
        totalAmount: Number(weeklyBonus[0]?.totalAmount || 0),
        eligibleCount,
        totalEmployees: branchEmployees.length,
        details: bonusDetailsList.map(d => ({
          employeeName: d.employeeName || 'غير محدد',
          weeklyRevenue: Number(d.weeklyRevenue || 0),
          bonusAmount: Number(d.bonusAmount || 0),
          bonusTier: d.bonusTier || 'none',
        })),
      });
      
      // إشعار البريد الإلكتروني المتقدم للمشرفين والأدمن
      await emailNotifications.notifyWeeklyBonusReport({
        branchId,
        branchName,
        weekNumber,
        month,
        year,
        totalAmount: Number(weeklyBonus[0]?.totalAmount || 0),
        eligibleCount,
        totalEmployees: branchEmployees.length,
        details: bonusDetailsList.map(d => ({
          employeeName: d.employeeName || 'غير محدد',
          weeklyRevenue: Number(d.weeklyRevenue || 0),
          tier: d.bonusTier || 'none',
          bonusAmount: Number(d.bonusAmount || 0),
          isEligible: Number(d.bonusAmount || 0) > 0,
        })),
      });
      
      console.log(`[Bonus Sync] Email notifications sent for branch ${branchId}`);
    } catch (emailError) {
      console.error('[Bonus Sync] Failed to send email notification:', emailError);
    }
    
    return {
      success: true,
      message: `تم تزامن البونص لـ ${branchEmployees.length} موظف وإرسال الإشعار`,
      data: {
        employeeCount: branchEmployees.length,
        totalAmount: Number(weeklyBonus[0]?.totalAmount || 0),
      },
    };

  } catch (error) {
    console.error("[Bonus Sync] Error:", error);
    return {
      success: false,
      message: `فشل التزامن: ${error instanceof Error ? error.message : "خطأ غير معروف"}`,
    };
  }
}
