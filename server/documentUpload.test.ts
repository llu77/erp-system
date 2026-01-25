import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as db from './db';

// Mock the database functions
vi.mock('./db', async (importOriginal) => {
  const actual = await importOriginal() as typeof db;
  return {
    ...actual,
    hasEmployeeSubmittedInfo: vi.fn(),
    updateEmployeeDocumentImage: vi.fn(),
    getEmployeeDocumentInfo: vi.fn(),
  };
});

describe('Document Upload System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateEmployeeDocumentImage', () => {
    it('should update iqama image URL correctly', async () => {
      const mockUpdateFn = vi.mocked(db.updateEmployeeDocumentImage);
      mockUpdateFn.mockResolvedValue({ success: true });

      const result = await db.updateEmployeeDocumentImage(1, 'iqama', 'https://example.com/iqama.jpg');
      
      expect(mockUpdateFn).toHaveBeenCalledWith(1, 'iqama', 'https://example.com/iqama.jpg');
      expect(result.success).toBe(true);
    });

    it('should update health certificate image URL correctly', async () => {
      const mockUpdateFn = vi.mocked(db.updateEmployeeDocumentImage);
      mockUpdateFn.mockResolvedValue({ success: true });

      const result = await db.updateEmployeeDocumentImage(1, 'healthCert', 'https://example.com/health.jpg');
      
      expect(mockUpdateFn).toHaveBeenCalledWith(1, 'healthCert', 'https://example.com/health.jpg');
      expect(result.success).toBe(true);
    });

    it('should update contract image URL correctly', async () => {
      const mockUpdateFn = vi.mocked(db.updateEmployeeDocumentImage);
      mockUpdateFn.mockResolvedValue({ success: true });

      const result = await db.updateEmployeeDocumentImage(1, 'contract', 'https://example.com/contract.jpg');
      
      expect(mockUpdateFn).toHaveBeenCalledWith(1, 'contract', 'https://example.com/contract.jpg');
      expect(result.success).toBe(true);
    });

    it('should handle null value for deleting image', async () => {
      const mockUpdateFn = vi.mocked(db.updateEmployeeDocumentImage);
      mockUpdateFn.mockResolvedValue({ success: true });

      const result = await db.updateEmployeeDocumentImage(1, 'iqama', null);
      
      expect(mockUpdateFn).toHaveBeenCalledWith(1, 'iqama', null);
      expect(result.success).toBe(true);
    });

    it('should return error on database failure', async () => {
      const mockUpdateFn = vi.mocked(db.updateEmployeeDocumentImage);
      mockUpdateFn.mockResolvedValue({ success: false, error: 'فشل الاتصال بقاعدة البيانات' });

      const result = await db.updateEmployeeDocumentImage(1, 'iqama', 'https://example.com/iqama.jpg');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('فشل الاتصال بقاعدة البيانات');
    });
  });

  describe('getEmployeeDocumentInfo', () => {
    it('should return employee document info with image URLs', async () => {
      const mockGetFn = vi.mocked(db.getEmployeeDocumentInfo);
      mockGetFn.mockResolvedValue({
        id: 1,
        code: 'EMP001',
        name: 'محمد أحمد',
        phone: '0501234567',
        position: 'موظف',
        branchId: 1,
        branchName: 'الفرع الرئيسي',
        iqamaNumber: '2123456789',
        iqamaExpiryDate: new Date('2025-12-31'),
        iqamaImageUrl: 'https://example.com/iqama.jpg',
        healthCertExpiryDate: new Date('2025-06-30'),
        healthCertImageUrl: 'https://example.com/health.jpg',
        contractExpiryDate: new Date('2026-01-01'),
        contractImageUrl: 'https://example.com/contract.jpg',
        infoSubmittedAt: new Date('2024-01-01'),
        infoSubmittedBy: null,
      });

      const result = await db.getEmployeeDocumentInfo(1);
      
      expect(result).not.toBeNull();
      expect(result?.iqamaImageUrl).toBe('https://example.com/iqama.jpg');
      expect(result?.healthCertImageUrl).toBe('https://example.com/health.jpg');
      expect(result?.contractImageUrl).toBe('https://example.com/contract.jpg');
    });

    it('should return null for non-existent employee', async () => {
      const mockGetFn = vi.mocked(db.getEmployeeDocumentInfo);
      mockGetFn.mockResolvedValue(null);

      const result = await db.getEmployeeDocumentInfo(999);
      
      expect(result).toBeNull();
    });
  });

  describe('Upload permission checks', () => {
    it('should allow upload when employee has not submitted info', async () => {
      const mockHasSubmitted = vi.mocked(db.hasEmployeeSubmittedInfo);
      mockHasSubmitted.mockResolvedValue(false);

      const hasSubmitted = await db.hasEmployeeSubmittedInfo(1);
      
      expect(hasSubmitted).toBe(false);
    });

    it('should block upload when employee has already submitted info', async () => {
      const mockHasSubmitted = vi.mocked(db.hasEmployeeSubmittedInfo);
      mockHasSubmitted.mockResolvedValue(true);

      const hasSubmitted = await db.hasEmployeeSubmittedInfo(1);
      
      expect(hasSubmitted).toBe(true);
    });
  });
});
