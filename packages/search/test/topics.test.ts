import assert from "node:assert/strict";
import test from "node:test";
import type { ImportedVerse } from "../../corpus/src/importer.ts";
import { parseReference } from "../../corpus/src/reference.ts";
import { buildSearchEngine } from "../src/engine.ts";
import { resolveTopic, TopicResolutionError } from "../src/topics.ts";
import type { DictionaryProvider, DictionarySnapshot } from "../src/topics.ts";

const texts = [
  ["Genesis 1:1", "In the beginning God created the heaven and the earth."],
  ["Psalm 34:14", "Depart from evil, and do good; seek peace, and pursue it."],
  ["Isaiah 57:21", "There is no peace, saith my God, to the wicked."],
  ["Matthew 5:9", "Blessed are the peacemakers: for they shall be called the children of God."],
] as const;
const verses: ImportedVerse[] = texts.map(([label, displayText], index) => ({
  reference: parseReference(label).start, sourceBookCode: `fixture-${index}`, displayText, rawRecord: displayText,
  sourceLine: index + 1, sourceByteStart: 0, sourceByteEnd: displayText.length, italics: [], paratext: [],
}));
const engine = buildSearchEngine(verses, { corpusVersion: "fixture-v1", algorithmVersion: "1.0.0" });

const snapshot: DictionarySnapshot = {
  provider: "Princeton WordNet",
  providerVersion: "3.0",
  sourceUrl: "https://wordnetcode.princeton.edu/3.0/WNdb-3.0.tar.gz",
  retrievedAt: "2026-10-04T00:00:00.000Z",
  license: "WordNet 3.0 License",
  payloadSha256: "a".repeat(64),
  headword: "harmony",
  senses: [
    { id: "wn30:n:00000001", partOfSpeech: "noun", definition: "agreement of opinion", synonyms: ["harmony", "agreement", "peace"] },
    { id: "wn30:n:00000002", partOfSpeech: "noun", definition: "a pleasing arrangement of musical notes", synonyms: ["harmony", "concord", "music"] },
  ],
};
const provider: DictionaryProvider = { available: true, lookup: () => snapshot };

test("exact KJV wording stops before the external dictionary bridge", () => {
  let calls = 0;
  const result = resolveTopic(engine, { topic: "peace" }, { available: true, lookup: () => { calls += 1; return snapshot; } });
  assert.equal(result.status, "exact_kjv");
  assert.equal(calls, 0);
  assert.equal(result.exact.total, 2);
});

test("ambiguous modern topics cannot bypass explicit sense selection", () => {
  const result = resolveTopic(engine, { topic: "harmony" }, provider);
  assert.equal(result.status, "requires_sense_selection");
  assert.equal(result.senses.length, 2);
  assert.equal("rankings" in result, false);
  assert.equal(result.provenance.provider, "Princeton WordNet");
});

test("selected sense exposes only WordNet candidates that occur in the KJV", () => {
  const result = resolveTopic(engine, { topic: "harmony", selectedSenseId: "wn30:n:00000001" }, provider);
  assert.equal(result.status, "requires_candidate_selection");
  assert.deepEqual(result.candidates.map((candidate) => candidate.term), ["peace"]);
  assert.equal(result.candidates[0]?.evidenceType, "external_synonym_bridge");
});

test("selected candidates produce separate exact rankings and a labeled combined view", () => {
  const result = resolveTopic(engine, { topic: "harmony", selectedSenseId: "wn30:n:00000001", selectedCandidates: ["peace"] }, provider);
  assert.equal(result.status, "resolved");
  assert.deepEqual(result.perCandidate[0]?.results.map((item) => item.label), ["Psalms 34:14", "Isaiah 57:21"]);
  assert.deepEqual(result.combined.map((item) => item.winningTerm), ["peace", "peace"]);
  assert.ok(result.combined.every((item) => item.externalBridge.evidenceType === "external_synonym_bridge"));
});

test("invalid senses, unoffered candidates, and unavailable offline data fail visibly", () => {
  assert.throws(() => resolveTopic(engine, { topic: "harmony", selectedSenseId: "missing" }, provider), (error) => error instanceof TopicResolutionError && error.status === 422);
  assert.throws(() => resolveTopic(engine, { topic: "harmony", selectedSenseId: "wn30:n:00000001", selectedCandidates: ["music"] }, provider), (error) => error instanceof TopicResolutionError && error.status === 422);
  assert.throws(() => resolveTopic(engine, { topic: "harmony" }, { available: false, lookup: () => { throw new Error("offline"); } }), (error) => error instanceof TopicResolutionError && error.status === 503);
});
