/**
 * اختبار OCR على الصورة المرفقة لتحديد سبب فشل القراءة
 */
import { extractAmountFromImage } from './server/ocr/balanceImageOCR';

async function testOCR() {
  const imagePath = '/home/ubuntu/upload/IMG_2823.png';
  
  console.log('🔍 بدء اختبار OCR على الصورة المرفقة...');
  console.log('📁 مسار الصورة:', imagePath);
  
  try {
    const result = await extractAmountFromImage(imagePath);
    
    console.log('\n📊 نتيجة الاستخراج:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n✅ نجح الاستخراج');
      console.log('💰 المبلغ المستخرج:', result.extractedAmount);
      console.log('📅 التاريخ المستخرج:', result.extractedDate);
      console.log('📊 الأقسام:', result.sections);
      console.log('🎯 الثقة:', result.confidence);
    } else {
      console.log('\n❌ فشل الاستخراج');
      console.log('🔴 الخطأ:', result.error);
    }
  } catch (error: any) {
    console.error('\n💥 خطأ في الاختبار:', error.message);
    console.error(error.stack);
  }
}

testOCR();
