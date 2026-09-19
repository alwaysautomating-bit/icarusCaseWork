create table public.core_timelines (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  slug text not null check(slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check(char_length(btrim(title)) between 1 and 120),
  subtitle text not null default '' check(char_length(subtitle) <= 240),
  description text not null default '' check(char_length(description) <= 1200),
  sort_order integer not null default 0,
  is_core boolean not null default true,
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(case_id,slug),
  unique(id,case_id)
);

alter table public.events add constraint events_id_case_unique unique(id,case_id);
alter table public.event_candidates add constraint event_candidates_id_case_unique unique(id,case_id);

create table public.core_timeline_event_memberships (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  timeline_id uuid not null,
  event_id uuid,
  event_candidate_id uuid,
  section text not null default '' check(char_length(section) <= 100),
  category text not null default '' check(char_length(category) <= 100),
  display_order integer not null default 0,
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key(timeline_id,case_id) references public.core_timelines(id,case_id) on delete cascade,
  foreign key(event_id,case_id) references public.events(id,case_id) on delete cascade,
  foreign key(event_candidate_id,case_id) references public.event_candidates(id,case_id) on delete cascade,
  check((event_id is not null)::integer + (event_candidate_id is not null)::integer = 1),
  unique(timeline_id,event_id),
  unique(timeline_id,event_candidate_id)
);

create table public.timeline_placement_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  timeline_id uuid not null,
  description text not null check(char_length(btrim(description)) between 1 and 500),
  temporal_hint_json jsonb not null default '{"precision":"unknown"}'::jsonb check(jsonb_typeof(temporal_hint_json)='object'),
  source_hint text not null default '' check(char_length(source_hint) <= 500),
  relative_to_event_id uuid,
  relative_relation text check(relative_relation is null or relative_relation in ('before','after','between','near')),
  section text not null default '' check(char_length(section) <= 100),
  category text not null default '' check(char_length(category) <= 100),
  display_order integer not null default 0,
  note text not null default '' check(char_length(note) <= 2000),
  status text not null default 'needs_source' check(status in ('needs_source','converted','dismissed')),
  linked_event_id uuid,
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(timeline_id,case_id) references public.core_timelines(id,case_id) on delete cascade,
  foreign key(relative_to_event_id,case_id) references public.events(id,case_id) on delete restrict,
  foreign key(linked_event_id,case_id) references public.events(id,case_id) on delete restrict,
  check(status <> 'converted' or linked_event_id is not null)
);

create index core_timelines_case_order_idx on public.core_timelines(case_id,sort_order,created_at);
create index core_timeline_memberships_timeline_order_idx on public.core_timeline_event_memberships(timeline_id,display_order,created_at);
create index timeline_placement_notes_timeline_status_order_idx on public.timeline_placement_notes(timeline_id,status,display_order,created_at);

alter table public.core_timelines enable row level security;
alter table public.core_timeline_event_memberships enable row level security;
alter table public.timeline_placement_notes enable row level security;

create policy core_timelines_select on public.core_timelines for select to authenticated
  using(private.can_access_case(case_id));
create policy core_timelines_insert on public.core_timelines for insert to authenticated
  with check(private.can_contribute_case(case_id) and created_by_user_id=(select auth.uid()));
create policy core_timelines_update on public.core_timelines for update to authenticated
  using(private.can_contribute_case(case_id))
  with check(private.can_contribute_case(case_id));

create policy core_timeline_memberships_select on public.core_timeline_event_memberships for select to authenticated
  using(private.can_access_case(case_id));
create policy core_timeline_memberships_insert on public.core_timeline_event_memberships for insert to authenticated
  with check(private.can_contribute_case(case_id) and created_by_user_id=(select auth.uid()));
create policy core_timeline_memberships_update on public.core_timeline_event_memberships for update to authenticated
  using(private.can_contribute_case(case_id))
  with check(private.can_contribute_case(case_id));
create policy core_timeline_memberships_delete on public.core_timeline_event_memberships for delete to authenticated
  using(private.can_contribute_case(case_id));

create policy timeline_placement_notes_select on public.timeline_placement_notes for select to authenticated
  using(private.can_access_case(case_id));
create policy timeline_placement_notes_insert on public.timeline_placement_notes for insert to authenticated
  with check(private.can_contribute_case(case_id) and created_by_user_id=(select auth.uid()));
create policy timeline_placement_notes_update on public.timeline_placement_notes for update to authenticated
  using(private.can_contribute_case(case_id))
  with check(private.can_contribute_case(case_id));

grant select,insert,update on public.core_timelines to authenticated;
grant select,insert,update,delete on public.core_timeline_event_memberships to authenticated;
grant select,insert,update on public.timeline_placement_notes to authenticated;
grant all privileges on public.core_timelines,public.core_timeline_event_memberships,public.timeline_placement_notes to service_role;
revoke all on public.core_timelines,public.core_timeline_event_memberships,public.timeline_placement_notes from anon;

with clancy_cases as (
  select id,owner_user_id from public.cases where title ilike '%clancy%'
), timeline_templates(slug,title,subtitle,description,sort_order) as (
  values
    ('january-24','January 24','Event reconstruction','High-resolution reconstruction of the lead-up, emergency response, discovery, hospital and initial investigative activity.',10),
    ('lindsay-health','Lindsay Clancy','Health & care trajectory','Mental health, medication, sleep and function, care and providers, and physical health before and after January 24.',20),
    ('patrick-activity','Patrick Clancy','Activity trajectory','Activity, communications, care involvement, device evidence and the later evolution of Patrick Clancy''s accounts.',30)
)
insert into public.core_timelines(case_id,slug,title,subtitle,description,sort_order,created_by_user_id)
select clancy_cases.id,timeline_templates.slug,timeline_templates.title,timeline_templates.subtitle,timeline_templates.description,timeline_templates.sort_order,clancy_cases.owner_user_id
from clancy_cases cross join timeline_templates
on conflict(case_id,slug) do nothing;

with note_templates(timeline_slug,description,temporal_hint_json,source_hint,section,category,display_order,note) as (
  values
    ('january-24','Work-computer email sent','{"precision":"exact","date":"2023-01-24","time":"17:24","label":"5:24 PM"}'::jsonb,'work computer / digital evidence','Lead-up','Digital',10,'Confirm the sending account, device clock and exact source artifact.'),
    ('january-24','Patrick enters CVS','{"precision":"exact","date":"2023-01-24","time":"17:32:32","label":"5:32:32 PM"}'::jsonb,'CVS surveillance or transaction record','Lead-up','Patrick activity',20,''),
    ('january-24','Patrick exits CVS','{"precision":"exact","date":"2023-01-24","time":"17:37:08","label":"5:37:08 PM"}'::jsonb,'CVS surveillance or transaction record','Lead-up','Patrick activity',30,''),
    ('january-24','ThreeV pickup','{"precision":"exact","date":"2023-01-24","time":"17:54","label":"5:54 PM"}'::jsonb,'ThreeV record / surveillance','Lead-up','Patrick activity',40,''),
    ('january-24','Call placed to Lindsay''s phone','{"precision":"exact","date":"2023-01-24","time":"18:09","label":"6:09 PM"}'::jsonb,'phone extraction or carrier record','Lead-up','Communications',50,'Keep device record, subscriber association and physical-user attribution separate.'),
    ('january-24','911 and dispatch sequence begins','{"precision":"approximate","date":"2023-01-24","time":"18:11","label":"~6:11 PM"}'::jsonb,'911 audio / dispatch log','Emergency response','911',60,''),
    ('january-24','Hospital, scene security and first investigative activity','{"precision":"relative_only","label":"Later that evening"}'::jsonb,'hospital, police and scene records','After discovery','Investigation',80,'Do not compress independent activities into a single known event when sources are located.'),
    ('january-24','Initial search-warrant process','{"precision":"relative_only","label":"Later / early January 25"}'::jsonb,'warrant packet','Initial investigation','Warrants',90,'Affidavit allegations remain attributed claims unless independently confirmed.'),

    ('lindsay-health','Relevant symptoms, care and medication changes','{"precision":"interval","startDate":"2022-09-01","endDate":"2022-12-31","label":"Sept–Dec 2022"}'::jsonb,'medical records and clinician testimony','Pre-event','Mental health',10,''),
    ('lindsay-health','McLean hospitalization','{"precision":"interval","startDate":"2023-01-01","endDate":"2023-01-05","label":"Jan 1–5"}'::jsonb,'McLean records','Pre-event','Care / providers',20,'Locate diagnostic observations, sleep documentation, medications and discharge instructions.'),
    ('lindsay-health','Tufts visit and diazepam prescription','{"precision":"exact_date","date":"2023-01-09","label":"Jan 9"}'::jsonb,'Tufts medical record','Pre-event','Medication',30,''),
    ('lindsay-health','Medication or taper changes','{"precision":"exact_date","date":"2023-01-16","label":"Jan 16"}'::jsonb,'medical record / medication list','Pre-event','Medication',40,''),
    ('lindsay-health','Last documented pre-event care and medication state','{"precision":"exact_date","date":"2023-01-23","label":"Jan 23"}'::jsonb,'medical records','Pre-event','Medication',50,'Include amitriptyline only if the source and active medication state are confirmed.'),
    ('lindsay-health','Documented medication, physical and clinical state on January 24','{"precision":"exact_date","date":"2023-01-24","label":"Jan 24"}'::jsonb,'medical records / physical evidence','Event day','Physical health',60,''),
    ('lindsay-health','ICU course and physical stabilization','{"precision":"relative_only","label":"Post-event · ICU"}'::jsonb,'hospital records','Post-event','Physical health',70,'Separate sedation, intubation, consciousness and orientation observations by their actual documentation time.'),
    ('lindsay-health','Healthcare proxy changed to parents','{"precision":"exact_date","date":"2023-01-29","label":"Jan 29"}'::jsonb,'hospital or proxy record','Post-event','Care / providers',80,''),

    ('patrick-activity','Relevant device/search activity, communications and care involvement','{"precision":"interval","startDate":"2022-12-01","endDate":"2022-12-31","label":"Dec 2022"}'::jsonb,'device evidence, messages and care records','Lead-up','Digital',10,''),
    ('patrick-activity','Hospitalizations, appointments and medication involvement','{"precision":"interval","startDate":"2023-01-01","endDate":"2023-01-22","label":"Jan 2023"}'::jsonb,'medical records and communications','Lead-up','Care involvement',20,''),
    ('patrick-activity','Day-before activity','{"precision":"exact_date","date":"2023-01-23","label":"Jan 23"}'::jsonb,'device, testimony and documentary sources','Lead-up','Activity',30,''),
    ('patrick-activity','Work activity, CVS, ThreeV and return-home sequence','{"precision":"interval","startDate":"2023-01-24","endDate":"2023-01-24","label":"Jan 24 · 5:24–6:09 PM"}'::jsonb,'digital records, surveillance and Patrick accounts','January 24','Activity',40,'Link the shared underlying events rather than recreating them in this timeline.'),
    ('patrick-activity','911 and first-responder activity','{"precision":"relative_only","label":"Jan 24 · after return home"}'::jsonb,'911, dispatch and responder testimony','January 24','Emergency response',50,''),
    ('patrick-activity','Police statements and family communications','{"precision":"relative_only","label":"Jan 25 onward"}'::jsonb,'interviews and communications','After','Accounts',60,''),
    ('patrick-activity','Public accounts, including GoFundMe and New Yorker','{"precision":"unknown","label":"Later public accounts"}'::jsonb,'GoFundMe, New Yorker and related source captures','After','Public accounts',70,'Keep each publication as an overlay; do not silently merge them into Core.'),
    ('patrick-activity','Trial testimony','{"precision":"interval","startDate":"2026-01-01","endDate":"2026-12-31","label":"2026 trial"}'::jsonb,'trial transcript','After','Trial testimony',80,'Show testimony as an account overlay unless a discrete event is independently confirmed.')
)
insert into public.timeline_placement_notes(
  case_id,timeline_id,description,temporal_hint_json,source_hint,section,category,display_order,note,created_by_user_id
)
select timeline.case_id,timeline.id,template.description,template.temporal_hint_json,template.source_hint,template.section,template.category,template.display_order,template.note,timeline.created_by_user_id
from public.core_timelines timeline
join note_templates template on template.timeline_slug=timeline.slug
where timeline.is_core and not exists(
  select 1 from public.timeline_placement_notes note
  where note.timeline_id=timeline.id and note.description=template.description
);

with candidate_choices as (
  select candidate.*,
    row_number() over(partition by candidate.case_id,lower(candidate.neutral_description) order by candidate.logical_order) as duplicate_rank
  from public.event_candidates candidate
), membership_templates(timeline_slug,neutral_description,section,category,display_order) as (
  values
    ('january-24','Patrick Clancy went inside the house to check on the children.','Emergency response','Patrick activity',200),
    ('january-24','Hall heard dispatch relay that Patrick Clancy could not wake the children after Patrick entered the house.','Emergency response','Dispatch',210),
    ('january-24','Stephen Hall heard a loud scream from inside the house.','Emergency response','Responder account',220),
    ('january-24','Hall and Josephine ran through the slider and entered the house after hearing the scream.','Emergency response','Responder account',230),
    ('january-24','Hall and Josephine returned to the basement to look for other children.','Discovery','Responder account',240),
    ('january-24','Brian Josephine carried Dawson to the ambulance and placed him on the stretcher as it finished parking.','EMS activity','Responder account',250),
    ('january-24','Responders split into parallel care lanes for Lindsay, Dawson, Cora, and Callan.','EMS activity','Responder account',260),
    ('january-24','Responders removed Cora from the basement on a backboard through the bulkhead stairs.','EMS activity','Responder account',270),
    ('lindsay-health','Hall observed cuts to both of Lindsay Clancy''s wrists and the left side of her neck.','Event day','Physical health',200),
    ('lindsay-health','An examiner''s question stated that the patient was identified as hypothermic to 82.1°F; the witness recalled hypothermia from her documentation without independently affirming the exact temperature.','Post-event','Physical health',210),
    ('lindsay-health','The patient''s body temperature was described in the Q&A as having come up to 95.2°F.','Post-event','Physical health',220),
    ('lindsay-health','Maureen Hartnett responded to South Shore Hospital and collected samples from Lindsay Clancy''s hands.','Post-event','Physical evidence',230),
    ('lindsay-health','Maureen Hartnett collected swabbings from underneath Lindsay Clancy''s fingernails at Brigham and Women''s Hospital.','Post-event','Physical evidence',240),
    ('patrick-activity','Patrick Clancy went inside the house to check on the children.','January 24','Activity',200),
    ('patrick-activity','Josephine heard Patrick Clancy scream that she had killed the children.','January 24','Statements',210),
    ('patrick-activity','After hearing the scream, Hussey saw Patrick Clancy unwrapping something from Dawson''s head.','January 24','Activity',220),
    ('patrick-activity','Dwyer observed Cora and Callan on the floor and Patrick seated nearby in the left basement.','January 24','Responder observation',230)
)
insert into public.core_timeline_event_memberships(
  case_id,timeline_id,event_candidate_id,section,category,display_order,created_by_user_id
)
select timeline.case_id,timeline.id,candidate.id,template.section,template.category,template.display_order,timeline.created_by_user_id
from public.core_timelines timeline
join membership_templates template on template.timeline_slug=timeline.slug
join candidate_choices candidate on candidate.case_id=timeline.case_id
  and candidate.neutral_description=template.neutral_description and candidate.duplicate_rank=1
on conflict(timeline_id,event_candidate_id) do nothing;
