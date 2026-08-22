import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { buildDay6KnowledgeAcceptance } from "@/lib/day6-knowledge-acceptance";
import { parseRevTranscript } from "@/lib/rev-testimony";
import { buildDeterministicStructure, compileTestimonyKnowledgeMap } from "@/lib/testimony-knowledge-mapper";

const artifact = path.resolve(".data/objects/48cca058a0bc10ec900010f0271d2bd6ede40c88b7db57e2790ee07aa2de55d2.html");
const identity = {
  caseId: "11111111-1111-4111-8111-111111111111",
  proceedingId: "22222222-2222-4222-8222-222222222222",
  sourceArtifactId: "33333333-3333-4333-8333-333333333333",
};

describe.runIf(existsSync(artifact))("testimony knowledge mapping", () => {
  const transcript = parseRevTranscript(readFileSync(artifact, "utf8"), "https://www.rev.com/transcripts/ma-v-lindsay-clancy-day-6");

  it("adapts the existing deterministic pass without overlaps or timestamp regression", () => {
    const structure = buildDeterministicStructure(transcript.segments);
    expect(structure.witnessBlocks).toHaveLength(8);
    expect(structure.witnessBlocks[0]).toMatchObject({ witness_name_candidate: "Christina Carpio", start: { segment_index: 63 } });
    expect(structure.witnessBlocks[1]).toMatchObject({ witness_name_candidate: "Joseph Rabbit" });
    expect(structure.qa).toMatchObject({ segmentCount: 2_197, timestampRegressions: 3, impossibleTimestampRegressions: 0, blockOverlaps: 0, invalidBlocks: 0 });
    expect(structure.qa.timestampRegressionDetails.map((item) => item.deltaMs)).toEqual([-2_000, -3_000, -2_000]);
    expect(structure.qa.unassignedSegmentIds).toHaveLength(63);
    expect(structure.qa.lowConfidenceBlockIds).toEqual([]);
  });

  it("maps the 82.1°F and 95.2°F exchanges without inventing measurement time or identity", () => {
    const output = buildDay6KnowledgeAcceptance(transcript, identity);
    expect(output.witness_blocks).toHaveLength(8);
    expect(output.testimony_units).toHaveLength(2);
    expect(output.knowledge_items).toHaveLength(2);
    expect(output.claims).toHaveLength(2);
    expect(output.event_candidates).toHaveLength(2);
    expect(output.temporal_assertions.map((item) => [item.precision, item.asserted_start, item.asserted_end])).toEqual([
      ["relative_only", null, null],
      ["unknown", null, null],
    ]);
    expect(output.entity_mentions.every((mention) => mention.resolved_entity_id === null)).toBe(true);
    expect(output.claims[0].normalized_assertion).toContain("remembered the patient was hypothermic");
    expect(output.claims[0].normalized_assertion).not.toContain("affirmed");
    expect(output.claims[1].normalized_assertion).toContain("95.2°F");
    expect(output.relationships.map((item) => item.relation_type)).toEqual(["describes", "describes"]);
    expect(JSON.stringify(output)).not.toMatch(/"(?:supports|contradicts|causes|truth)"/);
  });

  it("keeps every derived object linked to exact committed segment IDs and transformation lineage", () => {
    const output = buildDay6KnowledgeAcceptance(transcript, identity);
    const committed = new Set(transcript.segments.map((segment) => segment.id));
    for (const item of [...output.knowledge_items, ...output.claims, ...output.temporal_assertions, ...output.flags]) {
      const sourceIds = (item.source_segment_ids ?? []) as string[];
      expect(sourceIds.length).toBeGreaterThan(0);
      expect(sourceIds.every((id: string) => committed.has(id))).toBe(true);
    }
    expect(output.provenance_activities.map((activity) => activity.activity_type)).toEqual([
      "transcript_parse", "deterministic_structure", "knowledge_extraction",
    ]);
    expect(output.provenance_relations.some((relation) => relation.relation_type === "was_derived_from")).toBe(true);
    expect(output.invariants).toContain("canonical entity resolution is delegated to SAME");
  });

  it("rejects exact timestamps attached to an unknown temporal assertion", () => {
    const exchange = transcript.qaExchanges.find((item) => /95\.2 degrees/i.test(item.question))!;
    expect(() => compileTestimonyKnowledgeMap({
      ...identity,
      transcript,
      candidates: [{
        key: "invalid-time", witnessBlockImportedId: "witness_001", unitKind: "qa_thread",
        segments: [exchange.questionSegmentId, ...exchange.answerSegmentIds].map((segmentId) => ({ segmentId, contextRole: "substantive" as const })),
        summary: "Invalid test candidate.", unknowns: [], claims: [], entityMentions: [],
        eventCandidates: [{ key: "event", neutralDescription: "Candidate event.", participantMentions: [], sourceClaimKeys: [], extractionConfidence: 0.5 }],
        temporalAssertions: [{ key: "time", eventCandidateKey: "event", sourceClaimKey: null, rawTemporalLanguage: "at some point", assertedStart: "2023-01-24T00:00:00Z", assertedEnd: null, precision: "unknown", assertedByRaw: "test", sourceSegmentIds: [exchange.questionSegmentId], extractionConfidence: 0.5 }],
        relationships: [], flags: [],
      }],
    })).toThrow("unknown time cannot include an asserted timestamp");
  });
});
