/**
 * خدمة OCR لاستخراج المبالغ من صور الموازنة
 * Balance Image OCR Service
 * 
 * تستخدم LLM Vision لاستخراج المبالغ من صور الموازنة والتحقق من تطابقها
 */

import { invokeLLM, type Message } from "../_core/llm";
import { createLogger } from "../utils/logger";

const logger = createLogger("BalanceImageOCR");

// ==================== الأنواع ====================
export interface BalanceImage {
  url: string;
  key: string;
  uploadedAt: string;
}

export interface OCRExtractionResult {
  success: boolean;
  extractedAmount: number | null;
  confidence: "high" | "medium" | "low" | "none";
  rawText: string | null;
  error?: string;
}

export interface BalanceVerificationResult {
  success: boolean;
  isMatched: boolean;
  extractedAmount: number | null;
  expectedAmount: number;
  difference: number | null;
  confidence: "high" | "medium" | "low" | "none";
  message: string;
  details?: {
    rawText: string | null;
    processingTime: number;
  };
}

// ==================== الثوابت ====================
const AMOUNT_TOLERANCE_PERCENTAGE = 0.02; // 2% tolerance for OCR errors
const MIN_CONFIDENCE_FOR_VALIDATION = "medium";

// ==================== دوال مساعدة ====================

/**
 * تنظيف النص المستخرج وتحويله إلى رقم
 */
function parseExtractedAmount(text: string): number | null {
  if (!text) return null;

  // إزالة الرموز غير الرقمية ما عدا النقطة والفاصلة
  let cleaned = text
    .replace(/[^\d.,٠-٩]/g, "") // إزالة كل شيء ما عدا الأرقام والفواصل
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString()) // تحويل الأرقام العربية
    .replace(/,/g, "") // إزالة الفواصل
    .trim();

  // التعامل مع الأرقام العشرية
  const parts = cleaned.split(".");
  if (parts.length > 2) {
    // إذا كان هناك أكثر من نقطة، نأخذ الأخيرة كفاصل عشري
    cleaned = parts.slice(0, -1).join("") + "." + parts[parts.length - 1];
  }

  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? null : num;
}

/**
 * التحقق من تطابق المبلغين مع هامش خطأ
 */
function amountsMatch(
  extracted: number,
  expected: number,
  tolerancePercent: number = AMOUNT_TOLERANCE_PERCENTAGE
): boolean {
  if (expected === 0) return extracted === 0;
  
  const tolerance = expected * tolerancePercent;
  return Math.abs(extracted - expected) <= tolerance;
}

/**
 * تحديد مستوى الثقة بناءً على استجابة LLM
 */
function determineConfidence(
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

// ==================== الدوال الرئيسية ====================

/**
 * استخراج المبلغ من صورة الموازنة باستخدام LLM Vision
 */
export async function extractAmountFromImage(
  imageUrl: string
): Promise<OCRExtractionResult> {
  const startTime = Date.now();
  
  try {
    logger.info("بدء استخراج المبلغ من الصورة", { imageUrl: imageUrl.substring(0, 50) + "..." });

    const messages: Message[] = [
      {
        role: "system",
        content: `أنت خبير في قراءة واستخراج المبالغ المالية من صور إيصالات الدفع الإلكتروني (الموازنة/الشبكة).

مهمتك:
1. تحليل الصورة المرفقة
2. البحث عن المبلغ الإجمالي (Total) أو المبلغ المدفوع
3. استخراج الرقم بدقة

قواعد الاستخراج:
- ابحث عن كلمات مثل: Total, المجموع, الإجمالي, Amount, المبلغ, SAR, ر.س
- استخرج الرقم الأكبر إذا وجدت عدة مبالغ (عادة يكون الإجمالي)
- تجاهل الضريبة المنفصلة وركز على الإجمالي النهائي
- أرقام الموازنة عادة تكون بالريال السعودي

أجب بتنسيق JSON فقط:
{
  "amount": "المبلغ المستخرج كرقم فقط بدون عملة",
  "confidence": "high/medium/low",
  "rawText": "النص الكامل الذي قرأته من الصورة حول المبلغ"
}

إذا لم تتمكن من قراءة المبلغ:
{
  "amount": null,
  "confidence": "none",
  "rawText": "وصف المشكلة"
}`
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "استخرج المبلغ الإجمالي من صورة الموازنة/الإيصال التالية:"
          },
          {
            type: "image_url",
            image_url: {
              url: imageUrl,
              detail: "high"
            }
          }
        ]
      }
    ];

    const response = await invokeLLM({
      messages,
      temperature: 0.1, // درجة حرارة منخفضة للدقة
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "ocr_result",
          strict: true,
          schema: {
            type: "object",
            properties: {
              amount: { 
                type: ["string", "null"],
                description: "المبلغ المستخرج كنص"
              },
              confidence: { 
                type: "string",
                enum: ["high", "medium", "low", "none"],
                description: "مستوى الثقة في الاستخراج"
              },
              rawText: { 
                type: ["string", "null"],
                description: "النص الخام المقروء من الصورة"
              }
            },
            required: ["amount", "confidence", "rawText"],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("لم يتم استلام استجابة من LLM");
    }

    const parsed = JSON.parse(content);
    const extractedAmount = parseExtractedAmount(parsed.amount);
    const confidence = determineConfidence(parsed.confidence, extractedAmount);

    const processingTime = Date.now() - startTime;
    logger.info("تم استخراج المبلغ", { 
      extractedAmount, 
      confidence, 
      processingTime 
    });

    return {
      success: true,
      extractedAmount,
      confidence,
      rawText: parsed.rawText
    };

  } catch (error: any) {
    logger.error("خطأ في استخراج المبلغ من الصورة", error);
    return {
      success: false,
      extractedAmount: null,
      confidence: "none",
      rawText: null,
      error: error.message || "خطأ غير معروف"
    };
  }
}

/**
 * التحقق من تطابق مبلغ الشبكة مع صورة الموازنة
 */
export async function verifyBalanceImage(
  balanceImages: BalanceImage[],
  expectedNetworkAmount: number
): Promise<BalanceVerificationResult> {
  const startTime = Date.now();

  // التحقق من وجود صور
  if (!balanceImages || balanceImages.length === 0) {
    return {
      success: false,
      isMatched: false,
      extractedAmount: null,
      expectedAmount: expectedNetworkAmount,
      difference: null,
      confidence: "none",
      message: "لم يتم رفع صورة الموازنة"
    };
  }

  // إذا كان المبلغ المتوقع صفر، لا حاجة للتحقق
  if (expectedNetworkAmount === 0) {
    return {
      success: true,
      isMatched: true,
      extractedAmount: 0,
      expectedAmount: 0,
      difference: 0,
      confidence: "high",
      message: "لا يوجد مبلغ شبكة للتحقق منه"
    };
  }

  try {
    // استخراج المبلغ من أول صورة (الصورة الرئيسية)
    const primaryImage = balanceImages[0];
    const extractionResult = await extractAmountFromImage(primaryImage.url);

    if (!extractionResult.success || extractionResult.extractedAmount === null) {
      return {
        success: false,
        isMatched: false,
        extractedAmount: null,
        expectedAmount: expectedNetworkAmount,
        difference: null,
        confidence: extractionResult.confidence,
        message: extractionResult.error || "لم نتمكن من قراءة المبلغ من صورة الموازنة",
        details: {
          rawText: extractionResult.rawText,
          processingTime: Date.now() - startTime
        }
      };
    }

    const extractedAmount = extractionResult.extractedAmount;
    const difference = Math.abs(extractedAmount - expectedNetworkAmount);
    const isMatched = amountsMatch(extractedAmount, expectedNetworkAmount);

    // تحديد الرسالة بناءً على النتيجة
    let message: string;
    if (isMatched) {
      if (difference === 0) {
        message = "المبلغ مطابق تماماً";
      } else {
        message = `المبلغ مطابق (فرق بسيط: ${difference.toFixed(2)} ر.س)`;
      }
    } else {
      message = `المبلغ غير مطابق: المتوقع ${expectedNetworkAmount.toFixed(2)} ر.س، المستخرج ${extractedAmount.toFixed(2)} ر.س (فرق: ${difference.toFixed(2)} ر.س)`;
    }

    logger.info("نتيجة التحقق من صورة الموازنة", {
      isMatched,
      extractedAmount,
      expectedNetworkAmount,
      difference,
      confidence: extractionResult.confidence
    });

    return {
      success: true,
      isMatched,
      extractedAmount,
      expectedAmount: expectedNetworkAmount,
      difference,
      confidence: extractionResult.confidence,
      message,
      details: {
        rawText: extractionResult.rawText,
        processingTime: Date.now() - startTime
      }
    };

  } catch (error: any) {
    logger.error("خطأ في التحقق من صورة الموازنة", error);
    return {
      success: false,
      isMatched: false,
      extractedAmount: null,
      expectedAmount: expectedNetworkAmount,
      difference: null,
      confidence: "none",
      message: `خطأ في التحقق: ${error.message || "خطأ غير معروف"}`
    };
  }
}

/**
 * التحقق من أن مستوى الثقة كافٍ للتحقق
 */
export function isConfidenceSufficient(
  confidence: "high" | "medium" | "low" | "none"
): boolean {
  const levels = ["none", "low", "medium", "high"];
  const minLevel = levels.indexOf(MIN_CONFIDENCE_FOR_VALIDATION);
  const currentLevel = levels.indexOf(confidence);
  return currentLevel >= minLevel;
}

/**
 * الحصول على رسالة تحذير بناءً على مستوى الثقة
 */
export function getConfidenceWarning(
  confidence: "high" | "medium" | "low" | "none"
): string | null {
  switch (confidence) {
    case "none":
      return "لم نتمكن من قراءة المبلغ من الصورة. يرجى التحقق يدوياً.";
    case "low":
      return "دقة القراءة منخفضة. يرجى التأكد من وضوح الصورة.";
    case "medium":
      return "دقة القراءة متوسطة. قد يكون هناك فرق بسيط.";
    case "high":
      return null;
  }
}
