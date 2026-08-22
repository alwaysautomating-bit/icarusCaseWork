import { z } from "zod";

export const trialIndexStatuses = ["planned", "in_progress", "completed", "adjourned", "no_court", "cancelled"] as const;
export const trialIndexPhases = ["pretrial", "prosecution", "defense", "rebuttal", "closings", "deliberations", "verdict", "other", "unknown"] as const;
export const trialIndexBases = ["canonical_record", "editorial_reference", "mixed", "planned"] as const;
export const witnessAppearanceStatuses = ["expected", "appeared", "continued", "reported", "unknown"] as const;
export const trialIndexReferenceKinds = ["reporting", "court_notice", "docket", "canonical_transcript", "other"] as const;

export const trialIndexWitnessSchema = z.object({
  name: z.string().trim().min(2).max(200),
  descriptor: z.string().trim().max(1_000).default(""),
  status: z.enum(witnessAppearanceStatuses).default("reported"),
  source_segment_id: z.union([z.uuid(), z.literal("")]).optional(),
  proceeding_speaker_id: z.union([z.uuid(), z.literal("")]).optional(),
  witness_block_id: z.union([z.uuid(), z.literal("")]).optional(),
});

export const trialIndexTopicSchema = z.object({
  label: z.string().trim().min(2).max(200),
  summary: z.string().trim().max(2_000).default(""),
  source_segment_id: z.union([z.uuid(), z.literal("")]).optional(),
});

export const trialIndexReferenceSchema = z.object({
  title: z.string().trim().min(2).max(300),
  url: z.url().max(2_000).refine((value) => value.startsWith("http://") || value.startsWith("https://")),
  publisher: z.string().trim().max(200).default(""),
  source_kind: z.enum(trialIndexReferenceKinds).default("reporting"),
});

export type TrialIndexWitness = z.infer<typeof trialIndexWitnessSchema>;
export type TrialIndexTopic = z.infer<typeof trialIndexTopicSchema>;
export type TrialIndexReference = z.infer<typeof trialIndexReferenceSchema>;

function meaningfulParts(line: string) {
  return line.split("|").map((part) => part.trim());
}

export function parseWitnessLines(value: string): TrialIndexWitness[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const [name, descriptor = "", status = "reported"] = meaningfulParts(line);
    const parsed = trialIndexWitnessSchema.safeParse({ name, descriptor, status: status || "reported" });
    if (!parsed.success) throw new Error(`Witness line ${index + 1} is invalid. Use: Name | role or context | appeared/continued/expected/reported.`);
    return parsed.data;
  });
}

export function parseTopicLines(value: string): TrialIndexTopic[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const [label, summary = ""] = meaningfulParts(line);
    const parsed = trialIndexTopicSchema.safeParse({ label, summary });
    if (!parsed.success) throw new Error(`Topic line ${index + 1} is invalid. Use: Topic | short navigation summary.`);
    return parsed.data;
  });
}

export function parseReferenceLines(value: string): TrialIndexReference[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const [title, url, publisher = "", source_kind = "reporting"] = meaningfulParts(line);
    const parsed = trialIndexReferenceSchema.safeParse({ title, url, publisher, source_kind: source_kind || "reporting" });
    if (!parsed.success) throw new Error(`Reference line ${index + 1} is invalid. Use: Title | https://… | publisher | reporting/court_notice/docket/canonical_transcript/other.`);
    return parsed.data;
  });
}

export function trialIndexSearchText(input: { headline: string; summary: string; witnesses: TrialIndexWitness[]; topics: TrialIndexTopic[] }) {
  return [input.headline, input.summary, ...input.witnesses.flatMap((item) => [item.name, item.descriptor]), ...input.topics.flatMap((item) => [item.label, item.summary])].join(" ").toLocaleLowerCase();
}
