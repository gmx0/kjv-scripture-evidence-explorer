"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { EvidenceGraphResult, WorkflowResult } from "./phase3-results";
import { TopicResult } from "./topic-results";

type Mode = "reference" | "exact-word" | "exact-phrase" | "related" | "compare" | "graph" | "workflow" | "topic";
type WorkflowType = "gather_mentions" | "candidate_mates" | "divide_term" | "first_mention_chain" | "lexical_witnesses";
type JsonObject = Record<string, any>;

const MODE_LABELS: Record<Mode, string> = {
  reference: "Passage",
  "exact-word": "Exact word",
  "exact-phrase": "Exact phrase",
  related: "Related verses",
  compare: "Compare",
  graph: "Evidence graph",
  workflow: "WHGW workflows",
  topic: "Modern topic",
};

const MODE_HINTS: Record<Mode, string> = {
  reference: "Try John 3:16 or Psalms 23:1-3",
  "exact-word": "Try gathered",
  "exact-phrase": "Try in the beginning",
  related: "Try Isaiah 34:16",
  compare: "Enter one verse per line",
  graph: "Try John 3:16",
  workflow: "Enter a word or verse for the selected workflow",
  topic: "Try harmony or transportation",
};

export function StudyWorkbench({ books }: { books: string[] }) {
  const [mode, setMode] = useState<Mode>("related");
  const [input, setInput] = useState("John 3:16");
  const [testament, setTestament] = useState("");
  const [book, setBook] = useState("");
  const [minimumScore, setMinimumScore] = useState(0);
  const [evidenceType, setEvidenceType] = useState("");
  const [workflowType, setWorkflowType] = useState<WorkflowType>("gather_mentions");
  const [witnessCount, setWitnessCount] = useState<2 | 3>(2);
  const [result, setResult] = useState<JsonObject | null>(null);
  const [distribution, setDistribution] = useState<JsonObject | null>(null);
  const [lastQuery, setLastQuery] = useState<JsonObject | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const visibleRelated = useMemo(() => {
    const rows = result?.data?.results ?? [];
    return rows.filter((row: JsonObject) => row.score >= minimumScore && (!evidenceType || row.candidateReasons.includes(evidenceType)));
  }, [result, minimumScore, evidenceType]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setDistribution(null);
    try {
      const query = buildQuery();
      const response = await executeQuery(query);
      setResult(response);
      setLastQuery(query);
      if (mode === "exact-word") {
        const termResponse = await fetch(`/api/v1/terms/${encodeURIComponent(input.trim())}/distribution`);
        setDistribution(await readResponse(termResponse));
      }
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : "The study could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  function buildQuery(): JsonObject {
    const cleaned = input.trim();
    if (mode === "compare") return { mode, references: cleaned.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean) };
    if (mode === "reference") return { mode, input: cleaned, context: 2 };
    if (mode === "graph") return { mode, reference: cleaned, resultLimit: 10, termLimit: 8, nodeLimit: 30 };
    if (mode === "workflow") return { mode, request: workflowRequest(cleaned, workflowType, witnessCount) };
    if (mode === "topic") return { mode, request: { topic: cleaned, limitPerCandidate: 100 } };
    if (mode === "related") return {
      mode,
      input: cleaned,
      limit: 50,
      filters: {
        ...(testament ? { testament } : {}),
        ...(book ? { books: [book] } : {}),
      },
    };
    return { mode, input: cleaned, limit: 100, caseSensitive: false };
  }

  async function executeQuery(query: JsonObject) {
    if (query.mode === "reference") return readResponse(await fetch(`/api/v1/passages/${encodeURIComponent(query.input)}?context=${query.context}`));
    if (query.mode === "exact-word" || query.mode === "exact-phrase") {
      const params = new URLSearchParams({ q: query.input, mode: query.mode === "exact-word" ? "word" : "phrase", limit: String(query.limit), caseSensitive: String(query.caseSensitive) });
      return readResponse(await fetch(`/api/v1/search/exact?${params}`));
    }
    if (query.mode === "related") return postJson("/api/v1/search/related", { reference: query.input, limit: query.limit, filters: query.filters, algorithmVersion: "1.0.0" });
    if (query.mode === "graph") return postJson("/api/v1/graphs/evidence", { reference: query.reference, resultLimit: query.resultLimit, termLimit: query.termLimit, nodeLimit: query.nodeLimit });
    if (query.mode === "workflow") return postJson("/api/v1/workflows", query.request);
    if (query.mode === "topic") return postJson("/api/v1/topics/resolve", query.request);
    return postJson("/api/v1/compare", { references: query.references });
  }

  async function exportRecord() {
    if (!lastQuery) return;
    setError("");
    try {
      const response = await fetch("/api/v1/exports/research-record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lastQuery),
      });
      if (!response.ok) throw new Error((await response.json()).error?.message ?? "Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "kjv-research-record.json";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Export failed");
    }
  }

  async function continueTopic(request: JsonObject) {
    setBusy(true);
    setError("");
    try {
      const response = await postJson("/api/v1/topics/resolve", request);
      setResult(response);
      setLastQuery({ mode: "topic", request });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The topic could not be resolved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="workbench" aria-label="Scripture study workspace">
      <form className="query-panel" onSubmit={submit}>
        <div className="mode-tabs" role="radiogroup" aria-label="Search mode">
          {(Object.keys(MODE_LABELS) as Mode[]).map((item) => (
            <label key={item} className={mode === item ? "active" : ""}>
              <input type="radio" name="mode" value={item} checked={mode === item} onChange={() => { setMode(item); setResult(null); setError(""); }} />
              {MODE_LABELS[item]}
            </label>
          ))}
        </div>
        <label className="query-label" htmlFor="study-query">Study query</label>
        {mode === "compare" ? (
          <textarea id="study-query" rows={4} value={input} onChange={(event) => setInput(event.target.value)} placeholder={MODE_HINTS[mode]} required />
        ) : (
          <div className="query-row">
            <input id="study-query" value={input} onChange={(event) => setInput(event.target.value)} placeholder={MODE_HINTS[mode]} required />
            <button type="submit" disabled={busy}>{busy ? "Searching…" : "Study"}</button>
          </div>
        )}
        {mode === "compare" && <button type="submit" disabled={busy}>{busy ? "Comparing…" : "Compare passages"}</button>}
        {mode === "related" && (
          <fieldset className="filters">
            <legend>Candidate filters</legend>
            <label>Testament<select value={testament} onChange={(event) => setTestament(event.target.value)}><option value="">All</option><option value="OT">Old Testament</option><option value="NT">New Testament</option></select></label>
            <label>Book<select value={book} onChange={(event) => setBook(event.target.value)}><option value="">All books</option>{books.map((name) => <option key={name}>{name}</option>)}</select></label>
            <label>Minimum score<input type="number" min="0" max="1" step="0.01" value={minimumScore} onChange={(event) => setMinimumScore(Number(event.target.value))} /></label>
            <label>Evidence<select value={evidenceType} onChange={(event) => setEvidenceType(event.target.value)}><option value="">All evidence</option><option value="shared_nonzero_token">Shared word</option><option value="shared_exact_phrase">Exact phrase</option></select></label>
          </fieldset>
        )}
        {mode === "workflow" && <fieldset className="filters workflow-controls"><legend>Workflow</legend><label>Method<select value={workflowType} onChange={(event) => setWorkflowType(event.target.value as WorkflowType)}><option value="gather_mentions">Gather mentions</option><option value="candidate_mates">Candidate mates</option><option value="divide_term">Divide term by book</option><option value="first_mention_chain">First-mention chain</option><option value="lexical_witnesses">Two/three witnesses</option></select></label>{workflowType === "lexical_witnesses" && <label>Witness count<select value={witnessCount} onChange={(event) => setWitnessCount(Number(event.target.value) as 2 | 3)}><option value={2}>Two</option><option value={3}>Three</option></select></label>}</fieldset>}
        <p className="notice">{mode === "topic" ? "Dictionary senses are external bridges. They never replace KJV wording or alter Scripture ranking." : "Normalized matches are derived evidence; the displayed KJV wording is never replaced."}</p>
      </form>

      <div className="results-panel">
        <div className="results-heading">
          <div><p className="eyebrow">Evidence record</p><h2>{result ? MODE_LABELS[mode] : "Ready for a query"}</h2></div>
          <button type="button" className="secondary" onClick={exportRecord} disabled={!lastQuery || busy}>Export JSON</button>
        </div>
        <div aria-live="polite" className="sr-only">{busy ? "Search in progress" : error ? `Search error: ${error}` : result ? "Search complete" : ""}</div>
        {error && <div className="error-card" role="alert"><strong>Could not complete the study.</strong><span>{error}</span></div>}
        {!result && !error && <EmptyState />}
        {result && <Interpretation meta={result.meta} />}
        {result && mode === "reference" && <PassageResult data={result.data} />}
        {result && (mode === "exact-word" || mode === "exact-phrase") && <ExactResult data={result.data} distribution={distribution?.data} />}
        {result && mode === "related" && <RelatedResult data={result.data} rows={visibleRelated} />}
        {result && mode === "compare" && <CompareResult data={result.data} />}
        {result && mode === "graph" && <EvidenceGraphResult data={result.data} />}
        {result && mode === "workflow" && <WorkflowResult data={result.data} />}
        {result && mode === "topic" && <TopicResult key={`${result.data.topic}:${result.data.status}`} data={result.data} busy={busy} onContinue={continueTopic} />}
      </div>
    </section>
  );
}

function EmptyState() {
  return <div className="empty-state"><span aria-hidden="true">§</span><h3>Start with a passage or exact phrase.</h3><p>The workbench will show the source text, canonical context, and an inspectable evidence trail.</p></div>;
}

function Interpretation({ meta }: { meta: JsonObject }) {
  return <div className="interpretation"><span>Parsed deterministically</span><code>{meta.queryTrace?.join(" · ")}</code><small>{meta.corpusVersion} / algorithm {meta.algorithmVersion}</small></div>;
}

function PassageResult({ data }: { data: JsonObject }) {
  return <section><div className="section-title"><h3>{data.reference}</h3><span>{data.requested.length} requested verse{data.requested.length === 1 ? "" : "s"}</span></div><ol className="passage-context">{data.context.map((verse: JsonObject) => <li key={verse.label} className={verse.requested ? "requested" : ""}><strong>{verse.label}</strong><p>{verse.displayText}</p></li>)}</ol></section>;
}

function ExactResult({ data, distribution }: { data: JsonObject; distribution?: JsonObject }) {
  return <section>{distribution && <div className="stat-grid"><Stat label="Verse frequency" value={distribution.verseFrequency} /><Stat label="Total occurrences" value={distribution.totalFrequency} /><Stat label="First mention" value={formatRef(distribution.firstMention)} /><Stat label="Last mention" value={formatRef(distribution.lastMention)} /></div>}<div className="section-title"><h3>{data.total} matching verses</h3><span>{data.totalOccurrences} occurrences</span></div><div className="table-wrap"><table><thead><tr><th>Reference</th><th>Exact text</th><th>Positions</th></tr></thead><tbody>{data.matches.map((match: JsonObject) => <tr key={match.label}><th scope="row">{match.label}</th><td>{match.displayText}</td><td><code>{(match.positions ?? match.startPositions).join(", ")}</code></td></tr>)}</tbody></table></div></section>;
}

function RelatedResult({ data, rows }: { data: JsonObject; rows: JsonObject[] }) {
  return <section><blockquote><strong>{data.source.label}</strong><p>{data.source.displayText}</p></blockquote><div className="section-title"><h3>{rows.length} ranked results</h3><span>{data.candidateCount} candidates evaluated</span></div><div className="table-wrap"><table><thead><tr><th>Rank</th><th>Passage</th><th>Score</th><th>Components</th><th>Evidence</th></tr></thead><tbody>{rows.map((row) => <tr key={row.label}><td>{row.rank}</td><th scope="row"><span className="reference">{row.label}</span><p>{row.displayText}</p></th><td><strong>{row.score.toFixed(6)}</strong></td><td><ComponentBars components={row.components} /></td><td><details><summary>Why this matched</summary><dl className="evidence-list"><dt>Shared words</dt><dd>{row.matchedNormalizedTokens.join(", ") || "None"}</dd><dt>Exact phrases</dt><dd>{row.matchedPhrases.map((phrase: JsonObject) => phrase.tokens.join(" ")).join("; ") || "None"}</dd><dt>Rare words</dt><dd>{row.rareTokens.map((token: JsonObject) => `${token.token} (df ${token.documentFrequency})`).join(", ") || "None"}</dd><dt>Candidate reason</dt><dd>{row.candidateReasons.join(", ")}</dd><dt>Tie-break</dt><dd>{row.tieBreak}</dd></dl></details></td></tr>)}</tbody></table></div></section>;
}

function CompareResult({ data }: { data: JsonObject }) {
  return <section><div className="comparison-grid">{data.passages.map((passage: JsonObject) => <blockquote key={passage.label}><strong>{passage.label}</strong><p>{passage.displayText}</p></blockquote>)}</div><div className="token-groups"><div><h3>Common exact tokens</h3><p>{data.commonSurfaceTokens.join(", ") || "None"}</p></div><div><h3>Common normalized tokens</h3><p>{data.commonNormalizedTokens.join(", ") || "None"}</p></div></div><div className="table-wrap"><table><thead><tr><th>Pair</th><th>Score</th><th>Shared phrases</th></tr></thead><tbody>{data.pairs.map((pair: JsonObject) => <tr key={`${pair.source}-${pair.target}`}><th scope="row">{pair.source} ↔ {pair.target}</th><td>{pair.explanation.score.toFixed(6)}</td><td>{pair.explanation.matchedPhrases.map((phrase: JsonObject) => phrase.tokens.join(" ")).join("; ") || "None"}</td></tr>)}</tbody></table></div></section>;
}

function ComponentBars({ components }: { components: JsonObject }) {
  return <div className="component-bars">{Object.entries(components).map(([name, raw]) => { const value = Number(raw); return <span key={name}><small>{name}</small><i><b style={{ width: `${Math.round(value * 100)}%` }} /></i><em>{value.toFixed(3)}</em></span>; })}</div>;
}

function Stat({ label, value }: { label: string; value: unknown }) { return <div className="stat"><span>{label}</span><strong>{String(value ?? "—")}</strong></div>; }
function formatRef(reference: JsonObject | null) { return reference ? `${reference.book} ${reference.chapter}:${reference.verse}` : "—"; }

async function postJson(url: string, body: unknown) {
  return readResponse(await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
}

async function readResponse(response: Response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? `Request failed with status ${response.status}`);
  return body;
}

function workflowRequest(input: string, type: WorkflowType, count: 2 | 3) {
  if (type === "candidate_mates") return { type, reference: input, limit: 20 };
  if (type === "lexical_witnesses") return { type, reference: input, count, candidateLimit: 100 };
  if (type === "divide_term") return { type, term: input, exampleLimitPerBook: 3 };
  return { type, term: input, limit: 100 };
}
