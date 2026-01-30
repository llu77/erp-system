/**
 * اختبارات مركز أدوات الذكاء الاصطناعي
 * AI Tools Hub Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAvailableTools,
  executeAITool,
  AIToolContext,
  AIToolName
} from './aiToolsHub';

// Mock database
vi.mock('../db', () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([])
            })
          })
        }),
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([])
              })
            })
          })
        }),
        leftJoin: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue({
            having: vi.fn().mockResolvedValue([])
          })
        })
      })
    })
  })
}));

// Mock LLM
vi.mock('../_core/llm', () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          insights: ['رؤية اختبارية'],
          recommendations: ['توصية اختبارية']
        })
      }
    }]
  })
}));

describe('AI Tools Hub', () => {
  const mockContext: AIToolContext = {
    userId: 1,
    userRole: 'admin',
    branchId: 1,
    timestamp: new Date()
  };

  describe('getAvailableTools', () => {
    it('يجب أن يُرجع قائمة الأدوات المتاحة', () => {
      const tools = getAvailableTools();
      
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('يجب أن تحتوي كل أداة على الخصائص المطلوبة', () => {
      const tools = getAvailableTools();
      
      tools.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('requiredRole');
        expect(Array.isArray(tool.requiredRole)).toBe(true);
      });
    });

    it('يجب أن تتضمن أداة تحليل المبيعات', () => {
      const tools = getAvailableTools();
      const salesTool = tools.find(t => t.name === 'sales_intelligence');
      
      expect(salesTool).toBeDefined();
      expect(salesTool?.description).toContain('مبيعات');
    });

    it('يجب أن تتضمن أداة كشف الاحتيال', () => {
      const tools = getAvailableTools();
      const fraudTool = tools.find(t => t.name === 'fraud_detection');
      
      expect(fraudTool).toBeDefined();
      expect(fraudTool?.requiredRole).toContain('admin');
    });
  });

  describe('executeAITool', () => {
    it('يجب أن يُنفذ أداة تحليل المبيعات بنجاح', async () => {
      const result = await executeAITool({
        tool: 'sales_intelligence',
        context: mockContext,
        options: {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate: new Date(),
          includeAIInsights: true
        }
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('executionTime');
      expect(typeof result.executionTime).toBe('number');
    });

    it('يجب أن يُنفذ أداة تحليل سلوك العملاء', async () => {
      const result = await executeAITool({
        tool: 'customer_behavior',
        context: mockContext,
        options: {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate: new Date(),
          includeChurnPrediction: true
        }
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
    });

    it('يجب أن يُنفذ أداة التنبؤ بالطلب', async () => {
      const result = await executeAITool({
        tool: 'demand_forecast',
        context: mockContext,
        options: {
          forecastPeriods: 7,
          granularity: 'daily'
        }
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
    });

    it('يجب أن يُنفذ أداة كشف الاحتيال', async () => {
      const result = await executeAITool({
        tool: 'fraud_detection',
        context: mockContext,
        options: {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate: new Date(),
          sensitivityLevel: 'medium'
        }
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
    });

    it('يجب أن يُرجع وقت التنفيذ', async () => {
      const result = await executeAITool({
        tool: 'sales_intelligence',
        context: mockContext,
        options: {
          startDate: new Date(),
          endDate: new Date()
        }
      });

      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Tool Authorization', () => {
    it('يجب أن تكون أداة كشف الاحتيال متاحة للمدير فقط', () => {
      const tools = getAvailableTools();
      const fraudTool = tools.find(t => t.name === 'fraud_detection');
      
      expect(fraudTool?.requiredRole).toContain('admin');
      expect(fraudTool?.requiredRole).not.toContain('employee');
    });

    it('يجب أن تكون أداة تحليل المبيعات متاحة للمدير والمشرف', () => {
      const tools = getAvailableTools();
      const salesTool = tools.find(t => t.name === 'sales_intelligence');
      
      expect(salesTool?.requiredRole).toContain('admin');
      expect(salesTool?.requiredRole).toContain('manager');
    });
  });
});
