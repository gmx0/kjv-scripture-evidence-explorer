export { DEFAULT_SCORING_CONFIG, inverseDocumentFrequency, scoreVersePair, sortExplanations } from "./scoring.ts";
export type { AlignmentPair, PhraseMatch, ScoreExplanation, ScoringConfig, ScoringVerse } from "./types.ts";
export { buildSearchEngine } from "./engine.ts";
export type { CorpusStatistics, ExactMatch, IndexedVerse, PhraseMatchResult, SearchEngine, SearchMetadata } from "./engine.ts";
export {
  buildEvidenceGraph,
  candidateMates,
  divideTerm,
  firstMentionChain,
  gatherMentions,
  lexicalWitnesses,
} from "./workflows.ts";
export type { EvidenceEdge, EvidenceGraph, EvidenceNode, EvidenceTableRow, EvidenceType, TermEdgeExplanation } from "./workflows.ts";
export { prepareCrossReferenceImport } from "./cross-references.ts";
export type { CrossReferenceManifest, CrossReferenceRecord } from "./cross-references.ts";
export { resolveTopic, TopicResolutionError } from "./topics.ts";
export type { CandidateRanking, CombinedTopicResult, DictionaryProvider, DictionarySelectionSnapshot, DictionarySense, DictionarySnapshot, TopicCandidate, TopicRequest, TopicResolution } from "./topics.ts";
