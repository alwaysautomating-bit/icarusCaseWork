import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";

const laneKeys = ["occurrence", "patrick_account", "police_knowledge"] as const;
export type WarrantLane = (typeof laneKeys)[number];

const eventSchema = z.object({
  id: z.string(),
  time: z.string().nullable().optional(),
  time_precision: z.string().optional(),
  lane: z.enum(laneKeys),
  label: z.string(),
  assertion: z.string().optional(),
  after: z.array(z.string()).optional(),
  knowledge_type: z.string().optional(),
  originating_source: z.string().optional(),
  reported_by: z.string().optional(),
  actor_identification_weight: z.string().optional(),
  source_pages: z.array(z.number()),
  status: z.string(),
});
export type WarrantEvent = z.infer<typeof eventSchema>;

const timelineSchema = z.object({
  title: z.string(),
  case: z.string(),
  source: z.object({ file: z.string(), document_type: z.string(), packet_pages: z.string(), scope_note: z.string() }),
  events: z.array(eventSchema),
  critical_findings: z.array(z.string()),
  unresolved: z.array(z.string()),
});

const notesSchema = z.object({
  source_note: z.string(),
  state_transition: z.string(),
  reading_guide: z.string(),
  chain: z.array(z.string()),
  conclusion: z.string(),
  gaps: z.array(z.string()),
});

export async function getWarrantAttribution() {
  const dir = path.join(process.cwd(), "content", "timelines", "search-warrant");
  const [timeline, notes] = await Promise.all([
    fs.readFile(path.join(dir, "attribution-v1.json"), "utf8").then((raw) => timelineSchema.parse(JSON.parse(raw))),
    fs.readFile(path.join(dir, "attribution-notes-v1.json"), "utf8").then((raw) => notesSchema.parse(JSON.parse(raw))),
  ]);
  return { timeline, notes };
}

export const LANE_LABELS: Record<WarrantLane, { label: string; blurb: string }> = {
  occurrence: { label: "What occurred", blurb: "Errands, return, discovery, emergency response, medical events." },
  patrick_account: { label: "Patrick's account", blurb: "Each claim, with the time it was first documented." },
  police_knowledge: { label: "What police knew", blurb: "What investigators learned, from whom, and whether it identified the event, the mechanism, or the actor." },
};

export type WeightTone = "none" | "neutral" | "accusation" | "same-origin" | "circumstantial" | "formal" | "later";

const WEIGHTS: Record<string, { label: string; tone: WeightTone }> = {
  none: { label: "Identifies no actor", tone: "none" },
  actor_neutral: { label: "Actor-neutral", tone: "neutral" },
  primary_initial_identification: { label: "First actor identification", tone: "accusation" },
  supports_existing_accusation_same_origin: { label: "Same origin as the accusation", tone: "same-origin" },
  circumstantial: { label: "Circumstantial", tone: "circumstantial" },
  formalized_probable_cause: { label: "Formal attribution", tone: "formal" },
  not_available_for_15_45_arrest_warrant: { label: "Collected after the arrest warrant", tone: "later" },
};

export function weightInfo(value: string | undefined) {
  if (!value) return null;
  return WEIGHTS[value] ?? { label: value.replaceAll("_", " "), tone: "neutral" as WeightTone };
}

export function formatWarrantTime(event: WarrantEvent, titles: Map<string, string>) {
  if (event.time) {
    const [date = "", clock = ""] = event.time.split("T");
    const day = date === "2023-01-24" ? "Jan 24" : date === "2023-01-25" ? "Jan 25" : date;
    const hhmm = event.time_precision === "exact_to_second" ? clock : clock.slice(0, 5);
    return `${day} · ${event.time_precision === "approximate" ? "~" : ""}${hhmm}`;
  }
  if (event.time_precision?.startsWith("unknown_after")) return "Jan 24 · between 17:55:01 and about 18:11";
  if (event.after?.length) return `Follows ${event.after.map((id) => titles.get(id) ?? id).join("; ")}`;
  return "Time not stated";
}

export function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}
