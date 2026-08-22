import { z } from "zod";

import type { ParsedRevTranscript } from "@/lib/rev-testimony";
import {
  compileTestimonyKnowledgeMap,
  type SemanticKnowledgeCandidate,
} from "@/lib/testimony-knowledge-mapper";

export const TIMELINE_COMPILER_NAME = "icarus-testimony-timeline-candidate-compiler";
export const TIMELINE_COMPILER_VERSION = "1.0.0";
export const TIMELINE_CONTRACT_VERSION = "testimony-knowledge/1.0+timeline-candidate/1.0";

const monthNumbers: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

const qualificationPatterns = [
  { pattern: /\bI believe\b/i, qualification: "witness_qualified", basis: "wording:i-believe" },
  { pattern: /\bI think\b/i, qualification: "witness_qualified", basis: "wording:i-think" },
  { pattern: /\bmaybe\b/i, qualification: "witness_qualified", basis: "wording:maybe" },
  { pattern: /\bapproximately\b/i, qualification: "estimated", basis: "wording:approximately" },
  { pattern: /\baround\b/i, qualification: "estimated", basis: "wording:around" },
  { pattern: /\bI (?:do not|don't) recall exactly\b/i, qualification: "not_recalled", basis: "wording:not-recalled-exactly" },
  { pattern: /\bI (?:do not|don't) know when\b/i, qualification: "unknown", basis: "wording:unknown-when" },
  { pattern: /\bwould have to check (?:my )?notes\b/i, qualification: "witness_qualified", basis: "wording:check-notes" },
] as const;

const relativePattern = /\b(before|after|when I arrived|for about|(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:minutes?|hours?|days?|weeks?|months?|years?)\s+later|that morning|that evening|that night|the next day|the following day)\b/i;
const sequencePattern = /\b(then|later|earlier|first|already|not yet|had already|had not yet|subsequently|previously)\b/i;
const recurrencePattern = /\b(yearly|annually|daily|weekly|monthly|every\s+(?:day|week|month|year|morning|evening))\b/i;
const durationRangePattern = /\b(?:anywhere\s+from\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:to|-)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(minutes?|hours?|days?|weeks?|months?|years?)\b/i;

export type TemporalParseResult = {
  precision: "exact_timestamp" | "exact_date" | "exact_time" | "approximate" | "interval" | "bounded_interval" | "relative_only" | "sequence_only" | "unknown";
  assertedDate: string | null;
  assertedTimeOfDayStart: string | null;
  assertedTimeOfDayEnd: string | null;
  timeOfDayBand: string | null;
  datePrecision: string | null;
  timeOfDayPrecision: string | null;
  qualification: string;
  qualifierText: string | null;
  confidenceBasis: string;
  sequenceLanguage: string | null;
  durationIso8601: string | null;
  relativeOffsetValue: number | null;
  relativeOffsetUnit: string | null;
  recurrencePattern: Record<string, unknown> | null;
};

function isoDate(year: number, month: number, day: number) {
  const value = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  return z.string().date().parse(value);
}

function durationFromWording(wording: string) {
  const match = wording.match(/\b(?:for\s+(?:about\s+)?|approximately\s+|around\s+)(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(minutes?|hours?|days?|weeks?|months?|years?)\b/i);
  if (!match) return null;
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const value = Number.isNaN(Number(match[1])) ? words[match[1].toLowerCase()] : Number(match[1]);
  const unit = match[2].toLowerCase().replace(/s$/, "");
  const designator: Record<string, string> = { minute: "PT#M", hour: "PT#H", day: "P#D", week: "P#W", month: "P#M", year: "P#Y" };
  return { value, unit, iso: designator[unit].replace("#", String(value)) };
}

/** Parses only what the quoted wording states. It never imports the testimony timestamp as event time. */
export function parseTestimonyTemporalLanguage(rawWording: string): TemporalParseResult {
  const wording = z.string().min(1).parse(rawWording).trim();
  const qualifier = qualificationPatterns.find((item) => item.pattern.test(wording));
  const qualifierText = qualifier ? wording.match(qualifier.pattern)?.[0] ?? null : null;
  const qualification = qualifier?.qualification ?? "asserted";
  const confidenceBasis = qualifier?.basis ?? "wording:unqualified";

  const dateMatch = wording.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?[,]?\s+(\d{4})\b/i);
  const assertedDate = dateMatch ? isoDate(Number(dateMatch[3]), monthNumbers[dateMatch[1].toLowerCase()], Number(dateMatch[2])) : null;
  const clockMatch = wording.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/i);
  let assertedTimeOfDayStart: string | null = null;
  if (clockMatch) {
    let hour = Number(clockMatch[1]);
    const minute = Number(clockMatch[2] ?? "0");
    const pm = clockMatch[3].toLowerCase().startsWith("p");
    if (hour === 12) hour = 0;
    if (pm) hour += 12;
    assertedTimeOfDayStart = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
  }

  const bandMatch = wording.match(/\b(early morning|morning|afternoon|evening|night|overnight)\b/i);
  const timeOfDayBand = bandMatch ? bandMatch[1].toLowerCase().replace(/\s+/g, "_") : null;
  const duration = durationFromWording(wording);
  const durationRange = wording.match(durationRangePattern);
  const relative = wording.match(relativePattern)?.[0] ?? null;
  const sequence = wording.match(sequencePattern)?.[0] ?? null;
  const recurrence = wording.match(recurrencePattern)?.[0] ?? null;
  const unknownWhen = /\bI (?:do not|don't) know when\b/i.test(wording);
  const approximate = /\b(?:approximately|around|about)\b/i.test(wording) || Boolean(timeOfDayBand);

  let precision: TemporalParseResult["precision"] = "unknown";
  if (unknownWhen) precision = "unknown";
  else if (durationRange) precision = "bounded_interval";
  else if (duration) precision = "interval";
  else if (assertedDate && assertedTimeOfDayStart) precision = approximate ? "approximate" : "exact_timestamp";
  else if (assertedDate && timeOfDayBand) precision = "approximate";
  else if (assertedDate) precision = "exact_date";
  else if (assertedTimeOfDayStart) precision = approximate ? "approximate" : "exact_time";
  else if (timeOfDayBand) precision = "approximate";
  else if (relative) precision = "relative_only";
  else if (sequence) precision = "sequence_only";
  else if (recurrence) precision = "interval";

  const offsetMatch = wording.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(minutes?|hours?|days?|weeks?|months?|years?)\s+later\b/i);
  const offsetWords: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  return {
    precision,
    assertedDate,
    assertedTimeOfDayStart,
    assertedTimeOfDayEnd: null,
    timeOfDayBand,
    datePrecision: assertedDate ? "date" : null,
    timeOfDayPrecision: assertedTimeOfDayStart ? (approximate ? "approximate" : "exact") : timeOfDayBand ? "band" : null,
    qualification,
    qualifierText,
    confidenceBasis,
    sequenceLanguage: relative ?? sequence,
    durationIso8601: duration?.iso ?? null,
    relativeOffsetValue: offsetMatch ? (Number.isNaN(Number(offsetMatch[1])) ? offsetWords[offsetMatch[1].toLowerCase()] : Number(offsetMatch[1])) : null,
    relativeOffsetUnit: offsetMatch ? offsetMatch[2].toLowerCase().replace(/s$/, "") : null,
    recurrencePattern: recurrence ? { wording: recurrence, frequency: recurrence.toLowerCase().startsWith("year") || recurrence.toLowerCase() === "annually" ? "yearly" : recurrence.toLowerCase() } : null,
  };
}

const reviewedEventSchema = z.object({
  key: z.string().min(1),
  neutralDescription: z.string().min(1),
  eventClass: z.string().min(1),
  sourceClaimKey: z.string().min(1),
  sourceWording: z.string().min(1),
  sourceSegmentIds: z.array(z.string().uuid()).min(1),
  temporalWording: z.string().min(1),
  temporalSourceSegmentIds: z.array(z.string().uuid()).min(1),
  participantMentions: z.array(z.string().min(1)).default([]),
  recurrencePattern: z.record(z.string(), z.unknown()).nullable().default(null),
  extractionConfidence: z.number().min(0).max(1).default(1),
});

export const reviewedTimelineUnitSchema = z.object({
  key: z.string().min(1),
  witnessBlockImportedId: z.string().regex(/^witness_\d{3}$/),
  unitKind: z.enum(["qa_thread", "substantive_thread", "procedural_context", "mixed"]).default("qa_thread"),
  sourceSegmentIds: z.array(z.string().uuid()).min(1),
  summary: z.string().min(1),
  unknowns: z.array(z.string().min(1)).default([]),
  claim: z.object({
    key: z.string().min(1), assertedByRaw: z.string().min(1), speakerCapacity: z.string().nullable().default("witness"),
    normalizedAssertion: z.string().min(1), assertionStatus: z.enum(["asserted", "disputed", "qualified", "corrected", "withdrawn", "stipulated", "court_found", "unknown"]).default("asserted"),
    informationBasis: z.enum(["PERSONALLY_OBSERVED", "HEARD_FROM_PERSON", "READ_IN_RECORD", "REVIEWED_DEVICE_DATA", "RECALLED", "EXPERT_INFERENCE", "PARTY_ARGUMENT", "UNKNOWN_BASIS"]),
    sourceSegmentIds: z.array(z.string().uuid()).min(1), extractionConfidence: z.number().min(0).max(1).default(1),
  }),
  entityMentions: z.array(z.object({
    key: z.string().min(1), rawMention: z.string().min(1), mentionType: z.string().min(1), sourceSegmentIds: z.array(z.string().uuid()).min(1),
  })).default([]),
  events: z.array(reviewedEventSchema).min(1),
});

export type ReviewedTimelineUnit = z.input<typeof reviewedTimelineUnitSchema>;

function assertExactWording(label: string, wording: string, sourceSegmentIds: string[], segmentText: Map<string, string>) {
  const source = sourceSegmentIds.map((id) => segmentText.get(id) ?? "").join("\n");
  if (!source.includes(wording)) throw new Error(`${label} is not an exact substring of its cited testimony source: “${wording}”.`);
}

export function compileTestimonyTimelineCandidates(input: {
  caseId: string;
  proceedingId: string;
  sourceArtifactId: string;
  transcript: Pick<ParsedRevTranscript, "sourceSha256" | "segments">;
  reviewedUnits: ReviewedTimelineUnit[];
}) {
  const units = z.array(reviewedTimelineUnitSchema).parse(input.reviewedUnits);
  const segmentText = new Map(input.transcript.segments.map((segment) => [segment.id, segment.text]));
  const candidates: SemanticKnowledgeCandidate[] = units.map((unit) => {
    const unitScope = new Set(unit.sourceSegmentIds);
    const requireScope = (label: string, ids: string[]) => {
      if (ids.some((id) => !unitScope.has(id))) throw new Error(`${label} cites a segment outside the reviewed testimony unit.`);
    };
    requireScope("Claim", unit.claim.sourceSegmentIds);
    unit.entityMentions.forEach((mention) => requireScope("Entity mention", mention.sourceSegmentIds));

    return {
      key: unit.key,
      witnessBlockImportedId: unit.witnessBlockImportedId,
      unitKind: unit.unitKind,
      reviewStatus: "accepted",
      segments: unit.sourceSegmentIds.map((segmentId) => ({
        segmentId,
        contextRole: segmentText.get(segmentId)?.trim().endsWith("?") ? "question" as const : "answer" as const,
      })),
      summary: unit.summary,
      unknowns: unit.unknowns,
      claims: [{
        key: unit.claim.key, assertedByRaw: unit.claim.assertedByRaw, assertedByEntityId: null,
        speakerCapacity: unit.claim.speakerCapacity, normalizedAssertion: unit.claim.normalizedAssertion,
        assertionStatus: unit.claim.assertionStatus, informationBasis: unit.claim.informationBasis,
        provenanceType: "trial_testimony", sourceSegmentIds: unit.claim.sourceSegmentIds,
        extractionConfidence: unit.claim.extractionConfidence, propositionId: null,
      }],
      entityMentions: unit.entityMentions.map((mention) => ({ ...mention, normalizedCandidate: null })),
      eventCandidates: unit.events.map((event) => {
        requireScope("Event", event.sourceSegmentIds);
        assertExactWording("Event source wording", event.sourceWording, event.sourceSegmentIds, segmentText);
        return {
          key: event.key, neutralDescription: event.neutralDescription, eventClass: event.eventClass,
          participantMentions: event.participantMentions, sourceClaimKeys: [event.sourceClaimKey],
          sourceWording: event.sourceWording, recurrencePattern: event.recurrencePattern,
          extractionConfidence: event.extractionConfidence,
        };
      }),
      temporalAssertions: unit.events.map((event) => {
        requireScope("Temporal assertion", event.temporalSourceSegmentIds);
        assertExactWording("Temporal source wording", event.temporalWording, event.temporalSourceSegmentIds, segmentText);
        const parsed = parseTestimonyTemporalLanguage(event.temporalWording);
        return {
          key: `${event.key}-time`, eventCandidateKey: event.key, sourceClaimKey: event.sourceClaimKey,
          rawTemporalLanguage: event.temporalWording, assertedStart: null, assertedEnd: null,
          precision: parsed.precision, assertedDate: parsed.assertedDate,
          assertedTimeOfDayStart: parsed.assertedTimeOfDayStart, assertedTimeOfDayEnd: parsed.assertedTimeOfDayEnd,
          timeOfDayBand: parsed.timeOfDayBand, datePrecision: parsed.datePrecision,
          timeOfDayPrecision: parsed.timeOfDayPrecision, qualification: parsed.qualification,
          qualifierText: parsed.qualifierText, confidenceBasis: parsed.confidenceBasis,
          sequenceLanguage: parsed.sequenceLanguage, durationIso8601: parsed.durationIso8601,
          relativeOffsetValue: parsed.relativeOffsetValue, relativeOffsetUnit: parsed.relativeOffsetUnit,
          recurrencePattern: event.recurrencePattern ?? parsed.recurrencePattern,
          lowerBoundEventCandidateKey: null, upperBoundEventCandidateKey: null,
          assertedByRaw: unit.claim.assertedByRaw, sourceSegmentIds: event.temporalSourceSegmentIds,
          extractionConfidence: event.extractionConfidence,
        };
      }),
      relationships: unit.events.map((event) => ({
        key: `${event.key}-describes`, from: { type: "claim" as const, ref: event.sourceClaimKey }, relationType: "describes",
        to: { type: "event_candidate" as const, ref: event.key }, sourceClaimKey: event.sourceClaimKey,
        assertionStatus: unit.claim.assertionStatus === "qualified" ? "qualified" as const : "asserted" as const,
        extractionConfidence: event.extractionConfidence,
      })),
      flags: unit.unknowns.map((unknown, index) => ({
        key: `open-${index + 1}`, target: { type: "knowledge_item" as const, ref: unit.key }, flagType: "open_question",
        rationale: unknown, origin: "human" as const, status: "accepted" as const, sourceSegmentIds: unit.sourceSegmentIds,
      })),
    };
  });

  const compiled = compileTestimonyKnowledgeMap({
    ...input,
    candidates,
    extractionMethod: "reviewed_import",
    modelName: null,
    modelVersion: null,
    compilerName: TIMELINE_COMPILER_NAME,
    compilerVersion: TIMELINE_COMPILER_VERSION,
    contractVersion: TIMELINE_CONTRACT_VERSION,
    activityType: "timeline_candidate_extraction",
  });

  return {
    ...compiled,
    // The witness block is already persisted by the testimony knowledge mapping layer.
    // Reusing its deterministic ID avoids a parallel block or source-data copy.
    witness_blocks: [],
    invariants: [
      ...compiled.invariants,
      "timeline candidates are reviewable projections, not canonical events",
      "testimony timestamps are provenance locators and never default event time",
      "temporal confidence is derived from quoted wording only",
    ],
    boundary: { canonical_events_created: 0, same_resolutions_created: 0 },
  };
}
