# Data Model and API Contract

## Core relational model

```sql
corpus_versions(
  id, name, source_url, retrieved_at, source_sha256,
  canonical_sha256, importer_version, manifest_json, created_at
)

books(id, canonical_order, osis_code, name, testament)
verses(id, corpus_version_id, book_id, chapter, verse, display_text)
tokens(id, verse_id, position, char_start, char_end, surface, folded)
normalized_tokens(token_id, normalized, rule_id)
normalization_rules(id, version, kind, source, description)
token_statistics(corpus_version_id, normalized, document_frequency, total_frequency, idf)

cross_reference_sets(id, name, version, source, license, checksum)
cross_references(set_id, source_verse_id, target_verse_id, note)

definition_snapshots(
  id, provider, source_url, retrieved_at, license,
  headword, part_of_speech, sense_id, definition, payload_sha256
)
definition_candidates(snapshot_id, candidate, folded, occurs_in_corpus, frequency)

algorithm_versions(id, version, config_json, config_sha256, created_at)
```

Add uniqueness constraints for canonical references per corpus and token positions per verse. Index reference fields, folded/normalized tokens, phrase-supporting token sequences, and both directions of cross-reference pairs. PostgreSQL full-text facilities may accelerate candidates, but final ranking must use the project formula. See [PostgreSQL text-search controls](https://www.postgresql.org/docs/current/textsearch-controls.html).

## API conventions

- Prefix MVP endpoints with `/api/v1`.
- Validate request and response schemas.
- Use canonical OSIS-like IDs internally and familiar KJV labels for display.
- Return `400` for invalid syntax, `404` for unknown canonical references, `409` for corpus/config mismatch, `422` when a topic needs sense selection, and `503` when optional external lookup is unavailable.
- Pagination and limits must be explicit.

## Endpoints

### `GET /api/v1/passages/{reference}`

Returns exact text, canonical IDs, requested range, and optional context window.

### `GET /api/v1/search/exact?q=...&mode=word|phrase`

Returns exact surface matches in canonical order with offsets and counts.

### `POST /api/v1/search/related`

Request:

```json
{
  "reference": "John 3:16",
  "limit": 50,
  "filters": {},
  "algorithmVersion": "1.0.0"
}
```

Returns ranked result explanations matching `SCORING_SPEC.md`.

### `POST /api/v1/compare`

Accepts two to ten references and returns exact/normalized commonality, phrase spans, unique terms, and pairwise scores.

### `GET /api/v1/terms/{term}/distribution`

Returns exact and selected normalized counts, first/last mentions, and book distribution.

### `POST /api/v1/topics/resolve`

Returns exact KJV status first. If the topic is absent, the endpoint returns cached Princeton WordNet senses with provider, version, URL, retrieval date, license, and snapshot checksum. No expansion occurs until `selectedSenseId` is supplied. The selected sense is intersected with the KJV vocabulary, after which the user must submit `selectedCandidates` before any passages are returned.

Resolved responses contain a separate exact-word result set for every candidate and a labeled combined view. Every result carries an `external_synonym_bridge` record with the original topic, selected sense, candidate term, and provider provenance. Dictionary confidence is not a Scripture score. Invalid sense/candidate selections return `422`; missing uncached dictionary data returns `503`.

### `POST /api/v1/graphs/evidence`

Builds a bounded graph from a canonical verse reference. Nodes are passages or normalized evidence terms. Every typed edge has an `explanationId`, and `tableRows` contains exactly one accessible row per edge. Bounds are explicit: `resultLimit` 1–50, `termLimit` 0–25, and `nodeLimit` 2–100.

### `POST /api/v1/workflows`

Runs one deterministic workflow selected by `type`: `gather_mentions`, `candidate_mates`, `divide_term`, `first_mention_chain`, or `lexical_witnesses`. Gather and chain operations use exact KJV occurrences in canonical order. Candidate mates reuse the accepted ranking. Divide-term groups only observed book contexts. Lexical witnesses are selected from distinct canonical books and are labeled as a heuristic rather than doctrinal independence.

### `POST /api/v1/exports/research-record`

Returns a portable JSON record containing the query, corpus/config identifiers, external provenance if any, results, and explanations.

## Common response metadata

```json
{
  "meta": {
    "corpusVersion": "...",
    "algorithmVersion": "...",
    "configurationSha256": "...",
    "queryTrace": [],
    "generatedAt": "..."
  },
  "data": {}
}
```

`generatedAt` does not affect ordering or reproducibility.

