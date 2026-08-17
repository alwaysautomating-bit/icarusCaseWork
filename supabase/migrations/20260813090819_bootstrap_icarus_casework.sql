create type public.review_disposition as enum ('accepted','amended_accepted','rejected','deferred','cancelled');
create type public.claim_status as enum ('candidate','accepted','rejected','deferred');
create type public.time_precision as enum ('exact','approximate','interval','relative','unknown');
create type public.entity_kind as enum ('person','organization','location','device','proceeding','system_node');
create type public.lineage_kind as enum ('origin','quotes','paraphrases','repeats','derives_from');
create type public.contradiction_status as enum ('unresolved','resolved_by_evidence','clarified','superseded','cancelled');
create type public.research_window as enum ('all','ninety_days','thirty_days','incident_window');

create table public.cases (
  id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references auth.users(id), title text not null,
  purpose text not null, public_record_cutoff timestamptz not null, incident_at timestamptz,
  incident_window_start timestamptz, incident_window_end timestamptz, created_at timestamptz not null default now()
);
create table public.case_members (
  case_id uuid not null references public.cases(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','researcher','reviewer','viewer')), created_at timestamptz not null default now(), primary key(case_id,user_id)
);
create table public.source_artifacts (
  id uuid primary key default gen_random_uuid(), case_id uuid not null references public.cases(id) on delete cascade, title text not null,
  media_type text not null, sha256 text not null, byte_length integer not null, object_key text not null, acquired_from text not null,
  is_authorized boolean not null, created_at timestamptz not null default now(), unique(case_id,sha256)
);
create table public.source_segments (
  id uuid primary key default gen_random_uuid(), artifact_id uuid not null references public.source_artifacts(id) on delete cascade,
  locator_type text not null, locator jsonb not null, exact_text text not null
);
create table public.claims (
  id uuid primary key default gen_random_uuid(), case_id uuid not null references public.cases(id) on delete cascade,
  source_segment_id uuid not null references public.source_segments(id), claimant text not null, assertion text not null,
  claimed_event_time timestamptz, statement_time timestamptz, status public.claim_status not null default 'candidate', created_at timestamptz not null default now()
);
create table public.review_decisions (
  id uuid primary key default gen_random_uuid(), claim_id uuid not null references public.claims(id) on delete cascade,
  reviewer_user_id uuid not null references auth.users(id), disposition public.review_disposition not null, rationale text not null,
  reviewed_at timestamptz not null default now()
);
create table public.events (
  id uuid primary key default gen_random_uuid(), case_id uuid not null references public.cases(id) on delete cascade,
  promoted_from_claim_id uuid not null unique references public.claims(id), title text not null, event_time_start timestamptz,
  event_time_end timestamptz, time_precision public.time_precision not null, epistemic_state text not null,
  uncertainty_note text not null default '', created_at timestamptz not null default now()
);
create table public.entities (
  id uuid primary key default gen_random_uuid(), case_id uuid not null references public.cases(id) on delete cascade,
  canonical_name text not null, kind public.entity_kind not null, description text not null default '', created_at timestamptz not null default now(), unique(case_id,canonical_name)
);
create table public.entity_aliases (
  id uuid primary key default gen_random_uuid(), entity_id uuid not null references public.entities(id) on delete cascade,
  alias text not null, source_artifact_id uuid references public.source_artifacts(id)
);
create table public.artifact_provenance (
  id uuid primary key default gen_random_uuid(), artifact_id uuid not null references public.source_artifacts(id) on delete cascade,
  role text not null check(role in ('originator','publisher','custodian','submitter')), entity_id uuid not null references public.entities(id), note text not null default ''
);
create table public.claim_lineage (
  parent_claim_id uuid not null references public.claims(id) on delete cascade, child_claim_id uuid not null references public.claims(id) on delete cascade,
  kind public.lineage_kind not null, rationale text not null, primary key(parent_claim_id,child_claim_id), check(parent_claim_id<>child_claim_id)
);
create table public.contradictions (
  id uuid primary key default gen_random_uuid(), case_id uuid not null references public.cases(id) on delete cascade,
  title text not null, description text not null, status public.contradiction_status not null default 'unresolved', created_at timestamptz not null default now()
);
create table public.contradiction_claims (
  contradiction_id uuid not null references public.contradictions(id) on delete cascade, claim_id uuid not null references public.claims(id),
  position text not null, primary key(contradiction_id,claim_id)
);
create table public.contradiction_dispositions (
  id uuid primary key default gen_random_uuid(), contradiction_id uuid not null unique references public.contradictions(id) on delete cascade,
  disposition public.contradiction_status not null check(disposition<>'unresolved'), rationale text not null,
  evidence_claim_id uuid references public.claims(id), actor_user_id uuid not null references auth.users(id), disposed_at timestamptz not null default now(),
  check(disposition='cancelled' or evidence_claim_id is not null)
);
create table public.evidence_snapshots (
  id uuid primary key default gen_random_uuid(), case_id uuid not null references public.cases(id) on delete cascade,
  manifest_sha256 text not null, created_at timestamptz not null default now()
);
create table public.snapshot_artifacts (
  snapshot_id uuid not null references public.evidence_snapshots(id) on delete cascade,
  artifact_id uuid not null references public.source_artifacts(id), primary key(snapshot_id,artifact_id)
);
create table public.saved_research_views (
  id uuid primary key default gen_random_uuid(), case_id uuid not null references public.cases(id) on delete cascade, name text not null,
  research_window public.research_window not null, include_unresolved boolean not null default true,
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), unique(case_id,name)
);
create table public.audit_events (
  id uuid primary key default gen_random_uuid(), case_id uuid not null references public.cases(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id), action text not null, subject_type text not null, subject_id text not null,
  details jsonb not null, occurred_at timestamptz not null default now()
);

create schema if not exists private;
create function private.can_access_case(target_case_id uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.case_members m where m.case_id=target_case_id and m.user_id=(select auth.uid()));
$$;
create function private.is_case_owner(target_case_id uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.cases c where c.id=target_case_id and c.owner_user_id=(select auth.uid()));
$$;
create function private.add_case_owner_membership() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.case_members(case_id,user_id,role) values(new.id,new.owner_user_id,'owner');
  return new;
end;
$$;
revoke all on function private.can_access_case(uuid) from public;
revoke all on function private.is_case_owner(uuid) from public;
revoke all on function private.add_case_owner_membership() from public;
grant usage on schema private to authenticated;
grant execute on function private.can_access_case(uuid) to authenticated;
grant execute on function private.is_case_owner(uuid) to authenticated;
create trigger add_case_owner_membership after insert on public.cases for each row execute function private.add_case_owner_membership();

alter table public.cases enable row level security;
alter table public.case_members enable row level security;
alter table public.source_artifacts enable row level security;
alter table public.source_segments enable row level security;
alter table public.claims enable row level security;
alter table public.review_decisions enable row level security;
alter table public.events enable row level security;
alter table public.entities enable row level security;
alter table public.entity_aliases enable row level security;
alter table public.artifact_provenance enable row level security;
alter table public.claim_lineage enable row level security;
alter table public.contradictions enable row level security;
alter table public.contradiction_claims enable row level security;
alter table public.contradiction_dispositions enable row level security;
alter table public.evidence_snapshots enable row level security;
alter table public.snapshot_artifacts enable row level security;
alter table public.saved_research_views enable row level security;
alter table public.audit_events enable row level security;

create policy cases_select on public.cases for select to authenticated using (private.can_access_case(id));
create policy cases_insert on public.cases for insert to authenticated with check (owner_user_id=(select auth.uid()));
create policy cases_update on public.cases for update to authenticated using (private.can_access_case(id)) with check (private.can_access_case(id));
create policy members_select on public.case_members for select to authenticated using (private.can_access_case(case_id));
create policy members_insert on public.case_members for insert to authenticated with check (private.is_case_owner(case_id));

create policy artifacts_all on public.source_artifacts for all to authenticated using (private.can_access_case(case_id)) with check (private.can_access_case(case_id));
create policy claims_all on public.claims for all to authenticated using (private.can_access_case(case_id)) with check (private.can_access_case(case_id));
create policy events_all on public.events for all to authenticated using (private.can_access_case(case_id)) with check (private.can_access_case(case_id));
create policy entities_all on public.entities for all to authenticated using (private.can_access_case(case_id)) with check (private.can_access_case(case_id));
create policy contradictions_all on public.contradictions for all to authenticated using (private.can_access_case(case_id)) with check (private.can_access_case(case_id));
create policy snapshots_all on public.evidence_snapshots for all to authenticated using (private.can_access_case(case_id)) with check (private.can_access_case(case_id));
create policy views_all on public.saved_research_views for all to authenticated using (private.can_access_case(case_id)) with check (private.can_access_case(case_id));
create policy audit_select on public.audit_events for select to authenticated using (private.can_access_case(case_id));
create policy audit_insert on public.audit_events for insert to authenticated with check (private.can_access_case(case_id) and actor_user_id=(select auth.uid()));

create policy segments_all on public.source_segments for all to authenticated using (exists(select 1 from public.source_artifacts a where a.id=artifact_id and private.can_access_case(a.case_id))) with check (exists(select 1 from public.source_artifacts a where a.id=artifact_id and private.can_access_case(a.case_id)));
create policy reviews_all on public.review_decisions for all to authenticated using (exists(select 1 from public.claims c where c.id=claim_id and private.can_access_case(c.case_id))) with check (reviewer_user_id=(select auth.uid()) and exists(select 1 from public.claims c where c.id=claim_id and private.can_access_case(c.case_id)));
create policy aliases_all on public.entity_aliases for all to authenticated using (exists(select 1 from public.entities e where e.id=entity_id and private.can_access_case(e.case_id))) with check (exists(select 1 from public.entities e where e.id=entity_id and private.can_access_case(e.case_id)));
create policy provenance_all on public.artifact_provenance for all to authenticated using (exists(select 1 from public.source_artifacts a where a.id=artifact_id and private.can_access_case(a.case_id))) with check (exists(select 1 from public.source_artifacts a where a.id=artifact_id and private.can_access_case(a.case_id)));
create policy lineage_all on public.claim_lineage for all to authenticated using (exists(select 1 from public.claims c where c.id=parent_claim_id and private.can_access_case(c.case_id))) with check (exists(select 1 from public.claims c where c.id=parent_claim_id and private.can_access_case(c.case_id)));
create policy contradiction_claims_all on public.contradiction_claims for all to authenticated using (exists(select 1 from public.contradictions c where c.id=contradiction_id and private.can_access_case(c.case_id))) with check (exists(select 1 from public.contradictions c where c.id=contradiction_id and private.can_access_case(c.case_id)));
create policy contradiction_dispositions_all on public.contradiction_dispositions for all to authenticated using (exists(select 1 from public.contradictions c where c.id=contradiction_id and private.can_access_case(c.case_id))) with check (actor_user_id=(select auth.uid()) and exists(select 1 from public.contradictions c where c.id=contradiction_id and private.can_access_case(c.case_id)));
create policy snapshot_artifacts_all on public.snapshot_artifacts for all to authenticated using (exists(select 1 from public.evidence_snapshots s where s.id=snapshot_id and private.can_access_case(s.case_id))) with check (exists(select 1 from public.evidence_snapshots s where s.id=snapshot_id and private.can_access_case(s.case_id)));

grant select,insert,update,delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;
