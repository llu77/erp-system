/**
 * S3Image Component - Enhanced Version
 * 
 * مكون محسّن لعرض الصور من S3 مع:
 * - تجديد تلقائي للروابط المنتهية
 * - تخزين مؤقت في localStorage
 * - حالات تحميل واضحة مع skeleton
 * - timeout للتجديد لمنع التعليق
 * - دعم aspect-ratio للحفاظ على الأبعاد
 * 
 * @version 2.0.0
 * @author ERP System
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { Loader2, ImageOff, RefreshCw, AlertCircle } from 'lucide-react';
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
  /** الحد الأدنى للارتفاع (بالبكسل) */
  minHeight?: number;
  /** نسبة العرض إلى الارتفاع (مثل "16/9" أو "4/3") */
  aspectRatio?: string;
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

/** timeout للتجديد بالمللي ثانية (10 ثواني) */
const REFRESH_TIMEOUT_MS = 10000;

/** الحد الأدنى الافتراضي للارتفاع */
const DEFAULT_MIN_HEIGHT = 200;

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
export function getCachedUrl(s3Key: string): string | null {
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

type ImageState = 'loading' | 'loaded' | 'error' | 'refreshing' | 'timeout';

export function S3Image({
  src,
  s3Key,
  alt,
  className,
  fallback,
  lazy = true,
  onLoad,
  onError,
  minHeight = DEFAULT_MIN_HEIGHT,
  aspectRatio,
}: S3ImageProps) {
  // State
  const [imageUrl, setImageUrl] = useState<string>(() => {
    // التحقق من الـ cache أولاً
    const cached = getCachedUrl(s3Key);
    return cached || src;
  });
  const [state, setState] = useState<ImageState>('loading');
  const [refreshAttempts, setRefreshAttempts] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Refs
  const imgRef = useRef<HTMLImageElement>(null);
  const isMounted = useRef(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // tRPC mutation للتجديد
  const refreshMutation = trpc.revenues.refreshImageUrl.useMutation({
    onSuccess: (data) => {
      if (!isMounted.current) return;
      
      // إلغاء الـ timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      if (data.url) {
        // حفظ في الـ cache
        setCachedUrl(s3Key, data.url);
        setImageUrl(data.url);
        setState('loading');
        setErrorMessage('');
      } else {
        setState('error');
        setErrorMessage('لم يتم الحصول على رابط جديد');
        onError?.();
      }
    },
    onError: (error) => {
      if (!isMounted.current) return;
      
      // إلغاء الـ timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      setState('error');
      setErrorMessage(error.message || 'فشل تجديد الرابط');
      onError?.();
    },
  });
  
  // Cleanup
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  /**
   * معالجة نجاح تحميل الصورة
   */
  const handleLoad = useCallback(() => {
    if (!isMounted.current) return;
    setState('loaded');
    setRefreshAttempts(0);
    setErrorMessage('');
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
      
      // إضافة timeout للتجديد
      timeoutRef.current = setTimeout(() => {
        if (isMounted.current) {
          setState('timeout');
          setErrorMessage('انتهت مهلة تجديد الرابط');
        }
      }, REFRESH_TIMEOUT_MS);
      
      refreshMutation.mutate({ s3Key });
    } else {
      setState('error');
      setErrorMessage('فشل تحميل الصورة بعد عدة محاولات');
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
    setErrorMessage('');
    
    // إضافة timeout للتجديد
    timeoutRef.current = setTimeout(() => {
      if (isMounted.current) {
        setState('timeout');
        setErrorMessage('انتهت مهلة تجديد الرابط');
      }
    }, REFRESH_TIMEOUT_MS);
    
    refreshMutation.mutate({ s3Key });
  }, [s3Key, refreshMutation]);
  
  // ============================================================================
  // Styles
  // ============================================================================
  
  const containerStyle: React.CSSProperties = {
    minHeight: `${minHeight}px`,
    ...(aspectRatio && { aspectRatio }),
  };
  
  // ============================================================================
  // Render
  // ============================================================================
  
  // حالة التحميل أو التجديد
  if (state === 'loading' || state === 'refreshing') {
    return (
      <div 
        className={cn(
          "relative bg-muted/30 flex items-center justify-center rounded-lg overflow-hidden",
          className
        )}
        style={containerStyle}
      >
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
        
        {/* مؤشر التحميل مع skeleton */}
        <div className="flex flex-col items-center gap-3 text-muted-foreground p-6">
          <div className="relative">
            <Loader2 className="h-10 w-10 animate-spin text-primary/60" />
          </div>
          <span className="text-sm font-medium">
            {state === 'refreshing' ? 'جاري تجديد الرابط...' : 'جاري التحميل...'}
          </span>
          {state === 'refreshing' && (
            <span className="text-xs text-muted-foreground/70">
              المحاولة {refreshAttempts} من {MAX_REFRESH_ATTEMPTS}
            </span>
          )}
        </div>
        
        {/* Skeleton overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-muted/20 via-muted/40 to-muted/20 animate-pulse" />
      </div>
    );
  }
  
  // حالة الخطأ أو انتهاء المهلة
  if (state === 'error' || state === 'timeout') {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    return (
      <div 
        className={cn(
          "relative bg-muted/20 flex flex-col items-center justify-center gap-4 p-6 rounded-lg border border-dashed border-muted-foreground/30",
          className
        )}
        style={containerStyle}
      >
        {state === 'timeout' ? (
          <AlertCircle className="h-12 w-12 text-amber-500/70" />
        ) : (
          <ImageOff className="h-12 w-12 text-muted-foreground/50" />
        )}
        
        <div className="text-center space-y-1">
          <span className="text-sm font-medium text-muted-foreground">
            {state === 'timeout' ? 'انتهت مهلة التحميل' : 'تعذر تحميل الصورة'}
          </span>
          {errorMessage && (
            <p className="text-xs text-muted-foreground/70 max-w-[200px]">
              {errorMessage}
            </p>
          )}
        </div>
        
        <button
          onClick={handleRetry}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
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
      className={cn("rounded-lg", className)}
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
