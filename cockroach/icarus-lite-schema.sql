CREATE SCHEMA IF NOT EXISTS lite;

CREATE TABLE IF NOT EXISTS lite.proceedings (
  id UUID PRIMARY KEY,
  case_id UUID NOT NULL,
  case_title STRING NOT NULL,
  source_id UUID NOT NULL,
  source_title STRING NOT NULL,
  source_lineage_id UUID NOT NULL,
  source_lineage_key STRING NOT NULL,
  source_artifact_id UUID NOT NULL,
  source_artifact_title STRING NOT NULL,
  source_artifact_sha256 STRING NOT NULL CHECK (length(source_artifact_sha256) = 64),
  source_artifact_filename STRING,
  source_url STRING,
  canonical_url STRING,
  title STRING NOT NULL,
  proceeding_date DATE,
  status STRING NOT NULL
);

CREATE TABLE IF NOT EXISTS lite.witnesses (
  id UUID PRIMARY KEY,
  proceeding_id UUID NOT NULL REFERENCES lite.proceedings (id) ON DELETE CASCADE,
  object_code STRING NOT NULL,
  witness_label_raw STRING NOT NULL,
  resolved_entity_id UUID,
  resolution_status STRING NOT NULL,
  resolution_basis STRING,
  review_status STRING NOT NULL,
  boundary_confidence DECIMAL(5, 4) NOT NULL,
  start_segment_id UUID NOT NULL,
  end_segment_id UUID NOT NULL,
  start_timestamp_ms INT8,
  end_timestamp_ms INT8,
  logical_order INT8 NOT NULL,
  UNIQUE (proceeding_id, object_code)
);

CREATE TABLE IF NOT EXISTS lite.speakers (
  id UUID PRIMARY KEY,
  proceeding_id UUID NOT NULL REFERENCES lite.proceedings (id) ON DELETE CASCADE,
  provider_label STRING NOT NULL,
  canonical_name STRING,
  role STRING,
  review_required BOOL NOT NULL,
  UNIQUE (proceeding_id, provider_label)
);

CREATE TABLE IF NOT EXISTS lite.segments (
  id UUID PRIMARY KEY,
  proceeding_id UUID NOT NULL REFERENCES lite.proceedings (id) ON DELETE CASCADE,
  witness_id UUID NOT NULL REFERENCES lite.witnesses (id) ON DELETE CASCADE,
  speaker_id UUID REFERENCES lite.speakers (id) ON DELETE SET NULL,
  speaker_label STRING NOT NULL,
  witness_ordinal INT4 NOT NULL,
  source_ordinal INT4 NOT NULL,
  exact_text STRING NOT NULL,
  text_sha256 STRING NOT NULL CHECK (length(text_sha256) = 64),
  timestamp_start_ms INT8,
  timestamp_end_ms INT8,
  deep_link STRING,
  locator JSONB NOT NULL,
  transcript_provider STRING,
  source_artifact_id UUID NOT NULL,
  source_artifact_sha256 STRING NOT NULL CHECK (length(source_artifact_sha256) = 64),
  UNIQUE (witness_id, witness_ordinal),
  UNIQUE (source_artifact_id, source_ordinal)
);

CREATE INDEX IF NOT EXISTS witnesses_proceeding_idx
  ON lite.witnesses (proceeding_id, logical_order);

CREATE INDEX IF NOT EXISTS segments_witness_read_idx
  ON lite.segments (witness_id, witness_ordinal)
  STORING (speaker_label, timestamp_start_ms, timestamp_end_ms);
