---
name: Report intelligence composition (PIL reporting layer)
description: Rules for composing existing runtime intelligence into stakeholder reports without faking completeness.
---

# Report intelligence is a COMPOSER, never a producer

A reporting layer that reshapes already-computed runtime intelligence (summaries,
strengths, guidance, pipeline lineage) into stakeholder reports must add NO new
inference. It only reshapes, traces, and formats.

## Explainability vs. chain completeness are two different claims
- **Statement coverage** = "every surfaced statement is backed by ≥1 resolved hop."
  This can legitimately be 100% even on a degraded chain.
- **Chain completeness** = "all lineage hops Response→…→Intervention resolved."
- A statement's trace must cite ONLY resolved hops in its allowed prefix (hops
  1..anchor). It still traces to the *resolved depth* even when its own anchor hop
  is unresolved — e.g. growth-areas anchored at capability_to_problem still shows
  Response→Signal→Concern when hops 1–2 resolved. That is honest, not a bug.
- **Never let high statement-coverage masquerade as a complete chain.** Readiness
  must cap its band below "ready/complete" whenever `degraded=true`, and the note
  must name how many hops are unresolved.
**Why:** an architect review caught a 90/100 "ready — complete and fully traceable"
verdict on a session whose middle hops (concern→capability, capability→problem)
never resolved. Coverage was genuinely 100% (statements traced to resolved depth),
but the band overclaimed chain completeness.
**How to apply:** keep coverage as statement-support, but gate the readiness band +
note on the degraded flag; surface unresolved-hop count in user-facing text.

## Strength items trace off-chain
Strengths are NOT on the concern→intervention chain (canon: strengths come only
from CSI positive_factors / positive longitudinal growth, never raw signal
magnitude). Give them a `self_trace` (Response→Signal(positive)→Strength), and
exclude that synthetic key when asserting "traces cite only resolved chain hops".

## Report route + gating trap (CAPADEX) — don't conflate base vs stakeholder
- `GET /api/capadex/report/:session_id` = the **ungated core base report** (only exposes a
  `dynamic_reporting` metadata flag; always served).
- `GET /api/capadex/session/:id/report` (single, `?stakeholder=`) and `/session/:id/reports`
  (all 3) + `/institution/report` = the **gated PIL stakeholder** reports — gated by
  `isRuntimeIntelligenceActivationEnabled()` (flag `runtimeIntelligenceActivation`), NOT
  `pil_phase6c`/`dynamic_reporting`.
- OMEGA `GET /api/capadex/report/:session_id/omega` has **no** feature-flag wrapper in its route.
**Why:** an audit pass mis-tagged the near-identical `report/:session_id` vs `session/:id/report`
routes (swapped core↔stakeholder), claimed OMEGA was gated, and named the wrong gate.
**How to apply:** before asserting a report's gate/route, grep the actual `app.get(...)` wrapper —
the two routes differ by one path segment and have opposite gating.

## Cohort / multi-id endpoints: strict-validate, don't silently drop
For a route taking a list of session UUIDs, reject the whole request 400 if ANY
token is malformed. Silently filtering invalid ids out yields a degraded/empty
report for bad input and hides client bugs.
**Why:** "bad uuid → 400" was a hard constraint; `raw.filter(validId)` passed
smoke tests but violated it.
