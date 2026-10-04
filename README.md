# KJV Scripture Evidence Explorer

A local-first web application for deterministic KJV concordance, verse similarity, exact phrase tracing, topic-to-Scripture vocabulary resolution, and inspectable evidence graphs.

## What makes it different

Ordinary search finds a word. This project makes the entire chain visible:

1. preserve the exact query and KJV text;
2. find exact words and phrases;
3. calculate shared-vocabulary similarity using a versioned formula;
4. distinguish rare, informative words from common grammatical words;
5. show every score component and matched token;
6. optionally bridge a non-KJV modern term through a cited dictionary sense;
7. let the reader evaluate the passages in context.

The system does not use an LLM to choose or rank verses.

## Read before building

1. `AGENTS.md` — permanent rules for coding agents
2. `docs/PRODUCT_SPEC.md` — scope and user experience
3. `docs/CORPUS_AND_NORMALIZATION.md` — text provenance and token layers
4. `docs/SCORING_SPEC.md` — candidate generation and ranking
5. `docs/ARCHITECTURE.md` — components and data flow
6. `docs/DATA_AND_API.md` — database and endpoint contracts
7. `docs/TEST_PLAN.md` — reproducibility and acceptance tests
8. `docs/ROADMAP.md` — implementation order
9. `docs/DECISIONS.md` — decisions that must remain explicit

## Recommended stack

- Next.js App Router with TypeScript
- PostgreSQL for production and local development
- Drizzle ORM or direct SQL migrations
- Zod for input and response validation
- Vitest for unit and golden tests
- Playwright for browser acceptance tests
- Cytoscape.js for the evidence graph
- Docker Compose for a reproducible local database

These are defaults, not licenses to weaken the specifications. Record substitutions in `docs/DECISIONS.md`.

## Initial milestone

The first usable release accepts a KJV reference or phrase and returns:

- the exact verse in context;
- exact word and phrase occurrences;
- ranked related verses;
- component-by-component score explanations;
- first and last occurrences of selected terms;
- a table and graph view of evidence;
- a downloadable JSON research record.

Topic expansion and generated prose come after the local deterministic engine is verified.

## Current project state

The repository now contains the first executable engine skeleton:

- canonical 66-book reference parsing and stable ordering;
- a versioned Unicode-aware tokenizer with exact offsets;
- corpus-manifest validation and SHA-256 helpers;
- a versioned JSON Schema for corpus manifests;
- draft version 1.0.0 scoring primitives with explanations and tie-breaking;
- a dependency-free CLI for reference and token inspection;
- unit tests covering normal, boundary, and failure cases.

Run the checks with `npm test` once the host package-manager permission issue is resolved, or directly with:

```text
node --experimental-strip-types --test packages/corpus/test/reference.test.ts packages/corpus/test/tokenizer.test.ts packages/search/test/scoring.test.ts
```

Try the CLI directly:

```text
node --experimental-strip-types apps/cli/src/index.ts reference "Isaiah 34:15-17"
node --experimental-strip-types apps/cli/src/index.ts tokenize "Seek ye out of the book"
```

ADR-001 is approved: the project uses Bible Protector's first-party Pure Cambridge Edition plain-text archive. The pinned local source and checksums are documented in `data/source/README.md`.

## Phase 0 corpus import

Phase 0 is complete. Reproduce the canonical corpus artifacts with:

```text
npm run import:corpus
```

The command verifies the pinned archive and member checksums, imports exactly 31,102 verses, validates canonical sequence and counts, preserves italic spans, separates paratext, and writes a manifest, anomaly report, and canonical JSONL artifact under `data/derived/KJV-PCE-BP-2010-v1/`.

See `docs/PHASE_0_REPORT.md` for the completed audit.

## Phase 1 search engine

Phase 1 is complete. The local CLI now supports corpus statistics, exact word search, exact phrase search, full term distribution, and explained related-verse ranking:

```text
npm run index:corpus
npm run cli -- exact gathered --limit 20
npm run cli -- phrase "in the beginning" --limit 20
npm run cli -- term gathered
npm run cli -- related "Isaiah 34:16" --limit 20
```

The accepted algorithm is version `1.0.0`; its ten reviewed golden queries are stored in `tests/golden/phase1-related.json`. See `docs/PHASE_1_REPORT.md` for details. The active work is now Phase 2: the Next.js application, repository layer, APIs, and browser parity tests.

## Source and licensing checkpoints

Use a KJV source that is lawful for the intended jurisdiction and record its exact edition, source URL, retrieval date, checksum, and any territorial restrictions. Do not assume “public domain” has identical meaning in every country. Candidate sources and supporting references are listed in `docs/CORPUS_AND_NORMALIZATION.md`.

