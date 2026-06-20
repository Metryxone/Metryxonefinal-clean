# Career Simulation Report — Phase 4.8

**Phase:** 4.8 — Career Simulation Engine
**Date:** 2026-06-20 · **Subject:** `demo_subj_pm`
**Flag:** `careerSimulation` (default OFF) · **Route:** `routes/career-simulation.ts` · **Smoke:** `smoke-career-simulation.ts` → ✅ PASS
**Status:** Operational at engine/API level. Flag-gated, not deployed, not yet surfaced in user-facing UI.

## Purpose
Run "what-if" career simulations — project how readiness / fit would shift if specified competency or readiness levels changed — to support developmental planning (never a guarantee of outcome).

## Composition (compose-only)
Composes the competency runtime baseline + 4.3 readiness; applies scenario deltas and recomposes the downstream readiness view. It does not re-derive upstream raw scores; it perturbs inputs and re-runs the composition.

## Deliverables
- `services/career-simulation-engine.ts`
- `routes/career-simulation.ts`
- `migrations/20260620_career_simulation_runs.sql` (append-only `career_simulation_runs`)
- `careerSimulation` flag

## Honesty constraints (verified)
- A simulation can only project from a **measured baseline**. The smoke surfaced the honest coverage note: *"0/4 measurable onto-domains have a measured baseline level"* for the demo subject — when a baseline is absent, the engine reports it as unmeasurable rather than simulating from a fabricated zero.
- Coverage (which domains have a baseline) and Confidence (how trustworthy the projection is) are separate axes.
- Outputs are developmental projections, never hiring/promotion predictions.

## Contract compliance
- Flag-OFF → 503, byte-identical. Flag-ON → 401 without auth. IDOR closed via super-admin.
- GET-never-writes; never-throws; append-only runs (smoke cleaned up its rows).

## Smoke evidence (2026-06-20)
✅ PASS — honest unmeasurable-baseline note emitted; smoke rows cleaned up.

## Honest gaps
- For the demo subject there is no measured onto-domain baseline, so projections are correctly reported as unmeasurable — this is an honest data-coverage finding, not an engine defect.
- Not consumed by any user-facing screen yet (no frontend wiring of `/api/career-simulation`).
