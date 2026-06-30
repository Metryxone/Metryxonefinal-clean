# 14 · Assessment Depth Matrix

Depth = item quality, psychometric grounding, AI interpretation, reporting, recommendation. Breadth handled in
15. Scored Shallow / Moderate / Deep.

| Assessment | Item grounding | Psychometric quality | AI interpretation | Reporting | Recommendation | Depth |
|---|---|---|---|---|---|---|
| CAPADEX behavioural | signal→clarity→construct, proxy-language reframe | concern resolver (IDF-weighted), polarity-aware | reasoning + explainability engines | report-pack (behaviour profile) | intervention map | **Deep** |
| Competency | 12-layer ontology, role-DNA weights | runtime weights, expected-level from Role-DNA | inference + confidence + evidence | competency profile + role readiness | gap + roadmap | **Deep** |
| SDI | curated item set | framework parity | moderate | report | moderate | **Moderate** |
| LBI | W1–W10 consolidated | learning-behaviour index | chain triggers | LBI report | interventions | **Moderate-Deep** |
| EI | 8-dim formula authority | deterministic, drop-alert | EI health, progression | EI report | rec confidence (deterministic) | **Deep** |
| Adaptive difficulty | question bank | difficulty metadata exists | target/readiness thresholds | — | — | **Shallow (content-limited)** |
| Voice/avatar screening | LLM rubric on `question_id` | rubric-based | Whisper→LLM scorer | screening report | hire-support | **Moderate** |

## Depth findings (honest)
- **The two flagship assessments (behavioural, competency) are genuinely deep** — multi-layer grounding,
  evidence-backed AI, explainability, and downstream recommendation. This is the product's strongest surface.
- **Adaptive difficulty is the depth outlier:** the *mechanism* is deep but the *served content* is shallow
  (~100% medium items) → effective depth is capped by item-bank distribution, not algorithm. Honest ceiling.
- **AI interpretation is consistently present** but its *accuracy* is unvalidated for the LLM layer (see 20).
- **Psychometric reliability/validity statistics** (Cronbach's α, test-retest, factor structure) are **not
  measured/published** in-repo — a depth-credibility gap for enterprise/clinical buyers. (→ GAP-A2)

## Verdict
**Depth: DEEP for the flagship assessments, MODERATE elsewhere, SHALLOW for served adaptive content.** The two
credibility gaps are (1) item-bank difficulty distribution and (2) published psychometric reliability stats —
both enhancement-only.
