# ChatGPT Site distribution

This directory records the browser-local static implementation deployed to the public KJV Scripture Evidence Explorer Site.

The exact KJV corpus and WordNet files are generated deployment artifacts and are not duplicated here. Supply the versioned artifacts described by the monorepo corpus and dictionary manifests beneath `data/kjv/` and `data/wordnet/` before serving this distribution locally.

Algorithm changes require all of the following in the same commit:

1. implementation and tests;
2. an incremented algorithm version;
3. an updated `algorithm.html` explanation;
4. an updated root `docs/SCORING_SPEC.md`;
5. reviewed golden-result changes where applicable.

The deployed distribution contains no analytics, accounts, or visitor-data collection.
