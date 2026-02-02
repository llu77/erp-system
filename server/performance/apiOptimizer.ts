/**
 * API Optimizer - تحسين أداء الـ API
 * 
 * يوفر:
 * 1. Response Time Tracking
 * 2. Request Deduplication
 * 3. Response Compression Headers
 * 4. ETag Support for Caching
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// ===== Response Time Tracking =====
const apiTimes = new Map<string, number[]>();

export function trackResponseTime(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  const path = req.path;
  
  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;
    
    let times = apiTimes.get(path);
    if (!times) {
      times = [];
      apiTimes.set(path, times);
    }
    
    times.push(durationMs);
    if (times.length > 100) {
      times.shift();
    }
    
    // Log slow APIs (> 1000ms)
    if (durationMs > 1000) {
      console.warn(`[Slow API] ${req.method} ${path}: ${durationMs.toFixed(2)}ms`);
    }
  });
  
  next();
}

export function getApiStats(): Record<string, { avg: number; min: number; max: number; count: number }> {
  const stats: Record<string, { avg: number; min: number; max: number; count: number }> = {};
  
  for (const [path, times] of Array.from(apiTimes.entries())) {
    if (times.length > 0) {
      stats[path] = {
        avg: times.reduce((a, b) => a + b, 0) / times.length,
        min: Math.min(...times),
        max: Math.max(...times),
        count: times.length,
      };
    }
  }
  
  return stats;
}

// ===== ETag Support =====
export function generateETag(data: any): string {
  const hash = crypto.createHash('md5');
  hash.update(JSON.stringify(data));
  return `"${hash.digest('hex')}"`;
}

export function etagMiddleware(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);
  
  res.json = function(data: any) {
    // Generate ETag
    const etag = generateETag(data);
    res.setHeader('ETag', etag);
    
    // Check If-None-Match header
    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch === etag) {
      res.status(304).end();
      return res;
    }
    
    return originalJson(data);
  };
  
  next();
}

// ===== Request Deduplication =====
const pendingRequests = new Map<string, Promise<any>>();

export function deduplicateRequests(req: Request, res: Response, next: NextFunction): void {
  // Only deduplicate GET requests
  if (req.method !== 'GET') {
    return next();
  }
  
  const key = `${req.method}:${req.originalUrl}`;
  const pending = pendingRequests.get(key);
  
  if (pending) {
    // Wait for pending request and return same response
    pending.then((data) => {
      res.json(data);
    }).catch((err) => {
      res.status(500).json({ error: err.message });
    });
    return;
  }
  
  // Create promise for this request
  const promise = new Promise((resolve, reject) => {
    const originalJson = res.json.bind(res);
    
    res.json = function(data: any) {
      resolve(data);
      pendingRequests.delete(key);
      return originalJson(data);
    };
    
    res.on('error', (err) => {
      reject(err);
      pendingRequests.delete(key);
    });
  });
  
  pendingRequests.set(key, promise);
  
  // Clean up after 30 seconds
  setTimeout(() => {
    pendingRequests.delete(key);
  }, 30000);
  
  next();
}

// ===== Cache Control Headers =====
export function setCacheHeaders(maxAge: number = 60) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Only cache GET requests
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
    } else {
      res.setHeader('Cache-Control', 'no-store');
    }
    next();
  };
}

// ===== JSON Response Optimization =====
export function optimizeJsonResponse(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);
  
  res.json = function(data: any) {
    // Remove null/undefined values to reduce payload size
    const optimized = JSON.parse(JSON.stringify(data, (key, value) => {
      // Keep null for explicit null values in arrays
      if (Array.isArray(value)) return value;
      // Remove undefined and null from objects
      if (value === null || value === undefined) return undefined;
      return value;
    }));
    
    return originalJson(optimized);
  };
  
  next();
}

// ===== Performance Stats Endpoint =====
export function getPerformanceStats() {
  return {
    api: getApiStats(),
    memory: {
      heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)} MB`,
      external: `${(process.memoryUsage().external / 1024 / 1024).toFixed(2)} MB`,
    },
    uptime: `${(process.uptime() / 60).toFixed(2)} minutes`,
  };
}
