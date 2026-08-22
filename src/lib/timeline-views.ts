import { z } from "zod";

export const timelineSnapshotRunSchema = z.object({
  id: z.uuid(),
  compiler_name: z.string(),
  compiler_version: z.string(),
  contract_version: z.string(),
  configuration_sha256: z.string(),
  status: z.string(),
  created_at: z.string(),
  completed_at: z.string().nullable(),
});

export const timelineSnapshotItemSchema = z.object({
  event_candidate_id: z.uuid(),
  event_candidate_code: z.string(),
  neutral_description: z.string(),
  event_class: z.string().nullable(),
  source_wording: z.string().nullable(),
  participant_mentions: z.unknown(),
  event_recurrence_pattern: z.unknown(),
  source_claim_ids: z.array(z.uuid()),
  event_status: z.string(),
  event_confidence: z.coerce.number(),
  temporal_assertion_id: z.uuid(),
  temporal_assertion_code: z.string(),
  raw_temporal_language: z.string(),
  precision: z.string(),
  asserted_start: z.string().nullable(),
  asserted_end: z.string().nullable(),
  asserted_date: z.string().nullable(),
  asserted_time_of_day_start: z.string().nullable(),
  asserted_time_of_day_end: z.string().nullable(),
  time_of_day_band: z.string().nullable(),
  qualification: z.string(),
  qualifier_text: z.string().nullable(),
  confidence_basis: z.string(),
  sequence_language: z.string().nullable(),
  duration_iso8601: z.string().nullable(),
  relative_offset_value: z.coerce.number().int().nullable(),
  relative_offset_unit: z.string().nullable(),
  temporal_recurrence_pattern: z.unknown(),
  temporal_status: z.string(),
  temporal_confidence: z.coerce.number(),
  source_segment_ids: z.array(z.uuid()),
  asserted_by_raw: z.string().nullable(),
  proceeding_id: z.uuid(),
  proceeding_title: z.string(),
  proceeding_date: z.string().nullable(),
  extraction_run_id: z.uuid(),
});

export const timelineSnapshotSchema = z.object({
  schema_version: z.literal("timeline-candidate-view/1.0"),
  captured_at: z.string(),
  runs: z.array(timelineSnapshotRunSchema),
  items: z.array(timelineSnapshotItemSchema),
});

export type TimelineSnapshotRun = z.infer<typeof timelineSnapshotRunSchema>;
export type TimelineSnapshotItem = z.infer<typeof timelineSnapshotItemSchema>;
export type TimelineSnapshot = z.infer<typeof timelineSnapshotSchema>;

export type SavedTimelineView = {
  id: string;
  name: string;
  version: number;
  description: string;
  extractionRunIds: string[];
  eventCandidateIds: string[];
  temporalAssertionIds: string[];
  viewState: Record<string, unknown>;
  snapshot: TimelineSnapshot;
  createdBy: string;
  createdAt: string;
};
