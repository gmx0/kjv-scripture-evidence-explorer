import { createHash } from "node:crypto";
import { TOKENIZER_VERSION, compareReferences, formatReference, normalizeToken, parseReference, tokenize } from "../../corpus/src/index.ts";
import type { ImportedVerse } from "../../corpus/src/importer.ts";
import type { CanonicalReference, Token } from "../../shared/src/index.ts";
import { DEFAULT_SCORING_CONFIG, scoreVersePair, sortExplanations } from "./scoring.ts";
import type { ScoreExplanation, ScoringConfig, ScoringVerse } from "./types.ts";

export interface IndexedVerse extends ScoringVerse {
  id: number;
  displayText: string;
}

export interface CorpusStatistics {
  corpusSize: number;
  vocabularySize: number;
  documentFrequency: Record<string, number>;
  totalFrequency: Record<string, number>;
  idf: Record<string, number>;
  rareThreshold: number;
}

export interface SearchMetadata {
  corpusVersion: string;
  algorithmVersion: string;
  configurationSha256: string;
  queryTrace: string[];
}

export interface ExactMatch {
  reference: CanonicalReference;
  displayText: string;
  positions: number[];
  surfaces: string[];
}

export interface PhraseMatchResult {
  reference: CanonicalReference;
  displayText: string;
  startPositions: number[];
}

export interface SearchEngine {
  verses: IndexedVerse[];
  statistics: CorpusStatistics;
  configurationSha256: string;
  searchExactWord(query: string, options?: { caseSensitive?: boolean; limit?: number }): {
    meta: SearchMetadata; query: string; caseSensitive: boolean; total: number; totalOccurrences: number; matches: ExactMatch[];
  };
  searchExactPhrase(query: string, options?: { caseSensitive?: boolean; limit?: number }): {
    meta: SearchMetadata; query: string; caseSensitive: boolean; total: number; totalOccurrences: number; matches: PhraseMatchResult[];
  };
  termDistribution(query: string, options?: { caseSensitive?: boolean }): {
    meta: SearchMetadata; query: string; caseSensitive: boolean; verseFrequency: number; totalFrequency: number;
    firstMention: CanonicalReference | null; lastMention: CanonicalReference | null; byBook: Record<string, number>;
  };
  related(reference: string, options?: { limit?: number; books?: string[]; testament?: "OT" | "NT" }): {
    meta: SearchMetadata; source: { reference: CanonicalReference; displayText: string }; candidateCount: number; results: ScoreExplanation[];
  };
}

export function buildSearchEngine(
  imported: ImportedVerse[],
  identity: { corpusVersion: string; algorithmVersion: string },
): SearchEngine {
  const verses: IndexedVerse[] = imported.map((verse, id) => ({
    id,
    reference: verse.reference,
    displayText: verse.displayText,
    tokens: tokenize(verse.displayText),
  }));
  verses.sort((left, right) => compareReferences(left.reference, right.reference));
  verses.forEach((verse, id) => { verse.id = id; });

  const caseFoldedIndex = new Map<string, Map<number, number[]>>();
  const normalizedIndex = new Map<string, Map<number, number[]>>();
  const surfaceIndex = new Map<string, Map<number, number[]>>();
  const documentFrequency: Record<string, number> = {};
  const totalFrequency: Record<string, number> = {};
  const referenceIndex = new Map<string, number>();
  const scoringVerses: ScoringVerse[] = verses.map((verse) => ({
    reference: verse.reference,
    tokens: verse.tokens.map((token) => ({ ...token, folded: normalizeToken(token).normalized })),
  }));

  for (const verse of verses) {
    referenceIndex.set(formatReference(verse.reference), verse.id);
    const seenFolded = new Set<string>();
    for (const token of verse.tokens) {
      const normalized = normalizeToken(token).normalized;
      addOccurrence(caseFoldedIndex, token.folded, verse.id, token.position);
      addOccurrence(normalizedIndex, normalized, verse.id, token.position);
      addOccurrence(surfaceIndex, token.surface, verse.id, token.position);
      totalFrequency[normalized] = (totalFrequency[normalized] ?? 0) + 1;
      seenFolded.add(normalized);
    }
    for (const token of seenFolded) documentFrequency[token] = (documentFrequency[token] ?? 0) + 1;
  }

  const dfValues = Object.values(documentFrequency).sort((a, b) => a - b);
  const rareIndex = Math.max(0, Math.ceil(dfValues.length * 0.2) - 1);
  const rareThreshold = dfValues[rareIndex] ?? 0;
  const idf = Object.fromEntries(Object.entries(documentFrequency).map(([token, df]) => [token, Math.log((verses.length + 1) / (df + 1)) + 1]));
  const statistics: CorpusStatistics = {
    corpusSize: verses.length,
    vocabularySize: Object.keys(documentFrequency).length,
    documentFrequency,
    totalFrequency,
    idf,
    rareThreshold,
  };
  const scoringConfig: ScoringConfig = {
    ...DEFAULT_SCORING_CONFIG,
    algorithmVersion: identity.algorithmVersion,
    corpusSize: verses.length,
    documentFrequency,
    rareThreshold,
    weights: { ...DEFAULT_SCORING_CONFIG.weights },
  };
  const configurationSha256 = hashStable({
    algorithmVersion: scoringConfig.algorithmVersion,
    phraseCap: scoringConfig.phraseCap,
    rareCap: scoringConfig.rareCap,
    rareThresholdPercentile: 20,
    rareThreshold,
    weights: scoringConfig.weights,
    roundingDecimalPlaces: 6,
    tokenizerVersion: TOKENIZER_VERSION,
    normalizationVersion: "1.0.1",
    tieBreakOrder: ["score_desc", "phrase_desc", "rare_desc", "jaccard_desc", "cross_reference_desc", "canonical_order_asc"],
  });
  const metadata = (queryTrace: string[]): SearchMetadata => ({
    corpusVersion: identity.corpusVersion,
    algorithmVersion: identity.algorithmVersion,
    configurationSha256,
    queryTrace,
  });
  const collectExactWord = (query: string, caseSensitive: boolean): { key: string; matches: ExactMatch[] } => {
    const [queryToken, ...extra] = tokenize(query);
    if (!queryToken || extra.length) throw new Error("Exact word search requires exactly one token");
    const index = caseSensitive ? surfaceIndex : caseFoldedIndex;
    const key = caseSensitive ? queryToken.surface : queryToken.folded;
    const postings = index.get(key) ?? new Map<number, number[]>();
    const matches = [...postings.entries()]
      .map(([verseId, positions]) => ({
        reference: verses[verseId]!.reference,
        displayText: verses[verseId]!.displayText,
        positions: [...positions],
        surfaces: positions.map((position) => verses[verseId]!.tokens[position]!.surface),
      }))
      .sort((a, b) => compareReferences(a.reference, b.reference));
    return { key, matches };
  };

  return {
    verses,
    statistics,
    configurationSha256,

    searchExactWord(query, options = {}) {
      const caseSensitive = options.caseSensitive ?? false;
      const { key, matches: allMatches } = collectExactWord(query, caseSensitive);
      return {
        meta: metadata([`token:${key}`, `caseSensitive:${caseSensitive}`]),
        query,
        caseSensitive,
        total: allMatches.length,
        totalOccurrences: allMatches.reduce((total, match) => total + match.positions.length, 0),
        matches: allMatches.slice(0, clampLimit(options.limit, allMatches.length)),
      };
    },

    searchExactPhrase(query, options = {}) {
      const queryTokens = tokenize(query);
      if (queryTokens.length < 2) throw new Error("Exact phrase search requires at least two tokens");
      const caseSensitive = options.caseSensitive ?? false;
      const index = caseSensitive ? surfaceIndex : caseFoldedIndex;
      const keys = queryTokens.map((token) => caseSensitive ? token.surface : token.folded);
      const candidateIds = intersectPostings(keys.map((key) => index.get(key)));
      const allMatches: PhraseMatchResult[] = [];
      for (const verseId of candidateIds) {
        const verse = verses[verseId]!;
        const verseKeys = verse.tokens.map((token) => caseSensitive ? token.surface : token.folded);
        const startPositions = contiguousStarts(verseKeys, keys);
        if (startPositions.length) allMatches.push({ reference: verse.reference, displayText: verse.displayText, startPositions });
      }
      allMatches.sort((a, b) => compareReferences(a.reference, b.reference));
      return {
        meta: metadata([`phrase:${keys.join(" ")}`, `caseSensitive:${caseSensitive}`]),
        query,
        caseSensitive,
        total: allMatches.length,
        totalOccurrences: allMatches.reduce((total, match) => total + match.startPositions.length, 0),
        matches: allMatches.slice(0, clampLimit(options.limit, allMatches.length)),
      };
    },

    termDistribution(query, options = {}) {
      const caseSensitive = options.caseSensitive ?? false;
      const { key, matches } = collectExactWord(query, caseSensitive);
      const byBook: Record<string, number> = {};
      for (const match of matches) byBook[match.reference.book] = (byBook[match.reference.book] ?? 0) + 1;
      return {
        meta: metadata([`token:${key}`, `caseSensitive:${caseSensitive}`, "distribution:complete"]),
        query,
        caseSensitive,
        verseFrequency: matches.length,
        totalFrequency: matches.reduce((total, match) => total + match.positions.length, 0),
        firstMention: matches[0]?.reference ?? null,
        lastMention: matches.at(-1)?.reference ?? null,
        byBook,
      };
    },

    related(reference, options = {}) {
      const canonical = formatReference(parseReference(reference).start);
      const sourceId = referenceIndex.get(canonical);
      if (sourceId === undefined) throw new Error(`Unknown corpus reference: ${reference}`);
      const source = verses[sourceId]!;
      const candidateIds = new Set<number>();
      const scoringSource = scoringVerses[sourceId]!;
      for (const token of new Set(scoringSource.tokens.map((item) => item.folded))) {
        for (const verseId of normalizedIndex.get(token)?.keys() ?? []) if (verseId !== sourceId) candidateIds.add(verseId);
      }
      const filtered = [...candidateIds].filter((verseId) => {
        const candidate = verses[verseId]!;
        if (options.books?.length && !options.books.includes(candidate.reference.book)) return false;
        if (options.testament === "OT" && candidate.reference.bookOrder > 39) return false;
        if (options.testament === "NT" && candidate.reference.bookOrder <= 39) return false;
        return true;
      });
      const explanations = filtered.map((verseId) => scoreVersePair(scoringSource, scoringVerses[verseId]!, scoringConfig, {
        corpusVersion: identity.corpusVersion,
      }));
      const sorted = sortExplanations(explanations);
      return {
        meta: metadata([`reference:${canonical}`, `candidates:${filtered.length}`, `filters:${stableStringify({ books: options.books ?? [], testament: options.testament ?? null })}`]),
        source: { reference: source.reference, displayText: source.displayText },
        candidateCount: filtered.length,
        results: sorted.slice(0, clampLimit(options.limit ?? 50, 50)),
      };
    },
  };
}

function addOccurrence(index: Map<string, Map<number, number[]>>, key: string, verseId: number, position: number): void {
  let postings = index.get(key);
  if (!postings) { postings = new Map(); index.set(key, postings); }
  let positions = postings.get(verseId);
  if (!positions) { positions = []; postings.set(verseId, positions); }
  positions.push(position);
}

function intersectPostings(postings: Array<Map<number, number[]> | undefined>): number[] {
  if (postings.some((posting) => !posting)) return [];
  const ordered = (postings as Array<Map<number, number[]>>).sort((a, b) => a.size - b.size);
  return [...ordered[0]!.keys()].filter((verseId) => ordered.slice(1).every((posting) => posting.has(verseId)));
}

function contiguousStarts(haystack: string[], needle: string[]): number[] {
  const starts: number[] = [];
  for (let start = 0; start <= haystack.length - needle.length; start += 1) {
    if (needle.every((token, offset) => haystack[start + offset] === token)) starts.push(start);
  }
  return starts;
}

function clampLimit(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 1) throw new Error("limit must be a positive integer");
  return Math.min(value, 500);
}

function hashStable(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
