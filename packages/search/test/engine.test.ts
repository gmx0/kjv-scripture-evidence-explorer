import test from "node:test";
import assert from "node:assert/strict";
import { parseReference, tokenize } from "../../corpus/src/index.ts";
import { buildSearchEngine } from "../src/engine.ts";
import type { ImportedVerse } from "../../corpus/src/importer.ts";

function verse(reference: string, displayText: string): ImportedVerse {
  const parsed = parseReference(reference).start;
  return {
    reference: parsed,
    sourceBookCode: parsed.book.slice(0, 2),
    rawRecord: displayText,
    sourceLine: 1,
    sourceByteStart: 0,
    sourceByteEnd: displayText.length,
    displayText,
    italics: [],
    paratext: [],
  };
}

const fixture = [
  verse("Genesis 1:1", "In the beginning God created the heaven and the earth."),
  verse("Genesis 1:2", "And the earth was without form, and void; and darkness was upon the face of the deep."),
  verse("John 1:1", "In the beginning was the Word, and the Word was with God, and the Word was God."),
  verse("John 1:2", "The same was in the beginning with God."),
];

test("builds occurrence statistics from unique verse membership", () => {
  const engine = buildSearchEngine(fixture, { corpusVersion: "fixture-v1", algorithmVersion: "1.1.0" });
  assert.equal(engine.statistics.documentFrequency.word, 1);
  assert.equal(engine.statistics.totalFrequency.word, 3);
  assert.equal(engine.statistics.documentFrequency.beginning, 3);
});

test("exact word search distinguishes case when requested", () => {
  const engine = buildSearchEngine(fixture, { corpusVersion: "fixture-v1", algorithmVersion: "1.1.0" });
  assert.equal(engine.searchExactWord("word", { caseSensitive: false }).total, 1);
  assert.equal(engine.searchExactWord("word", { caseSensitive: true }).total, 0);
  assert.equal(engine.searchExactWord("Word", { caseSensitive: true }).total, 1);
});

test("exact phrase search requires contiguous tokens and returns positions", () => {
  const engine = buildSearchEngine(fixture, { corpusVersion: "fixture-v1", algorithmVersion: "1.1.0" });
  const result = engine.searchExactPhrase("in the beginning");
  assert.deepEqual(result.matches.map((match) => match.reference.book), ["Genesis", "John", "John"]);
  assert.deepEqual(result.matches.map((match) => match.startPositions), [[0], [0], [3]]);
  assert.equal(engine.searchExactPhrase("beginning created").total, 0);
});

test("term distribution exposes canonical first and last mentions", () => {
  const engine = buildSearchEngine(fixture, { corpusVersion: "fixture-v1", algorithmVersion: "1.1.0" });
  const distribution = engine.termDistribution("beginning");
  assert.equal(distribution.firstMention?.book, "Genesis");
  assert.equal(distribution.lastMention?.book, "John");
  assert.deepEqual(distribution.byBook, { Genesis: 1, John: 2 });
});

test("term distribution is not truncated by result-page limits", () => {
  const many = Array.from({ length: 501 }, (_, index) => verse(`Psalms ${index + 1}:1`, "Repeated token"));
  const engine = buildSearchEngine(many, { corpusVersion: "fixture-v1", algorithmVersion: "1.1.0" });
  const distribution = engine.termDistribution("token");
  assert.equal(distribution.verseFrequency, 501);
  assert.equal(distribution.byBook.Psalms, 501);
  assert.equal(distribution.lastMention?.chapter, 501);
});

test("related search is deterministic, explained, and excludes the source", () => {
  const engine = buildSearchEngine(fixture, { corpusVersion: "fixture-v1", algorithmVersion: "1.1.0" });
  const first = engine.related("Genesis 1:1", { limit: 3 });
  const second = engine.related("Genesis 1:1", { limit: 3 });
  assert.deepEqual(first, second);
  assert.equal(first.results.some((result) => result.reference.book === "Genesis" && result.reference.verse === 1), false);
  assert.equal(first.results[0]?.reference.book, "John");
  assert.ok(first.results[0]?.candidateReasons.includes("shared_nonzero_token"));
  assert.ok(first.results[0]!.matchedNormalizedTokens.length > 0);
});

test("related strictness changes candidate admission and configuration identity", () => {
  const engine = buildSearchEngine([
    verse("Genesis 1:1", "Spirit moved"),
    verse("John 1:1", "spirit moved"),
  ], { corpusVersion: "fixture-v1", algorithmVersion: "1.1.0" });
  const spelling = engine.related("Genesis 1:1", { matchLevel: "exact_spelling" });
  const letters = engine.related("Genesis 1:1", { matchLevel: "letter_exact" });
  assert.equal(spelling.results[0]?.matchedTokens.some((item) => item.token === "spirit"), true);
  assert.equal(letters.results[0]?.matchedTokens.some((item) => item.token === "Spirit"), false);
  assert.notEqual(spelling.meta.configurationSha256, letters.meta.configurationSha256);
});

test("tokenization used by the index remains the public tokenizer", () => {
  const engine = buildSearchEngine(fixture, { corpusVersion: "fixture-v1", algorithmVersion: "1.1.0" });
  assert.deepEqual(engine.verses[0]?.tokens, tokenize(fixture[0]!.displayText));
});
