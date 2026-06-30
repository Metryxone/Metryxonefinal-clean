# 07 · Assessment Consolidation Report

ONE assessment taxonomy. Classifies every assessment by the brief's type set (Entry/Baseline/Diagnostic/
Progress/Behaviour/Competency/Learning/Performance/Exit/Continuous), flags overlaps/duplicates/missing depth.

## Canonical assessment-type taxonomy vs repo reality
| Type | Definition | Repo evidence | Status |
|---|---|---|---|
| **Entry** | First-touch placement | CAPADEX intro/persona capture, free assessment modal | **IMPLEMENTED** |
| **Baseline** | Initial level snapshot | first competency/EI run, scoring_runs | **IMPLEMENTED** |
| **Diagnostic** | Concern/behavior diagnosis | CAPADEX concern banks, signal analysis, clarity mapping | **IMPLEMENTED (deepest surface)** |
| **Behaviour** | Behavioral signal patterns | signal ontology (4-tier), behaviour namespace | **IMPLEMENTED** |
| **Competency** | Frameworked skill assessment | `onto_*`/`competency_*`, adaptive question bank | **IMPLEMENTED** |
| **Learning** | Knowledge/learning checks | curated coding MCQ, learning paths | **PARTIAL** (uneven across stages) |
| **Performance** | Applied/role performance | role-DNA, talent match, interview intel | **PARTIAL overall** (STRONG in employer surface, thin learner-side) |
| **Progress** | Re-measure vs baseline | scoring_runs deltas exist; **not systematically re-administered** | **PARTIAL → MISSING (systematic)** |
| **Exit** | Stage/lifecycle exit gate | — | **MISSING** |
| **Continuous** | Ongoing re-assessment | — | **MISSING** |

## Overlaps / duplicates found
- **Concern-diagnostic vs Behaviour-signal** overlap in inputs but are *distinct subjects* (per 04 dictionary);
  keep separate — not a duplicate to merge, a boundary to document.
- **Competency assessment exists in two products by design** (student LBI `lbi_*` ⟂ Competency `onto_*`) — these
  are **intentionally separate**, NOT a duplicate to consolidate (carried from memory: LBI ⟂ Competency).
- **Adaptive question bank** served set is ~100% medium difficulty → effective difficulty ceiling (depth gap,
  not a duplicate).

## Missing depth (the consolidated finding)
- **Exit + Continuous assessment types are absent across all stages.** This is the *mechanism* behind the
  platform-wide "no closed growth loop" gap: without Exit/Continuous + systematic Progress re-administration,
  the product cannot measure improvement (→ 11 GAP-P1/A4).
- **Learning + Performance are uneven** — strong on employer side, thin on the learner back-half.

## CANONICAL TAXONOMY (recommendation)
> **Keep the strong core — Entry, Baseline, Diagnostic, Behaviour, Competency, plus Performance which is STRONG
> in the employer surface but PARTIAL platform-wide (thin learner-side). Treat Progress as PARTIAL (data exists,
> not systematically re-run). Treat Exit + Continuous as the priority MISSING types to instrument — reusing
> existing assessments re-administered at exit/interval, not net-new assessment engines.**

## Verdict
**ONE taxonomy; front-half assessment is mature and non-duplicative.** The back-half (Progress-systematic,
Exit, Continuous) is the depth gap. No assessment type is fabricated; LBI⟂Competency separation is preserved.
