# CAPADEX 3.0 · Phase 1.6 — Dashboard / Report Validation

> Deliverable 10 · Generated 2026-06-30T14:35:35.480Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:8d7228dfcd7b, written 2026-06-30T14:35:35.479Z).
> Honesty: Coverage⟂Confidence⟂Outcome⟂Adoption (never composited); null ≠ 0; never fabricated.

The outcome/KPI data is exposed READ-ONLY to super-admins (under the global `/api/admin` auth gate) — it composes the EXISTING dashboards/reports, it does not fork a new reporting engine. Endpoints validated:

| Endpoint | Purpose |
|---|---|
| `GET /api/outcome-kpi/enabled` | flag probe (503 OFF) |
| `GET /api/admin/outcome-kpi/model` | canonical spine + outcome types + KPI families + lifecycle rules + personas + axes |
| `GET /api/admin/outcome-kpi/coverage` | per-path coverage (evidence VERIFIED vs FS+DB) |
| `GET /api/admin/outcome-kpi/outcomes` | per-outcome-type coverage |
| `GET /api/admin/outcome-kpi/kpis` | per-KPI-family coverage |
| `GET /api/admin/outcome-kpi/matrices` | per-persona × 8-axis matrices |
| `GET /api/admin/outcome-kpi/effectiveness` | recommendation/intervention effectiveness (rate honest-null) |
| `GET /api/admin/outcome-kpi/personas` | per-persona paths + measured coverage |
| `GET /api/admin/outcome-kpi/gaps` | OPEN gaps + resolved-via-reuse |
| `GET /api/admin/outcome-kpi/summary` | rollup + STRUCTURAL verdict (+ adoption surfaced separately) |
| `GET /api/admin/outcome-kpi/outcomes/persona` | persona⟂outcome read-time-join linkage (k-anon) |

**Honesty rendering:** every dashboard value carries its axis — Coverage (substrate present) ⟂ Confidence (effectiveness, abstained) ⟂ Outcome (realized) ⟂ Adoption (usage). null renders as `—`, never as 0. KPIs read the EXISTING enterprise-analytics substrate; no number is recomputed or fabricated here.

**OFF state:** every data route returns 503 (`outcome_framework_kpi_engine_disabled`); under the global `/api/admin` gate an unauthenticated OFF probe is 401/403/503. Byte-identical-OFF incl. schema.
