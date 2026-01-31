/**
 * تحسينات متقدمة لنظام OCR
 * Advanced OCR Enhancements
 * 
 * يحتوي على:
 * 1. دوال تحليل متقدمة للمبالغ
 * 2. تحسين معالجة الأخطاء
 * 3. تحليل جودة الصورة
 * 4. تحسين رسائل التحذير
 */

import { createLogger } from "../utils/logger";
import type { POSSection, OCRWarning, OCRWarningType } from "./balanceImageOCR";

const logger = createLogger("OCREnhancements");

// ==================== الثوابت المتقدمة ====================

/**
 * أقسام الدفع المعروفة في إيصالات POS
 */
export const KNOWN_PAYMENT_SECTIONS = [
  "mada",
  "VISA", 
  "MasterCard",
  "DISCOVER",
  "Maestro",
  "GCCNET",
  "JN ONPAY",
  "AMEX",
  "UnionPay",
] as const;

/**
 * أنماط التاريخ المدعومة
 */
export const DATE_PATTERNS = [
  /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/, // DD/MM/YYYY or DD-MM-YYYY
  /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/, // YYYY/MM/DD or YYYY-MM-DD
  /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i, // DD Mon YYYY
] as const;

/**
 * حدود المبالغ المعقولة
 */
export const AMOUNT_LIMITS = {
  MIN: 0,
  MAX: 10_000_000, // 10 مليون ريال كحد أقصى معقول
  SUSPICIOUS_THRESHOLD: 1_000_000, // مبلغ يستدعي التحقق
} as const;

// ==================== تحليل المبالغ المتقدم ====================

/**
 * نتيجة تحليل المبلغ
 */
export interface AmountAnalysisResult {
  isValid: boolean;
  normalizedAmount: number | null;
  originalText: string;
  confidence: number; // 0-100
  issues: string[];
}

/**
 * تحليل متقدم للمبلغ المستخرج
 */
export function analyzeExtractedAmount(text: string | null | undefined): AmountAnalysisResult {
  const result: AmountAnalysisResult = {
    isValid: false,
    normalizedAmount: null,
    originalText: text?.toString() || "",
    confidence: 0,
    issues: [],
  };

  if (!text) {
    result.issues.push("لا يوجد نص للتحليل");
    return result;
  }

  const originalText = text.toString().trim();
  result.originalText = originalText;

  // تنظيف النص
  let cleaned = originalText
    .replace(/[^\d.,٠-٩\-]/g, "")
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
    .replace(/,/g, "")
    .trim();

  // التحقق من وجود أرقام
  if (!/\d/.test(cleaned)) {
    result.issues.push("لا توجد أرقام في النص");
    return result;
  }

  // معالجة النقاط المتعددة
  const dotCount = (cleaned.match(/\./g) || []).length;
  if (dotCount > 1) {
    result.issues.push("تم اكتشاف نقاط متعددة - تم تصحيحها");
    const parts = cleaned.split(".");
    cleaned = parts.slice(0, -1).join("") + "." + parts[parts.length - 1];
    result.confidence -= 10;
  }

  // تحويل إلى رقم
  const num = parseFloat(cleaned);
  if (Number.isNaN(num)) {
    result.issues.push("فشل تحويل النص إلى رقم");
    return result;
  }

  // التحقق من الحدود
  if (num < AMOUNT_LIMITS.MIN) {
    result.issues.push("المبلغ سالب");
    return result;
  }

  if (num > AMOUNT_LIMITS.MAX) {
    result.issues.push(`المبلغ يتجاوز الحد الأقصى (${AMOUNT_LIMITS.MAX.toLocaleString()})`);
    return result;
  }

  if (num > AMOUNT_LIMITS.SUSPICIOUS_THRESHOLD) {
    result.issues.push("مبلغ كبير يستدعي التحقق اليدوي");
    result.confidence -= 20;
  }

  // حساب الثقة
  result.confidence = 100;
  
  // خصم للمشاكل المكتشفة
  result.confidence -= result.issues.length * 5;
  
  // خصم إذا كان النص الأصلي يحتوي على أحرف غير متوقعة
  if (/[a-zA-Z]/.test(originalText)) {
    result.confidence -= 5;
  }

  result.isValid = true;
  result.normalizedAmount = num;
  result.confidence = Math.max(0, Math.min(100, result.confidence));

  return result;
}

// ==================== تحليل الأقسام ====================

/**
 * نتيجة تحليل الأقسام
 */
export interface SectionsAnalysisResult {
  isValid: boolean;
  totalAmount: number;
  activeSections: POSSection[];
  inactiveSections: string[];
  issues: string[];
  confidence: number;
}

/**
 * تحليل أقسام الدفع المستخرجة
 */
export function analyzeSections(sections: POSSection[]): SectionsAnalysisResult {
  const result: SectionsAnalysisResult = {
    isValid: false,
    totalAmount: 0,
    activeSections: [],
    inactiveSections: [],
    issues: [],
    confidence: 100,
  };

  if (!sections || sections.length === 0) {
    result.issues.push("لم يتم استخراج أي أقسام دفع");
    result.confidence = 0;
    return result;
  }

  // فصل الأقسام النشطة عن غير النشطة
  for (const section of sections) {
    if (section.terminalTotal > 0) {
      result.activeSections.push(section);
      result.totalAmount += section.terminalTotal;
    } else {
      result.inactiveSections.push(section.name);
    }
  }

  // التحقق من وجود أقسام نشطة
  if (result.activeSections.length === 0) {
    result.issues.push("جميع الأقسام بدون معاملات");
    result.confidence = 20;
    return result;
  }

  // التحقق من الأقسام المعروفة
  const unknownSections = result.activeSections.filter(
    s => !KNOWN_PAYMENT_SECTIONS.includes(s.name as any)
  );
  if (unknownSections.length > 0) {
    result.issues.push(`أقسام غير معروفة: ${unknownSections.map(s => s.name).join(", ")}`);
    result.confidence -= 10;
  }

  // التحقق من تطابق Host و Terminal
  for (const section of result.activeSections) {
    if (section.hostTotal !== section.terminalTotal) {
      const diff = Math.abs(section.hostTotal - section.terminalTotal);
      result.issues.push(
        `فرق في قسم ${section.name}: Host=${section.hostTotal}, Terminal=${section.terminalTotal} (فرق: ${diff})`
      );
      result.confidence -= 15;
    }
  }

  // التحقق من عدد المعاملات
  for (const section of result.activeSections) {
    if (section.count === 0 && section.terminalTotal > 0) {
      result.issues.push(`قسم ${section.name} له مبلغ بدون عدد معاملات`);
      result.confidence -= 5;
    }
  }

  result.isValid = result.activeSections.length > 0;
  result.confidence = Math.max(0, Math.min(100, result.confidence));

  return result;
}

// ==================== تحليل التاريخ المتقدم ====================

/**
 * نتيجة تحليل التاريخ
 */
export interface DateAnalysisResult {
  isValid: boolean;
  normalizedDate: string | null;
  originalText: string;
  format: string | null;
  issues: string[];
}

/**
 * تحليل متقدم للتاريخ المستخرج
 */
export function analyzeExtractedDate(text: string | null | undefined): DateAnalysisResult {
  const result: DateAnalysisResult = {
    isValid: false,
    normalizedDate: null,
    originalText: text?.toString() || "",
    format: null,
    issues: [],
  };

  if (!text) {
    result.issues.push("لا يوجد تاريخ للتحليل");
    return result;
  }

  const cleaned = text.toString().trim();
  result.originalText = cleaned;

  // محاولة مطابقة الأنماط المعروفة
  
  // نمط DD/MM/YYYY أو DD-MM-YYYY
  const dmyMatch = cleaned.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    const dayNum = parseInt(day);
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    // التحقق من صحة القيم
    if (monthNum < 1 || monthNum > 12) {
      result.issues.push(`شهر غير صالح: ${monthNum}`);
      return result;
    }
    if (dayNum < 1 || dayNum > 31) {
      result.issues.push(`يوم غير صالح: ${dayNum}`);
      return result;
    }
    if (yearNum < 2000 || yearNum > 2100) {
      result.issues.push(`سنة غير معقولة: ${yearNum}`);
      return result;
    }

    result.normalizedDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    result.format = "DD/MM/YYYY";
    result.isValid = true;
    return result;
  }

  // نمط YYYY-MM-DD أو YYYY/MM/DD
  const ymdMatch = cleaned.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    const [, year, month, day] = ymdMatch;
    const dayNum = parseInt(day);
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    if (monthNum < 1 || monthNum > 12) {
      result.issues.push(`شهر غير صالح: ${monthNum}`);
      return result;
    }
    if (dayNum < 1 || dayNum > 31) {
      result.issues.push(`يوم غير صالح: ${dayNum}`);
      return result;
    }
    if (yearNum < 2000 || yearNum > 2100) {
      result.issues.push(`سنة غير معقولة: ${yearNum}`);
      return result;
    }

    result.normalizedDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    result.format = "YYYY-MM-DD";
    result.isValid = true;
    return result;
  }

  // محاولة تحليل كـ Date
  try {
    const date = new Date(cleaned);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      if (year >= 2000 && year <= 2100) {
        result.normalizedDate = date.toISOString().split("T")[0];
        result.format = "ISO";
        result.isValid = true;
        return result;
      }
    }
  } catch {
    // تجاهل الخطأ
  }

  result.issues.push("تنسيق تاريخ غير معروف");
  return result;
}

// ==================== تحسين رسائل التحذير ====================

/**
 * إنشاء رسالة تحذير محسنة
 */
export function createEnhancedWarning(
  type: OCRWarningType,
  context: {
    extractedAmount?: number | null;
    expectedAmount?: number;
    extractedDate?: string | null;
    expectedDate?: string;
    sections?: POSSection[];
    confidence?: string;
  }
): OCRWarning {
  const warnings: Record<OCRWarningType, () => OCRWarning> = {
    no_date: () => ({
      type: "no_date",
      severity: "warning",
      message: "⚠️ لم نتمكن من قراءة التاريخ من الإيصال",
      suggestion: "تأكد من أن التاريخ واضح في أعلى الإيصال وغير مقطوع أو مطوي",
    }),

    unclear_image: () => ({
      type: "unclear_image",
      severity: "warning",
      message: "⚠️ الصورة غير واضحة أو جودتها منخفضة",
      suggestion: "يرجى رفع صورة أوضح بإضاءة جيدة، بدون اهتزاز، وتأكد من أن الإيصال مستوٍ وغير مجعد",
    }),

    low_confidence: () => ({
      type: "low_confidence",
      severity: "info",
      message: "ℹ️ دقة القراءة منخفضة - قد تكون النتائج غير دقيقة",
      suggestion: "يرجى التحقق يدوياً من المبالغ والتأكد من مطابقتها للإيصال الفعلي",
    }),

    partial_read: () => {
      const activeCount = context.sections?.filter(s => s.terminalTotal > 0).length || 0;
      return {
        type: "partial_read",
        severity: "info",
        message: `ℹ️ تم قراءة ${activeCount} قسم فقط من أقسام الدفع`,
        suggestion: "إذا كان هناك أقسام أخرى (mada, VISA, MasterCard, إلخ)، تأكد من ظهورها كاملة في الصورة",
      };
    },

    date_mismatch: () => ({
      type: "date_mismatch",
      severity: "error",
      message: `❌ التاريخ غير مطابق: تاريخ الإيصال ${context.extractedDate || "غير معروف"}، التاريخ المتوقع ${context.expectedDate || "غير محدد"}`,
      suggestion: "تأكد من رفع إيصال اليوم الصحيح. إذا كان الإيصال من يوم سابق، يرجى اختيار التاريخ المناسب",
    }),

    amount_mismatch: () => {
      const extractedAmt = context.extractedAmount ?? 0;
      const expectedAmt = context.expectedAmount ?? 0;
      const diff = Math.abs(extractedAmt - expectedAmt);
      const percentage = context.expectedAmount && context.expectedAmount > 0
        ? ((diff / context.expectedAmount) * 100).toFixed(1)
        : "0";
      return {
        type: "amount_mismatch",
        severity: "error",
        message: `❌ المبلغ غير مطابق: المتوقع ${expectedAmt.toFixed(2)} ر.س، المستخرج ${extractedAmt.toFixed(2)} ر.س (فرق: ${diff.toFixed(2)} ر.س = ${percentage}%)`,
        suggestion: "تأكد من إدخال مبلغ الشبكة الصحيح. راجع إجمالي TOTALS في جميع أقسام الإيصال",
      };
    },

    no_sections: () => ({
      type: "no_sections",
      severity: "warning",
      message: "⚠️ لم نتمكن من تحديد أقسام الدفع (mada, VISA, إلخ)",
      suggestion: "تأكد من أن الإيصال كامل ويظهر جميع الأقسام. قد تكون الصورة مقطوعة أو الإيصال غير واضح",
    }),
  };

  return warnings[type]();
}

// ==================== تحليل شامل للموازنة ====================

/**
 * نتيجة التحليل الشامل
 */
export interface ComprehensiveAnalysisResult {
  isValid: boolean;
  amountAnalysis: AmountAnalysisResult;
  sectionsAnalysis: SectionsAnalysisResult;
  dateAnalysis: DateAnalysisResult;
  overallConfidence: number;
  recommendations: string[];
}

/**
 * تحليل شامل لنتائج OCR
 */
export function performComprehensiveAnalysis(
  extractedAmount: number | null,
  extractedDate: string | null,
  sections: POSSection[],
  expectedAmount: number,
  expectedDate: string
): ComprehensiveAnalysisResult {
  const amountAnalysis = analyzeExtractedAmount(extractedAmount?.toString());
  const sectionsAnalysis = analyzeSections(sections);
  const dateAnalysis = analyzeExtractedDate(extractedDate);

  const recommendations: string[] = [];

  // حساب الثقة الإجمالية
  let overallConfidence = 100;

  // تحليل المبلغ
  if (!amountAnalysis.isValid) {
    overallConfidence -= 30;
    recommendations.push("تحسين جودة الصورة لقراءة المبلغ بشكل أفضل");
  }

  // تحليل الأقسام
  if (!sectionsAnalysis.isValid) {
    overallConfidence -= 25;
    recommendations.push("التأكد من ظهور جميع أقسام الدفع في الصورة");
  } else if (sectionsAnalysis.issues.length > 0) {
    overallConfidence -= sectionsAnalysis.issues.length * 5;
  }

  // تحليل التاريخ
  if (!dateAnalysis.isValid) {
    overallConfidence -= 15;
    recommendations.push("التأكد من وضوح التاريخ في أعلى الإيصال");
  }

  // مقارنة المبالغ
  if (amountAnalysis.normalizedAmount !== null) {
    const diff = Math.abs(amountAnalysis.normalizedAmount - expectedAmount);
    const tolerance = expectedAmount * 0.02;
    if (diff > tolerance) {
      overallConfidence -= 20;
      recommendations.push(`مراجعة المبلغ المدخل: الفرق ${diff.toFixed(2)} ر.س`);
    }
  }

  // مقارنة مع مجموع الأقسام
  if (sectionsAnalysis.isValid && amountAnalysis.normalizedAmount !== null) {
    const sectionsDiff = Math.abs(sectionsAnalysis.totalAmount - amountAnalysis.normalizedAmount);
    if (sectionsDiff > 1) {
      overallConfidence -= 10;
      recommendations.push("التحقق من تطابق مجموع الأقسام مع المجموع الكلي");
    }
  }

  overallConfidence = Math.max(0, Math.min(100, overallConfidence));

  return {
    isValid: amountAnalysis.isValid && sectionsAnalysis.isValid,
    amountAnalysis,
    sectionsAnalysis,
    dateAnalysis,
    overallConfidence,
    recommendations,
  };
}

// ==================== تصدير الدوال ====================

export {
  logger as ocrLogger,
};
