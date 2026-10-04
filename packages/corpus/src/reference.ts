import type { CanonicalReference, ReferenceRange } from "../../shared/src/index.ts";
import { resolveBook } from "./books.ts";

const REFERENCE_PATTERN = /^(.+?)\s+(\d+):(\d+)(?:\s*[-–]\s*(?:(\d+):)?(\d+))?$/u;

export class ReferenceParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReferenceParseError";
  }
}

export function parseReference(input: string): ReferenceRange {
  const match = REFERENCE_PATTERN.exec(input.trim());
  if (!match) throw new ReferenceParseError(`Invalid reference syntax: ${input}`);

  const [, bookInput, chapterText, verseText, endChapterText, endVerseText] = match;
  const resolved = resolveBook(bookInput!);
  if (!resolved) throw new ReferenceParseError(`Unknown book: ${bookInput}`);

  const chapter = positiveInteger(chapterText!, "chapter");
  const verse = positiveInteger(verseText!, "verse");
  const endChapter = endChapterText ? positiveInteger(endChapterText, "end chapter") : chapter;
  const endVerse = endVerseText ? positiveInteger(endVerseText, "end verse") : verse;

  const start = makeReference(resolved.book.name, resolved.bookOrder, chapter, verse);
  const end = makeReference(resolved.book.name, resolved.bookOrder, endChapter, endVerse);
  if (compareReferences(end, start) < 0) throw new ReferenceParseError("Reference range ends before it starts");
  return { start, end };
}

function positiveInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new ReferenceParseError(`${label} must be a positive integer`);
  return parsed;
}

function makeReference(book: string, bookOrder: number, chapter: number, verse: number): CanonicalReference {
  return { book, bookOrder, chapter, verse };
}

export function compareReferences(left: CanonicalReference, right: CanonicalReference): number {
  return left.bookOrder - right.bookOrder || left.chapter - right.chapter || left.verse - right.verse;
}

export function formatReference(reference: CanonicalReference): string {
  return `${reference.book} ${reference.chapter}:${reference.verse}`;
}

export function formatReferenceRange(range: ReferenceRange): string {
  const start = formatReference(range.start);
  if (compareReferences(range.start, range.end) === 0) return start;
  const end = range.start.chapter === range.end.chapter
    ? String(range.end.verse)
    : `${range.end.chapter}:${range.end.verse}`;
  return `${start}-${end}`;
}
