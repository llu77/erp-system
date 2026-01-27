/**
 * أدوات المشرف للمساعد الذكي
 * 
 * صلاحيات المشرف:
 * 1. عرض قائمة موظفي فرعه فقط
 * 2. عرض إيرادات الفرع الإجمالية
 * 3. عرض إيرادات أي موظف في الفرع
 * 4. ترتيب الموظفين حسب الإيرادات
 * 5. تحليل أداء موظف وتقديم نصائح
 * 
 * ⚠️ المشرف لا يمكنه الوصول لبيانات فروع أخرى
 */

import { getDb } from "../db";
import { 
  employees, 
  branches, 
  dailyRevenues,
  employeeRevenues,
  weeklyBonuses,
  bonusDetails
} from "../../drizzle/schema";
import { eq, and, gte, lte, desc, sql, sum } from "drizzle-orm";
import { getPerformanceAlertsForSupervisor } from "../notifications/performanceAlerts";

// ========== أنواع النتائج ==========
export interface SupervisorToolResult {
  success: boolean;
  hasData: boolean;
  dataCount: number;
  data?: any;
  error?: string;
  message: string;
  source?: string;
  period?: {
    start: string;
    end: string;
  };
}

// دالة مساعدة لإنشاء نتيجة فارغة
function noDataResult(message: string, period?: { start: string; end: string }): SupervisorToolResult {
  return {
    success: true,
    hasData: false,
    dataCount: 0,
    message,
    period
  };
}

// دالة مساعدة لإنشاء نتيجة خطأ
function errorResult(error: string): SupervisorToolResult {
  return {
    success: false,
    hasData: false,
    dataCount: 0,
    error,
    message: error
  };
}

// ========== حساب الفترات الزمنية ==========
function calculatePeriod(period?: string): { startDate: Date; endDate: Date; periodName: string } {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = now;
  let periodName: string;

  switch (period) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      periodName = 'اليوم';
      break;
    case 'week':
      const dayOfWeek = now.getDay();
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
      periodName = 'هذا الأسبوع';
      break;
    case 'last_week':
      const lastWeekDayOfWeek = now.getDay();
      const lastWeekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - lastWeekDayOfWeek - 1);
      const lastWeekStart = new Date(lastWeekEnd.getFullYear(), lastWeekEnd.getMonth(), lastWeekEnd.getDate() - 6);
      startDate = lastWeekStart;
      endDate = lastWeekEnd;
      periodName = 'الأسبوع الماضي';
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      periodName = 'هذا الشهر';
      break;
    case 'last_month':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      periodName = 'الشهر الماضي';
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      periodName = 'هذا الشهر';
  }

  return { startDate, endDate, periodName };
}

// ========== أداة 1: جلب قائمة موظفي الفرع ==========
export async function getBranchEmployees(branchId: number): Promise<SupervisorToolResult> {
  try {
    const db = await getDb();
    if (!db) {
      return errorResult('قاعدة البيانات غير متاحة');
    }

    const branchEmployees = await db.select({
      id: employees.id,
      name: employees.name,
      code: employees.code,
      phone: employees.phone,
      position: employees.position,
      isActive: employees.isActive,

    })
    .from(employees)
    .where(and(
      eq(employees.branchId, branchId),
      eq(employees.isActive, true)
    ))
    .orderBy(employees.name);

    if (branchEmployees.length === 0) {
      return noDataResult('لا يوجد موظفين في هذا الفرع');
    }

    // جلب اسم الفرع
    const branch = await db.select({ name: branches.name }).from(branches).where(eq(branches.id, branchId)).limit(1);
    const branchName = branch[0]?.name || 'غير محدد';

    const employeeList = branchEmployees.map((emp: any, index: number) => 
      `${index + 1}. ${emp.name} (${emp.code}) - ${emp.position || 'موظف'}${emp.isSupervisor ? ' 👑' : ''}`
    ).join('\n');

    return {
      success: true,
      hasData: true,
      dataCount: branchEmployees.length,
      data: branchEmployees,
      message: `📋 موظفي فرع ${branchName}:\n\n${employeeList}\n\n📊 إجمالي الموظفين: ${branchEmployees.length}`,
      source: 'جدول الموظفين'
    };
  } catch (error) {
    return errorResult(`حدث خطأ: ${error}`);
  }
}

// ========== أداة 2: جلب إيرادات الفرع الإجمالية ==========
export async function getBranchRevenue(branchId: number, period?: string): Promise<SupervisorToolResult> {
  try {
    const db = await getDb();
    if (!db) {
      return errorResult('قاعدة البيانات غير متاحة');
    }

    const { startDate, endDate, periodName } = calculatePeriod(period);

    // جلب اسم الفرع
    const branch = await db.select({ name: branches.name }).from(branches).where(eq(branches.id, branchId)).limit(1);
    const branchName = branch[0]?.name || 'غير محدد';

    // جلب إيرادات الفرع
    const revenues = await db.select({
      date: dailyRevenues.date,
      total: dailyRevenues.total,

    })
    .from(dailyRevenues)
    .where(and(
      eq(dailyRevenues.branchId, branchId),
      gte(dailyRevenues.date, startDate),
      lte(dailyRevenues.date, endDate)
    ))
    .orderBy(desc(dailyRevenues.date));

    if (revenues.length === 0) {
      return noDataResult(`لا توجد إيرادات مسجلة لفرع ${branchName} في ${periodName}`, {
        start: startDate.toLocaleDateString('ar-SA'),
        end: endDate.toLocaleDateString('ar-SA')
      });
    }

    const totalRevenue = revenues.reduce((sum: number, r: any) => sum + Number(r.total || 0), 0);
    const avgDaily = totalRevenue / revenues.length;
    const daysCount = revenues.length;

    return {
      success: true,
      hasData: true,
      dataCount: revenues.length,
      data: { totalRevenue, avgDaily, daysCount, revenues },
      message: `📊 إيرادات فرع ${branchName} (${periodName}):\n\n💰 الإجمالي: ${totalRevenue.toLocaleString()} ر.س\n📅 عدد الأيام: ${daysCount}\n📈 المتوسط اليومي: ${avgDaily.toLocaleString(undefined, { maximumFractionDigits: 0 })} ر.س`,
      source: 'جدول الإيرادات اليومية',
      period: {
        start: startDate.toLocaleDateString('ar-SA'),
        end: endDate.toLocaleDateString('ar-SA')
      }
    };
  } catch (error) {
    return errorResult(`حدث خطأ: ${error}`);
  }
}

// ========== أداة 3: جلب إيرادات موظف معين (للمشرف) ==========
export async function getEmployeeRevenueForSupervisor(
  supervisorBranchId: number, 
  employeeId: number, 
  period?: string
): Promise<SupervisorToolResult> {
  try {
    const db = await getDb();
    if (!db) {
      return errorResult('قاعدة البيانات غير متاحة');
    }

    // التحقق من أن الموظف ينتمي لنفس فرع المشرف
    const employee = await db.select({
      id: employees.id,
      name: employees.name,
      branchId: employees.branchId,
      branchName: branches.name,
    })
    .from(employees)
    .leftJoin(branches, eq(employees.branchId, branches.id))
    .where(eq(employees.id, employeeId))
    .limit(1);

    if (employee.length === 0) {
      return errorResult('الموظف غير موجود');
    }

    const emp = employee[0];
    
    // التحقق من أن الموظف في نفس الفرع
    if (emp.branchId !== supervisorBranchId) {
      return errorResult('⛔ لا يمكنك الوصول لبيانات موظف من فرع آخر');
    }

    const { startDate, endDate, periodName } = calculatePeriod(period);

    // جلب إيرادات الموظف
    const revenues = await db.select({
      total: employeeRevenues.total,
      date: dailyRevenues.date,
    })
    .from(employeeRevenues)
    .innerJoin(dailyRevenues, eq(employeeRevenues.dailyRevenueId, dailyRevenues.id))
    .where(and(
      eq(employeeRevenues.employeeId, employeeId),
      gte(dailyRevenues.date, startDate),
      lte(dailyRevenues.date, endDate)
    ))
    .orderBy(desc(dailyRevenues.date));

    if (revenues.length === 0) {
      return noDataResult(`لا توجد إيرادات مسجلة للموظف ${emp.name} في ${periodName}`, {
        start: startDate.toLocaleDateString('ar-SA'),
        end: endDate.toLocaleDateString('ar-SA')
      });
    }

    const totalRevenue = revenues.reduce((sum: number, r: any) => sum + Number(r.total || 0), 0);
    const avgDaily = totalRevenue / revenues.length;
    const daysCount = revenues.length;

    return {
      success: true,
      hasData: true,
      dataCount: revenues.length,
      data: { employee: emp, totalRevenue, avgDaily, daysCount },
      message: `📊 إيرادات الموظف ${emp.name} (${periodName}):\n\n💰 الإجمالي: ${totalRevenue.toLocaleString()} ر.س\n📅 أيام العمل: ${daysCount}\n📈 المتوسط اليومي: ${avgDaily.toLocaleString(undefined, { maximumFractionDigits: 0 })} ر.س`,
      source: 'جدول إيرادات الموظفين',
      period: {
        start: startDate.toLocaleDateString('ar-SA'),
        end: endDate.toLocaleDateString('ar-SA')
      }
    };
  } catch (error) {
    return errorResult(`حدث خطأ: ${error}`);
  }
}

// ========== أداة 4: ترتيب موظفي الفرع حسب الإيرادات ==========
export async function getBranchEmployeesRanking(branchId: number, period?: string): Promise<SupervisorToolResult> {
  try {
    const db = await getDb();
    if (!db) {
      return errorResult('قاعدة البيانات غير متاحة');
    }

    const { startDate, endDate, periodName } = calculatePeriod(period);

    // جلب اسم الفرع
    const branch = await db.select({ name: branches.name }).from(branches).where(eq(branches.id, branchId)).limit(1);
    const branchName = branch[0]?.name || 'غير محدد';

    // جلب موظفي الفرع مع إيراداتهم
    const employeesWithRevenue = await db.select({
      employeeId: employees.id,
      employeeName: employees.name,
      totalRevenue: sql<number>`COALESCE(SUM(${employeeRevenues.total}), 0)`.as('totalRevenue'),
    })
    .from(employees)
    .leftJoin(employeeRevenues, eq(employees.id, employeeRevenues.employeeId))
    .leftJoin(dailyRevenues, eq(employeeRevenues.dailyRevenueId, dailyRevenues.id))
    .where(and(
      eq(employees.branchId, branchId),
      eq(employees.isActive, true)
    ))
    .groupBy(employees.id, employees.name)
    .orderBy(desc(sql`totalRevenue`));

    if (employeesWithRevenue.length === 0) {
      return noDataResult('لا يوجد موظفين في هذا الفرع');
    }

    // ترتيب الموظفين
    const ranking = employeesWithRevenue.map((emp: any, index: number) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      return `${medal} ${emp.employeeName}: ${Number(emp.totalRevenue).toLocaleString()} ر.س`;
    }).join('\n');

    const totalBranchRevenue = employeesWithRevenue.reduce((sum: number, emp: any) => sum + Number(emp.totalRevenue || 0), 0);

    return {
      success: true,
      hasData: true,
      dataCount: employeesWithRevenue.length,
      data: employeesWithRevenue,
      message: `🏆 ترتيب موظفي فرع ${branchName} (${periodName}):\n\n${ranking}\n\n━━━━━━━━━━━━\n💰 إجمالي الفرع: ${totalBranchRevenue.toLocaleString()} ر.س`,
      source: 'جدول إيرادات الموظفين',
      period: {
        start: startDate.toLocaleDateString('ar-SA'),
        end: endDate.toLocaleDateString('ar-SA')
      }
    };
  } catch (error) {
    return errorResult(`حدث خطأ: ${error}`);
  }
}

// ========== أداة 5: تحليل أداء موظف وتقديم نصائح ==========
export async function analyzeEmployeePerformance(
  supervisorBranchId: number, 
  employeeId: number
): Promise<SupervisorToolResult> {
  try {
    const db = await getDb();
    if (!db) {
      return errorResult('قاعدة البيانات غير متاحة');
    }

    // التحقق من أن الموظف ينتمي لنفس فرع المشرف
    const employee = await db.select({
      id: employees.id,
      name: employees.name,
      branchId: employees.branchId,
      position: employees.position,
    })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);

    if (employee.length === 0) {
      return errorResult('الموظف غير موجود');
    }

    const emp = employee[0];
    
    if (emp.branchId !== supervisorBranchId) {
      return errorResult('⛔ لا يمكنك تحليل أداء موظف من فرع آخر');
    }

    const now = new Date();
    
    // جلب إيرادات الشهر الحالي
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthRevenues = await db.select({
      total: employeeRevenues.total,
      date: dailyRevenues.date,
    })
    .from(employeeRevenues)
    .innerJoin(dailyRevenues, eq(employeeRevenues.dailyRevenueId, dailyRevenues.id))
    .where(and(
      eq(employeeRevenues.employeeId, employeeId),
      gte(dailyRevenues.date, monthStart),
      lte(dailyRevenues.date, now)
    ))
    .orderBy(desc(dailyRevenues.date));

    // جلب إيرادات الشهر الماضي للمقارنة
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const lastMonthRevenues = await db.select({
      total: employeeRevenues.total,
    })
    .from(employeeRevenues)
    .innerJoin(dailyRevenues, eq(employeeRevenues.dailyRevenueId, dailyRevenues.id))
    .where(and(
      eq(employeeRevenues.employeeId, employeeId),
      gte(dailyRevenues.date, lastMonthStart),
      lte(dailyRevenues.date, lastMonthEnd)
    ));

    // جلب البونص
    const bonuses = await db.select({
      amount: bonusDetails.bonusAmount,
      weekStart: weeklyBonuses.weekStart,
    })
    .from(bonusDetails)
    .innerJoin(weeklyBonuses, eq(bonusDetails.weeklyBonusId, weeklyBonuses.id))
    .where(eq(bonusDetails.employeeId, employeeId))
    .orderBy(desc(weeklyBonuses.weekStart))
    .limit(4);

    // حساب الإحصائيات
    const currentMonthTotal = currentMonthRevenues.reduce((sum: number, r: any) => sum + Number(r.total || 0), 0);
    const lastMonthTotal = lastMonthRevenues.reduce((sum: number, r: any) => sum + Number(r.total || 0), 0);
    const currentMonthDays = currentMonthRevenues.length;
    const avgDaily = currentMonthDays > 0 ? currentMonthTotal / currentMonthDays : 0;
    const totalBonuses = bonuses.reduce((sum: number, b: any) => sum + Number(b.amount || 0), 0);

    // حساب نسبة التغيير
    let changePercent = 0;
    let changeDirection = '';
    if (lastMonthTotal > 0) {
      changePercent = ((currentMonthTotal - lastMonthTotal) / lastMonthTotal) * 100;
      changeDirection = changePercent >= 0 ? '📈 تحسن' : '📉 تراجع';
    }

    // تحليل الأداء وتقديم نصائح
    let performanceLevel = '';
    let advice = '';

    if (avgDaily >= 3000) {
      performanceLevel = '⭐⭐⭐⭐⭐ ممتاز';
      advice = 'أداء متميز! حافظ على هذا المستوى وشارك خبرتك مع زملائك.';
    } else if (avgDaily >= 2000) {
      performanceLevel = '⭐⭐⭐⭐ جيد جداً';
      advice = 'أداء جيد جداً! حاول زيادة التركيز على الخدمات ذات القيمة العالية.';
    } else if (avgDaily >= 1500) {
      performanceLevel = '⭐⭐⭐ جيد';
      advice = 'أداء جيد. يمكنك تحسينه بزيادة عدد العملاء أو تقديم خدمات إضافية.';
    } else if (avgDaily >= 1000) {
      performanceLevel = '⭐⭐ مقبول';
      advice = 'هناك مجال للتحسين. حاول التركيز على جودة الخدمة وسرعة الإنجاز.';
    } else {
      performanceLevel = '⭐ يحتاج تحسين';
      advice = 'يحتاج إلى متابعة ودعم. تحدث مع الموظف لفهم التحديات ومساعدته.';
    }

    return {
      success: true,
      hasData: true,
      dataCount: 1,
      data: {
        employee: emp,
        currentMonthTotal,
        lastMonthTotal,
        changePercent,
        avgDaily,
        totalBonuses,
        performanceLevel
      },
      message: `📊 تحليل أداء الموظف ${emp.name}:\n\n📅 الشهر الحالي:\n💰 الإيرادات: ${currentMonthTotal.toLocaleString()} ر.س\n📝 أيام العمل: ${currentMonthDays}\n📈 المتوسط اليومي: ${avgDaily.toLocaleString(undefined, { maximumFractionDigits: 0 })} ر.س\n\n📅 مقارنة بالشهر الماضي:\n💰 الشهر الماضي: ${lastMonthTotal.toLocaleString()} ر.س\n${changeDirection}: ${Math.abs(changePercent).toFixed(1)}%\n\n🎯 البونص (آخر 4 أسابيع): ${totalBonuses.toLocaleString()} ر.س\n\n━━━━━━━━━━━━\n📊 تقييم الأداء: ${performanceLevel}\n\n💡 التوصية:\n${advice}`,
      source: 'تحليل شامل'
    };
  } catch (error) {
    return errorResult(`حدث خطأ: ${error}`);
  }
}

// ========== تعريف أدوات المشرف للـ LLM ==========
export const supervisorTools = [
  {
    type: "function" as const,
    function: {
      name: "get_branch_employees",
      description: "جلب قائمة موظفي الفرع. متاح للمشرف فقط.",
      parameters: {
        type: "object",
        properties: {
          branchId: {
            type: "number",
            description: "رقم الفرع"
          }
        },
        required: ["branchId"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_branch_revenue",
      description: "جلب إيرادات الفرع الإجمالية. متاح للمشرف فقط.",
      parameters: {
        type: "object",
        properties: {
          branchId: {
            type: "number",
            description: "رقم الفرع"
          },
          period: {
            type: "string",
            enum: ["today", "week", "last_week", "month", "last_month"],
            description: "الفترة الزمنية"
          }
        },
        required: ["branchId"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_employee_revenue_supervisor",
      description: "جلب إيرادات موظف معين في الفرع. متاح للمشرف فقط.",
      parameters: {
        type: "object",
        properties: {
          supervisorBranchId: {
            type: "number",
            description: "رقم فرع المشرف"
          },
          employeeId: {
            type: "number",
            description: "رقم الموظف"
          },
          period: {
            type: "string",
            enum: ["today", "week", "last_week", "month", "last_month"],
            description: "الفترة الزمنية"
          }
        },
        required: ["supervisorBranchId", "employeeId"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_branch_employees_ranking",
      description: "جلب ترتيب موظفي الفرع حسب الإيرادات. متاح للمشرف فقط.",
      parameters: {
        type: "object",
        properties: {
          branchId: {
            type: "number",
            description: "رقم الفرع"
          },
          period: {
            type: "string",
            enum: ["today", "week", "last_week", "month", "last_month"],
            description: "الفترة الزمنية"
          }
        },
        required: ["branchId"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "analyze_employee_performance",
      description: "تحليل أداء موظف وتقديم نصائح. متاح للمشرف فقط.",
      parameters: {
        type: "object",
        properties: {
          supervisorBranchId: {
            type: "number",
            description: "رقم فرع المشرف"
          },
          employeeId: {
            type: "number",
            description: "رقم الموظف"
          }
        },
        required: ["supervisorBranchId", "employeeId"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_performance_alerts",
      description: "جلب تنبيهات تراجع أداء الموظفين في الفرع. يعرض الموظفين الذين تراجع أداؤهم بنسبة 30% أو أكثر مقارنة بالأسبوع السابق. متاح للمشرف فقط.",
      parameters: {
        type: "object",
        properties: {
          supervisorId: {
            type: "number",
            description: "رقم المشرف"
          },
          branchId: {
            type: "number",
            description: "رقم الفرع"
          }
        },
        required: ["supervisorId", "branchId"]
      }
    }
  }
];

// ========== تنفيذ أداة المشرف ==========
export async function executeSupervisorTool(toolName: string, args: any): Promise<SupervisorToolResult> {
  switch (toolName) {
    case 'get_branch_employees':
      return getBranchEmployees(args.branchId);
    
    case 'get_branch_revenue':
      return getBranchRevenue(args.branchId, args.period);
    
    case 'get_employee_revenue_supervisor':
      return getEmployeeRevenueForSupervisor(args.supervisorBranchId, args.employeeId, args.period);
    
    case 'get_branch_employees_ranking':
      return getBranchEmployeesRanking(args.branchId, args.period);
    
    case 'analyze_employee_performance':
      return analyzeEmployeePerformance(args.supervisorBranchId, args.employeeId);
    
    case 'get_performance_alerts':
      return getPerformanceAlerts(args.supervisorId, args.branchId);
    
    default:
      return errorResult(`أداة غير معروفة: ${toolName}`);
  }
}

// ========== جلب تنبيهات تراجع الأداء ==========
async function getPerformanceAlerts(supervisorId: number, branchId: number): Promise<SupervisorToolResult> {
  try {
    const alerts = await getPerformanceAlertsForSupervisor(supervisorId, branchId);
    
    return {
      success: true,
      hasData: alerts.hasAlerts,
      dataCount: alerts.declinedEmployees.length,
      data: alerts.declinedEmployees,
      message: alerts.summary,
      source: 'تحليل الأداء الأسبوعي'
    };
  } catch (error) {
    return errorResult(`حدث خطأ: ${error}`);
  }
}
