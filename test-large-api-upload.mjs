// اختبار API رفع صورة كبيرة

// إنشاء بيانات base64 كبيرة (حوالي 500KB)
const size = 500 * 1024;
const randomData = Buffer.alloc(size);
for (let i = 0; i < size; i++) {
  randomData[i] = Math.floor(Math.random() * 256);
}
const largeBase64 = 'data:image/jpeg;base64,' + randomData.toString('base64');

console.log('Testing large image upload...');
console.log('Base64 size:', (largeBase64.length / 1024 / 1024).toFixed(2), 'MB');

async function testLargeUpload() {
  const startTime = Date.now();
  
  try {
    const response = await fetch('http://localhost:3000/api/trpc/loyalty.uploadInvoiceImage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        json: {
          base64Data: largeBase64,
          fileName: 'large-test-invoice.jpg',
          contentType: 'image/jpeg',
        }
      }),
    });
    
    const duration = Date.now() - startTime;
    const result = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Duration:', duration, 'ms');
    console.log('Response:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testLargeUpload();
