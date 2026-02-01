/**
 * اختبار استراتيجية Smart Fallback
 * يختبر OCR بدون معالجة الصور (الافتراضي الجديد)
 */

import { extractWithRetry } from "./server/ocr/ocrRetryStrategy";

const IMAGE_PATH = "/home/ubuntu/upload/fcc83d9c-0ef8-4bb1-9ce4-69334bb62c60.jpeg";

async function testSmartFallback() {
  console.log("=".repeat(60));
  console.log("🧪 اختبار استراتيجية Smart Fallback");
  console.log("=".repeat(60));
  
  // الاختبار 1: بدون معالجة الصور (الافتراضي الجديد)
  console.log("\n📸 الاختبار 1: OCR بدون معالجة الصور (الافتراضي)");
  console.log("-".repeat(40));
  
  const startTime1 = Date.now();
  const result1 = await extractWithRetry(IMAGE_PATH, {
    preprocessImage: false,
    maxRetries: 2
  });
  const duration1 = Date.now() - startTime1;
  
  console.log(`✅ النتيجة: ${result1.success ? "نجاح" : "فشل"}`);
  console.log(`💰 المجموع: ${result1.finalResult.grandTotal} ر.س`);
  console.log(`📅 التاريخ: ${result1.finalResult.extractedDate}`);
  console.log(`🎯 الثقة: ${result1.finalResult.confidence}`);
  console.log(`⏱️ الوقت: ${(duration1 / 1000).toFixed(2)} ثانية`);
  console.log(`🔄 المحاولات: ${result1.attempts.length}`);
  
  // الاختبار 2: مع معالجة الصور (للمقارنة)
  console.log("\n📸 الاختبار 2: OCR مع معالجة الصور (للمقارنة)");
  console.log("-".repeat(40));
  
  const startTime2 = Date.now();
  const result2 = await extractWithRetry(IMAGE_PATH, {
    preprocessImage: true,
    maxRetries: 2
  });
  const duration2 = Date.now() - startTime2;
  
  console.log(`✅ النتيجة: ${result2.success ? "نجاح" : "فشل"}`);
  console.log(`💰 المجموع: ${result2.finalResult.grandTotal} ر.س`);
  console.log(`📅 التاريخ: ${result2.finalResult.extractedDate}`);
  console.log(`🎯 الثقة: ${result2.finalResult.confidence}`);
  console.log(`⏱️ الوقت: ${(duration2 / 1000).toFixed(2)} ثانية`);
  console.log(`🔄 المحاولات: ${result2.attempts.length}`);
  
  // المقارنة
  console.log("\n" + "=".repeat(60));
  console.log("📊 مقارنة النتائج:");
  console.log("=".repeat(60));
  console.log(`| المقياس         | بدون معالجة | مع معالجة |`);
  console.log(`|-----------------|-------------|-----------|`);
  console.log(`| المجموع         | ${result1.finalResult.grandTotal} ر.س    | ${result2.finalResult.grandTotal} ر.س   |`);
  console.log(`| التاريخ         | ${result1.finalResult.extractedDate}  | ${result2.finalResult.extractedDate} |`);
  console.log(`| الثقة           | ${result1.finalResult.confidence}       | ${result2.finalResult.confidence}      |`);
  console.log(`| الوقت           | ${(duration1 / 1000).toFixed(2)}s       | ${(duration2 / 1000).toFixed(2)}s      |`);
  
  // القيم المتوقعة
  const expectedTotal = 1055;
  const expectedDate = "2026-01-31";
  
  console.log("\n📋 القيم المتوقعة:");
  console.log(`   المجموع: ${expectedTotal} ر.س`);
  console.log(`   التاريخ: ${expectedDate}`);
  
  const result1Correct = result1.finalResult.grandTotal === expectedTotal && result1.finalResult.extractedDate === expectedDate;
  const result2Correct = result2.finalResult.grandTotal === expectedTotal && result2.finalResult.extractedDate === expectedDate;
  
  console.log(`\n🏆 النتيجة النهائية:`);
  console.log(`   بدون معالجة: ${result1Correct ? "✅ صحيح 100%" : "❌ خطأ"}`);
  console.log(`   مع معالجة: ${result2Correct ? "✅ صحيح 100%" : "❌ خطأ"}`);
  
  if (result1Correct && !result2Correct) {
    console.log("\n✅ تأكيد: الاستراتيجية الجديدة (بدون معالجة افتراضياً) أفضل!");
  }
}

testSmartFallback().catch(console.error);
