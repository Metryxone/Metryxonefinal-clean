# CAPADEX 3.0 · Program 3 · Phase 3.7 — Benchmarking Report (dimension 3 · benchmarking)

> Deliverable 04 · Generated 2026-07-01T14:57:50.706Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:7998539a81e1, written 2026-07-01T14:57:50.705Z).
> Scope: INTERPRETATION & REPORTING ONLY — norm-referencing/standardization/benchmarking/AI-interpretation/report intelligence/candidate performance/frontend/APIs that turn a SCORED + VALIDATED result (3.5 Scoring + 3.6 Science) into MEANING; it NEVER re-scores or re-validates the instrument.
> Honesty: the EIGHT certification dimensions (norms · standardization · benchmarking · ai_interpretation · report_intelligence · candidate_performance · frontend · apis) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Norm-referenced statistics + benchmarks ABSTAIN below k_min=30 real members; AI narrative confidence stays honest-null while cold-start. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

A candidate is benchmarked against a reference group — peer-cohort, role, stage/lifecycle, temporal-self (over time), institution and national/population — via the pure `computeBenchmark` mechanism reusing `peer-benchmark` + `benchmark-engine` + `wc3_longitudinal_snapshots` + the additive `aint_benchmarks` overlay. Each benchmark ABSTAINS below k_min=30 real members in the reference group.

**Benchmark scopes:** 4 SUPPORTED · 2 PARTIAL · 0 DEAD_END · 0 MISSING (6 total).

| Capability | Status | Anchors |
|---|---|---|
| **Peer-cohort benchmark** (`peer_cohort`) | SUPPORTED | services/peer-benchmark.ts, services/assessment-intelligence-mechanisms.ts, aint_benchmarks |
| **Role benchmark** (`role`) | SUPPORTED | services/benchmark-engine.ts, services/assessment-intelligence-mechanisms.ts, aint_benchmarks |
| **Stage / lifecycle benchmark** (`stage`) | SUPPORTED | services/peer-benchmark.ts, aint_benchmarks |
| **Temporal (self-over-time) benchmark** (`temporal_self`) | SUPPORTED | services/assessment-intelligence-mechanisms.ts, wc3_longitudinal_snapshots, aint_benchmarks |
| **Institution benchmark** (`institution`) | PARTIAL | services/benchmark-engine.ts, aint_benchmarks |
| **National / population benchmark** (`national`) | PARTIAL | services/assessment-intelligence-mechanisms.ts, aint_benchmarks |

### Benchmarking (`benchmarking`) — SUPPORTED
_ONE canonical benchmarking layer (aint_benchmarks) comparing a candidate against peer-cohort / role / stage / temporal-self reference groups by COMPOSING peer-benchmark + benchmark-engine + longitudinal snapshots. Benchmarks ABSTAIN below k_min real members. Institution & national benchmarks stay PARTIAL until those reference groups are populated._

- **Services**: services/peer-benchmark.ts, services/benchmark-engine.ts, services/assessment-intelligence-mechanisms.ts
- **Routes**: routes/assessment-intelligence.ts
- **Frontend**: components/intelligence/InterpretationWorkbench.tsx
- **Tables**: wc3_longitudinal_snapshots, aint_benchmarks
- **Verified**: svc 3/3 · rt 1/1 · fe 1/1 · tbl 1/2


_Institution and national benchmarks are PARTIAL: the mechanism supports them but a k_min-sized institution / representative national reference group is a data-availability boundary, NOT an engineering gap._
