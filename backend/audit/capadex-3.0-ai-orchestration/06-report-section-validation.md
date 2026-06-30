# CAPADEX 3.0 · Phase 1.7 — Report Section Validation

> Deliverable 06 · Generated 2026-06-30T15:05:09.697Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:88fda7ccb736, written 2026-06-30T15:05:09.695Z).
> Honesty: Coverage⟂Confidence⟂Outcome⟂Adoption (never composited); null ≠ 0; never fabricated.

The 8 canonical AI report sections, mapped to the EXISTING report builders that render them (verified vs live FS+DB). Reports are COMPOSED by the existing PIL + omega builders — this phase builds NO new report engine.

| Item | Category/Audience | Status | Services | Tables | Absent (honest) |
|---|---|---|---|---|---|
| Executive summary (`summary`) | — | SUPPORTED | 2/2 | 1/1 | — |
| AI analysis / interpretation (`analysis`) | — | SUPPORTED | 2/2 | 1/1 | — |
| Recommendations section (`recommendations`) | — | SUPPORTED | 1/1 | 2/2 | — |
| Intervention / action plan section (`interventions`) | — | SUPPORTED | 1/1 | 1/1 | — |
| Explainability / rationale section (`explainability`) | — | SUPPORTED | 1/1 | 0/0 | — |
| Progress / longitudinal section (`progress`) | — | PARTIAL | 1/1 | 1/1 | — |
| Realized-outcomes section (`outcomes`) | — | PARTIAL | 1/1 | 1/1 | — |
| KPI / benchmark section (`kpis`) | — | PARTIAL | 2/2 | 1/1 | — |

**Rollup:** **5 SUPPORTED · 3 PARTIAL · 0 DEAD_END · 0 MISSING** of 8.

## Definitions & honesty notes
- **Executive summary** (`summary`, SUPPORTED) — AI-composed summary section.
- **AI analysis / interpretation** (`analysis`, SUPPORTED) — Narrative analysis section grounded in reasoning chains.
- **Recommendations section** (`recommendations`, SUPPORTED) — Persisted recommendations rendered into the report.
- **Intervention / action plan section** (`interventions`, SUPPORTED) — Actionable interventions rendered.
- **Explainability / rationale section** (`explainability`, SUPPORTED) — Per-recommendation rationale surfaced in the report.
- **Progress / longitudinal section** (`progress`, PARTIAL) — Longitudinal trend rendered when >1 datapoint exists (Adoption axis, null≠0).
- **Realized-outcomes section** (`outcomes`, PARTIAL) — Realized outcomes surfaced from the canonical ledger; volume usage-driven (Adoption axis).
- **KPI / benchmark section** (`kpis`, PARTIAL) — KPI roll-up + benchmark surfaced; population usage-driven (Adoption axis).
