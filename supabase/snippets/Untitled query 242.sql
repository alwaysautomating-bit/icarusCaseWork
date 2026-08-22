SELECT
  id,
  title,
  proceeding_date,
  committed_segments
FROM proceedings
WHERE
  title ILIKE '%Opening%'
  OR title ILIKE '%Day 2%'
  OR title ILIKE '%Day 3%'
  OR title ILIKE '%Day 4%'
ORDER BY proceeding_date, title;