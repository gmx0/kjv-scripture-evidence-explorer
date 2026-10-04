import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createWordNetProvider, parseWordNetDataLine, parseWordNetIndexLine } from "../src/server/wordnet-provider.ts";

test("WordNet index parsing preserves published sense order and stable offsets", () => {
  const parsed = parseWordNetIndexLine("harmony n 5 4 ! @ ~ + 5 3 04713118 07027180 13969243 07180183 04984180");
  assert.equal(parsed.lemma, "harmony");
  assert.deepEqual(parsed.offsets, [4713118, 7027180, 13969243, 7180183, 4984180]);
});

test("WordNet data parsing keeps synset words, part of speech, and definition separate", () => {
  const parsed = parseWordNetDataLine("04713118 07 n 02 harmony 1 harmoniousness 0 000 | compatibility in opinion and action; \"an example\"");
  assert.equal(parsed.type, "n");
  assert.deepEqual(parsed.words, ["harmony", "harmoniousness"]);
  assert.equal(parsed.definition, "compatibility in opinion and action");
});

test("malformed WordNet rows fail rather than producing guessed senses", () => {
  assert.throws(() => parseWordNetIndexLine("broken"), /Malformed/);
  assert.throws(() => parseWordNetDataLine("00000000 no gloss divider"), /Malformed/);
});

test("cached snapshots remain readable when the imported dictionary is offline", (context) => {
  const root = mkdtempSync(resolve(tmpdir(), "kjv-topic-cache-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const cacheRoot = resolve(root, "cache");
  mkdirSync(cacheRoot);
  const snapshot = { provider: "Princeton WordNet", providerVersion: "3.0", sourceUrl: "https://example.invalid", retrievedAt: "2026-10-04T00:00:00.000Z", license: "WordNet 3.0 License", payloadSha256: "a".repeat(64), headword: "harmony", senses: [] };
  const name = createHash("sha256").update("harmony").digest("hex");
  writeFileSync(resolve(cacheRoot, `${name}.json`), JSON.stringify(snapshot));

  const provider = createWordNetProvider({ dictionaryRoot: resolve(root, "missing"), cacheRoot });
  assert.deepEqual(provider.lookup("harmony"), snapshot);
  provider.cacheSelection?.({ topic: "harmony", snapshot, selectedSense: { id: "wn30:n:1", partOfSpeech: "noun", definition: "agreement", synonyms: ["concord"] }, normalizedSynonymCandidates: [{ term: "concord", normalized: "concord", verseFrequency: 1, totalFrequency: 1, evidenceType: "external_synonym_bridge" }], selectedCandidates: ["concord"] });
  const selectionFile = readdirSync(resolve(cacheRoot, "selections"))[0]!;
  const selection = JSON.parse(readFileSync(resolve(cacheRoot, "selections", selectionFile), "utf8"));
  assert.equal(selection.selectedSense.id, "wn30:n:1");
  assert.deepEqual(selection.selectedCandidates, ["concord"]);
  assert.throws(() => provider.lookup("uncached"), /not installed/);
});
