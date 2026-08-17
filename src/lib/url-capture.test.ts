import { describe, expect, it } from "vitest";
import { assertSafeRemoteUrl, canonicalizeSubmittedUrl } from "@/lib/url-capture";

describe("testimony URL safety", () => {
  it("preserves meaningful query parameters while removing acquisition tracking from canonical identity", () => {
    expect(canonicalizeSubmittedUrl("https://www.rev.com/transcripts/day-6?utm_source=chatgpt&part=2#speaker")).toBe("https://www.rev.com/transcripts/day-6?part=2");
  });

  it("allows a public address and rejects private, loopback, credentialed, and nonstandard-port targets", async () => {
    await expect(assertSafeRemoteUrl("https://example.com/path", async () => [{ address: "93.184.216.34", family: 4 }])).resolves.toBeInstanceOf(URL);
    await expect(assertSafeRemoteUrl("https://example.com/path", async () => [{ address: "10.0.0.4", family: 4 }])).rejects.toThrow("private-network");
    await expect(assertSafeRemoteUrl("http://127.0.0.1/admin")).rejects.toThrow("private-network");
    await expect(assertSafeRemoteUrl("https://user:pass@example.com")).rejects.toThrow("credentials");
    await expect(assertSafeRemoteUrl("https://example.com:8443")).rejects.toThrow("ports");
  });
});
