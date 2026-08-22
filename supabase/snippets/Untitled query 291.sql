WITH patrick_hits AS (
  SELECT
    ss.id,
    ss.proceeding_id,
    ss.ordinal
  FROM source_segments ss
  JOIN proceeding_speakers ps
    ON ss.proceeding_speaker_id = ps.id
  WHERE ps.provider_label = 'Patrick Clancy'
    AND ss.exact_text ILIKE ANY (
      ARRAY[
        '%band%',
        '%resistance%',
        '%exercise%',
        '%tie%',
        '%tied%',
        '%knot%',
        '%knotted%',
        '%wrap%',
        '%wrapped%',
        '%neck%'
      ]
    )
)

SELECT
  p.title AS proceeding,
  ss.ordinal,
  ps.provider_label AS speaker,
  ss.exact_text,
  ss.timestamp_start_ms,
  ss.id AS segment_id,
  CASE
    WHEN ph.id IS NOT NULL THEN '<<< PATRICK MATCH >>>'
    ELSE ''
  END AS match
FROM patrick_hits hit
JOIN source_segments ss
  ON ss.proceeding_id = hit.proceeding_id
 AND ss.ordinal BETWEEN hit.ordinal - 4 AND hit.ordinal + 4
LEFT JOIN proceeding_speakers ps
  ON ss.proceeding_speaker_id = ps.id
LEFT JOIN proceedings p
  ON ss.proceeding_id = p.id
LEFT JOIN patrick_hits ph
  ON ss.id = ph.id
ORDER BY
  p.proceeding_date,
  hit.ordinal,
  ss.ordinal;
  