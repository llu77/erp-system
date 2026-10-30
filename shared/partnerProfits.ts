/**
 * أرباح الشركاء: نسب الشركاء لكل مؤسسة وتوزيع ربح (أو خسارة) الفرع الشهري عليهم
 * - فرع لبن (مؤسسة قصه وتخفيف): عمر 50%، سالم 30%، عبدالله 20%
 * - فرع طويق (مؤسسة تدرج وتخفيف): سعود 40%، عمر 40%، كلثوم الكلثم 20%
 * - الأرباح = الإيرادات - المصاريف (المصاريف الثابتة + الرواتب + المصاريف الأخرى)
 * - الحساب بالهللات حتى يساوي مجموع الحصص الربح تماماً، وفرق التقريب لصاحب أكبر نسبة
 * - الخسارة توزَّع بنفس النسب كمبالغ سالبة
 * مشتركة بين الخادم (الملخص وملف PDF) والواجهة
 */

import { ESTABLISHMENTS, matchEstablishmentKey } from "./branding";
import { roundMoney, toHalalas } from "./vouchers";

export const PARTNER_PROFITS_PAGE_TITLE = "أرباح الشركاء";
export const PARTNER_PROFITS_STATEMENT_TITLE = "بيان توزيع أرباح الشركاء";

export type PartnerEstablishmentKey = "qessa" | "tadarruj";

export interface PartnerShare {
  name: string;
  /** النسبة المئوية من ربح الفرع */
  percent: number;
}

/** نسب الشركاء حسب مؤسسة الفرع (matchEstablishmentKey)، مجموع كل قائمة 100% */
export const PARTNER_SHARES: Record<PartnerEstablishmentKey, readonly PartnerShare[]> = {
  // فرع لبن - مؤسسة قصه وتخفيف
  qessa: [
    { name: "عمر", percent: 50 },
    { name: "سالم", percent: 30 },
    { name: "عبدالله", percent: 20 },
  ],
  // فرع طويق - مؤسسة تدرج وتخفيف
  tadarruj: [
    { name: "سعود", percent: 40 },
    { name: "عمر", percent: 40 },
    { name: "كلثوم الكلثم", percent: 20 },
  ],
};

/** مفتاح نسب الشركاء لفرع من اسمه العربي أو الإنجليزي (null = فرع بدون نسب شركاء) */
export function partnerKeyForBranch(branch: {
  name?: string | null;
  nameAr?: string | null;
}): PartnerEstablishmentKey | null {
  const key = matchEstablishmentKey(branch.nameAr, branch.name);
  return key && PARTNER_SHARES[key] ? key : null;
}

/** ربح أو خسارة حسب الإشارة (الصفر ربح) */
export function profitOrLossLabel(amount: number): "ربح" | "خسارة" {
  return amount < 0 ? "خسارة" : "ربح";
}

export interface PartnerShareAmount extends PartnerShare {
  /** حصة الشريك بالريال (سالبة عند الخسارة) */
  amount: number;
}

/**
 * توزيع الربح على الشركاء بالهللات: لكل شريك الجزء الصحيح من نسبته،
 * وما تبقى من هللات التقريب لصاحب أكبر نسبة (الأول في القائمة عند التساوي)
 * فيكون مجموع الحصص مساوياً للربح تماماً. الخسارة توزَّع بنفس الطريقة بإشارة سالبة.
 */
export function splitPartnerProfit(profit: number, shares: readonly PartnerShare[]): PartnerShareAmount[] {
  const totalPercent = shares.reduce((sum, s) => sum + s.percent, 0);
  if (shares.length === 0 || Math.abs(totalPercent - 100) > 1e-9) {
    throw new Error("مجموع نسب الشركاء يجب أن يكون 100%");
  }
  const total = toHalalas(profit);
  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);
  const halalas = shares.map(s => Math.floor((abs * s.percent) / 100));
  const remainder = abs - halalas.reduce((sum, h) => sum + h, 0);
  const largest = shares.reduce((best, s, i) => (s.percent > shares[best].percent ? i : best), 0);
  halalas[largest] += remainder;
  // 0 بدل -0 عند الصفر
  return shares.map((s, i) => ({
    name: s.name,
    percent: s.percent,
    amount: halalas[i] === 0 ? 0 : (sign * halalas[i]) / 100,
  }));
}

// ==================== بيان الفرع ====================

/** أرقام الفرع الشهرية كما يعيدها getBranchMonthlyFinancials (الحقول المستخدمة فقط) */
export interface PartnerProfitFinancialsInput {
  revenue: { cash: number; network: number; total: number; days: number };
  expenses: {
    total: number;
    fixed: number;
    other: number;
    byCategory: Array<{ category: string; label: string; amount: number }>;
  };
  payroll: { count: number; netSalary: number; recoveredAdvances: number; cost: number };
  totalCosts: number;
  profit: number;
}

export interface PartnerProfitStatement {
  year: number;
  month: number;
  branchId: number;
  branchName: string;
  establishmentKey: PartnerEstablishmentKey;
  establishmentName: string;
  revenue: { cash: number; network: number; total: number; days: number };
  expenses: {
    fixed: number;
    /** تكلفة الرواتب = صافي المسيرات المعتمدة والمدفوعة + السلف المستردة فيها */
    salaries: number;
    other: number;
    /** إجمالي المصاريف = الثابتة + الرواتب + الأخرى */
    total: number;
    /** المصاريف الثابتة والأخرى حسب التصنيف (بدون الرواتب) */
    byCategory: Array<{ category: string; label: string; amount: number }>;
    payroll: { count: number; netSalary: number; recoveredAdvances: number };
  };
  /** الأرباح = الإيرادات - المصاريف (سالبة = خسارة) */
  profit: number;
  isLoss: boolean;
  partners: PartnerShareAmount[];
}

export interface PartnerProfitsSummary {
  year: number;
  month: number;
  branches: PartnerProfitStatement[];
  /** فروع نشطة لا تطابق مؤسسة لها نسب شركاء */
  unassigned: Array<{ id: number; name: string }>;
}

/** اسم الفرع المعروض: العربي ثم الإنجليزي */
export function branchDisplayName(branch: { name?: string | null; nameAr?: string | null }): string {
  return (branch.nameAr || branch.name || "").trim();
}

/** بيان الفرع: الأرقام المالية مع توزيع الربح على شركاء مؤسسته */
export function buildPartnerProfitStatement(args: {
  year: number;
  month: number;
  branch: { id: number; name?: string | null; nameAr?: string | null };
  key: PartnerEstablishmentKey;
  financials: PartnerProfitFinancialsInput;
}): PartnerProfitStatement {
  const f = args.financials;
  const profit = roundMoney(f.profit);
  return {
    year: args.year,
    month: args.month,
    branchId: args.branch.id,
    branchName: branchDisplayName(args.branch),
    establishmentKey: args.key,
    establishmentName: ESTABLISHMENTS[args.key].nameAr,
    revenue: {
      cash: roundMoney(f.revenue.cash),
      network: roundMoney(f.revenue.network),
      total: roundMoney(f.revenue.total),
      days: Number(f.revenue.days) || 0,
    },
    expenses: {
      fixed: roundMoney(f.expenses.fixed),
      salaries: roundMoney(f.payroll.cost),
      other: roundMoney(f.expenses.other),
      total: roundMoney(f.totalCosts),
      byCategory: f.expenses.byCategory.filter(c => roundMoney(c.amount) !== 0),
      payroll: {
        count: Number(f.payroll.count) || 0,
        netSalary: roundMoney(f.payroll.netSalary),
        recoveredAdvances: roundMoney(f.payroll.recoveredAdvances),
      },
    },
    profit,
    isLoss: profit < 0,
    partners: splitPartnerProfit(profit, PARTNER_SHARES[args.key]),
  };
}
