/**
 * مكون صورة قابلة للتجديد - محسّن للأداء
 * يجدد الرابط مسبقاً عند التحميل لتجنب التأخير
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
  // تجديد الرابط مسبقاً عند التحميل (افتراضي: true)
  prefetchUrl?: boolean;
}

// Cache للروابط المجددة لتجنب الطلبات المتكررة
const urlCache = new Map<string, { url: string; timestamp: number }>();
const CACHE_TTL = 55 * 60 * 1000; // 55 دقيقة (أقل من صلاحية S3 URL)

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

  const refreshMutation = trpc.revenues.refreshImageUrl.useMutation();

  // التحقق من الـ cache أو تجديد الرابط
  const getValidUrl = useCallback(async (): Promise<string> => {
    // التحقق من الـ cache أولاً
    const cached = urlCache.get(s3Key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.url;
    }

    // تجديد الرابط إذا كان prefetchUrl مفعّل
    if (prefetchUrl && s3Key) {
      try {
        const result = await refreshMutation.mutateAsync({ key: s3Key });
        if (result.success && result.url) {
          // حفظ في الـ cache
          urlCache.set(s3Key, { url: result.url, timestamp: Date.now() });
          return result.url;
        }
      } catch (error) {
        console.error("فشل تجديد رابط الصورة:", error);
      }
    }

    // استخدام الرابط الأصلي كـ fallback
    return src;
  }, [s3Key, src, prefetchUrl, refreshMutation]);

  // تحميل الصورة عند mount أو تغيير المصدر
  useEffect(() => {
    isMounted.current = true;
    setIsLoading(true);
    setHasError(false);
    setCurrentSrc(null);

    getValidUrl().then((url) => {
      if (isMounted.current) {
        setCurrentSrc(url);
      }
    });

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
    // محاولة تجديد الرابط مرة أخرى
    if (s3Key) {
      try {
        // إزالة من الـ cache لإجبار التجديد
        urlCache.delete(s3Key);
        const result = await refreshMutation.mutateAsync({ key: s3Key });
        if (result.success && result.url) {
          urlCache.set(s3Key, { url: result.url, timestamp: Date.now() });
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
    
    // إزالة من الـ cache
    urlCache.delete(s3Key);
    
    if (s3Key) {
      try {
        const result = await refreshMutation.mutateAsync({ key: s3Key });
        if (result.success && result.url) {
          urlCache.set(s3Key, { url: result.url, timestamp: Date.now() });
          setCurrentSrc(result.url);
          return;
        }
      } catch (error) {
        console.error("فشل تجديد رابط الصورة:", error);
      }
    }
    
    // إعادة تحميل الصورة الأصلية
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
        />
      )}
    </div>
  );
}

// دالة مساعدة لتجديد روابط متعددة مسبقاً (للاستخدام قبل فتح modal)
export function usePrefetchImages() {
  const refreshMutation = trpc.revenues.refreshImageUrls.useMutation();
  
  const prefetch = useCallback(async (keys: string[]) => {
    // تصفية المفاتيح الموجودة في الـ cache
    const keysToRefresh = keys.filter(key => {
      const cached = urlCache.get(key);
      return !cached || Date.now() - cached.timestamp >= CACHE_TTL;
    });
    
    if (keysToRefresh.length === 0) return;
    
    try {
      const result = await refreshMutation.mutateAsync({ keys: keysToRefresh });
      if (result.success && result.results) {
        result.results.forEach(({ key, url, success }) => {
          if (success && url) {
            urlCache.set(key, { url, timestamp: Date.now() });
          }
        });
      }
    } catch (error) {
      console.error("فشل تجديد روابط الصور:", error);
    }
  }, [refreshMutation]);
  
  return { prefetch, isPending: refreshMutation.isPending };
}

export default RefreshableImage;
