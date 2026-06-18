---
name: EI Admin Health Panel (P-R3A)
description: EIHealthPanel + /api/admin/ei/* routes pattern for Employability Index SuperAdmin visibility.
---

## Rule
The EI system's admin health is served by `backend/routes/ei-admin.ts` (registered as `registerEIAdminRoutes`) with three endpoints: `GET /api/admin/ei/health`, `GET /api/admin/ei/events/summary`, `GET /api/admin/ei/data-quality`. All behind `requireAuth + requireSuperAdmin`.

## Why
EI health data spans 5 tables (occupations, skills, occupation_skills, occupation_pathways, ei_snapshot_versions). Keeping it in a dedicated admin route file instead of inline in routes.ts lets it be lazy-schema (ei_events created on first POST), independently cached, and independently testable.

## How to apply
- `ei_events` table is created lazily on first `POST /api/ei/events` call — don't pre-migrate.
- Cache key pattern: Map<string, {data, ts}> with TTL=60s, bust with `?refresh=1`.
- The `POST /api/ei/events` endpoint validates against an ALLOWED_EVENTS Set — add new event types there first.
- Frontend panel is `frontend/src/components/superadmin/EIHealthPanel.tsx`, nav id = `ei-health`, group label = "Employability Intelligence".

## Confidence on recommendations (P-R3A W2)
`Recommendation.confidence` (0–1) is computed deterministically from evidence quantity: gap certainty for competency_development, transferability score for transferable_strength, mobility composite for role_progression. Never subjectively tuned. `provenance` string array names the sources.
