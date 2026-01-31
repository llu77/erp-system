/**
 * خدمة OCR لاستخراج المبالغ والتواريخ من صور إيصالات نقاط البيع (POS)
 * POS Receipt OCR Service
 * 
 * تستخدم LLM Vision لاستخراج:
 * 1. مجاميع المبالغ من الأقسام المختلفة (mada, VISA, MasterCard, etc.)
 * 2. التاريخ من الإيصال للتحقق من تطابقه مع تاريخ الرفع
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
}

// ==================== الثوابت ====================
const AMOUNT_TOLERANCE_PERCENTAGE = 0.02; // 2% tolerance for OCR errors
const MIN_CONFIDENCE_FOR_VALIDATION = "medium";
const DATE_TOLERANCE_DAYS = 1; // السماح بفرق يوم واحد في التاريخ

// ==================== دوال مساعدة ====================

/**
 * تنظيف النص المستخرج وتحويله إلى رقم
 */
function parseExtractedAmount(text: string | null | undefined): number | null {
  if (!text) return null;

  // إزالة الرموز غير الرقمية ما عدا النقطة والفاصلة
  let cleaned = text
    .toString()
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
 * تحويل التاريخ إلى تنسيق موحد YYYY-MM-DD
 */
function normalizeDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;

  try {
    // محاولة تحليل التاريخ بتنسيقات مختلفة
    const cleaned = dateStr.trim();
    
    // تنسيق DD/MM/YYYY أو DD-MM-YYYY
    const dmyMatch = cleaned.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmyMatch) {
      const [, day, month, year] = dmyMatch;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }

    // تنسيق YYYY/MM/DD أو YYYY-MM-DD
    const ymdMatch = cleaned.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (ymdMatch) {
      const [, year, month, day] = ymdMatch;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }

    // محاولة تحليل كـ Date
    const date = new Date(cleaned);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * التحقق من تطابق التاريخين مع هامش مسموح
 */
function datesMatch(
  extractedDate: string | null,
  expectedDate: string,
  toleranceDays: number = DATE_TOLERANCE_DAYS
): boolean {
  if (!extractedDate) return false;

  try {
    const extracted = new Date(extractedDate);
    const expected = new Date(expectedDate);
    
    const diffTime = Math.abs(extracted.getTime() - expected.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays <= toleranceDays;
  } catch {
    return false;
  }
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

/**
 * استخراج تاريخ الرفع من uploadedAt
 */
function getUploadDate(uploadedAt: string): string {
  try {
    const date = new Date(uploadedAt);
    return date.toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

// ==================== الدوال الرئيسية ====================

/**
 * استخراج المبالغ والتاريخ من صورة إيصال نقاط البيع
 */
export async function extractAmountFromImage(
  imageUrl: string
): Promise<OCRExtractionResult> {
  const startTime = Date.now();
  
  try {
    logger.info("بدء استخراج المبالغ والتاريخ من صورة إيصال POS", { 
      imageUrl: imageUrl.substring(0, 50) + "..." 
    });

    const messages: Message[] = [
      {
        role: "system",
        content: `أنت خبير في قراءة واستخراج البيانات من صور إيصالات نقاط البيع (POS Terminal Receipts).

هذا إيصال موازنة يومية من جهاز نقاط البيع يحتوي على عدة أقسام:
1. **mada** - بطاقات مدى المحلية
2. **VISA** - بطاقات فيزا
3. **MasterCard** - بطاقات ماستركارد
4. **DISCOVER** - بطاقات ديسكفر
5. **Maestro** - بطاقات مايسترو
6. **GCCNET** - شبكة الخليج
7. **JN ONPAY** - خدمة الدفع

كل قسم يحتوي على:
- **mada HOST / POS TERMINAL**: مجموع المعاملات
- **TOTALS**: المجموع الكلي للقسم

مهمتك:
1. استخراج التاريخ من أعلى الإيصال
2. استخراج مجموع TOTALS من كل قسم (mada, VISA, MasterCard, etc.)
3. حساب المجموع الكلي لجميع الأقسام

أجب بتنسيق JSON فقط:
{
  "date": "التاريخ بتنسيق YYYY-MM-DD أو DD/MM/YYYY",
  "sections": [
    {
      "name": "اسم القسم (mada, VISA, MasterCard, etc.)",
      "hostTotal": "مجموع HOST",
      "terminalTotal": "مجموع POS TERMINAL",
      "count": "عدد المعاملات"
    }
  ],
  "grandTotal": "المجموع الكلي لجميع الأقسام",
  "confidence": "high/medium/low",
  "rawText": "ملخص ما قرأته من الإيصال"
}

ملاحظات مهمة:
- ابحث عن TOTALS في كل قسم
- المبالغ بالريال السعودي (SAR)
- إذا كان القسم يحتوي على "NO TRANSACTIONS" فالمجموع = 0
- المجموع الكلي = مجموع جميع TOTALS من جميع الأقسام`
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "استخرج التاريخ والمبالغ من صورة إيصال نقاط البيع التالية. تأكد من جمع كل الأقسام (mada, VISA, MasterCard, etc.):"
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
          name: "pos_ocr_result",
          strict: true,
          schema: {
            type: "object",
            properties: {
              date: { 
                type: ["string", "null"],
                description: "التاريخ المستخرج"
              },
              sections: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    hostTotal: { type: ["number", "string", "null"] },
                    terminalTotal: { type: ["number", "string", "null"] },
                    count: { type: ["number", "string", "null"] }
                  },
                  required: ["name", "hostTotal", "terminalTotal", "count"],
                  additionalProperties: false
                },
                description: "أقسام الإيصال"
              },
              grandTotal: { 
                type: ["number", "string", "null"],
                description: "المجموع الكلي"
              },
              confidence: { 
                type: "string",
                enum: ["high", "medium", "low", "none"],
                description: "مستوى الثقة"
              },
              rawText: { 
                type: ["string", "null"],
                description: "ملخص المقروء"
              }
            },
            required: ["date", "sections", "grandTotal", "confidence", "rawText"],
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
    
    // معالجة الأقسام
    const sections: POSSection[] = (parsed.sections || []).map((s: any) => ({
      name: s.name || "unknown",
      hostTotal: parseExtractedAmount(s.hostTotal?.toString()) || 0,
      terminalTotal: parseExtractedAmount(s.terminalTotal?.toString()) || 0,
      count: parseInt(s.count?.toString() || "0") || 0
    }));

    // حساب المجموع الكلي من الأقسام
    const calculatedTotal = sections.reduce((sum, s) => sum + s.terminalTotal, 0);
    const extractedGrandTotal = parseExtractedAmount(parsed.grandTotal?.toString());
    
    // استخدام المجموع المحسوب إذا كان أكبر من المستخرج (للتأكد من عدم فقدان أي قسم)
    const grandTotal = Math.max(calculatedTotal, extractedGrandTotal || 0);

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
 * التحقق من تطابق مبلغ الشبكة وتاريخ الرفع مع صورة الموازنة
 */
export async function verifyBalanceImage(
  balanceImages: BalanceImage[],
  expectedNetworkAmount: number,
  uploadDate?: string
): Promise<BalanceVerificationResult> {
  const startTime = Date.now();

  // التحقق من وجود صور
  if (!balanceImages || balanceImages.length === 0) {
    return {
      success: false,
      isMatched: false,
      isDateMatched: false,
      extractedAmount: null,
      expectedAmount: expectedNetworkAmount,
      difference: null,
      extractedDate: null,
      expectedDate: uploadDate || new Date().toISOString().split("T")[0],
      confidence: "none",
      message: "لم يتم رفع صورة الموازنة"
    };
  }

  // تحديد تاريخ الرفع المتوقع
  const expectedDate = uploadDate || getUploadDate(balanceImages[0].uploadedAt);

  // إذا كان المبلغ المتوقع صفر، لا حاجة للتحقق من المبلغ
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
      message: "لا يوجد مبلغ شبكة للتحقق منه"
    };
  }

  try {
    // استخراج البيانات من أول صورة (الصورة الرئيسية)
    const primaryImage = balanceImages[0];
    const extractionResult = await extractAmountFromImage(primaryImage.url);

    if (!extractionResult.success || extractionResult.grandTotal === null) {
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
        }
      };
    }

    const extractedAmount = extractionResult.grandTotal;
    const extractedDate = extractionResult.extractedDate;
    const difference = Math.abs(extractedAmount - expectedNetworkAmount);
    const isAmountMatched = amountsMatch(extractedAmount, expectedNetworkAmount);
    const isDateMatched = datesMatch(extractedDate, expectedDate);

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
      messages.push(`✅ التاريخ مطابق: ${extractedDate}`);
    } else if (extractedDate) {
      messages.push(`❌ التاريخ غير مطابق: تاريخ الإيصال ${extractedDate}، تاريخ الرفع المتوقع ${expectedDate}`);
    } else {
      messages.push(`⚠️ لم نتمكن من قراءة التاريخ من الإيصال`);
    }

    // إضافة تفاصيل الأقسام
    if (extractionResult.sections.length > 0) {
      messages.push("\n📊 تفاصيل الأقسام:");
      extractionResult.sections.forEach(s => {
        if (s.terminalTotal > 0) {
          messages.push(`  - ${s.name}: ${s.terminalTotal.toFixed(2)} ر.س (${s.count} معاملة)`);
        }
      });
    }

    const finalMessage = messages.join("\n");
    const isFullyMatched = isAmountMatched && isDateMatched;

    logger.info("نتيجة التحقق من صورة الموازنة", {
      isAmountMatched,
      isDateMatched,
      extractedAmount,
      expectedNetworkAmount,
      extractedDate,
      expectedDate,
      difference,
      confidence: extractionResult.confidence
    });

    return {
      success: true,
      isMatched: isAmountMatched,
      isDateMatched,
      extractedAmount,
      expectedAmount: expectedNetworkAmount,
      difference,
      extractedDate,
      expectedDate,
      confidence: extractionResult.confidence,
      message: finalMessage,
      sections: extractionResult.sections,
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
      isDateMatched: false,
      extractedAmount: null,
      expectedAmount: expectedNetworkAmount,
      difference: null,
      extractedDate: null,
      expectedDate,
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
      return "لم نتمكن من قراءة البيانات من الصورة. يرجى التحقق يدوياً.";
    case "low":
      return "دقة القراءة منخفضة. يرجى التأكد من وضوح الصورة.";
    case "medium":
      return "دقة القراءة متوسطة. قد يكون هناك فرق بسيط.";
    case "high":
      return null;
  }
}

/**
 * التحقق من تطابق التاريخ فقط
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
      message: `التاريخ مطابق: ${extractedDate}`
    };
  }

  return {
    isMatched: false,
    message: `التاريخ غير مطابق: تاريخ الإيصال ${extractedDate}، تاريخ الرفع المتوقع ${expectedDate}`
  };
}
