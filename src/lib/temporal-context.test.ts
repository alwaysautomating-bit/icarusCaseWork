import { beforeAll, describe, expect, it } from "vitest";

import { buildDay3TemporalContext, day3TemporalContextAccounts } from "@/lib/day3-temporal-context-acceptance";
import { loadDay3Transcript } from "@/lib/day3-transcript-loader";
import type { ParsedRevTranscript } from "@/lib/rev-testimony";
import { buildTemporalContextPayload, compileTemporalContext, projectTemporalContext } from "@/lib/temporal-context";
import { describesPriorState, extractTemporalCues, parseDurationWording, wordingSupportsRelation } from "@/lib/temporal-lexicon";
import { parseTestimonyTemporalLanguage } from "@/lib/testimony-timeline-compiler";

const identity = {
  caseId: "11111111-1111-4111-8111-111111111111",
  proceedingId: "22222222-2222-4222-8222-222222222222",
  sourceArtifactId: "33333333-3333-4333-8333-333333333333",
};

describe("temporal lexicon", () => {
  it("recognises sequence, state, and simultaneity cues without inventing chronology", () => {
    expect(extractTemporalCues("When I arrived, the ambulance was already there.").map((cue) => cue.kind)).toEqual(expect.arrayContaining(["state", "simultaneity"]));
    expect(wordingSupportsRelation("Then I heard someone scream.", "BEFORE")).not.toBeNull();
    expect(wordingSupportsRelation("I heard someone scream.", "BEFORE")).toBeNull();
    expect(describesPriorState("The ambulance was backing up and had pretty much just parked")).toBe(true);
    expect(describesPriorState("I heard someone scream")).toBe(false);
  });

  it("keeps ranges as ranges and vague durations vague", () => {
    expect(parseDurationWording("Seven to 10 minutes.")).toMatchObject({ minSeconds: 420, maxSeconds: 600, vague: false });
    expect(parseDurationWording("A few minutes.")).toMatchObject({ minSeconds: null, maxSeconds: null, vague: true });
    expect(parseDurationWording("probably 15 seconds")).toMatchObject({ vague: true });
  });

  it("preserves the qualification on an approximate clock time", () => {
    expect(parseTestimonyTemporalLanguage("I think it was around 6:15 PM")).toMatchObject({
      precision: "approximate", assertedTimeOfDayStart: "18:15:00", qualification: "witness_qualified", qualifierText: "I think",
    });
    expect(parseTestimonyTemporalLanguage("when you came around there")).toMatchObject({ qualification: "asserted" });
  });
});

describe("Day 3 temporal context — Hall then Josephine", () => {
  let transcript: ParsedRevTranscript;
  beforeAll(async () => { transcript = (await loadDay3Transcript()).transcript; });

  const both = () => buildDay3TemporalContext(transcript, identity);
  const hallOnly = () => buildDay3TemporalContext(transcript, identity, { accounts: ["hall"] });

  it("keeps the first witness's account byte-identical when a second witness is processed", () => {
    const first = hallOnly();
    const second = both();
    expect(JSON.stringify(second.runs[0].payload)).toBe(JSON.stringify(first.runs[0].payload));
    const hall = (result: typeof first) => result.candidates.filter((item) => item.accountKey === "day3-hall");
    expect(hall(second)).toEqual(hall(first));
    expect(second.constraints.filter((item) => item.accountKey === "day3-hall")).toEqual(first.constraints);
    expect(second.candidates.length).toBeGreaterThan(first.candidates.length);
    expect(first.links).toEqual([]);
    expect(first.report.possibleSharedAnchors).toBe(0);
  });

  it("is idempotent across reruns", () => {
    const a = both(); const b = both();
    expect(b.contentSha256).toBe(a.contentSha256);
    expect(JSON.stringify(b.runs.map((run) => run.payload))).toBe(JSON.stringify(a.runs.map((run) => run.payload)));
  });

  it("creates no canonical events and no automatic SAME resolutions", () => {
    const result = both();
    expect(result.report.canonicalEventsCreated).toBe(0);
    expect(result.report.automaticSameResolutions).toBe(0);
    for (const run of result.runs) {
      expect(run.payload.boundary).toEqual({ canonical_events_created: 0, same_resolutions_created: 0 });
      expect(run.payload.entity_mentions.every((mention) => mention.resolved_entity_id === null)).toBe(true);
      expect(run.payload.event_candidates.every((event) => (event.source_claim_ids as string[]).length > 0 && event.review_status === "pending")).toBe(true);
    }
    expect(result.links.every((link) => link.reviewStatus === "pending")).toBe(true);
    expect(result.constraints.every((constraint) => constraint.reviewStatus === "pending")).toBe(true);
  });

  it("links every temporal assertion to exact testimony and never fabricates a clock time", () => {
    const result = both();
    const spoken = new Map(transcript.segments.map((segment) => [segment.id, segment.text]));
    for (const assertion of result.assertions) {
      expect(assertion.sourceSegmentIds.map((id) => spoken.get(id)).join("\n")).toContain(assertion.wording);
    }
    for (const run of result.runs) for (const row of run.payload.temporal_assertions) {
      expect(row.asserted_start).toBeNull();
      expect(row.asserted_end).toBeNull();
    }
    const relativeOnly = result.assertions.filter((assertion) => assertion.form === "RELATIVE" || assertion.form === "SEQUENCE_ONLY");
    expect(relativeOnly.length).toBeGreaterThan(0);
    expect(relativeOnly.every((assertion) => !assertion.hasClockValue)).toBe(true);
    expect(result.assertions.filter((assertion) => assertion.form === "UNKNOWN").length).toBeGreaterThan(0);
  });

  it("keeps the 6:11 PM premise approximate, qualified by wording, and marked as adopted from the question", () => {
    const result = both();
    const dispatch = result.assertions.filter((assertion) => assertion.wording === "approximately 6:11 PM");
    expect(dispatch).toHaveLength(2);
    for (const assertion of dispatch) expect(assertion).toMatchObject({ form: "APPROXIMATE_TIME", qualification: "estimated", adoptedFromQuestion: true });
    const rows = result.runs.flatMap((run) => run.payload.temporal_assertions).filter((row) => row.raw_temporal_language === "approximately 6:11 PM");
    expect(rows.every((row) => row.confidence_basis === "adopted-question-premise" && row.asserted_time_of_day_start === "18:11:00")).toBe(true);
  });

  it("preserves both travel-duration accounts as a conflict and never averages them", () => {
    const result = both();
    const conflict = result.conflicts.find((item) => item.kind === "duration_ranges_disjoint");
    expect(conflict?.parties.map((party) => party.wording).sort()).toEqual(["I would say anywhere from three to four minutes.", "Seven to 10 minutes."]);
    const durations = result.assertions.filter((assertion) => assertion.form === "DURATION" && assertion.durationSeconds && !assertion.durationSeconds.vague);
    expect(durations.map((item) => [item.durationSeconds!.min, item.durationSeconds!.max]).sort()).toEqual([[180, 240], [420, 600]]);
  });

  it("surfaces the kitchen-screaming disagreement without choosing a side", () => {
    const state = both().conflicts.find((item) => item.kind === "state_disagreement");
    expect(state?.parties.map((party) => party.accountKey).sort()).toEqual(["day3-hall", "day3-josephine"]);
  });

  it("proposes shared anchors and same-event links only as pending review candidates", () => {
    const result = both();
    const scream = result.anchors.find((anchor) => anchor.family === "scream")!;
    expect(scream.sharedAcrossAccounts).toBe(true);
    expect(scream.members.map((member) => member.accountKey).sort()).toEqual(["day3-hall", "day3-josephine"]);
    expect(result.links.filter((link) => link.linkType === "possible_shared_anchor" && link.to.id === scream.id)).toHaveLength(2);
    expect(result.links.some((link) => link.linkType === "possible_same_event")).toBe(true);
    expect(result.links.some((link) => link.linkType === "possible_additional_detail")).toBe(true);
    // Both original event candidates survive; neither replaces the other.
    const screamEvents = result.candidates.filter((candidate) => candidate.anchorFamily === "scream");
    expect(new Set(screamEvents.map((candidate) => candidate.id)).size).toBe(2);
  });

  it("derives a reviewable constraint from an observed prior state, separate from the source assertion", () => {
    const result = both();
    const ambulance = result.anchors.find((anchor) => anchor.family === "ambulance-arrival")!;
    const constraint = result.constraints.find((item) => item.derivation === "state_observation" && item.from.id === ambulance.id)!;
    expect(constraint.relation).toBe("BEFORE_OR_AT");
    expect(constraint.to.type).toBe("event_candidate");
    expect(constraint.wording).toContain("had pretty much just parked");
    expect(result.candidates.find((candidate) => candidate.id === constraint.to.id)?.kind).toBe("state_observation");
  });

  it("keeps knowledge-state changes separate and never proposes them as the same real-world event", () => {
    const result = both();
    const knowledge = result.candidates.filter((candidate) => candidate.kind === "knowledge_state");
    expect(knowledge.length).toBe(result.report.knowledgeStateChanges);
    const ids = new Set(knowledge.map((candidate) => candidate.id));
    expect(result.links.some((link) => link.linkType === "possible_same_event" && (ids.has(link.from.id) || ids.has(link.to.id)))).toBe(false);
    expect(knowledge.every((candidate) => candidate.knowledge && candidate.knowledge.holder)).toBe(true);
  });

  it("lets a strong anchor position weaker events without inventing clock times", () => {
    const result = both();
    const slot = projectTemporalContext(result).byAnchor("scream").slots.find((item) => item.accountKey === "day3-hall")!;
    expect(slot.before.length).toBeGreaterThan(0);
    expect(slot.after.length).toBeGreaterThan(0);
    const josephine = projectTemporalContext(result).byAnchor("scream").slots.find((item) => item.accountKey === "day3-josephine")!;
    expect(josephine.after.length).toBeGreaterThan(0);
  });

  it("rejects a relation the witness's own wording does not support", () => {
    const accounts = day3TemporalContextAccounts(transcript).slice(0, 1);
    const relation = accounts[0].relations.find((item) => item.key === "radio-before-scream")!;
    relation.wording = "I heard a loud scream from inside.";
    relation.sourceSegmentIds = accounts[0].statements.find((statement) => statement.key === "hall-scream")!.events[0].sourceSegmentIds;
    expect(() => compileTemporalContext({ ...identity, transcript, accounts })).toThrow(/no cue supporting/);
  });

  it("rejects a relation whose wording is not in the cited testimony", () => {
    const accounts = day3TemporalContextAccounts(transcript).slice(0, 1);
    accounts[0].relations.find((item) => item.key === "radio-before-scream")!.wording = "Then the scream came after the radio call.";
    expect(() => compileTemporalContext({ ...identity, transcript, accounts })).toThrow(/exact substring/);
  });

  it("reports the counts the milestone requires", () => {
    const { report } = both();
    expect(report).toMatchObject({
      testimonyUnitsReviewed: 23, eventCandidatesCreated: 40, temporalAssertionsCreated: 40,
      canonicalEventsCreated: 0, automaticSameResolutions: 0,
    });
    expect(report.possibleSharedAnchors).toBeGreaterThan(0);
    expect(report.temporalConflicts).toBeGreaterThanOrEqual(2);
    expect(report.sourceIrregularities.wholeProceedingPreserved).toBe(3);
  });
  it("builds a database payload that keeps account runs unchanged and adds only review-status context", () => {
    const result = both();
    const payload = buildTemporalContextPayload(result, identity);
    expect(payload.boundary).toEqual({ canonical_events_created: 0, same_resolutions_created: 0 });
    expect(payload.runs).toHaveLength(2);
    expect(JSON.stringify(payload.runs[0])).toBe(JSON.stringify(hallOnly().runs[0].payload));
    expect(payload.context.constraints).toHaveLength(result.constraints.length);
    expect(payload.context.links.every((link) => link.link_type.startsWith("possible_"))).toBe(true);
    expect(payload.context.conflicts.every((conflict) => conflict.target_event_candidate_id)).toBe(true);
    expect(payload.context.assertion_context.filter((item) => item.adopted_from_question)).toHaveLength(2);
    expect(buildTemporalContextPayload(both(), identity).context.run.id).toBe(payload.context.run.id);
    expect(buildTemporalContextPayload(hallOnly(), identity).context.run.id).not.toBe(payload.context.run.id);
  });
});
