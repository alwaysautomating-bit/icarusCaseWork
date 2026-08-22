SELECT COUNT(*) AS patrick_matching_segments
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
);
