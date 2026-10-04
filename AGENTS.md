# Agent Instructions

This repository builds a deterministic, inspectable KJV Scripture-search and study application. Read this file, then `README.md`, then the documents in `docs/` before changing code.

## Mission

Given a verse, passage, word, or topic, the application must programmatically surface KJV passages connected by exact words, phrases, uncommon vocabulary, and explicitly configured cross-references. It must show why each result appeared. If a modern topic is absent from the KJV, the application may resolve a dictionary sense to candidate KJV vocabulary, but must clearly distinguish that external bridge from Scripture evidence.

The system is a research instrument, not an oracle. It retrieves and organizes evidence; it does not claim that lexical similarity proves interpretation.

## Non-negotiable principles

1. Preserve the source. Store and display the exact imported KJV text without silent correction, modernization, lemmatization, or punctuation changes.
2. Be deterministic. The same corpus version, configuration, and query must return the same ordered results.
3. Explain every result. Return matched tokens and phrases, score components, filters, corpus version, algorithm version, and tie-break reason.
4. Separate evidence layers. Label exact KJV text, normalized matches, configured cross-references, dictionary data, and generated explanation separately.
5. Keep ranking non-generative. An LLM may summarize already retrieved evidence, but may not create matches, graph edges, scores, or rankings.
6. Prefer local computation. Core verse retrieval, indexing, ranking, and graph construction must work without network access after corpus import.
7. Do not smuggle in doctrine. Present textual relationships and competing candidates. Do not state a theological conclusion as an algorithmic fact.
8. Make uncertainty visible. An external synonym is a candidate bridge, not proof that a verse is “about” the modern topic.
9. Test formulas and data integrity. A scoring change requires golden-test updates and an explicit algorithm-version change.
10. Never silently change defaults that affect results. Record them in configuration and the decision log.

## Required workflow

Before implementing a task:

1. Identify the governing requirement in `docs/PRODUCT_SPEC.md`.
2. Check `docs/CORPUS_AND_NORMALIZATION.md` and `docs/SCORING_SPEC.md` for semantic constraints.
3. State any assumption that would affect corpus text, ranking, or interpretation.
4. Write or update a failing test first for algorithmic behavior.
5. Make the smallest coherent change.
6. Run unit, golden, corpus-integrity, type, and lint checks that apply.
7. Update documentation and `docs/DECISIONS.md` when behavior, defaults, dependencies, corpus provenance, or architecture changes.

## Implementation boundaries

- Use TypeScript for the web application and shared search code.
- Keep scoring in a pure package with no UI, network, or model dependency.
- Keep corpus import repeatable. Never hand-edit imported verse rows.
- Store canonical book/chapter/verse identifiers separately from display labels.
- Use integer or fixed-precision arithmetic for final ranking where practical. If floating point is used internally, define rounding before sorting.
- Sort tied results by the exact rules in `docs/SCORING_SPEC.md`; never rely on database row order.
- Treat stop words as data. Keep them searchable in exact mode; down-weight rather than erase them in similarity mode.
- Require the user to choose a dictionary sense when a term is ambiguous before expanding it to KJV vocabulary.
- Cache external definition responses with provider, URL, retrieval date, license, selected sense, and normalized synonym candidates.
- Never expose secret keys to the browser or commit them.
- Do not add analytics, authentication, collaborative notes, AI commentary, or additional Bible translations to the MVP unless the product spec is amended.

## Proposed repository shape

```text
apps/web/                 Next.js user interface and route handlers
packages/corpus/          KJV importer, validators, canonical references
packages/search/          Tokenization, indexing, scoring, explanations
packages/shared/          Shared types, schemas, configuration
data/source/              Unmodified source download; usually gitignored
data/derived/             Reproducible generated artifacts; usually gitignored
tests/golden/             Versioned queries and expected rankings
docs/                     Product and engineering specifications
```

Do not create this structure mechanically if an existing repository already has an equivalent organization. Preserve established conventions unless they violate a non-negotiable principle.

## Definition of done

A change is complete only when:

- behavior matches the relevant specification;
- results remain reproducible from a clean checkout and documented corpus source;
- tests cover the normal case, boundary case, and failure case;
- every ranked response remains explainable;
- accessibility is preserved for any UI change;
- no secret, copyrighted non-permitted corpus, or untracked external dependency was introduced;
- documentation reflects the actual behavior.

## Stop and ask

Ask the project owner before:

- changing the KJV edition or source file;
- changing scoring weights, normalization rules, stop-word policy, or tie-break order;
- adding a theological ontology or editorial cross-reference set;
- allowing an LLM to influence retrieval;
- introducing a paid or restrictive external API;
- publishing or deploying the application;
- importing material whose license is unclear.

