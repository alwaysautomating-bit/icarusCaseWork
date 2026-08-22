create table public.saved_reconstruction_versions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  name text not null check(char_length(btrim(name)) between 1 and 100),
  version integer not null check(version > 0),
  description text not null default '' check(char_length(description) <= 1000),
  schema_version text not null check(schema_version = 'testimony-reconstruction/1.0'),
  snapshot_sha256 text not null check(snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  source_run_ids uuid[] not null check(cardinality(source_run_ids) > 0),
  source_event_candidate_ids uuid[] not null check(cardinality(source_event_candidate_ids) > 0),
  source_temporal_assertion_ids uuid[] not null check(cardinality(source_temporal_assertion_ids) > 0),
  snapshot jsonb not null check(jsonb_typeof(snapshot) = 'object'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(case_id,name,version)
);

create index saved_reconstruction_versions_case_created_idx
  on public.saved_reconstruction_versions(case_id,created_at desc);

alter table public.saved_reconstruction_versions enable row level security;

create policy saved_reconstruction_versions_select
  on public.saved_reconstruction_versions for select to authenticated
  using(private.can_access_case(case_id));

grant select on public.saved_reconstruction_versions to authenticated;
grant all privileges on public.saved_reconstruction_versions to service_role;
revoke all on public.saved_reconstruction_versions from anon;

create function public.save_reconstruction_version(
  p_case_id uuid,
  p_name text,
  p_description text,
  p_snapshot jsonb
) returns public.saved_reconstruction_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_name text := btrim(p_name);
  v_version integer;
  v_run_ids uuid[];
  v_event_ids uuid[];
  v_temporal_ids uuid[];
  v_row public.saved_reconstruction_versions;
begin
  if v_actor is null or not private.can_access_case(p_case_id) then
    raise exception 'Not authorized for this case.' using errcode='42501';
  end if;
  if char_length(v_name) not between 1 and 100 or char_length(coalesce(p_description,'')) > 1000 then
    raise exception 'Invalid reconstruction name or description.';
  end if;
  if p_snapshot->>'schema_version' <> 'testimony-reconstruction/1.0'
     or nullif(p_snapshot->>'snapshot_sha256','') is null
     or (p_snapshot->>'snapshot_sha256') !~ '^[0-9a-f]{64}$'
     or nullif(p_snapshot->>'case_id','')::uuid <> p_case_id then
    raise exception 'Invalid reconstruction snapshot contract.';
  end if;
  if coalesce((p_snapshot->'boundaries'->>'canonical_events_created')::integer,-1) <> 0
     or coalesce((p_snapshot->'boundaries'->>'same_resolutions_created')::integer,-1) <> 0
     or coalesce((p_snapshot->'boundaries'->>'testimony_timestamps_used_as_event_time')::integer,-1) <> 0
     or coalesce((p_snapshot->'boundaries'->>'unresolved_tensions_collapsed')::integer,-1) <> 0 then
    raise exception 'Reconstruction snapshot violates candidate-only boundaries.';
  end if;

  v_run_ids := array(select value::uuid from jsonb_array_elements_text(coalesce(p_snapshot->'source_run_ids','[]'::jsonb)));
  v_event_ids := array(select value::uuid from jsonb_array_elements_text(coalesce(p_snapshot->'source_event_candidate_ids','[]'::jsonb)));
  v_temporal_ids := array(select value::uuid from jsonb_array_elements_text(coalesce(p_snapshot->'source_temporal_assertion_ids','[]'::jsonb)));
  if coalesce(cardinality(v_run_ids),0)=0 or coalesce(cardinality(v_event_ids),0)=0 or coalesce(cardinality(v_temporal_ids),0)=0 then
    raise exception 'Reconstruction snapshot requires source runs, event candidates, and temporal assertions.';
  end if;
  if cardinality(v_run_ids) <> (select count(distinct id) from public.knowledge_extraction_runs where case_id=p_case_id and id=any(v_run_ids)) then
    raise exception 'A reconstruction source run is unavailable for this case.' using errcode='42501';
  end if;
  if cardinality(v_event_ids) <> (select count(distinct id) from public.event_candidates where case_id=p_case_id and id=any(v_event_ids) and reconciled_event_id is null) then
    raise exception 'A reconstruction event candidate is unavailable or already reconciled.' using errcode='42501';
  end if;
  if cardinality(v_temporal_ids) <> (
    select count(distinct t.id) from public.temporal_assertions t
    where t.case_id=p_case_id and t.id=any(v_temporal_ids) and t.event_id is null and t.event_candidate_id=any(v_event_ids)
  ) then
    raise exception 'A reconstruction temporal assertion is unavailable or outside the candidate set.' using errcode='42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_case_id::text || ':' || lower(v_name),0));
  select coalesce(max(version),0)+1 into v_version
    from public.saved_reconstruction_versions
    where case_id=p_case_id and lower(name)=lower(v_name);

  insert into public.saved_reconstruction_versions(
    case_id,name,version,description,schema_version,snapshot_sha256,source_run_ids,
    source_event_candidate_ids,source_temporal_assertion_ids,snapshot,created_by
  ) values (
    p_case_id,v_name,v_version,coalesce(p_description,''),p_snapshot->>'schema_version',
    p_snapshot->>'snapshot_sha256',v_run_ids,v_event_ids,v_temporal_ids,p_snapshot,v_actor
  ) returning * into v_row;

  insert into public.audit_events(id,case_id,actor_user_id,action,subject_type,subject_id,details)
  values(gen_random_uuid(),p_case_id,v_actor,'reconstruction_version.saved','saved_reconstruction_version',v_row.id::text,
    jsonb_build_object('name',v_name,'version',v_version,'snapshotSha256',p_snapshot->>'snapshot_sha256','nodes',jsonb_array_length(p_snapshot->'nodes'),'tensions',jsonb_array_length(p_snapshot->'tensions')));
  return v_row;
end;
$$;

revoke all on function public.save_reconstruction_version(uuid,text,text,jsonb) from public,anon;
grant execute on function public.save_reconstruction_version(uuid,text,text,jsonb) to authenticated;
grant execute on function public.save_reconstruction_version(uuid,text,text,jsonb) to service_role;
