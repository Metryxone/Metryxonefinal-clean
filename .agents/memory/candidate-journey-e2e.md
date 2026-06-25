---
name: Candidate journey end-to-end validation
description: How to drive + honestly prove the 12-stage candidate journey (assessment→competency→EI→match→readiness→gap→roadmap→development→passport→signals→progression→persistence)
---

# Candidate journey E2E validation

Driver: `backend/scripts/e2e-candidate-journey.ts` (run `npx tsx ... [subjectId]`, default `demo_subj_pm`). Drives one subject through all 12 stages **in-process** by calling the same engine fns the super-admin HTTP routes call (`getProfile`, `buildEiProfile`, `buildCareerMatch`+`persistCareerMatchSnapshot`, `buildCareerReadiness`/Gap/Roadmap/Development + their `persist*`, `generateCareerPassport`+`persistPassportSnapshot`, `buildCareerSignals`, `persistCareerProgressionSnapshot`+`buildCareerProgression`).

## Honesty rules that matter here
- **Persistence proof = before/after row-count DELTA, never `count>0`.** `count>0` only proves a row *exists* (pre-existing data masks a regression). Read the canonical `list*` reader before and after each `persist*`; persisted = after>before.
**Why:** an existence check can report a false PASS on a broken writer.
- **`career_history` is event-only.** It appends a row ONLY when the readiness band / anchor role CHANGES between snapshots. Two identical snapshots → 0 `career_history` rows is HONEST, not a failure. `growth_tracking` increments on every progression snapshot, so prove stage 11 with the growth delta, report `career_history` separately.
- **Empty downstream is an honest chain, not a bug.** A high-readiness subject (e.g. demo_subj_pm readiness 83.5) yields `gaps=0 → roadmap phases=0 → development streams=0`. Don't force content.
- **A persistable stage that throws must record `persisted=false`** (not `'n/a'`) or stage-12 "all persisted" drops it from the denominator and false-passes. Exit non-zero on any generation/persistence failure so automation can't read a false PASS.
- **The synthetic "all data persisted" roll-up stage must be EXCLUDED from the final summary's persistence ratio.** That stage sets `persisted:true` on itself; its own numerator is correct (it computes before it's pushed), but a summary computed afterward that filters `persisted!=='n/a'` will COUNT the roll-up too → inflates e.g. 8/8 to 9/9 in the committed certification artifact. Exclude it by stage number and assert `summaryNumerator === rollupNumerator === persistableTotal` before emitting, else throw.
**Why:** an MX-301 architect review caught the committed cert showing 9/9 while the in-table roll-up said 8/8 — a measurable inflation in a "never fabricate" deliverable.
- **In-process calls bypass route auth/flag gates by design.** This validates the engine+persistence layer; route-gate validation (flag-OFF 503 / flag-ON 401) is a SEPARATE per-phase check, intentionally out of scope.

## Profile shape gotcha
`getProfile` (`competency-runtime.ts`) returns `ProfileView` with `measured` (bool), `overall_score`, `domain_scores[]`, `history_count` — NOT a `.overall` field. Reading `.overall` falsely reports "no scored assessment". `domain_scores` is `r.profile` (empty array when the JSONB isn't an array) so `domain_scores.length` can be small even for a scored subject; trust `measured` + downstream measurability.

## Verified state (demo_subj_pm, shared dev DB)
All 12 stages GEN✓; competency overall 75, EI ei_score 75 (Strong), readiness 83.5, matches 8, signals 7; stages 4–9 + 11 each insert one row per run (history_rows increment), career_history stays 0 (no transition). The `career_signal_history`/`career_progression_history`/`growth_tracking`/`career_history` tables are lazy-DDL — absent until the first flag-ON POST/persist creates them.
