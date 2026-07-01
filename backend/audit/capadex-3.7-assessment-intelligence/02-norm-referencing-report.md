# CAPADEX 3.0 · Program 3 · Phase 3.7 — Norm-Referencing Report (dimension 1 · norms)

> Deliverable 02 · Generated 2026-07-01T14:57:50.706Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:7998539a81e1, written 2026-07-01T14:57:50.705Z).
> Scope: INTERPRETATION & REPORTING ONLY — norm-referencing/standardization/benchmarking/AI-interpretation/report intelligence/candidate performance/frontend/APIs that turn a SCORED + VALIDATED result (3.5 Scoring + 3.6 Science) into MEANING; it NEVER re-scores or re-validates the instrument.
> Honesty: the EIGHT certification dimensions (norms · standardization · benchmarking · ai_interpretation · report_intelligence · candidate_performance · frontend · apis) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Norm-referenced statistics + benchmarks ABSTAIN below k_min=30 real members; AI narrative confidence stays honest-null while cold-start. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

A raw score is interpreted against a norm reference group — cohort, role, stage/lifecycle, self/ipsative (temporal), age/grade, national/population and custom (admin-defined) — via the pure `computeNormReference` mechanism reusing `peer-benchmark` (cohort) + `benchmark-engine` (role) + stage bands + longitudinal snapshots (self) + the additive `aint_norm_tables` overlay. Every norm-referenced statistic ABSTAINS below k_min=30 real members; nothing is fabricated on thin reference groups.

**Norm types:** 4 SUPPORTED · 3 PARTIAL · 0 DEAD_END · 0 MISSING (7 total).

| Capability | Status | Note |
|---|---|---|
| **Cohort norm** (`cohort_norm`) | SUPPORTED | Score interpreted against a k-anonymous peer cohort (peer-benchmark) — ABSTAINS below k_min real members. |
| **Role norm** (`role_norm`) | SUPPORTED | Score interpreted against a role reference group (benchmark-engine role metrics) — ABSTAINS below k_min. |
| **Stage / lifecycle norm** (`stage_norm`) | SUPPORTED | Score interpreted against a lifecycle-stage band (stageBandForScore) — norm boundaries are stage-canonical. |
| **Self / ipsative (temporal) norm** (`self_norm`) | SUPPORTED | Score interpreted against the candidate's own prior scores (longitudinal snapshots) — ipsative growth reference. |
| **Age / grade norm** (`age_norm`) | PARTIAL | Age-referenced norm requires an age-tagged reference sample at k_min per band — honest PARTIAL until adoption volume exists. |
| **National / population norm** (`national_norm`) | PARTIAL | Population norm requires a representative national reference sample — a data-availability boundary, not an engineering gap. |
| **Custom (admin-defined) norm** (`custom_norm`) | PARTIAL | Admin-defined norm tables (aint_norm_tables) can be stored + applied; PARTIAL until real custom norm groups are populated. |

### Norm Referencing (`norms`) — SUPPORTED
_ONE canonical norm-referencing layer (aint_norm_tables) interpreting a raw score against a cohort / role / stage / self reference group by COMPOSING the existing peer-benchmark (k-anonymous cohort) + benchmark-engine (role) + stage bands. Norm-referenced statistics ABSTAIN below k_min real members. Age / national / custom norms stay PARTIAL — data-availability boundaries, not engineering gaps._

- **Services**: services/peer-benchmark.ts, services/benchmark-engine.ts, services/assessment-intelligence-engine.ts, services/assessment-intelligence-mechanisms.ts
- **Routes**: routes/assessment-intelligence.ts
- **Frontend**: components/superadmin/AssessmentIntelligencePanel.tsx, components/intelligence/InterpretationWorkbench.tsx
- **Tables**: capadex_sessions, scoring_runs, aint_norm_tables
- **Verified**: svc 4/4 · rt 1/1 · fe 2/2 · tbl 1/3


_Age/grade, national/population and custom norms are PARTIAL: the mechanism can store + apply them (`aint_norm_tables`) but a k_min-sized age-tagged / representative / custom reference sample is a data-availability boundary, NOT an engineering gap._
