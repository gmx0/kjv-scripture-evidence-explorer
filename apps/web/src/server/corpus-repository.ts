import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ImportedVerse } from "../../../../packages/corpus/src/importer.ts";
import type { CorpusManifest } from "../../../../packages/shared/src/index.ts";

export interface CorpusIdentity {
  corpusVersion: string;
  canonicalSha256: string;
  algorithmVersion: "1.0.0";
}

export interface CorpusRepository {
  identity: CorpusIdentity;
  allVerses(): Promise<ImportedVerse[]>;
}

interface CanonicalJsonlRow {
  reference: ImportedVerse["reference"];
  sourceBookCode: string;
  displayText: string;
  italics: ImportedVerse["italics"];
  paratext: ImportedVerse["paratext"];
}

export async function createFileCorpusRepository(options: {
  corpusDirectory?: string;
} = {}): Promise<CorpusRepository> {
  const corpusDirectory = options.corpusDirectory ?? locateCorpusDirectory();
  const [manifestText, jsonl] = await Promise.all([
    readFile(resolve(corpusDirectory, "manifest.json"), "utf8"),
    readFile(resolve(corpusDirectory, "verses.jsonl"), "utf8"),
  ]);
  const manifest = JSON.parse(manifestText) as CorpusManifest;
  let byteCursor = 0;
  const verses = jsonl.trimEnd().split("\n").map((line, index) => {
    const row = JSON.parse(line) as CanonicalJsonlRow;
    const byteLength = Buffer.byteLength(line, "utf8");
    const verse: ImportedVerse = {
      ...row,
      rawRecord: line,
      sourceLine: index + 1,
      sourceByteStart: byteCursor,
      sourceByteEnd: byteCursor + byteLength,
    };
    byteCursor += byteLength + 1;
    return verse;
  });

  if (verses.length !== manifest.counts.verses) {
    throw new Error(`Corpus row count mismatch: expected ${manifest.counts.verses}, received ${verses.length}`);
  }

  return {
    identity: {
      corpusVersion: manifest.corpusVersion,
      canonicalSha256: manifest.canonicalSha256,
      algorithmVersion: "1.0.0",
    },
    async allVerses() { return verses; },
  };
}

export interface SqlQueryResult<Row> { rows: Row[] }
export interface SqlClient {
  query<Row>(text: string, values?: readonly unknown[]): Promise<SqlQueryResult<Row>>;
}

interface VerseDatabaseRow {
  book: string;
  book_order: number;
  chapter: number;
  verse: number;
  source_book_code: string;
  display_text: string;
  italics_json: ImportedVerse["italics"];
  paratext_json: ImportedVerse["paratext"];
}

export class PostgresCorpusRepository implements CorpusRepository {
  private readonly client: SqlClient;
  readonly identity: CorpusIdentity;

  constructor(client: SqlClient, identity: CorpusIdentity) {
    this.client = client;
    this.identity = identity;
  }

  async allVerses(): Promise<ImportedVerse[]> {
    const result = await this.client.query<VerseDatabaseRow>(`
      SELECT b.name AS book, b.canonical_order AS book_order,
             v.chapter, v.verse, v.source_book_code, v.display_text,
             v.italics_json, v.paratext_json
      FROM verses v
      JOIN books b ON b.id = v.book_id
      JOIN corpus_versions c ON c.id = v.corpus_version_id
      WHERE c.name = $1
      ORDER BY b.canonical_order, v.chapter, v.verse
    `, [this.identity.corpusVersion]);

    return result.rows.map((row, index) => ({
      reference: {
        book: row.book,
        bookOrder: row.book_order,
        chapter: row.chapter,
        verse: row.verse,
      },
      sourceBookCode: row.source_book_code,
      rawRecord: row.display_text,
      sourceLine: index + 1,
      sourceByteStart: 0,
      sourceByteEnd: Buffer.byteLength(row.display_text, "utf8"),
      displayText: row.display_text,
      italics: row.italics_json,
      paratext: row.paratext_json,
    }));
  }
}

function locateCorpusDirectory(): string {
  const override = process.env.KJV_CORPUS_DIRECTORY;
  if (override) return resolve(override);
  const relative = "data/derived/KJV-PCE-BP-2010-v1";
  return process.cwd().endsWith(resolve("apps/web"))
    ? resolve(process.cwd(), "../..", relative)
    : resolve(process.cwd(), relative);
}
