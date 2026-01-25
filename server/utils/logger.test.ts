/**
 * اختبارات نظام التسجيل
 * Logger System Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createLogger,
  authLogger,
  dbLogger,
  apiLogger,
  symbolAiLogger,
  requestsLogger,
  notificationLogger,
  storageLogger,
  payrollLogger,
  bonusLogger,
  attendanceLogger,
  type LogLevel,
  type LogContext,
} from './logger';

describe('Logger System', () => {
  let consoleSpy: {
    debug: ReturnType<typeof vi.spyOn>;
    info: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
    log: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createLogger', () => {
    it('يجب إنشاء logger بنجاح', () => {
      const logger = createLogger('TestModule');
      expect(logger).toBeDefined();
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.fatal).toBe('function');
    });

    it('يجب إنشاء logger مع سياق افتراضي', () => {
      const logger = createLogger('TestModule', { userId: 123 });
      logger.info('رسالة اختبار');
      
      expect(consoleSpy.info).toHaveBeenCalled();
      const call = consoleSpy.info.mock.calls[0][0];
      expect(call).toContain('TestModule');
      expect(call).toContain('رسالة اختبار');
    });
  });

  describe('Log Levels', () => {
    it('يجب تسجيل رسالة debug', () => {
      const logger = createLogger('TestModule');
      logger.debug('رسالة debug');
      
      expect(consoleSpy.debug).toHaveBeenCalled();
    });

    it('يجب تسجيل رسالة info', () => {
      const logger = createLogger('TestModule');
      logger.info('رسالة info');
      
      expect(consoleSpy.info).toHaveBeenCalled();
    });

    it('يجب تسجيل رسالة warn', () => {
      const logger = createLogger('TestModule');
      logger.warn('رسالة تحذير');
      
      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('يجب تسجيل رسالة error', () => {
      const logger = createLogger('TestModule');
      logger.error('رسالة خطأ');
      
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('يجب تسجيل رسالة fatal', () => {
      const logger = createLogger('TestModule');
      logger.fatal('رسالة خطأ حرج');
      
      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });

  describe('Error Logging', () => {
    it('يجب تسجيل خطأ مع معلومات الاستثناء', () => {
      const logger = createLogger('TestModule');
      const error = new Error('خطأ اختبار');
      
      logger.error('حدث خطأ', error);
      
      expect(consoleSpy.error).toHaveBeenCalled();
      const call = consoleSpy.error.mock.calls[0];
      expect(call[0]).toContain('حدث خطأ');
    });

    it('يجب تسجيل خطأ غير Error', () => {
      const logger = createLogger('TestModule');
      
      logger.error('حدث خطأ', 'نص الخطأ');
      
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('يجب تسجيل خطأ مع سياق إضافي', () => {
      const logger = createLogger('TestModule');
      const error = new Error('خطأ اختبار');
      
      logger.error('حدث خطأ', error, { userId: 123, action: 'test' });
      
      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });

  describe('Context', () => {
    it('يجب تضمين السياق في الرسالة', () => {
      const logger = createLogger('TestModule');
      
      logger.info('رسالة اختبار', { userId: 123, action: 'login' });
      
      expect(consoleSpy.info).toHaveBeenCalled();
      const call = consoleSpy.info.mock.calls[0][0];
      expect(call).toContain('userId');
    });

    it('يجب دمج السياق الافتراضي مع السياق الإضافي', () => {
      const logger = createLogger('TestModule', { module: 'Auth' });
      
      logger.info('رسالة اختبار', { action: 'login' });
      
      expect(consoleSpy.info).toHaveBeenCalled();
    });
  });

  describe('Child Logger', () => {
    it('يجب إنشاء logger فرعي مع سياق إضافي', () => {
      const parentLogger = createLogger('ParentModule');
      const childLogger = parentLogger.child({ requestId: 'req_123' });
      
      expect(childLogger).toBeDefined();
      childLogger.info('رسالة من الـ child');
      
      expect(consoleSpy.info).toHaveBeenCalled();
    });
  });

  describe('Timing Operations', () => {
    it('يجب قياس وقت العملية باستخدام startOperation', async () => {
      const logger = createLogger('TestModule');
      
      const endOperation = logger.startOperation('عملية اختبار');
      
      // محاكاة عملية تستغرق وقتاً
      await new Promise(resolve => setTimeout(resolve, 10));
      
      endOperation();
      
      expect(consoleSpy.debug).toHaveBeenCalled();
      expect(consoleSpy.info).toHaveBeenCalled();
    });

    it('يجب قياس وقت العملية باستخدام withTiming', async () => {
      const logger = createLogger('TestModule');
      
      const result = await logger.withTiming(
        'عملية اختبار',
        async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'نتيجة';
        }
      );
      
      expect(result).toBe('نتيجة');
      expect(consoleSpy.debug).toHaveBeenCalled();
      expect(consoleSpy.info).toHaveBeenCalled();
    });

    it('يجب تسجيل الخطأ عند فشل العملية في withTiming', async () => {
      const logger = createLogger('TestModule');
      
      await expect(
        logger.withTiming(
          'عملية فاشلة',
          async () => {
            throw new Error('خطأ اختبار');
          }
        )
      ).rejects.toThrow('خطأ اختبار');
      
      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });

  describe('Pre-configured Loggers', () => {
    it('يجب أن تكون جميع الـ loggers المعدة مسبقاً متاحة', () => {
      expect(authLogger).toBeDefined();
      expect(dbLogger).toBeDefined();
      expect(apiLogger).toBeDefined();
      expect(symbolAiLogger).toBeDefined();
      expect(requestsLogger).toBeDefined();
      expect(notificationLogger).toBeDefined();
      expect(storageLogger).toBeDefined();
      expect(payrollLogger).toBeDefined();
      expect(bonusLogger).toBeDefined();
      expect(attendanceLogger).toBeDefined();
    });

    it('يجب أن يعمل authLogger بشكل صحيح', () => {
      authLogger.info('تسجيل دخول ناجح', { userId: 123 });
      
      expect(consoleSpy.info).toHaveBeenCalled();
      const call = consoleSpy.info.mock.calls[0][0];
      expect(call).toContain('Auth');
    });

    it('يجب أن يعمل symbolAiLogger بشكل صحيح', () => {
      symbolAiLogger.info('معالجة طلب', { sessionId: 'sess_123' });
      
      expect(consoleSpy.info).toHaveBeenCalled();
      const call = consoleSpy.info.mock.calls[0][0];
      expect(call).toContain('SymbolAI');
    });

    it('يجب أن يعمل requestsLogger بشكل صحيح', () => {
      requestsLogger.info('طلب جديد', { requestId: 'REQ-001' });
      
      expect(consoleSpy.info).toHaveBeenCalled();
      const call = consoleSpy.info.mock.calls[0][0];
      expect(call).toContain('Requests');
    });
  });
});
