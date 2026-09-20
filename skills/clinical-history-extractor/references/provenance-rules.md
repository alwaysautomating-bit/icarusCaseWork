# Provenance rules

- `evidence[].seg` is the `segment_index` from the first-pass parse of the preserved transcript. The witness block's `segment_range` bounds every citation.
- `evidence[].span` must appear verbatim in that segment (whitespace, curly quotes, and zero-width characters are normalized; case is not).
- `raw` must appear in the cited segments (case-insensitive).
- A question and its answer are separate segments. When a fact is in counsel's question, cite the question's segment for the words and the answer's segment for the affirmation. Do not cite the answer's number for text that is in the question.
- The extraction file records `transcript_id`, `source_file`, `witness_block_id`, and `segment_range`, so any assertion can be opened in the Witness view.
- Relationships with `basis: explicit_language` require evidence.
- The validator is the gate: `pnpm medical:build` refuses to write projections when any span, raw text, segment range, id, or relationship endpoint fails.
