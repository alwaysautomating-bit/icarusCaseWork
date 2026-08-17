import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const FIRST_PASS_COMPILER_NAME = "icarus-testimony-first-pass";
export const FIRST_PASS_COMPILER_VERSION = "0.2.0";

const speakerMarkdownPattern = /^(?<speaker>.+?) \(\[(?<display>\d{1,2}:\d{2}(?::\d{2})?)\]\((?<url>https?:\/\/[^)]+)\)\):\s*$/;
const speakerTextPattern = /^(?<speaker>.+?) \((?<display>\d{1,2}:\d{2}(?::\d{2})?)\):\s*$/;
const timestampQueryPattern = /[?&]ts=(?<seconds>\d+(?:\.\d+)?)/;
const callPatterns = [
  /\b(?:the\s+)?commonwealth\s+(?:(?:would|will)\s+)?calls?\s+(?<name>(?:(?:Dr|Officer|Sergeant|Trooper|Detective|Chief|Captain|Lieutenant)\.?(?:\s+|$))?[A-Z][A-Za-z’'\-]+(?:\s+[A-Z][A-Za-z.’'\-]+){0,5})/i,
  /\b(?:the\s+)?defen[cs]e\s+(?:(?:would|will)\s+)?calls?\s+(?<name>(?:(?:Dr|Officer|Sergeant|Trooper|Detective|Chief|Captain|Lieutenant)\.?(?:\s+|$))?[A-Z][A-Za-z’'\-]+(?:\s+[A-Z][A-Za-z.’'\-]+){0,5})/i,
];
const oathPattern = /\b(?:solemnly\s+swear|raise\s+your\s+right\s+hand)\b/i;
const excusalPattern = /\b(?:you\s+may\s+step\s+down|witness\s+may\s+step\s+down|thank\s+you.*step\s+down)\b/i;
const proceduralRules = [
  ["objection", /\bobjection\b|\bobjecting\b/i], ["sustained", /\bsustained\b/i],
  ["overruled", /\boverruled\b/i], ["sidebar", /\bsidebar\b|\bapproach(?:\s+the\s+bench)?\b/i],
  ["voir_dire", /\bvoir\s+dire\b/i],
  ["jury_out", /\bjury(?:'s|\s+is)?\s+(?:out|outside|excused)|\bjurors?.*go\s+back\s+to\s+the\s+jury\s+room\b/i],
  ["jury_in", /\bjury(?:'s|\s+is)?\s+(?:back|present)|\bjurors?.*return\b|\b18\s+jurors\b/i],
  ["recess", /\brecess\b|\bbreak\b/i],
  ["witness_called", /\b(?:commonwealth|defen[cs]e).*\bcalls?\b.*\bwitness\b|\b(?:commonwealth|defen[cs]e)\s+(?:would\s+)?calls?\b/i],
  ["oath", oathPattern], ["witness_excused", excusalPattern],
  ["direct_explicit", /\bdirect examination\b/i],
  ["cross_explicit", /\bcross[- ]examination\b|\bcross\b.*\b(?:resume|return)\b/i],
  ["redirect_explicit", /\bredirect\b/i], ["recross_explicit", /\brecross\b|\bre-cross\b/i],
  ["exhibit", /\bexhibit\b|\bmarked\s+for\s+identification\b/i],
  ["admitted", /\badmitted\b|\breceived\s+in\s+evidence\b/i],
  ["stricken", /\bstrike\b|\bstricken\b|\bstruck\b/i],
];

const locatorSchema = z.object({
  segment_index: z.number().int().nonnegative(), source_line: z.number().int().positive(),
  timestamp_display: z.string().regex(/^\d{1,2}:\d{2}(?::\d{2})?$/),
  timestamp_seconds: z.number().nonnegative().nullable(), url: z.string().url().nullable(),
}).strict();
const blockSchema = z.object({
  block_id: z.string().regex(/^witness_\d{3}$/), witness_name_candidate: z.string().min(1),
  start: locatorSchema, end: locatorSchema, oath_detected: z.boolean(), excusal_detected: z.boolean(),
  boundary_confidence: z.number().min(0).max(1),
}).strict();
export const firstPassSchema = z.object({
  schema_version: z.literal("1.0"), classification: z.literal("candidate_structure_only"),
  source: z.object({ preserved_filename: z.string().min(1), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  compiler: z.object({ name: z.literal(FIRST_PASS_COMPILER_NAME), version: z.literal(FIRST_PASS_COMPILER_VERSION) }).strict(),
  counts: z.object({ segments: z.number().int(), witness_blocks: z.number().int(), phase_sets: z.number().int(), procedural_markers: z.number().int() }).strict(),
  witness_blocks: z.array(blockSchema),
  phase_sets: z.array(z.object({
    block_id: z.string(), witness_name_candidate: z.string(), examiner_candidates: z.array(z.string()),
    phases: z.array(z.object({ phase: z.enum(["setup", "direct", "cross", "redirect", "recross", "voir_dire"]), jury_present: z.boolean(), start: locatorSchema, end: locatorSchema }).strict()),
  }).strict()),
  procedural_markers: z.array(z.object({ locator: locatorSchema, speaker: z.string(), text: z.string(), event_types: z.array(z.string()).min(1) }).strict()),
  limitations: z.array(z.string()).min(1),
}).strict();

export const FIRST_PASS_LIMITATIONS = Object.freeze([
  "Witness names, boundaries, examination phases, jury state, and procedural markers are deterministic candidates requiring review.",
  "Boundary confidence measures cue coverage only; it does not measure truth, accuracy, credibility, or evidentiary weight.",
  "A witness block may include court procedure before testimony begins or after testimony ends.",
  "Transcript timestamps are source-media locators and are not automatically event times.",
  "No extracted statement is promoted to a verified fact, event, proposition, or database record.",
]);

function displayToSeconds(display) {
  const parts = display.split(":").map(Number);
  return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0] * 3600 + parts[1] * 60 + parts[2];
}
function locator(segment) {
  const { segment_index, source_line, timestamp_display, timestamp_seconds, url } = segment;
  return { segment_index, source_line, timestamp_display, timestamp_seconds, url };
}

export function parseTranscriptTurns(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const segments = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    const match = speakerMarkdownPattern.exec(line) ?? speakerTextPattern.exec(line);
    if (!match?.groups) { index += 1; continue; }
    const { speaker, display } = match.groups;
    const url = match.groups.url ?? null;
    const secondsMatch = url ? timestampQueryPattern.exec(url) : null;
    const timestampSeconds = secondsMatch?.groups?.seconds ? Number(secondsMatch.groups.seconds) : displayToSeconds(display);
    let next = index + 1;
    const textLines = [];
    while (next < lines.length) {
      const nextLine = lines[next].trim();
      if (speakerMarkdownPattern.test(nextLine) || speakerTextPattern.test(nextLine)) break;
      if (nextLine) textLines.push(nextLine);
      next += 1;
    }
    segments.push({ segment_index: segments.length, source_line: index + 1, speaker: speaker.trim(),
      timestamp_display: display, timestamp_seconds: timestampSeconds, url, text: textLines.join(" ").trim() });
    index = next;
  }
  return segments;
}

function calledName(text) {
  for (const pattern of callPatterns) {
    const match = pattern.exec(text);
    if (match?.groups?.name) return match.groups.name
      .replace(/[ .,:;-]+$/, "")
      .replace(/\s+as\s+(?:(?:its|the)\s+)?next\s+witness$/i, "")
      .replace(/\s+(?:please|as)$/i, "")
      .replace(/\.\s+(?:Good|Thank|Your|Do|Please)$/, "");
  }
  return null;
}

export function detectWitnessBlocks(segments) {
  const starts = [];
  for (let index = 0; index < segments.length; index += 1) {
    const name = calledName(segments[index].text);
    if (!name) continue;
    const previous = starts.at(-1);
    if (previous?.name.toLowerCase() === name.toLowerCase()) {
      const elapsed = segments[index].timestamp_seconds - segments[previous.index].timestamp_seconds;
      const oathBefore = segments.slice(previous.index, index).some((item) => oathPattern.test(item.text));
      if (elapsed <= 180 && !oathBefore) continue;
    }
    starts.push({ index, name });
  }
  return starts.map((start, blockIndex) => {
    const endIndex = starts[blockIndex + 1]?.index - 1 || segments.length - 1;
    const oathHits = segments.slice(start.index, Math.min(endIndex + 1, start.index + 15)).filter((item) => oathPattern.test(item.text)).length;
    const excusalHits = segments.slice(Math.max(start.index, endIndex - 15), endIndex + 1).filter((item) => excusalPattern.test(item.text)).length;
    const confidence = Math.min(0.99, 0.72 + Math.min(0.16, 0.08 * oathHits) + Math.min(0.1, 0.05 * excusalHits));
    return { block_id: `witness_${String(blockIndex + 1).padStart(3, "0")}`, witness_name_candidate: start.name,
      start: locator(segments[start.index]), end: locator(segments[endIndex]), oath_detected: oathHits > 0,
      excusal_detected: excusalHits > 0, boundary_confidence: Number(confidence.toFixed(2)) };
  });
}

function speakerMatches(speaker, witness) {
  const left = speaker.toLowerCase().replace(/[^a-z0-9 ]/g, "");
  const right = witness.toLowerCase().replace(/[^a-z0-9 ]/g, "");
  return left === right || (right.length > 5 && left.includes(right)) || (left.length > 5 && right.includes(left));
}
function findExaminers(segments, start, end, witness) {
  const ignored = ["judge", "clerk", "madam clerk", "speaker ", "court", "juror", "jury", "bailiff"];
  const stats = new Map();
  for (let index = start; index <= end; index += 1) {
    const segment = segments[index];
    if (speakerMatches(segment.speaker, witness) || ignored.some((prefix) => segment.speaker.toLowerCase().startsWith(prefix))) continue;
    const value = stats.get(segment.speaker) ?? { first: index, count: 0, questions: 0 };
    value.count += 1; value.questions += segment.text.includes("?") ? 1 : 0; stats.set(segment.speaker, value);
  }
  return [...stats.entries()].filter(([speaker, value]) => value.count >= 3 && (value.questions / value.count >= 0.3 || /attorney|mr\.|ms\.|mrs\.|commonwealth|defense|prosecutor/i.test(speaker)))
    .sort((a, b) => a[1].first - b[1].first).map(([speaker]) => speaker);
}

export function classifyPhases(segments, blocks) {
  return blocks.map((block) => {
    const start = block.start.segment_index; const end = block.end.segment_index;
    const examiners = findExaminers(segments, start, end, block.witness_name_candidate);
    const directExaminer = examiners[0]; const crossExaminer = examiners[1];
    let phase = "setup"; let juryPresent = true; let sawCross = false; let sawRedirect = false;
    const labels = [];
    for (let index = start; index <= end; index += 1) {
      const segment = segments[index];
      if (/jury.*(?:out|excused|jury room)/i.test(segment.text)) juryPresent = false;
      if (/jury.*(?:back|present)|18\s+jurors/i.test(segment.text)) juryPresent = true;
      if (/\bvoir\s+dire\b/i.test(segment.text)) phase = "voir_dire";
      else if (/\brecross\b|\bre-cross\b/i.test(segment.text)) { phase = "recross"; sawRedirect = true; }
      else if (/\bredirect\b/i.test(segment.text)) { phase = "redirect"; sawRedirect = true; }
      else if (/\bcross[- ]examination\b/i.test(segment.text)) { phase = "cross"; sawCross = true; }
      else if (/\bdirect examination\b/i.test(segment.text)) phase = "direct";
      if (phase !== "voir_dire" && directExaminer && segment.speaker === directExaminer) { phase = sawCross ? "redirect" : "direct"; if (sawCross) sawRedirect = true; }
      else if (phase !== "voir_dire" && crossExaminer && segment.speaker === crossExaminer) { phase = sawRedirect ? "recross" : "cross"; sawCross = true; }
      labels.push({ index, phase, juryPresent });
    }
    const phases = [];
    for (const label of labels) {
      const current = phases.at(-1);
      if (!current || current.phase !== label.phase || current.jury_present !== label.juryPresent) phases.push({ phase: label.phase, jury_present: label.juryPresent, start: locator(segments[label.index]), end: locator(segments[label.index]) });
      else current.end = locator(segments[label.index]);
    }
    return { block_id: block.block_id, witness_name_candidate: block.witness_name_candidate, examiner_candidates: examiners, phases };
  });
}

export function extractProceduralMarkers(segments) {
  return segments.flatMap((segment) => {
    const eventTypes = proceduralRules.filter(([, pattern]) => pattern.test(segment.text)).map(([type]) => type);
    return eventTypes.length ? [{ locator: locator(segment), speaker: segment.speaker, text: segment.text, event_types: eventTypes }] : [];
  });
}

export function buildFirstPass({ text, preservedFilename, sourceSha256 }) {
  const segments = parseTranscriptTurns(text); const witnessBlocks = detectWitnessBlocks(segments);
  const phaseSets = classifyPhases(segments, witnessBlocks); const proceduralMarkers = extractProceduralMarkers(segments);
  return firstPassSchema.parse({ schema_version: "1.0", classification: "candidate_structure_only",
    source: { preserved_filename: preservedFilename, sha256: sourceSha256 },
    compiler: { name: FIRST_PASS_COMPILER_NAME, version: FIRST_PASS_COMPILER_VERSION },
    counts: { segments: segments.length, witness_blocks: witnessBlocks.length, phase_sets: phaseSets.length, procedural_markers: proceduralMarkers.length },
    witness_blocks: witnessBlocks, phase_sets: phaseSets, procedural_markers: proceduralMarkers, limitations: [...FIRST_PASS_LIMITATIONS] });
}

export async function writeFirstPass({ preservedPath, outputPath, sourceSha256 }) {
  const output = buildFirstPass({ text: await readFile(preservedPath, "utf8"), preservedFilename: path.basename(preservedPath), sourceSha256 });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  return output;
}
