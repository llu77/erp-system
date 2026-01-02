import { storagePut } from './server/storage.ts';

// إنشاء صورة اختبارية صغيرة (1x1 pixel PNG)
const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const buffer = Buffer.from(testImageBase64, 'base64');

async function testUpload() {
  try {
    console.log('Testing storage upload...');
    console.log('Buffer size:', buffer.length, 'bytes');
    
    const timestamp = Date.now();
    const fileKey = `test-uploads/test-${timestamp}.png`;
    
    const result = await storagePut(fileKey, buffer, 'image/png');
    console.log('Upload successful!');
    console.log('Key:', result.key);
    console.log('URL:', result.url);
  } catch (error) {
    console.error('Upload failed!');
    console.error('Error:', error.message);
    console.error('Full error:', error);
  }
}

testUpload();
