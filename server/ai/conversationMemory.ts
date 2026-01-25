/**
 * خدمة ذاكرة المحادثات للمساعد الذكي Symbol AI
 * 
 * المسؤوليات:
 * 1. إنشاء وإدارة جلسات المحادثة
 * 2. حفظ واسترجاع سجل المحادثات
 * 3. تحميل السياق للمحادثات الجديدة
 */

import { getDb } from "../db";
import { 
  conversationSessions, 
  conversationHistory,
  pendingRequests,
  type ConversationSession,
  type ConversationHistoryRecord,
  type PendingRequest
} from "../../drizzle/schema";
import { eq, desc, and, gt, sql } from "drizzle-orm";
import { randomBytes } from "crypto";

// ==================== أنواع البيانات ====================

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: string;
  toolResults?: string;
  metadata?: string;
  createdAt?: Date;
}

export interface SessionInfo {
  sessionId: string;
  employeeId: number;
  employeeName: string;
  branchId?: number;
  branchName?: string;
  messageCount: number;
  lastMessageAt?: Date;
  createdAt: Date;
}

export interface PendingRequestInfo {
  id: number;
  requestType: string;
  requestData: Record<string, unknown>;
  summary: string;
  expiresAt: Date;
}

// ==================== دوال إدارة الجلسات ====================

/**
 * إنشاء جلسة محادثة جديدة
 */
export async function createSession(
  employeeId: number,
  employeeName: string,
  branchId?: number,
  branchName?: string
): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const sessionId = generateSessionId();
  
  await db.insert(conversationSessions).values({
    sessionId,
    employeeId,
    employeeName,
    branchId: branchId ?? null,
    branchName: branchName ?? null,
    status: "active",
    messageCount: 0,
    createdAt: new Date(),
  });
  
  return sessionId;
}

/**
 * الحصول على الجلسة النشطة للموظف أو إنشاء جلسة جديدة
 */
export async function getOrCreateActiveSession(
  employeeId: number,
  employeeName: string,
  branchId?: number,
  branchName?: string
): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  
  // البحث عن جلسة نشطة حديثة (خلال آخر 24 ساعة)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const existingSession = await db
    .select()
    .from(conversationSessions)
    .where(
      and(
        eq(conversationSessions.employeeId, employeeId),
        eq(conversationSessions.status, "active"),
        gt(conversationSessions.createdAt, oneDayAgo)
      )
    )
    .orderBy(desc(conversationSessions.createdAt))
    .limit(1);
  
  if (existingSession.length > 0) {
    return existingSession[0].sessionId;
  }
  
  // إنشاء جلسة جديدة
  return createSession(employeeId, employeeName, branchId, branchName);
}

/**
 * إغلاق جلسة المحادثة
 */
export async function closeSession(sessionId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db
    .update(conversationSessions)
    .set({
      status: "closed",
      closedAt: new Date(),
    })
    .where(eq(conversationSessions.sessionId, sessionId));
}

/**
 * الحصول على معلومات الجلسة
 */
export async function getSessionInfo(sessionId: string): Promise<SessionInfo | null> {
  const db = await getDb();
  if (!db) return null;
  
  const session = await db
    .select()
    .from(conversationSessions)
    .where(eq(conversationSessions.sessionId, sessionId))
    .limit(1);
  
  if (session.length === 0) {
    return null;
  }
  
  const s = session[0];
  return {
    sessionId: s.sessionId,
    employeeId: s.employeeId,
    employeeName: s.employeeName ?? "",
    branchId: s.branchId ?? undefined,
    branchName: s.branchName ?? undefined,
    messageCount: s.messageCount,
    lastMessageAt: s.lastMessageAt ?? undefined,
    createdAt: s.createdAt,
  };
}

// ==================== دوال سجل المحادثات ====================

/**
 * حفظ رسالة في سجل المحادثات
 */
export async function saveMessage(
  sessionId: string,
  message: Message
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // حفظ الرسالة
  await db.insert(conversationHistory).values({
    sessionId,
    role: message.role,
    content: message.content,
    toolCalls: message.toolCalls ?? null,
    toolResults: message.toolResults ?? null,
    metadata: message.metadata ?? null,
    createdAt: new Date(),
  });
  
  // تحديث عداد الرسائل ووقت آخر رسالة
  await db
    .update(conversationSessions)
    .set({
      messageCount: sql`${conversationSessions.messageCount} + 1`,
      lastMessageAt: new Date(),
    })
    .where(eq(conversationSessions.sessionId, sessionId));
}

/**
 * استرجاع آخر N رسائل من الجلسة
 */
export async function getRecentMessages(
  sessionId: string,
  limit: number = 10
): Promise<Message[]> {
  const db = await getDb();
  if (!db) return [];
  
  const messages = await db
    .select()
    .from(conversationHistory)
    .where(eq(conversationHistory.sessionId, sessionId))
    .orderBy(desc(conversationHistory.createdAt))
    .limit(limit);
  
  // عكس الترتيب ليكون من الأقدم للأحدث
  return messages.reverse().map((m) => ({
    role: m.role,
    content: m.content,
    toolCalls: m.toolCalls ?? undefined,
    toolResults: m.toolResults ?? undefined,
    metadata: m.metadata ?? undefined,
    createdAt: m.createdAt,
  }));
}

/**
 * الحصول على سياق المحادثة للـ LLM
 * يُرجع الرسائل بتنسيق مناسب للإرسال إلى LLM
 */
export async function getConversationContext(
  sessionId: string,
  maxMessages: number = 10
): Promise<Array<{ role: "user" | "assistant" | "system"; content: string }>> {
  const messages = await getRecentMessages(sessionId, maxMessages);
  
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
}

/**
 * الحصول على ملخص المحادثة
 */
export async function getConversationSummary(sessionId: string): Promise<string> {
  const messages = await getRecentMessages(sessionId, 20);
  
  if (messages.length === 0) {
    return "لا توجد محادثات سابقة.";
  }
  
  // إنشاء ملخص بسيط
  const userMessages = messages.filter((m) => m.role === "user");
  const topics = userMessages.map((m) => m.content.slice(0, 50)).join(" | ");
  
  return `المواضيع السابقة: ${topics}`;
}

// ==================== دوال الطلبات المعلقة ====================

/**
 * إنشاء طلب معلق للتأكيد
 */
export async function createPendingRequest(
  sessionId: string,
  employeeId: number,
  requestType: string,
  requestData: Record<string, unknown>,
  summary: string,
  expiresInMinutes: number = 5
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
  
  const result = await db.insert(pendingRequests).values({
    sessionId,
    employeeId,
    requestType,
    requestData: JSON.stringify(requestData),
    summary,
    status: "pending",
    expiresAt,
    createdAt: new Date(),
  });
  
  return Number(result[0].insertId);
}

/**
 * الحصول على الطلبات المعلقة للجلسة
 */
export async function getPendingRequests(
  sessionId: string
): Promise<PendingRequestInfo[]> {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  
  const requests = await db
    .select()
    .from(pendingRequests)
    .where(
      and(
        eq(pendingRequests.sessionId, sessionId),
        eq(pendingRequests.status, "pending"),
        gt(pendingRequests.expiresAt, now)
      )
    )
    .orderBy(desc(pendingRequests.createdAt));
  
  return requests.map((r) => ({
    id: r.id,
    requestType: r.requestType,
    requestData: JSON.parse(r.requestData) as Record<string, unknown>,
    summary: r.summary,
    expiresAt: r.expiresAt,
  }));
}

/**
 * تأكيد طلب معلق
 */
export async function confirmPendingRequest(
  requestId: number
): Promise<PendingRequestInfo | null> {
  const db = await getDb();
  if (!db) return null;
  
  const request = await db
    .select()
    .from(pendingRequests)
    .where(eq(pendingRequests.id, requestId))
    .limit(1);
  
  if (request.length === 0) {
    return null;
  }
  
  const r = request[0];
  
  // التحقق من أن الطلب لا يزال معلقاً وغير منتهي الصلاحية
  if (r.status !== "pending" || r.expiresAt < new Date()) {
    return null;
  }
  
  // تحديث حالة الطلب
  await db
    .update(pendingRequests)
    .set({
      status: "confirmed",
      confirmedAt: new Date(),
    })
    .where(eq(pendingRequests.id, requestId));
  
  return {
    id: r.id,
    requestType: r.requestType,
    requestData: JSON.parse(r.requestData) as Record<string, unknown>,
    summary: r.summary,
    expiresAt: r.expiresAt,
  };
}

/**
 * إلغاء طلب معلق
 */
export async function cancelPendingRequest(requestId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db
    .update(pendingRequests)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
    })
    .where(
      and(
        eq(pendingRequests.id, requestId),
        eq(pendingRequests.status, "pending")
      )
    );
  
  return true;
}

// ==================== دوال مساعدة ====================

/**
 * توليد معرف جلسة فريد
 */
function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(8).toString("hex");
  return `sess_${timestamp}_${random}`;
}

/**
 * تنظيف الجلسات القديمة (يمكن تشغيلها كـ cron job)
 */
export async function cleanupOldSessions(daysOld: number = 30): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  
  // إغلاق الجلسات القديمة
  await db
    .update(conversationSessions)
    .set({
      status: "closed",
      closedAt: new Date(),
    })
    .where(
      and(
        eq(conversationSessions.status, "active"),
        sql`${conversationSessions.createdAt} < ${cutoffDate}`
      )
    );
  
  return 0; // يمكن إضافة عداد للجلسات المغلقة
}

/**
 * تنظيف الطلبات المنتهية الصلاحية
 */
export async function cleanupExpiredRequests(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const now = new Date();
  
  await db
    .update(pendingRequests)
    .set({
      status: "expired",
    })
    .where(
      and(
        eq(pendingRequests.status, "pending"),
        sql`${pendingRequests.expiresAt} < ${now}`
      )
    );
}
