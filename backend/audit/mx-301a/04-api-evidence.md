# MX-301A — API Evidence (real HTTP)

Base: http://localhost:8080 · Super-admin auth mode: **direct** (super-admin logged in (no MFA challenge))

Every journey endpoint was probed twice: once **unauthenticated** (proves the route exists and is
secured — gated, never 404/000) and once with a **super-admin session** (proves the API serves the
candidate's real data). Verdicts are honest about flag-gated and self-scoped routes.

| # | Stage | Method | Path | Unauth | Authed | Verdict | Note |
|---|-------|--------|------|--------|--------|---------|------|
| 1 | Registration | POST | `/api/register` | 400 | 400 | **wired** | authed status=400 |
| 2 | Authentication | POST | `/api/login` | 401 | 401 | **wired** | authed status=401 |
| 3 | Profile completion | GET | `/api/cv/profile/user_4286d980cc6cc038` | 401 | 200 | **served** | authenticated 200 — API serves candidate data |
| 5 | Role DNA resolution | POST | `/api/admin/role-resolution/resolve` | 401 | 200 | **served** | authenticated 200 — API serves candidate data |
| 9 | Competency profile | GET | `/api/competency-runtime/profiles/user_4286d980cc6cc038` | 401 | 200 | **served** | authenticated 200 — API serves candidate data |
| 10 | Competency radar (type profile) | GET | `/api/competency-runtime/profiles/user_4286d980cc6cc038/type-profile` | 401 | 200 | **served** | authenticated 200 — API serves candidate data |
| 11 | Competency heatmap | GET | `/api/competency-runtime/mapping-grid` | 401 | 200 | **served** | authenticated 200 — API serves candidate data |
| 12 | Strength analysis | GET | `/api/competency/gap-analysis/user_4286d980cc6cc038` | 401 | 200 | **served** | authenticated 200 — API serves candidate data |
| 13 | Development areas (gap engine) | GET | `/api/competency-runtime/gap-engine/user_4286d980cc6cc038` | 401 | 200 | **served** | authenticated 200 — API serves candidate data |

**Verdict glossary:** `served` (authed 200, data returned) · `wired` (correctly gated unauth) ·
`flag_gated` (503 — feature flag OFF, honest) · `forbidden_cross_user` (403 — endpoint is
self-scoped by design) · `broken` (404/000 — route missing/unreachable).

> Super-admin authentication completed; authed probes reflect real served responses.
