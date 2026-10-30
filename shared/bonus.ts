/**
 * قواعد البونص المشتركة بين الخادم والواجهة
 *
 * - فترات البونص داخل الشهر: 1-7، 8-14، 15-21، 22-28، 29-نهاية الشهر
 * - المستويات يحددها المدير من صفحة "إعدادات مستويات البونص" (جدول bonusTierSettings)
 * - يحصل الموظف على مبلغ أعلى مستوى يكون إيراده في الفترة >= الحد الأدنى له
 */

export type BonusTierKey = "tier_1" | "tier_2" | "tier_3" | "tier_4" | "tier_5" | "tier_6" | "tier_7";
export type BonusTierResultKey = BonusTierKey | "none";

/** الحد الأقصى لعدد المستويات (مرتبط بقيم عمود bonusDetails.bonusTier) */
export const MAX_BONUS_TIERS = 7;

export interface BonusTierRule {
  tierKey: string;
  tierName: string;
  minRevenue: number;
  bonusAmount: number;
  color?: string;
}

export interface BonusTierMatch {
  tier: BonusTierResultKey;
  tierName: string;
  amount: number;
  isEligible: boolean;
}

/** المستويات الافتراضية (تُستخدم فقط إذا لم يحدد المدير أي مستويات نشطة) */
export const DEFAULT_BONUS_TIERS: BonusTierRule[] = [
  { tierKey: "tier_1", tierName: "المستوى 1", minRevenue: 1450, bonusAmount: 35, color: "orange" },
  { tierKey: "tier_2", tierName: "المستوى 2", minRevenue: 1750, bonusAmount: 55, color: "yellow" },
  { tierKey: "tier_3", tierName: "المستوى 3", minRevenue: 1950, bonusAmount: 65, color: "green" },
  { tierKey: "tier_4", tierName: "المستوى 4", minRevenue: 2200, bonusAmount: 90, color: "cyan" },
  { tierKey: "tier_5", tierName: "المستوى 5", minRevenue: 2500, bonusAmount: 120, color: "blue" },
  { tierKey: "tier_6", tierName: "المستوى 6", minRevenue: 2800, bonusAmount: 155, color: "indigo" },
  { tierKey: "tier_7", tierName: "المستوى 7", minRevenue: 3200, bonusAmount: 190, color: "purple" },
];

const VALID_TIER_KEYS = new Set<string>(["tier_1", "tier_2", "tier_3", "tier_4", "tier_5", "tier_6", "tier_7"]);

export function isValidTierKey(key: string): key is BonusTierKey {
  return VALID_TIER_KEYS.has(key);
}

/** ترتيب المستويات تصاعدياً حسب الحد الأدنى وتجاهل القيم غير الصالحة */
export function normalizeTiers(tiers: BonusTierRule[] | null | undefined): BonusTierRule[] {
  const valid = (tiers ?? []).filter(
    t =>
      isValidTierKey(t.tierKey) &&
      Number.isFinite(t.minRevenue) &&
      t.minRevenue > 0 &&
      Number.isFinite(t.bonusAmount) &&
      t.bonusAmount >= 0
  );
  const source = valid.length > 0 ? valid : DEFAULT_BONUS_TIERS;
  return [...source].sort((a, b) => a.minRevenue - b.minRevenue);
}

/** تحديد مستوى البونص لإيراد فترة معينة */
export function resolveBonusTier(revenue: number, tiers: BonusTierRule[] | null | undefined): BonusTierMatch {
  const value = Number.isFinite(revenue) ? revenue : 0;
  const ordered = normalizeTiers(tiers);
  let match: BonusTierRule | null = null;
  for (const tier of ordered) {
    if (value + 1e-9 >= tier.minRevenue) match = tier;
  }
  if (!match || match.bonusAmount <= 0) {
    return { tier: "none", tierName: "غير مؤهل", amount: 0, isEligible: false };
  }
  return {
    tier: match.tierKey as BonusTierKey,
    tierName: match.tierName,
    amount: match.bonusAmount,
    isEligible: true,
  };
}

/** المبلغ المتبقي للوصول للمستوى التالي */
export function revenueToNextTier(
  revenue: number,
  tiers: BonusTierRule[] | null | undefined
): { nextTier: BonusTierRule | null; remaining: number } {
  const ordered = normalizeTiers(tiers);
  const next = ordered.find(t => t.minRevenue > revenue + 1e-9) ?? null;
  return { nextTier: next, remaining: next ? Math.max(0, next.minRevenue - revenue) : 0 };
}

/**
 * التحقق من صحة قائمة مستويات قبل حفظها: حد أدنى تصاعدي ومبالغ تصاعدية بدون تكرار
 * تُرجع قائمة رسائل الأخطاء (فارغة إذا كانت صالحة)
 */
export function validateTierList(tiers: Array<{ minRevenue: number; bonusAmount: number }>): string[] {
  const errors: string[] = [];
  if (tiers.length === 0) errors.push("يجب تحديد مستوى واحد على الأقل");
  if (tiers.length > MAX_BONUS_TIERS) errors.push(`الحد الأقصى ${MAX_BONUS_TIERS} مستويات`);
  tiers.forEach((t, i) => {
    if (!Number.isFinite(t.minRevenue) || t.minRevenue <= 0) errors.push(`المستوى ${i + 1}: الحد الأدنى للإيراد يجب أن يكون أكبر من صفر`);
    if (!Number.isFinite(t.bonusAmount) || t.bonusAmount <= 0) errors.push(`المستوى ${i + 1}: مبلغ البونص يجب أن يكون أكبر من صفر`);
  });
  const sorted = [...tiers].sort((a, b) => a.minRevenue - b.minRevenue);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].minRevenue === sorted[i - 1].minRevenue) {
      errors.push(`الحد الأدنى ${sorted[i].minRevenue} مكرر`);
    }
    if (sorted[i].bonusAmount < sorted[i - 1].bonusAmount) {
      errors.push(`مبلغ البونص للحد ${sorted[i].minRevenue} أقل من المستوى الأدنى منه`);
    }
  }
  return errors;
}

// ==================== فترات البونص ====================

export const BONUS_PERIOD_RANGES: Record<1 | 2 | 3 | 4 | 5, { startDay: number; endDay: number | "end" }> = {
  1: { startDay: 1, endDay: 7 },
  2: { startDay: 8, endDay: 14 },
  3: { startDay: 15, endDay: 21 },
  4: { startDay: 22, endDay: 28 },
  5: { startDay: 29, endDay: "end" },
};

export function getBonusPeriodNumber(dayOfMonth: number): 1 | 2 | 3 | 4 | 5 {
  if (dayOfMonth <= 7) return 1;
  if (dayOfMonth <= 14) return 2;
  if (dayOfMonth <= 21) return 3;
  if (dayOfMonth <= 28) return 4;
  return 5;
}

/** أيام الفترة (اليوم الأول والأخير) لشهر معين */
export function getBonusPeriodDays(
  weekNumber: number,
  month: number,
  year: number
): { startDay: number; endDay: number; days: number } {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const range = BONUS_PERIOD_RANGES[(Math.min(5, Math.max(1, weekNumber)) as 1 | 2 | 3 | 4 | 5)];
  const endDay = range.endDay === "end" ? lastDay : Math.min(range.endDay, lastDay);
  return { startDay: range.startDay, endDay, days: Math.max(0, endDay - range.startDay + 1) };
}

/** عدد فترات البونص الفعلية في الشهر (فبراير غير الكبيسة = 4 فترات) */
export function getBonusPeriodsInMonth(month: number, year: number): number {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return lastDay >= 29 ? 5 : 4;
}

/** وصف الفترة للعرض: "1-7 أكتوبر 2026" */
export function formatBonusPeriodLabel(weekNumber: number, month: number, year: number): string {
  const { startDay, endDay } = getBonusPeriodDays(weekNumber, month, year);
  return `${startDay}-${endDay} ${ARABIC_MONTHS[month - 1] ?? month} ${year}`;
}

export const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];
