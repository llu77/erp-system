/**
 * استراتيجية إعادة المحاولة والتعافي لنظام OCR
 * OCR Retry and Recovery Strategy
 * 
 * تحسينات الأداء:
 * 1. إعادة المحاولة مع prompts مختلفة
 * 2. تحسين جودة الصورة قبل الإرسال
 * 3. استخدام نماذج مختلفة للقراءة
 * 4. تجميع النتائج من محاولات متعددة
 */

import { invokeLLM, type Message } from "../_core/llm";
import { createLogger } from "../utils/logger";
import type { OCRExtractionResult, POSSection } from "./balanceImageOCR";
import { parseExtractedAmount, normalizeDate, determineConfidence } from "./balanceImageOCR";
import { smartPreprocess, type PreprocessingResult } from "./imagePreprocessing";
import { enhanceReceiptImage, enhanceWeakReceiptImage, type EnhancementResult } from "./receiptEnhancer";

const logger = createLogger("OCRRetryStrategy");

// ==================== الأنواع ====================
export interface RetryConfig {
  maxRetries: number;
  prompts: PromptVariant[];
  combineResults: boolean;
  /** تفعيل معالجة الصور مسبقاً (افتراضي: false) */
  preprocessImage?: boolean;
  /** استخدام ReceiptEnhancer v2.0 بدلاً من المعالجة القديمة */
  useEnhancerV2?: boolean;
}

export interface PromptVariant {
  name: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
}

export interface RetryResult {
  success: boolean;
  attempts: AttemptResult[];
  finalResult: OCRExtractionResult;
  bestAttempt: AttemptResult | null;
}

export interface AttemptResult {
  promptName: string;
  result: OCRExtractionResult;
  duration: number;
  error?: string;
}

// ==================== Prompts المتنوعة ====================

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Prompt 1: القراءة المباشرة (الأساسي)
 */
const DIRECT_READ_PROMPT: PromptVariant = {
  name: "direct_read",
  systemPrompt: `أنت خبير في قراءة إيصالات نقاط البيع (POS Terminal Receipts).
مهمتك: استخراج البيانات المالية بدقة عالية.
السنة الحالية: ${CURRENT_YEAR}`,
  userPrompt: `اقرأ هذا الإيصال واستخرج:
1. التاريخ (YYYY-MM-DD)
2. مجموع كل قسم (mada, VISA, MasterCard, etc.)
3. المجموع الكلي

ابحث عن:
- "TOTALS" أو "TOTAL" في كل قسم
- "NO TRANSACTIONS" تعني المجموع = 0
- التاريخ في أعلى الإيصال

أجب بـ JSON فقط:
{"date":"YYYY-MM-DD","sections":[{"name":"mada","total":0,"count":0}],"grandTotal":0,"confidence":"high/medium/low","rawText":"ملخص"}`,
  temperature: 0.1
};

/**
 * Prompt 2: التركيز على الأرقام
 */
const NUMBERS_FOCUS_PROMPT: PromptVariant = {
  name: "numbers_focus",
  systemPrompt: `أنت محلل مالي متخصص في قراءة الأرقام من الإيصالات الحرارية.
ركز فقط على الأرقام والمبالغ. تجاهل النصوص غير المهمة.
السنة الحالية: ${CURRENT_YEAR}`,
  userPrompt: `استخرج جميع الأرقام المالية من هذا الإيصال:

1. ابحث عن أي رقم بعد كلمة "TOTAL" أو "TOTALS" أو "المجموع"
2. ابحث عن أرقام بتنسيق XXX.XX أو X,XXX.XX
3. ابحث عن التاريخ بأي تنسيق (DD/MM/YYYY أو YYYY-MM-DD)

المبالغ بالريال السعودي (SAR).

أجب بـ JSON:
{"date":"YYYY-MM-DD","amounts":[{"label":"mada","value":0},{"label":"VISA","value":0}],"grandTotal":0,"confidence":"high/medium/low"}`,
  temperature: 0.2
};

/**
 * Prompt 3: القراءة التفصيلية
 */
const DETAILED_READ_PROMPT: PromptVariant = {
  name: "detailed_read",
  systemPrompt: `أنت خبير OCR متخصص في الإيصالات الحرارية الصعبة القراءة.
لديك خبرة في:
- الإيصالات الباهتة أو المموهة
- الطباعة الحرارية المتلاشية
- الصور المائلة أو غير الواضحة
السنة الحالية: ${CURRENT_YEAR}`,
  userPrompt: `هذا إيصال موازنة يومية من جهاز POS. قد تكون الصورة غير واضحة.

خطوات القراءة:
1. حدد أولاً هل هذا إيصال POS أم لا
2. إذا كان إيصال POS، ابحث عن:
   - التاريخ (عادة في الأعلى)
   - أقسام البطاقات (mada, VISA, MasterCard, AMEX, DISCOVER, Maestro)
   - كلمة TOTALS أو TOTAL متبوعة برقم
   - المجموع الكلي (GRAND TOTAL أو TOTAL AMOUNT)

3. إذا كانت بعض الأجزاء غير واضحة، اكتب ما تستطيع قراءته

أجب بـ JSON:
{
  "isReceipt": true/false,
  "date": "YYYY-MM-DD أو null",
  "sections": [{"name": "mada", "total": 0, "count": 0}],
  "grandTotal": 0,
  "confidence": "high/medium/low/none",
  "readableText": "النص الذي تمكنت من قراءته",
  "issues": ["قائمة المشاكل في القراءة"]
}`,
  temperature: 0.15
};

/**
 * Prompt 4: استخراج المجموع فقط
 */
const TOTAL_ONLY_PROMPT: PromptVariant = {
  name: "total_only",
  systemPrompt: `مهمتك بسيطة: استخرج المجموع الكلي فقط من إيصال POS.
لا تحتاج لقراءة كل التفاصيل، فقط المجموع النهائي.
السنة الحالية: ${CURRENT_YEAR}`,
  userPrompt: `ابحث عن المجموع الكلي في هذا الإيصال.

ابحث عن:
- GRAND TOTAL
- TOTAL AMOUNT
- المجموع الكلي
- أكبر رقم في أسفل الإيصال

أجب بـ JSON:
{"grandTotal": 0, "date": "YYYY-MM-DD أو null", "confidence": "high/medium/low"}`,
  temperature: 0.1
};

// ==================== الدوال المساعدة ====================

/**
 * تحميل الصورة كـ Buffer
 */
async function fetchImageBuffer(imageUrl: string): Promise<Buffer> {
  // إذا كانت الصورة بالفعل base64
  if (imageUrl.startsWith("data:image/")) {
    const base64Data = imageUrl.split(",")[1];
    return Buffer.from(base64Data, "base64");
  }

  // إذا كانت ملف محلي
  if (imageUrl.startsWith("/") || imageUrl.startsWith("file://")) {
    const fs = await import("fs");
    const path = imageUrl.replace("file://", "");
    return fs.readFileSync(path);
  }

  // إذا كانت URL خارجية
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * تحويل الصورة إلى base64
 */
async function imageToBase64(imageUrl: string): Promise<string> {
  // إذا كانت الصورة بالفعل base64
  if (imageUrl.startsWith("data:image/")) {
    return imageUrl;
  }

  // إذا كانت ملف محلي
  if (imageUrl.startsWith("/") || imageUrl.startsWith("file://")) {
    const fs = await import("fs");
    const path = imageUrl.replace("file://", "");
    const buffer = fs.readFileSync(path);
    const base64 = buffer.toString("base64");
    const ext = path.split(".").pop()?.toLowerCase() || "png";
    const mimeType = ext === "jpg" ? "jpeg" : ext;
    return `data:image/${mimeType};base64,${base64}`;
  }

  // إذا كانت URL خارجية
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const contentType = response.headers.get("content-type") || "image/png";
    return `data:${contentType};base64,${base64}`;
  } catch (error: any) {
    logger.error("فشل تحميل الصورة", { url: imageUrl, error: error.message });
    throw new Error(`فشل تحميل الصورة: ${error.message}`);
  }
}

/**
 * تحليل استجابة LLM واستخراج البيانات
 */
function parseOCRResponse(content: string, promptName: string): OCRExtractionResult {
  try {
    // إزالة markdown code blocks
    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    // معالجة الأقسام
    let sections: POSSection[] = [];
    
    // من prompt direct_read و detailed_read
    if (parsed.sections && Array.isArray(parsed.sections)) {
      sections = parsed.sections.map((s: any) => ({
        name: s.name || "unknown",
        hostTotal: parseExtractedAmount(s.total?.toString()) || 0,
        terminalTotal: parseExtractedAmount(s.total?.toString()) || 0,
        count: parseInt(s.count?.toString() || "0") || 0
      }));
    }
    
    // من prompt numbers_focus
    if (parsed.amounts && Array.isArray(parsed.amounts)) {
      sections = parsed.amounts.map((a: any) => ({
        name: a.label || "unknown",
        hostTotal: parseExtractedAmount(a.value?.toString()) || 0,
        terminalTotal: parseExtractedAmount(a.value?.toString()) || 0,
        count: 0
      }));
    }

    // حساب المجموع
    const calculatedTotal = sections.reduce((sum, s) => sum + Math.max(s.hostTotal, s.terminalTotal), 0);
    const extractedGrandTotal = parseExtractedAmount(parsed.grandTotal?.toString());
    const grandTotal = Math.max(calculatedTotal, extractedGrandTotal || 0);

    // تطبيع التاريخ
    const extractedDate = normalizeDate(parsed.date);
    const confidence = determineConfidence(parsed.confidence, grandTotal);

    return {
      success: grandTotal > 0 || sections.length > 0,
      extractedAmount: grandTotal,
      extractedDate,
      sections,
      grandTotal,
      confidence,
      rawText: parsed.rawText || parsed.readableText || null
    };

  } catch (error: any) {
    logger.error("فشل تحليل استجابة OCR", { promptName, error: error.message });
    return {
      success: false,
      extractedAmount: null,
      extractedDate: null,
      sections: [],
      grandTotal: null,
      confidence: "none",
      rawText: null,
      error: `فشل تحليل الاستجابة: ${error.message}`
    };
  }
}

/**
 * تنفيذ محاولة OCR واحدة
 */
async function executeAttempt(
  base64Image: string,
  prompt: PromptVariant
): Promise<AttemptResult> {
  const startTime = Date.now();

  try {
    const messages: Message[] = [
      { role: "system", content: prompt.systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: prompt.userPrompt },
          {
            type: "image_url",
            image_url: { url: base64Image, detail: "high" }
          }
        ]
      }
    ];

    const response = await invokeLLM({
      messages,
      temperature: prompt.temperature
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("لم يتم استلام استجابة من LLM");
    }

    logger.info(`استجابة ${prompt.name}`, { content: content.substring(0, 200) });

    const result = parseOCRResponse(content, prompt.name);
    const duration = Date.now() - startTime;

    return {
      promptName: prompt.name,
      result,
      duration
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error(`فشل محاولة ${prompt.name}`, { error: error.message });

    return {
      promptName: prompt.name,
      result: {
        success: false,
        extractedAmount: null,
        extractedDate: null,
        sections: [],
        grandTotal: null,
        confidence: "none",
        rawText: null,
        error: error.message
      },
      duration,
      error: error.message
    };
  }
}

/**
 * دمج نتائج المحاولات المتعددة
 */
function combineResults(attempts: AttemptResult[]): OCRExtractionResult {
  // فلترة المحاولات الناجحة
  const successfulAttempts = attempts.filter(a => a.result.success && a.result.grandTotal !== null && a.result.grandTotal > 0);

  if (successfulAttempts.length === 0) {
    // لا توجد محاولات ناجحة
    const bestAttempt = attempts.find(a => a.result.sections.length > 0) || attempts[0];
    return bestAttempt?.result || {
      success: false,
      extractedAmount: null,
      extractedDate: null,
      sections: [],
      grandTotal: null,
      confidence: "none",
      rawText: null,
      error: "فشلت جميع محاولات القراءة"
    };
  }

  // ترتيب حسب الثقة والمبلغ
  const sorted = successfulAttempts.sort((a, b) => {
    const confOrder = { high: 3, medium: 2, low: 1, none: 0 };
    const confDiff = confOrder[b.result.confidence] - confOrder[a.result.confidence];
    if (confDiff !== 0) return confDiff;
    return (b.result.grandTotal || 0) - (a.result.grandTotal || 0);
  });

  const best = sorted[0].result;

  // إذا كان هناك أكثر من محاولة ناجحة، نتحقق من التوافق
  if (successfulAttempts.length > 1) {
    const amounts = successfulAttempts.map(a => a.result.grandTotal || 0);
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((sum, a) => sum + Math.pow(a - avgAmount, 2), 0) / amounts.length;
    
    // إذا كان التباين كبير، نستخدم الوسيط
    if (variance > avgAmount * 0.1) {
      const sortedAmounts = [...amounts].sort((a, b) => a - b);
      const medianAmount = sortedAmounts[Math.floor(sortedAmounts.length / 2)];
      best.extractedAmount = medianAmount;
      best.grandTotal = medianAmount;
      logger.info("استخدام الوسيط بسبب التباين الكبير", { amounts, median: medianAmount });
    }
  }

  // دمج الأقسام من جميع المحاولات
  const allSections = new Map<string, POSSection>();
  for (const attempt of successfulAttempts) {
    for (const section of attempt.result.sections) {
      const existing = allSections.get(section.name);
      if (!existing || section.hostTotal > existing.hostTotal) {
        allSections.set(section.name, section);
      }
    }
  }
  best.sections = Array.from(allSections.values());

  // دمج التواريخ
  const dates = successfulAttempts
    .map(a => a.result.extractedDate)
    .filter(d => d !== null);
  if (dates.length > 0 && !best.extractedDate) {
    best.extractedDate = dates[0];
  }

  return best;
}

// ==================== الدالة الرئيسية ====================

/**
 * استخراج البيانات من صورة الإيصال مع إعادة المحاولة
 */
export async function extractWithRetry(
  imageUrl: string,
  config?: Partial<RetryConfig>
): Promise<RetryResult> {
  const startTime = Date.now();

  // الإعدادات الافتراضية
  // ملاحظة: تم تعطيل معالجة الصور افتراضياً لأن الاختبارات أظهرت أن OCR بدون معالجة أدق
  // المعالجة تُستخدم كـ fallback عند فشل القراءة الأولى
  const defaultConfig: RetryConfig = {
    maxRetries: 3,
    prompts: [
      DIRECT_READ_PROMPT,
      DETAILED_READ_PROMPT,
      NUMBERS_FOCUS_PROMPT,
      TOTAL_ONLY_PROMPT
    ],
    combineResults: true,
    preprocessImage: false, // تم تعطيلها افتراضياً - تُستخدم كـ fallback
    useEnhancerV2: true // استخدام ReceiptEnhancer v2.0 الجديد
  };

  const finalConfig = { ...defaultConfig, ...config };
  const attempts: AttemptResult[] = [];
  let bestAttempt: AttemptResult | null = null;
  let preprocessingResult: PreprocessingResult | null = null;

  try {
    logger.info("بدء استخراج OCR مع إعادة المحاولة", { imageUrl: imageUrl.substring(0, 50) });
    
    let base64Image: string;
    
    // معالجة الصورة مسبقاً إذا كان مفعلاً
    if (finalConfig.preprocessImage) {
      try {
        logger.info("بدء معالجة الصورة مسبقاً");
        preprocessingResult = await smartPreprocess(imageUrl);
        base64Image = preprocessingResult.base64Image;
        logger.info("اكتملت معالجة الصورة", {
          originalSize: preprocessingResult.originalSize,
          processedSize: preprocessingResult.processedSize,
          enhancements: preprocessingResult.appliedEnhancements,
          processingTime: preprocessingResult.processingTime
        });
      } catch (preprocessError: any) {
        logger.warn("فشل معالجة الصورة، استخدام الصورة الأصلية", { error: preprocessError.message });
        base64Image = await imageToBase64(imageUrl);
      }
    } else {
      base64Image = await imageToBase64(imageUrl);
    }

    // تنفيذ المحاولات
    let usedPreprocessingFallback = false;
    
    for (let i = 0; i < Math.min(finalConfig.maxRetries, finalConfig.prompts.length); i++) {
      const prompt = finalConfig.prompts[i];
      logger.info(`محاولة ${i + 1}: ${prompt.name}`);

      const attempt = await executeAttempt(base64Image, prompt);
      attempts.push(attempt);

      // إذا نجحت المحاولة بثقة عالية، نتوقف
      if (attempt.result.success && 
          attempt.result.confidence === "high" && 
          attempt.result.grandTotal !== null && 
          attempt.result.grandTotal > 0) {
        logger.info(`نجحت المحاولة ${i + 1} بثقة عالية`);
        bestAttempt = attempt;
        break;
      }

      // تحديث أفضل محاولة
      if (!bestAttempt || 
          (attempt.result.success && 
           (!bestAttempt.result.success || 
            (attempt.result.grandTotal || 0) > (bestAttempt.result.grandTotal || 0)))) {
        bestAttempt = attempt;
      }
      
      // Smart Fallback: إذا فشلت المحاولة الأولى ولم نستخدم المعالجة، نجربها
      if (i === 0 && !attempt.result.success && !finalConfig.preprocessImage && !usedPreprocessingFallback) {
        logger.info("تفعيل Smart Fallback: معالجة الصورة بعد فشل المحاولة الأولى");
        try {
          // استخدام ReceiptEnhancer v2.0 إذا كان مفعلاً
          if (finalConfig.useEnhancerV2) {
            logger.info("استخدام ReceiptEnhancer v2.0 للصور الضعيفة");
            const imageBuffer = await fetchImageBuffer(imageUrl);
            const enhancementResult = await enhanceWeakReceiptImage(imageBuffer);
            base64Image = enhancementResult.base64;
            usedPreprocessingFallback = true;
            logger.info("تم تطبيق ReceiptEnhancer v2.0 كـ fallback", {
              originalSize: enhancementResult.originalSize,
              finalSize: enhancementResult.finalSize,
              compressionPercent: enhancementResult.compressionPercent.toFixed(1) + '%',
              ocrReadiness: enhancementResult.ocrReadiness.level,
              appliedSteps: enhancementResult.appliedSteps
            });
          } else {
            // استخدام المعالجة القديمة
            preprocessingResult = await smartPreprocess(imageUrl);
            base64Image = preprocessingResult.base64Image;
            usedPreprocessingFallback = true;
            logger.info("تم تطبيق معالجة الصورة القديمة كـ fallback", {
              originalSize: preprocessingResult.originalSize,
              processedSize: preprocessingResult.processedSize
            });
          }
        } catch (preprocessError: any) {
          logger.warn("فشل Smart Fallback", { error: preprocessError.message });
        }
      }
    }

    // دمج النتائج إذا مطلوب
    const finalResult = finalConfig.combineResults 
      ? combineResults(attempts)
      : (bestAttempt?.result || attempts[0]?.result || {
          success: false,
          extractedAmount: null,
          extractedDate: null,
          sections: [],
          grandTotal: null,
          confidence: "none",
          rawText: null,
          error: "لم يتم تنفيذ أي محاولة"
        });

    const totalDuration = Date.now() - startTime;
    logger.info("اكتمل استخراج OCR", {
      attempts: attempts.length,
      success: finalResult.success,
      grandTotal: finalResult.grandTotal,
      totalDuration
    });

    return {
      success: finalResult.success,
      attempts,
      finalResult,
      bestAttempt
    };

  } catch (error: any) {
    logger.error("خطأ في extractWithRetry", { error: error.message });

    return {
      success: false,
      attempts,
      finalResult: {
        success: false,
        extractedAmount: null,
        extractedDate: null,
        sections: [],
        grandTotal: null,
        confidence: "none",
        rawText: null,
        error: error.message
      },
      bestAttempt: null
    };
  }
}

// تصدير الثوابت للاختبار
export const PROMPTS = {
  DIRECT_READ: DIRECT_READ_PROMPT,
  NUMBERS_FOCUS: NUMBERS_FOCUS_PROMPT,
  DETAILED_READ: DETAILED_READ_PROMPT,
  TOTAL_ONLY: TOTAL_ONLY_PROMPT
};
