import { describe, expect, it } from "vitest";
import { isPublicResearchPath } from "./proxy";

describe("public Research Room routes", () => {
  it.each(["/", "/join", "/success"])("allows %s without a Supabase session", (pathname) => {
    expect(isPublicResearchPath(pathname)).toBe(true);
  });

  it.each(["/research-room", "/casework", "/cases/new", "/login", "/auth/callback"])("keeps %s inside session handling", (pathname) => {
    expect(isPublicResearchPath(pathname)).toBe(false);
  });
});
