import { compareReferences } from "../../corpus/src/reference.ts";
import type { AlignmentPair, CapitalizationEvidence, MatchLevel, MatchedTokenEvidence, PhraseLevel, PhraseMatch, ScoreExplanation, ScoringConfig, ScoringVerse } from "./types.ts";

export const DEFAULT_SCORING_CONFIG: Omit<ScoringConfig, "corpusSize" | "documentFrequency" | "rareThreshold"> = {
  algorithmVersion: "1.1.0",
  rareCap: 12,
  phraseCap: 25,
  matchLevel: "exact_spelling",
  phraseLevelMultipliers: { caseExact: 1, caseFolded: 0.8, normalized: 0.5 },
  weights: { jaccard: 0.4, phrase: 0.2, rare: 0.15, order: 0.1, capitalization: 0.1, crossReference: 0.05 },
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
  const sourceKeys = matchingKeys(source, config.matchLevel);
  const targetKeys = matchingKeys(target, config.matchLevel);
  const sourceWords = unique(sourceKeys);
  const targetWords = unique(targetKeys);
  const shared = sourceWords.filter((token) => targetWords.includes(token));
  const union = unique([...sourceWords, ...targetWords]);
  const rarityKeyByMatchKey = new Map<string, string>();
  for (const [index, key] of sourceKeys.entries()) rarityKeyByMatchKey.set(key, source.normalizedTokens?.[index] ?? source.tokens[index]!.folded);
  for (const [index, key] of targetKeys.entries()) rarityKeyByMatchKey.set(key, target.normalizedTokens?.[index] ?? target.tokens[index]!.folded);

  const weight = (token: string) => {
    const rarityKey = rarityKeyByMatchKey.get(token) ?? token;
    const df = config.documentFrequency[rarityKey] ?? config.corpusSize;
    return inverseDocumentFrequency(config.corpusSize, df) * (config.tokenMultipliers?.[rarityKey] ?? 1);
  };
  const intersectionWeight = sum(shared.map(weight));
  const unionWeight = sum(union.map(weight));
  const jaccard = clamp(unionWeight === 0 ? 0 : intersectionWeight / unionWeight);

  const phrases = findPhraseMatches(source, target, config.matchLevel, config.phraseLevelMultipliers);
  const phrase = clamp(sum(phrases.map((match) => match.tokens.length ** 2 * match.multiplier)) / config.phraseCap);

  const rareTokens = shared
    .filter((token) => (config.documentFrequency[rarityKeyByMatchKey.get(token) ?? token] ?? config.corpusSize) <= config.rareThreshold)
    .map((token) => {
      const rarityKey = rarityKeyByMatchKey.get(token) ?? token;
      const documentFrequency = config.documentFrequency[rarityKey] ?? config.corpusSize;
      return { token, documentFrequency, idf: inverseDocumentFrequency(config.corpusSize, documentFrequency) };
    });
  const rare = clamp(sum(rareTokens.map((item) => item.idf)) / config.rareCap);

  const searchableShared = shared.filter((token) => weight(token) > 0);
  const alignment = alignSharedTokens(sourceKeys, targetKeys, new Set(searchableShared));
  const order = orderScore(alignment, searchableShared.length, source.tokens.length, target.tokens.length);
  const matchedTokens = matchedTokenEvidence(source, target, alignment);
  const capitalizationEvidence = buildCapitalizationEvidence(source, target, alignment, weight);
  const capitalizationWeight = sum(capitalizationEvidence.map((item) => item.weight));
  const capitalization = clamp(capitalizationWeight === 0 ? 0 : sum(capitalizationEvidence.map((item) => item.weight * item.multiplier)) / capitalizationWeight);
  const crossReference = options.configuredCrossReference ? 1 : 0;
  const score = round6(
    config.weights.jaccard * jaccard + config.weights.phrase * phrase + config.weights.rare * rare
      + config.weights.order * order + config.weights.capitalization * capitalization
      + config.weights.crossReference * crossReference,
  );

  return {
    reference: target.reference,
    score,
    components: { jaccard: round6(jaccard), phrase: round6(phrase), rare: round6(rare), order: round6(order), capitalization: round6(capitalization), crossReference },
    matchLevel: config.matchLevel,
    matchedTokens,
    matchedSurfaceTokens: unique(matchedTokens.filter((item) => item.level === "case_exact").map((item) => item.sourceSurface)),
    matchedNormalizedTokens: shared,
    matchedPhrases: phrases,
    capitalizationEvidence: capitalizationEvidence.map((item) => ({ ...item, weight: round6(item.weight) })),
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

function findPhraseMatches(
  source: ScoringVerse,
  target: ScoringVerse,
  matchLevel: MatchLevel,
  multipliers: ScoringConfig["phraseLevelMultipliers"],
): PhraseMatch[] {
  const sourceKeys = matchingKeys(source, matchLevel);
  const targetKeys = matchingKeys(target, matchLevel);
  const candidates: PhraseMatch[] = [];
  for (let sourceStart = 0; sourceStart < sourceKeys.length; sourceStart += 1) {
    for (let targetStart = 0; targetStart < targetKeys.length; targetStart += 1) {
      let length = 0;
      while (sourceKeys[sourceStart + length] !== undefined && sourceKeys[sourceStart + length] === targetKeys[targetStart + length]) length += 1;
      if (length >= 2) {
        const level = phraseLevel(source, target, sourceStart, targetStart, length);
        candidates.push({
          tokens: source.tokens.slice(sourceStart, sourceStart + length).map((token) => token.surface),
          sourceStart,
          targetStart,
          level,
          multiplier: phraseMultiplier(level, multipliers),
        });
      }
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

function matchingKeys(verse: ScoringVerse, level: MatchLevel): string[] {
  if (level === "letter_exact") return verse.tokens.map((token) => token.surface);
  if (level === "normalized") return verse.normalizedTokens ?? verse.tokens.map((token) => token.folded);
  return verse.tokens.map((token) => token.folded);
}

function phraseLevel(source: ScoringVerse, target: ScoringVerse, sourceStart: number, targetStart: number, length: number): PhraseLevel {
  const offsets = range(0, length);
  if (offsets.every((offset) => source.tokens[sourceStart + offset]!.surface === target.tokens[targetStart + offset]!.surface)) return "case_exact";
  if (offsets.every((offset) => source.tokens[sourceStart + offset]!.folded === target.tokens[targetStart + offset]!.folded)) return "case_folded";
  return "normalized";
}

function phraseMultiplier(level: PhraseLevel, multipliers: ScoringConfig["phraseLevelMultipliers"]): number {
  if (level === "case_exact") return multipliers.caseExact;
  if (level === "case_folded") return multipliers.caseFolded;
  return multipliers.normalized;
}

function matchedTokenEvidence(source: ScoringVerse, target: ScoringVerse, alignment: AlignmentPair[]): MatchedTokenEvidence[] {
  return alignment.map((pair) => {
    const sourceSurface = source.tokens[pair.sourcePosition]!.surface;
    const targetSurface = target.tokens[pair.targetPosition]!.surface;
    const sourceNormalized = source.normalizedTokens?.[pair.sourcePosition] ?? source.tokens[pair.sourcePosition]!.folded;
    const targetNormalized = target.normalizedTokens?.[pair.targetPosition] ?? target.tokens[pair.targetPosition]!.folded;
    const level = sourceSurface === targetSurface ? "case_exact"
      : source.tokens[pair.sourcePosition]!.folded === target.tokens[pair.targetPosition]!.folded ? "case_folded"
        : sourceNormalized === targetNormalized ? "normalized" : "case_folded";
    return { ...pair, sourceSurface, targetSurface, level };
  });
}

function buildCapitalizationEvidence(
  source: ScoringVerse,
  target: ScoringVerse,
  alignment: AlignmentPair[],
  weight: (token: string) => number,
): CapitalizationEvidence[] {
  return alignment.map((pair) => {
    const sourceToken = source.tokens[pair.sourcePosition]!;
    const targetToken = target.tokens[pair.targetPosition]!;
    const sourceStart = isSentenceStart(source, pair.sourcePosition);
    const targetStart = isSentenceStart(target, pair.targetPosition);
    let multiplier: number;
    let reason: CapitalizationEvidence["reason"];
    if (sourceToken.surface === targetToken.surface) {
      multiplier = sourceStart || targetStart ? 0.5 : 1;
      reason = sourceStart || targetStart ? "identical_sentence_start" : "identical";
    } else if (sourceToken.folded === targetToken.folded && sourceStart !== targetStart) {
      multiplier = 0.25;
      reason = "different_only_sentence_start";
    } else {
      multiplier = 0;
      reason = "different";
    }
    const rarityKey = source.normalizedTokens?.[pair.sourcePosition] ?? sourceToken.folded;
    return {
      token: pair.token,
      sourceSurface: sourceToken.surface,
      targetSurface: targetToken.surface,
      sourcePosition: pair.sourcePosition,
      targetPosition: pair.targetPosition,
      multiplier,
      weight: weight(rarityKey),
      reason,
    };
  });
}

function isSentenceStart(verse: ScoringVerse, position: number): boolean {
  if (position === 0) return true;
  if (!verse.displayText) return false;
  const previous = verse.tokens[position - 1]!;
  const current = verse.tokens[position]!;
  return /[.!?][\s\])}"'’]*$/u.test(verse.displayText.slice(previous.charEnd, current.charStart));
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
  if (Object.values(config.phraseLevelMultipliers).some((value) => value < 0 || value > 1)) throw new Error("phrase multipliers must be between 0 and 1");
}

function inferCandidateReasons(shared: string[], phrases: PhraseMatch[], crossReference: number): string[] {
  const reasons: string[] = [];
  if (shared.length) reasons.push("shared_nonzero_token");
  if (phrases.some((phrase) => phrase.level === "case_exact")) reasons.push("shared_exact_phrase");
  else if (phrases.some((phrase) => phrase.level === "case_folded")) reasons.push("shared_case_folded_phrase");
  else if (phrases.some((phrase) => phrase.level === "normalized")) reasons.push("shared_normalized_phrase");
  if (crossReference) reasons.push("configured_cross_reference");
  return reasons;
}

const unique = <T>(items: T[]): T[] => [...new Set(items)];
const sum = (items: number[]): number => items.reduce((total, value) => total + value, 0);
const clamp = (value: number): number => Math.min(1, Math.max(0, value));
const round6 = (value: number): number => Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
const range = (start: number, length: number): number[] => Array.from({ length }, (_, index) => start + index);
