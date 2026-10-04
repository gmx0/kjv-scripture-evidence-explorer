BEGIN;

CREATE TABLE corpus_versions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE,
  source_url text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  source_sha256 char(64) NOT NULL,
  canonical_sha256 char(64) NOT NULL UNIQUE,
  importer_version text NOT NULL,
  manifest_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE books (
  id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  canonical_order smallint NOT NULL UNIQUE CHECK (canonical_order BETWEEN 1 AND 66),
  osis_code text NOT NULL UNIQUE,
  name text NOT NULL UNIQUE,
  testament char(2) NOT NULL CHECK (testament IN ('OT', 'NT'))
);

CREATE TABLE verses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  corpus_version_id bigint NOT NULL REFERENCES corpus_versions(id),
  book_id smallint NOT NULL REFERENCES books(id),
  chapter integer NOT NULL CHECK (chapter > 0),
  verse integer NOT NULL CHECK (verse > 0),
  source_book_code text NOT NULL,
  display_text text NOT NULL CHECK (display_text <> ''),
  italics_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  paratext_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (corpus_version_id, book_id, chapter, verse)
);

CREATE TABLE tokens (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  verse_id bigint NOT NULL REFERENCES verses(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position >= 0),
  char_start integer NOT NULL CHECK (char_start >= 0),
  char_end integer NOT NULL CHECK (char_end >= char_start),
  surface text NOT NULL,
  folded text NOT NULL,
  UNIQUE (verse_id, position)
);

CREATE TABLE normalization_rules (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  version text NOT NULL,
  kind text NOT NULL,
  source text NOT NULL,
  description text NOT NULL,
  UNIQUE (version, kind, source)
);

CREATE TABLE normalized_tokens (
  token_id bigint NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  normalized text NOT NULL,
  rule_id bigint REFERENCES normalization_rules(id),
  PRIMARY KEY (token_id, normalized)
);

CREATE TABLE token_statistics (
  corpus_version_id bigint NOT NULL REFERENCES corpus_versions(id) ON DELETE CASCADE,
  normalized text NOT NULL,
  document_frequency integer NOT NULL CHECK (document_frequency >= 0),
  total_frequency integer NOT NULL CHECK (total_frequency >= document_frequency),
  idf double precision NOT NULL CHECK (idf >= 0),
  PRIMARY KEY (corpus_version_id, normalized)
);

CREATE TABLE algorithm_versions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  version text NOT NULL UNIQUE,
  config_json jsonb NOT NULL,
  config_sha256 char(64) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX verses_reference_idx ON verses (corpus_version_id, book_id, chapter, verse);
CREATE INDEX tokens_folded_idx ON tokens (folded, verse_id, position);
CREATE INDEX normalized_tokens_lookup_idx ON normalized_tokens (normalized, token_id);

COMMIT;
