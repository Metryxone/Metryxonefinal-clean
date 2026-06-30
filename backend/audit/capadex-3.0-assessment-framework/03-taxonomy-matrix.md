# CAPADEX 3.0 · Phase 1.3 — Taxonomy Matrix (19 spec names → 10 canonical types)

> Deliverable 03 · Generated 2026-06-30T11:23:41.795Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:9f33dfe717b5, written 2026-06-30T11:23:41.791Z).
> Honesty: Coverage⟂Confidence⟂Outcome (never composited); null ≠ 0; never fabricated.

## Canonical 10-type taxonomy (FROZEN)

| # | Canonical Type | Status | Definition |
|---|---|---|---|
| 1 | Entry Assessment (`entry`) | IMPLEMENTED | First-touch placement — persona capture + concern discovery at the very start of the journey. |
| 2 | Baseline Assessment (`baseline`) | IMPLEMENTED | Initial level snapshot — the first scored run that establishes a reference point. |
| 3 | Diagnostic Assessment (`diagnostic`) | IMPLEMENTED | Concern / behaviour diagnosis — the deepest assessment surface (concern banks, signal analysis, clarity). |
| 4 | Behaviour Assessment (`behaviour`) | IMPLEMENTED | Behavioural signal patterns — timing/linguistic signals captured during the session (4-tier ontology). |
| 5 | Competency Assessment (`competency`) | IMPLEMENTED | Frameworked skill assessment — onto_*/competency_* genome with adaptive question bank. |
| 6 | Learning Assessment (`learning`) | PARTIAL | Knowledge/learning checks — curated coding MCQ, practice sets, learning-path checks. |
| 7 | Performance Assessment (`performance`) | PARTIAL | Applied/role performance — role-DNA fit, talent match, interview intelligence, readiness. |
| 8 | Progress Assessment (`progress`) | PARTIAL | Re-measure vs baseline — employability_scoring_runs deltas across sessions. |
| 9 | Exit Assessment (`exit`) | MISSING | Stage/lifecycle exit gate — a re-administration of existing assessments at stage/lifecycle exit. |
| 10 | Continuous Assessment (`continuous`) | MISSING | Ongoing re-assessment — interval re-administration of existing assessments. |

## Spec-19 → Canonical-10 crosswalk

| Spec name | Canonical type | Note |
|---|---|---|
| Entry | `entry` | Direct. |
| Baseline | `baseline` | Direct. |
| Discovery | `entry` | Concern discovery within Entry/Diagnostic (IntroPhase). |
| Diagnostic | `diagnostic` | Direct (deepest surface). |
| Behaviour | `behaviour` | Direct. |
| Personality | `behaviour` | Behavioural-trait surface; NOT a clinical personality test. |
| Psychometric | `competency` | Delivery method (psychometric question bank / LBI) — folds into Behaviour/Competency, not a separate type. |
| Competency | `competency` | Direct (spine). |
| Skill | `competency` | Skill = competency sub-domain. |
| Learning | `learning` | Direct. |
| Practice | `learning` | Practice = learning sub-type (curated MCQ). |
| Progress | `progress` | Direct (PARTIAL — not systematically re-run). |
| Performance | `performance` | Direct (strong employer-side). |
| Readiness | `performance` | Career readiness folds into Performance (career-readiness-engine). |
| Career | `performance` | Career fit spans Competency+Performance; canonical home = Performance. |
| Leadership | `competency` | Leadership = competency domain (no separate engine). |
| Wellness | `diagnostic` | Wellbeing flags via capadex-intervention-engine within Diagnostic. |
| Exit | `exit` | MISSING — re-administer existing assessments at exit. |
| Continuous | `continuous` | MISSING scheduler; longitudinal substrate exists. |
