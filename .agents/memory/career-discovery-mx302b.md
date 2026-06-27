---
name: Career Discovery & AI Guidance (MX-302B)
description: Flag-gated discovery layer running BEFORE Career Builder; composition-only over existing engines; gate + probe conventions.
---

# Career Discovery (MX-302B)

Flag `careerDiscovery` / `FF_CAREER_DISCOVERY` (default OFF, byte-identical incl. schema). Additive orchestration layer that runs a discovery experience BEFORE Career Builder, so guidance precedes recommendations.

## Composition-only (don't recompute)
- Discovery surfaces COMPOSE existing engines: match/simulation (explorer), recommendation/roadmap/development + AI coach (guidance), MEI (`computeMEIScore`) + LBI `learning_style` (`buildCompositeProfile(email,pool)`) in the profile. Only NET-NEW assessment is the light Values inventory (`career-discovery-values.ts`, pure scorer).
- Market explorer (`buildExplorerMarket`) composes `buildCareerIntelligence(pool,subjectId).career_readiness` (industries/functions items) + `listMarketDemands(pool,region,limit)` (salaries via salary_min/max/salary_currency, emerging via future_relevance_score, hiring_trend). Honest empty → [] + note, never fabricated.
- Guidance extra surfaces (daily_brief/weekly_goals/monthly_roadmap/competency_advice/industry_trends) are DERIVED deterministically from the already-composed recEnv/roadmapEnv/devEnv + market trends — rule-based labels, null≠0.

## Gate & probe conventions (review-enforced)
- **The Career Builder mount gate must run UNCONDITIONALLY** — a `?tab=` deep-link must NOT bypass it, or an incomplete user escapes discovery. Gate is satisfied only once status ∈ {completed,skipped} (derived `hasCompletedDiscovery`). An early `if (urlHasTab) return;` is the bypass bug.
- **`/enabled` probe is intentionally UNGATED**: always returns 200 `{enabled:false}` when OFF (no data, no DDL) so the frontend can cheaply detect flag state. Only DATA routes are gate-protected and 503 when OFF. Don't claim "every route 503s" in reports.

## Substrate keys
- `onto_competency_profiles` keys on `subject_id` (text) — there is NO `user_id` column. Battery presence probes + validation counts must key on `subject_id` (matches the match engine). See competency-ontology-architecture.md.

## Verify live
- Backend runs on tsx (not typechecked); root `tsconfig.json` is absent so `tsc --noEmit` surfaces pre-existing drizzle/node_modules + unrelated-file errors — only your own files matter. Real gate = frontend `vite build`. Founder validation: `cd backend && FF_CAREER_DISCOVERY=true npx tsx scripts/mx302b-founder-validation.ts`.
