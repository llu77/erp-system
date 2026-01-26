import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch for Twilio API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Set environment variables for testing
process.env.TWILIO_ACCOUNT_SID = 'AC60ed7e2dde5525facb88e8dcc56160fd';
process.env.TWILIO_AUTH_TOKEN = 'test_auth_token';
process.env.TWILIO_MESSAGING_SERVICE_SID = 'MG2cf60ceeb68b924e84c7d67d3379b7b8';
process.env.TWILIO_PHONE_NUMBER = '+13467421706';

import {
  sendSMS,
  sendWhatsApp,
  sendRequestSubmittedNotification,
  sendRequestApprovedNotification,
  sendRequestRejectedNotification,
  sendDocumentReminderSMS,
  sendDocumentExpiryAlertSMS,
} from './notifications/twilioService';

describe('Twilio Service', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('sendSMS', () => {
    it('should send SMS successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sid: 'SM123456',
          status: 'queued',
        }),
      });

      const result = await sendSMS({
        to: '+966598441020',
        body: 'Test message',
      });

      expect(result.success).toBe(true);
      expect(result.sid).toBe('SM123456');
      expect(result.status).toBe('queued');
    });

    it('should format Saudi phone numbers correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sid: 'SM123', status: 'queued' }),
      });

      await sendSMS({
        to: '0598441020', // Saudi format without country code
        body: 'Test',
      });

      // Check that the phone was formatted correctly
      const callArgs = mockFetch.mock.calls[0];
      const body = callArgs[1].body;
      expect(body).toContain('%2B966598441020'); // URL encoded +966598441020
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          message: 'Invalid phone number',
        }),
      });

      const result = await sendSMS({
        to: 'invalid',
        body: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid phone number');
    });
  });

  describe('sendWhatsApp', () => {
    it('should send WhatsApp message successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sid: 'WA123456',
          status: 'queued',
        }),
      });

      const result = await sendWhatsApp({
        to: '+966598441020',
        body: 'Test WhatsApp message',
      });

      expect(result.success).toBe(true);
      expect(result.sid).toBe('WA123456');
    });

    it('should format WhatsApp number with prefix', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sid: 'WA123', status: 'queued' }),
      });

      await sendWhatsApp({
        to: '0598441020',
        body: 'Test',
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = callArgs[1].body;
      expect(body).toContain('whatsapp%3A%2B966598441020'); // URL encoded whatsapp:+966598441020
    });
  });

  describe('Request Notifications', () => {
    it('should send request submitted notification', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sid: 'SM123', status: 'queued' }),
      });

      const result = await sendRequestSubmittedNotification(
        '+966598441020',
        'أحمد محمد',
        'إجازة',
        'REQ-2026-001'
      );

      expect(result.success).toBe(true);
      
      // Verify message content
      const callArgs = mockFetch.mock.calls[0];
      const body = decodeURIComponent(callArgs[1].body);
      const normalizedBody = body.replace(/\+/g, ' ');
      expect(normalizedBody).toContain('أحمد محمد');
      expect(normalizedBody).toContain('إجازة');
      expect(normalizedBody).toContain('REQ-2026-001');
      expect(normalizedBody).toContain('تم تقديم طلبك بنجاح');
    });

    it('should send request approved notification', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sid: 'SM123', status: 'queued' }),
      });

      const result = await sendRequestApprovedNotification(
        '+966598441020',
        'أحمد محمد',
        'سلفة',
        'REQ-2026-002',
        'تمت الموافقة على السلفة'
      );

      expect(result.success).toBe(true);
      
      const callArgs = mockFetch.mock.calls[0];
      const body = decodeURIComponent(callArgs[1].body);
      const normalizedBody = body.replace(/\+/g, ' ');
      expect(normalizedBody).toContain('تمت الموافقة');
      expect(normalizedBody).toContain('سلفة');
    });

    it('should send request rejected notification with reason', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sid: 'SM123', status: 'queued' }),
      });

      const result = await sendRequestRejectedNotification(
        '+966598441020',
        'أحمد محمد',
        'إجازة',
        'REQ-2026-003',
        'لا يوجد رصيد إجازات كافي'
      );

      expect(result.success).toBe(true);
      
      const callArgs = mockFetch.mock.calls[0];
      const body = decodeURIComponent(callArgs[1].body);
      expect(body).toContain('مرفوض');
      // URL encoded spaces become + signs
      expect(body.replace(/\+/g, ' ')).toContain('لا يوجد رصيد إجازات كافي');
    });
  });

  describe('Document Notifications', () => {
    it('should send document reminder SMS', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sid: 'SM123', status: 'queued' }),
      });

      const result = await sendDocumentReminderSMS(
        '+966598441020',
        'محمد علي',
        ['رقم الإقامة', 'الشهادة الصحية']
      );

      expect(result.success).toBe(true);
      
      const callArgs = mockFetch.mock.calls[0];
      const body = decodeURIComponent(callArgs[1].body);
      // URL encoded spaces become + signs, so we need to replace them
      const normalizedBody = body.replace(/\+/g, ' ');
      expect(normalizedBody).toContain('محمد علي');
      expect(normalizedBody).toContain('رقم الإقامة');
      expect(normalizedBody).toContain('الشهادة الصحية');
    });

    it('should send document expiry alert SMS', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sid: 'SM123', status: 'queued' }),
      });

      const result = await sendDocumentExpiryAlertSMS(
        '+966598441020',
        'خالد أحمد',
        'الإقامة',
        '2026-02-15',
        20
      );

      expect(result.success).toBe(true);
      
      const callArgs = mockFetch.mock.calls[0];
      const body = decodeURIComponent(callArgs[1].body);
      const normalizedBody = body.replace(/\+/g, ' ');
      expect(normalizedBody).toContain('خالد أحمد');
      expect(normalizedBody).toContain('الإقامة');
      expect(normalizedBody).toContain('20 يوم');
    });

    it('should show expired status for documents past expiry', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sid: 'SM123', status: 'queued' }),
      });

      const result = await sendDocumentExpiryAlertSMS(
        '+966598441020',
        'سعيد محمد',
        'الشهادة الصحية',
        '2026-01-01',
        -5 // Expired 5 days ago
      );

      expect(result.success).toBe(true);
      
      const callArgs = mockFetch.mock.calls[0];
      const body = decodeURIComponent(callArgs[1].body);
      const normalizedBody = body.replace(/\+/g, ' ');
      expect(normalizedBody).toContain('منتهية الصلاحية');
    });
  });

  describe('Phone Number Formatting', () => {
    it('should handle various Saudi phone formats', async () => {
      const testCases = [
        { input: '0598441020', expected: '+966598441020' },
        { input: '598441020', expected: '+966598441020' },
        { input: '+966598441020', expected: '+966598441020' },
        { input: '966598441020', expected: '+966598441020' },
        { input: '05 98 44 10 20', expected: '+966598441020' },
      ];

      for (const testCase of testCases) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sid: 'SM123', status: 'queued' }),
        });

        await sendSMS({ to: testCase.input, body: 'Test' });

        const callArgs = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
        const body = decodeURIComponent(callArgs[1].body);
        expect(body).toContain(`To=${testCase.expected}`);
      }
    });
  });
});
