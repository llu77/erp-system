/**
 * نظام OCR مبسط - يرسل الصورة مباشرة إلى Claude دون شروط معقدة
 * Simple OCR System - Sends image directly to Claude without complex conditions
 * 
 * الهدف: قبول أي صورة وإرسالها مباشرة إلى Claude للقراءة
 */

import { invokeLLM, type Message } from "../_core/llm";
import { createLogger } from "../utils/logger";
import { storageGet } from "../storage";

const logger = createLogger("SimpleOCR");

// ==================== الأنواع ====================
export interface SimpleOCRResult {
  success: boolean;
  data: {
    date: string | null;
    grandTotal: number | null;
    sections: Array<{
      name: string;
      total: number;
      count: number;
    }>;
    rawText: string | null;
  };
  confidence: "high" | "medium" | "low" | "none";
  error?: string;
  processingTime: number;
}

// ==================== الدوال المساعدة ====================

/**
 * تحميل الصورة وتحويلها إلى base64
 * بسيط وبدون شروط معقدة
 */
async function loadImageAsBase64(imageUrl: string, s3Key?: string): Promise<string> {
  // إذا كان الرابط بالفعل base64، نعيده كما هو
  if (imageUrl.startsWith('data:')) {
    logger.info("الصورة بالفعل base64");
    return imageUrl;
  }

  // محاولة تحميل الصورة
  let response = await fetch(imageUrl);
  
  // إذا فشل بخطأ 403/401، نحاول تجديد الرابط
  if (!response.ok && (response.status === 403 || response.status === 401) && s3Key) {
    logger.info("تجديد رابط S3 المنتهي", { s3Key });
    try {
      const { url: freshUrl } = await storageGet(s3Key);
      response = await fetch(freshUrl);
    } catch (e: any) {
      logger.warn("فشل تجديد الرابط", { error: e.message });
    }
  }

  if (!response.ok) {
    throw new Error(`فشل تحميل الصورة: HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString('base64');
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  
  return `data:${contentType};base64,${base64}`;
}

/**
 * تحليل استجابة Claude واستخراج JSON
 */
function parseClaudeResponse(content: string): any {
  // محاولة استخراج JSON من الاستجابة
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // تجاهل خطأ التحليل
    }
  }
  
  // إذا فشل، نعيد كائن فارغ
  return {
    date: null,
    grandTotal: null,
    sections: [],
    rawText: content
  };
}

/**
 * تحويل النص إلى رقم
 */
function parseAmount(value: any): number | null {
  if (value === null || value === undefined) return null;
  const str = String(value).replace(/[^\d.-]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

// ==================== الدالة الرئيسية ====================

/**
 * قراءة صورة إيصال POS مباشرة بواسطة Claude
 * بدون شروط معقدة - فقط إرسال الصورة وقراءتها
 * 
 * @param imageUrl رابط الصورة (S3, HTTP, أو base64)
 * @param s3Key مفتاح S3 (اختياري - لتجديد الروابط المنتهية)
 */
export async function readReceiptImage(
  imageUrl: string,
  s3Key?: string
): Promise<SimpleOCRResult> {
  const startTime = Date.now();
  
  logger.info("بدء قراءة الصورة مباشرة بواسطة Claude", {
    hasS3Key: !!s3Key,
    urlPreview: imageUrl.substring(0, 50)
  });

  try {
    // 1. تحميل الصورة وتحويلها إلى base64
    const base64Image = await loadImageAsBase64(imageUrl, s3Key);
    logger.info("تم تحميل الصورة بنجاح", {
      base64Length: base64Image.length
    });

    // 2. إرسال الصورة مباشرة إلى Claude
    const messages: Message[] = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `اقرأ هذه الصورة لإيصال موازنة نقاط البيع (POS).

استخرج:
1. التاريخ (بتنسيق YYYY-MM-DD)
2. المجموع الكلي (Grand Total)
3. الأقسام (mada, VISA, MasterCard, إلخ) مع مجموع كل قسم

أجب بـ JSON فقط:
{
  "date": "YYYY-MM-DD",
  "grandTotal": 0,
  "sections": [{"name": "mada", "total": 0, "count": 0}],
  "rawText": "ملخص ما قرأته"
}`
          },
          {
            type: "image_url",
            image_url: {
              url: base64Image,
              detail: "high"
            }
          }
        ]
      }
    ];

    logger.info("إرسال الصورة إلى Claude...");
    
    const response = await invokeLLM({
      messages,
      temperature: 0.1
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("لم يتم استلام استجابة من Claude");
    }

    logger.info("استجابة Claude", { 
      contentPreview: content.substring(0, 200) 
    });

    // 3. تحليل الاستجابة
    const parsed = parseClaudeResponse(content);
    
    const processingTime = Date.now() - startTime;
    
    const result: SimpleOCRResult = {
      success: true,
      data: {
        date: parsed.date || null,
        grandTotal: parseAmount(parsed.grandTotal),
        sections: (parsed.sections || []).map((s: any) => ({
          name: s.name || "unknown",
          total: parseAmount(s.total) || 0,
          count: parseInt(s.count) || 0
        })),
        rawText: parsed.rawText || null
      },
      confidence: parsed.grandTotal ? "high" : "medium",
      processingTime
    };

    logger.info("✅ تم قراءة الصورة بنجاح", {
      grandTotal: result.data.grandTotal,
      date: result.data.date,
      sectionsCount: result.data.sections.length,
      processingTime
    });

    return result;

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    
    logger.error("❌ فشل قراءة الصورة", {
      error: error.message,
      processingTime
    });

    return {
      success: false,
      data: {
        date: null,
        grandTotal: null,
        sections: [],
        rawText: null
      },
      confidence: "none",
      error: error.message,
      processingTime
    };
  }
}

/**
 * قراءة صورة موازنة والتحقق من المبلغ
 * نسخة مبسطة من verifyBalanceImage
 */
export async function verifyReceiptSimple(
  imageUrl: string,
  expectedAmount: number,
  s3Key?: string
): Promise<{
  success: boolean;
  isMatched: boolean;
  extractedAmount: number | null;
  expectedAmount: number;
  difference: number | null;
  message: string;
}> {
  const result = await readReceiptImage(imageUrl, s3Key);
  
  if (!result.success || result.data.grandTotal === null) {
    return {
      success: false,
      isMatched: false,
      extractedAmount: null,
      expectedAmount,
      difference: null,
      message: result.error || "فشل قراءة الصورة"
    };
  }

  const extracted = result.data.grandTotal;
  const difference = Math.abs(extracted - expectedAmount);
  const tolerance = expectedAmount * 0.02; // 2% تسامح
  const isMatched = difference <= tolerance;

  return {
    success: true,
    isMatched,
    extractedAmount: extracted,
    expectedAmount,
    difference,
    message: isMatched 
      ? `✅ المبلغ متطابق: ${extracted} ريال`
      : `⚠️ فرق ${difference.toFixed(2)} ريال (المستخرج: ${extracted}, المتوقع: ${expectedAmount})`
  };
}
