SELECT
  id,
  title,
  proceeding_date,
  source_url
FROM proceedings
WHERE title ILIKE '%Day 3%'
ORDER BY proceeding_date;