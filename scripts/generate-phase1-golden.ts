import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { importPceArchive } from "../packages/corpus/src/index.ts";
import { buildSearchEngine } from "../packages/search/src/index.ts";

const references = [
  "Genesis 1:1",
  "Deuteronomy 6:4",
  "Psalms 23:1",
  "Proverbs 3:5",
  "Isaiah 34:16",
  "Matthew 4:4",
  "John 3:16",
  "Romans 8:1",
  "2 Timothy 3:16",
  "Revelation 22:18"
];

const corpus = importPceArchive(resolve("data/source/TEXT-PCE.zip"));
if (corpus.report.errors.length) throw new Error(JSON.stringify(corpus.report.errors, null, 2));
const engine = buildSearchEngine(corpus.verses, { corpusVersion: corpus.report.corpusVersion, algorithmVersion: "1.0.0" });
const fixture = {
  corpusVersion: corpus.report.corpusVersion,
  canonicalSha256: corpus.report.canonicalSha256,
  algorithmVersion: "1.0.0",
  configurationSha256: engine.configurationSha256,
  reviewStatus: "accepted",
  queries: references.map((reference) => {
    const result = engine.related(reference, { limit: 5 });
    return {
      reference,
      results: result.results.map((item) => ({
        reference: `${item.reference.book} ${item.reference.chapter}:${item.reference.verse}`,
        score: item.score,
        matchedNormalizedTokens: item.matchedNormalizedTokens,
        matchedPhrases: item.matchedPhrases.map((phrase) => phrase.tokens.join(" ")),
      })),
    };
  }),
};
mkdirSync(resolve("tests/golden"), { recursive: true });
writeFileSync(resolve("tests/golden/phase1-related.json"), `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ queries: fixture.queries.length, configurationSha256: fixture.configurationSha256 }, null, 2));
