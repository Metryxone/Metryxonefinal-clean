# Career Development Report — Phase 4.6

**Phase:** 4.6 — Career Development Engine
**Date:** 2026-06-20 · **Subject:** `demo_subj_pm`
**Flag:** `careerDevelopment` (default OFF) · **Route:** `routes/career-development.ts` · **Smoke:** `smoke-career-development.ts` → ✅ PASS
**Status:** Operational at engine/API level. Flag-gated, not deployed, not yet surfaced in user-facing UI.

## Purpose
Turn EI recommendations and prioritized gaps into concrete development items across the **5 real competency TYPES** (behavioral / cognitive / functional / technical / future_skills).

## Composition (compose-only)
Composes the prior 4.x chain (readiness/gap) + EI recommendations. There is **no "Leadership" competency type** — leadership is represented THROUGH the other five via a `taxonomy_note`, never fabricated as its own type.

## Deliverables
- `services/career-development-engine.ts`
- `routes/career-development.ts`
- `migrations/20260620_career_development_history.sql` (append-only `career_development_history`)
- `careerDevelopment` flag

## Honesty constraints (verified)
- Development tracking is `null`-aware (`null ≠ 0`); an absent baseline is not scored as zero.
- The emitted / not-applicable / withheld accounting from the EI recommendation layer is preserved through to development items.
- Flag-OFF byte-identical (DDL gated); GET-never-writes.

## Contract compliance
- Flag-OFF → 503. Flag-ON → 401 without auth. IDOR closed via super-admin. Never-throws.

## Smoke evidence (2026-06-20)
✅ PASS — overall trend stable vs identical baseline; smoke rows cleaned up.

## Honest gaps
- Item richness is bounded by upstream recommendation/gap coverage.
- Not consumed by any user-facing screen yet (no frontend wiring of `/api/career-development`).
