alter table public.event_candidates
  add column event_class text,
  add column source_wording text,
  add column recurrence_pattern jsonb;

alter table public.event_candidates
  add constraint event_candidates_source_claim_required
  check(cardinality(source_claim_ids) > 0) not valid;

alter table public.event_candidates validate constraint event_candidates_source_claim_required;

alter table public.provenance_activities
  drop constraint if exists provenance_activities_activity_type_check;

alter table public.provenance_activities
  add constraint provenance_activities_activity_type_check
  check(activity_type in ('transcript_parse','deterministic_structure','knowledge_extraction','timeline_candidate_extraction','human_review','correction'));

alter table public.temporal_assertions
  drop constraint if exists temporal_assertions_precision_check;

alter table public.temporal_assertions
  add constraint temporal_assertions_precision_check
  check(precision in ('exact_timestamp','exact_date','exact_time','approximate','interval','bounded_interval','relative_only','sequence_only','unknown')),
  add column asserted_date date,
  add column asserted_time_of_day_start time,
  add column asserted_time_of_day_end time,
  add column time_of_day_band text,
  add column date_precision text,
  add column time_of_day_precision text,
  add column qualification text not null default 'asserted'
    check(qualification in ('asserted','witness_qualified','estimated','not_recalled','unknown')),
  add column qualifier_text text,
  add column confidence_basis text not null default 'wording:unqualified',
  add column sequence_language text,
  add column duration_iso8601 text,
  add column relative_offset_value integer,
  add column relative_offset_unit text,
  add column recurrence_pattern jsonb,
  add column lower_bound_event_candidate_id uuid references public.event_candidates(id) on delete set null,
  add column upper_bound_event_candidate_id uuid references public.event_candidates(id) on delete set null;

alter table public.temporal_assertions
  add constraint temporal_assertions_unknown_has_no_normalized_time
    check(precision <> 'unknown' or (
      asserted_start is null and asserted_end is null and asserted_date is null
      and asserted_time_of_day_start is null and asserted_time_of_day_end is null
    )),
  add constraint temporal_assertions_relative_has_no_normalized_time
    check(precision not in ('relative_only','sequence_only') or (
      asserted_start is null and asserted_end is null and asserted_date is null
      and asserted_time_of_day_start is null and asserted_time_of_day_end is null
    )),
  add constraint temporal_assertions_time_of_day_order
    check(asserted_time_of_day_end is null or asserted_time_of_day_start is null or asserted_time_of_day_end >= asserted_time_of_day_start),
  add constraint temporal_assertions_candidate_bounds_not_self
    check(lower_bound_event_candidate_id is null or upper_bound_event_candidate_id is null or lower_bound_event_candidate_id <> upper_bound_event_candidate_id);

create or replace function public.commit_testimony_timeline_candidates(payload jsonb) returns jsonb
language plpgsql security definer set search_path=public,private,extensions as $$
declare
  v_result jsonb;
  v_item jsonb;
  v_case_id uuid := (payload->>'case_id')::uuid;
begin
  if payload->'run'->>'compiler_name' <> 'icarus-testimony-timeline-candidate-compiler' then
    raise exception 'Unexpected timeline candidate compiler.';
  end if;
  if payload->>'schema_version' <> 'testimony-knowledge/1.0+timeline-candidate/1.0' then
    raise exception 'Unexpected timeline candidate contract.';
  end if;
  if jsonb_array_length(coalesce(payload->'witness_blocks','[]'::jsonb)) <> 0 then
    raise exception 'Timeline candidate compilation must reuse persisted witness blocks.';
  end if;
  if coalesce((payload->'boundary'->>'canonical_events_created')::integer,-1) <> 0
     or coalesce((payload->'boundary'->>'same_resolutions_created')::integer,-1) <> 0 then
    raise exception 'Timeline candidate compilation cannot create canonical events or SAME resolutions.';
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(payload->'event_candidates','[]'::jsonb)) loop
    if jsonb_array_length(coalesce(v_item->'source_claim_ids','[]'::jsonb)) = 0 then
      raise exception 'Every event candidate must cite at least one source claim.';
    end if;
    if nullif(v_item->>'event_class','') is null or nullif(v_item->>'source_wording','') is null then
      raise exception 'Every timeline event candidate requires an event class and exact source wording.';
    end if;
  end loop;

  v_result := public.commit_testimony_knowledge_map(payload);

  for v_item in select value from jsonb_array_elements(coalesce(payload->'event_candidates','[]'::jsonb)) loop
    update public.event_candidates
      set event_class=v_item->>'event_class',
          source_wording=v_item->>'source_wording',
          recurrence_pattern=v_item->'recurrence_pattern'
      where id=(v_item->>'id')::uuid and case_id=v_case_id and reconciled_event_id is null;
    if not found then raise exception 'Timeline event candidate was not committed in the expected case.'; end if;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(payload->'temporal_assertions','[]'::jsonb)) loop
    if nullif(v_item->>'source_claim_id','') is null then
      raise exception 'Every timeline temporal assertion must cite its source claim.';
    end if;
    update public.temporal_assertions
      set asserted_date=nullif(v_item->>'asserted_date','')::date,
          asserted_time_of_day_start=nullif(v_item->>'asserted_time_of_day_start','')::time,
          asserted_time_of_day_end=nullif(v_item->>'asserted_time_of_day_end','')::time,
          time_of_day_band=nullif(v_item->>'time_of_day_band',''),
          date_precision=nullif(v_item->>'date_precision',''),
          time_of_day_precision=nullif(v_item->>'time_of_day_precision',''),
          qualification=v_item->>'qualification',
          qualifier_text=nullif(v_item->>'qualifier_text',''),
          confidence_basis=v_item->>'confidence_basis',
          sequence_language=nullif(v_item->>'sequence_language',''),
          duration_iso8601=nullif(v_item->>'duration_iso8601',''),
          relative_offset_value=nullif(v_item->>'relative_offset_value','')::integer,
          relative_offset_unit=nullif(v_item->>'relative_offset_unit',''),
          recurrence_pattern=v_item->'recurrence_pattern',
          lower_bound_event_candidate_id=nullif(v_item->>'lower_bound_event_candidate_id','')::uuid,
          upper_bound_event_candidate_id=nullif(v_item->>'upper_bound_event_candidate_id','')::uuid
      where id=(v_item->>'id')::uuid and case_id=v_case_id and event_id is null;
    if not found then raise exception 'Timeline temporal assertion was not committed in the expected case.'; end if;
  end loop;

  return v_result || jsonb_build_object(
    'event_candidates',jsonb_array_length(coalesce(payload->'event_candidates','[]'::jsonb)),
    'temporal_assertions',jsonb_array_length(coalesce(payload->'temporal_assertions','[]'::jsonb)),
    'canonical_events_created',0,
    'same_resolutions_created',0
  );
end; $$;

revoke all on function public.commit_testimony_timeline_candidates(jsonb) from public,anon;
grant execute on function public.commit_testimony_timeline_candidates(jsonb) to authenticated;

create or replace view public.timeline_candidate_projection
with (security_invoker=true) as
with segment_context as (
  select
    source_segments.*,
    lag(timestamp_start_ms) over(partition by proceeding_id order by ordinal) as previous_timestamp_start_ms
  from public.source_segments
)
select
  event_candidate.case_id,
  event_candidate.proceeding_id,
  proceeding.title as proceeding_title,
  proceeding.proceeding_type,
  proceeding.proceeding_date,
  witness_block.id as witness_block_id,
  witness_block.object_code as witness_block_code,
  witness_block.witness_label_raw,
  witness_block.resolution_status as witness_resolution_status,
  testimony_unit.id as testimony_unit_id,
  testimony_unit.object_code as testimony_unit_code,
  testimony_unit.unit_kind,
  testimony_unit.phase_candidate,
  testimony_unit.jury_state_candidate,
  testimony_unit.review_status as testimony_unit_review_status,
  knowledge_item.id as knowledge_item_id,
  knowledge_item.object_code as knowledge_item_code,
  knowledge_item.summary as knowledge_item_summary,
  knowledge_item.unknowns,
  knowledge_item.review_status as knowledge_item_review_status,
  claim.id as claim_id,
  claim.object_code as claim_code,
  claim.normalized_assertion,
  claim.assertion_status,
  claim.information_basis,
  claim.asserted_by_raw,
  event_candidate.id as event_candidate_id,
  event_candidate.object_code as event_candidate_code,
  event_candidate.neutral_description,
  event_candidate.event_class,
  event_candidate.participant_mentions,
  event_candidate.source_wording as event_source_wording,
  event_candidate.recurrence_pattern as event_recurrence_pattern,
  event_candidate.review_status as event_candidate_status,
  temporal_assertion.id as temporal_assertion_id,
  temporal_assertion.object_code as temporal_assertion_code,
  temporal_assertion.raw_temporal_language,
  temporal_assertion.precision as temporal_precision,
  temporal_assertion.asserted_start,
  temporal_assertion.asserted_end,
  temporal_assertion.asserted_date,
  temporal_assertion.asserted_time_of_day_start,
  temporal_assertion.asserted_time_of_day_end,
  temporal_assertion.time_of_day_band,
  temporal_assertion.date_precision,
  temporal_assertion.time_of_day_precision,
  temporal_assertion.qualification,
  temporal_assertion.qualifier_text,
  temporal_assertion.confidence_basis,
  temporal_assertion.sequence_language,
  temporal_assertion.duration_iso8601,
  temporal_assertion.relative_offset_value,
  temporal_assertion.relative_offset_unit,
  temporal_assertion.recurrence_pattern as temporal_recurrence_pattern,
  temporal_assertion.review_status as temporal_assertion_status,
  source_ref.source_ordinal,
  segment.id as source_segment_id,
  segment.ordinal as proceeding_segment_ordinal,
  segment.exact_text as exact_source_text,
  speaker.provider_label as source_speaker,
  segment.timestamp_start_ms as testimony_timestamp_start_ms,
  segment.timestamp_end_ms as testimony_timestamp_end_ms,
  segment.deep_link,
  segment.locator as source_locator,
  segment.transcript_provider,
  artifact.id as source_artifact_id,
  artifact.sha256 as source_sha256,
  artifact.source_url,
  artifact.canonical_url,
  artifact.original_filename,
  (segment.timestamp_start_ms < segment.previous_timestamp_start_ms) as source_timestamp_irregularity
from public.temporal_assertions temporal_assertion
join public.event_candidates event_candidate
  on event_candidate.id=temporal_assertion.event_candidate_id and event_candidate.case_id=temporal_assertion.case_id
join public.claims claim
  on claim.id=temporal_assertion.source_claim_id and claim.knowledge_item_id=event_candidate.knowledge_item_id
join public.knowledge_items knowledge_item on knowledge_item.id=event_candidate.knowledge_item_id
join public.knowledge_extraction_runs extraction_run on extraction_run.id=knowledge_item.extraction_run_id
join public.testimony_units testimony_unit on testimony_unit.id=knowledge_item.testimony_unit_id
join public.witness_blocks witness_block on witness_block.id=testimony_unit.witness_block_id
join public.proceedings proceeding on proceeding.id=event_candidate.proceeding_id
join public.source_artifacts artifact on artifact.id=proceeding.source_artifact_id
cross join lateral unnest(temporal_assertion.source_segment_ids) with ordinality source_ref(segment_id,source_ordinal)
join segment_context segment on segment.id=source_ref.segment_id
left join public.proceeding_speakers speaker on speaker.id=segment.proceeding_speaker_id
where event_candidate.reconciled_event_id is null
  and temporal_assertion.event_id is null
  and extraction_run.compiler_name='icarus-testimony-timeline-candidate-compiler';

revoke all on public.timeline_candidate_projection from anon;
grant select on public.timeline_candidate_projection to authenticated;
grant all privileges on public.timeline_candidate_projection to service_role;
