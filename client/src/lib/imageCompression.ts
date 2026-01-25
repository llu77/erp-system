/**
 * مكتبة ضغط الصور قبل الرفع
 * تقوم بتقليل حجم الصور مع الحفاظ على جودة مقبولة
 */

interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.8,
  mimeType: 'image/jpeg',
};

/**
 * ضغط صورة وتقليل حجمها
 * @param file - ملف الصورة الأصلي
 * @param options - خيارات الضغط
 * @returns Promise<string> - الصورة المضغوطة بصيغة Base64
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<{ base64: string; originalSize: number; compressedSize: number; compressionRatio: number }> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // حساب الأبعاد الجديدة مع الحفاظ على نسبة العرض إلى الارتفاع
        let { width, height } = img;
        const maxWidth = opts.maxWidth!;
        const maxHeight = opts.maxHeight!;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        
        // إنشاء canvas للضغط
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('فشل في إنشاء سياق الرسم'));
          return;
        }
        
        // رسم الصورة على الـ canvas
        ctx.drawImage(img, 0, 0, width, height);
        
        // تحويل إلى Base64 مع الضغط
        const base64 = canvas.toDataURL(opts.mimeType, opts.quality);
        
        // حساب الحجم المضغوط (تقريبي من Base64)
        const compressedSize = Math.round((base64.length * 3) / 4);
        const originalSize = file.size;
        const compressionRatio = Math.round((1 - compressedSize / originalSize) * 100);
        
        resolve({
          base64,
          originalSize,
          compressedSize,
          compressionRatio: Math.max(0, compressionRatio),
        });
      };
      
      img.onerror = () => {
        reject(new Error('فشل في تحميل الصورة'));
      };
      
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => {
      reject(new Error('فشل في قراءة الملف'));
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * التحقق مما إذا كان الملف صورة صالحة
 */
export function isValidImage(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  return validTypes.includes(file.type);
}

/**
 * تنسيق حجم الملف للعرض
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} كيلوبايت`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} ميجابايت`;
}

/**
 * ضغط صورة من الكاميرا مباشرة
 * يستخدم إعدادات محسنة للصور الملتقطة من الكاميرا
 */
export async function compressCameraImage(file: File): Promise<{
  base64: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}> {
  return compressImage(file, {
    maxWidth: 1280,
    maxHeight: 1280,
    quality: 0.75,
    mimeType: 'image/jpeg',
  });
}

/**
 * ضغط صورة وثيقة (جودة أعلى للحفاظ على وضوح النص)
 */
export async function compressDocumentImage(file: File): Promise<{
  base64: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}> {
  return compressImage(file, {
    maxWidth: 1600,
    maxHeight: 1600,
    quality: 0.85,
    mimeType: 'image/jpeg',
  });
}
