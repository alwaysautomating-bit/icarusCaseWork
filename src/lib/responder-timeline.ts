import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";

const assertionSchema = z.object({ witness: z.string() }).catchall(z.unknown());

const eventSchema = z.object({
  id: z.string(),
  order: z.number(),
  phase: z.string(),
  title: z.string(),
  type: z.string(),
  occurred_at: z.string().optional(),
  precision: z.string().optional(),
  raw_temporal_expression: z.string().optional(),
  actors: z.array(z.string()).optional(),
  patients: z.array(z.string()).optional(),
  units: z.array(z.string()).optional(),
  unit: z.string().optional(),
  destination: z.string().optional(),
  confidence: z.string().optional(),
  anchor_relation: z.enum(["before", "at", "after"]),
  sources: z.array(z.string()).optional(),
  assertions: z.array(assertionSchema).optional(),
  constraints: z.object({ before: z.array(z.string()).optional(), after: z.array(z.string()).optional() }).optional(),
  overlaps_with: z.array(z.string()).optional(),
  sequence: z.array(z.string()).optional(),
  observations: z.array(z.string()).optional(),
  actions: z.array(z.string()).optional(),
  note: z.string().optional(),
  caveat: z.string().optional(),
  significance: z.string().optional(),
  description: z.string().optional(),
  finding: z.string().optional(),
  observation: z.string().optional(),
  source_assertion: z.string().optional(),
  evidence_reference: z.string().optional(),
  duration_minutes: z.number().optional(),
  start_event: z.string().optional(),
  end_event: z.string().optional(),
});

const constraintSchema = z.object({
  before: z.string().optional(),
  after: z.string().optional(),
  overlap: z.array(z.string()).optional(),
  duration: z.object({ start: z.string(), end: z.string(), minutes: z.number(), precision: z.string() }).optional(),
  basis: z.string(),
});

const unresolvedSchema = z.object({
  id: z.string(),
  issue: z.string(),
  status: z.string(),
  assertions: z.array(z.string()).optional(),
  handling: z.string().optional(),
});

const alignmentCellSchema = z.object({ text: z.string(), sources: z.array(z.string()) });

const anchorSchema = z.object({
  id: z.string(),
  label: z.string(),
  event_id: z.string(),
  definition: z.string(),
  rationale: z.string(),
  witness_alignment: z.array(z.object({
    witness: z.string(),
    role: z.string(),
    before: alignmentCellSchema,
    at: alignmentCellSchema,
    after: alignmentCellSchema,
  })),
});

const laneSchema = z.object({ key: z.string(), label: z.string(), summary: z.string(), steps: z.array(z.string()) });

const patrickSchema = z.object({
  intro: z.string(),
  entries: z.array(z.object({
    relation: z.enum(["before", "at", "after"]),
    witness: z.string(),
    text: z.string(),
    sources: z.array(z.string()),
    event_ids: z.array(z.string()),
  })),
  not_attested: z.array(z.string()),
});

const discrepancySchema = z.object({ id: z.string(), issue: z.string(), assertions: z.array(z.string()), handling: z.string() });

const timelineSchema = z.object({
  schema_version: z.string(),
  title: z.string(),
  status: z.string(),
  methodology: z.object({
    clock_anchor: z.object({ event: z.string(), time: z.string(), precision: z.string() }),
    rules: z.array(z.string()),
  }),
  anchor: anchorSchema,
  lanes: z.array(laneSchema),
  patrick_positions: patrickSchema,
  discrepancies: z.array(discrepancySchema),
  events: z.array(eventSchema),
  critical_constraints: z.array(constraintSchema),
  unresolved: z.array(unresolvedSchema),
});

export type ResponderTimeline = z.infer<typeof timelineSchema>;
export type ResponderEvent = z.infer<typeof eventSchema>;
export type ResponderConstraint = z.infer<typeof constraintSchema>;
export type ResponderUnresolved = z.infer<typeof unresolvedSchema>;
export type ResponderAnchor = z.infer<typeof anchorSchema>;
export type ResponderLane = z.infer<typeof laneSchema>;
export type AnchorRelation = ResponderEvent["anchor_relation"];

export const BAND_LABELS: Record<AnchorRelation, string> = { before: "Before T₀", at: "T₀ · the scream", after: "After T₀" };

export async function getResponderTimeline(): Promise<ResponderTimeline> {
  const file = path.join(process.cwd(), "content", "timelines", "first-responders", "v3-anchored.json");
  return timelineSchema.parse(JSON.parse(await fs.readFile(file, "utf8")));
}

const PHASE_LABELS: Record<string, string> = {
  dispatch: "Dispatch",
  initial_response: "Initial response",
  parallel_before_scream: "Before the scream — parallel activity",
  child_discovery: "Scream and child discovery",
  dawson_extraction: "Dawson extraction",
  parallel_post_scream: "After the scream — parallel activity",
  cora_callan: "Cora and Callan",
  escalation: "Escalation and mutual aid",
  recalled_response: "Recalled response",
  lindsay_transport: "Lindsay transport",
  dawson_transport: "Dawson transport",
  cora_transport: "Cora transport",
  callan_transport: "Callan transport",
  hospital: "Hospital handoff",
  scene_control: "Scene control",
};

export function phaseLabel(phase: string) {
  return PHASE_LABELS[phase] ?? phase.replaceAll("_", " ");
}

export type ConfidenceTone = "anchor" | "supported" | "single" | "conflict";

const CONFIDENCE: Record<string, { label: string; tone: ConfidenceTone }> = {
  clock_anchor: { label: "Clock anchor", tone: "anchor" },
  corroborated: { label: "Corroborated", tone: "supported" },
  supported: { label: "Supported", tone: "supported" },
  corroborated_candidate_shared_event: { label: "Candidate shared event", tone: "supported" },
  single_witness: { label: "Single witness", tone: "single" },
  conflict: { label: "Conflict", tone: "conflict" },
  event_supported_attribution_conflict: { label: "Event supported · attribution conflict", tone: "conflict" },
  attribution_unresolved: { label: "Attribution unresolved", tone: "conflict" },
};

export function confidenceInfo(value: string | undefined) {
  if (!value) return null;
  return CONFIDENCE[value] ?? { label: value.replaceAll("_", " "), tone: "single" as ConfidenceTone };
}

export function typeLabel(value: string) {
  return value.replaceAll("_", " ");
}
