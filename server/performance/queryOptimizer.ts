/**
 * Query Optimizer - تحسين استعلامات قاعدة البيانات
 * 
 * يوفر:
 * 1. Pagination للاستعلامات الكبيرة
 * 2. Query Batching لتقليل الـ round trips
 * 3. Result Caching للاستعلامات المتكررة
 * 4. Query Deduplication لمنع الاستعلامات المكررة
 */

import { cacheService } from '../cache/cacheService';

// ===== Pagination Helper =====
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function getPaginationOffset(params: PaginationParams): { offset: number; limit: number } {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20)); // Max 100 items per page
  const offset = (page - 1) * limit;
  return { offset, limit };
}

export function createPaginatedResult<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResult<T> {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const totalPages = Math.ceil(total / limit);
  
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

// ===== Query Deduplication =====
const pendingQueries = new Map<string, Promise<any>>();

export async function deduplicateQuery<T>(
  key: string,
  queryFn: () => Promise<T>
): Promise<T> {
  // Check if same query is already in progress
  const pending = pendingQueries.get(key);
  if (pending) {
    return pending as Promise<T>;
  }
  
  // Execute query and store promise
  const promise = queryFn().finally(() => {
    pendingQueries.delete(key);
  });
  
  pendingQueries.set(key, promise);
  return promise;
}

// ===== Query Batching =====
interface BatchedQuery<T> {
  key: string;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

const batchQueues = new Map<string, BatchedQuery<any>[]>();
const batchTimers = new Map<string, NodeJS.Timeout>();

export function batchQuery<T, K>(
  batchKey: string,
  itemKey: K,
  batchFn: (keys: K[]) => Promise<Map<K, T>>,
  delayMs: number = 10
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    // Get or create queue for this batch type
    let queue = batchQueues.get(batchKey);
    if (!queue) {
      queue = [];
      batchQueues.set(batchKey, queue);
    }
    
    // Add to queue
    queue.push({
      key: String(itemKey),
      resolve,
      reject,
    });
    
    // Clear existing timer
    const existingTimer = batchTimers.get(batchKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Set new timer to execute batch
    const timer = setTimeout(async () => {
      const currentQueue = batchQueues.get(batchKey) || [];
      batchQueues.delete(batchKey);
      batchTimers.delete(batchKey);
      
      if (currentQueue.length === 0) return;
      
      try {
        // Get unique keys
        const keys = Array.from(new Set(currentQueue.map(q => q.key))) as K[];
        
        // Execute batch query
        const results = await batchFn(keys);
        
        // Resolve all promises
        for (const query of currentQueue) {
          const result = results.get(query.key as K);
          query.resolve(result);
        }
      } catch (error) {
        // Reject all promises
        for (const query of currentQueue) {
          query.reject(error as Error);
        }
      }
    }, delayMs);
    
    batchTimers.set(batchKey, timer);
  });
}

// ===== Cached Query Helper =====
export async function cachedQuery<T>(
  cacheKey: string,
  queryFn: () => Promise<T>,
  ttlSeconds: number = 60
): Promise<T> {
  // Use cacheService.getOrSet for atomic cache operations
  return cacheService.getOrSet(cacheKey, () => deduplicateQuery(cacheKey, queryFn), ttlSeconds);
}

// ===== Select Fields Helper =====
export function selectFields<T extends Record<string, any>>(
  obj: T,
  fields: (keyof T)[]
): Partial<T> {
  const result: Partial<T> = {};
  for (const field of fields) {
    if (field in obj) {
      result[field] = obj[field];
    }
  }
  return result;
}

// ===== Query Performance Logger =====
const queryTimes = new Map<string, number[]>();

export function logQueryTime(queryName: string, durationMs: number): void {
  let times = queryTimes.get(queryName);
  if (!times) {
    times = [];
    queryTimes.set(queryName, times);
  }
  
  // Keep last 100 measurements
  times.push(durationMs);
  if (times.length > 100) {
    times.shift();
  }
}

export function getQueryStats(queryName: string): {
  avg: number;
  min: number;
  max: number;
  count: number;
} | null {
  const times = queryTimes.get(queryName);
  if (!times || times.length === 0) return null;
  
  return {
    avg: times.reduce((a, b) => a + b, 0) / times.length,
    min: Math.min(...times),
    max: Math.max(...times),
    count: times.length,
  };
}

export function getAllQueryStats(): Record<string, ReturnType<typeof getQueryStats>> {
  const stats: Record<string, ReturnType<typeof getQueryStats>> = {};
  for (const [name] of Array.from(queryTimes.entries())) {
    stats[name] = getQueryStats(name);
  }
  return stats;
}

// ===== Timed Query Wrapper =====
export async function timedQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    return await queryFn();
  } finally {
    const duration = performance.now() - start;
    logQueryTime(queryName, duration);
    
    // Log slow queries (> 500ms)
    if (duration > 500) {
      console.warn(`[Slow Query] ${queryName}: ${duration.toFixed(2)}ms`);
    }
  }
}
