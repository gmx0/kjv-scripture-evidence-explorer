import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { DictionaryProvider, DictionarySelectionSnapshot, DictionarySense, DictionarySnapshot } from "../../../../packages/search/src/topics.ts";

const SOURCE_URL = "https://wordnetcode.princeton.edu/3.0/WNdb-3.0.tar.gz";
const LICENSE = "WordNet 3.0 License — https://wordnet.princeton.edu/license-and-commercial-use";
const POSITIONS = ["noun", "verb", "adj", "adv"] as const;
const POS_NAMES = { n: "noun", v: "verb", a: "adjective", s: "adjective", r: "adverb" } as const;

export function createWordNetProvider(options: { dictionaryRoot?: string; cacheRoot?: string; clock?: () => Date } = {}): DictionaryProvider {
  const dictionaryRoot = options.dictionaryRoot ?? resolve(process.cwd(), "data/derived/wordnet-3.0");
  const cacheRoot = options.cacheRoot ?? resolve(process.cwd(), "data/derived/topic-cache");
  const manifestPath = resolve(dictionaryRoot, "manifest.json");
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : null;
  const data = manifest ? loadDictionary(resolve(dictionaryRoot, "dict")) : null;
  const memoryCache = new Map<string, DictionarySnapshot>();
  let cacheWritable = true;
  try { mkdirSync(cacheRoot, { recursive: true }); }
  catch { cacheWritable = false; }

  return {
    available: true,
    lookup(headword) {
      const normalized = headword.trim().toLocaleLowerCase("en-US").replaceAll(" ", "_");
      const cachePath = resolve(cacheRoot, `${createHash("sha256").update(normalized).digest("hex")}.json`);
      const inMemory = memoryCache.get(normalized);
      if (inMemory) return inMemory;
      if (existsSync(cachePath)) return JSON.parse(readFileSync(cachePath, "utf8")) as DictionarySnapshot;
      if (!data || !manifest) throw new Error("WordNet data is not installed and this topic is not cached");
      const senses: DictionarySense[] = [];
      for (const position of POSITIONS) {
        const indexLine = data.index[position].get(normalized);
        if (!indexLine) continue;
        for (const offset of parseWordNetIndexLine(indexLine).offsets) {
          const parsed = parseWordNetDataLine(lineAtOffset(data.data[position], offset));
          senses.push({ id: `wn30:${parsed.type}:${String(offset).padStart(8, "0")}`, partOfSpeech: POS_NAMES[parsed.type], definition: parsed.definition, synonyms: parsed.words });
        }
      }
      if (!senses.length) return null;
      const core = { provider: "Princeton WordNet", providerVersion: "3.0", sourceUrl: SOURCE_URL, license: LICENSE, headword: normalized.replaceAll("_", " "), senses };
      const snapshot: DictionarySnapshot = { ...core, retrievedAt: (options.clock?.() ?? new Date()).toISOString(), payloadSha256: createHash("sha256").update(stableStringify(core)).digest("hex") };
      memoryCache.set(normalized, snapshot);
      if (cacheWritable) {
        try { writeFileSync(cachePath, `${JSON.stringify(snapshot, null, 2)}\n`, { encoding: "utf8", flag: "wx" }); }
        catch (error) { if (!existsSync(cachePath)) cacheWritable = false; }
      }
      return snapshot;
    },
    cacheSelection(selection) {
      if (!cacheWritable) return;
      const selectionRoot = resolve(cacheRoot, "selections");
      try { mkdirSync(selectionRoot, { recursive: true }); }
      catch { cacheWritable = false; return; }
      const selectedCandidates = [...new Set(selection.selectedCandidates)].sort((left, right) => left.localeCompare(right, "en"));
      const record = selectionRecord(selection, selectedCandidates);
      const key = createHash("sha256").update(stableStringify({ topic: selection.topic, sense: selection.selectedSense.id, selectedCandidates })).digest("hex");
      const path = resolve(selectionRoot, `${key}.json`);
      if (!existsSync(path)) writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    },
  };
}

export function parseWordNetIndexLine(line: string) {
  const fields = line.trim().split(/\s+/u);
  if (fields.length < 7) throw new Error("Malformed WordNet index line");
  const synsetCount = Number.parseInt(fields[2]!, 10);
  const pointerCount = Number.parseInt(fields[3]!, 10);
  const offsetStart = 6 + pointerCount;
  const offsets = fields.slice(offsetStart, offsetStart + synsetCount).map((value) => Number.parseInt(value, 10));
  if (offsets.length !== synsetCount || offsets.some((value) => !Number.isSafeInteger(value))) throw new Error("Malformed WordNet synset offsets");
  return { lemma: fields[0]!, type: fields[1]!, offsets };
}

export function parseWordNetDataLine(line: string) {
  const divider = line.indexOf("|");
  if (divider < 0) throw new Error("Malformed WordNet data line");
  const fields = line.slice(0, divider).trim().split(/\s+/u);
  const wordCount = Number.parseInt(fields[3]!, 16);
  const words: string[] = [];
  for (let index = 0; index < wordCount; index += 1) words.push(fields[4 + index * 2]!.replaceAll("_", " "));
  const type = fields[2] as keyof typeof POS_NAMES;
  if (!(type in POS_NAMES)) throw new Error(`Unknown WordNet part of speech: ${type}`);
  const definition = line.slice(divider + 1).trim().split(/;\s*"/u, 1)[0]!.trim();
  return { offset: Number.parseInt(fields[0]!, 10), type, words, definition };
}

function loadDictionary(root: string) {
  const index = {} as Record<(typeof POSITIONS)[number], Map<string, string>>;
  const data = {} as Record<(typeof POSITIONS)[number], Buffer>;
  for (const position of POSITIONS) {
    const indexPath = resolve(root, `index.${position}`);
    const dataPath = resolve(root, `data.${position}`);
    if (!existsSync(indexPath) || !existsSync(dataPath)) throw new Error(`Incomplete WordNet import: ${position}`);
    index[position] = new Map(readFileSync(indexPath, "ascii").split(/\r?\n/u).filter((line) => line && !line.startsWith("  ")).map((line) => [line.slice(0, line.indexOf(" ")), line]));
    data[position] = readFileSync(dataPath);
  }
  return { index, data };
}

function lineAtOffset(buffer: Buffer, offset: number) { const end = buffer.indexOf(0x0a, offset); if (end < 0) throw new Error(`WordNet offset ${offset} has no terminating line`); return buffer.subarray(offset, end).toString("ascii"); }
function selectionRecord(selection: DictionarySelectionSnapshot, selectedCandidates: string[]) {
  return {
    schemaVersion: "1.0.0",
    provider: selection.snapshot.provider,
    providerVersion: selection.snapshot.providerVersion,
    sourceUrl: selection.snapshot.sourceUrl,
    retrievedAt: selection.snapshot.retrievedAt,
    license: selection.snapshot.license,
    payloadSha256: selection.snapshot.payloadSha256,
    topic: selection.topic,
    selectedSense: selection.selectedSense,
    normalizedSynonymCandidates: selection.normalizedSynonymCandidates,
    selectedCandidates,
  };
}
function stableStringify(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`; if (value && typeof value === "object") { const object = value as Record<string, unknown>; return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(",")}}`; } return JSON.stringify(value); }
