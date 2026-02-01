/**
 * BalanceImagesDialog Component
 * 
 * مكون لعرض صور الموازنة مع دعم التحديث المسبق (Batch Prefetch)
 * لتحسين تجربة المستخدم عند فتح modal الصور.
 * 
 * @version 1.0.0
 */

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ImageIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { S3Image, usePrefetchS3Images } from './S3Image';

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
}

// ============================================================================
// Component
// ============================================================================

export function BalanceImagesDialog({ 
  images, 
  date,
  triggerClassName 
}: BalanceImagesDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPrefetching, setIsPrefetching] = useState(false);
  const { prefetch, isLoading: isPrefetchLoading } = usePrefetchS3Images();
  
  /**
   * تجديد الروابط مسبقاً عند فتح الـ modal
   */
  const handleOpenChange = useCallback(async (open: boolean) => {
    setIsOpen(open);
    
    if (open && images.length > 0) {
      setIsPrefetching(true);
      try {
        await prefetch(images);
      } finally {
        setIsPrefetching(false);
      }
    }
  }, [images, prefetch]);
  
  // تنسيق التاريخ
  const formattedDate = typeof date === 'string' 
    ? format(new Date(date), "d MMMM yyyy", { locale: ar })
    : format(date, "d MMMM yyyy", { locale: ar });
  
  if (!images || images.length === 0) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className={triggerClassName || "gap-1 h-8 px-2"}
        >
          <ImageIcon className="h-4 w-4 text-primary" />
          <span className="text-xs">عرض ({images.length})</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            صور الموازنة - {formattedDate}
            {(isPrefetching || isPrefetchLoading) && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground font-normal">
                <Loader2 className="h-3 w-3 animate-spin" />
                جاري تحديث الروابط...
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          {images.map((img, idx) => (
            <div 
              key={img.key || idx} 
              className="border rounded-lg overflow-hidden bg-muted/20"
            >
              <S3Image
                src={img.url}
                s3Key={img.key}
                alt={`صورة الموازنة ${idx + 1}`}
                className="w-full h-auto max-h-[70vh] object-contain"
                lazy={false} // تحميل فوري لأن الروابط تم تجديدها مسبقاً
              />
              {img.uploadedAt && (
                <div className="px-3 py-2 bg-muted/50 text-xs text-muted-foreground border-t">
                  تم الرفع: {format(new Date(img.uploadedAt), "d MMMM yyyy - h:mm a", { locale: ar })}
                </div>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default BalanceImagesDialog;
