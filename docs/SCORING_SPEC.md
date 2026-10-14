# Deterministic Scoring Specification

## Overview

Ranking has two stages: candidate generation and scoring. Candidate generation must have high recall and may use inverted indexes. Scoring is a pure function of versioned corpus data, query configuration, and an optional versioned editorial cross-reference set.

Textual facts remain binary: characters either match, an occurrence either exists, and a dataset either records an edge or it does not. Evidentiary strength is gradual. Computational and display thresholds must not be described as proof that omitted evidence has zero similarity.

## Candidate generation

For a source passage, build tiered candidate pools using these conditions:

- share a non-zero-weight normalized token;
- contain an exact phrase of at least two tokens from the source;
- share a reviewed compound component or root family;
- share a qualifying raw prefix, suffix, or substring under the bounded letter-pattern rules;
- appear in the configured cross-reference set;
- match a user-selected expansion term.

Exclude the source verse itself by default. Apply user book/testament/range filters before final scoring. Record which condition admitted each candidate.

The default tiers are exact/phrase, shared vocabulary, morphology, letter patterns, editorial cross-references, and expanded-topic vocabulary. Each tier receives a deterministic computational quota based on score upper bounds. Union and de-duplicate the tiers before final scoring. Return total, evaluated, and pruned counts for every tier. Pruning means `not evaluated for display`, not `zero similarity`.

A shared prefix, suffix, internal substring, ordered subsequence, or unordered letter multiset may admit a bounded number of candidates. It is scored as raw letter-pattern evidence, not morphology. There is no minimum shared length, but short and common fragments decay sharply. Generate these candidates against the distinct vocabulary index, retain the highest upper-bound candidates per query token, and only then resolve them to verses.

## Token weight

For corpus size `N` verses and document frequency `df(t)`:

```text
idf(t) = ln((N + 1) / (df(t) + 1)) + 1
```

The weighted token value is `idf(t) * configured_token_multiplier(t)`. Default multiplier is `1`. Common words are not normally assigned zero; IDF supplies continuous down-weighting. An explicit user exclusion may set a term to zero for that query and must be recorded.

## Component scores

All component scores are clamped to `[0, 1]`.

### Weighted Jaccard `J`

For unique normalized token sets `A` and `B`:

```text
J(A,B) = sum(weight(t), t in A intersection B)
         / sum(weight(t), t in A union B)
```

### Phrase and near-phrase score `P`

Find aligned exact-token sequences shared by both passages, including contiguous phrases and ordered near-phrases. Score the longest non-overlapping alignments with smooth distance decay:

```text
gap_decay = exp(-0.7 * total_intervening_gap)
length_factor = 0.10 when aligned_length = 1, otherwise aligned_length^2
P = min(1, sum(length_factor * gap_decay) / phrase_cap)
```

The MVP default `phrase_cap` is `25`. A single aligned word therefore receives very small phrase/order evidence, adjacent words receive full phrase treatment, and increasingly separated words fade smoothly. Return every contributing span, gap, and location. Apply the configured overlap correction so the same single-token evidence is not fully counted in several components.

### Continuous rarity score `R`

Do not divide words into rare and non-rare scoring buckets. Normalize every shared token's IDF:

```text
rarity(t) = idf(t) / max_corpus_idf
R = min(1, sum(rarity(t)^2) / rare_cap)
```

The MVP default `rare_cap` is `3`. Squaring makes common words fade sharply without becoming zero. `Rare word` may remain a UI label based on a percentile, but crossing that display threshold does not alter scoring. Return all contributing tokens and frequencies.

### Order/proximity score `O`

For shared searchable tokens, calculate the best monotonic alignment of token positions. Reward preserved order and short gaps. The implementation must be specified by fixtures before release. Until then, use:

```text
order_ratio = aligned_shared_tokens / shared_searchable_tokens
gap_factor  = 1 / (1 + mean_normalized_gap_difference)
O = order_ratio * gap_factor
```

Define empty denominators as `0`. Return alignment pairs.

### Configured cross-reference score `C`

The presence of a dataset edge is binary, but supported evidence classes are graded:

```text
1.00 direct quotation
0.95 explicit citation
0.75 strong verbal parallel
0.50 probable allusion
0.25 topical editorial reference
```

If a dataset supplies no defensible type, use its documented default rather than inventing one. Absence gives `C = 0` only for this editorial component and means `not found in this dataset`, not `no relationship exists`. Label this component editorial rather than lexical.

### Capitalization fidelity `K`

For aligned surface-spelling matches, compare the uppercase/lowercase status of corresponding alphabetic characters:

```text
case_similarity = matching_case_positions / compared_alphabetic_positions
initial_information = 1 / (1 + 0.5 * initial_occurrence_count)
case_value = case_similarity * initial_information

K = sum(idf(t) * case_value(t)) / sum(idf(t))
```

`initial_occurrence_count` is `0`, `1`, or `2` according to how many aligned occurrences begin a sentence or verse. Thus capitalization evidence fades when position may explain it rather than jumping among four fixed categories. If there are no aligned surface-spelling matches, `K = 0`. This component states only how the selected KJV corpus is capitalized; it does not make claims about another printing or the original languages.

### Morphological relationship score `M`

Morphological evidence is calculated for aligned relationships with explicit source confidence. Each token pair contributes at its strongest single level, so the same pair is not counted repeatedly as a compound, root, prefix, and suffix match.

```text
relation_value = 1.00  identical whole surface word
relation_value = 0.80  same reviewed inflectional lemma
relation_value = 0.65  same reviewed root/derivational family
relation_value = 0.50  same reviewed compound component
relation_value = 0.20  same approved prefix and same retained base/root
relation_value = 0.15  same approved suffix and same retained base/root
relation_value = 0.00  raw affix or character overlap only; scored separately in L

M = sum(idf(root_or_component) * relation_value)
    / sum(idf(root_or_component))
```

Multiply each relation value before aggregation by:

```text
source_confidence:
1.00 manually reviewed KJV mapping
0.90 established lexical source
0.70 high-confidence deterministic rule
0.30 algorithmic morphological proposal
0.00 unexplained generated suggestion

context_compatibility: deterministic value in [0,1]
component_rarity: normalized corpus IDF in [0,1]
```

Low-confidence proposals are visible and user-disableable; they are not labeled reviewed facts.

For a token pair with several eligible relations, use the maximum `relation_value`. Whole-word identity is included above to make the hierarchy explicit, but its contribution to total similarity is already represented by `J`; therefore exact-identical pairs are omitted from `M`'s numerator and denominator in the final implementation. `M` measures the additional relationship beyond exact vocabulary.

Compound order is retained. Component proximity uses continuous decay:

```text
compound_distance = exp(-0.5 * intervening_searchable_tokens)
```

Adjacent ordered components receive full distance credit; increasingly separated components fade smoothly. A single shared component receives at most half the compound value before rarity and context multipliers.

#### Compound-family query expansion

When the query token is a reviewed compound, generate a bounded, explainable family before verse candidate generation:

```text
freewill
├─ exact compound: freewill
├─ orthographic compound form: free will
├─ component: free
├─ component: will
└─ sibling compounds sharing a component
   └─ selfwill / selfwilled = self + will
```

Search branches remain separate and retain their path from the original query. Default branch priorities are:

```text
1.00 exact whole compound
0.90 reviewed open/closed/hyphenated form of the same compound
0.60 passages containing all components in order and proximity
0.40 individual compound component
0.30 reviewed sibling compound sharing one component
```

These values control candidate expansion within `M`; they are not added directly to the total score. Multiply component evidence by its IDF so a common component such as `will` does not flood the results. Cap each component branch to a configurable number of candidates before union and final scoring.

For sibling compounds, the result must show the entire derivation, for example:

```text
freewill -> component will -> selfwilled
```

Do not pretend that `freewill` and `selfwilled` are synonyms. They are candidates because their printed compounds share the component `will`. Their surrounding verses, other shared words, phrases, capitalization, and proximity determine their final positions.

If a component is grammatically ambiguous, retain a deterministic distribution over supported classifications rather than forcing one label. For example, an occurrence might carry `nominal/volitional: 0.75`, `auxiliary: 0.15`, and `uncertain: 0.10`. When the query comes from `freewill`, use the relevant class probability as a context multiplier. Rules, values, and versions must be exposed; uncertainty is reduced rather than discarded.

### Raw letter-pattern score `L`

`L` rewards shared character patterns even when no reviewed morphological relationship is known. It never asserts that the words share a meaning or historical root.

For each token pair, find the longest common prefix, suffix, internal contiguous substring, ordered subsequence, and unordered multiset intersection. Calculate each eligible pattern:

```text
coverage = shared_length / max(token_a_length, token_b_length)
rarity = ln((V + 1) / (fragment_frequency + 1)) / ln(V + 1)
length_decay = exp(-2.3 * max(0, 4 - shared_length))

kind_multiplier = 1.00  prefix
kind_multiplier = 1.00  suffix
kind_multiplier = 0.75  internal substring
kind_multiplier = 0.25  noncontiguous letters in the same order
kind_multiplier = 0.10  unordered shared letters

pair_letter_score = coverage^3 * rarity * length_decay * kind_multiplier
L = min(1, weighted_mean(best pair_letter_score per aligned token pair))
```

`V` is the number of distinct searchable surface-word types. `fragment_frequency` is the number of those word types containing the same pattern in the same position class. For unordered comparisons, repeated letters use multiset counts rather than set membership. Use only the strongest pattern for a token pair.

The default length-decay values are approximately:

```text
1 shared letter  = 0.001
2 shared letters = 0.010
3 shared letters = 0.100
4+ shared letters = 1.000
```

Therefore no overlap is declared nonexistent, but one- and two-letter evidence normally approaches zero after coverage and rarity are also applied.

If the same pair already has an exact, lemma, root, compound, or validated-affix relationship, do not also award `L`; show the character overlap in the explanation but score only the stronger relationship. This prevents double counting.

Example: `freewill` and `selfwill` share the four-letter suffix `will`. With both tokens eight letters long, their coverage is `0.5`; rarity and the 5% total-score weight keep this evidence meaningful but subordinate. By contrast, `free` and `work` share only `r`; its length decay is about `0.001` before the cubic coverage and common-letter rarity reductions.

Letter-pattern candidate generation must use deterministic upper-bound pruning rather than enumerating every verse pair. Keep counts of pruned vocabulary and verse candidates and expose them in response metadata. A pruned candidate means “not evaluated for display,” not “zero similarity.”

## Default total

```text
score_raw = 0.30J + 0.20P + 0.10R + 0.10O + 0.10K + 0.10M + 0.05L + 0.05C
score = round(score_raw, 6)
```

Weights are configuration with an algorithm version. They must sum to `1`. A changed formula, component definition, default weight, normalization rule, or rounding policy increments the algorithm version and requires golden-result review.

## Tie-breaking

Sort by:

1. total score descending;
2. phrase score descending;
3. rare-word score descending;
4. capitalization fidelity descending;
5. morphological relationship score descending;
6. raw letter-pattern score descending;
7. weighted Jaccard descending;
8. configured cross-reference score descending;
9. canonical Bible order ascending.

Never use insertion order, database physical order, or nondeterministic parallel completion.

## Query types

- Exact word: return occurrences, not similarity ranking, unless the user explicitly asks for related verses.
- Exact phrase: rank by longest exact phrase, number of occurrences, then canonical order.
- Passage: use all enabled components.
- Expanded topic: run separate rankings for each user-selected KJV candidate term; a combined view may use the maximum score per verse and must expose the winning term. Do not blend dictionary confidence into the Scripture score.

Topic-to-corpus matching follows the graded ladder: exact form, normalized spelling, lemma, root family, compound family, validated affix, and raw letter pattern. Preserve the complete bridge path and its external sense confidence. Keep bridge confidence outside the Scripture score so `why this KJV term was selected` remains distinct from `why this verse ranked`.

## Explanation record

Every ranked item includes:

```json
{
  "reference": "...",
  "score": 0.0,
  "components": {"jaccard": 0.0, "phrase": 0.0, "rare": 0.0, "order": 0.0, "capitalization": 0.0, "morphology": 0.0, "letterPattern": 0.0, "crossReference": 0.0},
  "matchedSurfaceTokens": [],
  "matchedNormalizedTokens": [],
  "matchedPhrases": [],
  "rareTokens": [],
  "alignment": [],
  "caseMatches": [],
  "morphologicalMatches": [],
  "letterPatternMatches": [],
  "candidateReasons": [],
  "externalBridge": null,
  "corpusVersion": "...",
  "algorithmVersion": "..."
}
```

## Version-one limitation

Lexical overlap can miss conceptual connections and can overvalue repeated formulaic language. The UI must say this plainly. Semantic or generated suggestions, if later added, belong in an optional, separately labeled panel and cannot alter the deterministic ranking.

