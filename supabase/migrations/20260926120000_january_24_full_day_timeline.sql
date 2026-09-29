-- January 24 becomes the full-day core chronology. Only rows still carrying the
-- original seeded wording are updated, so any researcher edits are preserved.
update public.core_timelines
set subtitle = 'Full day · core chronology',
    description = 'Whole-day chronology for January 24. Digital, documentary and testimonial records are projected from their own source views; conflicting accounts stay side by side.',
    updated_at = now()
where slug = 'january-24'
  and subtitle = 'Event reconstruction';
