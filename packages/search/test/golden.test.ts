import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { importPceArchive } from "../../corpus/src/index.ts";
import { buildSearchEngine } from "../src/engine.ts";

const sourcePath = resolve("data/source/TEXT-PCE.zip");
const goldenPath = resolve("tests/golden/phase1-related.json");

test("reviewed full-corpus related-verse rankings match the golden fixture", { skip: !existsSync(sourcePath) }, () => {
  assert.equal(existsSync(goldenPath), true, "Phase 1 golden fixture must exist");
  const fixture = JSON.parse(readFileSync(goldenPath, "utf8"));
  const corpus = importPceArchive(sourcePath);
  const engine = buildSearchEngine(corpus.verses, { corpusVersion: corpus.report.corpusVersion, algorithmVersion: fixture.algorithmVersion });
  assert.equal(corpus.report.canonicalSha256, fixture.canonicalSha256);
  assert.equal(engine.configurationSha256, fixture.configurationSha256);
  for (const query of fixture.queries) {
    const result = engine.related(query.reference, { limit: query.results.length });
    assert.deepEqual(
      result.results.map((item) => ({
        reference: `${item.reference.book} ${item.reference.chapter}:${item.reference.verse}`,
        score: item.score,
        matchedNormalizedTokens: item.matchedNormalizedTokens,
        matchedPhrases: item.matchedPhrases.map((phrase) => phrase.tokens.join(" ")),
      })),
      query.results,
      query.reference,
    );
  }
});
