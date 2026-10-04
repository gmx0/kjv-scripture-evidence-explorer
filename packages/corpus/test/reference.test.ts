import test from "node:test";
import assert from "node:assert/strict";
import { formatReferenceRange, parseReference, ReferenceParseError } from "../src/index.ts";

test("parses and formats a single canonical reference", () => {
  const parsed = parseReference("John 3:16");
  assert.equal(parsed.start.book, "John");
  assert.equal(parsed.start.bookOrder, 43);
  assert.equal(formatReferenceRange(parsed), "John 3:16");
});

test("parses abbreviated and cross-chapter ranges", () => {
  assert.equal(formatReferenceRange(parseReference("1 Cor 13:13-14:1")), "1 Corinthians 13:13-14:1");
  assert.equal(formatReferenceRange(parseReference("Isa 34:15-17")), "Isaiah 34:15-17");
});

test("rejects unknown books, zero values, and reversed ranges", () => {
  assert.throws(() => parseReference("Unknown 1:1"), ReferenceParseError);
  assert.throws(() => parseReference("John 0:1"), ReferenceParseError);
  assert.throws(() => parseReference("John 3:16-15"), ReferenceParseError);
});
