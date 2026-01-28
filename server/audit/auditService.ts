/**
 * Audit Service - خدمة التدقيق والامتثال
 * تسجيل جميع العمليات الحساسة وكشف الشذوذ
 */

import { getDb } from "../db";
import { auditEvents, complianceViolations, InsertAuditEvent, InsertComplianceViolation } from "../../drizzle/schema";
import { eq, desc, and, gte, lte, count } from "drizzle-orm";

// ==================== أنواع البيانات ====================

export type AuditEventType = 
  | "create" | "update" | "delete" | "view" | "export" | "import"
  | "login" | "logout" | "login_failed" | "password_change"
  | "approval" | "rejection" | "payment" | "transfer"
  | "config_change" | "permission_change" | "bulk_operation";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface AuditContext {
  userId?: number;
  userName?: string;
  userRole?: string;
  userBranchId?: number;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

export interface AuditEventInput {
  eventType: AuditEventType;
  entityType: string;
  entityId?: number;
  entityName?: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  description?: string;
  context: AuditContext;
}

// ==================== تصنيف المخاطر ====================

const RISK_CLASSIFICATION: Record<string, RiskLevel> = {
  // عمليات عالية المخاطر
  "delete:employee": "high",
  "delete:payroll": "critical",
  "delete:revenue": "critical",
  "delete:expense": "high",
  "update:payroll": "high",
  "update:salary": "high",
  "bulk_operation:any": "high",
  "payment:any": "high",
  "transfer:any": "high",
  "permission_change:any": "critical",
  "config_change:any": "high",
  
  // عمليات متوسطة المخاطر
  "update:employee": "medium",
  "update:revenue": "medium",
  "update:expense": "medium",
  "create:expense": "medium",
  "approval:any": "medium",
  "rejection:any": "medium",
  "export:any": "medium",
  
  // عمليات منخفضة المخاطر
  "create:employee": "low",
  "create:revenue": "low",
  "view:any": "low",
  "login:any": "low",
  "logout:any": "low",
};

function classifyRisk(eventType: AuditEventType, entityType: string): RiskLevel {
  const specificKey = `${eventType}:${entityType}`;
  const genericKey = `${eventType}:any`;
  
  return RISK_CLASSIFICATION[specificKey] 
    || RISK_CLASSIFICATION[genericKey] 
    || "low";
}

// ==================== كشف الشذوذ ====================

interface InternalAnomalyResult {
  isAnomaly: boolean;
  score: number;
  reason?: string;
}

async function detectAnomaly(
  eventType: AuditEventType,
  entityType: string,
  context: AuditContext,
  newData?: Record<string, unknown>
): Promise<InternalAnomalyResult> {
  const db = await getDb();
  if (!db) return { isAnomaly: false, score: 0 };
  
  const anomalies: { score: number; reason: string }[] = [];
  
  // 1. كشف تسجيل الدخول من IP جديد
  if (eventType === "login" && context.userId && context.ipAddress) {
    const recentLogins = await db.select()
      .from(auditEvents)
      .where(and(
        eq(auditEvents.userId, context.userId),
        eq(auditEvents.eventType, "login"),
        gte(auditEvents.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      ))
      .limit(100);
    
    const knownIPs = new Set(recentLogins.map((l) => l.ipAddress));
    if (!knownIPs.has(context.ipAddress) && knownIPs.size > 0) {
      anomalies.push({ score: 60, reason: `تسجيل دخول من IP جديد: ${context.ipAddress}` });
    }
  }
  
  // 2. كشف العمليات خارج ساعات العمل
  const hour = new Date().getHours();
  if (hour < 6 || hour > 23) {
    if (["delete", "update", "bulk_operation", "payment"].includes(eventType)) {
      anomalies.push({ score: 40, reason: `عملية ${eventType} خارج ساعات العمل (${hour}:00)` });
    }
  }
  
  // 3. كشف العمليات المتكررة بشكل غير طبيعي
  if (context.userId) {
    const recentSameOps = await db.select({ count: count() })
      .from(auditEvents)
      .where(and(
        eq(auditEvents.userId, context.userId),
        eq(auditEvents.eventType, eventType),
        eq(auditEvents.entityType, entityType),
        gte(auditEvents.createdAt, new Date(Date.now() - 60 * 60 * 1000))
      ));
    
    const opCount = recentSameOps[0]?.count || 0;
    if (opCount > 50) {
      anomalies.push({ score: 70, reason: `${opCount} عملية ${eventType} على ${entityType} في الساعة الأخيرة` });
    }
  }
  
  // 4. كشف التغييرات الكبيرة في القيم المالية
  if (newData && (entityType === "expense" || entityType === "revenue" || entityType === "payroll")) {
    const amount = Number(newData.amount || newData.total || 0);
    if (amount > 100000) {
      anomalies.push({ score: 50, reason: `مبلغ كبير: ${amount.toLocaleString()} ر.س` });
    }
  }
  
  // 5. كشف محاولات تسجيل الدخول الفاشلة المتكررة
  if (eventType === "login_failed" && context.ipAddress) {
    const recentFailures = await db.select({ count: count() })
      .from(auditEvents)
      .where(and(
        eq(auditEvents.eventType, "login_failed"),
        eq(auditEvents.ipAddress, context.ipAddress),
        gte(auditEvents.createdAt, new Date(Date.now() - 15 * 60 * 1000))
      ));
    
    const failCount = recentFailures[0]?.count || 0;
    if (failCount >= 5) {
      anomalies.push({ score: 90, reason: `${failCount} محاولات دخول فاشلة من ${context.ipAddress}` });
    }
  }
  
  // حساب النتيجة النهائية
  if (anomalies.length === 0) {
    return { isAnomaly: false, score: 0 };
  }
  
  const maxScore = Math.max(...anomalies.map(a => a.score));
  const reasons = anomalies.map(a => a.reason).join(" | ");
  
  return {
    isAnomaly: maxScore >= 50,
    score: maxScore,
    reason: reasons
  };
}

// ==================== تسجيل الأحداث ====================

export async function logAuditEvent(input: AuditEventInput): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const { eventType, entityType, entityId, entityName, oldData, newData, description, context } = input;
  
  // تحديد الحقول المتغيرة
  let changedFields: string[] = [];
  if (oldData && newData) {
    changedFields = Object.keys(newData).filter(key => 
      JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])
    );
  }
  
  // تصنيف المخاطر
  const riskLevel = classifyRisk(eventType, entityType);
  
  // كشف الشذوذ
  const anomaly = await detectAnomaly(eventType, entityType, context, newData);
  
  // إنشاء سجل التدقيق
  const auditRecord: InsertAuditEvent = {
    userId: context.userId,
    userName: context.userName,
    userRole: context.userRole,
    userBranchId: context.userBranchId,
    eventType,
    entityType,
    entityId,
    entityName,
    oldData: oldData || null,
    newData: newData || null,
    changedFields: changedFields.length > 0 ? changedFields : null,
    description,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    sessionId: context.sessionId,
    riskLevel,
    isAnomaly: anomaly.isAnomaly,
    anomalyScore: anomaly.score > 0 ? String(anomaly.score) : null,
    anomalyReason: anomaly.reason,
    reviewStatus: anomaly.isAnomaly ? "pending" : undefined,
  };
  
  const [result] = await db.insert(auditEvents).values(auditRecord);
  
  // إذا كان هناك شذوذ عالي، أنشئ مخالفة امتثال
  if (anomaly.isAnomaly && anomaly.score >= 70) {
    await createComplianceViolation({
      ruleId: 0,
      ruleCode: "AUTO_ANOMALY",
      ruleName: "كشف الشذوذ التلقائي",
      violationType: "data_anomaly",
      severity: anomaly.score >= 90 ? "critical" : "warning",
      entityType,
      entityId,
      entityName,
      userId: context.userId,
      userName: context.userName,
      branchId: context.userBranchId,
      description: anomaly.reason || "تم كشف نشاط غير طبيعي",
      evidence: { auditEventId: result.insertId, anomalyScore: anomaly.score },
    });
  }
  
  return result.insertId;
}

// ==================== إنشاء مخالفة امتثال ====================

export async function createComplianceViolation(input: {
  ruleId: number;
  ruleCode: string;
  ruleName: string;
  violationType: "threshold_exceeded" | "unauthorized_access" | "policy_breach" | "data_anomaly" | "timing_violation" | "approval_bypass";
  severity: "info" | "warning" | "violation" | "critical";
  entityType: string;
  entityId?: number;
  entityName?: string;
  userId?: number;
  userName?: string;
  branchId?: number;
  description: string;
  evidence?: Record<string, unknown>;
}): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const violation: InsertComplianceViolation = {
    ruleId: input.ruleId,
    ruleCode: input.ruleCode,
    ruleName: input.ruleName,
    violationType: input.violationType,
    severity: input.severity,
    entityType: input.entityType,
    entityId: input.entityId,
    entityName: input.entityName,
    userId: input.userId,
    userName: input.userName,
    branchId: input.branchId,
    description: input.description,
    evidence: input.evidence || null,
    status: "open",
  };
  
  const [result] = await db.insert(complianceViolations).values(violation);
  return result.insertId;
}

// ==================== استعلامات التدقيق ====================

export async function getAuditEvents(options: {
  userId?: number;
  entityType?: string;
  eventType?: AuditEventType;
  riskLevel?: RiskLevel;
  isAnomaly?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  
  if (options.userId) conditions.push(eq(auditEvents.userId, options.userId));
  if (options.entityType) conditions.push(eq(auditEvents.entityType, options.entityType));
  if (options.eventType) conditions.push(eq(auditEvents.eventType, options.eventType));
  if (options.riskLevel) conditions.push(eq(auditEvents.riskLevel, options.riskLevel));
  if (options.isAnomaly !== undefined) conditions.push(eq(auditEvents.isAnomaly, options.isAnomaly));
  if (options.startDate) conditions.push(gte(auditEvents.createdAt, options.startDate));
  if (options.endDate) conditions.push(lte(auditEvents.createdAt, options.endDate));
  
  const events = await db.select()
    .from(auditEvents)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditEvents.createdAt))
    .limit(options.limit || 100)
    .offset(options.offset || 0);
  
  return events;
}

export async function getComplianceViolations(options: {
  status?: "open" | "investigating" | "resolved" | "dismissed" | "escalated";
  severity?: "info" | "warning" | "violation" | "critical";
  branchId?: number;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  
  if (options.status) conditions.push(eq(complianceViolations.status, options.status));
  if (options.severity) conditions.push(eq(complianceViolations.severity, options.severity));
  if (options.branchId) conditions.push(eq(complianceViolations.branchId, options.branchId));
  if (options.startDate) conditions.push(gte(complianceViolations.createdAt, options.startDate));
  if (options.endDate) conditions.push(lte(complianceViolations.createdAt, options.endDate));
  
  const violations = await db.select()
    .from(complianceViolations)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(complianceViolations.createdAt))
    .limit(options.limit || 100)
    .offset(options.offset || 0);
  
  return violations;
}

// ==================== إحصائيات التدقيق ====================

export async function getAuditStatistics(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return {
    totalEvents: 0,
    byRiskLevel: {},
    anomaliesDetected: 0,
    openViolations: 0,
    violationsBySeverity: {},
  };
  
  // إجمالي الأحداث
  const totalEvents = await db.select({ count: count() })
    .from(auditEvents)
    .where(and(
      gte(auditEvents.createdAt, startDate),
      lte(auditEvents.createdAt, endDate)
    ));
  
  // الأحداث حسب مستوى المخاطر
  const byRiskLevel = await db.select({
    riskLevel: auditEvents.riskLevel,
    count: count()
  })
    .from(auditEvents)
    .where(and(
      gte(auditEvents.createdAt, startDate),
      lte(auditEvents.createdAt, endDate)
    ))
    .groupBy(auditEvents.riskLevel);
  
  // الشذوذ المكتشف
  const anomalies = await db.select({ count: count() })
    .from(auditEvents)
    .where(and(
      gte(auditEvents.createdAt, startDate),
      lte(auditEvents.createdAt, endDate),
      eq(auditEvents.isAnomaly, true)
    ));
  
  // المخالفات المفتوحة
  const openViolations = await db.select({ count: count() })
    .from(complianceViolations)
    .where(eq(complianceViolations.status, "open"));
  
  // المخالفات حسب الخطورة
  const violationsBySeverity = await db.select({
    severity: complianceViolations.severity,
    count: count()
  })
    .from(complianceViolations)
    .where(and(
      gte(complianceViolations.createdAt, startDate),
      lte(complianceViolations.createdAt, endDate)
    ))
    .groupBy(complianceViolations.severity);
  
  return {
    totalEvents: totalEvents[0]?.count || 0,
    byRiskLevel: Object.fromEntries(byRiskLevel.map((r) => [r.riskLevel, r.count])),
    anomaliesDetected: anomalies[0]?.count || 0,
    openViolations: openViolations[0]?.count || 0,
    violationsBySeverity: Object.fromEntries(violationsBySeverity.map((v) => [v.severity, v.count])),
  };
}

// ==================== تحديث حالة المخالفة ====================

export async function updateViolationStatus(
  violationId: number,
  status: "investigating" | "resolved" | "dismissed" | "escalated",
  userId: number,
  resolution?: string
) {
  const db = await getDb();
  if (!db) return;
  
  const updateData: Partial<InsertComplianceViolation> = {
    status,
  };
  
  if (status === "resolved") {
    updateData.resolvedBy = userId;
    updateData.resolvedAt = new Date();
    updateData.resolution = resolution;
  }
  
  await db.update(complianceViolations)
    .set(updateData)
    .where(eq(complianceViolations.id, violationId));
}

// ==================== مراجعة حدث التدقيق ====================

export async function reviewAuditEvent(
  eventId: number,
  reviewerId: number,
  status: "reviewed" | "flagged" | "resolved",
  notes?: string
) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(auditEvents)
    .set({
      reviewStatus: status,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      reviewNotes: notes,
    })
    .where(eq(auditEvents.id, eventId));
}


// ==================== كشف الشذوذ ====================

export interface AnomalyResult {
  type: string;
  severity: RiskLevel;
  description: string;
  expectedValue: string;
  actualValue: string;
  recommendation: string;
  detectedAt: Date;
}

export async function detectAnomalies(year: number, month: number): Promise<AnomalyResult[]> {
  const db = await getDb();
  if (!db) return [];
  
  const anomalies: AnomalyResult[] = [];
  
  // تحليل الأحداث عالية المخاطر
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  const highRiskEvents = await db.select()
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.riskLevel, "critical"),
        gte(auditEvents.createdAt, startDate),
        lte(auditEvents.createdAt, endDate)
      )
    );
  
  if (highRiskEvents.length > 5) {
    anomalies.push({
      type: "عمليات عالية المخاطر",
      severity: "high",
      description: `تم اكتشاف ${highRiskEvents.length} عملية عالية المخاطر هذا الشهر`,
      expectedValue: "أقل من 5",
      actualValue: String(highRiskEvents.length),
      recommendation: "مراجعة العمليات عالية المخاطر والتأكد من صحتها",
      detectedAt: new Date(),
    });
  }
  
  // تحليل محاولات الدخول الفاشلة
  const failedLogins = await db.select()
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.eventType, "login_failed"),
        gte(auditEvents.createdAt, startDate),
        lte(auditEvents.createdAt, endDate)
      )
    );
  
  if (failedLogins.length > 10) {
    anomalies.push({
      type: "محاولات دخول فاشلة",
      severity: "medium",
      description: `تم اكتشاف ${failedLogins.length} محاولة دخول فاشلة`,
      expectedValue: "أقل من 10",
      actualValue: String(failedLogins.length),
      recommendation: "التحقق من أمان الحسابات وتفعيل المصادقة الثنائية",
      detectedAt: new Date(),
    });
  }
  
  // تحليل عمليات الحذف الجماعي
  const bulkDeletes = await db.select()
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.eventType, "bulk_operation"),
        gte(auditEvents.createdAt, startDate),
        lte(auditEvents.createdAt, endDate)
      )
    );
  
  if (bulkDeletes.length > 3) {
    anomalies.push({
      type: "عمليات جماعية",
      severity: "medium",
      description: `تم تنفيذ ${bulkDeletes.length} عملية جماعية`,
      expectedValue: "أقل من 3",
      actualValue: String(bulkDeletes.length),
      recommendation: "مراجعة العمليات الجماعية والتأكد من الحاجة إليها",
      detectedAt: new Date(),
    });
  }
  
  return anomalies;
}

// ==================== تقرير الامتثال ====================

export interface ComplianceCategory {
  name: string;
  score: number;
  passed: number;
  total: number;
}

export interface ComplianceIssue {
  title: string;
  description: string;
  severity: RiskLevel;
}

export interface ComplianceReport {
  overallScore: number;
  categories: ComplianceCategory[];
  issues: ComplianceIssue[];
  generatedAt: Date;
}

export async function generateComplianceReport(year: number, month: number): Promise<ComplianceReport> {
  const db = await getDb();
  if (!db) {
    return {
      overallScore: 0,
      categories: [],
      issues: [],
      generatedAt: new Date(),
    };
  }
  
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  const categories: ComplianceCategory[] = [];
  const issues: ComplianceIssue[] = [];
  
  // 1. فحص تسجيل الأحداث
  const totalEvents = await db.select({ count: count() })
    .from(auditEvents)
    .where(
      and(
        gte(auditEvents.createdAt, startDate),
        lte(auditEvents.createdAt, endDate)
      )
    );
  
  const auditScore = totalEvents[0]?.count > 0 ? 100 : 50;
  categories.push({
    name: "تسجيل الأحداث",
    score: auditScore,
    passed: auditScore === 100 ? 1 : 0,
    total: 1,
  });
  
  // 2. فحص مراجعة الأحداث
  const reviewedEvents = await db.select({ count: count() })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.reviewStatus, "reviewed"),
        gte(auditEvents.createdAt, startDate),
        lte(auditEvents.createdAt, endDate)
      )
    );
  
  const reviewScore = totalEvents[0]?.count > 0 
    ? Math.round((reviewedEvents[0]?.count / totalEvents[0]?.count) * 100)
    : 100;
  categories.push({
    name: "مراجعة الأحداث",
    score: reviewScore,
    passed: reviewScore >= 80 ? 1 : 0,
    total: 1,
  });
  
  if (reviewScore < 80) {
    issues.push({
      title: "أحداث غير مراجعة",
      description: `${100 - reviewScore}% من الأحداث لم تتم مراجعتها`,
      severity: "medium",
    });
  }
  
  // 3. فحص الانتهاكات
  const violations = await db.select({ count: count() })
    .from(complianceViolations)
    .where(
      and(
        eq(complianceViolations.status, "open"),
        gte(complianceViolations.createdAt, startDate),
        lte(complianceViolations.createdAt, endDate)
      )
    );
  
  const violationScore = violations[0]?.count === 0 ? 100 : Math.max(0, 100 - violations[0]?.count * 10);
  categories.push({
    name: "الانتهاكات المفتوحة",
    score: violationScore,
    passed: violationScore >= 80 ? 1 : 0,
    total: 1,
  });
  
  if (violations[0]?.count > 0) {
    issues.push({
      title: "انتهاكات مفتوحة",
      description: `يوجد ${violations[0]?.count} انتهاك مفتوح يحتاج معالجة`,
      severity: violations[0]?.count > 5 ? "high" : "medium",
    });
  }
  
  // 4. فحص الأمان
  const criticalEvents = await db.select({ count: count() })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.riskLevel, "critical"),
        gte(auditEvents.createdAt, startDate),
        lte(auditEvents.createdAt, endDate)
      )
    );
  
  const securityScore = criticalEvents[0]?.count === 0 ? 100 : Math.max(0, 100 - criticalEvents[0]?.count * 5);
  categories.push({
    name: "الأمان",
    score: securityScore,
    passed: securityScore >= 80 ? 1 : 0,
    total: 1,
  });
  
  if (criticalEvents[0]?.count > 0) {
    issues.push({
      title: "أحداث أمنية حرجة",
      description: `تم تسجيل ${criticalEvents[0]?.count} حدث أمني حرج`,
      severity: "high",
    });
  }
  
  // حساب النتيجة الإجمالية
  const overallScore = categories.length > 0
    ? Math.round(categories.reduce((sum, cat) => sum + cat.score, 0) / categories.length)
    : 0;
  
  return {
    overallScore,
    categories,
    issues,
    generatedAt: new Date(),
  };
}
