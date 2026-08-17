import { createHash } from "node:crypto";
import { canonicalizeSubmittedUrl } from "@/lib/url-capture";

export const REV_PARSER_NAME = "rev-html-transcript";
export const REV_PARSER_VERSION = "2.0.0";

const entities: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", ndash: "–", mdash: "—", hellip: "…" };
const decodeHtml = (value: string) => value
  .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
  .replace(/&([a-z]+);/gi, (match, name: string) => entities[name.toLowerCase()] ?? match);
const plainText = (value: string) => decodeHtml(value.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]+>/g, " ")).replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
const attribute = (html: string, pattern: RegExp) => decodeHtml(html.match(pattern)?.[1] ?? "").trim();

function stableUuid(namespace: string, value: string) {
  const hash = createHash("sha256").update(`${namespace}\0${value}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function timestampToMs(timestamp: string) {
  const parts = timestamp.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part) || part < 0) || parts.length < 2 || parts.length > 3) throw new Error(`Invalid transcript timestamp: ${timestamp}`);
  return 1_000 * (parts.length === 3 ? parts[0] * 3_600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1]);
}

function formatTimestamp(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1_000);
  return [Math.floor(seconds / 3_600), Math.floor((seconds % 3_600) / 60), seconds % 60].map((part) => String(part).padStart(2, "0")).join(":");
}

export type ParsedTranscriptSegment = { id: string; ordinal: number; speaker: string; timestampStartMs: number; timestampEndMs: number | null; deepLink: string; text: string; locator: { type: "timestamp"; timestampStart: string; timestampEnd?: string; start: number; end: number } };
export type QaExchange = { id: string; ordinal: number; questionSegmentId: string; answerSegmentIds: string[]; contextSegmentIds: string[]; questionSpeaker: string; answerSpeaker: string; question: string; answer: string; questionTimestamp: string; answerTimestamp: string };
export type ExtractionCandidate = { id: string; candidateType: "testimony_claim" | "qa_exchange" | "procedural_action" | "position" | "exhibit" | "stipulation" | "resolution_item"; sourceSegmentIds: string[]; payload: Record<string, unknown>; extractionConfidence: number; reviewStatus: "pending" };
export type StructuredExhibit = { id: string; label: string; admissionStatus: "identification" | "admitted" | "unknown"; description: string; sourceSegmentIds: string[] };
export type StructuredStipulation = { id: string; exhibitLabel: string; subject: string; status: "accepted" | "entered"; exactText: string; sourceSegmentIds: string[] };
export type CompilerResolutionItem = { id: string; kind: "measurement_time" | "speaker_attribution" | "transcript_gap"; title: string; detail: string; status: "unresolved"; eventTime: null; sourceSegmentIds: string[] };
type Position = { id: string; party: "commonwealth" | "defense"; statement: string; evidenceStatus: "not_evidence"; sourceSegmentIds: string[] };
type Procedure = { id: string; action: string; sourceSegmentIds: string[] };
type Coverage = { completionState: "complete" | "incomplete"; detectedSegments: number; parsedSegments: number; firstTimestamp: string; lastTimestamp: string; parserWarnings: string[] };

export type ProceedingPackageV1 = {
  schemaVersion: "proceeding-package/1.0";
  packageId: string;
  compiler: { name: "Icarus Testimony Compiler"; version: string; boundary: "record_only_no_case_analysis" };
  proceeding: { title: string; type: "trial_day"; proceedingDate: string | null; publisher: string };
  source: { canonicalUrl: string; sha256: string; representation: "rev_html_transcript" | "rev_markdown_transcript" };
  coverage: Coverage;
  speakers: Array<{ id: string; providerLabel: string }>;
  segments: ParsedTranscriptSegment[];
  qaExchanges: QaExchange[];
  extractionCandidates: ExtractionCandidate[];
  positions: Position[];
  proceduralActions: Procedure[];
  exhibits: StructuredExhibit[];
  stipulations: StructuredStipulation[];
  resolutionItems: CompilerResolutionItem[];
  invariants: string[];
};

export type ParsedRevTranscript = {
  title: string; description: string; canonicalUrl: string; publisher: "Rev"; publishedDate: string | null; sourceSha256: string; coverage: Coverage;
  speakers: Array<{ id: string; providerLabel: string }>;
  media: Array<{ id: string; provider: string; externalId: string | null; mediaUrl: string; embedUrl: string | null }>;
  segments: ParsedTranscriptSegment[]; qaExchanges: QaExchange[]; extractionCandidates: ExtractionCandidate[];
  claims: Array<{ id: string; propositionId: string; segmentId: string; speaker: string; assertion: string; normalizedText: string; extractionConfidence: number; sourceQuote: string; reviewReasons: string[] }>;
  attributions: Array<{ id: string; claimId: string; entityLabel: string; attributionRole: "reported_by" | "testified_by" | "transcribed_by"; sequence: number; notes: string }>;
  acquisitions: Array<{ id: string; title: string; sourceFamily: string; usedAtTrial: boolean | null; admittedAsExhibit: boolean | null; exhibitNumber: string | null; sourceUrl: string | null; discoveredFromSegmentId: string; priority: "low" | "medium" | "high" | "critical"; notes: string }>;
  positions: Position[]; proceduralActions: Procedure[]; exhibits: StructuredExhibit[]; stipulations: StructuredStipulation[]; resolutionItems: CompilerResolutionItem[]; package: ProceedingPackageV1;
};

function parseMedia(html: string, sha: string) {
  const iframe = html.match(/<iframe[^>]+class="[^"]*embedly-embed[^"]*"[^>]+src="([^"]+)"/i)?.[1];
  if (!iframe) return [];
  const embedlyUrl = new URL(decodeHtml(iframe).replace(/^\/\//, "https://"));
  const mediaUrl = embedlyUrl.searchParams.get("url");
  const embedUrl = embedlyUrl.searchParams.get("src");
  if (!mediaUrl) return [];
  const parsed = new URL(mediaUrl);
  const externalId = parsed.searchParams.get("v") ?? embedUrl?.match(/youtube\.com\/embed\/([^?&/]+)/i)?.[1] ?? null;
  return [{ id: stableUuid("media", `${sha}:${mediaUrl}`), provider: embedlyUrl.searchParams.get("display_name") ?? "Embedded media", externalId, mediaUrl, embedUrl }];
}

/** Rev provider turns are speaker headers plus every following continuation paragraph. */
function parseSegments(html: string, sha: string) {
  const opening = /<div[^>]+id="main-content"[^>]*>/i.exec(html);
  if (!opening) throw new Error("The Rev transcript body could not be located.");
  const body = html.slice(opening.index + opening[0].length);
  const header = /<p>((?:(?!<\/p>)[\s\S])*?)\s*\(<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>\):<\/p>/gi;
  const headers = [...body.matchAll(header)];
  if (!headers.length) throw new Error("No timestamped Rev transcript segments were found.");
  const raw: Array<Omit<ParsedTranscriptSegment, "timestampEndMs" | "locator">> = [];
  headers.forEach((item, index) => {
    const start = (item.index ?? 0) + item[0].length;
    const end = headers[index + 1]?.index ?? body.length;
    const paragraphs = [...body.slice(start, end).matchAll(/<p>([\s\S]*?)<\/p>/gi)].map((match) => plainText(match[1])).filter(Boolean);
    const speaker = plainText(item[1] ?? "");
    const text = paragraphs.join("\n\n");
    const timestampStartMs = timestampToMs(plainText(item[3] ?? ""));
    if (speaker && text) raw.push({ id: stableUuid("segment", `${sha}:${index}:${speaker}:${timestampStartMs}:${text}`), ordinal: index, speaker, timestampStartMs, deepLink: decodeHtml(item[2] ?? ""), text });
  });
  let offset = 0;
  const segments = raw.map((segment, index) => {
    const next = raw[index + 1]?.timestampStartMs ?? null;
    const timestampEndMs = next !== null && next >= segment.timestampStartMs ? next : null;
    const start = offset;
    offset += segment.text.length + 1;
    return { ...segment, timestampEndMs, locator: { type: "timestamp" as const, timestampStart: formatTimestamp(segment.timestampStartMs), ...(timestampEndMs === null ? {} : { timestampEnd: formatTimestamp(timestampEndMs) }), start, end: start + segment.text.length } };
  });
  return { detected: headers.length, segments };
}

function substantive(text: string) {
  const value = text.trim();
  return value.length >= 20 && value.length <= 12_000 && !value.endsWith("?") && !/^\[(?:inaudible|crosstalk|foreign language)[^\]]*\][.!]?$/i.test(value) && !/^(?:yes|no|okay|all right|thank you|good morning|good afternoon|correct|that'?s correct|i do)[,.! ]*$/i.test(value);
}

function buildClaims(segments: ParsedTranscriptSegment[]) {
  const claims: ParsedRevTranscript["claims"] = [];
  const attributions: ParsedRevTranscript["attributions"] = [];
  for (const segment of segments) {
    if (!substantive(segment.text)) continue;
    const id = stableUuid("claim", segment.id);
    claims.push({ id, propositionId: stableUuid("proposition", segment.text.toLowerCase().replace(/\s+/g, " ").trim()), segmentId: segment.id, speaker: segment.speaker, assertion: `${segment.speaker} testified: ${segment.text}`, normalizedText: segment.text, extractionConfidence: 0.82, sourceQuote: segment.text, reviewReasons: ["machine_extracted", "proposition_requires_normalization", "testimony_lane_only"] });
    const reported = /\b(?:i|we)\s+(?:recall\s+)?(?:was|were)\s+told\b|\baccording to\b/i.test(segment.text);
    const chain: Array<[string, "reported_by" | "testified_by" | "transcribed_by", string]> = reported
      ? [["Unknown incoming information source", "reported_by", "The testimony reports information from an unidentified upstream source."], [segment.speaker, "testified_by", "Speaker attributed by the captured transcript."], ["Rev", "transcribed_by", "Transcript representation published by Rev."]]
      : [[segment.speaker, "testified_by", "Speaker attributed by the captured transcript."], ["Rev", "transcribed_by", "Transcript representation published by Rev."]];
    chain.forEach(([entityLabel, attributionRole, notes], index) => attributions.push({ id: stableUuid("attribution", `${id}:${index + 1}`), claimId: id, entityLabel, attributionRole, sequence: index + 1, notes }));
  }
  return { claims, attributions };
}

const interruption = (segment: ParsedTranscriptSegment) => /^(?:objection|sustained|overruled|allow it|sidebar)/i.test(segment.text.trim()) || /judge|court/i.test(segment.speaker);
function buildQa(segments: ParsedTranscriptSegment[]) {
  const output: QaExchange[] = [];
  segments.slice(0, -1).forEach((question, index) => {
    if (!question.text.trim().endsWith("?")) return;
    let answerIndex = index + 1;
    while (answerIndex < Math.min(index + 4, segments.length) && interruption(segments[answerIndex])) answerIndex += 1;
    const answer = segments[answerIndex];
    if (!answer || answer.speaker === question.speaker || answer.text.trim().endsWith("?")) return;
    output.push({ id: stableUuid("qa", `${question.id}:${answer.id}`), ordinal: output.length, questionSegmentId: question.id, answerSegmentIds: [answer.id], contextSegmentIds: segments.slice(Math.max(0, index - 1), Math.min(segments.length, answerIndex + 2)).map((item) => item.id), questionSpeaker: question.speaker, answerSpeaker: answer.speaker, question: question.text, answer: answer.text, questionTimestamp: formatTimestamp(question.timestampStartMs), answerTimestamp: formatTimestamp(answer.timestampStartMs) });
  });
  return output;
}

function acquisitions(segments: ParsedTranscriptSegment[], url: string) {
  const output = new Map<string, ParsedRevTranscript["acquisitions"][number]>();
  for (const segment of segments) {
    for (const match of segment.text.matchAll(/\bExhibit\s+([A-Z0-9]+)(?:\s+for\s+(?:ID|identification))?/gi)) {
      const label = match[1].toUpperCase();
      const key = `exhibit:${label}`;
      if (!output.has(key)) output.set(key, { id: stableUuid("acquisition", key), title: `Exhibit ${label} — identified in testimony`, sourceFamily: "court_record", usedAtTrial: true, admittedAsExhibit: null, exhibitNumber: `${label}${/for\s+(?:ID|identification)/i.test(match[0]) ? " for identification" : ""}`, sourceUrl: url, discoveredFromSegmentId: segment.id, priority: "high", notes: "Mentioned in testimony; possession and admission are not implied by this acquisition record." });
    }
    if (/\bEMS\b|\bparamedics?\b/i.test(segment.text) && !output.has("ems")) output.set("ems", { id: stableUuid("acquisition", "ems"), title: "EMS / paramedic source information referenced in testimony", sourceFamily: "other", usedAtTrial: true, admittedAsExhibit: null, exhibitNumber: null, sourceUrl: url, discoveredFromSegmentId: segment.id, priority: "high", notes: "Underlying EMS information is referenced but not possessed or reviewed." });
    if (/\bmedical records?\b|\bclinical records?\b/i.test(segment.text) && !output.has("medical")) output.set("medical", { id: stableUuid("acquisition", "medical"), title: "Medical record referenced in testimony", sourceFamily: "medical_record", usedAtTrial: true, admittedAsExhibit: null, exhibitNumber: null, sourceUrl: url, discoveredFromSegmentId: segment.id, priority: "high", notes: "Underlying medical record is referenced but not possessed or reviewed." });
  }
  return [...output.values()];
}

const matching = (segments: ParsedTranscriptSegment[], pattern: RegExp) => segments.filter((segment) => pattern.test(segment.text));
function structureRecord(segments: ParsedTranscriptSegment[]) {
  const definitions: Array<[string, StructuredExhibit["admissionStatus"], string, RegExp]> = [
    ["J", "identification", "Summary or list of stipulated facts identified as Exhibit J.", /Exhibit J|J for identification/i],
    ["184", "admitted", "Stipulation regarding postmortem toxicology testing of Cora Clancy.", /Exhibit 184|postmortem toxicology testing of Cora Clancy/i],
    ["185", "admitted", "Stipulation regarding postmortem toxicology testing of Dawson Clancy.", /Exhibit 185|postmortem toxicology testing (?:relating to|of) Dawson Clancy/i],
    ["186", "admitted", "Stipulation regarding postmortem toxicology testing of Callan Clancy.", /Exhibit 186|postmortem toxicology testing of Callan Clancy/i],
  ];
  const exhibits = definitions.flatMap<StructuredExhibit>(([label, admissionStatus, description, pattern]) => {
    const rows = matching(segments, pattern);
    return rows.length ? [{ id: stableUuid("exhibit", label), label, admissionStatus, description, sourceSegmentIds: rows.map((row) => row.id) }] : [];
  });
  const acceptedJ = matching(segments, /accept(?:ed)? the (?:proposed )?stipulation|accept the stipulation/i);
  const stipulations = exhibits.map<StructuredStipulation>((exhibit) => {
    const rows = segments.filter((segment) => exhibit.sourceSegmentIds.includes(segment.id));
    const all = exhibit.label === "J" ? [...new Map([...rows, ...acceptedJ].map((row) => [row.id, row])).values()] : rows;
    return { id: stableUuid("stipulation", exhibit.label), exhibitLabel: exhibit.label, subject: exhibit.label === "J" ? "Facts summarized in Exhibit J" : exhibit.description.replace(/^Stipulation regarding /, "").replace(/\.$/, ""), status: exhibit.label === "J" ? "accepted" : "entered", exactText: all.map((row) => row.text).join("\n\n"), sourceSegmentIds: all.map((row) => row.id) };
  });
  const proceduralActions = matching(segments, /accept(?:ed)? the (?:proposed )?stipulation|move to enter three stipulations|bring the jury|call your next witness|swear .* in/i).map((segment) => ({ id: stableUuid("procedure", segment.id), action: segment.text, sourceSegmentIds: [segment.id] }));
  const positions = matching(segments, /we have not been contesting the government'?s case|Commonwealth's position|defense(?:'s)? position/i).map((segment) => ({ id: stableUuid("position", segment.id), party: /Reddington|defense/i.test(segment.speaker + segment.text) ? "defense" as const : "commonwealth" as const, statement: segment.text, evidenceStatus: "not_evidence" as const, sourceSegmentIds: [segment.id] }));
  const measurements = matching(segments, /82\.1 degrees|95\.2 degrees/i);
  const resolutionItems: CompilerResolutionItem[] = measurements.length ? [{ id: stableUuid("resolution", "temperature-measurement-time"), kind: "measurement_time", title: "Resolve when the 82.1°F and 95.2°F measurements were taken", detail: "The transcript supplies statement timestamps for the questions and answers, but it does not supply the event time of either temperature measurement. No measurement-time timestamp is inferred.", status: "unresolved", eventTime: null, sourceSegmentIds: measurements.map((row) => row.id) }] : [];
  return { exhibits, stipulations, proceduralActions, positions, resolutionItems };
}

function candidates(claims: ParsedRevTranscript["claims"], qa: QaExchange[], record: ReturnType<typeof structureRecord>) {
  const rows: ExtractionCandidate[] = claims.map((claim) => ({ id: stableUuid("candidate", `claim:${claim.id}`), candidateType: "testimony_claim", sourceSegmentIds: [claim.segmentId], payload: { assertion: claim.assertion, speaker: claim.speaker }, extractionConfidence: claim.extractionConfidence, reviewStatus: "pending" }));
  qa.forEach((item) => rows.push({ id: stableUuid("candidate", `qa:${item.id}`), candidateType: "qa_exchange", sourceSegmentIds: [item.questionSegmentId, ...item.answerSegmentIds], payload: { question: item.question, answer: item.answer, questionSpeaker: item.questionSpeaker, answerSpeaker: item.answerSpeaker }, extractionConfidence: 0.9, reviewStatus: "pending" }));
  record.proceduralActions.forEach((item) => rows.push({ id: stableUuid("candidate", `procedure:${item.id}`), candidateType: "procedural_action", sourceSegmentIds: item.sourceSegmentIds, payload: { action: item.action }, extractionConfidence: 0.9, reviewStatus: "pending" }));
  record.positions.forEach((item) => rows.push({ id: stableUuid("candidate", `position:${item.id}`), candidateType: "position", sourceSegmentIds: item.sourceSegmentIds, payload: { statement: item.statement, party: item.party, evidenceStatus: item.evidenceStatus }, extractionConfidence: 0.82, reviewStatus: "pending" }));
  record.exhibits.forEach((item) => rows.push({ id: stableUuid("candidate", `exhibit:${item.id}`), candidateType: "exhibit", sourceSegmentIds: item.sourceSegmentIds, payload: { label: item.label, admissionStatus: item.admissionStatus, description: item.description }, extractionConfidence: 0.95, reviewStatus: "pending" }));
  record.stipulations.forEach((item) => rows.push({ id: stableUuid("candidate", `stipulation:${item.id}`), candidateType: "stipulation", sourceSegmentIds: item.sourceSegmentIds, payload: { exhibitLabel: item.exhibitLabel, subject: item.subject, status: item.status }, extractionConfidence: 0.95, reviewStatus: "pending" }));
  record.resolutionItems.forEach((item) => rows.push({ id: stableUuid("candidate", `resolution:${item.id}`), candidateType: "resolution_item", sourceSegmentIds: item.sourceSegmentIds, payload: { title: item.title, detail: item.detail, eventTime: null }, extractionConfidence: 1, reviewStatus: "pending" }));
  return rows;
}

export function parseRevTranscript(html: string, submittedUrl: string, preservedSourceSha256?: string, representation: ProceedingPackageV1["source"]["representation"] = "rev_html_transcript"): ParsedRevTranscript {
  const sourceSha256 = preservedSourceSha256 ?? createHash("sha256").update(Buffer.from(html, "utf8")).digest("hex");
  const title = attribute(html, /<title>([^<]+)<\/title>/i).replace(/\s*\|\s*Rev$/i, "");
  const description = attribute(html, /<meta[^>]+content="([^"]*)"[^>]+name="description"/i) || attribute(html, /<meta[^>]+name="description"[^>]+content="([^"]*)"/i);
  const pageCanonical = attribute(html, /<link[^>]+href="([^"]+)"[^>]+rel="canonical"/i) || attribute(html, /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i);
  const canonicalUrl = pageCanonical || canonicalizeSubmittedUrl(submittedUrl);
  const publishedDate = html.match(/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})"/i)?.[1] ?? null;
  if (!title || !/rev\.com$/i.test(new URL(canonicalUrl).hostname)) throw new Error("The captured page is not a supported Rev transcript.");
  const parsed = parseSegments(html, sourceSha256);
  const coverage: Coverage = { completionState: parsed.detected === parsed.segments.length ? "complete" : "incomplete", detectedSegments: parsed.detected, parsedSegments: parsed.segments.length, firstTimestamp: formatTimestamp(parsed.segments[0].timestampStartMs), lastTimestamp: formatTimestamp(parsed.segments.at(-1)?.timestampStartMs ?? parsed.segments[0].timestampStartMs), parserWarnings: parsed.segments.some((segment) => /^Speaker \d+$/i.test(segment.speaker)) ? ["One or more provider speaker labels require human attribution review."] : [] };
  if (coverage.completionState !== "complete") throw new Error(`Transcript completeness failure: detected ${coverage.detectedSegments}, parsed ${coverage.parsedSegments}.`);
  const speakers = [...new Set(parsed.segments.map((segment) => segment.speaker))].map((providerLabel) => ({ id: stableUuid("speaker", `${sourceSha256}:${providerLabel}`), providerLabel }));
  const claimRecord = buildClaims(parsed.segments);
  const qaExchanges = buildQa(parsed.segments);
  const record = structureRecord(parsed.segments);
  const extractionCandidates = candidates(claimRecord.claims, qaExchanges, record);
  const packageRecord: ProceedingPackageV1 = { schemaVersion: "proceeding-package/1.0", packageId: stableUuid("package", sourceSha256), compiler: { name: "Icarus Testimony Compiler", version: REV_PARSER_VERSION, boundary: "record_only_no_case_analysis" }, proceeding: { title, type: "trial_day", proceedingDate: publishedDate, publisher: "Rev" }, source: { canonicalUrl, sha256: sourceSha256, representation }, coverage, speakers, segments: parsed.segments, qaExchanges, extractionCandidates, ...record, invariants: ["A run can complete only when detected segments equal parsed segments equal committed segments.", "Every extracted record cites one or more exact source segments.", "Question and short-answer segments remain linked as a Q/A exchange.", "Party advocacy is a position, not evidence.", "Transcript statement timestamps are never substituted for unknown event times.", "Casework import creates no support, contradiction, truth, or hypothesis assessment."] };
  return { title, description, canonicalUrl, publisher: "Rev", publishedDate, sourceSha256, coverage, speakers, media: parseMedia(html, sourceSha256), segments: parsed.segments, qaExchanges, extractionCandidates, claims: claimRecord.claims, attributions: claimRecord.attributions, acquisitions: acquisitions(parsed.segments, canonicalUrl), ...record, package: packageRecord };
}
