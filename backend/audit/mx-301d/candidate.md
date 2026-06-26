# Candidate — Persona Experience Validation

_MX-301D — Persona Experience Validation · generated 2026-06-25T16:26:00.167Z_

**Demonstration candidate:** `user_4286d980cc6cc038` (PII-masked).

The candidate, signed in as herself, viewing her own assessment across her tabs (Assessment · Results · Career · Passport · Reports). Strictly self-scoped.

**Reachable on 5/5 tabs** (5 directly visible, 0 aggregated/counted).

| Tab | Surface | Auth | Unauth | Authed | Visibility | Evidence / reason |
|---|---|---|---|---|---|---|
| Assessment | `GET /api/competency/compute-score/user_4286d980cc6cc038` | self | 401 | 200 | ✅ VISIBLE (her assessment) | compute-score surfaces her measured competency domains _(overallScore=78; totalCompetencies=20; domains[7])_ |
| Results | `GET /api/career/hub/summary` | self | 401 | 200 | ✅ VISIBLE (her assessment) | summary surfaces her snapshot-derived employability standing _(ei_score=77; snapshot_count=1; market_readiness=74; interview_readiness=71)_ |
| Career | `GET /api/career/hub/trajectory` | self | 401 | 200 | ✅ VISIBLE (her assessment) | trajectory computed from her snapshot + measured competency levels _(ei_score=77; competency_levels[20]; roles[8]; from_snapshot=true)_ |
| Passport | `GET /api/passport/overview` | self | 401 | 200 | ✅ VISIBLE (her assessment) | passport sections carry synced platform data _(section_total=5 completeness=15)_ |
| Reports | `GET /api/career/hub/report` | self | 401 | 200 | ✅ VISIBLE (her assessment) | career report renders narrative sections built from her snapshot _(sections[3]; ei; trajectory; market)_ |
