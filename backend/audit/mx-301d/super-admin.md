# Super Admin — Persona Experience Validation

_MX-301D — Persona Experience Validation · generated 2026-06-25T15:27:31.093Z_

**Demonstration candidate:** `user_4286d980cc6cc038` (PII-masked).

The super-admin console (Analytics · Assessment · Competencies · Reports · Platform Health) — a mix of her individual assessment (Assessment drill-down) and platform aggregates.

**Reachable on 3/5 tabs** (1 directly visible, 2 aggregated/counted).

| Tab | Surface | Auth | Unauth | Authed | Visibility | Evidence / reason |
|---|---|---|---|---|---|---|
| Analytics | `GET /api/admin/mission-control` | admin | 401 | 200 | 📊 AGGREGATED (counted) | aggregate console reports measurable platform totals AND her assessment row is present in the counted substrate — her assessment is one of the counted data points (counted, not a drill-down) _(sources_total=3; sources_total=7; sources_total=2; sources_total=4; sources_total=4)_ |
| Assessment | `GET /api/career-intelligence/user_4286d980cc6cc038` | admin | 401 | 200 | ✅ VISIBLE (her assessment) | surfaces her measured assessment data _(score=95; score=93.3; score=91.2; score=100)_ |
| Competencies | `GET /api/competency/engine-summary` | admin | 401 | 200 | 📊 AGGREGATED (counted) | aggregate console reports measurable platform totals AND her assessment row is present in the counted substrate — her assessment is one of the counted data points (counted, not a drill-down) _(active_competencies=422)_ |
| Reports | `GET /api/admin/vx/reports/overview` | admin | 401 | 200 | ➖ WIRED · no data for her | aggregate console returned no nonzero platform total (honest empty) |
| Platform Health | `GET /api/admin/platform/console/overview` | admin | 401 | 503 | 🔒 FLAG OFF | feature flag OFF (503) — surface not activated |

## Honest gaps (disclosed, never fabricated)

- **Reports** — ➖ WIRED · no data for her: aggregate console returned no nonzero platform total (honest empty)
- **Platform Health** — 🔒 FLAG OFF: feature flag OFF (503) — surface not activated
