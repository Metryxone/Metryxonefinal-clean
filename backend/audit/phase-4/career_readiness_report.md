# Career Readiness Report — Phase 4.3

**Phase:** 4.3 — Career Readiness Engine
**Date:** 2026-06-20 · **Subject:** `demo_subj_pm`
**Flag:** `careerReadiness` (default OFF) · **Route:** `routes/career-readiness.ts` · **Smoke:** `smoke-career-readiness.ts` → ✅ PASS
**Status:** Operational at engine/API level. Flag-gated, not deployed, not yet surfaced in user-facing UI.

## Purpose
Compose four sub-readiness axes into one career-readiness envelope keyed by subject:
- **Current readiness** — `career-readiness-engine`.
- **Future readiness** — `frp-readiness-engine` (FRP/FRI).
- **Role readiness** — `role-readiness-v2`.
- **Growth potential (headroom)** — `ei-profile-engine.growth_potential`.

Scores are **never re-derived** — the aggregator composes the upstream engine outputs.

## Deliverables
- `services/career-readiness-aggregator.ts` (pure, read-only, never-throws).
- `career_readiness_history` (append-only) — migration `20260620_career_readiness_history.sql` (flag-gated DDL).
- `routes/career-readiness.ts` — `GET /api/career-readiness/:subject` with `_meta`/`status`, IDOR guard, flag-OFF 503.

## Honesty constraints (verified)
- **Coverage vs Confidence reported per sub-readiness.** When FRP/future data is absent → `unmeasured`, never faked as 0.
- FRP/FRI confidence is **optimistic** (it counts zero-data sentinels), so Future measurability is gated on a provenance real-signal re-read, not on `FRI.confidence`.
- Critical-gap fit cap preserved (an already-ready subject does not get an inflated potential).

## Contract compliance
- Flag-OFF → 503, byte-identical (no DDL/writes). Flag-ON → 401 without auth. IDOR closed via super-admin.
- GET-never-writes; never-throws; append-only history (smoke: exactly one new row, cleaned up).

## Smoke evidence (2026-06-20)
✅ PASS — append-only: exactly one new row; smoke rows cleaned up.

## Honest gaps
- For the demo subject, future-readiness inputs are sparse → some axes report `unmeasured` (honest, expected).
- Not consumed by any user-facing readiness/graph screen yet (no frontend wiring of `/api/career-readiness`).
