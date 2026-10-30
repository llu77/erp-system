/**
 * اختبارات إعادة احتساب البونص: عدم استبدال إجمالي فترة طُلب صرفها أثناء الاحتساب
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { SQL } from "drizzle-orm";
import {
  bonusAuditLog,
  bonusDetails,
  dailyRevenues,
  employeeRevenues,
  employees,
  weeklyBonuses,
} from "../../drizzle/schema";
import type { BonusTierRule } from "../../shared/bonus";

const state = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("../db", () => ({ getDb: vi.fn(async () => state.db) }));
vi.mock("./tiers", () => ({ loadActiveBonusTiers: vi.fn(async () => ({ tiers: [] })) }));

import { recomputeWeeklyBonus } from "./sync";

const TIERS: BonusTierRule[] = [{ tierKey: "tier_1", tierName: "البرونزي", minRevenue: 1000, bonusAmount: 50 }];

interface Write {
  op: "insert" | "update" | "delete";
  table: unknown;
  values?: Record<string, unknown>;
  where?: unknown;
}

interface Scenario {
  /** حالة الصف في القراءة العادية (لقطة المعاملة - قد تكون قديمة) */
  snapshotStatus: string;
  /** حالة الصف عند القراءة مع القفل (FOR UPDATE) في كل محاولة */
  lockedStatuses: string[];
  /** عدد الصفوف المتأثرة بتحديث إجمالي الفترة في كل محاولة */
  updateAffectedRows?: number[];
}

/** قاعدة بيانات وهمية: الكتابات تُعتمد فقط إذا انتهت المعاملة بدون خطأ */
function createFakeDb(scenario: Scenario) {
  const committed: Write[] = [];
  let attempts = 0;
  let lockedReads = 0;
  const weeklyRow = (status: string) => ({ id: 7, branchId: 3, year: 2026, month: 10, weekNumber: 2, status, totalAmount: "20.00" });

  function resolveSelect(fields: Record<string, unknown> | undefined, table: unknown, forUpdate: boolean): unknown[] {
    if (table === dailyRevenues) return [{ id: 501, date: new Date(Date.UTC(2026, 9, 8)), cash: "1200.00", network: "0.00" }];
    if (table === employeeRevenues) return [{ dailyRevenueId: 501, employeeId: 11, total: "1200.00" }];
    if (table === employees) return [{ id: 11 }];
    if (table === weeklyBonuses) {
      if (!forUpdate) return [weeklyRow(scenario.snapshotStatus)];
      lockedReads++;
      return [weeklyRow(scenario.lockedStatuses[attempts - 1])];
    }
    if (table === bonusDetails) {
      if (fields && "total" in fields) return [{ total: "50.00" }];
      if (fields && "weeklyRevenue" in fields) return [{ weeklyRevenue: "900.00" }];
      return [{ id: 301, employeeId: 11 }];
    }
    if (table === bonusAuditLog) return [];
    throw new Error("جدول غير متوقع");
  }

  function makeTx(writes: Write[]) {
    return {
      execute: async () => [[{ id: 3 }]],
      select: (fields?: Record<string, unknown>) => {
        let table: unknown = null;
        let forUpdate = false;
        const chain = {
          from: (t: unknown) => ((table = t), chain),
          where: () => chain,
          orderBy: () => chain,
          limit: () => chain,
          for: (mode: string) => ((forUpdate = mode === "update"), chain),
          then: (onFulfilled: (rows: unknown[]) => unknown, onRejected?: (e: unknown) => unknown) =>
            Promise.resolve()
              .then(() => resolveSelect(fields, table, forUpdate))
              .then(onFulfilled, onRejected),
        };
        return chain;
      },
      insert: (table: unknown) => ({
        values: async (values: Record<string, unknown>) => {
          writes.push({ op: "insert", table, values });
          return [{ insertId: 99, affectedRows: 1 }];
        },
      }),
      update: (table: unknown) => ({
        set: (values: Record<string, unknown>) => ({
          where: async (where: unknown) => {
            writes.push({ op: "update", table, values, where });
            const affected = table === weeklyBonuses ? scenario.updateAffectedRows?.[attempts - 1] ?? 1 : 1;
            return [{ affectedRows: affected }];
          },
        }),
      }),
      delete: (table: unknown) => ({
        where: async (where: unknown) => {
          writes.push({ op: "delete", table, where });
          return [{ affectedRows: 1 }];
        },
      }),
    };
  }

  const db = {
    transaction: async (cb: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) => {
      attempts++;
      const writes: Write[] = [];
      const result = await cb(makeTx(writes)); // خطأ = تراجع (لا تُعتمد الكتابات)
      committed.push(...writes);
      return result;
    },
  };

  return {
    db,
    committed,
    get attempts() {
      return attempts;
    },
    get lockedReads() {
      return lockedReads;
    },
  };
}

function toSql(condition: unknown) {
  return new MySqlDialect().sqlToQuery(condition as SQL);
}

describe("recomputeWeeklyBonus - التزامن مع طلب الصرف", () => {
  beforeEach(() => {
    state.db = null;
  });

  it("يقرأ حالة الفترة مع القفل ولا يعدل فترة طُلب صرفها رغم أن اللقطة تُظهرها قيد الاحتساب", async () => {
    const fake = createFakeDb({ snapshotStatus: "pending", lockedStatuses: ["requested"] });
    state.db = fake.db;

    const result = await recomputeWeeklyBonus(3, 2026, 10, 2, { tiers: TIERS });

    expect(fake.lockedReads).toBe(1);
    expect(result.success).toBe(true);
    expect(result.locked).toBe(true);
    expect(result.totalAmount).toBe(20);
    expect(result.computedTotal).toBe(50);
    expect(fake.committed.some(w => w.table === weeklyBonuses && w.op === "update")).toBe(false);
    expect(fake.committed.some(w => w.table === bonusDetails)).toBe(false);
    const audit = fake.committed.filter(w => w.table === bonusAuditLog);
    expect(audit).toHaveLength(1);
    expect(audit[0].values?.action).toBe("revenue_changed_after_lock");
  });

  it("يحدث إجمالي الفترة المفتوحة بشرط أن حالتها ما زالت قيد الاحتساب أو مرفوضة", async () => {
    const fake = createFakeDb({ snapshotStatus: "pending", lockedStatuses: ["pending"] });
    state.db = fake.db;

    const result = await recomputeWeeklyBonus(3, 2026, 10, 2, { tiers: TIERS });

    expect(result.success).toBe(true);
    expect(result.locked).toBe(false);
    expect(result.totalAmount).toBe(50);
    const update = fake.committed.find(w => w.table === weeklyBonuses && w.op === "update");
    expect(update?.values?.totalAmount).toBe("50.00");
    const query = toSql(update?.where);
    expect(query.sql).toMatch(/`status` in \(\?, \?\)/);
    expect(query.params).toEqual([7, "pending", "rejected"]);
  });

  it("إذا لم يتأثر صف الفترة بتحديث الإجمالي يتراجع عن التعديلات ويعاملها كفترة مقفلة", async () => {
    const fake = createFakeDb({ snapshotStatus: "pending", lockedStatuses: ["pending", "requested"], updateAffectedRows: [0] });
    state.db = fake.db;

    const result = await recomputeWeeklyBonus(3, 2026, 10, 2, { tiers: TIERS });

    expect(fake.attempts).toBe(2);
    expect(result.success).toBe(true);
    expect(result.locked).toBe(true);
    expect(result.status).toBe("requested");
    expect(result.totalAmount).toBe(20);
    expect(fake.committed.some(w => w.table === weeklyBonuses && w.op === "update")).toBe(false);
    expect(fake.committed.some(w => w.table === bonusDetails)).toBe(false);
    expect(fake.committed.filter(w => w.table === bonusAuditLog).map(w => w.values?.action)).toEqual(["revenue_changed_after_lock"]);
  });
});
