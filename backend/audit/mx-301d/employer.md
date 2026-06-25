# Employer — Persona Experience Validation

_MX-301D — Persona Experience Validation · generated 2026-06-25T16:02:48.730Z_

**Demonstration candidate:** `user_4286d980cc6cc038` (PII-masked).

An employer/elevated session viewing the candidate against a real role (Candidate Match · Competency Match · Interview · Hiring Dashboard).

**Reachable on 2/4 tabs** (1 directly visible, 1 aggregated/counted).

| Tab | Surface | Auth | Unauth | Authed | Visibility | Evidence / reason |
|---|---|---|---|---|---|---|
| Candidate Match | `GET /api/talent-matching-engine/candidate/user_4286d980cc6cc038/role/role_pm` | admin | 401 | 200 | ➖ WIRED · no data for her | route resolves the candidate + role requirements, but her actuals are all null (evidence_mix.measured=0) — her assessment carries domain-proxy / EI data, NOT the precise per-competency (comp_*) levels this matcher needs (honest ceiling, not fabricated) _(evidence_mix measured=0 inferred=0 none=6; match_pct=0 confidence_pct=0)_ |
| Competency Match | `GET /api/v2/employer/competency-match/feature-flag` | admin | 200 | 200 | ➖ WIRED · no data for her | composer ACTIVE (flag on) but exposes NO per-candidate HTTP data route — competency match is computed server-side from her ledger; same precise comp_* ceiling as Candidate Match |
| Interview | `GET /api/interview-intelligence/job/mx301_demo_job/candidate/user_4286d980cc6cc038/evaluation` | admin | 401 | 200 | ✅ VISIBLE (her assessment) | operator-recorded interview scores present _(interviews_scored=1 total_scores=4)_ |
| Hiring Dashboard | `GET /api/employer/hiring/readiness` | admin | 401 | 200 | 📊 AGGREGATED (counted) | aggregate console reports measurable platform totals AND her assessment row is present in the counted substrate — her assessment is one of the counted data points (counted, not a drill-down) _(total=52)_ |

## Honest gaps (disclosed, never fabricated)

- **Candidate Match** — ➖ WIRED · no data for her: route resolves the candidate + role requirements, but her actuals are all null (evidence_mix.measured=0) — her assessment carries domain-proxy / EI data, NOT the precise per-competency (comp_*) levels this matcher needs (honest ceiling, not fabricated)
- **Competency Match** — ➖ WIRED · no data for her: composer ACTIVE (flag on) but exposes NO per-candidate HTTP data route — competency match is computed server-side from her ledger; same precise comp_* ceiling as Candidate Match
