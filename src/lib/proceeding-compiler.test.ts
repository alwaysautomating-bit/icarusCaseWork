import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compileOpeningStatements, compileProceedingSource } from "./proceeding-compiler";

const fixturePath = path.join(process.cwd(), "fixtures", "ma-v-lindsay-clancy-opening-statements.rev.txt");
const source = readFileSync(fixturePath, "utf8");

describe("opening-statement proceeding compiler", () => {
  const proceeding = compileOpeningStatements(source, path.basename(fixturePath));

  it("proves complete parsing inside the declared opening scope", () => {
    expect(proceeding.coverage.parsedSegments).toBe(proceeding.coverage.sourceDetectedSegments);
    expect(proceeding.coverage.compiledOpeningSegments).toBe(proceeding.coverage.openingScopeSegments);
    expect(proceeding.coverage.coverageRatio).toBe(1);
    expect(proceeding.coverage.completionState).toBe("complete");
    expect(proceeding.coverage.endBoundary).toMatch(/morning recess/i);
  });

  it("preserves every party passage as a position rather than evidence", () => {
    expect(proceeding.positions.length).toBeGreaterThan(30);
    expect(proceeding.positions.every((position) => position.recordClass === "advocacy_position")).toBe(true);
    expect(proceeding.positions.every((position) => position.evidenceStatus === "not_evidence")).toBe(true);
    expect(proceeding.positions.some((position) => position.party === "commonwealth")).toBe(true);
    expect(proceeding.positions.some((position) => position.party === "defense")).toBe(true);
  });

  it("keeps the judge's roadmap warning outside both party position lanes", () => {
    const warning = proceeding.segments.find((segment) => /opening statements are very important, but they are not evidence/i.test(segment.normalizedText));
    expect(warning).toMatchObject({ party: "court", recordKind: "instruction" });
    expect(proceeding.positions.some((position) => position.segmentId === warning?.id)).toBe(false);
  });

  it("retains the provider speaker label when normalizing the prosecutor attribution", () => {
    const opening = proceeding.segments.find((segment) => /Morning, ladies and gentlemen\. Cora/i.test(segment.normalizedText));
    expect(opening).toMatchObject({ originalSpeaker: "Madam Clerk", speaker: "Shannon Buckingham", speakerReviewRequired: true });
  });

  it("keeps exact character provenance for every compiled segment", () => {
    for (const segment of proceeding.segments) {
      expect(source.slice(segment.sourceStart, segment.sourceEnd).trim()).toBe(segment.exactText);
    }
  });

  it("surfaces unresolved transcript and account issues instead of resolving them by inference", () => {
    expect(proceeding.resolutionItems.some((item) => item.kind === "transcript_gap")).toBe(true);
    expect(proceeding.resolutionItems.some((item) => item.kind === "account_conflict" && /voice/i.test(item.title))).toBe(true);
    expect(proceeding.resolutionItems.some((item) => item.kind === "source_identity")).toBe(true);
  });

  it("routes opening statements through the provider-neutral compiler entry point", () => {
    const routed = compileProceedingSource({ provider: "rev", representation: "rev_plain_text", proceedingType: "opening_statements", artifactName: "opening.rev.txt" }, source);
    expect(routed.schemaVersion).toBe("proceeding-package/1.0");
    expect(routed.positions.every((position) => position.evidenceStatus === "not_evidence")).toBe(true);
  });
});
