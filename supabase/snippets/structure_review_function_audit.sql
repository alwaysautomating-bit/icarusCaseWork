select
  n.nspname as schema_name,
  p.proname,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where
  (n.nspname = 'private' and p.proname in ('append_case_ledger', 'can_access_case', 'is_case_owner'))
  or (n.nspname = 'public' and p.proname = 'review_extraction_candidate')
order by schema_name, p.proname;
