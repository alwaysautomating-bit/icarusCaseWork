import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { parseTranscriptTurns } from "../../scripts/transcript-first-pass-lib.mjs";

export type WitnessBlockRef = {
  day: number;
  blockId: string;
  witness: string;
  startDisplay: string;
  endDisplay: string;
  startIndex: number;
  endIndex: number;
  oath: boolean;
  excusal: boolean;
  confidence: number;
  revUrl: string | null;
  preservedFilename: string;
  firstPassFilename: string;
};

export type TranscriptTurn = {
  segment_index: number;
  source_line: number;
  speaker: string;
  timestamp_display: string;
  timestamp_seconds: number | null;
  url: string | null;
  text: string;
};

const root = () => path.join(process.cwd(), "transcripts");
const FIRST_PASS_PATTERN = /^Lindsay-Clancy_Trial-Day-(\d{2})_Testimony-First-Pass\.json$/;

type FirstPassFile = {
  source: { preserved_filename: string; sha256: string };
  witness_blocks: Array<{
    block_id: string;
    witness_name_candidate: string;
    start: { segment_index: number; timestamp_display: string; url: string | null };
    end: { segment_index: number; timestamp_display: string };
    oath_detected: boolean;
    excusal_detected: boolean;
    boundary_confidence: number;
  }>;
};

export async function listWitnessBlocks(): Promise<WitnessBlockRef[]> {
  const directory = path.join(root(), "first-pass");
  const files = (await fs.readdir(directory).catch(() => [])).filter((name) => FIRST_PASS_PATTERN.test(name)).sort();
  const perFile = await Promise.all(files.map(async (name) => {
    const day = Number(FIRST_PASS_PATTERN.exec(name)![1]);
    const data = JSON.parse(await fs.readFile(path.join(directory, name), "utf8")) as FirstPassFile;
    return data.witness_blocks.map<WitnessBlockRef>((block) => ({
      day,
      blockId: block.block_id,
      witness: block.witness_name_candidate,
      startDisplay: block.start.timestamp_display,
      endDisplay: block.end.timestamp_display,
      startIndex: block.start.segment_index,
      endIndex: block.end.segment_index,
      oath: block.oath_detected,
      excusal: block.excusal_detected,
      confidence: block.boundary_confidence,
      revUrl: block.start.url,
      preservedFilename: data.source.preserved_filename,
      firstPassFilename: name,
    }));
  }));
  return perFile.flat();
}

export async function getWitnessTestimony(day: number, blockId: string) {
  if (!Number.isInteger(day) || !/^witness_\d{3}$/.test(blockId)) return null;
  const blocks = await listWitnessBlocks();
  const block = blocks.find((item) => item.day === day && item.blockId === blockId);
  if (!block) return null;
  const sourcePath = path.join(root(), "preserved", block.preservedFilename);
  const text = await fs.readFile(sourcePath, "utf8").catch(() => null);
  if (text === null) return null;
  const turns = parseTranscriptTurns(text) as TranscriptTurn[];
  return { block, turns: turns.slice(block.startIndex, block.endIndex + 1), sourceBytes: Buffer.byteLength(text) };
}

export async function readDayFile(kind: "source" | "first-pass", block: WitnessBlockRef) {
  const file = kind === "source" ? path.join(root(), "preserved", block.preservedFilename) : path.join(root(), "first-pass", block.firstPassFilename);
  const bytes = await fs.readFile(file).catch(() => null);
  return bytes ? { bytes, filename: kind === "source" ? block.preservedFilename : block.firstPassFilename } : null;
}

export function witnessPlainText(block: WitnessBlockRef, turns: TranscriptTurn[]) {
  const title = `${block.witness} — Trial Day ${block.day}, ${block.startDisplay} to ${block.endDisplay}`;
  const lines = turns.map((turn) => `[${turn.timestamp_display}] ${turn.speaker}: ${turn.text}`);
  const notes = [
    "Witness boundaries are deterministic candidates from the intake compiler and need review.",
    "Timestamps are transcript media positions, not event times.",
    `Source: ${block.preservedFilename}`,
  ];
  return `${title}\n${"=".repeat(Math.min(title.length, 72))}\n${notes.map((note) => `(${note})`).join("\n")}\n\n${lines.join("\n\n")}\n`;
}

export function witnessSlug(block: WitnessBlockRef) {
  const name = block.witness.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `day-${String(block.day).padStart(2, "0")}-${name || block.blockId}`;
}

export function matchesWitness(block: WitnessBlockRef, query: string) {
  const needle = query.toLowerCase().trim();
  return needle.length > 0 && block.witness.toLowerCase().includes(needle);
}
