import { describe, expect, it } from "vitest";
import { getLocalAuthBypassCredentials, isLocalAuthBypassEnabled, shouldReplaceLocalAuthSession } from "@/lib/supabase/local-auth";

describe("local auth bypass", () => {
  it("is available only in development when explicitly enabled", () => {
    expect(isLocalAuthBypassEnabled({ NODE_ENV: "development", ICARUS_LOCAL_AUTH_BYPASS: "true" })).toBe(true);
    expect(isLocalAuthBypassEnabled({ NODE_ENV: "development" })).toBe(false);
    expect(isLocalAuthBypassEnabled({ NODE_ENV: "production", ICARUS_LOCAL_AUTH_BYPASS: "true" })).toBe(false);
    expect(isLocalAuthBypassEnabled({ NODE_ENV: "development", ICARUS_LOCAL_AUTH_BYPASS: "false" })).toBe(false);
  });

  it("returns only server-configured credentials", () => {
    expect(getLocalAuthBypassCredentials({
      NODE_ENV: "development",
      ICARUS_LOCAL_AUTH_BYPASS: "true",
      ICARUS_LOCAL_AUTH_EMAIL: " researcher@example.test ",
      ICARUS_LOCAL_AUTH_PASSWORD: "local-only-password",
    })).toEqual({ email: "researcher@example.test", password: "local-only-password" });

    expect(getLocalAuthBypassCredentials({ NODE_ENV: "development" })).toBeNull();
    expect(() => getLocalAuthBypassCredentials({
      NODE_ENV: "development",
      ICARUS_LOCAL_AUTH_BYPASS: "true",
      ICARUS_LOCAL_AUTH_EMAIL: "researcher@example.test",
    })).toThrow("email or password is missing");
  });

  it("replaces missing or different development sessions", () => {
    const credentials = { email: "local-owner@icarus.test", password: "local-only-password" };
    expect(shouldReplaceLocalAuthSession(credentials, undefined)).toBe(true);
    expect(shouldReplaceLocalAuthSession(credentials, "another-user@example.test")).toBe(true);
    expect(shouldReplaceLocalAuthSession(credentials, "LOCAL-OWNER@ICARUS.TEST")).toBe(false);
    expect(shouldReplaceLocalAuthSession(null, "another-user@example.test")).toBe(false);
  });
});
