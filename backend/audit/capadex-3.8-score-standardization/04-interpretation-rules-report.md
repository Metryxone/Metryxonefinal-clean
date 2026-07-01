# CAPADEX 3.0 · Program 3 · Phase 3.8 — Interpretation Rules Report (dimension 3 · interpretation)

> Deliverable 04 · Generated 2026-07-01T15:58:21.450Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:71e5cbf5bb8c, written 2026-07-01T15:58:21.449Z).
> Scope: STANDARDIZATION & INTERPRETATION ONLY — standard scores/structured-AST formula engine/interpretation rules/governance/super admin/frontend/ux/APIs/testing/documentation that turn a SCORED + VALIDATED result (3.5 Scoring + 3.6 Science) into standard scores, performance bands and interpretation-rule verdicts; it NEVER re-scores or re-validates the instrument. Benchmark / AI-interpretation / recommendation / report / dashboard / candidate-analytics are OUT OF SCOPE (later phases).
> Honesty: the TEN certification dimensions (standardization · formula · interpretation · governance · super_admin · frontend · ux · apis · testing · documentation) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Norm-referenced standardization ABSTAINS below k_min=30 real members. Formulas are a STRUCTURED AST (no eval / new Function). Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

A standardized score is deterministically interpreted into band / risk-category / development-priority / readiness verdicts via the pure `evaluateInterpretationRule` mechanism — a **rule repository** (`astd_interpretation_rules`), NOT an AI narrative (AI interpretation is OUT OF SCOPE, a later phase). A percentile is classified into a performance band via `classifyBand` using the canonical 9-band ladder (or a custom band set).

**Interpretation rule types:** 9 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (9 total).

| Capability | Status | Note |
|---|---|---|
| **Score interpretation** (`score`) | SUPPORTED | Overall standardized score → band verdict via the interpretation rule repository. |
| **Competency interpretation** (`competency`) | SUPPORTED | Per-competency standardized score → band verdict. |
| **Behaviour interpretation** (`behaviour`) | SUPPORTED | Per-behaviour standardized score → band verdict. |
| **Skill interpretation** (`skill`) | SUPPORTED | Per-skill standardized score → band verdict. |
| **Dimension interpretation** (`dimension`) | SUPPORTED | Per-dimension standardized score → band verdict. |
| **Overall interpretation** (`overall`) | SUPPORTED | Composite / overall standardized score → band verdict. |
| **Risk category** (`risk_category`) | SUPPORTED | Deterministic risk category derived from the standardized score band (low/moderate/high). |
| **Development priority** (`development_priority`) | SUPPORTED | Deterministic development-priority verdict derived from the standardized score band. |
| **Readiness category** (`readiness_category`) | SUPPORTED | Deterministic readiness category derived from the standardized score band (reuses readinessBand). |

**Performance bands:** 8 SUPPORTED · 1 PARTIAL · 0 DEAD_END · 0 MISSING (9 total).

| Capability | Status | Note |
|---|---|---|
| **Outstanding** (`outstanding`) | SUPPORTED | Top canonical band (percentile ≥ 98 by default) — boundaries are config-driven, not hard-coded at runtime. |
| **Excellent** (`excellent`) | SUPPORTED | Percentile ≥ 90 by default. |
| **Strong** (`strong`) | SUPPORTED | Percentile ≥ 75 by default. |
| **Above average** (`above_average`) | SUPPORTED | Percentile ≥ 60 by default. |
| **Average** (`average`) | SUPPORTED | Percentile ≥ 40 by default. |
| **Developing** (`developing`) | SUPPORTED | Percentile ≥ 25 by default. |
| **Needs improvement** (`needs_improvement`) | SUPPORTED | Percentile ≥ 10 by default. |
| **Critical** (`critical`) | SUPPORTED | Bottom canonical band (percentile < 10 by default). |
| **Custom organizational bands** (`custom`) | PARTIAL | Admin-defined band sets (astd_bands) can be stored + applied; PARTIAL until real custom band sets are populated. |

### Interpretation Rule Engine (`interpretation`) — SUPPORTED
_ONE canonical interpretation rule repository (astd_interpretation_rules) deterministically interpreting a standardized score into band / risk-category / development-priority / readiness verdicts across score / competency / behaviour / skill / dimension / overall rule types by COMPOSING classifyBand + readinessBand. Deterministic (no AI), governed, versioned._

- **Services**: services/score-standardization-mechanisms.ts, services/score-standardization-engine.ts
- **Routes**: routes/score-standardization.ts
- **Frontend**: components/standardization/StandardizationWorkbench.tsx
- **Tables**: astd_interpretation_rules, astd_bands
- **Verified**: svc 2/2 · rt 1/1 · fe 1/1 · tbl 0/2


_Custom organizational bands are PARTIAL: the mechanism can store + apply them (`astd_bands`) but a real custom band set is a data-availability boundary, NOT an engineering gap._
