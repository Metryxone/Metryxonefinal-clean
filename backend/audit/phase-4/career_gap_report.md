# Career Gap Report — Phase 4.4

**Phase:** 4.4 — Career Gap Engine
**Date:** 2026-06-20 · **Subject:** `demo_subj_pm`
**Flag:** `careerGap` (default OFF, `FF_CAREER_GAP=1` in workflow env) · **Route:** `routes/career-gap.ts` · **Smoke:** `smoke-career-gap.ts` → ✅ PASS
**Status:** Operational at engine/API level. Flag-gated, not deployed, not yet surfaced in user-facing UI.

## Purpose
Identify and prioritize competency/readiness gaps for a subject, bucketed into **now / next / later**.

## Composition (compose-only)
- `computeRoleReadinessV2().gap_areas` — the gap source.
- `onto_competency_type_map` — maps each gap to one of the **5 competency TYPE buckets** (behavioral / cognitive / functional / technical / future_skills); unmapped → `unclassified` (never fabricated).
- FRP / FRI — future-facing signal.
- Deterministic prioritization: `gap × weight` → now / next / later.

## Deliverables
- `services/career-gap-engine.ts`
- `routes/career-gap.ts`
- `migrations/20260620_career_gap_history.sql` (append-only `career_gap_history`)
- `careerGap` flag + `FF_CAREER_GAP=1` workflow env

## Honesty constraints (verified)
- **GET-never-writes proven across all 12 transitive competency-runtime relations.** A `competencyRuntimeReady()` probe (4 tables + 8 indexes) gates the composed role-readiness path so a GET creates no schema; if the runtime is unprovisioned the engine degrades to an honest gap-absent envelope.
- Unmapped competency types are surfaced as `unclassified`, never force-fitted into a TYPE bucket.

## Contract compliance
- Flag-OFF → 503, byte-identical including schema. Flag-ON → 401 without auth. IDOR closed via super-admin.
- Never-throws; append-only history (smoke: exactly one new row, cleaned up).

## Smoke evidence (2026-06-20)
✅ PASS — append-only: exactly one new row; cleaned up. (Architect review for 4.4: **GO**, GET-never-writes proven.)

## Honest gaps
- For a high-readiness subject, gap output can legitimately be small/empty — that is an honest finding, not a failure.
- Not consumed by any user-facing screen yet.
