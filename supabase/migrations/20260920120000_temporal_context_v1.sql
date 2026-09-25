-- Testimony -> Temporal Context Compiler v1.
-- Extends the existing testimony knowledge pipeline. Constraints and anchors get their own tables;
-- cross-witness proposals reuse knowledge_relationships and conflicts reuse knowledge_flags.
-- Nothing here creates canonical events or SAME resolutions.

alter table public.event_candidates
  add column candidate_kind text not null default 'event'
    check(candidate_kind in ('event','state_observation','knowledge_state')),
  add column anchor_family text,
  add column anchor_role text check(anchor_role is null or anchor_role in ('occurrence','detail','prior_state_origin')),
  add column state_claim jsonb,
  add column knowledge_state jsonb,
  add constraint event_candidates_knowledge_state_shape
    check((candidate_kind = 'knowledge_state') = (knowledge_state is not null));

alter table public.temporal_assertions
  add column assertion_form text check(assertion_form is null or assertion_form in (
    'EXACT_DATETIME','EXACT_DATE','EXACT_TIME','APPROXIMATE_TIME','INTERVAL','DURATION',
    'RELATIVE','SEQUENCE_ONLY','LOWER_BOUND','UPPER_BOUND','UNKNOWN')),
  add column adopted_from_question boolean not null default false,
  add column duration_min_seconds numeric,
  add column duration_max_seconds numeric,
  add column duration_vague boolean not null default false,
  add constraint temporal_assertions_duration_order
    check(duration_min_seconds is null or duration_max_seconds is null or duration_max_seconds >= duration_min_seconds);

alter table public.provenance_activities
  drop constraint if exists provenance_activities_activity_type_check;
alter table public.provenance_activities
  add constraint provenance_activities_activity_type_check
  check(activity_type in ('transcript_parse','deterministic_structure','knowledge_extraction','timeline_candidate_extraction','temporal_context_compilation','human_review','correction'));

create table public.temporal_anchor_candidates (
  id uuid primary key,
  case_id uuid not null references public.cases(id) on delete cascade,
  extraction_run_id uuid not null references public.knowledge_extraction_runs(id) on delete restrict,
  object_code text not null,
  family text not null,
  label text not null,
  anchor_class text not null check(anchor_class in ('CLOCK','ARRIVAL_DEPARTURE','SHARED_OBSERVATION','STATE','INFORMATION','TRANSITION')),
  review_status text not null check(review_status in ('pending','accepted','amended','rejected','deferred')),
  logical_order bigint not null,
  created_at timestamptz not null default now(),
  unique(case_id,object_code),
  unique(case_id,logical_order),
  unique(case_id,family)
);

create table public.temporal_constraints (
  id uuid primary key,
  case_id uuid not null references public.cases(id) on delete cascade,
  extraction_run_id uuid not null references public.knowledge_extraction_runs(id) on delete restrict,
  knowledge_item_id uuid not null references public.knowledge_items(id) on delete cascade,
  source_claim_id uuid not null references public.claims(id) on delete restrict,
  object_code text not null,
  account_key text not null,
  from_node_type text not null check(from_node_type in ('event_candidate','anchor_candidate')),
  from_node_id uuid not null,
  relation text not null check(relation in ('BEFORE','BEFORE_OR_AT','AT','AFTER_OR_AT','AFTER','OVERLAPS','DURING')),
  to_node_type text not null check(to_node_type in ('event_candidate','anchor_candidate')),
  to_node_id uuid not null,
  derivation text not null check(derivation in ('sequence_wording','simultaneity_wording','state_observation','knowledge_flow')),
  source_wording text not null check(length(source_wording) > 0),
  cue text not null check(length(cue) > 0),
  source_segment_ids uuid[] not null check(cardinality(source_segment_ids) > 0),
  review_status text not null check(review_status in ('pending','accepted','amended','rejected','deferred')),
  logical_order bigint not null,
  created_at timestamptz not null default now(),
  unique(case_id,object_code),
  unique(case_id,logical_order),
  check(from_node_id <> to_node_id)
);

create index temporal_constraints_from_idx on public.temporal_constraints(case_id,from_node_id);
create index temporal_constraints_to_idx on public.temporal_constraints(case_id,to_node_id);
create index event_candidates_anchor_family_idx on public.event_candidates(case_id,anchor_family) where anchor_family is not null;

alter table public.temporal_anchor_candidates enable row level security;
alter table public.temporal_constraints enable row level security;
create policy temporal_anchor_candidates_select on public.temporal_anchor_candidates for select to authenticated using(private.can_access_case(case_id));
create policy temporal_constraints_select on public.temporal_constraints for select to authenticated using(private.can_access_case(case_id));
revoke all on public.temporal_anchor_candidates, public.temporal_constraints from public, anon, authenticated;
grant select on public.temporal_anchor_candidates, public.temporal_constraints to authenticated;
grant all privileges on public.temporal_anchor_candidates, public.temporal_constraints to service_role;

create function public.commit_temporal_context(payload jsonb) returns jsonb
language plpgsql security definer set search_path=public,private,extensions as $$
declare
  v_case_id uuid := (payload->>'case_id')::uuid;
  v_proceeding_id uuid := (payload->>'proceeding_id')::uuid;
  v_actor uuid := (select auth.uid());
  v_ctx jsonb := payload->'context';
  v_run_id uuid := (payload->'context'->'run'->>'id')::uuid;
  v_compiler text := payload->'context'->'run'->>'compiler_name';
  v_proceeding public.proceedings%rowtype;
  v_existing public.knowledge_extraction_runs%rowtype;
  v_item jsonb;
  v_base jsonb;
  v_ids uuid[];
  v_found integer;
  v_order bigint;
  v_events_before bigint;
  v_entities_before bigint;
  v_counts jsonb;
begin
  if v_actor is null or not private.can_access_case(v_case_id) then
    raise exception 'Not authorized for this case.' using errcode='42501';
  end if;
  if v_compiler <> 'icarus-testimony-temporal-context-compiler'
     or payload->>'schema_version' <> 'testimony-knowledge/1.0+timeline-candidate/1.0+temporal-context/1.0' then
    raise exception 'Unexpected temporal context compiler or contract.';
  end if;
  if coalesce((payload->'boundary'->>'canonical_events_created')::integer,-1) <> 0
     or coalesce((payload->'boundary'->>'same_resolutions_created')::integer,-1) <> 0 then
    raise exception 'Temporal context compilation cannot create canonical events or SAME resolutions.';
  end if;
  if payload ?| array['claim_support','support','contradictions','verification','reconciliation','truth','entity_merges','canonical_entities','canonical_events'] then
    raise exception 'Temporal context payload crosses a forbidden analysis or SAME identity boundary.';
  end if;

  select * into v_proceeding from public.proceedings where id=v_proceeding_id and case_id=v_case_id for update;
  if not found then raise exception 'Proceeding not found in case.'; end if;
  if (v_ctx->'run'->>'source_artifact_id')::uuid <> v_proceeding.source_artifact_id then
    raise exception 'Temporal context source artifact does not match proceeding.';
  end if;

  select count(*) into v_events_before from public.events where case_id=v_case_id;
  select count(*) into v_entities_before from public.entities where case_id=v_case_id;

  -- Each witness account keeps its own unchanged, independently idempotent pipeline commit.
  for v_base in select value from jsonb_array_elements(coalesce(payload->'runs','[]'::jsonb)) loop
    if (v_base->>'case_id')::uuid <> v_case_id or (v_base->>'proceeding_id')::uuid <> v_proceeding_id then
      raise exception 'Account payload belongs to a different case or proceeding.';
    end if;
    perform public.commit_testimony_timeline_candidates(v_base);
  end loop;

  select * into v_existing from public.knowledge_extraction_runs
  where proceeding_id=v_proceeding_id and compiler_name=v_compiler
    and compiler_version=v_ctx->'run'->>'compiler_version'
    and configuration_sha256=v_ctx->'run'->>'configuration_sha256';
  if found then
    if v_existing.status <> 'complete' then raise exception 'Matching temporal context run is not complete.'; end if;
    return jsonb_build_object('run_id',v_existing.id,'duplicate',true,'canonical_events_created',0,'same_resolutions_created',0);
  end if;

  insert into public.knowledge_extraction_runs(id,case_id,proceeding_id,source_artifact_id,compiler_name,compiler_version,extraction_method,extraction_contract_version,configuration_sha256,status,created_by_user_id)
  values(v_run_id,v_case_id,v_proceeding_id,v_proceeding.source_artifact_id,v_compiler,v_ctx->'run'->>'compiler_version',v_ctx->'run'->>'extraction_method',v_ctx->'run'->>'extraction_contract_version',v_ctx->'run'->>'configuration_sha256','processing',v_actor);

  for v_item in select value from jsonb_array_elements(coalesce(v_ctx->'candidate_context','[]'::jsonb)) loop
    update public.event_candidates
      set candidate_kind=v_item->>'candidate_kind', anchor_family=nullif(v_item->>'anchor_family',''), anchor_role=nullif(v_item->>'anchor_role',''),
          state_claim=nullif(v_item->'state_claim','null'::jsonb), knowledge_state=nullif(v_item->'knowledge_state','null'::jsonb)
      where id=(v_item->>'event_candidate_id')::uuid and case_id=v_case_id and reconciled_event_id is null;
    if not found then raise exception 'Event candidate context targets a missing or reconciled candidate.'; end if;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(v_ctx->'assertion_context','[]'::jsonb)) loop
    update public.temporal_assertions
      set assertion_form=v_item->>'assertion_form', adopted_from_question=coalesce((v_item->>'adopted_from_question')::boolean,false),
          duration_min_seconds=nullif(v_item->>'duration_min_seconds','')::numeric, duration_max_seconds=nullif(v_item->>'duration_max_seconds','')::numeric,
          duration_vague=coalesce((v_item->>'duration_vague')::boolean,false)
      where id=(v_item->>'temporal_assertion_id')::uuid and case_id=v_case_id and event_id is null;
    if not found then raise exception 'Temporal assertion context targets a missing assertion.'; end if;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(v_ctx->'anchors','[]'::jsonb)) loop
    if not exists(select 1 from public.temporal_anchor_candidates where id=(v_item->>'id')::uuid and case_id=v_case_id) then
      v_order := private.append_case_ledger(v_case_id,'temporal_anchor_candidate',(v_item->>'id')::uuid,v_item->>'object_code','created',v_run_id,v_actor,v_compiler,jsonb_build_object('family',v_item->>'family'));
      insert into public.temporal_anchor_candidates(id,case_id,extraction_run_id,object_code,family,label,anchor_class,review_status,logical_order)
      values((v_item->>'id')::uuid,v_case_id,v_run_id,v_item->>'object_code',v_item->>'family',v_item->>'label',v_item->>'anchor_class','pending',v_order);
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(v_ctx->'constraints','[]'::jsonb)) loop
    v_ids := array(select jsonb_array_elements_text(v_item->'source_segment_ids')::uuid);
    select count(distinct s.id) into v_found from unnest(v_ids) x(id) join public.source_segments s on s.id=x.id and s.proceeding_id=v_proceeding_id;
    if cardinality(v_ids)=0 or v_found<>cardinality(v_ids) then raise exception 'Temporal constraint cites missing or foreign source segments.'; end if;
    if not exists(select 1 from public.event_candidates where id=(select case when v_item->>'from_node_type'='event_candidate' then (v_item->>'from_node_id')::uuid else (v_item->>'to_node_id')::uuid end) and case_id=v_case_id) then
      raise exception 'Temporal constraint must reference an event candidate.';
    end if;
    if v_item->>'from_node_type'='anchor_candidate' and not exists(select 1 from public.temporal_anchor_candidates where id=(v_item->>'from_node_id')::uuid and case_id=v_case_id) then
      raise exception 'Temporal constraint references an unknown anchor.';
    end if;
    if not exists(select 1 from public.temporal_constraints where id=(v_item->>'id')::uuid and case_id=v_case_id) then
      v_order := private.append_case_ledger(v_case_id,'temporal_constraint',(v_item->>'id')::uuid,v_item->>'object_code','created',v_run_id,v_actor,v_compiler,jsonb_build_object('relation',v_item->>'relation','derivation',v_item->>'derivation'));
      insert into public.temporal_constraints(id,case_id,extraction_run_id,knowledge_item_id,source_claim_id,object_code,account_key,from_node_type,from_node_id,relation,to_node_type,to_node_id,derivation,source_wording,cue,source_segment_ids,review_status,logical_order)
      values((v_item->>'id')::uuid,v_case_id,v_run_id,(v_item->>'knowledge_item_id')::uuid,(v_item->>'source_claim_id')::uuid,v_item->>'object_code',v_item->>'account_key',v_item->>'from_node_type',(v_item->>'from_node_id')::uuid,v_item->>'relation',v_item->>'to_node_type',(v_item->>'to_node_id')::uuid,v_item->>'derivation',v_item->>'source_wording',v_item->>'cue',v_ids,'pending',v_order);
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(v_ctx->'links','[]'::jsonb)) loop
    if (v_item->>'link_type') not in ('possible_shared_anchor','possible_same_event','possible_additional_detail') then
      raise exception 'Only possible_* review proposals may cross accounts; SAME resolution is forbidden here.';
    end if;
    if not exists(select 1 from public.knowledge_relationships where id=(v_item->>'id')::uuid and case_id=v_case_id) then
      v_order := private.append_case_ledger(v_case_id,'relationship',(v_item->>'id')::uuid,v_item->>'object_code','created',v_run_id,v_actor,v_compiler,jsonb_build_object('relation_type',v_item->>'link_type'));
      insert into public.knowledge_relationships(id,case_id,object_code,from_node_type,from_node_id,relation_type,to_node_type,to_node_id,source_claim_id,knowledge_item_id,source_id,assertion_status,extraction_confidence,review_status,logical_order)
      values((v_item->>'id')::uuid,v_case_id,v_item->>'object_code',v_item->>'from_node_type',(v_item->>'from_node_id')::uuid,v_item->>'link_type',v_item->>'to_node_type',(v_item->>'to_node_id')::uuid,(v_item->>'source_claim_id')::uuid,(v_item->>'knowledge_item_id')::uuid,v_proceeding.source_id,'candidate',0,'pending',v_order);
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(v_ctx->'conflicts','[]'::jsonb)) loop
    if not exists(select 1 from public.event_candidates where id=nullif(v_item->>'target_event_candidate_id','')::uuid and case_id=v_case_id) then
      raise exception 'Temporal conflict must target an event candidate.';
    end if;
    if not exists(select 1 from public.knowledge_flags where id=(v_item->>'id')::uuid and case_id=v_case_id) then
      v_order := private.append_case_ledger(v_case_id,'flag',(v_item->>'id')::uuid,v_item->>'object_code','flagged',v_run_id,v_actor,v_compiler,jsonb_build_object('flag_type','temporal_conflict:'||(v_item->>'kind')));
      insert into public.knowledge_flags(id,case_id,object_code,target_node_type,target_node_id,flag_type,rationale,origin,status,supporting_context,source_segment_ids,logical_order)
      values((v_item->>'id')::uuid,v_case_id,v_item->>'object_code','event_candidate',(v_item->>'target_event_candidate_id')::uuid,'temporal_conflict:'||(v_item->>'kind'),v_item->>'summary','deterministic_rule','proposed',jsonb_build_object('parties',v_item->'parties'),array(select jsonb_array_elements_text(coalesce(v_item->'source_segment_ids','[]'::jsonb))::uuid),v_order);
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(v_ctx->'provenance_activities','[]'::jsonb)) loop
    v_order := private.append_case_ledger(v_case_id,'provenance_activity',(v_item->>'id')::uuid,v_item->>'object_code','created',v_run_id,v_actor,v_compiler,jsonb_build_object('activity_type',v_item->>'activity_type'));
    insert into public.provenance_activities(id,case_id,extraction_run_id,object_code,activity_type,compiler_name,compiler_version,extraction_contract_version,configuration_sha256,associated_user_id,system_agent,logical_order)
    values((v_item->>'id')::uuid,v_case_id,v_run_id,v_item->>'object_code',v_item->>'activity_type',v_item->>'compiler_name',v_item->>'compiler_version',v_item->>'extraction_contract_version',v_item->>'configuration_sha256',v_actor,v_item->>'system_agent',v_order);
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(v_ctx->'provenance_relations','[]'::jsonb)) loop
    if not exists(select 1 from public.provenance_relations where id=(v_item->>'id')::uuid and case_id=v_case_id) then
      v_order := private.append_case_ledger(v_case_id,'provenance_relation',(v_item->>'id')::uuid,v_item->>'object_code','created',v_run_id,v_actor,v_compiler,jsonb_build_object('relation_type',v_item->>'relation_type'));
      insert into public.provenance_relations(id,case_id,object_code,from_node_type,from_node_id,relation_type,to_node_type,to_node_id,source_segment_ids,extraction_run_id,logical_order)
      values((v_item->>'id')::uuid,v_case_id,v_item->>'object_code',v_item->>'from_node_type',(v_item->>'from_node_id')::uuid,v_item->>'relation_type',v_item->>'to_node_type',(v_item->>'to_node_id')::uuid,array(select jsonb_array_elements_text(coalesce(v_item->'source_segment_ids','[]'::jsonb))::uuid),v_run_id,v_order);
    end if;
  end loop;

  if (select count(*) from public.events where case_id=v_case_id) <> v_events_before
     or (select count(*) from public.entities where case_id=v_case_id) <> v_entities_before then
    raise exception 'Temporal context compilation attempted to create canonical events or entities.';
  end if;

  update public.knowledge_extraction_runs set status='complete',completed_at=now() where id=v_run_id;
  v_counts := jsonb_build_object(
    'anchors',jsonb_array_length(coalesce(v_ctx->'anchors','[]'::jsonb)),
    'constraints',jsonb_array_length(coalesce(v_ctx->'constraints','[]'::jsonb)),
    'links',jsonb_array_length(coalesce(v_ctx->'links','[]'::jsonb)),
    'conflicts',jsonb_array_length(coalesce(v_ctx->'conflicts','[]'::jsonb)),
    'accounts',jsonb_array_length(coalesce(payload->'runs','[]'::jsonb)));
  insert into public.audit_events(id,case_id,actor_user_id,action,subject_type,subject_id,details)
  values(gen_random_uuid(),v_case_id,v_actor,'temporal_context.completed','knowledge_extraction_run',v_run_id::text,v_counts||jsonb_build_object('canonicalEventsCreated',0,'sameResolutionsCreated',0));
  return v_counts||jsonb_build_object('run_id',v_run_id,'duplicate',false,'canonical_events_created',0,'same_resolutions_created',0);
end; $$;

revoke all on function public.commit_temporal_context(jsonb) from public, anon;
grant execute on function public.commit_temporal_context(jsonb) to authenticated;

create or replace view public.temporal_context_projection
with (security_invoker=true) as
select
  event_candidate.case_id,
  event_candidate.proceeding_id,
  witness_block.witness_label_raw,
  event_candidate.id as event_candidate_id,
  event_candidate.object_code as event_candidate_code,
  event_candidate.candidate_kind,
  event_candidate.neutral_description,
  event_candidate.event_class,
  event_candidate.source_wording as event_source_wording,
  event_candidate.review_status as event_candidate_status,
  event_candidate.state_claim,
  event_candidate.knowledge_state,
  event_candidate.anchor_family,
  event_candidate.anchor_role,
  anchor.id as anchor_id,
  anchor.object_code as anchor_code,
  anchor.label as anchor_label,
  anchor.anchor_class,
  temporal_assertion.id as temporal_assertion_id,
  temporal_assertion.object_code as temporal_assertion_code,
  temporal_assertion.assertion_form,
  temporal_assertion.raw_temporal_language,
  temporal_assertion.precision as temporal_precision,
  temporal_assertion.qualification,
  temporal_assertion.qualifier_text,
  temporal_assertion.adopted_from_question,
  temporal_assertion.duration_min_seconds,
  temporal_assertion.duration_max_seconds,
  temporal_assertion.duration_vague,
  temporal_assertion.source_segment_ids as temporal_source_segment_ids,
  (select count(*) from public.temporal_constraints constraint_row
    where constraint_row.case_id=event_candidate.case_id
      and (constraint_row.from_node_id=event_candidate.id or constraint_row.to_node_id=event_candidate.id)) as constraint_count
from public.event_candidates event_candidate
join public.knowledge_items knowledge_item on knowledge_item.id=event_candidate.knowledge_item_id
join public.knowledge_extraction_runs extraction_run on extraction_run.id=knowledge_item.extraction_run_id
join public.testimony_units testimony_unit on testimony_unit.id=knowledge_item.testimony_unit_id
join public.witness_blocks witness_block on witness_block.id=testimony_unit.witness_block_id
left join public.temporal_assertions temporal_assertion on temporal_assertion.event_candidate_id=event_candidate.id and temporal_assertion.event_id is null
left join public.temporal_anchor_candidates anchor on anchor.case_id=event_candidate.case_id and anchor.family=event_candidate.anchor_family
where event_candidate.reconciled_event_id is null
  and extraction_run.compiler_name='icarus-testimony-timeline-candidate-compiler';

revoke all on public.temporal_context_projection from anon;
grant select on public.temporal_context_projection to authenticated;
grant all privileges on public.temporal_context_projection to service_role;
