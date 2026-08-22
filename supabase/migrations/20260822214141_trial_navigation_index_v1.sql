create table public.trial_index_days (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  day_number integer not null check(day_number > 0),
  court_date date,
  proceeding_id uuid references public.proceedings(id) on delete set null,
  session_status text not null check(session_status in ('planned','in_progress','completed','adjourned','no_court','cancelled')),
  trial_phase text not null check(trial_phase in ('pretrial','prosecution','defense','rebuttal','closings','deliberations','verdict','other','unknown')),
  headline text not null check(length(btrim(headline)) between 3 and 240),
  summary text not null default '' check(length(summary) <= 5000),
  basis text not null check(basis in ('canonical_record','editorial_reference','mixed','planned')),
  witnesses jsonb not null default '[]'::jsonb check(jsonb_typeof(witnesses)='array'),
  topics jsonb not null default '[]'::jsonb check(jsonb_typeof(topics)='array'),
  navigation_references jsonb not null default '[]'::jsonb check(jsonb_typeof(navigation_references)='array'),
  navigation_only boolean not null default true check(navigation_only),
  current_version integer not null default 0 check(current_version >= 0),
  created_by_user_id uuid not null references auth.users(id),
  updated_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(case_id,day_number),
  unique(proceeding_id)
);

create index trial_index_days_case_date_idx on public.trial_index_days(case_id,court_date,day_number);
create index trial_index_days_case_phase_idx on public.trial_index_days(case_id,trial_phase,day_number);

create table public.trial_index_day_versions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  trial_index_day_id uuid not null references public.trial_index_days(id) on delete cascade,
  version integer not null check(version > 0),
  snapshot jsonb not null check(jsonb_typeof(snapshot)='object'),
  change_note text not null default '' check(length(change_note) <= 1000),
  changed_by_user_id uuid not null references auth.users(id),
  changed_at timestamptz not null default now(),
  unique(trial_index_day_id,version)
);

create index trial_index_day_versions_case_day_idx on public.trial_index_day_versions(case_id,trial_index_day_id,version desc);

alter table public.trial_index_days enable row level security;
alter table public.trial_index_day_versions enable row level security;

create policy trial_index_days_select on public.trial_index_days for select to authenticated
  using(private.can_access_case(case_id));
create policy trial_index_day_versions_select on public.trial_index_day_versions for select to authenticated
  using(private.can_access_case(case_id));

revoke all on public.trial_index_days,public.trial_index_day_versions from public,anon,authenticated;
grant select on public.trial_index_days,public.trial_index_day_versions to authenticated;
grant all privileges on public.trial_index_days,public.trial_index_day_versions to service_role;

create or replace view public.trial_index_projection
with (security_invoker=true) as
select
  day.id,
  day.case_id,
  day.day_number,
  day.court_date,
  day.proceeding_id,
  proceeding.title as proceeding_title,
  proceeding.proceeding_date,
  proceeding.status as proceeding_status,
  day.session_status,
  day.trial_phase,
  day.headline,
  day.summary,
  day.basis,
  day.witnesses,
  day.topics,
  day.navigation_references,
  day.navigation_only,
  day.current_version,
  day.updated_at,
  coalesce(array(select witness->>'name' from jsonb_array_elements(day.witnesses) witness),'{}'::text[]) as witness_names,
  coalesce(array(select topic->>'label' from jsonb_array_elements(day.topics) topic),'{}'::text[]) as topic_labels
from public.trial_index_days day
left join public.proceedings proceeding on proceeding.id=day.proceeding_id and proceeding.case_id=day.case_id;

revoke all on public.trial_index_projection from public,anon,authenticated;
grant select on public.trial_index_projection to authenticated;

create function private.upsert_trial_index_day_core(p_case_id uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid := (select auth.uid());
  v_day_id uuid;
  v_day_number integer;
  v_court_date date;
  v_proceeding_id uuid;
  v_status text;
  v_phase text;
  v_headline text;
  v_summary text;
  v_basis text;
  v_witnesses jsonb := coalesce(p_payload->'witnesses','[]'::jsonb);
  v_topics jsonb := coalesce(p_payload->'topics','[]'::jsonb);
  v_references jsonb := coalesce(p_payload->'references','[]'::jsonb);
  v_change_note text := btrim(coalesce(p_payload->>'change_note',''));
  v_snapshot jsonb;
  v_previous jsonb;
  v_version integer;
  v_item jsonb;
  v_link_id uuid;
  v_created boolean := false;
begin
  if v_actor is null or not private.can_review_case(p_case_id) then
    raise exception 'TRIAL_INDEX_NOT_AUTHORIZED' using errcode='42501';
  end if;
  if jsonb_typeof(p_payload)<>'object' then raise exception 'TRIAL_INDEX_PAYLOAD_INVALID'; end if;
  if exists(
    select 1 from jsonb_object_keys(p_payload) key
    where key<>all(array['day_number','court_date','proceeding_id','session_status','trial_phase','headline','summary','basis','witnesses','topics','references','change_note'])
  ) then raise exception 'TRIAL_INDEX_FIELD_NOT_ALLOWED'; end if;

  begin v_day_number := (p_payload->>'day_number')::integer;
  exception when others then raise exception 'TRIAL_INDEX_DAY_NUMBER_INVALID'; end;
  if v_day_number is null or v_day_number <= 0 then raise exception 'TRIAL_INDEX_DAY_NUMBER_INVALID'; end if;
  begin v_court_date := nullif(p_payload->>'court_date','')::date;
  exception when others then raise exception 'TRIAL_INDEX_DATE_INVALID'; end;
  begin v_proceeding_id := nullif(p_payload->>'proceeding_id','')::uuid;
  exception when others then raise exception 'TRIAL_INDEX_PROCEEDING_INVALID'; end;
  v_status := coalesce(nullif(p_payload->>'session_status',''),'planned');
  v_phase := coalesce(nullif(p_payload->>'trial_phase',''),'unknown');
  v_headline := btrim(coalesce(p_payload->>'headline',''));
  v_summary := btrim(coalesce(p_payload->>'summary',''));
  v_basis := coalesce(nullif(p_payload->>'basis',''),'planned');

  if v_status not in ('planned','in_progress','completed','adjourned','no_court','cancelled') then raise exception 'TRIAL_INDEX_STATUS_INVALID'; end if;
  if v_phase not in ('pretrial','prosecution','defense','rebuttal','closings','deliberations','verdict','other','unknown') then raise exception 'TRIAL_INDEX_PHASE_INVALID'; end if;
  if v_basis not in ('canonical_record','editorial_reference','mixed','planned') then raise exception 'TRIAL_INDEX_BASIS_INVALID'; end if;
  if length(v_headline) not between 3 and 240 then raise exception 'TRIAL_INDEX_HEADLINE_INVALID'; end if;
  if length(v_summary)>5000 or length(v_change_note)>1000 then raise exception 'TRIAL_INDEX_TEXT_TOO_LONG'; end if;
  if jsonb_typeof(v_witnesses)<>'array' or jsonb_array_length(v_witnesses)>250 then raise exception 'TRIAL_INDEX_WITNESSES_INVALID'; end if;
  if jsonb_typeof(v_topics)<>'array' or jsonb_array_length(v_topics)>250 then raise exception 'TRIAL_INDEX_TOPICS_INVALID'; end if;
  if jsonb_typeof(v_references)<>'array' or jsonb_array_length(v_references)>100 then raise exception 'TRIAL_INDEX_REFERENCES_INVALID'; end if;

  if v_proceeding_id is not null and not exists(select 1 from public.proceedings where id=v_proceeding_id and case_id=p_case_id) then
    raise exception 'TRIAL_INDEX_LINK_UNAVAILABLE' using errcode='42501';
  end if;

  for v_item in select value from jsonb_array_elements(v_witnesses) loop
    if jsonb_typeof(v_item)<>'object'
      or exists(select 1 from jsonb_object_keys(v_item) key where key<>all(array['name','descriptor','status','source_segment_id','proceeding_speaker_id','witness_block_id']))
      or length(btrim(coalesce(v_item->>'name',''))) not between 2 and 200
      or length(coalesce(v_item->>'descriptor',''))>1000
      or coalesce(nullif(v_item->>'status',''),'reported') not in ('expected','appeared','continued','reported','unknown')
    then raise exception 'TRIAL_INDEX_WITNESS_INVALID'; end if;
    begin v_link_id := nullif(v_item->>'source_segment_id','')::uuid;
    exception when others then raise exception 'TRIAL_INDEX_WITNESS_LINK_INVALID'; end;
    if v_link_id is not null and not exists(select 1 from public.source_segments where id=v_link_id and case_id=p_case_id and (v_proceeding_id is null or proceeding_id=v_proceeding_id)) then raise exception 'TRIAL_INDEX_LINK_UNAVAILABLE' using errcode='42501'; end if;
    begin v_link_id := nullif(v_item->>'proceeding_speaker_id','')::uuid;
    exception when others then raise exception 'TRIAL_INDEX_WITNESS_LINK_INVALID'; end;
    if v_link_id is not null and not exists(select 1 from public.proceeding_speakers where id=v_link_id and case_id=p_case_id and (v_proceeding_id is null or proceeding_id=v_proceeding_id)) then raise exception 'TRIAL_INDEX_LINK_UNAVAILABLE' using errcode='42501'; end if;
    begin v_link_id := nullif(v_item->>'witness_block_id','')::uuid;
    exception when others then raise exception 'TRIAL_INDEX_WITNESS_LINK_INVALID'; end;
    if v_link_id is not null and not exists(select 1 from public.witness_blocks where id=v_link_id and case_id=p_case_id and (v_proceeding_id is null or proceeding_id=v_proceeding_id)) then raise exception 'TRIAL_INDEX_LINK_UNAVAILABLE' using errcode='42501'; end if;
  end loop;

  for v_item in select value from jsonb_array_elements(v_topics) loop
    if jsonb_typeof(v_item)<>'object'
      or exists(select 1 from jsonb_object_keys(v_item) key where key<>all(array['label','summary','source_segment_id']))
      or length(btrim(coalesce(v_item->>'label',''))) not between 2 and 200
      or length(coalesce(v_item->>'summary',''))>2000
    then raise exception 'TRIAL_INDEX_TOPIC_INVALID'; end if;
    begin v_link_id := nullif(v_item->>'source_segment_id','')::uuid;
    exception when others then raise exception 'TRIAL_INDEX_TOPIC_LINK_INVALID'; end;
    if v_link_id is not null and not exists(select 1 from public.source_segments where id=v_link_id and case_id=p_case_id and (v_proceeding_id is null or proceeding_id=v_proceeding_id)) then raise exception 'TRIAL_INDEX_LINK_UNAVAILABLE' using errcode='42501'; end if;
  end loop;

  for v_item in select value from jsonb_array_elements(v_references) loop
    if jsonb_typeof(v_item)<>'object'
      or exists(select 1 from jsonb_object_keys(v_item) key where key<>all(array['title','url','publisher','source_kind']))
      or length(btrim(coalesce(v_item->>'title',''))) not between 2 and 300
      or coalesce(v_item->>'url','') !~ '^https?://'
      or length(coalesce(v_item->>'url',''))>2000
      or coalesce(nullif(v_item->>'source_kind',''),'reporting') not in ('reporting','court_notice','docket','canonical_transcript','other')
    then raise exception 'TRIAL_INDEX_REFERENCE_INVALID'; end if;
  end loop;

  v_snapshot := jsonb_build_object(
    'day_number',v_day_number,'court_date',coalesce(v_court_date::text,''),'proceeding_id',coalesce(v_proceeding_id::text,''),
    'session_status',v_status,'trial_phase',v_phase,'headline',v_headline,'summary',v_summary,'basis',v_basis,
    'witnesses',v_witnesses,'topics',v_topics,'references',v_references,'navigation_only',true
  );

  select id,current_version into v_day_id,v_version
  from public.trial_index_days where case_id=p_case_id and day_number=v_day_number for update;
  if not found then
    v_day_id := gen_random_uuid();
    v_version := 0;
    v_created := true;
    insert into public.trial_index_days(
      id,case_id,day_number,court_date,proceeding_id,session_status,trial_phase,headline,summary,basis,
      witnesses,topics,navigation_references,current_version,created_by_user_id,updated_by_user_id
    ) values (
      v_day_id,p_case_id,v_day_number,v_court_date,v_proceeding_id,v_status,v_phase,v_headline,v_summary,v_basis,
      v_witnesses,v_topics,v_references,0,v_actor,v_actor
    );
  else
    select snapshot into v_previous from public.trial_index_day_versions where trial_index_day_id=v_day_id order by version desc limit 1;
    if v_previous=v_snapshot then
      return jsonb_build_object('day_id',v_day_id,'day_number',v_day_number,'version',v_version,'duplicate',true,'navigation_only',true);
    end if;
  end if;

  v_version := v_version+1;
  update public.trial_index_days set
    court_date=v_court_date,proceeding_id=v_proceeding_id,session_status=v_status,trial_phase=v_phase,
    headline=v_headline,summary=v_summary,basis=v_basis,witnesses=v_witnesses,topics=v_topics,
    navigation_references=v_references,current_version=v_version,updated_by_user_id=v_actor,updated_at=now()
  where id=v_day_id;
  insert into public.trial_index_day_versions(case_id,trial_index_day_id,version,snapshot,change_note,changed_by_user_id)
  values(p_case_id,v_day_id,v_version,v_snapshot,v_change_note,v_actor);
  insert into public.audit_events(id,case_id,actor_user_id,action,subject_type,subject_id,details)
  values(
    gen_random_uuid(),p_case_id,v_actor,case when v_created then 'trial_index.day_created' else 'trial_index.day_updated' end,
    'trial_index_day',v_day_id::text,jsonb_build_object('day_number',v_day_number,'version',v_version,'basis',v_basis,'navigation_only',true)
  );

  return jsonb_build_object('day_id',v_day_id,'day_number',v_day_number,'version',v_version,'duplicate',false,'navigation_only',true);
end;
$$;

revoke all on function private.upsert_trial_index_day_core(uuid,jsonb) from public,anon;
grant execute on function private.upsert_trial_index_day_core(uuid,jsonb) to authenticated;

create function public.upsert_trial_index_day(p_case_id uuid,p_payload jsonb) returns jsonb
language sql volatile security invoker set search_path='' as $$
  select private.upsert_trial_index_day_core(p_case_id,p_payload);
$$;

revoke all on function public.upsert_trial_index_day(uuid,jsonb) from public,anon;
grant execute on function public.upsert_trial_index_day(uuid,jsonb) to authenticated;
