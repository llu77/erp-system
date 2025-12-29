/**
 * معالج الاستثناءات العام
 * Global Exception Handler
 * 
 * يوفر معالجة موحدة لجميع الأخطاء في التطبيق
 * مع دعم التسجيل والإشعارات والاستجابات المنسقة
 */

import { TRPCError } from '@trpc/server';
import {
  BaseException,
  ValidationException,
  AuthenticationException,
  AuthorizationException,
  NotFoundException,
  DatabaseException,
  BusinessRuleException,
  InsufficientBalanceException,
  BudgetExceededException,
  InvalidAmountException,
  EmailException,
  SMTPException,
  NotificationException,
  TemplateException,
  FileUploadException,
  StorageException,
  RateLimitException,
  TimeoutException,
  ConflictException,
  InvalidStateException,
  ExternalServiceException,
  isBaseException,
  toBaseException,
} from './index';

// ==================== Types ====================

interface ErrorLogEntry {
  id: string;
  timestamp: Date;
  level: 'error' | 'warn' | 'info';
  code: string;
  message: string;
  stack?: string;
  details?: Record<string, any>;
  userId?: number;
  requestPath?: string;
  requestMethod?: string;
  userAgent?: string;
  ip?: string;
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    requestId?: string;
  };
}

interface HandlerContext {
  userId?: number;
  requestPath?: string;
  requestMethod?: string;
  userAgent?: string;
  ip?: string;
  requestId?: string;
}

type ErrorCallback = (error: BaseException, context?: HandlerContext) => void | Promise<void>;

// ==================== Global Exception Handler ====================

class GlobalExceptionHandler {
  private static instance: GlobalExceptionHandler;
  private errorCallbacks: ErrorCallback[] = [];
  private errorLogs: ErrorLogEntry[] = [];
  private maxLogSize: number = 1000;
  private isProduction: boolean = process.env.NODE_ENV === 'production';

  private constructor() {}

  /**
   * الحصول على نسخة واحدة من المعالج (Singleton)
   */
  static getInstance(): GlobalExceptionHandler {
    if (!GlobalExceptionHandler.instance) {
      GlobalExceptionHandler.instance = new GlobalExceptionHandler();
    }
    return GlobalExceptionHandler.instance;
  }

  /**
   * تسجيل callback للأخطاء
   */
  onError(callback: ErrorCallback): void {
    this.errorCallbacks.push(callback);
  }

  /**
   * إزالة callback
   */
  removeErrorCallback(callback: ErrorCallback): void {
    const index = this.errorCallbacks.indexOf(callback);
    if (index > -1) {
      this.errorCallbacks.splice(index, 1);
    }
  }

  /**
   * معالجة الخطأ الرئيسية
   */
  async handle(error: unknown, context?: HandlerContext): Promise<ErrorResponse> {
    const baseException = this.normalizeError(error);
    
    // تسجيل الخطأ
    const logEntry = this.logError(baseException, context);
    
    // تنفيذ callbacks
    await this.executeCallbacks(baseException, context);
    
    // إنشاء الاستجابة
    return this.createErrorResponse(baseException, context?.requestId);
  }

  /**
   * تحويل الخطأ إلى BaseException
   */
  private normalizeError(error: unknown): BaseException {
    // إذا كان بالفعل BaseException
    if (isBaseException(error)) {
      return error;
    }

    // إذا كان TRPCError
    if (error instanceof TRPCError) {
      return this.convertTRPCError(error);
    }

    // إذا كان Error عادي
    if (error instanceof Error) {
      return this.convertGenericError(error);
    }

    // أي شيء آخر
    return toBaseException(error);
  }

  /**
   * تحويل TRPCError إلى BaseException
   */
  private convertTRPCError(error: TRPCError): BaseException {
    const statusCode = this.trpcCodeToStatus(error.code);
    
    switch (error.code) {
      case 'UNAUTHORIZED':
        return new AuthenticationException(error.message);
      case 'FORBIDDEN':
        return new AuthorizationException(error.message);
      case 'NOT_FOUND':
        return new NotFoundException(error.message);
      case 'BAD_REQUEST':
        return new ValidationException(error.message);
      case 'TIMEOUT':
        return new TimeoutException(error.message);
      case 'TOO_MANY_REQUESTS':
        return new RateLimitException(error.message, 0, 0);
      case 'CONFLICT':
        return new ConflictException(error.message);
      default:
        return new BaseException(error.message, error.code, statusCode);
    }
  }

  /**
   * تحويل Error عادي إلى BaseException
   */
  private convertGenericError(error: Error): BaseException {
    // محاولة تحديد نوع الخطأ من الرسالة
    const message = error.message.toLowerCase();
    
    if (message.includes('smtp') || message.includes('mail')) {
      return new SMTPException(error.message, undefined, undefined, undefined, undefined, { originalError: error.name });
    }
    
    if (message.includes('timeout') || message.includes('timed out')) {
      return new TimeoutException(error.message);
    }
    
    if (message.includes('rate limit') || message.includes('too many')) {
      return new RateLimitException(error.message, 0, 0);
    }
    
    if (message.includes('storage') || message.includes('s3') || message.includes('bucket')) {
      return new StorageException(error.message);
    }
    
    if (message.includes('database') || message.includes('sql') || message.includes('query')) {
      return new DatabaseException(error.message, undefined, error);
    }
    
    if (message.includes('template') || message.includes('render')) {
      return new TemplateException(error.message);
    }
    
    if (message.includes('upload') || message.includes('file')) {
      return new FileUploadException(error.message);
    }
    
    return new BaseException(
      error.message,
      'INTERNAL_ERROR',
      500,
      { originalError: error.name, stack: error.stack },
      false
    );
  }

  /**
   * تحويل كود tRPC إلى كود HTTP
   */
  private trpcCodeToStatus(code: string): number {
    const mapping: Record<string, number> = {
      'PARSE_ERROR': 400,
      'BAD_REQUEST': 400,
      'UNAUTHORIZED': 401,
      'FORBIDDEN': 403,
      'NOT_FOUND': 404,
      'METHOD_NOT_SUPPORTED': 405,
      'TIMEOUT': 408,
      'CONFLICT': 409,
      'PRECONDITION_FAILED': 412,
      'PAYLOAD_TOO_LARGE': 413,
      'UNPROCESSABLE_CONTENT': 422,
      'TOO_MANY_REQUESTS': 429,
      'CLIENT_CLOSED_REQUEST': 499,
      'INTERNAL_SERVER_ERROR': 500,
      'NOT_IMPLEMENTED': 501,
    };
    return mapping[code] || 500;
  }

  /**
   * تسجيل الخطأ
   */
  private logError(error: BaseException, context?: HandlerContext): ErrorLogEntry {
    const logEntry: ErrorLogEntry = {
      id: this.generateLogId(),
      timestamp: new Date(),
      level: this.getLogLevel(error),
      code: error.code,
      message: error.message,
      stack: this.isProduction ? undefined : error.stack,
      details: error.details,
      userId: context?.userId,
      requestPath: context?.requestPath,
      requestMethod: context?.requestMethod,
      userAgent: context?.userAgent,
      ip: context?.ip,
    };

    // إضافة إلى السجل المحلي
    this.errorLogs.unshift(logEntry);
    if (this.errorLogs.length > this.maxLogSize) {
      this.errorLogs.pop();
    }

    // طباعة في console
    this.printLog(logEntry, error);

    return logEntry;
  }

  /**
   * تحديد مستوى السجل
   */
  private getLogLevel(error: BaseException): 'error' | 'warn' | 'info' {
    if (!error.isOperational) {
      return 'error';
    }
    
    switch (error.statusCode) {
      case 400:
      case 401:
      case 403:
      case 404:
        return 'warn';
      case 429:
        return 'info';
      default:
        return 'error';
    }
  }

  /**
   * طباعة السجل
   */
  private printLog(logEntry: ErrorLogEntry, error: BaseException): void {
    const timestamp = logEntry.timestamp.toISOString();
    const prefix = `[${timestamp}] [${logEntry.level.toUpperCase()}] [${error.code}]`;
    
    if (logEntry.level === 'error') {
      console.error(`${prefix} ${error.message}`, {
        details: error.details,
        stack: error.stack,
        context: {
          userId: logEntry.userId,
          path: logEntry.requestPath,
          method: logEntry.requestMethod,
        },
      });
    } else if (logEntry.level === 'warn') {
      console.warn(`${prefix} ${error.message}`, {
        details: error.details,
        context: {
          userId: logEntry.userId,
          path: logEntry.requestPath,
        },
      });
    } else {
      console.info(`${prefix} ${error.message}`);
    }
  }

  /**
   * تنفيذ callbacks
   */
  private async executeCallbacks(error: BaseException, context?: HandlerContext): Promise<void> {
    for (const callback of this.errorCallbacks) {
      try {
        await callback(error, context);
      } catch (callbackError) {
        console.error('[GlobalExceptionHandler] Error in callback:', callbackError);
      }
    }
  }

  /**
   * إنشاء استجابة الخطأ
   */
  private createErrorResponse(error: BaseException, requestId?: string): ErrorResponse {
    return {
      success: false,
      error: {
        code: error.code,
        message: this.isProduction ? this.getSafeMessage(error) : error.message,
        details: this.isProduction ? undefined : error.details,
        timestamp: error.timestamp.toISOString(),
        requestId,
      },
    };
  }

  /**
   * الحصول على رسالة آمنة للإنتاج
   */
  private getSafeMessage(error: BaseException): string {
    // إخفاء التفاصيل التقنية في الإنتاج
    if (!error.isOperational) {
      return 'حدث خطأ غير متوقع. يرجى المحاولة لاحقاً.';
    }
    return error.message;
  }

  /**
   * توليد معرف فريد للسجل
   */
  private generateLogId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * الحصول على سجلات الأخطاء
   */
  getErrorLogs(limit: number = 100): ErrorLogEntry[] {
    return this.errorLogs.slice(0, limit);
  }

  /**
   * الحصول على إحصائيات الأخطاء
   */
  getErrorStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const log of this.errorLogs) {
      stats[log.code] = (stats[log.code] || 0) + 1;
    }
    return stats;
  }

  /**
   * مسح سجلات الأخطاء
   */
  clearErrorLogs(): void {
    this.errorLogs = [];
  }

  /**
   * تحويل الخطأ إلى TRPCError
   */
  toTRPCError(error: unknown): TRPCError {
    const baseException = this.normalizeError(error);
    return baseException.toTRPCError();
  }
}

// ==================== Singleton Export ====================

export const globalExceptionHandler = GlobalExceptionHandler.getInstance();

// ==================== Helper Functions ====================

/**
 * معالج الأخطاء للاستخدام في tRPC procedures
 */
export function handleProcedureError(error: unknown): never {
  throw globalExceptionHandler.toTRPCError(error);
}

/**
 * wrapper للدوال مع معالجة الأخطاء
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: Partial<HandlerContext>
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      await globalExceptionHandler.handle(error, context as HandlerContext);
      throw globalExceptionHandler.toTRPCError(error);
    }
  }) as T;
}

/**
 * إنشاء middleware لمعالجة الأخطاء في Express
 */
export function createExpressErrorHandler() {
  return async (err: any, req: any, res: any, next: any) => {
    const context: HandlerContext = {
      requestPath: req.path,
      requestMethod: req.method,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection?.remoteAddress,
      userId: req.user?.id,
    };

    const response = await globalExceptionHandler.handle(err, context);
    
    const baseException = isBaseException(err) ? err : toBaseException(err);
    
    // إضافة headers خاصة لـ RateLimitException
    if (err instanceof RateLimitException) {
      const headers = err.getHeaders();
      Object.entries(headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }

    res.status(baseException.statusCode).json(response);
  };
}

/**
 * تسجيل callback لإرسال إشعارات عند الأخطاء الحرجة
 */
export function registerCriticalErrorNotifier(
  notifyFn: (error: BaseException) => Promise<void>
): void {
  globalExceptionHandler.onError(async (error) => {
    // إرسال إشعار فقط للأخطاء غير التشغيلية أو الأخطاء الخطيرة
    if (!error.isOperational || error.statusCode >= 500) {
      try {
        await notifyFn(error);
      } catch (notifyError) {
        console.error('[CriticalErrorNotifier] Failed to send notification:', notifyError);
      }
    }
  });
}

// ==================== Type Guards ====================

export function isValidationException(error: unknown): error is ValidationException {
  return error instanceof ValidationException;
}

export function isAuthenticationException(error: unknown): error is AuthenticationException {
  return error instanceof AuthenticationException;
}

export function isAuthorizationException(error: unknown): error is AuthorizationException {
  return error instanceof AuthorizationException;
}

export function isNotFoundException(error: unknown): error is NotFoundException {
  return error instanceof NotFoundException;
}

export function isDatabaseException(error: unknown): error is DatabaseException {
  return error instanceof DatabaseException;
}

export function isEmailException(error: unknown): error is EmailException {
  return error instanceof EmailException;
}

export function isSMTPException(error: unknown): error is SMTPException {
  return error instanceof SMTPException;
}

export function isNotificationException(error: unknown): error is NotificationException {
  return error instanceof NotificationException;
}

export function isTemplateException(error: unknown): error is TemplateException {
  return error instanceof TemplateException;
}

export function isStorageException(error: unknown): error is StorageException {
  return error instanceof StorageException;
}

export function isRateLimitException(error: unknown): error is RateLimitException {
  return error instanceof RateLimitException;
}

export function isTimeoutException(error: unknown): error is TimeoutException {
  return error instanceof TimeoutException;
}

export function isFileUploadException(error: unknown): error is FileUploadException {
  return error instanceof FileUploadException;
}

export function isBusinessRuleException(error: unknown): error is BusinessRuleException {
  return error instanceof BusinessRuleException;
}
