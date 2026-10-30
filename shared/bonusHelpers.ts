/**
 * أدوات عرض وسير عمل البونص المشتركة بين الخادم والواجهة
 *
 * - أسماء الحالات وألوان المستويات (من إعدادات المدير وليس خرائط ثابتة)
 * - تجهيز قائمة المستويات قبل الحفظ (مفاتيح tier_1..tier_N والحد الأقصى المشتق)
 * - منطق الفترات المساعد (انتهاء الفترة، صلاحية رقم الفترة)
 */

import {
  MAX_BONUS_TIERS,
  getBonusPeriodDays,
  getBonusPeriodNumber,
  getBonusPeriodsInMonth,
  type BonusTierRule,
} from "./bonus";

// ==================== الحالات ====================

export type WeeklyBonusStatus = "pending" | "requested" | "approved" | "rejected" | "paid";

export const BONUS_STATUS_LABELS: Record<WeeklyBonusStatus, string> = {
  pending: "قيد الاحتساب",
  requested: "بانتظار الموافقة",
  approved: "موافق عليه - بانتظار الصرف",
  rejected: "مرفوض",
  paid: "تم الصرف",
};

/** الحالات المقفلة: لا يتم تعديل مبالغها عند تغير الإيرادات */
export const LOCKED_BONUS_STATUSES: WeeklyBonusStatus[] = ["requested", "approved", "paid"];

/** الحالات التي يمكن منها طلب الصرف */
export const REQUESTABLE_BONUS_STATUSES: WeeklyBonusStatus[] = ["pending", "rejected"];

/** الحالات النهائية المعتمدة (تظهر للموظف كمبلغ نهائي) */
export const FINAL_BONUS_STATUSES: WeeklyBonusStatus[] = ["approved", "paid"];

export function isLockedBonusStatus(status: string | null | undefined): boolean {
  return LOCKED_BONUS_STATUSES.includes(status as WeeklyBonusStatus);
}

export function isFinalBonusStatus(status: string | null | undefined): boolean {
  return FINAL_BONUS_STATUSES.includes(status as WeeklyBonusStatus);
}

export function getBonusStatusLabel(status: string | null | undefined): string {
  return BONUS_STATUS_LABELS[status as WeeklyBonusStatus] ?? (status || "-");
}

export const BONUS_PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "نقداً",
  bank_transfer: "تحويل بنكي",
  check: "شيك",
};

// ==================== المستويات ====================

/** ألوان المستويات المسموح بها (تخزن بالاسم في bonusTierSettings.color) */
export const TIER_COLOR_HEX: Record<string, string> = {
  orange: "#f97316",
  yellow: "#eab308",
  green: "#22c55e",
  cyan: "#06b6d4",
  blue: "#3b82f6",
  indigo: "#6366f1",
  purple: "#a855f7",
  pink: "#ec4899",
  red: "#ef4444",
  gray: "#9ca3af",
};

/** اللون الافتراضي حسب ترتيب المستوى (1..7) */
export const DEFAULT_TIER_COLORS = ["orange", "yellow", "green", "cyan", "blue", "indigo", "purple"];

/** رقم المستوى من المفتاح: tier_3 → 3 */
export function getTierIndex(tierKey: string | null | undefined): number {
  const match = /^tier_(\d+)$/.exec(String(tierKey ?? ""));
  return match ? Number(match[1]) : 0;
}

/**
 * اسم المستوى للعرض بالترتيب:
 * 1) الاسم المحفوظ وقت الاحتساب (bonusDetails.tierName)
 * 2) اسم المستوى الحالي في إعدادات المدير
 * 3) "المستوى N"
 */
export function getTierDisplayName(
  tierKey: string | null | undefined,
  storedName?: string | null,
  tiers?: Array<Pick<BonusTierRule, "tierKey" | "tierName">> | null
): string {
  if (!tierKey || tierKey === "none") return "غير مؤهل";
  if (storedName && storedName.trim()) return storedName;
  const fromSettings = tiers?.find(t => t.tierKey === tierKey)?.tierName;
  if (fromSettings) return fromSettings;
  const index = getTierIndex(tierKey);
  return index > 0 ? `المستوى ${index}` : tierKey;
}

/** اسم اللون للمستوى (من الإعدادات أو حسب الترتيب) */
export function getTierColorName(
  tierKey: string | null | undefined,
  tiers?: Array<Pick<BonusTierRule, "tierKey" | "color">> | null
): string {
  if (!tierKey || tierKey === "none") return "gray";
  const fromSettings = tiers?.find(t => t.tierKey === tierKey)?.color;
  if (fromSettings && TIER_COLOR_HEX[fromSettings]) return fromSettings;
  const index = getTierIndex(tierKey);
  return DEFAULT_TIER_COLORS[(index - 1 + DEFAULT_TIER_COLORS.length) % DEFAULT_TIER_COLORS.length] ?? "gray";
}

export function getTierColorHex(
  tierKey: string | null | undefined,
  tiers?: Array<Pick<BonusTierRule, "tierKey" | "color">> | null
): string {
  return TIER_COLOR_HEX[getTierColorName(tierKey, tiers)] ?? TIER_COLOR_HEX.gray;
}

export interface TierInput {
  tierName?: string | null;
  minRevenue: number;
  bonusAmount: number;
  color?: string | null;
}

export interface PreparedTierRow {
  tierKey: string;
  tierName: string;
  minRevenue: number;
  maxRevenue: number | null;
  bonusAmount: number;
  color: string;
  sortOrder: number;
}

/**
 * تجهيز قائمة المستويات للحفظ:
 * - ترتيب تصاعدي حسب الحد الأدنى
 * - مفاتيح tier_1..tier_N بالترتيب (الحد الأقصى 7)
 * - الحد الأقصى = الحد الأدنى للمستوى التالي - 0.01 (آخر مستوى بلا حد أقصى)
 * - اسم افتراضي "المستوى N" ولون افتراضي حسب الترتيب
 */
export function prepareTierRowsForSave(input: TierInput[]): PreparedTierRow[] {
  const sorted = [...input]
    .map(t => ({
      ...t,
      minRevenue: roundMoney(Number(t.minRevenue)),
      bonusAmount: roundMoney(Number(t.bonusAmount)),
    }))
    .sort((a, b) => a.minRevenue - b.minRevenue)
    .slice(0, MAX_BONUS_TIERS);

  return sorted.map((tier, index) => {
    const next = sorted[index + 1];
    const name = (tier.tierName ?? "").trim();
    const color = tier.color && TIER_COLOR_HEX[tier.color] ? tier.color : DEFAULT_TIER_COLORS[index] ?? "gray";
    return {
      tierKey: `tier_${index + 1}`,
      tierName: name || `المستوى ${index + 1}`,
      minRevenue: tier.minRevenue,
      maxRevenue: next ? roundMoney(next.minRevenue - 0.01) : null,
      bonusAmount: tier.bonusAmount,
      color,
      sortOrder: index + 1,
    };
  });
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

// ==================== الفترات ====================

/** مفتاح يوم بصيغة YYYY-MM-DD */
export function toDayKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** هل رقم الفترة صالح لهذا الشهر؟ (فبراير غير الكبيسة 4 فترات فقط) */
export function isValidBonusPeriod(weekNumber: number, month: number, year: number): boolean {
  return (
    Number.isInteger(weekNumber) &&
    Number.isInteger(month) &&
    Number.isInteger(year) &&
    month >= 1 &&
    month <= 12 &&
    weekNumber >= 1 &&
    weekNumber <= getBonusPeriodsInMonth(month, year)
  );
}

/** فترة البونص ليوم تقويمي */
export function getBonusPeriodForDay(year: number, month: number, day: number) {
  return { year, month, weekNumber: getBonusPeriodNumber(day) };
}

/** آخر يوم في الفترة بصيغة YYYY-MM-DD */
export function getBonusPeriodEndKey(weekNumber: number, month: number, year: number): string {
  const { endDay } = getBonusPeriodDays(weekNumber, month, year);
  return toDayKey(year, month, endDay);
}

/**
 * هل انتهت الفترة؟ (اليوم الحالي بعد آخر يوم في الفترة)
 * todayKey: تاريخ يوم العمل الحالي بصيغة YYYY-MM-DD
 */
export function isBonusPeriodEnded(weekNumber: number, month: number, year: number, todayKey: string): boolean {
  return todayKey > getBonusPeriodEndKey(weekNumber, month, year);
}

/** قائمة فترات الشهر للاختيار */
export function listBonusPeriodsInMonth(month: number, year: number) {
  const count = getBonusPeriodsInMonth(month, year);
  return Array.from({ length: count }, (_, i) => {
    const weekNumber = i + 1;
    const { startDay, endDay } = getBonusPeriodDays(weekNumber, month, year);
    return { weekNumber, startDay, endDay };
  });
}
