/**
 * الأرقام المالية الشهرية للفرع: مصدر واحد للربح والخسارة وأرباح الشركاء
 * - الإيرادات: النقدي + الشبكة من الإيرادات اليومية
 * - المصاريف: المعتمدة والمدفوعة بتاريخ المصروف (الثابتة الشهرية + اليدوية)، بدون صفوف المسير
 * - الرواتب: مسيرات الشهر المعتمدة والمدفوعة = صافي المسير + السلف المستردة فيه
 *   (من جدول المسيرات نفسه، فلا تتكرر مع صف المصروف التلقائي للمسير)
 * - الربح = الإيرادات - (المصاريف + الرواتب)
 */

import { and, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import { getDb } from "../db";
import { dailyRevenues, expenses, payrollDetails, payrolls } from "../../drizzle/schema";
import { expenseCategoryLabel, payrollExpenseAmount, utcMonthRange } from "../../shared/expenses";
import { roundMoney } from "../../shared/vouchers";

/** حالات المصروف المحسوبة في الأرقام المالية */
export const COUNTED_EXPENSE_STATUSES = ["approved", "paid"] as const;
/** حالات المسير المحسوبة كتكلفة رواتب */
export const COUNTED_PAYROLL_STATUSES = ["approved", "paid"] as const;

export interface BranchMonthlyFinancials {
  year: number;
  month: number;
  /** null = كل الفروع */
  branchId: number | null;
  revenue: { cash: number; network: number; total: number; days: number };
  expenses: {
    /** المصاريف بدون صفوف المسير (الثابتة + اليدوية) */
    total: number;
    fixed: number;
    other: number;
    byCategory: Array<{ category: string; label: string; amount: number }>;
  };
  payroll: { count: number; netSalary: number; recoveredAdvances: number; cost: number };
  /** المصاريف + تكلفة الرواتب */
  totalCosts: number;
  profit: number;
}

export interface BranchFinancialsRaw {
  revenue: { cash: unknown; network: unknown; days: unknown };
  expenseRows: Array<{ category: string | null; source: string | null; amount: unknown }>;
  payroll: { count: unknown; netSalary: unknown; recoveredAdvances: unknown };
}

/** تجميع الأرقام (دالة نقية للاختبار) */
export function assembleBranchFinancials(
  year: number,
  month: number,
  branchId: number | null,
  raw: BranchFinancialsRaw
): BranchMonthlyFinancials {
  const cash = roundMoney(raw.revenue.cash);
  const network = roundMoney(raw.revenue.network);

  const byCategoryMap = new Map<string, number>();
  let fixed = 0;
  let other = 0;
  for (const row of raw.expenseRows) {
    if (row.source === "payroll") continue;
    const amount = roundMoney(row.amount);
    if (row.source === "fixed") fixed += amount;
    else other += amount;
    const category = row.category || "other";
    byCategoryMap.set(category, roundMoney((byCategoryMap.get(category) ?? 0) + amount));
  }
  const byCategory = Array.from(byCategoryMap.entries())
    .map(([category, amount]) => ({ category, label: expenseCategoryLabel(category), amount }))
    .sort((a, b) => b.amount - a.amount);

  const netSalary = roundMoney(raw.payroll.netSalary);
  const recoveredAdvances = roundMoney(raw.payroll.recoveredAdvances);
  const payrollCost = payrollExpenseAmount(netSalary, recoveredAdvances);
  const expensesTotal = roundMoney(fixed + other);
  const totalCosts = roundMoney(expensesTotal + payrollCost);
  const revenueTotal = roundMoney(cash + network);

  return {
    year,
    month,
    branchId,
    revenue: { cash, network, total: revenueTotal, days: Number(raw.revenue.days) || 0 },
    expenses: { total: expensesTotal, fixed: roundMoney(fixed), other: roundMoney(other), byCategory },
    payroll: { count: Number(raw.payroll.count) || 0, netSalary, recoveredAdvances, cost: payrollCost },
    totalCosts,
    profit: roundMoney(revenueTotal - totalCosts),
  };
}

/** الأرقام المالية لفرع (أو كل الفروع) في شهر */
export async function getBranchMonthlyFinancials(
  year: number,
  month: number,
  branchId: number | null = null
): Promise<BranchMonthlyFinancials> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const { start, endExclusive } = utcMonthRange(year, month);

  const revenueWhere = [gte(dailyRevenues.date, start), lt(dailyRevenues.date, endExclusive)];
  if (branchId != null) revenueWhere.push(eq(dailyRevenues.branchId, branchId));
  const [revenue] = await db
    .select({
      cash: sql<string>`COALESCE(SUM(${dailyRevenues.cash}), 0)`,
      network: sql<string>`COALESCE(SUM(${dailyRevenues.network}), 0)`,
      days: sql<number>`COUNT(DISTINCT DATE(${dailyRevenues.date}))`,
    })
    .from(dailyRevenues)
    .where(and(...revenueWhere));

  const expenseWhere = [
    gte(expenses.expenseDate, start),
    lt(expenses.expenseDate, endExclusive),
    inArray(expenses.status, [...COUNTED_EXPENSE_STATUSES]),
    ne(expenses.source, "payroll"),
  ];
  if (branchId != null) expenseWhere.push(eq(expenses.branchId, branchId));
  const expenseRows = await db
    .select({
      category: expenses.category,
      source: expenses.source,
      amount: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
    })
    .from(expenses)
    .where(and(...expenseWhere))
    .groupBy(expenses.category, expenses.source);

  const payrollWhere = [
    eq(payrolls.year, year),
    eq(payrolls.month, month),
    inArray(payrolls.status, [...COUNTED_PAYROLL_STATUSES]),
  ];
  if (branchId != null) payrollWhere.push(eq(payrolls.branchId, branchId));
  const payrollRows = await db
    .select({ id: payrolls.id, totalNetSalary: payrolls.totalNetSalary })
    .from(payrolls)
    .where(and(...payrollWhere));
  let recoveredAdvances = 0;
  if (payrollRows.length > 0) {
    const [advances] = await db
      .select({ total: sql<string>`COALESCE(SUM(${payrollDetails.advanceDeduction}), 0)` })
      .from(payrollDetails)
      .where(inArray(payrollDetails.payrollId, payrollRows.map(p => p.id)));
    recoveredAdvances = Number(advances?.total ?? 0);
  }

  return assembleBranchFinancials(year, month, branchId, {
    revenue: { cash: revenue?.cash ?? 0, network: revenue?.network ?? 0, days: revenue?.days ?? 0 },
    expenseRows,
    payroll: {
      count: payrollRows.length,
      netSalary: payrollRows.reduce((sum, p) => sum + Number(p.totalNetSalary ?? 0), 0),
      recoveredAdvances,
    },
  });
}
