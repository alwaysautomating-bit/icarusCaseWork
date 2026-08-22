-- Testimony Knowledge Mapping v1
-- Extends the committed proceeding record without creating Casework analysis.

create table public.knowledge_extraction_runs (
  id uuid primary key,
  case_id uuid not null references public.cases(id) on delete cascade,
  proceeding_id uuid not null references public.proceedings(id) on delete cascade,
  source_artifact_id uuid not null references public.source_artifacts(id) on delete restrict,
  compiler_name text not null,
  compiler_version text not null,
  extraction_method text not null check(extraction_method in ('deterministic','model','hybrid','reviewed_import')),
  model_name text,
  model_version text,
  extraction_contract_version text not null,
  configuration_sha256 text not null check(configuration_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null check(status in ('processing','complete','failed','review_required')),
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(proceeding_id,compiler_name,compiler_version,configuration_sha256)
);

create table public.case_ledger_heads (
  case_id uuid primary key references public.cases(id) on delete cascade,
  next_logical_order bigint not null default 1 check(next_logical_order > 0)
);

create table public.case_ledger (
  case_id uuid not null references public.cases(id) on delete cascade,
  logical_order bigint not null check(logical_order > 0),
  object_type text not null,
  object_id uuid not null,
  object_code text,
  operation text not null check(operation in ('created','versioned','reviewed','corrected','superseded','flagged')),
  extraction_run_id uuid references public.knowledge_extraction_runs(id) on delete restrict,
  actor_user_id uuid references auth.users(id),
  system_agent text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key(case_id,logical_order),
  unique(case_id,object_type,object_id,operation,logical_order)
);

create table public.witness_blocks (
  id uuid primary key,
  case_id uuid not null references public.cases(id) on delete cascade,
  proceeding_id uuid not null references public.proceedings(id) on delete cascade,
  extraction_run_id uuid not null references public.knowledge_extraction_runs(id) on delete restrict,
  object_code text not null,
  imported_id text,
  witness_label_raw text not null,
  resolved_entity_id uuid references public.entities(id) on delete set null,
  resolution_status text not null check(resolution_status in ('unresolved','externally_resolved','review_required')),
  resolution_basis text,
  start_segment_id uuid not null references public.source_segments(id) on delete restrict,
  end_segment_id uuid not null references public.source_segments(id) on delete restrict,
  start_timestamp_ms bigint,
  end_timestamp_ms bigint,
  boundary_confidence numeric(5,4) not null check(boundary_confidence between 0 and 1),
  exam_phase_candidates jsonb not null default '[]'::jsonb,
  jury_state_candidates jsonb not null default '[]'::jsonb,
  procedural_markers jsonb not null default '[]'::jsonb,
  review_status text not null check(review_status in ('pending','accepted','amended','rejected','deferred')),
  logical_order bigint not null,
  created_at timestamptz not null default now(),
  unique(case_id,object_code),
  unique(case_id,logical_order)
);

create table public.witness_block_segments (
  witness_block_id uuid not null references public.witness_blocks(id) on delete cascade,
  source_segment_id uuid not null references public.source_segments(id) on delete restrict,
  ordinal integer not null check(ordinal >= 0),
  primary key(witness_block_id,source_segment_id),
  unique(witness_block_id,ordinal)
);

create table public.testimony_units (
  id uuid primary key,
  case_id uuid not null references public.cases(id) on delete cascade,
  proceeding_id uuid not null references public.proceedings(id) on delete cascade,
  extraction_run_id uuid not null references public.knowledge_extraction_runs(id) on delete restrict,
  witness_block_id uuid not null references public.witness_blocks(id) on delete restrict,
  object_code text not null,
  unit_kind text not null check(unit_kind in ('qa_thread','substantive_thread','procedural_context','mixed')),
  witness_label_raw text not null,
  phase_candidate text,
  phase_confidence numeric(5,4) check(phase_confidence between 0 and 1),
  jury_state_candidate text,
  procedural_context jsonb not null default '[]'::jsonb,
  start_segment_id uuid not null references public.source_segments(id) on delete restrict,
  end_segment_id uuid not null references public.source_segments(id) on delete restrict,
  review_status text not null check(review_status in ('pending','accepted','amended','rejected','deferred')),
  logical_order bigint not null,
  created_at timestamptz not null default now(),
  unique(case_id,object_code),
  unique(case_id,logical_order)
);

create table public.testimony_unit_segments (
  testimony_unit_id uuid not null references public.testimony_units(id) on delete cascade,
  source_segment_id uuid not null references public.source_segments(id) on delete restrict,
  ordinal integer not null check(ordinal >= 0),
  context_role text not null check(context_role in ('substantive','question','answer','procedural','context')),
  primary key(testimony_unit_id,source_segment_id),
  unique(testimony_unit_id,ordinal)
);

create table public.knowledge_items (
  id uuid primary key,
  case_id uuid not null references public.cases(id) on delete cascade,
  proceeding_id uuid not null references public.proceedings(id) on delete cascade,
  extraction_run_id uuid not null references public.knowledge_extraction_runs(id) on delete restrict,
  testimony_unit_id uuid not null references public.testimony_units(id) on delete restrict,
  object_code text not null,
  summary text not null,
  witness_label_raw text not null,
  witness_entity_id uuid references public.entities(id) on delete set null,
  witness_resolution_status text not null check(witness_resolution_status in ('unresolved','externally_resolved','review_required')),
  phase_candidate text,
  phase_confidence numeric(5,4) check(phase_confidence between 0 and 1),
  jury_state_candidate text,
  unknowns jsonb not null default '[]'::jsonb,
  extraction_method text not null,
  model_version text,
  compiler_version text not null,
  extraction_contract_version text not null,
  review_status text not null check(review_status in ('pending','accepted','amended','rejected','deferred')),
  logical_order bigint not null,
  created_at timestamptz not null default now(),
  unique(case_id,object_code),
  unique(case_id,logical_order)
);

create table public.knowledge_item_segments (
  knowledge_item_id uuid not null references public.knowledge_items(id) on delete cascade,
  source_segment_id uuid not null references public.source_segments(id) on delete restrict,
  ordinal integer not null check(ordinal >= 0),
  primary key(knowledge_item_id,source_segment_id),
  unique(knowledge_item_id,ordinal)
);

create table public.knowledge_item_versions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  knowledge_item_id uuid not null references public.knowledge_items(id) on delete cascade,
  version integer not null check(version > 0),
  summary text not null,
  payload jsonb not null,
  action text not null check(action in ('created','amended','corrected','reviewed')),
  created_by_user_id uuid not null references auth.users(id),
  logical_order bigint not null,
  created_at timestamptz not null default now(),
  unique(knowledge_item_id,version),
  unique(case_id,logical_order)
);

alter table public.claims alter column proposition_id drop not null;
alter table public.claims
  add column object_code text,
  add column knowledge_item_id uuid references public.knowledge_items(id) on delete restrict,
  add column asserted_by_entity_id uuid references public.entities(id) on delete set null,
  add column asserted_by_raw text,
  add column speaker_capacity text,
  add column normalized_assertion text,
  add column assertion_status text not null default 'asserted' check(assertion_status in ('asserted','disputed','qualified','corrected','withdrawn','stipulated','court_found','unknown')),
  add column information_basis text not null default 'UNKNOWN_BASIS' check(information_basis in ('PERSONALLY_OBSERVED','HEARD_FROM_PERSON','READ_IN_RECORD','REVIEWED_DEVICE_DATA','RECALLED','EXPERT_INFERENCE','PARTY_ARGUMENT','UNKNOWN_BASIS')),
  add column logical_order bigint,
  add constraint claims_case_object_code_unique unique(case_id,object_code),
  add constraint claims_case_logical_order_unique unique(case_id,logical_order);

create table public.claim_source_segments (
  claim_id uuid not null references public.claims(id) on delete cascade,
  source_segment_id uuid not null references public.source_segments(id) on delete restrict,
  ordinal integer not null check(ordinal >= 0),
  primary key(claim_id,source_segment_id),
  unique(claim_id,ordinal)
);

create table public.entity_mentions (
  id uuid primary key,
  case_id uuid not null references public.cases(id) on delete cascade,
  knowledge_item_id uuid not null references public.knowledge_items(id) on delete cascade,
  object_code text not null,
  raw_mention text not null,
  normalized_candidate text,
  mention_type text,
  resolved_entity_id uuid references public.entities(id) on delete set null,
  resolution_status text not null check(resolution_status in ('unresolved','candidate','externally_resolved','rejected')),
  resolution_confidence numeric(5,4) check(resolution_confidence between 0 and 1),
  resolution_basis text,
  source_segment_ids uuid[] not null check(cardinality(source_segment_ids) > 0),
  review_status text not null check(review_status in ('pending','accepted','amended','rejected','deferred')),
  logical_order bigint not null,
  created_at timestamptz not null default now(),
  unique(case_id,object_code),
  unique(case_id,logical_order)
);

create table public.event_candidates (
  id uuid primary key,
  case_id uuid not null references public.cases(id) on delete cascade,
  proceeding_id uuid not null references public.proceedings(id) on delete cascade,
  knowledge_item_id uuid not null references public.knowledge_items(id) on delete cascade,
  object_code text not null,
  neutral_description text not null,
  participant_mentions jsonb not null default '[]'::jsonb,
  source_claim_ids uuid[] not null default '{}'::uuid[],
  extraction_confidence numeric(5,4) not null check(extraction_confidence between 0 and 1),
  review_status text not null check(review_status in ('pending','accepted','amended','rejected','deferred','reconciled')),
  reconciled_event_id uuid references public.events(id) on delete set null,
  reconciliation_basis text,
  logical_order bigint not null,
  created_at timestamptz not null default now(),
  unique(case_id,object_code),
  unique(case_id,logical_order),
  check((reconciled_event_id is null and review_status <> 'reconciled') or (reconciled_event_id is not null and review_status = 'reconciled'))
);

create table public.temporal_bands (
  id uuid primary key,
  case_id uuid not null references public.cases(id) on delete cascade,
  object_code text not null,
  label text not null,
  description text not null default '',
  ordinal integer not null check(ordinal >= 0),
  review_status text not null check(review_status in ('pending','accepted','amended','rejected','deferred')),
  unique(case_id,object_code),
  unique(case_id,label),
  unique(case_id,ordinal)
);

create table public.temporal_assertions (
  id uuid primary key,
  case_id uuid not null references public.cases(id) on delete cascade,
  knowledge_item_id uuid not null references public.knowledge_items(id) on delete cascade,
  source_claim_id uuid references public.claims(id) on delete restrict,
  event_id uuid references public.events(id) on delete restrict,
  event_candidate_id uuid references public.event_candidates(id) on delete restrict,
  object_code text not null,
  raw_temporal_language text not null,
  asserted_start timestamptz,
  asserted_end timestamptz,
  precision text not null check(precision in ('exact_timestamp','exact_date','approximate','interval','bounded_interval','relative_only','unknown')),
  temporal_band_id uuid references public.temporal_bands(id) on delete set null,
  lower_bound_event_id uuid references public.events(id) on delete set null,
  upper_bound_event_id uuid references public.events(id) on delete set null,
  asserted_by_entity_id uuid references public.entities(id) on delete set null,
  asserted_by_raw text,
  source_id uuid not null references public.sources(id) on delete restrict,
  source_segment_ids uuid[] not null check(cardinality(source_segment_ids) > 0),
  extraction_confidence numeric(5,4) not null check(extraction_confidence between 0 and 1),
  review_status text not null check(review_status in ('pending','accepted','amended','rejected','deferred')),
  logical_order bigint not null,
  created_at timestamptz not null default now(),
  unique(case_id,object_code),
  unique(case_id,logical_order),
  check(event_id is not null or event_candidate_id is not null),
  check(asserted_end is null or asserted_start is null or asserted_end >= asserted_start),
  check(precision <> 'unknown' or (asserted_start is null and asserted_end is null)),
  check(precision <> 'relative_only' or (asserted_start is null and asserted_end is null))
);

create table public.knowledge_relationships (
  id uuid primary key,
  case_id uuid not null references public.cases(id) on delete cascade,
  object_code text not null,
  from_node_type text not null,
  from_node_id uuid not null,
  relation_type text not null,
  to_node_type text not null,
  to_node_id uuid not null,
  source_claim_id uuid references public.claims(id) on delete restrict,
  knowledge_item_id uuid not null references public.knowledge_items(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete restrict,
  assertion_status text not null check(assertion_status in ('asserted','candidate','qualified','corrected','withdrawn','unknown')),
  extraction_confidence numeric(5,4) not null check(extraction_confidence between 0 and 1),
  review_status text not null check(review_status in ('pending','accepted','amended','rejected','deferred')),
  logical_order bigint not null,
  created_at timestamptz not null default now(),
  unique(case_id,object_code),
  unique(case_id,logical_order),
  check(relation_type not in ('causes','caused_by'))
);

create table public.knowledge_flags (
  id uuid primary key,
  case_id uuid not null references public.cases(id) on delete cascade,
  object_code text not null,
  target_node_type text not null,
  target_node_id uuid not null,
  flag_type text not null,
  rationale text not null,
  origin text not null check(origin in ('human','agent','deterministic_rule')),
  status text not null check(status in ('proposed','accepted','rejected','resolved','deferred')),
  reviewer_user_id uuid references auth.users(id),
  supporting_context jsonb not null default '{}'::jsonb,
  source_segment_ids uuid[] not null default '{}'::uuid[],
  logical_order bigint not null,
  created_at timestamptz not null default now(),
  unique(case_id,object_code),
  unique(case_id,logical_order),
  check(origin <> 'agent' or status in ('proposed','accepted','rejected','deferred'))
);

create table public.provenance_activities (
  id uuid primary key,
  case_id uuid not null references public.cases(id) on delete cascade,
  extraction_run_id uuid references public.knowledge_extraction_runs(id) on delete restrict,
  object_code text not null,
  activity_type text not null check(activity_type in ('transcript_parse','deterministic_structure','knowledge_extraction','human_review','correction')),
  compiler_name text,
  compiler_version text,
  model_name text,
  model_version text,
  extraction_contract_version text,
  configuration_sha256 text check(configuration_sha256 is null or configuration_sha256 ~ '^[a-f0-9]{64}$'),
  started_at timestamptz,
  ended_at timestamptz,
  associated_user_id uuid references auth.users(id),
  system_agent text,
  logical_order bigint not null,
  created_at timestamptz not null default now(),
  unique(case_id,object_code),
  unique(case_id,logical_order),
  check(ended_at is null or started_at is null or ended_at >= started_at)
);

create table public.provenance_relations (
  id uuid primary key,
  case_id uuid not null references public.cases(id) on delete cascade,
  object_code text not null,
  from_node_type text not null,
  from_node_id uuid not null,
  relation_type text not null check(relation_type in ('used','was_generated_by','was_derived_from','was_associated_with','was_attributed_to','had_primary_source','specialization_of')),
  to_node_type text not null,
  to_node_id uuid not null,
  source_segment_ids uuid[] not null default '{}'::uuid[],
  extraction_run_id uuid references public.knowledge_extraction_runs(id) on delete restrict,
  logical_order bigint not null,
  created_at timestamptz not null default now(),
  unique(case_id,object_code),
  unique(case_id,logical_order)
);

create index witness_blocks_proceeding_order_idx on public.witness_blocks(proceeding_id,start_timestamp_ms,end_timestamp_ms);
create index testimony_units_witness_idx on public.testimony_units(witness_block_id,logical_order);
create index knowledge_items_proceeding_idx on public.knowledge_items(proceeding_id,logical_order);
create index entity_mentions_unresolved_idx on public.entity_mentions(case_id,resolution_status) where resolved_entity_id is null;
create index event_candidates_review_idx on public.event_candidates(case_id,review_status,logical_order);
create index temporal_assertions_event_idx on public.temporal_assertions(event_id,event_candidate_id,logical_order);
create index knowledge_relationships_from_idx on public.knowledge_relationships(case_id,from_node_type,from_node_id);
create index knowledge_relationships_to_idx on public.knowledge_relationships(case_id,to_node_type,to_node_id);
create index knowledge_flags_target_idx on public.knowledge_flags(case_id,target_node_type,target_node_id,status);
create index provenance_relations_from_idx on public.provenance_relations(case_id,from_node_type,from_node_id);
create index provenance_relations_to_idx on public.provenance_relations(case_id,to_node_type,to_node_id);

alter table public.knowledge_extraction_runs enable row level security;
alter table public.case_ledger_heads enable row level security;
alter table public.case_ledger enable row level security;
alter table public.witness_blocks enable row level security;
alter table public.witness_block_segments enable row level security;
alter table public.testimony_units enable row level security;
alter table public.testimony_unit_segments enable row level security;
alter table public.knowledge_items enable row level security;
alter table public.knowledge_item_segments enable row level security;
alter table public.knowledge_item_versions enable row level security;
alter table public.claim_source_segments enable row level security;
alter table public.entity_mentions enable row level security;
alter table public.event_candidates enable row level security;
alter table public.temporal_bands enable row level security;
alter table public.temporal_assertions enable row level security;
alter table public.knowledge_relationships enable row level security;
alter table public.knowledge_flags enable row level security;
alter table public.provenance_activities enable row level security;
alter table public.provenance_relations enable row level security;

create policy knowledge_runs_select on public.knowledge_extraction_runs for select to authenticated using(private.can_access_case(case_id));
create policy case_ledger_select on public.case_ledger for select to authenticated using(private.can_access_case(case_id));
create policy witness_blocks_select on public.witness_blocks for select to authenticated using(private.can_access_case(case_id));
create policy testimony_units_select on public.testimony_units for select to authenticated using(private.can_access_case(case_id));
create policy knowledge_items_select on public.knowledge_items for select to authenticated using(private.can_access_case(case_id));
create policy knowledge_item_versions_select on public.knowledge_item_versions for select to authenticated using(private.can_access_case(case_id));
create policy entity_mentions_select on public.entity_mentions for select to authenticated using(private.can_access_case(case_id));
create policy event_candidates_select on public.event_candidates for select to authenticated using(private.can_access_case(case_id));
create policy temporal_bands_select on public.temporal_bands for select to authenticated using(private.can_access_case(case_id));
create policy temporal_assertions_select on public.temporal_assertions for select to authenticated using(private.can_access_case(case_id));
create policy knowledge_relationships_select on public.knowledge_relationships for select to authenticated using(private.can_access_case(case_id));
create policy knowledge_flags_select on public.knowledge_flags for select to authenticated using(private.can_access_case(case_id));
create policy provenance_activities_select on public.provenance_activities for select to authenticated using(private.can_access_case(case_id));
create policy provenance_relations_select on public.provenance_relations for select to authenticated using(private.can_access_case(case_id));

create policy witness_block_segments_select on public.witness_block_segments for select to authenticated using(exists(select 1 from public.witness_blocks b where b.id=witness_block_id and private.can_access_case(b.case_id)));
create policy testimony_unit_segments_select on public.testimony_unit_segments for select to authenticated using(exists(select 1 from public.testimony_units u where u.id=testimony_unit_id and private.can_access_case(u.case_id)));
create policy knowledge_item_segments_select on public.knowledge_item_segments for select to authenticated using(exists(select 1 from public.knowledge_items k where k.id=knowledge_item_id and private.can_access_case(k.case_id)));
create policy claim_source_segments_select on public.claim_source_segments for select to authenticated using(exists(select 1 from public.claims c where c.id=claim_id and private.can_access_case(c.case_id)));

grant select on public.knowledge_extraction_runs,public.case_ledger,public.witness_blocks,public.witness_block_segments,public.testimony_units,public.testimony_unit_segments,public.knowledge_items,public.knowledge_item_segments,public.knowledge_item_versions,public.claim_source_segments,public.entity_mentions,public.event_candidates,public.temporal_bands,public.temporal_assertions,public.knowledge_relationships,public.knowledge_flags,public.provenance_activities,public.provenance_relations to authenticated;
revoke all on public.case_ledger_heads from public,anon,authenticated;
revoke all on public.knowledge_extraction_runs,public.case_ledger,public.witness_blocks,public.witness_block_segments,public.testimony_units,public.testimony_unit_segments,public.knowledge_items,public.knowledge_item_segments,public.knowledge_item_versions,public.claim_source_segments,public.entity_mentions,public.event_candidates,public.temporal_bands,public.temporal_assertions,public.knowledge_relationships,public.knowledge_flags,public.provenance_activities,public.provenance_relations from anon;

create function private.append_case_ledger(
  p_case_id uuid,
  p_object_type text,
  p_object_id uuid,
  p_object_code text,
  p_operation text,
  p_extraction_run_id uuid,
  p_actor_user_id uuid,
  p_system_agent text,
  p_details jsonb default '{}'::jsonb
) returns bigint
language plpgsql security definer set search_path='' as $$
declare v_order bigint;
begin
  insert into public.case_ledger_heads(case_id,next_logical_order)
  values(p_case_id,2)
  on conflict(case_id) do update
    set next_logical_order=public.case_ledger_heads.next_logical_order+1
  returning next_logical_order-1 into v_order;

  insert into public.case_ledger(case_id,logical_order,object_type,object_id,object_code,operation,extraction_run_id,actor_user_id,system_agent,details)
  values(p_case_id,v_order,p_object_type,p_object_id,p_object_code,p_operation,p_extraction_run_id,p_actor_user_id,p_system_agent,coalesce(p_details,'{}'::jsonb));
  return v_order;
end; $$;

revoke all on function private.append_case_ledger(uuid,text,uuid,text,text,uuid,uuid,text,jsonb) from public,anon,authenticated;

create function public.commit_testimony_knowledge_map(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_case_id uuid := (payload->>'case_id')::uuid;
  v_proceeding_id uuid := (payload->>'proceeding_id')::uuid;
  v_actor uuid := (select auth.uid());
  v_run_id uuid := (payload->'run'->>'id')::uuid;
  v_source_id uuid;
  v_artifact_id uuid;
  v_proceeding public.proceedings%rowtype;
  v_existing public.knowledge_extraction_runs%rowtype;
  v_item jsonb;
  v_ids uuid[];
  v_found integer;
  v_order bigint;
  v_version_id uuid;
  v_segment_id uuid;
  v_index bigint;
  v_claim_count integer := 0;
begin
  if v_actor is null or not private.can_access_case(v_case_id) then
    raise exception 'Not authorized for this case.' using errcode='42501';
  end if;
  if payload ?| array['claim_support','support','contradictions','verification_assessments','verification','reconciliation','truth','hypotheses','theories','entity_merges','entity_aliases','canonical_entities'] then
    raise exception 'Knowledge mapping payload crosses a forbidden analysis or SAME identity boundary.';
  end if;

  select * into v_proceeding from public.proceedings where id=v_proceeding_id and case_id=v_case_id for update;
  if not found then raise exception 'Proceeding not found in case.'; end if;
  if v_proceeding.status not in ('complete','published') or v_proceeding.detected_segments<>v_proceeding.parsed_segments or v_proceeding.parsed_segments<>v_proceeding.committed_segments then
    raise exception 'Only a complete proceeding may enter knowledge mapping.';
  end if;
  v_source_id := v_proceeding.source_id;
  v_artifact_id := v_proceeding.source_artifact_id;
  if (payload->'run'->>'source_artifact_id')::uuid<>v_artifact_id then raise exception 'Extraction run source artifact does not match proceeding.'; end if;

  select * into v_existing from public.knowledge_extraction_runs
  where proceeding_id=v_proceeding_id
    and compiler_name=payload->'run'->>'compiler_name'
    and compiler_version=payload->'run'->>'compiler_version'
    and configuration_sha256=payload->'run'->>'configuration_sha256';
  if found then
    if v_existing.status<>'complete' then raise exception 'Matching knowledge extraction run is not complete.'; end if;
    return jsonb_build_object('run_id',v_existing.id,'duplicate',true,'knowledge_items',(select count(*) from public.knowledge_items where extraction_run_id=v_existing.id),'claims',(select count(*) from public.claims where knowledge_item_id in (select id from public.knowledge_items where extraction_run_id=v_existing.id)));
  end if;

  insert into public.knowledge_extraction_runs(id,case_id,proceeding_id,source_artifact_id,compiler_name,compiler_version,extraction_method,model_name,model_version,extraction_contract_version,configuration_sha256,status,created_by_user_id)
  values(v_run_id,v_case_id,v_proceeding_id,v_artifact_id,payload->'run'->>'compiler_name',payload->'run'->>'compiler_version',payload->'run'->>'extraction_method',nullif(payload->'run'->>'model_name',''),nullif(payload->'run'->>'model_version',''),payload->'run'->>'extraction_contract_version',payload->'run'->>'configuration_sha256','processing',v_actor);

  for v_item in select value from jsonb_array_elements(coalesce(payload->'witness_blocks','[]'::jsonb)) loop
    v_ids := array(select jsonb_array_elements_text(v_item->'source_segment_ids')::uuid);
    select count(distinct s.id) into v_found from unnest(v_ids) x(id) join public.source_segments s on s.id=x.id and s.proceeding_id=v_proceeding_id;
    if cardinality(v_ids)=0 or v_found<>cardinality(v_ids) then raise exception 'Witness block contains missing, duplicate, or foreign segments.'; end if;
    v_order := private.append_case_ledger(v_case_id,'witness_block',(v_item->>'id')::uuid,v_item->>'object_code','created',v_run_id,v_actor,payload->'run'->>'compiler_name',jsonb_build_object('source_segment_count',cardinality(v_ids)));
    insert into public.witness_blocks(id,case_id,proceeding_id,extraction_run_id,object_code,imported_id,witness_label_raw,resolved_entity_id,resolution_status,resolution_basis,start_segment_id,end_segment_id,start_timestamp_ms,end_timestamp_ms,boundary_confidence,exam_phase_candidates,jury_state_candidates,procedural_markers,review_status,logical_order)
    values((v_item->>'id')::uuid,v_case_id,v_proceeding_id,v_run_id,v_item->>'object_code',v_item->>'imported_id',v_item->>'witness_label_raw',nullif(v_item->>'resolved_entity_id','')::uuid,v_item->>'resolution_status',nullif(v_item->>'resolution_basis',''),(v_item->>'start_segment_id')::uuid,(v_item->>'end_segment_id')::uuid,(v_item->>'start_timestamp_ms')::bigint,(v_item->>'end_timestamp_ms')::bigint,(v_item->>'boundary_confidence')::numeric,coalesce(v_item->'exam_phase_candidates','[]'::jsonb),coalesce(v_item->'jury_state_candidates','[]'::jsonb),coalesce(v_item->'procedural_markers','[]'::jsonb),v_item->>'review_status',v_order);
    for v_segment_id,v_index in select value::uuid,ordinality-1 from jsonb_array_elements_text(v_item->'source_segment_ids') with ordinality loop
      insert into public.witness_block_segments(witness_block_id,source_segment_id,ordinal) values((v_item->>'id')::uuid,v_segment_id,v_index::integer);
    end loop;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(payload->'testimony_units','[]'::jsonb)) loop
    v_ids := array(select (value->>'source_segment_id')::uuid from jsonb_array_elements(v_item->'segments'));
    select count(distinct s.id) into v_found from unnest(v_ids) x(id) join public.source_segments s on s.id=x.id and s.proceeding_id=v_proceeding_id;
    if cardinality(v_ids)=0 or v_found<>cardinality(v_ids) then raise exception 'Testimony unit contains missing, duplicate, or foreign segments.'; end if;
    if exists(select 1 from unnest(v_ids) x(id) where not exists(select 1 from public.witness_block_segments b where b.witness_block_id=(v_item->>'witness_block_id')::uuid and b.source_segment_id=x.id)) then raise exception 'Testimony unit segment is outside its witness block.'; end if;
    v_order := private.append_case_ledger(v_case_id,'testimony_unit',(v_item->>'id')::uuid,v_item->>'object_code','created',v_run_id,v_actor,payload->'run'->>'compiler_name',jsonb_build_object('source_segment_count',cardinality(v_ids)));
    insert into public.testimony_units(id,case_id,proceeding_id,extraction_run_id,witness_block_id,object_code,unit_kind,witness_label_raw,phase_candidate,phase_confidence,jury_state_candidate,procedural_context,start_segment_id,end_segment_id,review_status,logical_order)
    values((v_item->>'id')::uuid,v_case_id,v_proceeding_id,v_run_id,(v_item->>'witness_block_id')::uuid,v_item->>'object_code',v_item->>'unit_kind',v_item->>'witness_label_raw',nullif(v_item->>'phase_candidate',''),nullif(v_item->>'phase_confidence','')::numeric,nullif(v_item->>'jury_state_candidate',''),coalesce(v_item->'procedural_context','[]'::jsonb),(v_item->>'start_segment_id')::uuid,(v_item->>'end_segment_id')::uuid,v_item->>'review_status',v_order);
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(payload->'testimony_units','[]'::jsonb)) loop
    for v_segment_id,v_index in select (value->>'source_segment_id')::uuid,ordinality-1 from jsonb_array_elements(v_item->'segments') with ordinality loop
      insert into public.testimony_unit_segments(testimony_unit_id,source_segment_id,ordinal,context_role)
      select (v_item->>'id')::uuid,v_segment_id,v_index::integer,(segment.value->>'context_role')
      from jsonb_array_elements(v_item->'segments') with ordinality segment(value,ordinality)
      where segment.ordinality=v_index+1;
    end loop;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(payload->'knowledge_items','[]'::jsonb)) loop
    v_ids := array(select jsonb_array_elements_text(v_item->'source_segment_ids')::uuid);
    if cardinality(v_ids)=0 or exists(select 1 from unnest(v_ids) x(id) where not exists(select 1 from public.testimony_unit_segments u where u.testimony_unit_id=(v_item->>'testimony_unit_id')::uuid and u.source_segment_id=x.id)) then raise exception 'Knowledge item segment is outside its testimony unit.'; end if;
    v_order := private.append_case_ledger(v_case_id,'knowledge_item',(v_item->>'id')::uuid,v_item->>'object_code','created',v_run_id,v_actor,payload->'run'->>'compiler_name',jsonb_build_object('source_segment_count',cardinality(v_ids)));
    insert into public.knowledge_items(id,case_id,proceeding_id,extraction_run_id,testimony_unit_id,object_code,summary,witness_label_raw,witness_entity_id,witness_resolution_status,phase_candidate,phase_confidence,jury_state_candidate,unknowns,extraction_method,model_version,compiler_version,extraction_contract_version,review_status,logical_order)
    values((v_item->>'id')::uuid,v_case_id,v_proceeding_id,v_run_id,(v_item->>'testimony_unit_id')::uuid,v_item->>'object_code',v_item->>'summary',v_item->>'witness_label_raw',nullif(v_item->>'witness_entity_id','')::uuid,v_item->>'witness_resolution_status',nullif(v_item->>'phase_candidate',''),nullif(v_item->>'phase_confidence','')::numeric,nullif(v_item->>'jury_state_candidate',''),coalesce(v_item->'unknowns','[]'::jsonb),payload->'run'->>'extraction_method',nullif(payload->'run'->>'model_version',''),payload->'run'->>'compiler_version',payload->'run'->>'extraction_contract_version',v_item->>'review_status',v_order);
    for v_segment_id,v_index in select value::uuid,ordinality-1 from jsonb_array_elements_text(v_item->'source_segment_ids') with ordinality loop
      insert into public.knowledge_item_segments(knowledge_item_id,source_segment_id,ordinal) values((v_item->>'id')::uuid,v_segment_id,v_index::integer);
    end loop;
    v_version_id := gen_random_uuid();
    v_order := private.append_case_ledger(v_case_id,'knowledge_item_version',v_version_id,v_item->>'object_code','versioned',v_run_id,v_actor,payload->'run'->>'compiler_name',jsonb_build_object('version',1));
    insert into public.knowledge_item_versions(id,case_id,knowledge_item_id,version,summary,payload,action,created_by_user_id,logical_order)
    values(v_version_id,v_case_id,(v_item->>'id')::uuid,1,v_item->>'summary',v_item,'created',v_actor,v_order);
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(payload->'claims','[]'::jsonb)) loop
    v_ids := array(select jsonb_array_elements_text(v_item->'source_segment_ids')::uuid);
    if cardinality(v_ids)=0 or exists(select 1 from unnest(v_ids) x(id) where not exists(select 1 from public.knowledge_item_segments k where k.knowledge_item_id=(v_item->>'knowledge_item_id')::uuid and k.source_segment_id=x.id)) then raise exception 'Claim segment is outside its knowledge item.'; end if;
    v_order := private.append_case_ledger(v_case_id,'claim',(v_item->>'id')::uuid,v_item->>'object_code','created',v_run_id,v_actor,payload->'run'->>'compiler_name',jsonb_build_object('assertion_status',v_item->>'assertion_status'));
    insert into public.claims(id,case_id,source_segment_id,claimant,assertion,status,source_id,proposition_id,evidence_lane,provenance_type,epistemic_status,extraction_confidence,source_quote,review_required,review_reasons,object_code,knowledge_item_id,asserted_by_entity_id,asserted_by_raw,speaker_capacity,normalized_assertion,assertion_status,information_basis,logical_order)
    values((v_item->>'id')::uuid,v_case_id,v_ids[1],v_item->>'asserted_by_raw',v_item->>'normalized_assertion','candidate',v_source_id,nullif(v_item->>'proposition_id','')::uuid,'testimony',(v_item->>'provenance_type')::public.claim_provenance_type,'unassessed',(v_item->>'extraction_confidence')::numeric,v_item->>'source_quote',true,coalesce(v_item->'review_reasons','[]'::jsonb),v_item->>'object_code',(v_item->>'knowledge_item_id')::uuid,nullif(v_item->>'asserted_by_entity_id','')::uuid,v_item->>'asserted_by_raw',nullif(v_item->>'speaker_capacity',''),v_item->>'normalized_assertion',v_item->>'assertion_status',v_item->>'information_basis',v_order);
    for v_segment_id,v_index in select value,ordinality-1 from unnest(v_ids) with ordinality as segment(value,ordinality) loop
      insert into public.claim_source_segments(claim_id,source_segment_id,ordinal) values((v_item->>'id')::uuid,v_segment_id,v_index::integer);
    end loop;
    v_claim_count := v_claim_count+1;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(payload->'entity_mentions','[]'::jsonb)) loop
    v_ids := array(select jsonb_array_elements_text(v_item->'source_segment_ids')::uuid);
    v_order := private.append_case_ledger(v_case_id,'entity_mention',(v_item->>'id')::uuid,v_item->>'object_code','created',v_run_id,v_actor,payload->'run'->>'compiler_name','{}'::jsonb);
    insert into public.entity_mentions(id,case_id,knowledge_item_id,object_code,raw_mention,normalized_candidate,mention_type,resolved_entity_id,resolution_status,resolution_confidence,resolution_basis,source_segment_ids,review_status,logical_order)
    values((v_item->>'id')::uuid,v_case_id,(v_item->>'knowledge_item_id')::uuid,v_item->>'object_code',v_item->>'raw_mention',nullif(v_item->>'normalized_candidate',''),nullif(v_item->>'mention_type',''),nullif(v_item->>'resolved_entity_id','')::uuid,v_item->>'resolution_status',nullif(v_item->>'resolution_confidence','')::numeric,nullif(v_item->>'resolution_basis',''),v_ids,v_item->>'review_status',v_order);
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(payload->'event_candidates','[]'::jsonb)) loop
    v_order := private.append_case_ledger(v_case_id,'event_candidate',(v_item->>'id')::uuid,v_item->>'object_code','created',v_run_id,v_actor,payload->'run'->>'compiler_name','{}'::jsonb);
    insert into public.event_candidates(id,case_id,proceeding_id,knowledge_item_id,object_code,neutral_description,participant_mentions,source_claim_ids,extraction_confidence,review_status,reconciled_event_id,reconciliation_basis,logical_order)
    values((v_item->>'id')::uuid,v_case_id,v_proceeding_id,(v_item->>'knowledge_item_id')::uuid,v_item->>'object_code',v_item->>'neutral_description',coalesce(v_item->'participant_mentions','[]'::jsonb),array(select jsonb_array_elements_text(coalesce(v_item->'source_claim_ids','[]'::jsonb))::uuid),(v_item->>'extraction_confidence')::numeric,v_item->>'review_status',null,null,v_order);
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(payload->'temporal_assertions','[]'::jsonb)) loop
    v_order := private.append_case_ledger(v_case_id,'temporal_assertion',(v_item->>'id')::uuid,v_item->>'object_code','created',v_run_id,v_actor,payload->'run'->>'compiler_name',jsonb_build_object('precision',v_item->>'precision'));
    insert into public.temporal_assertions(id,case_id,knowledge_item_id,source_claim_id,event_id,event_candidate_id,object_code,raw_temporal_language,asserted_start,asserted_end,precision,temporal_band_id,lower_bound_event_id,upper_bound_event_id,asserted_by_entity_id,asserted_by_raw,source_id,source_segment_ids,extraction_confidence,review_status,logical_order)
    values((v_item->>'id')::uuid,v_case_id,(v_item->>'knowledge_item_id')::uuid,nullif(v_item->>'source_claim_id','')::uuid,nullif(v_item->>'event_id','')::uuid,nullif(v_item->>'event_candidate_id','')::uuid,v_item->>'object_code',v_item->>'raw_temporal_language',nullif(v_item->>'asserted_start','')::timestamptz,nullif(v_item->>'asserted_end','')::timestamptz,v_item->>'precision',nullif(v_item->>'temporal_band_id','')::uuid,nullif(v_item->>'lower_bound_event_id','')::uuid,nullif(v_item->>'upper_bound_event_id','')::uuid,nullif(v_item->>'asserted_by_entity_id','')::uuid,v_item->>'asserted_by_raw',v_source_id,array(select jsonb_array_elements_text(v_item->'source_segment_ids')::uuid),(v_item->>'extraction_confidence')::numeric,v_item->>'review_status',v_order);
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(payload->'relationships','[]'::jsonb)) loop
    if (v_item->>'relation_type') in ('supports','corroborates','contradicts','conflicts_with','causes','caused_by') then raise exception 'Analytical or unscoped causal relationship is forbidden in transcript mapping.'; end if;
    v_order := private.append_case_ledger(v_case_id,'relationship',(v_item->>'id')::uuid,v_item->>'object_code','created',v_run_id,v_actor,payload->'run'->>'compiler_name',jsonb_build_object('relation_type',v_item->>'relation_type'));
    insert into public.knowledge_relationships(id,case_id,object_code,from_node_type,from_node_id,relation_type,to_node_type,to_node_id,source_claim_id,knowledge_item_id,source_id,assertion_status,extraction_confidence,review_status,logical_order)
    values((v_item->>'id')::uuid,v_case_id,v_item->>'object_code',v_item->>'from_node_type',(v_item->>'from_node_id')::uuid,v_item->>'relation_type',v_item->>'to_node_type',(v_item->>'to_node_id')::uuid,nullif(v_item->>'source_claim_id','')::uuid,(v_item->>'knowledge_item_id')::uuid,v_source_id,v_item->>'assertion_status',(v_item->>'extraction_confidence')::numeric,v_item->>'review_status',v_order);
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(payload->'flags','[]'::jsonb)) loop
    v_order := private.append_case_ledger(v_case_id,'flag',(v_item->>'id')::uuid,v_item->>'object_code','flagged',v_run_id,v_actor,payload->'run'->>'compiler_name',jsonb_build_object('flag_type',v_item->>'flag_type'));
    insert into public.knowledge_flags(id,case_id,object_code,target_node_type,target_node_id,flag_type,rationale,origin,status,reviewer_user_id,supporting_context,source_segment_ids,logical_order)
    values((v_item->>'id')::uuid,v_case_id,v_item->>'object_code',v_item->>'target_node_type',(v_item->>'target_node_id')::uuid,v_item->>'flag_type',v_item->>'rationale',v_item->>'origin',v_item->>'status',null,coalesce(v_item->'supporting_context','{}'::jsonb),array(select jsonb_array_elements_text(coalesce(v_item->'source_segment_ids','[]'::jsonb))::uuid),v_order);
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(payload->'provenance_activities','[]'::jsonb)) loop
    v_order := private.append_case_ledger(v_case_id,'provenance_activity',(v_item->>'id')::uuid,v_item->>'object_code','created',v_run_id,v_actor,payload->'run'->>'compiler_name',jsonb_build_object('activity_type',v_item->>'activity_type'));
    insert into public.provenance_activities(id,case_id,extraction_run_id,object_code,activity_type,compiler_name,compiler_version,model_name,model_version,extraction_contract_version,configuration_sha256,started_at,ended_at,associated_user_id,system_agent,logical_order)
    values((v_item->>'id')::uuid,v_case_id,v_run_id,v_item->>'object_code',v_item->>'activity_type',nullif(v_item->>'compiler_name',''),nullif(v_item->>'compiler_version',''),nullif(v_item->>'model_name',''),nullif(v_item->>'model_version',''),nullif(v_item->>'extraction_contract_version',''),nullif(v_item->>'configuration_sha256',''),nullif(v_item->>'started_at','')::timestamptz,nullif(v_item->>'ended_at','')::timestamptz,v_actor,nullif(v_item->>'system_agent',''),v_order);
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(payload->'provenance_relations','[]'::jsonb)) loop
    v_order := private.append_case_ledger(v_case_id,'provenance_relation',(v_item->>'id')::uuid,v_item->>'object_code','created',v_run_id,v_actor,payload->'run'->>'compiler_name',jsonb_build_object('relation_type',v_item->>'relation_type'));
    insert into public.provenance_relations(id,case_id,object_code,from_node_type,from_node_id,relation_type,to_node_type,to_node_id,source_segment_ids,extraction_run_id,logical_order)
    values((v_item->>'id')::uuid,v_case_id,v_item->>'object_code',v_item->>'from_node_type',(v_item->>'from_node_id')::uuid,v_item->>'relation_type',v_item->>'to_node_type',(v_item->>'to_node_id')::uuid,array(select jsonb_array_elements_text(coalesce(v_item->'source_segment_ids','[]'::jsonb))::uuid),v_run_id,v_order);
  end loop;

  update public.knowledge_extraction_runs set status='complete',completed_at=now() where id=v_run_id;
  insert into public.audit_events(id,case_id,actor_user_id,action,subject_type,subject_id,details)
  values(gen_random_uuid(),v_case_id,v_actor,'testimony_knowledge_map.completed','knowledge_extraction_run',v_run_id::text,jsonb_build_object('knowledgeItems',jsonb_array_length(coalesce(payload->'knowledge_items','[]'::jsonb)),'claims',v_claim_count,'analyticalAssessmentsCreated',0,'sameResolutionsCreated',0));
  return jsonb_build_object('run_id',v_run_id,'duplicate',false,'knowledge_items',jsonb_array_length(coalesce(payload->'knowledge_items','[]'::jsonb)),'claims',v_claim_count,'analytical_assessments_created',0,'same_resolutions_created',0);
end; $$;

revoke all on function public.commit_testimony_knowledge_map(jsonb) from public,anon;
grant execute on function public.commit_testimony_knowledge_map(jsonb) to authenticated;
grant all privileges on all tables in schema public to service_role;
