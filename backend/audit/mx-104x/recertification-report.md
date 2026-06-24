# MX-104X — Candidate & Career Ecosystem Re-Certification Report

_Generated 2026-06-24T15:39:47.757Z · engine v104.0.0 · read-only · no DDL · no writes_

> **Structural ⟂ Activation.** Structural = the machinery (tables/routes/services) EXISTS.
> Activation = live runtime data has flowed through it. These are SEPARATE axes; the verdict
> below is STRUCTURAL only. Low activation with high structural readiness is the HONEST early-
> adoption state — it is NOT a failure and is NEVER composited into the structural score.

## Verdict

- **Structural verdict:** `PASS` (axis: structural / machinery presence)
- **Structural readiness:** 100% (16/16 journey key tables present)
- **Activation:** 2/5 journey steps have live runtime data
- 2/5 journey steps have live runtime data (honest early-adoption state).

## Founder Counts (registered candidates per stage)

_Registered = users excluding super_admin + `@example.com` demo accounts. Funnel anchored on this population._

| Stage | Count | Conversion |
|-------|------:|-----------:|
| Registered | 0 | — |
| Assessed | 0 | _not measurable_ of registered |
| Employability profile | 0 | — |
| Career Builder | 0 | — |
| Career Passport | 0 | _not measurable_ of registered |

## Journey Analytics (per-step conversion / drop-off)

| Transition | From | To | Conversion | Drop-off |
|-----------|-----:|---:|-----------:|---------:|
| Registered → Assessment Scored | 0 | 0 | _not measurable_ | _n/a_ |
| Assessment Scored → Employability Profile | 0 | 0 | _not measurable_ | _n/a_ |
| Employability Profile → Career Builder | 0 | 0 | _not measurable_ | _n/a_ |
| Career Builder → Career Passport | 0 | 0 | _not measurable_ | _n/a_ |

_Conversion/drop-off is `n/a` when the denominator stage is empty or unmeasurable — never a fabricated rate._

## Subsystem Activation (live data)

### Career Builder
- Activation runs: 0 · Distinct users: 0
- Role DNA graph roles: 200 · Career paths: 0
- Role recommendations: 0 · Skill gaps: 0 · Development recs: 0
- Role readiness rows: 0

### Employability
- FRI readiness rows: 0 · FRI distinct users: 0
- Career-readiness profiles: 0 · LBI scores: 0

### Career Passport
- Foundation snapshots: 4 · Distinct subjects: 1
- Sections present — competency: 4 · employability: 4 · career: 0 · readiness: 4
- Achievements: 16 · Journey events: 24 · Avg coverage: 83% · Measurable subjects: 4
- careerPassport (cp_*): _schema not materialized (flag OFF / never activated) — null, not 0_

## Raw Data Volume (not funnel — reported separately)

_Subject-level totals that may exceed registered users (e.g. seeded competency history). Kept separate by design so the funnel stays honest._

- Competency-history subjects: 5
- CRA-scored subjects: 0
- Behavioural CAPADEX users: 0 · reports: 0
- Career-seeker profiles: 1

## Re-Certification Questions (Phase 6)

| # | Question | Structural | Activation | Answer |
|---|----------|:----------:|:----------:|--------|
| 1. Is candidate onboarding complete? | ✓ | no data | YES (structural) — registration + identity + career-seeker profile machinery present. |
| 2. Is assessment integration complete? | ✓ | live | YES (structural) — competency + behavioural (CAPADEX) assessment scoring present. |
| 3. Is employability integration complete? | ✓ | no data | YES (structural) — FRI readiness + career-readiness profile machinery present. |
| 4. Is career builder operational? | ✓ | no data | YES (structural) — paths/recommendations/skill-gaps/readiness machinery present. |
| 5. Is passport operational? | ✓ | live | YES (structural) — Career Passport Foundation snapshot machinery present. |
| 6. Is journey wiring intact (no rewires)? | ✓ | n/a | YES — this engine is additive read-only; it reads existing journey tables and changes no wiring. |
| 7. Are Structural & Activation reported separately (no inflation)? | ✓ | n/a | YES — separate axes throughout; verdict is structural-only; null≠0 preserved. |
| 8. Is flag-OFF byte-identical (no new schema)? | ✓ | n/a | YES — flag ecosystemActivation default OFF; routes 503 before DB touch; service defines NO DDL. |

## Structural — Journey Key Table Presence

| Table | Present |
|-------|:-------:|
| `users` | ✓ |
| `capadex_users` | ✓ |
| `capadex_sessions` | ✓ |
| `capadex_reports` | ✓ |
| `cra_scores` | ✓ |
| `cra_profiles` | ✓ |
| `p4_competency_history` | ✓ |
| `frp_user_readiness` | ✓ |
| `cg_user_activation_runs` | ✓ |
| `cg_user_role_readiness` | ✓ |
| `cg_user_recommendations` | ✓ |
| `cg_user_skill_gaps` | ✓ |
| `cg_user_learning_recs` | ✓ |
| `cg_user_career_path` | ✓ |
| `career_seeker_profiles` | ✓ |
| `career_passport_snapshots` | ✓ |

## Remaining Blockers (honest)

**Structural:**
- None — all journey key tables present.

**Activation (runtime adoption — NOT a structural failure):**
- No registered candidates yet (runtime adoption).
- No employability profiles generated yet.
- No career-builder activations yet.

---

_Read-only composition over already-built tables. Developmental/operational signals only —
NOT hiring/promotion/suitability predictions. No flag flips, no inflation, no deploy._