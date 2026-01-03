import 'dotenv/config';

// اختبار API التسجيل بتنسيق tRPC الصحيح
const testData = {
  name: 'عميل اختبار API',
  phone: '0599333444',
  serviceType: 'حلاقة شعر',
  invoiceImageUrl: 'https://example.com/test.jpg',
  invoiceImageKey: 'test-key',
};

try {
  const response = await fetch('http://localhost:3000/api/trpc/loyalty.register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ json: testData }),
  });
  
  const result = await response.json();
  console.log('Response status:', response.status);
  console.log('Response:', JSON.stringify(result, null, 2));
} catch (err) {
  console.error('Error:', err.message);
}
