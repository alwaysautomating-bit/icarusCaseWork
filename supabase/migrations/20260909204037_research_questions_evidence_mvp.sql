create table public.research_questions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  question text not null check (char_length(trim(question)) between 5 and 500),
  context text not null default '' check (char_length(context) <= 2000),
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolution text not null default '' check (char_length(resolution) <= 4000),
  limitations text not null default '' check (char_length(limitations) <= 2000),
  prompted_by_type text,
  prompted_by_id text,
  prompted_by_label text check (prompted_by_label is null or char_length(prompted_by_label) <= 300),
  prompted_by_href text check (prompted_by_href is null or char_length(prompted_by_href) <= 1000),
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint research_questions_id_case_key unique (id, case_id),
  check ((status = 'resolved' and resolved_at is not null and char_length(trim(resolution)) > 0) or (status = 'open' and resolved_at is null))
);

create table public.research_evidence_items (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 300),
  description text not null default '' check (char_length(description) <= 3000),
  research_note text not null default '' check (char_length(research_note) <= 3000),
  existence_established boolean not null default true check (existence_established),
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint research_evidence_items_id_case_key unique (id, case_id)
);

create unique index research_evidence_items_case_name_key
  on public.research_evidence_items (case_id, lower(trim(name)));

create table public.research_question_sources (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null,
  case_id uuid not null,
  source_type text not null check (source_type in ('testimony', 'evidence', 'document', 'image', 'research_material')),
  source_id text,
  source_label text not null check (char_length(trim(source_label)) between 2 and 500),
  source_href text check (source_href is null or char_length(source_href) <= 1000),
  source_locator jsonb not null default '{}'::jsonb,
  researcher_note text not null default '' check (char_length(researcher_note) <= 2000),
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint research_question_sources_question_case_fkey foreign key (question_id, case_id)
    references public.research_questions(id, case_id) on delete cascade,
  constraint research_question_sources_id_question_case_key unique (id, question_id, case_id)
);

create table public.research_question_entries (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null,
  case_id uuid not null,
  entry_kind text not null check (entry_kind in ('known', 'finding', 'unknown', 'target')),
  statement text not null check (char_length(trim(statement)) between 2 and 2000),
  source_link_id uuid,
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint research_question_entries_question_case_fkey foreign key (question_id, case_id)
    references public.research_questions(id, case_id) on delete cascade,
  constraint research_question_entries_source_fkey foreign key (source_link_id, question_id, case_id)
    references public.research_question_sources(id, question_id, case_id) on delete restrict,
  check (entry_kind not in ('known', 'finding') or source_link_id is not null)
);

create table public.research_evidence_sources (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null,
  case_id uuid not null,
  source_type text not null check (source_type in ('testimony', 'document', 'image', 'research_material')),
  source_id text,
  source_label text not null check (char_length(trim(source_label)) between 2 and 500),
  source_href text check (source_href is null or char_length(source_href) <= 1000),
  source_locator jsonb not null default '{}'::jsonb,
  relationship text not null default 'mentions' check (relationship in ('documents', 'mentions', 'depicts')),
  researcher_note text not null default '' check (char_length(researcher_note) <= 2000),
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint research_evidence_sources_evidence_case_fkey foreign key (evidence_id, case_id)
    references public.research_evidence_items(id, case_id) on delete cascade,
  constraint research_evidence_sources_id_evidence_case_key unique (id, evidence_id, case_id)
);

create table public.research_evidence_facts (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null,
  case_id uuid not null,
  statement text not null check (char_length(trim(statement)) between 2 and 2000),
  source_link_id uuid not null,
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint research_evidence_facts_evidence_case_fkey foreign key (evidence_id, case_id)
    references public.research_evidence_items(id, case_id) on delete cascade,
  constraint research_evidence_facts_source_fkey foreign key (source_link_id, evidence_id, case_id)
    references public.research_evidence_sources(id, evidence_id, case_id) on delete restrict
);

create table public.research_question_evidence_links (
  question_id uuid not null,
  evidence_id uuid not null,
  case_id uuid not null,
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (question_id, evidence_id),
  constraint research_question_evidence_question_fkey foreign key (question_id, case_id)
    references public.research_questions(id, case_id) on delete cascade,
  constraint research_question_evidence_evidence_fkey foreign key (evidence_id, case_id)
    references public.research_evidence_items(id, case_id) on delete cascade
);

create index research_questions_case_status_created_idx on public.research_questions(case_id, status, created_at desc);
create index research_question_sources_question_idx on public.research_question_sources(question_id, created_at);
create index research_question_entries_question_kind_idx on public.research_question_entries(question_id, entry_kind, created_at);
create index research_evidence_items_case_created_idx on public.research_evidence_items(case_id, created_at desc);
create index research_evidence_sources_evidence_idx on public.research_evidence_sources(evidence_id, created_at);
create index research_evidence_facts_evidence_idx on public.research_evidence_facts(evidence_id, created_at);
create index research_question_evidence_evidence_idx on public.research_question_evidence_links(evidence_id, question_id);

alter table public.research_questions enable row level security;
alter table public.research_evidence_items enable row level security;
alter table public.research_question_sources enable row level security;
alter table public.research_question_entries enable row level security;
alter table public.research_evidence_sources enable row level security;
alter table public.research_evidence_facts enable row level security;
alter table public.research_question_evidence_links enable row level security;

create policy research_questions_select on public.research_questions for select to authenticated using (private.can_access_case(case_id));
create policy research_questions_insert on public.research_questions for insert to authenticated with check (private.can_contribute_case(case_id) and created_by_user_id = (select auth.uid()));
create policy research_questions_update on public.research_questions for update to authenticated using (private.can_contribute_case(case_id)) with check (private.can_contribute_case(case_id));
create policy research_evidence_items_select on public.research_evidence_items for select to authenticated using (private.can_access_case(case_id));
create policy research_evidence_items_insert on public.research_evidence_items for insert to authenticated with check (private.can_contribute_case(case_id) and created_by_user_id = (select auth.uid()));

create policy research_question_sources_select on public.research_question_sources for select to authenticated using (private.can_access_case(case_id));
create policy research_question_sources_insert on public.research_question_sources for insert to authenticated with check (private.can_contribute_case(case_id) and created_by_user_id = (select auth.uid()));
create policy research_question_entries_select on public.research_question_entries for select to authenticated using (private.can_access_case(case_id));
create policy research_question_entries_insert on public.research_question_entries for insert to authenticated with check (private.can_contribute_case(case_id) and created_by_user_id = (select auth.uid()));
create policy research_evidence_sources_select on public.research_evidence_sources for select to authenticated using (private.can_access_case(case_id));
create policy research_evidence_sources_insert on public.research_evidence_sources for insert to authenticated with check (private.can_contribute_case(case_id) and created_by_user_id = (select auth.uid()));
create policy research_evidence_facts_select on public.research_evidence_facts for select to authenticated using (private.can_access_case(case_id));
create policy research_evidence_facts_insert on public.research_evidence_facts for insert to authenticated with check (private.can_contribute_case(case_id) and created_by_user_id = (select auth.uid()));
create policy research_question_evidence_links_select on public.research_question_evidence_links for select to authenticated using (private.can_access_case(case_id));
create policy research_question_evidence_links_insert on public.research_question_evidence_links for insert to authenticated with check (private.can_contribute_case(case_id) and created_by_user_id = (select auth.uid()));

revoke all on table public.research_questions, public.research_evidence_items, public.research_question_sources,
  public.research_question_entries, public.research_evidence_sources, public.research_evidence_facts,
  public.research_question_evidence_links from anon, authenticated;
grant select, insert on table public.research_questions, public.research_evidence_items, public.research_question_sources,
  public.research_question_entries, public.research_evidence_sources, public.research_evidence_facts,
  public.research_question_evidence_links to authenticated;
grant update (status, resolution, limitations, resolved_at) on table public.research_questions to authenticated;
