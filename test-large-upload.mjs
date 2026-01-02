import { storagePut } from './server/storage.ts';

// إنشاء صورة اختبارية أكبر (500KB تقريباً)
const size = 500 * 1024; // 500KB
const buffer = Buffer.alloc(size);
// ملء البيانات بقيم عشوائية
for (let i = 0; i < size; i++) {
  buffer[i] = Math.floor(Math.random() * 256);
}

async function testLargeUpload() {
  try {
    console.log('Testing large file upload...');
    console.log('Buffer size:', (buffer.length / 1024).toFixed(2), 'KB');
    
    const timestamp = Date.now();
    const fileKey = `test-uploads/large-test-${timestamp}.jpg`;
    
    const startTime = Date.now();
    const result = await storagePut(fileKey, buffer, 'image/jpeg');
    const duration = Date.now() - startTime;
    
    console.log('Upload successful!');
    console.log('Duration:', duration, 'ms');
    console.log('Key:', result.key);
    console.log('URL:', result.url);
  } catch (error) {
    console.error('Upload failed!');
    console.error('Error:', error.message);
    console.error('Full error:', error);
  }
}

testLargeUpload();
