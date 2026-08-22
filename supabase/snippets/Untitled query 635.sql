SELECT COUNT(*) AS total_matching_segments
FROM source_segments ss
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
    );