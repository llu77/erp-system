/**
 * مدير الأدوات - Tool Manager
 * ===========================
 * 
 * يدير جميع الأدوات المتاحة للـ Agents
 */

import type { ToolDefinition, ToolResult } from "../types";
import { BaseTool } from "../tools/baseTool";
import { thinkTool } from "../tools/thinkTool";
import { databaseQueryTool } from "../tools/databaseTool";
import { notificationTool } from "../tools/notificationTool";
import { analysisTool } from "../tools/analysisTool";

/**
 * مدير الأدوات
 */
export class ToolManager {
  private tools: Map<string, BaseTool> = new Map();

  constructor() {
    // تسجيل الأدوات الافتراضية
    this.registerTool(thinkTool);
    this.registerTool(databaseQueryTool);
    this.registerTool(notificationTool);
    this.registerTool(analysisTool);
  }

  /**
   * تسجيل أداة جديدة
   */
  registerTool(tool: BaseTool): void {
    this.tools.set(tool.name, tool);
    console.log(`[ToolManager] تم تسجيل الأداة: ${tool.name}`);
  }

  /**
   * إلغاء تسجيل أداة
   */
  unregisterTool(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * الحصول على أداة بالاسم
   */
  getTool(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  /**
   * الحصول على جميع الأدوات
   */
  getAllTools(): BaseTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * الحصول على أدوات محددة بالأسماء
   */
  getToolsByNames(names: string[]): BaseTool[] {
    return names
      .map(name => this.tools.get(name))
      .filter((tool): tool is BaseTool => tool !== undefined);
  }

  /**
   * الحصول على تعريفات الأدوات للـ API
   */
  getToolDefinitions(toolNames?: string[]): ToolDefinition[] {
    const tools = toolNames 
      ? this.getToolsByNames(toolNames)
      : this.getAllTools();
    
    return tools.map(tool => tool.toDefinition());
  }

  /**
   * تنفيذ أداة
   */
  async executeTool(name: string, input: Record<string, any>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    
    if (!tool) {
      return {
        tool_use_id: "",
        content: `خطأ: الأداة '${name}' غير موجودة`,
        is_error: true,
      };
    }

    try {
      const startTime = Date.now();
      const result = await tool.execute(input);
      const executionTime = Date.now() - startTime;
      
      console.log(`[ToolManager] تم تنفيذ ${name} في ${executionTime}ms`);
      
      return {
        tool_use_id: "",
        content: result,
        is_error: false,
      };
    } catch (error: any) {
      console.error(`[ToolManager] خطأ في تنفيذ ${name}:`, error);
      
      return {
        tool_use_id: "",
        content: `خطأ في تنفيذ الأداة: ${error.message}`,
        is_error: true,
      };
    }
  }

  /**
   * التحقق من وجود أداة
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * الحصول على عدد الأدوات
   */
  getToolCount(): number {
    return this.tools.size;
  }

  /**
   * الحصول على أسماء جميع الأدوات
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * الحصول على وصف مختصر لجميع الأدوات
   */
  getToolsSummary(): Array<{ name: string; description: string }> {
    return this.getAllTools().map(tool => ({
      name: tool.name,
      description: tool.description.substring(0, 100) + "...",
    }));
  }
}

// إنشاء instance واحد
export const toolManager = new ToolManager();
