import { describe, expect, it } from "vitest";
import { parseReferenceLines, parseTopicLines, parseWitnessLines, trialIndexSearchText } from "@/lib/trial-index-model";

describe("trial navigation index model", () => {
  it("parses compact editorial input without assigning evidentiary meaning", () => {
    const witnesses = parseWitnessLines("Ian Whiffen | Digital forensics | appeared\nDr. Mack | Rebuttal psychiatrist | reported");
    const topics = parseTopicLines("Apple Watch | Stair-climb data discussed\nDefense begins | Prosecution rested");
    const references = parseReferenceLines("Day 14 recap | https://example.test/day-14 | Example News | reporting");
    expect(witnesses).toHaveLength(2);
    expect(topics[0]).toMatchObject({ label: "Apple Watch" });
    expect(references[0]).toMatchObject({ source_kind: "reporting" });
    expect(trialIndexSearchText({ headline: "Prosecution rests", summary: "", witnesses, topics })).toContain("apple watch");
  });

  it("rejects malformed line contracts", () => {
    expect(() => parseWitnessLines("A | role | accepted")).toThrow(/Witness line 1/);
    expect(() => parseReferenceLines("Article | not-a-url")).toThrow(/Reference line 1/);
  });
});
