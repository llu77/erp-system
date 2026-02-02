/**
 * Smart Caching Service for ERP System
 * نظام التخزين المؤقت الذكي
 * 
 * Features:
 * - In-memory caching with TTL
 * - Automatic cache invalidation
 * - Cache statistics
 * - Pattern-based invalidation
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
  memoryUsage: string;
}

class CacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private stats = { hits: 0, misses: 0 };
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Get cached data or execute getter function
   */
  async getOrSet<T>(
    key: string,
    getter: () => Promise<T>,
    ttlSeconds: number = 300 // Default 5 minutes
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await getter();
    this.set(key, data, ttlSeconds);
    return data;
  }

  /**
   * Get data from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl * 1000) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    entry.hits++;
    this.stats.hits++;
    return entry.data as T;
  }

  /**
   * Set data in cache
   */
  set<T>(key: string, data: T, ttlSeconds: number = 300): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds,
      hits: 0,
    });
  }

  /**
   * Invalidate cache by exact key
   */
  invalidate(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Invalidate cache by pattern (prefix)
   */
  invalidatePattern(pattern: string): number {
    let count = 0;
    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Invalidate all cache entries for a specific entity type
   */
  invalidateEntity(entityType: string, entityId?: number): number {
    const pattern = entityId 
      ? `${entityType}:${entityId}` 
      : `${entityType}:`;
    return this.invalidatePattern(pattern);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const memoryUsage = this.estimateMemoryUsage();
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      entries: this.cache.size,
      memoryUsage,
    };
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (now - entry.timestamp > entry.ttl * 1000) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`[Cache] Cleaned ${cleaned} expired entries`);
    }
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(): string {
    let bytes = 0;
    for (const [key, entry] of Array.from(this.cache.entries())) {
      bytes += key.length * 2; // UTF-16
      bytes += JSON.stringify(entry.data).length * 2;
    }
    
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  /**
   * Destroy cache service
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

// Singleton instance
export const cacheService = new CacheService();

// Cache key generators
export const cacheKeys = {
  // Dashboard
  dashboardStats: (branchId?: number) => 
    branchId ? `dashboard:stats:${branchId}` : 'dashboard:stats:all',
  
  // Products
  productList: (branchId?: number) => 
    branchId ? `products:list:${branchId}` : 'products:list:all',
  productById: (id: number) => `products:${id}`,
  
  // Customers
  customerList: () => 'customers:list',
  customerById: (id: number) => `customers:${id}`,
  
  // Suppliers
  supplierList: () => 'suppliers:list',
  supplierById: (id: number) => `suppliers:${id}`,
  
  // Invoices
  invoiceList: (branchId?: number, status?: string) => 
    `invoices:list:${branchId || 'all'}:${status || 'all'}`,
  invoiceById: (id: number) => `invoices:${id}`,
  
  // Employees
  employeeList: (branchId?: number) => 
    branchId ? `employees:list:${branchId}` : 'employees:list:all',
  employeeById: (id: number) => `employees:${id}`,
  
  // Branches
  branchList: () => 'branches:list',
  branchById: (id: number) => `branches:${id}`,
  
  // POS
  posServices: (branchId?: number) => 
    branchId ? `pos:services:${branchId}` : 'pos:services:all',
  posCategories: () => 'pos:categories',
  posEmployees: (branchId: number) => `pos:employees:${branchId}`,
  posDailySummary: (branchId: number, date: string) => 
    `pos:daily:${branchId}:${date}`,
  
  // Loyalty
  loyaltyCustomer: (phone: string) => `loyalty:customer:${phone}`,
  loyaltySettings: (branchId?: number) => 
    branchId ? `loyalty:settings:${branchId}` : 'loyalty:settings:default',
  
  // Reports
  revenueReport: (branchId: number, startDate: string, endDate: string) => 
    `reports:revenue:${branchId}:${startDate}:${endDate}`,
  expenseReport: (branchId: number, startDate: string, endDate: string) => 
    `reports:expense:${branchId}:${startDate}:${endDate}`,
  
  // Settings
  companySettings: () => 'settings:company',
  userPermissions: (userId: number) => `permissions:user:${userId}`,
};

// Cache TTL constants (in seconds)
export const cacheTTL = {
  SHORT: 60,        // 1 minute - for frequently changing data
  MEDIUM: 300,      // 5 minutes - default
  LONG: 900,        // 15 minutes - for stable data
  VERY_LONG: 3600,  // 1 hour - for rarely changing data
  DAY: 86400,       // 24 hours - for static data
};

// Export types
export type { CacheStats };
