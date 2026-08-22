select
  table_name,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'case_members',
    'knowledge_items',
    'claims',
    'entity_mentions',
    'event_candidates',
    'temporal_assertions',
    'knowledge_relationships',
    'knowledge_flags',
    'case_ledger',
    'knowledge_item_segments',
    'claim_segments',
    'saved_timeline_view_versions',
    'saved_reconstruction_versions'
  )
order by table_name, ordinal_position;
