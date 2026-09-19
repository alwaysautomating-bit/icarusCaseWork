import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { courtRecordHref } from "@/lib/case-routes";
import { createClient } from "@/lib/supabase/server";

export type CoreTimeline = {
  id: string;
  case_id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  sort_order: number;
  is_core: boolean;
  updated_at: string;
};

export type TimelineItemState = "known" | "working" | "needs_source";
export type TimelineFilter = "all" | "knowns" | "needs-placement";

export type CoreTimelineItem = {
  id: string;
  membershipId: string | null;
  noteId: string | null;
  state: TimelineItemState;
  headline: string;
  section: string;
  category: string;
  precision: string;
  timeLabel: string;
  sortTime: number | null;
  displayOrder: number;
  sourceLabel: string | null;
  sourceHref: string | null;
  sourceWording: string | null;
  attribution: string | null;
  informationBasis: string | null;
  limitation: string;
  sourceHint: string;
  objectCode: string | null;
  structureHref: string | null;
  temporalHint: Record<string,unknown> | null;
};

export type AvailableTimelineEvent = {
  ref: string;
  state: "known" | "working";
  title: string;
  timeLabel: string;
};

type MembershipRow = {
  id: string;
  timeline_id: string;
  event_id: string | null;
  event_candidate_id: string | null;
  section: string;
  category: string;
  display_order: number;
};

type PlacementNoteRow = {
  id: string;
  timeline_id: string;
  description: string;
  temporal_hint_json: Record<string, unknown>;
  source_hint: string;
  section: string;
  category: string;
  display_order: number;
  note: string;
};

type EventRow = {
  id: string;
  promoted_from_claim_id: string;
  title: string;
  event_time_start: string | null;
  event_time_end: string | null;
  time_precision: string;
  uncertainty_note: string;
};

type CandidateRow = {
  id: string;
  object_code: string;
  neutral_description: string;
  source_wording: string | null;
  source_claim_ids: string[];
  review_status: string;
};

type TemporalRow = {
  event_candidate_id: string;
  raw_temporal_language: string;
  precision: string;
  asserted_start: string | null;
  asserted_end: string | null;
  asserted_date: string | null;
  asserted_time_of_day_start: string | null;
  asserted_time_of_day_end: string | null;
  time_of_day_band: string | null;
  qualifier_text: string | null;
  sequence_language: string | null;
  logical_order: number;
};

type ClaimRow = {
  id: string;
  source_segment_id: string;
  claimant: string;
  assertion: string;
  source_quote: string;
  asserted_by_raw: string | null;
  information_basis: string;
};

type SegmentRow = { id: string; artifact_id: string; locator: Record<string, unknown>; ordinal: number };
type ArtifactRow = { id: string; title: string; original_filename: string | null };

function rowsOrThrow<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("Supabase returned no data.");
  return result.data;
}

function ids(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function timestamp(date: unknown, time?: unknown) {
  if (typeof date !== "string" || !date) return null;
  const normalizedTime = typeof time === "string" && time ? time : "00:00:00";
  const parsed = Date.parse(`${date}T${normalizedTime.includes(":") ? normalizedTime : "00:00:00"}-05:00`);
  return Number.isNaN(parsed) ? null : parsed;
}

function readablePrecision(value: string) {
  return value.replaceAll("_", " ");
}

function formatClock(value: string) {
  const parts = value.split(":").map(Number);
  if (parts.some(Number.isNaN)) return value;
  const [hour = 0, minute = 0, second = 0] = parts;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")}${second ? `:${String(second).padStart(2, "0")}` : ""} ${suffix}`;
}

function formatDate(value: string) {
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(parsed);
}

function temporalDisplay(temporal: TemporalRow | undefined) {
  if (!temporal) return { label: "Time not placed", sortTime: null, precision: "unknown" };
  const date = temporal.asserted_date ?? temporal.asserted_start?.slice(0, 10) ?? null;
  const time = temporal.asserted_time_of_day_start ?? (temporal.asserted_start?.includes("T") ? temporal.asserted_start.slice(11, 19) : null);
  const prefix = temporal.precision === "approximate" ? "~" : "";
  if (date && time) return { label: `${formatDate(date)} · ${prefix}${formatClock(time)}`, sortTime: timestamp(date, time), precision: temporal.precision };
  if (date) return { label: formatDate(date), sortTime: timestamp(date), precision: temporal.precision };
  return {
    label: temporal.sequence_language ?? temporal.qualifier_text ?? temporal.raw_temporal_language ?? temporal.time_of_day_band ?? "Relative placement",
    sortTime: null,
    precision: temporal.precision,
  };
}

function noteTemporalDisplay(hint: Record<string, unknown>) {
  const label = typeof hint.label === "string" && hint.label ? hint.label : "Time not placed";
  const date = typeof hint.date === "string" ? hint.date : typeof hint.startDate === "string" ? hint.startDate : null;
  const time = typeof hint.time === "string" ? hint.time : null;
  return { label, sortTime: timestamp(date, time), precision: typeof hint.precision === "string" ? hint.precision : "unknown" };
}

function locatorLabel(locator: Record<string, unknown>, ordinal: number) {
  if (typeof locator.page === "number") return `page ${locator.page}`;
  if (typeof locator.timestampStart === "string") return locator.timestampStart;
  return `segment ${ordinal}`;
}

function eventTemporalDisplay(event: EventRow) {
  if (!event.event_time_start) return { label: "Time not placed", sortTime: null, precision: event.time_precision };
  const parsed = new Date(event.event_time_start);
  const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" }).format(parsed);
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", timeZone: "America/New_York" }).format(parsed);
  return { label: `${date} · ${event.time_precision === "approximate" ? "~" : ""}${time}`, sortTime: parsed.getTime(), precision: event.time_precision };
}

export function matchesTimelineFilter(item: CoreTimelineItem, filter: TimelineFilter, query: string) {
  if (filter === "knowns" && item.state !== "known") return false;
  if (filter === "needs-placement" && item.state !== "needs_source" && !["unknown", "relative", "relative_only", "sequence_only"].includes(item.precision)) return false;
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [item.headline,item.timeLabel,item.section,item.category,item.sourceLabel,item.sourceHint,item.sourceWording,item.attribution,item.limitation]
    .filter(Boolean).join(" ").toLowerCase().includes(needle);
}

export async function getCoreTimelineWorkspace(caseId: string) {
  const supabase = await createClient();
  const [timelineResult,membershipResult,noteResult,eventResult,candidateResult,temporalResult] = await Promise.all([
    supabase.from("core_timelines").select("id,case_id,slug,title,subtitle,description,sort_order,is_core,updated_at").eq("case_id",caseId).order("sort_order"),
    supabase.from("core_timeline_event_memberships").select("id,timeline_id,event_id,event_candidate_id,section,category,display_order").eq("case_id",caseId).order("display_order"),
    supabase.from("timeline_placement_notes").select("id,timeline_id,description,temporal_hint_json,source_hint,section,category,display_order,note").eq("case_id",caseId).eq("status","needs_source").order("display_order"),
    supabase.from("events").select("id,promoted_from_claim_id,title,event_time_start,event_time_end,time_precision,uncertainty_note").eq("case_id",caseId).order("event_time_start"),
    supabase.from("event_candidates").select("id,object_code,neutral_description,source_wording,source_claim_ids,review_status").eq("case_id",caseId).neq("review_status","rejected").order("logical_order"),
    supabase.from("temporal_assertions").select("event_candidate_id,raw_temporal_language,precision,asserted_start,asserted_end,asserted_date,asserted_time_of_day_start,asserted_time_of_day_end,time_of_day_band,qualifier_text,sequence_language,logical_order").eq("case_id",caseId).order("logical_order"),
  ]);
  const timelines = rowsOrThrow(timelineResult) as CoreTimeline[];
  const memberships = rowsOrThrow(membershipResult) as MembershipRow[];
  const notes = rowsOrThrow(noteResult) as PlacementNoteRow[];
  const events = rowsOrThrow(eventResult) as EventRow[];
  const candidates = rowsOrThrow(candidateResult) as CandidateRow[];
  const temporals = rowsOrThrow(temporalResult) as TemporalRow[];

  const relevantClaimIds = ids([
    ...events.map((event) => event.promoted_from_claim_id),
    ...candidates.flatMap((candidate) => candidate.source_claim_ids ?? []),
  ]);
  const claimResult = relevantClaimIds.length
    ? await supabase.from("claims").select("id,source_segment_id,claimant,assertion,source_quote,asserted_by_raw,information_basis").eq("case_id",caseId).in("id",relevantClaimIds)
    : { data: [] as ClaimRow[], error: null };
  const claims = rowsOrThrow(claimResult) as ClaimRow[];
  const segmentIds = ids(claims.map((claim) => claim.source_segment_id));
  const segmentResult = segmentIds.length
    ? await supabase.from("source_segments").select("id,artifact_id,locator,ordinal").eq("case_id",caseId).in("id",segmentIds)
    : { data: [] as SegmentRow[], error: null };
  const segments = rowsOrThrow(segmentResult) as SegmentRow[];
  const artifactIds = ids(segments.map((segment) => segment.artifact_id));
  const artifactResult = artifactIds.length
    ? await supabase.from("source_artifacts").select("id,title,original_filename").eq("case_id",caseId).in("id",artifactIds)
    : { data: [] as ArtifactRow[], error: null };
  const artifacts = rowsOrThrow(artifactResult) as ArtifactRow[];

  const eventById = new Map(events.map((event) => [event.id,event]));
  const candidateById = new Map(candidates.map((candidate) => [candidate.id,candidate]));
  const claimById = new Map(claims.map((claim) => [claim.id,claim]));
  const segmentById = new Map(segments.map((segment) => [segment.id,segment]));
  const artifactById = new Map(artifacts.map((artifact) => [artifact.id,artifact]));
  const temporalByCandidate = new Map<string,TemporalRow>();
  for (const temporal of temporals) if (!temporalByCandidate.has(temporal.event_candidate_id)) temporalByCandidate.set(temporal.event_candidate_id,temporal);

  function sourceForClaim(claimId: string | undefined) {
    const claim = claimId ? claimById.get(claimId) : undefined;
    const segment = claim ? segmentById.get(claim.source_segment_id) : undefined;
    const artifact = segment ? artifactById.get(segment.artifact_id) : undefined;
    return { claim,segment,artifact };
  }

  const itemsByTimeline = new Map<string,CoreTimelineItem[]>();
  for (const timeline of timelines) itemsByTimeline.set(timeline.id,[]);
  for (const membership of memberships) {
    const target = itemsByTimeline.get(membership.timeline_id);
    if (!target) continue;
    if (membership.event_id) {
      const event = eventById.get(membership.event_id);
      if (!event) continue;
      const temporal = eventTemporalDisplay(event);
      const source = sourceForClaim(event.promoted_from_claim_id);
      target.push({
        id:`event:${event.id}`,membershipId:membership.id,noteId:null,state:"known",headline:event.title,section:membership.section,category:membership.category,
        precision:temporal.precision,timeLabel:temporal.label,sortTime:temporal.sortTime,displayOrder:membership.display_order,
        sourceLabel:source.artifact && source.segment ? `${source.artifact.title} · ${locatorLabel(source.segment.locator,source.segment.ordinal)}` : null,
        sourceHref:source.segment ? courtRecordHref(caseId,{segmentId:source.segment.id}) : null,
        sourceWording:source.claim?.source_quote || source.claim?.assertion || null,attribution:source.claim?.asserted_by_raw || source.claim?.claimant || null,
        informationBasis:source.claim?.information_basis ?? null,limitation:event.uncertainty_note,sourceHint:"",objectCode:null,structureHref:null,temporalHint:null,
      });
    } else if (membership.event_candidate_id) {
      const candidate = candidateById.get(membership.event_candidate_id);
      if (!candidate) continue;
      const temporal = temporalDisplay(temporalByCandidate.get(candidate.id));
      const source = sourceForClaim(candidate.source_claim_ids?.[0]);
      target.push({
        id:`candidate:${candidate.id}`,membershipId:membership.id,noteId:null,state:"working",headline:candidate.neutral_description,section:membership.section,category:membership.category,
        precision:temporal.precision,timeLabel:temporal.label,sortTime:temporal.sortTime,displayOrder:membership.display_order,
        sourceLabel:source.artifact && source.segment ? `${source.artifact.title} · ${locatorLabel(source.segment.locator,source.segment.ordinal)}` : null,
        sourceHref:source.segment ? courtRecordHref(caseId,{segmentId:source.segment.id}) : null,sourceWording:candidate.source_wording || source.claim?.source_quote || null,
        attribution:source.claim?.asserted_by_raw || source.claim?.claimant || null,informationBasis:source.claim?.information_basis ?? null,
        limitation:candidate.review_status === "pending" ? "Source-linked candidate; not yet confirmed as a known anchor." : `Review state: ${candidate.review_status}.`,
        sourceHint:"",objectCode:candidate.object_code,structureHref:`/cases/${encodeURIComponent(caseId)}/structure?type=event&object=${encodeURIComponent(candidate.id)}`,temporalHint:null,
      });
    }
  }
  for (const note of notes) {
    const target = itemsByTimeline.get(note.timeline_id);
    if (!target) continue;
    const temporal = noteTemporalDisplay(note.temporal_hint_json);
    target.push({
      id:`note:${note.id}`,membershipId:null,noteId:note.id,state:"needs_source",headline:note.description,section:note.section,category:note.category,
      precision:temporal.precision,timeLabel:temporal.label,sortTime:temporal.sortTime,displayOrder:note.display_order,sourceLabel:null,sourceHref:null,sourceWording:null,
      attribution:null,informationBasis:null,limitation:note.note,sourceHint:note.source_hint,objectCode:null,structureHref:null,temporalHint:note.temporal_hint_json,
    });
  }

  for (const values of itemsByTimeline.values()) values.sort((a,b) => {
    if (a.sortTime !== null && b.sortTime !== null && a.sortTime !== b.sortTime) return a.sortTime-b.sortTime;
    return a.displayOrder-b.displayOrder;
  });

  const availableEvents: AvailableTimelineEvent[] = [
    ...events.map((event) => ({ ref:`event:${event.id}`,state:"known" as const,title:event.title,timeLabel:eventTemporalDisplay(event).label })),
    ...candidates.map((candidate) => ({ ref:`candidate:${candidate.id}`,state:"working" as const,title:candidate.neutral_description,timeLabel:temporalDisplay(temporalByCandidate.get(candidate.id)).label })),
  ];

  return { timelines,itemsByTimeline,availableEvents };
}

export function timelineStateLabel(state: TimelineItemState) {
  if (state === "known") return "Known anchor";
  if (state === "working") return "Working event";
  return "Needs source";
}

export function precisionLabel(precision: string) {
  return readablePrecision(precision);
}
