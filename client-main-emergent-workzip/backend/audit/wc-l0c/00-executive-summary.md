# WC-L0C — Behaviour Signal Source Audit — Executive Summary

**Mode:** AUDIT ONLY. No implementation, no schema, no migrations. STOP FOR APPROVAL.
**Date:** 2026-06-09 · **Scope:** Dev database. **Honesty canon:** Coverage (data exists) and
Confidence (trustworthy/sufficient) reported as separate axes; no fabrication; true ceilings only.

## The question
WC-L0B confirmed persistence = 100%, behaviour dimension coverage = 22.2%, trend coverage = 0%.
Risk appears; motivation / confidence / engagement / adaptability do not. The persistence layer
works — the **source layer** does not. This audit finds the exact reason.

## The answer (one sentence)
The four construct dimensions are **structurally unreachable**: the projection engine matches
behaviour dimensions by running regexes over `signal_key`, but the signal-activation runtime only
ever emits **concern-diagnostic distress keys** (`rapid_answer`, `social_withdrawal`,
`avoidance_pattern`, `cognitive_blocking`, `placement_anxiety`, `career_confusion`,
`emotional_overload`, `prolonged_hesitation`, `GENERAL_CONCERN`, `rapid_answer_pattern`) — and
**every one of those keys matches NONE of the construct regexes**. The intersection is empty, so
motivation/confidence/engagement/adaptability are `null` no matter how many sessions complete.

## Three layered failure points
| FP | Layer | Sessions affected (of 9 completed) | Effect |
|----|-------|-----------------------------------|--------|
| **FP1 — Capture gap** | telemetry/signal capture never fired | 5/9 | no evidence at all → graph absent |
| **FP2 — Activation/graph gap** | telemetry exists but no signals + no graph built | 2/9 | evidence present, never activated/graphed |
| **FP3 — Projection namespace mismatch** (ROOT) | `projectBehaviour` regexes vs runtime vocab | 9/9 | construct dims unreachable even when graphed |

FP3 is the structural root cause. FP1/FP2 are amplifiers that keep even risk/learning_style sparse.

## Coverage vs Confidence (honest split)
- **Coverage** of construct dims today = **0%** (0 of 9 sessions) and will REMAIN 0% under the
  current code **for the currently observed emitted signal namespace** — this is a ceiling, not a
  small-sample artefact. (It would become non-zero only if upstream begins emitting regex-matchable
  construct keys — e.g. future Pragati/seed keys — or the projection mapping changes.)
- **Risk** coverage = 2/9 — and arrives ONLY via the `loadRisks` low-score gate (score < 40 →
  `medium` = 50), NOT from any signal; the risk-signal regex also misses (`emotional_overload`
  ≠ `overwhelm`).
- **learning_style** = 1/9 (one pattern label: "High emotional load").
- **Confidence:** the 22.2% headline is real but composed entirely of risk + one pattern label;
  zero of it is a construct dimension.

## Achievable ceiling (see report 06 for derivation)
- **No change:** construct dims 0% for the currently observed emitted signal namespace (non-zero
  only if upstream emits regex-matchable construct keys or the mapping changes).
- **Fix FP3 only** (polarity-aware signal→dimension map): construct dims become reachable but
  bounded by capture+graph coverage → ~22% today.
- **Fix FP1+FP2+FP3:** ceiling approaches ~100% of sessions that produce ANY behavioural evidence —
  but only as **developmental DEFICITS** (concern signals inverse-code to construct deficits).
  Positive "strengths" (high motivation/confidence) stay unreachable from the distress vocabulary
  per the strengths canon (positive values come only from CSI `positive_factors` / positive growth).

## Deliverables in this folder
1. `01-signal-coverage-report.md` 2. `02-behaviour-graph-report.md` 3. `03-adapter-activation-report.md`
4. `04-projection-failure-report.md` 5. `05-root-cause-analysis.md` 6. `06-remediation-roadmap.md`
