select
  p.title as proceeding,
  ss.ordinal,
  coalesce(ps.canonical_name, ps.provider_label, 'Unknown') as speaker,
  ss.exact_text
from source_segments ss
join proceedings p
  on p.id = ss.proceeding_id
left join proceeding_speakers ps
  on ps.id = ss.proceeding_speaker_id
where
  ss.exact_text ilike any (array[
    '%hanging%',
    '%kid hanging%',
    '%child hanging%',
    '%hanging in the basement%',
    '%get inside%',
    '%basement%'
  ])
order by
  p.title,
  ss.ordinal;
