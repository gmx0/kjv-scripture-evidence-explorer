import type { CanonicalReference, Token } from "../../shared/src/index.ts";

export interface ScoringVerse {
  reference: CanonicalReference;
  tokens: Token[];
}

export interface ScoringConfig {
  algorithmVersion: string;
  corpusSize: number;
  documentFrequency: Readonly<Record<string, number>>;
  tokenMultipliers?: Readonly<Record<string, number>>;
  rareThreshold: number;
  rareCap: number;
  phraseCap: number;
  weights: {
    jaccard: number;
    phrase: number;
    rare: number;
    order: number;
    crossReference: number;
  };
}

export interface PhraseMatch {
  tokens: string[];
  sourceStart: number;
  targetStart: number;
}

export interface AlignmentPair {
  token: string;
  sourcePosition: number;
  targetPosition: number;
}

export interface ScoreExplanation {
  reference: CanonicalReference;
  score: number;
  components: {
    jaccard: number;
    phrase: number;
    rare: number;
    order: number;
    crossReference: number;
  };
  matchedSurfaceTokens: string[];
  matchedNormalizedTokens: string[];
  matchedPhrases: PhraseMatch[];
  rareTokens: Array<{ token: string; documentFrequency: number; idf: number }>;
  alignment: AlignmentPair[];
  candidateReasons: string[];
  externalBridge: null;
  corpusVersion: string;
  algorithmVersion: string;
}
