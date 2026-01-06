/**
 * الأداة الأساسية - Base Tool
 * ===========================
 * 
 * الفئة الأساسية لجميع أدوات الـ Agent
 */

import type { ToolDefinition, ToolInputSchema } from "../types";

export abstract class BaseTool {
  /** اسم الأداة */
  readonly name: string;
  /** وصف الأداة */
  readonly description: string;
  /** مخطط المدخلات */
  readonly inputSchema: ToolInputSchema;

  constructor(
    name: string,
    description: string,
    inputSchema: ToolInputSchema
  ) {
    this.name = name;
    this.description = description;
    this.inputSchema = inputSchema;
  }

  /**
   * تحويل الأداة إلى تعريف API
   */
  toDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      input_schema: this.inputSchema,
    };
  }

  /**
   * تنفيذ الأداة
   * @param input المدخلات
   * @returns نتيجة التنفيذ
   */
  abstract execute(input: Record<string, any>): Promise<string>;

  /**
   * التحقق من صحة المدخلات
   */
  validateInput(input: Record<string, any>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const required = this.inputSchema.required || [];

    // التحقق من الحقول المطلوبة
    for (const field of required) {
      if (!(field in input) || input[field] === undefined || input[field] === null) {
        errors.push(`الحقل المطلوب '${field}' غير موجود`);
      }
    }

    // التحقق من أنواع البيانات
    for (const [key, value] of Object.entries(input)) {
      const schema = this.inputSchema.properties[key];
      if (schema) {
        const typeError = this.validateType(value, schema.type, key);
        if (typeError) {
          errors.push(typeError);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private validateType(value: any, expectedType: string, fieldName: string): string | null {
    const actualType = Array.isArray(value) ? "array" : typeof value;
    
    if (expectedType === "array" && !Array.isArray(value)) {
      return `الحقل '${fieldName}' يجب أن يكون مصفوفة`;
    }
    
    if (expectedType !== "array" && actualType !== expectedType) {
      return `الحقل '${fieldName}' يجب أن يكون من نوع ${expectedType}، ولكنه ${actualType}`;
    }
    
    return null;
  }
}

/**
 * أداة بسيطة تنفذ دالة
 */
export class SimpleTool extends BaseTool {
  private handler: (input: Record<string, any>) => Promise<string>;

  constructor(
    name: string,
    description: string,
    inputSchema: ToolInputSchema,
    handler: (input: Record<string, any>) => Promise<string>
  ) {
    super(name, description, inputSchema);
    this.handler = handler;
  }

  async execute(input: Record<string, any>): Promise<string> {
    const validation = this.validateInput(input);
    if (!validation.valid) {
      throw new Error(`خطأ في المدخلات: ${validation.errors.join(", ")}`);
    }
    return this.handler(input);
  }
}
