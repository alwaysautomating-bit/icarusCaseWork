import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { parseTranscriptTurns } from "../../scripts/transcript-first-pass-lib.mjs";
import { witnessHref } from "@/lib/case-routes";
import { listWitnessBlocks } from "@/lib/witness-testimony";
import {
  buildEvents,
  type CareSetting,
  type Evidence,
  type RawAssertion,
  type RawConflict,
  type SupportCard,
  type TrajectoryEvent,
} from "@/lib/medical-trajectory-model";

type Turn = { segment_index: number; speaker: string; timestamp_display: string; text: string };
type ExtractionFile = { trial_day: number; source_file: string; witness: string; witness_block_id: string; source_notes?: string[]; extractor: { reviewed: boolean }; assertions: RawAssertion[] };
type RawSource = { day: number; seg: number; span: string };
type SupportFile = { sequence: (Omit<SupportCard, "sources"> & { sources: RawSource[] })[]; sequenceFrame: { start: string; end: string; label: string; source: RawSource }; signals: (Omit<SupportCard, "sources"> & { sources: { day: number; seg: number; span: string }[] })[]; cards: (Omit<SupportCard, "sources"> & { sources: { day: number; seg: number; span: string }[] })[]; questions: { id: string; text: string; origin: string }[] };

export type TrajectoryData = {
  events: TrajectoryEvent[];
  support: SupportCard[];
  ownershipSignals: SupportCard[];
  sequence: SupportCard[];
  sequenceFrame: { start: string; end: string; label: string };
  questions: SupportFile["questions"];
  settings: CareSetting[];
  sources: { day: number; witness: string; reviewed: boolean }[];
  sourceNotes: string[];
};

const medicalDir = () => path.join(process.cwd(), "content", "investigation", "medical");
const readJson = async <T,>(file: string) => JSON.parse(await fs.readFile(file, "utf8")) as T;
const transcripts = new Map<string, Turn[]>();

async function turnsFor(filename: string) {
  const cached = transcripts.get(filename);
  if (cached) return cached;
  const text = await fs.readFile(path.join(process.cwd(), "transcripts", "preserved", filename), "utf8");
  const turns = parseTranscriptTurns(text) as Turn[];
  transcripts.set(filename, turns);
  return turns;
}

const clip = (text: string) => (text.length > 900 ? `${text.slice(0, 897)}…` : text);

// A question and its answer are separate segments; show both so the quote makes sense on its own.
function exchangeAround(turns: Turn[], seg: number, witnessName: string): Evidence["exchange"] {
  const here = turns[seg];
  if (!here) return [];
  const isWitness = here.speaker.toLowerCase().includes(witnessName.toLowerCase().split(" ").at(-1) ?? "");
  const neighbor = isWitness ? turns[seg - 1] : turns[seg + 1];
  const pair = isWitness ? [neighbor, here] : [here, neighbor];
  return pair.filter((t): t is Turn => Boolean(t)).map((t) => ({ seg: t.segment_index, speaker: t.speaker, time: t.timestamp_display, text: clip(t.text) }));
}

export async function loadTrajectory(caseId: string): Promise<TrajectoryData> {
  const dir = medicalDir();
  const files = (await fs.readdir(path.join(dir, "assertions"))).filter((name) => name.endsWith(".assertions.json")).sort();
  const extractions = await Promise.all(files.map((name) => readJson<ExtractionFile>(path.join(dir, "assertions", name))));
  const [settingsFile, keys, support] = await Promise.all([
    readJson<{ settings: CareSetting[] }>(path.join(dir, "care-settings.json")),
    readJson<Record<string, string[]>>(path.join(dir, "medication-keys.json")),
    readJson<SupportFile>(path.join(dir, "support-context.json")),
  ]);
  const conflictFiles = (await fs.readdir(path.join(dir, "conflicts"))).filter((name) => name.endsWith("-combined.conflicts.json"));
  const conflicts = conflictFiles.length ? (await readJson<{ conflicts: RawConflict[] }>(path.join(dir, "conflicts", conflictFiles[0]!))).conflicts : [];

  const blocks = await listWitnessBlocks();
  const fileByDay = new Map(extractions.map((e) => [e.trial_day, e]));
  const turnsByDay = new Map<number, Turn[]>();
  for (const e of extractions) turnsByDay.set(e.trial_day, await turnsFor(e.source_file));

  const exchange = (day: number, seg: number) => exchangeAround(turnsByDay.get(day) ?? [], seg, fileByDay.get(day)?.witness ?? "");
  // Only testimony inside a first-pass witness block can be opened in the Witness view.
  const href = (day: number, seg: number, span: string) => {
    const block = blocks.find((b) => b.day === day && seg >= b.startIndex && seg <= b.endIndex);
    return block ? witnessHref(caseId, { day, block: block.blockId, find: span.slice(0, 80) }) : null;
  };

  const events = buildEvents(extractions.map((e) => ({ day: e.trial_day, assertions: e.assertions })), { settings: settingsFile.settings, keys, conflicts, exchange, href });
  const enrich = (card: SupportFile["cards"][number]): SupportCard => ({
    ...card,
    sources: card.sources.map((s) => ({ ...s, exchange: exchange(s.day, s.seg), href: href(s.day, s.seg, s.span) })),
  });
  const cards = support.cards.map(enrich);

  return {
    events,
    support: cards,
    ownershipSignals: support.signals.map(enrich),
    sequence: support.sequence.map(enrich),
    sequenceFrame: { start: support.sequenceFrame.start, end: support.sequenceFrame.end, label: support.sequenceFrame.label },
    questions: support.questions,
    settings: settingsFile.settings,
    sources: extractions.map((e) => ({ day: e.trial_day, witness: e.witness, reviewed: e.extractor.reviewed })),
    sourceNotes: extractions.flatMap((e) => (e.source_notes ?? []).map((note) => `Day ${e.trial_day}: ${note}`)),
  };
}
