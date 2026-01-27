import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Resend
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ id: 'test-email-id' }),
    },
  })),
}));

// Mock db
vi.mock('../db', () => ({
  getEmployeesWithExpiringDocuments: vi.fn().mockResolvedValue({
    expiring: {
      iqama: [
        {
          id: 1,
          code: 'EMP-001',
          name: 'محمد أحمد',
          branchId: 1,
          branchName: 'فرع لبن',
          iqamaExpiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        },
      ],
      healthCert: [
        {
          id: 2,
          code: 'EMP-002',
          name: 'خالد سعيد',
          branchId: 2,
          branchName: 'فرع طويق',
          healthCertExpiryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        },
      ],
      contract: [],
    },
    expired: {
      iqama: [
        {
          id: 3,
          code: 'EMP-003',
          name: 'علي محمد',
          branchId: 1,
          branchName: 'فرع لبن',
          iqamaExpiryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        },
      ],
      healthCert: [],
      contract: [],
    },
    summary: {
      totalExpiring: 2,
      totalExpired: 1,
      expiringIqamaCount: 1,
      expiringHealthCertCount: 1,
      expiringContractCount: 0,
      expiredIqamaCount: 1,
      expiredHealthCertCount: 0,
      expiredContractCount: 0,
    },
  }),
  getNotificationRecipients: vi.fn().mockResolvedValue([
    { id: 1, email: 'admin@test.com', name: 'Admin', role: 'admin', branchId: null },
    { id: 2, email: 'supervisor@test.com', name: 'Supervisor', role: 'branch_supervisor', branchId: 1 },
  ]),
}));

// Mock notification tracker
vi.mock('./notificationTracker', () => ({
  wasNotificationSentToday: vi.fn().mockResolvedValue(false),
  markNotificationAsSent: vi.fn().mockResolvedValue(undefined),
}));

describe('Document Expiry Notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getExpiringDocuments', () => {
    it('should return documents sorted by days remaining', async () => {
      const { getExpiringDocuments } = await import('./documentExpiryNotifications');
      const docs = await getExpiringDocuments(30);
      
      expect(docs).toBeDefined();
      expect(Array.isArray(docs)).toBe(true);
      expect(docs.length).toBeGreaterThan(0);
      
      // التحقق من الترتيب (الأقل أيام أولاً)
      for (let i = 1; i < docs.length; i++) {
        expect(docs[i].daysRemaining).toBeGreaterThanOrEqual(docs[i - 1].daysRemaining);
      }
    });

    it('should include expired documents with negative days', async () => {
      const { getExpiringDocuments } = await import('./documentExpiryNotifications');
      const docs = await getExpiringDocuments(30);
      
      const expiredDocs = docs.filter(d => d.daysRemaining < 0);
      expect(expiredDocs.length).toBeGreaterThan(0);
    });

    it('should include all document types', async () => {
      const { getExpiringDocuments } = await import('./documentExpiryNotifications');
      const docs = await getExpiringDocuments(30);
      
      const docTypes = new Set(docs.map(d => d.documentType));
      expect(docTypes.has('iqama')).toBe(true);
    });
  });

  describe('categorizeDocuments', () => {
    it('should categorize documents correctly', async () => {
      const { categorizeDocuments, getExpiringDocuments } = await import('./documentExpiryNotifications');
      const docs = await getExpiringDocuments(30);
      const categorized = categorizeDocuments(docs);
      
      expect(categorized).toHaveProperty('expired');
      expect(categorized).toHaveProperty('critical');
      expect(categorized).toHaveProperty('warning');
      expect(categorized).toHaveProperty('upcoming');
      
      // التحقق من صحة التصنيف
      categorized.expired.forEach(d => expect(d.daysRemaining).toBeLessThan(0));
      categorized.critical.forEach(d => {
        expect(d.daysRemaining).toBeGreaterThanOrEqual(0);
        expect(d.daysRemaining).toBeLessThanOrEqual(7);
      });
      categorized.warning.forEach(d => {
        expect(d.daysRemaining).toBeGreaterThan(7);
        expect(d.daysRemaining).toBeLessThanOrEqual(14);
      });
      categorized.upcoming.forEach(d => {
        expect(d.daysRemaining).toBeGreaterThan(14);
        expect(d.daysRemaining).toBeLessThanOrEqual(30);
      });
    });
  });

  describe('sendDocumentExpiryNotifications', () => {
    it('should send notifications successfully', async () => {
      const { sendDocumentExpiryNotifications } = await import('./documentExpiryNotifications');
      const result = await sendDocumentExpiryNotifications();
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.sentCount).toBeGreaterThanOrEqual(0);
      expect(result.totalDocuments).toBeGreaterThan(0);
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should not send if already sent today', async () => {
      const { wasNotificationSentToday } = await import('./notificationTracker');
      vi.mocked(wasNotificationSentToday).mockResolvedValueOnce(true);
      
      const { sendDocumentExpiryNotifications } = await import('./documentExpiryNotifications');
      const result = await sendDocumentExpiryNotifications();
      
      expect(result.success).toBe(true);
      expect(result.sentCount).toBe(0);
      expect(result.errors).toContain('تم إرسال إشعار الوثائق اليوم بالفعل');
    });
  });

  describe('sendSingleDocumentExpiryAlert', () => {
    it('should send alert for a single document', async () => {
      const { sendSingleDocumentExpiryAlert } = await import('./documentExpiryNotifications');
      
      const doc = {
        employeeId: 1,
        employeeName: 'محمد أحمد',
        employeeCode: 'EMP-001',
        branchId: 1,
        branchName: 'فرع لبن',
        documentType: 'iqama' as const,
        documentName: 'الإقامة',
        expiryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        daysRemaining: 5,
      };
      
      const result = await sendSingleDocumentExpiryAlert(doc);
      expect(result).toBe(true);
    });

    it('should handle expired documents correctly', async () => {
      const { sendSingleDocumentExpiryAlert } = await import('./documentExpiryNotifications');
      
      const doc = {
        employeeId: 1,
        employeeName: 'محمد أحمد',
        employeeCode: 'EMP-001',
        branchId: 1,
        branchName: 'فرع لبن',
        documentType: 'iqama' as const,
        documentName: 'الإقامة',
        expiryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        daysRemaining: -5,
      };
      
      const result = await sendSingleDocumentExpiryAlert(doc);
      expect(result).toBe(true);
    });
  });
});
