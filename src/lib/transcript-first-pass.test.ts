import { describe, expect, it } from "vitest";

import {
  buildFirstPass,
  firstPassSchema,
  parseTranscriptTurns,
} from "../../scripts/transcript-first-pass-lib.mjs";

const source = [
  "MA v. Lindsay Clancy Day 5",
  "",
  "Clerk ([00:01](https://www.rev.com/app/transcript/source/o/item?ts=1)):",
  "",
  "The Commonwealth calls Dr. Jane Example as its next witness.",
  "",
  "Clerk ([00:05](https://www.rev.com/app/transcript/source/o/item?ts=5)):",
  "",
  "Please raise your right hand and solemnly swear.",
  "",
  "Ms. Attorney ([00:10](https://www.rev.com/app/transcript/source/o/item?ts=10)):",
  "",
  "Doctor, what did you observe?",
  "",
  "Dr. Jane Example ([00:14](https://www.rev.com/app/transcript/source/o/item?ts=14)):",
  "",
  "I observed the records.",
  "",
  "Ms. Attorney ([00:20](https://www.rev.com/app/transcript/source/o/item?ts=20)):",
  "",
  "Was Exhibit 1 the record?",
  "",
  "Dr. Jane Example ([00:24](https://www.rev.com/app/transcript/source/o/item?ts=24)):",
  "",
  "Yes.",
  "",
  "Ms. Attorney ([00:30](https://www.rev.com/app/transcript/source/o/item?ts=30)):",
  "",
  "No further questions?",
  "",
  "Judge ([00:35](https://www.rev.com/app/transcript/source/o/item?ts=35)):",
  "",
  "The witness may step down.",
].join("\n");

describe("deterministic testimony first pass", () => {
  it("parses timestamped turns and preserves source locators", () => {
    const turns = parseTranscriptTurns(source);
    expect(turns).toHaveLength(8);
    expect(turns[0]).toMatchObject({ source_line: 3, timestamp_seconds: 1 });
  });

  it("emits schema-valid candidate structure without truth promotion", () => {
    const output = buildFirstPass({
      text: source,
      preservedFilename: "Day-05.md",
      sourceSha256: "a".repeat(64),
    });
    expect(firstPassSchema.safeParse(output).success).toBe(true);
    expect(output.classification).toBe("candidate_structure_only");
    expect(output.counts).toMatchObject({ segments: 8, witness_blocks: 1, phase_sets: 1 });
    expect(output.witness_blocks[0]).toMatchObject({
      witness_name_candidate: "Dr. Jane Example",
      oath_detected: true,
      excusal_detected: true,
      boundary_confidence: 0.85,
    });
    expect(output.procedural_markers.some((marker) => marker.event_types.includes("exhibit"))).toBe(true);
  });
});
