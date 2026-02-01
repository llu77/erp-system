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
 * تحسين الصورة للقراءة OCR - إصدار متقدم
 * - تصحيح الإضاءة التكيفي (CLAHE - Contrast Limited Adaptive Histogram Equalization)
 * - إزالة الاهتزاز (Deconvolution Sharpening)
 * - تحسين التباين والوضوح
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

    // ==================== تحليل الصورة ====================
    let totalBrightness = 0;
    let minBrightness = 255;
    let maxBrightness = 0;
    const pixelCount = data.length / 4;
    
    // حساب الهيستوجرام للسطوع
    const histogram = new Array(256).fill(0);

    for (let i = 0; i < data.length; i += 4) {
      const brightness = Math.round((data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114));
      totalBrightness += brightness;
      minBrightness = Math.min(minBrightness, brightness);
      maxBrightness = Math.max(maxBrightness, brightness);
      histogram[brightness]++;
    }

    const avgBrightness = totalBrightness / pixelCount;
    const dynamicRange = maxBrightness - minBrightness;
    
    // حساب التباين (الانحراف المعياري)
    let varianceSum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const brightness = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      varianceSum += Math.pow(brightness - avgBrightness, 2);
    }
    const stdDev = Math.sqrt(varianceSum / pixelCount);
    
    // كشف الاهتزاز (الصور المهتزة لها تباين منخفض في الحواف)
    const isBlurry = stdDev < 40;

    // ==================== المرحلة 1: تصحيح الإضاءة التكيفي (CLAHE مبسط) ====================
    // تقسيم الصورة إلى مناطق وتطبيق تصحيح محلي
    const tileSize = 64; // حجم المنطقة
    const tilesX = Math.ceil(width / tileSize);
    const tilesY = Math.ceil(height / tileSize);
    
    // حساب متوسط السطوع لكل منطقة
    const tileBrightness: number[][] = [];
    for (let ty = 0; ty < tilesY; ty++) {
      tileBrightness[ty] = [];
      for (let tx = 0; tx < tilesX; tx++) {
        let sum = 0;
        let count = 0;
        const startX = tx * tileSize;
        const startY = ty * tileSize;
        const endX = Math.min(startX + tileSize, width);
        const endY = Math.min(startY + tileSize, height);
        
        for (let y = startY; y < endY; y++) {
          for (let x = startX; x < endX; x++) {
            const idx = (y * width + x) * 4;
            sum += (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114);
            count++;
          }
        }
        tileBrightness[ty][tx] = count > 0 ? sum / count : 128;
      }
    }
    
    // تطبيق تصحيح الإضاءة المحلي
    const targetBrightness = 140;
    let brightnessAdjusted = false;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const tx = Math.min(Math.floor(x / tileSize), tilesX - 1);
        const ty = Math.min(Math.floor(y / tileSize), tilesY - 1);
        
        // حساب معامل التصحيح بناءً على المنطقة
        const localBrightness = tileBrightness[ty][tx];
        
        // تصحيح فقط إذا كانت المنطقة داكنة أو ساطعة جداً
        if (localBrightness < 100 || localBrightness > 200) {
          const factor = localBrightness < 100 
            ? Math.min(1.8, targetBrightness / Math.max(localBrightness, 1))
            : Math.max(0.7, targetBrightness / localBrightness);
          
          // تطبيق Gamma Correction مع التصحيح
          const gamma = localBrightness < 100 ? 0.75 : 1.1;
          
          data[idx] = clamp(Math.pow(data[idx] / 255, gamma) * 255 * factor);
          data[idx + 1] = clamp(Math.pow(data[idx + 1] / 255, gamma) * 255 * factor);
          data[idx + 2] = clamp(Math.pow(data[idx + 2] / 255, gamma) * 255 * factor);
          brightnessAdjusted = true;
        }
      }
    }
    
    if (brightnessAdjusted) {
      enhancements.push('تصحيح الإضاءة التكيفي');
    }

    // ==================== المرحلة 2: تحسين التباين (Histogram Stretching) ====================
    if (dynamicRange < 180) {
      // إعادة حساب الحدود بعد تصحيح الإضاءة
      let newMin = 255, newMax = 0;
      for (let i = 0; i < data.length; i += 4) {
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        newMin = Math.min(newMin, brightness);
        newMax = Math.max(newMax, brightness);
      }
      
      const newRange = newMax - newMin;
      if (newRange > 10 && newRange < 230) {
        const scale = 240 / newRange;
        const offset = 8 - newMin * scale;
        
        for (let i = 0; i < data.length; i += 4) {
          data[i] = clamp(data[i] * scale + offset);
          data[i + 1] = clamp(data[i + 1] * scale + offset);
          data[i + 2] = clamp(data[i + 2] * scale + offset);
        }
        
        enhancements.push('تحسين التباين');
      }
    }

    // ==================== المرحلة 3: إزالة الاهتزاز (Deconvolution Sharpening) ====================
    // نستخدم Laplacian of Gaussian (LoG) للكشف عن الحواف وتقويتها
    const original = new Uint8ClampedArray(data);
    
    // معامل الحدة - أقوى للصور المهتزة
    const sharpenStrength = isBlurry ? 0.7 : 0.5;
    
    // 5x5 Laplacian kernel لإزالة الاهتزاز بشكل أفضل
    const kernel5x5 = [
      [0, 0, -1, 0, 0],
      [0, -1, -2, -1, 0],
      [-1, -2, 16, -2, -1],
      [0, -1, -2, -1, 0],
      [0, 0, -1, 0, 0]
    ];
    
    for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        const idx = (y * width + x) * 4;
        
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          let kernelSum = 0;
          
          // تطبيق 5x5 kernel
          for (let ky = -2; ky <= 2; ky++) {
            for (let kx = -2; kx <= 2; kx++) {
              const nIdx = ((y + ky) * width + (x + kx)) * 4;
              const weight = kernel5x5[ky + 2][kx + 2];
              sum += original[nIdx + c] * weight;
              kernelSum += weight;
            }
          }
          
          // تطبيع القيمة
          const normalized = kernelSum !== 0 ? sum / kernelSum : sum / 16;
          const sharpened = original[idx + c] + (normalized - original[idx + c]) * sharpenStrength;
          
          data[idx + c] = clamp(sharpened);
        }
      }
    }
    
    if (isBlurry) {
      enhancements.push('إزالة الاهتزاز');
    } else {
      enhancements.push('تحسين الحدة');
    }

    // ==================== المرحلة 4: تحسين النص (Text Enhancement) ====================
    // زيادة التباين بين النص والخلفية
    for (let i = 0; i < data.length; i += 4) {
      const brightness = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      
      // تقوية الألوان الداكنة (النص) والفاتحة (الخلفية)
      if (brightness < 80) {
        // تعتيم النص
        const factor = 0.85;
        data[i] = clamp(data[i] * factor);
        data[i + 1] = clamp(data[i + 1] * factor);
        data[i + 2] = clamp(data[i + 2] * factor);
      } else if (brightness > 180) {
        // تفتيح الخلفية
        const factor = 1.1;
        data[i] = clamp(data[i] * factor);
        data[i + 1] = clamp(data[i + 1] * factor);
        data[i + 2] = clamp(data[i + 2] * factor);
      }
    }
    
    enhancements.push('تحسين وضوح النص');

    // ==================== تطبيق التغييرات ====================
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


// ==================== تقييم جودة الصورة ====================

/**
 * نتيجة تقييم جودة الصورة
 */
export interface ImageQualityResult {
  score: number;           // النسبة المئوية للجودة (0-100)
  level: 'excellent' | 'good' | 'acceptable' | 'poor';
  levelAr: string;         // المستوى بالعربية
  details: {
    brightness: number;    // جودة الإضاءة (0-100)
    contrast: number;      // جودة التباين (0-100)
    sharpness: number;     // جودة الحدة (0-100)
    resolution: number;    // جودة الدقة (0-100)
  };
  suggestions: string[];   // اقتراحات للتحسين
  isAcceptableForOCR: boolean;
}

/**
 * تقييم جودة الصورة للـ OCR
 * يحلل الصورة ويعطي نسبة مئوية للجودة مع اقتراحات للتحسين
 */
export async function evaluateImageQuality(base64Data: string): Promise<ImageQualityResult> {
  try {
    const img = await loadImage(base64Data);
    
    // إنشاء canvas للتحليل
    const canvas = document.createElement('canvas');
    const maxDim = 800; // تقليل الحجم للتحليل السريع
    let width = img.naturalWidth;
    let height = img.naturalHeight;
    
    if (width > maxDim || height > maxDim) {
      const ratio = Math.min(maxDim / width, maxDim / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }
    
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('فشل إنشاء سياق الرسم');
    }
    
    ctx.drawImage(img, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const pixelCount = data.length / 4;
    
    // ==================== تحليل الإضاءة ====================
    let totalBrightness = 0;
    let minBrightness = 255;
    let maxBrightness = 0;
    
    for (let i = 0; i < data.length; i += 4) {
      const brightness = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      totalBrightness += brightness;
      minBrightness = Math.min(minBrightness, brightness);
      maxBrightness = Math.max(maxBrightness, brightness);
    }
    
    const avgBrightness = totalBrightness / pixelCount;
    
    // جودة الإضاءة: الأفضل بين 100-180
    let brightnessScore: number;
    if (avgBrightness >= 100 && avgBrightness <= 180) {
      brightnessScore = 100;
    } else if (avgBrightness < 100) {
      brightnessScore = Math.max(0, (avgBrightness / 100) * 100);
    } else {
      brightnessScore = Math.max(0, ((255 - avgBrightness) / 75) * 100);
    }
    
    // ==================== تحليل التباين ====================
    const dynamicRange = maxBrightness - minBrightness;
    
    // جودة التباين: الأفضل > 150
    let contrastScore: number;
    if (dynamicRange >= 150) {
      contrastScore = 100;
    } else if (dynamicRange >= 100) {
      contrastScore = 70 + ((dynamicRange - 100) / 50) * 30;
    } else {
      contrastScore = (dynamicRange / 100) * 70;
    }
    
    // ==================== تحليل الحدة (Laplacian Variance) ====================
    let laplacianSum = 0;
    let laplacianCount = 0;
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        
        // حساب Laplacian للقناة الرمادية
        const center = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        const top = (data[idx - width * 4] + data[idx - width * 4 + 1] + data[idx - width * 4 + 2]) / 3;
        const bottom = (data[idx + width * 4] + data[idx + width * 4 + 1] + data[idx + width * 4 + 2]) / 3;
        const left = (data[idx - 4] + data[idx - 3] + data[idx - 2]) / 3;
        const right = (data[idx + 4] + data[idx + 5] + data[idx + 6]) / 3;
        
        const laplacian = Math.abs(4 * center - top - bottom - left - right);
        laplacianSum += laplacian * laplacian;
        laplacianCount++;
      }
    }
    
    const laplacianVariance = laplacianSum / laplacianCount;
    
    // جودة الحدة: الأفضل > 500
    let sharpnessScore: number;
    if (laplacianVariance >= 500) {
      sharpnessScore = 100;
    } else if (laplacianVariance >= 200) {
      sharpnessScore = 60 + ((laplacianVariance - 200) / 300) * 40;
    } else if (laplacianVariance >= 50) {
      sharpnessScore = 30 + ((laplacianVariance - 50) / 150) * 30;
    } else {
      sharpnessScore = (laplacianVariance / 50) * 30;
    }
    
    // ==================== تحليل الدقة ====================
    const originalWidth = img.naturalWidth;
    const originalHeight = img.naturalHeight;
    const megapixels = (originalWidth * originalHeight) / 1000000;
    
    // جودة الدقة: الأفضل > 2 ميجابكسل
    let resolutionScore: number;
    if (megapixels >= 2) {
      resolutionScore = 100;
    } else if (megapixels >= 1) {
      resolutionScore = 70 + ((megapixels - 1) / 1) * 30;
    } else if (megapixels >= 0.5) {
      resolutionScore = 40 + ((megapixels - 0.5) / 0.5) * 30;
    } else {
      resolutionScore = (megapixels / 0.5) * 40;
    }
    
    // ==================== حساب النتيجة الإجمالية ====================
    // الأوزان: الحدة والتباين أهم للـ OCR
    const weights = {
      brightness: 0.2,
      contrast: 0.3,
      sharpness: 0.35,
      resolution: 0.15
    };
    
    const overallScore = Math.round(
      brightnessScore * weights.brightness +
      contrastScore * weights.contrast +
      sharpnessScore * weights.sharpness +
      resolutionScore * weights.resolution
    );
    
    // ==================== تحديد المستوى ====================
    let level: 'excellent' | 'good' | 'acceptable' | 'poor';
    let levelAr: string;
    
    if (overallScore >= 80) {
      level = 'excellent';
      levelAr = 'ممتازة';
    } else if (overallScore >= 60) {
      level = 'good';
      levelAr = 'جيدة';
    } else if (overallScore >= 40) {
      level = 'acceptable';
      levelAr = 'مقبولة';
    } else {
      level = 'poor';
      levelAr = 'ضعيفة';
    }
    
    // ==================== إنشاء الاقتراحات ====================
    const suggestions: string[] = [];
    
    if (brightnessScore < 60) {
      if (avgBrightness < 100) {
        suggestions.push('الصورة داكنة جداً - حاول التصوير في مكان أكثر إضاءة');
      } else {
        suggestions.push('الصورة ساطعة جداً - تجنب الإضاءة المباشرة القوية');
      }
    }
    
    if (contrastScore < 60) {
      suggestions.push('التباين منخفض - تأكد من وضوح النص على الخلفية');
    }
    
    if (sharpnessScore < 60) {
      suggestions.push('الصورة غير واضحة - ثبّت الهاتف جيداً أثناء التصوير');
    }
    
    if (resolutionScore < 60) {
      suggestions.push('الدقة منخفضة - اقترب أكثر من الإيصال');
    }
    
    if (suggestions.length === 0 && overallScore < 80) {
      suggestions.push('حاول تحسين الإضاءة والثبات للحصول على نتيجة أفضل');
    }
    
    return {
      score: overallScore,
      level,
      levelAr,
      details: {
        brightness: Math.round(brightnessScore),
        contrast: Math.round(contrastScore),
        sharpness: Math.round(sharpnessScore),
        resolution: Math.round(resolutionScore)
      },
      suggestions,
      isAcceptableForOCR: overallScore >= 40
    };
    
  } catch (error) {
    console.error('فشل تقييم جودة الصورة:', error);
    return {
      score: 0,
      level: 'poor',
      levelAr: 'غير معروفة',
      details: {
        brightness: 0,
        contrast: 0,
        sharpness: 0,
        resolution: 0
      },
      suggestions: ['فشل تحليل الصورة - يرجى المحاولة مرة أخرى'],
      isAcceptableForOCR: false
    };
  }
}

/**
 * الحصول على لون مؤشر الجودة
 */
export function getQualityColor(score: number): string {
  if (score >= 80) return '#22c55e'; // أخضر
  if (score >= 60) return '#84cc16'; // أخضر فاتح
  if (score >= 40) return '#eab308'; // أصفر
  return '#ef4444'; // أحمر
}

/**
 * الحصول على أيقونة مؤشر الجودة
 */
export function getQualityIcon(level: 'excellent' | 'good' | 'acceptable' | 'poor'): string {
  switch (level) {
    case 'excellent': return '✓✓';
    case 'good': return '✓';
    case 'acceptable': return '~';
    case 'poor': return '✗';
  }
}
