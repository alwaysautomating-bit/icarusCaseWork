alter table public.evidence_intakes
  add column detected_segments integer not null default 0 check(detected_segments >= 0),
  add column parsed_segments integer not null default 0 check(parsed_segments >= 0),
  add column committed_segments integer not null default 0 check(committed_segments >= 0),
  add column first_timestamp_ms bigint,
  add column last_timestamp_ms bigint,
  add column parser_warnings jsonb not null default '[]'::jsonb;

update public.evidence_intakes
set processing_status='review_required',review_required=true,error_message=coalesce(error_message,'Legacy completion did not record detected/parsed/committed counts; reprocess through Testimony Compiler v1.')
where processing_status='complete';

alter table public.evidence_intakes
  add constraint evidence_intakes_complete_counts check(
    processing_status <> 'complete'
    or (detected_segments = parsed_segments and parsed_segments = committed_segments and detected_segments > 0)
  );

create table public.proceedings (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  evidence_intake_id uuid not null unique references public.evidence_intakes(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  source_artifact_id uuid not null unique references public.source_artifacts(id) on delete cascade,
  title text not null,
  proceeding_type text not null check(proceeding_type in ('trial_day','opening_statements','hearing','other')),
  proceeding_date date,
  compiler_name text not null,
  compiler_version text not null,
  status text not null check(status in ('processing','complete','failed','published')),
  detected_segments integer not null check(detected_segments >= 0),
  parsed_segments integer not null check(parsed_segments >= 0),
  committed_segments integer not null default 0 check(committed_segments >= 0),
  first_timestamp_ms bigint,
  last_timestamp_ms bigint,
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check(status not in ('complete','published') or (detected_segments=parsed_segments and parsed_segments=committed_segments and detected_segments > 0))
);

create table public.proceeding_speakers (
  id uuid primary key,
  case_id uuid not null references public.cases(id) on delete cascade,
  proceeding_id uuid not null references public.proceedings(id) on delete cascade,
  provider_label text not null,
  canonical_name text,
  role text,
  review_required boolean not null default false,
  unique(proceeding_id,provider_label)
);

alter table public.source_segments
  add column proceeding_id uuid references public.proceedings(id) on delete cascade,
  add column proceeding_speaker_id uuid references public.proceeding_speakers(id) on delete set null;

create table public.qa_exchanges (
  id uuid primary key,
  case_id uuid not null references public.cases(id) on delete cascade,
  proceeding_id uuid not null references public.proceedings(id) on delete cascade,
  ordinal integer not null check(ordinal >= 0),
  question_segment_id uuid not null references public.source_segments(id) on delete cascade,
  answer_segment_ids uuid[] not null check(cardinality(answer_segment_ids) > 0),
  context_segment_ids uuid[] not null,
  question_speaker_id uuid references public.proceeding_speakers(id),
  answer_speaker_id uuid references public.proceeding_speakers(id),
  question_text text not null,
  answer_text text not null,
  unique(proceeding_id,ordinal)
);

create table public.extraction_candidates (
  id uuid primary key,
  case_id uuid not null references public.cases(id) on delete cascade,
  proceeding_id uuid not null references public.proceedings(id) on delete cascade,
  candidate_type text not null check(candidate_type in ('testimony_claim','qa_exchange','procedural_action','position','exhibit','stipulation','resolution_item')),
  source_segment_ids uuid[] not null check(cardinality(source_segment_ids) > 0),
  payload jsonb not null,
  extraction_confidence numeric(5,4) not null check(extraction_confidence between 0 and 1),
  review_status text not null default 'pending' check(review_status in ('pending','accepted','amended','split','rejected','deferred')),
  current_review_version integer not null default 0 check(current_review_version >= 0),
  parent_candidate_id uuid references public.extraction_candidates(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.extraction_review_versions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  candidate_id uuid not null references public.extraction_candidates(id) on delete cascade,
  version integer not null check(version > 0),
  action text not null check(action in ('accept','amend','split','reject','defer')),
  payload jsonb,
  note text not null default '',
  reviewed_by_user_id uuid not null references auth.users(id),
  reviewed_at timestamptz not null default now(),
  unique(candidate_id,version)
);

create table public.proceeding_positions (
  id uuid primary key,
  case_id uuid not null references public.cases(id) on delete cascade,
  proceeding_id uuid not null references public.proceedings(id) on delete cascade,
  party text not null check(party in ('commonwealth','defense','other')),
  statement text not null,
  evidence_status text not null default 'not_evidence' check(evidence_status='not_evidence'),
  source_segment_ids uuid[] not null check(cardinality(source_segment_ids) > 0)
);

create table public.procedural_actions (
  id uuid primary key,
  case_id uuid not null references public.cases(id) on delete cascade,
  proceeding_id uuid not null references public.proceedings(id) on delete cascade,
  action text not null,
  source_segment_ids uuid[] not null check(cardinality(source_segment_ids) > 0)
);

create table public.proceeding_exhibits (
  id uuid primary key,
  case_id uuid not null references public.cases(id) on delete cascade,
  proceeding_id uuid not null references public.proceedings(id) on delete cascade,
  label text not null,
  admission_status text not null check(admission_status in ('identification','admitted','unknown')),
  description text not null,
  source_segment_ids uuid[] not null check(cardinality(source_segment_ids) > 0),
  unique(proceeding_id,label)
);

create table public.proceeding_stipulations (
  id uuid primary key,
  case_id uuid not null references public.cases(id) on delete cascade,
  proceeding_id uuid not null references public.proceedings(id) on delete cascade,
  exhibit_label text not null,
  subject text not null,
  status text not null check(status in ('accepted','entered')),
  exact_text text not null,
  source_segment_ids uuid[] not null check(cardinality(source_segment_ids) > 0)
);

create table public.resolution_items (
  id uuid primary key,
  case_id uuid not null references public.cases(id) on delete cascade,
  proceeding_id uuid not null references public.proceedings(id) on delete cascade,
  kind text not null,
  title text not null,
  detail text not null,
  status text not null default 'unresolved' check(status in ('unresolved','resolved','deferred')),
  event_time timestamptz,
  source_segment_ids uuid[] not null check(cardinality(source_segment_ids) > 0)
);

create table public.proceeding_package_versions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  proceeding_id uuid not null references public.proceedings(id) on delete cascade,
  version integer not null check(version > 0),
  schema_version text not null check(schema_version='proceeding-package/1.0'),
  package_sha256 text not null,
  package jsonb not null,
  publication_status text not null default 'draft' check(publication_status in ('draft','published','superseded')),
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  published_by_user_id uuid references auth.users(id),
  published_at timestamptz,
  unique(proceeding_id,version)
);

create table public.casework_proceeding_imports (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  package_version_id uuid not null references public.proceeding_package_versions(id) on delete restrict,
  import_status text not null check(import_status='imported'),
  imported_segments integer not null check(imported_segments >= 0),
  analytical_assessments_created integer not null default 0 check(analytical_assessments_created=0),
  imported_by_user_id uuid not null references auth.users(id),
  imported_at timestamptz not null default now(),
  unique(case_id,package_version_id)
);

create index proceedings_case_status_idx on public.proceedings(case_id,status,created_at desc);
create index proceeding_speakers_proceeding_idx on public.proceeding_speakers(proceeding_id);
create index qa_exchanges_proceeding_idx on public.qa_exchanges(proceeding_id,ordinal);
create index extraction_candidates_review_idx on public.extraction_candidates(proceeding_id,review_status,candidate_type);
create index extraction_review_versions_candidate_idx on public.extraction_review_versions(candidate_id,version desc);
create index source_segments_proceeding_ordinal_idx on public.source_segments(proceeding_id,ordinal);

alter table public.proceedings enable row level security;
alter table public.proceeding_speakers enable row level security;
alter table public.qa_exchanges enable row level security;
alter table public.extraction_candidates enable row level security;
alter table public.extraction_review_versions enable row level security;
alter table public.proceeding_positions enable row level security;
alter table public.procedural_actions enable row level security;
alter table public.proceeding_exhibits enable row level security;
alter table public.proceeding_stipulations enable row level security;
alter table public.resolution_items enable row level security;
alter table public.proceeding_package_versions enable row level security;
alter table public.casework_proceeding_imports enable row level security;

create policy proceedings_case_access on public.proceedings for all to authenticated using(private.can_access_case(case_id)) with check(private.can_access_case(case_id));
create policy proceeding_speakers_case_access on public.proceeding_speakers for all to authenticated using(private.can_access_case(case_id)) with check(private.can_access_case(case_id));
create policy qa_exchanges_case_access on public.qa_exchanges for all to authenticated using(private.can_access_case(case_id)) with check(private.can_access_case(case_id));
create policy extraction_candidates_case_access on public.extraction_candidates for all to authenticated using(private.can_access_case(case_id)) with check(private.can_access_case(case_id));
create policy extraction_review_versions_select on public.extraction_review_versions for select to authenticated using(private.can_access_case(case_id));
create policy proceeding_positions_case_access on public.proceeding_positions for all to authenticated using(private.can_access_case(case_id)) with check(private.can_access_case(case_id));
create policy procedural_actions_case_access on public.procedural_actions for all to authenticated using(private.can_access_case(case_id)) with check(private.can_access_case(case_id));
create policy proceeding_exhibits_case_access on public.proceeding_exhibits for all to authenticated using(private.can_access_case(case_id)) with check(private.can_access_case(case_id));
create policy proceeding_stipulations_case_access on public.proceeding_stipulations for all to authenticated using(private.can_access_case(case_id)) with check(private.can_access_case(case_id));
create policy resolution_items_case_access on public.resolution_items for all to authenticated using(private.can_access_case(case_id)) with check(private.can_access_case(case_id));
create policy proceeding_package_versions_select on public.proceeding_package_versions for select to authenticated using(private.can_access_case(case_id));
create policy casework_proceeding_imports_select on public.casework_proceeding_imports for select to authenticated using(private.can_access_case(case_id));

grant select on public.extraction_review_versions,public.proceeding_package_versions,public.casework_proceeding_imports to authenticated;
grant select,insert,update,delete on public.proceedings,public.proceeding_speakers,public.qa_exchanges,public.extraction_candidates,public.proceeding_positions,public.procedural_actions,public.proceeding_exhibits,public.proceeding_stipulations,public.resolution_items to authenticated;
revoke all on public.proceedings,public.proceeding_speakers,public.qa_exchanges,public.extraction_candidates,public.extraction_review_versions,public.proceeding_positions,public.procedural_actions,public.proceeding_exhibits,public.proceeding_stipulations,public.resolution_items,public.proceeding_package_versions,public.casework_proceeding_imports from anon;

create function public.review_extraction_candidate(p_candidate_id uuid,p_action text,p_payload jsonb default null,p_note text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid := (select auth.uid());
  v_candidate public.extraction_candidates%rowtype;
  v_version integer;
  v_child jsonb;
  v_child_ids uuid[] := '{}';
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
end; $$;

revoke all on function public.review_extraction_candidate(uuid,text,jsonb,text) from public,anon;
grant execute on function public.review_extraction_candidate(uuid,text,jsonb,text) to authenticated;

create function public.publish_proceeding_package(p_package_version_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid := (select auth.uid()); v_package public.proceeding_package_versions%rowtype; v_proceeding public.proceedings%rowtype; v_json_segments integer;
begin
  select * into v_package from public.proceeding_package_versions where id=p_package_version_id for update;
  if not found or v_actor is null or not private.can_access_case(v_package.case_id) then raise exception 'Package not found or not authorized.' using errcode='42501'; end if;
  select * into v_proceeding from public.proceedings where id=v_package.proceeding_id for update;
  v_json_segments := jsonb_array_length(coalesce(v_package.package->'segments','[]'::jsonb));
  if v_proceeding.status not in ('complete','published') or v_proceeding.detected_segments<>v_proceeding.parsed_segments or v_proceeding.parsed_segments<>v_proceeding.committed_segments or v_json_segments<>v_proceeding.committed_segments then raise exception 'Package completeness validation failed.'; end if;
  update public.proceeding_package_versions set publication_status='superseded' where proceeding_id=v_proceeding.id and publication_status='published' and id<>p_package_version_id;
  update public.proceeding_package_versions set publication_status='published',published_by_user_id=v_actor,published_at=now() where id=p_package_version_id;
  update public.proceedings set status='published' where id=v_proceeding.id;
  return jsonb_build_object('package_version_id',p_package_version_id,'publication_status','published','segments',v_json_segments);
end; $$;

create function public.import_proceeding_package_to_casework(p_package_version_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid := (select auth.uid()); v_package public.proceeding_package_versions%rowtype; v_import_id uuid; v_segments integer;
begin
  select * into v_package from public.proceeding_package_versions where id=p_package_version_id;
  if not found or v_actor is null or not private.can_access_case(v_package.case_id) then raise exception 'Package not found or not authorized.' using errcode='42501'; end if;
  if v_package.publication_status<>'published' then raise exception 'Only a published package can cross the Casework import boundary.'; end if;
  v_segments := jsonb_array_length(coalesce(v_package.package->'segments','[]'::jsonb));
  insert into public.casework_proceeding_imports(case_id,package_version_id,import_status,imported_segments,analytical_assessments_created,imported_by_user_id)
  values(v_package.case_id,p_package_version_id,'imported',v_segments,0,v_actor)
  on conflict(case_id,package_version_id) do update set import_status=excluded.import_status
  returning id into v_import_id;
  insert into public.audit_events(id,case_id,actor_user_id,action,subject_type,subject_id,details)
  values(gen_random_uuid(),v_package.case_id,v_actor,'proceeding_package.imported','proceeding_package_version',p_package_version_id::text,jsonb_build_object('segments',v_segments,'analyticalAssessmentsCreated',0));
  return jsonb_build_object('import_id',v_import_id,'status','imported','segments',v_segments,'analytical_assessments_created',0);
end; $$;

revoke all on function public.publish_proceeding_package(uuid),public.import_proceeding_package_to_casework(uuid) from public,anon;
grant execute on function public.publish_proceeding_package(uuid),public.import_proceeding_package_to_casework(uuid) to authenticated;

-- The URL-specific function marked rows complete before counting committed rows.
-- All callers must use the unified compiler boundary below.
revoke execute on function public.commit_testimony_url_intake(jsonb) from authenticated;

create function public.commit_testimony_compiler_run(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_case_id uuid := (payload->>'case_id')::uuid;
  v_actor uuid := (select auth.uid());
  v_intake_id uuid := (payload->'intake'->>'id')::uuid;
  v_source_id uuid := (payload->'source'->>'id')::uuid;
  v_lineage_id uuid := (payload->'lineage'->>'id')::uuid;
  v_artifact_id uuid := (payload->'artifact'->>'id')::uuid;
  v_proceeding_id uuid := (payload->'proceeding'->>'id')::uuid;
  v_package_id uuid := (payload->'package_version'->>'id')::uuid;
  v_detected integer := (payload->'coverage'->>'detected_segments')::integer;
  v_parsed integer := (payload->'coverage'->>'parsed_segments')::integer;
  v_committed integer;
  v_existing public.proceedings%rowtype;
begin
  if v_actor is null or not private.can_access_case(v_case_id) then raise exception 'Not authorized for this case.' using errcode='42501'; end if;
  if payload ?| array['claim_support','support','contradictions','verification_assessments','verification','reconciliation','truth','hypotheses'] then raise exception 'Casework analytical assessments are forbidden during compilation.'; end if;
  if payload->'source'->>'evidence_lane'<>'testimony' then raise exception 'The Testimony Compiler accepts the testimony lane only.'; end if;
  if v_detected is null or v_parsed is null or v_detected<=0 or v_detected<>v_parsed or v_parsed<>jsonb_array_length(coalesce(payload->'segments','[]'::jsonb)) then
    raise exception 'Completeness precondition failed: detected %, parsed %, payload segments %.',v_detected,v_parsed,jsonb_array_length(coalesce(payload->'segments','[]'::jsonb));
  end if;
  if payload->'package_version'->>'schema_version'<>'proceeding-package/1.0' or jsonb_array_length(coalesce(payload->'package_version'->'package'->'segments','[]'::jsonb))<>v_parsed then raise exception 'ProceedingPackage v1 segment coverage failed.'; end if;

  select p.* into v_existing from public.proceedings p join public.source_artifacts a on a.id=p.source_artifact_id where p.case_id=v_case_id and a.sha256=payload->'artifact'->>'sha256' limit 1;
  if found then
    if v_existing.status not in ('complete','published') or v_existing.detected_segments<>v_detected or v_existing.parsed_segments<>v_parsed or v_existing.committed_segments<>v_parsed then raise exception 'Existing artifact is incomplete or conflicts with this compiler run.'; end if;
    return jsonb_build_object('intake_id',v_existing.evidence_intake_id,'source_id',v_existing.source_id,'artifact_id',v_existing.source_artifact_id,'proceeding_id',v_existing.id,'package_version_id',(select id from public.proceeding_package_versions where proceeding_id=v_existing.id order by version desc limit 1),'duplicate',true,'segments',v_existing.committed_segments,'claims',(select count(*) from public.extraction_candidates where proceeding_id=v_existing.id and candidate_type='testimony_claim'),'acquisition_targets',0,'detected',v_existing.detected_segments,'parsed',v_existing.parsed_segments,'committed',v_existing.committed_segments);
  end if;

  insert into public.sources(id,case_id,title,source_family,evidence_lane,origin_date,known_to_exist,possessed_by_us,completeness,notes)
  values(v_source_id,v_case_id,payload->'source'->>'title',(payload->'source'->>'source_family')::public.source_family,'testimony',nullif(payload->'source'->>'origin_date','')::date,true,true,'processing',coalesce(payload->'source'->>'notes',''));
  insert into public.evidence_intakes(id,case_id,source_id,submitted_url,canonical_url,page_title,publisher,published_date,capture_method,content_type,captured_at,sha256,original_object_key,processing_status,parser_name,parser_version,review_required,created_by_user_id,detected_segments,parsed_segments,committed_segments,first_timestamp_ms,last_timestamp_ms,parser_warnings)
  values(v_intake_id,v_case_id,v_source_id,payload->'intake'->>'submitted_url',payload->'intake'->>'canonical_url',payload->'intake'->>'page_title',payload->'intake'->>'publisher',nullif(payload->'intake'->>'published_date','')::date,coalesce(nullif(payload->'intake'->>'capture_method',''),'import')::public.capture_method,payload->'intake'->>'content_type',(payload->'intake'->>'captured_at')::timestamptz,payload->'artifact'->>'sha256',payload->'artifact'->>'object_key','processing',payload->'intake'->>'parser_name',payload->'intake'->>'parser_version',false,v_actor,v_detected,v_parsed,0,(payload->'coverage'->>'first_timestamp_ms')::bigint,(payload->'coverage'->>'last_timestamp_ms')::bigint,coalesce(payload->'coverage'->'parser_warnings','[]'::jsonb));
  insert into public.source_lineages(id,case_id,source_id,lineage_key,notes) values(v_lineage_id,v_case_id,v_source_id,payload->'lineage'->>'lineage_key',coalesce(payload->'lineage'->>'notes',''));
  insert into public.source_artifacts(id,case_id,title,media_type,sha256,byte_length,object_key,acquired_from,is_authorized,source_id,evidence_intake_id,source_lineage_id,document_type,original_filename,source_url,canonical_url,publisher,capture_method,retrieved_at,is_original,is_derivative,completeness,parser_status)
  values(v_artifact_id,v_case_id,payload->'artifact'->>'title',payload->'artifact'->>'media_type',payload->'artifact'->>'sha256',(payload->'artifact'->>'byte_length')::integer,payload->'artifact'->>'object_key',payload->'artifact'->>'source_url',true,v_source_id,v_intake_id,v_lineage_id,payload->'artifact'->>'document_type',payload->'artifact'->>'original_filename',payload->'artifact'->>'source_url',payload->'artifact'->>'canonical_url',payload->'artifact'->>'publisher',coalesce(nullif(payload->'intake'->>'capture_method',''),'import')::public.capture_method,(payload->'artifact'->>'retrieved_at')::timestamptz,true,false,'processing','processing');
  update public.source_lineages set canonical_artifact_id=v_artifact_id where id=v_lineage_id;
  insert into public.proceedings(id,case_id,evidence_intake_id,source_id,source_artifact_id,title,proceeding_type,proceeding_date,compiler_name,compiler_version,status,detected_segments,parsed_segments,committed_segments,first_timestamp_ms,last_timestamp_ms,created_by_user_id)
  values(v_proceeding_id,v_case_id,v_intake_id,v_source_id,v_artifact_id,payload->'proceeding'->>'title',payload->'proceeding'->>'proceeding_type',nullif(payload->'proceeding'->>'proceeding_date','')::date,payload->'proceeding'->>'compiler_name',payload->'proceeding'->>'compiler_version','processing',v_detected,v_parsed,0,(payload->'coverage'->>'first_timestamp_ms')::bigint,(payload->'coverage'->>'last_timestamp_ms')::bigint,v_actor);

  insert into public.proceeding_speakers(id,case_id,proceeding_id,provider_label,canonical_name,role,review_required)
  select s.id,v_case_id,v_proceeding_id,s.provider_label,s.canonical_name,s.role,coalesce(s.review_required,false)
  from jsonb_to_recordset(coalesce(payload->'speakers','[]'::jsonb)) as s(id uuid,provider_label text,canonical_name text,role text,review_required boolean);
  insert into public.source_segments(id,artifact_id,locator_type,locator,exact_text,case_id,ordinal,timestamp_start_ms,timestamp_end_ms,deep_link,transcript_provider,proceeding_id,proceeding_speaker_id)
  select s.id,v_artifact_id,'timestamp',s.locator,s.exact_text,v_case_id,s.ordinal,s.timestamp_start_ms,s.timestamp_end_ms,s.deep_link,payload->'intake'->>'publisher',v_proceeding_id,ps.id
  from jsonb_to_recordset(payload->'segments') as s(id uuid,ordinal integer,speaker text,timestamp_start_ms bigint,timestamp_end_ms bigint,deep_link text,exact_text text,locator jsonb)
  join public.proceeding_speakers ps on ps.proceeding_id=v_proceeding_id and ps.provider_label=s.speaker;
  select count(*) into v_committed from public.source_segments where proceeding_id=v_proceeding_id;
  if v_committed<>v_detected or v_committed<>v_parsed then raise exception 'Completeness commit failed: detected %, parsed %, committed %.',v_detected,v_parsed,v_committed; end if;

  insert into public.qa_exchanges(id,case_id,proceeding_id,ordinal,question_segment_id,answer_segment_ids,context_segment_ids,question_speaker_id,answer_speaker_id,question_text,answer_text)
  select q.id,v_case_id,v_proceeding_id,q.ordinal,q.question_segment_id,array(select jsonb_array_elements_text(q.answer_segment_ids)::uuid),array(select jsonb_array_elements_text(q.context_segment_ids)::uuid),qs.id,ans.id,q.question_text,q.answer_text
  from jsonb_to_recordset(coalesce(payload->'qa_exchanges','[]'::jsonb)) as q(id uuid,ordinal integer,question_segment_id uuid,answer_segment_ids jsonb,context_segment_ids jsonb,question_speaker text,answer_speaker text,question_text text,answer_text text)
  left join public.proceeding_speakers qs on qs.proceeding_id=v_proceeding_id and qs.provider_label=q.question_speaker
  left join public.proceeding_speakers ans on ans.proceeding_id=v_proceeding_id and ans.provider_label=q.answer_speaker;
  insert into public.extraction_candidates(id,case_id,proceeding_id,candidate_type,source_segment_ids,payload,extraction_confidence,review_status)
  select c.id,v_case_id,v_proceeding_id,c.candidate_type,array(select jsonb_array_elements_text(c.source_segment_ids)::uuid),c.payload,c.extraction_confidence,'pending'
  from jsonb_to_recordset(coalesce(payload->'extraction_candidates','[]'::jsonb)) as c(id uuid,candidate_type text,source_segment_ids jsonb,payload jsonb,extraction_confidence numeric);
  insert into public.proceeding_positions(id,case_id,proceeding_id,party,statement,evidence_status,source_segment_ids)
  select p.id,v_case_id,v_proceeding_id,p.party,p.statement,'not_evidence',array(select jsonb_array_elements_text(p.source_segment_ids)::uuid) from jsonb_to_recordset(coalesce(payload->'positions','[]'::jsonb)) as p(id uuid,party text,statement text,source_segment_ids jsonb);
  insert into public.procedural_actions(id,case_id,proceeding_id,action,source_segment_ids)
  select p.id,v_case_id,v_proceeding_id,p.action,array(select jsonb_array_elements_text(p.source_segment_ids)::uuid) from jsonb_to_recordset(coalesce(payload->'procedural_actions','[]'::jsonb)) as p(id uuid,action text,source_segment_ids jsonb);
  insert into public.proceeding_exhibits(id,case_id,proceeding_id,label,admission_status,description,source_segment_ids)
  select e.id,v_case_id,v_proceeding_id,e.label,e.admission_status,e.description,array(select jsonb_array_elements_text(e.source_segment_ids)::uuid) from jsonb_to_recordset(coalesce(payload->'exhibits','[]'::jsonb)) as e(id uuid,label text,admission_status text,description text,source_segment_ids jsonb);
  insert into public.proceeding_stipulations(id,case_id,proceeding_id,exhibit_label,subject,status,exact_text,source_segment_ids)
  select s.id,v_case_id,v_proceeding_id,s.exhibit_label,s.subject,s.status,s.exact_text,array(select jsonb_array_elements_text(s.source_segment_ids)::uuid) from jsonb_to_recordset(coalesce(payload->'stipulations','[]'::jsonb)) as s(id uuid,exhibit_label text,subject text,status text,exact_text text,source_segment_ids jsonb);
  insert into public.resolution_items(id,case_id,proceeding_id,kind,title,detail,status,event_time,source_segment_ids)
  select r.id,v_case_id,v_proceeding_id,r.kind,r.title,r.detail,'unresolved',null,array(select jsonb_array_elements_text(r.source_segment_ids)::uuid) from jsonb_to_recordset(coalesce(payload->'resolution_items','[]'::jsonb)) as r(id uuid,kind text,title text,detail text,source_segment_ids jsonb);
  insert into public.proceeding_package_versions(id,case_id,proceeding_id,version,schema_version,package_sha256,package,publication_status,created_by_user_id)
  values(v_package_id,v_case_id,v_proceeding_id,1,'proceeding-package/1.0',payload->'package_version'->>'package_sha256',payload->'package_version'->'package','draft',v_actor);

  update public.evidence_intakes set processing_status='complete',committed_segments=v_committed where id=v_intake_id;
  update public.source_artifacts set completeness='complete',parser_status='complete' where id=v_artifact_id;
  update public.sources set completeness='complete' where id=v_source_id;
  update public.proceedings set status='complete',committed_segments=v_committed,completed_at=now() where id=v_proceeding_id;
  insert into public.audit_events(id,case_id,actor_user_id,action,subject_type,subject_id,details) values(gen_random_uuid(),v_case_id,v_actor,'testimony_compiler.completed','proceeding',v_proceeding_id::text,jsonb_build_object('detected',v_detected,'parsed',v_parsed,'committed',v_committed,'analyticalAssessmentsCreated',0));
  return jsonb_build_object('intake_id',v_intake_id,'source_id',v_source_id,'artifact_id',v_artifact_id,'proceeding_id',v_proceeding_id,'package_version_id',v_package_id,'duplicate',false,'segments',v_committed,'claims',(select count(*) from public.extraction_candidates where proceeding_id=v_proceeding_id and candidate_type='testimony_claim'),'acquisition_targets',0,'detected',v_detected,'parsed',v_parsed,'committed',v_committed);
end; $$;

revoke all on function public.commit_testimony_compiler_run(jsonb) from public,anon;
grant execute on function public.commit_testimony_compiler_run(jsonb) to authenticated;

grant all privileges on all tables in schema public to service_role;
