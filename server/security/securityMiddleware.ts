/**
 * Security Middleware - تحسينات الأمان
 * 
 * يوفر:
 * 1. Rate Limiting
 * 2. Input Sanitization
 * 3. SQL Injection Prevention
 * 4. XSS Prevention
 */

import { Request, Response, NextFunction } from 'express';

// ===== Rate Limiting =====
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(options: {
  windowMs?: number;
  max?: number;
  message?: string;
} = {}) {
  const windowMs = options.windowMs || 60 * 1000; // 1 minute
  const max = options.max || 100; // 100 requests per window
  const message = options.message || 'Too many requests, please try again later.';
  
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    
    let record = rateLimitStore.get(key);
    
    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      rateLimitStore.set(key, record);
    } else {
      record.count++;
    }
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
    res.setHeader('X-RateLimit-Reset', record.resetTime);
    
    if (record.count > max) {
      res.status(429).json({ error: message });
      return;
    }
    
    next();
  };
}

// ===== Input Sanitization =====
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return input;
  
  return input
    // Remove null bytes
    .replace(/\0/g, '')
    // Escape HTML entities
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    // Remove potential SQL injection patterns
    .replace(/--/g, '')
    .replace(/;/g, '')
    // Trim whitespace
    .trim();
}

export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized as T;
}

// ===== SQL Injection Detection =====
const sqlPatterns = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)\b)/i,
  /(\b(UNION|JOIN|WHERE|FROM|INTO)\b)/i,
  /(--|#|\/\*|\*\/)/,
  /(\bOR\b\s+\d+\s*=\s*\d+)/i,
  /(\bAND\b\s+\d+\s*=\s*\d+)/i,
  /('|\"|;|\\)/,
];

export function detectSqlInjection(input: string): boolean {
  if (typeof input !== 'string') return false;
  
  for (const pattern of sqlPatterns) {
    if (pattern.test(input)) {
      return true;
    }
  }
  
  return false;
}

export function sqlInjectionGuard(req: Request, res: Response, next: NextFunction): void {
  const checkValue = (value: any, path: string): boolean => {
    if (typeof value === 'string' && detectSqlInjection(value)) {
      console.warn(`[Security] Potential SQL injection detected at ${path}: ${value.substring(0, 50)}`);
      return true;
    }
    if (typeof value === 'object' && value !== null) {
      for (const [key, val] of Object.entries(value)) {
        if (checkValue(val, `${path}.${key}`)) {
          return true;
        }
      }
    }
    return false;
  };
  
  if (checkValue(req.body, 'body') || checkValue(req.query, 'query') || checkValue(req.params, 'params')) {
    res.status(400).json({ error: 'Invalid input detected' });
    return;
  }
  
  next();
}

// ===== XSS Prevention =====
export function xssGuard(req: Request, res: Response, next: NextFunction): void {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
}

// ===== CORS Configuration =====
export function corsConfig(allowedOrigins: string[] = []) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    
    if (origin && (allowedOrigins.length === 0 || allowedOrigins.includes(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    
    next();
  };
}

// ===== Request Validation =====
export function validateContentType(req: Request, res: Response, next: NextFunction): void {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      res.status(415).json({ error: 'Content-Type must be application/json' });
      return;
    }
  }
  
  next();
}

// ===== Audit Logging =====
export function auditLog(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };
    
    // Log only non-GET requests or errors
    if (req.method !== 'GET' || res.statusCode >= 400) {
      console.log('[Audit]', JSON.stringify(log));
    }
  });
  
  next();
}

// ===== Combined Security Middleware =====
export function securityMiddleware() {
  return [
    xssGuard,
    auditLog,
    rateLimit({ windowMs: 60000, max: 100 }),
  ];
}
