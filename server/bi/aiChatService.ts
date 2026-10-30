/**
 * خدمة المحادثة مع AI للتحليلات المالية
 * مستشار أعمال ذكي مع وصول كامل للبيانات
 */

import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { 
  dailyRevenues, employeeRevenues, expenses, employees, branches,
  monthlyRecords
} from "../../drizzle/schema";
import { sql, eq, and, gte, lte, desc, asc } from "drizzle-orm";
import { TOTAL_FIXED_COSTS, FIXED_COSTS_PER_BRANCH, BRANCHES_COUNT, FIXED_COSTS_PER_BRANCH_BREAKDOWN, excludeFixedCostCategories } from "./financialForecastService";
import { expenseCategoryLabel } from "../../shared/expenses";

// ==================== أنواع البيانات ====================

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface BusinessContext {
  currentDate: string;
  branches: { id: number; name: string }[];
  recentRevenue: {
    last7Days: number;
    last30Days: number;
    avgDaily: number;
  };
  recentExpenses: {
    last30Days: number;
    byCategory: { category: string; amount: number }[];
  };
  fixedCosts: {
    total: number;
    perBranch: number;
    breakdown: {
      salaries: number;
      shopRent: number;
      housingRent: number;
      electricity: number;
      internet: number;
    };
  };
  profitability: {
    last30Days: {
      revenue: number;
      variableExpenses: number;
      fixedCosts: number;
      totalExpenses: number;
      profit: number;
      margin: number;
    };
  };
  employeeCount: number;
  topPerformers: { name: string; revenue: number }[];
  alerts: string[];
  // بيانات تفصيلية إضافية
  branchDetails?: {
    id: number;
    name: string;
    revenue7Days: number;
    revenue30Days: number;
    avgDaily: number;
  }[];
  dailyTrend?: {
    date: string;
    revenue: number;
    dayName: string;
  }[];
  employeeDetails?: {
    name: string;
    branch: string;
    revenue30Days: number;
    avgDaily: number;
    workDays: number;
  }[];
}

// ==================== جلب سياق الأعمال ====================

async function getBusinessContext(branchId?: number): Promise<BusinessContext> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const now = new Date();
  const last7Days = new Date(now);
  last7Days.setDate(last7Days.getDate() - 7);
  const last30Days = new Date(now);
  last30Days.setDate(last30Days.getDate() - 30);

  // جلب الفروع
  const allBranches = await db.select({ id: branches.id, name: branches.name }).from(branches);

  // جلب إيرادات آخر 7 أيام
  const [revenue7Days] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${dailyRevenues.total}), 0)`,
    })
    .from(dailyRevenues)
    .where(
      branchId
        ? sql`DATE(${dailyRevenues.date}) >= ${last7Days.toISOString().split('T')[0]} AND ${dailyRevenues.branchId} = ${branchId}`
        : sql`DATE(${dailyRevenues.date}) >= ${last7Days.toISOString().split('T')[0]}`
    );

  // جلب إيرادات آخر 30 يوم
  const [revenue30Days] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${dailyRevenues.total}), 0)`,
      count: sql<number>`COUNT(DISTINCT DATE(${dailyRevenues.date}))`,
    })
    .from(dailyRevenues)
    .where(
      branchId
        ? sql`DATE(${dailyRevenues.date}) >= ${last30Days.toISOString().split('T')[0]} AND ${dailyRevenues.branchId} = ${branchId}`
        : sql`DATE(${dailyRevenues.date}) >= ${last30Days.toISOString().split('T')[0]}`
    );

  const totalRevenue30 = Number(revenue30Days?.total || 0);
  const daysWithRevenue = Number(revenue30Days?.count || 1);
  const avgDaily = daysWithRevenue > 0 ? totalRevenue30 / daysWithRevenue : 0;

  // جلب المصاريف آخر 30 يوم (المتغيرة فقط: الإيجارات والإنترنت والكهرباء والرواتب ضمن التكاليف الثابتة أدناه)
  const expensesByCategory = await db
    .select({
      category: expenses.category,
      total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)`,
    })
    .from(expenses)
    .where(
      and(
        branchId
          ? sql`DATE(${expenses.expenseDate}) >= ${last30Days.toISOString().split('T')[0]} AND ${expenses.branchId} = ${branchId} AND ${expenses.status} IN ('approved', 'paid')`
          : sql`DATE(${expenses.expenseDate}) >= ${last30Days.toISOString().split('T')[0]} AND ${expenses.status} IN ('approved', 'paid')`,
        excludeFixedCostCategories()
      )
    )
    .groupBy(expenses.category);

  const totalExpenses30 = expensesByCategory.reduce((sum, e) => sum + Number(e.total), 0);
  const fixedCosts = branchId ? FIXED_COSTS_PER_BRANCH : TOTAL_FIXED_COSTS;
  const totalCosts = totalExpenses30 + fixedCosts;

  // جلب عدد الموظفين
  const [employeeCountResult] = await db
    .select({
      count: sql<number>`COUNT(*)`,
    })
    .from(employees)
    .where(eq(employees.isActive, true));

  // جلب أفضل الموظفين أداءً
  const topPerformers = await db
    .select({
      name: employees.name,
      revenue: sql<number>`COALESCE(SUM(${employeeRevenues.total}), 0)`,
    })
    .from(employeeRevenues)
    .innerJoin(employees, eq(employeeRevenues.employeeId, employees.id))
    .innerJoin(dailyRevenues, eq(employeeRevenues.dailyRevenueId, dailyRevenues.id))
    .where(
      sql`DATE(${dailyRevenues.date}) >= ${last30Days.toISOString().split('T')[0]}`
    )
    .groupBy(employees.id, employees.name)
    .orderBy(desc(sql`SUM(${employeeRevenues.total})`))
    .limit(5);

  // توليد التنبيهات
  const alerts: string[] = [];
  const profit = totalRevenue30 - totalCosts;
  const margin = totalRevenue30 > 0 ? (profit / totalRevenue30) * 100 : 0;

  if (margin < 10) {
    alerts.push('⚠️ هامش الربح منخفض جداً (أقل من 10%)');
  }
  if (profit < 0) {
    alerts.push('🔴 المشروع يحقق خسائر في آخر 30 يوم');
  }
  if (avgDaily < fixedCosts / 30) {
    alerts.push('⚠️ المتوسط اليومي أقل من التكاليف الثابتة اليومية');
  }

  // جلب بيانات تفصيلية للفروع
  const branchDetails = await Promise.all(
    allBranches.map(async (branch) => {
      const [rev7] = await db
        .select({ total: sql<number>`COALESCE(SUM(${dailyRevenues.total}), 0)` })
        .from(dailyRevenues)
        .where(sql`DATE(${dailyRevenues.date}) >= ${last7Days.toISOString().split('T')[0]} AND ${dailyRevenues.branchId} = ${branch.id}`);
      
      const [rev30] = await db
        .select({ 
          total: sql<number>`COALESCE(SUM(${dailyRevenues.total}), 0)`,
          count: sql<number>`COUNT(DISTINCT DATE(${dailyRevenues.date}))`
        })
        .from(dailyRevenues)
        .where(sql`DATE(${dailyRevenues.date}) >= ${last30Days.toISOString().split('T')[0]} AND ${dailyRevenues.branchId} = ${branch.id}`);
      
      const total30 = Number(rev30?.total || 0);
      const days = Number(rev30?.count || 1);
      
      return {
        id: branch.id,
        name: branch.name,
        revenue7Days: Math.round(Number(rev7?.total || 0)),
        revenue30Days: Math.round(total30),
        avgDaily: Math.round(days > 0 ? total30 / days : 0),
      };
    })
  );

  // جلب الاتجاه اليومي (آخر 7 أيام)
  const dailyTrendData = await db
    .select({
      date: dailyRevenues.date,
      total: sql<number>`COALESCE(SUM(${dailyRevenues.total}), 0)`,
    })
    .from(dailyRevenues)
    .where(
      branchId
        ? sql`DATE(${dailyRevenues.date}) >= ${last7Days.toISOString().split('T')[0]} AND ${dailyRevenues.branchId} = ${branchId}`
        : sql`DATE(${dailyRevenues.date}) >= ${last7Days.toISOString().split('T')[0]}`
    )
    .groupBy(dailyRevenues.date)
    .orderBy(asc(dailyRevenues.date));

  const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const dailyTrend = dailyTrendData.map(d => {
    const date = new Date(d.date);
    return {
      date: date.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' }),
      revenue: Math.round(Number(d.total)),
      dayName: dayNames[date.getDay()],
    };
  });

  // جلب تفاصيل الموظفين
  const employeeDetailsData = await db
    .select({
      name: employees.name,
      branchId: employees.branchId,
      total: sql<number>`COALESCE(SUM(${employeeRevenues.total}), 0)`,
      workDays: sql<number>`COUNT(DISTINCT DATE(${dailyRevenues.date}))`,
    })
    .from(employeeRevenues)
    .innerJoin(employees, eq(employeeRevenues.employeeId, employees.id))
    .innerJoin(dailyRevenues, eq(employeeRevenues.dailyRevenueId, dailyRevenues.id))
    .where(sql`DATE(${dailyRevenues.date}) >= ${last30Days.toISOString().split('T')[0]}`)
    .groupBy(employees.id, employees.name, employees.branchId)
    .orderBy(desc(sql`SUM(${employeeRevenues.total})`));

  const branchMap = new Map(allBranches.map(b => [b.id, b.name]));
  const employeeDetails = employeeDetailsData.map(e => {
    const total = Number(e.total);
    const days = Number(e.workDays) || 1;
    return {
      name: e.name,
      branch: branchMap.get(e.branchId) || 'غير محدد',
      revenue30Days: Math.round(total),
      avgDaily: Math.round(total / days),
      workDays: days,
    };
  });

  return {
    currentDate: now.toLocaleDateString('ar-SA', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }),
    branches: allBranches,
    recentRevenue: {
      last7Days: Math.round(Number(revenue7Days?.total || 0)),
      last30Days: Math.round(totalRevenue30),
      avgDaily: Math.round(avgDaily),
    },
    recentExpenses: {
      last30Days: Math.round(totalExpenses30),
      byCategory: expensesByCategory.map(e => ({
        category: getCategoryName(e.category),
        amount: Math.round(Number(e.total)),
      })),
    },
    fixedCosts: {
      total: fixedCosts,
      perBranch: FIXED_COSTS_PER_BRANCH,
      breakdown: FIXED_COSTS_PER_BRANCH_BREAKDOWN,
    },
    profitability: {
      last30Days: {
        revenue: Math.round(totalRevenue30),
        variableExpenses: Math.round(totalExpenses30),
        fixedCosts: fixedCosts,
        totalExpenses: Math.round(totalCosts),
        profit: Math.round(profit),
        margin: Math.round(margin * 10) / 10,
      },
    },
    employeeCount: Number(employeeCountResult?.count || 0),
    topPerformers: topPerformers.map(p => ({
      name: p.name,
      revenue: Math.round(Number(p.revenue)),
    })),
    alerts,
    branchDetails,
    dailyTrend,
    employeeDetails,
  };
}

// ==================== ترجمة أسماء الفئات ====================

// الأسماء من المصدر المشترك (نفس أسماء صفحة المصاريف)
function getCategoryName(category: string): string {
  return expenseCategoryLabel(category);
}

// ==================== البرومبت الأساسي ====================

function getSystemPrompt(context: BusinessContext, userName?: string): string {
  const userGreeting = userName ? `أنت تتحدث مع ${userName}. استخدم اسمه في الردود لتكون أكثر شخصية.` : '';
  
  return `أنت Symbol AI - مستشار أعمال ذكي متقدم متخصص في تحليل البيانات المالية والتشغيلية.
اسمك "Symbol AI" وعند التعريف بنفسك قل "أنا Symbol AI".
${userGreeting}

أنت خبير في:
- تحليل الإيرادات والمصاريف بعمق
- التنبؤ المالي والتخطيط الاستراتيجي
- تحليل أداء الموظفين والفروع
- تحسين الكفاءة التشغيلية وخفض التكاليف
- إدارة المخاطر المالية والتدفق النقدي

## شخصيتك كـ Symbol AI:
- محترف وعلمي في التحليل
- عملي ومباشر في التوصيات
- صريح وشفاف في تحديد المشاكل
- إيجابي وبنّاء في تقديم الحلول
- تستخدم الأرقام والبيانات الحقيقية لدعم تحليلاتك
- تقدم رؤى مبنية على البيانات لا التخمين
- تبادر بطرح الأسئلة لفهم احتياجات المستخدم بشكل أفضل

## أسلوب التفاعل:
- عندما يسأل المستخدم سؤالاً عاماً، اطرح أسئلة توضيحية لفهم السياق بشكل أفضل
- بعد تقديم التحليل، اسأل إذا كان المستخدم يريد التعمق في جانب معين
- اقترح مواضيع ذات صلة قد تهم المستخدم
- استخدم اسم المستخدم في الردود لتكون أكثر شخصية وودية

## السياق الحالي للمشروع:
- التاريخ: ${context.currentDate}
- عدد الفروع: ${context.branches.length} (${context.branches.map(b => b.name).join('، ')})
- عدد الموظفين: ${context.employeeCount}

## البيانات المالية (آخر 30 يوم):
- إجمالي الإيرادات: ${context.recentRevenue.last30Days.toLocaleString('ar-SA')} ر.س
- إيرادات آخر 7 أيام: ${context.recentRevenue.last7Days.toLocaleString('ar-SA')} ر.س
- المتوسط اليومي: ${context.recentRevenue.avgDaily.toLocaleString('ar-SA')} ر.س

## المصاريف المتغيرة (المسجلة فعلياً في النظام - آخر 30 يوم):
- إجمالي المصاريف المتغيرة: ${context.recentExpenses.last30Days.toLocaleString('ar-SA')} ر.س
- تفصيل المصاريف حسب الفئة:
${context.recentExpenses.byCategory.map(e => `  • ${e.category}: ${e.amount.toLocaleString('ar-SA')} ر.س`).join('\n')}

## التكاليف الثابتة الشهرية (تقديرية):
- إجمالي التكاليف الثابتة: ${context.fixedCosts.total.toLocaleString('ar-SA')} ر.س
- تفصيل التكاليف الثابتة لكل فرع (${context.fixedCosts.perBranch.toLocaleString('ar-SA')} ر.س):
  • رواتب: ${context.fixedCosts.breakdown.salaries.toLocaleString('ar-SA')} ر.س
  • إيجار المحل: ${context.fixedCosts.breakdown.shopRent.toLocaleString('ar-SA')} ر.س
  • إيجار السكن: ${context.fixedCosts.breakdown.housingRent.toLocaleString('ar-SA')} ر.س
  • كهرباء: ${context.fixedCosts.breakdown.electricity.toLocaleString('ar-SA')} ر.س
  • إنترنت: ${context.fixedCosts.breakdown.internet.toLocaleString('ar-SA')} ر.س

## ملخص الربحية (آخر 30 يوم):
- الإيرادات: ${context.profitability.last30Days.revenue.toLocaleString('ar-SA')} ر.س
- المصاريف المتغيرة (من البيانات المالية): ${context.profitability.last30Days.variableExpenses.toLocaleString('ar-SA')} ر.س
- التكاليف الثابتة (تقديرية): ${context.profitability.last30Days.fixedCosts.toLocaleString('ar-SA')} ر.س
- إجمالي التكاليف: ${context.profitability.last30Days.totalExpenses.toLocaleString('ar-SA')} ر.س
- صافي الربح: ${context.profitability.last30Days.profit.toLocaleString('ar-SA')} ر.س
- هامش الربح: ${context.profitability.last30Days.margin}%

**ملاحظة هامة:** المصاريف المتغيرة هي المصاريف المسجلة فعلياً في صفحة المصاريف، بينما التكاليف الثابتة هي تقديرات شهرية للرواتب والإيجارات والمرافق

## أفضل الموظفين أداءً:
${context.topPerformers.map((p, i) => `${i + 1}. ${p.name}: ${p.revenue.toLocaleString('ar-SA')} ر.س`).join('\n')}

## التنبيهات الحالية:
${context.alerts.length > 0 ? context.alerts.join('\n') : 'لا توجد تنبيهات'}

## بيانات الفروع التفصيلية:
${context.branchDetails?.map(b => `- ${b.name}: إيرادات 7 أيام: ${b.revenue7Days.toLocaleString('ar-SA')} ر.س | 30 يوم: ${b.revenue30Days.toLocaleString('ar-SA')} ر.س | متوسط يومي: ${b.avgDaily.toLocaleString('ar-SA')} ر.س`).join('\n') || 'لا توجد بيانات'}

## الاتجاه اليومي (آخر 7 أيام):
${context.dailyTrend?.map(d => `- ${d.dayName} (${d.date}): ${d.revenue.toLocaleString('ar-SA')} ر.س`).join('\n') || 'لا توجد بيانات'}

## تفاصيل الموظفين (آخر 30 يوم):
${context.employeeDetails?.slice(0, 10).map((e, i) => `${i + 1}. ${e.name} (${e.branch}): ${e.revenue30Days.toLocaleString('ar-SA')} ر.س | متوسط: ${e.avgDaily.toLocaleString('ar-SA')} ر.س/يوم | ${e.workDays} يوم عمل`).join('\n') || 'لا توجد بيانات'}

## قواعد الرد:
1. استخدم البيانات المتاحة لدعم تحليلاتك
2. قدم توصيات عملية وقابلة للتنفيذ
3. كن صريحاً في تحديد المشاكل
4. استخدم الأرقام والنسب المئوية
5. اقترح خطوات محددة للتحسين
6. إذا سُئلت عن بيانات غير متاحة، اعترف بذلك واقترح بدائل
7. استخدم التنسيق المناسب (عناوين، قوائم، جداول) لتسهيل القراءة
8. أجب باللغة العربية دائماً`;
}

// ==================== المحادثة مع AI ====================

export async function chatWithAI(
  message: string,
  conversationHistory: ChatMessage[] = [],
  branchId?: number,
  userName?: string
): Promise<{ response: string; context: BusinessContext }> {
  // جلب سياق الأعمال الحالي
  const context = await getBusinessContext(branchId);
  
  // بناء الرسائل
  const messages: ChatMessage[] = [
    { role: 'system', content: getSystemPrompt(context, userName) },
    ...conversationHistory.slice(-10), // آخر 10 رسائل فقط
    { role: 'user', content: message },
  ];

  try {
    const response = await invokeLLM({
      messages: messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
      temperature: 0.2, // تحليل دقيق ومنطقي
    });

    const assistantMessage = response.choices[0]?.message?.content || 'عذراً، لم أتمكن من معالجة طلبك.';

    return {
      response: typeof assistantMessage === 'string' ? assistantMessage : JSON.stringify(assistantMessage),
      context,
    };
  } catch (error) {
    console.error('AI Chat Error:', error);
    return {
      response: 'عذراً، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.',
      context,
    };
  }
}

// ==================== رسالة الترحيب ====================

export function getWelcomeMessage(): string {
  return `مرحباً! أنا **Symbol AI** - مستشارك الذكي لتحليل الأعمال. 👋

قبل أن نبدأ، أود التعرف عليك:

**ما اسمك؟**

هذا سيساعدني في تخصيص التحليلات والتوصيات بشكل أفضل لك.`;
}

// ==================== أسئلة مقترحة ====================

export function getSuggestedQuestions(): string[] {
  return [
    'ما هو تحليلك للوضع المالي الحالي؟',
    'كيف يمكنني تحسين هامش الربح؟',
    'ما هي أكبر التحديات التي تواجه المشروع؟',
    'قارن أداء الفروع المختلفة',
    'ما هي توقعاتك للشهر القادم؟',
    'كيف يمكنني تقليل المصاريف؟',
    'من هم أفضل الموظفين وكيف يمكن تحفيزهم؟',
    'ما هي الفرص المتاحة للنمو؟',
  ];
}
