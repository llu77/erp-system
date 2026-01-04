/**
 * نظام Queue للإشعارات مع Retry Logic
 * =====================================
 * 
 * الميزات:
 * 1. Queue في الذاكرة لإدارة الإشعارات
 * 2. Retry Logic مع تأخير تصاعدي (Exponential Backoff)
 * 3. معالجة متوازية محدودة (Concurrency Control)
 * 4. تسجيل شامل لجميع العمليات
 * 5. Dead Letter Queue للإشعارات الفاشلة
 */

import { Resend } from "resend";
import { getDb } from "../db";
import { sentNotifications } from "../../drizzle/schema";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "info@symbolai.net";

// ==================== أنواع البيانات ====================

export interface QueuedNotification {
  id: string;
  type: NotificationQueueType;
  recipient: {
    email: string;
    name: string;
    id?: number;
  };
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  metadata?: Record<string, any>;
  priority: 'high' | 'normal' | 'low';
  createdAt: Date;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: Date;
  nextRetryAt?: Date;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'dead';
  error?: string;
}

export type NotificationQueueType = 
  | 'low_revenue'
  | 'high_expense'
  | 'revenue_mismatch'
  | 'inventory_low'
  | 'monthly_reminder'
  | 'employee_request'
  | 'product_update'
  | 'payroll_created'
  | 'weekly_report'
  | 'monthly_report'
  | 'bonus_request'
  | 'missing_revenue'
  | 'inventory_reminder'
  | 'payroll_reminder'
  | 'general';

interface QueueStats {
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  dead: number;
  totalProcessed: number;
  averageRetries: number;
}

// ==================== إعدادات Queue ====================

const QUEUE_CONFIG = {
  maxConcurrency: 3,           // عدد الإشعارات المعالجة بالتوازي
  defaultMaxAttempts: 3,       // عدد المحاولات الافتراضي
  baseRetryDelay: 1000,        // التأخير الأساسي (1 ثانية)
  maxRetryDelay: 60000,        // الحد الأقصى للتأخير (60 ثانية)
  processInterval: 1000,       // فترة معالجة Queue (1 ثانية)
  cleanupInterval: 300000,     // فترة تنظيف Queue (5 دقائق)
  deadLetterThreshold: 3,      // عدد المحاولات قبل Dead Letter
};

// ==================== Queue في الذاكرة ====================

class NotificationQueue {
  private queue: Map<string, QueuedNotification> = new Map();
  private deadLetterQueue: Map<string, QueuedNotification> = new Map();
  private processing: Set<string> = new Set();
  private isRunning: boolean = false;
  private processTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private stats: QueueStats = {
    pending: 0,
    processing: 0,
    sent: 0,
    failed: 0,
    dead: 0,
    totalProcessed: 0,
    averageRetries: 0,
  };

  /**
   * إضافة إشعار إلى Queue
   */
  async enqueue(notification: Omit<QueuedNotification, 'id' | 'createdAt' | 'attempts' | 'status'>): Promise<string> {
    const id = this.generateId();
    
    const queuedNotification: QueuedNotification = {
      ...notification,
      id,
      createdAt: new Date(),
      attempts: 0,
      maxAttempts: notification.maxAttempts || QUEUE_CONFIG.defaultMaxAttempts,
      status: 'pending',
    };

    this.queue.set(id, queuedNotification);
    this.stats.pending++;

    console.log(`[Queue] ➕ إضافة إشعار: ${id} | النوع: ${notification.type} | المستلم: ${notification.recipient.email}`);

    // بدء المعالجة إذا لم تكن تعمل
    if (!this.isRunning) {
      this.start();
    }

    return id;
  }

  /**
   * إضافة عدة إشعارات دفعة واحدة
   */
  async enqueueBatch(notifications: Omit<QueuedNotification, 'id' | 'createdAt' | 'attempts' | 'status'>[]): Promise<string[]> {
    const ids: string[] = [];
    
    for (const notification of notifications) {
      const id = await this.enqueue(notification);
      ids.push(id);
    }

    console.log(`[Queue] 📦 إضافة ${ids.length} إشعار دفعة واحدة`);
    return ids;
  }

  /**
   * بدء معالجة Queue
   */
  start(): void {
    if (this.isRunning) {
      console.log('[Queue] ⚠️ Queue يعمل بالفعل');
      return;
    }

    this.isRunning = true;
    console.log('[Queue] 🚀 بدء معالجة Queue');

    // معالجة دورية
    this.processTimer = setInterval(() => this.processQueue(), QUEUE_CONFIG.processInterval);

    // تنظيف دوري
    this.cleanupTimer = setInterval(() => this.cleanup(), QUEUE_CONFIG.cleanupInterval);
  }

  /**
   * إيقاف معالجة Queue
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.processTimer) {
      clearInterval(this.processTimer);
      this.processTimer = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    console.log('[Queue] 🛑 إيقاف Queue');
  }

  /**
   * معالجة Queue
   */
  private async processQueue(): Promise<void> {
    // التحقق من عدد المعالجات الحالية
    if (this.processing.size >= QUEUE_CONFIG.maxConcurrency) {
      return;
    }

    // الحصول على الإشعارات الجاهزة للمعالجة
    const readyNotifications = this.getReadyNotifications();

    for (const notification of readyNotifications) {
      if (this.processing.size >= QUEUE_CONFIG.maxConcurrency) {
        break;
      }

      // بدء المعالجة
      this.processNotification(notification);
    }
  }

  /**
   * الحصول على الإشعارات الجاهزة
   */
  private getReadyNotifications(): QueuedNotification[] {
    const now = new Date();
    const ready: QueuedNotification[] = [];

    // ترتيب حسب الأولوية والوقت
    const priorityOrder = { high: 0, normal: 1, low: 2 };

    for (const notification of Array.from(this.queue.values())) {
      if (notification.status !== 'pending') continue;
      if (this.processing.has(notification.id)) continue;
      if (notification.nextRetryAt && notification.nextRetryAt > now) continue;

      ready.push(notification);
    }

    // ترتيب حسب الأولوية ثم وقت الإنشاء
    ready.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    return ready;
  }

  /**
   * معالجة إشعار واحد
   */
  private async processNotification(notification: QueuedNotification): Promise<void> {
    const { id } = notification;

    // تحديث الحالة
    this.processing.add(id);
    notification.status = 'processing';
    notification.attempts++;
    notification.lastAttemptAt = new Date();

    this.stats.pending--;
    this.stats.processing++;

    console.log(`[Queue] ⚙️ معالجة: ${id} | المحاولة: ${notification.attempts}/${notification.maxAttempts}`);

    try {
      // إرسال البريد
      await this.sendEmail(notification);

      // نجاح
      notification.status = 'sent';
      this.stats.processing--;
      this.stats.sent++;
      this.stats.totalProcessed++;

      // تسجيل في قاعدة البيانات
      await this.logNotification(notification, 'sent');

      console.log(`[Queue] ✅ نجاح: ${id}`);

      // إزالة من Queue
      this.queue.delete(id);

    } catch (error: any) {
      console.error(`[Queue] ❌ فشل: ${id} | الخطأ: ${error.message}`);

      notification.error = error.message;

      // التحقق من عدد المحاولات
      if (notification.attempts >= notification.maxAttempts) {
        // نقل إلى Dead Letter Queue
        notification.status = 'dead';
        this.deadLetterQueue.set(id, notification);
        this.queue.delete(id);

        this.stats.processing--;
        this.stats.dead++;

        // تسجيل الفشل
        await this.logNotification(notification, 'failed');

        console.log(`[Queue] 💀 Dead Letter: ${id}`);
      } else {
        // جدولة إعادة المحاولة
        notification.status = 'pending';
        notification.nextRetryAt = this.calculateNextRetry(notification.attempts);

        this.stats.processing--;
        this.stats.pending++;
        this.stats.failed++;

        console.log(`[Queue] 🔄 إعادة المحاولة: ${id} في ${notification.nextRetryAt.toISOString()}`);
      }
    } finally {
      this.processing.delete(id);
    }
  }

  /**
   * إرسال البريد الإلكتروني
   */
  private async sendEmail(notification: QueuedNotification): Promise<void> {
    const { recipient, subject, bodyHtml, bodyText } = notification;

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: recipient.email,
      subject: subject,
      html: bodyHtml,
      text: bodyText,
    });

    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  /**
   * حساب وقت إعادة المحاولة (Exponential Backoff)
   */
  private calculateNextRetry(attempts: number): Date {
    // التأخير = baseDelay * 2^(attempts-1)
    // مع حد أقصى
    const delay = Math.min(
      QUEUE_CONFIG.baseRetryDelay * Math.pow(2, attempts - 1),
      QUEUE_CONFIG.maxRetryDelay
    );

    return new Date(Date.now() + delay);
  }

  /**
   * تسجيل الإشعار في قاعدة البيانات
   */
  private async logNotification(notification: QueuedNotification, status: 'sent' | 'failed'): Promise<void> {
    try {
      const database = await getDb();
      if (!database) return;

      await database.insert(sentNotifications).values({
        recipientId: notification.recipient.id || 0,
        recipientEmail: notification.recipient.email,
        recipientName: notification.recipient.name,
        notificationType: notification.type as any,
        subject: notification.subject,
        bodyArabic: notification.bodyHtml,
        status: status,
        sentAt: status === 'sent' ? new Date() : null,
        errorMessage: notification.error,
      });
    } catch (error: any) {
      console.error(`[Queue] خطأ في تسجيل الإشعار: ${error.message}`);
    }
  }

  /**
   * تنظيف Queue من الإشعارات القديمة
   */
  private cleanup(): void {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 ساعة

    let cleaned = 0;

    // تنظيف الإشعارات المرسلة القديمة
    for (const [id, notification] of Array.from(this.queue.entries())) {
      if (notification.status === 'sent' && 
          now.getTime() - notification.createdAt.getTime() > maxAge) {
        this.queue.delete(id);
        cleaned++;
      }
    }

    // تنظيف Dead Letter Queue القديمة
    for (const [id, notification] of Array.from(this.deadLetterQueue.entries())) {
      if (now.getTime() - notification.createdAt.getTime() > maxAge * 7) { // 7 أيام
        this.deadLetterQueue.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[Queue] 🧹 تنظيف: ${cleaned} إشعار`);
    }
  }

  /**
   * توليد معرف فريد
   */
  private generateId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * الحصول على إحصائيات Queue
   */
  getStats(): QueueStats & { queueSize: number; deadLetterSize: number } {
    return {
      ...this.stats,
      queueSize: this.queue.size,
      deadLetterSize: this.deadLetterQueue.size,
    };
  }

  /**
   * الحصول على الإشعارات في Dead Letter Queue
   */
  getDeadLetterNotifications(): QueuedNotification[] {
    return Array.from(this.deadLetterQueue.values());
  }

  /**
   * إعادة محاولة إشعار من Dead Letter Queue
   */
  async retryDeadLetter(id: string): Promise<boolean> {
    const notification = this.deadLetterQueue.get(id);
    if (!notification) {
      return false;
    }

    // إعادة إلى Queue الرئيسي
    notification.status = 'pending';
    notification.attempts = 0;
    notification.error = undefined;
    notification.nextRetryAt = undefined;

    this.queue.set(id, notification);
    this.deadLetterQueue.delete(id);

    this.stats.dead--;
    this.stats.pending++;

    console.log(`[Queue] 🔄 إعادة محاولة Dead Letter: ${id}`);
    return true;
  }

  /**
   * إعادة محاولة جميع إشعارات Dead Letter
   */
  async retryAllDeadLetters(): Promise<number> {
    let count = 0;
    for (const id of Array.from(this.deadLetterQueue.keys())) {
      if (await this.retryDeadLetter(id)) {
        count++;
      }
    }
    return count;
  }

  /**
   * الحصول على حالة إشعار
   */
  getNotificationStatus(id: string): QueuedNotification | undefined {
    return this.queue.get(id) || this.deadLetterQueue.get(id);
  }

  /**
   * إلغاء إشعار
   */
  cancelNotification(id: string): boolean {
    const notification = this.queue.get(id);
    if (!notification || notification.status !== 'pending') {
      return false;
    }

    this.queue.delete(id);
    this.stats.pending--;
    console.log(`[Queue] ❌ إلغاء: ${id}`);
    return true;
  }
}

// ==================== Singleton Instance ====================

export const notificationQueue = new NotificationQueue();

// ==================== دوال مساعدة للاستخدام الخارجي ====================

/**
 * إضافة إشعار بريد إلكتروني إلى Queue
 */
export async function queueEmailNotification(params: {
  type: NotificationQueueType;
  recipient: { email: string; name: string; id?: number };
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  priority?: 'high' | 'normal' | 'low';
  maxAttempts?: number;
  metadata?: Record<string, any>;
}): Promise<string> {
  return notificationQueue.enqueue({
    type: params.type,
    recipient: params.recipient,
    subject: params.subject,
    bodyHtml: params.bodyHtml,
    bodyText: params.bodyText,
    priority: params.priority || 'normal',
    maxAttempts: params.maxAttempts || QUEUE_CONFIG.defaultMaxAttempts,
    metadata: params.metadata,
  });
}

/**
 * إضافة عدة إشعارات دفعة واحدة
 */
export async function queueBatchNotifications(notifications: Array<{
  type: NotificationQueueType;
  recipient: { email: string; name: string; id?: number };
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  priority?: 'high' | 'normal' | 'low';
}>): Promise<string[]> {
  return notificationQueue.enqueueBatch(
    notifications.map(n => ({
      ...n,
      priority: n.priority || 'normal',
      maxAttempts: QUEUE_CONFIG.defaultMaxAttempts,
    }))
  );
}

/**
 * الحصول على إحصائيات Queue
 */
export function getQueueStats() {
  return notificationQueue.getStats();
}

/**
 * الحصول على إشعارات Dead Letter
 */
export function getDeadLetterNotifications() {
  return notificationQueue.getDeadLetterNotifications();
}

/**
 * إعادة محاولة إشعار فاشل
 */
export async function retryFailedNotification(id: string) {
  return notificationQueue.retryDeadLetter(id);
}

/**
 * إعادة محاولة جميع الإشعارات الفاشلة
 */
export async function retryAllFailedNotifications() {
  return notificationQueue.retryAllDeadLetters();
}

/**
 * بدء Queue (يُستدعى عند بدء السيرفر)
 */
export function startNotificationQueue() {
  notificationQueue.start();
}

/**
 * إيقاف Queue (يُستدعى عند إيقاف السيرفر)
 */
export function stopNotificationQueue() {
  notificationQueue.stop();
}
