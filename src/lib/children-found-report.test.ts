import { describe, expect, it } from "vitest";
import { buildChildrenFoundReport, childrenFoundSourceRequirements } from "@/lib/children-found-report";

describe("children-found source-linked report", () => {
  const completeSegments = childrenFoundSourceRequirements().map((source) => ({
    id: source.segmentId,
    exact_text: `Transcript context: ${source.expectedText}`,
  }));

  it("withholds the report when any reviewed source requirement is absent", () => {
    const result = buildChildrenFoundReport(completeSegments.slice(1));

    expect(result.available).toBe(false);
    expect(result.missingSourceKeys).toContain("dawson-field-state");
  });

  it("builds separate Dawson, Cora, and Callan findings from a complete source bundle", () => {
    const result = buildChildrenFoundReport(completeSegments);

    expect(result.available).toBe(true);
    expect(result.missingSourceKeys).toEqual([]);
    expect(result.subjects.map((subject) => subject.name)).toEqual(["Dawson", "Cora", "Callan"]);
    expect(result.subjects.find((subject) => subject.key === "cora")?.findings.some((finding) => finding.key === "cora-dna")).toBe(true);
    expect(result.subjects.find((subject) => subject.key === "callan")?.findings.find((finding) => finding.key === "callan-transfer")?.status).toBe("qualified");
  });

  it("keeps the unverified measurement and hand-blood propositions out of the findings", () => {
    const result = buildChildrenFoundReport(completeSegments);
    const findingText = result.subjects.flatMap((subject) => subject.findings).map((finding) => finding.text).join(" ");

    expect(findingText).not.toMatch(/11[- ]inch/i);
    expect(findingText).not.toMatch(/blood (?:specifically )?on (?:Cora(?:’s|'s) )?hands/i);
    expect(result.heldDetails.map((item) => item.key)).toEqual(["cora-stain-measurement", "cora-hand-blood"]);
  });
});
