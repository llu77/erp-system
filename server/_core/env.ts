/**
 * Environment Variable Configuration
 * Centralized and validated environment variable handling
 *
 * SECURITY: Never log or expose sensitive values!
 */

// Helper function to get required env variable
function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.error(`[ENV] Missing required environment variable: ${key}`);
    // In production, throw error for missing critical vars
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
  return value ?? "";
}

// Helper function to get optional env variable
function getOptionalEnv(key: string, defaultValue: string = ""): string {
  return process.env[key] ?? defaultValue;
}

// Validate that sensitive env vars are not exposed in logs
function maskSensitiveValue(value: string): string {
  if (!value || value.length < 8) return "***";
  return value.substring(0, 4) + "****" + value.substring(value.length - 4);
}

export const ENV = {
  // Application
  appId: getOptionalEnv("VITE_APP_ID"),
  isProduction: process.env.NODE_ENV === "production",
  nodeEnv: getOptionalEnv("NODE_ENV", "development"),

  // Security (Required in production)
  cookieSecret: getRequiredEnv("JWT_SECRET"),

  // Database (Required)
  databaseUrl: getRequiredEnv("DATABASE_URL"),

  // OAuth (Optional)
  oAuthServerUrl: getOptionalEnv("OAUTH_SERVER_URL"),
  ownerOpenId: getOptionalEnv("OWNER_OPEN_ID"),

  // Forge API (Optional)
  forgeApiUrl: getOptionalEnv("BUILT_IN_FORGE_API_URL"),
  forgeApiKey: getOptionalEnv("BUILT_IN_FORGE_API_KEY"),

  // Email Service - Resend (Optional)
  resendApiKey: getOptionalEnv("RESEND_API_KEY"),
  resendFromEmail: getOptionalEnv("RESEND_FROM_EMAIL", "noreply@example.com"),

  // SMS/WhatsApp Service - Twilio (Optional)
  twilioAccountSid: getOptionalEnv("TWILIO_ACCOUNT_SID"),
  twilioAuthToken: getOptionalEnv("TWILIO_AUTH_TOKEN"),
  twilioMessagingServiceSid: getOptionalEnv("TWILIO_MESSAGING_SERVICE_SID"),
  twilioPhoneNumber: getOptionalEnv("TWILIO_PHONE_NUMBER"),

  // Manus Deployment API (Optional)
  manusApiKey: getOptionalEnv("MANUS_API_KEY"),
  manusApiUrl: getOptionalEnv("MANUS_API_URL", "https://api.manus.ai/v1"),
  manusProjectId: getOptionalEnv("MANUS_PROJECT_ID"),
  manusWebhookSecret: getOptionalEnv("MANUS_WEBHOOK_SECRET"),
};

// Validate critical environment variables on module load
export function validateEnv(): { valid: boolean; missing: string[] } {
  const requiredInProduction = [
    "JWT_SECRET",
    "DATABASE_URL",
  ];

  const missing: string[] = [];

  for (const key of requiredInProduction) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0 && ENV.isProduction) {
    console.error("[ENV] Missing required environment variables:", missing.join(", "));
    console.error("[ENV] Please check your .env file or environment configuration");
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

// Log env status (safe - doesn't expose secrets)
export function logEnvStatus(): void {
  console.log("[ENV] Environment Configuration Status:");
  console.log(`  - NODE_ENV: ${ENV.nodeEnv}`);
  console.log(`  - Database: ${ENV.databaseUrl ? "Configured" : "Missing"}`);
  console.log(`  - JWT Secret: ${ENV.cookieSecret ? "Configured" : "Missing"}`);
  console.log(`  - Resend Email: ${ENV.resendApiKey ? "Configured" : "Not configured"}`);
  console.log(`  - Twilio SMS: ${ENV.twilioAccountSid ? "Configured" : "Not configured"}`);
  console.log(`  - Manus API: ${ENV.manusApiKey ? "Configured" : "Not configured"}`);
}

// Export masked values for debugging (safe to log)
export function getMaskedEnvValues(): Record<string, string> {
  return {
    DATABASE_URL: ENV.databaseUrl ? maskSensitiveValue(ENV.databaseUrl) : "Not set",
    JWT_SECRET: ENV.cookieSecret ? maskSensitiveValue(ENV.cookieSecret) : "Not set",
    RESEND_API_KEY: ENV.resendApiKey ? maskSensitiveValue(ENV.resendApiKey) : "Not set",
    TWILIO_ACCOUNT_SID: ENV.twilioAccountSid ? maskSensitiveValue(ENV.twilioAccountSid) : "Not set",
    MANUS_API_KEY: ENV.manusApiKey ? maskSensitiveValue(ENV.manusApiKey) : "Not set",
  };
}
