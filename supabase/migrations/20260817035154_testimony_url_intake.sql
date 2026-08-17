create type public.evidence_lane as enum ('testimony','documentary','direct_evidence');
create type public.evidence_intake_status as enum ('received','preserved','classified','processing','complete','failed','review_required');
create type public.source_family as enum ('journal_or_notebook','medical_record','witness_interview','court_record','trial_transcript','digital_forensics','surveillance','forensic_or_autopsy','search_warrant','news_report','video_or_audio','discovery_aid','other','unknown');
create type public.capture_method as enum ('url_capture','file_upload','manual_entry','import');
create type public.parser_status as enum ('pending','processing','complete','failed','review_required');
create type public.claim_provenance_type as enum ('trial_testimony','direct_observation','subject_statement','witness_statement','reported_statement','hearsay_report','primary_record','derived_record','investigator_characterization','investigator_inference','expert_opinion','procedural_record','media_report','warrant_boilerplate','unknown');
create type public.claim_epistemic_status as enum ('directly_supported','reported','ambiguous','conflicted','missing','unassessed');
create type public.attribution_role as enum ('speaker','reported_by','recorded_by','quoted_by','summarized_by','interpreted_by','authenticated_by','testified_by','transcribed_by');
create type public.support_relation_type as enum ('supports','corroborates','contradicts','conflicts_with','qualifies','supersedes','duplicates','derives_from','describes');
create type public.assessment_origin as enum ('human_review','reconciliation_rule','expert_review','imported_assessment');
create type public.verification_support_status as enum ('unassessed','supported','corroborated','conflicted','contradicted','superseded','insufficient');
create type public.acquisition_status as enum ('identified','located','captured','requested','restricted','unavailable','partial','complete');
create type public.acquisition_priority as enum ('low','medium','high','critical');

alter table public.cases
  add column workspace_key text not null default 'default',
  add constraint cases_owner_workspace_key_unique unique(owner_user_id,workspace_key);

do $$
begin
  if exists(select 1 from public.source_artifacts limit 1) or exists(select 1 from public.claims limit 1) then
    raise exception 'Testimony intake migration requires an explicit evidence-lane classification plan for existing artifacts and claims.';
  end if;
end;
$$;

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  title text not null,
  source_family public.source_family not null,
  evidence_lane public.evidence_lane not null,
  origin_entity_id uuid references public.entities(id),
  origin_date date,
  known_to_exist boolean not null default true,
  possessed_by_us boolean not null default false,
  completeness text,
  primary_source boolean,
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique(id,evidence_lane)
);

create table public.evidence_intakes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  source_id uuid references public.sources(id) on delete set null,
  submitted_url text not null,
  canonical_url text not null,
  page_title text,
  publisher text,
  published_date date,
  capture_method public.capture_method not null,
  content_type text,
  captured_at timestamptz not null,
  sha256 text not null,
  original_object_key text not null,
  processing_status public.evidence_intake_status not null,
  parser_name text,
  parser_version text,
  exact_duplicate_of uuid references public.evidence_intakes(id),
  review_required boolean not null default false,
  error_message text,
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check(exact_duplicate_of is null or exact_duplicate_of <> id)
);

create table public.source_lineages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  lineage_key text not null,
  canonical_artifact_id uuid,
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique(case_id,lineage_key)
);

alter table public.source_artifacts
  add column source_id uuid not null references public.sources(id) on delete cascade,
  add column evidence_intake_id uuid not null references public.evidence_intakes(id) on delete cascade,
  add column source_lineage_id uuid not null references public.source_lineages(id) on delete restrict,
  add column document_type text not null,
  add column original_filename text,
  add column source_url text not null,
  add column canonical_url text not null,
  add column publisher text,
  add column capture_method public.capture_method not null,
  add column retrieved_at timestamptz not null,
  add column is_original boolean not null default true,
  add column is_derivative boolean not null default false,
  add column derived_from_document_id uuid references public.source_artifacts(id),
  add column completeness text,
  add column parser_status public.parser_status not null default 'pending';

alter table public.source_lineages
  add constraint source_lineages_canonical_artifact_fk foreign key(canonical_artifact_id) references public.source_artifacts(id) on delete set null;

alter table public.source_segments
  add column case_id uuid not null references public.cases(id) on delete cascade,
  add column ordinal integer not null,
  add column speaker_entity_id uuid references public.entities(id),
  add column timestamp_start_ms bigint,
  add column timestamp_end_ms bigint,
  add column deep_link text,
  add column transcript_provider text,
  add constraint source_segments_artifact_ordinal_unique unique(artifact_id,ordinal),
  add constraint source_segments_timestamp_order check(timestamp_end_ms is null or timestamp_start_ms is null or timestamp_end_ms >= timestamp_start_ms);

create table public.propositions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  subject_entity_id uuid references public.entities(id),
  predicate text,
  object_json jsonb,
  time_start timestamptz,
  time_end timestamptz,
  location_entity_id uuid references public.entities(id),
  normalized_text text not null,
  review_required boolean not null default true,
  created_at timestamptz not null default now(),
  unique(case_id,normalized_text),
  check(time_end is null or time_start is null or time_end >= time_start)
);

alter table public.claims
  add column source_id uuid not null,
  add column proposition_id uuid not null references public.propositions(id) on delete restrict,
  add column evidence_lane public.evidence_lane not null,
  add column provenance_type public.claim_provenance_type not null,
  add column epistemic_status public.claim_epistemic_status not null default 'unassessed',
  add column extraction_confidence numeric(5,4) not null,
  add column source_quote text not null,
  add column review_required boolean not null default true,
  add column review_reasons jsonb not null default '[]'::jsonb,
  add constraint claims_source_lane_fk foreign key(source_id,evidence_lane) references public.sources(id,evidence_lane),
  add constraint claims_extraction_confidence_range check(extraction_confidence >= 0 and extraction_confidence <= 1);

create table public.claim_attributions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  claim_id uuid not null references public.claims(id) on delete cascade,
  entity_id uuid not null references public.entities(id),
  attribution_role public.attribution_role not null,
  sequence integer not null check(sequence > 0),
  source_document_id uuid references public.source_artifacts(id),
  notes text not null default '',
  unique(claim_id,sequence)
);

create table public.media_references (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  source_artifact_id uuid not null references public.source_artifacts(id) on delete cascade,
  provider text not null,
  external_id text,
  media_url text not null,
  embed_url text,
  possessed_by_us boolean not null default false,
  created_at timestamptz not null default now(),
  unique(source_artifact_id,media_url)
);

create table public.evidence_acquisition_records (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  title text not null,
  source_family public.source_family,
  known_to_exist boolean not null,
  used_at_trial boolean,
  admitted_as_exhibit boolean,
  exhibit_number text,
  publicly_released boolean,
  possessed_by_us boolean not null,
  completeness text,
  acquisition_status public.acquisition_status not null,
  acquisition_method text,
  source_url text,
  discovered_from_segment_id uuid references public.source_segments(id) on delete set null,
  priority public.acquisition_priority not null,
  notes text not null default '',
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check(not possessed_by_us or acquisition_status in ('captured','partial','complete'))
);

create table public.claim_support (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  supporting_claim_id uuid not null references public.claims(id) on delete cascade,
  target_proposition_id uuid not null references public.propositions(id) on delete cascade,
  evidence_lane public.evidence_lane not null,
  source_lineage_id uuid not null references public.source_lineages(id) on delete restrict,
  independence_group text not null,
  relation_type public.support_relation_type not null,
  assessment_origin public.assessment_origin not null,
  weight_override numeric,
  notes text not null default '',
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(supporting_claim_id,target_proposition_id,relation_type,source_lineage_id)
);

create table public.verification_assessments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  proposition_id uuid not null references public.propositions(id) on delete cascade,
  assessment_type text not null,
  support_status public.verification_support_status not null,
  basis text not null,
  assessed_by_user_id uuid not null references auth.users(id),
  assessed_at timestamptz not null default now(),
  method text not null,
  review_required boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.verification_assessment_claims (
  assessment_id uuid not null references public.verification_assessments(id) on delete cascade,
  claim_id uuid not null references public.claims(id) on delete cascade,
  relation_type text not null check(relation_type in ('supporting','conflicting')),
  primary key(assessment_id,claim_id)
);

create table public.event_claims (
  event_id uuid not null references public.events(id) on delete cascade,
  claim_id uuid not null references public.claims(id) on delete cascade,
  relation_type text not null check(relation_type in ('describes','supports','conflicts_with','qualifies')),
  primary key(event_id,claim_id)
);

create index evidence_intakes_case_status_idx on public.evidence_intakes(case_id,processing_status,created_at desc);
create index evidence_intakes_case_canonical_url_idx on public.evidence_intakes(case_id,canonical_url);
create index sources_case_lane_idx on public.sources(case_id,evidence_lane,created_at desc);
create index source_artifacts_source_idx on public.source_artifacts(source_id);
create index source_artifacts_intake_idx on public.source_artifacts(evidence_intake_id);
create index source_artifacts_lineage_idx on public.source_artifacts(source_lineage_id);
create index source_segments_case_artifact_idx on public.source_segments(case_id,artifact_id,ordinal);
create index source_segments_speaker_idx on public.source_segments(speaker_entity_id);
create index propositions_case_review_idx on public.propositions(case_id,review_required);
create index claims_proposition_idx on public.claims(proposition_id);
create index claims_source_lane_idx on public.claims(source_id,evidence_lane);
create index claim_attributions_case_claim_idx on public.claim_attributions(case_id,claim_id,sequence);
create index claim_attributions_entity_idx on public.claim_attributions(entity_id);
create index acquisition_case_status_idx on public.evidence_acquisition_records(case_id,acquisition_status,priority);
create index claim_support_case_proposition_idx on public.claim_support(case_id,target_proposition_id,relation_type);
create index claim_support_lineage_independence_idx on public.claim_support(source_lineage_id,independence_group);
create index verification_case_status_idx on public.verification_assessments(case_id,support_status,assessed_at desc);

alter table public.sources enable row level security;
alter table public.evidence_intakes enable row level security;
alter table public.source_lineages enable row level security;
alter table public.propositions enable row level security;
alter table public.claim_attributions enable row level security;
alter table public.media_references enable row level security;
alter table public.evidence_acquisition_records enable row level security;
alter table public.claim_support enable row level security;
alter table public.verification_assessments enable row level security;
alter table public.verification_assessment_claims enable row level security;
alter table public.event_claims enable row level security;

create policy sources_all on public.sources for all to authenticated using (private.can_access_case(case_id)) with check (private.can_access_case(case_id));
create policy evidence_intakes_all on public.evidence_intakes for all to authenticated using (private.can_access_case(case_id)) with check (private.can_access_case(case_id) and created_by_user_id=(select auth.uid()));
create policy source_lineages_all on public.source_lineages for all to authenticated using (private.can_access_case(case_id)) with check (private.can_access_case(case_id));
create policy propositions_all on public.propositions for all to authenticated using (private.can_access_case(case_id)) with check (private.can_access_case(case_id));
create policy claim_attributions_all on public.claim_attributions for all to authenticated using (private.can_access_case(case_id)) with check (private.can_access_case(case_id));
create policy media_references_all on public.media_references for all to authenticated using (private.can_access_case(case_id)) with check (private.can_access_case(case_id));
create policy acquisition_records_all on public.evidence_acquisition_records for all to authenticated using (private.can_access_case(case_id)) with check (private.can_access_case(case_id) and created_by_user_id=(select auth.uid()));
create policy claim_support_select on public.claim_support for select to authenticated using (private.can_access_case(case_id));
create policy verification_assessments_select on public.verification_assessments for select to authenticated using (private.can_access_case(case_id));
create policy verification_assessment_claims_select on public.verification_assessment_claims for select to authenticated using (exists(select 1 from public.verification_assessments a where a.id=assessment_id and private.can_access_case(a.case_id)));
create policy event_claims_all on public.event_claims for all to authenticated using (exists(select 1 from public.events e where e.id=event_id and private.can_access_case(e.case_id))) with check (exists(select 1 from public.events e where e.id=event_id and private.can_access_case(e.case_id)));

grant select,insert,update,delete on public.sources,public.evidence_intakes,public.source_lineages,public.propositions,public.claim_attributions,public.media_references,public.evidence_acquisition_records,public.event_claims to authenticated;
grant select,insert,update,delete on public.source_artifacts,public.source_segments,public.claims,public.entities,public.artifact_provenance,public.audit_events to authenticated;
grant select on public.claim_support,public.verification_assessments,public.verification_assessment_claims to authenticated;
revoke all on public.sources,public.evidence_intakes,public.source_lineages,public.propositions,public.claim_attributions,public.media_references,public.evidence_acquisition_records,public.claim_support,public.verification_assessments,public.verification_assessment_claims,public.event_claims from anon;

create function public.commit_testimony_url_intake(payload jsonb) returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_case_id uuid := (payload->>'case_id')::uuid;
  v_actor_id uuid := (select auth.uid());
  v_intake_id uuid := (payload->'intake'->>'id')::uuid;
  v_source_id uuid := (payload->'source'->>'id')::uuid;
  v_artifact_id uuid := (payload->'artifact'->>'id')::uuid;
  v_lineage_id uuid := (payload->'lineage'->>'id')::uuid;
  v_existing_artifact public.source_artifacts%rowtype;
  v_existing_intake_id uuid;
  v_segments_count integer;
  v_claims_count integer;
  v_acquisitions_count integer;
begin
  if v_actor_id is null or not private.can_access_case(v_case_id) then
    raise exception 'Not authorized for this case.' using errcode='42501';
  end if;
  if payload->'source'->>'evidence_lane' <> 'testimony' then
    raise exception 'This intake function accepts testimony only.';
  end if;
  if payload ?| array['claim_support','support','contradictions','verification_assessments','verification','reconciliation'] then
    raise exception 'Reconciliation and verification are forbidden during intake.';
  end if;
  if jsonb_array_length(coalesce(payload->'segments','[]'::jsonb)) > 5000 or jsonb_array_length(coalesce(payload->'claims','[]'::jsonb)) > 3000 then
    raise exception 'Parsed intake exceeds the permitted record budget.';
  end if;

  select * into v_existing_artifact
  from public.source_artifacts
  where case_id=v_case_id and sha256=payload->'artifact'->>'sha256'
  limit 1;

  if found then
    select evidence_intake_id into v_existing_intake_id from public.source_artifacts where id=v_existing_artifact.id;
    insert into public.evidence_intakes(id,case_id,source_id,submitted_url,canonical_url,page_title,publisher,published_date,capture_method,content_type,captured_at,sha256,original_object_key,processing_status,parser_name,parser_version,exact_duplicate_of,review_required,error_message,created_by_user_id)
    values(v_intake_id,v_case_id,v_existing_artifact.source_id,payload->'intake'->>'submitted_url',payload->'intake'->>'canonical_url',payload->'intake'->>'page_title',payload->'intake'->>'publisher',nullif(payload->'intake'->>'published_date','')::date,'url_capture',payload->'intake'->>'content_type',(payload->'intake'->>'captured_at')::timestamptz,payload->'artifact'->>'sha256',v_existing_artifact.object_key,'review_required',payload->'intake'->>'parser_name',payload->'intake'->>'parser_version',v_existing_intake_id,true,'Legacy URL intake cannot establish detected = parsed = committed; use commit_testimony_compiler_run.',v_actor_id);
    insert into public.audit_events(id,case_id,actor_user_id,action,subject_type,subject_id,details)
    values(gen_random_uuid(),v_case_id,v_actor_id,'testimony_intake.duplicate','evidence_intake',v_intake_id::text,jsonb_build_object('artifactId',v_existing_artifact.id,'exactDuplicateOf',v_existing_intake_id));
    select count(*) into v_segments_count from public.source_segments where artifact_id=v_existing_artifact.id;
    select count(*) into v_claims_count from public.claims where source_segment_id in (select id from public.source_segments where artifact_id=v_existing_artifact.id);
    select count(*) into v_acquisitions_count from public.evidence_acquisition_records where discovered_from_segment_id in (select id from public.source_segments where artifact_id=v_existing_artifact.id);
    return jsonb_build_object('intake_id',v_intake_id,'source_id',v_existing_artifact.source_id,'artifact_id',v_existing_artifact.id,'duplicate',true,'segments',v_segments_count,'claims',v_claims_count,'acquisition_targets',v_acquisitions_count);
  end if;

  insert into public.sources(id,case_id,title,source_family,evidence_lane,origin_date,known_to_exist,possessed_by_us,completeness,primary_source,notes)
  values(v_source_id,v_case_id,payload->'source'->>'title',(payload->'source'->>'source_family')::public.source_family,'testimony',nullif(payload->'source'->>'origin_date','')::date,true,false,payload->'source'->>'completeness',null,payload->'source'->>'notes');

  insert into public.evidence_intakes(id,case_id,source_id,submitted_url,canonical_url,page_title,publisher,published_date,capture_method,content_type,captured_at,sha256,original_object_key,processing_status,parser_name,parser_version,review_required,created_by_user_id)
  values(v_intake_id,v_case_id,v_source_id,payload->'intake'->>'submitted_url',payload->'intake'->>'canonical_url',payload->'intake'->>'page_title',payload->'intake'->>'publisher',nullif(payload->'intake'->>'published_date','')::date,'url_capture',payload->'intake'->>'content_type',(payload->'intake'->>'captured_at')::timestamptz,payload->'artifact'->>'sha256',payload->'artifact'->>'object_key','review_required',payload->'intake'->>'parser_name',payload->'intake'->>'parser_version',true,v_actor_id);

  insert into public.source_lineages(id,case_id,source_id,lineage_key,notes)
  values(v_lineage_id,v_case_id,v_source_id,payload->'lineage'->>'lineage_key',payload->'lineage'->>'notes');

  insert into public.source_artifacts(id,case_id,title,media_type,sha256,byte_length,object_key,acquired_from,is_authorized,source_id,evidence_intake_id,source_lineage_id,document_type,original_filename,source_url,canonical_url,publisher,capture_method,retrieved_at,is_original,is_derivative,completeness,parser_status)
  values(v_artifact_id,v_case_id,payload->'artifact'->>'title',payload->'artifact'->>'media_type',payload->'artifact'->>'sha256',(payload->'artifact'->>'byte_length')::integer,payload->'artifact'->>'object_key',payload->'intake'->>'submitted_url',true,v_source_id,v_intake_id,v_lineage_id,payload->'artifact'->>'document_type',null,payload->'artifact'->>'source_url',payload->'artifact'->>'canonical_url',payload->'artifact'->>'publisher','url_capture',(payload->'artifact'->>'retrieved_at')::timestamptz,true,false,'review_required','review_required');
  update public.source_lineages set canonical_artifact_id=v_artifact_id where id=v_lineage_id;

  insert into public.entities(id,case_id,canonical_name,kind,description)
  select gen_random_uuid(),v_case_id,n.name,
    case when n.name=coalesce(payload->'intake'->>'publisher','Rev') then 'organization'::public.entity_kind else 'person'::public.entity_kind end,
    case when n.name=coalesce(payload->'intake'->>'publisher','Rev') then 'Transcript publisher.' else 'Speaker identified in captured testimony.' end
  from (
    select coalesce(payload->'intake'->>'publisher','Rev') as name
    union
    select distinct s.speaker from jsonb_to_recordset(coalesce(payload->'segments','[]'::jsonb)) as s(speaker text) where nullif(btrim(s.speaker),'') is not null
    union
    select distinct a.entity_label from jsonb_to_recordset(coalesce(payload->'attributions','[]'::jsonb)) as a(entity_label text) where nullif(btrim(a.entity_label),'') is not null
  ) n
  on conflict(case_id,canonical_name) do nothing;

  insert into public.artifact_provenance(id,artifact_id,role,entity_id,note)
  select gen_random_uuid(),v_artifact_id,'publisher',e.id,'Publisher of the captured transcript representation.'
  from public.entities e where e.case_id=v_case_id and e.canonical_name=coalesce(payload->'intake'->>'publisher','Rev');

  insert into public.source_segments(id,artifact_id,locator_type,locator,exact_text,case_id,ordinal,speaker_entity_id,timestamp_start_ms,timestamp_end_ms,deep_link,transcript_provider)
  select s.id,v_artifact_id,'timestamp',s.locator,s.exact_text,v_case_id,s.ordinal,e.id,s.timestamp_start_ms,s.timestamp_end_ms,s.deep_link,coalesce(payload->'intake'->>'publisher','Rev')
  from jsonb_to_recordset(coalesce(payload->'segments','[]'::jsonb)) as s(id uuid,ordinal integer,speaker text,timestamp_start_ms bigint,timestamp_end_ms bigint,deep_link text,exact_text text,locator jsonb)
  join public.entities e on e.case_id=v_case_id and e.canonical_name=s.speaker;

  insert into public.propositions(id,case_id,normalized_text,review_required)
  select distinct on (c.normalized_text) c.proposition_id,v_case_id,c.normalized_text,true
  from jsonb_to_recordset(coalesce(payload->'claims','[]'::jsonb)) as c(proposition_id uuid,normalized_text text)
  order by c.normalized_text,c.proposition_id
  on conflict(case_id,normalized_text) do nothing;

  insert into public.claims(id,case_id,source_segment_id,claimant,assertion,claimed_event_time,statement_time,status,source_id,proposition_id,evidence_lane,provenance_type,epistemic_status,extraction_confidence,source_quote,review_required,review_reasons)
  select c.id,v_case_id,c.segment_id,c.speaker,c.assertion,null,null,'candidate',v_source_id,p.id,'testimony','trial_testimony','unassessed',c.extraction_confidence,c.source_quote,true,c.review_reasons
  from jsonb_to_recordset(coalesce(payload->'claims','[]'::jsonb)) as c(id uuid,segment_id uuid,speaker text,assertion text,normalized_text text,extraction_confidence numeric,source_quote text,review_reasons jsonb)
  join public.propositions p on p.case_id=v_case_id and p.normalized_text=c.normalized_text;

  insert into public.claim_attributions(id,case_id,claim_id,entity_id,attribution_role,sequence,source_document_id,notes)
  select a.id,v_case_id,a.claim_id,e.id,a.attribution_role::public.attribution_role,a.sequence,v_artifact_id,coalesce(a.notes,'')
  from jsonb_to_recordset(coalesce(payload->'attributions','[]'::jsonb)) as a(id uuid,claim_id uuid,entity_label text,attribution_role text,sequence integer,notes text)
  join public.entities e on e.case_id=v_case_id and e.canonical_name=a.entity_label;

  insert into public.media_references(id,case_id,source_id,source_artifact_id,provider,external_id,media_url,embed_url,possessed_by_us)
  select m.id,v_case_id,v_source_id,v_artifact_id,m.provider,m.external_id,m.media_url,m.embed_url,false
  from jsonb_to_recordset(coalesce(payload->'media','[]'::jsonb)) as m(id uuid,provider text,external_id text,media_url text,embed_url text);

  insert into public.evidence_acquisition_records(id,case_id,title,source_family,known_to_exist,used_at_trial,admitted_as_exhibit,exhibit_number,publicly_released,possessed_by_us,completeness,acquisition_status,source_url,discovered_from_segment_id,priority,notes,created_by_user_id)
  select a.id,v_case_id,a.title,a.source_family::public.source_family,true,a.used_at_trial,a.admitted_as_exhibit,a.exhibit_number,null,false,null,'identified',a.source_url,a.discovered_from_segment_id,a.priority::public.acquisition_priority,a.notes,v_actor_id
  from jsonb_to_recordset(coalesce(payload->'acquisitions','[]'::jsonb)) as a(id uuid,title text,source_family text,used_at_trial boolean,admitted_as_exhibit boolean,exhibit_number text,source_url text,discovered_from_segment_id uuid,priority text,notes text);

  insert into public.audit_events(id,case_id,actor_user_id,action,subject_type,subject_id,details)
  values(gen_random_uuid(),v_case_id,v_actor_id,'testimony_intake.legacy_review_required','evidence_intake',v_intake_id::text,jsonb_build_object('sourceId',v_source_id,'artifactId',v_artifact_id,'evidenceLane','testimony','segments',jsonb_array_length(coalesce(payload->'segments','[]'::jsonb)),'claims',jsonb_array_length(coalesce(payload->'claims','[]'::jsonb)),'reconciliationRows',0,'verificationRows',0));

  v_segments_count := jsonb_array_length(coalesce(payload->'segments','[]'::jsonb));
  v_claims_count := jsonb_array_length(coalesce(payload->'claims','[]'::jsonb));
  v_acquisitions_count := jsonb_array_length(coalesce(payload->'acquisitions','[]'::jsonb));
  return jsonb_build_object('intake_id',v_intake_id,'source_id',v_source_id,'artifact_id',v_artifact_id,'duplicate',false,'segments',v_segments_count,'claims',v_claims_count,'acquisition_targets',v_acquisitions_count);
end;
$$;

revoke all on function public.commit_testimony_url_intake(jsonb) from public,anon;
grant execute on function public.commit_testimony_url_intake(jsonb) to authenticated;
grant all privileges on all tables in schema public to service_role;
grant usage,select on all sequences in schema public to service_role;
