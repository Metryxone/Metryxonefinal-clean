---
name: CAPADEX hypothesis-driven investigation (Phase 0B)
description: How confidence bands, governance roles, and the dual flag systems gate the additive hypothesis layer over the existing CAPADEX engines.
---

# CAPADEX hypothesis-driven investigation — additive layer

Additive deepening of the EXISTING hypothesis / confidence / adaptive engines. The whole point is **flag-off / absent data == byte-identical prior behaviour**. When extending these engines, never change a return path that the live runtime depends on — add bands/governance as *extra* fields and gate any new response shape.

## Two flag systems — do NOT confuse them
- **Engine flags** live in `services/feature-flags.ts`, DB-backed, `isEnabled(snake_case)` (`hypothesis_engine`, `confidence_engine`, `adaptive_questioning`). The runtime engines read THESE.
- **Static config flags** live in `config/feature-flags.ts`, `isFlagEnabled(camelCase)`, env override `FF_<UPPER_SNAKE>`. New presentation-only gates (e.g. `hypothesisDrivenClarity`, default OFF) live HERE so flag-off is self-contained with no DB seed.
**Why:** the `/analyze` clarity envelope must be byte-identical when off without touching the DB; the engines must respect tenant DB flags. Picking the wrong system either leaks a new shape or needs a migration.

## Confidence bands are derived, not stored as authority
`confidenceBand(score)` (weak ≤0.40, moderate ≤0.70, strong >0.70) is a pure read over the existing `confidence` number. Populate `ConfidenceResult.band` at the SINGLE `computeConfidence` construction site so `applyDelta` and every return path inherit it — don't sprinkle band logic across call sites.

## Governance role is the "why we ask", scored separately from "which to ask"
`classifyGovernance()` (pure, no DB/flags) maps to `explore|weaken|eliminate|strengthen`. Priority order matters: no-target→explore, then `contradictionProbe≥0.5`→weaken (outranks band — resolving a contradiction is highest-value), then weak-band→eliminate, else strengthen. Keep rationale non-generic (name the construct + band).

## rankCandidateQuestions is read-only by contract
The selection ranking surface must NOT write a selection record or mutate runtime state — only `selectNextQuestion` does that. Extract the scorer into a shared pure `computeScoreBreakdown`/`scoreCandidate` so selection stays byte-identical, and let the ranking reuse it.
