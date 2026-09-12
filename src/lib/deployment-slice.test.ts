import { describe, expect, it } from "vitest";
import { getDeploymentSlice } from "./deployment-slice";

describe("deployment slice", () => {
  it("keeps the complete workspace locally", () => {
    expect(getDeploymentSlice({})).toBe("full");
  });

  it("defaults Vercel to the narrow research pilot", () => {
    expect(getDeploymentSlice({ VERCEL: "1" })).toBe("research_pilot");
  });

  it("allows an explicit reviewed full-workspace release", () => {
    expect(getDeploymentSlice({ VERCEL: "1", ICARUS_DEPLOYMENT_SLICE: "full" })).toBe("full");
  });
});
