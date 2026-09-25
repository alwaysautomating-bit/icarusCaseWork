import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadTrajectory } from "../src/lib/medical-trajectory";
import { daysBetween, fullWindow, medicationLanes, trajectoryFacts, type Evidence, type Lane, type SupportCard, type TrajectoryEvent } from "../src/lib/medical-trajectory-model";

/**
 * Renders the full Care Trajectory tab as a markdown report. The loader is server-only, so run with the
 * react-server condition:  node --conditions=react-server --import tsx scripts/generate-care-trajectory-report.ts
 */
const data = await loadTrajectory("report");
const { events, support, settings } = data;
const full = fullWindow(events, support);
const facts = trajectoryFacts(events, full);
const episodeStart = events.find((e) => e.lane === "care")?.date ?? full.start;

const LANE: Record<Lane, string> = { medication: "Medication", state: "Clinical state", safety: "Safety and risk", diagnostic: "Diagnostic model", care: "Care contacts" };
const PROV = { clinician: "Clinician act", reported: "Patient report", record: "Read from record", relayed: "Relayed about another provider" } as const;
const BASIS: Record<string, string> = {
  firsthand_provider: "witness did or observed it", patient_statement_to_witness: "patient told the witness", record_read_by_witness: "read from a record",
  counsel_proposition_affirmed: "counsel's question, witness affirmed", third_party_report: "relayed about another provider", witness_general_knowledge: "general knowledge",
};
const KIND: Record<SupportCard["kind"], string> = { testimony: "Testimony", record: "Read from record", question_raised: "Raised in a question, not confirmed", source_needed: "Source needed", researcher_observation: "Researcher observation" };
const fmt = (iso: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const label = (key: string | null) => settings.find((s) => s.key === key)?.label ?? "not attributed";
const cite = (e: { day: number; seg: number }) => `Day ${e.day}, segment ${e.seg}`;
const one = (text: string) => text.replace(/\s+/g, " ").trim();
const quote = (e: { day: number; seg: number; span: string }) => `  - ${cite(e)}: “${one(e.span)}”`;
const titleCase = (key: string) => key.replace(/(^|-)([a-z])/g, (_, a: string, b: string) => `${a === "-" ? " " : ""}${b.toUpperCase()}`);

const eventBlock = (e: TrajectoryEvent) => {
  const lines = [
    `- **${fmt(e.date)}${e.approximate ? " (approximate)" : ""} · ${e.title}**`,
    `  - ${LANE[e.lane]} · ${PROV[e.provenance]} · ${BASIS[e.basis] ?? e.basis}${e.status === "uncertain" ? " · hedged" : ""}`,
    `  - Setting: ${label(e.setting)} · Testimony: ${e.days.map((d) => `Day ${d}`).join(" + ")}${e.days.length > 1 ? " (corroborated)" : ""}`,
  ];
  if (e.note) lines.push(`  - Note: ${one(e.note)}`);
  else if (e.summary && e.summary !== e.title) lines.push(`  - Testimony: ${one(e.summary)}`);
  for (const c of e.conflicts) lines.push(`  - **Flagged for review:** ${one(c)}`);
  lines.push(...e.evidence.slice(0, 3).map(quote));
  return lines.join("\n");
};

const cardBlock = (c: SupportCard) => {
  const lines = [`- **${c.date ? `${fmt(c.date)} · ` : ""}${c.title}** (${KIND[c.kind]})`, `  - ${one(c.detail)}`];
  for (const r of c.references ?? []) lines.push(`  - Reference: [${r.label}](${r.url}) — ${one(r.note)}`);
  lines.push(...c.sources.slice(0, 3).map(quote));
  return lines.join("\n");
};

const out: string[] = [];
out.push(
  "# Care Trajectory Report",
  "",
  `Generated: ${new Date().toISOString().slice(0, 10)}`,
  "Status: Projection of testimony extractions; not a clinical record and not a finding of fault.",
  "",
  "## Frame",
  "",
  "**Severity ≠ imminent dangerousness ≠ treatment response.** The tab separates three questions the questioning keeps compressing: how ill she was, whether she met the emergency threshold, and whether treatment was working. Each event shows what was said, by whom, and how they knew.",
  "",
  "## At a glance",
  "",
  "| Measure | Value |",
  "| --- | --- |",
  `| Window | ${fmt(full.start)} to ${fmt(full.end)} |`,
  `| Days of one episode | ${daysBetween(episodeStart, full.end) + 1} (from ${fmt(episodeStart)}) |`,
  `| Dated events | ${events.length} |`,
  `| Medications | ${facts.medications} |`,
  `| Care settings | ${settings.length} |`,
  `| Prescribing settings | ${facts.prescribers} |`,
  `| Support and stressor cards | ${support.length} (${support.filter((c) => c.kind === "source_needed").length} still need a source) |`,
  "",
  "Approximate dates and events flagged for review are marked inline.",
  "",
  "## Continuing episode",
  "",
  `Analytical frame: a persistent episode without demonstrated stabilization, running ${fmt(episodeStart)} to ${fmt(full.end)}. Starting a new medication does not reset the episode clock.`,
  "",
  "## Who held the plan (care contacts by setting)",
  "",
);
for (const s of settings) {
  const list = events.filter((e) => e.setting === s.key && (e.lane === "care" || e.lane === "medication"));
  if (!list.length) continue;
  out.push(`### ${s.label} (${s.person})`, "", ...list.map((e) => `- ${fmt(e.date)}${e.approximate ? " ≈" : ""} · ${e.title}`), "");
}
out.push("## Medication", "", "Span is first to last documented event, not continuous use.", "");
for (const lane of medicationLanes(events, full)) {
  const prescribers = lane.settings.map(label).join(", ") || "prescriber not stated";
  out.push(`### ${titleCase(lane.medication)}`, "", `${fmt(lane.first)} to ${fmt(lane.last)} · ${prescribers}`, "");
  for (const c of lane.clusters) out.push(...c.events.map(eventBlock));
  out.push("");
}
for (const lane of ["state", "safety", "diagnostic"] as const) {
  out.push(`## ${LANE[lane]}`, "");
  const list = events.filter((e) => e.lane === lane);
  out.push(...(list.length ? list.map(eventBlock) : ["None documented."]), "");
}
out.push("## Care contacts, referrals and instructions", "", ...events.filter((e) => e.lane === "care").map(eventBlock), "");

out.push(
  `## The documented sequence · ${fmt(data.sequenceFrame.start)} to ${fmt(data.sequenceFrame.end)}`,
  "",
  "*Ill, charted as deteriorating, and not an imminent danger, all at once.*",
  "",
  `**${daysBetween(data.sequenceFrame.start, data.sequenceFrame.end)} days:** ${data.sequenceFrame.label}. The last antidepressant trial and its increase fall inside this window.`,
  "",
  ...data.sequence.map(cardBlock),
  "",
  "## Ownership of care",
  "",
  "Each line is testimony. Whether it amounts to a gap in ownership is the analytical question, and it is left open.",
  "",
  ...data.ownershipSignals.map(cardBlock),
  "",
  "### Questions the record invites",
  "",
  ...data.questions.map((q) => `- ${one(q.text)} *(${one(q.origin)})*`),
  "",
  "## Support and stressors",
  "",
  "Cards from testimony show their quotes. Cards raised in a question say so. Cards that need a source assert nothing until one is added.",
  "",
  ...support.map(cardBlock),
  "",
  "## Frame and sources",
  "",
  "The question is systemic: who owned the plan while the episode continued. Family and household context appears only where a source is loaded; the rest is marked as needing one.",
  "",
  ...data.sources.map((s) => `- ${s.witness}, Day ${s.day}${s.reviewed ? "" : " (extraction not yet reviewed)"}`),
  ...(data.sourceNotes.length ? ["", "Source notes:", ...data.sourceNotes.map((n) => `- ${one(n)}`)] : []),
  "",
);

const target = path.join(process.cwd(), "reports", "care-trajectory-report.md");
await mkdir(path.dirname(target), { recursive: true });
await writeFile(target, out.join("\n"), "utf8");
console.log(`Wrote ${target} (${events.length} events, ${support.length} support cards)`);
