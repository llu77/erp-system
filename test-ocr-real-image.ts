/**
 * اختبار نظام OCR على صورة إيصال فعلية
 * Test OCR system on real receipt image
 */

import { extractAmountFromImage, verifyBalanceImage } from "./server/ocr/balanceImageOCR";
import { storagePut } from "./server/storage";
import * as fs from "fs";
import * as path from "path";

async function testOCRWithRealImage() {
  console.log("=".repeat(60));
  console.log("🧪 اختبار نظام OCR على صورة إيصال فعلية");
  console.log("=".repeat(60));
  
  // قراءة الصورة من المسار المحلي
  const imagePath = "/home/ubuntu/upload/fcc83d9c-0ef8-4bb1-9ce4-69334bb62c60.jpeg";
  
  try {
    // رفع الصورة إلى S3 للحصول على رابط
    console.log("\n📤 رفع الصورة إلى S3...");
    const imageBuffer = fs.readFileSync(imagePath);
    const fileName = `test-ocr-${Date.now()}.jpeg`;
    const { url: imageUrl } = await storagePut(fileName, imageBuffer, "image/jpeg");
    console.log(`✅ تم رفع الصورة: ${imageUrl.substring(0, 80)}...`);
    
    // اختبار استخراج البيانات
    console.log("\n🔍 استخراج البيانات من الصورة...");
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
        console.log(`  ${i + 1}. ${section.name}: ${section.count} عملية = ${section.hostTotal || section.terminalTotal} ريال`);
      });
    }
    
    if (extractionResult.rawText) {
      console.log("\n📝 النص الخام (ملخص):");
      console.log(extractionResult.rawText.substring(0, 500));
    }
    
    // اختبار التحقق من المطابقة
    console.log("\n" + "=".repeat(60));
    console.log("🔄 اختبار التحقق من المطابقة");
    console.log("=".repeat(60));
    
    // القيم المتوقعة بناءً على تحليل الصورة
    const expectedAmount = 1055; // mada (920) + VISA (135)
    const expectedDate = "2026-01-31";
    
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
    console.log(`✅ النجاح: ${verificationResult.success}`);
    console.log(`💰 تطابق المبلغ: ${verificationResult.isMatched}`);
    console.log(`📅 تطابق التاريخ: ${verificationResult.isDateMatched}`);
    console.log(`💵 المبلغ المستخرج: ${verificationResult.extractedAmount} ريال`);
    console.log(`📆 التاريخ المستخرج: ${verificationResult.extractedDate}`);
    console.log(`📝 الرسالة: ${verificationResult.message}`);
    
    if (verificationResult.difference !== null) {
      console.log(`📊 الفرق: ${verificationResult.difference} ريال`);
    }
    
    if (verificationResult.warnings && verificationResult.warnings.length > 0) {
      console.log("\n⚠️ التحذيرات:");
      verificationResult.warnings.forEach((warning, i) => {
        console.log(`  ${i + 1}. [${warning.severity}] ${warning.message}`);
        if (warning.suggestion) {
          console.log(`     💡 ${warning.suggestion}`);
        }
      });
    }
    
    // اختبار مع مبلغ خاطئ
    console.log("\n" + "=".repeat(60));
    console.log("🔄 اختبار مع مبلغ خاطئ (500 ريال)");
    console.log("=".repeat(60));
    
    const wrongAmountResult = await verifyBalanceImage(
      { url: imageUrl, key: fileName, uploadedAt: new Date().toISOString() },
      500,
      expectedDate
    );
    
    console.log(`✅ النجاح: ${wrongAmountResult.success}`);
    console.log(`💰 تطابق المبلغ: ${wrongAmountResult.isMatched}`);
    console.log(`📝 الرسالة: ${wrongAmountResult.message}`);
    
    console.log("\n" + "=".repeat(60));
    console.log("✅ اكتمل الاختبار بنجاح");
    console.log("=".repeat(60));
    
  } catch (error) {
    console.error("❌ خطأ في الاختبار:", error);
    throw error;
  }
}

// تشغيل الاختبار
testOCRWithRealImage().catch(console.error);
