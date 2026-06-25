# Candidate — Persona Experience Validation

_MX-301D — Persona Experience Validation · generated 2026-06-25T15:27:31.089Z_

**Demonstration candidate:** `user_4286d980cc6cc038` (PII-masked).

The candidate, signed in as herself, viewing her own assessment across her tabs (Assessment · Results · Career · Passport · Reports). Strictly self-scoped.

**Reachable on 1/5 tabs** (1 directly visible, 0 aggregated/counted).

| Tab | Surface | Auth | Unauth | Authed | Visibility | Evidence / reason |
|---|---|---|---|---|---|---|
| Assessment | `GET /api/competency/compute-score/user_4286d980cc6cc038` | self | 401 | 200 | ➖ WIRED · no data for her | compute-score reads the cra_scores substrate, which is empty for her — her assessment lives in the onto_competency ledger (surfaced via the admin career-intelligence lens), not cra; the candidate self compute-score does NOT backfill from onto (honest substrate split) _(overallScore=0; totalCompetencies=0)_ |
| Results | `GET /api/career/hub/summary` | self | 401 | 400 | ➖ WIRED · no data for her | authed status=400 |
| Career | `GET /api/career/hub/trajectory` | self | 401 | 200 | ➖ WIRED · no data for her | authed 200 but no measured signal detected (honest absence) |
| Passport | `GET /api/passport/overview` | self | 401 | 200 | ✅ VISIBLE (her assessment) | passport sections carry synced platform data _(section_total=5 completeness=15)_ |
| Reports | `GET /api/career/hub/report` | self | 401 | 400 | ➖ WIRED · no data for her | authed status=400 |

## Honest gaps (disclosed, never fabricated)

- **Assessment** — ➖ WIRED · no data for her: compute-score reads the cra_scores substrate, which is empty for her — her assessment lives in the onto_competency ledger (surfaced via the admin career-intelligence lens), not cra; the candidate self compute-score does NOT backfill from onto (honest substrate split)
- **Results** — ➖ WIRED · no data for her: authed status=400
- **Career** — ➖ WIRED · no data for her: authed 200 but no measured signal detected (honest absence)
- **Reports** — ➖ WIRED · no data for her: authed status=400
