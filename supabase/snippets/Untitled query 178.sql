select
  ordinal,
  timestamp_start_ms,
  timestamp_end_ms,
  proceeding_speaker_id,
  exact_text,
  deep_link
from source_segments
where proceeding_id = '65580af1-a7ab-464a-8217-61c1e441a08c'
  and ordinal between 1240 and 1310
order by ordinal;