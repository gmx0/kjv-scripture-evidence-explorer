import test from "node:test";
import assert from "node:assert/strict";
import { decodeWindows1252, importPceText, serializeCanonicalVerses } from "../src/importer.ts";

test("decodes Windows-1252 punctuation as Unicode rather than C1 controls", () => {
  assert.equal(decodeWindows1252(Uint8Array.from([0x41, 0x92, 0x97, 0x42])), "A’—B");
});

test("imports verse records while separating italics and paratext", () => {
  const source = [
    "Ps 3:1 <<A Psalm of David.>> LORD, how are they increased that trouble me! many [are] they that rise up against me.",
    "Ps 3:2 Many [there be] which say of my soul, [There is] no help for him in God. Selah.",
  ].join("\r\n");

  const result = importPceText(source, { expectedBookCount: 1, expectedVerseCount: 2, validateFullCanon: false });
  assert.deepEqual(result.report.errors, []);
  assert.equal(result.verses[0]?.displayText, "LORD, how are they increased that trouble me! many are they that rise up against me.");
  assert.deepEqual(result.verses[0]?.italics.map((span) => result.verses[0]!.displayText.slice(span.start, span.end)), ["are"]);
  assert.deepEqual(result.verses[0]?.paratext, [{ type: "heading", raw: "A Psalm of David.", text: "A Psalm of David." }]);
  assert.deepEqual(result.verses[1]?.italics.map((span) => result.verses[1]!.displayText.slice(span.start, span.end)), ["there be", "There is"]);
});

test("classifies subscriptions and terminal markers as paratext", () => {
  const source = [
    "Ro 16:27 To God only wise, [be] glory through Jesus Christ for ever. Amen. <<[Written to the Romans from Corinthus.]>>",
    "Re 22:21 The grace of our Lord Jesus Christ [be] with you all. Amen. <<THE END.>>",
  ].join("\r\n");
  const result = importPceText(source, { expectedBookCount: 2, expectedVerseCount: 2, validateFullCanon: false });
  assert.equal(result.verses[0]?.paratext[0]?.type, "subscription");
  assert.equal(result.verses[1]?.paratext[0]?.type, "terminal");
  assert.doesNotMatch(result.verses[1]!.displayText, /THE END/);
});

test("reports malformed markup and nonconsecutive references", () => {
  const source = [
    "Ge 1:1 In the [beginning God created the heaven and the earth.",
    "Ge 1:3 And God said, Let there be light: and there was light.",
  ].join("\r\n");
  const result = importPceText(source, { expectedBookCount: 1, expectedVerseCount: 2, validateFullCanon: false });
  assert.ok(result.report.errors.some((error) => error.code === "unbalanced_italics"));
  assert.ok(result.report.errors.some((error) => error.code === "nonconsecutive_reference"));
});

test("canonical serialization is byte-for-byte deterministic", () => {
  const source = "Ge 1:1 In the beginning God created the heaven and the earth.\r\n";
  const first = importPceText(source, { expectedBookCount: 1, expectedVerseCount: 1, validateFullCanon: false });
  const second = importPceText(source, { expectedBookCount: 1, expectedVerseCount: 1, validateFullCanon: false });
  assert.equal(serializeCanonicalVerses(first.verses), serializeCanonicalVerses(second.verses));
});
