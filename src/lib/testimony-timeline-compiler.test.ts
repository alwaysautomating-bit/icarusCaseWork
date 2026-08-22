import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { DAY6_TIMELINE_WITNESS, buildDay6TimelineAcceptance } from "@/lib/day6-timeline-acceptance";
import { parseRevTranscript } from "@/lib/rev-testimony";
import { parseTestimonyTemporalLanguage } from "@/lib/testimony-timeline-compiler";

describe("testimony temporal language", () => {
  it.each([
    ["January 24th of 2023", "exact_date", "2023-01-24"],
    ["at 3:42 p.m.", "exact_time", null],
    ["around 3:42 p.m.", "approximate", null],
    ["the early morning hours", "approximate", null],
    ["approximately nine months", "interval", null],
    ["for about 20 minutes", "interval", null],
    ["after South Shore Hospital", "relative_only", null],
    ["three days later", "relative_only", null],
    ["the next day", "relative_only", null],
    ["I had already finished", "sequence_only", null],
    ["I had not yet arrived", "sequence_only", null],
    ["then confirmed it at the lab", "sequence_only", null],
    ["I don't know when that decision was made", "unknown", null],
    ["Yearly", "interval", null],
  ])("keeps %s at supported precision", (wording, precision, assertedDate) => {
    expect(parseTestimonyTemporalLanguage(wording)).toMatchObject({ precision, assertedDate });
  });

  it("preserves wording-derived qualification without inventing confidence", () => {
    expect(parseTestimonyTemporalLanguage("I believe it was around 3:42 p.m.")).toMatchObject({
      precision: "approximate",
      qualification: "witness_qualified",
      qualifierText: "I believe",
      confidenceBasis: "wording:i-believe",
    });
    expect(parseTestimonyTemporalLanguage("I would have to check my notes specifically.")).toMatchObject({
      precision: "unknown",
      qualification: "witness_qualified",
      confidenceBasis: "wording:check-notes",
    });
  });

  it("keeps relative offsets and recurring wording structured but unanchored", () => {
    expect(parseTestimonyTemporalLanguage("three days later")).toMatchObject({
      precision: "relative_only", relativeOffsetValue: 3, relativeOffsetUnit: "day", assertedDate: null,
    });
    expect(parseTestimonyTemporalLanguage("Yearly")).toMatchObject({
      precision: "interval", recurrencePattern: { wording: "Yearly", frequency: "yearly" }, assertedDate: null,
    });
  });
});

describe("Day 6 timeline candidate acceptance fixture", () => {
  it("compiles reviewed Hartnett testimony to traceable candidates without canonicalization", async () => {
    const html = await readFile(new URL("../../.data/objects/48cca058a0bc10ec900010f0271d2bd6ede40c88b7db57e2790ee07aa2de55d2.html", import.meta.url), "utf8");
    const transcript = parseRevTranscript(html, "https://www.rev.com/transcripts/ma-v-lindsay-clancy-day-6");
    const result = buildDay6TimelineAcceptance(transcript, {
      caseId: "11111111-1111-4111-8111-111111111111",
      proceedingId: "22222222-2222-4222-8222-222222222222",
      sourceArtifactId: "33333333-3333-4333-8333-333333333333",
    });

    expect(transcript.segments.slice(DAY6_TIMELINE_WITNESS.startOrdinal, DAY6_TIMELINE_WITNESS.endOrdinal + 1)).toHaveLength(488);
    expect(result.witness_blocks).toEqual([]);
    expect(result.testimony_units).toHaveLength(11);
    expect(result.knowledge_items).toHaveLength(11);
    expect(result.claims).toHaveLength(11);
    expect(result.event_candidates).toHaveLength(12);
    expect(result.temporal_assertions).toHaveLength(12);
    expect(result.entity_mentions).toHaveLength(19);
    expect(result.boundary).toEqual({ canonical_events_created: 0, same_resolutions_created: 0 });
    expect(result.testimony_units.every((unit) => unit.review_status === "accepted")).toBe(true);
    expect(result.event_candidates.every((event) => Array.isArray(event.source_claim_ids) && event.source_claim_ids.length > 0)).toBe(true);
    expect(result.entity_mentions.every((mention) => mention.resolved_entity_id === null)).toBe(true);
    expect(result.temporal_assertions.map((item) => item.precision)).toEqual([
      "interval", "interval", "exact_date", "unknown", "relative_only", "exact_date",
      "exact_date", "unknown", "approximate", "unknown", "sequence_only", "unknown",
    ]);
    expect(result.temporal_assertions.find((item) => item.raw_temporal_language === "At some point after being at South Shore Hospital")).toMatchObject({
      precision: "relative_only", asserted_date: null, asserted_start: null, asserted_end: null,
    });
    expect(result.temporal_assertions.find((item) => item.raw_temporal_language === "I don't know when that decision was made")).toMatchObject({
      precision: "unknown", qualification: "unknown", asserted_date: null, asserted_start: null, asserted_end: null,
    });
    expect(result.temporal_assertions.find((item) => item.raw_temporal_language === "the early morning hours, January 25th")).toMatchObject({
      precision: "approximate", time_of_day_band: "early_morning", asserted_date: null,
    });
    expect(result.deterministic_qa.timestampRegressionDetails).toHaveLength(3);
  });
});
