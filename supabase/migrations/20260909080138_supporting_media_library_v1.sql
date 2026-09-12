create table public.supporting_media_folders (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint supporting_media_folders_id_case_key unique (id, case_id)
);

create unique index supporting_media_folders_case_name_key
  on public.supporting_media_folders (case_id, lower(trim(name)));

create table public.supporting_media_items (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  folder_id uuid,
  original_filename text not null check (char_length(trim(original_filename)) between 1 and 255),
  media_type text not null check (media_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif')),
  byte_length bigint not null check (byte_length > 0 and byte_length <= 20971520),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  object_key text not null unique,
  caption text not null default '' check (char_length(caption) <= 240),
  context_note text not null default '' check (char_length(context_note) <= 2000),
  record_role text not null default 'supporting_reference' check (record_role = 'supporting_reference'),
  is_canonical boolean not null default false check (not is_canonical),
  uploaded_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint supporting_media_items_folder_case_fkey
    foreign key (folder_id, case_id)
    references public.supporting_media_folders(id, case_id)
    on delete set null (folder_id),
  constraint supporting_media_items_case_object_key_check
    check (object_key like case_id::text || '/%')
);

create index supporting_media_folders_case_created_idx
  on public.supporting_media_folders (case_id, created_at, id);
create index supporting_media_items_case_folder_created_idx
  on public.supporting_media_items (case_id, folder_id, created_at desc, id);

alter table public.supporting_media_folders enable row level security;
alter table public.supporting_media_items enable row level security;

create policy supporting_media_folders_select
  on public.supporting_media_folders
  for select to authenticated
  using (private.can_access_case(case_id));

create policy supporting_media_folders_insert
  on public.supporting_media_folders
  for insert to authenticated
  with check (
    private.can_contribute_case(case_id)
    and created_by_user_id = (select auth.uid())
  );

create policy supporting_media_items_select
  on public.supporting_media_items
  for select to authenticated
  using (private.can_access_case(case_id));

create policy supporting_media_items_insert
  on public.supporting_media_items
  for insert to authenticated
  with check (
    private.can_contribute_case(case_id)
    and uploaded_by_user_id = (select auth.uid())
  );

create policy supporting_media_items_update
  on public.supporting_media_items
  for update to authenticated
  using (private.can_contribute_case(case_id))
  with check (private.can_contribute_case(case_id));

revoke all on table public.supporting_media_folders from anon, authenticated;
revoke all on table public.supporting_media_items from anon, authenticated;

grant select, insert on table public.supporting_media_folders to authenticated;
grant select, insert on table public.supporting_media_items to authenticated;
grant update (folder_id, caption, context_note) on table public.supporting_media_items to authenticated;
