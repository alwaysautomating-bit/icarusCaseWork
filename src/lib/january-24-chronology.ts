import "server-only";

import { getCaseDigitalEvidenceTimeline } from "@/lib/case-digital-evidence";
import {
  courtRecordHref,
  digitalTimelineHref,
  firstRespondersTimelineHref,
  patrickAccountsHref,
  searchWarrantTimelineHref,
} from "@/lib/case-routes";
import type { CoreTimelineItem, TimelineProjectionOrigin, TimelineSourceKind } from "@/lib/core-timeline";
import { categoryKey, DEVICE_CATEGORIES, getDeviceReportTimeline, type DeviceReportEvent } from "@/lib/device-report-timeline";
import { getPatrickAccounts, STATUS_LABELS, type PatrickSourceKey } from "@/lib/patrick-accounts";
import { getResponderTimeline, phaseLabel } from "@/lib/responder-timeline";
import { getWarrantAttribution, LANE_LABELS, statusLabel } from "@/lib/search-warrant-timeline";

/*
 * January 24 full-day chronology.
 *
 * A read-only projection over source material that already exists elsewhere in Casework
 * (device report, examiner testimony, warrant affidavit, responder reconstruction and the
 * Patrick Clancy account comparison). Nothing here is written back as a timeline membership
 * or an event: each item points at the view that owns it, keeps its attribution and limits,
 * and never merges competing accounts into one asserted fact.
 */

const DAY = "2023-01-24";
const OFFSET = "-05:00";
const DISPATCH_ANCHOR = Date.parse(`${DAY}T18:11:00${OFFSET}`);

export const DAY_SOURCE_KINDS: Array<{ key: TimelineSourceKind; label: string }> = [
  { key: "digital", label: "Digital" },
  { key: "documentary", label: "Documents" },
  { key: "testimony", label: "Testimony" },
  { key: "accounts", label: "Patrick accounts" },
];

export type DayBand = { key: string; label: string };

export const DAY_BANDS: DayBand[] = [
  { key: "morning", label: "Morning" },
  { key: "afternoon", label: "Afternoon" },
  { key: "lead-up", label: "Late afternoon · errand and return home" },
  { key: "response", label: "Emergency response · from the ~6:11 PM dispatch" },
  { key: "evening", label: "Evening · hospital and first investigative steps" },
  { key: "january-25", label: "Continues into January 25" },
];

const SECTION_BANDS: Record<string, string> = {
  "lead-up": "lead-up",
  "emergency response": "response",
  discovery: "response",
  "ems activity": "response",
  "after discovery": "evening",
  "initial investigation": "evening",
};

/** Band for any timeline item: clock time first, then the item's own section as a fallback. */
export function dayBandKey(item: Pick<CoreTimelineItem, "sortTime" | "section" | "precision">) {
  if (item.sortTime !== null) {
    if (item.sortTime >= Date.parse(`2023-01-25T00:00:00${OFFSET}`)) return "january-25";
    const hour = new Date(item.sortTime - 5 * 3600_000).getUTCHours();
    if (item.sortTime >= Date.parse(`${DAY}T19:00:00${OFFSET}`)) return "evening";
    if (item.sortTime >= DISPATCH_ANCHOR) return "response";
    if (hour >= 17) return "lead-up";
    if (hour >= 12) return "afternoon";
    return "morning";
  }
  if (item.precision === "unknown") return null;
  return SECTION_BANDS[item.section.trim().toLowerCase()] ?? null;
}

function at(clock: string, date = DAY) {
  return Date.parse(`${date}T${clock}${OFFSET}`);
}

function clockLabel(clock: string, approximate = false) {
  const [hour = 0, minute = 0, second] = clock.replace("~", "").split(":").map(Number);
  const suffix = hour >= 12 ? "PM" : "AM";
  const seconds = second ? `:${String(second).padStart(2, "0")}` : "";
  return `${approximate ? "~" : ""}${hour % 12 || 12}:${String(minute).padStart(2, "0")}${seconds} ${suffix}`;
}

function base(origin: TimelineProjectionOrigin, id: string, fields: Partial<CoreTimelineItem> & Pick<CoreTimelineItem, "headline" | "timeLabel" | "sortTime" | "precision">): CoreTimelineItem {
  return {
    id: `projection:${id}`, membershipId: null, noteId: null, state: "projected", section: "", category: "",
    displayOrder: 0, sourceLabel: null, sourceHref: null, sourceWording: null, attribution: null, informationBasis: null,
    limitation: "", sourceHint: "", objectCode: null, structureHref: null, temporalHint: null, origin, ...fields,
  };
}

/* ---------- Digital: device timeline report ---------- */

const DEVICE_INCLUDED = new Set(["messages", "calls", "searches", "photos", "mail", "context"]);

function deviceHeadline(event: DeviceReportEvent) {
  const value = typeof event.value === "string" ? ` ${event.value}` : "";
  return `${event.detail}${value}`;
}

async function deviceReportItems(caseId: string) {
  const data = await getDeviceReportTimeline();
  const notes = data.report.report_source_notes;
  const origin: TimelineProjectionOrigin = { kind: "digital", label: "Device timeline report", viewLabel: "Open digital timeline", viewHref: digitalTimelineHref(caseId) };
  const limitation = "Structured from a report compiled from digital-evidence testimony. It does not independently authenticate the device records or resolve device/user attribution.";
  const items = data.events.flatMap((event) => {
    const key = categoryKey(event.category);
    if (!DEVICE_INCLUDED.has(key)) return [];
    const start = event.time ?? event.time_start;
    if (!start) return [];
    const approximate = start.startsWith("~");
    const label = DEVICE_CATEGORIES.find((item) => item.key === key)?.label ?? key;
    const endpoint = event.counterparty ? `${event.direction === "incoming" ? "from" : event.direction === "outgoing" ? "to" : "with"} ${event.counterparty}` : "";
    return [base({ ...origin, viewHref: digitalTimelineHref(caseId, key) }, `device:${event.index}`, {
      headline: deviceHeadline(event), timeLabel: clockLabel(start, approximate), sortTime: at(start.replace("~", "")),
      precision: approximate ? "approximate" : "exact_to_second", category: label,
      attribution: [event.source, event.direction, endpoint].filter(Boolean).join(" · "),
      informationBasis: "report entry as displayed", sourceLabel: `${data.report.title} · ${event.source}`, limitation,
    })];
  });
  const noteItems = [
    { key: "hr-first", clock: notes.heart_rate_first, headline: "First Apple Watch heart-rate record of the day (report source note)" },
    { key: "locked", clock: notes.device_locked_after_stated, headline: "Report states the iPhone remained locked after this time" },
    { key: "hr-last", clock: notes.heart_rate_last, headline: "Last Apple Watch heart-rate record (report source note)" },
  ].map((note) => base(origin, `device-note:${note.key}`, {
    headline: note.headline, timeLabel: clockLabel(note.clock), sortTime: at(note.clock), precision: "exact_to_second",
    category: "Report context", attribution: "Report source notes · as stated", informationBasis: "report summary statement",
    sourceLabel: `${data.report.title} · source notes`, limitation: `${limitation} The visible transcribed entries end before this note; nothing in the supplied pages covers the time between.`,
  }));
  return [...items, ...noteItems];
}

/* ---------- Digital: examiner testimony (source-segment linked) ---------- */

async function examinerTestimonyItems(caseId: string) {
  const { items } = await getCaseDigitalEvidenceTimeline(caseId);
  return items.map((item) => {
    const clock = item.occurredAt.slice(11, 19);
    return base({ kind: "digital", label: "Digital examiner testimony", viewLabel: "Open source segment", viewHref: courtRecordHref(caseId, { segmentId: item.sourceSegmentIds[0] }) }, `examiner:${item.key}`, {
      headline: item.headline,
      timeLabel: item.timestampPrecision === "second" ? clockLabel(clock) : clockLabel(clock.slice(0, 5)),
      sortTime: Date.parse(item.occurredAt), precision: item.timestampPrecision === "second" ? "exact_to_second" : "exact_to_minute",
      category: `${item.sourceSystem} · ${item.artifactType}`, sourceWording: item.sourceExcerpt,
      sourceHref: courtRecordHref(caseId, { segmentId: item.sourceSegmentIds[0] }), sourceLabel: `${item.device} · testimony`,
      attribution: "Digital forensic examiner, trial testimony", informationBasis: item.timestampBasis,
      limitation: `${item.attributionBoundary} ${item.interpretationBoundary}`,
    });
  });
}

/* ---------- Documentary: search-warrant affidavit chronology ---------- */

/** Affidavit events with no clock time, placed in the responder sequence by what they describe. */
const WARRANT_SEQUENCE: Record<string, { order: number; relation: string }> = {
  "sw-008": { order: -1, relation: "Between 5:55:01 PM and ~6:11 PM" },
  "sw-010": { order: 4.5, relation: "After dispatch · affidavit sequence" },
  "sw-011": { order: 17.5, relation: "After dispatch · affidavit sequence" },
  "sw-012": { order: 22.5, relation: "After dispatch · affidavit sequence" },
  "sw-013": { order: 23.5, relation: "After dispatch · affidavit sequence" },
};

async function warrantItems(caseId: string) {
  const { timeline } = await getWarrantAttribution();
  const href = searchWarrantTimelineHref(caseId);
  return timeline.events.flatMap((event) => {
    const origin: TimelineProjectionOrigin = { kind: "documentary", label: "Search-warrant affidavit", viewLabel: "Open warrant chronology", viewHref: `${href}#${event.id}` };
    const pages = `p. ${event.source_pages.join(", ")}`;
    const shared = {
      headline: event.label, category: LANE_LABELS[event.lane].label, sourceWording: event.assertion ?? null,
      sourceHref: `${href}#${event.id}`, sourceLabel: `${timeline.source.file} · ${pages}`,
      attribution: [event.originating_source ? `Originates with ${event.originating_source}` : null, event.reported_by ? `reported by ${event.reported_by}` : null, "as summarized in the affidavit"].filter(Boolean).join(", "),
      informationBasis: statusLabel(event.status),
      limitation: "Affidavit allegations are attributed claims in a probable-cause narrative; they are not promoted merely because the affidavit repeats them.",
    };
    if (event.time) {
      const [date = DAY, clock = "00:00:00"] = event.time.split("T");
      const approximate = event.time_precision === "approximate";
      const label = clockLabel(event.time_precision === "exact_to_second" ? clock : clock.slice(0, 5), approximate);
      return [base(origin, `warrant:${event.id}`, { ...shared, timeLabel: date === DAY ? label : `Jan 25 · ${label}`, sortTime: at(clock, date), precision: event.time_precision ?? "approximate" })];
    }
    const placement = WARRANT_SEQUENCE[event.id];
    if (!placement) return [];
    const sortTime = placement.order < 0 ? at("17:55:01") + 5 : DISPATCH_ANCHOR + placement.order;
    return [base(origin, `warrant:${event.id}`, { ...shared, timeLabel: placement.relation, sortTime, precision: placement.order < 0 ? "window" : "sequence_only" })];
  });
}

/* ---------- Testimony: first-responder reconstruction (key events) ---------- */

const RESPONDER_KEY_EVENTS = ["FR001", "FR002", "FR003", "FR004", "FR046", "FR005", "FR048", "FR049", "FR012", "FR013", "FR055", "FR016", "FR018", "FR027", "FR056", "FR029", "FR038", "FR040", "FR041", "FR042", "FR043"];

async function responderItems(caseId: string) {
  const timeline = await getResponderTimeline();
  const byId = new Map(timeline.events.map((event) => [event.id, event]));
  const href = firstRespondersTimelineHref(caseId);
  return RESPONDER_KEY_EVENTS.flatMap((id) => {
    const event = byId.get(id);
    if (!event) return [];
    const origin: TimelineProjectionOrigin = { kind: "testimony", label: "First-responder reconstruction", viewLabel: `Open in first responders (${timeline.events.length} events)`, viewHref: `${href}#${event.id.toLowerCase()}` };
    const isAnchor = event.confidence === "clock_anchor";
    const sources = event.sources ?? event.assertions?.map((assertion) => String(assertion.source ?? assertion.witness)) ?? [];
    return [base(origin, `responder:${event.id}`, {
      headline: event.title,
      timeLabel: isAnchor ? "~6:11 PM" : event.anchor_relation === "at" ? "T₀ · the scream" : `Sequence · ${event.anchor_relation === "before" ? "before" : "after"} T₀`,
      sortTime: DISPATCH_ANCHOR + event.order, precision: isAnchor ? "approximate" : "sequence_only",
      category: phaseLabel(event.phase), sourceHref: `${href}#${event.id.toLowerCase()}`,
      sourceLabel: sources.length ? `Transcript positions: ${sources.join("; ")}` : "Responder reconstruction",
      sourceWording: event.description ?? event.observation ?? event.finding ?? event.significance ?? null,
      attribution: event.actors?.length ? event.actors.join(", ") : event.assertions?.map((assertion) => assertion.witness).join(", ") ?? null,
      informationBasis: event.confidence ? event.confidence.replaceAll("_", " ") : "sequence reconstruction",
      limitation: [event.caveat, event.note, event.raw_temporal_expression ? `Temporal language: “${event.raw_temporal_expression}”.` : null,
        "Ordered by the responder reconstruction around T₀ (the scream); no clock time is invented for sequence-only events."].filter(Boolean).join(" "),
    })];
  });
}

/* ---------- Accounts: Patrick Clancy account comparison ---------- */

/** Where each compared step sits in the day. Sequence placements reference responder order around T₀. */
const ACCOUNT_PLACEMENT: Record<string, { sortTime: number; label: string; precision: string }> = {
  E1: { sortTime: at("17:15:00"), label: "~5:15–5:29 PM · accounts differ", precision: "window" },
  E2: { sortTime: at("17:32:32") + 1, label: "5:32–5:37 PM · CVS", precision: "window" },
  E3: { sortTime: at("17:55:01") + 1, label: "CVS and ThreeV video", precision: "window" },
  S01: { sortTime: at("17:55:01") + 10, label: "Between 5:55:01 PM and ~6:11 PM", precision: "window" },
  S02: { sortTime: at("17:55:01") + 11, label: "Between 5:55:01 PM and ~6:11 PM", precision: "window" },
  S03: { sortTime: at("17:55:01") + 12, label: "Between 5:55:01 PM and ~6:11 PM", precision: "window" },
  S04: { sortTime: at("17:55:01") + 13, label: "Between 5:55:01 PM and ~6:11 PM", precision: "window" },
  S05: { sortTime: DISPATCH_ANCHOR, label: "~6:11 PM · per accounts", precision: "approximate" },
  S06: { sortTime: DISPATCH_ANCHOR + 16.5, label: "Sequence · before T₀", precision: "sequence_only" },
  S08: { sortTime: DISPATCH_ANCHOR + 19.5, label: "Sequence · after T₀", precision: "sequence_only" },
  S07: { sortTime: DISPATCH_ANCHOR + 28.5, label: "Sequence · after T₀", precision: "sequence_only" },
  S09: { sortTime: DISPATCH_ANCHOR + 28.6, label: "Sequence · after T₀", precision: "sequence_only" },
  S10: { sortTime: DISPATCH_ANCHOR + 40.5, label: "Sequence · after T₀", precision: "sequence_only" },
};

async function accountItems(caseId: string) {
  const accounts = await getPatrickAccounts();
  const sourceLabel = new Map(accounts.sources.map((source) => [source.key, source.label]));
  const order: PatrickSourceKey[] = ["trial", "newyorker", "opening", "affidavit", "responders"];
  const href = patrickAccountsHref(caseId);
  return accounts.steps.flatMap((step) => {
    const placement = ACCOUNT_PLACEMENT[step.id];
    if (!placement) return [];
    const versions = order.flatMap((key) => {
      const cell = step.cells[key];
      return cell ? [{ source: sourceLabel.get(key) ?? key, text: cell.text, cites: cell.cites.join("; ") }] : [];
    });
    const origin: TimelineProjectionOrigin = { kind: "accounts", label: "Patrick Clancy · accounts compared", viewLabel: "Open account comparison", viewHref: `${href}#${step.id.toLowerCase()}` };
    return [base(origin, `account:${step.id}`, {
      headline: step.title, timeLabel: placement.label, sortTime: placement.sortTime, precision: placement.precision,
      category: STATUS_LABELS[step.assessment.status], versions, assessment: step.assessment.note,
      sourceHref: `${href}#${step.id.toLowerCase()}`, sourceLabel: `${versions.length} account${versions.length === 1 ? "" : "s"} compared`,
      attribution: "Patrick Clancy, as given in each source", informationBasis: "parallel accounts, not reconciled",
      limitation: "Each version is kept as its source gives it. A difference is a point to test, not a finding. Placement in the day is a reading aid, not a timestamp.",
    })];
  });
}

export async function getJanuary24DayProjection(caseId: string) {
  const [device, examiner, warrant, responders, accounts] = await Promise.all([
    deviceReportItems(caseId), examinerTestimonyItems(caseId), warrantItems(caseId), responderItems(caseId), accountItems(caseId),
  ]);
  return [...device, ...examiner, ...warrant, ...responders, ...accounts];
}

/** Chronological order for the full-day view: band, then clock/sequence position, then stored order. */
export function sortDayItems(items: CoreTimelineItem[]) {
  const bandIndex = (item: CoreTimelineItem) => {
    const key = dayBandKey(item);
    const index = DAY_BANDS.findIndex((band) => band.key === key);
    return index < 0 ? DAY_BANDS.length : index;
  };
  return [...items].sort((a, b) => bandIndex(a) - bandIndex(b)
    || (a.sortTime ?? Number.POSITIVE_INFINITY) - (b.sortTime ?? Number.POSITIVE_INFINITY)
    || a.displayOrder - b.displayOrder);
}
