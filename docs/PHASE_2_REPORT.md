# Phase 2 Completion Report

Date: 2026-10-04

Status: complete

## Web MVP

- Next.js 16 App Router application with a responsive, keyboard-accessible concordance workbench.
- Passage and range display with bounded canonical context.
- Exact word and exact phrase results in canonical order with occurrence positions.
- Related-verse rankings with source text, total and component scores, evidence labels, shared tokens, phrase spans, rare-word frequencies, and the stable tie-break rule.
- Testament, book, minimum-score, and evidence-type filters.
- Two-to-ten-passage comparison with exact and normalized commonality, unique vocabulary, shared phrases, and pairwise scores.
- Term frequency, first mention, last mention, and book distribution API data.
- Downloadable JSON research records that replay the deterministic query rather than trusting client-supplied results.
- Visible notices separating exact KJV wording from normalized or interpretive claims.

## Versioned API

- `GET /api/v1/passages/{reference}`
- `GET /api/v1/search/exact`
- `POST /api/v1/search/related`
- `POST /api/v1/compare`
- `GET /api/v1/terms/{term}/distribution`
- `POST /api/v1/exports/research-record`

Requests are length- and limit-capped and validated with Zod. Invalid syntax returns `400`, unknown corpus references return `404`, and unavailable algorithm versions return `409`. Responses identify corpus version, canonical checksum, algorithm version, configuration checksum, query trace, and generation time.

## Repository layer

The server consumes a `CorpusRepository` interface. The default local adapter reads the audited canonical JSONL and manifest, validates the declared verse count, and feeds the same Phase 1 engine used by the CLI. The PostgreSQL adapter uses the same contract. `database/migrations/0001_phase2_core.sql` creates the versioned corpus, book, verse, token, normalization, statistics, and algorithm tables with canonical uniqueness and lookup indexes.

The selected corpus text and generated indexes remain uncommitted artifacts. A clean checkout reproduces them with `npm run import:corpus` and `npm run index:corpus`.

## Acceptance evidence

- Strict TypeScript check passes.
- Production Next.js build passes and emits all six `/api/v1` operations.
- The complete corpus, unit, scoring, service, and Phase 1 golden suites pass without a golden diff.
- Playwright Chromium tests pass for the actual study interface, validation status, context response, and research export.
- The browser’s first five results for `Genesis 1:1` exactly reproduce the accepted CLI fixture: John 1:1, Jeremiah 51:48, 2 Samuel 18:9, Genesis 1:17, and John 1:2.

## Known operational characteristic

Each local Next.js server process constructs the full 31,102-verse in-memory index once. Warm queries reuse that cached service. This preserves offline operation and exact CLI parity; ADR-008 leaves room for a database-backed startup optimization without changing ranking semantics.

## Phase 2 exit gate

The web interface and stable API expose the deterministic Phase 1 engine, every ranked result remains inspectable, JSON exports reproduce server-side queries, and browser acceptance tests match the CLI golden order. Phase 3 may begin.
