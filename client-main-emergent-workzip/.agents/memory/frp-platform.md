---
name: Future Readiness Platform (FRP)
description: Architecture and registration conventions for the FRP — flag-gated additive layer on top of career/CAPADEX stack.
---

## Feature flag
`FF_FUTURE_READINESS=1` — in Backend API workflow command alongside all other flags.

## Tables (all `frp_*`)
`frp_skill_library`, `frp_skill_domain`, `frp_ai_impact`, `frp_automation_risk`,
`frp_industry_forecast`, `frp_role_evolution`, `frp_user_skill_profile`,
`frp_readiness_snapshots` (append-only), `frp_recommendations`, `frp_cohort_benchmarks`.

Schema+seed: `backend/services/frp-schema-seed.ts` (`ensureFRPSchema` + `seedFRPData`).

## FRI scoring
`backend/services/frp-readiness-engine.ts` — 5-signal composite 0–100.
Bands: emerging / developing / capable / resilient / pioneering.

## Route file
`backend/routes/frp.ts` — exports `registerFRPRoutes(app, pool, requireAuth, requireSuperAdmin)`.
Registered in `backend/routes.ts` after LIP via dynamic import.
Route prefix: `/api/frp/*` (user) and `/api/admin/frp/*` (admin).
Key route names: `/api/frp/overview`, `/api/frp/skill-landscape`, `/api/frp/ai-impact`,
`/api/frp/automation-risk`, `/api/frp/industry-forecast`, `/api/frp/role-evolution`,
`/api/frp/recommendations`, `/api/frp/benchmark`, `/api/frp/snapshots`.
Note: there is NO `/api/frp/skills` — it is `/api/frp/skill-landscape`.

## Frontend wiring
- Tab: id=`future-readiness`, zone=`intelligence`, component=`FutureReadinessTab.tsx` (1609 lines)
- Admin nav: id=`frp-admin`, group="Future Readiness Intelligence", component=`FRPDesignPanel.tsx`
- `Zap` icon used in both; added to `useAdminDashboardState.tsx` lucide imports.
- FutureReadinessTab has two nav sections: "Platform Intelligence" (6 tabs) + "Intelligence Products" (5 tabs, pink accent)
- Product tab IDs: `skills-planner`, `ai-navigator`, `transition-planner`, `entrepreneurship`, `emerging-careers`
- Product routes: `/api/frp/products/skills-planner|ai-navigator|transition-planner|entrepreneurship|emerging-careers`
- Products compose frp_* tables ONLY — no new engines or DDL; `/api/frp/products/*` are all `requireAuth`
- Entrepreneurship tab shows an honest `corpus_note` disclosure (proxy scoring until OPPORTUNITY_RECOGNITION construct lands)

## Activation layer (closed gaps)
- `frp_skill_library.construct_key` (VARCHAR 80) added lazily via ADD COLUMN IF NOT EXISTS; 41/41 skills mapped to CAPADEX construct vocab (RESILIENCE, CRITICAL_THINKING, SKILL_AWARENESS, COMMUNICATION, SOCIAL_CONFIDENCE, CREATIVITY, GOAL_ORIENTATION, LEARNING_DRIVE, IMPULSE_CONTROL, INTRINSIC_MOTIVATION). This is the keystone that connects FRP skills to the CAPADEX session signal pipeline.
- WC-3 outcome models seeded: `ai_career_readiness`, `career_transition_readiness`, `future_skills_readiness` (non-gated); `entrepreneurship_readiness` (gated=true, OPPORTUNITY_RECOGNITION deferred). Journey route `future_readiness` → `/career-builder?tab=future-readiness`, corpus_status=ready.
- Mentor bridge: `career_transition_coach` added to `MentorType` union + mapped in `OUTCOME_MENTOR_MAP` for all 4 FRP outcome models. (`backend/services/wc7b/mentor-bridge.ts`)

**Why:** additive pattern mirrors LIP exactly — dynamic import in routes.ts, flag gate middleware, lazy ensureSchema on startup.
