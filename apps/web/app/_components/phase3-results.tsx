"use client";

import { useMemo, useState } from "react";

type JsonObject = Record<string, any>;

export function EvidenceGraphResult({ data }: { data: JsonObject }) {
  const [view, setView] = useState<"table" | "graph">("table");
  const [selectedId, setSelectedId] = useState<string | null>(data.edges[0]?.explanationId ?? null);
  const selected = selectedId ? data.explanations[selectedId] : null;
  const positions = useMemo(() => layoutNodes(data.nodes), [data.nodes]);

  return <section>
    <blockquote><strong>{data.query.reference}</strong><p>{data.notices.join(" ")}</p></blockquote>
    <div className="section-title"><h3>{data.nodes.length} nodes · {data.edges.length} explained edges</h3><span>{data.truncated ? "Bounded view — more evidence exists" : "Complete within the requested bounds"}</span></div>
    <div className="view-toggle" role="group" aria-label="Evidence display">
      <button type="button" className={view === "table" ? "active" : "secondary"} onClick={() => setView("table")}>Accessible table</button>
      <button type="button" className={view === "graph" ? "active" : "secondary"} onClick={() => setView("graph")}>Visual graph</button>
    </div>
    {view === "table" ? <GraphTable data={data} select={setSelectedId} /> : <GraphSvg data={data} positions={positions} select={setSelectedId} />}
    {selected && <Explanation explanation={selected} />}
  </section>;
}

function GraphTable({ data, select }: { data: JsonObject; select: (id: string) => void }) {
  return <div className="table-wrap"><table><caption className="sr-only">One row for every evidence-graph edge</caption><thead><tr><th>Source</th><th>Target</th><th>Evidence</th><th>Score</th><th>Explanation</th></tr></thead><tbody>{data.tableRows.map((row: JsonObject) => <tr key={row.edgeId}><th scope="row">{row.sourceLabel}</th><td>{row.targetLabel}</td><td>{row.summary}</td><td>{row.score === null ? "—" : row.score.toFixed(6)}</td><td><button type="button" className="text-button" onClick={() => select(row.explanationId)}>Inspect</button></td></tr>)}</tbody></table></div>;
}

function GraphSvg({ data, positions, select }: { data: JsonObject; positions: Map<string, { x: number; y: number }>; select: (id: string) => void }) {
  return <div className="graph-shell"><svg viewBox="0 0 900 520" role="img" aria-labelledby="graph-title graph-desc"><title id="graph-title">Bounded lexical evidence graph for {data.query.reference}</title><desc id="graph-desc">Verse nodes are rectangles and evidence terms are circles. Use the accessible table for the same edges.</desc>
    <g className="graph-edges">{data.edges.map((edge: JsonObject) => { const source = positions.get(edge.source)!; const target = positions.get(edge.target)!; return <line key={edge.id} x1={source.x} y1={source.y} x2={target.x} y2={target.y} role="button" tabIndex={0} aria-label={`Inspect ${edge.evidenceTypes.join(", ")} edge`} onClick={() => select(edge.explanationId)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") select(edge.explanationId); }} />; })}</g>
    {data.nodes.map((node: JsonObject) => { const point = positions.get(node.id)!; const edge = data.edges.find((item: JsonObject) => item.source === node.id || item.target === node.id); return <g key={node.id} className={`graph-node ${node.role}`} role="button" tabIndex={0} aria-label={`${node.kind}: ${node.label}`} onClick={() => edge && select(edge.explanationId)} onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && edge) select(edge.explanationId); }}>
      {node.kind === "verse" ? <rect x={point.x - 58} y={point.y - 22} width="116" height="44" rx="3" /> : <circle cx={point.x} cy={point.y} r="31" />}
      <text x={point.x} y={point.y + 4} textAnchor="middle">{shortLabel(node.label)}</text>
    </g>; })}
  </svg><p className="graph-legend"><span className="verse-key">Rectangle: verse</span><span className="term-key">Circle: normalized term</span></p></div>;
}

export function WorkflowResult({ data }: { data: JsonObject }) {
  if (data.workflow === "gather_mentions" || data.workflow === "first_mention_chain") {
    return <section><Notice text={data.notice} /><div className="section-title"><h3>{data.totalVerses ?? data.mentions.length} exact mentions</h3><span>{data.truncated ? "Result limit reached" : "Canonical order"}</span></div><MentionTable mentions={data.mentions} /></section>;
  }
  if (data.workflow === "candidate_mates") {
    return <section><Notice text={data.notice} /><blockquote><strong>{data.source.label}</strong><p>{data.source.displayText}</p></blockquote><div className="section-title"><h3>{data.results.length} candidate mates</h3><span>{data.candidateCount} candidates evaluated</span></div><div className="table-wrap"><table><thead><tr><th>Rank</th><th>Passage</th><th>Score</th><th>Why</th></tr></thead><tbody>{data.results.map((row: JsonObject) => <tr key={row.label}><td>{row.rank}</td><th scope="row"><span className="reference">{row.label}</span><p>{row.displayText}</p></th><td>{row.explanation.score.toFixed(6)}</td><td>{row.evidenceTypes.join(", ")}</td></tr>)}</tbody></table></div></section>;
  }
  if (data.workflow === "divide_term") {
    return <section><Notice text={data.notice} /><div className="section-title"><h3>{data.totalOccurrences} occurrences divided by book</h3><span>{data.groups.length} observed book contexts{data.truncated ? " · first 500 verses only" : ""}</span></div>{data.groups.map((group: JsonObject) => <details className="division-group" key={group.book}><summary>{group.book} · {group.verseCount} verses · {group.occurrenceCount} occurrences</summary>{group.examples.map((example: JsonObject) => <blockquote key={example.label}><strong>{example.label}</strong><p>{example.displayText}</p><small>Local context: {example.context}</small></blockquote>)}</details>)}</section>;
  }
  return <section><Notice text={data.notice} /><blockquote><strong>{data.source.label}</strong><p>{data.source.displayText}</p></blockquote><div className="section-title"><h3>{data.witnesses.length} lexical witnesses</h3><span>{data.complete ? "Distinct canonical books" : "Not enough distinct books found"}</span></div><div className="comparison-grid">{data.witnesses.map((item: JsonObject) => <blockquote key={item.label}><strong>{item.rank}. {item.label}</strong><p>{item.displayText}</p><small>Score {item.explanation.score.toFixed(6)} · {item.explanation.matchedNormalizedTokens.join(", ")}</small></blockquote>)}</div></section>;
}

function MentionTable({ mentions }: { mentions: JsonObject[] }) { return <div className="table-wrap"><table><thead><tr><th>Reference</th><th>Exact KJV text</th><th>Token positions</th></tr></thead><tbody>{mentions.map((mention) => <tr key={mention.label}><th scope="row">{mention.label}</th><td><p>{mention.displayText}</p></td><td>{mention.positions.join(", ")}</td></tr>)}</tbody></table></div>; }
function Notice({ text }: { text: string }) { return <p className="notice workflow-notice">{text}</p>; }
function Explanation({ explanation }: { explanation: JsonObject }) { return <aside className="edge-explanation" aria-live="polite"><h3>Selected edge explanation</h3>{explanation.kind === "term_occurrence" ? <p><strong>{explanation.term}</strong> occurs in {explanation.verse} as {explanation.evidenceTypes.join(", ")} evidence.</p> : <><p>Score <strong>{explanation.score.toFixed(6)}</strong></p><dl className="evidence-list"><dt>Shared words</dt><dd>{explanation.matchedNormalizedTokens.join(", ") || "None"}</dd><dt>Exact phrases</dt><dd>{explanation.matchedPhrases.map((phrase: JsonObject) => phrase.tokens.join(" ")).join("; ") || "None"}</dd><dt>Rare words</dt><dd>{explanation.rareTokens.map((term: JsonObject) => term.token).join(", ") || "None"}</dd></dl></>}</aside>; }

function layoutNodes(nodes: JsonObject[]) {
  const positions = new Map<string, { x: number; y: number }>();
  const verses = nodes.filter((node) => node.kind === "verse");
  const terms = nodes.filter((node) => node.kind === "term");
  verses.forEach((node, index) => positions.set(node.id, { x: index === 0 ? 145 : 445, y: index === 0 ? 260 : 55 + index * (410 / Math.max(1, verses.length - 1)) }));
  terms.forEach((node, index) => positions.set(node.id, { x: 755, y: 55 + index * (410 / Math.max(1, terms.length - 1)) }));
  return positions;
}
function shortLabel(label: string) { return label.length > 18 ? `${label.slice(0, 16)}…` : label; }
