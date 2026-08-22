select
  table_schema,
  table_name,
  column_name,
  data_type
from information_schema.columns
where
  table_name ilike '%segment%'
  or table_name ilike '%testimony%'
  or table_name ilike '%transcript%'
  or table_name ilike '%proceeding%'
  or table_name ilike '%speaker%'
order by table_schema, table_name, ordinal_position;