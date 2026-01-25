/**
 * Middleware لمعالجة الأخطاء في tRPC
 * tRPC Error Handling Middleware
 */

import { TRPCError } from '@trpc/server';
import { createLogger } from '../utils/logger';
import {
  globalExceptionHandler,
} from '../exceptions/GlobalExceptionHandler';
import {
  BaseException,
  ValidationException,
  AuthenticationException,
  AuthorizationException,
  NotFoundException,
  DatabaseException,
  BusinessRuleException,
  isBaseException,
} from '../exceptions';

const logger = createLogger('ErrorMiddleware');

// ==================== Helper Functions ====================

/**
 * توليد معرف فريد للطلب
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * معالجة الخطأ وتحويله إلى TRPCError
 */
export async function handleError(
  error: unknown,
  context: {
    path?: string;
    userId?: number;
    requestId?: string;
  }
): Promise<TRPCError> {
  const { path, userId, requestId } = context;

  // معالجة الخطأ وتسجيله
  await globalExceptionHandler.handle(error, {
    requestId,
    userId,
    requestPath: path,
  });

  logger.error(`فشل: ${path || 'unknown'}`, error, {
    requestId,
    userId,
  });

  // تحويل الخطأ إلى TRPCError
  if (error instanceof TRPCError) {
    return error;
  }

  if (isBaseException(error)) {
    return error.toTRPCError();
  }

  // خطأ غير معروف
  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'حدث خطأ غير متوقع. يرجى المحاولة لاحقاً.',
    cause: error,
  });
}

/**
 * تغليف دالة مع معالجة الأخطاء
 */
export function wrapWithErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  moduleName: string
): T {
  const moduleLogger = createLogger(moduleName);

  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      moduleLogger.error('خطأ في العملية', error);
      
      if (isBaseException(error)) {
        throw error;
      }

      // تحويل الخطأ إلى BaseException
      if (error instanceof Error) {
        throw new BaseException(
          error.message,
          'INTERNAL_ERROR',
          500,
          { originalError: error.name },
          false
        );
      }

      throw new BaseException(
        'حدث خطأ غير متوقع',
        'UNKNOWN_ERROR',
        500,
        undefined,
        false
      );
    }
  }) as T;
}

/**
 * معالج أخطاء قاعدة البيانات
 */
export function handleDatabaseError(error: unknown, operation: string): never {
  const dbLogger = createLogger('Database');
  
  dbLogger.error(`خطأ في قاعدة البيانات: ${operation}`, error);

  if (error instanceof Error) {
    // التحقق من أنواع أخطاء قاعدة البيانات الشائعة
    const message = error.message.toLowerCase();

    if (message.includes('duplicate') || message.includes('unique')) {
      throw new BusinessRuleException(
        'هذا السجل موجود مسبقاً',
        'DUPLICATE_ENTRY'
      );
    }

    if (message.includes('foreign key') || message.includes('constraint')) {
      throw new BusinessRuleException(
        'لا يمكن تنفيذ هذه العملية بسبب ارتباطات موجودة',
        'FOREIGN_KEY_CONSTRAINT'
      );
    }

    if (message.includes('connection') || message.includes('timeout')) {
      throw new DatabaseException(
        'فشل الاتصال بقاعدة البيانات. يرجى المحاولة لاحقاً.',
        operation,
        error
      );
    }
  }

  throw new DatabaseException(
    'حدث خطأ في قاعدة البيانات',
    operation,
    error instanceof Error ? error : undefined
  );
}

/**
 * معالج أخطاء المصادقة
 */
export function handleAuthError(error: unknown, context?: string): never {
  const authLogger = createLogger('Auth');
  
  authLogger.warn(`خطأ في المصادقة: ${context || 'unknown'}`, { error: String(error) });

  if (isBaseException(error)) {
    throw error;
  }

  throw new AuthenticationException(
    'فشل التحقق من الهوية. يرجى تسجيل الدخول مرة أخرى.'
  );
}

/**
 * معالج أخطاء الصلاحيات
 */
export function handleAuthorizationError(
  requiredRole?: string,
  userRole?: string,
  resource?: string,
  action?: string
): never {
  const authLogger = createLogger('Auth');
  
  authLogger.warn('محاولة وصول غير مصرح', {
    requiredRole,
    userRole,
    resource,
    action,
  });

  throw new AuthorizationException(
    'ليس لديك الصلاحية للقيام بهذا الإجراء',
    requiredRole,
    userRole,
    resource,
    action
  );
}

/**
 * معالج أخطاء عدم العثور على المورد
 */
export function handleNotFoundError(
  resourceType: string,
  resourceId?: string | number
): never {
  throw new NotFoundException(
    `${resourceType} غير موجود`,
    resourceType,
    resourceId
  );
}

/**
 * معالج أخطاء التحقق من الصحة
 */
export function handleValidationError(
  message: string,
  field?: string,
  validationErrors?: Array<{ field: string; message: string }>
): never {
  throw new ValidationException(message, field, validationErrors);
}

/**
 * معالج أخطاء قواعد العمل
 */
export function handleBusinessRuleError(message: string, rule?: string): never {
  throw new BusinessRuleException(message, rule);
}

// ==================== Exports ====================

export {
  BaseException,
  ValidationException,
  AuthenticationException,
  AuthorizationException,
  NotFoundException,
  DatabaseException,
  BusinessRuleException,
};
