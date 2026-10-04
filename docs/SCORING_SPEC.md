# Deterministic Scoring Specification

Status: accepted as algorithm version `1.0.0` after Phase 1 golden-query review.

## Overview

Ranking has two stages: candidate generation and scoring. Candidate generation must have high recall and may use inverted indexes. Scoring is a pure function of versioned corpus data, query configuration, and an optional versioned editorial cross-reference set.

## Candidate generation

For a source passage, collect candidate verses that satisfy at least one enabled condition:

- share a non-zero-weight normalized token;
- contain an exact phrase of at least two tokens from the source;
- appear in the configured cross-reference set;
- match a user-selected expansion term.

Exclude the source verse itself by default. Apply user book/testament/range filters before final scoring. Record which condition admitted each candidate.

## Token weight

For corpus size `N` verses and document frequency `df(t)`:

```text
idf(t) = ln((N + 1) / (df(t) + 1)) + 1
```

The weighted token value is `idf(t) * configured_token_multiplier(t)`. Default multiplier is `1`. Reviewed zero-weight terms receive `0` in similarity components but remain eligible for exact phrase evidence.

## Component scores

All component scores are clamped to `[0, 1]`.

### Weighted Jaccard `J`

For unique normalized token sets `A` and `B`:

```text
J(A,B) = sum(weight(t), t in A intersection B)
         / sum(weight(t), t in A union B)
```

### Phrase score `P`

Find contiguous exact-token spans shared by both passages. Ignore single-token spans. Score the longest non-overlapping spans, rewarding length while capping the result:

```text
P = min(1, sum(length(span)^2) / phrase_cap)
```

The MVP default `phrase_cap` is `25`. Return every contributing span and its locations.

### Rare-word score `R`

Let `rare_threshold` default to corpus document-frequency percentile 20 among searchable tokens. For shared tokens at or below the threshold:

```text
R = min(1, sum(idf(t)) / rare_cap)
```

The MVP default `rare_cap` is `12`. Return contributing tokens and frequencies.

### Order/proximity score `O`

For shared searchable tokens, calculate the best monotonic alignment of token positions. Reward preserved order and short gaps. The implementation must be specified by fixtures before release. Until then, use:

```text
order_ratio = aligned_shared_tokens / shared_searchable_tokens
gap_factor  = 1 / (1 + mean_normalized_gap_difference)
O = order_ratio * gap_factor
```

Define empty denominators as `0`. Return alignment pairs.

### Configured cross-reference score `C`

`C = 1` when the source/candidate pair exists in the enabled, versioned cross-reference dataset; otherwise `0`. This component must be visibly labeled editorial rather than lexical.

## Default total

```text
score_raw = 0.50J + 0.20P + 0.15R + 0.10O + 0.05C
score = round(score_raw, 6)
```

Weights are configuration with an algorithm version. They must sum to `1`. A changed formula, component definition, default weight, normalization rule, or rounding policy increments the algorithm version and requires golden-result review.

## Tie-breaking

Sort by:

1. total score descending;
2. phrase score descending;
3. rare-word score descending;
4. weighted Jaccard descending;
5. configured cross-reference score descending;
6. canonical Bible order ascending.

Never use insertion order, database physical order, or nondeterministic parallel completion.

## Query types

- Exact word: return occurrences, not similarity ranking, unless the user explicitly asks for related verses.
- Exact phrase: rank by longest exact phrase, number of occurrences, then canonical order.
- Passage: use all enabled components.
- Expanded topic: run separate rankings for each user-selected KJV candidate term; a combined view may use the maximum score per verse and must expose the winning term. Do not blend dictionary confidence into the Scripture score.

## Explanation record

Every ranked item includes:

```json
{
  "reference": "...",
  "score": 0.0,
  "components": {"jaccard": 0.0, "phrase": 0.0, "rare": 0.0, "order": 0.0, "crossReference": 0.0},
  "matchedSurfaceTokens": [],
  "matchedNormalizedTokens": [],
  "matchedPhrases": [],
  "rareTokens": [],
  "alignment": [],
  "candidateReasons": [],
  "externalBridge": null,
  "corpusVersion": "...",
  "algorithmVersion": "..."
}
```

## Version-one limitation

Lexical overlap can miss conceptual connections and can overvalue repeated formulaic language. The UI must say this plainly. Semantic or generated suggestions, if later added, belong in an optional, separately labeled panel and cannot alter the deterministic ranking.

