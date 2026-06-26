# Super Admin — Persona Experience Validation

_MX-301D — Persona Experience Validation · generated 2026-06-25T16:26:00.170Z_

**Demonstration candidate:** `user_4286d980cc6cc038` (PII-masked).

The super-admin console (Analytics · Assessment · Competencies · Reports · Platform Health) — a mix of her individual assessment (Assessment drill-down) and platform aggregates.

**Reachable on 5/5 tabs** (1 directly visible, 4 aggregated/counted).

| Tab | Surface | Auth | Unauth | Authed | Visibility | Evidence / reason |
|---|---|---|---|---|---|---|
| Analytics | `GET /api/admin/mission-control` | admin | 401 | 200 | 📊 AGGREGATED (counted) | aggregate console reports measurable platform totals AND her assessment row is present in the counted substrate — her assessment is one of the counted data points (counted, not a drill-down) _(Registered users=3; sources_total=3; Active sessions=183; sources_total=7; sources_total=2)_ |
| Assessment | `GET /api/career-intelligence/user_4286d980cc6cc038` | admin | 401 | 200 | ✅ VISIBLE (her assessment) | surfaces her measured assessment data _(score=100; score=100; score=100; score=100)_ |
| Competencies | `GET /api/competency/engine-summary` | admin | 401 | 200 | 📊 AGGREGATED (counted) | aggregate console reports measurable platform totals AND her assessment row is present in the counted substrate — her assessment is one of the counted data points (counted, not a drill-down) _(active_competencies=422)_ |
| Reports | `GET /api/admin/rf/stats` | admin | 401 | 200 | 📊 AGGREGATED (counted) | aggregate console reports measurable platform totals AND her assessment row is present in the counted substrate — her assessment is one of the counted data points (counted, not a drill-down) _(generated_reports=51)_ |
| Platform Health | `GET /api/admin/platform/console/overview` | admin | 401 | 200 | 📊 AGGREGATED (counted) | aggregate console reports measurable platform totals AND her assessment row is present in the counted substrate — her assessment is one of the counted data points (counted, not a drill-down) _(total_users=3; new_users_30d=3; total=7; total_users=3; new_users_30d=3)_ |
