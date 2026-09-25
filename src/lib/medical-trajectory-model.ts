// Pure model for the care trajectory page. Turns medical assertions (already validated against the
// preserved transcripts) into dated events, lanes, and windows. No file access here so it stays testable.
import { medicationKey } from "../../scripts/medical-assertions-lib.mjs";

export type Lane = "medication" | "state" | "safety" | "diagnostic" | "care";
export type Provenance = "clinician" | "reported" | "record" | "relayed";

export type Evidence = { day: number; seg: number; span: string; exchange: { seg: number; speaker: string; time: string; text: string }[]; href: string | null };

export type TrajectoryEvent = {
  id: string;
  ids: string[];
  lane: Lane;
  date: string;
  approximate: boolean;
  title: string;
  summary: string;
  medication: string | null;
  setting: string | null;
  provenance: Provenance;
  status: "asserted" | "uncertain" | "negated";
  basis: string;
  days: number[];
  evidence: Evidence[];
  conflicts: string[];
  note: string | null;
};

export type SupportCard = {
  id: string;
  date: string | null;
  kind: "testimony" | "record" | "question_raised" | "source_needed" | "researcher_observation";
  title: string;
  detail: string;
  sources: { day: number; seg: number; span: string; exchange?: Evidence["exchange"]; href?: string | null }[];
  // External references (guidelines, health-agency pages) cited for a claim that is not testimony.
  references?: { label: string; url: string; note: string }[];
};

export type CareSetting = { key: string; label: string; person: string; match: string[] };

type RawEvidence = { seg: number; span: string };
export type RawAssertion = {
  id: string;
  type: string;
  raw: string;
  med?: { name: string; dose?: { value: number; unit: string }; prescriber?: string; quantity?: string };
  action?: { type: string; from?: { value: number; unit: string }; to?: { value: number; unit: string } };
  act?: string;
  report?: string;
  actor?: { name: string; role: string };
  symptom?: { terms: string[]; trajectory?: string };
  diagnosis?: { term: string };
  encounter?: { kind: string; modality?: string; provider?: string };
  time: { date: string | null; precision: string; anchor?: string; raw?: string };
  basis: string;
  status?: string;
  temporality?: string;
  evidence: RawEvidence[];
  note?: string;
};
export type RawConflict = { conflict_id: string; earlier: string; later: string | null; relationship: string; severity: string; reason: string };

const DAY_MS = 86_400_000;
export const toDay = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
export const fromDay = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);
export const addDays = (iso: string, days: number) => fromDay(toDay(iso) + days);
export const daysBetween = (from: string, to: string) => toDay(to) - toDay(from);

const dose = (d?: { value: number; unit: string }) => (d ? `${d.value} ${d.unit}` : null);
const ACT_VERB: Record<string, string> = { prescribed: "prescribed", advised: "advised", instructed: "instructed", recommended: "recommended", dispensed: "dispensed", discussed: "discussed", ordered: "ordered" };
const REPORT_VERB: Record<string, string> = {
  patient_reported_taking: "reported taking", patient_reported_stopping: "reported stopping", patient_reported_not_taking: "reported not taking",
  patient_reported_prescribed: "reported as prescribed", patient_reported_intent: "reported intent", third_party_reported: "relayed by patient",
};
const ACTION_WORD: Record<string, string> = { start: "start", increase: "increase", decrease: "decrease", taper: "taper", discontinue: "stop", hold: "hold", switch: "switch", continue: "continue", restart: "restart" };
const SAFETY = /suicid|hopeless|intrusive|going to die|self-harm|harm/i;

export function settingFor(assertion: RawAssertion, settings: CareSetting[]): string | null {
  const haystack = [assertion.encounter?.provider, assertion.med?.prescriber, assertion.actor?.name].filter(Boolean).join(" | ");
  for (const setting of settings) if (setting.match.some((needle) => haystack.includes(needle))) return setting.key;
  return null;
}

function medicationTitle(a: RawAssertion) {
  const name = a.med!.name;
  const amount = dose(a.med!.dose) ?? dose(a.action?.to);
  const verb = a.act ? ACT_VERB[a.act] : REPORT_VERB[a.report ?? ""] ?? "reported";
  const action = a.action && ACTION_WORD[a.action.type] ? ACTION_WORD[a.action.type] : null;
  const change = a.action?.from && a.action?.to ? ` (${dose(a.action.from)} → ${dose(a.action.to)})` : "";
  return `${name}${amount ? ` ${amount}` : ""} · ${action ? `${action} ${verb}` : verb}${change}`;
}

function laneAndTitle(a: RawAssertion): { lane: Lane; title: string; provenance: Provenance } | null {
  // A range ("throughout treatment") has no single day, so it cannot be a marker on the clock.
  if (a.temporality === "historical" || a.time.precision === "range") return null;
  const provenance: Provenance = a.report ? "reported" : a.basis === "record_read_by_witness" ? "record" : "clinician";
  switch (a.type) {
    case "medication": {
      if (a.status === "negated" || a.temporality === "hypothetical" || a.action?.type === "discuss") return null;
      return { lane: "medication", title: medicationTitle(a), provenance: a.report === "third_party_reported" ? "relayed" : provenance };
    }
    case "symptom": {
      if (a.status === "negated") return null;
      const text = a.symptom!.terms.join(", ");
      return { lane: SAFETY.test(text) ? "safety" : "state", title: text.length > 96 ? `${text.slice(0, 93)}…` : text, provenance };
    }
    case "diagnosis":
      return { lane: "diagnostic", title: `${a.status === "negated" ? "Assessed, not diagnosed: " : ""}${a.diagnosis!.term}`, provenance };
    case "encounter":
      return { lane: "care", title: `${a.encounter!.kind}${a.encounter!.provider ? ` · ${a.encounter!.provider}` : ""}`, provenance };
    case "referral":
    case "instruction":
      if (a.status === "negated") return null;
      return { lane: "care", title: a.raw.length > 90 ? `${a.raw.slice(0, 87)}…` : a.raw, provenance };
    default:
      return null;
  }
}

export function buildEvents(
  inputs: { day: number; assertions: RawAssertion[] }[],
  args: {
    settings: CareSetting[];
    keys: Record<string, string[]>;
    conflicts: RawConflict[];
    exchange: (day: number, seg: number) => Evidence["exchange"];
    href: (day: number, seg: number, span: string) => string | null;
  },
): TrajectoryEvent[] {
  const conflictsById = new Map<string, string[]>();
  for (const c of args.conflicts.filter((item) => item.severity === "review")) {
    for (const id of [c.earlier, c.later]) if (id) conflictsById.set(id, [...(conflictsById.get(id) ?? []), c.reason]);
  }
  const merged = new Map<string, TrajectoryEvent>();
  for (const { day, assertions } of inputs) {
    for (const a of assertions) {
      const mapped = laneAndTitle(a);
      const date = a.time.date ?? a.time.anchor ?? null;
      if (!mapped || !date) continue;
      const key = a.type === "medication"
        ? `med|${medicationKey(a.med!.name, args.keys)}|${a.act ?? a.report}|${a.action?.type ?? ""}|${dose(a.action?.to) ?? dose(a.med!.dose) ?? ""}|${date}`
        : `one|${a.id}`;
      const evidence: Evidence[] = a.evidence.map((e) => ({ day, seg: e.seg, span: e.span, exchange: args.exchange(day, e.seg), href: args.href(day, e.seg, e.span) }));
      const existing = merged.get(key);
      if (existing) {
        existing.ids.push(a.id);
        existing.evidence.push(...evidence);
        if (!existing.days.includes(day)) existing.days.push(day);
        existing.conflicts.push(...(conflictsById.get(a.id) ?? []));
        continue;
      }
      merged.set(key, {
        id: a.id, ids: [a.id], lane: mapped.lane, date, approximate: a.time.date === null || a.time.precision !== "exact",
        title: mapped.title, summary: a.raw, medication: a.type === "medication" ? medicationKey(a.med!.name, args.keys) : null,
        setting: settingFor(a, args.settings), provenance: mapped.provenance,
        status: a.status === "uncertain" ? "uncertain" : "asserted", basis: a.basis, days: [day], evidence,
        conflicts: [...(conflictsById.get(a.id) ?? [])], note: a.note ?? null,
      });
    }
  }
  return [...merged.values()].sort((x, y) => (x.date === y.date ? x.id.localeCompare(y.id) : x.date < y.date ? -1 : 1));
}

export type Window = { start: string; end: string };

export function fullWindow(events: TrajectoryEvent[], support: SupportCard[]): Window {
  const dates = [...events.map((e) => e.date), ...support.filter((s) => s.date).map((s) => s.date!)].sort();
  return { start: dates[0]!, end: dates.at(-1)! };
}

// The lead-up view: the fourteen days before an event, ending on it.
export function leadUpWindow(eventDate: string, days = 14): Window {
  return { start: addDays(eventDate, -days), end: eventDate };
}

export function inWindow(date: string, window: Window) {
  return date >= window.start && date <= window.end;
}

export function positionPercent(date: string, window: Window) {
  const span = Math.max(1, daysBetween(window.start, window.end));
  return Math.min(100, Math.max(0, (daysBetween(window.start, date) / span) * 100));
}

export type Cluster = { key: string; date: string; events: TrajectoryEvent[] };

// Events in one lane on one date share a marker so the lane stays legible.
export function clusterLane(events: TrajectoryEvent[], lane: Lane, window: Window): Cluster[] {
  const byDate = new Map<string, TrajectoryEvent[]>();
  for (const e of events.filter((item) => item.lane === lane && inWindow(item.date, window))) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
  return [...byDate.entries()].map(([date, list]) => ({ key: `${lane}:${date}`, date, events: list }));
}

export function medicationLanes(events: TrajectoryEvent[], window: Window) {
  const groups = new Map<string, TrajectoryEvent[]>();
  for (const e of events.filter((item) => item.lane === "medication" && item.medication)) groups.set(e.medication!, [...(groups.get(e.medication!) ?? []), e]);
  return [...groups.entries()]
    .map(([medication, list]) => {
      const visible = list.filter((e) => inWindow(e.date, window));
      return { medication, first: list[0]!.date, last: list.at(-1)!.date, clusters: clusterLane(visible, "medication", window), settings: [...new Set(list.map((e) => e.setting).filter(Boolean))] as string[] };
    })
    .filter((lane) => lane.clusters.length > 0)
    .sort((a, b) => (a.first < b.first ? -1 : a.first > b.first ? 1 : a.medication.localeCompare(b.medication)));
}

export function trajectoryFacts(events: TrajectoryEvent[], window: Window) {
  const medications = new Set(events.filter((e) => e.lane === "medication").map((e) => e.medication));
  const settings = new Set(events.filter((e) => e.setting).map((e) => e.setting));
  // Settings that a medication event is attributed to, whether the witness prescribed it or the patient relayed it.
  const prescribers = new Set(events.filter((e) => e.lane === "medication" && e.setting).map((e) => e.setting));
  return { days: daysBetween(window.start, window.end) + 1, medications: medications.size, settings: settings.size, prescribers: prescribers.size };
}
