create table public.court_packet_parse_runs (
  id uuid primary key,
  case_id uuid not null references public.cases(id) on delete cascade,
  source_artifact_id uuid not null references public.source_artifacts(id) on delete cascade,
  schema_version text not null check(schema_version='icarus.court_packet.parse.v1'),
  provider text not null check(provider='llamaparse'),
  provider_file_id text,
  provider_job_id text,
  sdk_name text not null check(sdk_name='@llamaindex/llama-cloud'),
  sdk_version text not null,
  parse_tier text not null check(parse_tier in ('fast','cost_effective','agentic','agentic_plus')),
  parse_version text not null,
  configuration_sha256 text not null check(configuration_sha256 ~ '^[a-f0-9]{64}$'),
  page_count integer not null check(page_count > 0),
  warnings jsonb not null default '[]'::jsonb check(jsonb_typeof(warnings)='array'),
  review_status text not null default 'review_required' check(review_status='review_required'),
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(source_artifact_id,configuration_sha256)
);

create table public.court_packet_pages (
  id uuid primary key,
  case_id uuid not null references public.cases(id) on delete cascade,
  parse_run_id uuid not null references public.court_packet_parse_runs(id) on delete cascade,
  source_segment_id uuid not null references public.source_segments(id) on delete cascade,
  page_number integer not null check(page_number > 0),
  markdown text not null,
  items jsonb not null default '[]'::jsonb check(jsonb_typeof(items)='array'),
  parser_page_id text,
  created_at timestamptz not null default now(),
  unique(parse_run_id,page_number),
  unique(parse_run_id,source_segment_id)
);

create table public.court_packet_boundary_candidates (
  id uuid primary key,
  case_id uuid not null references public.cases(id) on delete cascade,
  parse_run_id uuid not null references public.court_packet_parse_runs(id) on delete cascade,
  candidate_code text not null,
  detected_document_type text not null check(detected_document_type in ('search_warrant','warrant_application','affidavit','warrant_return','attachment','property_inventory','unclassified')),
  detected_start_page integer not null check(detected_start_page > 0),
  detected_end_page integer not null check(detected_end_page >= detected_start_page),
  source_segment_ids uuid[] not null check(cardinality(source_segment_ids) > 0),
  boundary_evidence jsonb not null default '[]'::jsonb check(jsonb_typeof(boundary_evidence)='array'),
  content_fingerprint text not null check(content_fingerprint ~ '^[a-f0-9]{64}$'),
  possible_duplicate_of uuid[] not null default '{}'::uuid[],
  review_status text not null default 'review_required' check(review_status in ('review_required','accepted','amended','rejected','deferred')),
  current_review_version integer not null default 0 check(current_review_version >= 0),
  created_at timestamptz not null default now(),
  unique(case_id,candidate_code)
);

create table public.court_packet_documents (
  id uuid primary key,
  case_id uuid not null references public.cases(id) on delete cascade,
  source_artifact_id uuid not null references public.source_artifacts(id) on delete restrict,
  candidate_id uuid not null unique references public.court_packet_boundary_candidates(id) on delete restrict,
  document_type text not null check(document_type in ('search_warrant','warrant_application','affidavit','warrant_return','attachment','property_inventory','unclassified')),
  start_page integer not null check(start_page > 0),
  end_page integer not null check(end_page >= start_page),
  source_segment_ids uuid[] not null check(cardinality(source_segment_ids) > 0),
  current_version integer not null check(current_version > 0),
  accepted_by_user_id uuid not null references auth.users(id),
  accepted_at timestamptz not null default now()
);

create table public.court_packet_boundary_review_versions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  candidate_id uuid not null references public.court_packet_boundary_candidates(id) on delete restrict,
  document_id uuid references public.court_packet_documents(id) on delete restrict,
  version integer not null check(version > 0),
  action text not null check(action in ('accept','amend','reject','defer')),
  previous_status text not null,
  resulting_status text not null,
  before_state jsonb not null,
  patch jsonb not null default '{}'::jsonb check(jsonb_typeof(patch)='object'),
  after_state jsonb not null,
  note text not null default '',
  source_segment_ids uuid[] not null check(cardinality(source_segment_ids) > 0),
  reviewed_by_user_id uuid not null references auth.users(id),
  reviewed_at timestamptz not null default now(),
  unique(candidate_id,version)
);

create index court_packet_parse_runs_case_created_idx on public.court_packet_parse_runs(case_id,created_at desc);
create index court_packet_pages_run_page_idx on public.court_packet_pages(parse_run_id,page_number);
create index court_packet_candidates_case_review_idx on public.court_packet_boundary_candidates(case_id,review_status,detected_start_page);
create index court_packet_documents_case_artifact_idx on public.court_packet_documents(case_id,source_artifact_id,start_page);
create index court_packet_reviews_candidate_version_idx on public.court_packet_boundary_review_versions(candidate_id,version desc);

alter table public.court_packet_parse_runs enable row level security;
alter table public.court_packet_pages enable row level security;
alter table public.court_packet_boundary_candidates enable row level security;
alter table public.court_packet_documents enable row level security;
alter table public.court_packet_boundary_review_versions enable row level security;

create policy court_packet_parse_runs_select on public.court_packet_parse_runs for select to authenticated using(private.can_access_case(case_id));
create policy court_packet_pages_select on public.court_packet_pages for select to authenticated using(private.can_access_case(case_id));
create policy court_packet_candidates_select on public.court_packet_boundary_candidates for select to authenticated using(private.can_access_case(case_id));
create policy court_packet_documents_select on public.court_packet_documents for select to authenticated using(private.can_access_case(case_id));
create policy court_packet_reviews_select on public.court_packet_boundary_review_versions for select to authenticated using(private.can_access_case(case_id));

revoke all on public.court_packet_parse_runs,public.court_packet_pages,public.court_packet_boundary_candidates,public.court_packet_documents,public.court_packet_boundary_review_versions from public,anon,authenticated;
grant select on public.court_packet_parse_runs,public.court_packet_pages,public.court_packet_boundary_candidates,public.court_packet_documents,public.court_packet_boundary_review_versions to authenticated;
grant all privileges on public.court_packet_parse_runs,public.court_packet_pages,public.court_packet_boundary_candidates,public.court_packet_documents,public.court_packet_boundary_review_versions to service_role;

create function public.commit_court_packet_parse(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_case_id uuid := nullif(payload->>'case_id','')::uuid;
  v_actor uuid := (select auth.uid());
  v_source_id uuid := nullif(payload->'source'->>'source_id','')::uuid;
  v_intake_id uuid := nullif(payload->'source'->>'intake_id','')::uuid;
  v_lineage_id uuid := nullif(payload->'source'->>'lineage_id','')::uuid;
  v_artifact_id uuid := nullif(payload->'source'->>'artifact_id','')::uuid;
  v_run_id uuid := nullif(payload->'parser'->>'run_id','')::uuid;
  v_sha256 text := payload->'source'->>'sha256';
  v_page_count integer := jsonb_array_length(coalesce(payload->'pages','[]'::jsonb));
  v_candidate_count integer := jsonb_array_length(coalesce(payload->'segments','[]'::jsonb));
  v_existing public.court_packet_parse_runs%rowtype;
  v_candidate jsonb;
  v_candidate_pages integer[];
  v_candidate_sources uuid[];
begin
  if v_actor is null or v_case_id is null or not private.can_access_case(v_case_id) then
    raise exception 'COURT_PACKET_NOT_AUTHORIZED' using errcode='42501';
  end if;
  if payload ?| array['claims','events','assertions','claim_support','support','contradictions','verification_assessments','reconciliation','truth','hypotheses','canonical_documents'] then
    raise exception 'COURT_PACKET_ANALYTICAL_WRITES_FORBIDDEN';
  end if;
  if payload->>'schema_version'<>'icarus.court_packet.parse.v1'
    or payload->'source'->>'source_family'<>'search_warrant'
    or payload->'source'->>'evidence_lane'<>'documentary'
    or payload->'parser'->>'provider'<>'llamaparse'
    or payload->'parser'->>'sdk_name'<>'@llamaindex/llama-cloud'
    or payload->'parser'->>'review_status'<>'review_required' then
    raise exception 'COURT_PACKET_CONTRACT_INVALID';
  end if;
  if v_sha256 is null or v_sha256 !~ '^[a-f0-9]{64}$'
    or payload->'parser'->>'configuration_sha256' !~ '^[a-f0-9]{64}$'
    or v_page_count <= 0
    or (payload->'source'->>'page_count')::integer <> v_page_count then
    raise exception 'COURT_PACKET_COMPLETENESS_INVALID';
  end if;
  if exists(
    select 1 from jsonb_to_recordset(payload->'pages') as p(page_number integer,text text,markdown text,items jsonb,locator jsonb)
    where p.page_number is null or p.page_number <= 0 or p.text is null or p.markdown is null
      or p.items is null or jsonb_typeof(p.items)<>'array'
      or p.locator->>'type'<>'page' or (p.locator->>'page')::integer<>p.page_number
  ) or (select count(distinct p.page_number) from jsonb_to_recordset(payload->'pages') as p(page_number integer))<>v_page_count
    or (select min(p.page_number) from jsonb_to_recordset(payload->'pages') as p(page_number integer))<>1
    or (select max(p.page_number) from jsonb_to_recordset(payload->'pages') as p(page_number integer))<>v_page_count then
    raise exception 'COURT_PACKET_PAGE_COVERAGE_INVALID';
  end if;

  select run.* into v_existing
  from public.court_packet_parse_runs run
  join public.source_artifacts artifact on artifact.id=run.source_artifact_id
  where run.case_id=v_case_id and artifact.sha256=v_sha256 and run.configuration_sha256=payload->'parser'->>'configuration_sha256'
  limit 1;
  if found then
    if v_existing.page_count<>v_page_count or (select count(*) from public.court_packet_boundary_candidates where parse_run_id=v_existing.id)<>v_candidate_count then
      raise exception 'COURT_PACKET_DUPLICATE_CONFLICT';
    end if;
    return jsonb_build_object('run_id',v_existing.id,'artifact_id',v_existing.source_artifact_id,'duplicate',true,'pages',v_existing.page_count,'candidates',v_candidate_count,'review_status','review_required','analytical_assessments_created',0);
  end if;
  if exists(select 1 from public.source_artifacts where case_id=v_case_id and sha256=v_sha256) then
    raise exception 'COURT_PACKET_ARTIFACT_REPARSE_REQUIRES_VERSIONED_WORKFLOW';
  end if;

  insert into public.sources(id,case_id,title,source_family,evidence_lane,known_to_exist,possessed_by_us,completeness,primary_source,notes)
  values(v_source_id,v_case_id,payload->'source'->>'name','search_warrant','documentary',true,true,'complete',true,'Immutable court packet preserved before document-intelligence review.');
  insert into public.evidence_intakes(id,case_id,source_id,submitted_url,canonical_url,page_title,publisher,capture_method,content_type,captured_at,sha256,original_object_key,processing_status,parser_name,parser_version,review_required,created_by_user_id,detected_segments,parsed_segments,committed_segments,parser_warnings)
  values(v_intake_id,v_case_id,v_source_id,null,null,payload->'source'->>'name',null,'file_upload',payload->'source'->>'media_type',(payload->'source'->>'captured_at')::timestamptz,v_sha256,payload->'source'->>'object_key','review_required','llamaparse',payload->'parser'->>'parse_version',true,v_actor,v_page_count,v_page_count,v_page_count,coalesce(payload->'warnings','[]'::jsonb));
  insert into public.source_lineages(id,case_id,source_id,lineage_key,notes)
  values(v_lineage_id,v_case_id,v_source_id,'court-packet:sha256:'||v_sha256,'Byte-identical court packet lineage; parser retries must resolve through the artifact hash.');
  insert into public.source_artifacts(id,case_id,title,media_type,sha256,byte_length,object_key,acquired_from,is_authorized,source_id,evidence_intake_id,source_lineage_id,document_type,original_filename,source_url,canonical_url,publisher,capture_method,retrieved_at,is_original,is_derivative,completeness,parser_status)
  values(v_artifact_id,v_case_id,payload->'source'->>'name',payload->'source'->>'media_type',v_sha256,(payload->'source'->>'byte_length')::integer,payload->'source'->>'object_key',null,true,v_source_id,v_intake_id,v_lineage_id,'court_packet',payload->'source'->>'name',null,null,null,'file_upload',(payload->'source'->>'captured_at')::timestamptz,true,false,'complete','review_required');
  update public.source_lineages set canonical_artifact_id=v_artifact_id where id=v_lineage_id;

  insert into public.source_segments(id,artifact_id,locator_type,locator,exact_text,case_id,ordinal,deep_link,transcript_provider)
  select p.segment_id,v_artifact_id,'page',p.locator,p.text,v_case_id,p.page_number-1,p.locator->>'value','llamaparse'
  from jsonb_to_recordset(payload->'pages') as p(segment_id uuid,page_number integer,text text,locator jsonb)
  order by p.page_number;
  insert into public.court_packet_parse_runs(id,case_id,source_artifact_id,schema_version,provider,provider_file_id,provider_job_id,sdk_name,sdk_version,parse_tier,parse_version,configuration_sha256,page_count,warnings,review_status,created_by_user_id)
  values(v_run_id,v_case_id,v_artifact_id,'icarus.court_packet.parse.v1','llamaparse',nullif(payload->'parser'->>'file_id',''),nullif(payload->'parser'->>'job_id',''),'@llamaindex/llama-cloud',payload->'parser'->>'sdk_version',payload->'parser'->>'tier',payload->'parser'->>'parse_version',payload->'parser'->>'configuration_sha256',v_page_count,coalesce(payload->'warnings','[]'::jsonb),'review_required',v_actor);
  insert into public.court_packet_pages(id,case_id,parse_run_id,source_segment_id,page_number,markdown,items,parser_page_id)
  select p.id,v_case_id,v_run_id,p.segment_id,p.page_number,p.markdown,p.items,nullif(p.parser_page_id,'')
  from jsonb_to_recordset(payload->'pages') as p(id uuid,segment_id uuid,page_number integer,markdown text,items jsonb,parser_page_id text)
  order by p.page_number;

  for v_candidate in select value from jsonb_array_elements(coalesce(payload->'segments','[]'::jsonb)) loop
    v_candidate_pages := array(select jsonb_array_elements_text(v_candidate->'page_numbers')::integer order by 1);
    if cardinality(v_candidate_pages)=0
      or (select min(value) from unnest(v_candidate_pages) value)<>(v_candidate->>'start_page')::integer
      or (select max(value) from unnest(v_candidate_pages) value)<>(v_candidate->>'end_page')::integer
      or cardinality(v_candidate_pages)<>((v_candidate->>'end_page')::integer-(v_candidate->>'start_page')::integer+1) then
      raise exception 'COURT_PACKET_CANDIDATE_RANGE_INVALID';
    end if;
    select array_agg(page.source_segment_id order by page.page_number) into v_candidate_sources
    from public.court_packet_pages page where page.parse_run_id=v_run_id and page.page_number=any(v_candidate_pages);
    if cardinality(v_candidate_sources)<>cardinality(v_candidate_pages) then raise exception 'COURT_PACKET_CANDIDATE_SOURCE_INVALID'; end if;
    insert into public.court_packet_boundary_candidates(id,case_id,parse_run_id,candidate_code,detected_document_type,detected_start_page,detected_end_page,source_segment_ids,boundary_evidence,content_fingerprint,possible_duplicate_of,review_status)
    values((v_candidate->>'id')::uuid,v_case_id,v_run_id,v_candidate->>'candidate_id',v_candidate->>'document_type',(v_candidate->>'start_page')::integer,(v_candidate->>'end_page')::integer,v_candidate_sources,coalesce(v_candidate->'boundary_evidence','[]'::jsonb),v_candidate->>'fingerprint',array(select jsonb_array_elements_text(coalesce(v_candidate->'possible_duplicate_of','[]'::jsonb))::uuid),'review_required');
  end loop;

  insert into public.audit_events(id,case_id,actor_user_id,action,subject_type,subject_id,details)
  values(gen_random_uuid(),v_case_id,v_actor,'court_packet.parse_committed','court_packet_parse_run',v_run_id::text,jsonb_build_object('sha256',v_sha256,'pages',v_page_count,'candidates',v_candidate_count,'reviewStatus','review_required','analyticalAssessmentsCreated',0));
  return jsonb_build_object('run_id',v_run_id,'artifact_id',v_artifact_id,'duplicate',false,'pages',v_page_count,'candidates',v_candidate_count,'review_status','review_required','analytical_assessments_created',0);
end; $$;

revoke all on function public.commit_court_packet_parse(jsonb) from public,anon,authenticated;
grant execute on function public.commit_court_packet_parse(jsonb) to authenticated;

create function public.review_court_packet_boundary(p_candidate_id uuid,p_action text,p_patch jsonb default '{}'::jsonb,p_note text default '',p_expected_version integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid := (select auth.uid());
  v_candidate public.court_packet_boundary_candidates%rowtype;
  v_run public.court_packet_parse_runs%rowtype;
  v_version integer;
  v_document_type text;
  v_start_page integer;
  v_end_page integer;
  v_source_ids uuid[];
  v_resulting_status text;
  v_before jsonb;
  v_after jsonb;
begin
  select * into v_candidate from public.court_packet_boundary_candidates where id=p_candidate_id for update;
  if not found or v_actor is null or not private.can_review_case(v_candidate.case_id) then raise exception 'COURT_PACKET_REVIEW_NOT_AUTHORIZED' using errcode='42501'; end if;
  if p_expected_version<>v_candidate.current_review_version then raise exception 'COURT_PACKET_REVIEW_STALE_VERSION'; end if;
  if p_action not in ('accept','amend','reject','defer') then raise exception 'COURT_PACKET_REVIEW_ACTION_INVALID'; end if;
  if jsonb_typeof(coalesce(p_patch,'{}'::jsonb))<>'object' or exists(select 1 from jsonb_object_keys(coalesce(p_patch,'{}'::jsonb)) key where key<>all(array['document_type','start_page','end_page'])) then raise exception 'COURT_PACKET_REVIEW_PATCH_INVALID'; end if;
  if p_action<>'amend' and coalesce(p_patch,'{}'::jsonb)<>'{}'::jsonb then raise exception 'COURT_PACKET_REVIEW_PATCH_REQUIRES_AMEND'; end if;
  if p_action in ('reject','defer','amend') and length(trim(coalesce(p_note,'')))<5 then raise exception 'COURT_PACKET_REVIEW_NOTE_REQUIRED'; end if;
  if v_candidate.review_status in ('accepted','amended') and p_action in ('reject','defer') then raise exception 'COURT_PACKET_ACCEPTED_DOCUMENT_REQUIRES_VERSIONED_AMENDMENT'; end if;

  select * into v_run from public.court_packet_parse_runs where id=v_candidate.parse_run_id;
  v_document_type := coalesce(nullif(p_patch->>'document_type',''),v_candidate.detected_document_type);
  v_start_page := coalesce(nullif(p_patch->>'start_page','')::integer,v_candidate.detected_start_page);
  v_end_page := coalesce(nullif(p_patch->>'end_page','')::integer,v_candidate.detected_end_page);
  if v_document_type not in ('search_warrant','warrant_application','affidavit','warrant_return','attachment','property_inventory','unclassified') or v_start_page<1 or v_end_page<v_start_page or v_end_page>v_run.page_count then raise exception 'COURT_PACKET_REVIEW_RANGE_INVALID'; end if;
  select array_agg(source_segment_id order by page_number) into v_source_ids from public.court_packet_pages where parse_run_id=v_candidate.parse_run_id and page_number between v_start_page and v_end_page;
  if cardinality(v_source_ids)<>(v_end_page-v_start_page+1) then raise exception 'COURT_PACKET_REVIEW_SOURCE_INVALID'; end if;

  v_version := v_candidate.current_review_version+1;
  v_resulting_status := case p_action when 'accept' then 'accepted' when 'amend' then 'amended' when 'reject' then 'rejected' else 'deferred' end;
  v_before := jsonb_build_object('document_type',v_candidate.detected_document_type,'start_page',v_candidate.detected_start_page,'end_page',v_candidate.detected_end_page,'review_status',v_candidate.review_status,'source_segment_ids',to_jsonb(v_candidate.source_segment_ids));
  v_after := jsonb_build_object('document_type',v_document_type,'start_page',v_start_page,'end_page',v_end_page,'review_status',v_resulting_status,'source_segment_ids',to_jsonb(v_source_ids));
  update public.court_packet_boundary_candidates set review_status=v_resulting_status,current_review_version=v_version where id=p_candidate_id;

  if p_action in ('accept','amend') then
    insert into public.court_packet_documents(id,case_id,source_artifact_id,candidate_id,document_type,start_page,end_page,source_segment_ids,current_version,accepted_by_user_id,accepted_at)
    values(p_candidate_id,v_candidate.case_id,v_run.source_artifact_id,p_candidate_id,v_document_type,v_start_page,v_end_page,v_source_ids,v_version,v_actor,now())
    on conflict(candidate_id) do update set document_type=excluded.document_type,start_page=excluded.start_page,end_page=excluded.end_page,source_segment_ids=excluded.source_segment_ids,current_version=excluded.current_version,accepted_by_user_id=excluded.accepted_by_user_id,accepted_at=excluded.accepted_at;
  end if;
  insert into public.court_packet_boundary_review_versions(case_id,candidate_id,document_id,version,action,previous_status,resulting_status,before_state,patch,after_state,note,source_segment_ids,reviewed_by_user_id)
  values(v_candidate.case_id,p_candidate_id,case when p_action in ('accept','amend') then p_candidate_id else null end,v_version,p_action,v_candidate.review_status,v_resulting_status,v_before,coalesce(p_patch,'{}'::jsonb),v_after,coalesce(p_note,''),v_source_ids,v_actor);
  insert into public.audit_events(id,case_id,actor_user_id,action,subject_type,subject_id,details)
  values(gen_random_uuid(),v_candidate.case_id,v_actor,'court_packet.boundary_'||p_action,'court_packet_boundary_candidate',p_candidate_id::text,jsonb_build_object('version',v_version,'previousStatus',v_candidate.review_status,'resultingStatus',v_resulting_status,'sourceSegmentIds',to_jsonb(v_source_ids)));
  return jsonb_build_object('candidate_id',p_candidate_id,'document_id',case when p_action in ('accept','amend') then p_candidate_id else null end,'version',v_version,'resulting_status',v_resulting_status,'source_segment_ids',to_jsonb(v_source_ids));
end; $$;

revoke all on function public.review_court_packet_boundary(uuid,text,jsonb,text,integer) from public,anon,authenticated;
grant execute on function public.review_court_packet_boundary(uuid,text,jsonb,text,integer) to authenticated;

comment on function public.commit_court_packet_parse(jsonb) is 'Atomically preserves one immutable court packet, every parsed page, and review-only document-boundary candidates. It creates no claims, events, truth assessments, or corroboration decisions.';
comment on table public.court_packet_documents is 'Human-accepted court-packet document boundaries. Parser candidates never enter this table without governed owner/reviewer action.';
