import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BOOKS,
  CORPUS_VERSION,
  IMPORTER_VERSION,
  PCE_MEMBER_NAME,
  formatReferenceRange,
  importPceArchive,
  parseReference,
  tokenize,
  validateManifest,
} from "../../../packages/corpus/src/index.ts";
import type { CorpusManifest } from "../../../packages/shared/src/index.ts";
import { buildSearchEngine } from "../../../packages/search/src/index.ts";

const [command, ...args] = process.argv.slice(2);

if (command === "reference") {
  const input = args.join(" ");
  if (!input) fail("Usage: npm run cli -- reference <reference>");
  const parsed = parseReference(input);
  console.log(JSON.stringify({ input, canonical: formatReferenceRange(parsed), parsed }, null, 2));
} else if (command === "tokenize") {
  const input = args.join(" ");
  if (!input) fail("Usage: npm run cli -- tokenize <text>");
  console.log(JSON.stringify({ tokenizerVersion: "1.0.0", input, tokens: tokenize(input) }, null, 2));
} else if (command === "import") {
  const sourcePath = resolve(args[0] ?? "data/source/TEXT-PCE.zip");
  const outputDirectory = resolve(args[1] ?? `data/derived/${CORPUS_VERSION}`);
  const result = importPceArchive(sourcePath);
  if (result.report.errors.length) {
    console.error(JSON.stringify(result.report, null, 2));
    process.exit(2);
  }
  const manifest: CorpusManifest = {
    schemaVersion: "1.0.0",
    corpusVersion: CORPUS_VERSION,
    edition: "King James Bible: Pure Cambridge Edition",
    sourceUrl: "https://bibleprotector.com/TEXT-PCE.zip",
    sourceMember: PCE_MEMBER_NAME,
    retrievedAt: "2026-10-04T00:00:00-04:00",
    sourceSha256: result.report.sourceSha256!,
    memberSha256: result.report.memberSha256!,
    canonicalSha256: result.report.canonicalSha256,
    importerVersion: IMPORTER_VERSION,
    encoding: "windows-1252",
    lineEndings: "CRLF",
    canonicalFormat: "jsonl-utf8-lf-v1",
    bookOrder: BOOKS.map((book) => book.name),
    counts: result.report.counts,
    license: {
      statement: "Publisher download page presents the files for any use, including all forms of further publishing.",
      jurisdictionNotes: "Public or commercial distribution requires jurisdiction-specific review; preserve the dated source-page record.",
    },
  };
  const manifestErrors = validateManifest(manifest);
  if (manifestErrors.length) fail(`Generated manifest is invalid:\n${manifestErrors.join("\n")}`);
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(resolve(outputDirectory, "verses.jsonl"), result.canonicalJsonl, "utf8");
  writeFileSync(resolve(outputDirectory, "import-report.json"), `${JSON.stringify(result.report, null, 2)}\n`, "utf8");
  writeFileSync(resolve(outputDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ outputDirectory, ...result.report.counts, canonicalSha256: result.report.canonicalSha256 }, null, 2));
} else if (["exact", "phrase", "term", "related", "stats", "index"].includes(command ?? "")) {
  const parsed = parseArguments(args);
  const corpus = importPceArchive(resolve("data/source/TEXT-PCE.zip"));
  if (corpus.report.errors.length) fail(`Corpus import failed:\n${JSON.stringify(corpus.report.errors, null, 2)}`);
  const engine = buildSearchEngine(corpus.verses, { corpusVersion: CORPUS_VERSION, algorithmVersion: "1.0.0" });
  if (command === "stats" || command === "index") {
    const statisticsRecord = {
      meta: { corpusVersion: CORPUS_VERSION, algorithmVersion: "1.0.0", configurationSha256: engine.configurationSha256 },
      statistics: engine.statistics,
    };
    if (command === "index") {
      const outputPath = resolve(`data/derived/${CORPUS_VERSION}/statistics.json`);
      writeFileSync(outputPath, `${JSON.stringify(statisticsRecord, null, 2)}\n`, "utf8");
      console.log(JSON.stringify({
        outputPath,
        corpusSize: engine.statistics.corpusSize,
        vocabularySize: engine.statistics.vocabularySize,
        rareThreshold: engine.statistics.rareThreshold,
        configurationSha256: engine.configurationSha256,
      }, null, 2));
    } else console.log(JSON.stringify(statisticsRecord, null, 2));
  } else {
    if (!parsed.query) fail(`Usage: npm run cli -- ${command} <query> [--limit N] [--case-sensitive]`);
    const limit = parsed.flags.limit ? Number(parsed.flags.limit) : undefined;
    const caseSensitive = parsed.flags["case-sensitive"] === true;
    const output = command === "exact"
      ? engine.searchExactWord(parsed.query, { caseSensitive, limit })
      : command === "phrase"
        ? engine.searchExactPhrase(parsed.query, { caseSensitive, limit })
        : command === "term"
          ? engine.termDistribution(parsed.query, { caseSensitive })
          : engine.related(parsed.query, {
            limit,
            books: typeof parsed.flags.book === "string" ? parsed.flags.book.split(",") : undefined,
            testament: parsed.flags.testament === "OT" || parsed.flags.testament === "NT" ? parsed.flags.testament : undefined,
          });
    console.log(JSON.stringify(output, null, 2));
  }
} else {
  fail("Commands: reference, tokenize, import, index, stats, exact, phrase, term, related");
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function parseArguments(values: string[]): { query: string; flags: Record<string, string | true> } {
  const queryParts: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!;
    if (!value.startsWith("--")) { queryParts.push(value); continue; }
    const name = value.slice(2);
    const next = values[index + 1];
    if (next && !next.startsWith("--")) { flags[name] = next; index += 1; }
    else flags[name] = true;
  }
  return { query: queryParts.join(" ").trim(), flags };
}
