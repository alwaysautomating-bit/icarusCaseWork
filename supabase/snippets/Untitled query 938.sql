SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    tablename ILIKE '%segment%'
    OR tablename ILIKE '%testimony%'
    OR tablename ILIKE '%proceed%'
  )
ORDER BY tablename, indexname;