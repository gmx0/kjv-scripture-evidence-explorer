import { compareReferences } from "../../corpus/src/reference.ts";
import type { AlignmentPair, PhraseMatch, ScoreExplanation, ScoringConfig, ScoringVerse } from "./types.ts";

export const DEFAULT_SCORING_CONFIG: Omit<ScoringConfig, "corpusSize" | "documentFrequency" | "rareThreshold"> = {
  algorithmVersion: "1.0.0",
  rareCap: 12,
  phraseCap: 25,
  weights: { jaccard: 0.5, phrase: 0.2, rare: 0.15, order: 0.1, crossReference: 0.05 },
};

export function inverseDocumentFrequency(corpusSize: number, documentFrequency: number): number {
  return Math.log((corpusSize + 1) / (documentFrequency + 1)) + 1;
}

export function scoreVersePair(
  source: ScoringVerse,
  target: ScoringVerse,
  config: ScoringConfig,
  options: { corpusVersion: string; configuredCrossReference?: boolean; candidateReasons?: string[] },
): ScoreExplanation {
  validateConfig(config);
  const sourceWords = unique(source.tokens.map((token) => token.folded));
  const targetWords = unique(target.tokens.map((token) => token.folded));
  const shared = sourceWords.filter((token) => targetWords.includes(token));
  const union = unique([...sourceWords, ...targetWords]);

  const weight = (token: string) => {
    const df = config.documentFrequency[token] ?? config.corpusSize;
    return inverseDocumentFrequency(config.corpusSize, df) * (config.tokenMultipliers?.[token] ?? 1);
  };
  const intersectionWeight = sum(shared.map(weight));
  const unionWeight = sum(union.map(weight));
  const jaccard = clamp(unionWeight === 0 ? 0 : intersectionWeight / unionWeight);

  const phrases = findPhraseMatches(source.tokens.map((t) => t.folded), target.tokens.map((t) => t.folded));
  const phrase = clamp(sum(phrases.map((match) => match.tokens.length ** 2)) / config.phraseCap);

  const rareTokens = shared
    .filter((token) => (config.documentFrequency[token] ?? config.corpusSize) <= config.rareThreshold)
    .map((token) => ({ token, documentFrequency: config.documentFrequency[token] ?? config.corpusSize, idf: inverseDocumentFrequency(config.corpusSize, config.documentFrequency[token] ?? config.corpusSize) }));
  const rare = clamp(sum(rareTokens.map((item) => item.idf)) / config.rareCap);

  const searchableShared = shared.filter((token) => weight(token) > 0);
  const alignment = alignSharedTokens(source.tokens.map((t) => t.folded), target.tokens.map((t) => t.folded), new Set(searchableShared));
  const order = orderScore(alignment, searchableShared.length, source.tokens.length, target.tokens.length);
  const crossReference = options.configuredCrossReference ? 1 : 0;
  const score = round6(
    config.weights.jaccard * jaccard + config.weights.phrase * phrase + config.weights.rare * rare
      + config.weights.order * order + config.weights.crossReference * crossReference,
  );

  return {
    reference: target.reference,
    score,
    components: { jaccard: round6(jaccard), phrase: round6(phrase), rare: round6(rare), order: round6(order), crossReference },
    matchedSurfaceTokens: unique(source.tokens.filter((token) => shared.includes(token.folded)).map((token) => token.surface)),
    matchedNormalizedTokens: shared,
    matchedPhrases: phrases,
    rareTokens: rareTokens.map((item) => ({ ...item, idf: round6(item.idf) })),
    alignment,
    candidateReasons: options.candidateReasons ?? inferCandidateReasons(searchableShared, phrases, crossReference),
    externalBridge: null,
    corpusVersion: options.corpusVersion,
    algorithmVersion: config.algorithmVersion,
  };
}

export function sortExplanations(items: ScoreExplanation[]): ScoreExplanation[] {
  return [...items].sort((a, b) =>
    b.score - a.score
    || b.components.phrase - a.components.phrase
    || b.components.rare - a.components.rare
    || b.components.jaccard - a.components.jaccard
    || b.components.crossReference - a.components.crossReference
    || compareReferences(a.reference, b.reference));
}

function findPhraseMatches(source: string[], target: string[]): PhraseMatch[] {
  const candidates: PhraseMatch[] = [];
  for (let sourceStart = 0; sourceStart < source.length; sourceStart += 1) {
    for (let targetStart = 0; targetStart < target.length; targetStart += 1) {
      let length = 0;
      while (source[sourceStart + length] !== undefined && source[sourceStart + length] === target[targetStart + length]) length += 1;
      if (length >= 2) candidates.push({ tokens: source.slice(sourceStart, sourceStart + length), sourceStart, targetStart });
    }
  }
  candidates.sort((a, b) => b.tokens.length - a.tokens.length || a.sourceStart - b.sourceStart || a.targetStart - b.targetStart);
  const usedSource = new Set<number>();
  const usedTarget = new Set<number>();
  const selected: PhraseMatch[] = [];
  for (const candidate of candidates) {
    const sourcePositions = range(candidate.sourceStart, candidate.tokens.length);
    const targetPositions = range(candidate.targetStart, candidate.tokens.length);
    if (sourcePositions.some((position) => usedSource.has(position)) || targetPositions.some((position) => usedTarget.has(position))) continue;
    sourcePositions.forEach((position) => usedSource.add(position));
    targetPositions.forEach((position) => usedTarget.add(position));
    selected.push(candidate);
  }
  return selected.sort((a, b) => a.sourceStart - b.sourceStart);
}

function alignSharedTokens(source: string[], target: string[], searchableShared: Set<string>): AlignmentPair[] {
  const alignment: AlignmentPair[] = [];
  let targetCursor = 0;
  for (let sourcePosition = 0; sourcePosition < source.length; sourcePosition += 1) {
    const token = source[sourcePosition]!;
    if (!searchableShared.has(token)) continue;
    const targetPosition = target.indexOf(token, targetCursor);
    if (targetPosition === -1) continue;
    alignment.push({ token, sourcePosition, targetPosition });
    targetCursor = targetPosition + 1;
  }
  return alignment;
}

function orderScore(alignment: AlignmentPair[], sharedCount: number, sourceLength: number, targetLength: number): number {
  if (sharedCount === 0 || alignment.length === 0) return 0;
  const orderRatio = alignment.length / sharedCount;
  const denominatorSource = Math.max(1, sourceLength - 1);
  const denominatorTarget = Math.max(1, targetLength - 1);
  const gapDifferences: number[] = [];
  for (let index = 1; index < alignment.length; index += 1) {
    const previous = alignment[index - 1]!;
    const current = alignment[index]!;
    const sourceGap = (current.sourcePosition - previous.sourcePosition) / denominatorSource;
    const targetGap = (current.targetPosition - previous.targetPosition) / denominatorTarget;
    gapDifferences.push(Math.abs(sourceGap - targetGap));
  }
  const meanGapDifference = gapDifferences.length ? sum(gapDifferences) / gapDifferences.length : 0;
  return clamp(orderRatio * (1 / (1 + meanGapDifference)));
}

function validateConfig(config: ScoringConfig): void {
  const total = sum(Object.values(config.weights));
  if (Math.abs(total - 1) > 1e-9) throw new Error(`Scoring weights must sum to 1; received ${total}`);
  if (config.corpusSize < 1) throw new Error("corpusSize must be positive");
  if (config.phraseCap <= 0 || config.rareCap <= 0) throw new Error("score caps must be positive");
}

function inferCandidateReasons(shared: string[], phrases: PhraseMatch[], crossReference: number): string[] {
  const reasons: string[] = [];
  if (shared.length) reasons.push("shared_nonzero_token");
  if (phrases.length) reasons.push("shared_exact_phrase");
  if (crossReference) reasons.push("configured_cross_reference");
  return reasons;
}

const unique = <T>(items: T[]): T[] => [...new Set(items)];
const sum = (items: number[]): number => items.reduce((total, value) => total + value, 0);
const clamp = (value: number): number => Math.min(1, Math.max(0, value));
const round6 = (value: number): number => Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
const range = (start: number, length: number): number[] => Array.from({ length }, (_, index) => start + index);
