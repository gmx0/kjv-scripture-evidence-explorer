import { BOOKS } from "../../../../packages/corpus/src/books.ts";
import {
  compareReferences,
  formatReference,
  normalizeToken,
  parseReference,
  tokenize,
} from "../../../../packages/corpus/src/index.ts";
import { buildSearchEngine } from "../../../../packages/search/src/engine.ts";
import { DEFAULT_SCORING_CONFIG, scoreVersePair } from "../../../../packages/search/src/scoring.ts";
import {
  buildEvidenceGraph,
  candidateMates,
  divideTerm,
  firstMentionChain,
  gatherMentions,
  lexicalWitnesses,
} from "../../../../packages/search/src/workflows.ts";
import type { IndexedVerse, SearchEngine } from "../../../../packages/search/src/engine.ts";
import type { ScoringConfig, ScoringVerse } from "../../../../packages/search/src/types.ts";
import { resolveTopic, TopicResolutionError } from "../../../../packages/search/src/topics.ts";
import type { DictionaryProvider, TopicRequest } from "../../../../packages/search/src/topics.ts";
import type { CanonicalReference } from "../../../../packages/shared/src/index.ts";
import type { CorpusRepository } from "./corpus-repository.ts";

export class StudyServiceError extends Error {
  readonly status: 400 | 404 | 409 | 422 | 503;

  constructor(message: string, status: 400 | 404 | 409 | 422 | 503) {
    super(message);
    this.name = "StudyServiceError";
    this.status = status;
  }
}

export interface RelatedRequest {
  reference: string;
  limit?: number | undefined;
  filters?: { books?: string[] | undefined; testament?: "OT" | "NT" | undefined } | undefined;
  algorithmVersion?: string | undefined;
}

export interface GraphRequest {
  reference: string;
  resultLimit?: number | undefined;
  termLimit?: number | undefined;
  nodeLimit?: number | undefined;
}

export type WorkflowRequest =
  | { type: "gather_mentions"; term: string; limit?: number | undefined }
  | { type: "candidate_mates"; reference: string; limit?: number | undefined }
  | { type: "divide_term"; term: string; exampleLimitPerBook?: number | undefined }
  | { type: "first_mention_chain"; term: string; limit?: number | undefined }
  | { type: "lexical_witnesses"; reference: string; count: 2 | 3; candidateLimit?: number | undefined };

export type ResearchQuery =
  | { mode: "reference"; input: string; context?: number | undefined }
  | { mode: "exact-word" | "exact-phrase"; input: string; limit?: number | undefined; caseSensitive?: boolean | undefined }
  | { mode: "related"; input: string; limit?: number | undefined; filters?: RelatedRequest["filters"] }
  | { mode: "compare"; references: string[] }
  | ({ mode: "graph" } & GraphRequest)
  | { mode: "workflow"; request: WorkflowRequest }
  | { mode: "topic"; request: TopicRequest };

interface ResponseMeta {
  corpusVersion: string;
  canonicalSha256: string;
  algorithmVersion: string;
  configurationSha256: string;
  queryTrace: string[];
  generatedAt: string;
}

export interface StudyService {
  passage(reference: string, context?: number): ApiResponse;
  exact(query: string, mode: "word" | "phrase", options?: { limit?: number; caseSensitive?: boolean }): ApiResponse;
  distribution(term: string, options?: { caseSensitive?: boolean }): ApiResponse;
  related(request: RelatedRequest): ApiResponse;
  compare(references: string[]): ApiResponse;
  evidenceGraph(request: GraphRequest): ApiResponse;
  workflow(request: WorkflowRequest): ApiResponse;
  topic(request: TopicRequest): ApiResponse;
  researchRecord(query: ResearchQuery): ResearchRecord;
}

export interface ApiResponse {
  meta: ResponseMeta;
  data: any;
}

export interface ResearchRecord {
  recordVersion: "1.0.0";
  exportedAt: string;
  query: ResearchQuery;
  response: ApiResponse;
}

export async function createStudyService(repository: CorpusRepository, dictionaryProvider: DictionaryProvider = unavailableDictionaryProvider): Promise<StudyService> {
  const imported = await repository.allVerses();
  const engine = buildSearchEngine(imported, repository.identity);
  const versesByLabel = new Map(engine.verses.map((verse) => [formatReference(verse.reference), verse]));
  const scoringConfig: ScoringConfig = {
    ...DEFAULT_SCORING_CONFIG,
    algorithmVersion: repository.identity.algorithmVersion,
    corpusSize: engine.statistics.corpusSize,
    documentFrequency: engine.statistics.documentFrequency,
    rareThreshold: engine.statistics.rareThreshold,
    weights: { ...DEFAULT_SCORING_CONFIG.weights },
  };

  const response = (data: unknown, queryTrace: string[] = []): ApiResponse => ({
    meta: {
      corpusVersion: repository.identity.corpusVersion,
      canonicalSha256: repository.identity.canonicalSha256,
      algorithmVersion: repository.identity.algorithmVersion,
      configurationSha256: engine.configurationSha256,
      queryTrace,
      generatedAt: new Date().toISOString(),
    },
    data,
  });

  const service: StudyService = {
    passage(reference, context = 2) {
      if (!Number.isSafeInteger(context) || context < 0 || context > 20) throw new StudyServiceError("context must be an integer from 0 to 20", 400);
      const range = parseReference(reference);
      const startLabel = formatReference(range.start);
      const endLabel = formatReference(range.end);
      const startIndex = engine.verses.findIndex((verse) => formatReference(verse.reference) === startLabel);
      const endIndex = engine.verses.findIndex((verse) => formatReference(verse.reference) === endLabel);
      if (startIndex < 0 || endIndex < 0) throw new StudyServiceError(`Unknown corpus reference: ${reference}`, 404);
      const requested = engine.verses.slice(startIndex, endIndex + 1).map(toPassageVerse);
      const first = engine.verses[startIndex]!;
      const last = engine.verses[endIndex]!;
      const lower = Math.max(0, startIndex - context);
      const upper = Math.min(engine.verses.length, endIndex + context + 1);
      const contextVerses = engine.verses.slice(lower, upper)
        .filter((verse) => verse.reference.bookOrder === first.reference.bookOrder || verse.reference.bookOrder === last.reference.bookOrder)
        .map((verse) => ({ ...toPassageVerse(verse), requested: compareReferences(verse.reference, range.start) >= 0 && compareReferences(verse.reference, range.end) <= 0 }));
      return response({ reference: `${startLabel}${startLabel === endLabel ? "" : `-${endLabel}`}`, requested, context: contextVerses }, [
        `reference:${startLabel}${startLabel === endLabel ? "" : `-${endLabel}`}`,
        `context:${context}`,
      ]);
    },

    exact(query, mode, options = {}) {
      const cleaned = requiredText(query, "q", 200);
      const queryTokens = tokenize(cleaned);
      if (mode === "word" && queryTokens.length !== 1) throw new StudyServiceError("Exact word search requires exactly one token", 400);
      if (mode === "phrase" && queryTokens.length < 2) throw new StudyServiceError("Exact phrase search requires at least two tokens", 400);
      const result = mode === "word"
        ? engine.searchExactWord(cleaned, options)
        : engine.searchExactPhrase(cleaned, options);
      return response({
        ...result,
        matches: result.matches.map((match) => ({ ...match, label: formatReference(match.reference) })),
      }, result.meta.queryTrace);
    },

    distribution(term, options = {}) {
      const cleaned = requiredText(term, "term", 100);
      if (tokenize(cleaned).length !== 1) throw new StudyServiceError("Term distribution requires exactly one token", 400);
      const result = engine.termDistribution(cleaned, options);
      return response(result, result.meta.queryTrace);
    },

    related(request) {
      if (request.algorithmVersion && request.algorithmVersion !== repository.identity.algorithmVersion) {
        throw new StudyServiceError(`Algorithm version ${request.algorithmVersion} is unavailable`, 409);
      }
      const reference = requiredText(request.reference, "reference", 100);
      const canonical = formatReference(requireVerse(engine, reference).reference);
      const filters = validateFilters(request.filters);
      const result = engine.related(canonical, { limit: validateLimit(request.limit, 50), ...filters });
      return response({
        ...result,
        source: { ...result.source, label: formatReference(result.source.reference) },
        results: result.results.map((item, rank) => ({
          ...item,
          rank: rank + 1,
          label: formatReference(item.reference),
          displayText: versesByLabel.get(formatReference(item.reference))!.displayText,
          tieBreak: "score, phrase, rare, jaccard, cross-reference, canonical order",
        })),
      }, result.meta.queryTrace);
    },

    compare(referenceInputs) {
      if (!Array.isArray(referenceInputs) || referenceInputs.length < 2 || referenceInputs.length > 10) {
        throw new StudyServiceError("compare requires between 2 and 10 references", 400);
      }
      const selected = referenceInputs.map((input) => requireVerse(engine, input));
      const exactSets = selected.map((verse) => new Set(verse.tokens.map((token) => token.surface)));
      const normalizedSets = selected.map((verse) => new Set(verse.tokens.map((token) => normalizeToken(token).normalized)));
      const commonSurfaceTokens = intersection(exactSets);
      const commonNormalizedTokens = intersection(normalizedSets);
      const uniqueNormalizedTokens = Object.fromEntries(selected.map((verse, index) => [
        formatReference(verse.reference),
        [...normalizedSets[index]!].filter((token) => !normalizedSets.some((set, otherIndex) => otherIndex !== index && set.has(token))).sort(),
      ]));
      const pairs = [];
      for (let left = 0; left < selected.length; left += 1) {
        for (let right = left + 1; right < selected.length; right += 1) {
          const source = scoringVerse(selected[left]!);
          const target = scoringVerse(selected[right]!);
          pairs.push({
            source: formatReference(source.reference),
            target: formatReference(target.reference),
            explanation: scoreVersePair(source, target, scoringConfig, { corpusVersion: repository.identity.corpusVersion }),
          });
        }
      }
      return response({
        passages: selected.map(toPassageVerse),
        commonSurfaceTokens,
        commonNormalizedTokens,
        uniqueNormalizedTokens,
        pairs,
      }, [`compare:${selected.map((verse) => formatReference(verse.reference)).join("|")}`]);
    },

    evidenceGraph(request) {
      const reference = formatReference(requireVerse(engine, request.reference).reference);
      const graph = clientInput(() => buildEvidenceGraph(engine, {
        reference,
        ...definedNumber("resultLimit", request.resultLimit),
        ...definedNumber("termLimit", request.termLimit),
        ...definedNumber("nodeLimit", request.nodeLimit),
      }));
      return response(graph, [
        `graph:${reference}`,
        `resultLimit:${graph.query.resultLimit}`,
        `termLimit:${graph.query.termLimit}`,
        `nodeLimit:${graph.query.nodeLimit}`,
        "crossReferences:disabled",
      ]);
    },

    workflow(request) {
      let data: unknown;
      switch (request.type) {
        case "gather_mentions":
          validateSingleTerm(request.term);
          data = clientInput(() => gatherMentions(engine, { term: request.term, ...definedNumber("limit", request.limit) }));
          break;
        case "candidate_mates": {
          const reference = formatReference(requireVerse(engine, request.reference).reference);
          data = clientInput(() => candidateMates(engine, { reference, ...definedNumber("limit", request.limit) }));
          break;
        }
        case "divide_term":
          validateSingleTerm(request.term);
          data = clientInput(() => divideTerm(engine, { term: request.term, ...definedNumber("exampleLimitPerBook", request.exampleLimitPerBook) }));
          break;
        case "first_mention_chain":
          validateSingleTerm(request.term);
          data = clientInput(() => firstMentionChain(engine, { term: request.term, ...definedNumber("limit", request.limit) }));
          break;
        case "lexical_witnesses": {
          const reference = formatReference(requireVerse(engine, request.reference).reference);
          data = clientInput(() => lexicalWitnesses(engine, { reference, count: request.count, ...definedNumber("candidateLimit", request.candidateLimit) }));
          break;
        }
      }
      return response(data, [`workflow:${request.type}`, "crossReferences:disabled"]);
    },

    topic(request) {
      let data;
      try { data = resolveTopic(engine, request, dictionaryProvider); }
      catch (error) {
        if (error instanceof TopicResolutionError) throw new StudyServiceError(error.message, error.status);
        throw error;
      }
      return response(data, [
        `topic:${request.topic.trim()}`,
        `status:${data.status}`,
        `sense:${request.selectedSenseId ?? "unselected"}`,
        `candidates:${request.selectedCandidates?.join("|") ?? "unselected"}`,
        "dictionary:Princeton WordNet 3.0",
      ]);
    },

    researchRecord(query) {
      let exportedResponse: ApiResponse;
      switch (query.mode) {
        case "reference": exportedResponse = service.passage(query.input, query.context); break;
        case "exact-word": exportedResponse = service.exact(query.input, "word", exactOptions(query)); break;
        case "exact-phrase": exportedResponse = service.exact(query.input, "phrase", exactOptions(query)); break;
        case "related": exportedResponse = service.related({ reference: query.input, limit: query.limit, filters: query.filters, algorithmVersion: repository.identity.algorithmVersion }); break;
        case "compare": exportedResponse = service.compare(query.references); break;
        case "graph": exportedResponse = service.evidenceGraph(query); break;
        case "workflow": exportedResponse = service.workflow(query.request); break;
        case "topic": exportedResponse = service.topic(query.request); break;
      }
      return { recordVersion: "1.0.0", exportedAt: new Date().toISOString(), query, response: exportedResponse };
    },
  };

  return service;
}

const unavailableDictionaryProvider: DictionaryProvider = {
  available: false,
  lookup() { throw new Error("WordNet is unavailable"); },
};

function requireVerse(engine: SearchEngine, input: string): IndexedVerse {
  let label: string;
  try { label = formatReference(parseReference(requiredText(input, "reference", 100)).start); }
  catch (error) { throw new StudyServiceError(error instanceof Error ? error.message : "Invalid reference", 400); }
  const verse = engine.verses.find((candidate) => formatReference(candidate.reference) === label);
  if (!verse) throw new StudyServiceError(`Unknown corpus reference: ${input}`, 404);
  return verse;
}

function scoringVerse(verse: IndexedVerse): ScoringVerse {
  return { reference: verse.reference, tokens: verse.tokens.map((token) => ({ ...token, folded: normalizeToken(token).normalized })) };
}

function toPassageVerse(verse: IndexedVerse) {
  return { reference: verse.reference, label: formatReference(verse.reference), displayText: verse.displayText };
}

function requiredText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string" || !value.trim()) throw new StudyServiceError(`${label} is required`, 400);
  if (value.length > maxLength) throw new StudyServiceError(`${label} must be at most ${maxLength} characters`, 400);
  return value.trim();
}

function validateLimit(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 1 || value > 500) throw new StudyServiceError("limit must be an integer from 1 to 500", 400);
  return value;
}

function validateFilters(filters: RelatedRequest["filters"]): { books?: string[]; testament?: "OT" | "NT" } {
  if (!filters) return {};
  if (filters.testament && filters.testament !== "OT" && filters.testament !== "NT") throw new StudyServiceError("testament must be OT or NT", 400);
  if (filters.books && (!Array.isArray(filters.books) || filters.books.some((book) => !BOOKS.some((candidate) => candidate.name === book)))) {
    throw new StudyServiceError("books contains an unknown canonical book", 400);
  }
  return { ...(filters.books?.length ? { books: filters.books } : {}), ...(filters.testament ? { testament: filters.testament } : {}) };
}

function intersection(sets: Array<Set<string>>): string[] {
  return [...sets[0]!].filter((item) => sets.slice(1).every((set) => set.has(item))).sort();
}

function exactOptions(query: { limit?: number | undefined; caseSensitive?: boolean | undefined }): { limit?: number; caseSensitive?: boolean } {
  return {
    ...(query.limit !== undefined ? { limit: query.limit } : {}),
    ...(query.caseSensitive !== undefined ? { caseSensitive: query.caseSensitive } : {}),
  };
}

function validateSingleTerm(term: string): void {
  const cleaned = requiredText(term, "term", 100);
  if (tokenize(cleaned).length !== 1) throw new StudyServiceError("Workflow term requires exactly one token", 400);
}

function definedNumber<Key extends string>(key: Key, value: number | undefined): Partial<Record<Key, number>> {
  return value === undefined ? {} : { [key]: value } as Partial<Record<Key, number>>;
}

function clientInput<T>(operation: () => T): T {
  try { return operation(); }
  catch (error) {
    if (error instanceof StudyServiceError) throw error;
    throw new StudyServiceError(error instanceof Error ? error.message : "Invalid workflow request", 400);
  }
}
