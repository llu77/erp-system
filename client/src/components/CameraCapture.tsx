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
import { Camera, X, RotateCcw, Check, SwitchCamera, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
  }, [stopCamera]);

  // إعادة التقاط
  const retakeImage = useCallback(() => {
    setCapturedImage(null);
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

          {/* إطار التوجيه */}
          {!capturedImage && !isLoading && !error && (
            <div className="absolute inset-4 border-2 border-white/50 rounded-lg pointer-events-none">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
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

        {/* نصيحة للمستخدم */}
        {!capturedImage && !isLoading && !error && (
          <div className="px-4 pb-4 text-center text-sm text-muted-foreground">
            وجّه الكاميرا نحو إيصال نقطة البيع (POS) وتأكد من وضوح الأرقام
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default CameraCapture;
