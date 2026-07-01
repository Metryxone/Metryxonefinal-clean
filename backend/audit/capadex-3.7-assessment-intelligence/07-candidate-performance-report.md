# CAPADEX 3.0 · Program 3 · Phase 3.7 — Candidate Performance Report (dimension 6 · candidate_performance)

> Deliverable 07 · Generated 2026-07-01T14:57:50.706Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:7998539a81e1, written 2026-07-01T14:57:50.705Z).
> Scope: INTERPRETATION & REPORTING ONLY — norm-referencing/standardization/benchmarking/AI-interpretation/report intelligence/candidate performance/frontend/APIs that turn a SCORED + VALIDATED result (3.5 Scoring + 3.6 Science) into MEANING; it NEVER re-scores or re-validates the instrument.
> Honesty: the EIGHT certification dimensions (norms · standardization · benchmarking · ai_interpretation · report_intelligence · candidate_performance · frontend · apis) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Norm-referenced statistics + benchmarks ABSTAIN below k_min=30 real members; AI narrative confidence stays honest-null while cold-start. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

Candidate-performance analytics — overall standing, dimension profile, percentile standing, peer-relative standing, growth trajectory, readiness band, response consistency and response-time analytics — via the pure `computePerformance` mechanism reusing standardization + `peer-benchmark` + `wc3_longitudinal_snapshots` + the additive `aint_performance` overlay. ABSTAINS below k_min=30 where a reference group is required.

**Candidate-performance metrics:** 6 SUPPORTED · 2 PARTIAL · 0 DEAD_END · 0 MISSING (8 total).

| Capability | Status | Anchors |
|---|---|---|
| **Overall standing** (`overall_standing`) | SUPPORTED | services/assessment-intelligence-mechanisms.ts, aint_performance |
| **Dimension profile** (`dimension_profile`) | SUPPORTED | services/assessment-intelligence-mechanisms.ts, aint_performance |
| **Percentile standing** (`percentile_standing`) | SUPPORTED | services/psychometric-standardization.ts, aint_performance |
| **Peer-relative standing** (`peer_relative`) | SUPPORTED | services/peer-benchmark.ts, aint_performance |
| **Growth trajectory** (`growth_trajectory`) | SUPPORTED | services/assessment-intelligence-mechanisms.ts, wc3_longitudinal_snapshots, aint_performance |
| **Readiness band** (`readiness_band`) | SUPPORTED | services/assessment-intelligence-mechanisms.ts, aint_performance |
| **Response consistency** (`consistency`) | PARTIAL | services/assessment-intelligence-mechanisms.ts, aint_performance |
| **Response-time analytics** (`response_time`) | PARTIAL | services/assessment-intelligence-mechanisms.ts, aint_performance |

### Candidate Performance (`candidate_performance`) — SUPPORTED
_ONE canonical candidate-performance layer (aint_performance) surfacing overall standing / dimension profile / percentile standing / peer-relative standing / growth trajectory / readiness band by COMPOSING the standardization + benchmark + longitudinal substrate. Response-consistency & response-time analytics stay PARTIAL until per-item timing is captured._

- **Services**: services/assessment-intelligence-mechanisms.ts, services/psychometric-standardization.ts, services/peer-benchmark.ts
- **Routes**: routes/assessment-intelligence.ts
- **Frontend**: components/intelligence/InterpretationWorkbench.tsx
- **Tables**: wc3_longitudinal_snapshots, aint_performance
- **Verified**: svc 3/3 · rt 1/1 · fe 1/1 · tbl 1/2


_Response consistency and response-time analytics are PARTIAL: both need per-item response timing captured at scale — a data-availability boundary, NOT an engineering gap._
