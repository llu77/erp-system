import { invokeLLM, type Message } from "./server/_core/llm";
import * as fs from "fs";

async function testLLMWithBase64() {
  console.log("🔍 اختبار استدعاء LLM مع base64...");
  
  // قراءة الصورة وتحويلها إلى base64
  const imagePath = "/home/ubuntu/upload/fcc83d9c-0ef8-4bb1-9ce4-69334bb62c60.jpeg";
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");
  const dataUrl = `data:image/jpeg;base64,${base64Image}`;
  
  console.log(`📊 حجم الصورة: ${imageBuffer.length} bytes`);
  console.log(`📊 طول base64: ${base64Image.length} characters`);
  
  const messages: Message[] = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `هذه صورة إيصال موازنة من جهاز نقاط البيع.
استخرج من هذه الصورة:
1. التاريخ (بتنسيق YYYY-MM-DD)
2. مجموع mada TOTALS (الرقم فقط)
3. مجموع VISA TOTALS (الرقم فقط)
4. المجموع الكلي

أجب بتنسيق JSON فقط:
{
  "date": "التاريخ",
  "mada_total": 0,
  "visa_total": 0,
  "grand_total": 0
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

  try {
    const response = await invokeLLM({ messages, temperature: 0.1 });
    console.log("\n📊 استجابة LLM:");
    const content = response.choices?.[0]?.message?.content;
    console.log("Content:", content);
  } catch (error) {
    console.error("❌ خطأ:", error);
  }
}

testLLMWithBase64();
