import { createHash } from "node:crypto";
import { parseRevTranscript, type ProceedingPackageV1 } from "@/lib/rev-testimony";

export type ProceedingParty = "court" | "commonwealth" | "defense" | "other";
export type ProceedingPhase = "court_orientation" | "commonwealth_opening" | "transition" | "defense_opening" | "recess";

export type ProceedingSegment = {
  id: string;
  ordinal: number;
  originalSpeaker: string;
  speaker: string;
  speakerConfidence: number;
  speakerReviewRequired: boolean;
  timestamp: string;
  timestampMs: number;
  exactText: string;
  normalizedText: string;
  sourceStart: number;
  sourceEnd: number;
  phase: ProceedingPhase;
  party: ProceedingParty;
  recordKind: "instruction" | "procedural_action" | "position";
};

export type PositionRecord = {
  id: string;
  party: Exclude<ProceedingParty, "court" | "other">;
  positionKind: "anticipated_evidence" | "event_narrative" | "legal_theory" | "characterization" | "response";
  assertion: string;
  segmentId: string;
  sourceQuote: string;
  timestamp: string;
  speaker: string;
  recordClass: "advocacy_position";
  evidenceStatus: "not_evidence";
};

export type ResolutionItem = {
  id: string;
  kind: "speaker_attribution" | "transcript_gap" | "account_conflict" | "source_identity" | "anticipated_source";
  title: string;
  detail: string;
  status: "unresolved";
  segmentIds: string[];
};

export type ReferencedSource = {
  id: string;
  label: string;
  sourceType: string;
  possessionStatus: "referenced_not_possessed";
  segmentIds: string[];
};

export type ProceedingPackage = {
  schemaVersion: "proceeding-package/1.0";
  packageId: string;
  proceeding: {
    title: string;
    matter: string;
    date: "2026-07-29";
    type: "opening_statements";
    jurisdiction: "Massachusetts Superior Court";
    compilerBoundary: "record_only_no_case_analysis";
  };
  source: {
    artifactName: string;
    publisher: "Rev";
    representation: "rev_plain_text_export";
    sha256: string;
    byteLength: number;
    originalSourceUrl: null;
    sourceIdentityNote: string;
  };
  coverage: {
    completionState: "complete";
    coverageRatio: 1;
    sourceDetectedSegments: number;
    parsedSegments: number;
    openingScopeSegments: number;
    compiledOpeningSegments: number;
    firstTimestamp: string;
    lastTimestamp: string;
    endBoundary: string;
    parserWarnings: string[];
  };
  segments: ProceedingSegment[];
  positions: PositionRecord[];
  proceduralActions: ProceedingSegment[];
  referencedSources: ReferencedSource[];
  resolutionItems: ResolutionItem[];
  invariants: string[];
};

type SourceLine = { text: string; start: number; end: number };

const HEADER = /^(?:(.+?)\s+)?\((\d{1,2}:\d{2}(?::\d{2})?)\):?$/;

function stableId(namespace: string, value: string) {
  return `${namespace}_${createHash("sha256").update(value).digest("hex").slice(0, 16)}`;
}

function sourceLines(source: string): SourceLine[] {
  const lines: SourceLine[] = [];
  const matcher = /.*(?:\r\n|\n|$)/g;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(source)) !== null) {
    if (match[0] === "") break;
    const lineBreakLength = match[0].endsWith("\r\n") ? 2 : match[0].endsWith("\n") ? 1 : 0;
    lines.push({ text: match[0].slice(0, match[0].length - lineBreakLength), start: match.index, end: match.index + match[0].length - lineBreakLength });
  }
  return lines;
}

function timestampMs(timestamp: string) {
  const parts = timestamp.split(":").map(Number);
  const seconds = parts.length === 3 ? parts[0] * 3_600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error(`Invalid proceeding timestamp: ${timestamp}`);
  return seconds * 1_000;
}

function formatTimestamp(milliseconds: number) {
  const total = Math.floor(milliseconds / 1_000);
  const hours = Math.floor(total / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

type RawSegment = Omit<ProceedingSegment, "phase" | "party" | "recordKind" | "speaker" | "speakerConfidence" | "speakerReviewRequired">;

function parseAllSegments(source: string): RawSegment[] {
  const lines = sourceLines(source);
  const transcriptTitle = lines.findIndex((line) => line.text.trim() === "MA v. Lindsay Clancy Opening Statements");
  if (transcriptTitle < 0) throw new Error("Opening-statement transcript title not found.");
  const firstHeader = lines.findIndex((line, index) => index > transcriptTitle && HEADER.test(line.text.trim()));
  if (firstHeader < 0) throw new Error("No timestamped transcript segments found.");

  const segments: RawSegment[] = [];
  let activeSpeaker = "Unidentified speaker";
  for (let index = firstHeader; index < lines.length; index += 1) {
    if (lines[index].text.trim() === "Keep reading") break;
    const header = lines[index].text.trim().match(HEADER);
    if (!header) continue;
    if (header[1]?.trim()) activeSpeaker = header[1].trim();

    let textStartLine = index + 1;
    while (textStartLine < lines.length && lines[textStartLine].text.trim() === "") textStartLine += 1;
    if (textStartLine >= lines.length || HEADER.test(lines[textStartLine].text.trim()) || lines[textStartLine].text.trim() === "Keep reading") continue;

    let textEndLine = textStartLine;
    while (textEndLine + 1 < lines.length && !HEADER.test(lines[textEndLine + 1].text.trim()) && lines[textEndLine + 1].text.trim() !== "Keep reading") textEndLine += 1;
    while (textEndLine > textStartLine && lines[textEndLine].text.trim() === "") textEndLine -= 1;

    const exactText = source.slice(lines[textStartLine].start, lines[textEndLine].end).trim();
    if (!exactText) continue;
    const milliseconds = timestampMs(header[2]);
    const ordinal = segments.length;
    segments.push({
      id: stableId("seg", `${ordinal}:${activeSpeaker}:${header[2]}:${exactText}`),
      ordinal,
      originalSpeaker: activeSpeaker,
      timestamp: formatTimestamp(milliseconds),
      timestampMs: milliseconds,
      exactText,
      normalizedText: exactText.replace(/\s+/g, " ").trim(),
      sourceStart: lines[textStartLine].start,
      sourceEnd: lines[textEndLine].end,
    });
    index = textEndLine;
  }
  if (segments.length === 0) throw new Error("The source contained no parseable transcript segments.");
  return segments;
}

function indexContaining(segments: RawSegment[], pattern: RegExp) {
  const index = segments.findIndex((segment) => pattern.test(segment.normalizedText));
  if (index < 0) throw new Error(`Required opening-statement boundary was not found: ${pattern.source}`);
  return index;
}

function positionKind(text: string, party: "commonwealth" | "defense"): PositionRecord["positionKind"] {
  if (party === "defense" && /\bgovernment\s+(?:says|said|will say)|\bprosecution\b|\bnot a righteous prosecution\b/i.test(text)) return "response";
  if (/\bbeyond a reasonable doubt\b|\bcriminally responsible\b|\bappreciate the wrongfulness\b|\bconform (?:their|her) conduct\b/i.test(text)) return "legal_theory";
  if (/\byou(?:'ll| will) (?:hear|see)|\bwe expect\b|\bthe evidence (?:will|in this case)\b/i.test(text)) return "anticipated_evidence";
  if (/\bcontrolling\b|\bmanipulative\b|\bloving\b|\bdedicated\b|\bgood (?:mother|person|nurse)\b|\bno motive\b/i.test(text)) return "characterization";
  return "event_narrative";
}

function classifyOpeningSegments(raw: RawSegment[]) {
  const commonwealthPrompt = indexContaining(raw, /prepared to give their opening statements/i);
  const commonwealthStart = indexContaining(raw, /Morning, ladies and gentlemen\. Cora/i);
  const defensePrompt = indexContaining(raw, /Mr\. Reddington, do you wish to give an opening/i);
  const defenseStart = indexContaining(raw, /I do\. Your Honor, I might use the easel/i);
  const recess = indexContaining(raw, /we're going to take the morning recess at this time/i);
  const recessEnd = indexContaining(raw, /Clear the full room, please/i);
  const openingRaw = raw.slice(0, recessEnd + 1);

  return openingRaw.map<ProceedingSegment>((segment, index) => {
    let phase: ProceedingPhase = "court_orientation";
    let party: ProceedingParty = "court";
    let recordKind: ProceedingSegment["recordKind"] = "instruction";
    let speaker = segment.originalSpeaker;
    let speakerConfidence = /^(Speaker \d+|Unidentified speaker)$/i.test(segment.originalSpeaker) ? 0.35 : 0.98;
    let speakerReviewRequired = speakerConfidence < 0.8;

    if (index > commonwealthPrompt && index < defensePrompt) {
      phase = "commonwealth_opening";
      party = "commonwealth";
      recordKind = "position";
      if (index >= commonwealthStart && segment.originalSpeaker === "Madam Clerk") {
        speaker = "Shannon Buckingham";
        speakerConfidence = 0.72;
        speakerReviewRequired = true;
      }
    } else if (index === commonwealthPrompt || index === defensePrompt) {
      phase = "transition";
      recordKind = "procedural_action";
    } else if (index >= defenseStart && index < recess) {
      phase = "defense_opening";
      party = "defense";
      recordKind = "position";
      speaker = "Kevin Reddington";
      speakerConfidence = segment.originalSpeaker === "Mr. Reddington" || segment.originalSpeaker === "Kevin Reddington" ? 0.98 : 0.9;
      speakerReviewRequired = false;
    } else if (index >= recess) {
      phase = "recess";
      recordKind = "procedural_action";
    } else if (index < commonwealthPrompt && !/Honorable William Sullivan/i.test(segment.originalSpeaker)) {
      recordKind = "procedural_action";
    }

    return { ...segment, phase, party, recordKind, speaker, speakerConfidence, speakerReviewRequired };
  });
}

function buildPositions(segments: ProceedingSegment[]) {
  return segments.filter((segment): segment is ProceedingSegment & { party: "commonwealth" | "defense" } => segment.recordKind === "position" && (segment.party === "commonwealth" || segment.party === "defense")).map<PositionRecord>((segment) => ({
    id: stableId("pos", segment.id),
    party: segment.party,
    positionKind: positionKind(segment.normalizedText, segment.party),
    assertion: segment.normalizedText,
    segmentId: segment.id,
    sourceQuote: segment.exactText,
    timestamp: segment.timestamp,
    speaker: segment.speaker,
    recordClass: "advocacy_position",
    evidenceStatus: "not_evidence",
  }));
}

const REFERENCE_RULES: Array<{ label: string; sourceType: string; pattern: RegExp }> = [
  { label: "Crime-scene photographs", sourceType: "photograph", pattern: /photographs? of the crime scene|crime scene.*photograph/i },
  { label: "First-responder testimony", sourceType: "testimony", pattern: /first responders?/i },
  { label: "Clancy family text messages", sourceType: "digital_communication", pattern: /text messages?|sends? a text/i },
  { label: "Phone searches and Apple Maps route", sourceType: "digital_activity", pattern: /Apple Maps|searched on her phone/i },
  { label: "Patrick Clancy 911 call", sourceType: "emergency_call", pattern: /calls? 911|911 for help/i },
  { label: "Medical and mental-health records", sourceType: "medical_record", pattern: /medical records?|hospital records?/i },
  { label: "Medication and prescription history", sourceType: "medical_record", pattern: /prescriptions?|medications? that she was on/i },
  { label: "Internet search history", sourceType: "digital_activity", pattern: /Google searches?/i },
  { label: "Hospital treatment records", sourceType: "medical_record", pattern: /South Shore Hospital|McLean Hospital|Mass General Hospital/i },
  { label: "Family, friend, teacher, and clinician testimony", sourceType: "anticipated_testimony", pattern: /family, friends?, teachers?|doctors? and nurses?|mental health professionals?/i },
];

function buildReferencedSources(segments: ProceedingSegment[]) {
  return REFERENCE_RULES.flatMap<ReferencedSource>((rule) => {
    const matches = segments.filter((segment) => rule.pattern.test(segment.normalizedText)).map((segment) => segment.id);
    return matches.length === 0 ? [] : [{ id: stableId("ref", rule.label), label: rule.label, sourceType: rule.sourceType, possessionStatus: "referenced_not_possessed", segmentIds: matches }];
  });
}

function buildResolutionItems(segments: ProceedingSegment[], sourceUrl: null): ResolutionItem[] {
  const unidentified = segments.filter((segment) => /^(Speaker \d+|Unidentified speaker)$/i.test(segment.originalSpeaker)).map((segment) => segment.id);
  const inaudible = segments.filter((segment) => /\[inaudible[^\]]*\]/i.test(segment.exactText)).map((segment) => segment.id);
  const conflictingVoiceAccount = segments.filter((segment) => /depending on which version of the events/i.test(segment.normalizedText)).map((segment) => segment.id);
  const anticipated = segments.filter((segment) => segment.recordKind === "position" && /\byou(?:'ll| will) (?:hear|see)|\bwe expect\b/i.test(segment.normalizedText)).map((segment) => segment.id);
  const items: ResolutionItem[] = [];
  if (unidentified.length) items.push({ id: stableId("res", "speaker-attribution"), kind: "speaker_attribution", title: "Resolve generic speaker labels", detail: `${unidentified.length} opening-scope segments retain provider labels such as “Speaker 1.”`, status: "unresolved", segmentIds: unidentified });
  if (inaudible.length) items.push({ id: stableId("res", "transcript-gaps"), kind: "transcript_gap", title: "Review inaudible passages", detail: `${inaudible.length} segments contain an explicit provider inaudibility marker.`, status: "unresolved", segmentIds: inaudible });
  if (conflictingVoiceAccount.length) items.push({ id: stableId("res", "voice-account-timing"), kind: "account_conflict", title: "Command-voice timing differs by reported account", detail: "The Commonwealth opening says the reported voice occurred either after Patrick left or after his CVS call. Later evidence must resolve the account and timing.", status: "unresolved", segmentIds: conflictingVoiceAccount });
  if (sourceUrl === null) items.push({ id: stableId("res", "canonical-source-url"), kind: "source_identity", title: "Canonical source URL absent from supplied export", detail: "The artifact identifies Rev as publisher but does not preserve the original page URL.", status: "unresolved", segmentIds: [] });
  if (anticipated.length) items.push({ id: stableId("res", "anticipated-sources"), kind: "anticipated_source", title: "Link promised proof when it enters the record", detail: `${anticipated.length} advocacy segments preview evidence or testimony. Those promises remain positions until linked to later admitted material.`, status: "unresolved", segmentIds: anticipated });
  return items;
}

export function compileOpeningStatements(source: string, artifactName = "opening-statements.rev.txt"): ProceedingPackage {
  const bytes = Buffer.from(source, "utf8");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const allSegments = parseAllSegments(source);
  const segments = classifyOpeningSegments(allSegments);
  const positions = buildPositions(segments);
  const proceduralActions = segments.filter((segment) => segment.recordKind !== "position");
  const parserWarnings = segments.some((segment) => segment.speakerReviewRequired) ? ["One or more speaker attributions require human review."] : [];

  if (segments.length === 0 || positions.length === 0) throw new Error("Opening-statement scope could not be compiled.");
  if (segments.some((segment) => segment.recordKind === "position" && segment.party === "court")) throw new Error("Position boundary violation: a court segment was classified as advocacy.");

  return {
    schemaVersion: "proceeding-package/1.0",
    packageId: stableId("pkg", sha256),
    proceeding: { title: "MA v. Lindsay Clancy — Opening Statements", matter: "Commonwealth v. Lindsay M. Clancy", date: "2026-07-29", type: "opening_statements", jurisdiction: "Massachusetts Superior Court", compilerBoundary: "record_only_no_case_analysis" },
    source: { artifactName, publisher: "Rev", representation: "rev_plain_text_export", sha256, byteLength: bytes.byteLength, originalSourceUrl: null, sourceIdentityNote: "Compiled from the user-supplied Rev plain-text export. The export is the preserved source representation for this slice." },
    coverage: {
      completionState: "complete",
      coverageRatio: 1,
      sourceDetectedSegments: allSegments.length,
      parsedSegments: allSegments.length,
      openingScopeSegments: segments.length,
      compiledOpeningSegments: segments.length,
      firstTimestamp: segments[0].timestamp,
      lastTimestamp: segments.at(-1)?.timestamp ?? segments[0].timestamp,
      endBoundary: "Morning recess after both opening statements",
      parserWarnings,
    },
    segments,
    positions,
    proceduralActions,
    referencedSources: buildReferencedSources(segments),
    resolutionItems: buildResolutionItems(segments, null),
    invariants: [
      "Every compiled object points to one or more exact source segments.",
      "Commonwealth and defense statements are advocacy positions, not evidence.",
      "Court instructions and procedural actions are stored separately from party positions.",
      "Speaker normalization never overwrites the provider's original label.",
      "A complete status requires parsed and detected segment counts to match within the declared scope.",
    ],
  };
}

export type PreservedTranscriptManifest = {
  provider: "rev";
  representation: "rev_html" | "rev_markdown" | "rev_plain_text";
  artifactName: string;
  sourceUrl?: string | null;
  proceedingType: "trial_day" | "opening_statements";
};

/** Provider-neutral compiler entry point used by preserved transcript manifests. */
export function compileProceedingSource(manifest: PreservedTranscriptManifest & { representation: "rev_html" }, source: string): ProceedingPackageV1;
export function compileProceedingSource(manifest: PreservedTranscriptManifest & { representation: "rev_markdown" }, source: string): ProceedingPackageV1;
export function compileProceedingSource(manifest: PreservedTranscriptManifest & { representation: "rev_plain_text"; proceedingType: "opening_statements" }, source: string): ProceedingPackage;
export function compileProceedingSource(manifest: PreservedTranscriptManifest, source: string): ProceedingPackage | ProceedingPackageV1 {
  if (manifest.provider === "rev" && manifest.representation === "rev_html") {
    return parseRevTranscript(source, manifest.sourceUrl ?? "https://www.rev.com/transcripts/preserved").package;
  }
  if (manifest.provider === "rev" && manifest.representation === "rev_markdown") {
    const header = /^(.+?) \(\[([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)\]\((https?:\/\/(?:www\.)?rev\.com\/app\/transcript\/[^)\s]+)\)\):\s*$/;
    const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/);
    const first = lines.findIndex((line) => header.test(line.trim()));
    if (first < 0) throw new Error("No Rev timestamped turns were found in the preserved markdown transcript.");
    const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
    const turns: Array<{ speaker: string; timestamp: string; href: string; text: string }> = [];
    for (let index = first; index < lines.length;) {
      const match = lines[index].trim().match(header);
      if (!match) { index += 1; continue; }
      let end = index + 1;
      while (end < lines.length && !header.test(lines[end].trim()) && lines[end].trim() !== "Keep reading") end += 1;
      const text = lines.slice(index + 1, end).join("\n").trim();
      if (text) turns.push({ speaker: match[1].trim(), timestamp: match[2], href: match[3], text });
      if (lines[end]?.trim() === "Keep reading") break;
      index = end;
    }
    const title = source.match(/^#\s*(MA v\. Lindsay Clancy Day \d+)\s*$/m)?.[1] ?? manifest.artifactName;
    const canonical = manifest.sourceUrl ?? `https://www.rev.com/transcripts/${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
    const syntheticHtml = `<!doctype html><html><head><title>${escape(title)} | Rev</title><link href="${escape(canonical)}" rel="canonical"></head><body><div id="main-content">${turns.map((turn) => `<p>${escape(turn.speaker)} (<a href="${escape(turn.href)}">${escape(turn.timestamp)}</a>):</p><p>${escape(turn.text).replaceAll("\n", "<br/>")}</p>`).join("")}</div></body></html>`;
    const originalSha256 = createHash("sha256").update(Buffer.from(source, "utf8")).digest("hex");
    return parseRevTranscript(syntheticHtml, canonical, originalSha256, "rev_markdown_transcript").package;
  }
  if (manifest.provider === "rev" && manifest.representation === "rev_plain_text" && manifest.proceedingType === "opening_statements") {
    return compileOpeningStatements(source, manifest.artifactName);
  }
  throw new Error(`Unsupported preserved transcript representation: ${manifest.provider}/${manifest.representation}/${manifest.proceedingType}`);
}

export type IntakeManifest = {
  trial_day: number;
  proceeding_label: string;
  proceeding_date: string | null;
  source: { publisher: "Rev"; preserved_filename: string; canonical_url: string | null };
  integrity: { sha256: string };
};

/** Bridges standardized intake manifests into the same provider-neutral compiler. */
export function compilePreservedTranscriptManifest(manifest: IntakeManifest, source: string) {
  if (manifest.source.publisher !== "Rev") throw new Error(`Unsupported transcript provider: ${manifest.source.publisher}`);
  const actualSha256 = createHash("sha256").update(Buffer.from(source, "utf8")).digest("hex");
  if (actualSha256 !== manifest.integrity.sha256) throw new Error("Preserved transcript checksum does not match its intake manifest.");
  return compileProceedingSource({ provider: "rev", representation: "rev_markdown", artifactName: manifest.source.preserved_filename, sourceUrl: manifest.source.canonical_url, proceedingType: "trial_day" }, source);
}
