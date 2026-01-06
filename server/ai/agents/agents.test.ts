/**
 * اختبارات نظام AI Agents
 * ========================
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { toolManager } from "./core/toolManager";
import { promptManager } from "./core/promptManager";
import { agentService } from "./core/agentService";
import { thinkTool } from "./tools/thinkTool";

describe("Tool Manager", () => {
  it("يجب أن يحتوي على الأدوات الافتراضية", () => {
    const tools = toolManager.getAllTools();
    expect(tools.length).toBeGreaterThan(0);
    
    const toolNames = toolManager.getToolNames();
    expect(toolNames).toContain("think");
    expect(toolNames).toContain("database_query");
    expect(toolNames).toContain("send_notification");
    expect(toolNames).toContain("analyze_data");
  });

  it("يجب أن يعيد تعريفات الأدوات بشكل صحيح", () => {
    const definitions = toolManager.getToolDefinitions();
    expect(definitions.length).toBeGreaterThan(0);
    
    definitions.forEach(def => {
      expect(def).toHaveProperty("name");
      expect(def).toHaveProperty("description");
      expect(def).toHaveProperty("input_schema");
    });
  });

  it("يجب أن يتحقق من وجود أداة", () => {
    expect(toolManager.hasTool("think")).toBe(true);
    expect(toolManager.hasTool("nonexistent_tool")).toBe(false);
  });

  it("يجب أن يعيد ملخص الأدوات", () => {
    const summary = toolManager.getToolsSummary();
    expect(summary.length).toBeGreaterThan(0);
    
    summary.forEach(item => {
      expect(item).toHaveProperty("name");
      expect(item).toHaveProperty("description");
    });
  });
});

describe("Think Tool", () => {
  it("يجب أن ينفذ التفكير بنجاح", async () => {
    const result = await thinkTool.execute({
      thought: "هذا اختبار للتفكير",
    });
    
    expect(result).toContain("تم تسجيل الفكرة بنجاح");
  });

  it("يجب أن يعيد تعريف الأداة بشكل صحيح", () => {
    const definition = thinkTool.toDefinition();
    
    expect(definition.name).toBe("think");
    expect(definition).toHaveProperty("description");
    expect(definition.input_schema).toHaveProperty("properties");
    expect(definition.input_schema.properties).toHaveProperty("thought");
  });
});

describe("Prompt Manager", () => {
  it("يجب أن يحتوي على المساعدين الافتراضيين", () => {
    const assistants = promptManager.getAllAssistants();
    expect(assistants.length).toBeGreaterThan(0);
    
    const ids = assistants.map(a => a.id);
    expect(ids).toContain("dataAnalyst");
    expect(ids).toContain("reportGenerator");
    expect(ids).toContain("supportAgent");
    expect(ids).toContain("generalAssistant");
  });

  it("يجب أن يعيد تكوين المساعد بشكل صحيح", () => {
    const config = promptManager.getAssistantConfig("dataAnalyst");
    
    expect(config).toBeDefined();
    expect(config?.name).toBe("محلل البيانات");
    expect(config?.category).toBe("analysis");
    expect(config?.tools).toContain("think");
    expect(config?.tools).toContain("database_query");
  });

  it("يجب أن يعيد System Prompt للمساعد", () => {
    const prompt = promptManager.getSystemPrompt("dataAnalyst");
    
    expect(prompt).toBeDefined();
    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt).toContain("محلل بيانات");
  });

  it("يجب أن يبني Prompt مع السياق", () => {
    const prompt = promptManager.buildPromptWithContext("generalAssistant", {
      userName: "أحمد",
      branchName: "الفرع الرئيسي",
      currentDate: "2024-01-01",
    });
    
    expect(prompt).toContain("أحمد");
    expect(prompt).toContain("الفرع الرئيسي");
    expect(prompt).toContain("2024-01-01");
  });

  it("يجب أن يعيد الأدوات المتاحة للمساعد", () => {
    const tools = promptManager.getAssistantTools("dataAnalyst");
    
    expect(tools).toContain("think");
    expect(tools).toContain("database_query");
    expect(tools).toContain("analyze_data");
  });
});

describe("Agent Service", () => {
  it("يجب أن ينشئ جلسة جديدة", () => {
    const sessionId = agentService.createSession("generalAssistant", 1);
    
    expect(sessionId).toBeDefined();
    expect(sessionId).toContain("generalAssistant");
    expect(sessionId).toContain("1");
  });

  it("يجب أن يحصل على الجلسة بعد إنشائها", () => {
    const sessionId = agentService.createSession("dataAnalyst", 2);
    const session = agentService.getSession(sessionId);
    
    expect(session).toBeDefined();
    expect(session?.sessionId).toBe(sessionId);
    expect(session?.messages).toEqual([]);
  });

  it("يجب أن ينهي الجلسة بنجاح", () => {
    const sessionId = agentService.createSession("supportAgent", 3);
    const ended = agentService.endSession(sessionId);
    
    expect(ended).toBe(true);
    expect(agentService.getSession(sessionId)).toBeUndefined();
  });

  it("يجب أن يعيد قائمة المساعدين المتاحين", () => {
    const assistants = agentService.getAvailableAssistants();
    
    expect(assistants.length).toBeGreaterThan(0);
    
    assistants.forEach(assistant => {
      expect(assistant).toHaveProperty("id");
      expect(assistant).toHaveProperty("name");
      expect(assistant).toHaveProperty("description");
      expect(assistant).toHaveProperty("icon");
      expect(assistant).toHaveProperty("color");
      expect(assistant).toHaveProperty("category");
    });
  });

  it("يجب أن يحصل على سجل المحادثة", () => {
    const sessionId = agentService.createSession("generalAssistant", 4);
    const history = agentService.getConversationHistory(sessionId);
    
    expect(history).toEqual([]);
  });

  it("يجب أن يمسح سجل المحادثة", () => {
    const sessionId = agentService.createSession("generalAssistant", 5);
    agentService.clearConversationHistory(sessionId);
    const history = agentService.getConversationHistory(sessionId);
    
    expect(history).toEqual([]);
  });

  it("يجب أن يحصل على إحصائيات الجلسة", () => {
    const sessionId = agentService.createSession("generalAssistant", 6);
    const stats = agentService.getSessionStats(sessionId);
    
    expect(stats).toBeDefined();
    expect(stats?.messageCount).toBe(0);
    expect(stats?.tokensUsed).toBe(0);
    expect(stats?.toolsUsed).toEqual([]);
  });
});
