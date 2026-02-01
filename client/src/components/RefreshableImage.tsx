/**
 * مكون صورة قابلة للتجديد
 * يحاول تجديد رابط الصورة تلقائياً إذا فشل التحميل
 */

import { useState, useEffect, useCallback } from "react";
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
}

export function RefreshableImage({
  src,
  s3Key,
  alt = "صورة",
  className,
  containerClassName,
  onLoad,
  onError
}: RefreshableImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 2;

  const refreshMutation = trpc.revenues.refreshImageUrl.useMutation();

  // إعادة تعيين الحالة عند تغيير المصدر
  useEffect(() => {
    setCurrentSrc(src);
    setIsLoading(true);
    setHasError(false);
    setRetryCount(0);
  }, [src, s3Key]);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(async () => {
    // محاولة تجديد الرابط إذا لم نتجاوز الحد الأقصى
    if (retryCount < maxRetries && s3Key) {
      setRetryCount(prev => prev + 1);
      try {
        const result = await refreshMutation.mutateAsync({ key: s3Key });
        if (result.success && result.url) {
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
  }, [retryCount, s3Key, refreshMutation, onError]);

  const handleRetry = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    setRetryCount(0);
    
    if (s3Key) {
      try {
        const result = await refreshMutation.mutateAsync({ key: s3Key });
        if (result.success && result.url) {
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
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-lg">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
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
    </div>
  );
}

export default RefreshableImage;
