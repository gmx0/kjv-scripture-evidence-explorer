# Test and Verification Plan

## Test layers

### Corpus integrity

- Verify source and canonical checksums.
- Validate canonical book order, reference uniqueness, non-empty text, and expected counts.
- Round-trip every reference through parser and formatter.
- Re-import twice and compare canonical exports byte-for-byte.
- Snapshot a small reviewed selection of exact verses and punctuation edge cases.

### Unit tests

- Reference parsing, including ranges and ambiguous abbreviations.
- Token boundaries, punctuation, apostrophes, hyphens, case folding, and offsets.
- Each normalization rule and its provenance.
- Document frequency and IDF.
- Weighted Jaccard, phrase spans, rare-word score, order/proximity, rounding, and tie-breaking.
- Empty, all-stop-word, repeated-word, and single-token inputs.
- Topic vocabulary intersection and mandatory sense selection.

### Property tests

- A verse compared with itself scores `1` for weighted Jaccard when it has searchable tokens.
- Weighted Jaccard is symmetric and lies in `[0,1]`.
- Adding an unrelated token cannot increase weighted Jaccard.
- Canonical tie-breaking is stable under shuffled candidate input.
- Exact-mode results are unaffected by normalization configuration.
- No generated text can add a result or alter a score.

### Golden tests

Store reviewed fixtures containing query, corpus checksum, algorithm version, configuration hash, ordered references, rounded scores, and explanation excerpts. Include:

- a verse with an obvious repeated phrase;
- a verse connected mainly by rare vocabulary;
- a high-frequency vocabulary case;
- a spelling-alias case such as `shew`/`show`;
- a result admitted only by a configured cross-reference;
- a modern term with multiple dictionary senses;
- a zero-exact-result topic whose synonyms do and do not occur in the KJV;
- tied scores that exercise every tie-break field.

Golden changes require a review note explaining why the ranking changed.

### API and browser tests

- Schema validation and status codes.
- Context navigation and canonical labels.
- “Why this matched” content equals API evidence.
- Filters preserve deterministic order.
- Exports reproduce the visible result set.
- Full keyboard flow and automated accessibility scan.
- Topic expansion cannot skip sense selection when ambiguous.

## Acceptance gates

Before merging algorithm or corpus changes:

1. corpus integrity suite passes;
2. unit and property suites pass;
3. golden diff is empty or explicitly approved;
4. API schemas remain backward-compatible or the API version changes;
5. browser smoke test passes;
6. documentation versions match runtime versions.

## Manual study review

Automated correctness is necessary but not sufficient. For each algorithm release, manually inspect at least ten diverse passages across law, history, poetry, prophecy, gospels, and epistles. Record false-positive patterns and omissions as evidence for future versioned changes; do not tune production weights invisibly.

