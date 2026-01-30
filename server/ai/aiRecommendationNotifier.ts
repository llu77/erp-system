/**
 * خدمة إشعارات التوصيات الذكية
 * AI Recommendation Notification Service
 * 
 * تكامل نظام التوصيات مع الإشعارات لتنبيه المدراء
 * عند اكتشاف أنماط عاجلة أو فرص مهمة
 */

import { getDb } from "../db";
import { notifyOwner } from "../_core/notification";
import { sendEmail } from "../email/emailService";
import { 
  Recommendation, 
  RecommendationEngine, 
  createRecommendationContext,
  RecommendationType,
  RecommendationCategory
} from "./advancedRecommendationEngine";
import { users, notifications, branches } from "../../drizzle/schema";
import { eq, and, inArray, gte, desc } from "drizzle-orm";

// ==================== أنواع البيانات ====================

export interface NotificationConfig {
  channels: NotificationChannel[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  recipients: RecipientConfig;
  throttle?: ThrottleConfig;
}

export type NotificationChannel = 'in_app' | 'email' | 'owner' | 'push';

export type UserRole = 'admin' | 'manager' | 'supervisor' | 'employee' | 'viewer';

export interface RecipientConfig {
  roles: UserRole[];
  branchIds?: number[];
  userIds?: number[];
  excludeUserIds?: number[];
}

export interface ThrottleConfig {
  maxPerHour: number;
  maxPerDay: number;
  cooldownMinutes: number;
}

export interface NotificationResult {
  success: boolean;
  channel: NotificationChannel;
  recipientCount: number;
  errors?: string[];
}

export interface AINotificationLog {
  id: string;
  recommendationId: string;
  channel: NotificationChannel;
  recipientIds: number[];
  sentAt: Date;
  status: 'sent' | 'failed' | 'throttled';
  errorMessage?: string;
}

// ==================== تكوين الإشعارات حسب نوع التوصية ====================

const NOTIFICATION_CONFIGS: Record<string, NotificationConfig> = {
  // تنبيهات حرجة - جميع القنوات
  critical: {
    channels: ['in_app', 'email', 'owner'],
    priority: 'critical',
    recipients: {
      roles: ['admin', 'manager']
    },
    throttle: {
      maxPerHour: 10,
      maxPerDay: 50,
      cooldownMinutes: 5
    }
  },
  
  // تنبيهات عالية الأهمية
  high: {
    channels: ['in_app', 'email'],
    priority: 'high',
    recipients: {
      roles: ['admin', 'manager']
    },
    throttle: {
      maxPerHour: 20,
      maxPerDay: 100,
      cooldownMinutes: 15
    }
  },
  
  // تنبيهات متوسطة
  medium: {
    channels: ['in_app'],
    priority: 'medium',
    recipients: {
      roles: ['admin', 'manager', 'supervisor']
    },
    throttle: {
      maxPerHour: 30,
      maxPerDay: 150,
      cooldownMinutes: 30
    }
  },
  
  // تنبيهات منخفضة
  low: {
    channels: ['in_app'],
    priority: 'low',
    recipients: {
      roles: ['admin', 'manager', 'supervisor']
    },
    throttle: {
      maxPerHour: 50,
      maxPerDay: 200,
      cooldownMinutes: 60
    }
  }
};

// تكوين خاص حسب فئة التوصية
const CATEGORY_CONFIGS: Partial<Record<RecommendationCategory, Partial<NotificationConfig>>> = {
  finance: {
    recipients: {
      roles: ['admin', 'manager'] // المالية للمدراء فقط
    }
  },
  inventory: {
    recipients: {
      roles: ['admin', 'manager', 'supervisor'] // المخزون يشمل المشرفين
    }
  },
  compliance: {
    channels: ['in_app', 'email', 'owner'], // الامتثال دائماً مهم
    recipients: {
      roles: ['admin']
    }
  }
};

// ==================== خدمة الإشعارات الذكية ====================

export class AIRecommendationNotifier {
  private notificationLogs: Map<string, AINotificationLog[]> = new Map();
  private throttleTracker: Map<string, number[]> = new Map();

  /**
   * إرسال إشعار لتوصية معينة
   */
  async notifyForRecommendation(
    recommendation: Recommendation,
    options?: Partial<NotificationConfig>
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];
    
    // الحصول على التكوين المناسب
    const config = this.getNotificationConfig(recommendation, options);
    
    // التحقق من التقييد (throttling)
    if (!this.checkThrottle(recommendation.id, config.throttle)) {
      return [{
        success: false,
        channel: 'in_app',
        recipientCount: 0,
        errors: ['تم تجاوز حد الإشعارات - يرجى الانتظار']
      }];
    }

    // الحصول على المستلمين
    const recipients = await this.getRecipients(config.recipients);
    
    if (recipients.length === 0) {
      return [{
        success: false,
        channel: 'in_app',
        recipientCount: 0,
        errors: ['لا يوجد مستلمين مؤهلين']
      }];
    }

    // إرسال عبر القنوات المحددة
    for (const channel of config.channels) {
      const result = await this.sendViaChannel(channel, recommendation, recipients);
      results.push(result);
      
      // تسجيل الإشعار
      this.logNotification(recommendation.id, channel, recipients.map(r => r.id), result.success);
    }

    return results;
  }

  /**
   * إرسال إشعارات لمجموعة توصيات
   */
  async notifyForRecommendations(
    recommendations: Recommendation[],
    options?: { 
      priorityThreshold?: 'low' | 'medium' | 'high' | 'critical';
      maxNotifications?: number;
    }
  ): Promise<Map<string, NotificationResult[]>> {
    const results = new Map<string, NotificationResult[]>();
    const threshold = options?.priorityThreshold || 'medium';
    const maxNotifications = options?.maxNotifications || 10;
    
    // ترتيب التوصيات حسب الأولوية
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    const thresholdValue = priorityOrder[threshold];
    
    // تصفية التوصيات حسب العتبة
    const filteredRecs = recommendations
      .filter(rec => priorityOrder[rec.priority] >= thresholdValue)
      .sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])
      .slice(0, maxNotifications);

    // إرسال الإشعارات
    for (const rec of filteredRecs) {
      const recResults = await this.notifyForRecommendation(rec);
      results.set(rec.id, recResults);
    }

    return results;
  }

  /**
   * إرسال ملخص يومي للتوصيات
   */
  async sendDailySummary(): Promise<NotificationResult> {
    const db = await getDb();
    if (!db) {
      return {
        success: false,
        channel: 'email',
        recipientCount: 0,
        errors: ['فشل الاتصال بقاعدة البيانات']
      };
    }

    // توليد التوصيات
    const context = createRecommendationContext(0, 'system');
    const engine = new RecommendationEngine(context);
    const recommendations = await engine.generateAllRecommendations();

    // تجميع الملخص
    const summary = this.generateSummary(recommendations);
    
    // إرسال للمالك
    const ownerResult = await notifyOwner({
      title: '📊 ملخص التوصيات الذكية اليومي',
      content: summary
    });

    // إرسال بريد إلكتروني للمدراء
    const admins = await db.select()
      .from(users)
      .where(inArray(users.role, ['admin', 'manager']));

    let emailsSent = 0;
    for (const admin of admins) {
      if (admin.email) {
        try {
          await sendEmail({
            to: admin.email,
            subject: '📊 ملخص التوصيات الذكية اليومي - Symbol AI',
            html: this.formatSummaryAsHtml(recommendations, summary)
          });
          emailsSent++;
        } catch (error) {
          console.error(`فشل إرسال البريد إلى ${admin.email}:`, error);
        }
      }
    }

    return {
      success: ownerResult || emailsSent > 0,
      channel: 'email',
      recipientCount: emailsSent + (ownerResult ? 1 : 0)
    };
  }

  /**
   * مراقبة وإرسال تنبيهات فورية
   */
  async monitorAndAlert(): Promise<{
    checked: number;
    alerted: number;
    recommendations: Recommendation[];
  }> {
    // توليد التوصيات
    const context = createRecommendationContext(0, 'system');
    const engine = new RecommendationEngine(context);
    const recommendations = await engine.generateAllRecommendations();

    // تصفية التوصيات العاجلة
    const urgentRecs = recommendations.filter(
      rec => rec.priority === 'critical' || rec.priority === 'high'
    );

    let alertedCount = 0;

    // إرسال تنبيهات للتوصيات العاجلة
    for (const rec of urgentRecs) {
      const results = await this.notifyForRecommendation(rec);
      if (results.some(r => r.success)) {
        alertedCount++;
      }
    }

    return {
      checked: recommendations.length,
      alerted: alertedCount,
      recommendations: urgentRecs
    };
  }

  // ==================== الدوال المساعدة ====================

  /**
   * الحصول على تكوين الإشعار المناسب
   */
  private getNotificationConfig(
    recommendation: Recommendation,
    overrides?: Partial<NotificationConfig>
  ): NotificationConfig {
    // البدء بالتكوين الأساسي حسب الأولوية
    const baseConfig = { ...NOTIFICATION_CONFIGS[recommendation.priority] };
    
    // دمج تكوين الفئة
    const categoryConfig = CATEGORY_CONFIGS[recommendation.category];
    if (categoryConfig) {
      if (categoryConfig.channels) {
        baseConfig.channels = categoryConfig.channels;
      }
      if (categoryConfig.recipients) {
        baseConfig.recipients = {
          ...baseConfig.recipients,
          ...categoryConfig.recipients
        };
      }
    }

    // دمج التجاوزات
    if (overrides) {
      return {
        ...baseConfig,
        ...overrides,
        recipients: {
          ...baseConfig.recipients,
          ...overrides.recipients
        }
      };
    }

    return baseConfig;
  }

  /**
   * الحصول على قائمة المستلمين
   */
  private async getRecipients(config: RecipientConfig): Promise<Array<{
    id: number;
    name: string | null;
    email: string | null;
    role: string;
    branchId: number | null;
  }>> {
    const db = await getDb();
    if (!db) return [];

    let query = db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      branchId: users.branchId
    }).from(users);

    // تصفية حسب الأدوار
    if (config.roles && config.roles.length > 0) {
      query = query.where(inArray(users.role, config.roles)) as typeof query;
    }

    // تصفية حسب الفروع
    if (config.branchIds && config.branchIds.length > 0) {
      query = query.where(inArray(users.branchId, config.branchIds)) as typeof query;
    }

    // تصفية حسب المستخدمين المحددين
    if (config.userIds && config.userIds.length > 0) {
      query = query.where(inArray(users.id, config.userIds)) as typeof query;
    }

    const recipients = await query;

    // استبعاد المستخدمين المحددين
    if (config.excludeUserIds && config.excludeUserIds.length > 0) {
      return recipients.filter(r => !config.excludeUserIds!.includes(r.id));
    }

    return recipients;
  }

  /**
   * إرسال عبر قناة محددة
   */
  private async sendViaChannel(
    channel: NotificationChannel,
    recommendation: Recommendation,
    recipients: Array<{ id: number; name: string | null; email: string | null; role: string }>
  ): Promise<NotificationResult> {
    const errors: string[] = [];
    let successCount = 0;

    switch (channel) {
      case 'owner':
        try {
          const ownerResult = await notifyOwner({
            title: this.formatNotificationTitle(recommendation),
            content: this.formatNotificationContent(recommendation)
          });
          if (ownerResult) successCount++;
        } catch (error) {
          errors.push(`فشل إرسال إشعار المالك: ${error}`);
        }
        break;

      case 'email':
        for (const recipient of recipients) {
          if (recipient.email) {
            try {
              await sendEmail({
                to: recipient.email,
                subject: this.formatNotificationTitle(recommendation),
                html: this.formatEmailContent(recommendation)
              });
              successCount++;
            } catch (error) {
              errors.push(`فشل إرسال البريد إلى ${recipient.email}`);
            }
          }
        }
        break;

      case 'in_app':
        const db = await getDb();
        if (db) {
          for (const recipient of recipients) {
            try {
              await db.insert(notifications).values({
                userId: recipient.id,
                title: this.formatNotificationTitle(recommendation),
                message: recommendation.description,
                type: this.mapRecommendationTypeToNotificationType(recommendation.type),
                isRead: false,
                createdAt: new Date()
              });
              successCount++;
            } catch (error) {
              errors.push(`فشل إنشاء إشعار للمستخدم ${recipient.id}`);
            }
          }
        }
        break;

      case 'push':
        // TODO: تنفيذ إشعارات Push في المستقبل
        break;
    }

    return {
      success: successCount > 0,
      channel,
      recipientCount: successCount,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * التحقق من التقييد
   */
  private checkThrottle(recommendationId: string, throttle?: ThrottleConfig): boolean {
    if (!throttle) return true;

    const key = recommendationId.split('_').slice(0, 2).join('_'); // مفتاح عام للنوع
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    const dayAgo = now - 24 * 60 * 60 * 1000;

    // الحصول على السجل
    let logs = this.throttleTracker.get(key) || [];
    
    // تنظيف السجلات القديمة
    logs = logs.filter(timestamp => timestamp > dayAgo);
    
    // التحقق من الحدود
    const lastHourCount = logs.filter(t => t > hourAgo).length;
    const lastDayCount = logs.length;

    if (lastHourCount >= throttle.maxPerHour) return false;
    if (lastDayCount >= throttle.maxPerDay) return false;

    // التحقق من فترة الانتظار
    const lastSent = logs[logs.length - 1];
    if (lastSent && (now - lastSent) < throttle.cooldownMinutes * 60 * 1000) {
      return false;
    }

    // تسجيل الإرسال الجديد
    logs.push(now);
    this.throttleTracker.set(key, logs);

    return true;
  }

  /**
   * تسجيل الإشعار
   */
  private logNotification(
    recommendationId: string,
    channel: NotificationChannel,
    recipientIds: number[],
    success: boolean
  ): void {
    const log: AINotificationLog = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      recommendationId,
      channel,
      recipientIds,
      sentAt: new Date(),
      status: success ? 'sent' : 'failed'
    };

    const logs = this.notificationLogs.get(recommendationId) || [];
    logs.push(log);
    this.notificationLogs.set(recommendationId, logs);
  }

  /**
   * تنسيق عنوان الإشعار
   */
  private formatNotificationTitle(recommendation: Recommendation): string {
    const priorityEmoji = {
      critical: '🚨',
      high: '⚠️',
      medium: '📊',
      low: '💡'
    };
    
    return `${priorityEmoji[recommendation.priority]} ${recommendation.title}`;
  }

  /**
   * تنسيق محتوى الإشعار
   */
  private formatNotificationContent(recommendation: Recommendation): string {
    const lines = [
      recommendation.description,
      '',
      `📈 التأثير المتوقع: ${recommendation.impact.changePercent > 0 ? '+' : ''}${recommendation.impact.changePercent.toFixed(1)}% على ${recommendation.impact.metric}`,
      `⏱️ الإطار الزمني: ${recommendation.impact.timeframe}`,
      `🎯 مستوى الثقة: ${(recommendation.confidence * 100).toFixed(0)}%`,
      '',
      '💡 السبب:',
      recommendation.reasoning
    ];

    if (recommendation.actions && recommendation.actions.length > 0) {
      lines.push('', '📋 الإجراءات المقترحة:');
      recommendation.actions.forEach((action, index) => {
        lines.push(`${index + 1}. ${action.label}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * تنسيق محتوى البريد الإلكتروني
   */
  private formatEmailContent(recommendation: Recommendation): string {
    const priorityColors = {
      critical: '#dc2626',
      high: '#ea580c',
      medium: '#ca8a04',
      low: '#16a34a'
    };

    const priorityLabels = {
      critical: 'حرج',
      high: 'مرتفع',
      medium: 'متوسط',
      low: 'منخفض'
    };

    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; line-height: 1.6; color: #1f2937; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 20px; border-radius: 12px 12px 0 0; }
    .priority-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; background: ${priorityColors[recommendation.priority]}; color: white; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .metric-box { background: white; padding: 15px; border-radius: 8px; margin: 10px 0; border-right: 4px solid #6366f1; }
    .actions { background: white; padding: 15px; border-radius: 8px; margin-top: 15px; }
    .action-item { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .action-item:last-child { border-bottom: none; }
    .footer { background: #1f2937; color: #9ca3af; padding: 15px; text-align: center; border-radius: 0 0 12px 12px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0 0 10px 0; font-size: 20px;">🤖 تنبيه من نظام الذكاء الاصطناعي</h1>
      <span class="priority-badge">${priorityLabels[recommendation.priority]}</span>
    </div>
    
    <div class="content">
      <h2 style="color: #1f2937; margin-top: 0;">${recommendation.title}</h2>
      <p>${recommendation.description}</p>
      
      <div class="metric-box">
        <strong>📈 التأثير المتوقع</strong>
        <p style="margin: 5px 0;">
          <span style="font-size: 24px; color: ${recommendation.impact.changePercent > 0 ? '#16a34a' : '#dc2626'};">
            ${recommendation.impact.changePercent > 0 ? '+' : ''}${recommendation.impact.changePercent.toFixed(1)}%
          </span>
          على ${recommendation.impact.metric}
        </p>
        <small>الإطار الزمني: ${recommendation.impact.timeframe}</small>
      </div>
      
      <div class="metric-box">
        <strong>💡 التحليل</strong>
        <p style="margin: 5px 0;">${recommendation.reasoning}</p>
        <small>مستوى الثقة: ${(recommendation.confidence * 100).toFixed(0)}%</small>
      </div>
      
      ${recommendation.actions && recommendation.actions.length > 0 ? `
      <div class="actions">
        <strong>📋 الإجراءات المقترحة</strong>
        ${recommendation.actions.map(action => `
          <div class="action-item">
            ➤ ${action.label}
          </div>
        `).join('')}
      </div>
      ` : ''}
    </div>
    
    <div class="footer">
      <p>هذا الإشعار تم إنشاؤه تلقائياً بواسطة نظام Symbol AI</p>
      <p>© ${new Date().getFullYear()} Symbol AI - نظام إدارة متكامل</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * توليد ملخص التوصيات
   */
  private generateSummary(recommendations: Recommendation[]): string {
    const byPriority = {
      critical: recommendations.filter(r => r.priority === 'critical'),
      high: recommendations.filter(r => r.priority === 'high'),
      medium: recommendations.filter(r => r.priority === 'medium'),
      low: recommendations.filter(r => r.priority === 'low')
    };

    const byCategory: Record<string, Recommendation[]> = {};
    recommendations.forEach(rec => {
      if (!byCategory[rec.category]) {
        byCategory[rec.category] = [];
      }
      byCategory[rec.category].push(rec);
    });

    const categoryLabels: Record<string, string> = {
      sales: 'المبيعات',
      inventory: 'المخزون',
      finance: 'المالية',
      customers: 'العملاء',
      employees: 'الموظفين',
      operations: 'العمليات',
      compliance: 'الامتثال'
    };

    const lines = [
      `📊 ملخص التوصيات الذكية - ${new Date().toLocaleDateString('ar-SA')}`,
      '',
      `📈 إجمالي التوصيات: ${recommendations.length}`,
      '',
      '🎯 حسب الأولوية:',
      `   🚨 حرج: ${byPriority.critical.length}`,
      `   ⚠️ مرتفع: ${byPriority.high.length}`,
      `   📊 متوسط: ${byPriority.medium.length}`,
      `   💡 منخفض: ${byPriority.low.length}`,
      '',
      '📁 حسب الفئة:'
    ];

    Object.entries(byCategory).forEach(([category, recs]) => {
      lines.push(`   ${categoryLabels[category] || category}: ${recs.length}`);
    });

    if (byPriority.critical.length > 0 || byPriority.high.length > 0) {
      lines.push('', '⚡ التوصيات العاجلة:');
      [...byPriority.critical, ...byPriority.high].slice(0, 5).forEach((rec, index) => {
        lines.push(`   ${index + 1}. ${rec.title}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * تنسيق الملخص كـ HTML
   */
  private formatSummaryAsHtml(recommendations: Recommendation[], textSummary: string): string {
    const byPriority = {
      critical: recommendations.filter(r => r.priority === 'critical'),
      high: recommendations.filter(r => r.priority === 'high'),
      medium: recommendations.filter(r => r.priority === 'medium'),
      low: recommendations.filter(r => r.priority === 'low')
    };

    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; line-height: 1.6; color: #1f2937; background: #f3f4f6; }
    .container { max-width: 700px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 30px; text-align: center; }
    .stats { display: flex; justify-content: space-around; padding: 20px; background: #f9fafb; }
    .stat-box { text-align: center; padding: 15px; }
    .stat-number { font-size: 32px; font-weight: bold; }
    .stat-label { font-size: 12px; color: #6b7280; }
    .critical { color: #dc2626; }
    .high { color: #ea580c; }
    .medium { color: #ca8a04; }
    .low { color: #16a34a; }
    .recommendations { padding: 20px; }
    .rec-item { padding: 15px; margin: 10px 0; background: #f9fafb; border-radius: 8px; border-right: 4px solid #6366f1; }
    .rec-title { font-weight: bold; margin-bottom: 5px; }
    .rec-desc { color: #6b7280; font-size: 14px; }
    .footer { background: #1f2937; color: #9ca3af; padding: 20px; text-align: center; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">📊 ملخص التوصيات الذكية اليومي</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">${new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>
    
    <div class="stats">
      <div class="stat-box">
        <div class="stat-number critical">${byPriority.critical.length}</div>
        <div class="stat-label">🚨 حرج</div>
      </div>
      <div class="stat-box">
        <div class="stat-number high">${byPriority.high.length}</div>
        <div class="stat-label">⚠️ مرتفع</div>
      </div>
      <div class="stat-box">
        <div class="stat-number medium">${byPriority.medium.length}</div>
        <div class="stat-label">📊 متوسط</div>
      </div>
      <div class="stat-box">
        <div class="stat-number low">${byPriority.low.length}</div>
        <div class="stat-label">💡 منخفض</div>
      </div>
    </div>
    
    ${(byPriority.critical.length > 0 || byPriority.high.length > 0) ? `
    <div class="recommendations">
      <h3>⚡ التوصيات العاجلة</h3>
      ${[...byPriority.critical, ...byPriority.high].slice(0, 5).map(rec => `
        <div class="rec-item">
          <div class="rec-title">${rec.title}</div>
          <div class="rec-desc">${rec.description}</div>
        </div>
      `).join('')}
    </div>
    ` : ''}
    
    <div class="footer">
      <p>هذا التقرير تم إنشاؤه تلقائياً بواسطة نظام Symbol AI</p>
      <p>للاطلاع على التفاصيل الكاملة، يرجى زيارة لوحة التحكم</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * تحويل نوع التوصية إلى نوع الإشعار
   */
  private mapRecommendationTypeToNotificationType(type: RecommendationType): 'low_stock' | 'new_order' | 'large_sale' | 'payment_due' | 'system' {
    // تحويل نوع التوصية إلى نوع إشعار متوافق مع schema
    const mapping: Record<RecommendationType, 'low_stock' | 'new_order' | 'large_sale' | 'payment_due' | 'system'> = {
      action: 'system',
      warning: 'low_stock',
      opportunity: 'large_sale',
      optimization: 'system',
      insight: 'system',
      prediction: 'system'
    };
    return mapping[type] || 'system';
  }

  /**
   * الحصول على سجل الإشعارات
   */
  getNotificationLogs(recommendationId?: string): AINotificationLog[] {
    if (recommendationId) {
      return this.notificationLogs.get(recommendationId) || [];
    }
    
    const allLogs: AINotificationLog[] = [];
    this.notificationLogs.forEach(logs => allLogs.push(...logs));
    return allLogs.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
  }
}

// ==================== دوال مساعدة للتصدير ====================

/**
 * إنشاء مثيل من خدمة الإشعارات
 */
export function createNotifier(): AIRecommendationNotifier {
  return new AIRecommendationNotifier();
}

/**
 * إرسال تنبيه فوري لتوصية عاجلة
 */
export async function sendUrgentAlert(recommendation: Recommendation): Promise<NotificationResult[]> {
  const notifier = new AIRecommendationNotifier();
  return notifier.notifyForRecommendation(recommendation, {
    channels: ['in_app', 'email', 'owner'],
    priority: 'critical'
  });
}

/**
 * تشغيل المراقبة والتنبيه
 */
export async function runMonitoringCycle(): Promise<{
  checked: number;
  alerted: number;
  recommendations: Recommendation[];
}> {
  const notifier = new AIRecommendationNotifier();
  return notifier.monitorAndAlert();
}
