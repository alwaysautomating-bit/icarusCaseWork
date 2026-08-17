import { describe, expect, it } from "vitest";
import { assertDistinctClaims, isIndependentCorroboration } from "./evidence-graph";

describe("claim lineage", () => {
  it("does not count repetition or paraphrase as independent corroboration", () => {
    expect(isIndependentCorroboration("repeats")).toBe(false);
    expect(isIndependentCorroboration("paraphrases")).toBe(false);
    expect(isIndependentCorroboration("origin")).toBe(true);
  });

  it("rejects self lineage", () => {
    expect(() => assertDistinctClaims("claim-a", "claim-a")).toThrow(/itself/);
  });
});
