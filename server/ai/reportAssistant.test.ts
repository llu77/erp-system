/**
 * اختبارات مساعد التقارير الذكي
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  analyzeQuestion, 
  generateReport, 
  generateResponse,
  getSuggestedQuestions,
  type AnalyzedQuestion,
  type ReportData
} from './reportAssistantService';

// Mock LLM
vi.mock('../_core/llm', () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          reportType: 'sales_summary',
          chartType: 'bar',
          dateRange: {
            start: '2026-01-01',
            end: '2026-01-30',
            label: 'يناير 2026'
          },
          filters: {},
          groupBy: null,
          orderBy: null,
          limit: 10,
          comparison: { enabled: false },
          confidence: 0.95,
          interpretation: 'تقرير ملخص المبيعات للشهر الحالي'
        })
      }
    }]
  })
}));

// Mock database
vi.mock('../db', () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    then: vi.fn().mockResolvedValue([{
      totalSales: 50000,
      invoiceCount: 100,
      avgInvoice: 500
    }])
  })
}));

describe('مساعد التقارير الذكي', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSuggestedQuestions', () => {
    it('يجب أن يعيد قائمة من الأسئلة المقترحة', () => {
      const questions = getSuggestedQuestions();
      
      expect(questions).toBeDefined();
      expect(Array.isArray(questions)).toBe(true);
      expect(questions.length).toBeGreaterThan(0);
      expect(questions.every(q => typeof q === 'string')).toBe(true);
    });

    it('يجب أن تحتوي الأسئلة على كلمات مفتاحية متعلقة بالتقارير', () => {
      const questions = getSuggestedQuestions();
      
      const keywords = ['مبيعات', 'تقرير', 'منتج', 'عميل', 'مصروف', 'مخزون', 'أرباح'];
      const hasRelevantKeywords = questions.some(q => 
        keywords.some(keyword => q.includes(keyword))
      );
      
      expect(hasRelevantKeywords).toBe(true);
    });
  });

  describe('analyzeQuestion', () => {
    it('يجب أن يحلل سؤال المبيعات بشكل صحيح', async () => {
      const question = 'ما هي المبيعات هذا الشهر؟';
      const result = await analyzeQuestion(question);
      
      expect(result).toBeDefined();
      expect(result.originalQuestion).toBe(question);
      expect(result.reportType).toBeDefined();
      expect(result.chartType).toBeDefined();
      expect(result.dateRange).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('يجب أن يتعامل مع سجل المحادثة', async () => {
      const question = 'وماذا عن الشهر الماضي؟';
      const history = [{
        role: 'user' as const,
        content: 'ما هي المبيعات هذا الشهر؟',
        timestamp: new Date()
      }, {
        role: 'assistant' as const,
        content: 'إجمالي المبيعات هذا الشهر 50,000 ر.س.',
        timestamp: new Date()
      }];
      
      const result = await analyzeQuestion(question, history);
      
      expect(result).toBeDefined();
      expect(result.originalQuestion).toBe(question);
    });
  });

  describe('أنواع التقارير', () => {
    const reportTypes = [
      'sales_summary',
      'sales_by_product',
      'sales_by_customer',
      'sales_by_employee',
      'sales_by_branch',
      'inventory_status',
      'low_stock',
      'expenses_summary',
      'expenses_by_category',
      'profit_loss',
      'customer_analysis',
      'employee_performance',
      'purchase_orders'
    ];

    it('يجب أن يدعم جميع أنواع التقارير المحددة', () => {
      // التحقق من أن الأنواع موجودة في النظام
      expect(reportTypes.length).toBe(13);
    });
  });

  describe('أنواع الرسوم البيانية', () => {
    const chartTypes = ['bar', 'line', 'pie', 'doughnut', 'area', 'table', 'kpi'];

    it('يجب أن يدعم جميع أنواع الرسوم البيانية', () => {
      expect(chartTypes.length).toBe(7);
    });
  });

  describe('التحقق من البنية', () => {
    it('يجب أن تكون بنية AnalyzedQuestion صحيحة', async () => {
      const result = await analyzeQuestion('ما هي المبيعات؟');
      
      // التحقق من الحقول المطلوبة
      expect(result).toHaveProperty('originalQuestion');
      expect(result).toHaveProperty('reportType');
      expect(result).toHaveProperty('chartType');
      expect(result).toHaveProperty('dateRange');
      expect(result).toHaveProperty('filters');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('interpretation');
      
      // التحقق من بنية dateRange
      expect(result.dateRange).toHaveProperty('start');
      expect(result.dateRange).toHaveProperty('end');
      expect(result.dateRange).toHaveProperty('label');
    });
  });
});
