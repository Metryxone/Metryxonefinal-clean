---
name: Adaptive Questioning (Phase B)
description: How the flag-gated adaptive clarify runtime is wired across backend + frontend, and the non-obvious decisions that keep it safe.
---

# Adaptive Questioning (CAPADEX clarify phase)

Makes the clarify phase feel adaptive, not scripted: dynamic pathing, info-gain,
zero-repetition, contradiction probing, adaptive length. Strictly additive, flag
default OFF, never 404/500, degrades to the legacy static batch flow.

## Non-obvious decisions
- **One pool, two entry points.** `/adaptive-next` MUST rebuild the candidate pool with the
  SAME `parseAnalyzeEnvelope` + `analyzeConcern(...,excludeIds)` path that `/analyze` uses,
  or the adaptive questions drift from the batch (different proxy-reframe / seen-filtering).
  **Why:** the pool is built with side-effecting reframing; re-deriving it any other way
  silently diverges. **How to apply:** when adding any incremental-question endpoint, reuse
  the analyze envelope + analyzeConcern, never re-query raw clarity rows.
- **`response_value` from the client is a distress proxy = chosen option index / (len-1)**,
  last option = max intensity. This is only valid because trait-inference attributes an
  answer to a trait ONLY when the STEM carries distress keywords, and those stems use
  ascending-intensity option scales. Do NOT try to send a "correct" polarity-aware value
  from the client — the engine handles polarity; the naive index proxy is intentional.
- **Frontend arms adaptive only when** `adaptive_enabled && batch.length>0 && no prefilled`.
  Prefill keeps the deterministic batch flow (mixing prefill indices with appended adaptive
  questions corrupts the index-keyed `clarifyAnswers`).
- **Graceful degradation is the contract, not a nicety.** Every adaptive failure mode
  (flag off, `enabled:false`, network error, duplicate/empty pick, client cap) falls back to
  the next unshown question from the retained full batch, or finishes to the bridge phase.
  The endpoint returns HTTP 200 `{enabled:false}` even on internal error — never 500.
- **Contradiction trait-pairs are gated behind the SAME static flag** (`isAdaptiveQuestioningEnabled`)
  inside the existing `detectContradictions` orchestrator — flag off → dormant, byte-identical.
  The CHECK constraint on `contradiction_events` had to be extended by migration to accept the
  3 new contradiction types, or inserts would throw.
