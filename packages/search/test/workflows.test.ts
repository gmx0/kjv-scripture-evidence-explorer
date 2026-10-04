import assert from "node:assert/strict";
import test from "node:test";
import { parseReference } from "../../corpus/src/reference.ts";
import type { ImportedVerse } from "../../corpus/src/importer.ts";
import { buildSearchEngine } from "../src/engine.ts";
import {
  buildEvidenceGraph,
  candidateMates,
  divideTerm,
  firstMentionChain,
  gatherMentions,
  lexicalWitnesses,
} from "../src/workflows.ts";

const fixture: ImportedVerse[] = [
  ["Genesis 1:1", "In the beginning God created the heaven and the earth."],
  ["Genesis 1:2", "And the earth was without form, and void."],
  ["Psalms 90:2", "Before the mountains were brought forth, thou art God."],
  ["John 1:1", "In the beginning was the Word, and the Word was with God."],
  ["John 3:16", "For God so loved the world, that he gave his only begotten Son."],
  ["Romans 1:20", "The invisible things of him from the creation of the world are clearly seen."],
  ["1 John 4:9", "God sent his only begotten Son into the world."],
].map(([label, displayText], index) => ({
  reference: parseReference(label!).start,
  sourceBookCode: `fixture-${index}`,
  rawRecord: displayText!,
  sourceLine: index + 1,
  sourceByteStart: 0,
  sourceByteEnd: displayText!.length,
  displayText: displayText!,
  italics: [],
  paratext: [],
}));

const engine = buildSearchEngine(fixture, { corpusVersion: "fixture-v1", algorithmVersion: "1.0.0" });

test("bounded evidence graph has typed nodes and an accessible row for every explained edge", () => {
  const graph = buildEvidenceGraph(engine, { reference: "Genesis 1:1", resultLimit: 3, termLimit: 4, nodeLimit: 8 });

  assert.ok(graph.nodes.some((node) => node.kind === "verse"));
  assert.ok(graph.nodes.some((node) => node.kind === "term"));
  assert.ok(graph.nodes.length <= 8);
  assert.equal(graph.tableRows.length, graph.edges.length);
  assert.deepEqual(graph.tableRows.map((row) => row.edgeId), graph.edges.map((edge) => edge.id));
  for (const edge of graph.edges) assert.ok(graph.explanations[edge.explanationId]);
});

test("graph construction is deterministic and carries visible evidence labels", () => {
  const options = { reference: "John 3:16", resultLimit: 4, termLimit: 5, nodeLimit: 10 };
  const first = buildEvidenceGraph(engine, options);
  const second = buildEvidenceGraph(engine, options);

  assert.deepEqual(first, second);
  assert.ok(first.edges.every((edge) => edge.evidenceTypes.length > 0));
  assert.ok(first.edges.some((edge) => edge.evidenceTypes.includes("exact_phrase")));
});

test("gather mentions and first-mention chain preserve canonical exact occurrences", () => {
  const gathered = gatherMentions(engine, { term: "beginning", limit: 20 });
  const chain = firstMentionChain(engine, { term: "beginning", limit: 20 });

  assert.deepEqual(gathered.mentions.map((item) => item.label), ["Genesis 1:1", "John 1:1"]);
  assert.equal(chain.firstMention?.label, "Genesis 1:1");
  assert.deepEqual(chain.links.map((link) => [link.source, link.target]), [["Genesis 1:1", "John 1:1"]]);
});

test("candidate mates reuse accepted ranking and divide term only groups observed contexts", () => {
  const mates = candidateMates(engine, { reference: "John 3:16", limit: 5 });
  const divided = divideTerm(engine, { term: "world", exampleLimitPerBook: 2 });

  assert.equal(mates.results[0]?.label, "1 John 4:9");
  assert.equal(divided.totalOccurrences, 3);
  assert.deepEqual(divided.groups.map((group) => group.book), ["John", "Romans", "1 John"]);
  assert.ok(divided.groups.every((group) => group.examples.every((example) => example.context.includes("world"))));
});

test("lexical witnesses select distinct books and state the limited independence basis", () => {
  const witnesses = lexicalWitnesses(engine, { reference: "Genesis 1:1", count: 3, candidateLimit: 20 });

  assert.equal(witnesses.independenceBasis, "distinct_canonical_books");
  assert.equal(new Set(witnesses.witnesses.map((item) => item.reference.book)).size, witnesses.witnesses.length);
  assert.ok(witnesses.witnesses.every((item) => item.explanation.matchedNormalizedTokens.length > 0));
  assert.match(witnesses.notice, /lexical/i);
});

test("workflow limits reject unsafe bounds", () => {
  assert.throws(() => buildEvidenceGraph(engine, { reference: "Genesis 1:1", nodeLimit: 101 }), /nodeLimit/);
  assert.throws(() => lexicalWitnesses(engine, { reference: "Genesis 1:1", count: 4 }), /count/);
});
