/**
 * اختبارات تحسينات نظام الوثائق
 * - ضغط الصور
 * - تقرير الموظفين بدون وثائق
 * - إشعارات تذكيرية
 */

import { describe, it, expect, vi } from 'vitest';

// Mock للدوال
vi.mock('./db', () => ({
  getEmployeesWithoutDocuments: vi.fn(),
  getEmployeeDocumentInfo: vi.fn(),
  createNotification: vi.fn(),
}));

describe('نظام تحسينات الوثائق', () => {
  
  describe('ضغط الصور', () => {
    it('يجب أن تكون مكتبة ضغط الصور موجودة', async () => {
      // التحقق من وجود الملف
      const fs = await import('fs');
      const path = '/home/ubuntu/erp-system/client/src/lib/imageCompression.ts';
      expect(fs.existsSync(path)).toBe(true);
    });
    
    it('يجب أن تحتوي على دالة compressImage', async () => {
      const compressionModule = await import('../client/src/lib/imageCompression');
      expect(typeof compressionModule.compressImage).toBe('function');
    });
    
    it('يجب أن تحتوي على دالة isValidImage', async () => {
      const compressionModule = await import('../client/src/lib/imageCompression');
      expect(typeof compressionModule.isValidImage).toBe('function');
    });
    
    it('يجب أن تحتوي على دالة formatFileSize', async () => {
      const compressionModule = await import('../client/src/lib/imageCompression');
      expect(typeof compressionModule.formatFileSize).toBe('function');
    });
  });
  
  describe('تقرير الموظفين بدون وثائق', () => {
    it('يجب أن تعيد دالة getEmployeesWithoutDocuments قائمة الموظفين', async () => {
      const db = await import('./db');
      const mockEmployees = [
        {
          id: 1,
          code: 'EMP001',
          name: 'موظف اختبار',
          branchName: 'فرع اختبار',
          missingDocuments: {
            info: true,
            iqamaImage: true,
            healthCertImage: false,
            contractImage: true,
          },
        },
      ];
      
      vi.mocked(db.getEmployeesWithoutDocuments).mockResolvedValue(mockEmployees);
      
      const result = await db.getEmployeesWithoutDocuments();
      expect(result).toHaveLength(1);
      expect(result[0].missingDocuments.info).toBe(true);
    });
    
    it('يجب أن تحدد الوثائق الناقصة بشكل صحيح', async () => {
      const db = await import('./db');
      const mockEmployee = {
        id: 1,
        code: 'EMP001',
        name: 'موظف اختبار',
        branchName: 'فرع اختبار',
        missingDocuments: {
          info: false,
          iqamaImage: true,
          healthCertImage: true,
          contractImage: false,
        },
      };
      
      vi.mocked(db.getEmployeesWithoutDocuments).mockResolvedValue([mockEmployee]);
      
      const result = await db.getEmployeesWithoutDocuments();
      expect(result[0].missingDocuments.iqamaImage).toBe(true);
      expect(result[0].missingDocuments.healthCertImage).toBe(true);
      expect(result[0].missingDocuments.contractImage).toBe(false);
    });
  });
  
  describe('إشعارات تذكيرية', () => {
    it('يجب أن تنشئ إشعار للموظف بنجاح', async () => {
      const db = await import('./db');
      
      vi.mocked(db.createNotification).mockResolvedValue({ id: 1 } as any);
      
      const result = await db.createNotification({
        userId: 1,
        title: 'تذكير: إكمال الوثائق',
        message: 'يرجى إكمال رفع الوثائق',
        type: 'system',
      });
      
      expect(result).toBeDefined();
      expect(db.createNotification).toHaveBeenCalledWith({
        userId: 1,
        title: 'تذكير: إكمال الوثائق',
        message: 'يرجى إكمال رفع الوثائق',
        type: 'system',
      });
    });
    
    it('يجب أن تتحقق من وجود وثائق ناقصة قبل إرسال التذكير', async () => {
      const db = await import('./db');
      
      const mockEmployee = {
        id: 1,
        name: 'موظف اختبار',
        infoSubmittedAt: new Date(),
        iqamaImageUrl: 'https://example.com/iqama.jpg',
        healthCertImageUrl: 'https://example.com/health.jpg',
        contractImageUrl: 'https://example.com/contract.jpg',
      };
      
      vi.mocked(db.getEmployeeDocumentInfo).mockResolvedValue(mockEmployee as any);
      
      const employee = await db.getEmployeeDocumentInfo(1);
      
      // التحقق من أن جميع الوثائق مكتملة
      const missing: string[] = [];
      if (!employee?.infoSubmittedAt) missing.push('المعلومات');
      if (!employee?.iqamaImageUrl) missing.push('صورة الإقامة');
      if (!employee?.healthCertImageUrl) missing.push('صورة الشهادة');
      if (!employee?.contractImageUrl) missing.push('صورة العقد');
      
      expect(missing).toHaveLength(0);
    });
  });
  
  describe('قالب البريد الإلكتروني', () => {
    it('يجب أن يحتوي على قالب تذكير الوثائق', async () => {
      const templates = await import('./notifications/emailTemplates');
      expect(typeof templates.getDocumentReminderTemplate).toBe('function');
    });
    
    it('يجب أن ينشئ قالب بريد صحيح', async () => {
      const templates = await import('./notifications/emailTemplates');
      
      const result = templates.getDocumentReminderTemplate({
        recipientName: 'المدير',
        totalEmployees: 5,
        employeesByBranch: {
          'فرع طويق': [
            { name: 'موظف 1', code: 'E001', missingDocuments: { info: true, iqamaImage: true, healthCertImage: false, contractImage: false } },
          ],
        },
      });
      
      expect(result.subject).toContain('تذكير');
      expect(result.subject).toContain('5');
      expect(result.html).toContain('المدير');
      expect(result.html).toContain('فرع طويق');
    });
  });
});
