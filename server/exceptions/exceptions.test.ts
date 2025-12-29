import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  createExceptionFromCode,
} from './index';

import {
  globalExceptionHandler,
  handleProcedureError,
  isValidationException,
  isAuthenticationException,
  isAuthorizationException,
  isNotFoundException,
  isDatabaseException,
  isEmailException,
  isSMTPException,
  isNotificationException,
  isTemplateException,
  isStorageException,
  isRateLimitException,
  isTimeoutException,
  isFileUploadException,
  isBusinessRuleException,
} from './GlobalExceptionHandler';

describe('Exception Classes', () => {
  describe('BaseException', () => {
    it('should create base exception with all properties', () => {
      const error = new BaseException('Test error', 'TEST_ERROR', 500, { key: 'value' });
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.details).toEqual({ key: 'value' });
      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.isOperational).toBe(true);
    });

    it('should convert to JSON correctly', () => {
      const error = new BaseException('Test', 'TEST', 400);
      const json = error.toJSON();
      
      expect(json.name).toBe('BaseException');
      expect(json.message).toBe('Test');
      expect(json.code).toBe('TEST');
      expect(json.statusCode).toBe(400);
      expect(json.timestamp).toBeDefined();
    });

    it('should convert to TRPCError', () => {
      const error = new BaseException('Test', 'TEST', 400);
      const trpcError = error.toTRPCError();
      
      expect(trpcError.code).toBe('BAD_REQUEST');
      expect(trpcError.message).toBe('Test');
    });
  });

  describe('ValidationException', () => {
    it('should create validation exception with field info', () => {
      const error = new ValidationException('Invalid email', 'email', [
        { field: 'email', message: 'البريد الإلكتروني غير صالح' }
      ]);
      
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.field).toBe('email');
      expect(error.validationErrors).toHaveLength(1);
    });
  });

  describe('AuthenticationException', () => {
    it('should create authentication exception', () => {
      const error = new AuthenticationException('فشل تسجيل الدخول', 'user@test.com', 3);
      
      expect(error.code).toBe('AUTHENTICATION_ERROR');
      expect(error.statusCode).toBe(401);
      expect(error.attemptedUsername).toBe('user@test.com');
      expect(error.failedAttempts).toBe(3);
    });
  });

  describe('AuthorizationException', () => {
    it('should create authorization exception with role info', () => {
      const error = new AuthorizationException(
        'غير مصرح',
        'admin',
        'user',
        'users',
        'delete'
      );
      
      expect(error.code).toBe('AUTHORIZATION_ERROR');
      expect(error.statusCode).toBe(403);
      expect(error.requiredRole).toBe('admin');
      expect(error.userRole).toBe('user');
      expect(error.resource).toBe('users');
      expect(error.action).toBe('delete');
    });
  });

  describe('NotFoundException', () => {
    it('should create not found exception', () => {
      const error = new NotFoundException('المستخدم غير موجود', 'User', 123);
      
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.resourceType).toBe('User');
      expect(error.resourceId).toBe(123);
    });
  });

  describe('DatabaseException', () => {
    it('should create database exception', () => {
      const originalError = new Error('Connection failed');
      const error = new DatabaseException('فشل الاتصال بقاعدة البيانات', 'SELECT * FROM users', originalError);
      
      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.query).toBe('SELECT * FROM users');
      expect(error.originalError).toBe(originalError);
      expect(error.isOperational).toBe(false);
    });
  });

  describe('InsufficientBalanceException', () => {
    it('should create insufficient balance exception', () => {
      const error = new InsufficientBalanceException('الرصيد غير كافي', 1000, 500, 'SAR');
      
      expect(error.code).toBe('INSUFFICIENT_BALANCE');
      expect(error.statusCode).toBe(422);
      expect(error.required).toBe(1000);
      expect(error.available).toBe(500);
      expect(error.currency).toBe('SAR');
    });
  });

  describe('BudgetExceededException', () => {
    it('should create budget exceeded exception', () => {
      const error = new BudgetExceededException('تجاوز الميزانية', 10000, 8000, 3000);
      
      expect(error.code).toBe('BUDGET_EXCEEDED');
      expect(error.budgetLimit).toBe(10000);
      expect(error.currentAmount).toBe(8000);
      expect(error.requestedAmount).toBe(3000);
    });
  });

  describe('EmailException', () => {
    it('should create email exception', () => {
      const error = new EmailException('فشل الإرسال', 'user@test.com', 'Test Subject');
      
      expect(error.code).toBe('EMAIL_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.recipient).toBe('user@test.com');
      expect(error.subject).toBe('Test Subject');
    });
  });

  describe('SMTPException', () => {
    it('should create SMTP exception', () => {
      const error = new SMTPException('خطأ SMTP', 550, 'Mailbox not found', 'smtp.example.com', 587);
      
      expect(error.code).toBe('SMTP_ERROR');
      expect(error.statusCode).toBe(502);
      expect(error.smtpCode).toBe(550);
      expect(error.smtpResponse).toBe('Mailbox not found');
      expect(error.host).toBe('smtp.example.com');
      expect(error.port).toBe(587);
    });
  });

  describe('NotificationException', () => {
    it('should create notification exception', () => {
      const error = new NotificationException('فشل الإشعار', 'email', 123);
      
      expect(error.code).toBe('NOTIFICATION_ERROR');
      expect(error.notificationType).toBe('email');
      expect(error.recipientId).toBe(123);
    });
  });

  describe('TemplateException', () => {
    it('should create template exception', () => {
      const error = new TemplateException(
        'خطأ في القالب',
        'welcome_email',
        'email',
        ['userName', 'companyName']
      );
      
      expect(error.code).toBe('TEMPLATE_ERROR');
      expect(error.templateName).toBe('welcome_email');
      expect(error.templateType).toBe('email');
      expect(error.missingVariables).toEqual(['userName', 'companyName']);
    });
  });

  describe('FileUploadException', () => {
    it('should create file upload exception', () => {
      const error = new FileUploadException(
        'حجم الملف كبير جداً',
        'document.pdf',
        15000000,
        'application/pdf',
        10000000,
        ['.pdf', '.doc']
      );
      
      expect(error.code).toBe('FILE_UPLOAD_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.fileName).toBe('document.pdf');
      expect(error.fileSize).toBe(15000000);
      expect(error.maxSize).toBe(10000000);
    });
  });

  describe('StorageException', () => {
    it('should create storage exception', () => {
      const error = new StorageException('فشل الرفع', 'upload', 'my-bucket', 'files/doc.pdf');
      
      expect(error.code).toBe('STORAGE_ERROR');
      expect(error.operation).toBe('upload');
      expect(error.bucket).toBe('my-bucket');
      expect(error.key).toBe('files/doc.pdf');
    });
  });

  describe('RateLimitException', () => {
    it('should create rate limit exception', () => {
      const resetTime = new Date(Date.now() + 60000);
      const error = new RateLimitException('تجاوز الحد', 100, 101, resetTime, 60);
      
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.statusCode).toBe(429);
      expect(error.limit).toBe(100);
      expect(error.current).toBe(101);
      expect(error.retryAfter).toBe(60);
    });

    it('should generate rate limit headers', () => {
      const resetTime = new Date(Date.now() + 60000);
      const error = new RateLimitException('تجاوز الحد', 100, 101, resetTime, 60);
      const headers = error.getHeaders();
      
      expect(headers['X-RateLimit-Limit']).toBe('100');
      expect(headers['X-RateLimit-Remaining']).toBe('0');
      expect(headers['Retry-After']).toBe('60');
    });
  });

  describe('TimeoutException', () => {
    it('should create timeout exception', () => {
      const error = new TimeoutException('انتهت المهلة', 'database_query', 30000, 35000);
      
      expect(error.code).toBe('TIMEOUT');
      expect(error.statusCode).toBe(408);
      expect(error.operation).toBe('database_query');
      expect(error.timeout).toBe(30000);
      expect(error.elapsed).toBe(35000);
    });
  });

  describe('ConflictException', () => {
    it('should create conflict exception', () => {
      const error = new ConflictException('البريد مستخدم', 'email', 'old@test.com', 'new@test.com');
      
      expect(error.code).toBe('CONFLICT');
      expect(error.statusCode).toBe(409);
      expect(error.conflictingResource).toBe('email');
    });
  });

  describe('InvalidStateException', () => {
    it('should create invalid state exception', () => {
      const error = new InvalidStateException(
        'لا يمكن الإلغاء',
        'completed',
        'pending',
        ['pending', 'in_progress']
      );
      
      expect(error.code).toBe('INVALID_STATE');
      expect(error.currentState).toBe('completed');
      expect(error.expectedState).toBe('pending');
      expect(error.allowedTransitions).toEqual(['pending', 'in_progress']);
    });
  });

  describe('ExternalServiceException', () => {
    it('should create external service exception', () => {
      const error = new ExternalServiceException(
        'فشل الخدمة',
        'PaymentGateway',
        'https://api.payment.com/charge',
        503,
        { error: 'Service unavailable' }
      );
      
      expect(error.code).toBe('EXTERNAL_SERVICE_ERROR');
      expect(error.statusCode).toBe(502);
      expect(error.serviceName).toBe('PaymentGateway');
      expect(error.serviceEndpoint).toBe('https://api.payment.com/charge');
      expect(error.responseStatus).toBe(503);
    });
  });
});

describe('Utility Functions', () => {
  describe('isBaseException', () => {
    it('should return true for BaseException instances', () => {
      expect(isBaseException(new BaseException('test', 'TEST'))).toBe(true);
      expect(isBaseException(new ValidationException('test'))).toBe(true);
      expect(isBaseException(new StorageException('test'))).toBe(true);
    });

    it('should return false for non-BaseException', () => {
      expect(isBaseException(new Error('test'))).toBe(false);
      expect(isBaseException('string')).toBe(false);
      expect(isBaseException(null)).toBe(false);
    });
  });

  describe('toBaseException', () => {
    it('should return same instance for BaseException', () => {
      const error = new ValidationException('test');
      expect(toBaseException(error)).toBe(error);
    });

    it('should convert Error to BaseException', () => {
      const error = new Error('test error');
      const converted = toBaseException(error);
      
      expect(converted).toBeInstanceOf(BaseException);
      expect(converted.message).toBe('test error');
      expect(converted.code).toBe('UNKNOWN_ERROR');
    });

    it('should convert string to BaseException', () => {
      const converted = toBaseException('string error');
      
      expect(converted).toBeInstanceOf(BaseException);
      expect(converted.message).toBe('string error');
    });
  });

  describe('createExceptionFromCode', () => {
    it('should create ValidationException from code', () => {
      const error = createExceptionFromCode('VALIDATION_ERROR', 'Invalid input');
      expect(error).toBeInstanceOf(ValidationException);
    });

    it('should create StorageException from code', () => {
      const error = createExceptionFromCode('STORAGE_ERROR', 'Storage failed');
      expect(error).toBeInstanceOf(StorageException);
    });

    it('should create BaseException for unknown code', () => {
      const error = createExceptionFromCode('UNKNOWN_CODE', 'Unknown error');
      expect(error).toBeInstanceOf(BaseException);
      expect(error.code).toBe('UNKNOWN_CODE');
    });
  });
});

describe('Type Guards', () => {
  it('should correctly identify exception types', () => {
    expect(isValidationException(new ValidationException('test'))).toBe(true);
    expect(isAuthenticationException(new AuthenticationException())).toBe(true);
    expect(isAuthorizationException(new AuthorizationException())).toBe(true);
    expect(isNotFoundException(new NotFoundException())).toBe(true);
    expect(isDatabaseException(new DatabaseException())).toBe(true);
    expect(isEmailException(new EmailException())).toBe(true);
    expect(isSMTPException(new SMTPException())).toBe(true);
    expect(isNotificationException(new NotificationException())).toBe(true);
    expect(isTemplateException(new TemplateException())).toBe(true);
    expect(isStorageException(new StorageException())).toBe(true);
    expect(isRateLimitException(new RateLimitException('test', 0, 0))).toBe(true);
    expect(isTimeoutException(new TimeoutException())).toBe(true);
    expect(isFileUploadException(new FileUploadException())).toBe(true);
    expect(isBusinessRuleException(new BusinessRuleException('test'))).toBe(true);
  });

  it('should return false for wrong types', () => {
    const error = new ValidationException('test');
    expect(isAuthenticationException(error)).toBe(false);
    expect(isStorageException(error)).toBe(false);
    expect(isRateLimitException(error)).toBe(false);
  });
});

describe('GlobalExceptionHandler', () => {
  beforeEach(() => {
    globalExceptionHandler.clearErrorLogs();
  });

  it('should handle BaseException', async () => {
    const error = new ValidationException('Invalid input');
    const response = await globalExceptionHandler.handle(error);
    
    expect(response.success).toBe(false);
    expect(response.error.code).toBe('VALIDATION_ERROR');
    expect(response.error.message).toBe('Invalid input');
  });

  it('should handle generic Error', async () => {
    const error = new Error('Something went wrong');
    const response = await globalExceptionHandler.handle(error);
    
    expect(response.success).toBe(false);
    expect(response.error.code).toBe('INTERNAL_ERROR');
  });

  it('should log errors', async () => {
    await globalExceptionHandler.handle(new ValidationException('test'));
    
    const logs = globalExceptionHandler.getErrorLogs();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].code).toBe('VALIDATION_ERROR');
  });

  it('should track error stats', async () => {
    await globalExceptionHandler.handle(new ValidationException('test1'));
    await globalExceptionHandler.handle(new ValidationException('test2'));
    await globalExceptionHandler.handle(new NotFoundException('test3'));
    
    const stats = globalExceptionHandler.getErrorStats();
    expect(stats['VALIDATION_ERROR']).toBe(2);
    expect(stats['NOT_FOUND']).toBe(1);
  });

  it('should convert to TRPCError', () => {
    const error = new AuthorizationException('غير مصرح');
    const trpcError = globalExceptionHandler.toTRPCError(error);
    
    expect(trpcError.code).toBe('FORBIDDEN');
    expect(trpcError.message).toBe('غير مصرح');
  });
});

describe('handleProcedureError', () => {
  it('should throw TRPCError', () => {
    const error = new ValidationException('Invalid');
    
    expect(() => handleProcedureError(error)).toThrow();
  });
});
