/**
 * ============================================
 * Receipt Image Enhancer v2.0
 * ============================================
 * 
 * خوارزمية محسّنة لمعالجة صور إيصالات POS
 * - ترتيب صحيح للفلاتر (بدون تعارضات)
 * - ضغط خفيف للحفاظ على جودة OCR
 * - تحليل ذكي للصورة قبل المعالجة
 * 
 * Pipeline الصحيح:
 * 1. تصحيح الاتجاه (EXIF)
 * 2. تحويل للرمادي (Grayscale)
 * 3. إزالة التشويش (Median - قبل الحدة!)
 * 4. تحسين التباين (Normalize)
 * 5. تحسين الحدة (مرة واحدة فقط!)
 * 6. ضغط خفيف (≤10%)
 */

import sharp from 'sharp';

// =============================================
// الأنواع والواجهات
// =============================================

export interface EnhancementConfig {
  /** جودة الضغط (85-100) - كلما زاد الرقم، قل الضغط */
  compressionQuality: number;
  
  /** الحد الأقصى للضغط المسموح (%) */
  maxCompressionPercent: number;
  
  /** قوة الحدة (0.5-2.0) */
  sharpenStrength: number;
  
  /** قوة إزالة التشويش (1-5) */
  denoiseStrength: number;
  
  /** تفعيل التحويل للرمادي */
  grayscale: boolean;
  
  /** تفعيل تحسين التباين */
  normalizeContrast: boolean;
  
  /** تفعيل المعالجة (false = رفع الصورة الأصلية فقط) */
  enableProcessing: boolean;
}

export interface ImageStats {
  width: number;
  height: number;
  contrast: number;
  brightness: number;
  sharpness: number;
  noiseLevel: number;
}

export interface OCRReadiness {
  score: number;
  level: 'ممتاز' | 'جيد' | 'مقبول' | 'ضعيف';
  issues: string[];
}

export interface EnhancementResult {
  buffer: Buffer;
  base64: string;
  
  originalSize: number;
  finalSize: number;
  compressionPercent: number;
  compressionWarning: string | null;
  
  appliedSteps: string[];
  processingTime: number;
  
  qualityImprovement: {
    contrast: number;
    sharpness: number;
    noiseReduction: number;
  };
  
  ocrReadiness: OCRReadiness;
  
  /** هل تم تطبيق المعالجة أم رفع الصورة الأصلية */
  wasProcessed: boolean;
}

// =============================================
// التكوين الافتراضي
// =============================================

/** التكوين المثالي للإيصالات الحرارية */
export const OPTIMAL_CONFIG: EnhancementConfig = {
  compressionQuality: 92,      // جودة عالية = ضغط ≤10%
  maxCompressionPercent: 10,   // لا تضغط أكثر من 10%
  sharpenStrength: 1.2,        // حدة معتدلة
  denoiseStrength: 3,          // تشويش خفيف (Median 3x3)
  grayscale: true,             // الرمادي أفضل للـ OCR
  normalizeContrast: true,     // تحسين التباين
  enableProcessing: false,     // ❌ معطل افتراضياً - الصورة الأصلية أفضل
};

/** تكوين للصور الضعيفة فقط */
export const WEAK_IMAGE_CONFIG: EnhancementConfig = {
  ...OPTIMAL_CONFIG,
  enableProcessing: true,      // ✅ تفعيل المعالجة
  sharpenStrength: 1.5,        // حدة أقوى
  denoiseStrength: 3,          // تشويش خفيف
};

// =============================================
// الفئة الرئيسية
// =============================================

export class ReceiptEnhancer {
  private config: EnhancementConfig;

  constructor(config: Partial<EnhancementConfig> = {}) {
    this.config = { ...OPTIMAL_CONFIG, ...config };
  }

  /**
   * 🎯 المعالجة الرئيسية - Pipeline محسّن
   * 
   * الترتيب الصحيح (مهم جداً!):
   * ────────────────────────────
   * 1. تصحيح الاتجاه ← أولاً دائماً
   * 2. تحويل للرمادي ← قبل أي معالجة
   * 3. إزالة التشويش ← قبل الحدة (مهم!)
   * 4. تحسين التباين ← بعد إزالة التشويش
   * 5. تحسين الحدة ← آخر معالجة (مرة واحدة!)
   * 6. الضغط الخفيف ← في النهاية
   */
  async enhance(imageBuffer: Buffer): Promise<EnhancementResult> {
    const startTime = Date.now();
    const originalSize = imageBuffer.length;
    const appliedSteps: string[] = [];

    // تحليل الصورة الأصلية
    const originalStats = await this.analyzeImage(imageBuffer);

    // إذا كانت المعالجة معطلة، نرجع الصورة الأصلية مع ضغط خفيف فقط
    if (!this.config.enableProcessing) {
      const result = await this.compressOnly(imageBuffer, originalStats);
      return {
        ...result,
        processingTime: Date.now() - startTime,
        wasProcessed: false,
      };
    }

    // بناء Pipeline المعالجة
    let pipeline = sharp(imageBuffer);

    // ─────────────────────────────────────────
    // الخطوة 1: تصحيح الاتجاه من EXIF
    // ─────────────────────────────────────────
    pipeline = pipeline.rotate();
    appliedSteps.push('تصحيح الاتجاه');

    // ─────────────────────────────────────────
    // الخطوة 2: تحويل للرمادي (اختياري لكن مُوصى)
    // ─────────────────────────────────────────
    if (this.config.grayscale) {
      pipeline = pipeline.grayscale();
      appliedSteps.push('تحويل للرمادي');
    }

    // ─────────────────────────────────────────
    // الخطوة 3: إزالة التشويش (قبل الحدة!)
    // ⚠️ Median filter أفضل من Gaussian للنص
    // ─────────────────────────────────────────
    if (originalStats.noiseLevel > 15) {
      pipeline = pipeline.median(this.config.denoiseStrength);
      appliedSteps.push('إزالة التشويش');
    }

    // ─────────────────────────────────────────
    // الخطوة 4: تحسين التباين التكيفي
    // ─────────────────────────────────────────
    if (this.config.normalizeContrast && originalStats.contrast < 60) {
      pipeline = pipeline.normalize();
      appliedSteps.push('تحسين التباين');
    }

    // ─────────────────────────────────────────
    // الخطوة 5: تحسين الحدة (مرة واحدة فقط!)
    // ⚠️ لا تُطبق التنعيم بعدها أبداً!
    // ─────────────────────────────────────────
    if (originalStats.sharpness < 70) {
      pipeline = pipeline.sharpen({
        sigma: 1.0,                           // نصف قطر صغير للنص
        m1: this.config.sharpenStrength,      // حدة للمناطق المسطحة
        m2: this.config.sharpenStrength * 0.4 // حدة أقل للحواف
      });
      appliedSteps.push('تحسين الحدة');
    }

    // ─────────────────────────────────────────
    // الخطوة 6: الضغط الخفيف (جودة عالية)
    // ⚠️ لا تضغط أكثر من 10%!
    // ─────────────────────────────────────────
    pipeline = pipeline.jpeg({
      quality: this.config.compressionQuality,
      mozjpeg: true  // ضغط ذكي بدون فقدان جودة
    });
    appliedSteps.push(`ضغط (جودة ${this.config.compressionQuality}%)`);

    // تنفيذ المعالجة
    const enhancedBuffer = await pipeline.toBuffer();
    const finalSize = enhancedBuffer.length;
    const compressionPercent = ((originalSize - finalSize) / originalSize) * 100;

    // تحليل الصورة النهائية
    const finalStats = await this.analyzeImage(enhancedBuffer);

    // التحقق من الضغط
    const compressionWarning = compressionPercent > this.config.maxCompressionPercent
      ? `⚠️ الضغط (${compressionPercent.toFixed(1)}%) أعلى من المسموح (${this.config.maxCompressionPercent}%)`
      : null;

    return {
      buffer: enhancedBuffer,
      base64: `data:image/jpeg;base64,${enhancedBuffer.toString('base64')}`,
      
      originalSize,
      finalSize,
      compressionPercent: Math.max(0, compressionPercent),
      compressionWarning,
      
      appliedSteps,
      processingTime: Date.now() - startTime,
      
      qualityImprovement: {
        contrast: finalStats.contrast - originalStats.contrast,
        sharpness: finalStats.sharpness - originalStats.sharpness,
        noiseReduction: originalStats.noiseLevel - finalStats.noiseLevel
      },
      
      ocrReadiness: this.calculateOCRReadiness(finalStats),
      wasProcessed: true,
    };
  }

  /**
   * ضغط خفيف فقط بدون معالجة
   */
  private async compressOnly(imageBuffer: Buffer, originalStats: ImageStats): Promise<Omit<EnhancementResult, 'processingTime' | 'wasProcessed'>> {
    const originalSize = imageBuffer.length;
    const appliedSteps: string[] = [];

    // ضغط خفيف فقط مع تصحيح الاتجاه
    const pipeline = sharp(imageBuffer)
      .rotate()
      .jpeg({
        quality: this.config.compressionQuality,
        mozjpeg: true
      });

    appliedSteps.push('تصحيح الاتجاه');
    appliedSteps.push(`ضغط خفيف (جودة ${this.config.compressionQuality}%)`);

    const compressedBuffer = await pipeline.toBuffer();
    const finalSize = compressedBuffer.length;
    const compressionPercent = ((originalSize - finalSize) / originalSize) * 100;

    const compressionWarning = compressionPercent > this.config.maxCompressionPercent
      ? `⚠️ الضغط (${compressionPercent.toFixed(1)}%) أعلى من المسموح (${this.config.maxCompressionPercent}%)`
      : null;

    return {
      buffer: compressedBuffer,
      base64: `data:image/jpeg;base64,${compressedBuffer.toString('base64')}`,
      
      originalSize,
      finalSize,
      compressionPercent: Math.max(0, compressionPercent),
      compressionWarning,
      
      appliedSteps,
      
      qualityImprovement: {
        contrast: 0,
        sharpness: 0,
        noiseReduction: 0
      },
      
      ocrReadiness: this.calculateOCRReadiness(originalStats),
    };
  }

  /**
   * تحليل جودة الصورة
   */
  async analyzeImage(buffer: Buffer): Promise<ImageStats> {
    try {
      const stats = await sharp(buffer).stats();
      const metadata = await sharp(buffer).metadata();

      // حساب التباين من الانحراف المعياري
      const avgStdev = stats.channels.reduce((sum, ch) => sum + ch.stdev, 0) / stats.channels.length;
      const contrast = Math.min(100, avgStdev * 2);

      // حساب السطوع من المتوسط
      const brightness = stats.channels.reduce((sum, ch) => sum + ch.mean, 0) / stats.channels.length;

      // تقدير الحدة (تقريبي)
      const sharpness = Math.min(100, avgStdev * 1.5);

      // تقدير مستوى التشويش
      const noiseLevel = Math.max(0, 50 - avgStdev);

      return {
        width: metadata.width || 0,
        height: metadata.height || 0,
        contrast,
        brightness,
        sharpness,
        noiseLevel
      };
    } catch (error) {
      // في حالة فشل التحليل، نرجع قيم افتراضية
      return {
        width: 0,
        height: 0,
        contrast: 50,
        brightness: 128,
        sharpness: 50,
        noiseLevel: 25
      };
    }
  }

  /**
   * حساب جاهزية الصورة للـ OCR
   */
  private calculateOCRReadiness(stats: ImageStats): OCRReadiness {
    let score = 100;
    const issues: string[] = [];

    if (stats.contrast < 40) {
      score -= 25;
      issues.push('تباين منخفض');
    }

    if (stats.sharpness < 40) {
      score -= 25;
      issues.push('صورة غير واضحة');
    }

    if (stats.brightness < 60 || stats.brightness > 220) {
      score -= 15;
      issues.push('سطوع غير مثالي');
    }

    if (stats.noiseLevel > 35) {
      score -= 15;
      issues.push('تشويش عالٍ');
    }

    let level: 'ممتاز' | 'جيد' | 'مقبول' | 'ضعيف';
    if (score >= 85) level = 'ممتاز';
    else if (score >= 70) level = 'جيد';
    else if (score >= 50) level = 'مقبول';
    else level = 'ضعيف';

    return { score: Math.max(0, score), level, issues };
  }

  /**
   * تحديث التكوين
   */
  updateConfig(config: Partial<EnhancementConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * الحصول على التكوين الحالي
   */
  getConfig(): EnhancementConfig {
    return { ...this.config };
  }
}

// =============================================
// دوال مساعدة للاستخدام المباشر
// =============================================

/**
 * معالجة صورة إيصال بالإعدادات الافتراضية (بدون معالجة)
 */
export async function enhanceReceiptImage(
  imageBuffer: Buffer,
  options: Partial<EnhancementConfig> = {}
): Promise<EnhancementResult> {
  const enhancer = new ReceiptEnhancer(options);
  return enhancer.enhance(imageBuffer);
}

/**
 * معالجة صورة إيصال ضعيفة (مع تفعيل المعالجة)
 */
export async function enhanceWeakReceiptImage(
  imageBuffer: Buffer,
  options: Partial<EnhancementConfig> = {}
): Promise<EnhancementResult> {
  const enhancer = new ReceiptEnhancer({ ...WEAK_IMAGE_CONFIG, ...options });
  return enhancer.enhance(imageBuffer);
}

/**
 * تحليل جودة صورة إيصال
 */
export async function analyzeReceiptImage(
  imageBuffer: Buffer
): Promise<{ stats: ImageStats; ocrReadiness: OCRReadiness }> {
  const enhancer = new ReceiptEnhancer();
  const stats = await enhancer.analyzeImage(imageBuffer);
  const ocrReadiness = new ReceiptEnhancer()['calculateOCRReadiness'](stats);
  return { stats, ocrReadiness };
}

export default ReceiptEnhancer;
