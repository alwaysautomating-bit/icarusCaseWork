create table public.reconciliation_groups (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  name text not null check(length(btrim(name)) between 3 and 200),
  description text not null default '' check(length(description) <= 5000),
  status text not null check(status in ('open','reviewed','deferred')),
  analytical_only boolean not null default true check(analytical_only),
  current_version integer not null default 0 check(current_version >= 0),
  created_by_user_id uuid not null references auth.users(id),
  updated_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reconciliation_groups_case_status_idx on public.reconciliation_groups(case_id,status,updated_at desc);

create table public.reconciliation_group_versions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  reconciliation_group_id uuid not null references public.reconciliation_groups(id) on delete cascade,
  version integer not null check(version > 0),
  snapshot jsonb not null check(jsonb_typeof(snapshot)='object'),
  change_note text not null default '' check(length(change_note) <= 2000),
  changed_by_user_id uuid not null references auth.users(id),
  ledger_logical_order bigint not null,
  changed_at timestamptz not null default now(),
  unique(reconciliation_group_id,version),
  unique(case_id,ledger_logical_order)
);

create index reconciliation_group_versions_case_group_idx on public.reconciliation_group_versions(case_id,reconciliation_group_id,version desc);

alter table public.reconciliation_groups enable row level security;
alter table public.reconciliation_group_versions enable row level security;

create policy reconciliation_groups_select on public.reconciliation_groups for select to authenticated
  using(private.can_access_case(case_id));
create policy reconciliation_group_versions_select on public.reconciliation_group_versions for select to authenticated
  using(private.can_access_case(case_id));

revoke all on public.reconciliation_groups,public.reconciliation_group_versions from public,anon,authenticated;
grant select on public.reconciliation_groups,public.reconciliation_group_versions to authenticated;
grant all privileges on public.reconciliation_groups,public.reconciliation_group_versions to service_role;

create or replace view public.reconciliation_group_projection
with (security_invoker=true) as
select
  groups.id,
  groups.case_id,
  groups.name,
  groups.description,
  groups.status,
  groups.analytical_only,
  groups.current_version,
  groups.created_by_user_id,
  groups.updated_by_user_id,
  groups.created_at,
  groups.updated_at,
  coalesce(jsonb_array_length(versions.snapshot->'members'),0) as member_count,
  coalesce(jsonb_array_length(versions.snapshot->'edges'),0) as edge_count,
  coalesce(versions.snapshot->'members','[]'::jsonb) as members,
  coalesce(versions.snapshot->'edges','[]'::jsonb) as edges,
  versions.changed_at as version_changed_at
from public.reconciliation_groups groups
left join lateral (
  select version.snapshot,version.changed_at
  from public.reconciliation_group_versions version
  where version.reconciliation_group_id=groups.id
  order by version.version desc
  limit 1
) versions on true;

revoke all on public.reconciliation_group_projection from public,anon,authenticated;
grant select on public.reconciliation_group_projection to authenticated;

create function private.save_reconciliation_group_core(
  p_case_id uuid,
  p_group_id uuid,
  p_expected_version integer,
  p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid := (select auth.uid());
  v_group_id uuid := p_group_id;
  v_name text;
  v_description text;
  v_status text;
  v_change_note text;
  v_members jsonb;
  v_edges jsonb;
  v_members_snapshot jsonb := '[]'::jsonb;
  v_edges_snapshot jsonb := '[]'::jsonb;
  v_snapshot jsonb;
  v_previous jsonb;
  v_member jsonb;
  v_edge jsonb;
  v_node_type text;
  v_node_id uuid;
  v_role text;
  v_object_code text;
  v_title text;
  v_review_status text;
  v_proceeding_id uuid;
  v_source_ids uuid[];
  v_member_keys text[] := '{}'::text[];
  v_edge_keys text[] := '{}'::text[];
  v_from_type text;
  v_to_type text;
  v_from_id uuid;
  v_to_id uuid;
  v_relation text;
  v_rationale text;
  v_version integer := 0;
  v_created boolean := false;
  v_ledger_order bigint;
begin
  if v_actor is null or not private.can_review_case(p_case_id) then
    raise exception 'RECONCILIATION_NOT_AUTHORIZED' using errcode='42501';
  end if;
  if jsonb_typeof(p_payload)<>'object' then raise exception 'RECONCILIATION_PAYLOAD_INVALID'; end if;
  if exists(
    select 1 from jsonb_object_keys(p_payload) key
    where key<>all(array['name','description','status','members','edges','change_note'])
  ) then raise exception 'RECONCILIATION_FIELD_NOT_ALLOWED'; end if;

  v_name := btrim(coalesce(p_payload->>'name',''));
  v_description := btrim(coalesce(p_payload->>'description',''));
  v_status := coalesce(nullif(p_payload->>'status',''),'open');
  v_change_note := btrim(coalesce(p_payload->>'change_note',''));
  v_members := coalesce(p_payload->'members','[]'::jsonb);
  v_edges := coalesce(p_payload->'edges','[]'::jsonb);

  if length(v_name) not between 3 and 200 or length(v_description)>5000 or length(v_change_note)>2000 then
    raise exception 'RECONCILIATION_TEXT_INVALID';
  end if;
  if v_status not in ('open','reviewed','deferred') then raise exception 'RECONCILIATION_STATUS_INVALID'; end if;
  if jsonb_typeof(v_members)<>'array' or jsonb_array_length(v_members) not between 2 and 50 then raise exception 'RECONCILIATION_MEMBERS_INVALID'; end if;
  if jsonb_typeof(v_edges)<>'array' or jsonb_array_length(v_edges)>200 then raise exception 'RECONCILIATION_EDGES_INVALID'; end if;
  if v_status='reviewed' and jsonb_array_length(v_edges)=0 then raise exception 'RECONCILIATION_REVIEW_REQUIRES_EDGE'; end if;

  if v_group_id is null then
    if coalesce(p_expected_version,0)<>0 then raise exception 'RECONCILIATION_STALE_VERSION'; end if;
    v_group_id := gen_random_uuid();
    v_created := true;
  else
    select current_version into v_version
    from public.reconciliation_groups
    where id=v_group_id and case_id=p_case_id
    for update;
    if not found then raise exception 'RECONCILIATION_GROUP_UNAVAILABLE' using errcode='42501'; end if;
    if p_expected_version is null or p_expected_version<>v_version then raise exception 'RECONCILIATION_STALE_VERSION'; end if;
    if v_change_note='' then raise exception 'RECONCILIATION_CHANGE_NOTE_REQUIRED'; end if;
  end if;

  for v_member in select value from jsonb_array_elements(v_members) loop
    if jsonb_typeof(v_member)<>'object'
      or exists(select 1 from jsonb_object_keys(v_member) key where key<>all(array['node_type','node_id','role']))
    then raise exception 'RECONCILIATION_MEMBER_INVALID'; end if;
    v_node_type := coalesce(v_member->>'node_type','');
    v_role := coalesce(nullif(v_member->>'role',''),'context');
    begin v_node_id := (v_member->>'node_id')::uuid;
    exception when others then raise exception 'RECONCILIATION_MEMBER_INVALID'; end;
    if v_node_type not in ('knowledge','claim','event','temporal','mention','relationship','flag')
      or v_role not in ('anchor','supporting','conflicting','context','unresolved')
    then raise exception 'RECONCILIATION_MEMBER_INVALID'; end if;
    if (v_node_type||':'||v_node_id::text)=any(v_member_keys) then raise exception 'RECONCILIATION_MEMBER_DUPLICATE'; end if;

    v_object_code := null; v_title := null; v_review_status := null; v_proceeding_id := null; v_source_ids := '{}'::uuid[];
    if v_node_type='knowledge' then
      select object_code,summary,review_status,proceeding_id into v_object_code,v_title,v_review_status,v_proceeding_id
      from public.knowledge_items where id=v_node_id and case_id=p_case_id;
      select coalesce(array_agg(source_segment_id order by ordinal),'{}'::uuid[]) into v_source_ids
      from public.knowledge_item_segments where knowledge_item_id=v_node_id;
    elsif v_node_type='claim' then
      select claim.object_code,coalesce(claim.normalized_assertion,claim.assertion),claim.status::text,item.proceeding_id
      into v_object_code,v_title,v_review_status,v_proceeding_id
      from public.claims claim left join public.knowledge_items item on item.id=claim.knowledge_item_id
      where claim.id=v_node_id and claim.case_id=p_case_id;
      select coalesce(array_agg(distinct source_id),'{}'::uuid[]) into v_source_ids from (
        select source_segment_id source_id from public.claims where id=v_node_id and case_id=p_case_id
        union select source_segment_id from public.claim_source_segments where claim_id=v_node_id
      ) sources;
    elsif v_node_type='event' then
      select object_code,neutral_description,review_status,proceeding_id into v_object_code,v_title,v_review_status,v_proceeding_id
      from public.event_candidates where id=v_node_id and case_id=p_case_id;
      select coalesce(array_agg(distinct source_id),'{}'::uuid[]) into v_source_ids from (
        select links.source_segment_id source_id
        from public.event_candidates event join public.knowledge_item_segments links on links.knowledge_item_id=event.knowledge_item_id
        where event.id=v_node_id and event.case_id=p_case_id
        union
        select claim.source_segment_id
        from public.event_candidates event join public.claims claim on claim.id=any(event.source_claim_ids)
        where event.id=v_node_id and event.case_id=p_case_id
        union
        select links.source_segment_id
        from public.event_candidates event join public.claim_source_segments links on links.claim_id=any(event.source_claim_ids)
        where event.id=v_node_id and event.case_id=p_case_id
      ) sources;
    elsif v_node_type='temporal' then
      select assertion.object_code,assertion.raw_temporal_language,assertion.review_status,item.proceeding_id,assertion.source_segment_ids
      into v_object_code,v_title,v_review_status,v_proceeding_id,v_source_ids
      from public.temporal_assertions assertion left join public.knowledge_items item on item.id=assertion.knowledge_item_id
      where assertion.id=v_node_id and assertion.case_id=p_case_id;
    elsif v_node_type='mention' then
      select mention.object_code,mention.raw_mention,mention.review_status,item.proceeding_id,mention.source_segment_ids
      into v_object_code,v_title,v_review_status,v_proceeding_id,v_source_ids
      from public.entity_mentions mention left join public.knowledge_items item on item.id=mention.knowledge_item_id
      where mention.id=v_node_id and mention.case_id=p_case_id;
    elsif v_node_type='relationship' then
      select relation.object_code,relation.from_node_type||' '||relation.relation_type||' '||relation.to_node_type,relation.review_status,item.proceeding_id
      into v_object_code,v_title,v_review_status,v_proceeding_id
      from public.knowledge_relationships relation left join public.knowledge_items item on item.id=relation.knowledge_item_id
      where relation.id=v_node_id and relation.case_id=p_case_id;
      select coalesce(array_agg(distinct source_id),'{}'::uuid[]) into v_source_ids from (
        select links.source_segment_id source_id
        from public.knowledge_relationships relation join public.knowledge_item_segments links on links.knowledge_item_id=relation.knowledge_item_id
        where relation.id=v_node_id and relation.case_id=p_case_id
        union
        select claim.source_segment_id from public.knowledge_relationships relation join public.claims claim on claim.id=relation.source_claim_id
        where relation.id=v_node_id and relation.case_id=p_case_id
      ) sources;
    else
      select object_code,flag_type||': '||rationale,status,null::uuid,source_segment_ids
      into v_object_code,v_title,v_review_status,v_proceeding_id,v_source_ids
      from public.knowledge_flags where id=v_node_id and case_id=p_case_id;
    end if;

    if v_title is null then raise exception 'RECONCILIATION_MEMBER_UNAVAILABLE' using errcode='42501'; end if;
    if v_review_status not in ('accepted','amended') then raise exception 'RECONCILIATION_MEMBER_NOT_REVIEWED'; end if;
    if coalesce(array_length(v_source_ids,1),0)=0 then raise exception 'RECONCILIATION_SOURCE_LINEAGE_REQUIRED'; end if;
    v_member_keys := array_append(v_member_keys,v_node_type||':'||v_node_id::text);
    v_members_snapshot := v_members_snapshot||jsonb_build_array(jsonb_build_object(
      'node_type',v_node_type,'node_id',v_node_id,'role',v_role,'object_code',v_object_code,'title',v_title,
      'review_status',v_review_status,'proceeding_id',v_proceeding_id,'source_segment_ids',to_jsonb(v_source_ids)
    ));
  end loop;

  for v_edge in select value from jsonb_array_elements(v_edges) loop
    if jsonb_typeof(v_edge)<>'object'
      or exists(select 1 from jsonb_object_keys(v_edge) key where key<>all(array['from_type','from_id','to_type','to_id','relation_type','rationale']))
    then raise exception 'RECONCILIATION_EDGE_INVALID'; end if;
    v_from_type := coalesce(v_edge->>'from_type',''); v_to_type := coalesce(v_edge->>'to_type','');
    v_relation := coalesce(v_edge->>'relation_type',''); v_rationale := btrim(coalesce(v_edge->>'rationale',''));
    begin v_from_id := (v_edge->>'from_id')::uuid; v_to_id := (v_edge->>'to_id')::uuid;
    exception when others then raise exception 'RECONCILIATION_EDGE_INVALID'; end;
    if v_relation not in ('supports','conflicts_with','qualifies','duplicates','derives_from','same_occurrence_candidate','distinct_occurrence','sequence_consistent','leaves_unresolved')
      or length(v_rationale) not between 3 and 2000
      or not (v_from_type||':'||v_from_id::text)=any(v_member_keys)
      or not (v_to_type||':'||v_to_id::text)=any(v_member_keys)
      or (v_from_type=v_to_type and v_from_id=v_to_id)
    then raise exception 'RECONCILIATION_EDGE_INVALID'; end if;
    if (v_from_type||':'||v_from_id::text||':'||v_relation||':'||v_to_type||':'||v_to_id::text)=any(v_edge_keys) then raise exception 'RECONCILIATION_EDGE_DUPLICATE'; end if;
    v_edge_keys := array_append(v_edge_keys,v_from_type||':'||v_from_id::text||':'||v_relation||':'||v_to_type||':'||v_to_id::text);
    v_edges_snapshot := v_edges_snapshot||jsonb_build_array(jsonb_build_object(
      'from_type',v_from_type,'from_id',v_from_id,'to_type',v_to_type,'to_id',v_to_id,'relation_type',v_relation,'rationale',v_rationale
    ));
  end loop;

  v_snapshot := jsonb_build_object(
    'schema_version','reconciliation-group/1.0','name',v_name,'description',v_description,'status',v_status,
    'members',v_members_snapshot,'edges',v_edges_snapshot,'analytical_only',true,
    'boundaries',jsonb_build_object('canonical_events_created',0,'same_resolutions_created',0,'entity_resolutions_created',0,'source_objects_mutated',0)
  );

  if not v_created then
    select snapshot into v_previous from public.reconciliation_group_versions
    where reconciliation_group_id=v_group_id order by version desc limit 1;
    if v_previous=v_snapshot then
      return jsonb_build_object('group_id',v_group_id,'version',v_version,'duplicate',true,'analytical_only',true);
    end if;
  else
    insert into public.reconciliation_groups(id,case_id,name,description,status,current_version,created_by_user_id,updated_by_user_id)
    values(v_group_id,p_case_id,v_name,v_description,v_status,0,v_actor,v_actor);
  end if;

  v_version := v_version+1;
  update public.reconciliation_groups set name=v_name,description=v_description,status=v_status,current_version=v_version,
    updated_by_user_id=v_actor,updated_at=now() where id=v_group_id;
  v_ledger_order := private.append_case_ledger(
    p_case_id,'reconciliation_group',v_group_id,'REC-'||upper(substr(replace(v_group_id::text,'-',''),1,10)),
    case when v_created then 'created' else 'versioned' end,null,v_actor,'icarus-reconcile-v1',
    jsonb_build_object('version',v_version,'member_count',jsonb_array_length(v_members_snapshot),'edge_count',jsonb_array_length(v_edges_snapshot),'status',v_status,'analytical_only',true)
  );
  insert into public.reconciliation_group_versions(case_id,reconciliation_group_id,version,snapshot,change_note,changed_by_user_id,ledger_logical_order)
  values(p_case_id,v_group_id,v_version,v_snapshot,v_change_note,v_actor,v_ledger_order);

  return jsonb_build_object('group_id',v_group_id,'version',v_version,'duplicate',false,'ledger_logical_order',v_ledger_order,'analytical_only',true);
end;
$$;

revoke all on function private.save_reconciliation_group_core(uuid,uuid,integer,jsonb) from public,anon;
grant execute on function private.save_reconciliation_group_core(uuid,uuid,integer,jsonb) to authenticated;

create function public.save_reconciliation_group(
  p_case_id uuid,
  p_group_id uuid,
  p_expected_version integer,
  p_payload jsonb
) returns jsonb
language sql volatile security invoker set search_path='' as $$
  select private.save_reconciliation_group_core(p_case_id,p_group_id,p_expected_version,p_payload);
$$;

revoke all on function public.save_reconciliation_group(uuid,uuid,integer,jsonb) from public,anon;
grant execute on function public.save_reconciliation_group(uuid,uuid,integer,jsonb) to authenticated;
