import test from "node:test";
import assert from "node:assert/strict";
import { parseReference, tokenize } from "../../corpus/src/index.ts";
import { inverseDocumentFrequency, scoreVersePair, sortExplanations } from "../src/index.ts";
import type { ScoringConfig, ScoringVerse } from "../src/index.ts";

const config: ScoringConfig = {
  algorithmVersion: "1.0.0-draft",
  corpusSize: 100,
  documentFrequency: { a: 90, gathered: 2, word: 10, is: 80, kept: 8 },
  tokenMultipliers: { a: 0 },
  rareThreshold: 5,
  rareCap: 12,
  phraseCap: 25,
  weights: { jaccard: 0.5, phrase: 0.2, rare: 0.15, order: 0.1, crossReference: 0.05 },
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
