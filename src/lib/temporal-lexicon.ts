/**
 * Deterministic temporal-language cues for testimony.
 *
 * The lexicon never invents chronology. It only classifies quoted wording so the
 * compiler can verify that a reviewed relation is actually supported by the
 * witness's own words.
 */

export type TemporalRelation =
  | "BEFORE" | "BEFORE_OR_AT" | "AT" | "AFTER_OR_AT" | "AFTER" | "OVERLAPS" | "DURING";

export type TemporalAssertionForm =
  | "EXACT_DATETIME" | "EXACT_DATE" | "EXACT_TIME" | "APPROXIMATE_TIME" | "INTERVAL" | "DURATION"
  | "RELATIVE" | "SEQUENCE_ONLY" | "LOWER_BOUND" | "UPPER_BOUND" | "UNKNOWN";

export type CueKind = "sequence" | "state" | "simultaneity" | "knowledge" | "duration" | "unknown_time";

export type TemporalCue = {
  kind: CueKind;
  /** The exact matched text. */
  text: string;
  /** Relations this wording can support, from the earlier-said thing to the later-said thing. */
  supports: TemporalRelation[];
};

const cuePatterns: Array<{ kind: CueKind; pattern: RegExp; supports: TemporalRelation[] }> = [
  { kind: "state", pattern: /\b(?:were|was|is|are|had)?\s*(?:there\s+)?already\b/i, supports: ["BEFORE_OR_AT"] },
  { kind: "state", pattern: /\bhad\s+(?:just\s+)?(?:pretty much\s+)?(?:just\s+)?(?:already\s+)?(?:been\s+)?(?:parked|removed|arrived)\b/i, supports: ["BEFORE_OR_AT"] },
  { kind: "state", pattern: /\b(?:not yet|had not yet|hadn't yet)\b/i, supports: ["AFTER"] },
  { kind: "state", pattern: /\bstill\b/i, supports: ["BEFORE_OR_AT"] },
  { kind: "simultaneity", pattern: /\b(?:simultaneously|at the same time|while)\b/i, supports: ["OVERLAPS", "AT"] },
  { kind: "simultaneity", pattern: /\bwhen (?:I|we|you) (?:arrived|entered|got there|saw|heard|came)\b/i, supports: ["AT", "BEFORE_OR_AT"] },
  { kind: "simultaneity", pattern: /\bas (?:I|we|you) (?:reached|arrived|entered|came)\b/i, supports: ["AT", "OVERLAPS"] },
  { kind: "simultaneity", pattern: /\bat that (?:point|time)\b/i, supports: ["AT", "BEFORE_OR_AT"] },
  { kind: "state", pattern: /\b(?:was|were)\s+(?:working on|open|closed|locked|unlocked|parked|running)\b/i, supports: ["BEFORE_OR_AT"] },
  { kind: "simultaneity", pattern: /\bby the time\b/i, supports: ["BEFORE_OR_AT"] },
  { kind: "sequence", pattern: /\b(?:shortly|immediately|soon|right)\s+after\b/i, supports: ["BEFORE"] },
  { kind: "sequence", pattern: /\bafter\b/i, supports: ["BEFORE"] },
  { kind: "sequence", pattern: /\bbefore\b/i, supports: ["AFTER"] },
  { kind: "sequence", pattern: /\b(?:once|when)\b/i, supports: ["BEFORE_OR_AT"] },
  { kind: "sequence", pattern: /\b(?:then|next|later|subsequently|afterward|eventually|immediately)\b/i, supports: ["BEFORE"] },
  { kind: "sequence", pattern: /\b(?:earlier|previously|first)\b/i, supports: ["AFTER"] },
  { kind: "sequence", pattern: /\b(?:at one point|at some point)\b/i, supports: ["DURING"] },
  { kind: "sequence", pattern: /\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:seconds?|minutes?|hours?|days?|weeks?|months?)\s+later\b/i, supports: ["BEFORE"] },
  { kind: "sequence", pattern: /\b(?:that morning|that evening|that night|the next day|the following day)\b/i, supports: ["DURING"] },
  { kind: "knowledge", pattern: /\b(?:later\s+)?learn(?:ed)?\b/i, supports: ["BEFORE_OR_AT"] },
  { kind: "knowledge", pattern: /\b(?:told|said|stated|relayed|communicated|radioed)\b/i, supports: ["BEFORE_OR_AT"] },
  { kind: "knowledge", pattern: /\b(?:heard|hear)\b/i, supports: ["BEFORE_OR_AT"] },
  { kind: "duration", pattern: /\b(?:for\s+(?:about\s+)?|approximately\s+|around\s+|anywhere from\s+)?(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|a few)\s*(?:to|-)?\s*(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)?\s*(?:seconds?|minutes?|hours?|days?|weeks?|months?|years?)\b/i, supports: [] },
  { kind: "unknown_time", pattern: /\bI (?:do not|don't) (?:know|recall) (?:exactly |precisely )?when\b/i, supports: [] },
];

export function extractTemporalCues(wording: string): TemporalCue[] {
  const cues: TemporalCue[] = [];
  const seen = new Set<string>();
  for (const { kind, pattern, supports } of cuePatterns) {
    const match = wording.match(pattern);
    if (!match) continue;
    const text = match[0].trim();
    const key = `${kind}:${text.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cues.push({ kind, text, supports });
  }
  return cues;
}

/** True when the wording contains a cue able to support the asserted relation. */
export function wordingSupportsRelation(wording: string, relation: TemporalRelation): TemporalCue | null {
  return extractTemporalCues(wording).find((cue) => cue.supports.includes(relation)) ?? null;
}

const stateWordings: RegExp[] = [
  /\balready\b/i,
  /\bwas (?:open|closed|locked|unlocked|parked|running|on|off)\b/i,
  /\bhad\s+(?:(?:pretty much|just|already)\s+)*(?:parked|been|removed|arrived)\b/i,
  /\b(?:still|not yet)\b/i,
  /\b(?:were|was) working on\b/i,
  /\bwere there\b/i,
  /\blaying on the ground\b/i,
];

/** True when wording reports a condition that already held at the moment observed. */
export function describesPriorState(wording: string): boolean {
  return stateWordings.some((pattern) => pattern.test(wording));
}

const wordNumbers: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const toNumber = (raw: string) => (Number.isNaN(Number(raw)) ? wordNumbers[raw.toLowerCase()] : Number(raw));
const unitSeconds: Record<string, number> = { second: 1, minute: 60, hour: 3_600, day: 86_400, week: 604_800 };

export type ParsedDuration = { minSeconds: number | null; maxSeconds: number | null; vague: boolean; text: string };

/** "three to four minutes" → 180–240 s. "a few minutes" stays vague; no seconds are invented. */
export function parseDurationWording(wording: string): ParsedDuration | null {
  const range = wording.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:to|-)\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(seconds?|minutes?|hours?|days?|weeks?)\b/i);
  if (range) {
    const seconds = unitSeconds[range[3].toLowerCase().replace(/s$/, "")];
    return { minSeconds: toNumber(range[1]) * seconds, maxSeconds: toNumber(range[2]) * seconds, vague: false, text: range[0] };
  }
  const single = wording.match(/\b(?:for\s+|about\s+|approximately\s+|around\s+|probably\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(seconds?|minutes?|hours?|days?|weeks?)\b/i);
  if (single) {
    const seconds = unitSeconds[single[2].toLowerCase().replace(/s$/, "")] * toNumber(single[1]);
    return { minSeconds: seconds, maxSeconds: seconds, vague: /\b(?:about|approximately|around|probably)\b/i.test(single[0]), text: single[0] };
  }
  const vague = wording.match(/\ba few\s+(seconds?|minutes?|hours?)\b/i);
  if (vague) return { minSeconds: null, maxSeconds: null, vague: true, text: vague[0] };
  return null;
}

/** Classifies a quoted temporal wording into the compiler's assertion forms. */
export function classifyAssertionForm(wording: string, base: { precision: string; qualification: string }): TemporalAssertionForm {
  const duration = parseDurationWording(wording);
  if (base.precision === "unknown" && !duration) return "UNKNOWN";
  if (base.precision === "exact_timestamp") return "EXACT_DATETIME";
  if (base.precision === "exact_date") return "EXACT_DATE";
  if (base.precision === "exact_time") return "EXACT_TIME";
  if (duration && /\b(?:for|took|long|anywhere)\b|^\s*(?:about|approximately)?\s*(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|a few)\b/i.test(wording) && !/\blater\b/i.test(wording)) return "DURATION";
  if (base.precision === "approximate") return "APPROXIMATE_TIME";
  if (base.precision === "interval" || base.precision === "bounded_interval") return "INTERVAL";
  if (/\b(?:no earlier than|at least|not before)\b/i.test(wording)) return "LOWER_BOUND";
  if (/\b(?:no later than|at most|not after|by then)\b/i.test(wording)) return "UPPER_BOUND";
  if (base.precision === "relative_only") return "RELATIVE";
  return "SEQUENCE_ONLY";
}
