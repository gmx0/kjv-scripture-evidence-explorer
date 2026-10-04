# Phase 1 Completion Report

Date: 2026-10-04

Status: complete

## Implemented engine

- Canonical in-memory verse index over all 31,102 PCE verses.
- Surface, typography-preserving case-folded, and explicitly normalized token layers.
- Positional occurrence indexes used for exact phrase matching without scanning unrelated verses.
- Corpus document frequency, total frequency, IDF, and rare-token threshold calculations.
- Exact word search with optional case sensitivity and occurrence positions.
- Exact contiguous phrase search with every matching start position.
- Complete term distributions with first mention, last mention, total frequency, verse frequency, and counts by book.
- Inverted-index candidate generation for related-verse search.
- Configurable book and Testament candidate filters.
- Deterministic component scoring, six-decimal rounding, full evidence explanations, and stable canonical tie-breaking.
- Corpus, algorithm, normalization, tokenizer, and configuration identities in query metadata.

The phrase index is positional: token postings retain verse and token positions, candidate verses are intersected, and contiguity is verified from those positions. This avoids a memory-heavy materialization of every possible n-gram while retaining deterministic phrase lookup.

## Version identities

- Corpus: `KJV-PCE-BP-2010-v1`
- Canonical SHA-256: `08c7215fb243f935c102c53fa1f8c849f0472aaff77fa3fae0bbe12b6b875e48`
- Tokenizer: `1.0.0`
- Normalization: `1.0.1`
- Scoring algorithm: `1.0.0`
- Configuration SHA-256: `4f130074a8f9433ecf4422aec811c96c0d4ec6ba5cac17492d74d7ca216aaaca`

## Corpus statistics

- Verses: 31,102
- Normalized vocabulary: 12,756 tokens
- Rare-token threshold: document frequency 1, representing the configured lowest 20th percentile in this vocabulary distribution

The generated `statistics.json` artifact records document frequency, total frequency, and IDF for every token.

Statistics artifact SHA-256: `5be0c9cdcdfebfb513d11bcd3297ea4e56ca72a4d5d06e9d670d864e576dab67`.

## Golden review

Ten cross-genre queries are pinned in `tests/golden/phase1-related.json`:

- Genesis 1:1
- Deuteronomy 6:4
- Psalms 23:1
- Proverbs 3:5
- Isaiah 34:16
- Matthew 4:4
- John 3:16
- Romans 8:1
- 2 Timothy 3:16
- Revelation 22:18

The review confirms that repeated phrases and direct lexical parallels rank strongly—for example, Deuteronomy 6:4 with Mark 12:29 and Matthew 4:4 with Luke 4:4. It also preserves the intended limitation: a passage such as 2 Timothy 3:16 has weaker lexical neighbors when its central vocabulary is rare or unique. The system reports that evidence rather than inventing conceptual links.

Each golden result pins ordered references, rounded scores, matched normalized tokens, and contributing phrases. The fixture also pins the corpus and configuration checksums.

## CLI

```text
npm run cli -- exact gathered --limit 20
npm run cli -- phrase "in the beginning" --limit 20
npm run cli -- term gathered
npm run cli -- related "Isaiah 34:16" --limit 20
npm run cli -- related "John 3:16" --testament NT --limit 20
npm run index:corpus
```

Every command returns structured JSON suitable for inspection or export. Exact and phrase results include occurrence positions; related results include the complete score explanation.

## Phase 1 exit gate

The deterministic engine operates over the full selected corpus, all reviewed golden rankings pass without a web interface, and the corpus-backed CLI reproduces them. Phase 2 may begin.
