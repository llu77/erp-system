import { invokeLLM, type Message } from "./server/_core/llm";
import { storagePut } from "./server/storage";
import * as fs from "fs";

async function testLLMDirect() {
  console.log("🔍 اختبار استدعاء LLM مباشرة...");
  
  // رفع الصورة
  const imagePath = "/home/ubuntu/upload/fcc83d9c-0ef8-4bb1-9ce4-69334bb62c60.jpeg";
  const imageBuffer = fs.readFileSync(imagePath);
  const { url: imageUrl } = await storagePut(`test-${Date.now()}.jpeg`, imageBuffer, "image/jpeg");
  console.log("✅ رابط الصورة:", imageUrl);
  
  const messages: Message[] = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `استخرج من هذه الصورة:
1. التاريخ
2. مجموع mada TOTALS
3. مجموع VISA TOTALS
4. المجموع الكلي

أجب بتنسيق JSON:
{
  "date": "التاريخ",
  "mada_total": "مجموع mada",
  "visa_total": "مجموع VISA",
  "grand_total": "المجموع الكلي"
}`
        },
        {
          type: "image_url",
          image_url: {
            url: imageUrl,
            detail: "high"
          }
        }
      ]
    }
  ];

  try {
    const response = await invokeLLM({ messages, temperature: 0.1 });
    console.log("\n📊 استجابة LLM:");
    console.log(JSON.stringify(response, null, 2));
  } catch (error) {
    console.error("❌ خطأ:", error);
  }
}

testLLMDirect();
