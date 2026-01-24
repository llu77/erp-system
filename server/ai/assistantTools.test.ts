import { describe, it, expect, vi, beforeEach } from 'vitest';
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
      expect(priceTool?.function.description).toContain('سعر');
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

    it('should handle calculate_price correctly', async () => {
      const result = await executeAssistantTool('calculate_price', {
        services: [
          { name: 'قص شعر', price: 50 },
          { name: 'صبغة', price: 100 }
        ],
        discountPercent: 10
      });
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.subtotal).toBe(150);
      expect(result.data.discount).toBe(15);
      expect(result.data.total).toBe(135);
    });

    it('should handle calculate_price with no discount', async () => {
      const result = await executeAssistantTool('calculate_price', {
        services: [
          { name: 'حلاقة', price: 30 }
        ]
      });
      expect(result.success).toBe(true);
      expect(result.data.total).toBe(30);
      expect(result.data.discount).toBe(0);
    });

    it('should handle calculate_price with empty services', async () => {
      const result = await executeAssistantTool('calculate_price', {
        services: []
      });
      expect(result.success).toBe(true);
      expect(result.data.total).toBe(0);
    });
  });

  describe('Tool Schema Validation', () => {
    it('identify_employee should have correct parameters', () => {
      const tool = assistantTools.find(t => t.function.name === 'identify_employee');
      expect(tool?.function.parameters.properties).toHaveProperty('name');
      expect(tool?.function.parameters.properties).toHaveProperty('branchName');
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

    it('calculate_price should have services parameter', () => {
      const tool = assistantTools.find(t => t.function.name === 'calculate_price');
      expect(tool?.function.parameters.properties).toHaveProperty('services');
      expect(tool?.function.parameters.properties).toHaveProperty('discountPercent');
    });
  });
});
