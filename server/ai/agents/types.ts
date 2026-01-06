/**
 * أنواع البيانات لنظام AI Agents
 * ================================
 * 
 * يحتوي على جميع الأنواع والواجهات المستخدمة في نظام الـ Agents
 */

// ==================== أنواع الرسائل ====================

export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContent {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
}

export interface FileContent {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4";
  };
}

export interface ToolCallContent {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface ToolResultContent {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export type MessageContent = string | (TextContent | ImageContent | FileContent | ToolCallContent | ToolResultContent)[];

export interface Message {
  role: MessageRole;
  content: MessageContent;
}

// ==================== أنواع الأدوات ====================

export interface ToolParameter {
  type: "string" | "number" | "boolean" | "object" | "array";
  description: string;
  enum?: string[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
  required?: string[];
}

export interface ToolInputSchema {
  type: "object";
  properties: Record<string, ToolParameter>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: ToolInputSchema;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface ToolResult {
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

// ==================== أنواع الـ Agent ====================

export interface AgentConfig {
  /** اسم الـ Agent */
  name: string;
  /** وصف الـ Agent */
  description: string;
  /** System Prompt */
  systemPrompt: string;
  /** النموذج المستخدم */
  model?: string;
  /** الحد الأقصى للـ Tokens */
  maxTokens?: number;
  /** درجة الحرارة */
  temperature?: number;
  /** حجم نافذة السياق */
  contextWindowTokens?: number;
  /** الأدوات المتاحة */
  tools?: string[];
  /** هل يدعم الذاكرة */
  supportsMemory?: boolean;
  /** هل يدعم RAG */
  supportsRAG?: boolean;
  /** الفئة */
  category?: AgentCategory;
  /** الأيقونة */
  icon?: string;
  /** اللون */
  color?: string;
}

export type AgentCategory = 
  | "engineering"
  | "analysis"
  | "automation"
  | "support"
  | "writing"
  | "research"
  | "general";

export interface AgentState {
  /** معرف الجلسة */
  sessionId: string;
  /** سجل الرسائل */
  messages: Message[];
  /** الأدوات المستخدمة */
  toolsUsed: string[];
  /** عدد الـ Tokens المستخدمة */
  tokensUsed: number;
  /** وقت البدء */
  startedAt: Date;
  /** آخر نشاط */
  lastActivityAt: Date;
}

// ==================== أنواع الاستجابة ====================

export interface AgentResponse {
  /** نص الاستجابة */
  text: string;
  /** استدعاءات الأدوات */
  toolCalls?: ToolCall[];
  /** نتائج الأدوات */
  toolResults?: ToolResult[];
  /** هل انتهى */
  isComplete: boolean;
  /** عدد الـ Tokens المستخدمة */
  tokensUsed: {
    input: number;
    output: number;
  };
  /** وقت الاستجابة بالمللي ثانية */
  responseTimeMs: number;
}

export interface StreamChunk {
  type: "text" | "tool_use" | "tool_result" | "done";
  content?: string;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
}

// ==================== أنواع المحادثة ====================

export interface Conversation {
  id: string;
  agentId: string;
  userId: number;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface ConversationSummary {
  id: string;
  agentId: string;
  title: string;
  lastMessage: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== أنواع التكوين ====================

export interface AssistantConfig {
  agent_name: string;
  Description: string;
  "One Line Summary"?: string | null;
  "Creation Date": string;
  "ChatGPT Access URL"?: string | null;
  "Utility Estimate": number;
  "Test Entry": boolean;
  "System Prompt": string;
  "Is Agent": boolean;
  "RAG (Required)": boolean;
  "Vision (Req)": boolean;
  "File Input (Req)": boolean;
  "Conversational": boolean;
  "Instructional": boolean;
  "Autonomous": boolean;
  "MCPs Used"?: string | null;
  "Deep Research": boolean;
  Personalised: string;
}

// ==================== أنواع الأحداث ====================

export interface AgentEvent {
  type: "message" | "tool_call" | "tool_result" | "error" | "complete";
  timestamp: Date;
  data: any;
}

export interface AgentEventHandler {
  onMessage?: (message: Message) => void;
  onToolCall?: (toolCall: ToolCall) => void;
  onToolResult?: (result: ToolResult) => void;
  onError?: (error: Error) => void;
  onComplete?: (response: AgentResponse) => void;
}

// ==================== أنواع الأخطاء ====================

export class AgentError extends Error {
  constructor(
    message: string,
    public code: AgentErrorCode,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = "AgentError";
  }
}

export type AgentErrorCode =
  | "INVALID_INPUT"
  | "TOOL_EXECUTION_FAILED"
  | "CONTEXT_OVERFLOW"
  | "RATE_LIMIT_EXCEEDED"
  | "API_ERROR"
  | "TIMEOUT"
  | "UNKNOWN";
