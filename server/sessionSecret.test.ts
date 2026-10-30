import { describe, expect, it } from "vitest";
import { MainSessionSecretMissingError, getMainSessionSecret, requireMainSessionSecret } from "./_core/sessionSecret";

const text = (bytes: Uint8Array | null) => (bytes ? new TextDecoder().decode(bytes) : null);

describe("main session secret", () => {
  it("uses JWT_SECRET when set", () => {
    expect(text(getMainSessionSecret({ JWT_SECRET: " s3cret ", NODE_ENV: "production" } as NodeJS.ProcessEnv))).toBe("s3cret");
  });

  it("has no fallback in production: sessions are refused instead of signed with a known string", () => {
    const env = { NODE_ENV: "production" } as NodeJS.ProcessEnv;
    expect(getMainSessionSecret(env)).toBeNull();
    expect(() => requireMainSessionSecret(env)).toThrow(MainSessionSecretMissingError);
    expect(getMainSessionSecret({ NODE_ENV: "production", JWT_SECRET: "   " } as NodeJS.ProcessEnv)).toBeNull();
  });

  it("keeps a local secret for development only", () => {
    expect(text(getMainSessionSecret({ NODE_ENV: "development" } as NodeJS.ProcessEnv))).toBe("local-development-session-secret");
    expect(text(getMainSessionSecret({ NODE_ENV: "development" } as NodeJS.ProcessEnv))).not.toBe("fallback-secret");
  });
});
