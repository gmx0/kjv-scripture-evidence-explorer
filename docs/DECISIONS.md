# Decision Log

Record consequential choices as short architecture decision records. Do not erase superseded decisions; mark them superseded and link the replacement.

## ADR template

```text
## ADR-NNN — Title
Status: proposed | accepted | superseded
Date: YYYY-MM-DD

Context
What forces or uncertainties require a decision?

Decision
What is being chosen?

Consequences
What becomes easier, harder, required, or excluded?

Evidence
Links, experiments, licenses, benchmarks, or review notes.
```

## Required initial decisions

### ADR-001 — KJV corpus edition and source

Status: accepted

Date: 2026-10-04

Context
The application needs one exact, stable KJV text because capitalization, spelling, punctuation, and italicized words are evidence. Project Gutenberg eBook 10 is complete and useful for validation, but it does not identify a precise editorial edition and differs from the Pure Cambridge Edition in known readings and formatting metadata.

Decision
Use Bible Protector's first-party **King James Bible: Pure Cambridge Edition: Text Format** archive at <https://bibleprotector.com/TEXT-PCE.zip>. Pin the downloaded archive and its sole `TEXT-PCE.txt` member by SHA-256. Treat Project Gutenberg eBook 10 only as a secondary comparison source.

The importer must decode the member as Windows-1252, require exactly 31,102 verse records and 66 known book prefixes, preserve the surface text, convert square-bracket italics into explicit span metadata, and store double-angle-bracket headings/subscriptions/end labels as separately typed paratext. It must never silently update from the live URL.

Consequences
The source is already line-oriented and deterministic, so no PDF, RTF, Word, EPUB, database, or OCR conversion is required. The project can preserve italics and punctuation precisely. The source archive contains no standalone license or changelog, so the source URL, retrieval date, publisher permission statement, archive/member checksums, and locally retained bytes are part of the corpus manifest. Distribution outside the United States still requires jurisdiction-specific review.

Evidence
See `data/source/README.md`. The archive SHA-256 is `ca6421515980a4a7387b5dbac3aa9cc586c7e6460fa1a92339b04fe58a162cf0`; the member SHA-256 is `ff6be20054adb077ab4e3ba27268a81ad9bf17fed02009393f5ce237f9c424e5`.

### ADR-002 — Normalization table authority

Status: accepted

Date: 2026-10-04

Context
Derived spellings and lemmas can create relationships that are absent from exact PCE wording. They therefore require explicit authority and provenance.

Decision
Keep normalization rules in versioned configuration under `config/normalization/`. Exact mode never uses aliases, although its explicit case-insensitive setting applies typography-preserving case folding. Each spelling alias or lemma mapping requires evidence and project-owner review; every change creates a new normalization version. Version `1.0.1` clarifies this boundary and keeps typographic-apostrophe equivalence in normalized modes only. It contains no spelling aliases or lemmas.

Consequences
Normalized search can grow without altering exact results. A new relationship cannot enter rankings through an undocumented library update or generated suggestion.

Evidence
`config/normalization/1.0.1.json` and tokenizer fixtures.

### ADR-003 — Database and migration layer

Status: accepted

Date: 2026-10-04

Context
The production system needs positional token indexes, deterministic queries, JSON explanation records, and a deployment-neutral relational store.

Decision
Use PostgreSQL 16 or newer with numbered, explicit SQL migrations and a thin typed TypeScript repository layer. Final scoring remains in the pure search package rather than SQL or an ORM. Use Docker Compose for the eventual local database and a managed PostgreSQL-compatible service for deployment. The Next.js application remains suitable for Vercel, but the database provider is intentionally not locked in during Phase 0.

Consequences
Schema changes remain inspectable and provider-neutral. Phase 0 derived JSONL does not require a running database; Phase 2 will load the same canonical artifact into PostgreSQL.

Evidence
`docs/DATA_AND_API.md`, `docs/ARCHITECTURE.md`, and the canonical JSONL import artifact.

### ADR-004 — Scoring version 1.0.0

Status: accepted

Date: 2026-10-04

Context
Phase 0 must freeze a configuration format without presenting unreviewed rankings as a final algorithm release.

Decision
The documented formula, weights, caps, six-decimal rounding, and tie-break order were first frozen as `1.0.0-draft`. After reviewing ten cross-genre golden queries in Phase 1, promote the unchanged configuration to production version `1.0.0`. It explicitly binds tokenizer `1.0.0` and normalization `1.0.1`. Future formula or default changes require a new algorithm version and an approved golden diff.

Consequences
Rankings are deterministic and every explanation/export identifies algorithm version `1.0.0` and its configuration checksum. The draft configuration remains in version control as review history.

Evidence
`config/scoring/1.0.0.json`, `tests/golden/phase1-related.json`, `docs/SCORING_SPEC.md`, and scoring unit tests.

### ADR-005 — External dictionary provider

Status: accepted

Date: 2026-10-04

Context
Modern-topic resolution needs stable sense identifiers, definitions, synonyms, an explicit license, and offline operation. A runtime web API would make core behavior depend on availability and could change results without a versioned import.

Decision
Use Princeton WordNet 3.0 from the official `WNdb-3.0.tar.gz` database archive. Pin archive SHA-256 `658b1ba191f5f98c2e9bae3e25c186013158f30ef779f191d2a44e5d25046dc8`. The importer extracts the eight required ASCII index/data files, preserves their embedded WordNet license notice, and records per-file checksums. Runtime lookup is local and writes immutable headword snapshots under the ignored derived-data cache.

Sense IDs use `wn30:<part-of-speech>:<synset-offset>`. Only single-token synonyms that occur in the normalized KJV vocabulary become candidates. The user must select a sense and then select candidate KJV words. WordNet confidence never enters Scripture ranking; each candidate produces a separate exact-word result set, and the combined view exposes its winning bridge term.

Consequences
Topic resolution works without runtime network access after import and preserves provider, version, source URL, retrieval date, license, definition, synonyms, and payload checksum. A clean checkout must obtain the pinned official archive and run `npm run import:wordnet`. Missing data produces a visible `503`, while already cached headwords remain available. Updating WordNet requires a new provider version and reviewed provenance.

Evidence
`config/dictionary/wordnet-3.0.json`, `data/source/README.md`, `scripts/import-wordnet.ts`, `packages/search/src/topics.ts`, and Phase 4 unit/browser tests.

### ADR-006 — Editorial cross-reference dataset

Status: proposed

Leave this component disabled until a source is selected, licensed, checksummed, and clearly labeled. The application remains complete without it.

### ADR-007 — Initial runtime and dependency-light engine skeleton

Status: accepted

Date: 2026-10-04

Context
The first increment needs to be executable before a corpus edition, database, or deployment target is approved. The available local runtime is Node.js 22; restricted execution environments may require explicit permission for Node and npm to resolve the enclosing user path.

Decision
Use Node.js 22's type-stripping support for the initial pure TypeScript corpus and search packages, CLI, and built-in test runner. Pin npm 11.3.0 as the package manager. Keep imports explicit and dependency-free in this increment. Preserve the proposed `apps/` and `packages/` monorepo layout so Next.js, PostgreSQL, schema validation, and browser tests can be added without moving the engine.

Consequences
Reference parsing, tokenization, scoring, and tests run immediately from a clean checkout with Node.js 22. The initial CLI is intentionally limited to reference parsing and token inspection until ADR-001 selects a corpus. Installing the eventual web/database dependencies remains a separate, reversible step.

Evidence
`package.json`, `packages/corpus`, `packages/search`, and the passing built-in Node test suite.

### ADR-008 — Phase 2 repository adapters and web runtime

Status: accepted

Date: 2026-10-04

Context
The web MVP needs to run locally from the already audited canonical artifact while retaining the PostgreSQL production boundary chosen in ADR-003. Requiring a running database merely to verify browser parity would weaken the local-first requirement and duplicate the corpus authority.

Decision
Define one typed `CorpusRepository` contract with two server-only adapters. The local web runtime reads the versioned canonical JSONL plus its manifest and validates the row count before building the unchanged Phase 1 search engine. A `PostgresCorpusRepository` and numbered SQL migration define the relational production path. Neither adapter performs scoring; both feed canonical verse rows into the pure search package.

Use Next.js 16 App Router route handlers in the Node.js runtime, Zod request validation, React 19, and Playwright browser acceptance tests. Generated corpus artifacts remain ignored and must be reproduced by the audited importer before local web startup.

Consequences
The entire Phase 2 experience remains usable without network access or a database after corpus import. PostgreSQL deployment can be added without moving ranking into SQL. Each Next.js server process pays a one-time in-memory index construction cost, after which queries reuse the cached service. A future database-backed index may reduce cold start without changing API results or algorithm version.

Evidence
`apps/web/src/server/corpus-repository.ts`, `database/migrations/0001_phase2_core.sql`, `apps/web/src/server/study-service.ts`, and `tests/browser/phase2.spec.ts`.

### ADR-009 — Phase 3 evidence graph and workflow semantics

Status: accepted

Date: 2026-10-04

Context
Phase 3 introduces graph navigation and study workflows that can easily imply stronger interpretive claims than their underlying lexical evidence supports. Editorial cross-references also require a separately approved source and license.

Decision
Build bounded graphs directly from the accepted deterministic related-verse explanations. Verse and term nodes are visually distinct, every edge has a stored explanation, and the accessible table contains exactly one row per edge. “Gather mentions” and “first-mention chain” use exact occurrences in canonical order; “candidate mates” reuses algorithm 1.0.0; “divide term” groups observed contexts by canonical book without inventing senses; and two/three-witness views choose ranked candidates from distinct canonical books. Distinct books are a lexical-independence heuristic only.

The cross-reference manifest format is versioned and fail-closed. Its checked-in manifest remains disabled. Enabling a set requires source URL, license, SHA-256 checksum, and explicit project-owner approval; Phase 3 imports no editorial dataset.

Consequences
The graph and workflows remain local, deterministic, inspectable, and non-generative. No scoring weight, normalization rule, stop-word rule, or tie-break order changed. A future editorial dataset can be added without silently entering the ranking system.

Evidence
`packages/search/src/workflows.ts`, `packages/search/src/cross-references.ts`, `config/cross-references/manifest.json`, `database/migrations/0002_phase3_cross_references.sql`, and Phase 3 unit/browser tests.

