/**
 * اختبار نظام OCR مع معالجة الصور الجديدة
 * Test OCR with New Image Preprocessing System
 */

import { smartPreprocess, THERMAL_RECEIPT_PRESET, LOW_QUALITY_PRESET } from "./server/ocr/imagePreprocessing";
import { extractWithRetry } from "./server/ocr/ocrRetryStrategy";
import * as fs from "fs";
import * as path from "path";

const TEST_IMAGE_PATH = "/home/ubuntu/upload/fcc83d9c-0ef8-4bb1-9ce4-69334bb62c60.jpeg";

// البيانات المتوقعة من الصورة (بناءً على التحليل البصري)
const EXPECTED_DATA = {
  date: "2026-01-31", // التاريخ في الإيصال: 31/01/2016 (مع تصحيح السنة)
  madaTotal: 920.00,
  visaTotal: 135.00,
  grandTotal: 1055.00, // mada (920) + VISA (135)
  sections: ["mada", "VISA"]
};

async function runTest() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("🧪 اختبار نظام OCR مع معالجة الصور الجديدة");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // التحقق من وجود الصورة
  if (!fs.existsSync(TEST_IMAGE_PATH)) {
    console.error("❌ الصورة غير موجودة:", TEST_IMAGE_PATH);
    process.exit(1);
  }

  const imageStats = fs.statSync(TEST_IMAGE_PATH);
  console.log("📷 معلومات الصورة:");
  console.log(`   - المسار: ${TEST_IMAGE_PATH}`);
  console.log(`   - الحجم: ${(imageStats.size / 1024).toFixed(2)} KB`);
  console.log("");

  // ═══════════════════════════════════════════════════════════════
  // الخطوة 1: اختبار معالجة الصورة مسبقاً
  // ═══════════════════════════════════════════════════════════════
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📸 الخطوة 1: معالجة الصورة مسبقاً (Smart Preprocessing)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  try {
    const preprocessResult = await smartPreprocess(TEST_IMAGE_PATH);
    
    console.log("✅ نجحت معالجة الصورة:");
    console.log(`   - الحجم الأصلي: ${(preprocessResult.originalSize / 1024).toFixed(2)} KB`);
    console.log(`   - الحجم بعد المعالجة: ${(preprocessResult.processedSize / 1024).toFixed(2)} KB`);
    console.log(`   - نسبة الضغط: ${(preprocessResult.processedSize / preprocessResult.originalSize * 100).toFixed(1)}%`);
    console.log(`   - الأبعاد الأصلية: ${preprocessResult.originalWidth}x${preprocessResult.originalHeight}`);
    console.log(`   - الأبعاد بعد المعالجة: ${preprocessResult.processedWidth}x${preprocessResult.processedHeight}`);
    console.log(`   - وقت المعالجة: ${preprocessResult.processingTime}ms`);
    console.log(`   - التحسينات المطبقة: ${preprocessResult.appliedEnhancements.join(", ")}`);
    console.log("");
  } catch (error: any) {
    console.error("❌ فشلت معالجة الصورة:", error.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // الخطوة 2: اختبار OCR مع معالجة الصور (مفعّلة)
  // ═══════════════════════════════════════════════════════════════
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔍 الخطوة 2: استخراج البيانات مع معالجة الصور (مفعّلة)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const startWithPreprocess = Date.now();
  
  try {
    const resultWithPreprocess = await extractWithRetry(TEST_IMAGE_PATH, {
      preprocessImage: true,
      maxRetries: 3
    });

    const durationWithPreprocess = Date.now() - startWithPreprocess;

    console.log("📊 نتائج OCR مع معالجة الصور:");
    console.log(`   - النجاح: ${resultWithPreprocess.finalResult.success ? "✅" : "❌"}`);
    console.log(`   - عدد المحاولات: ${resultWithPreprocess.attempts.length}`);
    console.log(`   - الوقت الإجمالي: ${durationWithPreprocess}ms`);
    console.log("");

    if (resultWithPreprocess.finalResult.success) {
      console.log("📋 البيانات المستخرجة:");
      console.log(`   - التاريخ: ${resultWithPreprocess.finalResult.extractedDate || "غير متوفر"}`);
      console.log(`   - المجموع الكلي: ${resultWithPreprocess.finalResult.grandTotal || 0} ر.س`);
      console.log(`   - الثقة: ${resultWithPreprocess.finalResult.confidence}`);
      console.log("");

      if (resultWithPreprocess.finalResult.sections && resultWithPreprocess.finalResult.sections.length > 0) {
        console.log("📑 الأقسام المستخرجة:");
        for (const section of resultWithPreprocess.finalResult.sections) {
          console.log(`   - ${section.name}: ${section.total} ر.س (${section.count} عملية)`);
        }
        console.log("");
      }

      // مقارنة مع البيانات المتوقعة
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("📊 مقارنة مع البيانات المتوقعة:");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

      const extractedDate = resultWithPreprocess.finalResult.extractedDate;
      const extractedTotal = resultWithPreprocess.finalResult.grandTotal || 0;

      // التحقق من التاريخ
      const dateMatch = extractedDate === EXPECTED_DATA.date;
      console.log(`   التاريخ:`);
      console.log(`      - المتوقع: ${EXPECTED_DATA.date}`);
      console.log(`      - المستخرج: ${extractedDate || "غير متوفر"}`);
      console.log(`      - النتيجة: ${dateMatch ? "✅ مطابق" : "⚠️ غير مطابق"}`);
      console.log("");

      // التحقق من المجموع
      const totalDiff = Math.abs(extractedTotal - EXPECTED_DATA.grandTotal);
      const totalMatch = totalDiff <= 1; // tolerance of 1 SAR
      console.log(`   المجموع الكلي:`);
      console.log(`      - المتوقع: ${EXPECTED_DATA.grandTotal} ر.س`);
      console.log(`      - المستخرج: ${extractedTotal} ر.س`);
      console.log(`      - الفرق: ${totalDiff.toFixed(2)} ر.س`);
      console.log(`      - النتيجة: ${totalMatch ? "✅ مطابق" : "⚠️ غير مطابق"}`);
      console.log("");

      // النتيجة النهائية
      console.log("═══════════════════════════════════════════════════════════════");
      if (dateMatch && totalMatch) {
        console.log("🎉 النتيجة النهائية: ✅ نجاح كامل - دقة 100%");
      } else if (totalMatch) {
        console.log("🔶 النتيجة النهائية: ⚠️ نجاح جزئي - المبلغ صحيح، التاريخ يحتاج مراجعة");
      } else if (dateMatch) {
        console.log("🔶 النتيجة النهائية: ⚠️ نجاح جزئي - التاريخ صحيح، المبلغ يحتاج مراجعة");
      } else {
        console.log("❌ النتيجة النهائية: فشل - كلا القيمتين غير مطابقتين");
      }
      console.log("═══════════════════════════════════════════════════════════════");

    } else {
      console.log("❌ فشل استخراج البيانات");
      console.log(`   - الخطأ: ${resultWithPreprocess.finalResult.error || "غير معروف"}`);
    }

    // عرض تفاصيل المحاولات
    console.log("\n📝 تفاصيل المحاولات:");
    for (const attempt of resultWithPreprocess.attempts) {
      const status = attempt.result.success ? "✅" : "❌";
      console.log(`   - ${attempt.promptName}: ${status} (${attempt.duration}ms)`);
      if (attempt.result.grandTotal) {
        console.log(`     المجموع: ${attempt.result.grandTotal} ر.س`);
      }
    }

  } catch (error: any) {
    console.error("❌ فشل اختبار OCR:", error.message);
    console.error(error.stack);
  }

  // ═══════════════════════════════════════════════════════════════
  // الخطوة 3: مقارنة مع OCR بدون معالجة (اختياري)
  // ═══════════════════════════════════════════════════════════════
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔬 الخطوة 3: مقارنة مع OCR بدون معالجة");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const startWithoutPreprocess = Date.now();
  
  try {
    const resultWithoutPreprocess = await extractWithRetry(TEST_IMAGE_PATH, {
      preprocessImage: false,
      maxRetries: 2
    });

    const durationWithoutPreprocess = Date.now() - startWithoutPreprocess;

    console.log("📊 نتائج OCR بدون معالجة:");
    console.log(`   - النجاح: ${resultWithoutPreprocess.finalResult.success ? "✅" : "❌"}`);
    console.log(`   - المجموع: ${resultWithoutPreprocess.finalResult.grandTotal || 0} ر.س`);
    console.log(`   - الوقت: ${durationWithoutPreprocess}ms`);

  } catch (error: any) {
    console.log("⚠️ فشل OCR بدون معالجة:", error.message);
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("✅ اكتمل الاختبار");
  console.log("═══════════════════════════════════════════════════════════════");
}

// تشغيل الاختبار
runTest().catch(console.error);
