/**
 * Performance Optimizations Tests
 * اختبارات تحسينات الأداء
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ===== Query Optimizer Tests =====
describe('Query Optimizer', () => {
  describe('Pagination Helper', () => {
    it('should calculate correct offset and limit', async () => {
      const { getPaginationOffset } = await import('./performance/queryOptimizer');
      
      const result = getPaginationOffset({ page: 2, limit: 20 });
      expect(result.offset).toBe(20);
      expect(result.limit).toBe(20);
    });
    
    it('should default to page 1 and limit 20', async () => {
      const { getPaginationOffset } = await import('./performance/queryOptimizer');
      
      const result = getPaginationOffset({});
      expect(result.offset).toBe(0);
      expect(result.limit).toBe(20);
    });
    
    it('should cap limit at 100', async () => {
      const { getPaginationOffset } = await import('./performance/queryOptimizer');
      
      const result = getPaginationOffset({ limit: 500 });
      expect(result.limit).toBe(100);
    });
  });
  
  describe('Paginated Result', () => {
    it('should create correct pagination metadata', async () => {
      const { createPaginatedResult } = await import('./performance/queryOptimizer');
      
      const data = [1, 2, 3, 4, 5];
      const result = createPaginatedResult(data, 100, { page: 2, limit: 5 });
      
      expect(result.data).toEqual(data);
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(5);
      expect(result.pagination.total).toBe(100);
      expect(result.pagination.totalPages).toBe(20);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrev).toBe(true);
    });
  });
  
  describe('Query Deduplication', () => {
    it('should deduplicate concurrent queries', async () => {
      const { deduplicateQuery } = await import('./performance/queryOptimizer');
      
      let callCount = 0;
      const queryFn = async () => {
        callCount++;
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'result';
      };
      
      // Call same query twice concurrently
      const [result1, result2] = await Promise.all([
        deduplicateQuery('test-key', queryFn),
        deduplicateQuery('test-key', queryFn),
      ]);
      
      expect(result1).toBe('result');
      expect(result2).toBe('result');
      expect(callCount).toBe(1); // Should only call once
    });
  });
  
  describe('Query Performance Logger', () => {
    it('should log query times', async () => {
      const { logQueryTime, getQueryStats } = await import('./performance/queryOptimizer');
      
      logQueryTime('test-query', 100);
      logQueryTime('test-query', 200);
      logQueryTime('test-query', 150);
      
      const stats = getQueryStats('test-query');
      expect(stats).not.toBeNull();
      expect(stats!.avg).toBe(150);
      expect(stats!.min).toBe(100);
      expect(stats!.max).toBe(200);
      expect(stats!.count).toBe(3);
    });
  });
});

// ===== Cache Service Tests =====
describe('Cache Service', () => {
  it('should cache and retrieve data', async () => {
    const { cacheService } = await import('./cache/cacheService');
    
    cacheService.set('test-key', { value: 'test' }, 60);
    const result = cacheService.get('test-key');
    
    expect(result).toEqual({ value: 'test' });
  });
  
  it('should return null for expired cache', async () => {
    const { cacheService } = await import('./cache/cacheService');
    
    cacheService.set('expired-key', { value: 'test' }, 0);
    
    // Wait a bit for expiration
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const result = cacheService.get('expired-key');
    expect(result).toBeNull();
  });
  
  it('should invalidate cache by pattern', async () => {
    const { cacheService } = await import('./cache/cacheService');
    
    cacheService.set('products:1', { id: 1 }, 60);
    cacheService.set('products:2', { id: 2 }, 60);
    cacheService.set('customers:1', { id: 1 }, 60);
    
    const invalidated = cacheService.invalidatePattern('products:');
    
    expect(invalidated).toBe(2);
    expect(cacheService.get('products:1')).toBeNull();
    expect(cacheService.get('products:2')).toBeNull();
    expect(cacheService.get('customers:1')).not.toBeNull();
  });
  
  it('should track cache statistics', async () => {
    const { cacheService } = await import('./cache/cacheService');
    
    cacheService.clear();
    
    cacheService.set('stats-test', { value: 1 }, 60);
    cacheService.get('stats-test'); // hit
    cacheService.get('stats-test'); // hit
    cacheService.get('nonexistent'); // miss
    
    const stats = cacheService.getStats();
    expect(stats.entries).toBeGreaterThanOrEqual(1);
  });
});

// ===== Security Middleware Tests =====
describe('Security Middleware', () => {
  describe('Input Sanitization', () => {
    it('should sanitize HTML entities', async () => {
      const { sanitizeInput } = await import('./security/securityMiddleware');
      
      const input = '<script>alert("xss")</script>';
      const sanitized = sanitizeInput(input);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('&lt'); // HTML entity without semicolon
    });
    
    it('should remove SQL injection patterns', async () => {
      const { sanitizeInput } = await import('./security/securityMiddleware');
      
      const input = 'test; DROP TABLE users--';
      const sanitized = sanitizeInput(input);
      
      expect(sanitized).not.toContain(';');
      expect(sanitized).not.toContain('--');
    });
  });
  
  describe('SQL Injection Detection', () => {
    it('should detect SQL injection attempts', async () => {
      const { detectSqlInjection } = await import('./security/securityMiddleware');
      
      expect(detectSqlInjection("SELECT * FROM users")).toBe(true);
      expect(detectSqlInjection("1 OR 1=1")).toBe(true);
      expect(detectSqlInjection("normal text")).toBe(false);
    });
  });
});

// ===== Cached Procedures Tests =====
describe('Cached Procedures', () => {
  it('should invalidate product cache', async () => {
    const { invalidateProductCache } = await import('./cache/cachedProcedures');
    const { cacheService } = await import('./cache/cacheService');
    
    cacheService.set('products:list:1', [{ id: 1 }], 60);
    
    invalidateProductCache(1);
    
    expect(cacheService.get('products:list:1')).toBeNull();
  });
  
  it('should invalidate POS cache', async () => {
    const { invalidatePosCache } = await import('./cache/cachedProcedures');
    const { cacheService } = await import('./cache/cacheService');
    
    cacheService.set('pos:services:1', [{ id: 1 }], 60);
    cacheService.set('pos:employees:1', [{ id: 1 }], 60);
    
    invalidatePosCache(1);
    
    expect(cacheService.get('pos:services:1')).toBeNull();
    expect(cacheService.get('pos:employees:1')).toBeNull();
  });
});
