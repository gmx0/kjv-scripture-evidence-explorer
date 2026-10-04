import test from "node:test";
import assert from "node:assert/strict";
import { normalizeToken, tokenize } from "../src/index.ts";

test("preserves surfaces and exact character offsets", () => {
  const text = "Spirit, spirit; man's—words.";
  const tokens = tokenize(text);
  assert.deepEqual(tokens.map(({ surface, folded }) => [surface, folded]), [
    ["Spirit", "spirit"], ["spirit", "spirit"], ["man's", "man's"], ["words", "words"],
  ]);
  for (const token of tokens) assert.equal(text.slice(token.charStart, token.charEnd), token.surface);
});

test("case folding preserves typography while normalization records apostrophe equivalence", () => {
  const [token] = tokenize("man’s");
  assert.equal(token?.surface, "man’s");
  assert.equal(token?.folded, "man’s");
  assert.deepEqual(normalizeToken(token!), { normalized: "man's", rules: ["typographic-apostrophe-equivalence"] });
});

test("returns no tokens for punctuation-only input", () => {
  assert.deepEqual(tokenize("— ..."), []);
});
