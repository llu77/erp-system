/**
 * Manus Deployment Service
 * خدمة النشر عبر Manus API
 *
 * Docs: https://manus.im/docs/integrations/manus-api
 */

import { ENV } from "../_core/env";

// Types
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
 * Verify webhook signature from Manus
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  if (!ENV.manusWebhookSecret) {
    console.warn("[Manus] Webhook secret not configured");
    return false;
  }

  // Simple HMAC verification (Manus uses SHA-256)
  const crypto = require("crypto");
  const expectedSignature = crypto
    .createHmac("sha256", ENV.manusWebhookSecret)
    .update(payload)
    .digest("hex");

  return signature === `sha256=${expectedSignature}`;
}

/**
 * Handle webhook event from Manus
 */
export function handleWebhookEvent(
  event: string,
  data: unknown
): { success: boolean; message: string } {
  console.log(`[Manus] Webhook event received: ${event}`);

  switch (event) {
    case "task.completed":
      console.log("[Manus] Deployment completed successfully");
      return { success: true, message: "Deployment completed" };

    case "task.failed":
      console.error("[Manus] Deployment failed:", data);
      return { success: false, message: "Deployment failed" };

    case "task.started":
      console.log("[Manus] Deployment started");
      return { success: true, message: "Deployment started" };

    default:
      console.log(`[Manus] Unknown event: ${event}`);
      return { success: true, message: `Event ${event} received` };
  }
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

export default {
  isManusConfigured,
  createDeployTask,
  getTaskStatus,
  cancelTask,
  verifyWebhookSignature,
  handleWebhookEvent,
  getManusStatus,
};
