# CAPADEX 3.0 · Phase 1.7 — Dashboard Validation

> Deliverable 07 · Generated 2026-06-30T15:05:09.697Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:88fda7ccb736, written 2026-06-30T15:05:09.695Z).
> Honesty: Coverage⟂Confidence⟂Outcome⟂Adoption (never composited); null ≠ 0; never fabricated.

The 8 dashboard surfaces that surface the AI orchestration outputs, by audience, mapped to the EXISTING dashboards (verified vs live FS+DB). The phase COMPOSES the existing dashboards; it does not fork a new reporting engine.

| Item | Category/Audience | Status | Services | Tables | Absent (honest) |
|---|---|---|---|---|---|
| AI-powered reports (user) (`ai_powered_reports`) | user | SUPPORTED | 0/0 | 1/1 | — |
| Report Factory (super-admin) (`report_factory_admin`) | super_admin | SUPPORTED | 0/0 | 1/1 | — |
| CAPADEX reports (super-admin) (`capadex_reports_admin`) | super_admin | SUPPORTED | 0/0 | 1/1 | — |
| Recommendation analytics (super-admin) (`recommendation_analytics_admin`) | super_admin | SUPPORTED | 0/0 | 2/2 | — |
| Outcome intelligence (super-admin) (`outcome_intelligence_admin`) | super_admin | SUPPORTED | 0/0 | 1/1 | — |
| Enterprise analytics / KPI (super-admin) (`enterprise_analytics_admin`) | super_admin | PARTIAL | 0/0 | 1/1 | — |
| AI governance (super-admin) (`ai_governance_admin`) | super_admin | SUPPORTED | 0/0 | 0/0 | — |
| User AI insights (Career Builder) (`user_ai_insights`) | user | SUPPORTED | 0/0 | 0/0 | — |

**Rollup:** **7 SUPPORTED · 1 PARTIAL · 0 DEAD_END · 0 MISSING** of 8.

## Definitions & honesty notes
- **AI-powered reports (user)** (`ai_powered_reports`, SUPPORTED) — User-facing AI report surface.
- **Report Factory (super-admin)** (`report_factory_admin`, SUPPORTED) — Admin report orchestration surface.
- **CAPADEX reports (super-admin)** (`capadex_reports_admin`, SUPPORTED) — Admin CAPADEX report inventory.
- **Recommendation analytics (super-admin)** (`recommendation_analytics_admin`, SUPPORTED) — Admin recommendation analytics + RIE recommendations.
- **Outcome intelligence (super-admin)** (`outcome_intelligence_admin`, SUPPORTED) — Admin realized-outcome intelligence.
- **Enterprise analytics / KPI (super-admin)** (`enterprise_analytics_admin`, PARTIAL) — KPI dashboard; population usage-driven (Adoption axis, null≠0).
- **AI governance (super-admin)** (`ai_governance_admin`, SUPPORTED) — AI governance + rules surface.
- **User AI insights (Career Builder)** (`user_ai_insights`, SUPPORTED) — User-facing AI competency insights in the Career Builder.
