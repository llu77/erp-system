/**
 * اختبارات محرك التوصيات المتقدم
 * Advanced Recommendation Engine Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RecommendationEngine,
  createRecommendationContext,
  generateRecommendations,
  RecommendationContext,
  Recommendation
} from './advancedRecommendationEngine';

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
          }),
          limit: vi.fn().mockResolvedValue([])
        }),
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([])
              })
            })
          }),
          groupBy: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([])
            })
          })
        }),
        leftJoin: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue({
            having: vi.fn().mockResolvedValue([])
          })
        }),
        groupBy: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      })
    })
  })
}));

describe('Advanced Recommendation Engine', () => {
  describe('createRecommendationContext', () => {
    it('يجب أن يُنشئ سياق توصيات صحيح', () => {
      const context = createRecommendationContext(1, 'admin', 1);
      
      expect(context).toBeDefined();
      expect(context.userId).toBe(1);
      expect(context.userRole).toBe('admin');
      expect(context.branchId).toBe(1);
      expect(context).toHaveProperty('timeOfDay');
      expect(context).toHaveProperty('dayOfWeek');
      expect(context).toHaveProperty('isEndOfMonth');
      expect(context).toHaveProperty('isEndOfWeek');
    });

    it('يجب أن يُحدد الوقت من اليوم بشكل صحيح', () => {
      const context = createRecommendationContext(1, 'admin');
      
      expect(['morning', 'afternoon', 'evening', 'night']).toContain(context.timeOfDay);
    });

    it('يجب أن يُحدد يوم الأسبوع بشكل صحيح', () => {
      const context = createRecommendationContext(1, 'admin');
      
      expect(context.dayOfWeek).toBeGreaterThanOrEqual(0);
      expect(context.dayOfWeek).toBeLessThanOrEqual(6);
    });

    it('يجب أن يعمل بدون branchId', () => {
      const context = createRecommendationContext(1, 'manager');
      
      expect(context).toBeDefined();
      expect(context.branchId).toBeUndefined();
    });
  });

  describe('RecommendationEngine', () => {
    let engine: RecommendationEngine;
    let mockContext: RecommendationContext;

    beforeEach(() => {
      mockContext = createRecommendationContext(1, 'admin', 1);
      engine = new RecommendationEngine(mockContext);
    });

    it('يجب أن يُنشئ محرك التوصيات بنجاح', () => {
      expect(engine).toBeDefined();
    });

    it('يجب أن يُولد توصيات', async () => {
      const recommendations = await engine.generateAllRecommendations();
      
      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('يجب أن تكون التوصيات مرتبة حسب الأولوية', async () => {
      const recommendations = await engine.generateAllRecommendations();
      
      if (recommendations.length > 1) {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        for (let i = 0; i < recommendations.length - 1; i++) {
          const current = priorityOrder[recommendations[i].priority];
          const next = priorityOrder[recommendations[i + 1].priority];
          expect(current).toBeGreaterThanOrEqual(next);
        }
      }
    });

    it('يجب أن يُرجع توصيات لصفحة محددة', async () => {
      await engine.generateAllRecommendations();
      const pageRecs = engine.getRecommendationsForPage('/dashboard');
      
      expect(pageRecs).toBeDefined();
      expect(Array.isArray(pageRecs)).toBe(true);
    });
  });

  describe('generateRecommendations', () => {
    it('يجب أن يُولد توصيات للمستخدم', async () => {
      const recommendations = await generateRecommendations(1, 'admin', 1);
      
      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('يجب أن يعمل بدون branchId', async () => {
      const recommendations = await generateRecommendations(1, 'manager');
      
      expect(recommendations).toBeDefined();
    });
  });

  describe('Recommendation Structure', () => {
    it('يجب أن تحتوي التوصية على الخصائص المطلوبة', async () => {
      const context = createRecommendationContext(1, 'admin', 1);
      const engine = new RecommendationEngine(context);
      const recommendations = await engine.generateAllRecommendations();
      
      if (recommendations.length > 0) {
        const rec = recommendations[0];
        expect(rec).toHaveProperty('id');
        expect(rec).toHaveProperty('type');
        expect(rec).toHaveProperty('category');
        expect(rec).toHaveProperty('priority');
        expect(rec).toHaveProperty('title');
        expect(rec).toHaveProperty('description');
        expect(rec).toHaveProperty('confidence');
        expect(rec).toHaveProperty('impact');
        expect(rec).toHaveProperty('actions');
        expect(rec).toHaveProperty('createdAt');
        expect(rec).toHaveProperty('status');
      }
    });

    it('يجب أن تكون الأولوية صحيحة', async () => {
      const context = createRecommendationContext(1, 'admin', 1);
      const engine = new RecommendationEngine(context);
      const recommendations = await engine.generateAllRecommendations();
      
      const validPriorities = ['low', 'medium', 'high', 'critical'];
      recommendations.forEach(rec => {
        expect(validPriorities).toContain(rec.priority);
      });
    });

    it('يجب أن تكون الثقة بين 0 و 1', async () => {
      const context = createRecommendationContext(1, 'admin', 1);
      const engine = new RecommendationEngine(context);
      const recommendations = await engine.generateAllRecommendations();
      
      recommendations.forEach(rec => {
        expect(rec.confidence).toBeGreaterThanOrEqual(0);
        expect(rec.confidence).toBeLessThanOrEqual(1);
      });
    });
  });
});
