import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { buildDay3ResponderReconstruction } from "@/lib/day3-responder-reconstruction";
import { compilePreservedTranscriptManifest, type IntakeManifest } from "@/lib/proceeding-compiler";
import type { ParsedRevTranscript } from "@/lib/rev-testimony";
import { compileTestimonyReconstruction } from "@/lib/testimony-reconstruction";
import { parseTestimonyTemporalLanguage } from "@/lib/testimony-timeline-compiler";

const caseId = "11111111-1111-4111-a111-111111111111";
const proceedingId = "22222222-2222-4222-a222-222222222222";
const sourceArtifactId = "33333333-3333-4333-a333-333333333333";

function day3Transcript() {
  const manifest = JSON.parse(readFileSync(path.resolve("transcripts/manifests/Lindsay-Clancy_Trial-Day-03_Intake-Manifest.json"), "utf8")) as IntakeManifest;
  const preserved = readFileSync(path.resolve("transcripts/preserved", manifest.source.preserved_filename), "utf8");
  const compiled = compilePreservedTranscriptManifest(manifest, preserved);
  return { sourceSha256: compiled.source.sha256, segments: compiled.segments } as ParsedRevTranscript;
}

describe("testimony reconstruction", () => {
  it("preserves response-duration ranges as bounded intervals", () => {
    expect(parseTestimonyTemporalLanguage("Seven to 10 minutes.").precision).toBe("bounded_interval");
    expect(parseTestimonyTemporalLanguage("anywhere from three to four minutes").precision).toBe("bounded_interval");
  });

  it("compiles six witness lanes without canonicalizing events or resolving tensions", () => {
    const result = buildDay3ResponderReconstruction(day3Transcript(), { caseId, proceedingId, sourceArtifactId }, "2026-08-22T12:00:00.000Z");
    expect(result.reviewedUnits).toHaveLength(25);
    expect(result.timeline.event_candidates).toHaveLength(25);
    expect(result.reconstruction.assertions).toHaveLength(25);
    expect(result.reconstruction.nodes).toHaveLength(10);
    expect(result.reconstruction.tensions).toHaveLength(4);
    expect(result.reconstruction.lanes).toHaveLength(5);
    expect(result.reconstruction.boundaries).toEqual({
      canonical_events_created: 0,
      same_resolutions_created: 0,
      testimony_timestamps_used_as_event_time: 0,
      unresolved_tensions_collapsed: 0,
    });
    expect(new Set(result.reconstruction.assertions.map((item) => item.witness))).toEqual(new Set([
      "Officer Stephen Hall", "Officer Brian Josephine", "PJ Hussey", "Loring Nudd", "Keith Nette", "Patrick Dwyer",
    ]));
  });

  it("rejects cyclic before constraints", () => {
    const result = buildDay3ResponderReconstruction(day3Transcript(), { caseId, proceedingId, sourceArtifactId }, "2026-08-22T12:00:00.000Z");
    expect(() => compileTestimonyReconstruction({
      timeline: result.timeline,
      eventCandidateIdByRef: result.eventCandidateIdByRef,
      definition: {
        title: "Cycle",
        description: "Invalid cycle fixture",
        lanes: [{ key: "lane", label: "Lane" }],
        nodes: [
          { key: "a", title: "A", summary: "A", laneKey: "lane", temporalLabel: "Unknown", assertionRefs: ["hall-scream"] },
          { key: "b", title: "B", summary: "B", laneKey: "lane", temporalLabel: "Unknown", assertionRefs: ["josephine-screams"] },
        ],
        edges: [
          { from: "a", to: "b", relation: "before", basisAssertionRefs: ["hall-scream"], rationale: "fixture", confidenceBasis: "fixture" },
          { from: "b", to: "a", relation: "before", basisAssertionRefs: ["josephine-screams"], rationale: "fixture", confidenceBasis: "fixture" },
        ],
        tensions: [],
      },
    })).toThrow("cycle");
  });
});
