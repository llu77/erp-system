/**
 * Response Cache Middleware
 * Middleware للتخزين المؤقت للاستجابات
 */

import { cacheService, cacheTTL } from './cacheService';

interface CacheableResponse {
  data: any;
  timestamp: number;
  etag: string;
}

/**
 * Generate ETag from response data
 */
function generateETag(data: any): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `"${Math.abs(hash).toString(16)}"`;
}

/**
 * Create a cached procedure wrapper for tRPC
 * يستخدم للـ queries التي لا تتغير كثيراً
 */
export function withCache<T>(
  cacheKey: string,
  ttl: number = cacheTTL.MEDIUM
) {
  return async (getter: () => Promise<T>): Promise<T> => {
    return cacheService.getOrSet(cacheKey, getter, ttl);
  };
}

/**
 * Invalidate cache after mutation
 * يستخدم بعد عمليات التعديل لإبطال الكاش
 */
export function invalidateAfterMutation(patterns: string[]): void {
  for (const pattern of patterns) {
    cacheService.invalidatePattern(pattern);
  }
}

/**
 * Cache decorator for database queries
 */
export async function cachedQuery<T>(
  key: string,
  query: () => Promise<T>,
  ttl: number = cacheTTL.MEDIUM
): Promise<T> {
  return cacheService.getOrSet(key, query, ttl);
}

/**
 * Batch cache invalidation helper
 */
export function invalidateCaches(keys: string[]): void {
  for (const key of keys) {
    cacheService.invalidate(key);
  }
}

/**
 * Entity-based cache invalidation
 */
export function invalidateEntityCaches(
  entityType: 'products' | 'customers' | 'suppliers' | 'invoices' | 'employees' | 'branches' | 'pos' | 'loyalty',
  entityId?: number
): void {
  cacheService.invalidateEntity(entityType, entityId);
  
  // Also invalidate related caches
  switch (entityType) {
    case 'products':
      cacheService.invalidatePattern('dashboard:');
      cacheService.invalidatePattern('reports:');
      break;
    case 'invoices':
      cacheService.invalidatePattern('dashboard:');
      cacheService.invalidatePattern('reports:revenue:');
      cacheService.invalidatePattern('customers:');
      break;
    case 'employees':
      cacheService.invalidatePattern('pos:employees:');
      cacheService.invalidatePattern('payrolls:');
      break;
    case 'pos':
      cacheService.invalidatePattern('pos:');
      cacheService.invalidatePattern('reports:');
      cacheService.invalidatePattern('loyalty:');
      break;
    case 'loyalty':
      cacheService.invalidatePattern('loyalty:');
      break;
  }
}

export { cacheService, cacheTTL };
