import { describe, it, expect } from "vitest";

describe("Resend API validation", () => {
  it("should have valid RESEND_API_KEY configured", async () => {
    const apiKey = process.env.RESEND_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey).not.toBe("");
    expect(apiKey?.startsWith("re_")).toBe(true);
  });

  it("should have valid RESEND_FROM_EMAIL configured", async () => {
    const fromEmail = process.env.RESEND_FROM_EMAIL;
    expect(fromEmail).toBeDefined();
    expect(fromEmail).not.toBe("");
    expect(fromEmail).toContain("@");
  });

  it("should be able to connect to Resend API", async () => {
    const apiKey = process.env.RESEND_API_KEY;
    
    // Test API key by fetching domains (lightweight endpoint)
    const response = await fetch("https://api.resend.com/domains", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    // 200 = success, 401 = invalid key
    expect(response.status).toBe(200);
  });
});
