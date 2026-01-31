/**
 * سجل تدقيق للتحقق من صور الموازنة
 * OCR Audit Log Service
 * 
 * يسجل جميع محاولات التحقق (الناجحة والفاشلة) لمراقبة الأنماط المشبوهة
 */

import { getDb } from "../db";
import { ocrAuditLogs, type OCRAuditLog } from "../../drizzle/schema";
import { createLogger } from "../utils/logger";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";

const logger = createLogger("OCRAuditLog");

// ==================== الأنواع ====================

export type OCRAuditStatus = 
  | "success"           // تم التحقق بنجاح
  | "amount_mismatch"   // عدم تطابق المبلغ
  | "date_mismatch"     // عدم تطابق التاريخ
  | "both_mismatch"     // عدم تطابق المبلغ والتاريخ
  | "low_confidence"    // ثقة منخفضة
  | "extraction_failed" // فشل استخراج البيانات
  | "no_image"          // لم يتم رفع صورة
  | "error";            // خطأ في النظام

export interface OCRAuditLogEntry {
  id?: number;
  branchId: number;
  userId: string;
  revenueDate: string;
  imageUrl: string | null;
  
  // البيانات المدخلة
  inputNetworkAmount: number;
  inputDate: string;
  
  // البيانات المستخرجة
  extractedAmount: number | null;
  extractedDate: string | null;
  extractedSections: Array<{
    name: string;
    hostTotal: number;
    terminalTotal: number;
    count: number;
  }> | string | null; // JSON string or array
  
  // نتيجة التحقق
  status: OCRAuditStatus;
  confidence: "high" | "medium" | "low" | "none";
  isAmountMatched: boolean;
  isDateMatched: boolean;
  amountDifference: number | null;
  
  // معلومات إضافية
  processingTimeMs: number;
  errorMessage: string | null;
  warnings: Array<{
    type: string;
    severity: string;
    message: string;
    suggestion?: string;
  }> | string | null; // JSON string or array
  
  // الطابع الزمني
  createdAt?: Date;
}

export interface OCRAuditStats {
  totalAttempts: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgProcessingTime: number;
  byStatus: Record<OCRAuditStatus, number>;
  byBranch: Array<{
    branchId: number;
    branchName: string;
    attempts: number;
    failures: number;
    failureRate: number;
  }>;
  recentFailures: OCRAuditLogEntry[];
}

// ==================== الدوال الرئيسية ====================

/**
 * تسجيل محاولة تحقق في سجل التدقيق
 */
export async function logOCRAttempt(entry: OCRAuditLogEntry): Promise<number | null> {
  try {
    const db = await getDb();
    if (!db) {
      logger.error("لا يمكن الاتصال بقاعدة البيانات");
      return null;
    }
    
    // تحويل extractedSections إلى الشكل الصحيح
    let sectionsData = null;
    if (entry.extractedSections) {
      if (typeof entry.extractedSections === 'string') {
        try {
          sectionsData = JSON.parse(entry.extractedSections);
        } catch {
          sectionsData = null;
        }
      } else {
        sectionsData = entry.extractedSections;
      }
    }

    // تحويل warnings إلى الشكل الصحيح
    let warningsData = null;
    if (entry.warnings) {
      if (typeof entry.warnings === 'string') {
        try {
          warningsData = JSON.parse(entry.warnings);
        } catch {
          warningsData = null;
        }
      } else {
        warningsData = entry.warnings;
      }
    }

    await db.insert(ocrAuditLogs).values({
      branchId: entry.branchId,
      userId: entry.userId,
      revenueDate: entry.revenueDate,
      imageUrl: entry.imageUrl,
      inputNetworkAmount: entry.inputNetworkAmount.toString(),
      inputDate: entry.inputDate,
      extractedAmount: entry.extractedAmount?.toString() || null,
      extractedDate: entry.extractedDate,
      extractedSections: sectionsData,
      status: entry.status,
      confidence: entry.confidence,
      isAmountMatched: entry.isAmountMatched,
      isDateMatched: entry.isDateMatched,
      amountDifference: entry.amountDifference?.toString() || null,
      processingTimeMs: entry.processingTimeMs,
      errorMessage: entry.errorMessage,
      warnings: warningsData,
    });

    logger.info("تم تسجيل محاولة التحقق في سجل التدقيق", {
      branchId: entry.branchId,
      status: entry.status,
      isAmountMatched: entry.isAmountMatched,
      isDateMatched: entry.isDateMatched
    });

    return 1; // نجاح
  } catch (error: any) {
    logger.error("خطأ في تسجيل محاولة التحقق", error);
    return null;
  }
}

/**
 * الحصول على إحصائيات التحقق
 */
export async function getOCRAuditStats(
  startDate?: string,
  endDate?: string,
  branchId?: number
): Promise<OCRAuditStats> {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error("لا يمكن الاتصال بقاعدة البيانات");
    }
    
    // بناء شروط الاستعلام
    const conditions = [];
    if (startDate) {
      conditions.push(gte(ocrAuditLogs.createdAt, new Date(startDate)));
    }
    if (endDate) {
      conditions.push(lte(ocrAuditLogs.createdAt, new Date(endDate)));
    }
    if (branchId) {
      conditions.push(eq(ocrAuditLogs.branchId, branchId));
    }

    // جلب جميع السجلات
    const logs = await db
      .select()
      .from(ocrAuditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(ocrAuditLogs.createdAt));

    // حساب الإحصائيات
    const totalAttempts = logs.length;
    const successCount = logs.filter(l => l.status === "success").length;
    const failureCount = totalAttempts - successCount;
    const successRate = totalAttempts > 0 ? (successCount / totalAttempts) * 100 : 0;
    
    // متوسط وقت المعالجة
    const avgProcessingTime = totalAttempts > 0
      ? logs.reduce((sum, l) => sum + (l.processingTimeMs || 0), 0) / totalAttempts
      : 0;

    // تجميع حسب الحالة
    const byStatus: Record<OCRAuditStatus, number> = {
      success: 0,
      amount_mismatch: 0,
      date_mismatch: 0,
      both_mismatch: 0,
      low_confidence: 0,
      extraction_failed: 0,
      no_image: 0,
      error: 0
    };
    logs.forEach((l: OCRAuditLog) => {
      const status = l.status as OCRAuditStatus;
      if (status in byStatus) {
        byStatus[status]++;
      }
    });

    // تجميع حسب الفرع
    const branchStats = new Map<number, { attempts: number; failures: number }>();
    logs.forEach((l: OCRAuditLog) => {
      const current = branchStats.get(l.branchId) || { attempts: 0, failures: 0 };
      current.attempts++;
      if (l.status !== "success") {
        current.failures++;
      }
      branchStats.set(l.branchId, current);
    });

    const byBranch = Array.from(branchStats.entries()).map(([branchId, stats]) => ({
      branchId,
      branchName: `فرع ${branchId}`, // يمكن تحسينه لجلب اسم الفرع الفعلي
      attempts: stats.attempts,
      failures: stats.failures,
      failureRate: stats.attempts > 0 ? (stats.failures / stats.attempts) * 100 : 0
    }));

    // آخر المحاولات الفاشلة
    const recentFailures = logs
      .filter((l: OCRAuditLog) => l.status !== "success")
      .slice(0, 10)
      .map(l => ({
        id: l.id,
        branchId: l.branchId,
        userId: l.userId,
        revenueDate: l.revenueDate,
        imageUrl: l.imageUrl,
        inputNetworkAmount: parseFloat(l.inputNetworkAmount || "0"),
        inputDate: l.inputDate,
        extractedAmount: l.extractedAmount ? parseFloat(l.extractedAmount) : null,
        extractedDate: l.extractedDate,
        extractedSections: l.extractedSections,
        status: l.status as OCRAuditStatus,
        confidence: l.confidence as "high" | "medium" | "low" | "none",
        isAmountMatched: l.isAmountMatched || false,
        isDateMatched: l.isDateMatched || false,
        amountDifference: l.amountDifference ? parseFloat(l.amountDifference) : null,
        processingTimeMs: l.processingTimeMs || 0,
        errorMessage: l.errorMessage,
        warnings: l.warnings,
        createdAt: l.createdAt || undefined
      }));

    return {
      totalAttempts,
      successCount,
      failureCount,
      successRate,
      avgProcessingTime,
      byStatus,
      byBranch,
      recentFailures
    };
  } catch (error: any) {
    logger.error("خطأ في جلب إحصائيات التحقق", error);
    return {
      totalAttempts: 0,
      successCount: 0,
      failureCount: 0,
      successRate: 0,
      avgProcessingTime: 0,
      byStatus: {
        success: 0,
        amount_mismatch: 0,
        date_mismatch: 0,
        both_mismatch: 0,
        low_confidence: 0,
        extraction_failed: 0,
        no_image: 0,
        error: 0
      },
      byBranch: [],
      recentFailures: []
    };
  }
}

/**
 * الحصول على سجلات التحقق لفرع معين
 */
export async function getOCRLogsForBranch(
  branchId: number,
  limit: number = 50
): Promise<OCRAuditLogEntry[]> {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error("لا يمكن الاتصال بقاعدة البيانات");
    }
    
    const logs = await db
      .select()
      .from(ocrAuditLogs)
      .where(eq(ocrAuditLogs.branchId, branchId))
      .orderBy(desc(ocrAuditLogs.createdAt))
      .limit(limit);

    return logs.map((l: OCRAuditLog) => ({
      id: l.id,
      branchId: l.branchId,
      userId: l.userId,
      revenueDate: l.revenueDate,
      imageUrl: l.imageUrl,
      inputNetworkAmount: parseFloat(l.inputNetworkAmount || "0"),
      inputDate: l.inputDate,
      extractedAmount: l.extractedAmount ? parseFloat(l.extractedAmount) : null,
      extractedDate: l.extractedDate,
      extractedSections: l.extractedSections,
      status: l.status as OCRAuditStatus,
      confidence: l.confidence as "high" | "medium" | "low" | "none",
      isAmountMatched: l.isAmountMatched || false,
      isDateMatched: l.isDateMatched || false,
      amountDifference: l.amountDifference ? parseFloat(l.amountDifference) : null,
      processingTimeMs: l.processingTimeMs || 0,
      errorMessage: l.errorMessage,
      warnings: l.warnings,
      createdAt: l.createdAt || undefined
    }));
  } catch (error: any) {
    logger.error("خطأ في جلب سجلات التحقق للفرع", error);
    return [];
  }
}

/**
 * الحصول على المحاولات المشبوهة (عدة محاولات فاشلة متتالية)
 */
export async function getSuspiciousAttempts(
  minFailures: number = 3,
  withinHours: number = 24
): Promise<Array<{
  branchId: number;
  userId: string;
  failureCount: number;
  lastAttempt: Date;
  statuses: string[];
}>> {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error("لا يمكن الاتصال بقاعدة البيانات");
    }
    const cutoffTime = new Date(Date.now() - withinHours * 60 * 60 * 1000);

    const logs = await db
      .select()
      .from(ocrAuditLogs)
      .where(
        and(
          gte(ocrAuditLogs.createdAt, cutoffTime),
          sql`${ocrAuditLogs.status} != 'success'`
        )
      )
      .orderBy(desc(ocrAuditLogs.createdAt));

    // تجميع حسب المستخدم والفرع
    const userAttempts = new Map<string, {
      branchId: number;
      userId: string;
      failures: Array<{ status: string; createdAt: Date }>;
    }>();

    logs.forEach((l: OCRAuditLog) => {
      const key = `${l.branchId}-${l.userId}`;
      const current = userAttempts.get(key) || {
        branchId: l.branchId,
        userId: l.userId,
        failures: [] as Array<{ status: string; createdAt: Date }>
      };
      current.failures.push({
        status: l.status,
        createdAt: l.createdAt || new Date()
      });
      userAttempts.set(key, current);
    });

    // فلترة المستخدمين المشبوهين
    return Array.from(userAttempts.values())
      .filter(u => u.failures.length >= minFailures)
      .map(u => ({
        branchId: u.branchId,
        userId: u.userId,
        failureCount: u.failures.length,
        lastAttempt: u.failures[0].createdAt,
        statuses: u.failures.map(f => f.status)
      }))
      .sort((a, b) => b.failureCount - a.failureCount);
  } catch (error: any) {
    logger.error("خطأ في جلب المحاولات المشبوهة", error);
    return [];
  }
}

/**
 * تحديد حالة التدقيق بناءً على نتيجة التحقق
 */
export function determineAuditStatus(
  success: boolean,
  isAmountMatched: boolean,
  isDateMatched: boolean,
  confidence: "high" | "medium" | "low" | "none",
  hasImage: boolean,
  hasError: boolean
): OCRAuditStatus {
  if (hasError) return "error";
  if (!hasImage) return "no_image";
  if (!success) return "extraction_failed";
  if (confidence === "low" || confidence === "none") return "low_confidence";
  if (!isAmountMatched && !isDateMatched) return "both_mismatch";
  if (!isAmountMatched) return "amount_mismatch";
  if (!isDateMatched) return "date_mismatch";
  return "success";
}
