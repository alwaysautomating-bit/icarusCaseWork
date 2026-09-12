do $$
declare
  policy_record record;
begin
  for policy_record in
    select * from (values
      ('source_artifacts', 'artifacts_all'),
      ('sources', 'sources_all'),
      ('source_lineages', 'source_lineages_all'),
      ('proceedings', 'proceedings_case_access'),
      ('proceeding_speakers', 'proceeding_speakers_case_access'),
      ('qa_exchanges', 'qa_exchanges_case_access'),
      ('extraction_candidates', 'extraction_candidates_case_access'),
      ('proceeding_positions', 'proceeding_positions_case_access'),
      ('procedural_actions', 'procedural_actions_case_access'),
      ('proceeding_exhibits', 'proceeding_exhibits_case_access'),
      ('proceeding_stipulations', 'proceeding_stipulations_case_access'),
      ('resolution_items', 'resolution_items_case_access'),
      ('entities', 'entities_all'),
      ('events', 'events_all'),
      ('contradictions', 'contradictions_all'),
      ('evidence_snapshots', 'snapshots_all'),
      ('saved_research_views', 'views_all'),
      ('claim_attributions', 'claim_attributions_all'),
      ('propositions', 'propositions_all'),
      ('media_references', 'media_references_all')
    ) as policies(table_name, policy_name)
  loop
    execute format('drop policy %I on public.%I', policy_record.policy_name, policy_record.table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (private.can_contribute_case(case_id))',
      policy_record.table_name || '_contributor_insert',
      policy_record.table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (private.can_contribute_case(case_id)) with check (private.can_contribute_case(case_id))',
      policy_record.table_name || '_contributor_update',
      policy_record.table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (private.can_contribute_case(case_id))',
      policy_record.table_name || '_contributor_delete',
      policy_record.table_name
    );
  end loop;
end;
$$;

drop policy evidence_intakes_all on public.evidence_intakes;
create policy evidence_intakes_contributor_insert on public.evidence_intakes for insert to authenticated
  with check (private.can_contribute_case(case_id) and created_by_user_id = (select auth.uid()));
create policy evidence_intakes_contributor_update on public.evidence_intakes for update to authenticated
  using (private.can_contribute_case(case_id))
  with check (private.can_contribute_case(case_id) and created_by_user_id = (select auth.uid()));
create policy evidence_intakes_contributor_delete on public.evidence_intakes for delete to authenticated
  using (private.can_contribute_case(case_id));

drop policy acquisition_records_all on public.evidence_acquisition_records;
create policy acquisition_records_contributor_insert on public.evidence_acquisition_records for insert to authenticated
  with check (private.can_contribute_case(case_id) and created_by_user_id = (select auth.uid()));
create policy acquisition_records_contributor_update on public.evidence_acquisition_records for update to authenticated
  using (private.can_contribute_case(case_id))
  with check (private.can_contribute_case(case_id) and created_by_user_id = (select auth.uid()));
create policy acquisition_records_contributor_delete on public.evidence_acquisition_records for delete to authenticated
  using (private.can_contribute_case(case_id));

drop policy segments_all on public.source_segments;
create policy segments_contributor_insert on public.source_segments for insert to authenticated
  with check (exists (select 1 from public.source_artifacts as artifact where artifact.id = source_segments.artifact_id and private.can_contribute_case(artifact.case_id)));
create policy segments_contributor_update on public.source_segments for update to authenticated
  using (exists (select 1 from public.source_artifacts as artifact where artifact.id = source_segments.artifact_id and private.can_contribute_case(artifact.case_id)))
  with check (exists (select 1 from public.source_artifacts as artifact where artifact.id = source_segments.artifact_id and private.can_contribute_case(artifact.case_id)));
create policy segments_contributor_delete on public.source_segments for delete to authenticated
  using (exists (select 1 from public.source_artifacts as artifact where artifact.id = source_segments.artifact_id and private.can_contribute_case(artifact.case_id)));

drop policy aliases_all on public.entity_aliases;
create policy aliases_contributor_insert on public.entity_aliases for insert to authenticated
  with check (exists (select 1 from public.entities as entity where entity.id = entity_aliases.entity_id and private.can_contribute_case(entity.case_id)));
create policy aliases_contributor_update on public.entity_aliases for update to authenticated
  using (exists (select 1 from public.entities as entity where entity.id = entity_aliases.entity_id and private.can_contribute_case(entity.case_id)))
  with check (exists (select 1 from public.entities as entity where entity.id = entity_aliases.entity_id and private.can_contribute_case(entity.case_id)));
create policy aliases_contributor_delete on public.entity_aliases for delete to authenticated
  using (exists (select 1 from public.entities as entity where entity.id = entity_aliases.entity_id and private.can_contribute_case(entity.case_id)));

drop policy provenance_all on public.artifact_provenance;
create policy provenance_contributor_insert on public.artifact_provenance for insert to authenticated
  with check (exists (select 1 from public.source_artifacts as artifact where artifact.id = artifact_provenance.artifact_id and private.can_contribute_case(artifact.case_id)));
create policy provenance_contributor_update on public.artifact_provenance for update to authenticated
  using (exists (select 1 from public.source_artifacts as artifact where artifact.id = artifact_provenance.artifact_id and private.can_contribute_case(artifact.case_id)))
  with check (exists (select 1 from public.source_artifacts as artifact where artifact.id = artifact_provenance.artifact_id and private.can_contribute_case(artifact.case_id)));
create policy provenance_contributor_delete on public.artifact_provenance for delete to authenticated
  using (exists (select 1 from public.source_artifacts as artifact where artifact.id = artifact_provenance.artifact_id and private.can_contribute_case(artifact.case_id)));

drop policy lineage_all on public.claim_lineage;
create policy lineage_contributor_insert on public.claim_lineage for insert to authenticated
  with check (exists (select 1 from public.claims as claim where claim.id = claim_lineage.parent_claim_id and private.can_contribute_case(claim.case_id)));
create policy lineage_contributor_update on public.claim_lineage for update to authenticated
  using (exists (select 1 from public.claims as claim where claim.id = claim_lineage.parent_claim_id and private.can_contribute_case(claim.case_id)))
  with check (exists (select 1 from public.claims as claim where claim.id = claim_lineage.parent_claim_id and private.can_contribute_case(claim.case_id)));
create policy lineage_contributor_delete on public.claim_lineage for delete to authenticated
  using (exists (select 1 from public.claims as claim where claim.id = claim_lineage.parent_claim_id and private.can_contribute_case(claim.case_id)));

drop policy contradiction_claims_all on public.contradiction_claims;
create policy contradiction_claims_contributor_insert on public.contradiction_claims for insert to authenticated
  with check (exists (select 1 from public.contradictions as contradiction where contradiction.id = contradiction_claims.contradiction_id and private.can_contribute_case(contradiction.case_id)));
create policy contradiction_claims_contributor_update on public.contradiction_claims for update to authenticated
  using (exists (select 1 from public.contradictions as contradiction where contradiction.id = contradiction_claims.contradiction_id and private.can_contribute_case(contradiction.case_id)))
  with check (exists (select 1 from public.contradictions as contradiction where contradiction.id = contradiction_claims.contradiction_id and private.can_contribute_case(contradiction.case_id)));
create policy contradiction_claims_contributor_delete on public.contradiction_claims for delete to authenticated
  using (exists (select 1 from public.contradictions as contradiction where contradiction.id = contradiction_claims.contradiction_id and private.can_contribute_case(contradiction.case_id)));

drop policy contradiction_dispositions_all on public.contradiction_dispositions;
create policy contradiction_dispositions_contributor_insert on public.contradiction_dispositions for insert to authenticated
  with check (actor_user_id = (select auth.uid()) and exists (select 1 from public.contradictions as contradiction where contradiction.id = contradiction_dispositions.contradiction_id and private.can_contribute_case(contradiction.case_id)));
create policy contradiction_dispositions_contributor_update on public.contradiction_dispositions for update to authenticated
  using (exists (select 1 from public.contradictions as contradiction where contradiction.id = contradiction_dispositions.contradiction_id and private.can_contribute_case(contradiction.case_id)))
  with check (actor_user_id = (select auth.uid()) and exists (select 1 from public.contradictions as contradiction where contradiction.id = contradiction_dispositions.contradiction_id and private.can_contribute_case(contradiction.case_id)));
create policy contradiction_dispositions_contributor_delete on public.contradiction_dispositions for delete to authenticated
  using (exists (select 1 from public.contradictions as contradiction where contradiction.id = contradiction_dispositions.contradiction_id and private.can_contribute_case(contradiction.case_id)));

drop policy snapshot_artifacts_all on public.snapshot_artifacts;
create policy snapshot_artifacts_contributor_insert on public.snapshot_artifacts for insert to authenticated
  with check (exists (select 1 from public.evidence_snapshots as snapshot where snapshot.id = snapshot_artifacts.snapshot_id and private.can_contribute_case(snapshot.case_id)));
create policy snapshot_artifacts_contributor_update on public.snapshot_artifacts for update to authenticated
  using (exists (select 1 from public.evidence_snapshots as snapshot where snapshot.id = snapshot_artifacts.snapshot_id and private.can_contribute_case(snapshot.case_id)))
  with check (exists (select 1 from public.evidence_snapshots as snapshot where snapshot.id = snapshot_artifacts.snapshot_id and private.can_contribute_case(snapshot.case_id)));
create policy snapshot_artifacts_contributor_delete on public.snapshot_artifacts for delete to authenticated
  using (exists (select 1 from public.evidence_snapshots as snapshot where snapshot.id = snapshot_artifacts.snapshot_id and private.can_contribute_case(snapshot.case_id)));

drop policy reviews_all on public.review_decisions;
create policy reviews_contributor_insert on public.review_decisions for insert to authenticated
  with check (reviewer_user_id = (select auth.uid()) and exists (select 1 from public.claims as claim where claim.id = review_decisions.claim_id and private.can_contribute_case(claim.case_id)));
create policy reviews_contributor_update on public.review_decisions for update to authenticated
  using (exists (select 1 from public.claims as claim where claim.id = review_decisions.claim_id and private.can_contribute_case(claim.case_id)))
  with check (reviewer_user_id = (select auth.uid()) and exists (select 1 from public.claims as claim where claim.id = review_decisions.claim_id and private.can_contribute_case(claim.case_id)));
create policy reviews_contributor_delete on public.review_decisions for delete to authenticated
  using (exists (select 1 from public.claims as claim where claim.id = review_decisions.claim_id and private.can_contribute_case(claim.case_id)));

drop policy event_claims_all on public.event_claims;
create policy event_claims_contributor_insert on public.event_claims for insert to authenticated
  with check (exists (select 1 from public.events as event where event.id = event_claims.event_id and private.can_contribute_case(event.case_id)));
create policy event_claims_contributor_update on public.event_claims for update to authenticated
  using (exists (select 1 from public.events as event where event.id = event_claims.event_id and private.can_contribute_case(event.case_id)))
  with check (exists (select 1 from public.events as event where event.id = event_claims.event_id and private.can_contribute_case(event.case_id)));
create policy event_claims_contributor_delete on public.event_claims for delete to authenticated
  using (exists (select 1 from public.events as event where event.id = event_claims.event_id and private.can_contribute_case(event.case_id)));
