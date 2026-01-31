/**
 * مكون معاينة الصورة المتقدم مع Lightbox والتكبير
 * Advanced Image Preview Component with Lightbox and Zoom
 * 
 * الميزات:
 * - معاينة الصورة في نافذة منبثقة
 * - تكبير/تصغير الصورة (Zoom)
 * - سحب الصورة للتنقل (Pan)
 * - دعم اللمس للأجهزة المحمولة
 * - إشعارات عند مشاكل الصورة
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Download, 
  X, 
  Maximize2,
  Minimize2,
  AlertTriangle,
  CheckCircle,
  Clock,
  ImageOff,
  Move
} from "lucide-react";
import { cn } from "@/lib/utils";

// ==================== الأنواع ====================
export interface ImagePreviewProps {
  src: string;
  alt?: string;
  title?: string;
  isOpen: boolean;
  onClose: () => void;
  // معلومات التحقق من OCR
  ocrResult?: {
    confidence: "high" | "medium" | "low" | "none";
    extractedAmount?: number | null;
    extractedDate?: string | null;
    isMatched?: boolean;
    isDateMatched?: boolean;
    message?: string;
  };
  // إشعارات
  warnings?: string[];
}

export interface ImageThumbnailProps {
  src: string;
  alt?: string;
  onClick?: () => void;
  onRemove?: () => void;
  isUploading?: boolean;
  uploadProgress?: number;
  ocrStatus?: "pending" | "success" | "warning" | "error";
  ocrMessage?: string;
  className?: string;
}

// ==================== الثوابت ====================
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

// ==================== مكون Lightbox الرئيسي ====================
export function ImagePreviewLightbox({
  src,
  alt = "صورة",
  title = "معاينة الصورة",
  isOpen,
  onClose,
  ocrResult,
  warnings = []
}: ImagePreviewProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // إعادة تعيين الحالة عند فتح/إغلاق
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
      setImageLoaded(false);
      setImageError(false);
    }
  }, [isOpen]);

  // التكبير
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  }, []);

  const handleZoomChange = useCallback((value: number[]) => {
    setZoom(value[0]);
  }, []);

  // التدوير
  const handleRotate = useCallback(() => {
    setRotation(prev => (prev + 90) % 360);
  }, []);

  // إعادة التعيين
  const handleReset = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  }, []);

  // السحب للتنقل
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y
      };
    }
  }, [zoom, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      });
    }
  }, [isDragging, zoom]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // دعم اللمس
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (zoom > 1 && e.touches.length === 1) {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      };
    }
  }, [zoom, position]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isDragging && zoom > 1 && e.touches.length === 1) {
      setPosition({
        x: e.touches[0].clientX - dragStartRef.current.x,
        y: e.touches[0].clientY - dragStartRef.current.y
      });
    }
  }, [isDragging, zoom]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // تكبير بعجلة الماوس
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom(prev => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta)));
  }, []);

  // تحميل الصورة
  const handleDownload = useCallback(async () => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("فشل تحميل الصورة:", error);
    }
  }, [src]);

  // الحصول على لون حالة OCR
  const getOCRStatusColor = () => {
    if (!ocrResult) return "bg-muted";
    switch (ocrResult.confidence) {
      case "high": return "bg-green-500/20 text-green-500 border-green-500/30";
      case "medium": return "bg-yellow-500/20 text-yellow-500 border-yellow-500/30";
      case "low": return "bg-orange-500/20 text-orange-500 border-orange-500/30";
      case "none": return "bg-red-500/20 text-red-500 border-red-500/30";
    }
  };

  const getOCRStatusIcon = () => {
    if (!ocrResult) return null;
    switch (ocrResult.confidence) {
      case "high": return <CheckCircle className="h-4 w-4" />;
      case "medium": return <Clock className="h-4 w-4" />;
      case "low": 
      case "none": return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getConfidenceLabel = () => {
    if (!ocrResult) return "";
    switch (ocrResult.confidence) {
      case "high": return "دقة عالية";
      case "medium": return "دقة متوسطة";
      case "low": return "دقة منخفضة";
      case "none": return "لم تتم القراءة";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className={cn(
          "max-w-5xl w-[95vw] h-[90vh] p-0 gap-0 flex flex-col",
          isFullscreen && "max-w-none w-screen h-screen rounded-none"
        )}
      >
        {/* الهيدر */}
        <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-lg">{title}</DialogTitle>
              {ocrResult && (
                <Badge variant="outline" className={cn("gap-1", getOCRStatusColor())}>
                  {getOCRStatusIcon()}
                  {getConfidenceLabel()}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsFullscreen(!isFullscreen)}
                title={isFullscreen ? "تصغير" : "ملء الشاشة"}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <DialogDescription className="sr-only">
            معاينة الصورة مع إمكانية التكبير والتصغير
          </DialogDescription>
        </DialogHeader>

        {/* منطقة الصورة */}
        <div 
          ref={containerRef}
          className="flex-1 relative overflow-hidden bg-black/90 flex items-center justify-center"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
          style={{ cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
        >
          {imageError ? (
            <div className="flex flex-col items-center gap-4 text-white/70">
              <ImageOff className="h-16 w-16" />
              <p>فشل تحميل الصورة</p>
            </div>
          ) : (
            <>
              <img
                ref={imageRef}
                src={src}
                alt={alt}
                className={cn(
                  "max-w-full max-h-full object-contain transition-opacity duration-300",
                  !imageLoaded && "opacity-0"
                )}
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                  transition: isDragging ? "none" : "transform 0.2s ease-out"
                }}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
                draggable={false}
              />
              {!imageLoaded && !imageError && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-white/20 border-t-white"></div>
                </div>
              )}
            </>
          )}

          {/* مؤشر التكبير */}
          {zoom > 1 && (
            <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2">
              <Move className="h-4 w-4" />
              اسحب للتنقل
            </div>
          )}
        </div>

        {/* شريط التحكم */}
        <div className="px-4 py-3 border-t bg-background flex-shrink-0">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* أزرار التحكم */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handleZoomOut} disabled={zoom <= MIN_ZOOM}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <div className="w-32 px-2">
                <Slider
                  value={[zoom]}
                  min={MIN_ZOOM}
                  max={MAX_ZOOM}
                  step={ZOOM_STEP}
                  onValueChange={handleZoomChange}
                />
              </div>
              <Button variant="outline" size="icon" onClick={handleZoomIn} disabled={zoom >= MAX_ZOOM}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handleRotate}>
                <RotateCw className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset}>
                إعادة تعيين
              </Button>
              <Button variant="outline" size="icon" onClick={handleDownload}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* معلومات OCR والتحذيرات */}
          {(ocrResult || warnings.length > 0) && (
            <div className="mt-3 space-y-2">
              {/* نتيجة OCR */}
              {ocrResult && ocrResult.message && (
                <div className={cn(
                  "p-3 rounded-lg text-sm whitespace-pre-line",
                  ocrResult.isMatched && ocrResult.isDateMatched 
                    ? "bg-green-500/10 border border-green-500/20" 
                    : "bg-yellow-500/10 border border-yellow-500/20"
                )}>
                  {ocrResult.message}
                </div>
              )}

              {/* التحذيرات */}
              {warnings.length > 0 && (
                <div className="space-y-1">
                  {warnings.map((warning, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center gap-2 p-2 bg-orange-500/10 border border-orange-500/20 rounded-lg text-sm text-orange-600"
                    >
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      {warning}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==================== مكون الصورة المصغرة ====================
export function ImageThumbnail({
  src,
  alt = "صورة",
  onClick,
  onRemove,
  isUploading = false,
  uploadProgress = 0,
  ocrStatus,
  ocrMessage,
  className
}: ImageThumbnailProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const getStatusBadge = () => {
    if (isUploading) {
      return (
        <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 gap-1">
          <div className="animate-spin h-3 w-3 border-2 border-blue-400 border-t-transparent rounded-full" />
          جاري الرفع {uploadProgress > 0 && `${uploadProgress}%`}
        </Badge>
      );
    }

    switch (ocrStatus) {
      case "success":
        return (
          <Badge variant="secondary" className="bg-green-500/20 text-green-400 gap-1">
            <CheckCircle className="h-3 w-3" />
            تم التحقق
          </Badge>
        );
      case "warning":
        return (
          <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400 gap-1">
            <AlertTriangle className="h-3 w-3" />
            تحذير
          </Badge>
        );
      case "error":
        return (
          <Badge variant="secondary" className="bg-red-500/20 text-red-400 gap-1">
            <AlertTriangle className="h-3 w-3" />
            خطأ
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary" className="bg-gray-500/20 text-gray-400 gap-1">
            <Clock className="h-3 w-3" />
            قيد التحقق
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div 
      className={cn(
        "relative border rounded-lg overflow-hidden group cursor-pointer",
        "transition-all duration-200 hover:ring-2 hover:ring-primary/50",
        className
      )}
      onClick={onClick}
    >
      {/* الصورة */}
      <div className="relative w-full h-40 bg-muted">
        {imageError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
            <ImageOff className="h-8 w-8 mb-2" />
            <span className="text-xs">فشل التحميل</span>
          </div>
        ) : (
          <>
            <img
              src={src}
              alt={alt}
              className={cn(
                "w-full h-full object-contain transition-opacity duration-300",
                !imageLoaded && "opacity-0"
              )}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
            {!imageLoaded && !imageError && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-pulse bg-muted-foreground/20 w-full h-full" />
              </div>
            )}
          </>
        )}

        {/* شريط التقدم */}
        {isUploading && uploadProgress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
            <div 
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}
      </div>

      {/* أزرار التحكم */}
      <div className="absolute top-2 left-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {onRemove && (
          <Button
            size="icon"
            variant="destructive"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* شارة الحالة */}
      <div className="absolute bottom-2 right-2">
        {getStatusBadge()}
      </div>

      {/* رسالة OCR */}
      {ocrMessage && ocrStatus === "warning" && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6">
          <p className="text-xs text-yellow-300 line-clamp-2">{ocrMessage}</p>
        </div>
      )}
    </div>
  );
}

// ==================== تصدير افتراضي ====================
export default ImagePreviewLightbox;
