/**
 * مكون التقاط الصورة من الكاميرا
 * Camera Capture Component
 * 
 * يتيح للمستخدم التقاط صورة مباشرة من كاميرا الهاتف
 * مع دعم الكاميرا الخلفية والأمامية
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, X, RotateCcw, Check, SwitchCamera, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { evaluateImageQuality, getQualityColor, type ImageQualityResult } from "@/utils/imageCompression";

// ==================== الأنواع ====================

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

type FacingMode = "user" | "environment";

// ==================== المكون الرئيسي ====================

export function CameraCapture({ onCapture, onClose, isOpen }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<FacingMode>("environment");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageQuality, setImageQuality] = useState<ImageQualityResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // التحقق من وجود كاميرات متعددة
  const checkMultipleCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === "videoinput");
      setHasMultipleCameras(videoDevices.length > 1);
    } catch {
      setHasMultipleCameras(false);
    }
  }, []);

  // بدء تشغيل الكاميرا
  const startCamera = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    // إيقاف الكاميرا السابقة إن وجدت
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    try {
      // التحقق من دعم الكاميرا
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("المتصفح لا يدعم الوصول إلى الكاميرا");
      }

      // طلب إذن الكاميرا
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsLoading(false);
    } catch (err) {
      console.error("خطأ في تشغيل الكاميرا:", err);
      
      let errorMessage = "فشل الوصول إلى الكاميرا";
      
      if (err instanceof Error) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          errorMessage = "تم رفض إذن الكاميرا. يرجى السماح بالوصول إلى الكاميرا من إعدادات المتصفح.";
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          errorMessage = "لم يتم العثور على كاميرا. تأكد من توصيل الكاميرا.";
        } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
          errorMessage = "الكاميرا مستخدمة من تطبيق آخر. أغلق التطبيقات الأخرى وحاول مجدداً.";
        } else if (err.name === "OverconstrainedError") {
          errorMessage = "الكاميرا لا تدعم الإعدادات المطلوبة.";
        }
      }
      
      setError(errorMessage);
      setIsLoading(false);
    }
  }, [facingMode]);

  // إيقاف الكاميرا
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // التقاط الصورة
  const captureImage = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return;

    // ضبط أبعاد الـ canvas
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // رسم الإطار الحالي
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // تحويل إلى base64
    const imageData = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedImage(imageData);
    
    // إيقاف الكاميرا بعد الالتقاط
    stopCamera();
    
    // تحليل جودة الصورة
    setIsAnalyzing(true);
    evaluateImageQuality(imageData).then(quality => {
      setImageQuality(quality);
      setIsAnalyzing(false);
    }).catch(() => {
      setIsAnalyzing(false);
    });
  }, [stopCamera]);

  // إعادة التقاط
  const retakeImage = useCallback(() => {
    setCapturedImage(null);
    setImageQuality(null);
    startCamera();
  }, [startCamera]);

  // تأكيد الصورة
  const confirmImage = useCallback(() => {
    if (capturedImage) {
      onCapture(capturedImage);
      setCapturedImage(null);
      stopCamera();
      onClose();
    }
  }, [capturedImage, onCapture, stopCamera, onClose]);

  // تبديل الكاميرا
  const switchCamera = useCallback(() => {
    setFacingMode(prev => prev === "environment" ? "user" : "environment");
  }, []);

  // تأثير لبدء الكاميرا عند فتح النافذة
  useEffect(() => {
    if (isOpen && !capturedImage) {
      checkMultipleCameras();
      startCamera();
    }
    
    return () => {
      if (!isOpen) {
        stopCamera();
        setCapturedImage(null);
        setError(null);
      }
    };
  }, [isOpen, capturedImage, checkMultipleCameras, startCamera, stopCamera]);

  // تأثير لإعادة تشغيل الكاميرا عند تغيير الوضع
  useEffect(() => {
    if (isOpen && !capturedImage && !isLoading) {
      startCamera();
    }
  }, [facingMode]);

  // إغلاق النافذة
  const handleClose = useCallback(() => {
    stopCamera();
    setCapturedImage(null);
    setError(null);
    onClose();
  }, [stopCamera, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            التقاط صورة الإيصال
          </DialogTitle>
        </DialogHeader>

        <div className="relative bg-black aspect-[4/3] overflow-hidden">
          {/* حالة التحميل */}
          {isLoading && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black text-white">
              <Loader2 className="h-10 w-10 animate-spin mb-4" />
              <p>جاري تشغيل الكاميرا...</p>
            </div>
          )}

          {/* حالة الخطأ */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black text-white p-6 text-center">
              <X className="h-12 w-12 text-red-500 mb-4" />
              <p className="text-red-400 mb-4">{error}</p>
              <Button variant="outline" onClick={startCamera}>
                إعادة المحاولة
              </Button>
            </div>
          )}

          {/* عرض الفيديو */}
          {!capturedImage && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${isLoading || error ? "hidden" : ""}`}
            />
          )}

          {/* عرض الصورة الملتقطة */}
          {capturedImage && (
            <img
              src={capturedImage}
              alt="الصورة الملتقطة"
              className="w-full h-full object-contain"
            />
          )}

          {/* Canvas مخفي للالتقاط */}
          <canvas ref={canvasRef} className="hidden" />

          {/* إطار التوجيه المتقدم */}
          {!capturedImage && !isLoading && !error && (
            <>
              {/* الإطار الخارجي */}
              <div className="absolute inset-4 border-2 border-white/30 rounded-lg pointer-events-none">
                {/* زوايا الإطار */}
                <div className="absolute -top-1 -left-1 w-10 h-10 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-10 h-10 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-10 h-10 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-10 h-10 border-b-4 border-r-4 border-primary rounded-br-lg" />
                
                {/* خطوط التوجيه الوسطى */}
                <div className="absolute top-1/2 left-0 right-0 h-px bg-white/20" />
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
              </div>
              
              {/* نص التوجيه */}
              <div className="absolute top-6 left-0 right-0 text-center">
                <span className="bg-black/60 text-white text-sm px-3 py-1 rounded-full">
                  ضع الإيصال داخل الإطار
                </span>
              </div>
              
              {/* أيقونة الإيصال المرجعية */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-32 h-48 border-2 border-dashed border-white/30 rounded-lg flex flex-col items-center justify-center">
                  <svg className="w-12 h-12 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-white/40 text-xs mt-2">إيصال POS</span>
                </div>
              </div>
            </>
          )}
          
          {/* مؤشر جودة الصورة */}
          {capturedImage && imageQuality && !isAnalyzing && (
            <div className="absolute bottom-4 left-4 right-4 bg-black/80 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {imageQuality.isAcceptableForOCR ? (
                    <CheckCircle2 className="h-5 w-5" style={{ color: getQualityColor(imageQuality.score) }} />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                  <span className="text-white font-medium">جودة الصورة: {imageQuality.levelAr}</span>
                </div>
                <span 
                  className="text-lg font-bold" 
                  style={{ color: getQualityColor(imageQuality.score) }}
                >
                  {imageQuality.score}%
                </span>
              </div>
              
              {/* شريط التقدم */}
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-2">
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${imageQuality.score}%`,
                    backgroundColor: getQualityColor(imageQuality.score)
                  }}
                />
              </div>
              
              {/* التفاصيل */}
              <div className="grid grid-cols-4 gap-2 text-xs text-gray-400 mb-2">
                <div className="text-center">
                  <div className="text-white">{imageQuality.details.brightness}%</div>
                  <div>الإضاءة</div>
                </div>
                <div className="text-center">
                  <div className="text-white">{imageQuality.details.contrast}%</div>
                  <div>التباين</div>
                </div>
                <div className="text-center">
                  <div className="text-white">{imageQuality.details.sharpness}%</div>
                  <div>الحدة</div>
                </div>
                <div className="text-center">
                  <div className="text-white">{imageQuality.details.resolution}%</div>
                  <div>الدقة</div>
                </div>
              </div>
              
              {/* الاقتراحات */}
              {imageQuality.suggestions.length > 0 && (
                <div className="text-xs text-yellow-400">
                  لنتيجة أفضل: {imageQuality.suggestions[0]}
                </div>
              )}
            </div>
          )}
          
          {/* حالة التحليل */}
          {capturedImage && isAnalyzing && (
            <div className="absolute bottom-4 left-4 right-4 bg-black/80 rounded-lg p-3 flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-white">جاري تحليل جودة الصورة...</span>
            </div>
          )}
        </div>

        {/* أزرار التحكم */}
        <div className="p-4 flex items-center justify-center gap-4 bg-background">
          {!capturedImage ? (
            <>
              {/* زر الإغلاق */}
              <Button
                variant="outline"
                size="icon"
                onClick={handleClose}
                className="h-12 w-12 rounded-full"
              >
                <X className="h-6 w-6" />
              </Button>

              {/* زر الالتقاط */}
              <Button
                size="icon"
                onClick={captureImage}
                disabled={isLoading || !!error}
                className="h-16 w-16 rounded-full bg-primary hover:bg-primary/90"
              >
                <div className="h-12 w-12 rounded-full border-4 border-white" />
              </Button>

              {/* زر تبديل الكاميرا */}
              {hasMultipleCameras && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={switchCamera}
                  disabled={isLoading}
                  className="h-12 w-12 rounded-full"
                >
                  <SwitchCamera className="h-6 w-6" />
                </Button>
              )}
            </>
          ) : (
            <>
              {/* زر إعادة الالتقاط */}
              <Button
                variant="outline"
                onClick={retakeImage}
                className="gap-2"
              >
                <RotateCcw className="h-5 w-5" />
                إعادة الالتقاط
              </Button>

              {/* زر التأكيد */}
              <Button
                onClick={confirmImage}
                className="gap-2"
              >
                <Check className="h-5 w-5" />
                استخدام الصورة
              </Button>
            </>
          )}
        </div>

        {/* نصائح للمستخدم */}
        {!capturedImage && !isLoading && !error && (
          <div className="px-4 pb-4 space-y-2">
            <div className="text-center text-sm text-muted-foreground">
              وجّه الكاميرا نحو إيصال نقطة البيع (POS) وتأكد من وضوح الأرقام
            </div>
            <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
              <span className="bg-muted px-2 py-1 rounded">إضاءة جيدة</span>
              <span className="bg-muted px-2 py-1 rounded">ثبّت الهاتف</span>
              <span className="bg-muted px-2 py-1 rounded">اقترب من الإيصال</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default CameraCapture;
