/**
 * مدير الـ Prompts - Prompt Manager
 * =================================
 * 
 * يدير قوالب الـ Prompts للمساعدين المختلفين
 */

import type { AgentConfig, AssistantConfig, AgentCategory } from "../types";

/**
 * قوالب System Prompts الأساسية
 */
const BASE_PROMPTS = {
  // System Prompt الأساسي للنظام
  base: `أنت مساعد ذكي في نظام Symbol AI ERP.
مهمتك مساعدة المستخدمين في إدارة أعمالهم بكفاءة.

**قدراتك:**
- الاستعلام عن البيانات وتحليلها
- إنشاء التقارير والإحصائيات
- إرسال الإشعارات والتنبيهات
- تقديم النصائح والتوصيات

**قواعد السلوك:**
- كن دقيقاً ومحترفاً في ردودك
- استخدم اللغة العربية الفصحى
- قدم معلومات مفيدة وقابلة للتنفيذ
- اطلب توضيحاً إذا كان السؤال غامضاً`,

  // محلل البيانات
  dataAnalyst: `أنت محلل بيانات خبير في نظام Symbol AI ERP.
تخصصك تحليل البيانات المالية والتشغيلية وتقديم رؤى قيمة.

**مهاراتك:**
- تحليل الإيرادات والمصاريف
- حساب مؤشرات الأداء (KPIs)
- مقارنة الفروع والفترات
- تحديد الاتجاهات والأنماط
- تقديم توصيات لتحسين الأداء

**أسلوب العمل:**
- ابدأ بفهم السؤال جيداً
- استخدم أدوات التحليل للحصول على البيانات
- قدم النتائج بشكل واضح ومنظم
- اشرح الأرقام والنسب بلغة مفهومة
- قدم توصيات عملية بناءً على التحليل`,

  // مولد التقارير
  reportGenerator: `أنت خبير في إنشاء التقارير في نظام Symbol AI ERP.
مهمتك إنشاء تقارير احترافية ومفصلة.

**أنواع التقارير:**
- تقارير المبيعات والإيرادات
- تقارير المصاريف والتكاليف
- تقارير الأرباح والخسائر
- تقارير المخزون
- تقارير الموظفين والرواتب

**معايير التقرير الجيد:**
- عنوان واضح ومحدد
- ملخص تنفيذي في البداية
- بيانات دقيقة ومحدثة
- رسوم بيانية عند الحاجة
- توصيات في النهاية`,

  // مساعد الدعم
  supportAgent: `أنت مساعد دعم فني في نظام Symbol AI ERP.
مهمتك مساعدة المستخدمين في استخدام النظام وحل مشاكلهم.

**مجالات الدعم:**
- شرح ميزات النظام
- حل المشاكل التقنية
- الإجابة على الأسئلة الشائعة
- توجيه المستخدمين للصفحات المناسبة

**أسلوب الدعم:**
- استمع جيداً لمشكلة المستخدم
- اطرح أسئلة توضيحية عند الحاجة
- قدم حلولاً خطوة بخطوة
- تأكد من حل المشكلة قبل الإنهاء`,

  // خبير الأتمتة
  automationExpert: `أنت خبير أتمتة في نظام Symbol AI ERP.
تخصصك أتمتة المهام المتكررة وتحسين سير العمل.

**مجالات الأتمتة:**
- جدولة التقارير الدورية
- إعداد التنبيهات التلقائية
- أتمتة الإشعارات
- تحسين العمليات

**قدراتك:**
- تحليل العمليات الحالية
- اقتراح تحسينات
- إعداد قواعد الأتمتة
- مراقبة الأداء`,
};

/**
 * تكوينات المساعدين المتخصصين
 */
const ASSISTANT_CONFIGS: Record<string, AgentConfig> = {
  dataAnalyst: {
    name: "محلل البيانات",
    description: "خبير في تحليل البيانات المالية والتشغيلية",
    systemPrompt: BASE_PROMPTS.dataAnalyst,
    tools: ["think", "database_query", "analyze_data"],
    category: "analysis",
    icon: "📊",
    color: "#3B82F6",
  },
  reportGenerator: {
    name: "مولد التقارير",
    description: "خبير في إنشاء التقارير الاحترافية",
    systemPrompt: BASE_PROMPTS.reportGenerator,
    tools: ["think", "database_query", "analyze_data", "send_notification"],
    category: "analysis",
    icon: "📋",
    color: "#10B981",
  },
  supportAgent: {
    name: "مساعد الدعم",
    description: "مساعد لحل المشاكل والإجابة على الأسئلة",
    systemPrompt: BASE_PROMPTS.supportAgent,
    tools: ["think"],
    category: "support",
    icon: "🎧",
    color: "#8B5CF6",
  },
  automationExpert: {
    name: "خبير الأتمتة",
    description: "خبير في أتمتة المهام وتحسين سير العمل",
    systemPrompt: BASE_PROMPTS.automationExpert,
    tools: ["think", "database_query", "send_notification"],
    category: "automation",
    icon: "⚙️",
    color: "#F59E0B",
  },
  generalAssistant: {
    name: "المساعد العام",
    description: "مساعد عام للمهام المتنوعة",
    systemPrompt: BASE_PROMPTS.base,
    tools: ["think", "database_query", "analyze_data", "send_notification"],
    category: "general",
    icon: "🤖",
    color: "#6366F1",
  },
};

/**
 * مدير الـ Prompts
 */
export class PromptManager {
  private customPrompts: Map<string, string> = new Map();
  private assistantConfigs: Map<string, AgentConfig> = new Map();

  constructor() {
    // تحميل التكوينات الافتراضية
    Object.entries(ASSISTANT_CONFIGS).forEach(([key, config]) => {
      this.assistantConfigs.set(key, config);
    });
  }

  /**
   * الحصول على System Prompt
   */
  getSystemPrompt(assistantId: string): string {
    const config = this.assistantConfigs.get(assistantId);
    if (config) {
      return config.systemPrompt;
    }
    
    // التحقق من الـ Prompts المخصصة
    const customPrompt = this.customPrompts.get(assistantId);
    if (customPrompt) {
      return customPrompt;
    }
    
    // إرجاع الـ Prompt الأساسي
    return BASE_PROMPTS.base;
  }

  /**
   * الحصول على تكوين مساعد
   */
  getAssistantConfig(assistantId: string): AgentConfig | undefined {
    return this.assistantConfigs.get(assistantId);
  }

  /**
   * الحصول على جميع المساعدين
   */
  getAllAssistants(): Array<{ id: string; config: AgentConfig }> {
    return Array.from(this.assistantConfigs.entries()).map(([id, config]) => ({
      id,
      config,
    }));
  }

  /**
   * إضافة مساعد مخصص
   */
  addCustomAssistant(id: string, config: AgentConfig): void {
    this.assistantConfigs.set(id, config);
  }

  /**
   * تحديث System Prompt لمساعد
   */
  updateSystemPrompt(assistantId: string, prompt: string): void {
    const config = this.assistantConfigs.get(assistantId);
    if (config) {
      config.systemPrompt = prompt;
    } else {
      this.customPrompts.set(assistantId, prompt);
    }
  }

  /**
   * تحميل تكوين من JSON
   */
  loadFromJSON(config: AssistantConfig): AgentConfig {
    return {
      name: config.agent_name,
      description: config.Description,
      systemPrompt: config["System Prompt"],
      supportsRAG: config["RAG (Required)"],
      category: this.inferCategory(config),
      icon: "🤖",
      color: "#6366F1",
    };
  }

  /**
   * استنتاج الفئة من التكوين
   */
  private inferCategory(config: AssistantConfig): AgentCategory {
    const description = config.Description.toLowerCase();
    
    if (description.includes("engineering") || description.includes("technical")) {
      return "engineering";
    }
    if (description.includes("analysis") || description.includes("data")) {
      return "analysis";
    }
    if (description.includes("automation") || description.includes("python")) {
      return "automation";
    }
    if (description.includes("support") || description.includes("help")) {
      return "support";
    }
    if (description.includes("writing") || description.includes("email")) {
      return "writing";
    }
    if (description.includes("research")) {
      return "research";
    }
    
    return "general";
  }

  /**
   * بناء Prompt مع السياق
   */
  buildPromptWithContext(
    assistantId: string,
    context: {
      userName?: string;
      branchName?: string;
      currentDate?: string;
      additionalContext?: string;
    }
  ): string {
    let prompt = this.getSystemPrompt(assistantId);
    
    // إضافة معلومات السياق
    const contextParts: string[] = [];
    
    if (context.userName) {
      contextParts.push(`اسم المستخدم: ${context.userName}`);
    }
    if (context.branchName) {
      contextParts.push(`الفرع: ${context.branchName}`);
    }
    if (context.currentDate) {
      contextParts.push(`التاريخ: ${context.currentDate}`);
    }
    if (context.additionalContext) {
      contextParts.push(context.additionalContext);
    }
    
    if (contextParts.length > 0) {
      prompt += `\n\n**معلومات السياق:**\n${contextParts.join("\n")}`;
    }
    
    return prompt;
  }

  /**
   * الحصول على الأدوات المتاحة لمساعد
   */
  getAssistantTools(assistantId: string): string[] {
    const config = this.assistantConfigs.get(assistantId);
    return config?.tools || ["think"];
  }
}

// إنشاء instance واحد
export const promptManager = new PromptManager();
