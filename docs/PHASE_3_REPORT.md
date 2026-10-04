# Phase 3 Completion Report

Date: 2026-10-04

## Outcome

Phase 3 adds a deterministic, bounded evidence graph and the five planned WHGW workflows without changing corpus text, normalization, scoring weights, candidate rules, or tie-breaking. Every graph edge resolves to a stored explanation and to exactly one row in the accessible table.

## Delivered

- Evidence graphs contain typed verse/term nodes, typed edges, explicit bounds, explanations, truncation state, and table parity.
- The visual graph distinguishes verse rectangles from term circles and supports keyboard edge inspection.
- Gather mentions and first-mention chains preserve exact occurrences in canonical order.
- Candidate mates reuse algorithm `1.0.0` and expose its explanations.
- Divide-term groups only observed contexts by canonical book; it does not invent senses.
- Two/three lexical witnesses use distinct canonical books and explicitly disclaim doctrinal independence.
- Graph and workflow queries can be exported as reproducible JSON research records.
- A versioned editorial cross-reference manifest, validator, and SQL schema exist, but the checked-in set is disabled and contains no editorial data.

## API

- `POST /api/v1/graphs/evidence`
- `POST /api/v1/workflows`
- `POST /api/v1/exports/research-record` for replayable graph and workflow records

## Verification

The unit suite covers graph bounds and parity, deterministic construction, each workflow family, limit failures, and fail-closed cross-reference provenance. Service tests verify API metadata and research-record replay. Playwright covers the table/visual graph path and workflow API labels. Build, type, corpus-integrity, golden-ranking, and browser checks are the release gates.

## Deliberate limits

No licensed editorial cross-reference source has been approved, so that evidence layer is disabled. “Witness” means only a transparent distinct-book lexical heuristic. First mention is reported as ordering evidence, not an interpretive rule. Extremely common divide-term queries report when the 500-verse inspection bound is reached.
