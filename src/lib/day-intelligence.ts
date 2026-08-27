import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const contractVersion = z.literal("day-intelligence/1.0");
const reviewStatus = z.enum(["generated", "needs_review", "accepted", "amended", "rejected", "deferred"]);
const sourceLinkageStatus = z.enum(["complete", "source_linkage_incomplete"]);
const epistemicClass = z.enum([
  "source_statement", "witness_testimony", "expert_opinion", "party_position", "court_ruling", "stipulation",
  "analytical_inference", "working_conclusion", "evidence_chain", "relationship", "tension", "risk",
  "research_question", "research_action", "memory_candidate", "handoff_state",
]);
const itemSection = z.enum([
  "insights", "positions_working_conclusions", "evidence_chains", "relationships", "risks_tensions",
  "open_questions", "actions", "memory_candidates", "handoff",
]);

const sourceSchema = z.object({
  source_segment_id: z.string().min(1).nullable(),
  source_artifact_id: z.string().min(1).nullable().optional(),
  proceeding_id: z.string().min(1).nullable().optional(),
  speaker_name: z.string().min(1).nullable().optional(),
  speaker_capacity: z.string().min(1).nullable().optional(),
  examination_phase: z.string().min(1).nullable().optional(),
  locator: z.object({ type: z.string().min(1), value: z.string().min(1) }).nullable().optional(),
  role: z.enum(["primary_source", "supports", "contradicts", "qualifies", "relied_on", "omitted_from_review", "independent_anchor", "originates_from", "repeats", "derived_from", "context_only"]),
  source_status: z.enum(["canonical", "derivative", "reported", "unknown"]).optional(),
});

const itemSchema = z.object({
  item_id: z.string().min(1),
  section: itemSection,
  epistemic_class: epistemicClass,
  title: z.string().min(1),
  content: z.string().min(1),
  importance: z.enum(["high", "medium", "low"]),
  extraction_confidence: z.number().min(0).max(1),
  evidentiary_assessment: z.enum(["direct", "corroborated", "partially_corroborated", "single_source", "derived", "conflicted", "unsupported", "not_assessed"]),
  source_linkage_status: sourceLinkageStatus,
  review_status: reviewStatus,
  sources: z.array(sourceSchema),
  tags: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([]),
});

const summarySchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().min(1),
  one_liner: z.string().min(1),
  purpose: z.string().min(1),
  what_changed: z.string().min(1),
  primary_topics: z.array(z.string()),
});

const authoritySchema = z.object({
  evidentiary_source_of_record: z.literal("source_artifact + source_segments"),
  canonical_analytical_representation: z.literal("context.md"),
});

const cardSchema = z.object({
  id: z.string().min(1),
  profile: z.literal("legal_case_analysis"),
  contract_version: contractVersion,
  artifact_set_id: z.string().min(1),
  case_id: z.string().min(1),
  trial_day_id: z.string().min(1),
  day_number: z.number().int().positive(),
  version: z.number().int().positive(),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  one_liner: z.string().min(1),
  purpose: z.string().min(1),
  what_changed: z.string().min(1),
  primary_topics: z.array(z.string()),
  review_status: reviewStatus,
  source_linkage_status: z.enum(["complete", "partial", "source_linkage_incomplete"]),
  item_counts: z.record(z.string(), z.number().int().nonnegative()),
  generated_at: z.string().min(1),
  authority: authoritySchema,
});

const agentPackSchema = z.object({
  version: z.string().min(1),
  profile: z.literal("legal_case_analysis"),
  contract_version: contractVersion,
  artifact_set_id: z.string().min(1),
  case_id: z.string().min(1),
  trial_day_id: z.string().min(1),
  day_number: z.number().int().positive(),
  artifact_version: z.number().int().positive(),
  supersedes_artifact_set_id: z.string().min(1).nullable(),
  source_record: z.object({
    proceeding_ids: z.array(z.string()),
    transcript_artifact_ids: z.array(z.string()),
    input_hashes: z.record(z.string(), z.string()),
    source_segment_namespace: z.literal("source_segments.id"),
    source_record_complete: z.boolean(),
  }),
  generation: z.object({
    created_at: z.string().min(1),
    collapse_skill: z.object({ name: z.literal("thread-collapse-handoff"), version: z.string().min(1), mode: z.literal("legal_evidentiary") }),
    compiler: z.object({ name: z.literal("context-card-compiler"), version: z.string().min(1), profile: z.literal("legal_case_analysis") }),
    model: z.object({ provider: z.string().min(1), name: z.string().min(1), version: z.string().min(1) }),
    configuration_hash: z.string().min(1),
  }),
  summary: summarySchema,
  items: z.array(itemSchema),
  limitations: z.array(z.object({ code: z.string().min(1), severity: z.enum(["material", "non_material"]), description: z.string().min(1), affected_item_ids: z.array(z.string()) })),
  governance: z.object({
    human_review_required: z.literal(true),
    auto_action_allowed: z.literal(false),
    audit_log_required: z.literal(true),
    analytical_acceptance_is_canonical_fact: z.literal(false),
    cross_day_auto_promotion_allowed: z.literal(false),
    scratchpad_input_allowed: z.literal(false),
  }),
  authority: authoritySchema.extend({ generated_projection: z.literal("agent-pack.json") }),
});

const relationshipSchema = z.object({
  relationship_id: z.string().min(1),
  from_item_id: z.string().min(1),
  to_item_id: z.string().min(1),
  relationship_type: z.enum(["supports", "contradicts", "qualifies", "relied_on", "omitted_from_review", "independent_anchor", "originates_from", "repeats", "derived_from", "context_only", "related_to"]),
  rationale: z.string().min(1),
  source_type: z.literal("declared"),
  review_status: z.literal("accepted"),
  confidence: z.literal(1),
});

const relationshipsSchema = z.object({
  contract_version: contractVersion,
  artifact_set_id: z.string().min(1),
  case_id: z.string().min(1),
  trial_day_id: z.string().min(1),
  day_number: z.number().int().positive(),
  version: z.number().int().positive(),
  relationships: z.array(relationshipSchema),
});

export type DayIntelligenceItem = z.infer<typeof itemSchema>;
export type DayIntelligenceCard = z.infer<typeof cardSchema>;
export type DayIntelligenceAgentPack = z.infer<typeof agentPackSchema>;
export type DayIntelligenceRelationships = z.infer<typeof relationshipsSchema>;

export type DayIntelligenceBundle = {
  directory: string;
  context: string;
  card: DayIntelligenceCard;
  agentPack: DayIntelligenceAgentPack;
  relationships: DayIntelligenceRelationships;
};

function isMissingFile(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function assertSynchronized(card: DayIntelligenceCard, agentPack: DayIntelligenceAgentPack, relationships: DayIntelligenceRelationships) {
  const identity = [card.artifact_set_id, agentPack.artifact_set_id, relationships.artifact_set_id];
  if (new Set(identity).size !== 1) throw new Error("Day Intelligence artifacts do not share one artifact_set_id.");
  const versions = [card.version, agentPack.artifact_version, relationships.version];
  if (new Set(versions).size !== 1) throw new Error("Day Intelligence artifacts do not share one version.");

  const itemIds = agentPack.items.map((item) => item.item_id);
  if (new Set(itemIds).size !== itemIds.length) throw new Error("Day Intelligence contains duplicate item IDs.");
  const knownItems = new Set(itemIds);
  for (const item of agentPack.items) {
    if (item.source_linkage_status === "complete" && item.sources.length > 0 && !item.sources.some((source) => source.source_segment_id)) {
      throw new Error(`Day Intelligence item ${item.item_id} is marked complete without an exact source segment.`);
    }
  }
  for (const relationship of relationships.relationships) {
    if (!knownItems.has(relationship.from_item_id) || !knownItems.has(relationship.to_item_id)) {
      throw new Error(`Day Intelligence relationship ${relationship.relationship_id} references an unknown item.`);
    }
  }
}

export function dayIntelligenceRoot() {
  return join(process.cwd(), "generated", "day-intelligence");
}

export async function getDayIntelligenceBundle(caseId: string, dayNumber: number, root = dayIntelligenceRoot()): Promise<DayIntelligenceBundle | null> {
  const dayDirectory = join(root, `day-${String(dayNumber).padStart(2, "0")}`);
  let entries;
  try {
    entries = await readdir(dayDirectory, { withFileTypes: true });
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }
  const versions = entries.flatMap((entry) => {
    const match = entry.isDirectory() ? /^v([1-9]\d*)$/.exec(entry.name) : null;
    return match ? [{ name: entry.name, version: Number(match[1]) }] : [];
  }).sort((a, b) => b.version - a.version);

  for (const version of versions) {
    const directory = join(dayDirectory, version.name);
    const [context, cardText, agentPackText, relationshipsText] = await Promise.all([
      readFile(join(directory, "context.md"), "utf8"),
      readFile(join(directory, "card.json"), "utf8"),
      readFile(join(directory, "agent-pack.json"), "utf8"),
      readFile(join(directory, "relationships.json"), "utf8"),
    ]);
    if (!context.trim()) throw new Error(`Day Intelligence ${version.name} has an empty context.md.`);
    const card = cardSchema.parse(JSON.parse(cardText));
    if (card.case_id !== caseId || card.day_number !== dayNumber) continue;
    const agentPack = agentPackSchema.parse(JSON.parse(agentPackText));
    const relationships = relationshipsSchema.parse(JSON.parse(relationshipsText));
    assertSynchronized(card, agentPack, relationships);
    return { directory, context, card, agentPack, relationships };
  }
  return null;
}
