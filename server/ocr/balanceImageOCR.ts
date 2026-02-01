/**
 * خدمة OCR لاستخراج المبالغ والتواريخ من صور إيصالات نقاط البيع (POS)
 * POS Receipt OCR Service
 * 
 * تستخدم LLM Vision لاستخراج:
 * 1. مجاميع المبالغ من الأقسام المختلفة (mada, VISA, MasterCard, etc.)
 * 2. التاريخ من الإيصال للتحقق من تطابقه مع تاريخ الرفع
 * 
 * التحسينات (1 فبراير 2026):
 * - دعم base64 data URL للصور
 * - تصحيح تلقائي للتاريخ (أخطاء OCR الشائعة)
 * - prompt محسّن مع السنة الحالية كمرجع
 * - إزالة response_format لتجنب أخطاء undefined
 */

import { invokeLLM, type Message } from "../_core/llm";
import { createLogger } from "../utils/logger";
import { storageGet } from "../storage";

const logger = createLogger("BalanceImageOCR");

// ==================== الأنواع ====================
export interface BalanceImage {
  url: string;
  key: string;
  uploadedAt: string;
}

export interface POSSection {
  name: string; // mada, VISA, MasterCard, DISCOVER, etc.
  hostTotal: number;
  terminalTotal: number;
  count: number;
}

export interface OCRExtractionResult {
  success: boolean;
  extractedAmount: number | null;
  extractedDate: string | null; // YYYY-MM-DD format
  sections: POSSection[];
  grandTotal: number | null;
  confidence: "high" | "medium" | "low" | "none";
  rawText: string | null;
  error?: string;
}

export interface BalanceVerificationResult {
  success: boolean;
  isMatched: boolean;
  isDateMatched: boolean;
  extractedAmount: number | null;
  expectedAmount: number;
  difference: number | null;
  extractedDate: string | null;
  expectedDate: string;
  confidence: "high" | "medium" | "low" | "none";
  message: string;
  sections?: POSSection[];
  details?: {
    rawText: string | null;
    processingTime: number;
  };
  // إشعارات للمستخدم
  warnings: OCRWarning[];
}

// أنواع الإشعارات
export type OCRWarningType = 
  | "no_date" 
  | "unclear_image" 
  | "low_confidence" 
  | "partial_read" 
  | "date_mismatch" 
  | "amount_mismatch"
  | "no_sections";

export interface OCRWarning {
  type: OCRWarningType;
  severity: "info" | "warning" | "error";
  message: string;
  suggestion?: string;
}

// ==================== الثوابت ====================
// نظام التسامح المتدرج (Graduated Tolerance System)
// المبالغ الصغيرة تحتاج هامش أكبر لأن الفرق الصغير يكون نسبة كبيرة
export const TOLERANCE_TIERS = [
  { maxAmount: 500, tolerance: 0.03 },    // 3% للمبالغ أقل من 500
  { maxAmount: 2000, tolerance: 0.025 },  // 2.5% للمبالغ 500-2000
  { maxAmount: 5000, tolerance: 0.02 },   // 2% للمبالغ 2000-5000
  { maxAmount: 10000, tolerance: 0.015 }, // 1.5% للمبالغ 5000-10000
  { maxAmount: Infinity, tolerance: 0.01 } // 1% للمبالغ أكثر من 10000
];

// القيمة الافتراضية للتوافق العكسي
export const AMOUNT_TOLERANCE_PERCENTAGE = 0.02; // 2% tolerance for OCR errors (default)
export const MIN_CONFIDENCE_FOR_VALIDATION = "medium";
export const DATE_TOLERANCE_DAYS = 1; // السماح بفرق يوم واحد في التاريخ

// السنة الحالية للتصحيح التلقائي
const CURRENT_YEAR = new Date().getFullYear();

// ==================== دوال مساعدة ====================

/**
 * تنظيف النص المستخرج وتحويله إلى رقم
 * يدعم الأرقام العربية (٠-٩) والغربية (0-9)
 */
export function parseExtractedAmount(text: string | null | undefined): number | null {
  if (!text) return null;
  
  let str = text.toString();
  
  // تحويل الأرقام العربية إلى غربية
  const arabicNumerals: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '٫': '.' // الفاصلة العربية
  };
  
  for (const [arabic, western] of Object.entries(arabicNumerals)) {
    str = str.split(arabic).join(western);
  }
  
  // معالجة التنسيق الأوروبي (1.500,00 → 1500.00)
  // إذا كان هناك نقطة كفاصل آلاف وفاصلة كعشرية
  if (str.includes(',') && str.includes('.')) {
    // التنسيق الأوروبي: 1.500,00
    if (str.lastIndexOf('.') < str.lastIndexOf(',')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // التنسيق الأمريكي: 1,500.00
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // فاصلة فقط - قد تكون عشرية أو آلاف
    const parts = str.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      // فاصلة عشرية
      str = str.replace(',', '.');
    } else {
      // فاصلة آلاف
      str = str.replace(/,/g, '');
    }
  }
  
  // معالجة النقاط المتعددة (1.500.00 → 1500.00)
  const dots = str.match(/\./g);
  if (dots && dots.length > 1) {
    // النقطة الأخيرة هي العشرية، الباقي فواصل آلاف
    const lastDotIndex = str.lastIndexOf('.');
    const beforeDot = str.substring(0, lastDotIndex).replace(/\./g, '');
    const afterDot = str.substring(lastDotIndex);
    str = beforeDot + afterDot;
  }
  
  // إزالة كل شيء ما عدا الأرقام والنقطة
  const cleaned = str.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

/**
 * تصحيح أخطاء OCR الشائعة في التاريخ
 * مثل: 2016 → 2026، 2O26 → 2026
 */
export function correctDateOCRErrors(dateStr: string | null): string | null {
  if (!dateStr) return null;
  
  let corrected = dateStr;
  
  // تصحيح الحروف التي تشبه الأرقام
  corrected = corrected
    .replace(/O/gi, '0')  // O → 0
    .replace(/l/g, '1')   // l → 1
    .replace(/I/g, '1')   // I → 1
    .replace(/S/g, '5')   // S → 5
    .replace(/B/g, '8');  // B → 8
  
  // تصحيح السنة إذا كانت قريبة من السنة الحالية
  // مثل: 2016 → 2026 (خطأ شائع في قراءة 0 كـ 1)
  const yearPatterns = [
    { wrong: '2016', correct: '2026' },
    { wrong: '2015', correct: '2025' },
    { wrong: '2017', correct: '2027' },
    { wrong: '2006', correct: '2026' },
    { wrong: '2O26', correct: '2026' },
    { wrong: '20Z6', correct: '2026' },
  ];
  
  for (const pattern of yearPatterns) {
    if (corrected.includes(pattern.wrong)) {
      corrected = corrected.replace(pattern.wrong, pattern.correct);
      logger.info(`تصحيح التاريخ: ${pattern.wrong} → ${pattern.correct}`);
    }
  }
  
  // التحقق من أن السنة منطقية (بين 2020 و 2030)
  const yearMatch = corrected.match(/20\d{2}/);
  if (yearMatch) {
    const year = parseInt(yearMatch[0]);
    if (year < 2020 || year > 2030) {
      // محاولة تصحيح السنة إلى السنة الحالية
      corrected = corrected.replace(yearMatch[0], CURRENT_YEAR.toString());
      logger.info(`تصحيح السنة غير المنطقية: ${yearMatch[0]} → ${CURRENT_YEAR}`);
    }
  }
  
  return corrected;
}

/**
 * تطبيع التاريخ إلى تنسيق YYYY-MM-DD
 */
export function normalizeDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  
  // تصحيح أخطاء OCR أولاً
  const correctedDate = correctDateOCRErrors(dateStr);
  if (!correctedDate) return null;
  
  // محاولة تحليل التنسيقات المختلفة
  const formats = [
    // DD/MM/YYYY or DD-MM-YYYY
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
    // YYYY/MM/DD or YYYY-MM-DD
    /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/,
    // DD.MM.YYYY
    /(\d{1,2})\.(\d{1,2})\.(\d{4})/
  ];

  for (const format of formats) {
    const match = correctedDate.match(format);
    if (match) {
      let year: number, month: number, day: number;
      
      if (match[1].length === 4) {
        // YYYY-MM-DD format
        year = parseInt(match[1]);
        month = parseInt(match[2]);
        day = parseInt(match[3]);
      } else {
        // DD-MM-YYYY format
        day = parseInt(match[1]);
        month = parseInt(match[2]);
        year = parseInt(match[3]);
      }
      
      // التحقق من صحة التاريخ
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
      }
    }
  }
  
  return null;
}

/**
 * حساب نسبة التسامح المتدرجة بناءً على المبلغ
 */
export function calculateGraduatedTolerance(amount: number): number {
  for (const tier of TOLERANCE_TIERS) {
    if (amount <= tier.maxAmount) {
      return tier.tolerance;
    }
  }
  return TOLERANCE_TIERS[TOLERANCE_TIERS.length - 1].tolerance;
}

/**
 * التحقق من تطابق المبالغ مع التسامح المتدرج
 */
export function amountsMatch(
  extracted: number,
  expected: number,
  tolerancePercent?: number
): boolean {
  if (expected === 0) return extracted === 0;
  
  // استخدام التسامح المتدرج إذا لم يتم تحديد نسبة مخصصة
  const tolerance = tolerancePercent ?? calculateGraduatedTolerance(expected);
  const allowedDifference = expected * tolerance;
  
  return Math.abs(extracted - expected) <= allowedDifference;
}

/**
 * الحصول على تفاصيل التسامح للعرض للمستخدم
 */
export function getToleranceDetails(amount: number): {
  percentage: number;
  allowedDifference: number;
  tier: string;
} {
  const percentage = calculateGraduatedTolerance(amount);
  const allowedDifference = amount * percentage;
  
  let tier: string;
  if (amount <= 500) tier = 'مبلغ صغير (أقل من 500)';
  else if (amount <= 2000) tier = 'مبلغ متوسط (500-2000)';
  else if (amount <= 5000) tier = 'مبلغ كبير (2000-5000)';
  else if (amount <= 10000) tier = 'مبلغ ضخم (5000-10000)';
  else tier = 'مبلغ كبير جداً (أكثر من 10000)';
  
  return { percentage, allowedDifference, tier };
}

/**
 * تحديد مستوى الثقة بناءً على استجابة LLM
 */
export function determineConfidence(
  llmConfidence: string | undefined,
  extractedAmount: number | null
): "high" | "medium" | "low" | "none" {
  if (extractedAmount === null) return "none";
  
  const conf = llmConfidence?.toLowerCase() || "";
  if (conf.includes("high") || conf.includes("عالي")) return "high";
  if (conf.includes("medium") || conf.includes("متوسط")) return "medium";
  if (conf.includes("low") || conf.includes("منخفض")) return "low";
  
  // إذا لم يحدد، نفترض متوسط إذا تم استخراج مبلغ
  return extractedAmount !== null ? "medium" : "none";
}

/**
 * استخراج تاريخ الرفع من uploadedAt
 */
export function getUploadDate(uploadedAt: string): string {
  try {
    const date = new Date(uploadedAt);
    return date.toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

/**
 * تحويل رابط الصورة إلى base64 data URL
 * هذا يحل مشكلة "NO IMAGE AVAILABLE" مع روابط S3
 * 
 * يدعم:
 * - روابط S3/HTTP (يتم جلبها وتحويلها)
 * - ملفات محلية (يتم قراءتها مباشرة)
 * - روابط base64 (يتم إعادتها كما هي)
 * - مفاتيح S3 (يتم الحصول على رابط جديد عبر storageGet)
 * 
 * تحسين (1 فبراير 2026):
 * - عند فشل التحميل بخطأ 403، يتم محاولة استخراج مفتاح S3 والحصول على رابط جديد
 */
async function fetchImageAsBase64(imageUrl: string, s3Key?: string): Promise<string> {
  const fs = await import('fs');
  
  try {
    // إذا كان الرابط بالفعل base64، نعيده كما هو
    if (imageUrl.startsWith('data:')) {
      return imageUrl;
    }
    
    // إذا كان ملف محلي
    if (imageUrl.startsWith('/') || imageUrl.startsWith('file://')) {
      const filePath = imageUrl.replace('file://', '');
      const buffer = fs.readFileSync(filePath);
      const base64 = buffer.toString('base64');
      // تحديد نوع الصورة من الامتداد
      const ext = filePath.split('.').pop()?.toLowerCase() || 'jpeg';
      const mimeTypes: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp'
      };
      const contentType = mimeTypes[ext] || 'image/jpeg';
      return `data:${contentType};base64,${base64}`;
    }
    
    // جلب الصورة من الرابط HTTP/HTTPS
    logger.info("بدء تحميل الصورة", {
      hasS3Key: !!s3Key,
      urlPreview: imageUrl.substring(0, 80)
    });
    
    let response = await fetch(imageUrl, {
      headers: {
        'Accept': 'image/*'
      }
    });
    
    // إذا فشل التحميل بخطأ 403 (انتهاء صلاحية الرابط)، نحاول الحصول على رابط جديد
    if (!response.ok && (response.status === 403 || response.status === 401)) {
      logger.warn(`رابط S3 منتهي الصلاحية (${response.status})، محاولة الحصول على رابط جديد`, {
        status: response.status,
        providedKey: s3Key || 'none'
      });
      
      // محاولة استخراج مفتاح S3 من الرابط أو استخدام المفتاح المُمرر
      const key = s3Key || extractS3KeyFromUrl(imageUrl);
      
      logger.info("مفتاح S3 المستخدم للحصول على رابط جديد", {
        key: key || 'NOT_FOUND',
        source: s3Key ? 'provided' : 'extracted'
      });
      
      if (key) {
        try {
          logger.info("الحصول على رابط جديد من S3", { key });
          const { url: freshUrl } = await storageGet(key);
          
          logger.info("تم الحصول على رابط جديد", { 
            freshUrlPreview: freshUrl.substring(0, 80) 
          });
          
          // محاولة التحميل بالرابط الجديد
          response = await fetch(freshUrl, {
            headers: {
              'Accept': 'image/*'
            }
          });
          
          if (response.ok) {
            logger.info("✅ تم الحصول على الصورة بنجاح بالرابط الجديد");
          } else {
            logger.error("❌ فشل التحميل بالرابط الجديد أيضاً", {
              status: response.status,
              statusText: response.statusText
            });
          }
        } catch (storageError: any) {
          logger.error("فشل الحصول على رابط جديد من S3", { 
            error: storageError.message,
            key 
          });
        }
      } else {
        logger.error("❌ لا يوجد مفتاح S3 للحصول على رابط جديد", {
          originalUrl: imageUrl.substring(0, 100)
        });
      }
    }
    
    if (!response.ok) {
      logger.error("فشل تحميل الصورة نهائياً", {
        status: response.status,
        statusText: response.statusText,
        hasKey: !!s3Key
      });
      throw new Error(`فشل تحميل الصورة: HTTP ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    
    // تحديد نوع الصورة
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    return `data:${contentType};base64,${base64}`;
  } catch (error: any) {
    logger.error("خطأ في تحويل الصورة إلى base64", { error: error.message, imageUrl: imageUrl.substring(0, 100) });
    
    // محاولة أخيرة: إذا كان لدينا مفتاح S3، نحاول الحصول على رابط جديد
    if (s3Key) {
      try {
        logger.info("محاولة أخيرة: الحصول على رابط جديد من S3", { key: s3Key });
        const { url: freshUrl } = await storageGet(s3Key);
        
        const response = await fetch(freshUrl, {
          headers: { 'Accept': 'image/*' }
        });
        
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const base64 = buffer.toString('base64');
          const contentType = response.headers.get('content-type') || 'image/jpeg';
          logger.info("نجحت المحاولة الأخيرة في تحميل الصورة");
          return `data:${contentType};base64,${base64}`;
        }
      } catch (lastError: any) {
        logger.error("فشلت المحاولة الأخيرة", { error: lastError.message });
      }
    }
    
    // إعادة الرابط الأصلي كـ fallback (قد لا يعمل مع LLM)
    logger.warn("سيتم استخدام الرابط الأصلي - قد لا يعمل مع بعض الصور");
    return imageUrl;
  }
}

/**
 * استخراج مفتاح S3 من رابط URL
 * يدعم روابط CloudFront و S3 المباشرة و Manus Storage
 * 
 * الروابط المدعومة:
 * - CloudFront: https://xxx.cloudfront.net/revenues/image.jpg
 * - S3 Direct: https://bucket.s3.region.amazonaws.com/key.jpg
 * - Manus Storage: https://storage.manus.im/v1/xxx/revenues/image.jpg
 */
function extractS3KeyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const hostname = urlObj.hostname;
    
    logger.info("محاولة استخراج مفتاح S3", { 
      hostname, 
      pathname: pathname.substring(0, 100),
      hasQueryParams: urlObj.search.length > 0
    });
    
    // إزالة الـ / الأولى
    let key = pathname.startsWith('/') ? pathname.substring(1) : pathname;
    
    // CloudFront URLs
    if (hostname.includes('cloudfront.net')) {
      // المسار هو المفتاح مباشرة
      if (key && /\.(jpg|jpeg|png|gif|webp)$/i.test(key)) {
        logger.info("تم استخراج مفتاح S3 من CloudFront", { key });
        return key;
      }
    }
    
    // S3 Direct URLs
    if (hostname.includes('s3.') || hostname.includes('amazonaws.com')) {
      // قد يكون المفتاح مشفراً
      const decodedKey = decodeURIComponent(key);
      if (decodedKey && /\.(jpg|jpeg|png|gif|webp)$/i.test(decodedKey)) {
        logger.info("تم استخراج مفتاح S3 من S3 Direct", { key: decodedKey });
        return decodedKey;
      }
    }
    
    // Manus Storage URLs
    if (hostname.includes('manus') || hostname.includes('storage')) {
      // البحث عن مسار الصورة في الـ pathname
      // مثال: /v1/storage/xxx/revenues/image.jpg
      const imagePathMatch = pathname.match(/\/(revenues\/[^?]+\.(jpg|jpeg|png|gif|webp))/i);
      if (imagePathMatch) {
        logger.info("تم استخراج مفتاح S3 من Manus Storage", { key: imagePathMatch[1] });
        return imagePathMatch[1];
      }
    }
    
    // محاولة عامة: البحث عن أي مسار ينتهي بامتداد صورة
    const generalMatch = pathname.match(/\/([^?]+\.(jpg|jpeg|png|gif|webp))/i);
    if (generalMatch) {
      const extractedKey = generalMatch[1];
      logger.info("تم استخراج مفتاح S3 (محاولة عامة)", { key: extractedKey });
      return extractedKey;
    }
    
    // التحقق من أن المفتاح يبدو صالحاً (يحتوي على امتداد صورة)
    if (key && /\.(jpg|jpeg|png|gif|webp)$/i.test(key)) {
      logger.info("تم استخراج مفتاح S3 من الرابط", { key });
      return key;
    }
    
    logger.warn("لم يتم العثور على مفتاح S3 صالح في الرابط", { 
      url: url.substring(0, 100) 
    });
    return null;
  } catch (error: any) {
    logger.error("خطأ في استخراج مفتاح S3", { error: error.message });
    return null;
  }
}

/**
 * استخراج JSON من نص قد يحتوي على markdown
 */
function extractJsonFromResponse(content: string): any {
  // محاولة إزالة markdown code blocks
  let jsonStr = content.trim();
  
  // إزالة ```json ... ```
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }
  
  // محاولة التحليل
  return JSON.parse(jsonStr);
}

// ==================== الدوال الرئيسية ====================

/**
 * استخراج المبالغ والتاريخ من صورة إيصال نقاط البيع
 * يستخدم استراتيجية إعادة المحاولة مع prompts متعددة للحصول على أفضل نتيجة
 * 
 * @param imageUrl رابط الصورة (S3, محلي، أو base64)
 * @param useRetryStrategy استخدام استراتيجية إعادة المحاولة (افتراضي: true)
 * @param s3Key مفتاح S3 للحصول على رابط جديد عند انتهاء صلاحية الرابط
 */
export async function extractAmountFromImage(
  imageUrl: string,
  useRetryStrategy: boolean = true,
  s3Key?: string
): Promise<OCRExtractionResult> {
  const startTime = Date.now();
  
  // استخدام استراتيجية إعادة المحاولة للحصول على أفضل نتيجة
  if (useRetryStrategy) {
    try {
      const { extractWithRetry } = await import("./ocrRetryStrategy");
      const retryResult = await extractWithRetry(imageUrl, {
        maxRetries: 3,
        combineResults: true
      });
      
      logger.info("نتيجة استراتيجية إعادة المحاولة", {
        success: retryResult.success,
        attempts: retryResult.attempts.length,
        grandTotal: retryResult.finalResult.grandTotal,
        processingTime: Date.now() - startTime
      });
      
      return retryResult.finalResult;
    } catch (retryError: any) {
      logger.warn("فشل استراتيجية إعادة المحاولة، الرجوع للطريقة الأساسية", {
        error: retryError.message
      });
      // الرجوع للطريقة الأساسية
    }
  }
  
  try {
    logger.info("بدء استخراج المبالغ والتاريخ من صورة إيصال POS (الطريقة الأساسية)", { 
      imageUrl: imageUrl.substring(0, 50) + "..." 
    });

    // تحويل الصورة إلى base64 لتجنب مشكلة "NO IMAGE AVAILABLE"
    // تمرير مفتاح S3 للحصول على رابط جديد في حالة انتهاء صلاحية الرابط (403)
    const base64ImageUrl = await fetchImageAsBase64(imageUrl, s3Key);
    logger.info("تم تحويل الصورة إلى base64", {
      originalLength: imageUrl.length,
      base64Length: base64ImageUrl.length
    });

    const messages: Message[] = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `أنت خبير في قراءة إيصالات نقاط البيع (POS Terminal Receipts).

هذه صورة إيصال موازنة يومية. السنة الحالية هي ${CURRENT_YEAR}.

استخرج البيانات التالية:
1. التاريخ من أعلى الإيصال (بتنسيق YYYY-MM-DD)
2. مجموع TOTALS لكل قسم (mada, VISA, MasterCard, DISCOVER, Maestro, GCCNET, UNIONPAY)
3. المجموع الكلي لجميع الأقسام

ملاحظات مهمة:
- ابحث عن "TOTALS" في كل قسم - هذا هو المجموع المطلوب
- إذا كان القسم يحتوي على "NO TRANSACTIONS" فالمجموع = 0
- المبالغ بالريال السعودي (SAR)
- السنة في التاريخ يجب أن تكون ${CURRENT_YEAR} أو قريبة منها

أجب بتنسيق JSON فقط (بدون أي نص إضافي):
{
  "date": "YYYY-MM-DD",
  "sections": [
    {"name": "mada", "total": 0, "count": 0},
    {"name": "VISA", "total": 0, "count": 0}
  ],
  "grandTotal": 0,
  "confidence": "high/medium/low",
  "rawText": "ملخص قصير لما قرأته"
}`
          },
          {
            type: "image_url",
            image_url: {
              url: base64ImageUrl,
              detail: "high"
            }
          }
        ]
      }
    ];

    const response = await invokeLLM({
      messages,
      temperature: 0.1 // درجة حرارة منخفضة للدقة
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("لم يتم استلام استجابة من LLM");
    }

    logger.info("استجابة LLM الخام", { content: content.substring(0, 200) });

    const parsed = extractJsonFromResponse(content);
    
    // معالجة الأقسام
    const sections: POSSection[] = (parsed.sections || []).map((s: any) => ({
      name: s.name || "unknown",
      hostTotal: parseExtractedAmount(s.total?.toString()) || parseExtractedAmount(s.hostTotal?.toString()) || 0,
      terminalTotal: parseExtractedAmount(s.total?.toString()) || parseExtractedAmount(s.terminalTotal?.toString()) || 0,
      count: parseInt(s.count?.toString() || "0") || 0
    }));

    // حساب المجموع الكلي من الأقسام
    const calculatedTotal = sections.reduce((sum, s) => sum + Math.max(s.hostTotal, s.terminalTotal), 0);
    const extractedGrandTotal = parseExtractedAmount(parsed.grandTotal?.toString());
    
    // استخدام المجموع المحسوب إذا كان أكبر من المستخرج (للتأكد من عدم فقدان أي قسم)
    const grandTotal = Math.max(calculatedTotal, extractedGrandTotal || 0);

    // تطبيع التاريخ مع تصحيح أخطاء OCR
    const extractedDate = normalizeDate(parsed.date);
    const confidence = determineConfidence(parsed.confidence, grandTotal);

    const processingTime = Date.now() - startTime;
    logger.info("تم استخراج البيانات من إيصال POS", { 
      grandTotal, 
      extractedDate,
      sectionsCount: sections.length,
      confidence, 
      processingTime 
    });

    return {
      success: true,
      extractedAmount: grandTotal,
      extractedDate,
      sections,
      grandTotal,
      confidence,
      rawText: parsed.rawText
    };

  } catch (error: any) {
    logger.error("خطأ في استخراج البيانات من صورة الإيصال", error);
    return {
      success: false,
      extractedAmount: null,
      extractedDate: null,
      sections: [],
      grandTotal: null,
      confidence: "none",
      rawText: null,
      error: error.message || "خطأ غير معروف"
    };
  }
}

/**
 * توليد الإشعارات بناءً على نتيجة التحقق
 */
export function generateWarnings(
  extractionResult: OCRExtractionResult,
  isAmountMatched: boolean,
  isDateMatched: boolean,
  extractedDate: string | null,
  expectedDate: string,
  extractedAmount: number | null,
  expectedAmount: number
): OCRWarning[] {
  const warnings: OCRWarning[] = [];

  // تحذير عدم وجود تاريخ
  if (!extractedDate) {
    warnings.push({
      type: "no_date",
      severity: "warning",
      message: "لم نتمكن من قراءة التاريخ من الإيصال",
      suggestion: "تأكد من أن التاريخ واضح في أعلى الإيصال وغير مقطوع"
    });
  }

  // تحذير عدم تطابق التاريخ
  if (extractedDate && !isDateMatched) {
    warnings.push({
      type: "date_mismatch",
      severity: "error",
      message: `التاريخ غير مطابق: تاريخ الإيصال ${extractedDate}، التاريخ المتوقع ${expectedDate}`,
      suggestion: "تأكد من رفع إيصال اليوم الصحيح"
    });
  }

  // تحذير عدم تطابق المبلغ
  if (extractedAmount !== null && !isAmountMatched) {
    const diff = Math.abs(extractedAmount - expectedAmount);
    warnings.push({
      type: "amount_mismatch",
      severity: "error",
      message: `المبلغ غير مطابق: المتوقع ${expectedAmount.toFixed(2)} ر.س، المستخرج ${extractedAmount.toFixed(2)} ر.س (فرق: ${diff.toFixed(2)} ر.س)`,
      suggestion: "تأكد من إدخال مبلغ الشبكة الصحيح"
    });
  }

  // تحذير الصورة غير الواضحة (ثقة منخفضة)
  if (extractionResult.confidence === "low" || extractionResult.confidence === "none") {
    warnings.push({
      type: "low_confidence",
      severity: "warning",
      message: "جودة الصورة منخفضة أو غير واضحة",
      suggestion: "يرجى رفع صورة أوضح بإضاءة جيدة وبدون اهتزاز"
    });
  }

  // تحذير عدم وجود أقسام
  if (extractionResult.sections.length === 0) {
    warnings.push({
      type: "no_sections",
      severity: "warning",
      message: "لم نتمكن من قراءة أقسام الإيصال (mada, VISA, etc.)",
      suggestion: "تأكد من أن الإيصال يظهر بالكامل في الصورة"
    });
  }

  // تحذير القراءة الجزئية (بعض الأقسام فقط)
  if (extractionResult.sections.length > 0 && extractionResult.sections.length < 3) {
    warnings.push({
      type: "partial_read",
      severity: "info",
      message: `تم قراءة ${extractionResult.sections.length} قسم فقط من الإيصال`,
      suggestion: "تأكد من أن جميع أقسام الإيصال واضحة في الصورة"
    });
  }

  // تحذير الصورة غير الواضحة (ثقة منخفضة + لا توجد أقسام)
  if ((extractionResult.confidence === "low" || extractionResult.confidence === "none") && extractionResult.sections.length === 0) {
    warnings.push({
      type: "unclear_image",
      severity: "error",
      message: "الصورة غير واضحة ولم نتمكن من قراءتها",
      suggestion: "يرجى رفع صورة أوضح بإضاءة جيدة وبدون اهتزاز"
    });
  }

  return warnings;
}

/**
 * التحقق من تطابق التواريخ مع السماح بفرق يوم واحد
 * @param extractedDate التاريخ المستخرج
 * @param expectedDate التاريخ المتوقع
 * @param toleranceDays عدد أيام التسامح (افتراضي: DATE_TOLERANCE_DAYS)
 */
export function datesMatch(
  extractedDate: string | null,
  expectedDate: string,
  toleranceDays: number = DATE_TOLERANCE_DAYS
): boolean {
  if (!extractedDate) return false;
  
  try {
    const extracted = new Date(extractedDate);
    const expected = new Date(expectedDate);
    
    // التحقق من صحة التواريخ
    if (isNaN(extracted.getTime()) || isNaN(expected.getTime())) {
      return false;
    }
    
    // حساب الفرق بالأيام
    const diffTime = Math.abs(extracted.getTime() - expected.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // إذا كان التسامح 0، يجب أن يكون الفرق 0 تماماً
    if (toleranceDays === 0) {
      return diffTime === 0;
    }
    
    return diffDays <= toleranceDays;
  } catch {
    return false;
  }
}

/**
 * التحقق من صورة الموازنة ومطابقتها مع المبلغ المتوقع
 */
export async function verifyBalanceImage(
  balanceImages: BalanceImage | BalanceImage[],
  expectedNetworkAmount: number,
  expectedDate: string
): Promise<BalanceVerificationResult> {
  const startTime = Date.now();
  
  // تحويل إلى مصفوفة إذا كان كائن واحد
  const images = Array.isArray(balanceImages) ? balanceImages : [balanceImages];
  
  // إذا لم يكن هناك مبلغ شبكة، لا داعي للتحقق
  if (expectedNetworkAmount === 0) {
    return {
      success: true,
      isMatched: true,
      isDateMatched: true,
      extractedAmount: 0,
      expectedAmount: 0,
      difference: 0,
      extractedDate: expectedDate,
      expectedDate,
      confidence: "high",
      message: "لا يوجد مبلغ شبكة للتحقق منه",
      warnings: []
    };
  }

  try {
    // استخراج البيانات من أول صورة (الصورة الرئيسية)
    const primaryImage = images[0];
    if (!primaryImage || !primaryImage.url) {
      throw new Error("لم يتم توفير صورة صالحة");
    }
    
    // تمرير مفتاح S3 للحصول على رابط جديد في حالة انتهاء صلاحية الرابط الحالي
    const extractionResult = await extractAmountFromImage(primaryImage.url, true, primaryImage.key);

    if (!extractionResult.success || extractionResult.grandTotal === null) {
      const warnings: OCRWarning[] = [{
        type: "unclear_image",
        severity: "error",
        message: extractionResult.error || "لم نتمكن من قراءة المبالغ من صورة الموازنة",
        suggestion: "يرجى رفع صورة أوضح بإضاءة جيدة وبدون اهتزاز"
      }];
      
      return {
        success: false,
        isMatched: false,
        isDateMatched: false,
        extractedAmount: null,
        expectedAmount: expectedNetworkAmount,
        difference: null,
        extractedDate: extractionResult.extractedDate,
        expectedDate,
        confidence: extractionResult.confidence,
        message: extractionResult.error || "لم نتمكن من قراءة المبالغ من صورة الموازنة",
        sections: extractionResult.sections,
        details: {
          rawText: extractionResult.rawText,
          processingTime: Date.now() - startTime
        },
        warnings
      };
    }

    const extractedAmount = extractionResult.grandTotal;
    const extractedDate = extractionResult.extractedDate;
    const difference = Math.abs(extractedAmount - expectedNetworkAmount);
    const isAmountMatched = amountsMatch(extractedAmount, expectedNetworkAmount);
    const isDateMatched = datesMatch(extractedDate, expectedDate);

    // توليد الإشعارات
    const warnings = generateWarnings(
      extractionResult,
      isAmountMatched,
      isDateMatched,
      extractedDate,
      expectedDate,
      extractedAmount,
      expectedNetworkAmount
    );

    // تحديد الرسالة بناءً على النتيجة
    const messages: string[] = [];
    
    // رسالة المبلغ
    if (isAmountMatched) {
      if (difference === 0) {
        messages.push("✅ المبلغ مطابق تماماً");
      } else {
        messages.push(`✅ المبلغ مطابق (فرق بسيط: ${difference.toFixed(2)} ر.س)`);
      }
    } else {
      messages.push(`❌ المبلغ غير مطابق: المتوقع ${expectedNetworkAmount.toFixed(2)} ر.س، المستخرج ${extractedAmount.toFixed(2)} ر.س (فرق: ${difference.toFixed(2)} ر.س)`);
    }
    
    // رسالة التاريخ
    if (isDateMatched) {
      messages.push("✅ التاريخ مطابق");
    } else if (extractedDate) {
      messages.push(`❌ التاريخ غير مطابق: تاريخ الإيصال ${extractedDate}، التاريخ المتوقع ${expectedDate}`);
    } else {
      messages.push("⚠️ لم نتمكن من قراءة التاريخ");
    }

    const processingTime = Date.now() - startTime;
    
    return {
      success: isAmountMatched && isDateMatched,
      isMatched: isAmountMatched,
      isDateMatched,
      extractedAmount,
      expectedAmount: expectedNetworkAmount,
      difference,
      extractedDate,
      expectedDate,
      confidence: extractionResult.confidence,
      message: messages.join(" | "),
      sections: extractionResult.sections,
      details: {
        rawText: extractionResult.rawText,
        processingTime
      },
      warnings
    };

  } catch (error: any) {
    logger.error("خطأ في التحقق من صورة الموازنة", error);
    
    return {
      success: false,
      isMatched: false,
      isDateMatched: false,
      extractedAmount: null,
      expectedAmount: expectedNetworkAmount,
      difference: null,
      extractedDate: null,
      expectedDate,
      confidence: "none",
      message: `خطأ في التحقق: ${error.message}`,
      warnings: [{
        type: "unclear_image",
        severity: "error",
        message: `خطأ في التحقق: ${error.message}`,
        suggestion: "يرجى المحاولة مرة أخرى أو رفع صورة مختلفة"
      }]
    };
  }
}


/**
 * التحقق من كفاية مستوى الثقة
 */
export function isConfidenceSufficient(
  confidence: "high" | "medium" | "low" | "none"
): boolean {
  return confidence === "high" || confidence === "medium";
}

/**
 * الحصول على رسالة تحذير بناءً على مستوى الثقة
 */
export function getConfidenceWarning(
  confidence: "high" | "medium" | "low" | "none"
): string | null {
  switch (confidence) {
    case "high":
      return null;
    case "medium":
      return "جودة الصورة متوسطة - النتائج قد تكون غير دقيقة 100%";
    case "low":
      return "جودة الصورة منخفضة - يرجى رفع صورة أوضح";
    case "none":
      return "لم نتمكن من قراءة الصورة - يرجى التأكد من وضوح الصورة";
    default:
      return null;
  }
}

/**
 * التحقق من التاريخ فقط (بدون المبلغ)
 */
export function verifyDateOnly(
  extractedDate: string | null,
  expectedDate: string
): { isMatched: boolean; message: string } {
  if (!extractedDate) {
    return {
      isMatched: false,
      message: "لم نتمكن من قراءة التاريخ من الإيصال"
    };
  }
  
  const isMatched = datesMatch(extractedDate, expectedDate);
  
  if (isMatched) {
    return {
      isMatched: true,
      message: "التاريخ مطابق"
    };
  }
  
  return {
    isMatched: false,
    message: `التاريخ غير مطابق: تاريخ الإيصال ${extractedDate}، التاريخ المتوقع ${expectedDate}`
  };
}
