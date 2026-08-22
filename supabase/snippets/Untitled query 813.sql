SELECT DISTINCT
  canonical_name,
  provider_label,
  role
FROM proceeding_speakers
WHERE
  canonical_name ILIKE '%Patrick%'
  OR provider_label ILIKE '%Patrick%';