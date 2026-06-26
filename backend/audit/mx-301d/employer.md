# Employer — Persona Experience Validation

_MX-301D — Persona Experience Validation · generated 2026-06-25T16:26:00.170Z_

**Demonstration candidate:** `user_4286d980cc6cc038` (PII-masked).

An employer/elevated session viewing the candidate against a real role (Candidate Match · Competency Match · Interview · Hiring Dashboard).

**Reachable on 3/4 tabs** (2 directly visible, 1 aggregated/counted).

| Tab | Surface | Auth | Unauth | Authed | Visibility | Evidence / reason |
|---|---|---|---|---|---|---|
| Candidate Match | `GET /api/talent-matching-engine/candidate/user_4286d980cc6cc038/role/role_pm` | admin | 401 | 200 | ✅ VISIBLE (her assessment) | candidate competency evidence flows into the match _(evidence_mix measured=6 inferred=0 none=0; match_pct=100 confidence_pct=100)_ |
| Competency Match | `GET /api/v2/employer/competency-match/user_4286d980cc6cc038/mx301d-probe-job` | admin | 401 | 200 | ✅ VISIBLE (her assessment) | competency-driven match computed from her onto ledger vs role DNA _(competencyMatch=100; matched=3/13; direct=2 proxy=1; coverage=22.1%)_ |
| Interview | `GET /api/interview-intelligence/job/mx301d-probe-job/candidate/user_4286d980cc6cc038/evaluation` | admin | 401 | 200 | ➖ WIRED · no data for her | wired + secured, but Interview is OPERATOR-INPUT driven (arithmetic over panelist scores) — it does NOT consume the competency ledger, and no interview scores exist for her _(interviews_scored=0 total_scores=0)_ |
| Hiring Dashboard | `GET /api/employer/hiring/readiness` | admin | 401 | 200 | 📊 AGGREGATED (counted) | aggregate console reports measurable platform totals AND her assessment row is present in the counted substrate — her assessment is one of the counted data points (counted, not a drill-down) _(total=52)_ |

## Honest gaps (disclosed, never fabricated)

- **Interview** — ➖ WIRED · no data for her: wired + secured, but Interview is OPERATOR-INPUT driven (arithmetic over panelist scores) — it does NOT consume the competency ledger, and no interview scores exist for her
