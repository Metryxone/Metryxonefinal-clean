# WC-L0E Deliverable 1 — Behaviour Signal Capture: Root Cause & Activation
_Generated 2026-06-09T15:19:15.380Z_

## Root cause (why only 2/9 completed sessions had a behaviour graph)
The construct-feeding behaviour signals (`career_confusion`, `placement_anxiety`, `social_withdrawal`,
`emotional_overload`, … — the `SIGNAL_DEFICIT_MAP` keys, `signal_type='activated'`, populated
`strength`) are produced by the **Signal Activation Runtime** (`services/signal-activation-runtime.ts`
→ `runEvidenceRuntime`), which is invoked **unconditionally** (no feature-flag gate) on the
`/api/capadex/session/:id/respond` path after each answer batch. The 7 zero-signal completed sessions all
finished **before that runtime was added to the `/respond` code path** — i.e. it is a code-rollout gap,
not a flag flip and not a code defect in the current path. The live path already works forward (the one
post-activation real session captured activation signals + telemetry).

> Note: `FF_RUNTIME_INTELLIGENCE_ACTIVATION` gates the downstream REPORTING/activation surfaces, NOT the
> signal-capture call itself — so capture cannot be "switched on" by that flag; the historical gap can
> only be closed by re-running the engine over the old sessions (this backfill).

> The `signal-classifier.ts` / `lib/signal-ingest.ts` path (the `/api/signals/ingest` endpoint) writes a
> DIFFERENT, strength-less family of rows (`implicit`/`cognitive`/`linguistic`) that the WC-L0D deficit
> map cannot inverse-code. Re-running THAT path would not have populated any construct dimension — only
> the activation runtime produces the strength-bearing concern signals the construct dims consume.

## The fix (WC-L0E backfill — reuse only, flag-gated)
Re-run the EXISTING `runEvidenceRuntime` OFFLINE over each historical zero-signal session, rebuilding the
EvidenceInput batch **purely from persisted `capadex_responses`** (which already snapshot
`concern_bucket`). Telemetry (`response_time_ms` / `answer_changed`) is **omitted, never fabricated**, so
no rapid/hesitation/volatility evidence is invented. Backfilled rows are provenance-stamped
`signal_value.wcl0e_backfill = true`. Gated by `FF_BEHAVIOUR_SIGNAL_BACKFILL` (default OFF). The construct
dims are then projected by the EXISTING WC-L0 persistence (honouring `FF_BEHAVIOUR_NAMESPACE_ALIGNMENT`).

## The true ceiling (honesty canon — not inflated)
| Session class | Count | Backfillable? |
|---|---|---|
| Already-activated (live capture) | 2 | n/a — left untouched |
| Backfilled from responses | 5 | ✅ activated from persisted answers |
| Zero responses (abandoned) | 2 | ❌ **permanently un-backfillable** (no evidence exists) |

The 2 zero-response sessions can **never** produce a behaviour graph honestly (there is no
behavioural evidence to recompute from). They cap the maximum achievable graph coverage at
**7/9 = 77.8%** — reported as the true ceiling, not modelled up.
