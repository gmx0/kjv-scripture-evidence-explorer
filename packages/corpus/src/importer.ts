import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { BOOKS } from "./books.ts";
import type { CanonicalReference } from "../../shared/src/index.ts";

export const IMPORTER_VERSION = "0.1.0";
export const CORPUS_VERSION = "KJV-PCE-BP-2010-v1";
export const PINNED_ARCHIVE_SHA256 = "ca6421515980a4a7387b5dbac3aa9cc586c7e6460fa1a92339b04fe58a162cf0";
export const PINNED_MEMBER_SHA256 = "ff6be20054adb077ab4e3ba27268a81ad9bf17fed02009393f5ce237f9c424e5";
export const PCE_MEMBER_NAME = "TEXT-PCE.txt";

const PCE_BOOK_CODES = [
  "Ge", "Ex", "Le", "Nu", "De", "Jos", "Jg", "Ru", "1Sa", "2Sa", "1Ki", "2Ki", "1Ch", "2Ch",
  "Ezr", "Ne", "Es", "Job", "Ps", "Pr", "Ec", "Song", "Isa", "Jer", "La", "Eze", "Da", "Ho", "Joe",
  "Am", "Ob", "Jon", "Mic", "Na", "Hab", "Zep", "Hag", "Zec", "Mal", "Mt", "Mr", "Lu", "Joh", "Ac",
  "Ro", "1Co", "2Co", "Ga", "Eph", "Php", "Col", "1Th", "2Th", "1Ti", "2Ti", "Tit", "Phm", "Heb",
  "Jas", "1Pe", "2Pe", "1Jo", "2Jo", "3Jo", "Jude", "Re",
] as const;

if (PCE_BOOK_CODES.length !== BOOKS.length) throw new Error("PCE book-code table must contain 66 entries");

const BOOK_BY_CODE = new Map<string, (typeof BOOKS)[number] & { bookOrder: number }>(
  PCE_BOOK_CODES.map((code, index) => [code, { ...BOOKS[index]!, bookOrder: index + 1 }]),
);
const RECORD_PATTERN = /^([1-3]?[A-Za-z]+) (\d+):(\d+) (.+)$/u;

export type ParatextType = "heading" | "subscription" | "terminal";

export interface ItalicSpan {
  start: number;
  end: number;
  source: "pce_square_brackets";
}

export interface ParatextItem {
  type: ParatextType;
  raw: string;
  text: string;
}

export interface ImportedVerse {
  reference: CanonicalReference;
  sourceBookCode: string;
  rawRecord: string;
  sourceLine: number;
  sourceByteStart: number;
  sourceByteEnd: number;
  displayText: string;
  italics: ItalicSpan[];
  paratext: ParatextItem[];
}

export interface ImportIssue {
  code: string;
  message: string;
  line?: number;
  reference?: string;
}

export interface ImportReport {
  corpusVersion: string;
  importerVersion: string;
  sourceSha256: string | null;
  memberSha256: string | null;
  canonicalSha256: string;
  counts: { books: number; chapters: number; verses: number; italicSpans: number; paratextItems: number };
  errors: ImportIssue[];
  warnings: ImportIssue[];
}

export interface ImportResult {
  verses: ImportedVerse[];
  canonicalJsonl: string;
  report: ImportReport;
}

export interface ImportOptions {
  expectedBookCount?: number;
  expectedVerseCount?: number;
  validateFullCanon?: boolean;
  sourceSha256?: string | null;
  memberSha256?: string | null;
}

export function importPceArchive(archivePath: string): ImportResult {
  const archive = readFileSync(archivePath);
  const sourceSha256 = digest(archive);
  const member = extractZipMember(archive, PCE_MEMBER_NAME);
  const memberSha256 = digest(member);
  const text = decodeWindows1252(member);
  const result = importPceText(text, { sourceSha256, memberSha256, validateFullCanon: true });
  if (sourceSha256 !== PINNED_ARCHIVE_SHA256) {
    result.report.errors.unshift({ code: "source_checksum_mismatch", message: `Expected ${PINNED_ARCHIVE_SHA256}, received ${sourceSha256}` });
  }
  if (memberSha256 !== PINNED_MEMBER_SHA256) {
    result.report.errors.unshift({ code: "member_checksum_mismatch", message: `Expected ${PINNED_MEMBER_SHA256}, received ${memberSha256}` });
  }
  return result;
}

const WINDOWS_1252_C1 = [
  "€", "\u0081", "‚", "ƒ", "„", "…", "†", "‡", "ˆ", "‰", "Š", "‹", "Œ", "\u008d", "Ž", "\u008f",
  "\u0090", "‘", "’", "“", "”", "•", "–", "—", "˜", "™", "š", "›", "œ", "\u009d", "ž", "Ÿ",
] as const;

export function decodeWindows1252(bytes: Uint8Array): string {
  let output = "";
  for (const byte of bytes) {
    output += byte >= 0x80 && byte <= 0x9f ? WINDOWS_1252_C1[byte - 0x80]! : String.fromCharCode(byte);
  }
  return output;
}

export function importPceText(text: string, options: ImportOptions = {}): ImportResult {
  const expectedBookCount = options.expectedBookCount ?? 66;
  const expectedVerseCount = options.expectedVerseCount ?? 31_102;
  const validateFullCanon = options.validateFullCanon ?? true;
  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  const verses: ImportedVerse[] = [];
  const seen = new Set<string>();
  const lines = text.split(/\r?\n/u);
  let byteCursor = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const rawRecord = lines[index]!;
    const line = index + 1;
    const sourceByteStart = byteCursor;
    const sourceByteEnd = sourceByteStart + rawRecord.length;
    byteCursor = sourceByteEnd + (text.startsWith("\r\n", sourceByteEnd) ? 2 : index < lines.length - 1 ? 1 : 0);
    if (!rawRecord) continue;

    const match = RECORD_PATTERN.exec(rawRecord);
    if (!match) {
      errors.push({ code: "malformed_record", message: "Record does not match '<book> <chapter>:<verse> <text>'", line });
      continue;
    }
    const [, sourceBookCode, chapterText, verseText, markedText] = match;
    const book = BOOK_BY_CODE.get(sourceBookCode!);
    if (!book) {
      errors.push({ code: "unknown_book_code", message: `Unknown PCE book code '${sourceBookCode}'`, line });
      continue;
    }
    const reference: CanonicalReference = {
      book: book.name,
      bookOrder: book.bookOrder,
      chapter: Number(chapterText),
      verse: Number(verseText),
    };
    const referenceLabel = label(reference);
    if (seen.has(referenceLabel)) errors.push({ code: "duplicate_reference", message: `Duplicate reference ${referenceLabel}`, line, reference: referenceLabel });
    seen.add(referenceLabel);

    const paratextResult = extractParatext(markedText!);
    if (paratextResult.unbalanced) errors.push({ code: "unbalanced_paratext", message: "Unbalanced double-angle paratext marker", line, reference: referenceLabel });
    const italicResult = extractItalics(paratextResult.verseText);
    if (italicResult.unbalanced) errors.push({ code: "unbalanced_italics", message: "Unbalanced or nested italic marker", line, reference: referenceLabel });

    verses.push({
      reference,
      sourceBookCode: sourceBookCode!,
      rawRecord,
      sourceLine: line,
      sourceByteStart,
      sourceByteEnd,
      displayText: italicResult.displayText,
      italics: italicResult.spans,
      paratext: paratextResult.items,
    });
  }

  validateSequence(verses, errors, validateFullCanon);
  const bookCount = new Set(verses.map((verse) => verse.reference.bookOrder)).size;
  const chapterCount = new Set(verses.map((verse) => `${verse.reference.bookOrder}:${verse.reference.chapter}`)).size;
  if (verses.length !== expectedVerseCount) errors.push({ code: "unexpected_verse_count", message: `Expected ${expectedVerseCount} verses, received ${verses.length}` });
  if (bookCount !== expectedBookCount) errors.push({ code: "unexpected_book_count", message: `Expected ${expectedBookCount} books, received ${bookCount}` });
  if (verses.some((verse) => !verse.displayText)) errors.push({ code: "empty_verse", message: "One or more verses have empty display text" });

  const canonicalJsonl = serializeCanonicalVerses(verses);
  const report: ImportReport = {
    corpusVersion: CORPUS_VERSION,
    importerVersion: IMPORTER_VERSION,
    sourceSha256: options.sourceSha256 ?? null,
    memberSha256: options.memberSha256 ?? null,
    canonicalSha256: digest(Buffer.from(canonicalJsonl, "utf8")),
    counts: {
      books: bookCount,
      chapters: chapterCount,
      verses: verses.length,
      italicSpans: verses.reduce((total, verse) => total + verse.italics.length, 0),
      paratextItems: verses.reduce((total, verse) => total + verse.paratext.length, 0),
    },
    errors,
    warnings,
  };
  return { verses, canonicalJsonl, report };
}

export function serializeCanonicalVerses(verses: ImportedVerse[]): string {
  return verses.map((verse) => JSON.stringify({
    reference: verse.reference,
    sourceBookCode: verse.sourceBookCode,
    displayText: verse.displayText,
    italics: verse.italics,
    paratext: verse.paratext,
  })).join("\n") + "\n";
}

function extractParatext(input: string): { verseText: string; items: ParatextItem[]; unbalanced: boolean } {
  const items: ParatextItem[] = [];
  const pattern = /<<(.+?)>>/gu;
  const verseText = input.replace(pattern, (_whole, inner: string) => {
    const raw = inner;
    const text = inner.replaceAll("[", "").replaceAll("]", "");
    items.push({ type: classifyParatext(text), raw, text });
    return "";
  }).trim();
  return { verseText, items, unbalanced: verseText.includes("<<") || verseText.includes(">>") };
}

function classifyParatext(text: string): ParatextType {
  const folded = text.toLowerCase();
  if (folded.includes("the end")) return "terminal";
  if (folded.includes("written") || folded.includes("epistle")) return "subscription";
  return "heading";
}

function extractItalics(input: string): { displayText: string; spans: ItalicSpan[]; unbalanced: boolean } {
  let displayText = "";
  let spanStart: number | null = null;
  let unbalanced = false;
  const spans: ItalicSpan[] = [];
  for (const char of input) {
    if (char === "[") {
      if (spanStart !== null) unbalanced = true;
      else spanStart = displayText.length;
      continue;
    }
    if (char === "]") {
      if (spanStart === null) unbalanced = true;
      else {
        spans.push({ start: spanStart, end: displayText.length, source: "pce_square_brackets" });
        spanStart = null;
      }
      continue;
    }
    displayText += char;
  }
  if (spanStart !== null) unbalanced = true;
  return { displayText, spans, unbalanced };
}

function validateSequence(verses: ImportedVerse[], errors: ImportIssue[], validateFullCanon: boolean): void {
  if (!verses.length) return;
  if (validateFullCanon && label(verses[0]!.reference) !== "Genesis 1:1") {
    errors.push({ code: "unexpected_first_reference", message: `Expected Genesis 1:1, received ${label(verses[0]!.reference)}` });
  }
  for (let index = 1; index < verses.length; index += 1) {
    const previous = verses[index - 1]!.reference;
    const current = verses[index]!.reference;
    const sameChapter = current.bookOrder === previous.bookOrder && current.chapter === previous.chapter && current.verse === previous.verse + 1;
    const nextChapter = current.bookOrder === previous.bookOrder && current.chapter === previous.chapter + 1 && current.verse === 1;
    const nextBook = current.bookOrder === previous.bookOrder + 1 && current.chapter === 1 && current.verse === 1;
    if (!sameChapter && !nextChapter && !nextBook) {
      errors.push({ code: "nonconsecutive_reference", message: `${label(previous)} is followed by ${label(current)}`, line: verses[index]!.sourceLine, reference: label(current) });
    }
  }
  if (validateFullCanon && label(verses.at(-1)!.reference) !== "Revelation 22:21") {
    errors.push({ code: "unexpected_last_reference", message: `Expected Revelation 22:21, received ${label(verses.at(-1)!.reference)}` });
  }
}

function extractZipMember(archive: Buffer, wantedName: string): Buffer {
  const eocdSignature = 0x06054b50;
  let eocd = -1;
  for (let offset = archive.length - 22; offset >= Math.max(0, archive.length - 65_557); offset -= 1) {
    if (archive.readUInt32LE(offset) === eocdSignature) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error("ZIP end-of-central-directory record not found");
  const entryCount = archive.readUInt16LE(eocd + 10);
  let offset = archive.readUInt32LE(eocd + 16);
  for (let index = 0; index < entryCount; index += 1) {
    if (archive.readUInt32LE(offset) !== 0x02014b50) throw new Error("Invalid ZIP central-directory entry");
    const method = archive.readUInt16LE(offset + 10);
    const compressedSize = archive.readUInt32LE(offset + 20);
    const uncompressedSize = archive.readUInt32LE(offset + 24);
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const localOffset = archive.readUInt32LE(offset + 42);
    const name = archive.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    if (name === wantedName) {
      if (archive.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("Invalid ZIP local-file header");
      const localNameLength = archive.readUInt16LE(localOffset + 26);
      const localExtraLength = archive.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = archive.subarray(dataStart, dataStart + compressedSize);
      const result = method === 0 ? Buffer.from(compressed) : method === 8 ? inflateRawSync(compressed) : null;
      if (!result) throw new Error(`Unsupported ZIP compression method ${method}`);
      if (result.length !== uncompressedSize) throw new Error("ZIP member size mismatch");
      return result;
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`ZIP member '${wantedName}' not found`);
}

function digest(input: Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

function label(reference: CanonicalReference): string {
  return `${reference.book} ${reference.chapter}:${reference.verse}`;
}
