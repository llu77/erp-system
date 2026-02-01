/**
 * S3Image Component
 * 
 * مكون لعرض الصور من S3 مع دعم تجديد الروابط المنتهية تلقائياً.
 * يستخدم localStorage للتخزين المؤقت لتقليل طلبات API.
 * 
 * @version 1.0.0
 * @author ERP System
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { Loader2, ImageOff, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types & Interfaces
// ============================================================================

interface S3ImageProps {
  /** رابط الصورة الأصلي من S3 */
  src: string;
  /** مفتاح الصورة في S3 للتجديد */
  s3Key: string;
  /** النص البديل للصورة */
  alt: string;
  /** CSS classes إضافية */
  className?: string;
  /** مكون بديل عند الفشل */
  fallback?: React.ReactNode;
  /** تفعيل التحميل الكسول */
  lazy?: boolean;
  /** callback عند نجاح التحميل */
  onLoad?: () => void;
  /** callback عند فشل التحميل */
  onError?: () => void;
}

interface CachedUrl {
  url: string;
  timestamp: number;
  s3Key: string;
}

// ============================================================================
// Constants
// ============================================================================

/** مدة صلاحية الـ cache بالمللي ثانية (50 دقيقة) */
const CACHE_TTL_MS = 50 * 60 * 1000;

/** مفتاح localStorage للتخزين المؤقت */
const CACHE_STORAGE_KEY = 's3_image_url_cache';

/** الحد الأقصى لعدد محاولات التجديد */
const MAX_REFRESH_ATTEMPTS = 2;

// ============================================================================
// Cache Utilities
// ============================================================================

/**
 * الحصول على الـ cache من localStorage
 */
function getUrlCache(): Map<string, CachedUrl> {
  try {
    const cached = localStorage.getItem(CACHE_STORAGE_KEY);
    if (!cached) return new Map();
    
    const parsed = JSON.parse(cached) as Record<string, CachedUrl>;
    const now = Date.now();
    const validEntries: [string, CachedUrl][] = [];
    
    // تصفية الإدخالات المنتهية
    for (const [key, value] of Object.entries(parsed)) {
      if (now - value.timestamp < CACHE_TTL_MS) {
        validEntries.push([key, value]);
      }
    }
    
    return new Map(validEntries);
  } catch {
    return new Map();
  }
}

/**
 * حفظ رابط في الـ cache
 */
function setCachedUrl(s3Key: string, url: string): void {
  try {
    const cache = getUrlCache();
    cache.set(s3Key, {
      url,
      timestamp: Date.now(),
      s3Key,
    });
    
    // تحويل Map إلى object للتخزين
    const cacheObj: Record<string, CachedUrl> = {};
    cache.forEach((value, key) => {
      cacheObj[key] = value;
    });
    
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cacheObj));
  } catch {
    // تجاهل أخطاء localStorage
  }
}

/**
 * الحصول على رابط من الـ cache
 */
function getCachedUrl(s3Key: string): string | null {
  const cache = getUrlCache();
  const cached = cache.get(s3Key);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.url;
  }
  
  return null;
}

// ============================================================================
// Component
// ============================================================================

type ImageState = 'loading' | 'loaded' | 'error' | 'refreshing';

export function S3Image({
  src,
  s3Key,
  alt,
  className,
  fallback,
  lazy = true,
  onLoad,
  onError,
}: S3ImageProps) {
  // State
  const [imageUrl, setImageUrl] = useState<string>(src);
  const [state, setState] = useState<ImageState>('loading');
  const [refreshAttempts, setRefreshAttempts] = useState(0);
  
  // Refs
  const imgRef = useRef<HTMLImageElement>(null);
  const isMounted = useRef(true);
  
  // tRPC mutation للتجديد
  const refreshMutation = trpc.revenues.refreshImageUrl.useMutation({
    onSuccess: (data) => {
      if (!isMounted.current) return;
      
      if (data.url) {
        // حفظ في الـ cache
        setCachedUrl(s3Key, data.url);
        setImageUrl(data.url);
        setState('loading');
      } else {
        setState('error');
        onError?.();
      }
    },
    onError: () => {
      if (!isMounted.current) return;
      setState('error');
      onError?.();
    },
  });
  
  // التحقق من الـ cache عند التحميل
  useEffect(() => {
    const cachedUrl = getCachedUrl(s3Key);
    if (cachedUrl && cachedUrl !== src) {
      setImageUrl(cachedUrl);
    }
  }, [s3Key, src]);
  
  // Cleanup
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  /**
   * معالجة نجاح تحميل الصورة
   */
  const handleLoad = useCallback(() => {
    if (!isMounted.current) return;
    setState('loaded');
    setRefreshAttempts(0);
    onLoad?.();
  }, [onLoad]);
  
  /**
   * معالجة فشل تحميل الصورة
   */
  const handleError = useCallback(() => {
    if (!isMounted.current) return;
    
    // محاولة تجديد الرابط إذا لم نصل للحد الأقصى
    if (refreshAttempts < MAX_REFRESH_ATTEMPTS && s3Key) {
      setState('refreshing');
      setRefreshAttempts(prev => prev + 1);
      refreshMutation.mutate({ s3Key });
    } else {
      setState('error');
      onError?.();
    }
  }, [refreshAttempts, s3Key, refreshMutation, onError]);
  
  /**
   * إعادة المحاولة يدوياً
   */
  const handleRetry = useCallback(() => {
    if (!s3Key) return;
    setRefreshAttempts(0);
    setState('refreshing');
    refreshMutation.mutate({ s3Key });
  }, [s3Key, refreshMutation]);
  
  // ============================================================================
  // Render
  // ============================================================================
  
  // حالة التحميل
  if (state === 'loading' || state === 'refreshing') {
    return (
      <div className={cn(
        "relative bg-muted/50 flex items-center justify-center",
        className
      )}>
        {/* الصورة مخفية أثناء التحميل */}
        <img
          ref={imgRef}
          src={imageUrl}
          alt={alt}
          className="opacity-0 absolute inset-0 w-full h-full object-contain"
          onLoad={handleLoad}
          onError={handleError}
          loading={lazy ? 'lazy' : 'eager'}
        />
        
        {/* مؤشر التحميل */}
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="text-xs">
            {state === 'refreshing' ? 'جاري تجديد الرابط...' : 'جاري التحميل...'}
          </span>
        </div>
      </div>
    );
  }
  
  // حالة الخطأ
  if (state === 'error') {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    return (
      <div className={cn(
        "relative bg-muted/30 flex flex-col items-center justify-center gap-3 p-4",
        className
      )}>
        <ImageOff className="h-12 w-12 text-muted-foreground/50" />
        <span className="text-sm text-muted-foreground">تعذر تحميل الصورة</span>
        <button
          onClick={handleRetry}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <RefreshCw className="h-3 w-3" />
          إعادة المحاولة
        </button>
      </div>
    );
  }
  
  // حالة النجاح
  return (
    <img
      ref={imgRef}
      src={imageUrl}
      alt={alt}
      className={className}
      loading={lazy ? 'lazy' : 'eager'}
      onError={handleError}
    />
  );
}

// ============================================================================
// Batch Prefetch Utility
// ============================================================================

/**
 * تجديد روابط متعددة مسبقاً
 * يُستخدم عند فتح modal يحتوي على عدة صور
 */
export function usePrefetchS3Images() {
  const batchRefreshMutation = trpc.revenues.batchRefreshImageUrls.useMutation();
  
  const prefetch = useCallback(async (images: Array<{ url: string; key: string }>) => {
    // تصفية الصور التي تحتاج تجديد
    const keysToRefresh: string[] = [];
    
    for (const img of images) {
      const cached = getCachedUrl(img.key);
      if (!cached) {
        keysToRefresh.push(img.key);
      }
    }
    
    if (keysToRefresh.length === 0) return;
    
    try {
      const result = await batchRefreshMutation.mutateAsync({ s3Keys: keysToRefresh });
      
      // حفظ النتائج في الـ cache
      for (const item of result.urls) {
        if (item.url) {
          setCachedUrl(item.s3Key, item.url);
        }
      }
    } catch {
      // تجاهل الأخطاء - سيتم التجديد عند الحاجة
    }
  }, [batchRefreshMutation]);
  
  return { prefetch, isLoading: batchRefreshMutation.isPending };
}

export default S3Image;
