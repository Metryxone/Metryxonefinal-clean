# CAPADEX 3.0 · Program 3 · Phase 3.1 — Assessment Taxonomy & Type Crosswalk

> Deliverable 03 · Generated 2026-07-01T07:15:13.791Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:6a98bbfa5f18, written 2026-07-01T07:15:13.862Z).
> Honesty: the FIVE certification axes (architecture · lifecycle · governance · metadata · repository-alignment) are reported SEPARATELY and NEVER composited. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

ONE taxonomy: the FROZEN 10-type registry (composed from `config/assessment-framework.ts`, never forked). Every legacy/spec name FOLDS into a canonical type OR is honestly marked ABSENT (not a separate type).

## Canonical types (10)
| Type | Status | Spec aliases |
|---|---|---|
| **Entry Assessment** (`entry`) | IMPLEMENTED | Entry, Discovery |
| **Baseline Assessment** (`baseline`) | IMPLEMENTED | Baseline |
| **Diagnostic Assessment** (`diagnostic`) | IMPLEMENTED | Diagnostic, Discovery, Wellness |
| **Behaviour Assessment** (`behaviour`) | IMPLEMENTED | Behaviour, Personality |
| **Competency Assessment** (`competency`) | IMPLEMENTED | Competency, Skill, Psychometric, Leadership, Career |
| **Learning Assessment** (`learning`) | PARTIAL | Learning, Practice |
| **Performance Assessment** (`performance`) | PARTIAL | Performance, Readiness, Career |
| **Progress Assessment** (`progress`) | IMPLEMENTED | Progress |
| **Exit Assessment** (`exit`) | IMPLEMENTED | Exit |
| **Continuous Assessment** (`continuous`) | IMPLEMENTED | Continuous |

## Type crosswalk (22: 20 FOLDS · 2 ABSENT)
Aptitude / Organization / Custom are explicitly reconciled: Aptitude folds into Competency delivery; Organization is an aggregation LENS not a type; Custom is authored via the CAF builder against the canonical types.

| Spec name | Disposition | Canonical type | Note |
|---|---|---|---|
| Entry | FOLDS | entry | Direct. |
| Baseline | FOLDS | baseline | Direct. |
| Discovery | FOLDS | entry | Concern discovery within Entry/Diagnostic (IntroPhase). |
| Diagnostic | FOLDS | diagnostic | Direct (deepest surface). |
| Behaviour | FOLDS | behaviour | Direct. |
| Personality | FOLDS | behaviour | Behavioural-trait surface; NOT a clinical personality test. |
| Psychometric | FOLDS | competency | Delivery method (psychometric question bank / LBI) — folds into Behaviour/Competency, not a separate type. |
| Competency | FOLDS | competency | Direct (spine). |
| Skill | FOLDS | competency | Skill = competency sub-domain. |
| Learning | FOLDS | learning | Direct. |
| Practice | FOLDS | learning | Practice = learning sub-type (curated MCQ). |
| Progress | FOLDS | progress | Direct — systematic re-measurement now instrumented via the progression-capture hook (reuse). |
| Performance | FOLDS | performance | Direct (strong employer-side). |
| Readiness | FOLDS | performance | Career readiness folds into Performance (career-readiness-engine). |
| Career | FOLDS | performance | Career fit spans Competency+Performance; canonical home = Performance. |
| Leadership | FOLDS | competency | Leadership = competency domain (no separate engine). |
| Wellness | FOLDS | diagnostic | Wellbeing flags via capadex-intervention-engine within Diagnostic. |
| Exit | FOLDS | exit | Close-the-loop exit hook implemented via reuse (reached-Mastery eligibility + reached_mastery milestone capture); adoption-gated. |
| Continuous | FOLDS | continuous | Interval re-administration via a derived freshness signal (reuse); no server cron; adoption-gated. |
| Aptitude | FOLDS | competency | Aptitude items fold into Competency/Diagnostic delivery (question-bank cognitive items); NOT a separate canonical type. |
| Organization | ABSENT | — | Organization/institutional roll-up is an AGGREGATION lens (enterprise-analytics), not an assessment type — no separate taxonomy entry. |
| Custom | ABSENT | — | Custom/ad-hoc assessments are authored via the CAF builder against the canonical types — not a distinct taxonomy entry. |
