# Founder — Persona Experience Validation

_MX-301D — Persona Experience Validation · generated 2026-06-25T16:26:00.171Z_

**Demonstration candidate:** `user_4286d980cc6cc038` (PII-masked).

The founder consoles (Executive · KPIs · Platform Health · Growth · Intelligence) — platform-level aggregates into which her single assessment is counted, never a drill-down.

**Reachable on 5/5 tabs** (0 directly visible, 5 aggregated/counted).

| Tab | Surface | Auth | Unauth | Authed | Visibility | Evidence / reason |
|---|---|---|---|---|---|---|
| Executive Dashboard | `GET /api/admin/platform/console/executive` | admin | 401 | 200 | 📊 AGGREGATED (counted) | aggregate console reports measurable platform totals AND her assessment row is present in the counted substrate — her assessment is one of the counted data points (counted, not a drill-down) _(total_users=3)_ |
| KPIs | `GET /api/admin/platform/console/founder` | admin | 401 | 200 | 📊 AGGREGATED (counted) | aggregate console reports measurable platform totals AND her assessment row is present in the counted substrate — her assessment is one of the counted data points (counted, not a drill-down) _(new_users_30d=3; total_users=3)_ |
| Platform Health | `GET /api/admin/command-center/console/monitoring` | admin | 401 | 200 | 📊 AGGREGATED (counted) | aggregate console reports measurable platform totals AND her assessment row is present in the counted substrate — her assessment is one of the counted data points (counted, not a drill-down) _(active_governance_alerts=1500; count=1500; count=2; total=12)_ |
| Growth | `GET /api/admin/command-center/console/unified` | admin | 401 | 200 | 📊 AGGREGATED (counted) | aggregate console reports measurable platform totals AND her assessment row is present in the counted substrate — her assessment is one of the counted data points (counted, not a drill-down) _(total=41; total=41; profiles=2; profiles=2; total=2)_ |
| Intelligence | `GET /api/admin/command-center/console/control-tower` | admin | 401 | 200 | 📊 AGGREGATED (counted) | aggregate console reports measurable platform totals AND her assessment row is present in the counted substrate — her assessment is one of the counted data points (counted, not a drill-down) _(candidates_in_review=3; count=3; pending_total=3; total_users=3; active_sessions=183)_ |
