/**
 * اختبار تحسين قراءة التاريخ في OCR
 * التحقق من قراءة تاريخ الموازنة (أعلى الإيصال) بدلاً من تاريخ الطباعة (أسفل الإيصال)
 */

import { extractAmountFromImage } from './server/ocr/balanceImageOCR';
import * as fs from 'fs';
import * as path from 'path';

const IMAGE_PATH = '/home/ubuntu/upload/fcc83d9c-0ef8-4bb1-9ce4-69334bb62c60.jpeg';

// القيم المتوقعة من الإيصال
const EXPECTED = {
  grandTotal: 1055,  // mada: 920 + VISA: 135
  date: '2026-01-31' // تاريخ الموازنة (31/01/2016 → 2026-01-31 بعد التصحيح)
};

async function runTest() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🧪 اختبار تحسين قراءة التاريخ في OCR');
  console.log('═══════════════════════════════════════════════════════════════');
  
  // التحقق من وجود الصورة
  if (!fs.existsSync(IMAGE_PATH)) {
    console.error('❌ الصورة غير موجودة:', IMAGE_PATH);
    process.exit(1);
  }
  
  console.log('📷 الصورة:', IMAGE_PATH);
  console.log('📊 القيم المتوقعة:');
  console.log(`   - المجموع: ${EXPECTED.grandTotal} ر.س`);
  console.log(`   - التاريخ: ${EXPECTED.date} (تاريخ الموازنة، ليس تاريخ الطباعة)`);
  console.log('');
  
  // تحويل الصورة إلى base64
  const imageBuffer = fs.readFileSync(IMAGE_PATH);
  const base64Image = imageBuffer.toString('base64');
  const dataUrl = `data:image/jpeg;base64,${base64Image}`;
  
  console.log('⏳ جاري استخراج البيانات...');
  const startTime = Date.now();
  
  try {
    const result = await extractAmountFromImage(dataUrl);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 نتائج الاختبار:');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`⏱️  وقت المعالجة: ${duration} ثانية`);
    console.log(`✅ نجاح العملية: ${result.success ? 'نعم' : 'لا'}`);
    console.log(`💰 المجموع المستخرج: ${result.extractedAmount} ر.س`);
    console.log(`📅 التاريخ المستخرج: ${result.extractedDate || 'غير متوفر'}`);
    console.log(`🎯 مستوى الثقة: ${result.confidence}`);
    console.log('');
    
    // التحقق من الدقة
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔍 التحقق من الدقة:');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const amountMatch = result.extractedAmount === EXPECTED.grandTotal;
    const dateMatch = result.extractedDate === EXPECTED.date;
    
    console.log(`   - المجموع: ${amountMatch ? '✅' : '❌'} (متوقع: ${EXPECTED.grandTotal}, فعلي: ${result.extractedAmount})`);
    console.log(`   - التاريخ: ${dateMatch ? '✅' : '❌'} (متوقع: ${EXPECTED.date}, فعلي: ${result.extractedDate})`);
    console.log('');
    
    if (amountMatch && dateMatch) {
      console.log('🎉 النتيجة النهائية: نجاح كامل ✅');
      console.log('   تم قراءة تاريخ الموازنة الصحيح من أعلى الإيصال');
    } else if (amountMatch) {
      console.log('⚠️ النتيجة النهائية: نجاح جزئي');
      console.log('   المجموع صحيح، لكن التاريخ يحتاج مراجعة');
    } else {
      console.log('❌ النتيجة النهائية: فشل');
    }
    
    console.log('═══════════════════════════════════════════════════════════════');
    
  } catch (error) {
    console.error('❌ خطأ في الاختبار:', error);
    process.exit(1);
  }
}

runTest();
