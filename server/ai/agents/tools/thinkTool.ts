/**
 * أداة التفكير - Think Tool
 * =========================
 * 
 * أداة للاستدلال الداخلي بدون تنفيذ إجراءات خارجية
 * تُستخدم عندما يحتاج الـ Agent للتفكير في مشكلة معقدة
 */

import { BaseTool } from "./baseTool";

export class ThinkTool extends BaseTool {
  constructor() {
    super(
      "think",
      `استخدم هذه الأداة للتفكير في شيء ما. لن تحصل على معلومات جديدة 
      أو تغير قاعدة البيانات، ولكنها ستضيف الفكرة إلى السجل.
      استخدمها عندما تحتاج إلى استدلال معقد أو ذاكرة مؤقتة.`,
      {
        type: "object",
        properties: {
          thought: {
            type: "string",
            description: "الفكرة أو الاستدلال الذي تريد تسجيله",
          },
          category: {
            type: "string",
            description: "تصنيف الفكرة (اختياري)",
            enum: ["analysis", "planning", "problem_solving", "reflection", "other"],
          },
        },
        required: ["thought"],
      }
    );
  }

  async execute(input: { thought: string; category?: string }): Promise<string> {
    const { thought, category } = input;
    
    // تسجيل الفكرة (يمكن توسيعها لاحقاً للحفظ في قاعدة البيانات)
    console.log(`[ThinkTool] ${category || "general"}: ${thought}`);
    
    return "تم تسجيل الفكرة بنجاح!";
  }
}

export const thinkTool = new ThinkTool();
