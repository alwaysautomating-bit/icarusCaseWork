alter table public.source_segments
  add column search_vector tsvector generated always as (
    setweight(to_tsvector('english'::regconfig, coalesce(exact_text, '')), 'A')
  ) stored;

create index source_segments_search_vector_gin
  on public.source_segments using gin(search_vector);

create function public.search_testimony(
  p_case_id uuid,
  p_search_text text,
  p_result_limit integer default 25,
  p_result_offset integer default 0,
  p_context_size integer default 3
)
returns table (
  source_segment_id uuid,
  case_id uuid,
  proceeding_id uuid,
  proceeding_title text,
  proceeding_date date,
  speaker text,
  timestamp_start_ms bigint,
  timestamp_end_ms bigint,
  exact_text text,
  snippet text,
  relevance real,
  ordinal integer,
  locator jsonb,
  artifact_id uuid,
  artifact_title text,
  source_url text,
  canonical_url text,
  deep_link text,
  context_before jsonb,
  context_after jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  with search_query as (
    select websearch_to_tsquery(
      'english'::regconfig,
      left(coalesce(p_search_text, ''), 500)
    ) as query
  ), ranked as (
    select
      segment.id as source_segment_id,
      segment.case_id,
      segment.proceeding_id,
      coalesce(proceeding.title, artifact.title, 'Source segment') as proceeding_title,
      proceeding.proceeding_date,
      coalesce(proceeding_speaker.canonical_name, proceeding_speaker.provider_label, 'Unidentified speaker') as speaker,
      segment.timestamp_start_ms,
      segment.timestamp_end_ms,
      segment.exact_text,
      ts_headline(
        'english'::regconfig,
        segment.exact_text,
        search_query.query,
        'StartSel=⟦, StopSel=⟧, MaxWords=45, MinWords=12, MaxFragments=2, FragmentDelimiter= … '
      ) as snippet,
      ts_rank_cd(segment.search_vector, search_query.query, 32) as relevance,
      segment.ordinal,
      segment.locator,
      segment.artifact_id,
      artifact.title as artifact_title,
      artifact.source_url,
      artifact.canonical_url,
      segment.deep_link
    from public.source_segments as segment
    cross join search_query
    left join public.proceedings as proceeding on proceeding.id = segment.proceeding_id
    left join public.proceeding_speakers as proceeding_speaker on proceeding_speaker.id = segment.proceeding_speaker_id
    join public.source_artifacts as artifact on artifact.id = segment.artifact_id
    where segment.case_id = p_case_id
      and private.can_access_case(p_case_id)
      and segment.search_vector @@ search_query.query
    order by relevance desc, segment.ordinal, segment.id
    limit least(greatest(coalesce(p_result_limit, 25), 1), 100)
    offset greatest(coalesce(p_result_offset, 0), 0)
  )
  select
    ranked.source_segment_id,
    ranked.case_id,
    ranked.proceeding_id,
    ranked.proceeding_title,
    ranked.proceeding_date,
    ranked.speaker,
    ranked.timestamp_start_ms,
    ranked.timestamp_end_ms,
    ranked.exact_text,
    ranked.snippet,
    ranked.relevance,
    ranked.ordinal,
    ranked.locator,
    ranked.artifact_id,
    ranked.artifact_title,
    ranked.source_url,
    ranked.canonical_url,
    ranked.deep_link,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'source_segment_id', neighbor.id,
          'ordinal', neighbor.ordinal,
          'speaker', coalesce(neighbor_speaker.canonical_name, neighbor_speaker.provider_label, 'Unidentified speaker'),
          'timestamp_start_ms', neighbor.timestamp_start_ms,
          'exact_text', neighbor.exact_text,
          'locator', neighbor.locator,
          'deep_link', neighbor.deep_link
        ) order by neighbor.ordinal
      )
      from public.source_segments as neighbor
      left join public.proceeding_speakers as neighbor_speaker on neighbor_speaker.id = neighbor.proceeding_speaker_id
      where neighbor.artifact_id = ranked.artifact_id
        and neighbor.ordinal >= ranked.ordinal - least(greatest(coalesce(p_context_size, 3), 0), 10)
        and neighbor.ordinal < ranked.ordinal
    ), '[]'::jsonb) as context_before,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'source_segment_id', neighbor.id,
          'ordinal', neighbor.ordinal,
          'speaker', coalesce(neighbor_speaker.canonical_name, neighbor_speaker.provider_label, 'Unidentified speaker'),
          'timestamp_start_ms', neighbor.timestamp_start_ms,
          'exact_text', neighbor.exact_text,
          'locator', neighbor.locator,
          'deep_link', neighbor.deep_link
        ) order by neighbor.ordinal
      )
      from public.source_segments as neighbor
      left join public.proceeding_speakers as neighbor_speaker on neighbor_speaker.id = neighbor.proceeding_speaker_id
      where neighbor.artifact_id = ranked.artifact_id
        and neighbor.ordinal > ranked.ordinal
        and neighbor.ordinal <= ranked.ordinal + least(greatest(coalesce(p_context_size, 3), 0), 10)
    ), '[]'::jsonb) as context_after
  from ranked
  order by ranked.relevance desc, ranked.ordinal, ranked.source_segment_id;
$$;

comment on column public.source_segments.exact_text is
  'Canonical byte-preserving transcript/source text searched by Casework full-text and fragment retrieval.';

comment on column public.source_segments.search_vector is
  'Stored English tsvector derived only from canonical source_segments.exact_text.';

comment on function public.search_testimony(uuid, text, integer, integer, integer) is
  'RLS-aware ranked full-text search over canonical source segments with provenance and surrounding context.';

revoke all on function public.search_testimony(uuid, text, integer, integer, integer) from public, anon;
grant execute on function public.search_testimony(uuid, text, integer, integer, integer) to authenticated;
