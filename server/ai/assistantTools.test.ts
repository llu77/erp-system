import { describe, it, expect } from 'vitest';
import { assistantTools, executeAssistantTool } from './assistantTools';

describe('Employee Assistant Tools', () => {
  describe('assistantTools definition', () => {
    it('should have all required tools defined', () => {
      expect(assistantTools).toBeDefined();
      expect(Array.isArray(assistantTools)).toBe(true);
      expect(assistantTools.length).toBeGreaterThan(0);
    });

    it('should have identify_employee tool', () => {
      const identifyTool = assistantTools.find(t => t.function.name === 'identify_employee');
      expect(identifyTool).toBeDefined();
      expect(identifyTool?.function.description).toContain('موظف');
    });

    it('should have submit_request tool', () => {
      const submitTool = assistantTools.find(t => t.function.name === 'submit_request');
      expect(submitTool).toBeDefined();
      expect(submitTool?.function.description).toContain('طلب');
    });

    it('should have get_report tool', () => {
      const reportTool = assistantTools.find(t => t.function.name === 'get_report');
      expect(reportTool).toBeDefined();
      expect(reportTool?.function.description).toContain('تقرير');
    });

    it('should have calculate_price tool', () => {
      const priceTool = assistantTools.find(t => t.function.name === 'calculate_price');
      expect(priceTool).toBeDefined();
      expect(priceTool?.function.description).toContain('أسعار');
    });

    it('should have prepare_request tool', () => {
      const prepareTool = assistantTools.find(t => t.function.name === 'prepare_request');
      expect(prepareTool).toBeDefined();
      expect(prepareTool?.function.description).toContain('تأكيد');
    });

    it('should have confirm_request tool', () => {
      const confirmTool = assistantTools.find(t => t.function.name === 'confirm_request');
      expect(confirmTool).toBeDefined();
      expect(confirmTool?.function.description).toContain('تأكيد');
    });

    it('should have cancel_request tool', () => {
      const cancelTool = assistantTools.find(t => t.function.name === 'cancel_request');
      expect(cancelTool).toBeDefined();
      expect(cancelTool?.function.description).toContain('إلغاء');
    });
  });

  describe('executeAssistantTool', () => {
    it('should return error for unknown tool', async () => {
      const result = await executeAssistantTool('unknown_tool', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('غير معروفة');
    });

    it('should handle identify_employee with missing name', async () => {
      const result = await executeAssistantTool('identify_employee', {});
      expect(result).toBeDefined();
      // Should either fail or return empty results
    });

    it('should handle calculate_price with services array', async () => {
      // calculate_price يبحث عن الخدمات في قاعدة البيانات
      const result = await executeAssistantTool('calculate_price', {
        services: ['قص شعر', 'صبغة'],
        discountPercent: 10
      });
      expect(result).toBeDefined();
      // قد تكون الخدمات غير موجودة في قاعدة البيانات
      expect(result.hasData !== undefined).toBe(true);
    });

    it('should handle calculate_price with empty services', async () => {
      const result = await executeAssistantTool('calculate_price', {
        services: []
      });
      expect(result).toBeDefined();
      expect(result.hasData !== undefined).toBe(true);
    });
  });

  describe('Tool Schema Validation', () => {
    it('identify_employee should have name parameter', () => {
      const tool = assistantTools.find(t => t.function.name === 'identify_employee');
      expect(tool?.function.parameters.properties).toHaveProperty('name');
    });

    it('submit_request should have required parameters', () => {
      const tool = assistantTools.find(t => t.function.name === 'submit_request');
      expect(tool?.function.parameters.properties).toHaveProperty('employeeId');
      expect(tool?.function.parameters.properties).toHaveProperty('type');
      expect(tool?.function.parameters.properties).toHaveProperty('description');
    });

    it('get_report should have required parameters', () => {
      const tool = assistantTools.find(t => t.function.name === 'get_report');
      expect(tool?.function.parameters.properties).toHaveProperty('employeeId');
      expect(tool?.function.parameters.properties).toHaveProperty('reportType');
    });

    it('prepare_request should have required parameters', () => {
      const tool = assistantTools.find(t => t.function.name === 'prepare_request');
      expect(tool?.function.parameters.properties).toHaveProperty('sessionId');
      expect(tool?.function.parameters.properties).toHaveProperty('employeeId');
      expect(tool?.function.parameters.properties).toHaveProperty('type');
      expect(tool?.function.parameters.properties).toHaveProperty('description');
    });

    it('confirm_request should have required parameters', () => {
      const tool = assistantTools.find(t => t.function.name === 'confirm_request');
      expect(tool?.function.parameters.properties).toHaveProperty('sessionId');
      expect(tool?.function.parameters.properties).toHaveProperty('employeeId');
    });

    it('cancel_request should have required parameters', () => {
      const tool = assistantTools.find(t => t.function.name === 'cancel_request');
      expect(tool?.function.parameters.properties).toHaveProperty('sessionId');
    });
  });

  describe('Tool Count', () => {
    it('should have 7 tools total', () => {
      // identify_employee, submit_request, get_report, calculate_price, prepare_request, confirm_request, cancel_request
      expect(assistantTools.length).toBe(7);
    });
  });
});
