/**
 * Bonus Tiers - تحميل مستويات البونص من قاعدة البيانات
 *
 * - المصدر الوحيد للمستويات هو جدول bonusTierSettings (يحدده المدير)
 * - إذا لم توجد مستويات نشطة تُستخدم DEFAULT_BONUS_TIERS
 * - ذاكرة مؤقتة قصيرة تُمسح عند حفظ المستويات
 */

import { DEFAULT_BONUS_TIERS, normalizeTiers, isValidTierKey, type BonusTierRule } from "../../shared/bonus";
import * as db from "../db";

const CACHE_TTL_MS = 60_000;

let cache: { tiers: BonusTierRule[]; isDefault: boolean; loadedAt: number } | null = null;

/** تحويل صفوف قاعدة البيانات إلى قواعد مستويات صالحة */
export function toTierRules(
  rows: Array<{ tierKey: string; tierName: string; minRevenue: number | string; bonusAmount: number | string; color?: string | null }>
): BonusTierRule[] {
  return rows
    .map(r => ({
      tierKey: r.tierKey,
      tierName: r.tierName,
      minRevenue: Number(r.minRevenue),
      bonusAmount: Number(r.bonusAmount),
      color: r.color ?? undefined,
    }))
    .filter(
      t =>
        isValidTierKey(t.tierKey) &&
        Number.isFinite(t.minRevenue) &&
        t.minRevenue > 0 &&
        Number.isFinite(t.bonusAmount) &&
        t.bonusAmount >= 0
    )
    .sort((a, b) => a.minRevenue - b.minRevenue);
}

/**
 * تحميل المستويات النشطة (مرة واحدة لكل عملية احتساب)
 */
export async function loadActiveBonusTiers(options: { fresh?: boolean } = {}): Promise<{
  tiers: BonusTierRule[];
  isDefault: boolean;
}> {
  if (!options.fresh && cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) {
    return { tiers: cache.tiers, isDefault: cache.isDefault };
  }

  let rows: BonusTierRule[] = [];
  try {
    rows = toTierRules(await db.getActiveBonusTiers());
  } catch (error) {
    console.error("[Bonus Tiers] فشل تحميل المستويات من قاعدة البيانات:", error);
  }

  const isDefault = rows.length === 0;
  const tiers = isDefault ? normalizeTiers(DEFAULT_BONUS_TIERS) : rows;
  cache = { tiers, isDefault, loadedAt: Date.now() };
  return { tiers, isDefault };
}

/** المستويات فقط */
export async function getActiveTierRules(): Promise<BonusTierRule[]> {
  return (await loadActiveBonusTiers()).tiers;
}

/** مسح الذاكرة المؤقتة (بعد حفظ المستويات) */
export function invalidateBonusTiersCache(): void {
  cache = null;
}
