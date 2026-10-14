import test from "node:test";
import assert from "node:assert/strict";
import { parseReference, tokenize } from "../../corpus/src/index.ts";
import { inverseDocumentFrequency, scoreVersePair, sortExplanations } from "../src/index.ts";
import type { ScoringConfig, ScoringVerse } from "../src/index.ts";

const config: ScoringConfig = {
  algorithmVersion: "1.1.0",
  corpusSize: 100,
  documentFrequency: { a: 90, gathered: 2, word: 10, is: 80, kept: 8 },
  tokenMultipliers: { a: 0 },
  rareThreshold: 5,
  rareCap: 12,
  phraseCap: 25,
  matchLevel: "exact_spelling",
  phraseLevelMultipliers: { caseExact: 1, caseFolded: 0.8, normalized: 0.5 },
  weights: { jaccard: 0.4, phrase: 0.2, rare: 0.15, order: 0.1, capitalization: 0.1, crossReference: 0.05 },
};

function verse(reference: string, text: string): ScoringVerse {
  return { reference: parseReference(reference).start, tokens: tokenize(text) };
}

test("uses the specified IDF formula", () => {
  assert.equal(inverseDocumentFrequency(100, 100), 1);
  assert.ok(inverseDocumentFrequency(100, 1) > inverseDocumentFrequency(100, 50));
});

test("scores identical searchable text with full Jaccard and stable evidence", () => {
  const source = verse("Genesis 1:1", "the gathered word");
  const result = scoreVersePair(source, verse("John 1:1", "the gathered word"), config, { corpusVersion: "fixture-v1" });
  assert.equal(result.components.jaccard, 1);
  assert.deepEqual(result.matchedPhrases[0]?.tokens, ["the", "gathered", "word"]);
  assert.ok(result.rareTokens.some(({ token }) => token === "gathered"));
  assert.deepEqual(result.candidateReasons, ["shared_nonzero_token", "shared_exact_phrase"]);
  assert.equal(result.components.capitalization, 0.942751);
  assert.equal(result.capitalizationEvidence[0]?.reason, "identical_sentence_start");
  assert.equal(result.matchedPhrases[0]?.level, "case_exact");
});

test("weights capitalization by position and reports edition-specific evidence", () => {
  const result = scoreVersePair(
    verse("Genesis 1:1", "Word is kept"),
    verse("John 1:1", "a word is kept"),
    config,
    { corpusVersion: "fixture-v1" },
  );
  const word = result.capitalizationEvidence.find((item) => item.token === "word");
  assert.equal(word?.multiplier, 0.25);
  assert.equal(word?.reason, "different_only_sentence_start");
  assert.equal(result.matchedPhrases[0]?.level, "case_folded");
  assert.equal(result.matchedPhrases[0]?.multiplier, 0.8);
});

test("letter-exact mode does not admit a token whose capitalization differs", () => {
  const letterExact = { ...config, matchLevel: "letter_exact" as const };
  const result = scoreVersePair(
    verse("Genesis 1:1", "the Spirit"),
    verse("John 1:1", "the spirit"),
    letterExact,
    { corpusVersion: "fixture-v1" },
  );
  assert.deepEqual(result.matchedTokens.map((item) => item.token), ["the"]);
  assert.equal(result.matchedPhrases.length, 0);
});

test("letter-exact matches still use the folded corpus key for rarity", () => {
  const letterExact = {
    ...config,
    matchLevel: "letter_exact" as const,
    documentFrequency: { ...config.documentFrequency, spirit: 2 },
  };
  const result = scoreVersePair(
    verse("Genesis 1:1", "Spirit"),
    verse("John 1:1", "Spirit"),
    letterExact,
    { corpusVersion: "fixture-v1" },
  );
  assert.equal(result.components.jaccard, 1);
  assert.deepEqual(result.rareTokens.map((item) => item.documentFrequency), [2]);
});

test("normalized phrases receive derived-tier credit without double counting", () => {
  const normalized = { ...config, matchLevel: "normalized" as const };
  const source = { ...verse("Genesis 1:1", "I shew thee"), normalizedTokens: ["i", "show", "thee"] };
  const target = { ...verse("John 1:1", "I show thee"), normalizedTokens: ["i", "show", "thee"] };
  const result = scoreVersePair(source, target, normalized, { corpusVersion: "fixture-v1" });
  assert.equal(result.matchedPhrases.length, 1);
  assert.equal(result.matchedPhrases[0]?.level, "normalized");
  assert.equal(result.matchedPhrases[0]?.multiplier, 0.5);
});

test("zero-weight tokens remain phrase evidence but add no Jaccard weight", () => {
  const result = scoreVersePair(verse("Genesis 1:1", "a word"), verse("Exodus 1:1", "a kept"), config, { corpusVersion: "fixture-v1" });
  assert.equal(result.components.jaccard, 0);
  assert.equal(result.matchedNormalizedTokens.includes("a"), true);
  assert.deepEqual(result.candidateReasons, []);
});

test("rejects invalid scoring weights", () => {
  const invalid = { ...config, weights: { ...config.weights, jaccard: 0.6 } };
  assert.throws(() => scoreVersePair(verse("Genesis 1:1", "word"), verse("Exodus 1:1", "word"), invalid, { corpusVersion: "fixture-v1" }), /sum to 1/);
});

test("tie-breaking ends in canonical order and ignores input order", () => {
  const source = verse("Genesis 1:1", "gathered word");
  const later = scoreVersePair(source, verse("John 1:1", "gathered kept"), config, { corpusVersion: "fixture-v1" });
  const earlier = scoreVersePair(source, verse("Exodus 1:1", "gathered kept"), config, { corpusVersion: "fixture-v1" });
  assert.deepEqual(sortExplanations([later, earlier]).map((item) => item.reference.book), ["Exodus", "John"]);
});
