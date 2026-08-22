create table public.structure_review_versions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  target_type text not null check(target_type in ('knowledge','claim','mention','event','temporal','relationship','flag')),
  target_id uuid not null,
  version integer not null check(version > 0),
  action text not null check(action in ('accept','amend','reject','defer')),
  previous_status text not null,
  resulting_status text not null,
  before_state jsonb not null check(jsonb_typeof(before_state) = 'object'),
  patch jsonb not null default '{}'::jsonb check(jsonb_typeof(patch) = 'object'),
  after_state jsonb not null check(jsonb_typeof(after_state) = 'object'),
  note text not null default '' check(char_length(note) <= 4000),
  source_segment_ids uuid[] not null,
  reviewed_by_user_id uuid not null references auth.users(id),
  ledger_logical_order bigint not null check(ledger_logical_order > 0),
  reviewed_at timestamptz not null default now(),
  unique(case_id,target_type,target_id,version),
  unique(case_id,ledger_logical_order)
);

create index structure_review_versions_case_reviewed_idx
  on public.structure_review_versions(case_id,reviewed_at desc);
create index structure_review_versions_case_queue_idx
  on public.structure_review_versions(case_id,target_type,resulting_status,reviewed_at desc);
create index structure_review_versions_target_version_idx
  on public.structure_review_versions(target_type,target_id,version desc);

alter table public.structure_review_versions enable row level security;

create policy structure_review_versions_select
  on public.structure_review_versions for select to authenticated
  using(private.can_access_case(case_id));

revoke all on public.structure_review_versions from public,anon,authenticated;
grant select on public.structure_review_versions to authenticated;
grant all privileges on public.structure_review_versions to service_role;

create function private.can_review_case(target_case_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select (select auth.uid()) is not null and exists(
    select 1
    from public.case_members member
    where member.case_id=target_case_id
      and member.user_id=(select auth.uid())
      and member.role in ('owner','reviewer')
  );
$$;

revoke all on function private.can_review_case(uuid) from public,anon,authenticated;

create function private.review_structure_object_core(
  p_case_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_action text,
  p_patch jsonb,
  p_note text,
  p_expected_version integer
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid := (select auth.uid());
  v_patch jsonb := coalesce(p_patch,'{}'::jsonb);
  v_note text := btrim(coalesce(p_note,''));
  v_previous_status text;
  v_resulting_status text;
  v_version integer;
  v_before jsonb;
  v_after jsonb;
  v_source_segment_ids uuid[] := '{}'::uuid[];
  v_object_code text;
  v_extraction_run_id uuid;
  v_ledger_order bigint;
  v_review_id uuid := gen_random_uuid();
  v_reviewed_at timestamptz := now();
begin
  if v_actor is null or not private.can_review_case(p_case_id) then
    raise exception 'STRUCTURE_REVIEW_NOT_AUTHORIZED' using errcode='42501';
  end if;
  if p_target_type not in ('knowledge','claim','mention','event','temporal','relationship','flag') then
    raise exception 'STRUCTURE_REVIEW_INVALID_TARGET_TYPE' using errcode='22023';
  end if;
  if p_action not in ('accept','amend','reject','defer') then
    raise exception 'STRUCTURE_REVIEW_INVALID_ACTION' using errcode='22023';
  end if;
  if p_expected_version is null or p_expected_version < 0 then
    raise exception 'STRUCTURE_REVIEW_INVALID_EXPECTED_VERSION' using errcode='22023';
  end if;
  if jsonb_typeof(v_patch) <> 'object' then
    raise exception 'STRUCTURE_REVIEW_PATCH_MUST_BE_OBJECT' using errcode='22023';
  end if;
  if p_action='amend' and v_patch='{}'::jsonb then
    raise exception 'STRUCTURE_REVIEW_AMEND_REQUIRES_PATCH' using errcode='22023';
  end if;
  if p_action<>'amend' and v_patch<>'{}'::jsonb then
    raise exception 'STRUCTURE_REVIEW_PATCH_ONLY_ALLOWED_FOR_AMEND' using errcode='22023';
  end if;
  if p_action in ('amend','reject','defer') and v_note='' then
    raise exception 'STRUCTURE_REVIEW_NOTE_REQUIRED' using errcode='22023';
  end if;
  if char_length(v_note) > 4000 then
    raise exception 'STRUCTURE_REVIEW_NOTE_TOO_LONG' using errcode='22023';
  end if;

  if p_target_type='knowledge' then
    select to_jsonb(item),item.review_status,item.object_code,item.extraction_run_id
      into v_before,v_previous_status,v_object_code,v_extraction_run_id
      from public.knowledge_items item
      where item.id=p_target_id and item.case_id=p_case_id
      for update;
    if not found then raise exception 'STRUCTURE_REVIEW_TARGET_UNAVAILABLE' using errcode='42501'; end if;
    if exists(select 1 from jsonb_object_keys(v_patch) key where key<>all(array['summary','unknowns'])) then
      raise exception 'STRUCTURE_REVIEW_PATCH_FIELD_NOT_ALLOWED' using errcode='22023';
    end if;
    if v_patch ? 'summary' and (jsonb_typeof(v_patch->'summary')<>'string' or char_length(btrim(v_patch->>'summary')) not between 1 and 4000) then
      raise exception 'STRUCTURE_REVIEW_INVALID_SUMMARY' using errcode='22023';
    end if;
    if v_patch ? 'unknowns' and jsonb_typeof(v_patch->'unknowns')<>'array' then
      raise exception 'STRUCTURE_REVIEW_UNKNOWNS_MUST_BE_ARRAY' using errcode='22023';
    end if;
    select coalesce(array_agg(link.source_segment_id order by link.ordinal),'{}'::uuid[])
      into v_source_segment_ids
      from public.knowledge_item_segments link where link.knowledge_item_id=p_target_id;

  elsif p_target_type='claim' then
    select to_jsonb(item),item.status::text,item.object_code,knowledge.extraction_run_id
      into v_before,v_previous_status,v_object_code,v_extraction_run_id
      from public.claims item
      left join public.knowledge_items knowledge on knowledge.id=item.knowledge_item_id and knowledge.case_id=item.case_id
      where item.id=p_target_id and item.case_id=p_case_id
      for update of item;
    if not found then raise exception 'STRUCTURE_REVIEW_TARGET_UNAVAILABLE' using errcode='42501'; end if;
    if exists(select 1 from jsonb_object_keys(v_patch) key where key<>all(array['normalized_assertion','assertion_status','information_basis'])) then
      raise exception 'STRUCTURE_REVIEW_PATCH_FIELD_NOT_ALLOWED' using errcode='22023';
    end if;
    if v_patch ? 'normalized_assertion' and jsonb_typeof(v_patch->'normalized_assertion') not in ('string','null') then
      raise exception 'STRUCTURE_REVIEW_INVALID_NORMALIZED_ASSERTION' using errcode='22023';
    end if;
    if v_patch ? 'assertion_status' and coalesce(v_patch->>'assertion_status','') not in ('asserted','disputed','qualified','corrected','withdrawn','unknown') then
      raise exception 'STRUCTURE_REVIEW_INVALID_ASSERTION_STATUS' using errcode='22023';
    end if;
    if v_patch ? 'information_basis' and coalesce(v_patch->>'information_basis','') not in ('PERSONALLY_OBSERVED','HEARD_FROM_PERSON','READ_IN_RECORD','REVIEWED_DEVICE_DATA','RECALLED','EXPERT_INFERENCE','PARTY_ARGUMENT','UNKNOWN_BASIS') then
      raise exception 'STRUCTURE_REVIEW_INVALID_INFORMATION_BASIS' using errcode='22023';
    end if;
    select coalesce(array_agg(source_segment_id order by source_order),'{}'::uuid[])
      into v_source_segment_ids
      from (
        select item.source_segment_id,0 as source_order from public.claims item where item.id=p_target_id
        union
        select link.source_segment_id,link.ordinal+1 from public.claim_source_segments link where link.claim_id=p_target_id
      ) sources;

  elsif p_target_type='mention' then
    select to_jsonb(item),item.review_status,item.object_code,knowledge.extraction_run_id
      into v_before,v_previous_status,v_object_code,v_extraction_run_id
      from public.entity_mentions item
      join public.knowledge_items knowledge on knowledge.id=item.knowledge_item_id and knowledge.case_id=item.case_id
      where item.id=p_target_id and item.case_id=p_case_id
      for update of item;
    if not found then raise exception 'STRUCTURE_REVIEW_TARGET_UNAVAILABLE' using errcode='42501'; end if;
    if (v_before->>'resolved_entity_id') is not null then
      raise exception 'STRUCTURE_REVIEW_TARGET_INELIGIBLE' using errcode='55000';
    end if;
    if exists(select 1 from jsonb_object_keys(v_patch) key where key<>all(array['normalized_candidate','mention_type'])) then
      raise exception 'STRUCTURE_REVIEW_PATCH_FIELD_NOT_ALLOWED' using errcode='22023';
    end if;
    if v_patch ? 'normalized_candidate' and jsonb_typeof(v_patch->'normalized_candidate') not in ('string','null') then
      raise exception 'STRUCTURE_REVIEW_INVALID_NORMALIZED_CANDIDATE' using errcode='22023';
    end if;
    if v_patch ? 'mention_type' and jsonb_typeof(v_patch->'mention_type') not in ('string','null') then
      raise exception 'STRUCTURE_REVIEW_INVALID_MENTION_TYPE' using errcode='22023';
    end if;
    v_source_segment_ids := array(select jsonb_array_elements_text(v_before->'source_segment_ids')::uuid);

  elsif p_target_type='event' then
    select to_jsonb(item),item.review_status,item.object_code,knowledge.extraction_run_id
      into v_before,v_previous_status,v_object_code,v_extraction_run_id
      from public.event_candidates item
      join public.knowledge_items knowledge on knowledge.id=item.knowledge_item_id and knowledge.case_id=item.case_id
      where item.id=p_target_id and item.case_id=p_case_id
      for update of item;
    if not found then raise exception 'STRUCTURE_REVIEW_TARGET_UNAVAILABLE' using errcode='42501'; end if;
    if (v_before->>'reconciled_event_id') is not null then
      raise exception 'STRUCTURE_REVIEW_TARGET_INELIGIBLE' using errcode='55000';
    end if;
    if exists(select 1 from jsonb_object_keys(v_patch) key where key<>all(array['neutral_description','participant_mentions'])) then
      raise exception 'STRUCTURE_REVIEW_PATCH_FIELD_NOT_ALLOWED' using errcode='22023';
    end if;
    if v_patch ? 'neutral_description' and (jsonb_typeof(v_patch->'neutral_description')<>'string' or char_length(btrim(v_patch->>'neutral_description')) not between 1 and 4000) then
      raise exception 'STRUCTURE_REVIEW_INVALID_EVENT_DESCRIPTION' using errcode='22023';
    end if;
    if v_patch ? 'participant_mentions' and jsonb_typeof(v_patch->'participant_mentions')<>'array' then
      raise exception 'STRUCTURE_REVIEW_PARTICIPANTS_MUST_BE_ARRAY' using errcode='22023';
    end if;
    select coalesce(array_agg(source_segment_id order by source_order),'{}'::uuid[])
      into v_source_segment_ids
      from (
        select source.source_segment_id,(claim_ref.ordinal*10000)+source.source_ordinal as source_order
        from unnest(array(select jsonb_array_elements_text(v_before->'source_claim_ids')::uuid)) with ordinality claim_ref(claim_id,ordinal)
        join lateral (
          select claim.source_segment_id,0 as source_ordinal from public.claims claim where claim.id=claim_ref.claim_id and claim.case_id=p_case_id
          union
          select link.source_segment_id,link.ordinal+1 from public.claim_source_segments link where link.claim_id=claim_ref.claim_id
        ) source on true
        union all
        select link.source_segment_id,1000000+link.ordinal
        from public.knowledge_item_segments link where link.knowledge_item_id=(v_before->>'knowledge_item_id')::uuid
      ) sources;

  elsif p_target_type='temporal' then
    select to_jsonb(item),item.review_status,item.object_code,knowledge.extraction_run_id
      into v_before,v_previous_status,v_object_code,v_extraction_run_id
      from public.temporal_assertions item
      join public.knowledge_items knowledge on knowledge.id=item.knowledge_item_id and knowledge.case_id=item.case_id
      where item.id=p_target_id and item.case_id=p_case_id
      for update of item;
    if not found then raise exception 'STRUCTURE_REVIEW_TARGET_UNAVAILABLE' using errcode='42501'; end if;
    if (v_before->>'event_id') is not null then
      raise exception 'STRUCTURE_REVIEW_TARGET_INELIGIBLE' using errcode='55000';
    end if;
    if exists(select 1 from jsonb_object_keys(v_patch) key where key<>all(array[
      'asserted_start','asserted_end','precision','asserted_date','asserted_time_of_day_start','asserted_time_of_day_end',
      'time_of_day_band','date_precision','time_of_day_precision','qualification','qualifier_text','sequence_language',
      'duration_iso8601','relative_offset_value','relative_offset_unit','recurrence_pattern',
      'lower_bound_event_candidate_id','upper_bound_event_candidate_id'
    ])) then
      raise exception 'STRUCTURE_REVIEW_PATCH_FIELD_NOT_ALLOWED' using errcode='22023';
    end if;
    if v_patch ? 'precision' and coalesce(v_patch->>'precision','') not in ('exact_timestamp','exact_date','exact_time','approximate','interval','bounded_interval','relative_only','sequence_only','unknown') then
      raise exception 'STRUCTURE_REVIEW_INVALID_PRECISION' using errcode='22023';
    end if;
    if v_patch ? 'qualification' and coalesce(v_patch->>'qualification','') not in ('asserted','witness_qualified','estimated','not_recalled','unknown') then
      raise exception 'STRUCTURE_REVIEW_INVALID_QUALIFICATION' using errcode='22023';
    end if;
    if v_patch ? 'recurrence_pattern' and jsonb_typeof(v_patch->'recurrence_pattern') not in ('object','null') then
      raise exception 'STRUCTURE_REVIEW_RECURRENCE_MUST_BE_OBJECT' using errcode='22023';
    end if;
    if v_patch ? 'lower_bound_event_candidate_id' and nullif(v_patch->>'lower_bound_event_candidate_id','') is not null and not exists(
      select 1 from public.event_candidates bound where bound.id=(v_patch->>'lower_bound_event_candidate_id')::uuid and bound.case_id=p_case_id
    ) then raise exception 'STRUCTURE_REVIEW_BOUND_UNAVAILABLE' using errcode='42501'; end if;
    if v_patch ? 'upper_bound_event_candidate_id' and nullif(v_patch->>'upper_bound_event_candidate_id','') is not null and not exists(
      select 1 from public.event_candidates bound where bound.id=(v_patch->>'upper_bound_event_candidate_id')::uuid and bound.case_id=p_case_id
    ) then raise exception 'STRUCTURE_REVIEW_BOUND_UNAVAILABLE' using errcode='42501'; end if;
    v_source_segment_ids := array(select jsonb_array_elements_text(v_before->'source_segment_ids')::uuid);

  elsif p_target_type='relationship' then
    select to_jsonb(item),item.review_status,item.object_code,knowledge.extraction_run_id
      into v_before,v_previous_status,v_object_code,v_extraction_run_id
      from public.knowledge_relationships item
      join public.knowledge_items knowledge on knowledge.id=item.knowledge_item_id and knowledge.case_id=item.case_id
      where item.id=p_target_id and item.case_id=p_case_id
      for update of item;
    if not found then raise exception 'STRUCTURE_REVIEW_TARGET_UNAVAILABLE' using errcode='42501'; end if;
    if exists(select 1 from jsonb_object_keys(v_patch) key where key<>all(array['relation_type','assertion_status'])) then
      raise exception 'STRUCTURE_REVIEW_PATCH_FIELD_NOT_ALLOWED' using errcode='22023';
    end if;
    if v_patch ? 'relation_type' and (jsonb_typeof(v_patch->'relation_type')<>'string' or btrim(v_patch->>'relation_type')='' or v_patch->>'relation_type' in ('causes','caused_by')) then
      raise exception 'STRUCTURE_REVIEW_INVALID_RELATION_TYPE' using errcode='22023';
    end if;
    if v_patch ? 'assertion_status' and coalesce(v_patch->>'assertion_status','') not in ('asserted','candidate','qualified','corrected','withdrawn','unknown') then
      raise exception 'STRUCTURE_REVIEW_INVALID_ASSERTION_STATUS' using errcode='22023';
    end if;
    select coalesce(array_agg(source_segment_id order by source_order),'{}'::uuid[])
      into v_source_segment_ids
      from (
        select claim.source_segment_id,0 as source_order from public.claims claim where claim.id=nullif(v_before->>'source_claim_id','')::uuid
        union
        select link.source_segment_id,link.ordinal+1 from public.claim_source_segments link where link.claim_id=nullif(v_before->>'source_claim_id','')::uuid
        union
        select link.source_segment_id,1000000+link.ordinal from public.knowledge_item_segments link where link.knowledge_item_id=(v_before->>'knowledge_item_id')::uuid
      ) sources;

  else
    select to_jsonb(item),item.status,item.object_code,null::uuid
      into v_before,v_previous_status,v_object_code,v_extraction_run_id
      from public.knowledge_flags item
      where item.id=p_target_id and item.case_id=p_case_id
      for update;
    if not found then raise exception 'STRUCTURE_REVIEW_TARGET_UNAVAILABLE' using errcode='42501'; end if;
    if exists(select 1 from jsonb_object_keys(v_patch) key where key<>all(array['rationale','supporting_context'])) then
      raise exception 'STRUCTURE_REVIEW_PATCH_FIELD_NOT_ALLOWED' using errcode='22023';
    end if;
    if v_patch ? 'rationale' and (jsonb_typeof(v_patch->'rationale')<>'string' or char_length(btrim(v_patch->>'rationale')) not between 1 and 4000) then
      raise exception 'STRUCTURE_REVIEW_INVALID_RATIONALE' using errcode='22023';
    end if;
    if v_patch ? 'supporting_context' and jsonb_typeof(v_patch->'supporting_context')<>'object' then
      raise exception 'STRUCTURE_REVIEW_CONTEXT_MUST_BE_OBJECT' using errcode='22023';
    end if;
    v_source_segment_ids := array(select jsonb_array_elements_text(v_before->'source_segment_ids')::uuid);
  end if;

  select coalesce(max(version),0) into v_version
    from public.structure_review_versions
    where case_id=p_case_id and target_type=p_target_type and target_id=p_target_id;
  if v_version<>p_expected_version then
    raise exception 'STRUCTURE_REVIEW_STALE_VERSION expected %, current %',p_expected_version,v_version using errcode='40001';
  end if;

  if p_target_type='claim' then
    if v_previous_status not in ('candidate','deferred') or (v_before->>'assertion_status') in ('stipulated','court_found') then
      raise exception 'STRUCTURE_REVIEW_TARGET_INELIGIBLE' using errcode='55000';
    end if;
  elsif p_target_type='flag' then
    if v_previous_status not in ('proposed','deferred') then
      raise exception 'STRUCTURE_REVIEW_TARGET_INELIGIBLE' using errcode='55000';
    end if;
  elsif v_previous_status not in ('pending','deferred') then
    raise exception 'STRUCTURE_REVIEW_TARGET_INELIGIBLE' using errcode='55000';
  end if;

  v_version := v_version+1;
  v_resulting_status := case p_action when 'accept' then 'accepted' when 'amend' then case when p_target_type in ('claim','flag') then 'accepted' else 'amended' end when 'reject' then 'rejected' else 'deferred' end;

  if p_target_type='knowledge' then
    update public.knowledge_items set
      summary=case when v_patch ? 'summary' then btrim(v_patch->>'summary') else summary end,
      unknowns=case when v_patch ? 'unknowns' then v_patch->'unknowns' else unknowns end,
      review_status=v_resulting_status
      where id=p_target_id and case_id=p_case_id;
    select to_jsonb(item) into v_after from public.knowledge_items item where item.id=p_target_id;
  elsif p_target_type='claim' then
    update public.claims set
      normalized_assertion=case when v_patch ? 'normalized_assertion' then nullif(btrim(v_patch->>'normalized_assertion'),'') else normalized_assertion end,
      assertion_status=case when v_patch ? 'assertion_status' then v_patch->>'assertion_status' else assertion_status end,
      information_basis=case when v_patch ? 'information_basis' then v_patch->>'information_basis' else information_basis end,
      status=v_resulting_status::public.claim_status
      where id=p_target_id and case_id=p_case_id;
    select to_jsonb(item) into v_after from public.claims item where item.id=p_target_id;
  elsif p_target_type='mention' then
    update public.entity_mentions set
      normalized_candidate=case when v_patch ? 'normalized_candidate' then nullif(btrim(v_patch->>'normalized_candidate'),'') else normalized_candidate end,
      mention_type=case when v_patch ? 'mention_type' then nullif(btrim(v_patch->>'mention_type'),'') else mention_type end,
      review_status=v_resulting_status
      where id=p_target_id and case_id=p_case_id;
    select to_jsonb(item) into v_after from public.entity_mentions item where item.id=p_target_id;
  elsif p_target_type='event' then
    update public.event_candidates set
      neutral_description=case when v_patch ? 'neutral_description' then btrim(v_patch->>'neutral_description') else neutral_description end,
      participant_mentions=case when v_patch ? 'participant_mentions' then v_patch->'participant_mentions' else participant_mentions end,
      review_status=v_resulting_status
      where id=p_target_id and case_id=p_case_id and reconciled_event_id is null;
    select to_jsonb(item) into v_after from public.event_candidates item where item.id=p_target_id;
  elsif p_target_type='temporal' then
    update public.temporal_assertions set
      asserted_start=case when v_patch ? 'asserted_start' then nullif(v_patch->>'asserted_start','')::timestamptz else asserted_start end,
      asserted_end=case when v_patch ? 'asserted_end' then nullif(v_patch->>'asserted_end','')::timestamptz else asserted_end end,
      precision=case when v_patch ? 'precision' then v_patch->>'precision' else precision end,
      asserted_date=case when v_patch ? 'asserted_date' then nullif(v_patch->>'asserted_date','')::date else asserted_date end,
      asserted_time_of_day_start=case when v_patch ? 'asserted_time_of_day_start' then nullif(v_patch->>'asserted_time_of_day_start','')::time else asserted_time_of_day_start end,
      asserted_time_of_day_end=case when v_patch ? 'asserted_time_of_day_end' then nullif(v_patch->>'asserted_time_of_day_end','')::time else asserted_time_of_day_end end,
      time_of_day_band=case when v_patch ? 'time_of_day_band' then nullif(btrim(v_patch->>'time_of_day_band'),'') else time_of_day_band end,
      date_precision=case when v_patch ? 'date_precision' then nullif(btrim(v_patch->>'date_precision'),'') else date_precision end,
      time_of_day_precision=case when v_patch ? 'time_of_day_precision' then nullif(btrim(v_patch->>'time_of_day_precision'),'') else time_of_day_precision end,
      qualification=case when v_patch ? 'qualification' then v_patch->>'qualification' else qualification end,
      qualifier_text=case when v_patch ? 'qualifier_text' then nullif(btrim(v_patch->>'qualifier_text'),'') else qualifier_text end,
      sequence_language=case when v_patch ? 'sequence_language' then nullif(btrim(v_patch->>'sequence_language'),'') else sequence_language end,
      duration_iso8601=case when v_patch ? 'duration_iso8601' then nullif(btrim(v_patch->>'duration_iso8601'),'') else duration_iso8601 end,
      relative_offset_value=case when v_patch ? 'relative_offset_value' then nullif(v_patch->>'relative_offset_value','')::integer else relative_offset_value end,
      relative_offset_unit=case when v_patch ? 'relative_offset_unit' then nullif(btrim(v_patch->>'relative_offset_unit'),'') else relative_offset_unit end,
      recurrence_pattern=case when v_patch ? 'recurrence_pattern' then v_patch->'recurrence_pattern' else recurrence_pattern end,
      lower_bound_event_candidate_id=case when v_patch ? 'lower_bound_event_candidate_id' then nullif(v_patch->>'lower_bound_event_candidate_id','')::uuid else lower_bound_event_candidate_id end,
      upper_bound_event_candidate_id=case when v_patch ? 'upper_bound_event_candidate_id' then nullif(v_patch->>'upper_bound_event_candidate_id','')::uuid else upper_bound_event_candidate_id end,
      review_status=v_resulting_status
      where id=p_target_id and case_id=p_case_id and event_id is null;
    select to_jsonb(item) into v_after from public.temporal_assertions item where item.id=p_target_id;
  elsif p_target_type='relationship' then
    update public.knowledge_relationships set
      relation_type=case when v_patch ? 'relation_type' then btrim(v_patch->>'relation_type') else relation_type end,
      assertion_status=case when v_patch ? 'assertion_status' then v_patch->>'assertion_status' else assertion_status end,
      review_status=v_resulting_status
      where id=p_target_id and case_id=p_case_id;
    select to_jsonb(item) into v_after from public.knowledge_relationships item where item.id=p_target_id;
  else
    update public.knowledge_flags set
      rationale=case when v_patch ? 'rationale' then btrim(v_patch->>'rationale') else rationale end,
      supporting_context=case when v_patch ? 'supporting_context' then v_patch->'supporting_context' else supporting_context end,
      status=v_resulting_status,
      reviewer_user_id=v_actor
      where id=p_target_id and case_id=p_case_id;
    select to_jsonb(item) into v_after from public.knowledge_flags item where item.id=p_target_id;
  end if;

  select coalesce(array_agg(source_segment_id order by first_ordinal),'{}'::uuid[])
    into v_source_segment_ids
    from (
      select source_segment_id,min(source_ordinal) as first_ordinal
      from (
        select source_segment_id,source_ordinal
        from unnest(v_source_segment_ids) with ordinality source(source_segment_id,source_ordinal)
        union all
        select relation_source.source_segment_id,10000000+relation.logical_order+relation_source.source_ordinal
        from public.provenance_relations relation
        cross join lateral unnest(relation.source_segment_ids) with ordinality relation_source(source_segment_id,source_ordinal)
        where relation.case_id=p_case_id and (relation.from_node_id=p_target_id or relation.to_node_id=p_target_id)
      ) combined
      group by source_segment_id
    ) deduplicated;

  v_ledger_order := private.append_case_ledger(
    p_case_id,
    case p_target_type when 'knowledge' then 'knowledge_item' when 'mention' then 'entity_mention' when 'event' then 'event_candidate' when 'temporal' then 'temporal_assertion' when 'relationship' then 'relationship' when 'flag' then 'flag' else 'claim' end,
    p_target_id,
    v_object_code,
    'reviewed',
    v_extraction_run_id,
    v_actor,
    null,
    jsonb_build_object('action',p_action,'version',v_version,'previous_status',v_previous_status,'resulting_status',v_resulting_status,'note',v_note,'patch',v_patch,'source_segment_ids',to_jsonb(v_source_segment_ids))
  );

  insert into public.structure_review_versions(
    id,case_id,target_type,target_id,version,action,previous_status,resulting_status,before_state,patch,
    after_state,note,source_segment_ids,reviewed_by_user_id,ledger_logical_order,reviewed_at
  ) values (
    v_review_id,p_case_id,p_target_type,p_target_id,v_version,p_action,v_previous_status,v_resulting_status,v_before,v_patch,
    v_after,v_note,v_source_segment_ids,v_actor,v_ledger_order,v_reviewed_at
  );

  return jsonb_build_object(
    'review_id',v_review_id,
    'case_id',p_case_id,
    'target_type',p_target_type,
    'target_id',p_target_id,
    'version',v_version,
    'action',p_action,
    'resulting_status',v_resulting_status,
    'ledger_logical_order',v_ledger_order,
    'reviewed_at',v_reviewed_at,
    'source_segment_ids',to_jsonb(v_source_segment_ids)
  );
end;
$$;

revoke all on function private.review_structure_object_core(uuid,text,uuid,text,jsonb,text,integer) from public,anon;
grant execute on function private.review_structure_object_core(uuid,text,uuid,text,jsonb,text,integer) to authenticated;

create function public.review_structure_object(
  p_case_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_action text,
  p_patch jsonb default '{}'::jsonb,
  p_note text default '',
  p_expected_version integer default 0
) returns jsonb
language sql volatile security invoker set search_path='' as $$
  select private.review_structure_object_core(
    p_case_id,p_target_type,p_target_id,p_action,coalesce(p_patch,'{}'::jsonb),coalesce(p_note,''),p_expected_version
  );
$$;

revoke all on function public.review_structure_object(uuid,text,uuid,text,jsonb,text,integer) from public,anon;
grant execute on function public.review_structure_object(uuid,text,uuid,text,jsonb,text,integer) to authenticated;

create or replace function public.review_extraction_candidate(
  p_candidate_id uuid,
  p_action text,
  p_payload jsonb default null,
  p_note text default ''
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid := (select auth.uid());
  v_candidate public.extraction_candidates%rowtype;
  v_version integer;
  v_child jsonb;
  v_child_ids uuid[] := '{}'::uuid[];
  v_child_id uuid;
begin
  select * into v_candidate from public.extraction_candidates where id=p_candidate_id for update;
  if not found or v_actor is null or not private.can_access_case(v_candidate.case_id) then raise exception 'Candidate not found or not authorized.' using errcode='42501'; end if;
  if p_action not in ('accept','amend','split','reject','defer') then raise exception 'Unsupported review action.'; end if;
  if p_action='amend' and (p_payload is null or jsonb_typeof(p_payload)<>'object') then raise exception 'Amend requires an object payload.'; end if;
  if p_action='split' and (p_payload is null or jsonb_typeof(p_payload)<>'array' or jsonb_array_length(p_payload)<2) then raise exception 'Split requires at least two payload objects.'; end if;
  v_version := v_candidate.current_review_version + 1;
  insert into public.extraction_review_versions(case_id,candidate_id,version,action,payload,note,reviewed_by_user_id)
  values(v_candidate.case_id,p_candidate_id,v_version,p_action,p_payload,coalesce(p_note,''),v_actor);
  update public.extraction_candidates set current_review_version=v_version,review_status=case p_action when 'accept' then 'accepted' when 'amend' then 'amended' when 'split' then 'split' when 'reject' then 'rejected' else 'deferred' end where id=p_candidate_id;
  if p_action='split' then
    for v_child in select value from jsonb_array_elements(p_payload) loop
      if jsonb_typeof(v_child)<>'object' then raise exception 'Each split item must be an object.'; end if;
      v_child_id := gen_random_uuid();
      insert into public.extraction_candidates(id,case_id,proceeding_id,candidate_type,source_segment_ids,payload,extraction_confidence,review_status,parent_candidate_id)
      values(v_child_id,v_candidate.case_id,v_candidate.proceeding_id,v_candidate.candidate_type,v_candidate.source_segment_ids,v_child,v_candidate.extraction_confidence,'pending',p_candidate_id);
      v_child_ids := array_append(v_child_ids,v_child_id);
    end loop;
  end if;
  return jsonb_build_object('candidate_id',p_candidate_id,'version',v_version,'action',p_action,'child_candidate_ids',v_child_ids);
end;
$$;

revoke all on function public.review_extraction_candidate(uuid,text,jsonb,text) from public,anon;
grant execute on function public.review_extraction_candidate(uuid,text,jsonb,text) to authenticated;
