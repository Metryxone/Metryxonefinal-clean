# Deliverable 6 — Remediation Roadmap
_Generated 2026-06-08T16:54:03.604Z · proposal only — STOP for approval before executing any step._

All steps are **additive, flag-gated, reversible**, and introduce **no new intelligence model,
ontology, or construct** — they activate EXISTING, already-wired intelligence. Ordered by dependency.

## R1 — Disambiguate + verify the live path (no code change) · LOW effort · DO FIRST
Drive ONE new completed session and check whether Stage + Journey state (and Outcome IF it has a spine)
get written. This resolves the only open ambiguity in this audit — whether the live hook (i) has simply
not fired since the last completion (7d ago) or (ii) fires but writes nothing/fails silently
(`postCompletionHooks` is never-throws, so the data alone can't tell). Highest-value, lowest-cost check.

## R2 — Journey backfill script (mirrors WC-L1 backfill) · LOW effort · ⚠️ degraded output
Add `scripts/wc3/<...>-journey-backfill.ts` that calls the EXISTING `resolveSessionJourney` over
completed sessions. Yields 9/9 routed rows. **Caveat:** all degraded (conf ≈ 0.2)
until Outcome is populated — lifts Journey *coverage* but not *quality*. Do R4 first for it to mean anything.

## R3 — Stage backfill script · LOW effort
Add a stage backfill calling the EXISTING `resolveSessionStage` so `wc3_stage_state` matches the
already-backfilled snapshots. Pure coverage parity; no data ceiling (snapshots prove stage is derivable).

## R4 — Unblock Outcome at the source (the real fix) · MEDIUM effort · prerequisite for meaningful R2
Outcome needs ACTIVE behavioural constructs. Options, highest fidelity first (no new constructs — all
use EXISTING resolvers/data):
1. **Behavioural-spine capture** — ensure `behavioural_hypotheses` (Phase-3 spine) is persisted at
   completion so sessions carry active constructs. This is the canonical input the resolver expects.
2. **Enable `FF_WC3_OUTCOME_CROSSWALK`** so the EXISTING crosswalk can classify the
   **≤3/9** sessions that carry a `primary_construct_key`
   (2) or a non-UNMAPPED concern bridge tag (1) — contingent on the tag resolving
   to a construct. Lower fidelity than (1); will NOT reach the remaining 6/9 sessions.
Until R4 lands, Outcome coverage is honestly **0%** and any "outcome backfill" writes nothing.

## R5 — Re-run WC-L1 trends + re-measure · LOW effort (after R2–R4)
Once Outcome/Journey carry real rows, re-run the WC-L1 backfill so Outcome/Journey trend coverage
reflects real data, then re-run this audit to confirm the ceilings moved for real reasons.

## What NOT to do (honesty guardrails)
- Do **not** backfill Journey alone and report the coverage gain as readiness — the routes are degraded.
- Do **not** fabricate constructs/outcomes to make Outcome non-empty.
- Do **not** tune trend/forecast confidence toward the >90% targets — let real data move them.

## Sequencing
```
R1 (verify live) ─┬─ R3 (stage backfill, independent)
                  └─ R4 (unblock outcome) ──> R2 (journey backfill, now meaningful) ──> R5 (re-trend + re-audit)
```
