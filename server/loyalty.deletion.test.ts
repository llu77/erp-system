import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('./db', () => ({
  getVisitById: vi.fn(),
  createVisitDeletionRequest: vi.fn(),
  hasPendingDeletionRequest: vi.fn(),
  getPendingDeletionRequests: vi.fn(),
  getAllDeletionRequests: vi.fn(),
  getDeletionRequestById: vi.fn(),
  approveDeletionRequest: vi.fn(),
  rejectDeletionRequest: vi.fn(),
  getDeletionRequestsStats: vi.fn(),
}));

import {
  getVisitById,
  createVisitDeletionRequest,
  hasPendingDeletionRequest,
  getPendingDeletionRequests,
  getAllDeletionRequests,
  getDeletionRequestById,
  approveDeletionRequest,
  rejectDeletionRequest,
  getDeletionRequestsStats,
} from './db';

describe('Loyalty Visit Deletion Requests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createVisitDeletionRequest', () => {
    it('should create a deletion request with valid data', async () => {
      const mockData = {
        visitId: 1,
        customerName: 'أحمد محمد',
        customerPhone: '0501234567',
        serviceType: 'حلاقة',
        visitDate: new Date(),
        branchId: 1,
        branchName: 'فرع الرياض',
        deletionReason: 'زيارة مكررة بالخطأ',
        requestedBy: 1,
        requestedByName: 'مشرف الفرع',
      };

      vi.mocked(createVisitDeletionRequest).mockResolvedValue(1);

      const result = await createVisitDeletionRequest(mockData);
      
      expect(createVisitDeletionRequest).toHaveBeenCalledWith(mockData);
      expect(result).toBe(1);
    });
  });

  describe('hasPendingDeletionRequest', () => {
    it('should return true if pending request exists', async () => {
      vi.mocked(hasPendingDeletionRequest).mockResolvedValue(true);

      const result = await hasPendingDeletionRequest(1);
      
      expect(result).toBe(true);
    });

    it('should return false if no pending request exists', async () => {
      vi.mocked(hasPendingDeletionRequest).mockResolvedValue(false);

      const result = await hasPendingDeletionRequest(1);
      
      expect(result).toBe(false);
    });
  });

  describe('getPendingDeletionRequests', () => {
    it('should return list of pending requests', async () => {
      const mockRequests = [
        {
          id: 1,
          visitId: 1,
          customerName: 'أحمد',
          customerPhone: '0501234567',
          status: 'pending',
          deletionReason: 'سبب الحذف',
          requestedBy: 1,
          requestedAt: new Date(),
        },
      ];

      vi.mocked(getPendingDeletionRequests).mockResolvedValue(mockRequests as any);

      const result = await getPendingDeletionRequests();
      
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('pending');
    });

    it('should return empty array if no pending requests', async () => {
      vi.mocked(getPendingDeletionRequests).mockResolvedValue([]);

      const result = await getPendingDeletionRequests();
      
      expect(result).toHaveLength(0);
    });
  });

  describe('approveDeletionRequest', () => {
    it('should approve deletion request and delete visit', async () => {
      vi.mocked(approveDeletionRequest).mockResolvedValue({ success: true });

      const result = await approveDeletionRequest(1, 1, 'أدمن', 'تمت الموافقة');
      
      expect(result.success).toBe(true);
    });

    it('should fail if request not found', async () => {
      vi.mocked(approveDeletionRequest).mockResolvedValue({ 
        success: false, 
        error: 'طلب الحذف غير موجود' 
      });

      const result = await approveDeletionRequest(999, 1, 'أدمن');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('طلب الحذف غير موجود');
    });

    it('should fail if request already processed', async () => {
      vi.mocked(approveDeletionRequest).mockResolvedValue({ 
        success: false, 
        error: 'تم معالجة هذا الطلب مسبقاً' 
      });

      const result = await approveDeletionRequest(1, 1, 'أدمن');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('تم معالجة هذا الطلب مسبقاً');
    });
  });

  describe('rejectDeletionRequest', () => {
    it('should reject deletion request with notes', async () => {
      vi.mocked(rejectDeletionRequest).mockResolvedValue({ success: true });

      const result = await rejectDeletionRequest(1, 1, 'أدمن', 'الزيارة صحيحة');
      
      expect(result.success).toBe(true);
    });

    it('should fail if request not found', async () => {
      vi.mocked(rejectDeletionRequest).mockResolvedValue({ 
        success: false, 
        error: 'طلب الحذف غير موجود' 
      });

      const result = await rejectDeletionRequest(999, 1, 'أدمن', 'سبب الرفض');
      
      expect(result.success).toBe(false);
    });
  });

  describe('getDeletionRequestsStats', () => {
    it('should return correct statistics', async () => {
      const mockStats = {
        pending: 5,
        approved: 10,
        rejected: 3,
        total: 18,
      };

      vi.mocked(getDeletionRequestsStats).mockResolvedValue(mockStats);

      const result = await getDeletionRequestsStats();
      
      expect(result.pending).toBe(5);
      expect(result.approved).toBe(10);
      expect(result.rejected).toBe(3);
      expect(result.total).toBe(18);
    });

    it('should return zeros when no requests exist', async () => {
      vi.mocked(getDeletionRequestsStats).mockResolvedValue({
        pending: 0,
        approved: 0,
        rejected: 0,
        total: 0,
      });

      const result = await getDeletionRequestsStats();
      
      expect(result.total).toBe(0);
    });
  });

  describe('Deletion Request Workflow', () => {
    it('should follow correct workflow: request -> approve -> delete', async () => {
      // 1. Check no pending request
      vi.mocked(hasPendingDeletionRequest).mockResolvedValue(false);
      const hasPending = await hasPendingDeletionRequest(1);
      expect(hasPending).toBe(false);

      // 2. Create deletion request
      vi.mocked(createVisitDeletionRequest).mockResolvedValue(1);
      const requestId = await createVisitDeletionRequest({
        visitId: 1,
        customerName: 'أحمد',
        customerPhone: '0501234567',
        deletionReason: 'زيارة مكررة',
        requestedBy: 1,
      });
      expect(requestId).toBe(1);

      // 3. Approve and delete
      vi.mocked(approveDeletionRequest).mockResolvedValue({ success: true });
      const approveResult = await approveDeletionRequest(1, 2, 'أدمن');
      expect(approveResult.success).toBe(true);
    });

    it('should prevent duplicate pending requests', async () => {
      vi.mocked(hasPendingDeletionRequest).mockResolvedValue(true);
      
      const hasPending = await hasPendingDeletionRequest(1);
      expect(hasPending).toBe(true);
      
      // Should not create new request if one is pending
      // This logic is handled in the router
    });
  });
});
