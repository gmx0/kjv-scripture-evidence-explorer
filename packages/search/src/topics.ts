import { compareReferences, formatReference, normalizeToken, tokenize } from "../../corpus/src/index.ts";
import type { SearchEngine } from "./engine.ts";

export interface DictionarySense {
  id: string;
  partOfSpeech: "noun" | "verb" | "adjective" | "adverb";
  definition: string;
  synonyms: string[];
}

export interface DictionarySnapshot {
  provider: string;
  providerVersion: string;
  sourceUrl: string;
  retrievedAt: string;
  license: string;
  payloadSha256: string;
  headword: string;
  senses: DictionarySense[];
}

export interface DictionaryProvider {
  available: boolean;
  lookup(headword: string): DictionarySnapshot | null;
  cacheSelection?(selection: DictionarySelectionSnapshot): void;
}

export interface DictionarySelectionSnapshot {
  topic: string;
  snapshot: DictionarySnapshot;
  selectedSense: DictionarySense;
  normalizedSynonymCandidates: TopicCandidate[];
  selectedCandidates: string[];
}

export interface TopicRequest {
  topic: string;
  selectedSenseId?: string | undefined;
  selectedCandidates?: string[] | undefined;
  limitPerCandidate?: number | undefined;
}

export class TopicResolutionError extends Error {
  readonly status: 400 | 422 | 503;

  constructor(message: string, status: 400 | 422 | 503) {
    super(message);
    this.name = "TopicResolutionError";
    this.status = status;
  }
}

interface ExternalBridge {
  evidenceType: "external_synonym_bridge";
  originalTopic: string;
  selectedSenseId: string;
  selectedSenseDefinition: string;
  candidateTerm: string;
  provider: string;
  providerVersion: string;
  sourceUrl: string;
  license: string;
  payloadSha256: string;
}

export type TopicResolution =
  | { status: "exact_kjv"; topic: string; exact: Record<string, any>; notice: string }
  | { status: "requires_sense_selection"; topic: string; exactTotal: 0; senses: DictionarySense[]; provenance: ReturnType<typeof provenance>; notice: string }
  | { status: "requires_candidate_selection"; topic: string; exactTotal: 0; selectedSense: DictionarySense; candidates: TopicCandidate[]; provenance: ReturnType<typeof provenance>; notice: string }
  | { status: "no_kjv_candidates"; topic: string; exactTotal: 0; selectedSense: DictionarySense; candidates: []; provenance: ReturnType<typeof provenance>; notice: string }
  | { status: "resolved"; topic: string; exactTotal: 0; selectedSense: DictionarySense; selectedCandidates: string[]; perCandidate: CandidateRanking[]; combined: CombinedTopicResult[]; provenance: ReturnType<typeof provenance>; notice: string };

export interface TopicCandidate {
  term: string;
  normalized: string;
  verseFrequency: number;
  totalFrequency: number;
  evidenceType: "external_synonym_bridge";
}

export interface CandidateRanking {
  term: string;
  scoreBasis: "exact_selected_candidate";
  total: number;
  truncated: boolean;
  results: Array<{
    label: string;
    reference: SearchEngine["verses"][number]["reference"];
    displayText: string;
    score: 1;
    occurrenceCount: number;
    evidenceTypes: ["exact_word", "external_synonym_bridge"];
    externalBridge: ExternalBridge;
  }>;
}

export type CombinedTopicResult = CandidateRanking["results"][number] & {
  winningTerm: string;
  matchedCandidateTerms: string[];
};

export function resolveTopic(engine: SearchEngine, request: TopicRequest, provider: DictionaryProvider): TopicResolution {
  const topic = requiredTopic(request.topic);
  const exact = exactKjv(engine, topic);
  if (exact.total > 0) {
    return { status: "exact_kjv", topic, exact, notice: "The query occurs in the KJV, so no external vocabulary bridge was used." };
  }

  if (!provider.available) throw new TopicResolutionError("Dictionary expansion is unavailable offline and no cached snapshot exists for this topic.", 503);
  let snapshot: DictionarySnapshot | null;
  try { snapshot = provider.lookup(topic); }
  catch { throw new TopicResolutionError("Dictionary expansion is unavailable offline and no cached snapshot exists for this topic.", 503); }
  if (!snapshot) throw new TopicResolutionError(`Princeton WordNet has no entry for ${topic}.`, 422);
  if (!request.selectedSenseId) {
    return {
      status: "requires_sense_selection",
      topic,
      exactTotal: 0,
      senses: snapshot.senses,
      provenance: provenance(snapshot),
      notice: "Choose a dictionary sense before any KJV vocabulary is suggested. WordNet data is external evidence, not a biblical definition.",
    };
  }

  const sense = snapshot.senses.find((candidate) => candidate.id === request.selectedSenseId);
  if (!sense) throw new TopicResolutionError("The selected sense does not belong to this cached dictionary response.", 422);
  const candidates = intersectCandidates(engine, sense);
  provider.cacheSelection?.({ topic, snapshot, selectedSense: sense, normalizedSynonymCandidates: candidates, selectedCandidates: request.selectedCandidates ?? [] });
  if (!candidates.length) {
    return { status: "no_kjv_candidates", topic, exactTotal: 0, selectedSense: sense, candidates: [], provenance: provenance(snapshot), notice: "No single-word synonym from the selected external sense occurs in the KJV corpus." };
  }
  if (!request.selectedCandidates?.length) {
    return {
      status: "requires_candidate_selection",
      topic,
      exactTotal: 0,
      selectedSense: sense,
      candidates,
      provenance: provenance(snapshot),
      notice: "Select the candidate KJV vocabulary to search. These terms are an external bridge, not proof that a passage is about the modern topic.",
    };
  }

  const offered = new Map(candidates.map((candidate) => [candidate.term, candidate]));
  const requested = [...new Set(request.selectedCandidates.map((candidate) => candidate.trim().toLocaleLowerCase("en-US")))];
  if (requested.some((candidate) => !offered.has(candidate))) throw new TopicResolutionError("Every selected candidate must come from the chosen sense and occur in the KJV.", 422);
  const selectedCandidates = requested.sort((left, right) => left.localeCompare(right, "en"));
  const limit = integerInRange(request.limitPerCandidate ?? 100, 1, 500, "limitPerCandidate");
  const perCandidate = selectedCandidates.map((term) => rankCandidate(engine, topic, sense, snapshot, term, limit));
  return {
    status: "resolved",
    topic,
    exactTotal: 0,
    selectedSense: sense,
    selectedCandidates,
    perCandidate,
    combined: combineRankings(perCandidate),
    provenance: provenance(snapshot),
    notice: "Rankings are separate exact-KJV searches for user-selected bridge terms. Dictionary confidence never changes Scripture scores.",
  };
}

function exactKjv(engine: SearchEngine, topic: string) {
  const tokens = tokenize(topic);
  if (!tokens.length) throw new TopicResolutionError("topic must contain searchable text", 400);
  const result = tokens.length === 1 ? engine.searchExactWord(topic, { limit: 500 }) : engine.searchExactPhrase(topic, { limit: 500 });
  return { ...result, matches: result.matches.map((match) => ({ ...match, label: formatReference(match.reference) })) };
}

function intersectCandidates(engine: SearchEngine, sense: DictionarySense): TopicCandidate[] {
  const unique = new Map<string, TopicCandidate>();
  for (const synonym of sense.synonyms) {
    const tokens = tokenize(synonym.replaceAll("_", " "));
    if (tokens.length !== 1) continue;
    const normalized = normalizeToken(tokens[0]!).normalized;
    const verseFrequency = engine.statistics.documentFrequency[normalized] ?? 0;
    if (!verseFrequency) continue;
    unique.set(normalized, { term: normalized, normalized, verseFrequency, totalFrequency: engine.statistics.totalFrequency[normalized] ?? 0, evidenceType: "external_synonym_bridge" });
  }
  return [...unique.values()].sort((left, right) => left.term.localeCompare(right.term, "en"));
}

function rankCandidate(engine: SearchEngine, topic: string, sense: DictionarySense, snapshot: DictionarySnapshot, term: string, limit: number): CandidateRanking {
  const bridge = externalBridge(topic, sense, snapshot, term);
  const allResults = engine.verses
    .map((verse) => {
      const occurrenceCount = verse.tokens.filter((token) => normalizeToken(token).normalized === term).length;
      return occurrenceCount ? { label: formatReference(verse.reference), reference: verse.reference, displayText: verse.displayText, score: 1 as const, occurrenceCount, evidenceTypes: ["exact_word", "external_synonym_bridge"] as ["exact_word", "external_synonym_bridge"], externalBridge: bridge } : null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  return { term, scoreBasis: "exact_selected_candidate", total: allResults.length, truncated: allResults.length > limit, results: allResults.slice(0, limit) };
}

function combineRankings(rankings: CandidateRanking[]): CombinedTopicResult[] {
  const byReference = new Map<string, CombinedTopicResult>();
  for (const ranking of rankings) {
    for (const result of ranking.results) {
      const existing = byReference.get(result.label);
      if (existing) {
        existing.matchedCandidateTerms.push(ranking.term);
        existing.matchedCandidateTerms.sort((left, right) => left.localeCompare(right, "en"));
        continue;
      }
      byReference.set(result.label, { ...result, winningTerm: ranking.term, matchedCandidateTerms: [ranking.term] });
    }
  }
  return [...byReference.values()].sort((left, right) => right.score - left.score || left.winningTerm.localeCompare(right.winningTerm, "en") || compareReferences(left.reference, right.reference));
}

function provenance(snapshot: DictionarySnapshot) {
  return { provider: snapshot.provider, providerVersion: snapshot.providerVersion, sourceUrl: snapshot.sourceUrl, retrievedAt: snapshot.retrievedAt, license: snapshot.license, payloadSha256: snapshot.payloadSha256, headword: snapshot.headword };
}

function externalBridge(topic: string, sense: DictionarySense, snapshot: DictionarySnapshot, term: string): ExternalBridge {
  return { evidenceType: "external_synonym_bridge", originalTopic: topic, selectedSenseId: sense.id, selectedSenseDefinition: sense.definition, candidateTerm: term, provider: snapshot.provider, providerVersion: snapshot.providerVersion, sourceUrl: snapshot.sourceUrl, license: snapshot.license, payloadSha256: snapshot.payloadSha256 };
}

function requiredTopic(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new TopicResolutionError("topic is required", 400);
  if (value.length > 100) throw new TopicResolutionError("topic must be at most 100 characters", 400);
  return value.trim();
}

function integerInRange(value: number, minimum: number, maximum: number, label: string) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new TopicResolutionError(`${label} must be an integer from ${minimum} to ${maximum}`, 400);
  return value;
}
