import { describe, expect, it } from "vitest";
import { getDayIntelligenceBundle } from "@/lib/day-intelligence";

const lindsayClancyCaseId = "413d071f-6299-46ae-aa85-46390aca38a6";

describe("Day Intelligence artifact loader", () => {
  it("loads the newest synchronized four-file bundle for a case and day", async () => {
    const bundle = await getDayIntelligenceBundle(lindsayClancyCaseId, 20);

    expect(bundle?.card.artifact_set_id).toBe("lindsay-clancy-day-20-v1");
    expect(bundle?.card.version).toBe(1);
    expect(bundle?.agentPack.items).toHaveLength(30);
    expect(bundle?.agentPack.governance.scratchpad_input_allowed).toBe(false);
    expect(bundle?.relationships.relationships).toEqual([]);
    expect(bundle?.context).toContain("Generated analysis for reference only");
  });

  it("loads Opening Statements and every generated day through Day 19", async () => {
    const bundles = await Promise.all(Array.from({ length: 19 }, (_, index) => getDayIntelligenceBundle(lindsayClancyCaseId, index + 1)));

    expect(bundles.every(Boolean)).toBe(true);
    expect(bundles[0]?.card.title).toBe("Opening Statements Intelligence");
    expect(bundles[18]?.card.subtitle).toContain("Heilbrun");
    expect(bundles.every((bundle) => bundle?.agentPack.governance.scratchpad_input_allowed === false)).toBe(true);
  });

  it("returns an empty state for a day with no generated artifact", async () => {
    await expect(getDayIntelligenceBundle(lindsayClancyCaseId, 21)).resolves.toBeNull();
  });

  it("does not expose another case's artifact", async () => {
    await expect(getDayIntelligenceBundle("another-case", 20)).resolves.toBeNull();
  });
});
