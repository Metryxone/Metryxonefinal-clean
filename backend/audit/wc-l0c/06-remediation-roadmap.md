# Deliverable 6 — Remediation Roadmap (recommendation only — AUDIT, no implementation)

> Nothing below is implemented. This is the **minimum fix set** with honest achievable ceilings.
> All work would be additive, flag-gated, read-only over already-computed data, never fabricating.

## Achievable coverage ceiling (derivation)
| Scenario | motivation/confidence/engagement/adaptability | risk | learning_style |
|----------|:--:|:--:|:--:|
| **No change (today)** | **0%** (structural, for currently observed emitted namespace) | 2/9 (low-score only) | 1/9 |
| **Fix FP3 only** (signal→dim map) | ≤ 2/9 ≈ 22% (bounded by graphed sessions) | 2/9 → more if signal-side risk alias added | 1/9 |
| **Fix FP1+FP2+FP3** | → ~100% of sessions that produce ANY behavioural evidence | same | rises with pattern capture |

**Hard honesty ceiling:** even fully fixed, concern signals yield construct **deficits only**.
"High motivation/confidence" (positive strengths) stays unreachable from the distress vocabulary —
positive values may come only from CSI `positive_factors` / positive longitudinal growth. Report
construct dims with **Coverage** (was a signal present?) and **Confidence** (deficit vs strength,
single-signal vs corroborated) as separate axes.

## Minimum fix set (priority order)

### FIX 1 — Replace dead construct regexes with a polarity-aware signal→dimension map (ROOT, highest leverage)
- **What:** in `projectBehaviour` / `strengthByKey`, swap the 4 construct regexes for an explicit
  map keyed on the runtime's actual emitted vocabulary (and its ontology family), with a **polarity**
  flag so a concern signal inverse-codes to a construct **deficit** (e.g. `avoidance_pattern` →
  adaptability⁻ & engagement⁻; `cognitive_blocking` → engagement⁻; `placement_anxiety` →
  confidence⁻; `career_confusion` → motivation⁻; `social_withdrawal` → engagement⁻;
  `emotional_overload` → risk⁺).
- **Also:** add an `overload|overwhelm` alias to the risk signal regex so risk can come from signals,
  not only the low-score gate.
- **Why it is the minimum:** this alone makes the four dimensions reachable for every already-graphed
  session — no schema, no new capture. Bounded by graph coverage (FIX 2).
- **Honesty guard:** map emits deficits + provenance; never a positive strength from a concern key.

### FIX 2 — Close the capture/activation/graph gap so projection has inputs (FP1 + FP2)
- **What:** ensure `runActivation` + `buildBehaviorGraph` run on **every** completion (not just the 2
  observed), and that telemetry-only sessions (`d0f54fc4`, `a0924499`) convert telemetry → signals.
  Backfill graphs for the 7 ungraphed completed sessions.
- **Why:** lifts the construct ceiling from ~22% toward full coverage of evidence-bearing sessions.
- **Note:** investigate the 34 orphan graphs (session_id not in `capadex_sessions`) — id-space /
  test sessions; out of scope to "fix" but confirm they are not masking a real id-mapping bug.

### FIX 3 — Give telemetry-derived candidates a real strength
- **What:** `rapid_answer` / `prolonged_hesitation` rows persist with `strength = NULL` → contribute
  0 even when matched. Assign a strength on activation so they can register once mapped.

### FIX 4 — Keep positive strengths sourced honestly (canon guard)
- **What:** when surfacing construct dims, draw any **positive** value only from CSI `positive_factors`
  / positive longitudinal growth; label concern-derived dims explicitly as developmental deficits.

## What NOT to do
- Do **not** lower activation thresholds to force more signals — the problem is vocabulary, not
  threshold (CANDIDATE_MIN 0.2 is not the gate that fails).
- Do **not** infer positive strengths from concern-signal magnitude (violates strengths canon).
- Do **not** add new ontology/signals — the atomic ontology already covers the constructs.

## Suggested sequencing
FIX 1 (unblocks the structural ceiling) → FIX 2 (raises coverage) → FIX 3 (cleanup) → FIX 4 (honesty
hardening). FIX 1 is the single change that moves construct coverage off 0%.

---
**STATUS: AUDIT COMPLETE — STOP FOR APPROVAL. No code, schema, or migration was changed.**
