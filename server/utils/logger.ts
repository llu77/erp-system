/**
 * نظام التسجيل المنظم (Structured Logger)
 * Structured Logging System
 * 
 * يوفر تسجيل منظم مع مستويات مختلفة ودعم للسياق
 */

// ==================== Types ====================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
  userId?: number;
  employeeId?: number;
  sessionId?: string;
  requestId?: string;
  module?: string;
  action?: string;
  duration?: number;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    code?: string;
    stack?: string;
  };
}

// ==================== Configuration ====================

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

const isProduction = process.env.NODE_ENV === 'production';
const minLogLevel: LogLevel = isProduction ? 'info' : 'debug';

// ==================== Logger Class ====================

class Logger {
  private module: string;
  private defaultContext: LogContext;

  constructor(module: string, defaultContext: LogContext = {}) {
    this.module = module;
    this.defaultContext = { module, ...defaultContext };
  }

  /**
   * إنشاء logger فرعي مع سياق إضافي
   */
  child(context: LogContext): Logger {
    const childLogger = new Logger(this.module, {
      ...this.defaultContext,
      ...context,
    });
    return childLogger;
  }

  /**
   * تسجيل رسالة debug
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * تسجيل رسالة info
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * تسجيل رسالة warn
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * تسجيل رسالة error
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorInfo = this.extractErrorInfo(error);
    this.log('error', message, context, errorInfo);
  }

  /**
   * تسجيل رسالة fatal
   */
  fatal(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorInfo = this.extractErrorInfo(error);
    this.log('fatal', message, context, errorInfo);
  }

  /**
   * تسجيل بداية عملية مع قياس الوقت
   */
  startOperation(operationName: string, context?: LogContext): () => void {
    const startTime = Date.now();
    this.debug(`بدء: ${operationName}`, context);

    return () => {
      const duration = Date.now() - startTime;
      this.info(`انتهاء: ${operationName}`, { ...context, duration });
    };
  }

  /**
   * تسجيل عملية كاملة مع قياس الوقت
   */
  async withTiming<T>(
    operationName: string,
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const startTime = Date.now();
    this.debug(`بدء: ${operationName}`, context);

    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      this.info(`نجاح: ${operationName}`, { ...context, duration });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.error(`فشل: ${operationName}`, error, { ...context, duration });
      throw error;
    }
  }

  /**
   * التسجيل الأساسي
   */
  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: LogEntry['error']
  ): void {
    // التحقق من مستوى التسجيل
    if (LOG_LEVELS[level] < LOG_LEVELS[minLogLevel]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.defaultContext, ...context },
      error,
    };

    this.output(entry);
  }

  /**
   * استخراج معلومات الخطأ
   */
  private extractErrorInfo(error: unknown): LogEntry['error'] | undefined {
    if (!error) return undefined;

    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        code: (error as any).code,
        stack: isProduction ? undefined : error.stack,
      };
    }

    return {
      name: 'UnknownError',
      message: String(error),
    };
  }

  /**
   * إخراج السجل
   */
  private output(entry: LogEntry): void {
    const { timestamp, level, message, context, error } = entry;
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.module}]`;

    // تنسيق JSON للإنتاج
    if (isProduction) {
      console.log(JSON.stringify(entry));
      return;
    }

    // تنسيق قابل للقراءة للتطوير
    const contextStr = context && Object.keys(context).length > 1
      ? ` ${JSON.stringify(context)}`
      : '';

    switch (level) {
      case 'debug':
        console.debug(`${prefix} ${message}${contextStr}`);
        break;
      case 'info':
        console.info(`${prefix} ${message}${contextStr}`);
        break;
      case 'warn':
        console.warn(`${prefix} ${message}${contextStr}`);
        break;
      case 'error':
      case 'fatal':
        console.error(`${prefix} ${message}${contextStr}`, error || '');
        break;
    }
  }
}

// ==================== Factory Functions ====================

/**
 * إنشاء logger جديد لوحدة معينة
 */
export function createLogger(module: string, context?: LogContext): Logger {
  return new Logger(module, context);
}

// ==================== Pre-configured Loggers ====================

export const authLogger = createLogger('Auth');
export const dbLogger = createLogger('Database');
export const apiLogger = createLogger('API');
export const symbolAiLogger = createLogger('SymbolAI');
export const requestsLogger = createLogger('Requests');
export const notificationLogger = createLogger('Notification');
export const storageLogger = createLogger('Storage');
export const payrollLogger = createLogger('Payroll');
export const bonusLogger = createLogger('Bonus');
export const attendanceLogger = createLogger('Attendance');

// ==================== Default Export ====================

export default createLogger;
