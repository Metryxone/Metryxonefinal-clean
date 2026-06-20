# Career Recommendation Report — Phase 4.7

**Phase:** 4.7 — Career Recommendation Engine
**Date:** 2026-06-20 · **Subject:** `demo_subj_pm`
**Flag:** `careerRecommendation` (default OFF) · **Route:** `routes/career-recommendation.ts` · **Smoke:** `smoke-career-recommendation.ts` → ✅ 22 passed / 0 failed
**Status:** Operational at engine/API level. Flag-gated, not deployed, not yet surfaced in user-facing UI.

## Purpose
Emit ranked career recommendations across **6 canonical groups in canonical order**, combining subject-personalized recommendations with market-only (catalog) recommendations.

## Composition (compose-only)
Composes the 4.x readiness/gap/development chain plus market/catalog data. Namespaced into `career-recommendation-aggregator` + `career_recommendation_*` tables so it does **not** clobber CGI `cg_user_recommendations` or the Phase-3.9 library/rules.

## Deliverables
- `services/career-recommendation-engine.ts` + `career-recommendation-aggregator.ts`
- `routes/career-recommendation.ts`
- `migrations/20260620_career_recommendation.sql` → `career_recommendation_library`, `career_recommendation_rules`, `career_recommendation_history`
- `careerRecommendation` flag

## Honesty constraints (verified by smoke)
- **Personalized** = the recommendation's CONTENT consumes the subject → inherits the chain confidence.
- **Catalog-only / market-only** recommendations are ALWAYS `personalized=false` + **Provisional**.
- Integrity invariant: `personalized_count + market_only_count === total_recommendations`; `by_type` sums correctly.
- Non-existent subject → honest empty/market-only envelope (`ok=true`), never a 500 and never fabricated personalization.

## Contract compliance
- **GET-never-writes:** a build creates NONE of the 3 `career_recommendation_*` tables (probed via `to_regclass` before/after); config reads from `defaults` until an admin seed runs.
- Seed (admin POST) creates schema + inserts inline defaults; config then reads from `db`.
- History append-only via explicit snapshot path only (smoke: second snapshot does not overwrite → count=2).
- Flag-OFF → 503; cleanup restores a pristine (defaults-source) dev DB.

## Smoke evidence (2026-06-20)
✅ 22 passed / 0 failed — append-only verified; rec tables dropped → dev DB pristine.

## Honest gaps
- Personalized depth is bounded by upstream chain coverage; market-only items remain Provisional by contract.
- Not consumed by any user-facing screen yet (no frontend wiring of `/api/career-recommendation`).
