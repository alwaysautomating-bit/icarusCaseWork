SELECT
    ps.canonical_name,
    ps.provider_label,
    ps.role,
    ss.ordinal,
    ss.exact_text,
    ss.timestamp_start_ms,
    ss.deep_link,
    p.title AS proceeding
FROM source_segments ss
LEFT JOIN proceeding_speakers ps
    ON ss.proceeding_speaker_id = ps.id
LEFT JOIN proceedings p
    ON ss.proceeding_id = p.id
WHERE
    ss.exact_text ILIKE ANY (
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
ORDER BY p.proceeding_date, ss.ordinal;
