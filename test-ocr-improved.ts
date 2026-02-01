/**
 * اختبار نظام OCR المحسّن على صورة إيصال فعلية
 */

import { extractAmountFromImage, verifyBalanceImage } from "./server/ocr/balanceImageOCR";
import { storagePut } from "./server/storage";
import * as fs from "fs";

async function testImprovedOCR() {
  console.log("=".repeat(60));
  console.log("🧪 اختبار نظام OCR المحسّن على صورة إيصال فعلية");
  console.log("=".repeat(60));
  
  const imagePath = "/home/ubuntu/upload/fcc83d9c-0ef8-4bb1-9ce4-69334bb62c60.jpeg";
  
  try {
    // رفع الصورة إلى S3
    console.log("\n📤 رفع الصورة إلى S3...");
    const imageBuffer = fs.readFileSync(imagePath);
    const fileName = `test-ocr-improved-${Date.now()}.jpeg`;
    const { url: imageUrl } = await storagePut(fileName, imageBuffer, "image/jpeg");
    console.log(`✅ تم رفع الصورة: ${imageUrl.substring(0, 80)}...`);
    
    // اختبار استخراج البيانات
    console.log("\n🔍 استخراج البيانات من الصورة (مع تحويل base64)...");
    const startTime = Date.now();
    const extractionResult = await extractAmountFromImage(imageUrl);
    const extractionTime = Date.now() - startTime;
    
    console.log("\n📊 نتائج الاستخراج:");
    console.log("-".repeat(40));
    console.log(`⏱️ وقت المعالجة: ${extractionTime}ms`);
    console.log(`✅ النجاح: ${extractionResult.success}`);
    console.log(`📅 التاريخ المستخرج: ${extractionResult.extractedDate}`);
    console.log(`💰 المبلغ الإجمالي: ${extractionResult.grandTotal} ريال`);
    console.log(`🎯 مستوى الثقة: ${extractionResult.confidence}`);
    
    if (extractionResult.sections && extractionResult.sections.length > 0) {
      console.log("\n📋 الأقسام المستخرجة:");
      extractionResult.sections.forEach((section, i) => {
        const total = Math.max(section.hostTotal, section.terminalTotal);
        console.log(`  ${i + 1}. ${section.name}: ${section.count} عملية = ${total} ريال`);
      });
    }
    
    // القيم المتوقعة
    const expectedAmount = 1055; // mada (920) + VISA (135)
    const expectedDate = "2026-01-31";
    
    console.log("\n" + "=".repeat(60));
    console.log("🔄 اختبار التحقق من المطابقة");
    console.log("=".repeat(60));
    console.log(`\n📊 القيم المتوقعة:`);
    console.log(`  💰 المبلغ: ${expectedAmount} ريال`);
    console.log(`  📅 التاريخ: ${expectedDate}`);
    
    const verificationResult = await verifyBalanceImage(
      { url: imageUrl, key: fileName, uploadedAt: new Date().toISOString() },
      expectedAmount,
      expectedDate
    );
    
    console.log("\n📊 نتائج التحقق:");
    console.log("-".repeat(40));
    console.log(`✅ النجاح الكلي: ${verificationResult.success}`);
    console.log(`💰 تطابق المبلغ: ${verificationResult.isMatched}`);
    console.log(`📅 تطابق التاريخ: ${verificationResult.isDateMatched}`);
    console.log(`💵 المبلغ المستخرج: ${verificationResult.extractedAmount} ريال`);
    console.log(`📆 التاريخ المستخرج: ${verificationResult.extractedDate}`);
    console.log(`📊 الفرق: ${verificationResult.difference} ريال`);
    console.log(`📝 الرسالة: ${verificationResult.message}`);
    
    if (verificationResult.warnings && verificationResult.warnings.length > 0) {
      console.log("\n⚠️ التحذيرات:");
      verificationResult.warnings.forEach((warning, i) => {
        console.log(`  ${i + 1}. [${warning.severity}] ${warning.message}`);
      });
    }
    
    // ملخص النتائج
    console.log("\n" + "=".repeat(60));
    console.log("📋 ملخص النتائج");
    console.log("=".repeat(60));
    
    const dateCorrect = extractionResult.extractedDate === expectedDate;
    const amountCorrect = extractionResult.grandTotal === expectedAmount;
    
    console.log(`\n| البيان | القيمة المتوقعة | القيمة المستخرجة | الحالة |`);
    console.log(`|--------|-----------------|------------------|--------|`);
    console.log(`| التاريخ | ${expectedDate} | ${extractionResult.extractedDate} | ${dateCorrect ? '✅' : '❌'} |`);
    console.log(`| المبلغ | ${expectedAmount} ر.س | ${extractionResult.grandTotal} ر.س | ${amountCorrect ? '✅' : '❌'} |`);
    
    console.log("\n" + "=".repeat(60));
    console.log(verificationResult.success ? "✅ الاختبار ناجح!" : "❌ الاختبار فشل");
    console.log("=".repeat(60));
    
  } catch (error) {
    console.error("❌ خطأ في الاختبار:", error);
    throw error;
  }
}

testImprovedOCR().catch(console.error);
