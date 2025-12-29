/**
 * نظام معالجة الأخطاء المتقدم
 * Advanced Exception Handling System
 * 
 * يوفر هذا الملف مجموعة شاملة من الاستثناءات المخصصة
 * لمعالجة الأخطاء بشكل موحد ومنظم في جميع أنحاء التطبيق
 */

import { TRPCError } from '@trpc/server';

// ==================== Base Exception Classes ====================

/**
 * الاستثناء الأساسي - جميع الاستثناءات المخصصة ترث منه
 */
export class BaseException extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly timestamp: Date;
  public readonly details?: Record<string, any>;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    details?: Record<string, any>,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.timestamp = new Date();
    this.details = details;
    this.isOperational = isOperational;
    
    // الحفاظ على stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * تحويل الاستثناء إلى كائن JSON
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      details: this.details,
    };
  }

  /**
   * تحويل إلى TRPCError للاستخدام مع tRPC
   */
  toTRPCError(): TRPCError {
    const trpcCode = this.getTRPCCode();
    return new TRPCError({
      code: trpcCode,
      message: this.message,
      cause: this,
    });
  }

  /**
   * الحصول على كود tRPC المناسب
   */
  protected getTRPCCode(): 
    | 'PARSE_ERROR'
    | 'BAD_REQUEST'
    | 'INTERNAL_SERVER_ERROR'
    | 'NOT_IMPLEMENTED'
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'METHOD_NOT_SUPPORTED'
    | 'TIMEOUT'
    | 'CONFLICT'
    | 'PRECONDITION_FAILED'
    | 'PAYLOAD_TOO_LARGE'
    | 'UNPROCESSABLE_CONTENT'
    | 'TOO_MANY_REQUESTS'
    | 'CLIENT_CLOSED_REQUEST' {
    switch (this.statusCode) {
      case 400: return 'BAD_REQUEST';
      case 401: return 'UNAUTHORIZED';
      case 403: return 'FORBIDDEN';
      case 404: return 'NOT_FOUND';
      case 408: return 'TIMEOUT';
      case 409: return 'CONFLICT';
      case 413: return 'PAYLOAD_TOO_LARGE';
      case 422: return 'UNPROCESSABLE_CONTENT';
      case 429: return 'TOO_MANY_REQUESTS';
      default: return 'INTERNAL_SERVER_ERROR';
    }
  }
}

// ==================== Validation Exceptions ====================

/**
 * استثناء التحقق من الصحة
 */
export class ValidationException extends BaseException {
  public readonly field?: string;
  public readonly validationErrors?: Array<{ field: string; message: string }>;

  constructor(
    message: string,
    field?: string,
    validationErrors?: Array<{ field: string; message: string }>,
    details?: Record<string, any>
  ) {
    super(message, 'VALIDATION_ERROR', 400, { ...details, field, validationErrors });
    this.field = field;
    this.validationErrors = validationErrors;
  }
}

// ==================== Authentication & Authorization Exceptions ====================

/**
 * استثناء المصادقة - فشل تسجيل الدخول
 */
export class AuthenticationException extends BaseException {
  public readonly attemptedUsername?: string;
  public readonly failedAttempts?: number;

  constructor(
    message: string = 'فشل المصادقة',
    attemptedUsername?: string,
    failedAttempts?: number,
    details?: Record<string, any>
  ) {
    super(message, 'AUTHENTICATION_ERROR', 401, { ...details, attemptedUsername, failedAttempts });
    this.attemptedUsername = attemptedUsername;
    this.failedAttempts = failedAttempts;
  }
}

/**
 * استثناء التفويض - عدم وجود صلاحيات
 */
export class AuthorizationException extends BaseException {
  public readonly requiredRole?: string;
  public readonly userRole?: string;
  public readonly resource?: string;
  public readonly action?: string;

  constructor(
    message: string = 'غير مصرح لك بهذا الإجراء',
    requiredRole?: string,
    userRole?: string,
    resource?: string,
    action?: string,
    details?: Record<string, any>
  ) {
    super(message, 'AUTHORIZATION_ERROR', 403, { ...details, requiredRole, userRole, resource, action });
    this.requiredRole = requiredRole;
    this.userRole = userRole;
    this.resource = resource;
    this.action = action;
  }
}

// ==================== Resource Exceptions ====================

/**
 * استثناء عدم العثور على المورد
 */
export class NotFoundException extends BaseException {
  public readonly resourceType?: string;
  public readonly resourceId?: string | number;

  constructor(
    message: string = 'المورد غير موجود',
    resourceType?: string,
    resourceId?: string | number,
    details?: Record<string, any>
  ) {
    super(message, 'NOT_FOUND', 404, { ...details, resourceType, resourceId });
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}

// ==================== Database Exceptions ====================

/**
 * استثناء قاعدة البيانات
 */
export class DatabaseException extends BaseException {
  public readonly query?: string;
  public readonly originalError?: Error;

  constructor(
    message: string = 'خطأ في قاعدة البيانات',
    query?: string,
    originalError?: Error,
    details?: Record<string, any>
  ) {
    super(message, 'DATABASE_ERROR', 500, { ...details, query }, false);
    this.query = query;
    this.originalError = originalError;
  }
}

// ==================== Business Logic Exceptions ====================

/**
 * استثناء قواعد العمل
 */
export class BusinessRuleException extends BaseException {
  public readonly rule?: string;

  constructor(
    message: string,
    rule?: string,
    details?: Record<string, any>
  ) {
    super(message, 'BUSINESS_RULE_VIOLATION', 422, { ...details, rule });
    this.rule = rule;
  }
}

/**
 * استثناء الرصيد غير الكافي
 */
export class InsufficientBalanceException extends BaseException {
  public readonly required: number;
  public readonly available: number;
  public readonly currency: string;

  constructor(
    message: string = 'الرصيد غير كافي',
    required: number,
    available: number,
    currency: string = 'SAR',
    details?: Record<string, any>
  ) {
    super(message, 'INSUFFICIENT_BALANCE', 422, { ...details, required, available, currency });
    this.required = required;
    this.available = available;
    this.currency = currency;
  }
}

/**
 * استثناء تجاوز الميزانية
 */
export class BudgetExceededException extends BaseException {
  public readonly budgetLimit: number;
  public readonly currentAmount: number;
  public readonly requestedAmount: number;

  constructor(
    message: string = 'تم تجاوز حد الميزانية',
    budgetLimit: number,
    currentAmount: number,
    requestedAmount: number,
    details?: Record<string, any>
  ) {
    super(message, 'BUDGET_EXCEEDED', 422, { ...details, budgetLimit, currentAmount, requestedAmount });
    this.budgetLimit = budgetLimit;
    this.currentAmount = currentAmount;
    this.requestedAmount = requestedAmount;
  }
}

/**
 * استثناء المبلغ غير الصالح
 */
export class InvalidAmountException extends BaseException {
  public readonly amount: number;
  public readonly minAmount?: number;
  public readonly maxAmount?: number;

  constructor(
    message: string = 'المبلغ غير صالح',
    amount: number,
    minAmount?: number,
    maxAmount?: number,
    details?: Record<string, any>
  ) {
    super(message, 'INVALID_AMOUNT', 400, { ...details, amount, minAmount, maxAmount });
    this.amount = amount;
    this.minAmount = minAmount;
    this.maxAmount = maxAmount;
  }
}

// ==================== Email & Notification Exceptions ====================

/**
 * استثناء البريد الإلكتروني
 */
export class EmailException extends BaseException {
  public readonly recipient?: string;
  public readonly subject?: string;
  public readonly originalError?: Error;

  constructor(
    message: string = 'فشل إرسال البريد الإلكتروني',
    recipient?: string,
    subject?: string,
    originalError?: Error,
    details?: Record<string, any>
  ) {
    super(message, 'EMAIL_ERROR', 500, { ...details, recipient, subject });
    this.recipient = recipient;
    this.subject = subject;
    this.originalError = originalError;
  }
}

/**
 * استثناء SMTP - أخطاء خادم البريد
 */
export class SMTPException extends BaseException {
  public readonly smtpCode?: number;
  public readonly smtpResponse?: string;
  public readonly host?: string;
  public readonly port?: number;

  constructor(
    message: string = 'خطأ في خادم البريد SMTP',
    smtpCode?: number,
    smtpResponse?: string,
    host?: string,
    port?: number,
    details?: Record<string, any>
  ) {
    super(message, 'SMTP_ERROR', 502, { ...details, smtpCode, smtpResponse, host, port });
    this.smtpCode = smtpCode;
    this.smtpResponse = smtpResponse;
    this.host = host;
    this.port = port;
  }
}

/**
 * استثناء الإشعارات
 */
export class NotificationException extends BaseException {
  public readonly notificationType?: 'email' | 'push' | 'sms' | 'in-app';
  public readonly recipientId?: string | number;
  public readonly originalError?: Error;

  constructor(
    message: string = 'فشل إرسال الإشعار',
    notificationType?: 'email' | 'push' | 'sms' | 'in-app',
    recipientId?: string | number,
    originalError?: Error,
    details?: Record<string, any>
  ) {
    super(message, 'NOTIFICATION_ERROR', 500, { ...details, notificationType, recipientId });
    this.notificationType = notificationType;
    this.recipientId = recipientId;
    this.originalError = originalError;
  }
}

/**
 * استثناء القوالب
 */
export class TemplateException extends BaseException {
  public readonly templateName?: string;
  public readonly templateType?: 'email' | 'pdf' | 'html' | 'sms';
  public readonly missingVariables?: string[];
  public readonly originalError?: Error;

  constructor(
    message: string = 'خطأ في معالجة القالب',
    templateName?: string,
    templateType?: 'email' | 'pdf' | 'html' | 'sms',
    missingVariables?: string[],
    originalError?: Error,
    details?: Record<string, any>
  ) {
    super(message, 'TEMPLATE_ERROR', 500, { ...details, templateName, templateType, missingVariables });
    this.templateName = templateName;
    this.templateType = templateType;
    this.missingVariables = missingVariables;
    this.originalError = originalError;
  }
}

// ==================== File & Storage Exceptions ====================

/**
 * استثناء رفع الملفات
 */
export class FileUploadException extends BaseException {
  public readonly fileName?: string;
  public readonly fileSize?: number;
  public readonly fileType?: string;
  public readonly maxSize?: number;
  public readonly allowedTypes?: string[];

  constructor(
    message: string = 'فشل رفع الملف',
    fileName?: string,
    fileSize?: number,
    fileType?: string,
    maxSize?: number,
    allowedTypes?: string[],
    details?: Record<string, any>
  ) {
    super(message, 'FILE_UPLOAD_ERROR', 400, { ...details, fileName, fileSize, fileType, maxSize, allowedTypes });
    this.fileName = fileName;
    this.fileSize = fileSize;
    this.fileType = fileType;
    this.maxSize = maxSize;
    this.allowedTypes = allowedTypes;
  }
}

/**
 * استثناء التخزين (S3)
 */
export class StorageException extends BaseException {
  public readonly operation?: 'upload' | 'download' | 'delete' | 'list' | 'copy';
  public readonly bucket?: string;
  public readonly key?: string;
  public readonly originalError?: Error;

  constructor(
    message: string = 'خطأ في التخزين',
    operation?: 'upload' | 'download' | 'delete' | 'list' | 'copy',
    bucket?: string,
    key?: string,
    originalError?: Error,
    details?: Record<string, any>
  ) {
    super(message, 'STORAGE_ERROR', 500, { ...details, operation, bucket, key });
    this.operation = operation;
    this.bucket = bucket;
    this.key = key;
    this.originalError = originalError;
  }
}

// ==================== Rate Limiting & Timeout Exceptions ====================

/**
 * استثناء تجاوز حد الطلبات
 */
export class RateLimitException extends BaseException {
  public readonly limit: number;
  public readonly current: number;
  public readonly resetTime?: Date;
  public readonly retryAfter?: number; // بالثواني

  constructor(
    message: string = 'تم تجاوز حد الطلبات المسموح',
    limit: number,
    current: number,
    resetTime?: Date,
    retryAfter?: number,
    details?: Record<string, any>
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, { ...details, limit, current, resetTime, retryAfter });
    this.limit = limit;
    this.current = current;
    this.resetTime = resetTime;
    this.retryAfter = retryAfter;
  }

  /**
   * الحصول على رؤوس HTTP للاستجابة
   */
  getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'X-RateLimit-Limit': this.limit.toString(),
      'X-RateLimit-Remaining': Math.max(0, this.limit - this.current).toString(),
    };
    
    if (this.resetTime) {
      headers['X-RateLimit-Reset'] = Math.floor(this.resetTime.getTime() / 1000).toString();
    }
    
    if (this.retryAfter) {
      headers['Retry-After'] = this.retryAfter.toString();
    }
    
    return headers;
  }
}

/**
 * استثناء انتهاء المهلة
 */
export class TimeoutException extends BaseException {
  public readonly operation?: string;
  public readonly timeout: number; // بالمللي ثانية
  public readonly elapsed?: number;

  constructor(
    message: string = 'انتهت مهلة العملية',
    operation?: string,
    timeout: number = 30000,
    elapsed?: number,
    details?: Record<string, any>
  ) {
    super(message, 'TIMEOUT', 408, { ...details, operation, timeout, elapsed });
    this.operation = operation;
    this.timeout = timeout;
    this.elapsed = elapsed;
  }
}

// ==================== Conflict & State Exceptions ====================

/**
 * استثناء التعارض
 */
export class ConflictException extends BaseException {
  public readonly conflictingResource?: string;
  public readonly existingValue?: any;
  public readonly newValue?: any;

  constructor(
    message: string = 'تعارض في البيانات',
    conflictingResource?: string,
    existingValue?: any,
    newValue?: any,
    details?: Record<string, any>
  ) {
    super(message, 'CONFLICT', 409, { ...details, conflictingResource, existingValue, newValue });
    this.conflictingResource = conflictingResource;
    this.existingValue = existingValue;
    this.newValue = newValue;
  }
}

/**
 * استثناء الحالة غير الصالحة
 */
export class InvalidStateException extends BaseException {
  public readonly currentState?: string;
  public readonly expectedState?: string;
  public readonly allowedTransitions?: string[];

  constructor(
    message: string = 'حالة غير صالحة للعملية',
    currentState?: string,
    expectedState?: string,
    allowedTransitions?: string[],
    details?: Record<string, any>
  ) {
    super(message, 'INVALID_STATE', 422, { ...details, currentState, expectedState, allowedTransitions });
    this.currentState = currentState;
    this.expectedState = expectedState;
    this.allowedTransitions = allowedTransitions;
  }
}

// ==================== External Service Exceptions ====================

/**
 * استثناء الخدمات الخارجية
 */
export class ExternalServiceException extends BaseException {
  public readonly serviceName: string;
  public readonly serviceEndpoint?: string;
  public readonly responseStatus?: number;
  public readonly responseBody?: any;
  public readonly originalError?: Error;

  constructor(
    message: string = 'خطأ في الخدمة الخارجية',
    serviceName: string,
    serviceEndpoint?: string,
    responseStatus?: number,
    responseBody?: any,
    originalError?: Error,
    details?: Record<string, any>
  ) {
    super(message, 'EXTERNAL_SERVICE_ERROR', 502, { ...details, serviceName, serviceEndpoint, responseStatus });
    this.serviceName = serviceName;
    this.serviceEndpoint = serviceEndpoint;
    this.responseStatus = responseStatus;
    this.responseBody = responseBody;
    this.originalError = originalError;
  }
}

// ==================== Utility Functions ====================

/**
 * التحقق مما إذا كان الخطأ من نوع BaseException
 */
export function isBaseException(error: unknown): error is BaseException {
  return error instanceof BaseException;
}

/**
 * تحويل خطأ عام إلى BaseException
 */
export function toBaseException(error: unknown): BaseException {
  if (isBaseException(error)) {
    return error;
  }
  
  if (error instanceof Error) {
    return new BaseException(
      error.message,
      'UNKNOWN_ERROR',
      500,
      { originalError: error.name, stack: error.stack },
      false
    );
  }
  
  return new BaseException(
    String(error),
    'UNKNOWN_ERROR',
    500,
    undefined,
    false
  );
}

/**
 * إنشاء استثناء من رمز الخطأ
 */
export function createExceptionFromCode(
  code: string,
  message: string,
  details?: Record<string, any>
): BaseException {
  switch (code) {
    case 'VALIDATION_ERROR':
      return new ValidationException(message, undefined, undefined, details);
    case 'AUTHENTICATION_ERROR':
      return new AuthenticationException(message, undefined, undefined, details);
    case 'AUTHORIZATION_ERROR':
      return new AuthorizationException(message, undefined, undefined, undefined, undefined, details);
    case 'NOT_FOUND':
      return new NotFoundException(message, undefined, undefined, details);
    case 'DATABASE_ERROR':
      return new DatabaseException(message, undefined, undefined, details);
    case 'BUSINESS_RULE_VIOLATION':
      return new BusinessRuleException(message, undefined, details);
    case 'EMAIL_ERROR':
      return new EmailException(message, undefined, undefined, undefined, details);
    case 'SMTP_ERROR':
      return new SMTPException(message, undefined, undefined, undefined, undefined, details);
    case 'NOTIFICATION_ERROR':
      return new NotificationException(message, undefined, undefined, undefined, details);
    case 'TEMPLATE_ERROR':
      return new TemplateException(message, undefined, undefined, undefined, undefined, details);
    case 'FILE_UPLOAD_ERROR':
      return new FileUploadException(message, undefined, undefined, undefined, undefined, undefined, details);
    case 'STORAGE_ERROR':
      return new StorageException(message, undefined, undefined, undefined, undefined, details);
    case 'RATE_LIMIT_EXCEEDED':
      return new RateLimitException(message, 0, 0, undefined, undefined, details);
    case 'TIMEOUT':
      return new TimeoutException(message, undefined, 30000, undefined, details);
    case 'CONFLICT':
      return new ConflictException(message, undefined, undefined, undefined, details);
    case 'INVALID_STATE':
      return new InvalidStateException(message, undefined, undefined, undefined, details);
    case 'EXTERNAL_SERVICE_ERROR':
      return new ExternalServiceException(message, 'unknown', undefined, undefined, undefined, undefined, details);
    default:
      return new BaseException(message, code, 500, details);
  }
}
