import { describe, expect, it } from "vitest";
import { buildLindsayFoundReport, lindsayFoundSourceRequirements } from "@/lib/lindsay-found-report";

describe("Lindsay source-linked findings report", () => {
  const completeSegments = lindsayFoundSourceRequirements().map((source) => ({
    id: source.segmentId,
    exact_text: `Transcript context: ${source.expectedText}`,
  }));

  it("withholds the report when a reviewed source requirement is absent", () => {
    const result = buildLindsayFoundReport(completeSegments.slice(1));
    expect(result.available).toBe(false);
    expect(result.missingSourceKeys).toContain("patrick-location");
  });

  it("builds a separate scene-to-hospital lane from a complete source bundle", () => {
    const result = buildLindsayFoundReport(completeSegments);
    expect(result.available).toBe(true);
    expect(result.findings.map((finding) => finding.phase)).toContain("Hospital documentation");
    expect(result.findings.find((finding) => finding.key === "wounds")?.status).toBe("qualified");
  });

  it("does not promote hand-stain identity or internal-injury diagnoses", () => {
    const result = buildLindsayFoundReport(completeSegments);
    const findingText = result.findings.map((finding) => finding.text).join(" ");
    expect(findingText).not.toMatch(/stain (?:was|as) blood/i);
    expect(findingText).not.toMatch(/burst fracture|fractured every rib/i);
    expect(result.heldDetails.map((item) => item.key)).toEqual(["hand-stain-identity", "internal-injuries"]);
  });
});
