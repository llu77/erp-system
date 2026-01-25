/**
 * اختبارات middleware معالجة الأخطاء
 * Error Middleware Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateRequestId,
  handleError,
  wrapWithErrorHandling,
  handleDatabaseError,
  handleAuthError,
  handleAuthorizationError,
  handleNotFoundError,
  handleValidationError,
  handleBusinessRuleError,
  BaseException,
  ValidationException,
  AuthenticationException,
  AuthorizationException,
  NotFoundException,
  DatabaseException,
  BusinessRuleException,
} from './errorMiddleware';
import { TRPCError } from '@trpc/server';

describe('Error Middleware', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateRequestId', () => {
    it('يجب توليد معرف فريد', () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^req_\d+_[a-z0-9]+$/);
    });
  });

  describe('handleError', () => {
    it('يجب إرجاع TRPCError كما هو', async () => {
      const originalError = new TRPCError({
        code: 'BAD_REQUEST',
        message: 'خطأ في الطلب',
      });
      
      const result = await handleError(originalError, { path: 'test.path' });
      
      expect(result).toBeInstanceOf(TRPCError);
      expect(result.code).toBe('BAD_REQUEST');
    });

    it('يجب تحويل BaseException إلى TRPCError', async () => {
      const baseError = new BaseException(
        'خطأ مخصص',
        'CUSTOM_ERROR',
        400,
        undefined,
        false
      );
      
      const result = await handleError(baseError, { path: 'test.path' });
      
      expect(result).toBeInstanceOf(TRPCError);
    });

    it('يجب تحويل الخطأ العام إلى INTERNAL_SERVER_ERROR', async () => {
      const genericError = new Error('خطأ عام');
      
      const result = await handleError(genericError, { path: 'test.path' });
      
      expect(result).toBeInstanceOf(TRPCError);
      expect(result.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });

  describe('wrapWithErrorHandling', () => {
    it('يجب تنفيذ الدالة بنجاح', async () => {
      const fn = async () => 'نتيجة';
      const wrappedFn = wrapWithErrorHandling(fn, 'TestModule');
      
      const result = await wrappedFn();
      
      expect(result).toBe('نتيجة');
    });

    it('يجب تحويل الخطأ إلى BaseException', async () => {
      const fn = async () => {
        throw new Error('خطأ اختبار');
      };
      const wrappedFn = wrapWithErrorHandling(fn, 'TestModule');
      
      await expect(wrappedFn()).rejects.toThrow(BaseException);
    });

    it('يجب إعادة رمي BaseException كما هو', async () => {
      const originalError = new ValidationException('خطأ تحقق');
      const fn = async () => {
        throw originalError;
      };
      const wrappedFn = wrapWithErrorHandling(fn, 'TestModule');
      
      await expect(wrappedFn()).rejects.toThrow(ValidationException);
    });
  });

  describe('handleDatabaseError', () => {
    it('يجب رمي BusinessRuleException للسجلات المكررة', () => {
      const error = new Error('Duplicate entry for key');
      
      expect(() => handleDatabaseError(error, 'insert')).toThrow(BusinessRuleException);
    });

    it('يجب رمي BusinessRuleException لقيود المفتاح الأجنبي', () => {
      const error = new Error('Foreign key constraint fails');
      
      expect(() => handleDatabaseError(error, 'delete')).toThrow(BusinessRuleException);
    });

    it('يجب رمي DatabaseException لأخطاء الاتصال', () => {
      const error = new Error('Connection timeout');
      
      expect(() => handleDatabaseError(error, 'query')).toThrow(DatabaseException);
    });

    it('يجب رمي DatabaseException للأخطاء العامة', () => {
      const error = new Error('خطأ غير معروف');
      
      expect(() => handleDatabaseError(error, 'query')).toThrow(DatabaseException);
    });
  });

  describe('handleAuthError', () => {
    it('يجب رمي AuthenticationException', () => {
      expect(() => handleAuthError(new Error('invalid token'), 'login')).toThrow(AuthenticationException);
    });

    it('يجب إعادة رمي BaseException كما هو', () => {
      const originalError = new ValidationException('خطأ تحقق');
      
      expect(() => handleAuthError(originalError, 'login')).toThrow(ValidationException);
    });
  });

  describe('handleAuthorizationError', () => {
    it('يجب رمي AuthorizationException', () => {
      expect(() => handleAuthorizationError('admin', 'user', 'settings', 'edit')).toThrow(AuthorizationException);
    });
  });

  describe('handleNotFoundError', () => {
    it('يجب رمي NotFoundException', () => {
      expect(() => handleNotFoundError('الموظف', 123)).toThrow(NotFoundException);
    });

    it('يجب تضمين نوع المورد في الرسالة', () => {
      try {
        handleNotFoundError('الموظف', 123);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect((error as NotFoundException).message).toContain('الموظف');
      }
    });
  });

  describe('handleValidationError', () => {
    it('يجب رمي ValidationException', () => {
      expect(() => handleValidationError('البيانات غير صالحة')).toThrow(ValidationException);
    });

    it('يجب تضمين أخطاء التحقق', () => {
      const validationErrors = [
        { field: 'email', message: 'البريد الإلكتروني غير صالح' },
        { field: 'password', message: 'كلمة المرور قصيرة جداً' },
      ];
      
      try {
        handleValidationError('البيانات غير صالحة', undefined, validationErrors);
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationException);
      }
    });
  });

  describe('handleBusinessRuleError', () => {
    it('يجب رمي BusinessRuleException', () => {
      expect(() => handleBusinessRuleError('لا يمكن حذف موظف لديه رواتب معلقة')).toThrow(BusinessRuleException);
    });
  });

  describe('Exception Classes', () => {
    describe('BaseException', () => {
      it('يجب إنشاء استثناء أساسي', () => {
        const error = new BaseException('خطأ', 'ERROR_CODE', 500);
        
        expect(error.message).toBe('خطأ');
        expect(error.code).toBe('ERROR_CODE');
        expect(error.statusCode).toBe(500);
      });

      it('يجب تحويله إلى TRPCError', () => {
        const error = new BaseException('خطأ', 'ERROR_CODE', 400);
        const trpcError = error.toTRPCError();
        
        expect(trpcError).toBeInstanceOf(TRPCError);
      });
    });

    describe('ValidationException', () => {
      it('يجب إنشاء استثناء تحقق', () => {
        const error = new ValidationException('البيانات غير صالحة', 'email');
        
        expect(error.message).toBe('البيانات غير صالحة');
        expect(error.field).toBe('email');
      });
    });

    describe('AuthenticationException', () => {
      it('يجب إنشاء استثناء مصادقة', () => {
        const error = new AuthenticationException('يرجى تسجيل الدخول');
        
        expect(error.message).toBe('يرجى تسجيل الدخول');
      });
    });

    describe('AuthorizationException', () => {
      it('يجب إنشاء استثناء صلاحيات', () => {
        const error = new AuthorizationException('غير مصرح', 'admin', 'user');
        
        expect(error.message).toBe('غير مصرح');
        expect(error.requiredRole).toBe('admin');
        expect(error.userRole).toBe('user');
      });
    });

    describe('NotFoundException', () => {
      it('يجب إنشاء استثناء عدم العثور', () => {
        const error = new NotFoundException('الموظف غير موجود', 'Employee', 123);
        
        expect(error.message).toBe('الموظف غير موجود');
        expect(error.resourceType).toBe('Employee');
        expect(error.resourceId).toBe(123);
      });
    });

    describe('DatabaseException', () => {
      it('يجب إنشاء استثناء قاعدة بيانات', () => {
        const originalError = new Error('Connection failed');
        const error = new DatabaseException('فشل الاتصال', 'SELECT * FROM users', originalError);
        
        expect(error.message).toBe('فشل الاتصال');
        expect(error.query).toBe('SELECT * FROM users');
        expect(error.originalError).toBe(originalError);
      });
    });

    describe('BusinessRuleException', () => {
      it('يجب إنشاء استثناء قاعدة عمل', () => {
        const error = new BusinessRuleException('لا يمكن الحذف', 'DELETE_CONSTRAINT');
        
        expect(error.message).toBe('لا يمكن الحذف');
        expect(error.rule).toBe('DELETE_CONSTRAINT');
      });
    });
  });
});
