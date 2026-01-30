/**
 * نظام الصلاحيات الذكي
 * Smart Permissions System
 * 
 * صلاحيات ديناميكية تتكيف مع السياق والظروف
 * مع كشف الأنماط غير الطبيعية وتصعيد تلقائي
 */

import { getDb } from "../db";
import { invokeLLM } from "../_core/llm";
import { 
  users, employees, branches, invoices, expenses,
  activityLogs, securityAlerts, auditEvents
} from "../../drizzle/schema";
import { eq, and, gte, lte, desc, sql, count } from "drizzle-orm";

// ==================== أنواع البيانات ====================

export interface PermissionContext {
  userId: number;
  userRole: string;
  branchId?: number;
  action: string;
  resource: string;
  resourceId?: number;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

export interface PermissionDecision {
  allowed: boolean;
  reason: string;
  conditions?: PermissionCondition[];
  requiresApproval?: boolean;
  approvalLevel?: string;
  expiresAt?: Date;
  auditRequired: boolean;
  riskScore: number;
}

export interface PermissionCondition {
  type: 'time' | 'amount' | 'frequency' | 'location' | 'approval';
  description: string;
  value: any;
  operator: 'eq' | 'gt' | 'lt' | 'between' | 'in';
}

export interface AnomalyDetectionResult {
  isAnomaly: boolean;
  anomalyType?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: string[];
  recommendedAction: string;
}

export interface PermissionEscalation {
  originalPermission: string;
  escalatedPermission: string;
  reason: string;
  duration: number; // بالدقائق
  approvedBy?: number;
  expiresAt: Date;
}

// ==================== قواعد الصلاحيات الأساسية ====================

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['*'], // كل الصلاحيات
  manager: [
    'view:*', 'create:*', 'update:*', 'delete:own',
    'approve:requests', 'manage:employees', 'view:reports',
    'export:reports', 'manage:inventory'
  ],
  supervisor: [
    'view:branch', 'create:revenue', 'create:expense',
    'view:employees:branch', 'create:requests', 'view:reports:branch'
  ],
  employee: [
    'view:own', 'create:requests', 'view:schedule'
  ],
  viewer: [
    'view:*', 'export:reports'
  ]
};

// ==================== قيود الوقت ====================

const TIME_RESTRICTIONS: Record<string, { start: number; end: number; days: number[] }> = {
  financial_operations: {
    start: 8, // 8 صباحاً
    end: 22,  // 10 مساءً
    days: [0, 1, 2, 3, 4, 5, 6] // كل الأيام
  },
  sensitive_data: {
    start: 9,
    end: 18,
    days: [0, 1, 2, 3, 4] // الأحد - الخميس
  },
  admin_operations: {
    start: 0,
    end: 24,
    days: [0, 1, 2, 3, 4, 5, 6]
  }
};

// ==================== حدود العمليات ====================

const OPERATION_LIMITS: Record<string, Record<string, number>> = {
  admin: {
    daily_transactions: Infinity,
    max_transaction_amount: Infinity,
    daily_deletions: Infinity,
    daily_exports: Infinity
  },
  manager: {
    daily_transactions: 500,
    max_transaction_amount: 100000,
    daily_deletions: 50,
    daily_exports: 100
  },
  supervisor: {
    daily_transactions: 100,
    max_transaction_amount: 10000,
    daily_deletions: 0,
    daily_exports: 20
  },
  employee: {
    daily_transactions: 50,
    max_transaction_amount: 5000,
    daily_deletions: 0,
    daily_exports: 5
  },
  viewer: {
    daily_transactions: 0,
    max_transaction_amount: 0,
    daily_deletions: 0,
    daily_exports: 50
  }
};

// ==================== التحقق من الصلاحيات ====================

export async function checkPermission(
  context: PermissionContext
): Promise<PermissionDecision> {
  const { userId, userRole, action, resource, timestamp } = context;

  // 1. التحقق من الصلاحيات الأساسية
  const basePermission = checkBasePermission(userRole, action, resource);
  if (!basePermission.allowed) {
    return basePermission;
  }

  // 2. التحقق من قيود الوقت
  const timeCheck = checkTimeRestrictions(action, resource, timestamp);
  if (!timeCheck.allowed) {
    return timeCheck;
  }

  // 3. التحقق من حدود العمليات
  const limitCheck = await checkOperationLimits(userId, userRole, action);
  if (!limitCheck.allowed) {
    return limitCheck;
  }

  // 4. كشف الشذوذات
  const anomalyCheck = await detectAnomalies(context);
  if (anomalyCheck.isAnomaly && anomalyCheck.severity !== 'low') {
    return {
      allowed: anomalyCheck.severity !== 'critical',
      reason: anomalyCheck.description,
      requiresApproval: anomalyCheck.severity === 'high',
      approvalLevel: anomalyCheck.severity === 'high' ? 'manager' : undefined,
      auditRequired: true,
      riskScore: anomalyCheck.severity === 'critical' ? 100 : 
                 anomalyCheck.severity === 'high' ? 75 : 50
    };
  }

  // 5. حساب درجة المخاطر
  const riskScore = calculateRiskScore(context);

  return {
    allowed: true,
    reason: 'تم السماح بالعملية',
    auditRequired: riskScore > 30,
    riskScore
  };
}

// ==================== التحقق من الصلاحيات الأساسية ====================

function checkBasePermission(
  role: string,
  action: string,
  resource: string
): PermissionDecision {
  const permissions = ROLE_PERMISSIONS[role] || [];
  
  // التحقق من صلاحية الكل
  if (permissions.includes('*')) {
    return { allowed: true, reason: 'صلاحيات كاملة', auditRequired: false, riskScore: 0 };
  }

  // التحقق من الصلاحية المحددة
  const requiredPermission = `${action}:${resource}`;
  const hasPermission = permissions.some(p => {
    if (p === requiredPermission) return true;
    if (p === `${action}:*`) return true;
    if (p.endsWith(':*') && p.startsWith(action.split(':')[0])) return true;
    return false;
  });

  if (hasPermission) {
    return { allowed: true, reason: 'صلاحية ممنوحة', auditRequired: false, riskScore: 0 };
  }

  return {
    allowed: false,
    reason: `ليس لديك صلاحية ${action} على ${resource}`,
    auditRequired: true,
    riskScore: 50
  };
}

// ==================== التحقق من قيود الوقت ====================

function checkTimeRestrictions(
  action: string,
  resource: string,
  timestamp: Date
): PermissionDecision {
  // تحديد نوع العملية
  let restrictionType = 'admin_operations';
  if (['create', 'update', 'delete'].includes(action) && 
      ['invoice', 'expense', 'payment'].includes(resource)) {
    restrictionType = 'financial_operations';
  } else if (['view', 'export'].includes(action) && 
             ['salary', 'employee_data', 'financial_report'].includes(resource)) {
    restrictionType = 'sensitive_data';
  }

  const restriction = TIME_RESTRICTIONS[restrictionType];
  if (!restriction) {
    return { allowed: true, reason: 'لا توجد قيود زمنية', auditRequired: false, riskScore: 0 };
  }

  const hour = timestamp.getHours();
  const day = timestamp.getDay();

  // التحقق من اليوم
  if (!restriction.days.includes(day)) {
    return {
      allowed: false,
      reason: 'هذه العملية غير متاحة في هذا اليوم',
      auditRequired: true,
      riskScore: 30
    };
  }

  // التحقق من الوقت
  if (hour < restriction.start || hour >= restriction.end) {
    return {
      allowed: false,
      reason: `هذه العملية متاحة فقط من ${restriction.start}:00 إلى ${restriction.end}:00`,
      auditRequired: true,
      riskScore: 30
    };
  }

  return { allowed: true, reason: 'ضمن الوقت المسموح', auditRequired: false, riskScore: 0 };
}

// ==================== التحقق من حدود العمليات ====================

async function checkOperationLimits(
  userId: number,
  role: string,
  action: string
): Promise<PermissionDecision> {
  const limits = OPERATION_LIMITS[role] || OPERATION_LIMITS.viewer;
  const db = await getDb();
  if (!db) {
    return { allowed: true, reason: 'تعذر التحقق من الحدود', auditRequired: true, riskScore: 20 };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // حساب عدد العمليات اليوم
  const todayOperations = await db.select({ count: count() })
    .from(activityLogs)
    .where(and(
      eq(activityLogs.userId, userId),
      eq(activityLogs.action, action),
      gte(activityLogs.createdAt, today)
    ));

  const operationCount = todayOperations[0]?.count || 0;

  // التحقق من الحد اليومي
  let limitKey = 'daily_transactions';
  if (action === 'delete') limitKey = 'daily_deletions';
  if (action === 'export') limitKey = 'daily_exports';

  const limit = limits[limitKey];
  if (operationCount >= limit) {
    return {
      allowed: false,
      reason: `تجاوزت الحد اليومي (${limit}) لهذا النوع من العمليات`,
      auditRequired: true,
      riskScore: 60
    };
  }

  return { allowed: true, reason: 'ضمن الحدود المسموحة', auditRequired: false, riskScore: 0 };
}

// ==================== كشف الشذوذات ====================

async function detectAnomalies(
  context: PermissionContext
): Promise<AnomalyDetectionResult> {
  const { userId, action, resource, timestamp } = context;
  const db = await getDb();
  if (!db) {
    return {
      isAnomaly: false,
      severity: 'low',
      description: 'تعذر التحقق من الشذوذات',
      evidence: [],
      recommendedAction: 'متابعة العملية'
    };
  }

  const evidence: string[] = [];
  let anomalyScore = 0;

  // 1. التحقق من نمط الوقت غير العادي
  const hour = timestamp.getHours();
  if (hour < 6 || hour > 23) {
    evidence.push(`عملية في وقت غير عادي: ${hour}:00`);
    anomalyScore += 30;
  }

  // 2. التحقق من تكرار العمليات السريع
  const fiveMinutesAgo = new Date(timestamp.getTime() - 5 * 60 * 1000);
  const recentOperations = await db.select({ count: count() })
    .from(activityLogs)
    .where(and(
      eq(activityLogs.userId, userId),
      gte(activityLogs.createdAt, fiveMinutesAgo)
    ));

  if ((recentOperations[0]?.count || 0) > 20) {
    evidence.push(`${recentOperations[0]?.count} عملية في آخر 5 دقائق`);
    anomalyScore += 40;
  }

  // 3. التحقق من العمليات الحساسة المتكررة
  if (['delete', 'export', 'update_permission'].includes(action)) {
    const hourAgo = new Date(timestamp.getTime() - 60 * 60 * 1000);
    const sensitiveOps = await db.select({ count: count() })
      .from(activityLogs)
      .where(and(
        eq(activityLogs.userId, userId),
        eq(activityLogs.action, action),
        gte(activityLogs.createdAt, hourAgo)
      ));

    if ((sensitiveOps[0]?.count || 0) > 10) {
      evidence.push(`${sensitiveOps[0]?.count} عملية ${action} في الساعة الأخيرة`);
      anomalyScore += 50;
    }
  }

  // تحديد مستوى الخطورة
  let severity: AnomalyDetectionResult['severity'] = 'low';
  if (anomalyScore >= 80) severity = 'critical';
  else if (anomalyScore >= 60) severity = 'high';
  else if (anomalyScore >= 30) severity = 'medium';

  return {
    isAnomaly: anomalyScore > 20,
    anomalyType: anomalyScore > 20 ? 'behavioral' : undefined,
    severity,
    description: evidence.length > 0 
      ? `تم اكتشاف نمط غير عادي: ${evidence.join(', ')}`
      : 'لم يتم اكتشاف شذوذات',
    evidence,
    recommendedAction: severity === 'critical' 
      ? 'إيقاف العملية وإخطار المسؤول'
      : severity === 'high'
      ? 'طلب موافقة إضافية'
      : 'تسجيل العملية للمراجعة'
  };
}

// ==================== حساب درجة المخاطر ====================

function calculateRiskScore(context: PermissionContext): number {
  let score = 0;

  // عوامل المخاطر
  const riskFactors: Record<string, number> = {
    // نوع العملية
    'delete': 30,
    'update': 15,
    'create': 10,
    'export': 20,
    'view': 5,
    
    // نوع المورد
    'financial': 25,
    'employee_data': 20,
    'settings': 30,
    'reports': 15,
    
    // الوقت
    'off_hours': 20,
    'weekend': 10
  };

  // إضافة نقاط حسب نوع العملية
  score += riskFactors[context.action] || 0;

  // إضافة نقاط حسب الوقت
  const hour = context.timestamp.getHours();
  if (hour < 8 || hour > 20) {
    score += riskFactors['off_hours'];
  }

  const day = context.timestamp.getDay();
  if (day === 5 || day === 6) { // الجمعة والسبت
    score += riskFactors['weekend'];
  }

  return Math.min(100, score);
}

// ==================== تصعيد الصلاحيات ====================

export async function requestPermissionEscalation(
  userId: number,
  permission: string,
  reason: string,
  duration: number // بالدقائق
): Promise<{ success: boolean; escalation?: PermissionEscalation; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: 'قاعدة البيانات غير متاحة' };
  }

  // التحقق من صحة الطلب
  if (duration > 480) { // 8 ساعات كحد أقصى
    return { success: false, error: 'مدة التصعيد لا يمكن أن تتجاوز 8 ساعات' };
  }

  const escalation: PermissionEscalation = {
    originalPermission: 'current',
    escalatedPermission: permission,
    reason,
    duration,
    expiresAt: new Date(Date.now() + duration * 60 * 1000)
  };

  // في الإنتاج، يجب حفظ هذا في قاعدة البيانات وإرسال إشعار للموافقة
  return { success: true, escalation };
}

// ==================== تدقيق استخدام الصلاحيات ====================

export async function auditPermissionUsage(
  userId: number,
  startDate: Date,
  endDate: Date
): Promise<{
  summary: {
    totalOperations: number;
    byAction: Record<string, number>;
    byResource: Record<string, number>;
    anomalies: number;
    riskScore: number;
  };
  timeline: { date: string; count: number; riskScore: number }[];
  recommendations: string[];
}> {
  const db = await getDb();
  if (!db) {
    return {
      summary: { totalOperations: 0, byAction: {}, byResource: {}, anomalies: 0, riskScore: 0 },
      timeline: [],
      recommendations: []
    };
  }

  // جمع البيانات
  const operations = await db.select({
    action: activityLogs.action,
    resource: activityLogs.entityType,
    date: sql<string>`DATE(${activityLogs.createdAt})`,
    count: count()
  })
  .from(activityLogs)
  .where(and(
    eq(activityLogs.userId, userId),
    gte(activityLogs.createdAt, startDate),
    lte(activityLogs.createdAt, endDate)
  ))
  .groupBy(activityLogs.action, activityLogs.entityType, sql`DATE(${activityLogs.createdAt})`);

  // تجميع الإحصائيات
  const byAction: Record<string, number> = {};
  const byResource: Record<string, number> = {};
  const byDate: Record<string, { count: number; riskScore: number }> = {};
  let totalOperations = 0;

  for (const op of operations) {
    totalOperations += Number(op.count);
    byAction[op.action] = (byAction[op.action] || 0) + Number(op.count);
    byResource[op.resource] = (byResource[op.resource] || 0) + Number(op.count);
    
    if (!byDate[op.date]) {
      byDate[op.date] = { count: 0, riskScore: 0 };
    }
    byDate[op.date].count += Number(op.count);
  }

  // حساب درجة المخاطر الإجمالية
  const riskScore = Math.min(100, 
    (byAction['delete'] || 0) * 2 +
    (byAction['export'] || 0) * 1 +
    (byAction['update'] || 0) * 0.5
  );

  // توليد التوصيات
  const recommendations: string[] = [];
  if ((byAction['delete'] || 0) > 50) {
    recommendations.push('عدد عمليات الحذف مرتفع، يُنصح بمراجعة السياسات');
  }
  if ((byAction['export'] || 0) > 100) {
    recommendations.push('عدد عمليات التصدير مرتفع، يُنصح بمراقبة البيانات المصدرة');
  }

  return {
    summary: {
      totalOperations,
      byAction,
      byResource,
      anomalies: 0,
      riskScore
    },
    timeline: Object.entries(byDate).map(([date, data]) => ({
      date,
      count: data.count,
      riskScore: data.riskScore
    })),
    recommendations
  };
}

// ==================== الصلاحيات الديناميكية ====================

export interface DynamicPermissionRule {
  id: string;
  name: string;
  condition: {
    type: 'time' | 'amount' | 'frequency' | 'context';
    operator: 'eq' | 'gt' | 'lt' | 'between' | 'in';
    value: any;
  };
  action: 'allow' | 'deny' | 'require_approval';
  priority: number;
  expiresAt?: Date;
}

const dynamicRules: DynamicPermissionRule[] = [
  {
    id: 'rule_large_transaction',
    name: 'معاملات كبيرة تتطلب موافقة',
    condition: { type: 'amount', operator: 'gt', value: 50000 },
    action: 'require_approval',
    priority: 100
  },
  {
    id: 'rule_off_hours_sensitive',
    name: 'منع العمليات الحساسة خارج أوقات العمل',
    condition: { type: 'time', operator: 'between', value: { start: 22, end: 6 } },
    action: 'deny',
    priority: 90
  },
  {
    id: 'rule_high_frequency',
    name: 'تقييد التكرار العالي',
    condition: { type: 'frequency', operator: 'gt', value: 100 },
    action: 'require_approval',
    priority: 80
  }
];

export function evaluateDynamicRules(
  context: PermissionContext,
  amount?: number,
  frequency?: number
): DynamicPermissionRule | null {
  const hour = context.timestamp.getHours();

  for (const rule of dynamicRules.sort((a, b) => b.priority - a.priority)) {
    let matches = false;

    switch (rule.condition.type) {
      case 'amount':
        if (amount !== undefined) {
          matches = evaluateCondition(amount, rule.condition.operator, rule.condition.value);
        }
        break;
      case 'time':
        if (rule.condition.operator === 'between') {
          const { start, end } = rule.condition.value;
          matches = hour >= start || hour < end;
        }
        break;
      case 'frequency':
        if (frequency !== undefined) {
          matches = evaluateCondition(frequency, rule.condition.operator, rule.condition.value);
        }
        break;
    }

    if (matches) {
      return rule;
    }
  }

  return null;
}

function evaluateCondition(value: number, operator: string, target: any): boolean {
  switch (operator) {
    case 'eq': return value === target;
    case 'gt': return value > target;
    case 'lt': return value < target;
    case 'between': return value >= target.min && value <= target.max;
    default: return false;
  }
}
