/**
 * مكون صورة قابلة للتجديد - محسّن للأداء v2.0
 * 
 * التحسينات:
 * 1. localStorage cache بدلاً من Map (يبقى بعد إعادة تحميل الصفحة)
 * 2. Image preloading بعد تجديد الرابط
 * 3. تجديد متوازي للروابط المتعددة
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { ImageOff, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RefreshableImageProps {
  src: string;
  s3Key: string;
  alt?: string;
  className?: string;
  containerClassName?: string;
  onLoad?: () => void;
  onError?: () => void;
  prefetchUrl?: boolean;
}

// ==================== Cache System ====================
const CACHE_KEY_PREFIX = "img_url_cache_";
const CACHE_TTL = 55 * 60 * 1000; // 55 دقيقة

interface CacheEntry {
  url: string;
  timestamp: number;
}

// Memory cache للوصول السريع
const memoryCache = new Map<string, CacheEntry>();

function getCachedUrl(s3Key: string): string | null {
  // التحقق من memory cache أولاً (أسرع)
  const memCached = memoryCache.get(s3Key);
  if (memCached && Date.now() - memCached.timestamp < CACHE_TTL) {
    return memCached.url;
  }

  // التحقق من localStorage
  try {
    const stored = localStorage.getItem(CACHE_KEY_PREFIX + s3Key);
    if (stored) {
      const entry: CacheEntry = JSON.parse(stored);
      if (Date.now() - entry.timestamp < CACHE_TTL) {
        // تحديث memory cache
        memoryCache.set(s3Key, entry);
        return entry.url;
      }
      // حذف الـ cache المنتهي
      localStorage.removeItem(CACHE_KEY_PREFIX + s3Key);
    }
  } catch (e) {
    // تجاهل أخطاء localStorage
  }

  return null;
}

function setCachedUrl(s3Key: string, url: string): void {
  const entry: CacheEntry = { url, timestamp: Date.now() };
  
  // حفظ في memory cache
  memoryCache.set(s3Key, entry);
  
  // حفظ في localStorage
  try {
    localStorage.setItem(CACHE_KEY_PREFIX + s3Key, JSON.stringify(entry));
  } catch (e) {
    // تجاهل أخطاء localStorage (ممتلئ)
  }
}

function clearCachedUrl(s3Key: string): void {
  memoryCache.delete(s3Key);
  try {
    localStorage.removeItem(CACHE_KEY_PREFIX + s3Key);
  } catch (e) {
    // تجاهل
  }
}

// ==================== Image Preloader ====================
const preloadedImages = new Set<string>();

function preloadImage(url: string): Promise<void> {
  if (preloadedImages.has(url)) return Promise.resolve();
  
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      preloadedImages.add(url);
      resolve();
    };
    img.onerror = () => resolve(); // لا نفشل إذا فشل التحميل المسبق
    img.src = url;
  });
}

// ==================== Main Component ====================
export function RefreshableImage({
  src,
  s3Key,
  alt = "صورة",
  className,
  containerClassName,
  onLoad,
  onError,
  prefetchUrl = true
}: RefreshableImageProps) {
  const [currentSrc, setCurrentSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const isMounted = useRef(true);
  const retryCount = useRef(0);

  const refreshMutation = trpc.revenues.refreshImageUrl.useMutation();

  // تحميل الصورة مع cache
  useEffect(() => {
    isMounted.current = true;
    retryCount.current = 0;
    setIsLoading(true);
    setHasError(false);

    const loadImage = async () => {
      // 1. التحقق من الـ cache
      const cachedUrl = getCachedUrl(s3Key);
      if (cachedUrl) {
        if (isMounted.current) {
          setCurrentSrc(cachedUrl);
        }
        return;
      }

      // 2. تجديد الرابط إذا لم يكن في الـ cache
      if (prefetchUrl && s3Key) {
        try {
          const result = await refreshMutation.mutateAsync({ key: s3Key });
          if (result.success && result.url && isMounted.current) {
            setCachedUrl(s3Key, result.url);
            // Preload الصورة
            preloadImage(result.url);
            setCurrentSrc(result.url);
            return;
          }
        } catch (error) {
          console.error("فشل تجديد رابط الصورة:", error);
        }
      }

      // 3. استخدام الرابط الأصلي كـ fallback
      if (isMounted.current) {
        setCurrentSrc(src);
      }
    };

    loadImage();

    return () => {
      isMounted.current = false;
    };
  }, [src, s3Key]);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(async () => {
    // محاولة واحدة فقط لتجديد الرابط
    if (retryCount.current < 1 && s3Key) {
      retryCount.current++;
      clearCachedUrl(s3Key);
      
      try {
        const result = await refreshMutation.mutateAsync({ key: s3Key });
        if (result.success && result.url) {
          setCachedUrl(s3Key, result.url);
          setCurrentSrc(result.url);
          return;
        }
      } catch (error) {
        console.error("فشل تجديد رابط الصورة:", error);
      }
    }
    
    setIsLoading(false);
    setHasError(true);
    onError?.();
  }, [s3Key, refreshMutation, onError]);

  const handleRetry = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    retryCount.current = 0;
    clearCachedUrl(s3Key);
    
    if (s3Key) {
      try {
        const result = await refreshMutation.mutateAsync({ key: s3Key });
        if (result.success && result.url) {
          setCachedUrl(s3Key, result.url);
          setCurrentSrc(result.url);
          return;
        }
      } catch (error) {
        console.error("فشل تجديد رابط الصورة:", error);
      }
    }
    
    setCurrentSrc(src + "?t=" + Date.now());
  }, [s3Key, src, refreshMutation]);

  if (hasError) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center gap-3 bg-muted/50 rounded-lg p-6",
        containerClassName
      )}>
        <ImageOff className="h-12 w-12 text-muted-foreground" />
        <p className="text-sm text-muted-foreground text-center">فشل تحميل الصورة</p>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRetry}
          disabled={refreshMutation.isPending}
          className="gap-2"
        >
          {refreshMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("relative", containerClassName)}>
      {(isLoading || !currentSrc) && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-lg">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      {currentSrc && (
        <img
          src={currentSrc}
          alt={alt}
          className={cn(
            "transition-opacity duration-300",
            isLoading && "opacity-0",
            className
          )}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
        />
      )}
    </div>
  );
}

// ==================== Batch Prefetch Hook ====================
export function usePrefetchImages() {
  const refreshMutation = trpc.revenues.refreshImageUrls.useMutation();
  
  const prefetch = useCallback(async (keys: string[]) => {
    // تصفية المفاتيح غير الموجودة في الـ cache
    const keysToRefresh = keys.filter(key => !getCachedUrl(key));
    
    if (keysToRefresh.length === 0) return;
    
    try {
      const result = await refreshMutation.mutateAsync({ keys: keysToRefresh });
      if (result.success && result.results) {
        // تجديد متوازي + preload
        const preloadPromises = result.results.map(async ({ key, url, success }) => {
          if (success && url) {
            setCachedUrl(key, url);
            await preloadImage(url);
          }
        });
        
        await Promise.all(preloadPromises);
      }
    } catch (error) {
      console.error("فشل تجديد روابط الصور:", error);
    }
  }, [refreshMutation]);
  
  return { prefetch, isPending: refreshMutation.isPending };
}

export default RefreshableImage;
