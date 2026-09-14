import { describe, expect, it } from "vitest";
import { isPublicResearchPath } from "./proxy";

describe("public entry routes", () => {
  it.each(["/"])("allows %s without a Supabase session", (pathname) => {
    expect(isPublicResearchPath(pathname)).toBe(true);
  });

  it.each(["/casework", "/cases/new", "/login", "/auth/callback"])("keeps %s inside session handling", (pathname) => {
    expect(isPublicResearchPath(pathname)).toBe(false);
  });
});
