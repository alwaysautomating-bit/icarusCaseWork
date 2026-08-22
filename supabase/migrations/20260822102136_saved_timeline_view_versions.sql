create table public.saved_timeline_views (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  name text not null check(char_length(btrim(name)) between 1 and 100),
  version integer not null check(version > 0),
  description text not null default '' check(char_length(description) <= 1000),
  extraction_run_ids uuid[] not null check(cardinality(extraction_run_ids) > 0),
  event_candidate_ids uuid[] not null check(cardinality(event_candidate_ids) > 0),
  temporal_assertion_ids uuid[] not null check(cardinality(temporal_assertion_ids) > 0),
  view_state jsonb not null default '{}'::jsonb check(jsonb_typeof(view_state) = 'object'),
  snapshot jsonb not null check(jsonb_typeof(snapshot) = 'object'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(case_id,name,version)
);

create index saved_timeline_views_case_created_idx
  on public.saved_timeline_views(case_id,created_at desc);

create index saved_timeline_views_creator_idx
  on public.saved_timeline_views(created_by,created_at desc);

alter table public.saved_timeline_views enable row level security;

create policy saved_timeline_views_select
  on public.saved_timeline_views for select to authenticated
  using(private.can_access_case(case_id));

create policy saved_timeline_views_insert
  on public.saved_timeline_views for insert to authenticated
  with check(private.can_access_case(case_id) and created_by = (select auth.uid()));

create policy saved_timeline_views_delete
  on public.saved_timeline_views for delete to authenticated
  using(private.can_access_case(case_id) and (created_by = (select auth.uid()) or private.is_case_owner(case_id)));

grant select,insert,delete on public.saved_timeline_views to authenticated;
grant all privileges on public.saved_timeline_views to service_role;
revoke all on public.saved_timeline_views from anon;

create function public.save_timeline_view_version(
  p_case_id uuid,
  p_name text,
  p_description text,
  p_extraction_run_ids uuid[],
  p_event_candidate_ids uuid[],
  p_temporal_assertion_ids uuid[],
  p_view_state jsonb default '{}'::jsonb
) returns public.saved_timeline_views
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_name text := btrim(p_name);
  v_version integer;
  v_snapshot jsonb;
  v_row public.saved_timeline_views;
begin
  if v_actor is null or not private.can_access_case(p_case_id) then
    raise exception 'Not authorized for this case.' using errcode='42501';
  end if;
  if char_length(v_name) not between 1 and 100 or char_length(coalesce(p_description,'')) > 1000 then
    raise exception 'Invalid timeline view name or description.';
  end if;
  if coalesce(cardinality(p_extraction_run_ids),0)=0
     or coalesce(cardinality(p_event_candidate_ids),0)=0
     or coalesce(cardinality(p_temporal_assertion_ids),0)=0 then
    raise exception 'A saved timeline view requires a run, event candidates, and temporal assertions.';
  end if;
  if jsonb_typeof(coalesce(p_view_state,'{}'::jsonb)) <> 'object' then
    raise exception 'Timeline view state must be a JSON object.';
  end if;

  if (select count(*) from public.knowledge_extraction_runs r
      where r.case_id=p_case_id
        and r.compiler_name='icarus-testimony-timeline-candidate-compiler'
        and r.id=any(p_extraction_run_ids)) <> cardinality(p_extraction_run_ids) then
    raise exception 'One or more extraction runs are unavailable for this case.' using errcode='42501';
  end if;

  if (select count(*) from public.event_candidates e
      join public.knowledge_items k on k.id=e.knowledge_item_id
      where e.case_id=p_case_id and e.id=any(p_event_candidate_ids)
        and k.extraction_run_id=any(p_extraction_run_ids)) <> cardinality(p_event_candidate_ids) then
    raise exception 'One or more event candidates are unavailable for the selected run.' using errcode='42501';
  end if;

  if (select count(*) from public.temporal_assertions t
      join public.knowledge_items k on k.id=t.knowledge_item_id
      where t.case_id=p_case_id and t.id=any(p_temporal_assertion_ids)
        and t.event_candidate_id=any(p_event_candidate_ids)
        and k.extraction_run_id=any(p_extraction_run_ids)) <> cardinality(p_temporal_assertion_ids) then
    raise exception 'One or more temporal assertions are unavailable for the selected run.' using errcode='42501';
  end if;

  select jsonb_build_object(
    'schema_version','timeline-candidate-view/1.0',
    'captured_at',now(),
    'runs',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',r.id,'compiler_name',r.compiler_name,'compiler_version',r.compiler_version,
        'contract_version',r.extraction_contract_version,'configuration_sha256',r.configuration_sha256,
        'status',r.status,'created_at',r.created_at,'completed_at',r.completed_at
      ) order by r.created_at)
      from public.knowledge_extraction_runs r
      where r.case_id=p_case_id and r.id=any(p_extraction_run_ids)
    ),'[]'::jsonb),
    'items',coalesce((
      select jsonb_agg(jsonb_build_object(
        'event_candidate_id',e.id,
        'event_candidate_code',e.object_code,
        'neutral_description',e.neutral_description,
        'event_class',e.event_class,
        'source_wording',e.source_wording,
        'participant_mentions',e.participant_mentions,
        'event_recurrence_pattern',e.recurrence_pattern,
        'source_claim_ids',e.source_claim_ids,
        'event_status',e.review_status,
        'event_confidence',e.extraction_confidence,
        'temporal_assertion_id',t.id,
        'temporal_assertion_code',t.object_code,
        'raw_temporal_language',t.raw_temporal_language,
        'precision',t.precision,
        'asserted_start',t.asserted_start,
        'asserted_end',t.asserted_end,
        'asserted_date',t.asserted_date,
        'asserted_time_of_day_start',t.asserted_time_of_day_start,
        'asserted_time_of_day_end',t.asserted_time_of_day_end,
        'time_of_day_band',t.time_of_day_band,
        'qualification',t.qualification,
        'qualifier_text',t.qualifier_text,
        'confidence_basis',t.confidence_basis,
        'sequence_language',t.sequence_language,
        'duration_iso8601',t.duration_iso8601,
        'relative_offset_value',t.relative_offset_value,
        'relative_offset_unit',t.relative_offset_unit,
        'temporal_recurrence_pattern',t.recurrence_pattern,
        'temporal_status',t.review_status,
        'temporal_confidence',t.extraction_confidence,
        'source_segment_ids',captured_sources.source_segment_ids,
        'asserted_by_raw',coalesce(t.asserted_by_raw,c.asserted_by_raw,k.witness_label_raw),
        'proceeding_id',p.id,
        'proceeding_title',p.title,
        'proceeding_date',p.proceeding_date,
        'extraction_run_id',k.extraction_run_id
      ) order by e.logical_order,t.logical_order)
      from public.event_candidates e
      join public.knowledge_items k on k.id=e.knowledge_item_id
      join public.proceedings p on p.id=e.proceeding_id
      join public.temporal_assertions t on t.event_candidate_id=e.id and t.id=any(p_temporal_assertion_ids)
      left join public.claims c on c.id=t.source_claim_id
      cross join lateral (
        select coalesce(array_agg(distinct source_segment_id order by source_segment_id),'{}'::uuid[]) as source_segment_ids
        from (
          select unnest(t.source_segment_ids) as source_segment_id
          union all
          select event_claim.source_segment_id
            from public.claims event_claim where event_claim.id=any(e.source_claim_ids)
          union all
          select claim_link.source_segment_id
            from public.claim_source_segments claim_link where claim_link.claim_id=any(e.source_claim_ids)
        ) source_refs
      ) captured_sources
      where e.case_id=p_case_id and e.id=any(p_event_candidate_ids)
        and k.extraction_run_id=any(p_extraction_run_ids)
    ),'[]'::jsonb)
  ) into v_snapshot;

  perform pg_advisory_xact_lock(hashtextextended(p_case_id::text || ':' || lower(v_name),0));
  select coalesce(max(version),0)+1 into v_version
    from public.saved_timeline_views
    where case_id=p_case_id and lower(name)=lower(v_name);

  insert into public.saved_timeline_views(
    case_id,name,version,description,extraction_run_ids,event_candidate_ids,
    temporal_assertion_ids,view_state,snapshot,created_by
  ) values (
    p_case_id,v_name,v_version,coalesce(p_description,''),p_extraction_run_ids,
    p_event_candidate_ids,p_temporal_assertion_ids,coalesce(p_view_state,'{}'::jsonb),v_snapshot,v_actor
  ) returning * into v_row;

  insert into public.audit_events(id,case_id,actor_user_id,action,subject_type,subject_id,details)
  values(gen_random_uuid(),p_case_id,v_actor,'timeline_view.saved','saved_timeline_view',v_row.id::text,
    jsonb_build_object('name',v_name,'version',v_version,'events',cardinality(p_event_candidate_ids),'temporal_assertions',cardinality(p_temporal_assertion_ids)));

  return v_row;
end;
$$;

revoke all on function public.save_timeline_view_version(uuid,text,text,uuid[],uuid[],uuid[],jsonb) from public,anon;
grant execute on function public.save_timeline_view_version(uuid,text,text,uuid[],uuid[],uuid[],jsonb) to authenticated;
grant execute on function public.save_timeline_view_version(uuid,text,text,uuid[],uuid[],uuid[],jsonb) to service_role;
