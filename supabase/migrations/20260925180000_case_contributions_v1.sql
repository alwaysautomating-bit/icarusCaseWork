-- Lets an owner share a per-case password so outside contributors can submit evidence
-- without a full account. Submissions land as "pending" and only the case owner can
-- see, approve, or reject them. Anonymous submission is written by the server-only
-- service-role client after it verifies the password in application code — these
-- tables intentionally grant nothing to anon/authenticated beyond the owner policies.

create table public.case_contribution_settings (
  case_id uuid primary key references public.cases(id) on delete cascade,
  password_hash text not null,
  enabled boolean not null default true,
  updated_by_user_id uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);

create table public.case_contributions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  contributor_name text not null default '' check (char_length(contributor_name) <= 120),
  contributor_note text not null default '' check (char_length(contributor_note) <= 2000),
  object_key text not null unique,
  original_filename text not null check (char_length(trim(original_filename)) between 1 and 255),
  media_type text not null check (media_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'application/pdf')),
  byte_length bigint not null check (byte_length > 0 and byte_length <= 26214400),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by_user_id uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint case_contributions_object_key_check check (object_key like 'contributions/' || case_id::text || '/%')
);

create index case_contributions_case_status_created_idx
  on public.case_contributions (case_id, status, created_at desc);

alter table public.case_contribution_settings enable row level security;
alter table public.case_contributions enable row level security;

create policy case_contribution_settings_owner_all
  on public.case_contribution_settings
  for all to authenticated
  using (private.is_case_owner(case_id))
  with check (private.is_case_owner(case_id) and updated_by_user_id = (select auth.uid()));

create policy case_contributions_owner_all
  on public.case_contributions
  for all to authenticated
  using (private.is_case_owner(case_id))
  with check (private.is_case_owner(case_id));

revoke all on table public.case_contribution_settings from anon, authenticated;
revoke all on table public.case_contributions from anon, authenticated;

grant select, insert, update, delete on table public.case_contribution_settings to authenticated;
grant select, update on table public.case_contributions to authenticated;
