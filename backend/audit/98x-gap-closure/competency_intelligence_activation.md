# Phase 2 — Competency Intelligence Spine Activation

**Task:** MX-98X-GAP-CLOSURE-IMPLEMENTATION · Phase 2
**Date:** 2026-06-23 · Additive / reversible / flag-gated. Evidence = live `count(*)` + route/service trace + `.agents/memory/competency-onet-three-system-silo.md`, `competency-runtime-dual-scoring-ledger.md`.

## Target spine
```
Assessment → Competency Scores → Competency Intelligence Layer → Employability Intelligence
   → Career Builder → Career Passport → Employer Intelligence → Workforce Intelligence → Market Intelligence
```

## Current state (evidence)
- Scoring produces **two ledgers**: rich scorer → `onto_competency_score_runs` (2), runtime `scoreInstance` → `onto_competency_profiles` (38, append-only, 1 row/run). Any "scored subjects" count must UNION both or runtime-scored subjects read as unscored.
- Three role→competency requirement sources coexist: curated `onto_role_weights` (44) / `onto_role_competency_profiles` (14) / O*NET `map_role_competency` (52,362).
- Downstream consumers read **different** competency sources: Employer reads `lbi_scores`/`cra_scores` (0); Career Builder `cg_user_*` (0); predictive reads behavioural, not competency.

## Gap = parallel paths + missing contracts (not missing engines)
| Gap | Evidence | Closure |
|---|---|---|
| Two scoring ledgers, no unified read | `onto_competency_score_runs` 2 vs `onto_competency_profiles` 38 | **Unified competency profile reader** that UNIONs both ledgers (latest-per-subject) |
| Employer not consuming competency | `lbi_scores`/`cra_scores` 0 | re-point employer match to `onto_competency_profiles` (Phase 3) |
| Career Builder not consuming competency | `cg_user_*` 0 | assessment→readiness automation (Phase 4) |
| No shared object contracts | each consumer shapes its own | **typed contracts**: UnifiedCompetencyProfile / Score / Recommendation / Gap |

## Implementation (additive, flag `FF_COMPETENCY_SPINE_CONTRACTS`, default OFF)
- New `services/competency-intelligence-contracts.ts` exporting pure types + a **read-only resolver** `resolveUnifiedCompetencyProfile(pool, subjectId)` that UNIONs both ledgers (never recomputes; inherits each ledger's confidence; null where unmeasured — never fake 0).
- Unified objects: `UnifiedCompetencyProfile`, `UnifiedCompetencyScore`, `UnifiedCompetencyRecommendation`, `UnifiedCompetencyGap` — adopted by new consumers; existing consumers unchanged until their phase.
- No new scoring math. The spine becomes "unified in data" by giving every downstream one canonical read.

## Architecture / Data / API impact
- **Architecture:** one new contracts module + one resolver; pure composition over existing tables. No engine edits.
- **Data:** zero DDL, zero writes — read-only resolver over existing tables (`to_regclass` probe + degrade).
- **API:** optional `GET /api/v2/competency-spine/profile/:subjectId` (flag-OFF 503). Existing endpoints untouched.

## Rollback strategy
- Flag OFF → resolver route 503; no consumer wired yet → zero impact. Delete the module to fully remove. No data to undo.

## Success metrics
- Unified read returns the same subject whether scored via rich or runtime ledger (UNION correctness on the 38+2 population).
- Zero parallel recomputation introduced (resolver only SELECTs).

## Expected maturity gain
- Competency spine connectivity: ~30% → ~55% (contracts + unified read; full gain realized as Phases 3–4 adopt it).

## Evidence ledger
- Counts → live `count(*)`, 2026-06-23. Dual-ledger + three-source facts → memory `competency-runtime-dual-scoring-ledger.md`, `competency-onet-three-system-silo.md` + prior `backend/audit/competency-onet-validation/*.md` (`da07dd93`). Maturity = reasoned estimate.
