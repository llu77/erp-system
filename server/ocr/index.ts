/**
 * ============================================
 * Manus OCR System v3.0
 * ============================================
 * 
 * نظام OCR متكامل لاستخراج البيانات من إيصالات POS
 * 
 * المكونات:
 * ─────────
 * 1. balanceImageOCR - الخدمة الرئيسية للتحقق من صور الموازنة
 * 2. ocrRetryStrategy - استراتيجية إعادة المحاولة مع Smart Fallback
 * 3. receiptEnhancer - معالجة الصور الضعيفة
 * 
 * الاستخدام:
 * ─────────
 * ```typescript
 * import { verifyBalanceImage, extractAmountFromImage } from './ocr';
 * 
 * // التحقق من صورة موازنة
 * const result = await verifyBalanceImage(
 *   { url: 'https://...', key: 'receipts/image.jpg', uploadedAt: '2026-02-01' },
 *   expectedAmount,
 *   '2026-02-01'
 * );
 * 
 * // استخراج البيانات فقط (v3.0 API)
 * const extraction = await extractAmountFromImage(imageUrl, {
 *   s3Key: 'receipts/image.jpg',
 *   useRetryStrategy: true
 * });
 * ```
 * 
 * @author Manus Team
 * @version 3.0.0
 * @date 2026-02-01
 */

// ==================== تصدير من balanceImageOCR ====================
export {
  // الدوال الرئيسية
  verifyBalanceImage,
  extractAmountFromImage,
  
  // دوال مساعدة
  parseExtractedAmount,
  normalizeDate,
  correctDateOCRErrors,
  amountsMatch,
  datesMatch,
  calculateGraduatedTolerance,
  getToleranceDetails,
  determineConfidence,
  isConfidenceSufficient,
  generateWarnings,
  getUploadDate,
  getConfidenceWarning,
  verifyDateOnly,
  
  // الثوابت
  TOLERANCE_TIERS,
  DATE_TOLERANCE_DAYS,
  AMOUNT_TOLERANCE_PERCENTAGE,
  MIN_CONFIDENCE_FOR_VALIDATION,
  
  // الأنواع
  type BalanceImage,
  type POSSection,
  type OCRExtractionResult,
  type BalanceVerificationResult,
  type OCRWarning,
  type OCRWarningType,
  type ExtractionOptions // ✅ جديد v3.0
} from "./balanceImageOCR";

// ==================== تصدير من ocrRetryStrategy ====================
export {
  // الدالة الرئيسية
  extractWithRetry,
  
  // الثوابت
  PROMPTS,
  
  // الأنواع
  type RetryConfig,
  type RetryResult,
  type AttemptResult,
  type PromptVariant
} from "./ocrRetryStrategy";

// ==================== تصدير من receiptEnhancer ====================
export {
  // الفئة
  ReceiptEnhancer,
  
  // الدوال
  enhanceReceiptImage,
  enhanceWeakReceiptImage,
  analyzeReceiptImage,
  
  // الثوابت
  OPTIMAL_CONFIG,
  WEAK_IMAGE_CONFIG,
  
  // الأنواع
  type EnhancementConfig,
  type ImageStats,
  type OCRReadiness,
  type EnhancementResult
} from "./receiptEnhancer";

// ==================== معلومات الإصدار ====================
export const VERSION = {
  major: 3,
  minor: 0,
  patch: 0,
  full: "3.0.0",
  date: "2026-02-01",
  changes: [
    "دعم Claude Opus 4.5 كنموذج أساسي",
    "تمرير s3Key بشكل صحيح عبر جميع الطبقات",
    "Circuit Breaker لمنع الطلبات الزائدة",
    "Smart Fallback مع ReceiptEnhancer",
    "Prompts محسّنة للتمييز بين تاريخ الموازنة والطباعة",
    "تحليل صورة محسّن (Laplacian variance)",
    "تسجيل أحداث شامل مع metrics"
  ]
};
