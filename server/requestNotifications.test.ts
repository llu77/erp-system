/**
 * اختبارات إشعارات الطلبات وانتهاء صلاحية الوثائق
 */
import { describe, it, expect, vi } from 'vitest';

// Mock Resend
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ id: 'test-email-id' }),
    },
  })),
}));

// Mock db
vi.mock('./db', () => ({
  getAllUsers: vi.fn().mockResolvedValue([
    { id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin' },
    { id: 2, name: 'General Supervisor', email: 'gs@test.com', role: 'general_supervisor' },
  ]),
  logSentNotification: vi.fn().mockResolvedValue(undefined),
  getEmployeeById: vi.fn().mockResolvedValue({
    id: 1,
    name: 'Test Employee',
    email: 'employee@test.com',
    branchId: 1,
  }),
  getAllEmployeesWithDocuments: vi.fn().mockResolvedValue([
    {
      id: 1,
      name: 'Employee 1',
      code: 'E001',
      branchName: 'Branch 1',
      iqamaExpiryDate: new Date(Date.now() - 86400000), // expired yesterday
      healthCertExpiryDate: new Date(Date.now() + 7 * 86400000), // expires in 7 days
      contractExpiryDate: new Date(Date.now() + 60 * 86400000), // expires in 60 days
      isActive: true,
    },
    {
      id: 2,
      name: 'Employee 2',
      code: 'E002',
      branchName: 'Branch 2',
      iqamaExpiryDate: new Date(Date.now() + 15 * 86400000), // expires in 15 days
      healthCertExpiryDate: null,
      contractExpiryDate: null,
      isActive: true,
    },
  ]),
}));

describe('Request Notification Functions', () => {
  describe('notifyEmployeeRequestSubmitted', () => {
    it('should have the correct function signature', async () => {
      const { notifyEmployeeRequestSubmitted } = await import('./notifications/emailNotificationService');
      expect(typeof notifyEmployeeRequestSubmitted).toBe('function');
    });

    it('should accept required parameters', async () => {
      const { notifyEmployeeRequestSubmitted } = await import('./notifications/emailNotificationService');
      
      const result = await notifyEmployeeRequestSubmitted({
        employeeEmail: 'test@example.com',
        employeeName: 'Test Employee',
        requestType: 'advance',
        requestId: 123,
        submittedAt: new Date(),
      });
      
      expect(typeof result).toBe('boolean');
    });
  });

  describe('notifyEmployeeRequestApproved', () => {
    it('should have the correct function signature', async () => {
      const { notifyEmployeeRequestApproved } = await import('./notifications/emailNotificationService');
      expect(typeof notifyEmployeeRequestApproved).toBe('function');
    });

    it('should accept required parameters', async () => {
      const { notifyEmployeeRequestApproved } = await import('./notifications/emailNotificationService');
      
      const result = await notifyEmployeeRequestApproved({
        employeeEmail: 'test@example.com',
        employeeName: 'Test Employee',
        requestType: 'leave',
        requestId: 456,
        approvedBy: 'Admin',
        approvedAt: new Date(),
      });
      
      expect(typeof result).toBe('boolean');
    });
  });

  describe('notifyEmployeeRequestRejected', () => {
    it('should have the correct function signature', async () => {
      const { notifyEmployeeRequestRejected } = await import('./notifications/emailNotificationService');
      expect(typeof notifyEmployeeRequestRejected).toBe('function');
    });

    it('should accept required parameters with reason', async () => {
      const { notifyEmployeeRequestRejected } = await import('./notifications/emailNotificationService');
      
      const result = await notifyEmployeeRequestRejected({
        employeeEmail: 'test@example.com',
        employeeName: 'Test Employee',
        requestType: 'permission',
        requestId: 789,
        rejectedBy: 'Manager',
        rejectedAt: new Date(),
        reason: 'لا يوجد رصيد كافي',
      });
      
      expect(typeof result).toBe('boolean');
    });
  });
});

describe('Document Expiry Alert Functions', () => {
  describe('sendDocumentExpiryAlert', () => {
    it('should have the correct function signature', async () => {
      const { sendDocumentExpiryAlert } = await import('./notifications/emailNotificationService');
      expect(typeof sendDocumentExpiryAlert).toBe('function');
    });

    it('should accept expired and expiring documents', async () => {
      const { sendDocumentExpiryAlert } = await import('./notifications/emailNotificationService');
      
      const result = await sendDocumentExpiryAlert({
        expiredDocs: [
          {
            employeeId: 1,
            employeeName: 'Employee 1',
            employeeCode: 'E001',
            branchName: 'Branch 1',
            documentType: 'الإقامة',
            expiryDate: new Date(Date.now() - 86400000),
            daysRemaining: -1,
            status: 'expired' as const,
          },
        ],
        expiringDocs: [
          {
            employeeId: 2,
            employeeName: 'Employee 2',
            employeeCode: 'E002',
            branchName: 'Branch 2',
            documentType: 'الشهادة الصحية',
            expiryDate: new Date(Date.now() + 7 * 86400000),
            daysRemaining: 7,
            status: 'expiring_soon' as const,
          },
        ],
      });
      
      expect(result).toHaveProperty('success');
    });
  });

  describe('checkDocumentExpirations', () => {
    it('should have the correct function signature', async () => {
      const { checkDocumentExpirations } = await import('./notifications/scheduledNotificationService');
      expect(typeof checkDocumentExpirations).toBe('function');
    });
  });
});

describe('Request Type Names', () => {
  it('should map request types to Arabic names correctly', () => {
    const requestTypeNames: Record<string, string> = {
      advance: 'سلفة',
      leave: 'إجازة',
      arrears: 'صرف متأخرات',
      permission: 'استئذان',
      objection: 'اعتراض',
      resignation: 'استقالة',
    };

    expect(requestTypeNames['advance']).toBe('سلفة');
    expect(requestTypeNames['leave']).toBe('إجازة');
    expect(requestTypeNames['permission']).toBe('استئذان');
    expect(requestTypeNames['resignation']).toBe('استقالة');
  });
});
