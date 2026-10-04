BEGIN;

CREATE TABLE cross_reference_sets (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  source_url TEXT NOT NULL,
  license TEXT NOT NULL,
  checksum CHAR(64) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  manifest_json JSONB NOT NULL,
  UNIQUE (name, version, checksum)
);

CREATE TABLE cross_references (
  set_id BIGINT NOT NULL REFERENCES cross_reference_sets(id) ON DELETE CASCADE,
  source_verse_id BIGINT NOT NULL REFERENCES verses(id),
  target_verse_id BIGINT NOT NULL REFERENCES verses(id),
  note TEXT,
  PRIMARY KEY (set_id, source_verse_id, target_verse_id),
  CHECK (source_verse_id <> target_verse_id)
);

CREATE INDEX cross_references_target_idx ON cross_references(set_id, target_verse_id, source_verse_id);

COMMIT;
