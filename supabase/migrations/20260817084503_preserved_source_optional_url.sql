-- Preserved artifacts can be complete and checksum-verifiable even when the
-- publisher URL was not retained in the export. Unknown provenance must stay
-- null instead of being replaced with a plausible URL.
alter table public.evidence_intakes
  alter column submitted_url drop not null,
  alter column canonical_url drop not null;

alter table public.source_artifacts
  alter column acquired_from drop not null,
  alter column source_url drop not null,
  alter column canonical_url drop not null;
