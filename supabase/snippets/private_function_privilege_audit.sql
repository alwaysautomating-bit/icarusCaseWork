select
  n.nspname as schema_name,
  p.proname,
  pg_get_function_identity_arguments(p.oid) as arguments,
  has_schema_privilege('authenticated', n.oid, 'usage') as authenticated_schema_usage,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute,
  has_function_privilege('anon', p.oid, 'execute') as anon_execute,
  has_function_privilege('public', p.oid, 'execute') as public_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private'
order by p.proname, arguments;
