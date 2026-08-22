create extension if not exists pg_trgm with schema extensions;

create index source_segments_exact_text_trgm_gin
  on public.source_segments using gin(exact_text extensions.gin_trgm_ops);

drop function public.search_testimony(uuid, text, integer, integer, integer);

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
  match_method text,
  relevance real,
  fts_relevance real,
  trigram_relevance real,
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
set pg_trgm.word_similarity_threshold = 0.45
as $$
  with search_input as (
    select
      websearch_to_tsquery('english'::regconfig, left(coalesce(p_search_text, ''), 500)) as query,
      left(trim(both '"' from btrim(coalesce(p_search_text, ''))), 500) as literal
  ), candidate_matches as (
    select
      segment.id as source_segment_id,
      ts_rank_cd(segment.search_vector, search_input.query, 32) as fts_relevance,
      0::real as trigram_relevance,
      'fts'::text as match_method
    from public.source_segments as segment
    cross join search_input
    where segment.case_id = p_case_id
      and private.can_access_case(p_case_id)
      and segment.search_vector @@ search_input.query

    union all

    select
      segment.id,
      0::real,
      extensions.word_similarity(search_input.literal, segment.exact_text),
      'trigram'::text
    from public.source_segments as segment
    cross join search_input
    where segment.case_id = p_case_id
      and private.can_access_case(p_case_id)
      and length(search_input.literal) >= 3
      and search_input.literal operator(extensions.<%) segment.exact_text
  ), combined_matches as (
    select
      candidate_matches.source_segment_id,
      max(candidate_matches.fts_relevance)::real as fts_relevance,
      max(candidate_matches.trigram_relevance)::real as trigram_relevance,
      case
        when bool_or(candidate_matches.match_method = 'fts') and bool_or(candidate_matches.match_method = 'trigram') then 'fts+trigram'
        when bool_or(candidate_matches.match_method = 'fts') then 'fts'
        else 'trigram'
      end as match_method
    from candidate_matches
    group by candidate_matches.source_segment_id
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
      case
        when combined_matches.fts_relevance > 0 then ts_headline(
          'english'::regconfig,
          segment.exact_text,
          search_input.query,
          'StartSel=⟦, StopSel=⟧, MaxWords=45, MinWords=12, MaxFragments=2, FragmentDelimiter= … '
        )
        else left(segment.exact_text, 600)
      end as snippet,
      combined_matches.match_method,
      greatest(combined_matches.fts_relevance, combined_matches.trigram_relevance * 0.5)::real as relevance,
      combined_matches.fts_relevance,
      combined_matches.trigram_relevance,
      segment.ordinal,
      segment.locator,
      segment.artifact_id,
      artifact.title as artifact_title,
      artifact.source_url,
      artifact.canonical_url,
      segment.deep_link
    from combined_matches
    cross join search_input
    join public.source_segments as segment on segment.id = combined_matches.source_segment_id
    left join public.proceedings as proceeding on proceeding.id = segment.proceeding_id
    left join public.proceeding_speakers as proceeding_speaker on proceeding_speaker.id = segment.proceeding_speaker_id
    join public.source_artifacts as artifact on artifact.id = segment.artifact_id
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
    ranked.match_method,
    ranked.relevance,
    ranked.fts_relevance,
    ranked.trigram_relevance,
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

comment on function public.search_testimony(uuid, text, integer, integer, integer) is
  'RLS-aware lexical testimony search combining canonical-text FTS and trigram fragment retrieval with provenance and context.';

revoke all on function public.search_testimony(uuid, text, integer, integer, integer) from public, anon;
grant execute on function public.search_testimony(uuid, text, integer, integer, integer) to authenticated;
