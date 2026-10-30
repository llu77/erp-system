/**
 * أدوات واجهة البونص (بدون اعتماد على React)
 *
 * - تحويل صفوف جدول المستويات القابل للتعديل إلى أرقام والتحقق منها بنفس قواعد الخادم
 * - فترات البونص للاختيار (1-7، 8-14، 15-21، 22-28، 29-نهاية الشهر) من الوحدة المشتركة
 * - أسماء إجراءات سجل التدقيق وملخص سجل تغييرات المستويات
 */

import {
  formatBonusPeriodLabel,
  getBonusPeriodNumber,
  getBonusPeriodsInMonth,
  validateTierList,
} from "@shared/bonus";
import {
  DEFAULT_TIER_COLORS,
  TIER_COLOR_HEX,
  isBonusPeriodEnded,
  listBonusPeriodsInMonth,
  prepareTierRowsForSave,
  toDayKey,
  type PreparedTierRow,
  type TierInput,
} from "@shared/bonusHelpers";

// ==================== الأرقام ====================

/**
 * تحويل نص مبلغ إلى رقم (يقبل الأرقام العربية ٠-٩ والفواصل)
 * يُرجع NaN إذا كان النص فارغاً أو غير صالح
 */
export function parseAmountInput(value: string | number | null | undefined): number {
  if (typeof value === "number") return value;
  const normalized = String(value ?? "")
    .trim()
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, ".")
    .replace(/[٬,\s]/g, "");
  if (normalized === "" || !/^-?(\d+\.?\d*|\.\d+)$/.test(normalized)) return NaN;
  return Number(normalized);
}

/** عرض مبلغ بدون أصفار زائدة: 1450.00 → "1450"، 12.5 → "12.5" */
export function formatAmountForInput(value: number | string | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return String(Math.round(n * 100) / 100);
}

/** تنسيق مبلغ بالريال للعرض */
export function formatSar(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return `${(Number.isFinite(n) ? n : 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;
}

// ==================== جدول المستويات القابل للتعديل ====================

export interface TierDraftRow {
  uid: string;
  tierName: string;
  minRevenue: string;
  bonusAmount: string;
  color: string;
}

let draftUidCounter = 0;

export function newTierDraftUid(): string {
  draftUidCounter += 1;
  return `tier-row-${draftUidCounter}`;
}

/** صفوف قابلة للتعديل من المستويات المحفوظة (مرتبة تصاعدياً حسب الحد الأدنى) */
export function tiersToDraftRows(
  tiers: Array<{ tierName: string; minRevenue: number | string; bonusAmount: number | string; color?: string | null }>
): TierDraftRow[] {
  return [...tiers]
    .sort((a, b) => Number(a.minRevenue) - Number(b.minRevenue))
    .map((tier, index) => ({
      uid: newTierDraftUid(),
      tierName: tier.tierName ?? "",
      minRevenue: formatAmountForInput(tier.minRevenue),
      bonusAmount: formatAmountForInput(tier.bonusAmount),
      color: tier.color && TIER_COLOR_HEX[tier.color] ? tier.color : DEFAULT_TIER_COLORS[index] ?? "gray",
    }));
}

/** صف جديد فارغ (اللون حسب ترتيبه) */
export function createEmptyTierDraftRow(index: number): TierDraftRow {
  return {
    uid: newTierDraftUid(),
    tierName: "",
    minRevenue: "",
    bonusAmount: "",
    color: DEFAULT_TIER_COLORS[index] ?? "gray",
  };
}

/** تحويل الصفوف إلى مدخلات bonuses.saveTiers */
export function draftRowsToTierInput(rows: TierDraftRow[]): TierInput[] {
  return rows.map(row => ({
    tierName: row.tierName.trim() || null,
    minRevenue: parseAmountInput(row.minRevenue),
    bonusAmount: parseAmountInput(row.bonusAmount),
    color: row.color || null,
  }));
}

export const MAX_TIER_NAME_LENGTH = 100;

/** التحقق من الصفوف بنفس قواعد الخادم (validateTierList) + طول الاسم */
export function validateTierDraft(rows: TierDraftRow[]): string[] {
  const errors = validateTierList(draftRowsToTierInput(rows));
  rows.forEach((row, index) => {
    if (row.tierName.trim().length > MAX_TIER_NAME_LENGTH) {
      errors.push(`المستوى ${index + 1}: الاسم أطول من ${MAX_TIER_NAME_LENGTH} حرف`);
    }
  });
  return errors;
}

/**
 * المستويات كما ستُحفظ (مفاتيح tier_1..tier_N حسب الترتيب التصاعدي)
 * تُستخدم للاختبار المباشر قبل الحفظ - تُرجع قائمة فارغة إذا كانت الصفوف غير صالحة
 */
export function draftRowsToRules(rows: TierDraftRow[]): PreparedTierRow[] {
  if (validateTierDraft(rows).length > 0) return [];
  return prepareTierRowsForSave(draftRowsToTierInput(rows));
}

/** نطاق كل صف حسب الترتيب التصاعدي: "1450 - 1749.99" أو "3200 فأكثر" */
export function describeDraftRanges(rows: TierDraftRow[]): Record<string, string | null> {
  const parsed = rows
    .map(row => ({ uid: row.uid, min: parseAmountInput(row.minRevenue) }))
    .filter(item => Number.isFinite(item.min) && item.min > 0)
    .sort((a, b) => a.min - b.min);

  const result: Record<string, string | null> = {};
  rows.forEach(row => {
    result[row.uid] = null;
  });
  parsed.forEach((item, index) => {
    const next = parsed.slice(index + 1).find(other => other.min > item.min);
    const duplicate = parsed.some(other => other.uid !== item.uid && other.min === item.min);
    if (duplicate) {
      result[item.uid] = null;
    } else if (next) {
      result[item.uid] = `${formatAmountForInput(item.min)} - ${formatAmountForInput(next.min - 0.01)}`;
    } else {
      result[item.uid] = `${formatAmountForInput(item.min)} فأكثر`;
    }
  });
  return result;
}

/** مفتاح مقارنة للصفوف (لمعرفة وجود تعديلات غير محفوظة) */
function draftSignature(rows: TierDraftRow[]): string {
  return JSON.stringify(
    draftRowsToTierInput(rows)
      .map(t => ({
        tierName: t.tierName ?? "",
        minRevenue: Number.isFinite(t.minRevenue) ? t.minRevenue : String(t.minRevenue),
        bonusAmount: Number.isFinite(t.bonusAmount) ? t.bonusAmount : String(t.bonusAmount),
        color: t.color ?? "",
      }))
      .sort((a, b) => Number(a.minRevenue) - Number(b.minRevenue))
  );
}

export function isTierDraftDirty(rows: TierDraftRow[], savedRows: TierDraftRow[]): boolean {
  return draftSignature(rows) !== draftSignature(savedRows);
}

// ==================== سجل تغييرات المستويات ====================

/**
 * ملخص قيم المستويات المحفوظة في سجل التغييرات (JSON لقائمة أو لمستوى واحد)
 * مثال: ["المستوى 1: 1450 ر.س ← بونص 35 ر.س"]
 */
export function summarizeTierSnapshot(json: string | null | undefined): string[] {
  if (!json) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  const list = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" ? [parsed] : [];
  return list
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .filter(item => item.isActive !== false)
    .map(item => ({
      name: typeof item.tierName === "string" && item.tierName.trim() ? item.tierName : String(item.tierKey ?? "مستوى"),
      min: Number(item.minRevenue),
      amount: Number(item.bonusAmount),
    }))
    .sort((a, b) => (Number.isFinite(a.min) ? a.min : 0) - (Number.isFinite(b.min) ? b.min : 0))
    .map(t => `${t.name}: ${Number.isFinite(t.min) ? formatAmountForInput(t.min) : "-"} ر.س ← بونص ${Number.isFinite(t.amount) ? formatAmountForInput(t.amount) : "-"} ر.س`);
}

// ==================== الفترات ====================

export interface BonusPeriodRef {
  year: number;
  month: number;
  weekNumber: number;
}

/** مفتاح اليوم المحلي YYYY-MM-DD */
export function getLocalDayKey(date: Date = new Date()): string {
  return toDayKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** الفترة الحالية حسب تاريخ الجهاز */
export function getDefaultBonusPeriod(date: Date = new Date()): BonusPeriodRef {
  return { year: date.getFullYear(), month: date.getMonth() + 1, weekNumber: getBonusPeriodNumber(date.getDate()) };
}

/** تصحيح رقم الفترة عند تغيير الشهر (فبراير غير الكبيسة 4 فترات) */
export function clampBonusPeriod(period: BonusPeriodRef): BonusPeriodRef {
  const count = getBonusPeriodsInMonth(period.month, period.year);
  return { ...period, weekNumber: Math.min(Math.max(1, period.weekNumber), count) };
}

/** الفترة السابقة أو التالية (عبر حدود الشهر) */
export function shiftBonusPeriod(period: BonusPeriodRef, delta: 1 | -1): BonusPeriodRef {
  const { year, month, weekNumber } = clampBonusPeriod(period);
  if (delta === 1) {
    if (weekNumber < getBonusPeriodsInMonth(month, year)) return { year, month, weekNumber: weekNumber + 1 };
    return month === 12 ? { year: year + 1, month: 1, weekNumber: 1 } : { year, month: month + 1, weekNumber: 1 };
  }
  if (weekNumber > 1) return { year, month, weekNumber: weekNumber - 1 };
  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  return { ...prev, weekNumber: getBonusPeriodsInMonth(prev.month, prev.year) };
}

export function compareBonusPeriods(a: BonusPeriodRef, b: BonusPeriodRef): number {
  return a.year - b.year || a.month - b.month || a.weekNumber - b.weekNumber;
}

export interface BonusPeriodOption {
  weekNumber: number;
  startDay: number;
  endDay: number;
  label: string;
  started: boolean;
  ended: boolean;
}

/** فترات الشهر للاختيار مع حالة البدء والانتهاء */
export function getBonusPeriodOptions(month: number, year: number, todayKey: string): BonusPeriodOption[] {
  return listBonusPeriodsInMonth(month, year).map(p => ({
    ...p,
    label: formatBonusPeriodLabel(p.weekNumber, month, year),
    started: toDayKey(year, month, p.startDay) <= todayKey,
    ended: isBonusPeriodEnded(p.weekNumber, month, year, todayKey),
  }));
}

// ==================== سجل التدقيق ====================

export const BONUS_AUDIT_ACTION_LABELS: Record<string, string> = {
  sync: "إعادة احتساب",
  request: "طلب صرف",
  approve: "موافقة",
  reject: "رفض",
  pay: "تسجيل صرف",
  paid: "تسجيل صرف",
  revenue_changed_after_lock: "تغير الإيراد بعد القفل",
  reset_after_rejection: "إعادة فتح بعد الرفض",
  discrepancy_alert_sent: "تنبيه فروقات",
};

export function getBonusAuditActionLabel(action: string | null | undefined): string {
  if (!action) return "-";
  return BONUS_AUDIT_ACTION_LABELS[action] ?? action;
}

export const TIER_CHANGE_TYPE_LABELS: Record<string, string> = {
  create: "إضافة",
  update: "تعديل",
  delete: "حذف",
};

// ==================== الألوان ====================

/** لون نص مقروء (أسود أو أبيض) فوق لون خلفية hex */
export function getReadableTextColor(hex: string): "#000000" | "#ffffff" {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return "#ffffff";
  const value = parseInt(match[1], 16);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#000000" : "#ffffff";
}
