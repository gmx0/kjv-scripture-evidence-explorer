# Phase 0 Completion Report

Date: 2026-10-04

Status: complete

## Decisions fixed

- Corpus: Bible Protector Pure Cambridge Edition text archive, version `KJV-PCE-BP-2010-v1`.
- Runtime and package manager: Node.js 22.16.0 and npm 11.3.0.
- Repository: dependency-light TypeScript packages under `packages/`, applications under `apps/`.
- Normalization: exact mode never uses aliases; reviewed, versioned rules only.
- Database: PostgreSQL 16+, numbered SQL migrations, thin typed repository layer.
- Scoring: immutable `1.0.0-draft` configuration pending Phase 1 golden review.

## Source integrity

- Archive SHA-256: `ca6421515980a4a7387b5dbac3aa9cc586c7e6460fa1a92339b04fe58a162cf0`
- Member SHA-256: `ff6be20054adb077ab4e3ba27268a81ad9bf17fed02009393f5ce237f9c424e5`
- Encoding: Windows-1252
- Source line endings: CRLF
- Canonical output: UTF-8 JSONL with LF line endings

## Import result

- Books: 66
- Chapters: 1,189
- Verses: 31,102
- Italic spans: 21,489
- Paratext items: 132
- Errors: 0
- Warnings: 0
- Canonical SHA-256: `08c7215fb243f935c102c53fa1f8c849f0472aaff77fa3fae0bbe12b6b875e48`

## Generated artifact hashes

- `verses.jsonl`: `08c7215fb243f935c102c53fa1f8c849f0472aaff77fa3fae0bbe12b6b875e48`
- `manifest.json`: `c6624af6d1d1547e67f8909a7d1dc17e84db8c4e57724561b3383633ce0c4f32`
- `import-report.json`: `7a35b943bae2541bdae5adec5842708a1e3883a077a322e09fdb4a635ed2caaa`

The importer was run repeatedly from the pinned archive. Every generated artifact retained the same checksum.

During Phase 1 CLI verification, a decoder regression test found that the runtime's nominal Windows-1252 decoder exposed C1 control characters for source bytes `0x92` and `0x97`. Importer `0.1.0` now uses an explicit Windows-1252 mapping, correctly producing Unicode right apostrophes and em dashes. The source hashes did not change; the corrected canonical hash above supersedes the initial audit hash.

## Verification

The complete test suite contains 16 passing tests covering:

- canonical reference parsing and rejection cases;
- token surfaces, offsets, punctuation, and apostrophe folding;
- italic and paratext extraction;
- malformed markup and reference-sequence failures;
- full-source checksums and canonical counts;
- repeat-import determinism;
- IDF, weighted Jaccard, zero-weight terms, scoring validation, and stable tie-breaking.

## Reproduction

```text
npm test
npm run import:corpus
```

Generated corpus artifacts are intentionally gitignored. Their hashes and the instructions needed to reproduce them are tracked in this report and `data/source/README.md`.

## Phase 0 exit gate

One clean import passes every implemented integrity gate and produces byte-for-byte reproducible artifacts. Phase 1 may begin.
