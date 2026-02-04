/**
 * Manus Deployment Service
 * خدمة النشر عبر Manus API
 *
 * Docs: https://open.manus.im/docs/webhooks
 * Security: RSA-SHA256 signature verification
 */

import { ENV } from "../_core/env";
import * as crypto from "crypto";

// ============================================
// Types - API Responses
// ============================================

interface ManusTaskResponse {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: unknown;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

interface ManusDeployConfig {
  projectName?: string;
  buildCommand?: string;
  startCommand?: string;
  envVars?: string[];
  webhookUrl?: string;
}

interface ManusApiError {
  code: string;
  message: string;
  details?: unknown;
}

// ============================================
// Types - Webhook Events
// ============================================

type ManusWebhookEventType = "task_created" | "task_progress" | "task_stopped";

interface ManusWebhookPayload {
  event_id: string;
  event_type: ManusWebhookEventType;
  task_id: string;
  task_title?: string;
  task_url?: string;
}

interface ManusTaskCreatedPayload extends ManusWebhookPayload {
  event_type: "task_created";
}

interface ManusTaskProgressPayload extends ManusWebhookPayload {
  event_type: "task_progress";
  progress_detail: {
    task_id: string;
    progress_type: "plan_update" | "step_complete" | "status_change";
    message: string;
    progress_percentage?: number;
  };
}

interface ManusTaskStoppedPayload extends ManusWebhookPayload {
  event_type: "task_stopped";
  stop_reason: "finish" | "ask" | "error";
  message: string;
  output?: unknown;
}

type ManusWebhookEvent =
  | ManusTaskCreatedPayload
  | ManusTaskProgressPayload
  | ManusTaskStoppedPayload;

// Webhook verification headers
interface ManusWebhookHeaders {
  "x-webhook-signature": string;
  "x-webhook-timestamp": string;
}

// ============================================
// Constants
// ============================================

const WEBHOOK_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

// Check if Manus is configured
export function isManusConfigured(): boolean {
  return Boolean(ENV.manusApiKey);
}

// Get headers for Manus API requests
function getManusHeaders(): HeadersInit {
  if (!ENV.manusApiKey) {
    throw new Error("[Manus] API key not configured. Set MANUS_API_KEY in .env");
  }

  return {
    Authorization: `Bearer ${ENV.manusApiKey}`,
    "Content-Type": "application/json",
  };
}

/**
 * Create a deployment task on Manus
 */
export async function createDeployTask(
  config: ManusDeployConfig = {}
): Promise<ManusTaskResponse> {
  if (!isManusConfigured()) {
    throw new Error("[Manus] API not configured");
  }

  const payload = {
    type: "deploy",
    project: config.projectName || ENV.manusProjectId || "erp-system",
    config: {
      build_command: config.buildCommand || "pnpm build",
      start_command: config.startCommand || "pnpm start",
      env_vars: config.envVars || [
        "DATABASE_URL",
        "JWT_SECRET",
        "NODE_ENV",
        "RESEND_API_KEY",
        "TWILIO_ACCOUNT_SID",
        "TWILIO_AUTH_TOKEN",
      ],
    },
    webhook_url: config.webhookUrl,
  };

  try {
    const response = await fetch(`${ENV.manusApiUrl}/tasks`, {
      method: "POST",
      headers: getManusHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = (await response.json()) as ManusApiError;
      console.error("[Manus] Deploy task failed:", error);
      throw new Error(error.message || "Failed to create deploy task");
    }

    const data = (await response.json()) as ManusTaskResponse;
    console.log(`[Manus] Deploy task created: ${data.id}`);
    return data;
  } catch (error) {
    console.error("[Manus] Error creating deploy task:", error);
    throw error;
  }
}

/**
 * Get task status from Manus
 */
export async function getTaskStatus(taskId: string): Promise<ManusTaskResponse> {
  if (!isManusConfigured()) {
    throw new Error("[Manus] API not configured");
  }

  try {
    const response = await fetch(`${ENV.manusApiUrl}/tasks/${taskId}`, {
      method: "GET",
      headers: getManusHeaders(),
    });

    if (!response.ok) {
      const error = (await response.json()) as ManusApiError;
      throw new Error(error.message || "Failed to get task status");
    }

    return (await response.json()) as ManusTaskResponse;
  } catch (error) {
    console.error("[Manus] Error getting task status:", error);
    throw error;
  }
}

/**
 * Cancel a running task
 */
export async function cancelTask(taskId: string): Promise<boolean> {
  if (!isManusConfigured()) {
    throw new Error("[Manus] API not configured");
  }

  try {
    const response = await fetch(`${ENV.manusApiUrl}/tasks/${taskId}/cancel`, {
      method: "POST",
      headers: getManusHeaders(),
    });

    if (!response.ok) {
      const error = (await response.json()) as ManusApiError;
      console.error("[Manus] Cancel task failed:", error);
      return false;
    }

    console.log(`[Manus] Task ${taskId} cancelled`);
    return true;
  } catch (error) {
    console.error("[Manus] Error cancelling task:", error);
    return false;
  }
}

/**
 * Verify webhook signature from Manus (RSA-SHA256)
 *
 * Manus uses RSA-SHA256 with 2048-bit keys
 * Signed content format: {timestamp}.{url}.{sha256(body)}
 *
 * @param payload - Raw request body
 * @param signature - X-Webhook-Signature header value
 * @param timestamp - X-Webhook-Timestamp header value
 * @param url - Request URL
 * @param publicKey - Manus public key (optional, uses cached if not provided)
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  timestamp?: string,
  url?: string,
  publicKey?: string
): boolean {
  if (!ENV.manusWebhookSecret && !publicKey) {
    console.warn("[Manus] Webhook secret/public key not configured");
    return false;
  }

  try {
    // Validate timestamp to prevent replay attacks (5 minute window)
    if (timestamp) {
      const timestampMs = parseInt(timestamp, 10) * 1000;
      const now = Date.now();
      if (Math.abs(now - timestampMs) > WEBHOOK_TIMESTAMP_TOLERANCE_MS) {
        console.error("[Manus] Webhook timestamp outside tolerance window");
        return false;
      }
    }

    // Calculate body hash
    const bodyHash = crypto
      .createHash("sha256")
      .update(payload)
      .digest("hex");

    // Build signed content: {timestamp}.{url}.{body_hash}
    const signedContent = timestamp && url
      ? `${timestamp}.${url}.${bodyHash}`
      : payload;

    // For RSA-SHA256 verification (if public key provided)
    if (publicKey) {
      const contentHash = crypto
        .createHash("sha256")
        .update(signedContent)
        .digest();

      const signatureBuffer = Buffer.from(signature.replace("sha256=", ""), "base64");

      const isValid = crypto.verify(
        "sha256",
        contentHash,
        {
          key: publicKey,
          padding: crypto.constants.RSA_PKCS1_PADDING,
        },
        signatureBuffer
      );

      return isValid;
    }

    // Fallback to HMAC-SHA256 verification
    const expectedSignature = crypto
      .createHmac("sha256", ENV.manusWebhookSecret)
      .update(signedContent)
      .digest("hex");

    return signature === `sha256=${expectedSignature}` || signature === expectedSignature;
  } catch (error) {
    console.error("[Manus] Webhook signature verification error:", error);
    return false;
  }
}

/**
 * Parse and validate webhook headers
 */
export function parseWebhookHeaders(headers: Record<string, string>): ManusWebhookHeaders | null {
  const signature = headers["x-webhook-signature"] || headers["X-Webhook-Signature"];
  const timestamp = headers["x-webhook-timestamp"] || headers["X-Webhook-Timestamp"];

  if (!signature) {
    console.error("[Manus] Missing X-Webhook-Signature header");
    return null;
  }

  return {
    "x-webhook-signature": signature,
    "x-webhook-timestamp": timestamp || "",
  };
}

/**
 * Handle webhook event from Manus
 *
 * Event Types:
 * - task_created: Task was created
 * - task_progress: Task is making progress (multiple events)
 * - task_stopped: Task finished or needs input
 */
export function handleWebhookEvent(
  payload: ManusWebhookEvent
): { success: boolean; message: string; requiresInput?: boolean; output?: unknown } {
  console.log(`[Manus] Webhook event received: ${payload.event_type} (${payload.event_id})`);

  switch (payload.event_type) {
    case "task_created": {
      const event = payload as ManusTaskCreatedPayload;
      console.log(`[Manus] Task created: ${event.task_id}`);
      console.log(`  - Title: ${event.task_title || "N/A"}`);
      console.log(`  - URL: ${event.task_url || "N/A"}`);
      return {
        success: true,
        message: `Task ${event.task_id} created`
      };
    }

    case "task_progress": {
      const event = payload as ManusTaskProgressPayload;
      const detail = event.progress_detail;
      console.log(`[Manus] Task progress: ${detail.progress_type}`);
      console.log(`  - Message: ${detail.message}`);
      if (detail.progress_percentage !== undefined) {
        console.log(`  - Progress: ${detail.progress_percentage}%`);
      }
      return {
        success: true,
        message: detail.message
      };
    }

    case "task_stopped": {
      const event = payload as ManusTaskStoppedPayload;
      console.log(`[Manus] Task stopped: ${event.stop_reason}`);
      console.log(`  - Message: ${event.message}`);

      if (event.stop_reason === "finish") {
        console.log("[Manus] ✅ Task completed successfully");
        return {
          success: true,
          message: event.message,
          output: event.output
        };
      }

      if (event.stop_reason === "ask") {
        console.log("[Manus] ⏳ Task requires user input");
        return {
          success: true,
          message: event.message,
          requiresInput: true
        };
      }

      if (event.stop_reason === "error") {
        console.error("[Manus] ❌ Task failed:", event.message);
        return {
          success: false,
          message: event.message
        };
      }

      return {
        success: true,
        message: event.message
      };
    }

    default:
      console.log(`[Manus] Unknown event type: ${(payload as ManusWebhookPayload).event_type}`);
      return {
        success: true,
        message: `Unknown event received`
      };
  }
}

/**
 * Express middleware for handling Manus webhooks
 */
export function createWebhookHandler(
  onEvent?: (event: ManusWebhookEvent, result: ReturnType<typeof handleWebhookEvent>) => void
) {
  return async (req: { body: unknown; headers: Record<string, string>; url?: string }, res: { status: (code: number) => { json: (data: unknown) => void } }) => {
    try {
      // Parse headers
      const headers = parseWebhookHeaders(req.headers);
      if (!headers) {
        return res.status(401).json({ error: "Missing webhook signature" });
      }

      // Get raw body
      const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);

      // Verify signature
      const isValid = verifyWebhookSignature(
        rawBody,
        headers["x-webhook-signature"],
        headers["x-webhook-timestamp"],
        req.url
      );

      if (!isValid) {
        console.error("[Manus] Invalid webhook signature");
        return res.status(401).json({ error: "Invalid signature" });
      }

      // Parse and handle event
      const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const result = handleWebhookEvent(payload as ManusWebhookEvent);

      // Callback for custom handling
      if (onEvent) {
        onEvent(payload as ManusWebhookEvent, result);
      }

      return res.status(200).json({ received: true, ...result });
    } catch (error) {
      console.error("[Manus] Webhook handler error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  };
}

/**
 * Get deployment status summary
 */
export function getManusStatus(): {
  configured: boolean;
  apiUrl: string;
  projectId: string | null;
  webhookConfigured: boolean;
} {
  return {
    configured: isManusConfigured(),
    apiUrl: ENV.manusApiUrl,
    projectId: ENV.manusProjectId || null,
    webhookConfigured: Boolean(ENV.manusWebhookSecret),
  };
}

// ============================================
// Exports
// ============================================

export default {
  // Configuration
  isManusConfigured,
  getManusStatus,

  // Task Operations
  createDeployTask,
  getTaskStatus,
  cancelTask,

  // Webhook Handling
  verifyWebhookSignature,
  parseWebhookHeaders,
  handleWebhookEvent,
  createWebhookHandler,
};

// Type exports for consumers
export type {
  ManusTaskResponse,
  ManusDeployConfig,
  ManusWebhookEvent,
  ManusWebhookEventType,
  ManusTaskCreatedPayload,
  ManusTaskProgressPayload,
  ManusTaskStoppedPayload,
};
