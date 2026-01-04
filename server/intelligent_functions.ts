/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🧠 INTELLIGENT SYSTEM FUNCTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * الدوال الذكية لنظام ERP:
 * 1. كشف الأنماط والشذوذ
 * 2. تحسين سير العمل
 * 3. محرك الأتمتة
 */

import { getDb } from "./db";
import {
  dailyRevenues,
  employeeRevenues,
  weeklyBonuses,
  bonusDetails,
  employees,
  branches,
} from "../drizzle/schema";
import { eq, and, gte, lte, sql, between, desc, asc, isNull, ne } from "drizzle-orm";

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

type DrizzleDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;

interface Anomaly {
  type: "spike" | "drop";
  entityType: "employee" | "branch";
  entityId: number;
  entityName: string;
  date: string;
  expectedValue: number;
  actualValue: number;
  deviation: number;
  deviationSigma: number;
  confidence: "low" | "medium" | "high";
  severity: "info" | "warning" | "critical";
  possibleCauses: string[];
  suggestedActions: string[];
}

interface FraudPattern {
  patternType: "round_numbers" | "threshold_gaming" | "benford_violation" | "exact_repetition";
  description: string;
  affectedEntities: Array<{ type: string; id: number; name: string }>;
  confidence: "low" | "medium" | "high";
  evidence: string[];
  riskLevel: "low" | "medium" | "high";
  recommendations: string[];
}

interface PerformancePattern {
  employeeId: number;
  employeeName: string;
  pattern: "declining_star" | "rising_talent" | "consistent_high" | "consistent_low" | "erratic" | "plateau";
  description: string;
  metrics: {
    avgRevenue: number;
    trend: number;
    volatility: number;
    bonusRate: number;
  };
  recommendations: string[];
  urgency: "low" | "medium" | "high" | "urgent";
}

interface ProactiveAlert {
  id: string;
  type: "bonus_at_risk" | "data_delay" | "performance_drop" | "opportunity";
  priority: "info" | "warning" | "critical" | "urgent";
  title: string;
  message: string;
  entity: { type: string; id: number; name: string };
  actionRequired: string;
  deadline?: Date;
  data: Record<string, unknown>;
}

interface SmartRecommendation {
  id: string;
  type: "optimization" | "warning" | "opportunity" | "action_required";
  priority: "info" | "warning" | "critical" | "urgent";
  title: string;
  description: string;
  impact: {
    metric: string;
    currentValue: number;
    potentialValue: number;
    improvement: number;
    improvementPercent: number;
  };
  actionItems: Array<{
    action: string;
    effort: "low" | "medium" | "high";
    timeline: string;
  }>;
  affectedEntities: Array<{ type: string; id: number; name: string }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 1: 🔍 كشف الأنماط والشذوذ
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 1.1 اكتشاف الشذوذ في الإيرادات باستخدام Z-Score
 * 
 * Z = (X - μ) / σ
 * 
 * |Z| < 2: طبيعي
 * |Z| ≥ 2: شذوذ محتمل (95%)
 * |Z| ≥ 3: شذوذ مؤكد (99.7%)
 */
export async function detectRevenueAnomalies(
  branchId: number,
  analysisDate: Date,
  options: {
    lookbackDays?: number;
    zScoreThreshold?: number;
    includeEmployeeLevel?: boolean;
  } = {}
): Promise<{
  anomalies: Anomaly[];
  statistics: {
    mean: number;
    stdDev: number;
    median: number;
    analyzedDays: number;
  };
}> {
  const db = await getDb();
  if (!db) throw new Error("فشل الاتصال بقاعدة البيانات");

  const {
    lookbackDays = 90,
    zScoreThreshold = 2.5,
    includeEmployeeLevel = true,
  } = options;

  const anomalies: Anomaly[] = [];

  // حساب تاريخ البداية
  const startDate = new Date(analysisDate);
  startDate.setDate(startDate.getDate() - lookbackDays);

  // ═══════════════════════════════════════════════════════════════
  // 1. تحليل على مستوى الفرع
  // ═══════════════════════════════════════════════════════════════
  const branchRevenues = await db
    .select({
      date: dailyRevenues.date,
      total: dailyRevenues.total,
    })
    .from(dailyRevenues)
    .where(
      and(
        eq(dailyRevenues.branchId, branchId),
        between(dailyRevenues.date, startDate, analysisDate)
      )
    )
    .orderBy(asc(dailyRevenues.date));

  if (branchRevenues.length < 7) {
    return {
      anomalies: [],
      statistics: { mean: 0, stdDev: 0, median: 0, analyzedDays: branchRevenues.length },
    };
  }

  // حساب الإحصائيات
  const values = branchRevenues.map(r => Number(r.total || 0));
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const sortedValues = [...values].sort((a, b) => a - b);
  const median = sortedValues[Math.floor(sortedValues.length / 2)];

  // فحص آخر 7 أيام للشذوذ
  const recentRevenues = branchRevenues.slice(-7);
  for (const rev of recentRevenues) {
    const value = Number(rev.total || 0);
    const zScore = stdDev > 0 ? (value - mean) / stdDev : 0;

    if (Math.abs(zScore) >= zScoreThreshold) {
      const isSpike = zScore > 0;
      const deviation = ((value - mean) / mean) * 100;

      anomalies.push({
        type: isSpike ? "spike" : "drop",
        entityType: "branch",
        entityId: branchId,
        entityName: `الفرع #${branchId}`,
        date: rev.date instanceof Date ? rev.date.toISOString().split('T')[0] : String(rev.date),
        expectedValue: Math.round(mean),
        actualValue: Math.round(value),
        deviation: Math.round(deviation),
        deviationSigma: Math.round(zScore * 10) / 10,
        confidence: Math.abs(zScore) >= 3 ? "high" : Math.abs(zScore) >= 2.5 ? "medium" : "low",
        severity: Math.abs(zScore) >= 3 ? "critical" : Math.abs(zScore) >= 2.5 ? "warning" : "info",
        possibleCauses: isSpike
          ? ["يوم ذروة", "عدد موظفين أعلى من المعتاد", "عروض خاصة"]
          : ["يوم هادئ", "غياب موظفين", "مشكلة في الخدمة"],
        suggestedActions: [
          "مراجعة تفصيلية للبيانات",
          isSpike ? "التحقق من صحة الإيرادات" : "التحقق من اكتمال البيانات",
        ],
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. تحليل على مستوى الموظفين (اختياري)
  // ═══════════════════════════════════════════════════════════════
  if (includeEmployeeLevel) {
    const employeeData = await db
      .select({
        employeeId: employeeRevenues.employeeId,
        employeeName: employees.name,
        date: dailyRevenues.date,
        total: employeeRevenues.total,
      })
      .from(employeeRevenues)
      .innerJoin(dailyRevenues, eq(employeeRevenues.dailyRevenueId, dailyRevenues.id))
      .innerJoin(employees, eq(employeeRevenues.employeeId, employees.id))
      .where(
        and(
          eq(dailyRevenues.branchId, branchId),
          between(dailyRevenues.date, startDate, analysisDate)
        )
      )
      .orderBy(asc(dailyRevenues.date));

    // تجميع البيانات حسب الموظف
    const employeeMap = new Map<number, { name: string; values: { date: Date | string; total: number }[] }>();
    for (const row of employeeData) {
      if (!employeeMap.has(row.employeeId)) {
        employeeMap.set(row.employeeId, { name: row.employeeName, values: [] });
      }
      employeeMap.get(row.employeeId)!.values.push({
        date: row.date,
        total: Number(row.total || 0),
      });
    }

    // تحليل كل موظف
    for (const [empId, data] of Array.from(employeeMap.entries())) {
      if (data.values.length < 7) continue;

      const empValues = data.values.map((v: { date: Date | string; total: number }) => v.total);
      const empMean = empValues.reduce((a: number, b: number) => a + b, 0) / empValues.length;
      const empVariance = empValues.reduce((sum: number, val: number) => sum + Math.pow(val - empMean, 2), 0) / empValues.length;
      const empStdDev = Math.sqrt(empVariance);

      // فحص آخر 3 أيام
      const recentEmpData = data.values.slice(-3);
      for (const rev of recentEmpData) {
        const zScore = empStdDev > 0 ? (rev.total - empMean) / empStdDev : 0;

        if (Math.abs(zScore) >= zScoreThreshold) {
          const isSpike = zScore > 0;
          const deviation = ((rev.total - empMean) / empMean) * 100;

          anomalies.push({
            type: isSpike ? "spike" : "drop",
            entityType: "employee",
            entityId: empId,
            entityName: data.name,
            date: rev.date instanceof Date ? rev.date.toISOString().split('T')[0] : String(rev.date),
            expectedValue: Math.round(empMean),
            actualValue: Math.round(rev.total),
            deviation: Math.round(deviation),
            deviationSigma: Math.round(zScore * 10) / 10,
            confidence: Math.abs(zScore) >= 3 ? "high" : "medium",
            severity: Math.abs(zScore) >= 3 ? "warning" : "info",
            possibleCauses: isSpike
              ? ["أداء استثنائي", "خطأ في الإدخال"]
              : ["غياب جزئي", "مشكلة شخصية", "خطأ في الإدخال"],
            suggestedActions: ["مراجعة البيانات مع المشرف"],
          });
        }
      }
    }
  }

  // ترتيب حسب الخطورة
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  anomalies.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    anomalies,
    statistics: {
      mean: Math.round(mean),
      stdDev: Math.round(stdDev),
      median: Math.round(median),
      analyzedDays: branchRevenues.length,
    },
  };
}

/**
 * 1.2 كشف أنماط التلاعب المحتملة
 */
export async function detectFraudPatterns(
  branchId: number,
  startDate: Date,
  endDate: Date
): Promise<{
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
  patterns: FraudPattern[];
}> {
  const db = await getDb();
  if (!db) throw new Error("فشل الاتصال بقاعدة البيانات");

  const patterns: FraudPattern[] = [];
  let totalRiskScore = 0;

  // جلب بيانات الموظفين
  const employeeData = await db
    .select({
      employeeId: employeeRevenues.employeeId,
      employeeName: employees.name,
      total: employeeRevenues.total,
      date: dailyRevenues.date,
    })
    .from(employeeRevenues)
    .innerJoin(dailyRevenues, eq(employeeRevenues.dailyRevenueId, dailyRevenues.id))
    .innerJoin(employees, eq(employeeRevenues.employeeId, employees.id))
    .where(
      and(
        eq(dailyRevenues.branchId, branchId),
        between(dailyRevenues.date, startDate, endDate)
      )
    );

  // تجميع حسب الموظف
  const employeeMap = new Map<number, { name: string; revenues: number[] }>();
  for (const row of employeeData) {
    if (!employeeMap.has(row.employeeId)) {
      employeeMap.set(row.employeeId, { name: row.employeeName, revenues: [] });
    }
    employeeMap.get(row.employeeId)!.revenues.push(Number(row.total || 0));
  }

  // ═══════════════════════════════════════════════════════════════
  // 1. كشف الأرقام المدورة (Round Numbers)
  // ═══════════════════════════════════════════════════════════════
  for (const [empId, data] of Array.from(employeeMap.entries())) {
    const roundCount = data.revenues.filter((r: number) => r % 50 === 0).length;
    const roundPercent = (roundCount / data.revenues.length) * 100;

    if (roundPercent > 40 && data.revenues.length >= 10) {
      patterns.push({
        patternType: "round_numbers",
        description: `${roundPercent.toFixed(0)}% من الإيرادات أرقام مدورة`,
        affectedEntities: [{ type: "employee", id: empId, name: data.name }],
        confidence: roundPercent > 60 ? "high" : "medium",
        evidence: [
          `${roundCount} من ${data.revenues.length} إيراد منتهي بـ 00 أو 50`,
        ],
        riskLevel: roundPercent > 60 ? "high" : "medium",
        recommendations: [
          "مراجعة الفواتير الأصلية",
          "مقارنة مع نظام الكاشير",
        ],
      });
      totalRiskScore += roundPercent > 60 ? 30 : 15;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. كشف التحايل على حدود البونص (Threshold Gaming)
  // ═══════════════════════════════════════════════════════════════
  const thresholds = [1200, 1500, 1800, 2100, 2400];
  
  // جلب البونصات الأسبوعية
  const weeklyData = await db
    .select({
      employeeId: bonusDetails.employeeId,
      employeeName: employees.name,
      weeklyRevenue: bonusDetails.weeklyRevenue,
    })
    .from(bonusDetails)
    .innerJoin(weeklyBonuses, eq(bonusDetails.weeklyBonusId, weeklyBonuses.id))
    .innerJoin(employees, eq(bonusDetails.employeeId, employees.id))
    .where(
      and(
        eq(weeklyBonuses.branchId, branchId),
        between(weeklyBonuses.createdAt, startDate, endDate)
      )
    );

  // تجميع حسب الموظف
  const weeklyMap = new Map<number, { name: string; revenues: number[] }>();
  for (const row of weeklyData) {
    if (!weeklyMap.has(row.employeeId)) {
      weeklyMap.set(row.employeeId, { name: row.employeeName, revenues: [] });
    }
    weeklyMap.get(row.employeeId)!.revenues.push(Number(row.weeklyRevenue || 0));
  }

  for (const [empId, data] of Array.from(weeklyMap.entries())) {
    if (data.revenues.length < 4) continue;

    let suspiciousCount = 0;
    for (const rev of data.revenues) {
      for (const threshold of thresholds) {
        const diff = rev - threshold;
        if (diff > 0 && diff < 50) {
          suspiciousCount++;
          break;
        }
      }
    }

    const suspiciousPercent = (suspiciousCount / data.revenues.length) * 100;
    if (suspiciousPercent > 50) {
      patterns.push({
        patternType: "threshold_gaming",
        description: "إيرادات أسبوعية دائماً فوق حد البونص بفارق صغير",
        affectedEntities: [{ type: "employee", id: empId, name: data.name }],
        confidence: "high",
        evidence: [
          `${suspiciousPercent.toFixed(0)}% من الأسابيع فوق الحد بأقل من 50 ر.س`,
        ],
        riskLevel: "high",
        recommendations: [
          "مراجعة تفصيلية لإيرادات هذا الموظف",
          "مقارنة مع الفواتير الأصلية",
          "مراقبة مشددة للفترة القادمة",
        ],
      });
      totalRiskScore += 40;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. كشف التكرار المثير للشك (Exact Repetition)
  // ═══════════════════════════════════════════════════════════════
  for (const [empId, data] of Array.from(employeeMap.entries())) {
    if (data.revenues.length < 10) continue;

    const frequencyMap = new Map<number, number>();
    for (const rev of data.revenues) {
      frequencyMap.set(rev, (frequencyMap.get(rev) || 0) + 1);
    }

    for (const [value, count] of Array.from(frequencyMap.entries())) {
      const repeatPercent = (count / data.revenues.length) * 100;
      if (repeatPercent > 30 && count >= 5) {
        patterns.push({
          patternType: "exact_repetition",
          description: `نفس المبلغ (${value} ر.س) يتكرر بشكل مثير للشك`,
          affectedEntities: [{ type: "employee", id: empId, name: data.name }],
          confidence: repeatPercent > 40 ? "high" : "medium",
          evidence: [
            `${value} ر.س تكرر ${count} مرة (${repeatPercent.toFixed(0)}%)`,
          ],
          riskLevel: repeatPercent > 40 ? "high" : "medium",
          recommendations: ["التحقق من تنوع الخدمات المقدمة"],
        });
        totalRiskScore += repeatPercent > 40 ? 25 : 10;
      }
    }
  }

  // حساب مستوى الخطر الإجمالي
  const riskScore = Math.min(100, totalRiskScore);
  const riskLevel: "low" | "medium" | "high" = 
    riskScore >= 60 ? "high" : riskScore >= 30 ? "medium" : "low";

  return { riskScore, riskLevel, patterns };
}

/**
 * 1.3 كشف أنماط أداء الموظفين
 */
export async function detectPerformancePatterns(
  branchId: number,
  analysisDate: Date
): Promise<{
  patterns: PerformancePattern[];
  summary: {
    decliningStars: number;
    risingTalents: number;
    consistentHigh: number;
    consistentLow: number;
    erratic: number;
    plateau: number;
  };
}> {
  const db = await getDb();
  if (!db) throw new Error("فشل الاتصال بقاعدة البيانات");

  const patterns: PerformancePattern[] = [];
  const lookbackDate = new Date(analysisDate);
  lookbackDate.setDate(lookbackDate.getDate() - 60);

  // جلب بيانات الموظفين
  const employeeData = await db
    .select({
      employeeId: employeeRevenues.employeeId,
      employeeName: employees.name,
      total: employeeRevenues.total,
      date: dailyRevenues.date,
    })
    .from(employeeRevenues)
    .innerJoin(dailyRevenues, eq(employeeRevenues.dailyRevenueId, dailyRevenues.id))
    .innerJoin(employees, eq(employeeRevenues.employeeId, employees.id))
    .where(
      and(
        eq(dailyRevenues.branchId, branchId),
        between(dailyRevenues.date, lookbackDate, analysisDate)
      )
    )
    .orderBy(asc(dailyRevenues.date));

  // جلب بيانات البونص
  const bonusData = await db
    .select({
      employeeId: bonusDetails.employeeId,
      bonusAmount: bonusDetails.bonusAmount,
    })
    .from(bonusDetails)
    .innerJoin(weeklyBonuses, eq(bonusDetails.weeklyBonusId, weeklyBonuses.id))
    .where(
      and(
        eq(weeklyBonuses.branchId, branchId),
        between(weeklyBonuses.createdAt, lookbackDate, analysisDate)
      )
    );

  // تجميع حسب الموظف
  const employeeMap = new Map<number, {
    name: string;
    revenues: { date: Date | string; total: number }[];
    bonuses: number[];
  }>();

  for (const row of employeeData) {
    if (!employeeMap.has(row.employeeId)) {
      employeeMap.set(row.employeeId, { name: row.employeeName, revenues: [], bonuses: [] });
    }
    employeeMap.get(row.employeeId)!.revenues.push({
      date: row.date,
      total: Number(row.total || 0),
    });
  }

  for (const row of bonusData) {
    if (employeeMap.has(row.employeeId)) {
      employeeMap.get(row.employeeId)!.bonuses.push(Number(row.bonusAmount || 0));
    }
  }

  // تحليل كل موظف
  for (const [empId, data] of Array.from(employeeMap.entries())) {
    if (data.revenues.length < 14) continue;

    const values = data.revenues.map((r: { date: Date | string; total: number }) => r.total);
    const avgRevenue = values.reduce((a: number, b: number) => a + b, 0) / values.length;

    // حساب الاتجاه (Trend)
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    const firstAvg = firstHalf.reduce((a: number, b: number) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a: number, b: number) => a + b, 0) / secondHalf.length;
    const trend = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;

    // حساب التذبذب (Volatility)
    const variance = values.reduce((sum: number, val: number) => sum + Math.pow(val - avgRevenue, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const volatility = avgRevenue > 0 ? stdDev / avgRevenue : 0;

    // حساب نسبة البونص
    const bonusRate = data.bonuses.length > 0
      ? data.bonuses.filter((b: number) => b > 0).length / data.bonuses.length
      : 0;

    // تحديد النمط
    let pattern: PerformancePattern["pattern"];
    let description: string;
    let recommendations: string[];
    let urgency: PerformancePattern["urgency"];

    if (bonusRate > 0.6 && trend < -15) {
      pattern = "declining_star";
      description = "موظف متميز يتراجع أداؤه";
      recommendations = ["اجتماع فوري لفهم الأسباب", "خطة دعم وتحفيز"];
      urgency = "urgent";
    } else if (trend > 20 && volatility < 0.3) {
      pattern = "rising_talent";
      description = "موظف يُظهر تحسناً مستمراً";
      recommendations = ["تقدير الجهود", "فرص للترقية"];
      urgency = "low";
    } else if (bonusRate > 0.6 && volatility < 0.2) {
      pattern = "consistent_high";
      description = "أداء عالي وثابت";
      recommendations = ["الحفاظ على الدعم", "مشاركة الخبرة"];
      urgency = "low";
    } else if (bonusRate < 0.3 && volatility < 0.2) {
      pattern = "consistent_low";
      description = "أداء منخفض ثابت";
      recommendations = ["تدريب مكثف", "تقييم الملاءمة"];
      urgency = "high";
    } else if (volatility > 0.4) {
      pattern = "erratic";
      description = "أداء متذبذب";
      recommendations = ["خطة استقرار", "متابعة يومية"];
      urgency = "medium";
    } else {
      pattern = "plateau";
      description = "أداء ثابت دون تطور";
      recommendations = ["أهداف جديدة", "تحفيز إضافي"];
      urgency = "medium";
    }

    patterns.push({
      employeeId: empId,
      employeeName: data.name,
      pattern,
      description,
      metrics: {
        avgRevenue: Math.round(avgRevenue),
        trend: Math.round(trend),
        volatility: Math.round(volatility * 100) / 100,
        bonusRate: Math.round(bonusRate * 100) / 100,
      },
      recommendations,
      urgency,
    });
  }

  // ترتيب حسب الأولوية
  const urgencyOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  patterns.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

  // حساب الملخص
  const summary = {
    decliningStars: patterns.filter(p => p.pattern === "declining_star").length,
    risingTalents: patterns.filter(p => p.pattern === "rising_talent").length,
    consistentHigh: patterns.filter(p => p.pattern === "consistent_high").length,
    consistentLow: patterns.filter(p => p.pattern === "consistent_low").length,
    erratic: patterns.filter(p => p.pattern === "erratic").length,
    plateau: patterns.filter(p => p.pattern === "plateau").length,
  };

  return { patterns, summary };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 2: ⚡ تحسين سير العمل
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 2.1 توليد التنبيهات الاستباقية
 */
export async function generateProactiveAlerts(
  branchId: number,
  currentDate: Date
): Promise<{
  alerts: ProactiveAlert[];
  summary: {
    urgent: number;
    critical: number;
    warning: number;
    info: number;
  };
}> {
  const db = await getDb();
  if (!db) throw new Error("فشل الاتصال بقاعدة البيانات");

  const alerts: ProactiveAlert[] = [];

  // حساب بداية ونهاية الأسبوع الحالي
  const dayOfWeek = currentDate.getDay();
  const weekStart = new Date(currentDate);
  weekStart.setDate(currentDate.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  // ═══════════════════════════════════════════════════════════════
  // 1. موظفين قريبين من حد البونص
  // ═══════════════════════════════════════════════════════════════
  const thresholds = [1200, 1500, 1800, 2100, 2400];
  const daysRemaining = Math.max(0, 6 - dayOfWeek);

  const currentWeekRevenues = await db
    .select({
      employeeId: employeeRevenues.employeeId,
      employeeName: employees.name,
      totalRevenue: sql<string>`SUM(${employeeRevenues.total})`,
    })
    .from(employeeRevenues)
    .innerJoin(dailyRevenues, eq(employeeRevenues.dailyRevenueId, dailyRevenues.id))
    .innerJoin(employees, eq(employeeRevenues.employeeId, employees.id))
    .where(
      and(
        eq(dailyRevenues.branchId, branchId),
        between(dailyRevenues.date, weekStart, currentDate)
      )
    )
    .groupBy(employeeRevenues.employeeId, employees.name);

  for (const emp of currentWeekRevenues) {
    const current = Number(emp.totalRevenue || 0);

    for (const threshold of thresholds) {
      const gap = threshold - current;

      // إذا كان قريب من الحد ويمكن تحقيقه
      if (gap > 0 && gap < 300 && daysRemaining > 0) {
        const requiredPerDay = gap / daysRemaining;

        alerts.push({
          id: `bonus-risk-${emp.employeeId}-${threshold}`,
          type: "bonus_at_risk",
          priority: gap < 100 ? "urgent" : "warning",
          title: `${emp.employeeName} قريب من حد البونص`,
          message: `يحتاج ${gap.toFixed(0)} ر.س للوصول للمستوى (${threshold} ر.س)`,
          entity: { type: "employee", id: emp.employeeId, name: emp.employeeName },
          actionRequired: `تحقيق ${requiredPerDay.toFixed(0)} ر.س/يوم في الأيام المتبقية`,
          deadline: weekEnd,
          data: {
            currentRevenue: current,
            targetThreshold: threshold,
            gap,
            daysRemaining,
            requiredPerDay,
          },
        });
        break; // أقرب حد فقط
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. تأخر في إدخال البيانات
  // ═══════════════════════════════════════════════════════════════
  const yesterday = new Date(currentDate);
  yesterday.setDate(yesterday.getDate() - 1);

  const yesterdayData = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(dailyRevenues)
    .where(
      and(
        eq(dailyRevenues.branchId, branchId),
        eq(dailyRevenues.date, yesterday)
      )
    );

  if (Number(yesterdayData[0]?.count || 0) === 0) {
    alerts.push({
      id: `data-delay-${branchId}-${yesterday.toISOString().split('T')[0]}`,
      type: "data_delay",
      priority: "critical",
      title: "لم يتم إدخال بيانات الأمس",
      message: `لا توجد إيرادات مسجلة ليوم ${yesterday.toLocaleDateString("ar-SA")}`,
      entity: { type: "branch", id: branchId, name: `الفرع #${branchId}` },
      actionRequired: "إدخال إيرادات الأمس فوراً",
      deadline: new Date(currentDate.getTime() + 12 * 60 * 60 * 1000),
      data: { missingDate: yesterday.toISOString().split('T')[0] },
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. انخفاض الأداء
  // ═══════════════════════════════════════════════════════════════
  const lookbackStart = new Date(currentDate);
  lookbackStart.setDate(lookbackStart.getDate() - 14);

  const twoWeeksAgo = new Date(currentDate);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 28);

  const recentRevenues = await db
    .select({
      employeeId: employeeRevenues.employeeId,
      employeeName: employees.name,
      total: sql<string>`SUM(${employeeRevenues.total})`,
    })
    .from(employeeRevenues)
    .innerJoin(dailyRevenues, eq(employeeRevenues.dailyRevenueId, dailyRevenues.id))
    .innerJoin(employees, eq(employeeRevenues.employeeId, employees.id))
    .where(
      and(
        eq(dailyRevenues.branchId, branchId),
        between(dailyRevenues.date, lookbackStart, currentDate)
      )
    )
    .groupBy(employeeRevenues.employeeId, employees.name);

  const previousRevenues = await db
    .select({
      employeeId: employeeRevenues.employeeId,
      total: sql<string>`SUM(${employeeRevenues.total})`,
    })
    .from(employeeRevenues)
    .innerJoin(dailyRevenues, eq(employeeRevenues.dailyRevenueId, dailyRevenues.id))
    .where(
      and(
        eq(dailyRevenues.branchId, branchId),
        between(dailyRevenues.date, twoWeeksAgo, lookbackStart)
      )
    )
    .groupBy(employeeRevenues.employeeId);

  const previousMap = new Map(previousRevenues.map(p => [p.employeeId, Number(p.total || 0)]));

  for (const emp of recentRevenues) {
    const recent = Number(emp.total || 0);
    const previous = previousMap.get(emp.employeeId) || 0;

    if (previous > 0) {
      const changePercent = ((recent - previous) / previous) * 100;

      if (changePercent < -20) {
        alerts.push({
          id: `perf-drop-${emp.employeeId}`,
          type: "performance_drop",
          priority: changePercent < -40 ? "critical" : "warning",
          title: `انخفاض أداء ${emp.employeeName}`,
          message: `انخفض الإيراد بنسبة ${Math.abs(changePercent).toFixed(0)}% مقارنة بالفترة السابقة`,
          entity: { type: "employee", id: emp.employeeId, name: emp.employeeName },
          actionRequired: "مراجعة أسباب التراجع واتخاذ إجراء",
          data: {
            recentTotal: recent,
            previousTotal: previous,
            changePercent,
          },
        });
      }
    }
  }

  // حساب الملخص
  const summary = {
    urgent: alerts.filter(a => a.priority === "urgent").length,
    critical: alerts.filter(a => a.priority === "critical").length,
    warning: alerts.filter(a => a.priority === "warning").length,
    info: alerts.filter(a => a.priority === "info").length,
  };

  // ترتيب حسب الأولوية
  const priorityOrder = { urgent: 0, critical: 1, warning: 2, info: 3 };
  alerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return { alerts, summary };
}

/**
 * 2.2 توليد التوصيات الذكية
 */
export async function generateSmartRecommendations(
  branchId: number,
  analysisDate: Date
): Promise<{
  recommendations: SmartRecommendation[];
  summary: {
    total: number;
    byType: Record<string, number>;
    byPriority: Record<string, number>;
    estimatedImpact: number;
  };
}> {
  const db = await getDb();
  if (!db) throw new Error("فشل الاتصال بقاعدة البيانات");

  const recommendations: SmartRecommendation[] = [];

  // حساب بداية ونهاية الأسبوع
  const dayOfWeek = analysisDate.getDay();
  const weekStart = new Date(analysisDate);
  weekStart.setDate(analysisDate.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);

  const daysRemaining = Math.max(0, 6 - dayOfWeek);

  // ═══════════════════════════════════════════════════════════════
  // 1. فرص الموظفين القريبين من البونص
  // ═══════════════════════════════════════════════════════════════
  const thresholds = [1200, 1500, 1800, 2100, 2400];
  const bonusAmounts = [35, 60, 100, 150, 200];

  const currentWeekRevenues = await db
    .select({
      employeeId: employeeRevenues.employeeId,
      employeeName: employees.name,
      totalRevenue: sql<string>`SUM(${employeeRevenues.total})`,
    })
    .from(employeeRevenues)
    .innerJoin(dailyRevenues, eq(employeeRevenues.dailyRevenueId, dailyRevenues.id))
    .innerJoin(employees, eq(employeeRevenues.employeeId, employees.id))
    .where(
      and(
        eq(dailyRevenues.branchId, branchId),
        between(dailyRevenues.date, weekStart, analysisDate)
      )
    )
    .groupBy(employeeRevenues.employeeId, employees.name);

  const nearThresholdEmployees: Array<{
    id: number;
    name: string;
    current: number;
    target: number;
    gap: number;
    potentialBonus: number;
  }> = [];

  for (const emp of currentWeekRevenues) {
    const current = Number(emp.totalRevenue || 0);

    for (let i = 0; i < thresholds.length; i++) {
      const gap = thresholds[i] - current;
      if (gap > 0 && gap < 200 && daysRemaining > 0) {
        nearThresholdEmployees.push({
          id: emp.employeeId,
          name: emp.employeeName,
          current,
          target: thresholds[i],
          gap,
          potentialBonus: bonusAmounts[i],
        });
        break;
      }
    }
  }

  if (nearThresholdEmployees.length > 0) {
    const totalPotentialBonus = nearThresholdEmployees.reduce((sum, e) => sum + e.potentialBonus, 0);

    recommendations.push({
      id: "rec-near-threshold",
      type: "opportunity",
      priority: "warning",
      title: `${nearThresholdEmployees.length} موظفين قريبين من حد البونص`,
      description: `يمكن زيادة إجمالي البونص بـ ${totalPotentialBonus} ر.س بتحفيز هؤلاء الموظفين`,
      impact: {
        metric: "total_bonus",
        currentValue: 0,
        potentialValue: totalPotentialBonus,
        improvement: totalPotentialBonus,
        improvementPercent: 100,
      },
      actionItems: nearThresholdEmployees.map(e => ({
        action: `${e.name}: يحتاج ${e.gap} ر.س للوصول لـ ${e.target}`,
        effort: "low" as const,
        timeline: `${daysRemaining} أيام متبقية`,
      })),
      affectedEntities: nearThresholdEmployees.map(e => ({
        type: "employee",
        id: e.id,
        name: e.name,
      })),
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. تحذير البيانات الناقصة
  // ═══════════════════════════════════════════════════════════════
  const yesterday = new Date(analysisDate);
  yesterday.setDate(yesterday.getDate() - 1);

  const yesterdayData = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(dailyRevenues)
    .where(
      and(
        eq(dailyRevenues.branchId, branchId),
        eq(dailyRevenues.date, yesterday)
      )
    );

  if (Number(yesterdayData[0]?.count || 0) === 0) {
    recommendations.push({
      id: "rec-missing-data",
      type: "action_required",
      priority: "critical",
      title: "بيانات الأمس غير مكتملة",
      description: "لم يتم إدخال إيرادات الأمس مما قد يؤثر على حساب البونص",
      impact: {
        metric: "data_completeness",
        currentValue: 0,
        potentialValue: 100,
        improvement: 100,
        improvementPercent: 100,
      },
      actionItems: [
        {
          action: "إدخال إيرادات الأمس فوراً",
          effort: "low",
          timeline: "اليوم",
        },
      ],
      affectedEntities: [{ type: "branch", id: branchId, name: `الفرع #${branchId}` }],
    });
  }

  // حساب الملخص
  const summary = {
    total: recommendations.length,
    byType: {} as Record<string, number>,
    byPriority: {} as Record<string, number>,
    estimatedImpact: 0,
  };

  for (const rec of recommendations) {
    summary.byType[rec.type] = (summary.byType[rec.type] || 0) + 1;
    summary.byPriority[rec.priority] = (summary.byPriority[rec.priority] || 0) + 1;
    summary.estimatedImpact += rec.impact.improvement;
  }

  return { recommendations, summary };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 3: 🤖 محرك الأتمتة
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 3.1 تنفيذ التصحيح التلقائي
 */
export async function executeAutoCorrection(
  branchId: number,
  correctionType: "recalculate" | "fix_negatives" | "remove_duplicates" | "fix_orphans"
): Promise<{
  success: boolean;
  message: string;
  corrections: Array<{
    entity: string;
    entityId: number;
    issue: string;
    action: string;
    oldValue?: unknown;
    newValue?: unknown;
  }>;
  summary: { checked: number; corrected: number; failed: number };
}> {
  const db = await getDb();
  if (!db) throw new Error("فشل الاتصال بقاعدة البيانات");

  const corrections: Array<{
    entity: string;
    entityId: number;
    issue: string;
    action: string;
    oldValue?: unknown;
    newValue?: unknown;
  }> = [];

  let checked = 0;
  let corrected = 0;
  let failed = 0;

  try {
    switch (correctionType) {
      case "recalculate":
        // إعادة حساب جميع البونصات للشهر الحالي
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        const bonuses = await db
          .select()
          .from(weeklyBonuses)
          .where(
            and(
              eq(weeklyBonuses.branchId, branchId),
              eq(weeklyBonuses.month, month),
              eq(weeklyBonuses.year, year)
            )
          );

        checked = bonuses.length;

        for (const bonus of bonuses) {
          const details = await db
            .select({
              sum: sql<string>`SUM(${bonusDetails.bonusAmount})`,
            })
            .from(bonusDetails)
            .where(eq(bonusDetails.weeklyBonusId, bonus.id));

          const correctTotal = Number(details[0]?.sum || 0);
          const currentTotal = Number(bonus.totalAmount || 0);

          if (Math.abs(correctTotal - currentTotal) > 0.01) {
            await db
              .update(weeklyBonuses)
              .set({ totalAmount: correctTotal.toFixed(2) })
              .where(eq(weeklyBonuses.id, bonus.id));

            corrections.push({
              entity: "weekly_bonus",
              entityId: bonus.id,
              issue: "إجمالي غير صحيح",
              action: "تصحيح الإجمالي",
              oldValue: currentTotal,
              newValue: correctTotal,
            });
            corrected++;
          }
        }
        break;

      case "fix_negatives":
        // تصحيح القيم السالبة
        const negatives = await db
          .select()
          .from(employeeRevenues)
          .innerJoin(dailyRevenues, eq(employeeRevenues.dailyRevenueId, dailyRevenues.id))
          .where(
            and(
              eq(dailyRevenues.branchId, branchId),
              sql`CAST(${employeeRevenues.total} AS DECIMAL) < 0`
            )
          );

        checked = negatives.length;

        for (const neg of negatives) {
          await db
            .update(employeeRevenues)
            .set({ total: "0.00" })
            .where(eq(employeeRevenues.id, neg.employeeRevenues.id));

          corrections.push({
            entity: "employee_revenue",
            entityId: neg.employeeRevenues.id,
            issue: "قيمة سالبة",
            action: "تصفير القيمة",
            oldValue: neg.employeeRevenues.total,
            newValue: 0,
          });
          corrected++;
        }
        break;

      case "remove_duplicates":
        // حذف السجلات المكررة
        const duplicates = await db.execute(sql`
          SELECT er1.id, er1.employee_id, er1.daily_revenue_id
          FROM employee_revenues er1
          INNER JOIN employee_revenues er2 
            ON er1.employee_id = er2.employee_id 
            AND er1.daily_revenue_id = er2.daily_revenue_id
            AND er1.id > er2.id
          INNER JOIN daily_revenues dr ON er1.daily_revenue_id = dr.id
          WHERE dr.branch_id = ${branchId}
        `);

        const dupRows = (duplicates as unknown as any[][])[0] || [];
        checked = dupRows.length;

        for (const dup of dupRows) {
          await db
            .delete(employeeRevenues)
            .where(eq(employeeRevenues.id, dup.id));

          corrections.push({
            entity: "employee_revenue",
            entityId: dup.id,
            issue: "سجل مكرر",
            action: "حذف",
          });
          corrected++;
        }
        break;

      case "fix_orphans":
        // حذف السجلات اليتيمة
        const orphans = await db
          .select({ id: bonusDetails.id })
          .from(bonusDetails)
          .leftJoin(weeklyBonuses, eq(bonusDetails.weeklyBonusId, weeklyBonuses.id))
          .where(isNull(weeklyBonuses.id));

        checked = orphans.length;

        for (const orphan of orphans) {
          await db
            .delete(bonusDetails)
            .where(eq(bonusDetails.id, orphan.id));

          corrections.push({
            entity: "bonus_detail",
            entityId: orphan.id,
            issue: "سجل يتيم",
            action: "حذف",
          });
          corrected++;
        }
        break;
    }

    return {
      success: true,
      message: `تم التصحيح بنجاح: ${corrected} من ${checked}`,
      corrections,
      summary: { checked, corrected, failed },
    };

  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "خطأ غير معروف",
      corrections,
      summary: { checked, corrected, failed: checked - corrected },
    };
  }
}

/**
 * 3.2 فحص سلامة البيانات
 */
export async function checkDataIntegrity(
  branchId?: number
): Promise<{
  isHealthy: boolean;
  issues: Array<{
    type: string;
    severity: "low" | "medium" | "high";
    description: string;
    affectedCount: number;
    recommendation: string;
  }>;
  summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
  };
}> {
  const db = await getDb();
  if (!db) throw new Error("فشل الاتصال بقاعدة البيانات");

  const issues: Array<{
    type: string;
    severity: "low" | "medium" | "high";
    description: string;
    affectedCount: number;
    recommendation: string;
  }> = [];

  let totalChecks = 0;
  let passedChecks = 0;

  // ═══════════════════════════════════════════════════════════════
  // 1. فحص القيم السالبة
  // ═══════════════════════════════════════════════════════════════
  totalChecks++;
  const negativeCheck = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(employeeRevenues)
    .where(sql`CAST(${employeeRevenues.total} AS DECIMAL) < 0`);

  const negativeCount = Number(negativeCheck[0]?.count || 0);
  if (negativeCount > 0) {
    issues.push({
      type: "negative_values",
      severity: "high",
      description: `يوجد ${negativeCount} سجل بقيم سالبة`,
      affectedCount: negativeCount,
      recommendation: "تشغيل التصحيح التلقائي (fix_negatives)",
    });
  } else {
    passedChecks++;
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. فحص السجلات اليتيمة
  // ═══════════════════════════════════════════════════════════════
  totalChecks++;
  const orphanCheck = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(bonusDetails)
    .leftJoin(weeklyBonuses, eq(bonusDetails.weeklyBonusId, weeklyBonuses.id))
    .where(isNull(weeklyBonuses.id));

  const orphanCount = Number(orphanCheck[0]?.count || 0);
  if (orphanCount > 0) {
    issues.push({
      type: "orphan_records",
      severity: "medium",
      description: `يوجد ${orphanCount} سجل بونص يتيم`,
      affectedCount: orphanCount,
      recommendation: "تشغيل التصحيح التلقائي (fix_orphans)",
    });
  } else {
    passedChecks++;
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. فحص تطابق الإجماليات
  // ═══════════════════════════════════════════════════════════════
  totalChecks++;
  const mismatchQuery = await db.execute(sql`
    SELECT wb.id, wb.total_amount as recorded,
           COALESCE(SUM(bd.bonus_amount), 0) as calculated
    FROM weekly_bonuses wb
    LEFT JOIN bonus_details bd ON wb.id = bd.weekly_bonus_id
    ${branchId ? sql`WHERE wb.branch_id = ${branchId}` : sql``}
    GROUP BY wb.id, wb.total_amount
    HAVING ABS(CAST(wb.total_amount AS DECIMAL) - COALESCE(SUM(bd.bonus_amount), 0)) > 0.01
  `);

  const mismatchRows = (mismatchQuery as unknown as any[][])[0] || [];
  if (mismatchRows.length > 0) {
    issues.push({
      type: "total_mismatch",
      severity: "high",
      description: `يوجد ${mismatchRows.length} بونص بإجمالي غير متطابق`,
      affectedCount: mismatchRows.length,
      recommendation: "تشغيل التصحيح التلقائي (recalculate)",
    });
  } else {
    passedChecks++;
  }

  return {
    isHealthy: issues.length === 0,
    issues,
    summary: {
      totalChecks,
      passedChecks,
      failedChecks: totalChecks - passedChecks,
    },
  };
}
