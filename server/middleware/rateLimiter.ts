/**
 * Rate Limiter Middleware
 * محدد معدل الطلبات
 * 
 * يوفر حماية ضد الطلبات المفرطة مع دعم استثناءات مخصصة
 */

import { RateLimitException, TimeoutException } from '../exceptions';

// ==================== Types ====================

interface RateLimitConfig {
  windowMs: number;      // فترة النافذة بالمللي ثانية
  maxRequests: number;   // الحد الأقصى للطلبات في النافذة
  keyPrefix?: string;    // بادئة المفتاح
  skipFailedRequests?: boolean;  // تجاهل الطلبات الفاشلة
  skipSuccessfulRequests?: boolean;  // تجاهل الطلبات الناجحة
  message?: string;      // رسالة الخطأ المخصصة
}

interface RateLimitEntry {
  count: number;
  resetTime: Date;
  firstRequest: Date;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

// ==================== In-Memory Store ====================

class RateLimitStore {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // تنظيف دوري للمدخلات المنتهية
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  get(key: string): RateLimitEntry | undefined {
    return this.store.get(key);
  }

  set(key: string, entry: RateLimitEntry): void {
    this.store.set(key, entry);
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  private cleanup(): void {
    const now = new Date();
    const keysToDelete: string[] = [];
    this.store.forEach((entry, key) => {
      if (entry.resetTime < now) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.store.delete(key));
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }

  getStats(): { totalKeys: number; oldestEntry: Date | null } {
    let oldestEntry: Date | null = null;
    this.store.forEach((entry) => {
      if (!oldestEntry || entry.firstRequest < oldestEntry) {
        oldestEntry = entry.firstRequest;
      }
    });
    return { totalKeys: this.store.size, oldestEntry };
  }
}

// ==================== Rate Limiter ====================

const defaultStore = new RateLimitStore();

export class RateLimiter {
  private config: Required<RateLimitConfig>;
  private store: RateLimitStore;

  constructor(config: RateLimitConfig, store?: RateLimitStore) {
    this.config = {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      keyPrefix: config.keyPrefix || 'rl',
      skipFailedRequests: config.skipFailedRequests || false,
      skipSuccessfulRequests: config.skipSuccessfulRequests || false,
      message: config.message || 'تم تجاوز حد الطلبات المسموح. يرجى المحاولة لاحقاً.',
    };
    this.store = store || defaultStore;
  }

  /**
   * التحقق من الطلب وتحديث العداد
   */
  check(key: string): RateLimitResult {
    const fullKey = `${this.config.keyPrefix}:${key}`;
    const now = new Date();
    const entry = this.store.get(fullKey);

    // إذا لم يكن هناك سجل أو انتهت النافذة
    if (!entry || entry.resetTime < now) {
      const resetTime = new Date(now.getTime() + this.config.windowMs);
      this.store.set(fullKey, {
        count: 1,
        resetTime,
        firstRequest: now,
      });
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetTime,
      };
    }

    // تحديث العداد
    entry.count++;
    this.store.set(fullKey, entry);

    // التحقق من تجاوز الحد
    if (entry.count > this.config.maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime.getTime() - now.getTime()) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        retryAfter,
      };
    }

    return {
      allowed: true,
      remaining: this.config.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  /**
   * التحقق ورمي استثناء إذا تم تجاوز الحد
   */
  checkOrThrow(key: string): RateLimitResult {
    const result = this.check(key);
    
    if (!result.allowed) {
      throw new RateLimitException(
        this.config.message,
        this.config.maxRequests,
        this.config.maxRequests + 1,
        result.resetTime,
        result.retryAfter,
        { key, windowMs: this.config.windowMs }
      );
    }

    return result;
  }

  /**
   * إعادة تعيين العداد لمفتاح معين
   */
  reset(key: string): void {
    const fullKey = `${this.config.keyPrefix}:${key}`;
    this.store.delete(fullKey);
  }

  /**
   * الحصول على حالة المفتاح
   */
  getStatus(key: string): RateLimitResult | null {
    const fullKey = `${this.config.keyPrefix}:${key}`;
    const entry = this.store.get(fullKey);
    
    if (!entry) return null;

    const now = new Date();
    if (entry.resetTime < now) {
      this.store.delete(fullKey);
      return null;
    }

    return {
      allowed: entry.count <= this.config.maxRequests,
      remaining: Math.max(0, this.config.maxRequests - entry.count),
      resetTime: entry.resetTime,
      retryAfter: entry.count > this.config.maxRequests 
        ? Math.ceil((entry.resetTime.getTime() - now.getTime()) / 1000)
        : undefined,
    };
  }
}

// ==================== Pre-configured Limiters ====================

/**
 * محدد للطلبات العامة - 100 طلب في الدقيقة
 */
export const generalLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 100,
  keyPrefix: 'general',
  message: 'تم تجاوز حد الطلبات العامة. يرجى الانتظار دقيقة.',
});

/**
 * محدد لتسجيل الدخول - 5 محاولات في 15 دقيقة
 */
export const loginLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  keyPrefix: 'login',
  message: 'تم تجاوز عدد محاولات تسجيل الدخول. يرجى المحاولة بعد 15 دقيقة.',
});

/**
 * محدد للبريد الإلكتروني - 10 رسائل في الساعة
 */
export const emailLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 10,
  keyPrefix: 'email',
  message: 'تم تجاوز حد إرسال البريد الإلكتروني. يرجى المحاولة لاحقاً.',
});

/**
 * محدد لرفع الملفات - 20 ملف في الساعة
 */
export const uploadLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 20,
  keyPrefix: 'upload',
  message: 'تم تجاوز حد رفع الملفات. يرجى المحاولة لاحقاً.',
});

/**
 * محدد للتقارير - 5 تقارير في الساعة
 */
export const reportLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
  keyPrefix: 'report',
  message: 'تم تجاوز حد إنشاء التقارير. يرجى المحاولة لاحقاً.',
});

/**
 * محدد للـ API - 1000 طلب في الساعة
 */
export const apiLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 1000,
  keyPrefix: 'api',
  message: 'تم تجاوز حد طلبات API. يرجى المحاولة لاحقاً.',
});

// ==================== Timeout Wrapper ====================

/**
 * تنفيذ دالة مع مهلة زمنية
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  operation?: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new TimeoutException(
        `انتهت مهلة العملية${operation ? `: ${operation}` : ''}`,
        operation,
        timeoutMs,
        timeoutMs,
        { operation }
      ));
    }, timeoutMs);

    fn()
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * تنفيذ دالة مع إعادة المحاولة
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
  operation?: string
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // لا نعيد المحاولة لأخطاء Rate Limit
      if (error instanceof RateLimitException) {
        throw error;
      }
      
      // لا نعيد المحاولة للمحاولة الأخيرة
      if (attempt === maxRetries) {
        break;
      }
      
      // انتظار قبل المحاولة التالية
      await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      console.log(`[Retry] ${operation || 'Operation'} - Attempt ${attempt + 1}/${maxRetries}`);
    }
  }
  
  throw lastError || new Error('فشلت جميع المحاولات');
}

// ==================== Cleanup ====================

export function destroyRateLimitStore(): void {
  defaultStore.destroy();
}
