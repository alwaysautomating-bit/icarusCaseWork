import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";

const observedSchema = z.object({ witness: z.string(), text: z.string(), cites: z.array(z.string()) });

const stepSchema = z.object({
  id: z.string(),
  title: z.string(),
  relation: z.enum(["before", "at", "after"]),
  coverage: z.enum(["none", "partial", "recorded", "witnessed"]),
  anchor: z.boolean().optional(),
  quote: z.object({ text: z.string(), cites: z.array(z.string()) }).nullable(),
  summary: z.string(),
  observed_by: z.array(observedSchema),
  scene_effect: z.string().nullable(),
});

const discoverySchema = z.object({
  schema_version: z.string(),
  title: z.string(),
  intro: z.string(),
  reading_note: z.string(),
  steps: z.array(stepSchema),
  scream: z.object({
    question: z.string(),
    points: z.array(z.object({ kind: z.enum(["responder", "testimony", "recording"]), source: z.string(), text: z.string(), cites: z.array(z.string()) })),
    reading: z.string(),
    caution: z.string(),
  }),
  unobserved: z.object({
    title: z.string(),
    start: z.string(),
    end: z.string(),
    first_seen: z.array(z.object({ child: z.string(), by: z.string(), text: z.string(), cites: z.array(z.string()) })),
    changed: z.array(z.string()),
    cannot_account_for: z.array(z.string()),
  }),
  scene_state: z.array(z.object({ subject: z.string(), patrick: z.string(), responders: z.string(), cites: z.array(z.string()), not_mentioned: z.string() })),
  open_questions: z.array(z.string()),
});

export type PatrickDiscovery = z.infer<typeof discoverySchema>;

export async function getPatrickDiscovery(): Promise<PatrickDiscovery> {
  const file = path.join(process.cwd(), "content", "timelines", "patrick", "discovery-v1.json");
  return discoverySchema.parse(JSON.parse(await fs.readFile(file, "utf8")));
}

export const COVERAGE_LABELS = {
  none: "Not observed by anyone else",
  partial: "Partly observed",
  recorded: "Recorded on the 911 line",
  witnessed: "Witnessed by several responders",
} as const;
