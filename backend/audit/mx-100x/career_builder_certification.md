# Section 8 — Career Builder & Career Graph Certification

**Verdict: PARTIAL (structure + engines PASS; user activation FAIL — zero seekers).**

Career Builder is architecturally one of the deepest surfaces (Career Operating System: 23 `career_*`
tables, 17 `cg_*` graph tables, pure engines, Zustand stores, additive intelligence layers). It is
held at PARTIAL by a stark fact: **no real users have activated it** — every per-user table is empty.

## 8.1 Career Graph content — PASS (catalog)
- `cg_roles` = 200 (role catalog), plus role-edge / track / skill-requirement / readiness-weight
  reference tables. The graph backbone exists.
- Career match honesty (4.2): `cg_roles` has **no per-role requirements**, so only the anchor match is
  requirement-backed; all other matches are correctly capped at **Provisional** regardless of Match%.
  Match% (rank) and confidence (backing) are kept on separate axes.

## 8.2 User activation — FAIL (zero)
| Table | Count |
|---|---:|
| career_seeker_profiles | 1 |
| cg_user_role_readiness / _skill_gaps / _recommendations / _career_path / _activation_runs | 0 |
| career_seeker_jobs / _goals | 0 |
| career_recommendations / career_outcomes / career_simulation_runs | 0 |
- One profile, **zero** readiness runs, skill gaps, recommendations, paths, goals, jobs, or outcomes.
  The Career Operating System has never been driven by a real user at volume.

## 8.3 Intelligence engines — PASS (compose-only), unexercised
- The 4.x compose family (readiness / gap / match / roadmap / recommendation / signal / development)
  is **compose-only** (re-shapes already-computed data, never recomputes), flag-gated, GET-never-
  writes, with honest null≠0 handling and zero-base trend guards (Number(null)≠measured 0).
- IDOR is guarded (`resolveEffectiveUserId`) at both enrichment and route level.
- These engines are correctly built but, with 0 user data, produce **honest empty / high-readiness-by-
  absence** results — which is the right behavior, not a bug.

## 8.4 CAPADEX → Career behavior bridge — PASS (additive, gated)
- The bridge is pure and adopted **only when `session_id` is non-null**; consumers take an optional
  `behavior?` arg (absent → byte-identical). With CAPADEX sessions = 0 in this DB, the bridge is
  correctly inert. Per-job ranking modifiers key off a per-row feature, not a user scalar.

## 8.5 Confidence vs Coverage
- **Coverage:** full engine + 200-role catalog reachable. **Confidence:** unproven — 1 profile,
  0 activation runs, requirements only for the anchor role.

## 8.6 Certification table
| Sub-area | Verdict | Evidence |
|---|---|---|
| Career graph catalog | PASS | cg_roles 200 + reference tables |
| Intelligence engines (4.x) | PASS (compose-only) | flag-gated, IDOR-guarded, honest null handling |
| Per-role requirements | PARTIAL | only anchor match requirement-backed; rest Provisional |
| User activation (Usage) | FAIL | 1 profile, all cg_user_* = 0 |

**Net: PARTIAL.** A deep, well-disciplined career system that is essentially pre-launch on the demand
side. Certification requires real seeker activation (profiles → readiness runs → recommendations).
