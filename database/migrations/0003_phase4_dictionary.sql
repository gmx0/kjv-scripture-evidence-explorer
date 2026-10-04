BEGIN;

CREATE TABLE definition_snapshots (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_version TEXT NOT NULL,
  source_url TEXT NOT NULL,
  retrieved_at TIMESTAMPTZ NOT NULL,
  license TEXT NOT NULL,
  headword TEXT NOT NULL,
  part_of_speech TEXT NOT NULL,
  sense_id TEXT NOT NULL,
  definition TEXT NOT NULL,
  payload_sha256 CHAR(64) NOT NULL,
  selected BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (provider, provider_version, headword, sense_id, payload_sha256)
);

CREATE TABLE definition_candidates (
  snapshot_id BIGINT NOT NULL REFERENCES definition_snapshots(id) ON DELETE CASCADE,
  candidate TEXT NOT NULL,
  normalized TEXT NOT NULL,
  occurs_in_corpus BOOLEAN NOT NULL,
  verse_frequency INTEGER NOT NULL CHECK (verse_frequency >= 0),
  total_frequency INTEGER NOT NULL CHECK (total_frequency >= verse_frequency),
  selected BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (snapshot_id, normalized)
);

CREATE INDEX definition_snapshots_headword_idx ON definition_snapshots(provider, provider_version, headword);

COMMIT;
