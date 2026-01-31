/**
 * خدمة ضغط وتحسين الصور قبل الرفع
 * Image Compression and Enhancement Service
 * 
 * تقوم بـ:
 * 1. ضغط الصورة لتقليل حجمها
 * 2. تحسين الجودة للقراءة OCR
 * 3. تصحيح الاتجاه تلقائياً
 * 4. تحسين التباين والوضوح
 */

// ==================== الأنواع ====================

export interface ImageCompressionOptions {
  maxWidth?: number;        // الحد الأقصى للعرض (افتراضي: 1920)
  maxHeight?: number;       // الحد الأقصى للارتفاع (افتراضي: 1920)
  quality?: number;         // جودة الضغط 0-1 (افتراضي: 0.85)
  maxSizeKB?: number;       // الحد الأقصى للحجم بالكيلوبايت (افتراضي: 500)
  enhanceForOCR?: boolean;  // تحسين للقراءة OCR (افتراضي: true)
  outputFormat?: 'jpeg' | 'png' | 'webp'; // صيغة الإخراج (افتراضي: jpeg)
}

export interface CompressionResult {
  success: boolean;
  base64Data: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  width: number;
  height: number;
  format: string;
  error?: string;
  enhancements?: string[];
}

// ==================== الثوابت ====================

const DEFAULT_OPTIONS: Required<ImageCompressionOptions> = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.85,
  maxSizeKB: 500,
  enhanceForOCR: true,
  outputFormat: 'jpeg'
};

// ==================== الدوال المساعدة ====================

/**
 * تحميل الصورة من base64 أو URL
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('فشل تحميل الصورة'));
    img.src = src;
  });
}

/**
 * حساب الأبعاد الجديدة مع الحفاظ على النسبة
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let width = originalWidth;
  let height = originalHeight;

  // تقليص إذا كان أكبر من الحد الأقصى
  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }

  if (height > maxHeight) {
    width = Math.round((width * maxHeight) / height);
    height = maxHeight;
  }

  return { width, height };
}

/**
 * تحسين الصورة للقراءة OCR
 * - زيادة التباين والإضاءة
 * - تحسين الحدة والوضوح
 * - تطبيق تصحيح الألوان التلقائي
 */
function enhanceImageForOCR(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): string[] {
  const enhancements: string[] = [];
  
  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // تحليل الصورة لتحديد ما إذا كانت تحتاج تحسين
    let totalBrightness = 0;
    let minBrightness = 255;
    let maxBrightness = 0;
    const pixelCount = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      totalBrightness += brightness;
      minBrightness = Math.min(minBrightness, brightness);
      maxBrightness = Math.max(maxBrightness, brightness);
    }

    const avgBrightness = totalBrightness / pixelCount;
    const dynamicRange = maxBrightness - minBrightness;

    // === تحسين الإضاءة المتقدم ===
    // إذا كانت الصورة داكنة جداً (متوسط السطوع < 120)
    if (avgBrightness < 120) {
      // حساب معامل التصحيح التلقائي
      const targetBrightness = 140;
      const brightnessFactor = Math.min(1.5, targetBrightness / avgBrightness);
      
      for (let i = 0; i < data.length; i += 4) {
        // تطبيق تصحيح gamma للحصول على إضاءة طبيعية
        data[i] = clamp(Math.pow(data[i] / 255, 0.85) * 255 * brightnessFactor);     // R
        data[i + 1] = clamp(Math.pow(data[i + 1] / 255, 0.85) * 255 * brightnessFactor); // G
        data[i + 2] = clamp(Math.pow(data[i + 2] / 255, 0.85) * 255 * brightnessFactor); // B
      }
      
      enhancements.push('تحسين الإضاءة');
    }
    // إذا كانت الصورة ساطعة جداً (متوسط السطوع > 200)
    else if (avgBrightness > 200) {
      const darkFactor = 0.9;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = clamp(data[i] * darkFactor);
        data[i + 1] = clamp(data[i + 1] * darkFactor);
        data[i + 2] = clamp(data[i + 2] * darkFactor);
      }
      enhancements.push('تعديل السطوع الزائد');
    }

    // === تحسين التباين التلقائي (Auto Contrast) ===
    // إذا كان النطاق الديناميكي منخفضاً
    if (dynamicRange < 150) {
      // تمديد النطاق ليشمل 0-255
      const scale = 255 / Math.max(dynamicRange, 1);
      
      for (let i = 0; i < data.length; i += 4) {
        data[i] = clamp((data[i] - minBrightness) * scale);
        data[i + 1] = clamp((data[i + 1] - minBrightness) * scale);
        data[i + 2] = clamp((data[i + 2] - minBrightness) * scale);
      }
      
      enhancements.push('تحسين التباين');
    }

    // === تحسين الحدة المتقدم (Unsharp Mask) ===
    // نطبق دائماً لتحسين وضوح النص
    const original = new Uint8ClampedArray(data);
    const sharpenAmount = 0.4; // زيادة الحدة
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        
        for (let c = 0; c < 3; c++) {
          // حساب المتوسط المحيط (3x3 kernel)
          const neighbors = 
            original[idx - width * 4 - 4 + c] + // أعلى يسار
            original[idx - width * 4 + c] +     // أعلى
            original[idx - width * 4 + 4 + c] + // أعلى يمين
            original[idx - 4 + c] +             // يسار
            original[idx + 4 + c] +             // يمين
            original[idx + width * 4 - 4 + c] + // أسفل يسار
            original[idx + width * 4 + c] +     // أسفل
            original[idx + width * 4 + 4 + c];  // أسفل يمين
          
          const avg = neighbors / 8;
          const diff = original[idx + c] - avg;
          
          data[idx + c] = clamp(original[idx + c] + diff * sharpenAmount);
        }
      }
    }
    
    enhancements.push('تحسين الحدة');

    // === تطبيق التغييرات ===
    ctx.putImageData(imageData, 0, 0);
    
  } catch (error) {
    console.warn('فشل تحسين الصورة:', error);
  }

  return enhancements;
}

/**
 * تقييد القيمة بين 0 و 255
 */
function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

/**
 * قراءة اتجاه الصورة من EXIF
 */
async function getImageOrientation(base64Data: string): Promise<number> {
  try {
    // استخراج البيانات الثنائية
    const base64 = base64Data.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // البحث عن EXIF orientation
    // JPEG يبدأ بـ FFD8
    if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) {
      return 1; // ليس JPEG
    }

    let offset = 2;
    while (offset < bytes.length) {
      if (bytes[offset] !== 0xFF) break;
      
      const marker = bytes[offset + 1];
      
      // APP1 marker (EXIF)
      if (marker === 0xE1) {
        const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
        
        // التحقق من "Exif\0\0"
        if (
          bytes[offset + 4] === 0x45 && // E
          bytes[offset + 5] === 0x78 && // x
          bytes[offset + 6] === 0x69 && // i
          bytes[offset + 7] === 0x66 && // f
          bytes[offset + 8] === 0x00 &&
          bytes[offset + 9] === 0x00
        ) {
          // قراءة TIFF header
          const tiffOffset = offset + 10;
          const littleEndian = bytes[tiffOffset] === 0x49; // II = little endian
          
          // قراءة IFD0 offset
          const ifd0Offset = tiffOffset + (littleEndian 
            ? (bytes[tiffOffset + 4] | (bytes[tiffOffset + 5] << 8) | (bytes[tiffOffset + 6] << 16) | (bytes[tiffOffset + 7] << 24))
            : ((bytes[tiffOffset + 4] << 24) | (bytes[tiffOffset + 5] << 16) | (bytes[tiffOffset + 6] << 8) | bytes[tiffOffset + 7]));
          
          // قراءة عدد الإدخالات
          const numEntries = littleEndian
            ? (bytes[ifd0Offset] | (bytes[ifd0Offset + 1] << 8))
            : ((bytes[ifd0Offset] << 8) | bytes[ifd0Offset + 1]);
          
          // البحث عن Orientation tag (0x0112)
          for (let i = 0; i < numEntries; i++) {
            const entryOffset = ifd0Offset + 2 + (i * 12);
            const tag = littleEndian
              ? (bytes[entryOffset] | (bytes[entryOffset + 1] << 8))
              : ((bytes[entryOffset] << 8) | bytes[entryOffset + 1]);
            
            if (tag === 0x0112) {
              const orientation = littleEndian
                ? (bytes[entryOffset + 8] | (bytes[entryOffset + 9] << 8))
                : ((bytes[entryOffset + 8] << 8) | bytes[entryOffset + 9]);
              
              return orientation;
            }
          }
        }
        
        offset += 2 + length;
      } else if (marker === 0xD9 || marker === 0xDA) {
        break; // نهاية أو بداية البيانات
      } else {
        const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
        offset += 2 + length;
      }
    }
    
    return 1; // الاتجاه الافتراضي
  } catch {
    return 1;
  }
}

/**
 * تصحيح اتجاه الصورة بناءً على EXIF
 */
function correctOrientation(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  orientation: number,
  width: number,
  height: number
): { width: number; height: number } {
  // تصحيح الاتجاه بناءً على قيمة EXIF
  switch (orientation) {
    case 2: // Flip horizontal
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      break;
    case 3: // Rotate 180
      ctx.translate(width, height);
      ctx.rotate(Math.PI);
      break;
    case 4: // Flip vertical
      ctx.translate(0, height);
      ctx.scale(1, -1);
      break;
    case 5: // Rotate 90 CW + flip horizontal
      ctx.rotate(Math.PI / 2);
      ctx.scale(1, -1);
      return { width: height, height: width };
    case 6: // Rotate 90 CW
      ctx.translate(height, 0);
      ctx.rotate(Math.PI / 2);
      return { width: height, height: width };
    case 7: // Rotate 90 CCW + flip horizontal
      ctx.translate(0, width);
      ctx.rotate(-Math.PI / 2);
      ctx.scale(1, -1);
      return { width: height, height: width };
    case 8: // Rotate 90 CCW
      ctx.translate(0, width);
      ctx.rotate(-Math.PI / 2);
      return { width: height, height: width };
    default:
      // No transformation needed
      break;
  }
  
  return { width, height };
}

// ==================== الدالة الرئيسية ====================

/**
 * ضغط وتحسين الصورة
 */
export async function compressAndEnhanceImage(
  base64Data: string,
  options: ImageCompressionOptions = {}
): Promise<CompressionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const enhancements: string[] = [];
  
  try {
    // حساب الحجم الأصلي
    const originalSize = Math.round((base64Data.length * 3) / 4);
    
    // تحميل الصورة
    const img = await loadImage(base64Data);
    
    // قراءة اتجاه EXIF
    const orientation = await getImageOrientation(base64Data);
    if (orientation > 1) {
      enhancements.push('تصحيح الاتجاه');
    }
    
    // حساب الأبعاد الجديدة
    let { width, height } = calculateDimensions(
      img.naturalWidth,
      img.naturalHeight,
      opts.maxWidth,
      opts.maxHeight
    );
    
    // إنشاء canvas
    const canvas = document.createElement('canvas');
    
    // تعديل الأبعاد للاتجاهات المقلوبة
    if (orientation >= 5 && orientation <= 8) {
      canvas.width = height;
      canvas.height = width;
    } else {
      canvas.width = width;
      canvas.height = height;
    }
    
    const ctx = canvas.getContext('2d', { 
      alpha: false,
      willReadFrequently: opts.enhanceForOCR 
    });
    
    if (!ctx) {
      throw new Error('فشل إنشاء سياق الرسم');
    }
    
    // خلفية بيضاء
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // تصحيح الاتجاه
    ctx.save();
    const correctedDims = correctOrientation(ctx, img, orientation, width, height);
    width = correctedDims.width;
    height = correctedDims.height;
    
    // رسم الصورة
    ctx.drawImage(img, 0, 0, width, height);
    ctx.restore();
    
    // تحسين للقراءة OCR
    if (opts.enhanceForOCR) {
      const ocrEnhancements = enhanceImageForOCR(ctx, canvas.width, canvas.height);
      enhancements.push(...ocrEnhancements);
    }
    
    // ضغط الصورة
    let quality = opts.quality;
    let compressedBase64 = canvas.toDataURL(`image/${opts.outputFormat}`, quality);
    let compressedSize = Math.round((compressedBase64.length * 3) / 4);
    
    // تقليل الجودة تدريجياً إذا كان الحجم كبيراً
    const maxSizeBytes = opts.maxSizeKB * 1024;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (compressedSize > maxSizeBytes && quality > 0.3 && attempts < maxAttempts) {
      quality -= 0.1;
      compressedBase64 = canvas.toDataURL(`image/${opts.outputFormat}`, quality);
      compressedSize = Math.round((compressedBase64.length * 3) / 4);
      attempts++;
    }
    
    // إذا لا يزال كبيراً، نقلل الأبعاد
    if (compressedSize > maxSizeBytes) {
      const scaleFactor = Math.sqrt(maxSizeBytes / compressedSize);
      const newWidth = Math.round(canvas.width * scaleFactor);
      const newHeight = Math.round(canvas.height * scaleFactor);
      
      const smallCanvas = document.createElement('canvas');
      smallCanvas.width = newWidth;
      smallCanvas.height = newHeight;
      
      const smallCtx = smallCanvas.getContext('2d');
      if (smallCtx) {
        smallCtx.fillStyle = '#FFFFFF';
        smallCtx.fillRect(0, 0, newWidth, newHeight);
        smallCtx.drawImage(canvas, 0, 0, newWidth, newHeight);
        
        compressedBase64 = smallCanvas.toDataURL(`image/${opts.outputFormat}`, quality);
        compressedSize = Math.round((compressedBase64.length * 3) / 4);
        
        enhancements.push('تقليل الأبعاد');
      }
    }
    
    const compressionRatio = originalSize > 0 
      ? Math.round((1 - compressedSize / originalSize) * 100) 
      : 0;
    
    if (compressionRatio > 0) {
      enhancements.push(`ضغط ${compressionRatio}%`);
    }
    
    return {
      success: true,
      base64Data: compressedBase64,
      originalSize,
      compressedSize,
      compressionRatio,
      width: canvas.width,
      height: canvas.height,
      format: opts.outputFormat,
      enhancements
    };
    
  } catch (error: any) {
    return {
      success: false,
      base64Data: base64Data, // إرجاع الأصلية في حالة الفشل
      originalSize: Math.round((base64Data.length * 3) / 4),
      compressedSize: Math.round((base64Data.length * 3) / 4),
      compressionRatio: 0,
      width: 0,
      height: 0,
      format: 'unknown',
      error: error.message || 'فشل ضغط الصورة'
    };
  }
}

/**
 * التحقق من صحة الصورة قبل الرفع
 */
export function validateImageForUpload(file: File): { 
  valid: boolean; 
  error?: string;
  warnings?: string[];
} {
  const warnings: string[] = [];
  
  // التحقق من نوع الملف
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  if (!validTypes.includes(file.type)) {
    return { 
      valid: false, 
      error: 'نوع الملف غير مدعوم. يرجى استخدام JPEG أو PNG أو WebP' 
    };
  }
  
  // التحقق من الحجم
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return { 
      valid: false, 
      error: 'حجم الملف كبير جداً. الحد الأقصى 10 ميجابايت' 
    };
  }
  
  // تحذيرات
  if (file.size > 5 * 1024 * 1024) {
    warnings.push('حجم الملف كبير، سيتم ضغطه تلقائياً');
  }
  
  if (file.type === 'image/png') {
    warnings.push('سيتم تحويل PNG إلى JPEG للحصول على حجم أصغر');
  }
  
  return { valid: true, warnings };
}

/**
 * تحويل ملف إلى base64
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('فشل قراءة الملف'));
    reader.readAsDataURL(file);
  });
}

/**
 * معالجة الصورة الكاملة: التحقق + التحويل + الضغط + التحسين
 */
export async function processImageForUpload(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<CompressionResult & { fileName: string; contentType: string }> {
  // التحقق من الصورة
  const validation = validateImageForUpload(file);
  if (!validation.valid) {
    return {
      success: false,
      base64Data: '',
      originalSize: file.size,
      compressedSize: 0,
      compressionRatio: 0,
      width: 0,
      height: 0,
      format: 'unknown',
      fileName: file.name,
      contentType: file.type,
      error: validation.error
    };
  }
  
  // تحويل إلى base64
  const base64Data = await fileToBase64(file);
  
  // ضغط وتحسين
  const result = await compressAndEnhanceImage(base64Data, options);
  
  // تحديد اسم الملف والنوع
  const outputFormat = options.outputFormat || 'jpeg';
  const fileName = file.name.replace(/\.[^.]+$/, `.${outputFormat}`);
  const contentType = `image/${outputFormat}`;
  
  return {
    ...result,
    fileName,
    contentType
  };
}
