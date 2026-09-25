import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { spanFound } from "../../scripts/medical-assertions-lib.mjs";
import { parseTranscriptTurns } from "../../scripts/transcript-first-pass-lib.mjs";
import {
  buildEvents,
  clusterLane,
  fullWindow,
  inWindow,
  leadUpWindow,
  medicationLanes,
  positionPercent,
  trajectoryFacts,
  type CareSetting,
  type RawAssertion,
  type RawConflict,
  type SupportCard,
} from "./medical-trajectory-model";

const root = path.resolve(__dirname, "../..");
const medical = (...parts: string[]) => path.join(root, "content", "investigation", "medical", ...parts);
const json = <T,>(...parts: string[]) => JSON.parse(readFileSync(medical(...parts), "utf8")) as T;

const day9 = json<{ assertions: RawAssertion[] }>("assertions", "tufts-day09.assertions.json");
const day10 = json<{ assertions: RawAssertion[] }>("assertions", "tufts-day10.assertions.json");
const settings = json<{ settings: CareSetting[] }>("care-settings.json").settings;
const keys = json<Record<string, string[]>>("medication-keys.json");
const conflicts = json<{ conflicts: RawConflict[] }>("conflicts", "tufts-combined.conflicts.json").conflicts;
type RawCard = Omit<SupportCard, "sources"> & { sources: { day: number; seg: number; span: string }[] };
const supportFile = json<{ cards: RawCard[]; signals: RawCard[]; sequence: RawCard[]; sequenceFrame: { start: string; end: string; source: { day: number; seg: number; span: string } } }>("support-context.json");
const support = { cards: [...supportFile.cards, ...supportFile.signals, ...supportFile.sequence] };

const events = buildEvents(
  [{ day: 9, assertions: day9.assertions }, { day: 10, assertions: day10.assertions }],
  { settings, keys, conflicts, exchange: () => [], href: () => null },
);

describe("trajectory events", () => {
  it("drops historical, negated, and merely discussed items from the lanes", () => {
    expect(events.some((e) => /nursing school/i.test(e.summary))).toBe(false);
    expect(events.every((e) => e.lane !== "medication" || !/· discussed$/.test(e.title))).toBe(true);
  });
  it("merges the same medication event stated on two days into one event with both days", () => {
    const increase = events.find((e) => e.medication === "lorazepam" && /increase/.test(e.title) && /advised/.test(e.title));
    expect(increase?.days).toEqual([10]);
    const amitriptyline = events.find((e) => e.medication === "amitriptyline" && e.date === "2023-01-23" && /increase/.test(e.title));
    expect(amitriptyline?.days.slice().sort((a, b) => a - b)).toEqual([9, 10]);
    expect(amitriptyline?.ids.length).toBe(2);
  });
  it("attributes prescribers to care settings and keeps other providers apart", () => {
    const seroquel = events.find((e) => e.medication === "quetiapine" && /200 mg/.test(e.title));
    expect(seroquel?.setting).toBe("south-shore");
    const lamotrigine = events.find((e) => e.medication === "lamotrigine" && /prescribed/.test(e.title));
    expect(lamotrigine?.setting).toBe("aster-psychiatry");
  });
  it("keeps range-type statements off the clock", () => {
    expect(events.some((e) => /14 appointments|continue to recommend that she attend individual therapy/.test(e.summary))).toBe(false);
  });
  it("attaches review candidates to the events they concern", () => {
    expect(events.some((e) => e.conflicts.length > 0)).toBe(true);
  });
});

describe("windows and lanes", () => {
  it("builds the full window from the first to the last dated item", () => {
    const window = fullWindow(events, []);
    expect(window.start <= "2022-09-15").toBe(true);
    expect(window.end).toBe("2023-01-23");
  });
  it("builds the lead-up as the fourteen days before an event", () => {
    const window = leadUpWindow("2023-01-23");
    expect(window).toEqual({ start: "2023-01-09", end: "2023-01-23" });
    expect(inWindow("2023-01-16", window)).toBe(true);
    expect(inWindow("2023-01-08", window)).toBe(false);
    expect(positionPercent("2023-01-16", window)).toBe(50);
  });
  it("clusters one lane's events by date and only inside the window", () => {
    const window = leadUpWindow("2023-01-23");
    const clusters = clusterLane(events, "state", window);
    expect(clusters.every((c) => inWindow(c.date, window))).toBe(true);
    expect(new Set(clusters.map((c) => c.date)).size).toBe(clusters.length);
  });
  it("lists medication lanes that have activity in the window, in order of first appearance", () => {
    const lanes = medicationLanes(events, leadUpWindow("2023-01-23"));
    expect(lanes.map((l) => l.medication)).toContain("amitriptyline");
    expect(lanes.map((l) => l.medication)).not.toContain("sertraline");
  });
  it("counts distinct prescribing settings", () => {
    const facts = trajectoryFacts(events, fullWindow(events, []));
    expect(facts.prescribers).toBeGreaterThanOrEqual(2);
    expect(facts.days).toBeGreaterThan(120);
  });
});

describe("support context", () => {
  const transcript = (day: number) => parseTranscriptTurns(readFileSync(path.join(root, "transcripts", "preserved", `Lindsay-Clancy_Trial-Day-${String(day).padStart(2, "0")}_Rev-Transcript.txt`), "utf8"));
  it("has every cited span verbatim in the preserved transcript", () => {
    const failures: string[] = [];
    for (const card of support.cards) {
      for (const source of card.sources) {
        const segment = transcript(source.day)[source.seg];
        if (!spanFound(segment, source.span)) failures.push(`${card.id}: day ${source.day} seg ${source.seg}`);
      }
    }
    expect(failures).toEqual([]);
  });
  it("keeps the documented sequence in date order and its endpoint anchored to testimony", () => {
    const dates = supportFile.sequence.map((card) => card.date!);
    expect([...dates].sort()).toEqual(dates);
    expect(supportFile.sequence.every((card) => card.sources.length > 0)).toBe(true);
    const source = supportFile.sequenceFrame.source;
    expect(spanFound(transcript(source.day)[source.seg], source.span)).toBe(true);
  });
  it("gives researcher observations a testimony source and a public reference, so they are not bare opinion", () => {
    for (const card of supportFile.cards.filter((c) => c.kind === "researcher_observation")) {
      expect(card.sources.length).toBeGreaterThan(0);
      expect(((card as { references?: unknown[] }).references ?? []).length).toBeGreaterThan(0);
    }
  });
  it("gives source_needed cards no sources and no date, so they assert nothing", () => {
    for (const card of support.cards.filter((c) => c.kind === "source_needed")) {
      expect(card.sources).toEqual([]);
      expect(card.date).toBeNull();
    }
  });
});
