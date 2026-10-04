# Corpus and Normalization Specification

## Corpus contract

The corpus is an immutable, versioned input. An import manifest must record:

- edition name and publication details;
- source URL and retrieval timestamp;
- source license or public-domain statement and jurisdiction notes;
- SHA-256 checksum of the unmodified download;
- importer version and configuration;
- book ordering and versification notes;
- verse, chapter, and book counts after import;
- SHA-256 checksum of the canonical exported verse table.

Selected source: [Bible Protector's first-party Pure Cambridge Edition text archive](https://bibleprotector.com/TEXT-PCE.zip). Its source page explicitly presents the downloadable files for any use, including further publishing. The archive is pinned by the checksums in `data/source/README.md`; a changed live download is a new candidate corpus version, never an automatic replacement.

[Project Gutenberg eBook 10](https://www.gutenberg.org/ebooks/10) is a secondary validation source only. It is not textually identical to the selected PCE and does not preserve italic spans. General KJV background is available from [BibleGateway](https://www.biblegateway.com/versions/King-James-Version-KJV-Bible/). Licensing must still be evaluated for the deployment jurisdiction; the KJV has special publication rules in the United Kingdom.

Never fetch a third-party Bible API during ordinary search. Network sources may bootstrap a corpus only through the audited importer.

## Selected source format

`TEXT-PCE.txt` is a Windows-1252, CRLF-delimited file with exactly one verse record per line:

```text
Ge 1:1 In the beginning God created the heaven and the earth.
```

The importer must:

- map all 66 publisher book codes through a fixed reviewed table;
- parse the reference before interpreting any text markup;
- preserve the original decoded record and its source byte range;
- store square-bracket spans as italic formatting while retaining their words in the canonical display text;
- store double-angle-bracket material as typed paratext;
- exclude terminal markers such as `THE END` from verse-token ranking;
- emit an anomaly instead of guessing when brackets or markers are unbalanced;
- verify the archive checksum, member checksum, record count, reference uniqueness, and canonical order before producing derived data.

## Stored text layers

For each verse, retain these separately:

| Layer | Purpose | May alter display text? |
|---|---|---:|
| Raw source | Provenance and re-import verification | No |
| Canonical display | Exact application display and quotation | No |
| Surface tokens | Exact word lookup with original spelling | No |
| Folded tokens | Case-insensitive matching | No |
| Normalized tokens | Explicit spelling/typography aliases | No |
| Lemma candidates | Optional morphological grouping | No |

The canonical display layer is authoritative for quotations. Derived layers exist only for retrieval.

## Tokenization

The tokenizer must be a pure, versioned function.

- Use Unicode-aware word boundaries.
- Preserve the original token text and character offsets.
- Fold case with a documented locale-independent rule.
- Treat possessives, hyphens, apostrophes, and punctuation through fixtures rather than undocumented library defaults.
- Preserve verse order and within-verse token position.
- Index numbers only if verified as part of the selected corpus text; reference numbers are metadata, not verse tokens.

## Normalization

Normalization is opt-in and explainable. Each normalized token stores the rule that produced it.

Allowed initial rules:

- case folding;
- typographic apostrophe equivalence;
- a reviewed archaic spelling alias table;
- an optional reviewed inflection/lemma table.

Disallowed initial rules:

- automatic paraphrase;
- embedding similarity;
- undocumented stemmers;
- replacing KJV words with modern words in display text;
- merging words merely because a language model considers them related.

When `shew` is associated with `show`, for example, the UI must identify that as a configured spelling alias. Exact mode must not treat them as identical.

## Stop words and frequency

Do not delete stop words from the corpus. Exact phrase search needs them. In similarity mode, use inverse document frequency to reduce the influence of very common terms. A versioned stop-word list may additionally set selected tokens to zero similarity weight, but those tokens remain visible in phrase evidence and exact occurrence results.

Document frequency is the count of verses containing the token, not the token's total occurrence count. Compute IDF from the imported corpus using the formula in `SCORING_SPEC.md`.

## External vocabulary bridge

If a query has no exact KJV occurrence:

1. show the zero-result fact;
2. offer external expansion;
3. retrieve definitions from an approved source such as [Princeton WordNet](https://wordnet.princeton.edu/license-and-commercial-use);
4. store provider, source URL, retrieval time, license, headword, part of speech, sense ID, definition, and candidate synonyms;
5. require the user to select a sense when more than one material sense exists;
6. intersect candidate words with the KJV vocabulary;
7. display the surviving KJV terms for user selection;
8. run normal deterministic searches for those terms.

The bridge is external metadata. It must not be described as a biblical definition.

## Validation gates

- Expected canonical book order is exact.
- Book, chapter, and verse identifiers are unique.
- No verse text is empty.
- Reference parsing round-trips every row.
- Raw-to-canonical transformations are fully logged.
- Re-importing the same file yields identical canonical checksums.
- Known punctuation, possessive, archaic spelling, and phrase fixtures pass.

