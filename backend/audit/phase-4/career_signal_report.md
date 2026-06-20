# Career Signal Report — Phase 4.10

**Phase:** 4.10 — Career Signal Engine
**Date:** 2026-06-20 · **Subject:** `demo_subj_pm`
**Flag:** `careerSignal` (default OFF, `FF_CAREER_SIGNAL=1` in workflow env) · **Route:** `routes/career-signal.ts` · **Smoke:** `smoke-career-signal.ts` → ✅ 25 passed / 0 failed
**Status:** Operational at engine/API level. Flag-gated, not deployed, not yet surfaced in user-facing UI.

## Purpose
Compose **seven developmental signals** for a subject:
Career Potential · Leadership Potential · Technical Potential · Growth Potential · Promotion Potential · Career Risk · Career Stagnation Risk.

## Composition (compose-only)
Composes `getProfile` (competency runtime) + `buildEiProfile` + **4.3** `buildCareerReadiness` + **4.4** `buildCareerGap`. All four sources are gated behind a `competencyRuntimeReady()` probe so a GET creates no schema.

## Deliverables
- `services/career-signal-engine.ts`
- `routes/career-signal.ts`
- `migrations/20260620_career_signal.sql` → `career_signal_library` + `career_signal_rules` (+ history)
- `careerSignal` flag + `FF_CAREER_SIGNAL=1` workflow env
- `scripts/smoke-career-signal.ts`

## Config-as-data
`career_signal_library` + `career_signal_rules` override the in-code `DEFAULT_SIGNAL_LIBRARY` / `DEFAULT_SIGNAL_RULES` when present; admin CRUD is the **only** write/DDL path. Config readers use `to_regclass` + defaults fallback (verified: source=`defaults`, 7 library items, both band sets present).

## Honesty constraints (verified by smoke)
- **Coverage** (present / declared inputs) and **Confidence** (inherited weakest source band, never re-derived) are SEPARATE axes.
- **Promotion Potential** is framed strictly as DEVELOPMENTAL, never a prediction.
- Fixed a `clampScore(null) → 0` fabrication bug — now guards `null/undefined/''` before `Number()` so an absent input never becomes a measured 0.

## Contract compliance
- Flag-OFF → 503, byte-identical including schema (before any DB touch). Flag-ON → 401 without auth. IDOR closed via super-admin.
- GET-never-writes; never-throws; invalid POST hardened to 400.

## Smoke evidence (2026-06-20)
✅ 25 passed / 0 failed — library/rules source=defaults; band sets present.

## Honest gaps
- Signal confidence is capped by the weakest composed source band — sparse upstream data ⇒ lower-confidence signals (honest).
- Not consumed by any user-facing screen yet (no frontend wiring of `/api/career-signal`).
