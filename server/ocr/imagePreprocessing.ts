/**
 * خدمة معالجة الصور مسبقاً لتحسين دقة OCR
 * Image Preprocessing Service for OCR Accuracy Enhancement
 * 
 * تحسينات مخصصة لإيصالات نقاط البيع الحرارية:
 * - تحسين التباين للنصوص الباهتة
 * - تحسين السطوع للصور المظلمة
 * - تحويل إلى Grayscale
 * - إزالة الضوضاء
 * - تحسين الحدة
 */

import sharp from "sharp";
import { createLogger } from "../utils/logger";
import * as fs from "fs";
import * as path from "path";

const logger = createLogger("ImagePreprocessing");

// ==================== الأنواع ====================

export interface PreprocessingOptions {
  /** تحسين التباين (0.5 - 2.0، الافتراضي 1.3) */
  contrast?: number;
  /** تحسين السطوع (-100 إلى 100، الافتراضي 10) */
  brightness?: number;
  /** تحويل إلى Grayscale */
  grayscale?: boolean;
  /** تحسين الحدة (0 - 2، الافتراضي 1.2) */
  sharpen?: number;
  /** إزالة الضوضاء */
  denoise?: boolean;
  /** تطبيع الحجم (العرض الأقصى) */
  maxWidth?: number;
  /** جودة الإخراج (1-100) */
  quality?: number;
}

export interface PreprocessingResult {
  /** الصورة المعالجة كـ base64 */
  base64Image: string;
  /** نوع MIME */
  mimeType: string;
  /** العرض الأصلي */
  originalWidth: number;
  /** الارتفاع الأصلي */
  originalHeight: number;
  /** العرض بعد المعالجة */
  processedWidth: number;
  /** الارتفاع بعد المعالجة */
  processedHeight: number;
  /** حجم الملف الأصلي (bytes) */
  originalSize: number;
  /** حجم الملف بعد المعالجة (bytes) */
  processedSize: number;
  /** وقت المعالجة (ms) */
  processingTime: number;
  /** التحسينات المطبقة */
  appliedEnhancements: string[];
}

// ==================== الإعدادات الافتراضية ====================

/** إعدادات مُحسّنة لإيصالات نقاط البيع الحرارية */
export const THERMAL_RECEIPT_PRESET: PreprocessingOptions = {
  contrast: 1.4,      // تباين عالي للنصوص الباهتة
  brightness: 15,     // سطوع خفيف
  grayscale: true,    // تحويل إلى أبيض وأسود
  sharpen: 1.3,       // تحسين الحدة
  denoise: true,      // إزالة الضوضاء
  maxWidth: 2000,     // تحديد الحجم الأقصى
  quality: 90         // جودة عالية
};

/** إعدادات للصور الباهتة جداً */
export const LOW_QUALITY_PRESET: PreprocessingOptions = {
  contrast: 1.8,      // تباين عالي جداً
  brightness: 25,     // سطوع أعلى
  grayscale: true,
  sharpen: 1.5,       // حدة أعلى
  denoise: true,
  maxWidth: 2000,
  quality: 95
};

/** إعدادات للصور الواضحة */
export const HIGH_QUALITY_PRESET: PreprocessingOptions = {
  contrast: 1.2,
  brightness: 5,
  grayscale: true,
  sharpen: 1.0,
  denoise: false,
  maxWidth: 2500,
  quality: 85
};

// ==================== الدوال الرئيسية ====================

/**
 * معالجة صورة من رابط URL
 */
export async function preprocessImageFromUrl(
  imageUrl: string,
  options: PreprocessingOptions = THERMAL_RECEIPT_PRESET
): Promise<PreprocessingResult> {
  const startTime = Date.now();
  const appliedEnhancements: string[] = [];

  try {
    logger.info("بدء معالجة الصورة من URL", { 
      url: imageUrl.substring(0, 50) + "..." 
    });

    // جلب الصورة
    let imageBuffer: Buffer;
    
    if (imageUrl.startsWith("data:")) {
      // صورة base64
      const base64Data = imageUrl.split(",")[1];
      imageBuffer = Buffer.from(base64Data, "base64");
    } else if (imageUrl.startsWith("file://") || imageUrl.startsWith("/")) {
      // ملف محلي
      const filePath = imageUrl.replace("file://", "");
      imageBuffer = fs.readFileSync(filePath);
    } else {
      // رابط HTTP
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`فشل جلب الصورة: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    }

    return await preprocessImageBuffer(imageBuffer, options, startTime, appliedEnhancements);
  } catch (error: any) {
    logger.error("خطأ في معالجة الصورة من URL", { error: error.message });
    throw error;
  }
}

/**
 * معالجة صورة من Buffer
 */
export async function preprocessImageBuffer(
  imageBuffer: Buffer,
  options: PreprocessingOptions = THERMAL_RECEIPT_PRESET,
  startTime: number = Date.now(),
  appliedEnhancements: string[] = []
): Promise<PreprocessingResult> {
  try {
    const originalSize = imageBuffer.length;
    
    // الحصول على معلومات الصورة الأصلية
    const metadata = await sharp(imageBuffer).metadata();
    const originalWidth = metadata.width || 0;
    const originalHeight = metadata.height || 0;

    logger.info("معلومات الصورة الأصلية", {
      width: originalWidth,
      height: originalHeight,
      format: metadata.format,
      size: originalSize
    });

    // بدء معالجة الصورة
    let processor = sharp(imageBuffer);

    // 1. تطبيع الحجم
    if (options.maxWidth && originalWidth > options.maxWidth) {
      processor = processor.resize(options.maxWidth, null, {
        withoutEnlargement: true,
        fit: "inside"
      });
      appliedEnhancements.push(`resize:${options.maxWidth}`);
    }

    // 2. تحويل إلى Grayscale
    if (options.grayscale) {
      processor = processor.grayscale();
      appliedEnhancements.push("grayscale");
    }

    // 3. تحسين التباين والسطوع
    const modulate: { brightness?: number; saturation?: number } = {};
    const linear: { a?: number; b?: number } = {};

    if (options.brightness !== undefined && options.brightness !== 0) {
      // تحويل brightness من -100:100 إلى 0.5:1.5
      modulate.brightness = 1 + (options.brightness / 100);
      appliedEnhancements.push(`brightness:${options.brightness}`);
    }

    if (options.contrast !== undefined && options.contrast !== 1) {
      // تطبيق التباين باستخدام linear
      linear.a = options.contrast;
      linear.b = (1 - options.contrast) * 128;
      appliedEnhancements.push(`contrast:${options.contrast}`);
    }

    if (Object.keys(modulate).length > 0) {
      processor = processor.modulate(modulate);
    }

    if (Object.keys(linear).length > 0) {
      processor = processor.linear(linear.a, linear.b);
    }

    // 4. تحسين الحدة
    if (options.sharpen && options.sharpen > 0) {
      const sigma = 0.5 + (options.sharpen - 1) * 0.5;
      processor = processor.sharpen({ sigma });
      appliedEnhancements.push(`sharpen:${options.sharpen}`);
    }

    // 5. إزالة الضوضاء
    if (options.denoise) {
      processor = processor.median(3);
      appliedEnhancements.push("denoise");
    }

    // 6. تحويل إلى JPEG مع الجودة المحددة
    const quality = options.quality || 90;
    processor = processor.jpeg({ quality });

    // تنفيذ المعالجة
    const processedBuffer = await processor.toBuffer();
    const processedMetadata = await sharp(processedBuffer).metadata();

    // تحويل إلى base64
    const base64Image = `data:image/jpeg;base64,${processedBuffer.toString("base64")}`;

    const result: PreprocessingResult = {
      base64Image,
      mimeType: "image/jpeg",
      originalWidth,
      originalHeight,
      processedWidth: processedMetadata.width || originalWidth,
      processedHeight: processedMetadata.height || originalHeight,
      originalSize,
      processedSize: processedBuffer.length,
      processingTime: Date.now() - startTime,
      appliedEnhancements
    };

    logger.info("اكتملت معالجة الصورة", {
      originalSize,
      processedSize: result.processedSize,
      compressionRatio: (result.processedSize / originalSize * 100).toFixed(1) + "%",
      processingTime: result.processingTime,
      enhancements: appliedEnhancements.length
    });

    return result;
  } catch (error: any) {
    logger.error("خطأ في معالجة الصورة", { error: error.message });
    throw error;
  }
}

/**
 * معالجة صورة من ملف محلي
 */
export async function preprocessImageFromFile(
  filePath: string,
  options: PreprocessingOptions = THERMAL_RECEIPT_PRESET
): Promise<PreprocessingResult> {
  const absolutePath = path.resolve(filePath);
  
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`الملف غير موجود: ${absolutePath}`);
  }

  const imageBuffer = fs.readFileSync(absolutePath);
  return preprocessImageBuffer(imageBuffer, options);
}

/**
 * معالجة صورة من base64
 */
export async function preprocessImageFromBase64(
  base64Data: string,
  options: PreprocessingOptions = THERMAL_RECEIPT_PRESET
): Promise<PreprocessingResult> {
  // إزالة prefix إذا وجد
  const cleanBase64 = base64Data.includes(",") 
    ? base64Data.split(",")[1] 
    : base64Data;
  
  const imageBuffer = Buffer.from(cleanBase64, "base64");
  return preprocessImageBuffer(imageBuffer, options);
}

/**
 * تحليل جودة الصورة وتحديد الإعدادات المناسبة
 */
export async function analyzeAndSelectPreset(
  imageBuffer: Buffer
): Promise<PreprocessingOptions> {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    const stats = await sharp(imageBuffer).stats();

    // حساب متوسط السطوع
    const avgBrightness = stats.channels.reduce((sum, ch) => sum + ch.mean, 0) / stats.channels.length;
    
    // حساب التباين (الانحراف المعياري)
    const avgStdDev = stats.channels.reduce((sum, ch) => sum + ch.stdev, 0) / stats.channels.length;

    logger.info("تحليل جودة الصورة", {
      avgBrightness: avgBrightness.toFixed(2),
      avgStdDev: avgStdDev.toFixed(2),
      width: metadata.width,
      height: metadata.height
    });

    // تحديد الإعدادات بناءً على التحليل
    if (avgBrightness < 80 || avgStdDev < 40) {
      // صورة مظلمة أو منخفضة التباين
      logger.info("تم اختيار إعدادات الجودة المنخفضة");
      return LOW_QUALITY_PRESET;
    } else if (avgBrightness > 200 && avgStdDev > 60) {
      // صورة واضحة
      logger.info("تم اختيار إعدادات الجودة العالية");
      return HIGH_QUALITY_PRESET;
    } else {
      // صورة عادية
      logger.info("تم اختيار الإعدادات الافتراضية للإيصالات الحرارية");
      return THERMAL_RECEIPT_PRESET;
    }
  } catch (error: any) {
    logger.warn("فشل تحليل الصورة، استخدام الإعدادات الافتراضية", { error: error.message });
    return THERMAL_RECEIPT_PRESET;
  }
}

/**
 * معالجة ذكية للصورة مع اختيار تلقائي للإعدادات
 */
export async function smartPreprocess(
  imageUrl: string
): Promise<PreprocessingResult> {
  const startTime = Date.now();

  try {
    // جلب الصورة
    let imageBuffer: Buffer;
    
    if (imageUrl.startsWith("data:")) {
      const base64Data = imageUrl.split(",")[1];
      imageBuffer = Buffer.from(base64Data, "base64");
    } else if (imageUrl.startsWith("file://") || imageUrl.startsWith("/")) {
      const filePath = imageUrl.replace("file://", "");
      imageBuffer = fs.readFileSync(filePath);
    } else {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`فشل جلب الصورة: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    }

    // تحليل الصورة واختيار الإعدادات
    const preset = await analyzeAndSelectPreset(imageBuffer);

    // معالجة الصورة
    return await preprocessImageBuffer(imageBuffer, preset, startTime, ["smart_analysis"]);
  } catch (error: any) {
    logger.error("خطأ في المعالجة الذكية", { error: error.message });
    throw error;
  }
}

// ==================== تصدير الإعدادات ====================

export const PRESETS = {
  THERMAL_RECEIPT: THERMAL_RECEIPT_PRESET,
  LOW_QUALITY: LOW_QUALITY_PRESET,
  HIGH_QUALITY: HIGH_QUALITY_PRESET
};
