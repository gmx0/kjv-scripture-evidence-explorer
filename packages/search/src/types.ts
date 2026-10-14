import type { CanonicalReference, Token } from "../../shared/src/index.ts";

export interface ScoringVerse {
  reference: CanonicalReference;
  tokens: Token[];
  displayText?: string;
  normalizedTokens?: string[];
}

export type MatchLevel = "letter_exact" | "exact_spelling" | "normalized";
export type PhraseLevel = "case_exact" | "case_folded" | "normalized";

export interface ScoringConfig {
  algorithmVersion: string;
  corpusSize: number;
  documentFrequency: Readonly<Record<string, number>>;
  tokenMultipliers?: Readonly<Record<string, number>>;
  rareThreshold: number;
  rareCap: number;
  phraseCap: number;
  matchLevel: MatchLevel;
  phraseLevelMultipliers: {
    caseExact: number;
    caseFolded: number;
    normalized: number;
  };
  weights: {
    jaccard: number;
    phrase: number;
    rare: number;
    order: number;
    capitalization: number;
    crossReference: number;
  };
}

export interface PhraseMatch {
  tokens: string[];
  sourceStart: number;
  targetStart: number;
  level: PhraseLevel;
  multiplier: number;
}

export interface AlignmentPair {
  token: string;
  sourcePosition: number;
  targetPosition: number;
}

export interface MatchedTokenEvidence {
  token: string;
  level: "case_exact" | "case_folded" | "normalized";
  sourceSurface: string;
  targetSurface: string;
  sourcePosition: number;
  targetPosition: number;
}

export interface CapitalizationEvidence {
  token: string;
  sourceSurface: string;
  targetSurface: string;
  sourcePosition: number;
  targetPosition: number;
  multiplier: number;
  weight: number;
  reason: "identical" | "identical_sentence_start" | "different_only_sentence_start" | "different";
}

export interface ScoreExplanation {
  reference: CanonicalReference;
  score: number;
  components: {
    jaccard: number;
    phrase: number;
    rare: number;
    order: number;
    capitalization: number;
    crossReference: number;
  };
  matchLevel: MatchLevel;
  matchedTokens: MatchedTokenEvidence[];
  matchedSurfaceTokens: string[];
  matchedNormalizedTokens: string[];
  matchedPhrases: PhraseMatch[];
  capitalizationEvidence: CapitalizationEvidence[];
  rareTokens: Array<{ token: string; documentFrequency: number; idf: number }>;
  alignment: AlignmentPair[];
  candidateReasons: string[];
  externalBridge: null;
  corpusVersion: string;
  algorithmVersion: string;
}
