create or replace function public.list_case_members(p_case_id uuid)
returns table (
  user_id uuid,
  email text,
  membership_role text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if not private.is_case_owner(p_case_id) then
    raise exception 'Only the case owner can view the member directory.' using errcode = '42501';
  end if;

  return query
  select
    member.user_id,
    account.email::text,
    member.role,
    member.created_at
  from public.case_members as member
  join auth.users as account on account.id = member.user_id
  where member.case_id = p_case_id
  order by
    case when member.role = 'owner' then 0 else 1 end,
    lower(account.email::text);
end;
$$;

create or replace function private.can_contribute_case(target_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.case_members as member
    where member.case_id = target_case_id
      and member.user_id = (select auth.uid())
      and member.role in ('owner', 'reviewer', 'researcher')
  );
$$;

create or replace function public.upsert_case_member_by_email(
  p_case_id uuid,
  p_email text,
  p_role text
)
returns table (
  user_id uuid,
  email text,
  membership_role text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_email text := lower(trim(p_email));
  v_target_user_id uuid;
  v_previous_role text;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if not private.is_case_owner(p_case_id) then
    raise exception 'Only the case owner can manage members.' using errcode = '42501';
  end if;

  if v_email = '' or position('@' in v_email) < 2 then
    raise exception 'Enter a valid email address.' using errcode = '22023';
  end if;

  if p_role not in ('reviewer', 'researcher', 'viewer') then
    raise exception 'The role must be reviewer, researcher, or viewer.' using errcode = '22023';
  end if;

  select account.id
  into v_target_user_id
  from auth.users as account
  where lower(account.email::text) = v_email
  limit 1;

  if v_target_user_id is null then
    raise exception 'No Icarus account exists for %. Ask this person to sign in once, then add them here.', v_email
      using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.cases as target_case
    where target_case.id = p_case_id
      and target_case.owner_user_id = v_target_user_id
  ) then
    raise exception 'The case owner role cannot be changed here.' using errcode = '22023';
  end if;

  select member.role
  into v_previous_role
  from public.case_members as member
  where member.case_id = p_case_id
    and member.user_id = v_target_user_id;

  insert into public.case_members (case_id, user_id, role)
  values (p_case_id, v_target_user_id, p_role)
  on conflict on constraint case_members_pkey
  do update set role = excluded.role;

  if v_previous_role is distinct from p_role then
    insert into public.audit_events (
      case_id,
      actor_user_id,
      action,
      subject_type,
      subject_id,
      details
    ) values (
      p_case_id,
      v_actor_id,
      case when v_previous_role is null then 'case.member_added' else 'case.member_role_changed' end,
      'case_member',
      v_target_user_id::text,
      jsonb_build_object('previous_role', v_previous_role, 'role', p_role)
    );
  end if;

  return query
  select
    member.user_id,
    account.email::text,
    member.role,
    member.created_at
  from public.case_members as member
  join auth.users as account on account.id = member.user_id
  where member.case_id = p_case_id
    and member.user_id = v_target_user_id;
end;
$$;

create or replace function public.remove_case_member(
  p_case_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_previous_role text;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if not private.is_case_owner(p_case_id) then
    raise exception 'Only the case owner can manage members.' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.cases as target_case
    where target_case.id = p_case_id
      and target_case.owner_user_id = p_user_id
  ) then
    raise exception 'The case owner cannot be removed.' using errcode = '22023';
  end if;

  delete from public.case_members as member
  where member.case_id = p_case_id
    and member.user_id = p_user_id
  returning member.role into v_previous_role;

  if v_previous_role is null then
    return false;
  end if;

  insert into public.audit_events (
    case_id,
    actor_user_id,
    action,
    subject_type,
    subject_id,
    details
  ) values (
    p_case_id,
    v_actor_id,
    'case.member_removed',
    'case_member',
    p_user_id::text,
    jsonb_build_object('previous_role', v_previous_role)
  );

  return true;
end;
$$;

revoke all on function public.list_case_members(uuid) from public, anon;
revoke all on function public.upsert_case_member_by_email(uuid, text, text) from public, anon;
revoke all on function public.remove_case_member(uuid, uuid) from public, anon;

grant execute on function public.list_case_members(uuid) to authenticated;
grant execute on function public.upsert_case_member_by_email(uuid, text, text) to authenticated;
grant execute on function public.remove_case_member(uuid, uuid) to authenticated;

revoke all on function private.can_contribute_case(uuid) from public;
grant execute on function private.can_contribute_case(uuid) to authenticated;

-- Viewer is a genuinely read-only exploration role. Existing SELECT policies continue
-- to use can_access_case; every direct mutation policy requires contribution access.
alter policy cases_update on public.cases
  using (private.is_case_owner(id))
  with check (private.is_case_owner(id));
alter policy audit_insert on public.audit_events
  with check (private.can_contribute_case(case_id) and actor_user_id = (select auth.uid()));
alter policy saved_timeline_views_insert on public.saved_timeline_views
  with check (private.can_contribute_case(case_id) and created_by = (select auth.uid()));
alter policy saved_timeline_views_delete on public.saved_timeline_views
  using (private.can_contribute_case(case_id) and (created_by = (select auth.uid()) or private.is_case_owner(case_id)));

alter policy artifacts_all on public.source_artifacts
  using (private.can_contribute_case(case_id)) with check (private.can_contribute_case(case_id));
alter policy sources_all on public.sources
  using (private.can_contribute_case(case_id)) with check (private.can_contribute_case(case_id));
alter policy source_lineages_all on public.source_lineages
  using (private.can_contribute_case(case_id)) with check (private.can_contribute_case(case_id));
alter policy evidence_intakes_all on public.evidence_intakes
  using (private.can_contribute_case(case_id))
  with check (private.can_contribute_case(case_id) and created_by_user_id = (select auth.uid()));
alter policy proceedings_case_access on public.proceedings
  using (private.can_contribute_case(case_id)) with check (private.can_contribute_case(case_id));
alter policy proceeding_speakers_case_access on public.proceeding_speakers
  using (private.can_contribute_case(case_id)) with check (private.can_contribute_case(case_id));
alter policy qa_exchanges_case_access on public.qa_exchanges
  using (private.can_contribute_case(case_id)) with check (private.can_contribute_case(case_id));
alter policy extraction_candidates_case_access on public.extraction_candidates
  using (private.can_contribute_case(case_id)) with check (private.can_contribute_case(case_id));
alter policy proceeding_positions_case_access on public.proceeding_positions
  using (private.can_contribute_case(case_id)) with check (private.can_contribute_case(case_id));
alter policy procedural_actions_case_access on public.procedural_actions
  using (private.can_contribute_case(case_id)) with check (private.can_contribute_case(case_id));
alter policy proceeding_exhibits_case_access on public.proceeding_exhibits
  using (private.can_contribute_case(case_id)) with check (private.can_contribute_case(case_id));
alter policy proceeding_stipulations_case_access on public.proceeding_stipulations
  using (private.can_contribute_case(case_id)) with check (private.can_contribute_case(case_id));
alter policy resolution_items_case_access on public.resolution_items
  using (private.can_contribute_case(case_id)) with check (private.can_contribute_case(case_id));

alter policy entities_all on public.entities
  using (private.can_contribute_case(case_id)) with check (private.can_contribute_case(case_id));
alter policy events_all on public.events
  using (private.can_contribute_case(case_id)) with check (private.can_contribute_case(case_id));
alter policy contradictions_all on public.contradictions
  using (private.can_contribute_case(case_id)) with check (private.can_contribute_case(case_id));
alter policy snapshots_all on public.evidence_snapshots
  using (private.can_contribute_case(case_id)) with check (private.can_contribute_case(case_id));
alter policy views_all on public.saved_research_views
  using (private.can_contribute_case(case_id)) with check (private.can_contribute_case(case_id));
alter policy claim_attributions_all on public.claim_attributions
  using (private.can_contribute_case(case_id)) with check (private.can_contribute_case(case_id));
alter policy propositions_all on public.propositions
  using (private.can_contribute_case(case_id)) with check (private.can_contribute_case(case_id));
alter policy media_references_all on public.media_references
  using (private.can_contribute_case(case_id)) with check (private.can_contribute_case(case_id));
alter policy acquisition_records_all on public.evidence_acquisition_records
  using (private.can_contribute_case(case_id))
  with check (private.can_contribute_case(case_id) and created_by_user_id = (select auth.uid()));

alter policy segments_all on public.source_segments
  using (exists (
    select 1 from public.source_artifacts as artifact
    where artifact.id = source_segments.artifact_id
      and private.can_contribute_case(artifact.case_id)
  ))
  with check (exists (
    select 1 from public.source_artifacts as artifact
    where artifact.id = source_segments.artifact_id
      and private.can_contribute_case(artifact.case_id)
  ));
alter policy aliases_all on public.entity_aliases
  using (exists (
    select 1 from public.entities as entity
    where entity.id = entity_aliases.entity_id
      and private.can_contribute_case(entity.case_id)
  ))
  with check (exists (
    select 1 from public.entities as entity
    where entity.id = entity_aliases.entity_id
      and private.can_contribute_case(entity.case_id)
  ));
alter policy provenance_all on public.artifact_provenance
  using (exists (
    select 1 from public.source_artifacts as artifact
    where artifact.id = artifact_provenance.artifact_id
      and private.can_contribute_case(artifact.case_id)
  ))
  with check (exists (
    select 1 from public.source_artifacts as artifact
    where artifact.id = artifact_provenance.artifact_id
      and private.can_contribute_case(artifact.case_id)
  ));
alter policy lineage_all on public.claim_lineage
  using (exists (
    select 1 from public.claims as claim
    where claim.id = claim_lineage.parent_claim_id
      and private.can_contribute_case(claim.case_id)
  ))
  with check (exists (
    select 1 from public.claims as claim
    where claim.id = claim_lineage.parent_claim_id
      and private.can_contribute_case(claim.case_id)
  ));
alter policy contradiction_claims_all on public.contradiction_claims
  using (exists (
    select 1 from public.contradictions as contradiction
    where contradiction.id = contradiction_claims.contradiction_id
      and private.can_contribute_case(contradiction.case_id)
  ))
  with check (exists (
    select 1 from public.contradictions as contradiction
    where contradiction.id = contradiction_claims.contradiction_id
      and private.can_contribute_case(contradiction.case_id)
  ));
alter policy contradiction_dispositions_all on public.contradiction_dispositions
  using (exists (
    select 1 from public.contradictions as contradiction
    where contradiction.id = contradiction_dispositions.contradiction_id
      and private.can_contribute_case(contradiction.case_id)
  ))
  with check (
    actor_user_id = (select auth.uid())
    and exists (
      select 1 from public.contradictions as contradiction
      where contradiction.id = contradiction_dispositions.contradiction_id
        and private.can_contribute_case(contradiction.case_id)
    )
  );
alter policy snapshot_artifacts_all on public.snapshot_artifacts
  using (exists (
    select 1 from public.evidence_snapshots as snapshot
    where snapshot.id = snapshot_artifacts.snapshot_id
      and private.can_contribute_case(snapshot.case_id)
  ))
  with check (exists (
    select 1 from public.evidence_snapshots as snapshot
    where snapshot.id = snapshot_artifacts.snapshot_id
      and private.can_contribute_case(snapshot.case_id)
  ));
alter policy reviews_all on public.review_decisions
  using (exists (
    select 1 from public.claims as claim
    where claim.id = review_decisions.claim_id
      and private.can_contribute_case(claim.case_id)
  ))
  with check (
    reviewer_user_id = (select auth.uid())
    and exists (
      select 1 from public.claims as claim
      where claim.id = review_decisions.claim_id
        and private.can_contribute_case(claim.case_id)
    )
  );
alter policy event_claims_all on public.event_claims
  using (exists (
    select 1 from public.events as event
    where event.id = event_claims.event_id
      and private.can_contribute_case(event.case_id)
  ))
  with check (exists (
    select 1 from public.events as event
    where event.id = event_claims.event_id
      and private.can_contribute_case(event.case_id)
  ));

create policy artifacts_member_select on public.source_artifacts for select to authenticated
  using (private.can_access_case(case_id));
create policy sources_member_select on public.sources for select to authenticated
  using (private.can_access_case(case_id));
create policy source_lineages_member_select on public.source_lineages for select to authenticated
  using (private.can_access_case(case_id));
create policy evidence_intakes_member_select on public.evidence_intakes for select to authenticated
  using (private.can_access_case(case_id));
create policy proceedings_member_select on public.proceedings for select to authenticated
  using (private.can_access_case(case_id));
create policy proceeding_speakers_member_select on public.proceeding_speakers for select to authenticated
  using (private.can_access_case(case_id));
create policy qa_exchanges_member_select on public.qa_exchanges for select to authenticated
  using (private.can_access_case(case_id));
create policy extraction_candidates_member_select on public.extraction_candidates for select to authenticated
  using (private.can_access_case(case_id));
create policy proceeding_positions_member_select on public.proceeding_positions for select to authenticated
  using (private.can_access_case(case_id));
create policy procedural_actions_member_select on public.procedural_actions for select to authenticated
  using (private.can_access_case(case_id));
create policy proceeding_exhibits_member_select on public.proceeding_exhibits for select to authenticated
  using (private.can_access_case(case_id));
create policy proceeding_stipulations_member_select on public.proceeding_stipulations for select to authenticated
  using (private.can_access_case(case_id));
create policy resolution_items_member_select on public.resolution_items for select to authenticated
  using (private.can_access_case(case_id));
create policy entities_member_select on public.entities for select to authenticated
  using (private.can_access_case(case_id));
create policy events_member_select on public.events for select to authenticated
  using (private.can_access_case(case_id));
create policy contradictions_member_select on public.contradictions for select to authenticated
  using (private.can_access_case(case_id));
create policy snapshots_member_select on public.evidence_snapshots for select to authenticated
  using (private.can_access_case(case_id));
create policy saved_research_views_member_select on public.saved_research_views for select to authenticated
  using (private.can_access_case(case_id));
create policy claim_attributions_member_select on public.claim_attributions for select to authenticated
  using (private.can_access_case(case_id));
create policy propositions_member_select on public.propositions for select to authenticated
  using (private.can_access_case(case_id));
create policy media_references_member_select on public.media_references for select to authenticated
  using (private.can_access_case(case_id));
create policy acquisition_records_member_select on public.evidence_acquisition_records for select to authenticated
  using (private.can_access_case(case_id));

create policy segments_member_select on public.source_segments for select to authenticated
  using (exists (
    select 1 from public.source_artifacts as artifact
    where artifact.id = source_segments.artifact_id
      and private.can_access_case(artifact.case_id)
  ));
create policy aliases_member_select on public.entity_aliases for select to authenticated
  using (exists (
    select 1 from public.entities as entity
    where entity.id = entity_aliases.entity_id
      and private.can_access_case(entity.case_id)
  ));
create policy provenance_member_select on public.artifact_provenance for select to authenticated
  using (exists (
    select 1 from public.source_artifacts as artifact
    where artifact.id = artifact_provenance.artifact_id
      and private.can_access_case(artifact.case_id)
  ));
create policy lineage_member_select on public.claim_lineage for select to authenticated
  using (exists (
    select 1 from public.claims as claim
    where claim.id = claim_lineage.parent_claim_id
      and private.can_access_case(claim.case_id)
  ));
create policy contradiction_claims_member_select on public.contradiction_claims for select to authenticated
  using (exists (
    select 1 from public.contradictions as contradiction
    where contradiction.id = contradiction_claims.contradiction_id
      and private.can_access_case(contradiction.case_id)
  ));
create policy contradiction_dispositions_member_select on public.contradiction_dispositions for select to authenticated
  using (exists (
    select 1 from public.contradictions as contradiction
    where contradiction.id = contradiction_dispositions.contradiction_id
      and private.can_access_case(contradiction.case_id)
  ));
create policy snapshot_artifacts_member_select on public.snapshot_artifacts for select to authenticated
  using (exists (
    select 1 from public.evidence_snapshots as snapshot
    where snapshot.id = snapshot_artifacts.snapshot_id
      and private.can_access_case(snapshot.case_id)
  ));
create policy reviews_member_select on public.review_decisions for select to authenticated
  using (exists (
    select 1 from public.claims as claim
    where claim.id = review_decisions.claim_id
      and private.can_access_case(claim.case_id)
  ));
create policy event_claims_member_select on public.event_claims for select to authenticated
  using (exists (
    select 1 from public.events as event
    where event.id = event_claims.event_id
      and private.can_access_case(event.case_id)
  ));
