# Implementation Roadmap

## Phase 0 — Decisions and corpus audit

Status: complete (2026-10-04)

- Select the exact KJV source and document jurisdiction/licensing constraints.
- Establish package manager, repository layout, database migration tool, and supported runtime versions.
- Create the corpus manifest schema and importer fixtures.
- Fix the algorithm versioning and configuration format.
- Exit when one clean import passes all integrity gates and is reproducible.

Completion evidence: `data/derived/KJV-PCE-BP-2010-v1/manifest.json`, `import-report.json`, the canonical JSONL checksum, and the full-source repeat-import test.

## Phase 1 — Deterministic engine and CLI

Status: complete (2026-10-04)

- Implement reference parsing and canonical identifiers.
- Implement versioned tokenizer and normalization trace.
- Build occurrence and phrase indexes.
- Calculate corpus statistics.
- Implement candidate generation, component scoring, explanations, and stable sorting.
- Add a CLI that can run exact and related-verse queries and export JSON.
- Exit when golden tests pass without a web interface.

Completion evidence: `docs/PHASE_1_REPORT.md`, `tests/golden/phase1-related.json`, the corpus-backed CLI commands, and the complete passing test suite.

## Phase 2 — Web MVP

Status: complete (2026-10-04)

- Scaffold the Next.js application and database repository layer.
- Implement passage, exact-search, related-search, comparison, and distribution endpoints.
- Build the study page, context view, results table, filters, and explanation disclosures.
- Add JSON research-record export.
- Exit when browser tests reproduce CLI results.

Completion evidence: `docs/PHASE_2_REPORT.md`, the `/api/v1` route handlers, `database/migrations/0001_phase2_core.sql`, the study workbench under `apps/web`, and `tests/browser/phase2.spec.ts`.

## Phase 3 — Graph and WHGW workflows

Status: complete (2026-10-04)

- Add the bounded evidence graph with accessible table parity.
- Add gather mentions, candidate mates, divide terms, first-mention chain, and two/three-witness views.
- Add versioned editorial cross-reference import, disabled until a licensed source is chosen.
- Exit when every graph edge resolves to an explanation record.

Completion evidence: `docs/PHASE_3_REPORT.md`, `packages/search/src/workflows.ts`, the Phase 3 `/api/v1` routes, `config/cross-references/manifest.json`, and `tests/browser/phase3.spec.ts`.

## Phase 4 — Modern topic resolver

Status: complete (2026-10-04)

- Integrate one approved dictionary provider.
- Cache provenance and license data.
- Build sense selection and KJV vocabulary intersection.
- Add separate per-candidate rankings and a labeled combined view.
- Exit when ambiguous terms cannot bypass user selection and the feature degrades cleanly offline.

Completion evidence: `docs/PHASE_4_REPORT.md`, `packages/search/src/topics.ts`, `apps/web/src/server/wordnet-provider.ts`, the `/api/v1/topics/resolve` route, and `tests/browser/phase4.spec.ts`.

## Phase 5 — Optional generated explanation

- Add only after the deterministic system is trusted.
- Pass retrieved evidence and explicit instructions to the model.
- Require citations to the visible passage set.
- Label prose as generated and keep it outside ranking/export truth fields.
- Exit when disabling the model leaves all core research features intact.

## Initial task queue

1. Record ADR-001 through ADR-004 in `DECISIONS.md`.
2. Create corpus manifest and JSON Schema.
3. Build reference parser fixtures.
4. Implement importer dry run and anomaly report.
5. Add tokenizer fixtures before choosing tokenization libraries.
6. Implement pure scoring functions from `SCORING_SPEC.md`.
7. Create 8–12 reviewed golden queries.
8. Build CLI and compare clean-run outputs.
9. Scaffold the web UI only after the engine is stable.

