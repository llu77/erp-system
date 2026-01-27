/**
 * سكريبت رفع صورة الموظف إلى S3 وتحديث قاعدة البيانات
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// تحميل متغيرات البيئة
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

async function uploadToS3(filePath, relKey) {
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(relKey);
  
  // إنشاء FormData
  const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
  const formData = new FormData();
  formData.append('file', blob, fileName);
  
  // بناء URL للرفع
  const baseUrl = FORGE_API_URL.endsWith('/') ? FORGE_API_URL : `${FORGE_API_URL}/`;
  const uploadUrl = new URL('v1/storage/upload', baseUrl);
  uploadUrl.searchParams.set('path', relKey);
  
  console.log(`📤 جاري الرفع إلى: ${uploadUrl.toString()}`);
  
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FORGE_API_KEY}`,
    },
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`فشل رفع الصورة (${response.status}): ${error}`);
  }
  
  const result = await response.json();
  return result.url;
}

async function updateEmployeePhoto(employeeCode, photoUrl) {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  try {
    // تحديث صورة الموظف
    const [result] = await connection.execute(
      'UPDATE employees SET photoUrl = ? WHERE code = ?',
      [photoUrl, employeeCode]
    );
    
    if (result.affectedRows === 0) {
      throw new Error(`لم يتم العثور على موظف بالكود: ${employeeCode}`);
    }
    
    console.log(`✅ تم تحديث صورة الموظف ${employeeCode}`);
    return result;
  } finally {
    await connection.end();
  }
}

async function main() {
  const employeeCode = process.argv[2] || 'EMP-004'; // عبدالحي جلال
  const photoPath = process.argv[3] || path.join(__dirname, '..', 'abdulhai-photo.jpeg');
  
  console.log(`📸 جاري رفع صورة الموظف ${employeeCode}...`);
  console.log(`   المسار: ${photoPath}`);
  
  if (!fs.existsSync(photoPath)) {
    console.error(`❌ الملف غير موجود: ${photoPath}`);
    process.exit(1);
  }
  
  try {
    // رفع الصورة إلى S3
    const relKey = `employees/photos/${employeeCode}-${Date.now()}.jpeg`;
    const photoUrl = await uploadToS3(photoPath, relKey);
    
    console.log(`✅ تم رفع الصورة بنجاح`);
    console.log(`   URL: ${photoUrl}`);
    
    // تحديث قاعدة البيانات
    await updateEmployeePhoto(employeeCode, photoUrl);
    
    console.log(`\n🎉 تمت العملية بنجاح!`);
  } catch (error) {
    console.error(`❌ خطأ: ${error.message}`);
    process.exit(1);
  }
}

main();
