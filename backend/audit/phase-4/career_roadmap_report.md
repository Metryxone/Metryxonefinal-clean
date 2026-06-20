# Career Roadmap Report — Phase 4.5

**Phase:** 4.5 — Career Roadmap Engine
**Date:** 2026-06-20 · **Subject:** `demo_subj_pm`
**Flag:** `careerRoadmap` (default OFF) · **Route:** `routes/career-roadmap.ts` · **Smoke:** `smoke-career-roadmap.ts` → ✅ PASS
**Status:** Operational at engine/API level. Flag-gated, not deployed, not yet surfaced in user-facing UI.

## Purpose
Sequence prioritized gaps and development items into a forward-looking roadmap (milestones / phases) for a subject, reusing the existing M5 growth-plan mechanisms rather than building a new plan store.

## Composition (compose-only)
Consumes **4.4 Career Gap** prioritization (now/next/later) and readiness headroom from **4.3**; orders milestones deterministically. Reuses existing growth-plan infrastructure (no parallel plan tables).

## Deliverables
- `services/career-roadmap-engine.ts`
- `routes/career-roadmap.ts`
- `migrations/20260620_career_roadmap_history.sql` (append-only `career_roadmap_history`)
- `careerRoadmap` flag

## Honesty constraints (verified)
- Roadmap milestone counts are **populated-only** — the engine does not count empty scaffold slots as completed milestones.
- When no gaps/datapoints exist, the roadmap is honestly sparse/empty rather than padded.
- Outputs are developmental sequencing, never promotion timelines or guarantees.

## Contract compliance
- Flag-OFF → 503, byte-identical. Flag-ON → 401 without auth. IDOR closed via super-admin.
- GET-never-writes; never-throws; append-only history (smoke: exactly one new row, cleaned up).

## Smoke evidence (2026-06-20)
✅ PASS — append-only: exactly one new row; smoke rows cleaned up.

## Honest gaps
- Roadmap richness is bounded by upstream gap coverage; a high-readiness subject yields a short roadmap (honest).
- Not consumed by any user-facing screen yet (no frontend wiring of `/api/career-roadmap`).
