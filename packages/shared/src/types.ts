export interface CanonicalReference {
  book: string;
  bookOrder: number;
  chapter: number;
  verse: number;
}

export interface ReferenceRange {
  start: CanonicalReference;
  end: CanonicalReference;
}

export interface Token {
  position: number;
  charStart: number;
  charEnd: number;
  surface: string;
  folded: string;
}

export interface CorpusVerse {
  reference: CanonicalReference;
  displayText: string;
  tokens: Token[];
}

export interface CorpusManifest {
  schemaVersion: "1.0.0";
  corpusVersion: string;
  edition: string;
  sourceUrl: string;
  sourceMember: string;
  retrievedAt: string;
  sourceSha256: string;
  memberSha256: string;
  canonicalSha256: string;
  importerVersion: string;
  encoding: string;
  lineEndings: string;
  canonicalFormat: string;
  bookOrder: string[];
  counts: {
    books: number;
    chapters: number;
    verses: number;
    italicSpans: number;
    paratextItems: number;
  };
  license: {
    statement: string;
    jurisdictionNotes: string;
  };
}
