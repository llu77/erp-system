/**
 * نظام المراقبة التلقائية للتوصيات الذكية
 * AI Recommendation Monitoring System
 * 
 * يقوم بمراقبة النظام دورياً واكتشاف الأنماط العاجلة
 * وإرسال تنبيهات فورية للمدراء
 */

import { getDb } from "../db";
import { 
  AIRecommendationNotifier, 
  createNotifier, 
  runMonitoringCycle 
} from "../ai/aiRecommendationNotifier";
import { 
  RecommendationEngine, 
  createRecommendationContext,
  Recommendation 
} from "../ai/advancedRecommendationEngine";
import { notifyOwner } from "../_core/notification";
import { activityLogs } from "../../drizzle/schema";
import { eq, and, gte, desc } from "drizzle-orm";

// ==================== أنواع البيانات ====================

export interface MonitoringConfig {
  enabled: boolean;
  intervalMinutes: number;
  priorityThreshold: 'low' | 'medium' | 'high' | 'critical';
  maxAlertsPerCycle: number;
  quietHoursStart?: number; // ساعة البدء (0-23)
  quietHoursEnd?: number;   // ساعة الانتهاء (0-23)
  dailySummaryHour: number; // ساعة إرسال الملخص اليومي
}

export interface MonitoringResult {
  timestamp: Date;
  cycleId: string;
  recommendationsChecked: number;
  alertsSent: number;
  urgentRecommendations: Recommendation[];
  errors: string[];
  duration: number;
}

export interface MonitoringStats {
  totalCycles: number;
  totalAlerts: number;
  lastCycleAt: Date | null;
  averageDuration: number;
  errorRate: number;
}

// ==================== التكوين الافتراضي ====================

const DEFAULT_CONFIG: MonitoringConfig = {
  enabled: true,
  intervalMinutes: 30,
  priorityThreshold: 'high',
  maxAlertsPerCycle: 5,
  quietHoursStart: 22,
  quietHoursEnd: 7,
  dailySummaryHour: 8
};

// ==================== نظام المراقبة ====================

export class AIRecommendationMonitor {
  private config: MonitoringConfig;
  private notifier: AIRecommendationNotifier;
  private monitoringHistory: MonitoringResult[] = [];
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(config?: Partial<MonitoringConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.notifier = createNotifier();
  }

  /**
   * بدء المراقبة التلقائية
   */
  start(): void {
    if (this.isRunning) {
      console.log('[AI Monitor] المراقبة قيد التشغيل بالفعل');
      return;
    }

    if (!this.config.enabled) {
      console.log('[AI Monitor] المراقبة معطلة في التكوين');
      return;
    }

    console.log(`[AI Monitor] 🚀 بدء المراقبة التلقائية (كل ${this.config.intervalMinutes} دقيقة)`);
    this.isRunning = true;

    // تشغيل دورة أولية
    this.runCycle();

    // جدولة الدورات المتكررة
    this.intervalId = setInterval(
      () => this.runCycle(),
      this.config.intervalMinutes * 60 * 1000
    );
  }

  /**
   * إيقاف المراقبة
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('[AI Monitor] المراقبة متوقفة بالفعل');
      return;
    }

    console.log('[AI Monitor] 🛑 إيقاف المراقبة التلقائية');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * تشغيل دورة مراقبة واحدة
   */
  async runCycle(): Promise<MonitoringResult> {
    const startTime = Date.now();
    const cycleId = `cycle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const errors: string[] = [];

    console.log(`[AI Monitor] 🔍 بدء دورة المراقبة: ${cycleId}`);

    // التحقق من ساعات الهدوء
    if (this.isQuietHours()) {
      console.log('[AI Monitor] ⏸️ ساعات الهدوء - تخطي الدورة');
      const result: MonitoringResult = {
        timestamp: new Date(),
        cycleId,
        recommendationsChecked: 0,
        alertsSent: 0,
        urgentRecommendations: [],
        errors: ['تم تخطي الدورة - ساعات الهدوء'],
        duration: Date.now() - startTime
      };
      this.monitoringHistory.push(result);
      return result;
    }

    try {
      // توليد التوصيات
      const context = createRecommendationContext(0, 'system');
      const engine = new RecommendationEngine(context);
      const allRecommendations = await engine.generateAllRecommendations();

      // تصفية التوصيات العاجلة
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const thresholdValue = priorityOrder[this.config.priorityThreshold];
      
      const urgentRecommendations = allRecommendations
        .filter(rec => priorityOrder[rec.priority] >= thresholdValue)
        .slice(0, this.config.maxAlertsPerCycle);

      console.log(`[AI Monitor] 📊 تم فحص ${allRecommendations.length} توصية، ${urgentRecommendations.length} عاجلة`);

      // إرسال التنبيهات
      let alertsSent = 0;
      for (const rec of urgentRecommendations) {
        try {
          const results = await this.notifier.notifyForRecommendation(rec);
          if (results.some(r => r.success)) {
            alertsSent++;
          }
        } catch (error) {
          errors.push(`فشل إرسال تنبيه للتوصية ${rec.id}: ${error}`);
        }
      }

      // تسجيل النتيجة
      const result: MonitoringResult = {
        timestamp: new Date(),
        cycleId,
        recommendationsChecked: allRecommendations.length,
        alertsSent,
        urgentRecommendations,
        errors,
        duration: Date.now() - startTime
      };

      this.monitoringHistory.push(result);
      
      // الاحتفاظ بآخر 100 نتيجة فقط
      if (this.monitoringHistory.length > 100) {
        this.monitoringHistory = this.monitoringHistory.slice(-100);
      }

      console.log(`[AI Monitor] ✅ اكتملت الدورة: ${alertsSent} تنبيه تم إرساله في ${result.duration}ms`);

      // تسجيل في قاعدة البيانات
      await this.logCycleToDatabase(result);

      return result;

    } catch (error) {
      console.error('[AI Monitor] ❌ خطأ في دورة المراقبة:', error);
      
      const result: MonitoringResult = {
        timestamp: new Date(),
        cycleId,
        recommendationsChecked: 0,
        alertsSent: 0,
        urgentRecommendations: [],
        errors: [`خطأ عام: ${error}`],
        duration: Date.now() - startTime
      };

      this.monitoringHistory.push(result);
      return result;
    }
  }

  /**
   * إرسال الملخص اليومي
   */
  async sendDailySummary(): Promise<boolean> {
    console.log('[AI Monitor] 📧 إرسال الملخص اليومي');
    
    try {
      const result = await this.notifier.sendDailySummary();
      console.log(`[AI Monitor] ✅ تم إرسال الملخص إلى ${result.recipientCount} مستلم`);
      return result.success;
    } catch (error) {
      console.error('[AI Monitor] ❌ فشل إرسال الملخص اليومي:', error);
      return false;
    }
  }

  /**
   * التحقق من ساعات الهدوء
   */
  private isQuietHours(): boolean {
    if (this.config.quietHoursStart === undefined || this.config.quietHoursEnd === undefined) {
      return false;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const start = this.config.quietHoursStart;
    const end = this.config.quietHoursEnd;

    // التعامل مع الحالة التي تمتد فيها ساعات الهدوء عبر منتصف الليل
    if (start > end) {
      return currentHour >= start || currentHour < end;
    }
    
    return currentHour >= start && currentHour < end;
  }

  /**
   * تسجيل الدورة في قاعدة البيانات
   */
  private async logCycleToDatabase(result: MonitoringResult): Promise<void> {
    try {
      const db = await getDb();
      if (!db) return;

      await db.insert(activityLogs).values({
        userId: null,
        userName: 'AI Monitor',
        action: 'ai_monitoring_cycle',
        entityType: 'recommendations',
        entityId: null,
        details: JSON.stringify({
          cycleId: result.cycleId,
          checked: result.recommendationsChecked,
          alerts: result.alertsSent,
          duration: result.duration,
          errors: result.errors
        }),
        createdAt: new Date()
      });
    } catch (error) {
      console.error('[AI Monitor] فشل تسجيل الدورة في قاعدة البيانات:', error);
    }
  }

  /**
   * الحصول على إحصائيات المراقبة
   */
  getStats(): MonitoringStats {
    const totalCycles = this.monitoringHistory.length;
    const totalAlerts = this.monitoringHistory.reduce((sum, r) => sum + r.alertsSent, 0);
    const lastCycle = this.monitoringHistory[this.monitoringHistory.length - 1];
    const totalDuration = this.monitoringHistory.reduce((sum, r) => sum + r.duration, 0);
    const errorCycles = this.monitoringHistory.filter(r => r.errors.length > 0).length;

    return {
      totalCycles,
      totalAlerts,
      lastCycleAt: lastCycle?.timestamp || null,
      averageDuration: totalCycles > 0 ? totalDuration / totalCycles : 0,
      errorRate: totalCycles > 0 ? (errorCycles / totalCycles) * 100 : 0
    };
  }

  /**
   * الحصول على سجل المراقبة
   */
  getHistory(limit?: number): MonitoringResult[] {
    const history = [...this.monitoringHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * تحديث التكوين
   */
  updateConfig(newConfig: Partial<MonitoringConfig>): void {
    const wasRunning = this.isRunning;
    
    if (wasRunning) {
      this.stop();
    }

    this.config = { ...this.config, ...newConfig };

    if (wasRunning && this.config.enabled) {
      this.start();
    }
  }

  /**
   * الحصول على التكوين الحالي
   */
  getConfig(): MonitoringConfig {
    return { ...this.config };
  }

  /**
   * التحقق من حالة التشغيل
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

// ==================== Singleton Instance ====================

let monitorInstance: AIRecommendationMonitor | null = null;

/**
 * الحصول على مثيل المراقب
 */
export function getMonitor(config?: Partial<MonitoringConfig>): AIRecommendationMonitor {
  if (!monitorInstance) {
    monitorInstance = new AIRecommendationMonitor(config);
  }
  return monitorInstance;
}

/**
 * بدء المراقبة التلقائية
 */
export function startMonitoring(config?: Partial<MonitoringConfig>): void {
  const monitor = getMonitor(config);
  monitor.start();
}

/**
 * إيقاف المراقبة
 */
export function stopMonitoring(): void {
  if (monitorInstance) {
    monitorInstance.stop();
  }
}

/**
 * تشغيل دورة مراقبة يدوية
 */
export async function runManualCycle(): Promise<MonitoringResult> {
  const monitor = getMonitor();
  return monitor.runCycle();
}

/**
 * الحصول على إحصائيات المراقبة
 */
export function getMonitoringStats(): MonitoringStats | null {
  if (!monitorInstance) return null;
  return monitorInstance.getStats();
}

// ==================== Cron Job Handler ====================

/**
 * معالج Cron للمراقبة الدورية
 * يمكن استدعاؤه من scheduler الرئيسي
 */
export async function handleMonitoringCron(): Promise<{
  success: boolean;
  result?: MonitoringResult;
  error?: string;
}> {
  try {
    const monitor = getMonitor();
    const result = await monitor.runCycle();
    
    return {
      success: result.errors.length === 0,
      result
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'خطأ غير معروف'
    };
  }
}

/**
 * معالج Cron للملخص اليومي
 */
export async function handleDailySummaryCron(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const monitor = getMonitor();
    const success = await monitor.sendDailySummary();
    
    return { success };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'خطأ غير معروف'
    };
  }
}
