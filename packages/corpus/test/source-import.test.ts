import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { importPceArchive } from "../src/importer.ts";

const sourcePath = resolve("data/source/TEXT-PCE.zip");

test("the pinned PCE archive passes every corpus integrity gate", { skip: !existsSync(sourcePath) }, () => {
  const first = importPceArchive(sourcePath);
  const second = importPceArchive(sourcePath);
  assert.deepEqual(first.report.errors, []);
  assert.equal(first.report.counts.books, 66);
  assert.equal(first.report.counts.chapters, 1189);
  assert.equal(first.report.counts.verses, 31102);
  assert.equal(first.report.sourceSha256, "ca6421515980a4a7387b5dbac3aa9cc586c7e6460fa1a92339b04fe58a162cf0");
  assert.equal(first.report.memberSha256, "ff6be20054adb077ab4e3ba27268a81ad9bf17fed02009393f5ce237f9c424e5");
  assert.equal(first.report.canonicalSha256, second.report.canonicalSha256);
  assert.equal(first.canonicalJsonl, second.canonicalJsonl);
});
