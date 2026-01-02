import { storagePut } from './server/storage.ts';

async function testUpload() {
  try {
    console.log('Testing storage upload...');
    
    // إنشاء صورة اختبارية صغيرة (1x1 pixel PNG)
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const buffer = Buffer.from(testImageBase64, 'base64');
    
    const result = await storagePut(
      `test/test-${Date.now()}.png`,
      buffer,
      'image/png'
    );
    
    console.log('Upload successful!');
    console.log('Result:', result);
  } catch (error) {
    console.error('Upload failed!');
    console.error('Error:', error.message);
    console.error('Full error:', error);
  }
}

testUpload();
