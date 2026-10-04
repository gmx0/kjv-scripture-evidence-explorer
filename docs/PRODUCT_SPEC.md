# Product Specification

## Product goal

Help a reader investigate how the KJV uses its own words by turning a verse, phrase, word, or modern topic into a reproducible evidence set. Optimize for auditability and study, not for a single authoritative answer.

## Primary users

- A reader tracing repeated KJV wording across books.
- A writer developing a section from multiple supporting passages.
- A researcher checking whether an apparent connection is exact, normalized, editorial, or inferred.
- A developer who needs a stable programmatic concordance API.

## Core user journeys

### Verse study

The user enters `John 3:16`. The app shows the exact verse and nearby context, significant terms, exact phrase matches, ranked related verses, first/last mentions, and an evidence graph. Every result shows why it matched.

### Word or phrase study

The user enters a KJV word or quoted phrase. The app lists every exact occurrence in canonical order, then offers normalized and similarity modes as explicit additional layers.

### Modern topic study

The user enters a term not found in the KJV. The app first reports zero exact occurrences. If the user chooses expansion, it retrieves cited dictionary senses, asks the user to select the intended sense, maps that sense to candidate vocabulary, shows which candidates actually occur in the KJV, and searches only the selected candidates. The original topic is never presented as though it were KJV wording.

### Compare passages

The user selects two or more passages. The app displays common exact tokens, common normalized tokens, shared phrases, unique terms, proximity/order evidence, and configured cross-references.

## Functional requirements

| ID | Requirement |
|---|---|
| FR-1 | Resolve canonical KJV references, ranges, words, phrases, and free-text topics. |
| FR-2 | Preserve and display exact imported verse text. |
| FR-3 | Support exact, normalized, phrase, and similarity search as distinct modes. |
| FR-4 | Rank related verses with the versioned formula in `SCORING_SPEC.md`. |
| FR-5 | Explain each result with matched evidence and component scores. |
| FR-6 | Show canonical context and never isolate a verse without an easy context path. |
| FR-7 | Provide first mention, last mention, frequency, and book distribution for a term. |
| FR-8 | Visualize verse/term relationships without hiding lower-ranked tabular results. |
| FR-9 | Export query, configuration, corpus version, results, and explanations as JSON. |
| FR-10 | Resolve absent modern terms through a cited, cached, user-selected dictionary sense. |
| FR-11 | Permit curated cross-references only as a separately labeled source layer. |
| FR-12 | Offer a local API with stable, validated response schemas. |

## WHGW-style study operations

These are named workflows over the same evidence engine, not separate ranking systems:

- Gather mentions: all exact or selected normalized occurrences.
- Candidate mates: passages sharing unusually informative wording.
- Divide terms: compare how a word is used across distinct contexts and constructions.
- Opposites: locate explicit antonym or contrast vocabulary, with the source of the antonym relation labeled.
- First-mention chain: follow selected terms from their first occurrence to later repetitions.
- Scripture-defines-Scripture: find passages where a term co-occurs with apposition, definition-like syntax, restatement, or repeated phrase; label these as candidates, not proven definitions.
- Two or three witnesses: identify independent passages sharing the asserted lexical relationship; do not claim doctrinal independence automatically.

## Result labels

Every edge or result must carry one or more visible labels:

- `exact_word`
- `exact_phrase`
- `normalized_word`
- `rare_word`
- `word_order`
- `configured_cross_reference`
- `external_synonym_bridge`
- `generated_summary`

## MVP exclusions

- No automatic theological verdicts.
- No semantic vector search in the primary ranking.
- No original-language lexicon claims.
- No user accounts or collaborative editing.
- No additional Bible translations.
- No uncited web snippets used as definitions.
- No AI-generated cross-reference edges.

## Success criteria

- A user can reproduce an exported ranking from corpus, query, and config alone.
- Every returned verse has a human-readable “why this matched” explanation.
- Exact search has no false positives caused by normalization.
- Topic expansion cannot proceed through an ambiguous definition without user sense selection.
- A full 31,102-verse corpus audit passes for the selected standard Protestant KJV versification, or any documented edition difference is explicitly accepted.

