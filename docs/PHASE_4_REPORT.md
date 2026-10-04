# Phase 4 Completion Report

Date: 2026-10-04

## Outcome

Phase 4 adds an inspectable modern-topic resolver without allowing dictionary data to masquerade as Scripture evidence. Exact KJV lookup always runs first. If the topic is absent, no passage results can appear until the user explicitly selects a Princeton WordNet sense and then selects candidate words that actually occur in the KJV.

## Provider and provenance

- Provider: Princeton WordNet 3.0.
- Official archive: `https://wordnetcode.princeton.edu/3.0/WNdb-3.0.tar.gz`.
- Pinned SHA-256: `658b1ba191f5f98c2e9bae3e25c186013158f30ef779f191d2a44e5d25046dc8`.
- License: the WordNet 3.0 license embedded in the database files and published by Princeton.
- Runtime networking: none after `npm run import:wordnet`.
- Cache: immutable JSON headword snapshots under `data/derived/topic-cache/`, keyed by normalized-headword SHA-256.

Each snapshot records provider, provider version, source URL, retrieval time, license, headword, stable synset IDs, part of speech, definition, synonyms, and a deterministic payload checksum.

## Resolution contract

1. Search the KJV exactly. If present, return canonical matches and do not call WordNet.
2. For an absent topic, return all WordNet senses with no rankings.
3. Require `selectedSenseId`; reject IDs not present in the cached response.
4. Intersect only single-token synonyms with the KJV normalized vocabulary.
5. Require explicit `selectedCandidates`; reject unoffered words.
6. Run separate exact-word searches for each selected candidate.
7. Build a combined view with the winning candidate exposed on every row.

Every bridged result is labeled `external_synonym_bridge`. Definitions are external metadata, not biblical definitions. Candidate occurrence evidence receives a fixed exact-match value of `1`; no dictionary confidence is blended into algorithm `1.0.0`, and its verse-similarity rankings remain unchanged.

## Offline behavior

The provider reads only the imported local database and persistent cache. If the database is missing, exact KJV topic searches still work. Cached topic snapshots still work. An absent uncached topic returns `503` with a user-visible offline message.

## Verification

Unit tests cover exact-query bypass, mandatory sense selection, vocabulary intersection, mandatory candidate selection, separate/combined results, invalid selections, provider unavailability, WordNet row parsing, and research-record provenance. Browser tests cover the complete multi-stage topic journey and API status behavior. Existing golden rankings remain unchanged.
