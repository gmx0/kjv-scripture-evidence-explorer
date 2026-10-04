import { formatReference, normalizeToken } from "../../corpus/src/index.ts";
import type { ScoreExplanation } from "./types.ts";
import type { IndexedVerse, SearchEngine } from "./engine.ts";

export type EvidenceType =
  | "exact_word"
  | "exact_phrase"
  | "normalized_word"
  | "rare_word"
  | "word_order"
  | "configured_cross_reference";

export interface EvidenceNode {
  id: string;
  kind: "verse" | "term";
  label: string;
  displayText: string | null;
  role: "source" | "result" | "evidence_term";
  canonicalOrder: number | null;
}

export interface EvidenceEdge {
  id: string;
  source: string;
  target: string;
  evidenceTypes: EvidenceType[];
  explanationId: string;
  score: number | null;
}

export interface EvidenceTableRow {
  edgeId: string;
  sourceLabel: string;
  targetLabel: string;
  evidenceTypes: EvidenceType[];
  summary: string;
  score: number | null;
  explanationId: string;
}

export interface EvidenceGraph {
  query: { reference: string; resultLimit: number; termLimit: number; nodeLimit: number };
  nodes: EvidenceNode[];
  edges: EvidenceEdge[];
  explanations: Record<string, ScoreExplanation | TermEdgeExplanation>;
  tableRows: EvidenceTableRow[];
  truncated: boolean;
  notices: string[];
}

export interface TermEdgeExplanation {
  kind: "term_occurrence";
  term: string;
  verse: string;
  evidenceTypes: EvidenceType[];
  sourceResultExplanationId: string | null;
}

export function buildEvidenceGraph(
  engine: SearchEngine,
  options: { reference: string; resultLimit?: number; termLimit?: number; nodeLimit?: number },
): EvidenceGraph {
  const nodeLimit = integerInRange(options.nodeLimit ?? 40, 2, 100, "nodeLimit");
  const resultLimit = integerInRange(options.resultLimit ?? 12, 1, 50, "resultLimit");
  const termLimit = integerInRange(options.termLimit ?? 12, 0, 25, "termLimit");
  const allowedResults = Math.min(resultLimit, nodeLimit - 1);
  const related = engine.related(options.reference, { limit: allowedResults });
  const sourceLabel = formatReference(related.source.reference);
  const results = related.results.slice(0, allowedResults);
  const resultLabels = results.map((item) => formatReference(item.reference));
  const remainingNodeCapacity = Math.max(0, nodeLimit - 1 - results.length);
  const candidateTerms = selectGraphTerms(engine, results, Number.MAX_SAFE_INTEGER);
  const selectedTerms = candidateTerms.slice(0, Math.min(termLimit, remainingNodeCapacity));
  const verseByLabel = new Map(engine.verses.map((verse) => [formatReference(verse.reference), verse]));

  const nodes: EvidenceNode[] = [
    verseNode(verseByLabel.get(sourceLabel)!, "source"),
    ...resultLabels.map((label) => verseNode(verseByLabel.get(label)!, "result")),
    ...selectedTerms.map((term) => ({
      id: termNodeId(term),
      kind: "term" as const,
      label: term,
      displayText: null,
      role: "evidence_term" as const,
      canonicalOrder: null,
    })),
  ];
  const explanations: EvidenceGraph["explanations"] = {};
  const edges: EvidenceEdge[] = [];

  for (const explanation of results) {
    const targetLabel = formatReference(explanation.reference);
    const explanationId = `score:${sourceLabel}->${targetLabel}`;
    explanations[explanationId] = explanation;
    edges.push({
      id: `edge:${sourceLabel}->${targetLabel}`,
      source: verseNodeId(sourceLabel),
      target: verseNodeId(targetLabel),
      evidenceTypes: evidenceTypesForScore(explanation),
      explanationId,
      score: explanation.score,
    });
  }

  const sourceTerms = normalizedTerms(verseByLabel.get(sourceLabel)!);
  for (const term of selectedTerms) {
    addTermEdge(edges, explanations, sourceLabel, term, sourceTerms.has(term), null);
    for (const explanation of results) {
      if (!explanation.matchedNormalizedTokens.includes(term)) continue;
      const targetLabel = formatReference(explanation.reference);
      const scoreExplanationId = `score:${sourceLabel}->${targetLabel}`;
      addTermEdge(edges, explanations, targetLabel, term, hasExactSurface(explanation, term), scoreExplanationId);
    }
  }

  const labels = new Map(nodes.map((node) => [node.id, node.label]));
  const tableRows = edges.map((edge) => ({
    edgeId: edge.id,
    sourceLabel: labels.get(edge.source)!,
    targetLabel: labels.get(edge.target)!,
    evidenceTypes: edge.evidenceTypes,
    summary: edge.evidenceTypes.map(humanizeEvidenceType).join(", "),
    score: edge.score,
    explanationId: edge.explanationId,
  }));

  return {
    query: { reference: sourceLabel, resultLimit, termLimit, nodeLimit },
    nodes,
    edges,
    explanations,
    tableRows,
    truncated: related.candidateCount > results.length || candidateTerms.length > selectedTerms.length,
    notices: [
      "Graph edges are lexical evidence, not proof of interpretation.",
      "Editorial cross-references are disabled until a licensed, versioned source is approved.",
    ],
  };
}

export function gatherMentions(engine: SearchEngine, options: { term: string; limit?: number }) {
  const limit = integerInRange(options.limit ?? 100, 1, 500, "limit");
  const result = engine.searchExactWord(options.term, { limit });
  return {
    workflow: "gather_mentions" as const,
    term: result.query,
    totalVerses: result.total,
    totalOccurrences: result.totalOccurrences,
    mentions: result.matches.map((match) => ({ ...match, label: formatReference(match.reference), evidenceTypes: ["exact_word"] as EvidenceType[] })),
    truncated: result.total > result.matches.length,
    notice: "These are exact KJV word occurrences in canonical order.",
  };
}

export function candidateMates(engine: SearchEngine, options: { reference: string; limit?: number }) {
  const limit = integerInRange(options.limit ?? 20, 1, 100, "limit");
  const result = engine.related(options.reference, { limit });
  const verseByLabel = new Map(engine.verses.map((verse) => [formatReference(verse.reference), verse]));
  return {
    workflow: "candidate_mates" as const,
    source: { ...result.source, label: formatReference(result.source.reference) },
    candidateCount: result.candidateCount,
    results: result.results.map((explanation, index) => {
      const label = formatReference(explanation.reference);
      return {
        rank: index + 1,
        label,
        displayText: verseByLabel.get(label)!.displayText,
        evidenceTypes: evidenceTypesForScore(explanation),
        explanation,
      };
    }),
    notice: "Candidate mates share informative wording; the ranking does not assert interpretation.",
  };
}

export function divideTerm(engine: SearchEngine, options: { term: string; exampleLimitPerBook?: number }) {
  const exampleLimitPerBook = integerInRange(options.exampleLimitPerBook ?? 3, 1, 10, "exampleLimitPerBook");
  const result = engine.searchExactWord(options.term, { limit: 500 });
  const verseByLabel = new Map(engine.verses.map((verse) => [formatReference(verse.reference), verse]));
  const groupMap = new Map<string, { book: string; bookOrder: number; verseCount: number; occurrenceCount: number; examples: Array<{ label: string; displayText: string; positions: number[]; context: string }> }>();
  for (const match of result.matches) {
    const label = formatReference(match.reference);
    const verse = verseByLabel.get(label)!;
    let group = groupMap.get(match.reference.book);
    if (!group) {
      group = { book: match.reference.book, bookOrder: match.reference.bookOrder, verseCount: 0, occurrenceCount: 0, examples: [] };
      groupMap.set(match.reference.book, group);
    }
    group.verseCount += 1;
    group.occurrenceCount += match.positions.length;
    if (group.examples.length < exampleLimitPerBook) {
      const firstPosition = match.positions[0]!;
      const context = verse.tokens.slice(Math.max(0, firstPosition - 3), firstPosition + 4).map((token) => token.surface).join(" ");
      group.examples.push({ label, displayText: match.displayText, positions: match.positions, context });
    }
  }
  return {
    workflow: "divide_term" as const,
    term: result.query,
    totalVerses: result.total,
    totalOccurrences: result.totalOccurrences,
    groups: [...groupMap.values()].sort((left, right) => left.bookOrder - right.bookOrder),
    truncated: result.total > result.matches.length,
    notice: "Groups show observed book contexts only; they are not generated senses or doctrinal categories.",
  };
}

export function firstMentionChain(engine: SearchEngine, options: { term: string; limit?: number }) {
  const gathered = gatherMentions(engine, options);
  const mentions = gathered.mentions;
  return {
    workflow: "first_mention_chain" as const,
    term: gathered.term,
    firstMention: mentions[0] ?? null,
    mentions,
    links: mentions.slice(1).map((mention, index) => ({
      source: mentions[index]!.label,
      target: mention.label,
      evidenceTypes: ["exact_word"] as EvidenceType[],
      term: gathered.term,
    })),
    truncated: gathered.truncated,
    notice: "The chain follows exact repetitions in canonical order; first occurrence is not an interpretive rule.",
  };
}

export function lexicalWitnesses(engine: SearchEngine, options: { reference: string; count: number; candidateLimit?: number }) {
  const count = integerInRange(options.count, 2, 3, "count");
  const candidateLimit = integerInRange(options.candidateLimit ?? 100, count, 500, "candidateLimit");
  const related = engine.related(options.reference, { limit: candidateLimit });
  const sourceLabel = formatReference(related.source.reference);
  const seenBooks = new Set([related.source.reference.book]);
  const selected: ScoreExplanation[] = [];
  for (const explanation of related.results) {
    if (seenBooks.has(explanation.reference.book)) continue;
    seenBooks.add(explanation.reference.book);
    selected.push(explanation);
    if (selected.length === count) break;
  }
  const verseByLabel = new Map(engine.verses.map((verse) => [formatReference(verse.reference), verse]));
  return {
    workflow: "lexical_witnesses" as const,
    source: { ...related.source, label: sourceLabel },
    requestedCount: count,
    complete: selected.length === count,
    independenceBasis: "distinct_canonical_books" as const,
    witnesses: selected.map((explanation, index) => {
      const label = formatReference(explanation.reference);
      return { rank: index + 1, label, displayText: verseByLabel.get(label)!.displayText, reference: explanation.reference, explanation };
    }),
    notice: "Distinct books provide a transparent lexical-independence heuristic only; this is not a claim of doctrinal independence.",
  };
}

function selectGraphTerms(engine: SearchEngine, results: ScoreExplanation[], limit: number): string[] {
  const terms = new Set(results.flatMap((result) => result.matchedNormalizedTokens));
  return [...terms]
    .sort((left, right) => (engine.statistics.idf[right] ?? 0) - (engine.statistics.idf[left] ?? 0) || left.localeCompare(right, "en"))
    .slice(0, limit);
}

function evidenceTypesForScore(explanation: ScoreExplanation): EvidenceType[] {
  const types: EvidenceType[] = [];
  if (explanation.matchedSurfaceTokens.length) types.push("exact_word");
  if (explanation.matchedNormalizedTokens.length) types.push("normalized_word");
  if (explanation.matchedPhrases.length) types.push("exact_phrase");
  if (explanation.rareTokens.length) types.push("rare_word");
  if (explanation.components.order > 0) types.push("word_order");
  if (explanation.components.crossReference > 0) types.push("configured_cross_reference");
  return types;
}

function addTermEdge(
  edges: EvidenceEdge[],
  explanations: EvidenceGraph["explanations"],
  verseLabel: string,
  term: string,
  exact: boolean,
  scoreExplanationId: string | null,
) {
  const id = `term:${verseLabel}->${term}`;
  const evidenceTypes: EvidenceType[] = exact ? ["exact_word"] : ["normalized_word"];
  explanations[id] = { kind: "term_occurrence", term, verse: verseLabel, evidenceTypes, sourceResultExplanationId: scoreExplanationId };
  edges.push({ id: `edge:${id}`, source: verseNodeId(verseLabel), target: termNodeId(term), evidenceTypes, explanationId: id, score: null });
}

function verseNode(verse: IndexedVerse, role: "source" | "result"): EvidenceNode {
  const label = formatReference(verse.reference);
  return { id: verseNodeId(label), kind: "verse", label, displayText: verse.displayText, role, canonicalOrder: verse.id };
}

function normalizedTerms(verse: IndexedVerse): Set<string> {
  return new Set(verse.tokens.map((token) => normalizeToken(token).normalized));
}

function hasExactSurface(explanation: ScoreExplanation, term: string): boolean {
  return explanation.matchedSurfaceTokens.some((surface) => surface.toLocaleLowerCase("en-US") === term);
}

function humanizeEvidenceType(type: EvidenceType): string {
  return type.replaceAll("_", " ");
}

function verseNodeId(label: string): string { return `verse:${label}`; }
function termNodeId(term: string): string { return `term:${term}`; }

function integerInRange(value: number, minimum: number, maximum: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be an integer from ${minimum} to ${maximum}`);
  }
  return value;
}
