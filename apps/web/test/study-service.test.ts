import assert from "node:assert/strict";
import test from "node:test";
import type { ImportedVerse } from "../../../packages/corpus/src/importer.ts";
import { parseReference } from "../../../packages/corpus/src/reference.ts";
import type { CorpusRepository } from "../src/server/corpus-repository.ts";
import { createStudyService } from "../src/server/study-service.ts";

const TEXTS = [
  ["Genesis 1:1", "In the beginning God created the heaven and the earth."],
  ["Genesis 1:2", "And the earth was without form, and void."],
  ["John 1:1", "In the beginning was the Word, and the Word was with God."],
  ["John 3:16", "For God so loved the world, that he gave his only begotten Son."],
  ["1 John 4:9", "God sent his only begotten Son into the world."],
] as const;

const verses: ImportedVerse[] = TEXTS.map(([label, displayText], index) => ({
  reference: parseReference(label).start,
  sourceBookCode: `fixture-${index}`,
  displayText,
  rawRecord: displayText,
  sourceLine: index + 1,
  sourceByteStart: 0,
  sourceByteEnd: displayText.length,
  italics: [],
  paratext: [],
}));

const repository: CorpusRepository = {
  identity: {
    corpusVersion: "fixture-v1",
    canonicalSha256: "fixture-sha256",
    algorithmVersion: "1.0.0",
  },
  async allVerses() { return verses; },
};

test("passage lookup includes bounded canonical context without changing exact text", async () => {
  const service = await createStudyService(repository);
  const result = service.passage("Genesis 1:1", 1);

  assert.equal(result.data.requested[0]?.displayText, TEXTS[0][1]);
  assert.deepEqual(result.data.context.map((verse) => verse.label), ["Genesis 1:1", "Genesis 1:2"]);
});

test("exact and distribution results share the engine's canonical evidence", async () => {
  const service = await createStudyService(repository);
  const exact = service.exact("beginning", "word", { limit: 20 });
  const distribution = service.distribution("beginning");

  assert.deepEqual(exact.data.matches.map((match) => match.label), ["Genesis 1:1", "John 1:1"]);
  assert.equal(distribution.data.verseFrequency, 2);
  assert.equal(distribution.data.firstMention?.book, "Genesis");
});

test("related API adds display text without changing engine ordering or explanations", async () => {
  const service = await createStudyService(repository);
  const related = service.related({ reference: "John 3:16", limit: 10, filters: {}, algorithmVersion: "1.0.0" });

  assert.equal(related.data.results[0]?.label, "1 John 4:9");
  assert.equal(related.data.results[0]?.displayText, TEXTS[4][1]);
  assert.ok(related.data.results[0]?.matchedNormalizedTokens.includes("begotten"));
});

test("comparison reports common, unique, phrase, and pairwise evidence", async () => {
  const service = await createStudyService(repository);
  const comparison = service.compare(["John 3:16", "1 John 4:9"]);

  assert.ok(comparison.data.commonNormalizedTokens.includes("begotten"));
  assert.ok(comparison.data.uniqueNormalizedTokens["John 3:16"]?.includes("loved"));
  assert.equal(comparison.data.pairs.length, 1);
  assert.ok(comparison.data.pairs[0]!.explanation.score > 0);
});

test("research record export replays the visible deterministic query", async () => {
  const service = await createStudyService(repository);
  const record = service.researchRecord({ mode: "related", input: "John 3:16", limit: 3 });

  assert.equal(record.recordVersion, "1.0.0");
  assert.equal(record.query.mode, "related");
  assert.equal(record.response.meta.corpusVersion, "fixture-v1");
  assert.equal(record.response.data.results.length, 3);
});

test("invalid exact terms and unknown canonical references expose client-safe statuses", async () => {
  const service = await createStudyService(repository);

  assert.throws(() => service.exact("two words", "word"), (error: any) => error.status === 400);
  assert.throws(
    () => service.related({ reference: "John 99:99", algorithmVersion: "1.0.0" }),
    (error: any) => error.status === 404,
  );
});

test("evidence graph API preserves table parity and explanation resolution", async () => {
  const service = await createStudyService(repository);
  const graph = service.evidenceGraph({ reference: "John 3:16", resultLimit: 3, termLimit: 4, nodeLimit: 8 });

  assert.equal(graph.data.edges.length, graph.data.tableRows.length);
  assert.ok(graph.data.edges.every((edge: any) => graph.data.explanations[edge.explanationId]));
  assert.equal(graph.meta.algorithmVersion, "1.0.0");
});

test("WHGW workflow API exposes exact gathering and lexical witnesses", async () => {
  const service = await createStudyService(repository);
  const gathered = service.workflow({ type: "gather_mentions", term: "beginning", limit: 20 });
  const witnesses = service.workflow({ type: "lexical_witnesses", reference: "Genesis 1:1", count: 2 });

  assert.deepEqual(gathered.data.mentions.map((item: any) => item.label), ["Genesis 1:1", "John 1:1"]);
  assert.equal(witnesses.data.independenceBasis, "distinct_canonical_books");
});

test("Phase 3 graph queries can be replayed as research records", async () => {
  const service = await createStudyService(repository);
  const record = service.researchRecord({ mode: "graph", reference: "John 3:16", resultLimit: 2, termLimit: 2, nodeLimit: 5 });

  assert.equal(record.query.mode, "graph");
  assert.equal(record.response.data.tableRows.length, record.response.data.edges.length);
});

test("topic resolution requires an explicit sense and selected KJV candidates", async () => {
  const provider = {
    available: true,
    lookup: () => ({
      provider: "Princeton WordNet", providerVersion: "3.0", sourceUrl: "https://wordnet.example/fixture",
      retrievedAt: "2026-10-04T00:00:00.000Z", license: "WordNet 3.0 License", payloadSha256: "a".repeat(64), headword: "affection",
      senses: [
        { id: "wn30:n:1", partOfSpeech: "noun" as const, definition: "a positive feeling", synonyms: ["affection", "loved"] },
        { id: "wn30:n:2", partOfSpeech: "noun" as const, definition: "a bodily condition", synonyms: ["affection", "condition"] },
      ],
    }),
  };
  const service = await createStudyService(repository, provider);
  const senses = service.topic({ topic: "affection" });
  assert.equal(senses.data.status, "requires_sense_selection");
  assert.equal(senses.data.senses.length, 2);

  const candidates = service.topic({ topic: "affection", selectedSenseId: "wn30:n:1" });
  assert.equal(candidates.data.status, "requires_candidate_selection");
  assert.deepEqual(candidates.data.candidates.map((item: any) => item.term), ["loved"]);

  const resolved = service.topic({ topic: "affection", selectedSenseId: "wn30:n:1", selectedCandidates: ["loved"] });
  assert.equal(resolved.data.status, "resolved");
  assert.equal(resolved.data.perCandidate[0].results[0].externalBridge.evidenceType, "external_synonym_bridge");
});

test("exact KJV topic requests do not require dictionary availability", async () => {
  const service = await createStudyService(repository);
  const result = service.topic({ topic: "begotten" });
  assert.equal(result.data.status, "exact_kjv");
  assert.equal(result.data.exact.total, 2);
});

test("topic research records retain selected external bridge provenance", async () => {
  const provider = {
    available: true,
    lookup: () => ({ provider: "Princeton WordNet", providerVersion: "3.0", sourceUrl: "https://wordnet.example/fixture", retrievedAt: "2026-10-04T00:00:00.000Z", license: "WordNet 3.0 License", payloadSha256: "b".repeat(64), headword: "affection", senses: [{ id: "wn30:n:1", partOfSpeech: "noun" as const, definition: "a positive feeling", synonyms: ["loved"] }] }),
  };
  const service = await createStudyService(repository, provider);
  const record = service.researchRecord({ mode: "topic", request: { topic: "affection", selectedSenseId: "wn30:n:1", selectedCandidates: ["loved"] } });
  assert.equal(record.response.data.provenance.provider, "Princeton WordNet");
  assert.equal(record.response.data.combined[0].winningTerm, "loved");
});
