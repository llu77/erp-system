/**
 * خدمة Agent الأساسية - Agent Service
 * ====================================
 * 
 * المحرك الرئيسي لتشغيل الـ Agents
 */

import { invokeLLM } from "../../../_core/llm";
import type { 
  Message, 
  AgentConfig, 
  AgentResponse, 
  AgentState,
  ToolCall,
  ToolResult,
  AgentError,
  AgentEventHandler
} from "../types";
import { toolManager } from "./toolManager";
import { promptManager } from "./promptManager";

/**
 * خدمة Agent
 */
export class AgentService {
  private sessions: Map<string, AgentState> = new Map();
  private maxIterations = 10; // الحد الأقصى لعدد التكرارات
  private maxTokens = 4096;

  /**
   * إنشاء جلسة جديدة
   */
  createSession(assistantId: string, userId: number): string {
    const sessionId = `${assistantId}-${userId}-${Date.now()}`;
    
    const state: AgentState = {
      sessionId,
      messages: [],
      toolsUsed: [],
      tokensUsed: 0,
      startedAt: new Date(),
      lastActivityAt: new Date(),
    };
    
    this.sessions.set(sessionId, state);
    console.log(`[AgentService] تم إنشاء جلسة: ${sessionId}`);
    
    return sessionId;
  }

  /**
   * الحصول على جلسة
   */
  getSession(sessionId: string): AgentState | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * إنهاء جلسة
   */
  endSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * إرسال رسالة للـ Agent
   */
  async chat(
    sessionId: string,
    assistantId: string,
    userMessage: string,
    context?: {
      userName?: string;
      branchName?: string;
      branchId?: number;
    }
  ): Promise<AgentResponse> {
    const startTime = Date.now();
    
    // الحصول على الجلسة أو إنشاء واحدة جديدة
    let state = this.sessions.get(sessionId);
    if (!state) {
      this.createSession(assistantId, 0);
      state = this.sessions.get(sessionId)!;
    }

    // الحصول على تكوين المساعد
    const config = promptManager.getAssistantConfig(assistantId);
    const systemPrompt = promptManager.buildPromptWithContext(assistantId, {
      userName: context?.userName,
      branchName: context?.branchName,
      currentDate: new Date().toLocaleDateString("ar-SA"),
    });

    // إضافة رسالة المستخدم
    state.messages.push({
      role: "user",
      content: userMessage,
    });

    // الحصول على الأدوات المتاحة
    const availableTools = promptManager.getAssistantTools(assistantId);
    const toolDefinitions = toolManager.getToolDefinitions(availableTools);

    try {
      // تشغيل حلقة Agent
      const response = await this.runAgentLoop(
        systemPrompt,
        state.messages,
        toolDefinitions,
        availableTools
      );

      // تحديث الجلسة
      state.messages.push({
        role: "assistant",
        content: response.text,
      });
      state.lastActivityAt = new Date();
      state.tokensUsed += response.tokensUsed.input + response.tokensUsed.output;

      return {
        ...response,
        responseTimeMs: Date.now() - startTime,
      };
    } catch (error: any) {
      console.error(`[AgentService] خطأ في المحادثة:`, error);
      
      return {
        text: `عذراً، حدث خطأ: ${error.message}`,
        isComplete: true,
        tokensUsed: { input: 0, output: 0 },
        responseTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * تشغيل حلقة Agent
   */
  private async runAgentLoop(
    systemPrompt: string,
    messages: Message[],
    toolDefinitions: any[],
    availableTools: string[]
  ): Promise<AgentResponse> {
    let iteration = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const toolCalls: ToolCall[] = [];
    const toolResults: ToolResult[] = [];

    // بناء الرسائل للـ API
    const apiMessages: any[] = [
      { role: "system", content: systemPrompt },
      ...messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    ];

    while (iteration < this.maxIterations) {
      iteration++;
      console.log(`[AgentService] التكرار ${iteration}`);

      // استدعاء LLM
      const response = await invokeLLM({
        messages: apiMessages,
        tools: toolDefinitions.length > 0 ? toolDefinitions : undefined,
        max_tokens: this.maxTokens,
      });

      // تحديث عداد الـ Tokens
      totalInputTokens += response.usage?.prompt_tokens || 0;
      totalOutputTokens += response.usage?.completion_tokens || 0;

      const choice = response.choices?.[0];
      if (!choice) {
        return {
          text: "لم يتم الحصول على استجابة",
          isComplete: true,
          tokensUsed: { input: totalInputTokens, output: totalOutputTokens },
          responseTimeMs: 0,
        };
      }

      const message = choice.message;
      const stopReason = choice.finish_reason;

      // التحقق من استدعاءات الأدوات
      if (message.tool_calls && message.tool_calls.length > 0) {
        // تنفيذ الأدوات
        for (const toolCall of message.tool_calls) {
          const toolName = toolCall.function?.name;
          const toolInput = JSON.parse(toolCall.function?.arguments || "{}");
          
          console.log(`[AgentService] تنفيذ الأداة: ${toolName}`);
          
          // تسجيل استدعاء الأداة
          toolCalls.push({
            id: toolCall.id,
            name: toolName,
            input: toolInput,
          });

          // تنفيذ الأداة
          const result = await toolManager.executeTool(toolName, toolInput);
          result.tool_use_id = toolCall.id;
          toolResults.push(result);

          // إضافة نتيجة الأداة للرسائل
          apiMessages.push({
            role: "assistant",
            content: null,
            tool_calls: [toolCall],
          });
          apiMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result.content,
          });
        }

        // الاستمرار في الحلقة للحصول على الرد النهائي
        continue;
      }

      // إذا انتهى بدون استدعاء أدوات، إرجاع النص
      return {
        text: typeof message.content === 'string' ? message.content : JSON.stringify(message.content) || "",
        toolCalls,
        toolResults,
        isComplete: true,
        tokensUsed: { input: totalInputTokens, output: totalOutputTokens },
        responseTimeMs: 0,
      };
    }

    // إذا وصلنا للحد الأقصى من التكرارات
    return {
      text: "تم الوصول للحد الأقصى من التكرارات. يرجى إعادة صياغة السؤال.",
      toolCalls,
      toolResults,
      isComplete: false,
      tokensUsed: { input: totalInputTokens, output: totalOutputTokens },
      responseTimeMs: 0,
    };
  }

  /**
   * الحصول على سجل المحادثة
   */
  getConversationHistory(sessionId: string): Message[] {
    const state = this.sessions.get(sessionId);
    return state?.messages || [];
  }

  /**
   * مسح سجل المحادثة
   */
  clearConversationHistory(sessionId: string): void {
    const state = this.sessions.get(sessionId);
    if (state) {
      state.messages = [];
    }
  }

  /**
   * الحصول على إحصائيات الجلسة
   */
  getSessionStats(sessionId: string): {
    messageCount: number;
    tokensUsed: number;
    duration: number;
    toolsUsed: string[];
  } | null {
    const state = this.sessions.get(sessionId);
    if (!state) return null;

    return {
      messageCount: state.messages.length,
      tokensUsed: state.tokensUsed,
      duration: Date.now() - state.startedAt.getTime(),
      toolsUsed: state.toolsUsed,
    };
  }

  /**
   * الحصول على قائمة المساعدين المتاحين
   */
  getAvailableAssistants(): Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    category: string;
  }> {
    return promptManager.getAllAssistants().map(({ id, config }) => ({
      id,
      name: config.name,
      description: config.description,
      icon: config.icon || "🤖",
      color: config.color || "#6366F1",
      category: config.category || "general",
    }));
  }
}

// إنشاء instance واحد
export const agentService = new AgentService();
