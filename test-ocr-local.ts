/**
 * اختبار OCR مباشرة مع base64 من الملف المحلي
 */

import { invokeLLM, type Message } from "./server/_core/llm";
import * as fs from "fs";

async function testOCRLocal() {
  console.log("=".repeat(60));
  console.log("🧪 اختبار OCR مباشرة من الملف المحلي");
  console.log("=".repeat(60));
  
  const imagePath = "/home/ubuntu/upload/fcc83d9c-0ef8-4bb1-9ce4-69334bb62c60.jpeg";
  
  // قراءة الصورة وتحويلها إلى base64
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");
  const dataUrl = `data:image/jpeg;base64,${base64Image}`;
  
  console.log(`📊 حجم الصورة: ${imageBuffer.length} bytes`);
  
  const CURRENT_YEAR = new Date().getFullYear();
  
  const messages: Message[] = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `أنت خبير في قراءة إيصالات نقاط البيع (POS Terminal Receipts).

هذه صورة إيصال موازنة يومية. السنة الحالية هي ${CURRENT_YEAR}.

استخرج البيانات التالية:
1. التاريخ من أعلى الإيصال (بتنسيق YYYY-MM-DD)
2. مجموع TOTALS لكل قسم (mada, VISA, MasterCard, DISCOVER, Maestro, GCCNET, UNIONPAY)
3. المجموع الكلي لجميع الأقسام

ملاحظات مهمة:
- ابحث عن "TOTALS" في كل قسم - هذا هو المجموع المطلوب
- إذا كان القسم يحتوي على "NO TRANSACTIONS" فالمجموع = 0
- المبالغ بالريال السعودي (SAR)
- السنة في التاريخ يجب أن تكون ${CURRENT_YEAR} أو قريبة منها

أجب بتنسيق JSON فقط (بدون أي نص إضافي):
{
  "date": "YYYY-MM-DD",
  "sections": [
    {"name": "mada", "total": 0, "count": 0},
    {"name": "VISA", "total": 0, "count": 0}
  ],
  "grandTotal": 0,
  "confidence": "high/medium/low",
  "rawText": "ملخص قصير لما قرأته"
}`
        },
        {
          type: "image_url",
          image_url: {
            url: dataUrl,
            detail: "high"
          }
        }
      ]
    }
  ];

  const startTime = Date.now();
  const response = await invokeLLM({ messages, temperature: 0.1 });
  const processingTime = Date.now() - startTime;
  
  const content = response.choices?.[0]?.message?.content;
  console.log(`\n⏱️ وقت المعالجة: ${processingTime}ms`);
  console.log("\n📊 استجابة LLM:");
  console.log(content);
  
  // محاولة تحليل JSON
  try {
    let jsonStr = content?.trim() || "";
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    const parsed = JSON.parse(jsonStr);
    
    console.log("\n📋 البيانات المستخرجة:");
    console.log(`  📅 التاريخ: ${parsed.date}`);
    console.log(`  💰 المجموع الكلي: ${parsed.grandTotal} ريال`);
    console.log(`  🎯 الثقة: ${parsed.confidence}`);
    
    if (parsed.sections && parsed.sections.length > 0) {
      console.log("\n📋 الأقسام:");
      parsed.sections.forEach((s: any, i: number) => {
        console.log(`  ${i + 1}. ${s.name}: ${s.count} عملية = ${s.total} ريال`);
      });
    }
    
    // التحقق من الدقة
    const expectedDate = "2026-01-31";
    const expectedAmount = 1055;
    
    console.log("\n" + "=".repeat(60));
    console.log("📋 التحقق من الدقة");
    console.log("=".repeat(60));
    console.log(`| البيان | المتوقع | المستخرج | الحالة |`);
    console.log(`|--------|---------|----------|--------|`);
    console.log(`| التاريخ | ${expectedDate} | ${parsed.date} | ${parsed.date === expectedDate ? '✅' : '❌'} |`);
    console.log(`| المبلغ | ${expectedAmount} | ${parsed.grandTotal} | ${parsed.grandTotal === expectedAmount ? '✅' : '❌'} |`);
    
  } catch (e) {
    console.error("❌ خطأ في تحليل JSON:", e);
  }
}

testOCRLocal().catch(console.error);
