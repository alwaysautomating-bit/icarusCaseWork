import { describe, expect, it } from "vitest";
import { isPublicResearchPath, pilotCaseRedirectPath } from "./proxy";

describe("public Research Room routes", () => {
  it.each(["/", "/join", "/success"])("allows %s without a Supabase session", (pathname) => {
    expect(isPublicResearchPath(pathname)).toBe(true);
  });

  it.each(["/research-room", "/casework", "/cases/new", "/login", "/auth/callback"])("keeps %s inside session handling", (pathname) => {
    expect(isPublicResearchPath(pathname)).toBe(false);
  });
});

describe("research pilot route boundary", () => {
  it.each(["trial-index", "record", "files", "questions", "evidence", "access"])("allows the %s case route", (route) => {
    expect(pilotCaseRedirectPath(`/cases/case-id/${route}`)).toBeNull();
  });

  it.each(["structure", "reconcile", "reconstruction", "trajectory", "reports"])("redirects the %s case route", (route) => {
    expect(pilotCaseRedirectPath(`/cases/case-id/${route}`)).toBe("/cases/case-id/trial-index");
  });

  it("does not interfere with case selection and creation", () => {
    expect(pilotCaseRedirectPath("/casework")).toBeNull();
    expect(pilotCaseRedirectPath("/cases/new")).toBeNull();
  });
});
