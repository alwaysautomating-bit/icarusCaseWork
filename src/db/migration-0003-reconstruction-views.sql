CREATE TYPE research_window AS ENUM ('all','ninety_days','thirty_days','incident_window');
ALTER TABLE cases ADD COLUMN incident_at timestamptz;
ALTER TABLE cases ADD COLUMN incident_window_start timestamptz;
ALTER TABLE cases ADD COLUMN incident_window_end timestamptz;
UPDATE cases SET incident_at='2023-01-24T00:00:00-05:00', incident_window_start='2023-01-24T18:00:00-05:00', incident_window_end='2023-01-25T06:00:00-05:00' WHERE id='11111111-1111-4111-8111-111111111111';
ALTER TABLE events ADD COLUMN uncertainty_note text NOT NULL DEFAULT '';
CREATE TABLE contradiction_dispositions (id uuid PRIMARY KEY, contradiction_id uuid NOT NULL UNIQUE REFERENCES contradictions(id), disposition contradiction_status NOT NULL, rationale text NOT NULL, evidence_claim_id uuid REFERENCES claims(id), actor_id text NOT NULL, disposed_at timestamptz NOT NULL DEFAULT now(), CHECK(disposition <> 'unresolved'), CHECK(disposition = 'cancelled' OR evidence_claim_id IS NOT NULL));
CREATE TABLE saved_research_views (id uuid PRIMARY KEY, case_id uuid NOT NULL REFERENCES cases(id), name text NOT NULL, research_window research_window NOT NULL, include_unresolved boolean NOT NULL DEFAULT true, created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(case_id,name));
CREATE INDEX saved_view_case_idx ON saved_research_views(case_id);
