/**
 * BalanceImagesDialog Component - Enhanced Version
 * 
 * مكون محسّن لعرض صور الموازنة مع:
 * - دعم التحديث المسبق (Batch Prefetch)
 * - حالات تحميل واضحة
 * - تصميم متجاوب للموبايل والويب
 * - معالجة أخطاء محسّنة
 * 
 * @version 2.0.0
 */

import { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ImageIcon, Loader2, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { S3Image, usePrefetchS3Images, getCachedUrl } from './S3Image';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface BalanceImage {
  url: string;
  key: string;
  uploadedAt?: string;
}

interface BalanceImagesDialogProps {
  /** صور الموازنة */
  images: BalanceImage[];
  /** تاريخ الإيراد */
  date: Date | string;
  /** CSS classes إضافية للزر */
  triggerClassName?: string;
  /** عرض الصور في وضع gallery */
  galleryMode?: boolean;
}

type PrefetchStatus = 'idle' | 'loading' | 'success' | 'partial' | 'error';

// ============================================================================
// Component
// ============================================================================

export function BalanceImagesDialog({ 
  images, 
  date,
  triggerClassName,
  galleryMode = false,
}: BalanceImagesDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [prefetchStatus, setPrefetchStatus] = useState<PrefetchStatus>('idle');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const { prefetch, isLoading: isPrefetchLoading } = usePrefetchS3Images();
  
  // التحقق من الصور المخزنة مؤقتاً
  const [cachedCount, setCachedCount] = useState(0);
  
  useEffect(() => {
    if (images && images.length > 0) {
      let count = 0;
      for (const img of images) {
        if (getCachedUrl(img.key)) {
          count++;
        }
      }
      setCachedCount(count);
    }
  }, [images]);
  
  /**
   * تجديد الروابط مسبقاً عند فتح الـ modal
   */
  const handleOpenChange = useCallback(async (open: boolean) => {
    setIsOpen(open);
    setCurrentImageIndex(0);
    
    if (open && images.length > 0) {
      setPrefetchStatus('loading');
      try {
        await prefetch(images);
        
        // التحقق من نجاح التجديد
        let successCount = 0;
        for (const img of images) {
          if (getCachedUrl(img.key)) {
            successCount++;
          }
        }
        
        if (successCount === images.length) {
          setPrefetchStatus('success');
        } else if (successCount > 0) {
          setPrefetchStatus('partial');
        } else {
          setPrefetchStatus('error');
        }
      } catch {
        setPrefetchStatus('error');
      }
    } else {
      setPrefetchStatus('idle');
    }
  }, [images, prefetch]);
  
  // تنسيق التاريخ
  const formattedDate = typeof date === 'string' 
    ? format(new Date(date), "d MMMM yyyy", { locale: ar })
    : format(date, "d MMMM yyyy", { locale: ar });
  
  // التنقل بين الصور في وضع gallery
  const goToNext = useCallback(() => {
    setCurrentImageIndex(prev => (prev + 1) % images.length);
  }, [images.length]);
  
  const goToPrev = useCallback(() => {
    setCurrentImageIndex(prev => (prev - 1 + images.length) % images.length);
  }, [images.length]);
  
  // معالجة مفاتيح لوحة المفاتيح
  useEffect(() => {
    if (!isOpen || !galleryMode) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goToPrev();
      if (e.key === 'ArrowLeft') goToNext();
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, galleryMode, goToNext, goToPrev]);
  
  // إذا لم تكن هناك صور
  if (!images || images.length === 0) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }
  
  // مؤشر حالة التجديد
  const StatusIndicator = () => {
    if (prefetchStatus === 'idle') return null;
    
    return (
      <span className={cn(
        "flex items-center gap-1.5 text-xs font-normal px-2 py-1 rounded-full",
        prefetchStatus === 'loading' && "bg-primary/10 text-primary",
        prefetchStatus === 'success' && "bg-green-500/10 text-green-600",
        prefetchStatus === 'partial' && "bg-amber-500/10 text-amber-600",
        prefetchStatus === 'error' && "bg-red-500/10 text-red-600",
      )}>
        {prefetchStatus === 'loading' && (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            جاري تحديث الروابط...
          </>
        )}
        {prefetchStatus === 'success' && (
          <>
            <CheckCircle2 className="h-3 w-3" />
            تم التحديث
          </>
        )}
        {prefetchStatus === 'partial' && (
          <>
            <AlertCircle className="h-3 w-3" />
            تحديث جزئي
          </>
        )}
        {prefetchStatus === 'error' && (
          <>
            <AlertCircle className="h-3 w-3" />
            فشل التحديث
          </>
        )}
      </span>
    );
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className={cn(
            "gap-1.5 h-8 px-2 hover:bg-primary/10",
            triggerClassName
          )}
        >
          <ImageIcon className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium">عرض ({images.length})</span>
          {cachedCount > 0 && cachedCount < images.length && (
            <span className="text-[10px] text-muted-foreground">
              ({cachedCount} مخزن)
            </span>
          )}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between gap-2 flex-wrap">
            <span className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              صور الموازنة - {formattedDate}
            </span>
            <StatusIndicator />
          </DialogTitle>
        </DialogHeader>
        
        {/* محتوى الصور */}
        <div className="flex-1 overflow-y-auto mt-4 space-y-4">
          {galleryMode ? (
            // وضع Gallery - صورة واحدة مع تنقل
            <div className="relative">
              <div className="relative min-h-[400px] bg-muted/20 rounded-lg overflow-hidden">
                <S3Image
                  src={images[currentImageIndex].url}
                  s3Key={images[currentImageIndex].key}
                  alt={`صورة الموازنة ${currentImageIndex + 1}`}
                  className="w-full h-auto max-h-[60vh] object-contain"
                  lazy={false}
                  minHeight={400}
                />
              </div>
              
              {/* أزرار التنقل */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={goToPrev}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-background/80 hover:bg-background rounded-full shadow-lg transition-colors"
                    aria-label="الصورة السابقة"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                  <button
                    onClick={goToNext}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-background/80 hover:bg-background rounded-full shadow-lg transition-colors"
                    aria-label="الصورة التالية"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                </>
              )}
              
              {/* مؤشر الصور */}
              {images.length > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                  {images.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      className={cn(
                        "w-2.5 h-2.5 rounded-full transition-colors",
                        idx === currentImageIndex 
                          ? "bg-primary" 
                          : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                      )}
                      aria-label={`الصورة ${idx + 1}`}
                    />
                  ))}
                </div>
              )}
              
              {/* معلومات الصورة */}
              {images[currentImageIndex].uploadedAt && (
                <div className="text-center mt-3 text-xs text-muted-foreground">
                  تم الرفع: {format(new Date(images[currentImageIndex].uploadedAt), "d MMMM yyyy - h:mm a", { locale: ar })}
                </div>
              )}
            </div>
          ) : (
            // وضع القائمة - جميع الصور
            images.map((img, idx) => (
              <div 
                key={img.key || idx} 
                className="border rounded-lg overflow-hidden bg-muted/10"
              >
                {/* رقم الصورة */}
                <div className="px-3 py-2 bg-muted/30 border-b flex items-center justify-between">
                  <span className="text-sm font-medium">
                    صورة {idx + 1} من {images.length}
                  </span>
                  {img.uploadedAt && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(img.uploadedAt), "d MMMM yyyy - h:mm a", { locale: ar })}
                    </span>
                  )}
                </div>
                
                {/* الصورة */}
                <div className="p-2">
                  <S3Image
                    src={img.url}
                    s3Key={img.key}
                    alt={`صورة الموازنة ${idx + 1}`}
                    className="w-full h-auto max-h-[60vh] object-contain rounded"
                    lazy={false}
                    minHeight={300}
                  />
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* شريط المعلومات السفلي */}
        <div className="flex-shrink-0 pt-4 border-t mt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>إجمالي الصور: {images.length}</span>
            {galleryMode && images.length > 1 && (
              <span>استخدم الأسهم للتنقل</span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default BalanceImagesDialog;
