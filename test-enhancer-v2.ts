/**
 * اختبار ReceiptEnhancer v2.0 على صورة إيصال فعلية
 */

import * as fs from "fs";
import { enhanceReceiptImage, enhanceWeakReceiptImage, analyzeReceiptImage } from "./server/ocr/receiptEnhancer";
import { extractWithRetry } from "./server/ocr/ocrRetryStrategy";

const IMAGE_PATH = "/home/ubuntu/upload/fcc83d9c-0ef8-4bb1-9ce4-69334bb62c60.jpeg";

async function main() {
  console.log("=".repeat(60));
  console.log("اختبار ReceiptEnhancer v2.0 على صورة فعلية");
  console.log("=".repeat(60));

  // قراءة الصورة
  const imageBuffer = fs.readFileSync(IMAGE_PATH);
  console.log(`\n📷 حجم الصورة الأصلية: ${(imageBuffer.length / 1024).toFixed(2)} KB`);

  // 1. تحليل الصورة
  console.log("\n" + "-".repeat(40));
  console.log("1️⃣ تحليل الصورة:");
  const { stats, ocrReadiness } = await analyzeReceiptImage(imageBuffer);
  console.log(`   - الأبعاد: ${stats.width}x${stats.height}`);
  console.log(`   - التباين: ${stats.contrast.toFixed(1)}%`);
  console.log(`   - السطوع: ${stats.brightness.toFixed(1)}`);
  console.log(`   - الحدة: ${stats.sharpness.toFixed(1)}%`);
  console.log(`   - الضوضاء: ${stats.noiseLevel.toFixed(1)}%`);
  console.log(`   - جاهزية OCR: ${ocrReadiness.score}/100 (${ocrReadiness.level})`);
  if (ocrReadiness.issues.length > 0) {
    console.log(`   - المشاكل: ${ocrReadiness.issues.join(", ")}`);
  }

  // 2. اختبار بدون معالجة (الإعدادات الافتراضية)
  console.log("\n" + "-".repeat(40));
  console.log("2️⃣ اختبار OCR بدون معالجة (الإعدادات الافتراضية):");
  const startNoProcess = Date.now();
  const resultNoProcess = await extractWithRetry(IMAGE_PATH, {
    preprocessImage: false,
    useEnhancerV2: false
  });
  const timeNoProcess = Date.now() - startNoProcess;
  
  console.log(`   - النجاح: ${resultNoProcess.success ? "✅" : "❌"}`);
  console.log(`   - المجموع: ${resultNoProcess.finalResult.grandTotal} ر.س`);
  console.log(`   - التاريخ: ${resultNoProcess.finalResult.extractedDate}`);
  console.log(`   - الثقة: ${resultNoProcess.finalResult.confidence}`);
  console.log(`   - الوقت: ${(timeNoProcess / 1000).toFixed(2)} ثانية`);

  // 3. اختبار مع ReceiptEnhancer v2.0
  console.log("\n" + "-".repeat(40));
  console.log("3️⃣ اختبار OCR مع ReceiptEnhancer v2.0:");
  
  // أولاً: تحسين الصورة
  const enhancementResult = await enhanceWeakReceiptImage(imageBuffer);
  console.log(`   - تم المعالجة: ${enhancementResult.wasProcessed ? "✅" : "❌"}`);
  console.log(`   - الحجم الأصلي: ${(enhancementResult.originalSize / 1024).toFixed(2)} KB`);
  console.log(`   - الحجم النهائي: ${(enhancementResult.finalSize / 1024).toFixed(2)} KB`);
  console.log(`   - نسبة الضغط: ${enhancementResult.compressionPercent.toFixed(1)}%`);
  console.log(`   - جاهزية OCR: ${enhancementResult.ocrReadiness.score}/100 (${enhancementResult.ocrReadiness.level})`);
  console.log(`   - الخطوات المطبقة: ${enhancementResult.appliedSteps.join(" → ")}`);
  
  // ثانياً: OCR على الصورة المحسّنة
  const startWithEnhancer = Date.now();
  const resultWithEnhancer = await extractWithRetry(enhancementResult.base64, {
    preprocessImage: false, // الصورة محسّنة بالفعل
    useEnhancerV2: false
  });
  const timeWithEnhancer = Date.now() - startWithEnhancer;
  
  console.log(`   - النجاح: ${resultWithEnhancer.success ? "✅" : "❌"}`);
  console.log(`   - المجموع: ${resultWithEnhancer.finalResult.grandTotal} ر.س`);
  console.log(`   - التاريخ: ${resultWithEnhancer.finalResult.extractedDate}`);
  console.log(`   - الثقة: ${resultWithEnhancer.finalResult.confidence}`);
  console.log(`   - الوقت: ${(timeWithEnhancer / 1000).toFixed(2)} ثانية`);

  // 4. المقارنة
  console.log("\n" + "=".repeat(60));
  console.log("📊 المقارنة:");
  console.log("=".repeat(60));
  console.log(`
| المقياس | بدون معالجة | مع ReceiptEnhancer v2.0 |
|---------|-------------|-------------------------|
| المجموع | ${resultNoProcess.finalResult.grandTotal} ر.س | ${resultWithEnhancer.finalResult.grandTotal} ر.س |
| التاريخ | ${resultNoProcess.finalResult.extractedDate} | ${resultWithEnhancer.finalResult.extractedDate} |
| الثقة | ${resultNoProcess.finalResult.confidence} | ${resultWithEnhancer.finalResult.confidence} |
| الوقت | ${(timeNoProcess / 1000).toFixed(2)}s | ${(timeWithEnhancer / 1000).toFixed(2)}s |
`);

  // القيم المتوقعة
  const expectedTotal = 1055;
  const expectedDate = "2026-01-31";
  
  console.log("\n📋 القيم المتوقعة:");
  console.log(`   - المجموع: ${expectedTotal} ر.س`);
  console.log(`   - التاريخ: ${expectedDate}`);
  
  const noProcessCorrect = resultNoProcess.finalResult.grandTotal === expectedTotal && 
                           resultNoProcess.finalResult.extractedDate === expectedDate;
  const enhancerCorrect = resultWithEnhancer.finalResult.grandTotal === expectedTotal && 
                          resultWithEnhancer.finalResult.extractedDate === expectedDate;
  
  console.log(`\n✅ دقة بدون معالجة: ${noProcessCorrect ? "100%" : "غير صحيح"}`);
  console.log(`✅ دقة مع ReceiptEnhancer v2.0: ${enhancerCorrect ? "100%" : "غير صحيح"}`);
  
  // حفظ الصورة المحسّنة للمقارنة
  const outputPath = "/home/ubuntu/upload/enhanced-receipt-v2.jpg";
  fs.writeFileSync(outputPath, enhancementResult.buffer);
  console.log(`\n💾 تم حفظ الصورة المحسّنة في: ${outputPath}`);
}

main().catch(console.error);
