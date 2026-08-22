select
  ss.id,
  ss.proceeding_id,
  ss.ordinal,
  ss.timestamp_start_ms,
  ss.timestamp_end_ms,
  ss.proceeding_speaker_id,
  ss.exact_text,
  ss.deep_link
from source_segments ss
where
     ss.exact_text ilike '%hanging%'
  or ss.exact_text ilike '%kid%hang%'
  or ss.exact_text ilike '%child%hang%'
order by
  ss.proceeding_id,
  ss.ordinal;
