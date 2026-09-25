// Medical assertion layer: schema, provenance verification, and deterministic projections.
// Contract: contracts/medical-assertion-1.0.md. Extraction is model work; everything here is code.
// Nothing in this module promotes an assertion to a verified fact or a T0 entry.
import { z } from "zod";

export const MEDICAL_ASSERTION_CONTRACT = "icarus-medical-assertion/1.0";

export const CONCEPT_TYPES = ["medication", "symptom", "diagnosis", "encounter", "instruction", "observation", "referral"];
// What a clinician (or clinic) did. A prescription is not dispensing; dispensing is not ingestion.
export const ACTS = ["prescribed", "ordered", "recommended", "advised", "instructed", "administered", "dispensed", "observed", "discussed", "referred"];
// What someone reported or a document lists. None of these establishes what was actually taken.
export const REPORTS = [
  "patient_reported_taking", "patient_reported_not_taking", "patient_reported_stopping", "patient_reported_past_use",
  "patient_reported_prescribed", "patient_reported_intent", "third_party_reported", "recorded_on_medication_list", "detected_by_toxicology",
];
export const ACTIONS = ["start", "increase", "decrease", "taper", "discontinue", "hold", "switch", "continue", "restart", "discuss"];
export const BASES = [
  "firsthand_provider", // witness did or observed it herself
  "patient_statement_to_witness", // patient told the witness
  "record_read_by_witness", // witness read it from a chart or exhibit
  "counsel_proposition_affirmed", // stated in counsel's question; witness affirmed it
  "third_party_report", // relayed about another provider's action
  "witness_general_knowledge", // not specific to the patient
];
export const STATUSES = ["asserted", "uncertain", "negated", "hypothetical"];
export const TEMPORALITIES = ["current", "historical", "hypothetical"];
export const EXPERIENCERS = ["patient", "family_member", "other"];
export const PRECISIONS = ["exact", "approximate", "range", "relative", "unknown"];
export const RELATIONSHIP_TYPES = ["CHANGES", "DISCONTINUES", "REPLACES", "REPORTED_RESPONSE_TO", "FOLLOWS_UP"];

const dateText = z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/);
const dose = z.object({ value: z.number(), unit: z.string() }).strict();
const evidenceItem = z.object({ seg: z.number().int(), span: z.string().min(1) }).strict();

export const assertionSchema = z.object({
  id: z.string().regex(/^meda_[a-z0-9-]+_\d{3}$/),
  type: z.enum(CONCEPT_TYPES),
  raw: z.string().min(1),
  med: z.object({
    name: z.string().min(1), dose: dose.optional(), dose_raw: z.string().optional(),
    frequency: z.string().optional(), route: z.string().optional(), prescriber: z.string().optional(), quantity: z.string().optional(),
  }).strict().optional(),
  action: z.object({ type: z.enum(ACTIONS), from: dose.optional(), to: dose.optional() }).strict().optional(),
  act: z.enum(ACTS).optional(),
  report: z.enum(REPORTS).optional(),
  actor: z.object({ name: z.string(), role: z.enum(["provider", "patient", "third_party", "unknown"]) }).strict().optional(),
  symptom: z.object({ terms: z.array(z.string()).min(1), severity: z.string().optional(), trajectory: z.string().optional() }).strict().optional(),
  diagnosis: z.object({ term: z.string() }).strict().optional(),
  encounter: z.object({ kind: z.string(), modality: z.string().optional(), provider: z.string().optional(), duration: z.string().optional() }).strict().optional(),
  // effective_time: when the asserted state or act applies. Documentation and testimony time are separate clocks.
  time: z.object({ date: dateText.nullable(), precision: z.enum(PRECISIONS), anchor: dateText.optional(), raw: z.string().optional() }).strict(),
  basis: z.enum(BASES),
  status: z.enum(STATUSES).default("asserted"),
  temporality: z.enum(TEMPORALITIES).default("current"),
  experiencer: z.enum(EXPERIENCERS).default("patient"),
  evidence: z.array(evidenceItem).min(1),
  note: z.string().optional(),
}).strict().superRefine((a, ctx) => {
  const issue = (message) => ctx.addIssue({ code: "custom", message });
  if (a.type === "medication" && !a.med) issue("medication assertion requires med");
  if (["medication", "instruction", "referral"].includes(a.type) && Boolean(a.act) === Boolean(a.report)) issue("exactly one of act or report is required for medication, instruction, and referral");
  if (a.type === "symptom" && !a.symptom) issue("symptom assertion requires symptom");
  if (a.type === "diagnosis" && !a.diagnosis) issue("diagnosis assertion requires diagnosis");
  if (a.type === "encounter" && !a.encounter) issue("encounter assertion requires encounter");
  if (a.time.date === null && !(a.time.anchor || a.time.precision === "unknown")) issue("undated time needs an anchor date or precision unknown");
  if (a.time.precision === "relative" && !a.time.anchor) issue("relative time needs an anchor date");
});

export const relationshipSchema = z.object({
  id: z.string().regex(/^medr_[a-z0-9-]+_\d{3}$/),
  type: z.enum(RELATIONSHIP_TYPES),
  from: z.string(),
  to: z.string(),
  basis: z.enum(["explicit_language", "code_inferred", "reviewer"]),
  status: z.enum(["proposed", "confirmed", "rejected"]).default("proposed"),
  evidence: z.array(evidenceItem).optional(),
  reason: z.string().optional(),
}).strict().superRefine((r, ctx) => {
  if (r.basis === "explicit_language" && !r.evidence?.length) ctx.addIssue({ code: "custom", message: "explicit_language relationship requires evidence" });
});

export const extractionFileSchema = z.object({
  contract: z.literal(MEDICAL_ASSERTION_CONTRACT),
  subject: z.string(),
  transcript_id: z.string(),
  source_file: z.string(),
  witness_block_id: z.string(),
  witness: z.string(),
  trial_day: z.number().int(),
  // Never inferred from a publisher display date; null until independently verified.
  proceeding_date: z.string().nullable(),
  segment_range: z.tuple([z.number().int(), z.number().int()]),
  extractor: z.object({ method: z.string(), rules: z.string(), reviewed: z.boolean() }).strict(),
  // Known defects in the source transcript (duplicated passages, timestamp gaps) that affect what can be cited.
  source_notes: z.array(z.string()).optional(),
  assertions: z.array(assertionSchema),
  relationships: z.array(relationshipSchema),
}).strict();

const clean = (text) => text.normalize("NFKC").replace(/[​-‍﻿]/g, "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();

// True when `span` appears verbatim (after whitespace and quote normalization) in the segment's text.
export function spanFound(segment, span) {
  return Boolean(segment) && clean(segment.text).includes(clean(span));
}

export function segmentsByIndex(segments) {
  return new Map(segments.map((segment) => [segment.segment_index, segment]));
}

// Structural + provenance validation. Returns error strings; empty means every span was found verbatim.
export function validateExtraction(file, segments) {
  const errors = [];
  const parsed = extractionFileSchema.safeParse(file);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) errors.push(`schema: ${issue.path.join(".")}: ${issue.message}`);
    return { errors, data: null };
  }
  const data = parsed.data;
  const bySegment = segmentsByIndex(segments);
  const [first, last] = data.segment_range;
  const ids = new Set();
  const checkEvidence = (owner, evidence) => {
    for (const { seg, span } of evidence) {
      const segment = bySegment.get(seg);
      if (!segment || seg < first || seg > last) { errors.push(`${owner}: segment ${seg} is outside witness block ${first}-${last}`); continue; }
      if (!clean(segment.text).includes(clean(span))) errors.push(`${owner}: span not found verbatim in segment ${seg}: "${span}"`);
    }
  };
  for (const a of data.assertions) {
    if (ids.has(a.id)) errors.push(`${a.id}: duplicate id`);
    ids.add(a.id);
    checkEvidence(a.id, a.evidence);
    const pool = clean(a.evidence.map((e) => bySegment.get(e.seg)?.text ?? "").join(" ")).toLowerCase();
    if (!pool.includes(clean(a.raw).toLowerCase())) errors.push(`${a.id}: raw text "${a.raw}" is not present in the cited segments`);
  }
  for (const r of data.relationships) {
    if (ids.has(r.id)) errors.push(`${r.id}: duplicate id`);
    ids.add(r.id);
    if (r.evidence) checkEvidence(r.id, r.evidence);
  }
  const known = new Set(data.assertions.map((a) => a.id));
  for (const r of data.relationships) for (const end of [r.from, r.to]) if (!known.has(end)) errors.push(`${r.id}: unknown assertion ${end}`);
  return { errors, data };
}

// ---- Medication key normalization (reversible: the raw name stays on the assertion) ----
export function medicationKey(name, keys) {
  const lower = name.toLowerCase().replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
  for (const [key, aliases] of Object.entries(keys)) {
    if (aliases.some((alias) => new RegExp(`(^|[^a-z])${alias.toLowerCase()}([^a-z]|$)`).test(lower))) return key;
  }
  return `unmapped:${lower}`;
}

const firstSegment = (a) => Math.min(...a.evidence.map((e) => e.seg));
const sortDate = (a) => a.time.date ?? a.time.anchor ?? "9999";
const byTime = (a, b) => (sortDate(a) < sortDate(b) ? -1 : sortDate(a) > sortDate(b) ? 1 : firstSegment(a) - firstSegment(b));
const doseText = (d) => (d ? `${d.value} ${d.unit}` : null);
const doseValue = (text) => (text ? Number(text.split(" ")[0]) : null);
const doseUnit = (text) => (text ? text.split(" ")[1] : null);
const eventKey = (e) => `${e.date ?? e.anchor ?? "9999"}#${String(Math.min(...e.segments)).padStart(6, "0")}`;

// ---- Projection: medication lineage (derived view, never the stored truth) ----
export function buildMedicationLineages(assertions, keys) {
  const groups = new Map();
  for (const a of assertions.filter((x) => x.med)) {
    const key = medicationKey(a.med.name, keys);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(a);
  }
  return [...groups.entries()].map(([medication_key, list]) => ({
    medication_key,
    names_raw: [...new Set(list.map((a) => a.med.name))],
    events: list.sort(byTime).map((a) => ({
      id: a.id,
      date: a.time.date, precision: a.time.precision, anchor: a.time.anchor ?? null, time_raw: a.time.raw ?? null,
      track: a.act ? "clinician_act" : "reported",
      act: a.act ?? null, report: a.report ?? null,
      action: a.action?.type ?? null,
      action_from: doseText(a.action?.from), action_to: doseText(a.action?.to),
      dose: doseText(a.med.dose), dose_raw: a.med.dose_raw ?? null, frequency: a.med.frequency ?? null,
      prescriber: a.med.prescriber ?? null, quantity: a.med.quantity ?? null,
      basis: a.basis, status: a.status, temporality: a.temporality,
      segments: a.evidence.map((e) => e.seg), note: a.note ?? null,
    })),
  })).sort((x, y) => x.medication_key.localeCompare(y.medication_key));
}

// ---- Projection: conflict / review candidates (proposals only, always unresolved) ----
export function detectMedicalConflicts(lineages) {
  const out = [];
  const push = (c) => out.push({ reconciliation: "unresolved", severity: "review", ...c });
  const live = (e) => e.status !== "negated" && e.temporality === "current";
  for (const line of lineages) {
    const key = line.medication_key;
    const events = line.events;
    // Dose state: does each documented dose follow from the last one?
    let last = null;
    for (const e of events.filter(live)) {
      const from = e.action_from;
      // The same change stated again (for example on cross-examination) corroborates; it is not a new dose state.
      if (last && e.action_to && e.action_to === last.state && (e.date ?? e.anchor) === last.when) continue;
      if (from && last && doseUnit(from) === doseUnit(last.state) && doseValue(from) !== doseValue(last.state)) {
        push({ earlier: last.id, later: e.id, medication_key: key, relationship: "action_from_dose_disagrees_with_prior_state",
          reason: `${e.id} says the change starts from ${from}, but the last documented dose before it (${last.id}) was ${last.state}. No event between them explains the difference.` });
      } else if (e.dose && last && doseUnit(e.dose) === doseUnit(last.state) && doseValue(e.dose) !== doseValue(last.state) && !(e.action && (e.action_from === last.state || e.action_to === e.dose))) {
        push({ earlier: last.id, later: e.id, medication_key: key, relationship: "possible_dose_transition",
          reason: `Later source records ${e.dose} after ${last.state}, but no explicit dose-change event was located between the assertions.` });
      }
      const state = e.action_to ?? e.dose;
      if (state) last = { id: e.id, state, when: e.date ?? e.anchor };
    }
    // Stop instruction followed by a report of taking.
    for (const stop of events.filter((e) => live(e) && e.track === "clinician_act" && e.action === "discontinue")) {
      const later = events.find((e) => live(e) && e.report === "patient_reported_taking" && eventKey(e) > eventKey(stop));
      if (later) push({ earlier: stop.id, later: later.id, medication_key: key, relationship: "reported_taking_after_stop_instruction",
        reason: `A stop instruction (${stop.id}) is followed by a report of taking the medication (${later.id}).` });
    }
    // Taper discussed, but no later report shows a dose at or below its target.
    const tapers = events.filter((e) => live(e) && e.action === "taper" && e.track === "clinician_act");
    // One review per taper date; prefer the statement that gives a target dose.
    const taperByDate = new Map();
    for (const t of tapers) { const day = t.date ?? t.anchor; if (!taperByDate.has(day) || (!taperByDate.get(day).action_to && t.action_to)) taperByDate.set(day, t); }
    for (const taper of taperByDate.values()) {
      const target = doseValue(taper.action_to);
      const later = events.filter((e) => live(e) && eventKey(e) > eventKey(taper) && ["patient_reported_taking", "patient_reported_prescribed"].includes(e.report));
      const completed = later.some((e) => e.dose && target !== null && doseValue(e.dose) <= target);
      if (later.length && !completed) push({ earlier: taper.id, later: later[0].id, medication_key: key, relationship: "taper_status_unresolved",
        reason: `A taper to ${taper.action_to ?? "a lower dose"} was discussed (${taper.id}); later reports (${later.map((l) => `${l.id}${l.dose ? ` ${l.dose}` : " dose not stated"}`).join(", ")}) do not show it carried out.` });
    }
    // Same-date contradictory reports.
    const reports = events.filter((e) => e.report && e.status !== "negated" && e.temporality === "current");
    for (const taking of reports.filter((e) => e.report === "patient_reported_taking")) {
      const clash = reports.find((e) => ["patient_reported_not_taking", "patient_reported_stopping"].includes(e.report) && (e.date ?? e.anchor) === (taking.date ?? taking.anchor));
      if (clash) push({ earlier: taking.id, later: clash.id, medication_key: key, relationship: "same_date_contradictory_reports",
        reason: `Both a report of taking (${taking.id}) and a report of not taking or stopping (${clash.id}) are recorded for ${taking.date ?? taking.anchor}.` });
    }
    // Prescribed with no later report of what happened.
    for (const rx of events.filter((e) => live(e) && e.act === "prescribed")) {
      const after = events.some((e) => e.report && e.report !== "patient_reported_past_use" && eventKey(e) >= eventKey(rx));
      if (!after) push({ earlier: rx.id, later: null, medication_key: key, relationship: "prescribed_without_reported_uptake", severity: "info",
        reason: `${rx.id} is a prescription with no later report in this testimony of whether it was started, taken, or stopped.` });
    }
    if (!events.some((e) => e.basis === "firsthand_provider" && e.track === "clinician_act")) {
      push({ earlier: events[0].id, later: null, medication_key: key, relationship: "no_firsthand_provider_event", severity: "info",
        reason: "Every event for this medication is a patient statement, a record read aloud, or another provider's action relayed to the witness." });
    }
    for (const e of events.filter((x) => x.date === null && x.anchor === null)) {
      push({ earlier: e.id, later: null, medication_key: key, relationship: "undated_event", severity: "info", reason: `${e.id} has no date or anchor.` });
    }
  }
  return out.map((c, index) => ({ conflict_id: `medc_${String(index + 1).padStart(3, "0")}`, ...c }));
}

// ---- Projection: clinical chronology ----
export function summarize(a) {
  const who = a.actor ? `${a.actor.name}: ` : "";
  if (a.med) {
    const dose = a.med.dose ? ` ${doseText(a.med.dose)}` : a.med.dose_raw ? ` (${a.med.dose_raw})` : "";
    const change = a.action ? ` [${a.action.type}${a.action.from ? ` from ${doseText(a.action.from)}` : ""}${a.action.to ? ` to ${doseText(a.action.to)}` : ""}]` : "";
    return `${who}${a.act ?? a.report}: ${a.med.name}${dose}${change}`;
  }
  if (a.symptom) return `${who}${a.symptom.terms.join(", ")}${a.symptom.trajectory ? ` (${a.symptom.trajectory})` : ""}`;
  if (a.diagnosis) return `${who}diagnosis: ${a.diagnosis.term}`;
  if (a.encounter) return `${a.encounter.kind}${a.encounter.provider ? ` with ${a.encounter.provider}` : ""}${a.encounter.modality ? `, ${a.encounter.modality}` : ""}`;
  return `${who}${a.act ?? a.report ?? "observation"}: ${a.raw}`;
}

export function buildClinicalTimeline(assertions, relationships) {
  const days = new Map();
  for (const a of [...assertions].sort(byTime)) {
    const day = a.time.date ?? (a.time.anchor ? `${a.time.anchor} (relative)` : "undated");
    if (!days.has(day)) days.set(day, []);
    days.get(day).push({
      id: a.id, type: a.type, summary: summarize(a), status: a.status, temporality: a.temporality, basis: a.basis,
      precision: a.time.precision, time_raw: a.time.raw ?? null, segments: a.evidence.map((e) => e.seg),
    });
  }
  return { days: [...days.entries()].map(([date, items]) => ({ date, items })), relationships };
}

// ---- Acceptance expectations (hand-built ground truth the projections must reproduce) ----
export function checkExpectations(assertions, expectations, keys) {
  return expectations.map((expectation) => {
    const hit = assertions.find((a) => {
      if (!a.med || medicationKey(a.med.name, keys) !== expectation.medication_key) return false;
      if (expectation.act && a.act !== expectation.act) return false;
      if (expectation.report && a.report !== expectation.report) return false;
      if (expectation.action && a.action?.type !== expectation.action) return false;
      if (expectation.dose && doseText(a.action?.to ?? a.med.dose) !== expectation.dose) return false;
      if (expectation.date && (a.time.date ?? a.time.anchor) !== expectation.date) return false;
      return true;
    });
    return { ...expectation, met: Boolean(hit), matched: hit?.id ?? null };
  });
}

export function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i += 1; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

// ---- Human-readable report ----
export function renderReport({ data, lineages, conflicts, timeline, expectations, csvCoverage }) {
  const count = (list, pick) => list.reduce((acc, item) => ({ ...acc, [pick(item)]: (acc[pick(item)] ?? 0) + 1 }), {});
  const table = (obj) => Object.entries(obj).sort().map(([k, v]) => `| ${k} | ${v} |`).join("\n");
  const lines = [];
  lines.push(`# Medical assertions: ${data.witness}, Trial Day ${data.trial_day}`, "");
  lines.push(`Source: \`${data.source_file}\`, witness block ${data.witness_block_id}, segments ${data.segment_range[0]}-${data.segment_range[1]}.`);
  lines.push(`Proceeding date: ${data.proceeding_date ?? "not independently verified"}. Reviewed by a person: ${data.extractor.reviewed ? "yes" : "no"}.`);
  lines.push("", "Research artifact. Nothing here is a verified fact or a T0 entry; every value carries a verbatim span from the transcript.", "");
  lines.push("## Counts", "", `${data.assertions.length} assertions, ${data.relationships.length} relationships, ${conflicts.length} review candidates.`, "");
  lines.push("| type | n |", "|---|---|", table(count(data.assertions, (a) => a.type)), "");
  lines.push("| knowledge basis | n |", "|---|---|", table(count(data.assertions, (a) => a.basis)), "");
  lines.push("## Medication lineages", "");
  for (const line of lineages) {
    lines.push(`### ${line.medication_key} (${line.names_raw.join(", ")})`, "", "| date | track | what | dose | prescriber | basis | status |", "|---|---|---|---|---|---|---|");
    for (const e of line.events) {
      const when = e.date ?? (e.anchor ? `~${e.anchor} (${e.time_raw ?? "relative"})` : "undated");
      const what = [e.act ?? e.report, e.action ? `[${e.action}${e.action_from ? ` from ${e.action_from}` : ""}${e.action_to ? ` to ${e.action_to}` : ""}]` : ""].filter(Boolean).join(" ");
      lines.push(`| ${when} | ${e.track} | ${what} | ${e.dose ?? e.dose_raw ?? ""} | ${e.prescriber ?? ""} | ${e.basis} | ${e.status}/${e.temporality} |`);
    }
    lines.push("");
  }
  lines.push("## Review candidates", "");
  for (const c of conflicts.filter((x) => x.severity === "review")) lines.push(`- **${c.medication_key}** \`${c.relationship}\` (${c.earlier}${c.later ? ` -> ${c.later}` : ""}): ${c.reason}`);
  const info = conflicts.filter((c) => c.severity === "info");
  lines.push("", `${info.length} informational notes (${Object.entries(count(info, (c) => c.relationship)).map(([k, v]) => `${k}: ${v}`).join("; ")}).`, "");
  if (expectations) {
    lines.push("## Acceptance expectations", "", `${expectations.filter((x) => x.met).length}/${expectations.length} met.`, "");
    for (const x of expectations) lines.push(`- ${x.met ? "PASS" : "FAIL"} ${x.label} ${x.matched ? `(${x.matched})` : ""}`);
    lines.push("");
  }
  if (csvCoverage) {
    lines.push("## Coverage against Medication-Documentedtimeline.csv", "");
    for (const row of csvCoverage) lines.push(row.key.startsWith("unmapped:") ? `- unmapped CSV row name "${row.name}" (check the CSV; no medication key matches)` : `- ${row.covered ? "in extraction" : "not in this testimony block"}: ${row.name} -> ${row.key}`);
    lines.push("");
  }
  lines.push("## Clinical chronology", "");
  for (const day of timeline.days) {
    lines.push(`### ${day.date}`, "");
    for (const item of day.items) lines.push(`- ${item.summary}${item.status !== "asserted" ? ` (${item.status})` : ""}${item.temporality !== "current" ? ` (${item.temporality})` : ""} — seg ${item.segments.join(", ")}`);
    lines.push("");
  }
  return lines.join("\n");
}
